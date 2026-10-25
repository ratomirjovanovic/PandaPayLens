import { describe, expect, it } from "vitest";
import {
  analyzeRecords,
  analyzeSources,
  analyzeText,
  correlate,
  sortEvents,
  toIsoTimestamp,
  type DiagnosticRule,
  type NormalizedEvent,
  type ProviderAdapter,
} from "@pandapaylens/core";

/** Minimal adapter: records like { fake: "ref", t?: number, ok?: boolean }. */
const fake: ProviderAdapter<{ fake: string; t?: number; ok?: boolean; link?: string }> = {
  id: "fake",
  displayName: "Fake",
  version: "0.0.0",
  supportedFormats: [{ id: "fake.v1", description: "test" }],
  detect: (input) =>
    input && typeof input === "object" && "fake" in input
      ? {
          provider: "fake",
          format: "fake.v1",
          confidence: 0.9,
          supported: true,
          reasons: ["has fake"],
        }
      : { provider: "fake", format: null, confidence: 0, supported: false, reasons: [] },
  parse: (input) =>
    typeof (input as { fake: unknown }).fake === "string"
      ? { ok: true, value: input as { fake: string } }
      : { ok: false, issues: ["fake must be a string"] },
  normalize: (p, ctx) => [
    {
      sourceFormat: ctx.format,
      eventType: "fake.event",
      eventTypeKnown: true,
      stage: "payment",
      paymentReference: p.fake,
      ...(p.link ? { relatedReference: p.link } : {}),
      ...(p.t !== undefined ? { eventTimestamp: new Date(p.t * 1000).toISOString() } : {}),
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
      outcome: p.ok === undefined ? "unknown" : p.ok ? "success" : "failure",
      attributes: {},
      source: { recordIndex: ctx.recordIndex, path: "" },
    },
  ],
  decodeErrors: () => [],
  correlationKeys: (e) =>
    [e.paymentReference, e.relatedReference].filter((x): x is string => Boolean(x)),
};

const opts = {
  adapters: [fake],
  rules: [],
  catalogVersion: "test",
  now: () => new Date("2026-01-01T00:00:00Z"),
};

describe("analyzeText", () => {
  it("returns parse errors without throwing", () => {
    const r = analyzeText("{", opts);
    expect(!r.ok && r.error.code).toBe("INVALID_JSON");
  });

  it("marks unrecognized records as unsupported and warns", () => {
    const r = analyzeText('[{"other":1}]', opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.records[0]!.status).toBe("unsupported");
      expect(r.result.warnings.map((w) => w.code)).toEqual([
        "UNSUPPORTED_RECORD",
        "NO_ANALYZABLE_RECORDS",
      ]);
    }
  });

  it("marks records that fail schema validation as invalid", () => {
    const r = analyzeText('{"fake": 5}', opts);
    expect(r.ok && r.result.records[0]!.status).toBe("invalid");
    expect(r.ok && r.result.warnings[0]!.code).toBe("INVALID_RECORD");
  });

  it("unwraps the receivedAt envelope into observedTimestamp", () => {
    const r = analyzeText(
      '{"receivedAt":"2026-01-01T10:00:00+02:00","payload":{"fake":"a"}}',
      opts,
    );
    expect(r.ok && r.result.events[0]!.observedTimestamp).toBe("2026-01-01T08:00:00.000Z");
    expect(r.ok && r.result.arrivalOrderInferred).toBe(false);
  });

  it("does not treat objects with extra keys as envelopes", () => {
    const r = analyzeText(
      '{"receivedAt":"2026-01-01T00:00:00Z","payload":{"fake":"a"},"x":1}',
      opts,
    );
    expect(r.ok && r.result.records[0]!.status).toBe("unsupported");
  });

  it("rejects an unknown provider override with a typed error", () => {
    const r = analyzeText('{"fake":"a"}', { ...opts, provider: "nope" });
    expect(!r.ok && r.error.code).toBe("UNKNOWN_PROVIDER");
  });

  it("uses a provider override even below the detection threshold", () => {
    const low: ProviderAdapter<{ fake: string }> = {
      ...fake,
      detect: (i) => ({ ...fake.detect(i), confidence: 0.2 }),
    };
    expect(
      analyzeText('{"fake":"a"}', { ...opts, adapters: [low] }).ok &&
        analyzeText('{"fake":"a"}', { ...opts, adapters: [low] }),
    ).toMatchObject({ result: { events: [] } });
    const r = analyzeText('{"fake":"a"}', { ...opts, adapters: [low], provider: "fake" });
    expect(r.ok && r.result.events).toHaveLength(1);
  });

  it("warns when two adapters match with similar confidence", () => {
    const twin = { ...fake, id: "twin", displayName: "Twin" };
    const r = analyzeText('{"fake":"a"}', { ...opts, adapters: [fake, twin] });
    expect(r.ok && r.result.warnings.some((w) => w.code === "AMBIGUOUS_PROVIDER")).toBe(true);
  });

  it("reports rule failures as warnings instead of crashing", () => {
    const broken: DiagnosticRule = {
      id: "BROKEN",
      version: "1",
      providers: ["*"],
      description: "",
      evaluate: () => {
        throw new Error("boom");
      },
    };
    const r = analyzeText('{"fake":"a"}', { ...opts, rules: [broken] });
    expect(r.ok && r.result.warnings.find((w) => w.code === "RULE_FAILED")?.message).toMatch(
      /BROKEN.*boom/,
    );
  });

  it("skips rules for providers that are not present", () => {
    let called = false;
    const rule: DiagnosticRule = {
      id: "R",
      version: "1",
      providers: ["stripe"],
      description: "",
      evaluate: () => ((called = true), []),
    };
    analyzeText('{"fake":"a"}', { ...opts, rules: [rule] });
    expect(called).toBe(false);
  });

  it("returns INTERNAL_ERROR when an adapter throws during normalization", () => {
    const bad = {
      ...fake,
      normalize: () => {
        throw new Error("adapter bug");
      },
    };
    const r = analyzeRecords([{ fake: "a" }], { ...opts, adapters: [bad] });
    expect(!r.ok && r.error.code).toBe("INTERNAL_ERROR");
  });

  it("treats a throwing detect() as no match", () => {
    const bad = {
      ...fake,
      detect: () => {
        throw new Error("x");
      },
    };
    const r = analyzeRecords([{ fake: "a" }], { ...opts, adapters: [bad] });
    expect(r.ok && r.result.records[0]!.status).toBe("unsupported");
  });

  it("flags sensitive data and records metadata", () => {
    const r = analyzeText('{"fake":"a","email":"x@example.com"}', opts);
    expect(r.ok && r.result.sensitiveData).toEqual({ detected: true, fieldPaths: ["[0].email"] });
    expect(r.ok && r.result.meta.analyzedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("suggests the timeline view for event data", () => {
    const r = analyzeText('[{"fake":"a"},{"fake":"a"}]', opts);
    expect(r.ok && r.result.suggestedView).toBe("timeline");
  });
});

const ev = (id: string, extra: Partial<NormalizedEvent>): NormalizedEvent => ({
  id,
  provider: "fake",
  sourceFormat: "fake.v1",
  eventType: "x",
  eventTypeKnown: true,
  stage: "payment",
  outcome: "unknown",
  attributes: {},
  sourceIndex: Number(id.slice(1)),
  source: { recordIndex: 0, path: "" },
  ...extra,
});

describe("sortEvents", () => {
  it("orders by event time, then observation time, then source order; untimed last", () => {
    const sorted = sortEvents([
      ev("e0", {}),
      ev("e1", { eventTimestamp: "2026-01-01T00:00:02Z" }),
      ev("e2", {
        eventTimestamp: "2026-01-01T00:00:01Z",
        observedTimestamp: "2026-01-01T00:00:09Z",
      }),
      ev("e3", {
        eventTimestamp: "2026-01-01T00:00:01Z",
        observedTimestamp: "2026-01-01T00:00:05Z",
      }),
      ev("e4", {
        eventTimestamp: "2026-01-01T00:00:01Z",
        observedTimestamp: "2026-01-01T00:00:05Z",
      }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["e3", "e4", "e2", "e1", "e0"]);
  });
});

describe("correlate", () => {
  it("links events transitively through shared references only", () => {
    const groups = correlate(
      [
        ev("e1", { paymentReference: "A" }),
        ev("e2", { paymentReference: "B", relatedReference: "C" }),
        ev("e3", { paymentReference: "A", relatedReference: "C" }),
        ev("e4", { paymentReference: "Z" }),
        ev("e5", {}),
      ],
      [fake],
    );
    expect(groups.map((g) => g.eventIds)).toEqual([["e1", "e2", "e3"], ["e4"], ["e5"]]);
    expect(groups[0]!.references.sort()).toEqual(["A", "B", "C"]);
  });

  it("namespaces keys per provider", () => {
    const other = { ...fake, id: "other" };
    const groups = correlate(
      [ev("e1", { paymentReference: "A" }), ev("e2", { paymentReference: "A", provider: "other" })],
      [fake, other],
    );
    expect(groups).toHaveLength(2);
  });
});

describe("toIsoTimestamp", () => {
  it("handles unix seconds, milliseconds, ISO strings and junk", () => {
    expect(toIsoTimestamp(1761379200)).toBe("2025-10-25T08:00:00.000Z");
    expect(toIsoTimestamp(1761379200000)).toBe("2025-10-25T08:00:00.000Z");
    expect(toIsoTimestamp("2026-10-25T09:00:00+02:00")).toBe("2026-10-25T07:00:00.000Z");
    expect(toIsoTimestamp("not a date")).toBeUndefined();
    expect(toIsoTimestamp(Number.NaN)).toBeUndefined();
    expect(toIsoTimestamp({})).toBeUndefined();
  });
});

describe("analyzeSources", () => {
  it("combines sources and keeps per-source offsets", () => {
    const r = analyzeSources(
      [
        { name: "a.json", text: '[{"fake":"x"},{"fake":"y"}]' },
        { name: "b.jsonl", text: '{"fake":"x"}\n{"__proto__":1,"fake":"z"}' },
      ],
      opts,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sources).toEqual([
        { name: "a.json", recordStart: 0, recordCount: 2, format: "json" },
        { name: "b.jsonl", recordStart: 2, recordCount: 2, format: "jsonl" },
      ]);
      expect(r.result.groups).toHaveLength(3);
      expect(r.result.warnings[0]).toMatchObject({ code: "DANGEROUS_KEY_REMOVED", recordIndex: 3 });
    }
  });

  it("names the failing source", () => {
    const r = analyzeSources(
      [
        { name: "ok.json", text: "{}" },
        { name: "bad.json", text: "{" },
      ],
      opts,
    );
    expect(!r.ok && r.error).toMatchObject({ code: "INVALID_JSON", source: "bad.json" });
  });

  it("enforces session size and record limits", () => {
    const big = { name: "x", text: `"${"a".repeat(60)}"` };
    expect(analyzeSources([big, big], { ...opts, sessionMaxBytes: 100 })).toMatchObject({
      ok: false,
      error: { code: "SESSION_TOO_LARGE" },
    });
    expect(
      analyzeSources(
        [
          { name: "a", text: "[1,2]" },
          { name: "b", text: "[3]" },
        ],
        { ...opts, limits: { maxRecords: 2 } },
      ),
    ).toMatchObject({ ok: false, error: { code: "TOO_MANY_RECORDS" } });
  });
});

describe("toIsoTimestamp zones", () => {
  it("rejects date-times without a zone and keeps zoned ones", () => {
    expect(toIsoTimestamp("2026-10-25T10:00:00")).toBeUndefined();
    expect(toIsoTimestamp("2026-10-25 10:00:00")).toBeUndefined();
    expect(toIsoTimestamp("2026-10-25T10:00:00Z")).toBe("2026-10-25T10:00:00.000Z");
    expect(toIsoTimestamp("2026-10-25T10:00:00+0200")).toBe("2026-10-25T08:00:00.000Z");
    expect(toIsoTimestamp("2026-10-25")).toBe("2026-10-25T00:00:00.000Z");
  });
});

describe("lenient JSON warning", () => {
  it("tells the user which non-standard syntax was removed", () => {
    const r = analyzeText('{"fake": "x", // comment\n}', opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.events).toHaveLength(1);
      expect(r.result.warnings[0]).toEqual({
        code: "LENIENT_JSON",
        message:
          "The input is not strict JSON. Removed trailing commas and comments before parsing.",
      });
    }
  });

  it("names the source file in a multi-file session", () => {
    const r = analyzeSources(
      [
        { name: "strict.json", text: '{"fake":"x"}' },
        { name: "docs.json", text: '{"fake":"y",}' },
      ],
      opts,
    );
    expect(r.ok && r.result.warnings.filter((w) => w.code === "LENIENT_JSON")).toEqual([
      {
        code: "LENIENT_JSON",
        message: "docs.json: The input is not strict JSON. Removed trailing commas before parsing.",
      },
    ]);
  });

  it("adds no warning for strict JSON", () => {
    const r = analyzeText('{"fake": "x"}', opts);
    expect(r.ok && r.result.warnings.map((w) => w.code)).not.toContain("LENIENT_JSON");
  });
});
