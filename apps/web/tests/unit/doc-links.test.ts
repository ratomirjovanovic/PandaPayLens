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

describe("finding documentation links", () => {
  it("every link a rule produces for the fixtures is on an official host", () => {
    const root = fileURLToPath(new URL("../../../../fixtures/", import.meta.url));
    const links = new Set<string>();
    for (const d of readdirSync(root)) {
      if (!statSync(join(root, d)).isDirectory()) continue;
      for (const f of readdirSync(join(root, d))) {
        const r = analyzeText(readFileSync(join(root, d, f), "utf8"), {
          adapters: ADAPTERS,
          rules: defaultRules,
          catalogVersion: "test",
        });
        if (!r.ok) continue;
        for (const x of r.result.findings) if (x.documentationUrl) links.add(x.documentationUrl);
      }
    }
    expect(links.size).toBeGreaterThan(20);
    for (const url of links) expect(isOfficialDocUrl(url), url).toBe(true);
  });
});
