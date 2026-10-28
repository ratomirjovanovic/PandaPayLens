/**
 * Control-plane schema. This database never stores imported payment data.
 *
 * Tables used by Better Auth (users, auth_sessions, auth_accounts,
 * auth_verifications, auth_passkeys, auth_rate_limits) keep the property
 * names Better Auth expects; columns are snake_case.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------- auth

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("display_name").notNull().default(""),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** active | disabled. Disabled users cannot create sessions. */
    status: text("status").notNull().default("active"),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "auth_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);

export const passkeys = pgTable(
  "auth_passkeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [
    index("auth_passkeys_user_idx").on(t.userId),
    index("auth_passkeys_credential_idx").on(t.credentialID),
  ],
);

export const rateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  // Better Auth stores Date.now() in milliseconds, which needs 64 bits.
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * Magic link emails sent per address in the current window, keyed by a
 * SHA-256 of the normalized address. Only allowed addresses are counted.
 */
export const magicLinkSends = pgTable("auth_magic_link_sends", {
  emailHash: text("email_hash").primaryKey(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
  count: integer("count").notNull(),
});

/**
 * Sessions that completed a passkey challenge. Privileged requests require a
 * row here; an email magic link alone is never enough.
 */
export const sessionMfa = pgTable("admin_session_mfa", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  verifiedAt: ts("verified_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- RBAC

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("user_roles_user_idx").on(t.userId),
    // At most one active grant per user and role.
    uniqueIndex("user_roles_active_unique")
      .on(t.userId, t.roleId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

export const adminInvitations = pgTable(
  "admin_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invitedIdentity: text("invited_identity").notNull(),
    targetRole: text("target_role").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_invitations_identity_idx").on(sql`lower(${t.invitedIdentity})`)],
);

// ---------------------------------------------------------------- catalog & workflow

export const providerCatalog = pgTable("provider_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerCode: text("provider_code").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** active | draft_development | disabled */
  status: text("status").notNull(),
  supportedFormats: jsonb("supported_formats").$type<string[]>().notNull(),
  documentationUrl: text("documentation_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ruleDrafts = pgTable(
  "rule_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => providerCatalog.id),
    ruleCode: text("rule_code").notNull(),
    proposedVersion: text("proposed_version").notNull(),
    draftContent: jsonb("draft_content").$type<RuleDraftContent>().notNull(),
    /** pending | valid | invalid */
    validationStatus: text("validation_status").notNull().default("pending"),
    /** draft | submitted | approved | rejected */
    reviewStatus: text("review_status").notNull().default("draft"),
    reviewNote: text("review_note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("rule_drafts_status_idx").on(t.reviewStatus)],
);

export type RuleDraftContent = {
  title: string;
  description: string;
  category: string;
  severity: string;
  documentationUrl?: string;
};

export const catalogReleases = pgTable("catalog_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull().unique(),
  gitCommitSha: text("git_commit_sha"),
  artifactChecksum: text("artifact_checksum"),
  /** requested | published | failed | rolled_back */
  releaseStatus: text("release_status").notNull(),
  releasedAt: ts("released_at"),
  releasedBy: uuid("released_by").references(() => users.id),
  createdAt: createdAt(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: updatedAt(),
});

/** Append-only; a database trigger rejects UPDATE and DELETE. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    timestamp: ts("timestamp").notNull().defaultNow(),
    outcome: text("outcome").notNull(),
    requestCorrelationId: text("request_correlation_id"),
    safeMetadata: jsonb("safe_metadata").$type<Record<string, string | number | boolean | null>>(),
  },
  (t) => [
    index("audit_logs_timestamp_idx").on(t.timestamp),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const publicMetricsDaily = pgTable(
  "public_metrics_daily",
  {
    date: text("date").notNull(),
    applicationVersion: text("application_version").notNull(),
    pageViewCount: integer("page_view_count").notNull().default(0),
    sampleAnalysisCount: integer("sample_analysis_count").notNull().default(0),
    providerSampleCounts: jsonb("provider_sample_counts")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
  },
  (t) => [primaryKey({ columns: [t.date, t.applicationVersion] })],
);
