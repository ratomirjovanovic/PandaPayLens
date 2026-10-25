import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeText, toJsonReport } from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules } from "@pandapaylens/rules";

const root = fileURLToPath(new URL("../../../fixtures/", import.meta.url));
const ids = new Set(ADAPTERS.map((a) => a.id));
const opts = { adapters: ADAPTERS, rules: defaultRules, catalogVersion: "test" };

/** Fixture folders named after a registered provider. */
const cases = readdirSync(root)
  .filter((d) => ids.has(d) && statSync(join(root, d)).isDirectory())
  .flatMap((d) =>
    readdirSync(join(root, d))
      .filter((f) => /\.(json|jsonl|txt|http)$/.test(f) && !/malformed|invalid/i.test(f))
      .map((f) => [d, f] as const),
  );

describe("cross-provider detection", () => {
  it("has fixtures for every registered provider", () => {
    for (const id of ids)
      expect(
        cases.some(([d]) => d === id),
        `no fixtures for ${id}`,
      ).toBe(true);
  });

  it.each(cases)("%s/%s is attributed only to its own provider", (provider, file) => {
    const r = analyzeText(readFileSync(join(root, provider, file), "utf8"), opts);
    if (!r.ok) return; // parse failures are covered by each adapter's own tests
    for (const rec of r.result.records) {
      if (rec.provider === null) continue; // unrecognized records are allowed (e.g. mixed inputs)
      expect(rec.provider, `record ${rec.recordIndex} detected as ${rec.provider}`).toBe(provider);
      for (const alt of rec.alternatives) {
        // Another adapter may score low, but never at or above the acceptance threshold.
        expect(
          alt.confidence,
          `${alt.provider} also matched record ${rec.recordIndex}`,
        ).toBeLessThan(0.5);
      }
    }
    expect(r.result.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
    expect(() => toJsonReport(r.result)).not.toThrow();
  });
});

describe("shared fixtures with the full registry", () => {
  it("mixed Stripe/Adyen input is not claimed by any other adapter", () => {
    const r = analyzeText(
      readFileSync(join(root, "mixed/unrelated-transactions.json"), "utf8"),
      opts,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.records.map((x) => x.provider)).toEqual([
        "stripe",
        "stripe",
        "stripe",
        "adyen",
      ]);
      expect(r.result.warnings.map((w) => w.code)).not.toContain("AMBIGUOUS_PROVIDER");
    }
  });

  it.each(["unknown-provider-error.json", "xss.json", "prototype-pollution.json"])(
    "malformed/%s is not misattributed",
    (file) => {
      const r = analyzeText(readFileSync(join(root, "malformed", file), "utf8"), opts);
      expect(r.ok).toBe(true);
      if (r.ok) {
        for (const rec of r.result.records) expect([null, "stripe"]).toContain(rec.provider);
      }
    },
  );
});

describe("snapshot records", () => {
  it("history inside a status response is not reported as a late arrival", () => {
    const r = analyzeText(readFileSync(join(root, "ecommpay/two-step-flow.json"), "utf8"), opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.findings.map((f) => f.ruleId)).not.toContain("OUT_OF_ORDER_ARRIVAL");
    }
  });
});
