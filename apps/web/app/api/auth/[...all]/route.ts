import { toNextJsHandler } from "better-auth/next-js";
import { adminEnabled } from "@/lib/admin/config";
import { getAuth } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const notFound = () =>
  Response.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });

export async function GET(req: Request) {
  return adminEnabled() ? toNextJsHandler(getAuth()).GET(req) : notFound();
}

export async function POST(req: Request) {
  return adminEnabled() ? toNextJsHandler(getAuth()).POST(req) : notFound();
}
