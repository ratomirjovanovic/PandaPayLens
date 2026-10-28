/**
 * Administrative operations. Every exported operation takes the caller's
 * Principal and calls authorize() itself, so authorization does not depend
 * on route middleware.
 */
import { createHash } from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  adminInvitations,
  auditLogs,
  catalogReleases,
  magicLinkSends,
  passkeys,
  providerCatalog,
  roles,
  ruleDrafts,
  sessionMfa,
  sessions,
  systemSettings,
  userRoles,
  users,
} from "@/db/schema";
import { authorize, AuthzError, FRESH_MAX_AGE_MS } from "./authz";
import type { Db, Principal, RoleCode } from "./types";

export class ServiceError extends Error {
  constructor(
    readonly code: "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT" | "LAST_SUPERADMIN",
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

type Ctx = { db: Db; principal: Principal | null; requestId?: string; now?: Date };

const now = (c: { now?: Date }) => c.now ?? new Date();

// ---------------------------------------------------------------- audit

export type AuditEntry = {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: "success" | "failure" | "denied";
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/** Metadata must be small, flat and free of payment data or secrets. */
export async function audit(db: Db, e: AuditEntry): Promise<void> {
  const meta = e.metadata
    ? Object.fromEntries(
        Object.entries(e.metadata).map(([k, v]) => [
          k.slice(0, 64),
          typeof v === "string" ? v.slice(0, 256) : v,
        ]),
      )
    : null;
  await db.insert(auditLogs).values({
    actorId: e.actorId,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId ?? null,
    outcome: e.outcome,
    requestCorrelationId: e.requestId ?? null,
    safeMetadata: meta,
  });
}

/**
 * Security events without a known actor go to the server log as one JSON
 * line instead of the audit table, so anonymous traffic cannot grow the
 * append-only log. Fields must be free of payment data, secrets and emails.
 */
export function logSecurityEvent(
  event: string,
  fields: Record<string, string | number | null> = {},
): void {
  console.warn(JSON.stringify({ security_event: event, ...fields }));
}

/** Authorize and record denials, so privilege probing shows up in the audit log. */
async function guard(
  c: Ctx,
  action: string,
  req: { role: RoleCode; fresh?: boolean },
): Promise<Principal> {
  try {
    return authorize(c.principal, req, now(c).getTime());
  } catch (e) {
    if (e instanceof AuthzError && c.principal) {
      await audit(c.db, {
        actorId: c.principal.userId,
        action,
        resourceType: "authorization",
        outcome: "denied",
        requestId: c.requestId,
        metadata: { reason: e.code },
      });
    } else if (e instanceof AuthzError) {
      logSecurityEvent("authorization.denied", {
        action,
        reason: e.code,
        requestId: c.requestId ?? null,
      });
    }
    throw e;
  }
}

// ---------------------------------------------------------------- principal

export async function loadPrincipal(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<Principal | null> {
  const [u] = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  if (!u) return null;
  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
  const [mfa] = await db
    .select({ verifiedAt: sessionMfa.verifiedAt })
    .from(sessionMfa)
    .where(eq(sessionMfa.sessionId, sessionId));
  const [pk] = await db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId));
  return {
    userId: u.id,
    email: u.email,
    sessionId,
    status: u.status,
    roles: roleRows
      .map((r) => r.code)
      .filter((r): r is RoleCode => r === "admin" || r === "superadmin"),
    mfaVerifiedAt: mfa?.verifiedAt ?? null,
    hasPasskey: (pk?.n ?? 0) > 0,
  };
}

/**
 * Policy for passkey changes made through the auth endpoints. Enrolling the
 * first passkey only needs the email session. Any change after that needs a
 * fresh passkey challenge, so control of the mailbox alone can never add or
 * remove a second factor, and the last passkey can never be deleted.
 * Returns the reason for a denial, or null when the change may proceed.
 */
export async function passkeyChangeDenial(
  db: Db,
  p: Principal,
  path: string,
  at = new Date(),
): Promise<string | null> {
  const enrolling =
    path === "/passkey/generate-register-options" || path === "/passkey/verify-registration";
  if (!p.hasPasskey && enrolling) return null;
  let reason: { code: string; message: string } | null = null;
  if (!p.mfaVerifiedAt || at.getTime() - p.mfaVerifiedAt.getTime() > FRESH_MAX_AGE_MS) {
    reason = { code: "MFA_NOT_FRESH", message: "Verify with an existing passkey first." };
  } else if (path === "/passkey/delete-passkey") {
    const [pk] = await db
      .select({ n: count() })
      .from(passkeys)
      .where(eq(passkeys.userId, p.userId));
    if ((pk?.n ?? 0) <= 1)
      reason = {
        code: "LAST_PASSKEY",
        message: "Register another passkey before removing the last one.",
      };
  }
  if (!reason) return null;
  await audit(db, {
    actorId: p.userId,
    action: "auth.passkey_change_denied",
    resourceType: "passkey",
    outcome: "denied",
    metadata: { reason: reason.code },
  });
  return reason.message;
}

// ---------------------------------------------------------------- sign-in policy

const normEmail = (e: string) => e.trim().toLowerCase();

/**
 * Whether a magic link may be sent / an account created for this email:
 * an existing active user, an open invitation, or the bootstrap identity
 * while no superadmin exists. Callers must not reveal the answer.
 */
export async function mayReceiveMagicLink(
  db: Db,
  email: string,
  bootstrapEmail: string,
  at = new Date(),
): Promise<boolean> {
  const e = normEmail(email);
  const [u] = await db
    .select({ status: users.status })
    .from(users)
    .where(sql`lower(${users.email}) = ${e}`);
  if (u) return u.status === "active";
  if (await openInvitation(db, e, at)) return true;
  return e === bootstrapEmail && !(await superadminExists(db));
}

async function openInvitation(db: Db, email: string, at: Date) {
  const [inv] = await db
    .select()
    .from(adminInvitations)
    .where(
      and(
        sql`lower(${adminInvitations.invitedIdentity}) = ${email}`,
        isNull(adminInvitations.acceptedAt),
        isNull(adminInvitations.revokedAt),
        gt(adminInvitations.expiresAt, at),
      ),
    )
    .orderBy(desc(adminInvitations.createdAt))
    .limit(1);
  return inv ?? null;
}

async function superadminExists(db: Db) {
  const [r] = await db
    .select({ n: count() })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(eq(roles.code, "superadmin"), isNull(userRoles.revokedAt), eq(users.status, "active")),
    );
  return (r?.n ?? 0) > 0;
}

async function roleId(db: Db, code: RoleCode) {
  const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, code));
  if (!r) throw new Error(`Role ${code} is not seeded.`);
  return r.id;
}

/**
 * Runs once after a new account is created. Grants the role from an open
 * invitation (single use), or bootstraps the first superadmin. Idempotent:
 * the bootstrap identity gains nothing once a superadmin exists.
 */
export async function onUserCreated(
  db: Db,
  user: { id: string; email: string },
  bootstrapEmail: string,
  at = new Date(),
): Promise<void> {
  const email = normEmail(user.email);
  const inv = await openInvitation(db, email, at);
  if (inv) {
    const claimed = await db
      .update(adminInvitations)
      .set({ acceptedAt: at, acceptedBy: user.id })
      .where(and(eq(adminInvitations.id, inv.id), isNull(adminInvitations.acceptedAt)))
      .returning({ id: adminInvitations.id });
    if (claimed.length) {
      await db.insert(userRoles).values({
        userId: user.id,
        roleId: await roleId(db, inv.targetRole as RoleCode),
        grantedBy: inv.invitedBy,
        grantedAt: at,
      });
      await audit(db, {
        actorId: user.id,
        action: "invitation.accept",
        resourceType: "invitation",
        resourceId: inv.id,
        outcome: "success",
        metadata: { role: inv.targetRole },
      });
      return;
    }
  }
  if (email === bootstrapEmail && !(await superadminExists(db))) {
    await db.insert(userRoles).values({
      userId: user.id,
      roleId: await roleId(db, "superadmin"),
      grantedBy: null,
      grantedAt: at,
    });
    await audit(db, {
      actorId: user.id,
      action: "bootstrap.superadmin",
      resourceType: "user",
      resourceId: user.id,
      outcome: "success",
    });
  }
}

export async function recordLogin(db: Db, userId: string, method: string, at = new Date()) {
  await db.update(users).set({ lastLoginAt: at }).where(eq(users.id, userId));
  await audit(db, {
    actorId: userId,
    action: "auth.login",
    resourceType: "session",
    outcome: "success",
    metadata: { method },
  });
}

export async function markSessionMfa(
  db: Db,
  sessionId: string,
  userId: string,
  method: "passkey",
  at = new Date(),
) {
  await db
    .insert(sessionMfa)
    .values({ sessionId, method, verifiedAt: at })
    .onConflictDoUpdate({ target: sessionMfa.sessionId, set: { verifiedAt: at, method } });
  await audit(db, {
    actorId: userId,
    action: "auth.mfa_verified",
    resourceType: "session",
    outcome: "success",
    metadata: { method },
  });
}

/**
 * Whether a new session may be created for this user. Refusals of known
 * accounts (disabled, or without a principal) are audited.
 */
export async function sessionAllowed(db: Db, sessionId: string, userId: string) {
  const p = await loadPrincipal(db, sessionId, userId);
  if (p?.status === "active") return true;
  if (p)
    await audit(db, {
      actorId: userId,
      action: "auth.sign_in_refused",
      resourceType: "session",
      outcome: "denied",
      metadata: { reason: "ACCOUNT_DISABLED" },
    });
  return false;
}

/**
 * The reason a sign-in endpoint failed, from the value Better Auth hands to
 * after hooks, or null when it succeeded or is not a sign-in endpoint. A
 * failed magic link is a redirect with an `error` parameter.
 */
export function signInFailure(
  path: string,
  returned: unknown,
): { method: "magic_link" | "passkey"; reason: string } | null {
  if (!(returned instanceof Error) || returned.name !== "APIError") return null;
  const e = returned as Error & {
    statusCode?: number;
    body?: { code?: string };
    headers?: unknown;
  };
  const reason = (r: string | null | undefined) =>
    (r || String(e.statusCode ?? "error")).slice(0, 64);
  if (path === "/magic-link/verify") {
    if (e.statusCode !== 302) return { method: "magic_link", reason: reason(e.body?.code) };
    const location = e.headers instanceof Headers ? e.headers.get("location") : null;
    const error = location ? new URL(location, "http://localhost").searchParams.get("error") : null;
    return error ? { method: "magic_link", reason: reason(error) } : null;
  }
  if (path === "/passkey/verify-authentication")
    return { method: "passkey", reason: reason(e.body?.code) };
  return null;
}

/**
 * After a passkey is removed, end the user's other sessions: one of them may
 * have been verified with the removed passkey, and sessions do not record
 * which passkey verified them.
 */
export async function onPasskeyRemoved(db: Db, userId: string, currentSessionId: string) {
  const revoked = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
    .returning({ id: sessions.id });
  await audit(db, {
    actorId: userId,
    action: "auth.passkey_removed",
    resourceType: "passkey",
    outcome: "success",
    metadata: { revokedSessions: revoked.length },
  });
}

export const MAGIC_LINK_SENDS_PER_WINDOW = 3;
export const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;

/**
 * Count one magic link email for this address and say whether it may be
 * sent. The per-IP limit alone let rotating addresses flood a known inbox.
 */
export async function consumeMagicLinkQuota(db: Db, email: string, at = new Date()) {
  const t = at.getTime();
  const emailHash = createHash("sha256").update(normEmail(email)).digest("hex");
  const expired = sql`${magicLinkSends.windowStart} <= ${t - MAGIC_LINK_WINDOW_MS}`;
  const [row] = await db
    .insert(magicLinkSends)
    .values({ emailHash, windowStart: t, count: 1 })
    .onConflictDoUpdate({
      target: magicLinkSends.emailHash,
      set: {
        windowStart: sql`case when ${expired} then ${t} else ${magicLinkSends.windowStart} end`,
        count: sql`case when ${expired} then 1 else ${magicLinkSends.count} + 1 end`,
      },
    })
    .returning({ count: magicLinkSends.count });
  return (row?.count ?? 1) <= MAGIC_LINK_SENDS_PER_WINDOW;
}

// ---------------------------------------------------------------- dashboard

export async function dashboard(c: Ctx) {
  await guard(c, "dashboard.view", { role: "admin" });
  const [drafts] = await c.db
    .select({ n: count() })
    .from(ruleDrafts)
    .where(eq(ruleDrafts.reviewStatus, "submitted"));
  const [failed] = await c.db
    .select({ n: count() })
    .from(catalogReleases)
    .where(eq(catalogReleases.releaseStatus, "failed"));
  const [admins] = await c.db
    .select({ n: sql<number>`count(distinct ${userRoles.userId})` })
    .from(userRoles)
    .where(isNull(userRoles.revokedAt));
  const providers = await c.db
    .select({
      code: providerCatalog.providerCode,
      name: providerCatalog.displayName,
      status: providerCatalog.status,
    })
    .from(providerCatalog);
  const recent = await auditList(c, 10);
  return {
    draftsAwaitingReview: drafts?.n ?? 0,
    failedPublications: failed?.n ?? 0,
    activeAdmins: Number(admins?.n ?? 0),
    providers,
    recentActions: recent,
  };
}

// ---------------------------------------------------------------- users & invitations

export async function listUsers(c: Ctx) {
  await guard(c, "users.list", { role: "superadmin" });
  const rows = await c.db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
  const grants = await c.db
    .select({ userId: userRoles.userId, code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(isNull(userRoles.revokedAt));
  const invitations = await c.db
    .select()
    .from(adminInvitations)
    .orderBy(desc(adminInvitations.createdAt))
    .limit(50);
  return {
    users: rows.map((u) => ({
      ...u,
      roles: grants.filter((g) => g.userId === u.id).map((g) => g.code),
    })),
    invitations,
  };
}

export const InviteInput = z.object({
  email: z.email().max(254),
  role: z.enum(["admin", "superadmin"]),
  expiresInHours: z.number().int().min(1).max(168).default(72),
});

export async function inviteAdmin(c: Ctx, input: unknown) {
  const p = await guard(c, "invitation.create", { role: "superadmin", fresh: true });
  const parsed = InviteInput.safeParse(input);
  if (!parsed.success) throw new ServiceError("VALIDATION_FAILED", "Enter a valid email and role.");
  const email = normEmail(parsed.data.email);
  const [existing] = await c.db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (existing)
    throw new ServiceError(
      "CONFLICT",
      "This person already has an account. Change their role instead.",
      409,
    );
  const at = now(c);
  // A new invitation replaces any open one for the same identity.
  await c.db
    .update(adminInvitations)
    .set({ revokedAt: at })
    .where(
      and(
        sql`lower(${adminInvitations.invitedIdentity}) = ${email}`,
        isNull(adminInvitations.acceptedAt),
        isNull(adminInvitations.revokedAt),
      ),
    );
  const [inv] = await c.db
    .insert(adminInvitations)
    .values({
      invitedIdentity: email,
      targetRole: parsed.data.role,
      invitedBy: p.userId,
      expiresAt: new Date(at.getTime() + parsed.data.expiresInHours * 3600_000),
    })
    .returning();
  await audit(c.db, {
    actorId: p.userId,
    action: "invitation.create",
    resourceType: "invitation",
    resourceId: inv!.id,
    outcome: "success",
    requestId: c.requestId,
    metadata: { role: parsed.data.role },
  });
  return inv!;
}

export async function revokeInvitation(c: Ctx, id: string) {
  const p = await guard(c, "invitation.revoke", { role: "superadmin", fresh: true });
  const res = await c.db
    .update(adminInvitations)
    .set({ revokedAt: now(c) })
    .where(
      and(
        eq(adminInvitations.id, id),
        isNull(adminInvitations.acceptedAt),
        isNull(adminInvitations.revokedAt),
      ),
    )
    .returning({ id: adminInvitations.id });
  if (!res.length) throw new ServiceError("NOT_FOUND", "No open invitation with that id.", 404);
  await audit(c.db, {
    actorId: p.userId,
    action: "invitation.revoke",
    resourceType: "invitation",
    resourceId: id,
    outcome: "success",
    requestId: c.requestId,
  });
}

async function revokeAllSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Runs a change that can remove a superadmin in one transaction, serialized by
 * an advisory lock, so two concurrent changes can't both pass the
 * last-superadmin check.
 */
async function withSuperadminLock<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7101)`);
    return fn(tx as unknown as Db);
  });
}

async function activeSuperadminCount(db: Db, excludingUserId?: string) {
  const [r] = await db
    .select({ n: count() })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(roles.code, "superadmin"),
        isNull(userRoles.revokedAt),
        eq(users.status, "active"),
        excludingUserId ? ne(users.id, excludingUserId) : undefined,
      ),
    );
  return r?.n ?? 0;
}

export const RoleChangeInput = z.object({
  userId: z.uuid(),
  roles: z.array(z.enum(["admin", "superadmin"])).max(2),
});

/** Replace a user's roles. Invalidates their sessions. */
export async function setUserRoles(c: Ctx, input: unknown) {
  const p = await guard(c, "user.roles_change", { role: "superadmin", fresh: true });
  const parsed = RoleChangeInput.safeParse(input);
  if (!parsed.success) throw new ServiceError("VALIDATION_FAILED", "Invalid role change.");
  const { userId, roles: wanted } = parsed.data;
  await withSuperadminLock(c.db, async (db) => {
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!target) throw new ServiceError("NOT_FOUND", "User not found.", 404);
    if (!wanted.includes("superadmin") && (await activeSuperadminCount(db, userId)) === 0) {
      throw new ServiceError(
        "LAST_SUPERADMIN",
        "The last active superadmin cannot lose the role. Use the documented recovery procedure.",
        409,
      );
    }
    const at = now(c);
    const current = await db
      .select({ id: userRoles.id, code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), isNull(userRoles.revokedAt)));
    const toRevoke = current.filter((r) => !wanted.includes(r.code as RoleCode));
    const toGrant = wanted.filter((w) => !current.some((r) => r.code === w));
    if (toRevoke.length)
      await db
        .update(userRoles)
        .set({ revokedAt: at })
        .where(
          inArray(
            userRoles.id,
            toRevoke.map((r) => r.id),
          ),
        );
    for (const code of toGrant)
      await db
        .insert(userRoles)
        .values({ userId, roleId: await roleId(db, code), grantedBy: p.userId, grantedAt: at });
    if (toRevoke.length || toGrant.length) {
      await revokeAllSessions(db, userId);
      await audit(db, {
        actorId: p.userId,
        action: "user.roles_change",
        resourceType: "user",
        resourceId: userId,
        outcome: "success",
        requestId: c.requestId,
        metadata: {
          granted: toGrant.join(",") || null,
          revoked: toRevoke.map((r) => r.code).join(",") || null,
        },
      });
    }
  });
}

export async function setUserStatus(c: Ctx, input: unknown) {
  const p = await guard(c, "user.status_change", { role: "superadmin", fresh: true });
  const parsed = z
    .object({ userId: z.uuid(), status: z.enum(["active", "disabled"]) })
    .safeParse(input);
  if (!parsed.success) throw new ServiceError("VALIDATION_FAILED", "Invalid status change.");
  const { userId, status } = parsed.data;
  await withSuperadminLock(c.db, async (db) => {
    if (status === "disabled" && (await activeSuperadminCount(db, userId)) === 0) {
      const [isSuper] = await db
        .select({ n: count() })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(roles.code, "superadmin"),
            isNull(userRoles.revokedAt),
          ),
        );
      if ((isSuper?.n ?? 0) > 0)
        throw new ServiceError(
          "LAST_SUPERADMIN",
          "The last active superadmin cannot be disabled.",
          409,
        );
    }
    const res = await db
      .update(users)
      .set({ status, updatedAt: now(c) })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (!res.length) throw new ServiceError("NOT_FOUND", "User not found.", 404);
    if (status === "disabled") await revokeAllSessions(db, userId);
    await audit(db, {
      actorId: p.userId,
      action: "user.status_change",
      resourceType: "user",
      resourceId: userId,
      outcome: "success",
      requestId: c.requestId,
      metadata: { status },
    });
  });
}

export async function revokeSessions(c: Ctx, input: unknown) {
  const p = await guard(c, "session.revoke", { role: "superadmin", fresh: true });
  const parsed = z.object({ userId: z.uuid() }).safeParse(input);
  if (!parsed.success) throw new ServiceError("VALIDATION_FAILED", "Invalid user id.");
  await revokeAllSessions(c.db, parsed.data.userId);
  await audit(c.db, {
    actorId: p.userId,
    action: "session.revoke",
    resourceType: "user",
    resourceId: parsed.data.userId,
    outcome: "success",
    requestId: c.requestId,
  });
}

// ---------------------------------------------------------------- audit log

/** Security events visible only to superadmins. */
const SECURITY_ACTIONS = [
  "auth.",
  "user.",
  "invitation.",
  "session.",
  "settings.",
  "bootstrap.",
  "dashboard.",
  "users.",
];

async function auditList(c: Ctx, limit: number, before?: Date) {
  const p = c.principal!;
  const superadmin = p.roles.includes("superadmin");
  const rows = await c.db
    .select()
    .from(auditLogs)
    .where(
      and(
        before ? lt(auditLogs.timestamp, before) : undefined,
        superadmin ? undefined : eq(auditLogs.actorId, p.userId),
      ),
    )
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);
  // Admins see their own non-security actions only ("limited" access).
  return superadmin
    ? rows
    : rows.filter((r) => !SECURITY_ACTIONS.some((s) => r.action.startsWith(s)));
}

export async function listAuditLogs(c: Ctx, opts: { before?: string; limit?: number } = {}) {
  await guard(c, "audit.list", { role: "admin" });
  const before = opts.before ? new Date(opts.before) : undefined;
  return auditList(
    c,
    Math.min(Math.max(opts.limit ?? 100, 1), 500),
    before && !Number.isNaN(before.getTime()) ? before : undefined,
  );
}

// ---------------------------------------------------------------- settings

/** Only these non-secret keys may be stored. Secrets live in Vercel env vars. */
export const SETTINGS_SCHEMA = {
  "public.notice": z.string().max(500),
  "features.examplesVisible": z.boolean(),
  "docs.extraLinks": z
    .array(z.object({ title: z.string().max(80), url: z.url().startsWith("https://") }))
    .max(10),
  "catalog.supportedVersions": z.array(z.string().regex(/^\d{4}\.\d{1,2}\.\d+$/)).max(20),
} as const;
export type SettingKey = keyof typeof SETTINGS_SCHEMA;

export async function getSettings(c: Ctx) {
  await guard(c, "settings.view", { role: "superadmin" });
  return c.db.select().from(systemSettings);
}

export async function updateSetting(c: Ctx, input: unknown) {
  const p = await guard(c, "settings.update", { role: "superadmin", fresh: true });
  const base = z
    .object({
      key: z.enum(Object.keys(SETTINGS_SCHEMA) as [SettingKey, ...SettingKey[]]),
      value: z.unknown(),
    })
    .safeParse(input);
  if (!base.success) throw new ServiceError("VALIDATION_FAILED", "Unknown setting.");
  const value = SETTINGS_SCHEMA[base.data.key].safeParse(base.data.value);
  if (!value.success)
    throw new ServiceError("VALIDATION_FAILED", "Invalid value for this setting.");
  await c.db
    .insert(systemSettings)
    .values({ key: base.data.key, value: value.data, updatedBy: p.userId, updatedAt: now(c) })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: value.data, updatedBy: p.userId, updatedAt: now(c) },
    });
  await audit(c.db, {
    actorId: p.userId,
    action: "settings.update",
    resourceType: "setting",
    resourceId: base.data.key,
    outcome: "success",
    requestId: c.requestId,
  });
}

// ---------------------------------------------------------------- rule drafts

export const DraftInput = z.object({
  providerCode: z.enum(["stripe", "adyen"]).nullable(),
  ruleCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/, "Use UPPER_SNAKE_CASE"),
  proposedVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  content: z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(4000),
    category: z.string().max(64),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    documentationUrl: z.url().startsWith("https://").optional(),
  }),
});

function validateDraft(d: z.infer<typeof DraftInput>): "valid" | "invalid" {
  // Critical/high drafts must cite documentation (evidence-backed severity).
  if (
    (d.content.severity === "critical" || d.content.severity === "high") &&
    !d.content.documentationUrl
  )
    return "invalid";
  return "valid";
}

async function providerIdFor(db: Db, code: string | null) {
  if (!code) return null;
  const [p] = await db
    .select({ id: providerCatalog.id })
    .from(providerCatalog)
    .where(eq(providerCatalog.providerCode, code));
  return p?.id ?? null;
}

export async function listDrafts(c: Ctx) {
  await guard(c, "rules.list", { role: "admin" });
  return c.db.select().from(ruleDrafts).orderBy(desc(ruleDrafts.updatedAt)).limit(200);
}

export async function createDraft(c: Ctx, input: unknown) {
  const p = await guard(c, "rule_draft.create", { role: "admin" });
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success)
    throw new ServiceError(
      "VALIDATION_FAILED",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  const [d] = await c.db
    .insert(ruleDrafts)
    .values({
      providerId: await providerIdFor(c.db, parsed.data.providerCode),
      ruleCode: parsed.data.ruleCode,
      proposedVersion: parsed.data.proposedVersion,
      draftContent: parsed.data.content,
      validationStatus: validateDraft(parsed.data),
      createdBy: p.userId,
    })
    .returning();
  await audit(c.db, {
    actorId: p.userId,
    action: "rule_draft.create",
    resourceType: "rule_draft",
    resourceId: d!.id,
    outcome: "success",
    requestId: c.requestId,
    metadata: { ruleCode: parsed.data.ruleCode },
  });
  return d!;
}

export async function updateDraft(c: Ctx, id: string, input: unknown) {
  const p = await guard(c, "rule_draft.update", { role: "admin" });
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success)
    throw new ServiceError(
      "VALIDATION_FAILED",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  const res = await c.db
    .update(ruleDrafts)
    .set({
      providerId: await providerIdFor(c.db, parsed.data.providerCode),
      ruleCode: parsed.data.ruleCode,
      proposedVersion: parsed.data.proposedVersion,
      draftContent: parsed.data.content,
      validationStatus: validateDraft(parsed.data),
      updatedAt: now(c),
    })
    // Only the author can edit a draft, and only while it is not under review.
    .where(
      and(
        eq(ruleDrafts.id, id),
        eq(ruleDrafts.createdBy, p.userId),
        inArray(ruleDrafts.reviewStatus, ["draft", "rejected"]),
      ),
    )
    .returning({ id: ruleDrafts.id });
  if (!res.length) throw new ServiceError("NOT_FOUND", "No editable draft with that id.", 404);
  await audit(c.db, {
    actorId: p.userId,
    action: "rule_draft.update",
    resourceType: "rule_draft",
    resourceId: id,
    outcome: "success",
    requestId: c.requestId,
  });
}

export async function submitDraft(c: Ctx, id: string) {
  const p = await guard(c, "rule_draft.submit", { role: "admin" });
  const res = await c.db
    .update(ruleDrafts)
    .set({ reviewStatus: "submitted", updatedAt: now(c) })
    .where(
      and(
        eq(ruleDrafts.id, id),
        eq(ruleDrafts.createdBy, p.userId),
        eq(ruleDrafts.validationStatus, "valid"),
        inArray(ruleDrafts.reviewStatus, ["draft", "rejected"]),
      ),
    )
    .returning({ id: ruleDrafts.id });
  if (!res.length)
    throw new ServiceError(
      "CONFLICT",
      "Only the author can submit a draft, and only a valid one that is not already under review.",
      409,
    );
  await audit(c.db, {
    actorId: p.userId,
    action: "rule_draft.submit",
    resourceType: "rule_draft",
    resourceId: id,
    outcome: "success",
    requestId: c.requestId,
  });
}

/**
 * Approval records the decision only. Publishing happens through a reviewed
 * Git pull request and CI; the database never overrides the published catalog.
 */
export async function reviewDraft(c: Ctx, id: string, input: unknown) {
  const p = await guard(c, "rule_draft.review", { role: "superadmin", fresh: true });
  const parsed = z
    .object({ decision: z.enum(["approved", "rejected"]), note: z.string().max(1000).optional() })
    .safeParse(input);
  if (!parsed.success) throw new ServiceError("VALIDATION_FAILED", "Invalid review decision.");
  const [draft] = await c.db
    .select({ createdBy: ruleDrafts.createdBy })
    .from(ruleDrafts)
    .where(eq(ruleDrafts.id, id));
  if (!draft) throw new ServiceError("NOT_FOUND", "Draft not found.", 404);
  const res = await c.db
    .update(ruleDrafts)
    .set({
      reviewStatus: parsed.data.decision,
      reviewNote: parsed.data.note ?? null,
      reviewedBy: p.userId,
      updatedAt: now(c),
    })
    .where(and(eq(ruleDrafts.id, id), eq(ruleDrafts.reviewStatus, "submitted")))
    .returning({ id: ruleDrafts.id });
  if (!res.length)
    throw new ServiceError("CONFLICT", "Only submitted drafts can be reviewed.", 409);
  await audit(c.db, {
    actorId: p.userId,
    action: `rule_draft.${parsed.data.decision === "approved" ? "approve" : "reject"}`,
    resourceType: "rule_draft",
    resourceId: id,
    outcome: "success",
    requestId: c.requestId,
    metadata: { selfReview: draft.createdBy === p.userId },
  });
}

// ---------------------------------------------------------------- catalog

export async function listProviders(c: Ctx) {
  await guard(c, "providers.list", { role: "admin" });
  return c.db.select().from(providerCatalog).orderBy(providerCatalog.providerCode);
}

export async function listReleases(c: Ctx) {
  await guard(c, "releases.list", { role: "admin" });
  return c.db.select().from(catalogReleases).orderBy(desc(catalogReleases.createdAt)).limit(100);
}
