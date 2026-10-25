import { ADAPTERS } from "@/lib/analyzer";

export function GET() {
  return Response.json({
    providers: ADAPTERS.map((a) => ({
      id: a.id,
      name: a.displayName,
      version: a.version,
      formats: a.supportedFormats,
    })),
  });
}
