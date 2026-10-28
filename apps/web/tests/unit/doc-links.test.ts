import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText } from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";
import { isOfficialDocUrl } from "@/lib/doc-links";

describe("isOfficialDocUrl", () => {
  it("accepts https links on hosts that provider manifests cite", () => {
    for (const url of [
      "https://docs.stripe.com/api/idempotent_requests",
      "https://docs.adyen.com/development-resources/api-idempotency",
      "https://developer.paypal.com/api/rest/reference/idempotency/",
      "https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency",
      "https://docs.mollie.com/reference/api-idempotency",
      "https://www.checkout.com/docs/developer-resources/api/idempotency",
    ])
      expect(isOfficialDocUrl(url), url).toBe(true);
  });

  it("rejects other schemes, unknown hosts and malformed values", () => {
    for (const url of [
      undefined,
      "",
      "http://docs.stripe.com/api",
      "javascript:alert(1)",
      "https://docs.stripe.com.example.net/api",
      "https://example.com/docs",
      "not a url",
    ])
      expect(isOfficialDocUrl(url), String(url)).toBe(false);
  });
});

const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
const fixtures = readdirSync(root)
  .filter((d) => statSync(join(root, d)).isDirectory())
  .flatMap((d) => readdirSync(join(root, d)).map((f) => [d, f] as const));

describe("finding documentation links", () => {
  // Filled by the per-fixture tests, which run in order before the final check.
  const links = new Set<string>();

  it.each(fixtures)("%s/%s links only to official hosts", (dir, file) => {
    const r = analyzeText(readFileSync(join(root, dir, file), "utf8"), {
      adapters: ADAPTERS,
      rules: defaultRules,
      catalogVersion: "test",
    });
    if (!r.ok) return;
    for (const x of r.result.findings) {
      if (!x.documentationUrl) continue;
      expect(isOfficialDocUrl(x.documentationUrl), x.documentationUrl).toBe(true);
      links.add(x.documentationUrl);
    }
  });

  it("the fixtures exercise many distinct documentation links", () => {
    expect(links.size).toBeGreaterThan(20);
  });
});
