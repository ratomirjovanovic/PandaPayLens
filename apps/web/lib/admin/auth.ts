import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { passkey } from "@better-auth/passkey";
import { after } from "next/server";
import * as schema from "@/db/schema";
import { adminConfig } from "./config";
import { getDb } from "./db";
import { sendMagicLinkEmail } from "./email";
import {
  audit,
  consumeMagicLinkQuota,
  loadPrincipal,
  logSecurityEvent,
  markSessionMfa,
  mayReceiveMagicLink,
  onPasskeyRemoved,
  onUserCreated,
  passkeyChangeDenial,
  recordLogin,
  sessionAllowed,
  signInFailure,
} from "./services";

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
          // form can't be used to discover administrators. Both branches do
          // their remaining work after the response: waiting for Resend, or
          // failing on a delivery error, would make allowed addresses
          // observable through timing or status.
          if (!(await mayReceiveMagicLink(db, email, cfg.bootstrapEmail))) {
            // No known actor, so the server log rather than the audit table.
            after(() => logSecurityEvent("auth.magic_link_refused"));
            return;
          }
          after(async () => {
            if (!(await consumeMagicLinkQuota(db, email))) {
              logSecurityEvent("auth.magic_link_throttled");
              return;
            }
            await sendMagicLinkEmail(cfg, email, url).catch((e) =>
              console.error(e instanceof Error ? e.message : "Email delivery failed."),
            );
          });
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
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED");
        const p = await loadPrincipal(db, session.session.id, session.user.id);
        if (!p || p.status !== "active") throw new APIError("FORBIDDEN");
        const denial = await passkeyChangeDenial(db, p, ctx.path);
        if (denial) throw new APIError("FORBIDDEN", { message: denial });
      }),
      after: createAuthMiddleware(async (ctx) => {
        const returned = ctx.context.returned;
        const failure = signInFailure(ctx.path, returned);
        if (failure) logSecurityEvent("auth.sign_in_failed", failure);
        const session = ctx.context.session;
        if (isAPIError(returned) || !session) return;
        const actorId = session.user.id;
        if (ctx.path === "/passkey/verify-registration")
          await audit(db, {
            actorId,
            action: "auth.mfa_enrolled",
            resourceType: "passkey",
            outcome: "success",
            metadata: { method: "passkey" },
          });
        else if (ctx.path === "/passkey/delete-passkey")
          await onPasskeyRemoved(db, actorId, session.session.id);
        else if (ctx.path === "/passkey/update-passkey")
          await audit(db, {
            actorId,
            action: "auth.passkey_renamed",
            resourceType: "passkey",
            outcome: "success",
          });
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
            if (!(await sessionAllowed(db, session.id ?? crypto.randomUUID(), session.userId)))
              return false;
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
