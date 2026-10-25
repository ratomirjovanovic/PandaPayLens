import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import * as schema from "@/db/schema";
import { authorize, AuthzError, FRESH_MAX_AGE_MS, MFA_MAX_AGE_MS } from "@/lib/admin/authz";
import * as svc from "@/lib/admin/services";
import type { Db, Principal } from "@/lib/admin/types";

const BOOT = "owner@example.com";
const migrationsFolder = fileURLToPath(new URL("../../db/migrations", import.meta.url));

let db: Db;

async function freshDb() {
  const client = new PGlite();
  const d = drizzle({ client, schema });
  await migrate(d, { migrationsFolder });
  return d as unknown as Db;
}

async function createUser(email: string) {
  const [u] = await db.insert(schema.users).values({ email }).returning();
  await svc.onUserCreated(db, { id: u!.id, email }, BOOT);
  return u!;
}

async function sessionFor(userId: string, opts: { mfa?: Date | null; passkey?: boolean } = {}) {
  const [s] = await db
    .insert(schema.sessions)
    .values({ userId, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600_000) })
    .returning();
  if (opts.passkey !== false) {
    await db.insert(schema.passkeys).values({
      userId,
      publicKey: "pk",
      credentialID: crypto.randomUUID(),
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });
  }
  if (opts.mfa !== null)
    await db
      .insert(schema.sessionMfa)
      .values({ sessionId: s!.id, method: "passkey", verifiedAt: opts.mfa ?? new Date() });
  return (await svc.loadPrincipal(db, s!.id, userId))!;
}

async function auditActions() {
  return (
    await db
      .select({ a: schema.auditLogs.action, o: schema.auditLogs.outcome })
      .from(schema.auditLogs)
  ).map((r) => `${r.a}:${r.o}`);
}

beforeEach(async () => {
  db = await freshDb();
});

describe("authorize()", () => {
  const base: Principal = {
    userId: "u",
    email: "e",
    sessionId: "s",
    status: "active",
    roles: ["admin"],
    mfaVerifiedAt: new Date(),
    hasPasskey: true,
  };
  const now = Date.now();
  const code = (fn: () => unknown) => {
    try {
      fn();
      return "OK";
    } catch (e) {
      return e instanceof AuthzError ? e.code : "OTHER";
    }
  };

  it.each([
    ["anonymous", null, { role: "admin" }, "UNAUTHENTICATED"],
    ["disabled", { ...base, status: "disabled" }, { role: "admin" }, "ACCOUNT_DISABLED"],
    ["no role", { ...base, roles: [] }, { role: "admin" }, "FORBIDDEN"],
    ["admin → superadmin op", base, { role: "superadmin" }, "FORBIDDEN"],
    [
      "no passkey",
      { ...base, hasPasskey: false },
      { role: "admin" },
      "PASSKEY_ENROLLMENT_REQUIRED",
    ],
    ["email-only session", { ...base, mfaVerifiedAt: null }, { role: "admin" }, "MFA_REQUIRED"],
    [
      "expired MFA",
      { ...base, mfaVerifiedAt: new Date(now - MFA_MAX_AGE_MS - 1) },
      { role: "admin" },
      "MFA_REQUIRED",
    ],
    [
      "stale for sensitive op",
      { ...base, roles: ["superadmin"], mfaVerifiedAt: new Date(now - FRESH_MAX_AGE_MS - 1) },
      { role: "superadmin", fresh: true },
      "REAUTHENTICATION_REQUIRED",
    ],
    ["admin ok", base, { role: "admin" }, "OK"],
    ["superadmin implies admin", { ...base, roles: ["superadmin"] }, { role: "admin" }, "OK"],
    [
      "fresh superadmin",
      { ...base, roles: ["superadmin"] },
      { role: "superadmin", fresh: true },
      "OK",
    ],
  ] as const)("%s", (_n, p, req, expected) => {
    expect(code(() => authorize(p as Principal | null, req, now))).toBe(expected);
  });
});

describe("superadmin bootstrap and sign-in policy", () => {
  it("allows magic links only for known, invited or bootstrap identities", async () => {
    expect(await svc.mayReceiveMagicLink(db, "OWNER@example.com ", BOOT)).toBe(true);
    expect(await svc.mayReceiveMagicLink(db, "stranger@example.com", BOOT)).toBe(false);
  });

  it("bootstraps the first superadmin once and logs it", async () => {
    const owner = await createUser(BOOT);
    const p = await sessionFor(owner.id);
    expect(p.roles).toEqual(["superadmin"]);
    expect(await auditActions()).toContain("bootstrap.superadmin:success");
  });

  it("is idempotent: the bootstrap email gains nothing once a superadmin exists", async () => {
    await createUser(BOOT);
    // Simulate the original account being removed from the role and a new
    // account appearing with the bootstrap address via a different path.
    expect(await svc.mayReceiveMagicLink(db, "other@example.com", "other@example.com")).toBe(false);
  });

  it("refuses disabled users", async () => {
    const owner = await createUser(BOOT);
    await db.update(schema.users).set({ status: "disabled" }).where(eq(schema.users.id, owner.id));
    expect(await svc.mayReceiveMagicLink(db, BOOT, BOOT)).toBe(false);
  });
});

describe("invitations and role management", () => {
  async function superadmin() {
    const owner = await createUser(BOOT);
    return { owner, p: await sessionFor(owner.id) };
  }

  it("superadmin invites, invitee gets the role on first sign-in, invitation is single-use", async () => {
    const { p } = await superadmin();
    await svc.inviteAdmin({ db, principal: p }, { email: "New.Admin@example.com", role: "admin" });
    expect(await svc.mayReceiveMagicLink(db, "new.admin@example.com", BOOT)).toBe(true);
    const invitee = await createUser("new.admin@example.com");
    const ip = await sessionFor(invitee.id);
    expect(ip.roles).toEqual(["admin"]);
    const [inv] = await db.select().from(schema.adminInvitations);
    expect(inv!.acceptedBy).toBe(invitee.id);
    expect(await auditActions()).toEqual(
      expect.arrayContaining(["invitation.create:success", "invitation.accept:success"]),
    );
  });

  it("expired and revoked invitations grant nothing", async () => {
    const { p } = await superadmin();
    const inv = await svc.inviteAdmin(
      { db, principal: p },
      { email: "a@example.com", role: "admin" },
    );
    await svc.revokeInvitation({ db, principal: p }, inv.id);
    expect(await svc.mayReceiveMagicLink(db, "a@example.com", BOOT)).toBe(false);
    await svc.inviteAdmin(
      { db, principal: p },
      { email: "b@example.com", role: "admin", expiresInHours: 1 },
    );
    expect(
      await svc.mayReceiveMagicLink(db, "b@example.com", BOOT, new Date(Date.now() + 2 * 3600_000)),
    ).toBe(false);
  });

  it("admins cannot invite, change roles, or read settings", async () => {
    const { p } = await superadmin();
    await svc.inviteAdmin({ db, principal: p }, { email: "x@example.com", role: "admin" });
    const x = await createUser("x@example.com");
    const xp = await sessionFor(x.id);
    await expect(
      svc.inviteAdmin({ db, principal: xp }, { email: "y@example.com", role: "superadmin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      svc.setUserRoles({ db, principal: xp }, { userId: x.id, roles: ["superadmin"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.getSettings({ db, principal: xp })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await auditActions()).toContain("invitation.create:denied");
  });

  it("email-only sessions are rejected for every privileged operation", async () => {
    const owner = await createUser(BOOT);
    const p = await sessionFor(owner.id, { mfa: null });
    await expect(svc.dashboard({ db, principal: p })).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
    await expect(svc.listUsers({ db, principal: p })).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
  });

  it("sensitive operations need a fresh passkey challenge", async () => {
    const owner = await createUser(BOOT);
    const p = await sessionFor(owner.id, { mfa: new Date(Date.now() - FRESH_MAX_AGE_MS - 60_000) });
    await expect(svc.listUsers({ db, principal: p })).resolves.toBeTruthy();
    await expect(
      svc.inviteAdmin({ db, principal: p }, { email: "z@example.com", role: "admin" }),
    ).rejects.toMatchObject({ code: "REAUTHENTICATION_REQUIRED" });
  });

  it("the last active superadmin cannot be demoted or disabled", async () => {
    const { owner, p } = await superadmin();
    await expect(
      svc.setUserRoles({ db, principal: p }, { userId: owner.id, roles: ["admin"] }),
    ).rejects.toMatchObject({ code: "LAST_SUPERADMIN" });
    await expect(
      svc.setUserStatus({ db, principal: p }, { userId: owner.id, status: "disabled" }),
    ).rejects.toMatchObject({ code: "LAST_SUPERADMIN" });
  });

  it("role changes and disabling revoke the user's sessions", async () => {
    const { p } = await superadmin();
    await svc.inviteAdmin({ db, principal: p }, { email: "r@example.com", role: "admin" });
    const r = await createUser("r@example.com");
    await sessionFor(r.id);
    await svc.setUserRoles({ db, principal: p }, { userId: r.id, roles: ["superadmin"] });
    expect(
      await db.select().from(schema.sessions).where(eq(schema.sessions.userId, r.id)),
    ).toHaveLength(0);
    await sessionFor(r.id);
    await svc.setUserStatus({ db, principal: p }, { userId: r.id, status: "disabled" });
    expect(
      await db.select().from(schema.sessions).where(eq(schema.sessions.userId, r.id)),
    ).toHaveLength(0);
  });

  it("rejects invalid input", async () => {
    const { p } = await superadmin();
    await expect(
      svc.inviteAdmin({ db, principal: p }, { email: "not-an-email", role: "admin" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      svc.inviteAdmin({ db, principal: p }, { email: "a@example.com", role: "owner" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("settings", () => {
  it("accepts only allowlisted keys with valid values", async () => {
    const owner = await createUser(BOOT);
    const p = await sessionFor(owner.id);
    await svc.updateSetting(
      { db, principal: p },
      { key: "public.notice", value: "Maintenance Friday" },
    );
    await expect(
      svc.updateSetting({ db, principal: p }, { key: "DATABASE_URL", value: "postgres://x" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      svc.updateSetting(
        { db, principal: p },
        { key: "docs.extraLinks", value: [{ title: "x", url: "javascript:alert(1)" }] },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect((await svc.getSettings({ db, principal: p })).map((s) => s.key)).toEqual([
      "public.notice",
    ]);
  });
});

describe("rule drafts", () => {
  it("admin drafts and submits; only superadmin reviews; approval does not publish", async () => {
    const owner = await createUser(BOOT);
    const sp = await sessionFor(owner.id);
    await svc.inviteAdmin({ db, principal: sp }, { email: "d@example.com", role: "admin" });
    const d = await createUser("d@example.com");
    const ap = await sessionFor(d.id);
    const draft = await svc.createDraft(
      { db, principal: ap },
      {
        providerCode: "stripe",
        ruleCode: "LATE_CAPTURE",
        proposedVersion: "1.0.0",
        content: {
          title: "Late capture",
          description: "Capture after authorization expiry window.",
          category: "capture",
          severity: "low",
        },
      },
    );
    expect(draft.validationStatus).toBe("valid");
    await svc.submitDraft({ db, principal: ap }, draft.id);
    await expect(
      svc.reviewDraft({ db, principal: ap }, draft.id, { decision: "approved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await svc.reviewDraft({ db, principal: sp }, draft.id, { decision: "approved" });
    const [row] = await db.select().from(schema.ruleDrafts);
    expect(row!.reviewStatus).toBe("approved");
    expect(await db.select().from(schema.catalogReleases)).toHaveLength(0);
  });

  it("high-severity drafts without documentation are invalid and cannot be submitted", async () => {
    const owner = await createUser(BOOT);
    const p = await sessionFor(owner.id);
    const draft = await svc.createDraft(
      { db, principal: p },
      {
        providerCode: null,
        ruleCode: "BIG_DEAL",
        proposedVersion: "1.0.0",
        content: {
          title: "Big",
          description: "Something serious happened.",
          category: "x",
          severity: "high",
        },
      },
    );
    expect(draft.validationStatus).toBe("invalid");
    await expect(svc.submitDraft({ db, principal: p }, draft.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("audit log integrity", () => {
  it("rejects UPDATE, DELETE and TRUNCATE at the database level", async () => {
    await createUser(BOOT);
    // Drizzle wraps the database error; the trigger's message is in `cause`.
    const reason = (p: Promise<unknown>) =>
      p.then(
        () => "no error",
        (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message,
      );
    expect(await reason(db.execute(sql`update audit_logs set outcome = 'x'`))).toMatch(
      /append-only/,
    );
    expect(await reason(db.execute(sql`delete from audit_logs`))).toMatch(/append-only/);
    expect(await reason(db.execute(sql`truncate audit_logs`))).toMatch(/append-only/);
  });

  it("admins see only their own non-security entries", async () => {
    const owner = await createUser(BOOT);
    const sp = await sessionFor(owner.id);
    await svc.inviteAdmin({ db, principal: sp }, { email: "l@example.com", role: "admin" });
    const l = await createUser("l@example.com");
    const lp = await sessionFor(l.id);
    await svc.createDraft(
      { db, principal: lp },
      {
        providerCode: "adyen",
        ruleCode: "MY_RULE",
        proposedVersion: "1.0.0",
        content: {
          title: "Mine",
          description: "A description long enough.",
          category: "x",
          severity: "info",
        },
      },
    );
    const seen = (await svc.listAuditLogs({ db, principal: lp })).map((r) => r.action);
    expect(seen).toEqual(["rule_draft.create"]);
    expect((await svc.listAuditLogs({ db, principal: sp })).length).toBeGreaterThan(3);
  });
});
