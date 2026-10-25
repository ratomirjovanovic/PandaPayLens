import { describe, expect, it } from "vitest";
import { analyzeText, type ProviderAdapter } from "@pandapaylens/core";
import { defaultRules } from "@pandapaylens/rules";

type Rec = {
  probe: string;
  kind: "payment" | "refund";
  amount: string;
  id?: string;
  repeat?: boolean;
};

/** Minimal id-less provider: no delivery key unless `id` is present. */
const probe: ProviderAdapter<Rec> = {
  id: "probe",
  displayName: "Probe",
  version: "0.0.0",
  supportedFormats: [{ id: "probe.v1", description: "test" }],
  detect: (input) =>
    input && typeof input === "object" && "probe" in input
      ? {
          provider: "probe",
          format: "probe.v1",
          confidence: 0.9,
          supported: true,
          reasons: ["probe"],
        }
      : { provider: "probe", format: null, confidence: 0, supported: false, reasons: [] },
  parse: (input) => ({ ok: true, value: input as Rec }),
  normalize: (r) => [
    {
      sourceFormat: "probe.v1",
      eventType: r.kind,
      eventTypeKnown: true,
      stage: r.kind,
      outcome: "success",
      paymentReference: r.probe,
      amountMinor: r.amount,
      currency: "EUR",
      ...(r.id ? { deliveryKey: r.id } : {}),
      ...(r.repeat ? { contentMayRepeat: true } : {}),
      attributes: {},
      source: { recordIndex: 0, path: "" },
    },
  ],
  decodeErrors: () => [],
  correlationKeys: (e) => (e.paymentReference ? [`p:${e.paymentReference}`] : []),
};

const run = (records: Rec[]) => {
  const r = analyzeText(JSON.stringify(records), {
    adapters: [probe],
    rules: defaultRules,
    catalogVersion: "test",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.result.findings;
};
const pay: Rec = { probe: "P1", kind: "payment", amount: "1000" };
const refund: Rec = { probe: "P1", kind: "refund", amount: "600" };

describe("repeats recognized by identical content", () => {
  it("reports identical id-less records once, as a possible repeat", () => {
    const dups = run([pay, refund, refund]).filter((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ confidence: "possible" });
  });

  it("counts a refund delivered twice only once", () => {
    // 600 + 600 would exceed the 1000 payment; one refund of 600 does not.
    expect(run([pay, refund, refund]).map((f) => f.ruleId)).not.toContain("AMOUNT_MISMATCH");
  });

  it("does not treat records that differ in any field as repeats", () => {
    const other = { ...refund, amount: "300" };
    expect(run([pay, refund, other]).map((f) => f.ruleId)).not.toContain("DUPLICATE_DELIVERY");
  });

  it("never merges events the provider marks as possibly identical", () => {
    // Two separate partial refunds of 600 do exceed the 1000 payment.
    const partial = { ...refund, repeat: true };
    const ids = run([pay, partial, partial]).map((f) => f.ruleId);
    expect(ids).not.toContain("DUPLICATE_DELIVERY");
    expect(ids).toContain("AMOUNT_MISMATCH");
  });

  it("keeps confirmed confidence for documented delivery keys", () => {
    const keyed = { ...refund, id: "evt_PPLsynth1" };
    const dup = run([pay, keyed, keyed]).find((f) => f.ruleId === "DUPLICATE_DELIVERY");
    expect(dup).toMatchObject({ confidence: "confirmed" });
  });
});
