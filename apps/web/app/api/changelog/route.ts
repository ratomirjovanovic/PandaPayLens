import { RELEASES } from "@/lib/changelog";

export function GET() {
  return Response.json({ releases: RELEASES });
}
