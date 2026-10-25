import { CORE_VERSION } from "@pandapaylens/core";
import { RULE_CATALOG_VERSION, defaultRules } from "@pandapaylens/rules";

export function GET() {
  return Response.json({
    catalogVersion: RULE_CATALOG_VERSION,
    coreVersion: CORE_VERSION,
    rules: defaultRules.map((r) => ({ id: r.id, version: r.version })),
  });
}
