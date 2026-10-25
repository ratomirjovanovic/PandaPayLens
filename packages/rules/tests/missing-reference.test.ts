import { describe, expect, it } from "vitest";
import type { AnalysisContext, NormalizedEvent } from "@pandapaylens/core";
import { missingReference } from "@pandapaylens/rules";

function event(id: string, paymentReference?: string): NormalizedEvent {
  return {
    id,
    provider: "test",
    sourceFormat: "test",
    eventType: "x",
    eventTypeKnown: true,
    stage: "capture",
    outcome: "success",
    ...(paymentReference ? { paymentReference } : {}),
    attributes: {},
    sourceIndex: 0,
    source: { recordIndex: 0, path: "" },
  };
}

function ctx(events: NormalizedEvent[], groups: string[][]): AnalysisContext {
  return {
    manifests: {},
    events,
    errors: [],
    groups: groups.map((ids, i) => ({
      id: `grp-${i}`,
      provider: "test",
      references: [],
      eventIds: ids,
      latestOutcome: "unknown",
    })),
    arrivalOrderInferred: true,
  };
}

const titles = (c: AnalysisContext) => missingReference.evaluate(c).map((f) => f.title);

describe("MISSING_REFERENCE", () => {
  it("does not report events linked into a group by another identifier", () => {
    const c = ctx([event("a", "P1"), event("b")], [["a", "b"]]);
    expect(titles(c)).toEqual([]);
  });

  it("reports a lone event without a payment reference", () => {
    const c = ctx([event("a", "P1"), event("b")], [["a"], ["b"]]);
    expect(titles(c)).toEqual(["1 event(s) without a payment reference"]);
  });

  it("reports an event that is in no group", () => {
    expect(titles(ctx([event("b")], []))).toEqual(["1 event(s) without a payment reference"]);
  });
});
