import { describe, expect, it } from "vitest";
import { analyzeText, type ProviderAdapter } from "@pandapaylens/core";

type Rec = { p: string; at?: string; seen?: string; assumed?: boolean };

/** A test provider that passes its record's times through unchanged. */
const probe = (id: string): ProviderAdapter<Rec> => ({
  id,
  displayName: id === "a" ? "Provider A" : "Provider B",
  version: "0.0.0",
  supportedFormats: [{ id: `${id}.v1`, description: "test" }],
  detect: (input) =>
    input && typeof input === "object" && (input as Rec).p === id
      ? { provider: id, format: `${id}.v1`, confidence: 0.9, supported: true, reasons: [id] }
      : { provider: id, format: null, confidence: 0, supported: false, reasons: [] },
  parse: (input) => ({ ok: true, value: input as Rec }),
  normalize: (r, ctx) => [
    {
      sourceFormat: `${id}.v1`,
      eventType: "payment",
      eventTypeKnown: true,
      stage: "authorization",
      outcome: "success",
      paymentReference: `PPLsynth-${id}`,
      ...(r.at !== undefined ? { eventTimestamp: r.at } : {}),
      ...(r.seen !== undefined ? { observedTimestamp: r.seen } : {}),
      ...(r.assumed ? { eventTimeZoneAssumed: true } : {}),
      attributes: {},
      source: { recordIndex: ctx.recordIndex, path: "" },
    },
  ],
  decodeErrors: () => [],
  correlationKeys: () => [],
});

const run = (records: Rec[]) => {
  const r = analyzeText(JSON.stringify(records), {
    adapters: [probe("a"), probe("b")],
    rules: [],
    catalogVersion: "test",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.result;
};
const codes = (r: ReturnType<typeof run>) => r.warnings.map((w) => w.code);

describe("event time guard", () => {
  it("keeps ISO 8601 times with Z or an offset", () => {
    const r = run([
      { p: "a", at: "2026-10-25T10:00:00Z" },
      { p: "a", at: "2026-10-25T12:00:00.123+02:00" },
      { p: "a", at: "2026-10-25T10:00+0000" },
    ]);
    expect(r.events.map((e) => e.eventTimestamp).sort()).toEqual([
      "2026-10-25T10:00+0000",
      "2026-10-25T10:00:00Z",
      "2026-10-25T12:00:00.123+02:00",
    ]);
    expect(codes(r)).not.toContain("TIMESTAMP_IGNORED");
  });

  it("drops times without a zone, date-only values and malformed values", () => {
    const r = run([
      { p: "a", at: "2026-10-25 10:00:00" },
      { p: "a", at: "2026-10-25T10:00:00" },
      { p: "a", at: "2026-10-25" },
      { p: "a", at: "2026-13-45T10:00:00Z" },
      { p: "a", at: "yesterday", seen: "2026-10-25 10:00" },
    ]);
    expect(r.events.every((e) => e.eventTimestamp === undefined)).toBe(true);
    expect(r.events.every((e) => e.observedTimestamp === undefined)).toBe(true);
    const w = r.warnings.find((x) => x.code === "TIMESTAMP_IGNORED");
    expect(w?.message).toMatch(/^6 time value/);
  });

  it("clears the assumed-zone flag when the time itself is dropped", () => {
    const r = run([{ p: "a", at: "2026-10-25 10:00:00", assumed: true }]);
    expect(r.events[0]!.eventTimeZoneAssumed).toBeUndefined();
  });
});

describe("assumed time zones", () => {
  it("warns when assumed-UTC times are mixed with another provider's times", () => {
    const r = run([
      { p: "a", at: "2026-10-25T10:00:00.000Z", assumed: true },
      { p: "b", at: "2026-10-25T10:30:00.000Z" },
    ]);
    const w = r.warnings.find((x) => x.code === "TIME_ZONE_ASSUMED");
    expect(w?.message).toMatch(/^Provider A documents no time zone/);
    expect(r.events[0]!.eventTimeZoneAssumed).toBe(true);
  });

  it("does not warn for a single provider or when the other provider has no times", () => {
    expect(
      codes(
        run([
          { p: "a", at: "2026-10-25T10:00:00.000Z", assumed: true },
          { p: "a", at: "2026-10-25T11:00:00.000Z", assumed: true },
        ]),
      ),
    ).not.toContain("TIME_ZONE_ASSUMED");
    expect(
      codes(run([{ p: "a", at: "2026-10-25T10:00:00.000Z", assumed: true }, { p: "b" }])),
    ).not.toContain("TIME_ZONE_ASSUMED");
  });
});
