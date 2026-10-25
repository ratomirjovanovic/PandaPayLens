import "server-only";
import { headers } from "next/headers";
import { adminEnabled } from "./config";
import { getAuth } from "./auth";
import { AuthzError } from "./authz";
import { getDb } from "./db";
import { loadPrincipal, ServiceError } from "./services";
import type { Db, Principal } from "./types";

export async function currentPrincipal(h?: Headers): Promise<Principal | null> {
  if (!adminEnabled()) return null;
  const hdrs = h ?? (await headers());
  const session = await getAuth().api.getSession({ headers: hdrs });
  if (!session) return null;
  return loadPrincipal(getDb(), session.session.id, session.user.id);
}

/**
 * Mutations must come from this site. Session cookies are SameSite=Strict;
 * this Origin check is the second CSRF layer.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export type AdminHandler = (ctx: {
  db: Db;
  principal: Principal | null;
  requestId: string;
  req: Request;
  params: string[];
}) => Promise<unknown>;

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, requestId } };
}

export async function runAdmin(
  req: Request,
  params: string[],
  handler: AdminHandler,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!adminEnabled()) return json(404, errorBody("NOT_FOUND", "Not found.", requestId));
  if (req.method !== "GET") {
    if (!sameOrigin(req))
      return json(403, errorBody("CSRF_REJECTED", "Cross-site request rejected.", requestId));
    if (!(req.headers.get("content-type") ?? "").startsWith("application/json"))
      return json(415, errorBody("UNSUPPORTED_MEDIA_TYPE", "Send JSON.", requestId));
  }
  try {
    const principal = await currentPrincipal(req.headers);
    const data = await handler({ db: getDb(), principal, requestId, req, params });
    return json(200, { data: data ?? null });
  } catch (e) {
    if (e instanceof AuthzError)
      return json(e.status, errorBody(e.code, authzMessage(e.code), requestId));
    if (e instanceof ServiceError) return json(e.status, errorBody(e.code, e.message, requestId));
    // Never return internal details (SQL, stack traces, paths).
    console.error(`admin request ${requestId} failed`, e instanceof Error ? e.name : "unknown");
    return json(500, errorBody("INTERNAL_ERROR", "Something went wrong.", requestId));
  }
}

function authzMessage(code: AuthzError["code"]) {
  switch (code) {
    case "UNAUTHENTICATED":
      return "Sign in first.";
    case "ACCOUNT_DISABLED":
      return "This account is disabled.";
    case "FORBIDDEN":
      return "You do not have permission for this action.";
    case "PASSKEY_ENROLLMENT_REQUIRED":
      return "Register a passkey to continue.";
    case "MFA_REQUIRED":
      return "Verify with your passkey to continue.";
    case "REAUTHENTICATION_REQUIRED":
      return "Verify with your passkey again for this action.";
  }
}
