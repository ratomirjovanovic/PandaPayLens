import type { Principal, Requirement } from "./types";

/** Privileged sessions must have passed a passkey challenge within this window. */
export const MFA_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Sensitive operations need a passkey challenge within this window. */
export const FRESH_MAX_AGE_MS = 10 * 60 * 1000;

export type AuthzCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_DISABLED"
  | "FORBIDDEN"
  | "PASSKEY_ENROLLMENT_REQUIRED"
  | "MFA_REQUIRED"
  | "REAUTHENTICATION_REQUIRED";

export class AuthzError extends Error {
  constructor(
    readonly code: AuthzCode,
    readonly status: 401 | 403,
  ) {
    super(code);
  }
}

/**
 * The single authorization decision. Pure, so it is exhaustively tested.
 * Superadmin implies admin.
 */
export function authorize(p: Principal | null, req: Requirement, now = Date.now()): Principal {
  if (!p) throw new AuthzError("UNAUTHENTICATED", 401);
  if (p.status !== "active") throw new AuthzError("ACCOUNT_DISABLED", 403);
  const ok =
    req.role === "admin"
      ? p.roles.includes("admin") || p.roles.includes("superadmin")
      : p.roles.includes("superadmin");
  if (!ok) throw new AuthzError("FORBIDDEN", 403);
  if (!p.hasPasskey) throw new AuthzError("PASSKEY_ENROLLMENT_REQUIRED", 403);
  if (!p.mfaVerifiedAt || now - p.mfaVerifiedAt.getTime() > MFA_MAX_AGE_MS)
    throw new AuthzError("MFA_REQUIRED", 403);
  if (req.fresh && now - p.mfaVerifiedAt.getTime() > FRESH_MAX_AGE_MS)
    throw new AuthzError("REAUTHENTICATION_REQUIRED", 403);
  return p;
}
