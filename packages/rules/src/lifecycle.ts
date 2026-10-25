/**
 * Lifecycle rules: recurring billing, disputes, refunds,
 * payouts and amount consistency. Provider-agnostic; they read only the
 * normalized stage, outcome, amount and the optional subscription fields
 * that adapters set from documented data.
 *
 * Like the other rules, they report what the supplied records show. They never
 * claim why an issuer or acquirer declined, and never suggest retrying against
 * provider guidance.
 */
import type {
  AnalysisContext,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedEvent,
} from "@pandapaylens/core";

type Finding = Omit<DiagnosticFinding, "ruleId" | "ruleVersion">;

const time = (e: NormalizedEvent) => (e.eventTimestamp ? Date.parse(e.eventTimestamp) : undefined);

function groups(ctx: AnalysisContext): NormalizedEvent[][] {
  const byId = new Map(ctx.events.map((e) => [e.id, e]));
  const order = new Map(ctx.events.map((e, i) => [e.id, i]));
  return ctx.groups.map((g) =>
    g.eventIds.map((id) => byId.get(id)!).sort((a, b) => order.get(a.id)! - order.get(b.id)!),
  );
}

/** Drop repeated deliveries so one business event is counted once. */
function unique(events: readonly NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (!e.deliveryKey) return true;
    const k = `${e.provider}:${e.deliveryKey}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** True when `a` is known to come before `b` (by event time, else by source order). */
function before(a: NormalizedEvent, b: NormalizedEvent): boolean {
  const ta = time(a);
  const tb = time(b);
  if (ta !== undefined && tb !== undefined) return ta < tb;
  return a.sourceIndex < b.sourceIndex;
}

const isPaymentSuccess = (e: NormalizedEvent) =>
  e.outcome === "success" &&
  (e.stage === "payment" ||
    e.stage === "authorization" ||
    e.stage === "capture" ||
    e.stage === "settlement");

export const recurringPaymentFailed: DiagnosticRule = {
  id: "RECURRING_PAYMENT_FAILED",
  version: "1.0.0",
  providers: ["*"],
  description: "A recurring (rebill) charge failed, possibly after earlier successful cycles.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const events = unique(g);
      const failed = events.filter((e) => e.isRecurring && e.outcome === "failure");
      for (const f of failed) {
        const earlier = events.filter((e) => e !== f && isPaymentSuccess(e) && before(e, f));
        out.push({
          severity: "medium",
          confidence: "confirmed",
          title: earlier.length
            ? "Rebill declined after earlier successful payments"
            : "Recurring charge failed",
          explanation: earlier.length
            ? `A recurring charge failed (${f.eventType}) after ${earlier.length} earlier successful payment(s) in the same transaction group.`
            : `A recurring charge failed (${f.eventType}). No earlier successful payment is present in the supplied records.`,
          evidenceEventIds: [...earlier.map((e) => e.id), f.id],
          recommendedAction:
            "Check the decoded reason and the provider's dunning or retry settings. Ask the customer to update their payment method if the decline requires it.",
          limitations: [
            "The records do not show whether the provider will retry the charge automatically.",
            "PandaPayLens does not know why the issuer or acquirer declined beyond what the payload states.",
          ],
        });
      }
    }
    return out;
  },
};

export const chargebackReported: DiagnosticRule = {
  id: "CHARGEBACK_REPORTED",
  version: "1.0.0",
  providers: ["*"],
  description: "A dispute or chargeback is reported, possibly after a successful payment.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const events = unique(g);
      const disputes = events.filter((e) => e.stage === "dispute");
      if (!disputes.length) continue;
      const first = disputes[0]!;
      const paid = events.filter((e) => isPaymentSuccess(e) && before(e, first));
      out.push({
        severity: "medium",
        confidence: "confirmed",
        title: paid.length
          ? "Chargeback after a successful payment"
          : "Dispute or chargeback reported",
        explanation: `${disputes.length} dispute or chargeback event(s) appear in this transaction${
          paid.length ? ", after a payment the provider reported as successful" : ""
        }: ${[...new Set(disputes.map((d) => d.eventType))].join(", ")}.`,
        evidenceEventIds: [...paid.map((e) => e.id), ...disputes.map((e) => e.id)],
        recommendedAction:
          "Review the dispute in the provider's dashboard and respond within its deadline if you contest it.",
        limitations: [
          "The supplied records may not include the dispute's final outcome.",
          "A chargeback does not by itself show fraud; the reason code, if present, comes from the provider or card network.",
        ],
      });
    }
    return out;
  },
};

export const refundPending: DiagnosticRule = {
  id: "REFUND_PENDING",
  version: "1.0.0",
  providers: ["*"],
  description: "A refund was initiated but its completion is not shown.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const refunds = unique(g).filter((e) => e.stage === "refund");
      if (!refunds.length) continue;
      if (refunds.some((e) => e.outcome === "success" || e.outcome === "failure")) continue;
      if (!refunds.some((e) => e.outcome === "pending")) continue;
      out.push({
        severity: "low",
        confidence: "possible",
        title: "Refund not yet confirmed",
        explanation:
          "A refund appears as pending, and no later record shows it completed or failed.",
        evidenceEventIds: refunds.map((e) => e.id),
        recommendedAction:
          "Check the refund's current status with the provider before telling the customer it is complete.",
        limitations: [
          "A refund initiation is not a completed refund; later events may exist that were not supplied.",
        ],
      });
    }
    return out;
  },
};

export const payoutStatus: DiagnosticRule = {
  id: "PAYOUT_STATUS",
  version: "1.0.0",
  providers: ["*"],
  description: "A payout failed or remains unconfirmed in the supplied records.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const payouts = unique(g).filter((e) => e.stage === "payout");
      if (!payouts.length) continue;
      const failed = payouts.filter((e) => e.outcome === "failure");
      const final = payouts.some((e) => e.outcome === "success" || e.outcome === "failure");
      if (failed.length) {
        out.push({
          severity: "medium",
          confidence: "confirmed",
          title: "Payout failed",
          explanation: `The provider reported a failed payout: ${[...new Set(failed.map((e) => e.eventType))].join(", ")}.`,
          evidenceEventIds: failed.map((e) => e.id),
          recommendedAction:
            "Check the payout's failure reason and the recipient's details before issuing a new payout.",
          limitations: [
            "A new payout should only be sent once the failure is confirmed with the provider, to avoid paying twice.",
          ],
        });
      } else if (!final) {
        out.push({
          severity: "low",
          confidence: "possible",
          title: "Payout not confirmed",
          explanation:
            "A payout appears in the supplied records, but none of them shows it completed or failed.",
          evidenceEventIds: payouts.map((e) => e.id),
          recommendedAction:
            "Wait for the provider's final notification or check the payout status before acting.",
          limitations: ["Later events may exist that were not supplied."],
        });
      }
    }
    return out;
  },
};

export const captureFailedAfterAuthorization: DiagnosticRule = {
  id: "CAPTURE_FAILED_AFTER_AUTHORIZATION",
  version: "1.0.0",
  providers: ["*"],
  description: "An authorization succeeded but a later capture failed.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const events = unique(g);
      const auth = events.filter((e) => e.stage === "authorization" && e.outcome === "success");
      const failedCaptures = events.filter((e) => e.stage === "capture" && e.outcome === "failure");
      if (!auth.length || !failedCaptures.length) continue;
      const later = failedCaptures.filter((c) => auth.some((a) => before(a, c)));
      if (!later.length) continue;
      out.push({
        severity: "medium",
        confidence: "confirmed",
        title: "Capture failed after a successful authorization",
        explanation:
          "The authorization succeeded, but a later capture of the same payment failed. Funds were reserved but not collected.",
        evidenceEventIds: [...auth.map((e) => e.id), ...later.map((e) => e.id)],
        recommendedAction:
          "Check the capture's failure reason and whether the authorization is still valid before capturing again.",
        limitations: [
          "An authorization can expire; the records may not show whether it is still open.",
        ],
      });
    }
    return out;
  },
};

export const amountMismatch: DiagnosticRule = {
  id: "AMOUNT_MISMATCH",
  version: "1.1.0",
  providers: ["*"],
  description:
    "Refunded or captured amounts exceed the paid or authorized amount, or currencies differ.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of groups(ctx)) {
      const events = unique(g).filter(
        (e) => e.amountMinor !== undefined && /^-?\d+$/.test(e.amountMinor) && e.currency,
      );
      const currencies = new Set(events.map((e) => e.currency));
      if (currencies.size > 1) {
        out.push({
          severity: "low",
          confidence: "possible",
          title: "Different currencies in one transaction",
          explanation: `Events of the same transaction report different currencies: ${[...currencies].join(", ")}.`,
          evidenceEventIds: events.map((e) => e.id),
          recommendedAction: "Check whether currency conversion is expected for this payment.",
          limitations: [
            "Some providers legitimately report settlement in a different currency than the charge.",
          ],
        });
        continue;
      }
      const sum = (list: NormalizedEvent[]) =>
        list.reduce((n, e) => n + BigInt(e.amountMinor!), 0n);
      const paid = events.filter(
        (e) => e.outcome === "success" && (e.stage === "payment" || e.stage === "authorization"),
      );
      // A subscription group holds several separate charges (one per cycle), so
      // refunds are compared with their total. Otherwise one payment is often
      // reported by several events, so the largest single amount is the base.
      const recurring = paid.some((e) => e.isRecurring === true);
      const base = !paid.length
        ? null
        : recurring
          ? sum(paid)
          : paid.reduce((m, e) => (BigInt(e.amountMinor!) > m ? BigInt(e.amountMinor!) : m), 0n);
      if (base === null) continue;
      const refunds = events.filter((e) => e.stage === "refund" && e.outcome === "success");
      const refunded = sum(refunds);
      if (refunds.length && refunded > base) {
        out.push({
          severity: "medium",
          confidence: "strong",
          title: "Refunds exceed the payment amount",
          explanation: `Successful refunds total ${refunded} (minor units), more than the payment amount of ${base}.`,
          evidenceEventIds: refunds.map((e) => e.id),
          recommendedAction: "Check for duplicate refunds or refunds linked to the wrong payment.",
          limitations: [
            "Repeated deliveries of the same refund are counted once only when the provider documents a delivery key.",
          ],
        });
      }
    }
    return out;
  },
};

export const LIFECYCLE_RULES: readonly DiagnosticRule[] = [
  recurringPaymentFailed,
  captureFailedAfterAuthorization,
  chargebackReported,
  payoutStatus,
  amountMismatch,
  refundPending,
];
