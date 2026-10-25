import { APP_VERSION } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Sanitized health: no environment, dependency or infrastructure details. */
export function GET() {
  return Response.json(
    { status: "ok", version: APP_VERSION },
    { headers: { "Cache-Control": "no-store" } },
  );
}
