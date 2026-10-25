/**
 * PandaPayLens diagnostic rule catalog.
 *
 * Finding text must not quote payment identifiers: evidence is referenced by
 * event id, so masking in the UI and in exports stays effective.
 *
 * Rules are pure functions of the normalized analysis context: no network,
 * no storage, no dynamic code. Each rule states what the supplied data shows
 * and what it cannot show. Provider behavior (duplicate delivery, out-of-order
 * arrival) is reported as information, not as a defect.
 */

import type {
  AnalysisContext,
  DeliveryProfile,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedEvent,
} from "@pandapaylens/core";
import { LIFECYCLE_RULES } from "./lifecycle.js";
import { repeatKey } from "./repeat.js";

export { repeatKey };

export const RULE_CATALOG_VERSION = "2026.10.5";

type Finding = Omit<DiagnosticFinding, "ruleId" | "ruleVersion">;

const STRIPE_WEBHOOKS = "https://docs.stripe.com/webhooks#handle-duplicate-events";
const STRIPE_ORDER = "https://docs.stripe.com/webhooks#event-ordering";
const ADYEN_HANDLE = "https://docs.adyen.com/development-resources/webhooks/handle-webhook-events";
const STRIPE_IDEMPOTENCY = "https://docs.stripe.com/api/idempotent_requests";
const IDEMPOTENCY_DOCS: Record<string, string> = {
  stripe: STRIPE_IDEMPOTENCY,
  adyen: "https://docs.adyen.com/development-resources/api-idempotency",
  paypal: "https://developer.paypal.com/api/rest/reference/idempotency/",
  square: "https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency",
  mollie: "https://docs.mollie.com/reference/api-idempotency",
  checkout: "https://www.checkout.com/docs/developer-resources/api/idempotency",
};

const time = (e: NormalizedEvent) => (e.eventTimestamp ? Date.parse(e.eventTimestamp) : undefined);

function groupBy<T>(items: readonly T[], key: (t: T) => string | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (k === undefined) continue;
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Events of one transaction group, in context (chronological) order. */
function eventsByGroup(ctx: AnalysisContext): { id: string; events: NormalizedEvent[] }[] {
  const byId = new Map(ctx.events.map((e) => [e.id, e]));
  const order = new Map(ctx.events.map((e, i) => [e.id, i]));
  return ctx.groups.map((g) => ({
    id: g.id,
    events: g.eventIds
      .map((id) => byId.get(id)!)
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!),
  }));
}

/** First delivery of each deliveryKey; later copies are dropped. */
function uniqueDeliveries(events: readonly NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = repeatKey(e);
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const deliveryGroups = (ctx: AnalysisContext) =>
  [...groupBy(ctx.events, repeatKey).values()].filter((l) => l.length > 1);

const FALLBACK_DELIVERY: DeliveryProfile = {
  duplicateKey: "delivery key",
  duplicatesDocumented: false,
  ordering: "not_documented",
  dedupeAdvice: "Make sure your notification handler is idempotent before acting on a delivery.",
};

const deliveryOf = (ctx: AnalysisContext, provider: string) =>
  ctx.manifests[provider]?.delivery ?? FALLBACK_DELIVERY;
const nameOf = (ctx: AnalysisContext, provider: string) =>
  ctx.manifests[provider]?.displayName ?? provider;

const describe = (e: NormalizedEvent) =>
  `${e.eventType}${e.providerStatus ? ` (${e.providerStatus})` : ""}`;

export const duplicateDelivery: DiagnosticRule = {
  id: "DUPLICATE_DELIVERY",
  version: "1.2.0",
  providers: ["*"],
  description: "The same provider event appears more than once in the supplied data.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const list of deliveryGroups(ctx)) {
      // Copies that disagree are reported by CONFLICTING_OBSERVATIONS instead.
      if (new Set(list.map((e) => `${e.outcome}|${e.providerStatus ?? ""}`)).size > 1) continue;
      const first = list[0]!;
      const d = deliveryOf(ctx, first.provider);
      const name = nameOf(ctx, first.provider);
      const byKey = Boolean(first.deliveryKey);
      out.push({
        severity: list.length >= 3 ? "low" : "info",
        confidence: byKey ? "confirmed" : "possible",
        title: byKey
          ? `${describe(first)} delivered ${list.length} times`
          : `Identical ${describe(first)} record appears ${list.length} times`,
        explanation: byKey
          ? `The same ${name} event (same ${d.duplicateKey}) appears ${list.length} times. ${
              d.duplicatesDocumented
                ? `${name} documents that it can deliver the same notification more than once, so this is expected delivery behavior, not necessarily an application bug.`
                : "Repeated deliveries are common with webhooks and are not necessarily an application bug."
            }`
          : `${list.length} records from ${name} have identical content. ${name} sends no delivery id for this kind of record, so this is most likely the same notification delivered again or the same object fetched again; it is counted once.`,
        evidenceEventIds: list.map((e) => e.id),
        recommendedAction: d.dedupeAdvice,
        ...(d.docsUrl ? { documentationUrl: d.docsUrl } : {}),
        limitations: byKey
          ? [
              "The supplied data cannot show whether your application processed the event more than once.",
            ]
          : [
              "Identical content does not prove a repeated delivery: two separate events with exactly the same fields would look the same.",
              "The supplied data cannot show whether your application processed the record more than once.",
            ],
      });
    }
    return out;
  },
};

export const conflictingObservations: DiagnosticRule = {
  id: "CONFLICTING_OBSERVATIONS",
  version: "1.1.0",
  providers: ["*"],
  description: "Repeated deliveries of one event report incompatible states.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const list of deliveryGroups(ctx)) {
      const variants = new Set(list.map((e) => `${e.outcome}|${e.providerStatus ?? ""}`));
      if (variants.size < 2) continue;
      const first = list[0]!;
      const d = deliveryOf(ctx, first.provider);
      out.push({
        severity: "medium",
        confidence: "confirmed",
        title: `Copies of ${first.eventType} disagree`,
        explanation: `${list.length} records share the same ${d.duplicateKey} but report different states: ${[
          ...new Set(list.map(describe)),
        ].join(" vs ")}.`,
        evidenceEventIds: list.map((e) => e.id),
        recommendedAction: `Check the payment's current state with ${nameOf(ctx, first.provider)}. If your handler keeps only the first copy, it may have acted on a superseded result.`,
        ...(d.docsUrl ? { documentationUrl: d.docsUrl } : {}),
        limitations: [
          "The input may have been assembled from several sources; PandaPayLens cannot verify the records' authenticity.",
        ],
      });
    }
    return out;
  },
};

export const outOfOrderArrival: DiagnosticRule = {
  id: "OUT_OF_ORDER_ARRIVAL",
  version: "1.3.0",
  providers: ["*"],
  description: "An event arrived after an event that was created later.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of eventsByGroup(ctx)) {
      const arrivals = uniqueDeliveries(
        [...g.events].sort((a, b) => {
          if (!ctx.arrivalOrderInferred && a.observedTimestamp && b.observedTimestamp) {
            const d = Date.parse(a.observedTimestamp) - Date.parse(b.observedTimestamp);
            if (d !== 0) return d;
          }
          return a.sourceIndex - b.sourceIndex;
        }),
      ).filter((e) => time(e) !== undefined);
      // A record with several events is one snapshot (for example a status
      // response listing past operations). It arrives as of its newest event;
      // the older entries are history, not late arrivals.
      const newestInRecord = new Map<number, number>();
      for (const e of arrivals) {
        const prev = newestInRecord.get(e.source.recordIndex);
        if (prev === undefined || time(e)! > prev)
          newestInRecord.set(e.source.recordIndex, time(e)!);
      }
      const late: NormalizedEvent[] = [];
      let maxSeen: NormalizedEvent | undefined;
      for (const e of arrivals) {
        // Events from the same input record arrived together (one delivery, one
        // snapshot or one batch), so their relative order says nothing about
        // arrival. Only compare events that came in different records.
        if (
          maxSeen &&
          time(e)! === newestInRecord.get(e.source.recordIndex) &&
          time(e)! < time(maxSeen)! &&
          e.source.recordIndex !== maxSeen.source.recordIndex
        ) {
          late.push(e, maxSeen);
        }
        if (!maxSeen || time(e)! > time(maxSeen)!) maxSeen = e;
      }
      if (late.length === 0) continue;
      const ids = [...new Set(late.map((e) => e.id))];
      const provider = g.events[0]!.provider;
      const d = deliveryOf(ctx, provider);
      const name = nameOf(ctx, provider);
      out.push({
        severity: "info",
        confidence: ctx.arrivalOrderInferred ? "possible" : "confirmed",
        title: "Events arrived out of order",
        explanation: `${ids.length} events in this transaction arrived in a different order than they were created. ${
          d.ordering === "not_guaranteed"
            ? `${name} does not guarantee delivery order.`
            : `${name} does not document a delivery order guarantee.`
        } This is not a defect by itself.`,
        evidenceEventIds: ids,
        recommendedAction:
          "Base state transitions on the object's current state or event timestamps, not on arrival order.",
        ...(provider === "stripe"
          ? { documentationUrl: STRIPE_ORDER }
          : d.docsUrl
            ? { documentationUrl: d.docsUrl }
            : {}),
        limitations: ctx.arrivalOrderInferred
          ? [
              "No receipt timestamps were supplied; arrival order is assumed from the order of records in the input.",
            ]
          : [],
      });
    }
    return out;
  },
};

export const unknownEventType: DiagnosticRule = {
  id: "UNKNOWN_EVENT_TYPE",
  version: "1.0.0",
  providers: ["*"],
  description: "An event type PandaPayLens has no semantics for.",
  evaluate(ctx) {
    const byType = groupBy(
      ctx.events.filter((e) => !e.eventTypeKnown),
      (e) => `${e.provider}:${e.eventType}`,
    );
    return [...byType.values()].map((list) => ({
      severity: "info" as const,
      confidence: "confirmed" as const,
      title: `Unsupported event type: ${list[0]!.eventType}`,
      explanation: `PandaPayLens does not have semantics for ${list[0]!.provider} event type "${list[0]!.eventType}". It is shown on the timeline but not used to judge the payment outcome.`,
      evidenceEventIds: list.map((e) => e.id),
      recommendedAction:
        "Check the provider's documentation for this event type. Contributions with fixtures are welcome.",
      limitations: [],
    }));
  },
};

export const missingReference: DiagnosticRule = {
  id: "MISSING_REFERENCE",
  version: "1.2.0",
  providers: ["*"],
  description: "An event cannot be linked to a payment.",
  evaluate(ctx) {
    const out: Finding[] = [];
    // An event that shares a correlation group with other events is linked,
    // whatever documented identifier linked it.
    const groupSize = new Map<string, number>();
    for (const g of ctx.groups) for (const id of g.eventIds) groupSize.set(id, g.eventIds.length);
    const noRef = ctx.events.filter(
      (e) => !e.paymentReference && e.stage !== "error" && (groupSize.get(e.id) ?? 1) < 2,
    );
    if (noRef.length) {
      out.push({
        severity: "low",
        confidence: "confirmed",
        title: `${noRef.length} event(s) without a payment reference`,
        explanation:
          "These events carry no payment identifier, so they cannot be linked to other events of the same transaction.",
        evidenceEventIds: noRef.map((e) => e.id),
        recommendedAction:
          "Include the full event payload, or the related object, when collecting data for analysis.",
        limitations: [],
      });
    }
    // Modifications (attribute set by the adapter) link to the payment only via a parent reference.
    const orphanMods = ctx.events.filter(
      (e) => e.attributes.isModification === true && !e.relatedReference,
    );
    if (orphanMods.length) {
      out.push({
        severity: "medium",
        confidence: "strong",
        title: "Modification without a link to its payment",
        explanation:
          "These modification events (capture, refund, cancellation, ...) carry no reference to the original payment, so the payment they modify cannot be identified. Their own reference was used as the payment reference instead.",
        evidenceEventIds: orphanMods.map((e) => e.id),
        recommendedAction:
          "Check that the full notification was captured, including the reference to the original payment (for Adyen: originalReference).",
        ...(orphanMods.every((e) => e.provider === "adyen")
          ? { documentationUrl: ADYEN_HANDLE }
          : {}),
        limitations: [],
      });
    }
    return out;
  },
};

export const paymentFailure: DiagnosticRule = {
  id: "PAYMENT_FAILURE",
  version: "1.1.0",
  providers: ["*"],
  description: "The provider reports a failed payment, capture or refund.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of eventsByGroup(ctx)) {
      const failed = uniqueDeliveries(g.events).filter(
        (e) =>
          e.outcome === "failure" &&
          ["payment", "authorization", "capture", "refund"].includes(e.stage),
      );
      if (!failed.length) continue;
      const postAuth = failed.filter((e) => e.stage === "capture" || e.stage === "refund");
      const last = failed.at(-1)!;
      const errors = ctx.errors.filter(
        (er) => er.paymentReference && er.paymentReference === last.paymentReference,
      );
      out.push({
        severity: postAuth.length ? "medium" : "low",
        confidence: "confirmed",
        title: postAuth.length
          ? `${postAuth.at(-1)!.stage === "capture" ? "Capture" : "Refund"} failed`
          : "Payment attempt failed",
        explanation: `The provider reported ${failed.length === 1 ? "a failure" : `${failed.length} failures`}: ${[...new Set(failed.map(describe))].join(", ")}.${
          errors.length ? " See the decoded error for the reason." : ""
        }`,
        evidenceEventIds: failed.map((e) => e.id),
        ...(errors.length ? { evidenceErrorIds: errors.map((e) => e.id) } : {}),
        recommendedAction: postAuth.length
          ? "Review the failed modification. Funds may not have moved as intended."
          : "Use the decoded error's guidance to decide whether the customer needs to act.",
        limitations: [
          "A failed attempt does not mean the order failed: a later attempt may have succeeded outside the supplied data.",
        ],
      });
    }
    return out;
  },
};

export const unresolvedOutcome: DiagnosticRule = {
  id: "UNRESOLVED_OUTCOME",
  version: "1.1.0",
  providers: ["*"],
  description: "The supplied events do not show a final payment state.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of eventsByGroup(ctx)) {
      // Errors are handled by the decoder (and POSSIBLE_RETRY_RISK when their
      // outcome is unknown); here only lifecycle events count.
      const relevant = g.events.filter(
        (e) => e.eventTypeKnown && e.stage !== "dispute" && e.stage !== "error",
      );
      if (!relevant.length) continue;
      if (relevant.some((e) => e.outcome === "success" || e.outcome === "failure")) continue;
      out.push({
        severity: "low",
        confidence: "possible",
        title: "Final outcome not visible",
        explanation: `The latest supplied state is ${describe(relevant.at(-1)!)}. None of the ${relevant.length} event(s) in this transaction report a final success or failure.`,
        evidenceEventIds: relevant.map((e) => e.id),
        recommendedAction:
          "Retrieve the payment from the provider, or collect later webhooks, before acting on this transaction.",
        limitations: ["Later events may exist that were not supplied."],
      });
    }
    return out;
  },
};

const STRIPE_PI_TERMINAL = new Set(["succeeded", "canceled"]);

export const potentialStateInconsistency: DiagnosticRule = {
  id: "POTENTIAL_STATE_INCONSISTENCY",
  version: "1.0.0",
  providers: ["stripe", "adyen"],
  description: "Observed states contradict documented provider state transitions.",
  evaluate(ctx) {
    const out: Finding[] = [];
    for (const g of eventsByGroup(ctx)) {
      const events = uniqueDeliveries(g.events);
      if (events[0]?.provider === "stripe") {
        // PaymentIntent `succeeded` and `canceled` are terminal statuses.
        const pi = events.filter(
          (e) =>
            e.attributes.objectType === "payment_intent" &&
            e.providerStatus &&
            time(e) !== undefined,
        );
        const terminal = pi.find((e) => STRIPE_PI_TERMINAL.has(e.providerStatus!));
        if (terminal) {
          const after = pi.filter(
            (e) => time(e)! > time(terminal)! && e.providerStatus !== terminal.providerStatus,
          );
          if (after.length) {
            out.push({
              severity: "medium",
              confidence: "strong",
              title: `PaymentIntent changed state after "${terminal.providerStatus}"`,
              explanation: `A PaymentIntent reported the terminal status "${terminal.providerStatus}" and later events report ${[
                ...new Set(after.map((e) => `"${e.providerStatus}"`)),
              ].join(
                ", ",
              )}. Stripe documents ${[...STRIPE_PI_TERMINAL].join(" and ")} as terminal statuses.`,
              evidenceEventIds: [terminal.id, ...after.map((e) => e.id)],
              recommendedAction:
                "Check whether events from different PaymentIntents or accounts were mixed, and retrieve the PaymentIntent to confirm its state.",
              documentationUrl: "https://docs.stripe.com/payments/paymentintents/lifecycle",
              limitations: [
                "Event timestamps have one-second resolution; events created in the same second cannot be ordered.",
              ],
            });
          }
        }
      } else if (events[0]?.provider === "adyen") {
        const auth = events.filter((e) => e.eventType === "AUTHORISATION");
        const failedAuth = auth.length > 0 && auth.every((e) => e.outcome === "failure");
        const captures = events.filter((e) => e.eventType === "CAPTURE" && e.outcome === "success");
        if (failedAuth && captures.length) {
          out.push({
            severity: "medium",
            confidence: "strong",
            title: "Capture succeeded for a refused authorization",
            explanation:
              "The supplied data shows AUTHORISATION success=false and a successful CAPTURE for the same payment. A refused payment cannot normally be captured.",
            evidenceEventIds: [...auth, ...captures].map((e) => e.id),
            recommendedAction:
              "Check the payment in the Adyen Customer Area; the records may come from different payments or environments.",
            documentationUrl: ADYEN_HANDLE,
            limitations: [],
          });
        }
        const cancelled = events.filter(
          (e) => e.eventType === "CANCELLATION" && e.outcome === "success",
        );
        if (cancelled.length && captures.length) {
          out.push({
            severity: "medium",
            confidence: "possible",
            title: "Both cancellation and capture succeeded",
            explanation:
              "The supplied data shows a successful CANCELLATION and a successful CAPTURE for the same payment. Normally only one of them can take effect.",
            evidenceEventIds: [...cancelled, ...captures].map((e) => e.id),
            recommendedAction: "Check the payment's final state in the Adyen Customer Area.",
            documentationUrl: ADYEN_HANDLE,
            limitations: [
              "Partial captures followed by cancelling the remaining amount are legitimate; check the amounts.",
            ],
          });
        }
      }
    }
    return out;
  },
};

export const possibleRetryRisk: DiagnosticRule = {
  id: "POSSIBLE_RETRY_RISK",
  version: "1.2.0",
  providers: ["*"],
  description: "The supplied records suggest an unsafe retry pattern.",
  evaluate(ctx) {
    const out: Finding[] = [];

    // 1. Errors whose original outcome is unknown: a blind retry could duplicate a charge.
    const uncertain = ctx.errors.filter(
      (e) => e.category === "provider_unavailable" || e.category === "network_or_timeout",
    );
    for (const e of uncertain) {
      if (e.retry !== "retry_conditionally" && e.retry !== "safe_to_retry_technical_request")
        continue;
      // Issuer or network answers are known outcomes, not uncertain ones.
      if (e.outcomeKnown || e.subCodes.decline_code || e.subCodes.refusalReasonCode) continue;
      out.push({
        severity: "low",
        confidence: "possible",
        title: "Outcome of the original request is unknown",
        explanation: `The ${e.provider} error "${e.code}" does not say whether the original operation took effect. Sending a new request without checking could create a second payment.`,
        evidenceEventIds: [],
        evidenceErrorIds: [e.id],
        recommendedAction:
          "Verify the original operation's status first. If you retry, reuse the same idempotency key.",
        ...(IDEMPOTENCY_DOCS[e.provider] ? { documentationUrl: IDEMPOTENCY_DOCS[e.provider] } : {}),
        limitations: ["The supplied data cannot show whether a retry was already sent."],
      });
    }

    // 2. Repeated attempts on one payment after do-not-retry guidance. Only
    // distinct attempts count: an API response and the webhook for the same
    // attempt share an attemptReference.
    const byRef = groupBy(
      ctx.errors.filter((e) => e.retry === "do_not_retry" && e.attemptReference),
      (e) => (e.paymentReference ? `${e.provider}:${e.paymentReference}` : undefined),
    );
    for (const all of byRef.values()) {
      const list = [...new Map(all.map((e) => [e.attemptReference, e])).values()];
      if (list.length < 2) continue;
      // Advice depends on what was attempted: card networks only penalize
      // card retries, and a payout has no customer payment method to change.
      const records = new Set(list.map((e) => e.source.recordIndex));
      const refs = new Set(list.map((e) => e.paymentReference));
      const payout = ctx.events.some(
        (ev) =>
          ev.stage === "payout" &&
          ev.provider === list[0]!.provider &&
          (records.has(ev.source.recordIndex) ||
            (ev.paymentReference !== undefined && refs.has(ev.paymentReference))),
      );
      const card = !payout && list.some((e) => e.category === "card_declined");
      const codes = [...new Set(list.map((e) => e.code))].join(", ");
      out.push({
        severity: "medium",
        confidence: "possible",
        title: `${list.length} attempts after a do-not-retry ${payout ? "error" : "decline"}`,
        explanation: `The same ${payout ? "payout" : "payment"} shows ${list.length} errors whose guidance is not to retry (${codes}). ${
          card
            ? "Repeated attempts on such declines can be penalized by card networks."
            : "Repeating the same request is unlikely to succeed until the cause is fixed."
        }`,
        evidenceEventIds: [],
        evidenceErrorIds: list.map((e) => e.id),
        recommendedAction: payout
          ? "Stop automatic retries. Correct the recipient details named in the error, and confirm the earlier payout failed before sending a new one."
          : card
            ? "Stop automatic retries for these declines and ask the customer for another payment method."
            : "Stop automatic retries. Fix the cause named in the error, or ask the customer to choose another way to pay.",
        limitations: [
          payout
            ? "The errors may come from separate payout requests."
            : "The errors may come from separate customer-initiated attempts.",
        ],
      });
    }

    // 3. Adyen: several authorised payments for one merchantReference.
    const auths = uniqueDeliveries(ctx.events).filter(
      (e) =>
        e.provider === "adyen" &&
        e.merchantReference &&
        e.outcome === "success" &&
        (e.eventType === "AUTHORISATION" || e.eventType === "payment_response.Authorised"),
    );
    for (const list of groupBy(auths, (e) => e.merchantReference).values()) {
      const payments = new Set(list.map((e) => e.paymentReference));
      if (payments.size < 2) continue;
      out.push({
        severity: "medium",
        confidence: "possible",
        title: "Several successful authorizations for one order reference",
        explanation: `${payments.size} different payments were authorized with the same merchantReference. If these are retries of one order, the shopper may have been charged more than once.`,
        evidenceEventIds: list.map((e) => e.id),
        recommendedAction:
          "Check whether the order really needed several payments; cancel or refund duplicates if not. Use idempotency keys on payment requests.",
        documentationUrl: "https://docs.adyen.com/development-resources/api-idempotency",
        limitations: [
          "merchantReference values can legitimately be reused (for example for split orders or subscriptions).",
        ],
      });
    }
    return out;
  },
};

export const defaultRules: readonly DiagnosticRule[] = Object.freeze([
  paymentFailure,
  potentialStateInconsistency,
  possibleRetryRisk,
  conflictingObservations,
  unresolvedOutcome,
  missingReference,
  duplicateDelivery,
  outOfOrderArrival,
  unknownEventType,
  ...LIFECYCLE_RULES,
]);

export * from "./lifecycle.js";
