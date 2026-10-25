import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";

/** Works with both the Neon driver (production) and PGlite (tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type RoleCode = "admin" | "superadmin";

/** Everything the server knows about the caller. Never taken from the client. */
export type Principal = {
  userId: string;
  email: string;
  sessionId: string;
  status: string;
  roles: RoleCode[];
  /** When this session completed a passkey challenge, if it did. */
  mfaVerifiedAt: Date | null;
  hasPasskey: boolean;
};

export type Requirement = {
  role: RoleCode;
  /** Sensitive operation: the passkey challenge must be recent. */
  fresh?: boolean;
};
