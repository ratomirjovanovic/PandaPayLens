import { toNextJsHandler } from "better-auth/next-js";
import { adminEnabled } from "@/lib/admin/config";
import { getAuth } from "@/lib/admin/auth";
import { logSecurityEvent } from "@/lib/admin/services";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });

// Better Auth answers rate-limited requests before any hook runs.
async function handle(req: Request, method: "GET" | "POST") {
  if (!adminEnabled()) return notFound();
  const res = await toNextJsHandler(getAuth())[method](req);
  if (res.status === 429)
    logSecurityEvent("auth.rate_limited", { path: new URL(req.url).pathname });
  return res;
}

export const GET = (req: Request) => handle(req, "GET");
export const POST = (req: Request) => handle(req, "POST");
