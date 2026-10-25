import { describe, expect, it } from "vitest";
import type { AnalysisContext, NormalizedEvent } from "@pandapaylens/core";
import {
  amountMismatch,
  captureFailedAfterAuthorization,
  chargebackReported,
  payoutStatus,
  recurringPaymentFailed,
  refundPending,
} from "@pandapaylens/rules";

let n = 0;
function ev(extra: Partial<NormalizedEvent>): NormalizedEvent {
  n++;
  return {
    id: `ev-${n}`,
    provider: "test",
    sourceFormat: "test",
    eventType: "x",
    eventTypeKnown: true,
    stage: "payment",
    outcome: "unknown",
    attributes: {},
    sourceIndex: n,
    source: { recordIndex: n, path: "" },
    ...extra,
  };
}

function ctx(events: NormalizedEvent[]): AnalysisContext {
  return {
    manifests: {},
    events,
    errors: [],
    groups: [
      {
        id: "grp-1",
        provider: "test",
        references: ["P"],
        eventIds: events.map((e) => e.id),
        latestOutcome: "unknown",
      },
    ],
    arrivalOrderInferred: true,
  };
}

const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();

describe("RECURRING_PAYMENT_FAILED", () => {
  it("reports a rebill decline after earlier successful cycles as confirmed", () => {
    const f = recurringPaymentFailed.evaluate(
      ctx([
        ev({ eventType: "initial", outcome: "success", eventTimestamp: t(0) }),
        ev({ eventType: "rebill", outcome: "success", isRecurring: true, eventTimestamp: t(1) }),
        ev({ eventType: "rebill", outcome: "failure", isRecurring: true, eventTimestamp: t(2) }),
      ]),
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      title: "Rebill declined after earlier successful payments",
      confidence: "confirmed",
    });
    expect(f[0]!.evidenceEventIds).toHaveLength(3);
  });

  it("ignores failed one-time payments and reports a lone recurring failure without claiming history", () => {
    expect(recurringPaymentFailed.evaluate(ctx([ev({ outcome: "failure" })]))).toEqual([]);
    const f = recurringPaymentFailed.evaluate(ctx([ev({ outcome: "failure", isRecurring: true })]));
    expect(f[0]!.title).toBe("Recurring charge failed");
  });
});

describe("CHARGEBACK_REPORTED", () => {
  it("links a chargeback to an earlier successful payment", () => {
    const f = chargebackReported.evaluate(
      ctx([
        ev({ outcome: "success", eventTimestamp: t(0) }),
        ev({ stage: "dispute", eventType: "chargeback", eventTimestamp: t(5) }),
      ]),
    );
    expect(f[0]).toMatchObject({
      title: "Chargeback after a successful payment",
      severity: "medium",
    });
  });

  it("does not claim fraud", () => {
    const f = chargebackReported.evaluate(ctx([ev({ stage: "dispute" })]));
    expect(f[0]!.title).toBe("Dispute or chargeback reported");
    expect(f[0]!.limitations.join(" ")).toMatch(/does not by itself show fraud/);
  });
});

describe("REFUND_PENDING", () => {
  it("reports a refund that never reached a final state", () => {
    expect(
      refundPending.evaluate(ctx([ev({ stage: "refund", outcome: "pending" })]))[0]!.title,
    ).toBe("Refund not yet confirmed");
    expect(
      refundPending.evaluate(
        ctx([
          ev({ stage: "refund", outcome: "pending" }),
          ev({ stage: "refund", outcome: "success" }),
        ]),
      ),
    ).toEqual([]);
  });
});

describe("PAYOUT_STATUS", () => {
  it("reports failed and unconfirmed payouts separately", () => {
    expect(
      payoutStatus.evaluate(ctx([ev({ stage: "payout", outcome: "failure" })]))[0]!.title,
    ).toBe("Payout failed");
    expect(
      payoutStatus.evaluate(ctx([ev({ stage: "payout", outcome: "pending" })]))[0]!.title,
    ).toBe("Payout not confirmed");
    expect(payoutStatus.evaluate(ctx([ev({ stage: "payout", outcome: "success" })]))).toEqual([]);
  });

  it("warns against paying twice", () => {
    const f = payoutStatus.evaluate(ctx([ev({ stage: "payout", outcome: "failure" })]));
    expect(f[0]!.limitations.join(" ")).toMatch(/avoid paying twice/);
  });
});

describe("CAPTURE_FAILED_AFTER_AUTHORIZATION", () => {
  it("requires the capture failure to come after a successful authorization", () => {
    const ok = captureFailedAfterAuthorization.evaluate(
      ctx([
        ev({ stage: "authorization", outcome: "success", eventTimestamp: t(0) }),
        ev({ stage: "capture", outcome: "failure", eventTimestamp: t(3) }),
      ]),
    );
    expect(ok).toHaveLength(1);
    const reversed = captureFailedAfterAuthorization.evaluate(
      ctx([
        ev({ stage: "capture", outcome: "failure", eventTimestamp: t(0) }),
        ev({ stage: "authorization", outcome: "success", eventTimestamp: t(3) }),
      ]),
    );
    expect(reversed).toEqual([]);
  });
});

describe("AMOUNT_MISMATCH", () => {
  it("flags refunds above the payment amount using exact integer math", () => {
    const f = amountMismatch.evaluate(
      ctx([
        ev({ outcome: "success", amountMinor: "1000", currency: "EUR" }),
        ev({ stage: "refund", outcome: "success", amountMinor: "600", currency: "EUR" }),
        ev({ stage: "refund", outcome: "success", amountMinor: "500", currency: "EUR" }),
      ]),
    );
    expect(f[0]).toMatchObject({ title: "Refunds exceed the payment amount" });
    expect(f[0]!.explanation).toContain("1100");
  });

  it("allows partial refunds and handles amounts beyond 2^53", () => {
    expect(
      amountMismatch.evaluate(
        ctx([
          ev({ outcome: "success", amountMinor: "1000", currency: "EUR" }),
          ev({ stage: "refund", outcome: "success", amountMinor: "999", currency: "EUR" }),
        ]),
      ),
    ).toEqual([]);
    const big = "90071992547409930";
    expect(
      amountMismatch.evaluate(
        ctx([
          ev({ outcome: "success", amountMinor: big, currency: "EUR" }),
          ev({
            stage: "refund",
            outcome: "success",
            amountMinor: "90071992547409931",
            currency: "EUR",
          }),
        ]),
      ),
    ).toHaveLength(1);
  });

  it("reports mixed currencies as possible only", () => {
    const f = amountMismatch.evaluate(
      ctx([ev({ amountMinor: "1", currency: "EUR" }), ev({ amountMinor: "1", currency: "USD" })]),
    );
    expect(f[0]).toMatchObject({ confidence: "possible", severity: "low" });
  });
});

describe("AMOUNT_MISMATCH with subscriptions", () => {
  it("compares refunds with the total of all billing cycles", () => {
    const f = amountMismatch.evaluate(
      ctx([
        ev({ outcome: "success", amountMinor: "1000", currency: "EUR", isRecurring: false }),
        ev({ outcome: "success", amountMinor: "1000", currency: "EUR", isRecurring: true }),
        ev({ stage: "refund", outcome: "success", amountMinor: "1000", currency: "EUR" }),
        ev({ stage: "refund", outcome: "success", amountMinor: "1000", currency: "EUR" }),
      ]),
    );
    expect(f).toEqual([]);
  });
});
