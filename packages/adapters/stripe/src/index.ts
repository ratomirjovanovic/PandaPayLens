/**
 * Stripe adapter.
 *
 * Supported input families:
 * - `stripe.api_error`        API error response: `{ "error": { "type", "code", … } }`
 * - `stripe.payment_intent`   PaymentIntent object snapshot
 * - `stripe.event.snapshot`   API v1 snapshot event (`object: "event"`, `data.object`)
 *
 * Recognized but not supported: `stripe.event.thin` (v2 thin events carry no
 * embedded object, so they cannot build a timeline on their own).
 */

import {
  minorUnits,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type LifecycleStage,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ADVICE_CODES,
  DECLINE_CODES,
  ERROR_CODES,
  ERROR_TYPES,
  docsForCode,
  docsForDecline,
  type CatalogEntry,
} from "./catalog.js";

export const STRIPE_ADAPTER_VERSION = "0.1.0";

const ERROR_TYPE_SET = new Set([
  "api_error",
  "card_error",
  "idempotency_error",
  "invalid_request_error",
]);

const ErrorBody = z
  .object({
    type: z.string().max(64),
    code: z.string().max(128).optional(),
    decline_code: z.string().max(128).optional(),
    advice_code: z.string().max(128).optional(),
    network_decline_code: z.string().max(32).optional(),
    message: z.string().optional(),
    param: z.string().max(256).optional(),
    doc_url: z.string().optional(),
    request_log_url: z.string().optional(),
    payment_intent: z.looseObject({ id: z.string() }).optional(),
    charge: z.string().optional(),
  })
  .loose();

const ApiError = z.looseObject({ error: ErrorBody });

const PaymentIntent = z.looseObject({
  id: z.string().max(255),
  object: z.literal("payment_intent"),
  status: z.string().max(64),
  amount: z.number().int().optional(),
  amount_received: z.number().int().optional(),
  currency: z.string().optional(),
  created: z.number().optional(),
  latest_charge: z
    .union([z.string(), z.looseObject({ id: z.string() })])
    .nullable()
    .optional(),
  last_payment_error: ErrorBody.nullable().optional(),
  capture_method: z.string().optional(),
  cancellation_reason: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
});

const SnapshotEvent = z.looseObject({
  id: z.string().max(255),
  object: z.literal("event"),
  type: z.string().max(128),
  created: z.number(),
  api_version: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  pending_webhooks: z.number().optional(),
  request: z
    .looseObject({
      id: z.string().nullable().optional(),
      idempotency_key: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  data: z.looseObject({ object: z.looseObject({ object: z.string().optional() }) }),
});

export type StripeParsed =
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | { kind: "payment_intent"; value: z.infer<typeof PaymentIntent> }
  | { kind: "event"; value: z.infer<typeof SnapshotEvent> };

type EventMapping = { stage: LifecycleStage; outcome: Outcome | "from_status" };

/** Event types with known semantics. Others are shown as UNKNOWN_EVENT_TYPE. */
const EVENT_TYPES: Record<string, EventMapping> = {
  "payment_intent.created": { stage: "payment", outcome: "pending" },
  "payment_intent.processing": { stage: "payment", outcome: "pending" },
  "payment_intent.requires_action": { stage: "authentication", outcome: "pending" },
  "payment_intent.amount_capturable_updated": { stage: "authorization", outcome: "pending" },
  "payment_intent.partially_funded": { stage: "payment", outcome: "pending" },
  "payment_intent.succeeded": { stage: "payment", outcome: "success" },
  "payment_intent.payment_failed": { stage: "payment", outcome: "failure" },
  "payment_intent.canceled": { stage: "cancellation", outcome: "failure" },
  "charge.pending": { stage: "payment", outcome: "pending" },
  "charge.succeeded": { stage: "payment", outcome: "success" },
  "charge.failed": { stage: "payment", outcome: "failure" },
  "charge.captured": { stage: "capture", outcome: "success" },
  "charge.expired": { stage: "cancellation", outcome: "failure" },
  "charge.updated": { stage: "other", outcome: "unknown" },
  "charge.refunded": { stage: "refund", outcome: "success" },
  "charge.refund.updated": { stage: "refund", outcome: "from_status" },
  "refund.created": { stage: "refund", outcome: "from_status" },
  "refund.updated": { stage: "refund", outcome: "from_status" },
  "refund.failed": { stage: "refund", outcome: "failure" },
  "charge.dispute.created": { stage: "dispute", outcome: "unknown" },
  "charge.dispute.updated": { stage: "dispute", outcome: "unknown" },
  "charge.dispute.closed": { stage: "dispute", outcome: "unknown" },
  "charge.dispute.funds_withdrawn": { stage: "dispute", outcome: "unknown" },
  "charge.dispute.funds_reinstated": { stage: "dispute", outcome: "unknown" },
};

export const PAYMENT_INTENT_TERMINAL_STATUSES = new Set(["succeeded", "canceled"]);

function outcomeFromStatus(
  objectType: string | undefined,
  status: string | undefined,
  hasError: boolean,
): Outcome {
  if (!status) return "unknown";
  if (objectType === "refund") {
    if (status === "succeeded") return "success";
    if (status === "failed" || status === "canceled") return "failure";
    if (status === "pending" || status === "requires_action") return "pending";
    return "unknown";
  }
  if (objectType === "charge") {
    if (status === "succeeded") return "success";
    if (status === "failed") return "failure";
    if (status === "pending") return "pending";
    return "unknown";
  }
  switch (status) {
    case "succeeded":
      return "success";
    case "canceled":
      return "failure";
    case "requires_payment_method":
      // Initial state, or the state after a failed attempt.
      return hasError ? "failure" : "pending";
    case "requires_confirmation":
    case "requires_action":
    case "processing":
    case "requires_capture":
      return "pending";
    default:
      return "unknown";
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function detect(input: unknown): DetectionResult {
  const base = { provider: "stripe" };
  if (!isObj(input)) return { ...base, format: null, confidence: 0, supported: false, reasons: [] };

  if (isObj(input.error) && typeof input.error.type === "string") {
    if (ERROR_TYPE_SET.has(input.error.type)) {
      return {
        ...base,
        format: "stripe.api_error",
        confidence: 0.95,
        supported: true,
        reasons: [`error.type is the Stripe error type "${input.error.type}"`],
      };
    }
    return {
      ...base,
      format: "stripe.api_error",
      confidence: 0.3,
      supported: true,
      reasons: ["Has an error object, but error.type is not a known Stripe type"],
    };
  }

  if (
    input.object === "v2.core.event" ||
    (input.object === "event" && "related_object" in input && !("data" in input))
  ) {
    return {
      ...base,
      format: "stripe.event.thin",
      confidence: 0.9,
      supported: false,
      reasons: ["object is a Stripe v2 thin event"],
      unsupportedReason:
        "Stripe thin events don't embed the related object, so PandaPayLens cannot build a timeline from them yet. Fetch the related object and paste its snapshot instead.",
    };
  }

  if (input.object === "event" && typeof input.type === "string" && isObj(input.data)) {
    const evtId = typeof input.id === "string" && input.id.startsWith("evt_");
    const reasons = ['object is "event"', "has data.object"];
    if (evtId) reasons.push("id has the evt_ prefix");
    return {
      ...base,
      format: "stripe.event.snapshot",
      confidence: evtId ? 0.98 : 0.8,
      supported: true,
      reasons,
    };
  }

  if (input.object === "payment_intent" && typeof input.status === "string") {
    const piId = typeof input.id === "string" && input.id.startsWith("pi_");
    return {
      ...base,
      format: "stripe.payment_intent",
      confidence: piId ? 0.98 : 0.8,
      supported: true,
      reasons: ['object is "payment_intent"', ...(piId ? ["id has the pi_ prefix"] : [])],
    };
  }

  return { ...base, format: null, confidence: 0, supported: false, reasons: [] };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: StripeParsed } | { ok: false; issues: string[] } {
  const schema =
    format === "stripe.api_error"
      ? ApiError
      : format === "stripe.payment_intent"
        ? PaymentIntent
        : format === "stripe.event.snapshot"
          ? SnapshotEvent
          : null;
  if (!schema) return { ok: false, issues: [`Unsupported Stripe format "${format}".`] };
  const r = schema.safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const kind =
    format === "stripe.api_error"
      ? "api_error"
      : format === "stripe.payment_intent"
        ? "payment_intent"
        : "event";
  return { ok: true, value: { kind, value: r.data } as StripeParsed };
}

function idOf(v: unknown): string | undefined {
  if (typeof v === "string") return safeId(v);
  if (isObj(v)) return safeId(v.id);
  return undefined;
}

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 64) ?? "");
  }
  return out;
}

/** References and amount from a PaymentIntent, Charge or Refund object. */
function describeObject(obj: Record<string, unknown>) {
  const type = typeof obj.object === "string" ? obj.object : undefined;
  let paymentReference: string | undefined;
  let relatedReference: string | undefined;
  if (type === "payment_intent") {
    paymentReference = safeId(obj.id);
    relatedReference = idOf(obj.latest_charge);
  } else if (type === "charge") {
    paymentReference = idOf(obj.payment_intent);
    relatedReference = safeId(obj.id);
  } else if (type === "refund") {
    paymentReference = idOf(obj.payment_intent);
    relatedReference = idOf(obj.charge);
  } else if (type === "dispute") {
    paymentReference = idOf(obj.payment_intent);
    relatedReference = idOf(obj.charge);
  }
  const lastError = isObj(obj.last_payment_error) ? obj.last_payment_error : undefined;
  const attributes = attrs([
    ["objectType", type],
    ["objectId", type === "refund" || type === "dispute" ? safeId(obj.id) : undefined],
    ["captureMethod", obj.capture_method],
    ["captured", obj.captured],
    ["paid", obj.paid],
    ["refunded", obj.refunded],
    [
      "amountRefunded",
      typeof obj.amount_refunded === "number" ? String(obj.amount_refunded) : undefined,
    ],
    [
      "amountReceived",
      typeof obj.amount_received === "number" ? String(obj.amount_received) : undefined,
    ],
    ["cancellationReason", obj.cancellation_reason],
    ["failureCode", obj.failure_code],
    ["refundReason", type === "refund" ? obj.reason : undefined],
    ["disputeReason", type === "dispute" ? obj.reason : undefined],
    ["lastErrorCode", lastError?.code],
    ["lastErrorDeclineCode", lastError?.decline_code],
    ["paymentMethodTypes", obj.payment_method_types],
    ["livemode", obj.livemode],
  ]);
  return {
    type,
    paymentReference,
    relatedReference,
    status: typeof obj.status === "string" ? obj.status : undefined,
    amountMinor: minorUnits(obj.amount),
    currency: upperCurrency(obj.currency),
    hasError: Boolean(lastError) || (type === "charge" && typeof obj.failure_code === "string"),
    attributes,
  };
}

function normalize(parsed: StripeParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

  if (parsed.kind === "api_error") {
    const e = parsed.value.error;
    const pi = e.payment_intent ? describeObject(e.payment_intent) : undefined;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${e.code ?? e.type}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: e.type,
        paymentReference: pi?.paymentReference,
        relatedReference: safeId(e.charge) ?? pi?.relatedReference,
        outcome: e.type === "card_error" ? "failure" : "unknown",
        attributes: attrs([
          ["errorType", e.type],
          ["code", e.code],
          ["declineCode", e.decline_code],
          ["adviceCode", e.advice_code],
          ["param", e.param],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "payment_intent") {
    const d = describeObject(parsed.value);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "payment_intent.snapshot",
        eventTypeKnown: true,
        stage: "payment",
        providerStatus: d.status,
        paymentReference: d.paymentReference,
        relatedReference: d.relatedReference,
        amountMinor: d.amountMinor,
        currency: d.currency,
        outcome: outcomeFromStatus("payment_intent", d.status, d.hasError),
        // `created` is when the PaymentIntent was created, not when this
        // status was observed, so it is not used as the event time.
        attributes: { ...d.attributes, createdAt: toIsoTimestamp(parsed.value.created) ?? null },
        source,
        ...observed,
      }),
    ];
  }

  const evt = parsed.value;
  const d = describeObject(evt.data.object);
  const mapping = EVENT_TYPES[evt.type];
  const outcome: Outcome = !mapping
    ? "unknown"
    : mapping.outcome === "from_status"
      ? outcomeFromStatus(d.type, d.status, d.hasError)
      : mapping.outcome;
  const eventId = safeId(evt.id);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(evt.type, 128) ?? "unknown",
      eventTypeKnown: Boolean(mapping),
      stage: mapping?.stage ?? "other",
      providerStatus: d.status,
      eventReference: eventId,
      deliveryKey: eventId,
      paymentReference: d.paymentReference,
      relatedReference: d.relatedReference,
      eventTimestamp: toIsoTimestamp(evt.created),
      amountMinor: d.amountMinor,
      currency: d.currency,
      outcome,
      attributes: {
        ...d.attributes,
        ...attrs([
          ["apiVersion", evt.api_version ?? undefined],
          ["requestId", safeId(evt.request?.id ?? undefined)],
          ["livemode", evt.livemode],
        ]),
        hasIdempotencyKey: Boolean(evt.request?.idempotency_key),
      },
      source,
      ...observed,
    }),
  ];
}

/** Drop undefined optional fields so output is stable and compact. */
function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type ErrorFields = {
  type?: string | undefined;
  code?: string | undefined;
  decline_code?: string | undefined;
  advice_code?: string | undefined;
  network_decline_code?: string | undefined;
  message?: string | undefined;
  param?: string | undefined;
};

/** Shared by API errors, PaymentIntent.last_payment_error and failed charges. */
export function decodeStripeError(
  e: ErrorFields,
): Omit<DecodedErrorDraft, "sourceFormat" | "source" | "paymentReference"> {
  const code = e.code ?? e.type ?? "unknown";
  const subCodes: Record<string, string> = {};
  if (e.type) subCodes.type = e.type;
  if (e.decline_code) subCodes.decline_code = e.decline_code;
  if (e.advice_code) subCodes.advice_code = e.advice_code;
  if (e.network_decline_code) subCodes.network_decline_code = e.network_decline_code;

  const docs = [];
  let entry: CatalogEntry | undefined;
  let confidence: Confidence;
  const missing: string[] = [];

  const declineEntry = e.decline_code ? DECLINE_CODES[e.decline_code] : undefined;
  const codeEntry = e.code ? ERROR_CODES[e.code] : undefined;
  if (declineEntry) {
    entry = declineEntry;
    confidence = "strong";
    docs.push({ title: `Stripe decline code: ${e.decline_code}`, url: docsForDecline() });
  } else if (codeEntry) {
    entry = codeEntry;
    confidence = "strong";
  } else if (e.type && ERROR_TYPES[e.type]) {
    entry = ERROR_TYPES[e.type];
    confidence = "possible";
  } else {
    confidence = "insufficient";
  }
  if (e.code) docs.push({ title: `Stripe error code: ${e.code}`, url: docsForCode(e.code) });
  else docs.push({ title: "Stripe error codes", url: "https://docs.stripe.com/error-codes" });

  if (e.decline_code && !declineEntry)
    missing.push(
      `Decline code "${e.decline_code}" is not in the PandaPayLens catalog yet; check Stripe's decline code reference.`,
    );
  if (e.code && !codeEntry && !declineEntry)
    missing.push(`Error code "${e.code}" is not in the PandaPayLens catalog yet.`);
  if ((e.code === "card_declined" || e.type === "card_error") && !e.decline_code) {
    missing.push("No decline_code was supplied, so the issuer's specific reason is unknown.");
  }

  let retry = entry?.retry ?? "unknown";
  let retryExplanation =
    entry?.retryExplanation ?? "No retry guidance is available for this error.";
  const advice = e.advice_code ? ADVICE_CODES[e.advice_code] : undefined;
  if (advice) {
    // Stripe's advice code is the most specific retry signal available.
    retry = advice.retry;
    retryExplanation = advice.retryExplanation;
  }

  const message = safeText(e.message);
  return {
    code,
    subCodes,
    category: entry?.category ?? "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation: entry?.explanation ?? "PandaPayLens does not recognize this Stripe error.",
    nextAction:
      entry?.nextAction ?? "Check the Stripe documentation and the request log for this error.",
    retry,
    retryExplanation,
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function decodeError(parsed: StripeParsed, ctx: NormalizeContext): DecodedErrorDraft | null {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  if (parsed.kind === "api_error") {
    const e = parsed.value.error;
    const ref = e.payment_intent ? safeId(e.payment_intent.id) : undefined;
    const attempt =
      safeId(e.charge) ?? (e.payment_intent ? idOf(e.payment_intent.latest_charge) : undefined);
    const decoded = decodeStripeError(e);
    if (!ref && e.type === "card_error")
      decoded.missingInformation.push(
        "No PaymentIntent reference; the later state of this payment cannot be checked from this record.",
      );
    return {
      ...decoded,
      sourceFormat: ctx.format,
      source: { ...source, path: "error" },
      ...(ref ? { paymentReference: ref } : {}),
      ...(attempt ? { attemptReference: attempt } : {}),
    };
  }
  const obj = parsed.kind === "payment_intent" ? parsed.value : parsed.value.data.object;
  const objType = obj.object;
  if (objType === "payment_intent" && isObj(obj.last_payment_error)) {
    const le = obj.last_payment_error as ErrorFields & { charge?: unknown };
    const ref = safeId(obj.id);
    const attempt = idOf(le.charge) ?? idOf(obj.latest_charge);
    return {
      ...decodeStripeError(le),
      ...(attempt ? { attemptReference: attempt } : {}),
      sourceFormat: ctx.format,
      source: {
        ...source,
        path: parsed.kind === "event" ? "data.object.last_payment_error" : "last_payment_error",
      },
      ...(ref ? { paymentReference: ref } : {}),
    };
  }
  if (objType === "charge" && typeof obj.failure_code === "string") {
    const outcome = isObj(obj.outcome) ? obj.outcome : {};
    const fields: ErrorFields = {
      type: "card_error",
      code: obj.failure_code,
      decline_code:
        typeof outcome.reason === "string" && DECLINE_CODES[outcome.reason]
          ? outcome.reason
          : undefined,
      advice_code: typeof outcome.advice_code === "string" ? outcome.advice_code : undefined,
      network_decline_code:
        typeof outcome.network_decline_code === "string" ? outcome.network_decline_code : undefined,
      message: typeof obj.failure_message === "string" ? obj.failure_message : undefined,
    };
    const ref = idOf(obj.payment_intent);
    const attempt = safeId(obj.id);
    return {
      ...decodeStripeError(fields),
      ...(attempt ? { attemptReference: attempt } : {}),
      sourceFormat: ctx.format,
      source: { ...source, path: parsed.kind === "event" ? "data.object" : "" },
      ...(ref ? { paymentReference: ref } : {}),
    };
  }
  return null;
}

export const stripeAdapter: ProviderAdapter<StripeParsed> = {
  id: "stripe",
  displayName: "Stripe",
  version: STRIPE_ADAPTER_VERSION,
  supportedFormats: [
    {
      id: "stripe.api_error",
      description:
        "Stripe API error response ({ error: { type, code, decline_code, advice_code } })",
    },
    { id: "stripe.payment_intent", description: "PaymentIntent object snapshot" },
    {
      id: "stripe.event.snapshot",
      description:
        "API v1 snapshot event (webhook payload) for PaymentIntent, Charge, Refund and Dispute objects",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors(parsed, ctx) {
    const e = decodeError(parsed, ctx);
    return e ? [e] : [];
  },
  correlationKeys(event: NormalizedEvent): string[] {
    // PaymentIntent and Charge ids are both explicit links between objects.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export { EVENT_TYPES as STRIPE_EVENT_TYPES };
export * from "./catalog.js";
export default stripeAdapter;
