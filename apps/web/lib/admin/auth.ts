import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { passkey } from "@better-auth/passkey";
import * as schema from "@/db/schema";
import { adminConfig } from "./config";
import { getDb } from "./db";
import { sendMagicLinkEmail } from "./email";
import {
  audit,
  loadPrincipal,
  markSessionMfa,
  mayReceiveMagicLink,
  onUserCreated,
  recordLogin,
} from "./services";
import { FRESH_MAX_AGE_MS } from "./authz";

/** Paths that change a user's passkeys. */
const PASSKEY_MUTATIONS = [
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
];

function createAuth() {
  const cfg = adminConfig();
  if (!cfg) throw new Error("Administration is not configured.");
  const db = getDb();
  const host = new URL(cfg.baseUrl).hostname;

  return betterAuth({
    appName: "PandaPayLens Admin",
    baseURL: cfg.baseUrl,
    basePath: "/api/auth",
    secret: cfg.authSecret,
    trustedOrigins: [cfg.baseUrl],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        passkey: schema.passkeys,
        rateLimit: schema.rateLimits,
      },
    }),
    // No passwords, no public sign-up: magic link for identity, passkey for MFA.
    emailAndPassword: { enabled: false },
    user: {
      additionalFields: {
        status: { type: "string", input: false, defaultValue: "active" },
        lastLoginAt: { type: "date", input: false, required: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: cfg.baseUrl.startsWith("https://"),
      cookiePrefix: "ppl",
      defaultCookieAttributes: { sameSite: "strict", httpOnly: true },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/magic-link": { window: 300, max: 5 },
        "/passkey/verify-authentication": { window: 60, max: 10 },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        disableSignUp: false, // gated by mayReceiveMagicLink and the user.create hook
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          // Respond identically whether or not the address is allowed, so the
          // form can't be used to discover administrators.
          if (!(await mayReceiveMagicLink(db, email, cfg.bootstrapEmail))) {
            await audit(db, {
              actorId: null,
              action: "auth.magic_link_refused",
              resourceType: "session",
              outcome: "denied",
            });
            return;
          }
          await sendMagicLinkEmail(cfg, email, url);
        },
      }),
      passkey({
        rpID: host,
        rpName: "PandaPayLens Admin",
        origin: cfg.baseUrl,
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      }),
      nextCookies(),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!PASSKEY_MUTATIONS.includes(ctx.path)) return;
        // Enrolling the first passkey only needs the email session. Changing
        // passkeys after that requires a fresh passkey challenge, so control of
        // the mailbox alone can never add a new second factor.
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED");
        const p = await loadPrincipal(db, session.session.id, session.user.id);
        if (!p || p.status !== "active") throw new APIError("FORBIDDEN");
        if (
          !p.hasPasskey &&
          ctx.path !== "/passkey/delete-passkey" &&
          ctx.path !== "/passkey/update-passkey"
        )
          return;
        if (!p.mfaVerifiedAt || Date.now() - p.mfaVerifiedAt.getTime() > FRESH_MAX_AGE_MS) {
          await audit(db, {
            actorId: p.userId,
            action: "auth.passkey_change_denied",
            resourceType: "passkey",
            outcome: "denied",
          });
          throw new APIError("FORBIDDEN", { message: "Verify with an existing passkey first." });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/passkey/verify-registration" && ctx.context.session) {
          await audit(db, {
            actorId: ctx.context.session.user.id,
            action: "auth.mfa_enrolled",
            resourceType: "passkey",
            outcome: "success",
            metadata: { method: "passkey" },
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!(await mayReceiveMagicLink(db, user.email, cfg.bootstrapEmail))) return false;
            return { data: { ...user, email: user.email.trim().toLowerCase() } };
          },
          after: async (user) => {
            await onUserCreated(db, { id: user.id, email: user.email }, cfg.bootstrapEmail);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const p = await loadPrincipal(db, session.id ?? crypto.randomUUID(), session.userId);
            if (!p || p.status !== "active") return false;
          },
          after: async (session, ctx) => {
            const method =
              ctx?.path === "/passkey/verify-authentication" ? "passkey" : "magic_link";
            await recordLogin(db, session.userId, method);
            if (method === "passkey")
              await markSessionMfa(db, session.id, session.userId, "passkey");
          },
        },
      },
    },
  });
}

let instance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}
