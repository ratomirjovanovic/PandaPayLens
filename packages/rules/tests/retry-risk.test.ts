import { describe, expect, it } from "vitest";
import type { AnalysisContext, DecodedError, NormalizedEvent } from "@pandapaylens/core";
import { possibleRetryRisk } from "@pandapaylens/rules";

function err(i: number, category: DecodedError["category"]): DecodedError {
  return {
    id: `err-${i}`,
    provider: "test",
    sourceFormat: "test",
    code: `C${i}`,
    subCodes: {},
    category,
    explanation: "",
    nextAction: "",
    retry: "do_not_retry",
    retryExplanation: "",
    confidence: "strong",
    documentation: [],
    missingInformation: [],
    paymentReference: "P1",
    attemptReference: `A${i}`,
    outcomeKnown: true,
    source: { recordIndex: i, path: "" },
  };
}

function event(i: number, stage: NormalizedEvent["stage"]): NormalizedEvent {
  return {
    id: `ev-${i}`,
    provider: "test",
    sourceFormat: "test",
    eventType: "x",
    eventTypeKnown: true,
    stage,
    outcome: "failure",
    paymentReference: "P1",
    attributes: {},
    sourceIndex: i,
    source: { recordIndex: i, path: "" },
  };
}

function ctx(stage: NormalizedEvent["stage"], category: DecodedError["category"]): AnalysisContext {
  return {
    manifests: {},
    events: [event(0, stage), event(1, stage)],
    errors: [err(0, category), err(1, category)],
    groups: [],
    arrivalOrderInferred: true,
  };
}

const repeated = (c: AnalysisContext) =>
  possibleRetryRisk.evaluate(c).filter((f) => f.title.includes("do-not-retry"));

describe("POSSIBLE_RETRY_RISK repeated attempts", () => {
  it("keeps card network advice for card declines", () => {
    const [f] = repeated(ctx("payment", "card_declined"));
    expect(f!.title).toBe("2 attempts after a do-not-retry decline");
    expect(f!.explanation).toMatch(/card networks/);
    expect(f!.recommendedAction).toMatch(/another payment method/);
  });

  it("gives payout advice without card wording", () => {
    const [f] = repeated(ctx("payout", "invalid_request"));
    expect(f!.title).toBe("2 attempts after a do-not-retry error");
    expect(f!.explanation).toMatch(/^The same payout/);
    expect(`${f!.explanation} ${f!.recommendedAction}`).not.toMatch(/card|payment method/);
    expect(f!.recommendedAction).toMatch(/recipient details/);
  });

  it("stays neutral for other payment errors", () => {
    const [f] = repeated(ctx("payment", "insufficient_funds"));
    expect(f!.explanation).not.toMatch(/card/);
    expect(f!.recommendedAction).toMatch(/Fix the cause/);
  });
});
