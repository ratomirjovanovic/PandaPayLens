/**
 * Airwallex adapter (Payments Client API).
 *
 * Supported input families:
 * - `airwallex.error`            error body `{ code, message, source, trace_id, details }`
 * - `airwallex.payment_intent`   PaymentIntent snapshot (`int_` id, embedded latest_payment_attempt)
 * - `airwallex.payment_attempt`  PaymentAttempt snapshot (`att_` id)
 * - `airwallex.refund`           Refund snapshot (`rfd_` id)
 * - `airwallex.payment_dispute`  PaymentDispute snapshot (`dst_` id)
 * - `airwallex.webhook`          payments webhook `{ id, name, data.object, created_at, version }`
 *
 * Recognized but not supported: payout webhooks and Transfer objects.
 *
 * Airwallex objects share words with Stripe (PaymentIntent, data.object,
 * next_action), so detection relies on Airwallex-only evidence: the int_,
 * att_, rfd_ and dst_ id prefixes, upper-case statuses, the flat error body
 * with trace_id, and the `name` + `version` event envelope. Airwallex payloads
 * never carry a top-level `object` key.
 */

import {
  decimalToMinor,
  lookup,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type LifecycleStage,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ANALYZED_EVENT_FAMILIES,
  API_ERROR_ALIASES,
  API_ERROR_CODES,
  AVS_CODES,
  AVS_URL,
  BRAND_LABELS,
  CATEGORY_NEXT_ACTIONS,
  CVC_CODES,
  CVC_URL,
  DISPUTE_STATUSES,
  ERROR_CODES_URL,
  FAILURE_CODES,
  FAILURE_CODE_STAGES,
  ISSUER_CODES,
  ISSUER_CODES_URL,
  ISSUER_RETRY_EXPLANATIONS,
  MAC_URL,
  MERCHANT_ADVICE_CODES,
  OTHER_EVENT_FAMILIES,
  OTHER_PAYMENTS_EVENTS,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_INTENT_STATUSES,
  RATE_LIMITS_URL,
  REFUND_STATUSES,
  STATUSES_URL,
  WEBHOOK_EVENTS,
  brandsForCodeFormat,
  type CardBrand,
  type CatalogEntry,
  type IssuerReading,
  type StatusEntry,
} from "./catalog.js";
import { airwallexManifest, AIRWALLEX_ADAPTER_VERSION } from "./manifest.js";

export { airwallexManifest, AIRWALLEX_ADAPTER_VERSION };

const PROVIDER = "airwallex";

const INTENT_ID = /^int_[A-Za-z0-9_]{1,120}$/;
const ATTEMPT_ID = /^att_[A-Za-z0-9_]{1,120}$/;
const REFUND_ID = /^rfd_[A-Za-z0-9_]{1,120}$/;
const DISPUTE_ID = /^dst_[A-Za-z0-9_]{1,120}$/;
const UPPER_STATUS = /^[A-Z][A-Z_]{1,63}$/;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,40}(?:\.[a-z0-9_]{1,40}){1,3}$/;
const API_VERSION = /^\d{4}-\d{2}-\d{2}$/;
const SNAKE_CODE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** Keys of the documented error body. */
const ERROR_KEYS = new Set([
  "code",
  "message",
  "source",
  "trace_id",
  "details",
  "provider_original_response_code",
]);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const OptStr = z.string().max(256).nullable().optional();
const OptNum = z.number().nullable().optional();
const Details = z.looseObject({});

const ErrorBody = z.looseObject({
  code: z.string().min(1).max(128),
  message: z.string().nullable().optional(),
  source: OptStr,
  trace_id: OptStr,
  details: Details.nullable().optional(),
  provider_original_response_code: z.string().max(64).nullable().optional(),
});

const FailureDetails = z.looseObject({
  code: z.string().max(128).nullable().optional(),
  message: z.string().nullable().optional(),
  trace_id: OptStr,
  details: Details.nullable().optional(),
});

const PaymentMethod = z.looseObject({
  type: z.string().max(64).nullable().optional(),
  card: z
    .looseObject({ brand: z.string().max(64).nullable().optional() })
    .nullable()
    .optional(),
});

const attemptShape = {
  id: z.string().max(255).optional(),
  status: z.string().max(64).optional(),
  payment_intent_id: OptStr,
  amount: OptNum,
  currency: OptStr,
  captured_amount: OptNum,
  refunded_amount: OptNum,
  merchant_order_id: OptStr,
  payment_method: PaymentMethod.nullable().optional(),
  failure_code: z.string().max(128).nullable().optional(),
  failure_details: FailureDetails.nullable().optional(),
  provider_original_response_code: z.string().max(64).nullable().optional(),
  merchant_advice_code: z.string().max(16).nullable().optional(),
  authentication_data: z
    .looseObject({
      avs_result: z.string().max(32).nullable().optional(),
      cvc_result: z.string().max(32).nullable().optional(),
    })
    .nullable()
    .optional(),
  settle_via: z.string().max(32).nullable().optional(),
  created_at: OptStr,
  updated_at: OptStr,
};

const LatestAttempt = z.looseObject(attemptShape);

const PaymentAttempt = z.looseObject({
  ...attemptShape,
  id: z.string().max(255),
  status: z.string().max(64),
});

const PaymentIntent = z.looseObject({
  id: z.string().max(255),
  status: z.string().max(64),
  request_id: OptStr,
  amount: OptNum,
  currency: OptStr,
  captured_amount: OptNum,
  merchant_order_id: OptStr,
  latest_payment_attempt: LatestAttempt.nullable().optional(),
  next_action: z
    .looseObject({ type: z.string().max(64).nullable().optional() })
    .nullable()
    .optional(),
  triggered_by: z.string().max(32).nullable().optional(),
  created_at: OptStr,
  updated_at: OptStr,
  cancelled_at: OptStr,
});

const Refund = z.looseObject({
  id: z.string().max(255),
  status: z.string().max(64),
  request_id: OptStr,
  payment_intent_id: OptStr,
  payment_attempt_id: OptStr,
  amount: OptNum,
  currency: OptStr,
  failure_details: FailureDetails.nullable().optional(),
  created_at: OptStr,
  updated_at: OptStr,
});

const PaymentDispute = z
  .looseObject({
    id: OptStr,
    // Older webhook shape (payments-webhooks page).
    dispute_id: OptStr,
    stage: z.string().max(64).nullable().optional(),
    status: z.string().max(64).nullable().optional(),
    mode: z.string().max(64).nullable().optional(),
    payment_intent_id: OptStr,
    payment_attempt_id: OptStr,
    merchant_order_id: OptStr,
    amount: OptNum,
    currency: OptStr,
    dispute_amount: OptNum,
    dispute_currency: OptStr,
    reason: z
      .looseObject({
        type: z.string().max(64).nullable().optional(),
        original_code: z.string().max(32).nullable().optional(),
        description: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    dispute_reason_type: z.string().max(64).nullable().optional(),
    dispute_original_reason_code: z.string().max(32).nullable().optional(),
    card_brand: z.string().max(64).nullable().optional(),
    card_scheme: z.string().max(64).nullable().optional(),
    transaction_type: z.string().max(32).nullable().optional(),
    payment_method_type: z.string().max(64).nullable().optional(),
    due_at: OptStr,
    created_at: OptStr,
    updated_at: OptStr,
  })
  .refine((d) => Boolean(d.id ?? d.dispute_id), {
    message: "id or dispute_id is required",
    path: ["id"],
  });

const Webhook = z.looseObject({
  id: z.string().max(255).nullable().optional(),
  name: z.string().max(128),
  data: z.looseObject({ object: z.looseObject({}) }),
  created_at: OptStr,
  createdAt: OptStr,
  version: z.string().max(32).nullable().optional(),
});

type ErrorT = z.infer<typeof ErrorBody>;
type AttemptFields = z.infer<typeof LatestAttempt>;
type AttemptT = z.infer<typeof PaymentAttempt>;
type IntentT = z.infer<typeof PaymentIntent>;
type RefundT = z.infer<typeof Refund>;
type DisputeT = z.infer<typeof PaymentDispute>;
type WebhookT = z.infer<typeof Webhook>;
type FailureDetailsT = z.infer<typeof FailureDetails>;

type ObjectParsed =
  | { kind: "payment_intent"; value: IntentT }
  | { kind: "payment_attempt"; value: AttemptT }
  | { kind: "refund"; value: RefundT }
  | { kind: "payment_dispute"; value: DisputeT };

export type AirwallexParsed =
  | { kind: "error"; value: ErrorT }
  | ObjectParsed
  | { kind: "webhook"; value: WebhookT; object: ObjectParsed | null };

type Family = (typeof ANALYZED_EVENT_FAMILIES)[number];

const OBJECT_SCHEMAS = {
  payment_intent: PaymentIntent,
  payment_attempt: PaymentAttempt,
  refund: Refund,
  payment_dispute: PaymentDispute,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Drop undefined optional fields so output is stable and compact. */
function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function familyOf(name: string): Family | "other" | "payout" | null {
  const prefix = name.split(".")[0]!;
  if (prefix === "payout") return "payout";
  if ((ANALYZED_EVENT_FAMILIES as readonly string[]).includes(prefix)) return prefix as Family;
  if (OTHER_EVENT_FAMILIES.includes(prefix)) return "other";
  return null;
}

/** Decimal major-unit amount (a JSON number) to integer minor units. */
function amountOf(value: unknown, currency: string | undefined) {
  if (typeof value !== "number" || !currency) return {};
  const minor = decimalToMinor(value, currency);
  return minor !== undefined ? { amountMinor: minor } : { amountAsSupplied: String(value) };
}

function minorAttr(value: unknown, currency: string | undefined): string | undefined {
  return typeof value === "number" && currency ? decimalToMinor(value, currency) : undefined;
}

const BRAND_ALIASES: Record<string, CardBrand> = {
  visa: "visa",
  mastercard: "mastercard",
  unionpay: "unionpay",
  cartesbancaires: "cartes_bancaires",
  amex: "amex",
  americanexpress: "amex",
  jcb: "jcb",
  discover: "discover",
  diners: "diners",
  dinersclub: "diners",
  dinersclubinternational: "diners",
};

export function normalizeBrand(value: unknown): CardBrand | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  return lookup(BRAND_ALIASES, value.toLowerCase().replace(/[^a-z]/g, ""));
}

function issuerCodeFrom(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && /^[A-Za-z0-9.]{1,16}$/.test(v)) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input) || meta?.format === "form") return none;
  // Documented Airwallex payloads never have a top-level `object` key; Stripe's do.
  if ("object" in input) return none;

  if (typeof input.name === "string" && isObj(input.data)) return detectWebhook(input);

  const id = typeof input.id === "string" ? input.id : "";
  const status = typeof input.status === "string" ? input.status : undefined;
  const upper = status !== undefined && UPPER_STATUS.test(status);
  const snapshot = (format: string, known: boolean, reasons: string[]): DetectionResult => ({
    provider: PROVIDER,
    format,
    confidence: known ? 0.95 : 0.75,
    supported: true,
    reasons: known
      ? reasons
      : [...reasons, "status is upper case but not one of the documented values"],
  });

  if (INTENT_ID.test(id) && upper) {
    const reasons = ["id has the PaymentIntent prefix int_", "status is upper case"];
    if (isObj(input.latest_payment_attempt)) reasons.push("has latest_payment_attempt");
    return snapshot(
      "airwallex.payment_intent",
      Boolean(lookup(PAYMENT_INTENT_STATUSES, status)),
      reasons,
    );
  }
  if (ATTEMPT_ID.test(id) && upper) {
    const reasons = ["id has the PaymentAttempt prefix att_", "status is upper case"];
    if (typeof input.payment_intent_id === "string" && INTENT_ID.test(input.payment_intent_id))
      reasons.push("payment_intent_id has the int_ prefix");
    return snapshot(
      "airwallex.payment_attempt",
      Boolean(lookup(PAYMENT_ATTEMPT_STATUSES, status)),
      reasons,
    );
  }
  if (REFUND_ID.test(id) && upper) {
    return snapshot("airwallex.refund", Boolean(lookup(REFUND_STATUSES, status)), [
      "id has the Refund prefix rfd_",
      "status is upper case",
    ]);
  }
  if (DISPUTE_ID.test(id) && (upper || typeof input.stage === "string")) {
    return snapshot(
      "airwallex.payment_dispute",
      Boolean(lookup(DISPUTE_STATUSES, status)) || !status,
      ["id has the PaymentDispute prefix dst_"],
    );
  }

  if (
    typeof input.short_reference_id === "string" &&
    typeof input.transfer_method === "string" &&
    (typeof input.transfer_currency === "string" || typeof input.source_currency === "string")
  ) {
    return {
      provider: PROVIDER,
      format: "airwallex.transfer",
      confidence: 0.85,
      supported: false,
      reasons: ["has short_reference_id, transfer_method and a transfer currency"],
      unsupportedReason:
        "Airwallex payout transfers are recognized but not analyzed by this version of the adapter.",
    };
  }

  if (typeof input.code === "string" && !("status" in input) && !("error" in input))
    return detectError(input, meta);

  return none;
}

function detectError(input: Record<string, unknown>, meta?: RecordMeta): DetectionResult {
  const code = input.code as string;
  const known = Boolean(lookup(API_ERROR_CODES, code) ?? lookup(API_ERROR_ALIASES, code));
  const trace = typeof input.trace_id === "string" && input.trace_id !== "";
  const issuer = typeof input.provider_original_response_code === "string";
  const details = isObj(input.details);
  const message = typeof input.message === "string";
  const exact = Object.keys(input).every((k) => ERROR_KEYS.has(k));
  const reasons: string[] = [];
  let confidence = 0;
  if (known && (trace || issuer)) {
    confidence = message ? 0.95 : 0.85;
    reasons.push(`code "${code}" is a documented Airwallex error code`);
    if (trace) reasons.push("has trace_id");
    if (issuer) reasons.push("has provider_original_response_code");
  } else if (SNAKE_CODE.test(code) && trace && details && message && exact) {
    confidence = 0.7;
    reasons.push("flat error body with code, message, trace_id and details");
  } else if (known && details && message && exact) {
    // A documented code without trace_id is too generic to claim.
    confidence = 0.45;
    reasons.push(`code "${code}" is a documented Airwallex error code, but there is no trace_id`);
  }
  if (confidence === 0) {
    return { provider: PROVIDER, format: null, confidence: 0, supported: false, reasons: [] };
  }
  if (!exact) confidence = Math.min(confidence, 0.8);
  const status = meta?.http?.status;
  if (status !== undefined) reasons.push(`HTTP status ${status}`);
  return { provider: PROVIDER, format: "airwallex.error", confidence, supported: true, reasons };
}

function detectWebhook(input: Record<string, unknown>): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  // Stripe, Square and PayPal events use `type` or `event_type`, not `name`.
  if ("type" in input || "event_type" in input) return none;
  const name = input.name as string;
  if (!EVENT_NAME.test(name)) return none;
  const family = familyOf(name);
  if (!family) return none;
  const data = input.data as Record<string, unknown>;
  const obj = isObj(data.object) ? data.object : undefined;

  const reasons = [`name "${name}" is an Airwallex event name`];
  let evidence = 0;
  if (typeof input.version === "string" && API_VERSION.test(input.version)) {
    evidence++;
    reasons.push("version is a dated API version");
  }
  if ("account_id" in input || "accountId" in input || "org_id" in input) {
    evidence++;
    reasons.push("has an account_id, accountId or org_id field");
  }
  const objId = obj
    ? [obj.id, obj.dispute_id, obj.payment_intent_id].find(
        (v) =>
          typeof v === "string" &&
          (INTENT_ID.test(v) || ATTEMPT_ID.test(v) || REFUND_ID.test(v) || DISPUTE_ID.test(v)),
      )
    : undefined;
  if (objId) {
    evidence++;
    reasons.push("data.object has an Airwallex id prefix (int_, att_, rfd_ or dst_)");
  }

  if (family === "payout") {
    return {
      provider: PROVIDER,
      format: "airwallex.payout_webhook",
      confidence: evidence > 0 ? 0.9 : 0.45,
      supported: false,
      reasons,
      unsupportedReason:
        "Airwallex payout webhooks are recognized but not analyzed by this version of the adapter.",
    };
  }

  const knownName = Boolean(lookup(WEBHOOK_EVENTS, name)) || OTHER_PAYMENTS_EVENTS.includes(name);
  let confidence: number;
  if (family === "other") {
    confidence = knownName && evidence > 0 ? 0.9 : knownName ? 0.45 : 0;
  } else if (knownName) {
    confidence = evidence > 0 ? 0.95 : obj ? 0.75 : 0.45;
  } else {
    confidence = evidence >= 2 ? 0.8 : evidence === 1 ? 0.6 : 0.4;
  }
  if (confidence === 0) return none;
  if (obj) reasons.push("has data.object");
  return { provider: PROVIDER, format: "airwallex.webhook", confidence, supported: true, reasons };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const path = [prefix, i.path.join(".")].filter(Boolean).join(".");
    return `${path || "(root)"}: ${i.message}`;
  });
}

function parseObject(
  kind: ObjectParsed["kind"],
  input: unknown,
  prefix = "",
): { ok: true; value: ObjectParsed } | { ok: false; issues: string[] } {
  const r = OBJECT_SCHEMAS[kind].safeParse(input);
  if (!r.success) return { ok: false, issues: issuesOf(r.error, prefix) };
  return { ok: true, value: { kind, value: r.data } as ObjectParsed };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: AirwallexParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case "airwallex.error": {
      const r = ErrorBody.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "error", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "airwallex.payment_intent":
      return parseObject("payment_intent", input);
    case "airwallex.payment_attempt":
      return parseObject("payment_attempt", input);
    case "airwallex.refund":
      return parseObject("refund", input);
    case "airwallex.payment_dispute":
      return parseObject("payment_dispute", input);
    case "airwallex.webhook": {
      const r = Webhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const family = familyOf(r.data.name);
      let object: ObjectParsed | null = null;
      if (family && family !== "other" && family !== "payout") {
        const o = parseObject(family, r.data.data.object, "data.object");
        if (o.ok) object = o.value;
        // Unknown event names keep the event even when the object is unusual.
        else if (lookup(WEBHOOK_EVENTS, r.data.name)) return o;
      }
      return { ok: true, value: { kind: "webhook", value: r.data, object } };
    }
    default:
      return { ok: false, issues: [`Unsupported Airwallex format "${format}".`] };
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type Described = {
  objectType: string;
  paymentReference?: string;
  relatedReference?: string;
  merchantReference?: string;
  status?: string;
  stage: LifecycleStage;
  outcome: Outcome;
  amountMinor?: string;
  currency?: string;
  updatedAt?: string;
  attributes: Record<string, SafePrimitive | SafePrimitive[]>;
};

function attemptFailed(a: AttemptFields | null | undefined): boolean {
  if (!a) return false;
  return a.status === "FAILED" || Boolean(a.failure_code) || Boolean(a.failure_details?.code);
}

function statusInfo(table: Record<string, StatusEntry>, status: string | undefined) {
  return lookup(table, status);
}

function attemptAttributes(a: AttemptFields, prefix: "" | "latestAttempt") {
  const k = (name: string) =>
    prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
  const currency = upperCurrency(a.currency);
  return attrs([
    [k("status"), prefix ? a.status : undefined],
    [k("failureCode"), a.failure_code],
    [k("failureDetailsCode"), a.failure_details?.code],
    [k("issuerResponseCode"), issuerCodeFrom(a.provider_original_response_code)],
    [k("merchantAdviceCode"), a.merchant_advice_code],
    [k("paymentMethodType"), a.payment_method?.type],
    [k("cardBrand"), a.payment_method?.card?.brand],
    [k("settleVia"), a.settle_via],
    [k("avsResult"), a.authentication_data?.avs_result],
    [k("cvcResult"), a.authentication_data?.cvc_result],
    [k("capturedAmountMinor"), minorAttr(a.captured_amount, currency)],
    [k("refundedAmountMinor"), prefix ? undefined : minorAttr(a.refunded_amount, currency)],
  ]);
}

function describeIntent(pi: IntentT): Described {
  const currency = upperCurrency(pi.currency);
  const latest = pi.latest_payment_attempt ?? undefined;
  const failed = attemptFailed(latest);
  const info = statusInfo(PAYMENT_INTENT_STATUSES, pi.status);
  const outcome: Outcome = !info
    ? "unknown"
    : pi.status === "REQUIRES_PAYMENT_METHOD" && failed
      ? "failure"
      : info.outcome;
  const { amountMinor, amountAsSupplied } = amountOf(pi.amount, currency);
  return {
    objectType: "payment_intent",
    paymentReference: safeId(pi.id),
    relatedReference: safeId(latest?.id),
    merchantReference: safeId(pi.merchant_order_id),
    status: pi.status,
    stage: info?.stage ?? "other",
    outcome,
    amountMinor,
    currency,
    updatedAt: toIsoTimestamp(pi.updated_at),
    attributes: {
      ...attrs([
        ["objectType", "payment_intent"],
        ["statusKnown", Boolean(info)],
        ["amountAsSupplied", amountAsSupplied],
        ["capturedAmountMinor", minorAttr(pi.captured_amount, currency)],
        ["nextActionType", pi.next_action?.type],
        ["triggeredBy", pi.triggered_by],
        ["hasRequestId", Boolean(pi.request_id)],
        ["createdAt", toIsoTimestamp(pi.created_at)],
        ["updatedAt", toIsoTimestamp(pi.updated_at)],
        ["cancelledAt", toIsoTimestamp(pi.cancelled_at)],
      ]),
      ...(latest ? attemptAttributes(latest, "latestAttempt") : {}),
    },
  };
}

function describeAttempt(a: AttemptT): Described {
  const currency = upperCurrency(a.currency);
  const info = statusInfo(PAYMENT_ATTEMPT_STATUSES, a.status);
  let stage: LifecycleStage = info?.stage ?? "other";
  if (a.status === "FAILED") stage = lookup(FAILURE_CODE_STAGES, a.failure_code) ?? "payment";
  const { amountMinor, amountAsSupplied } = amountOf(a.amount, currency);
  return {
    objectType: "payment_attempt",
    paymentReference: safeId(a.payment_intent_id),
    relatedReference: safeId(a.id),
    merchantReference: safeId(a.merchant_order_id),
    status: a.status,
    stage,
    outcome: info?.outcome ?? "unknown",
    amountMinor,
    currency,
    updatedAt: toIsoTimestamp(a.updated_at),
    attributes: {
      ...attrs([
        ["objectType", "payment_attempt"],
        ["statusKnown", Boolean(info)],
        ["amountAsSupplied", amountAsSupplied],
        ["createdAt", toIsoTimestamp(a.created_at)],
        ["updatedAt", toIsoTimestamp(a.updated_at)],
      ]),
      ...attemptAttributes(a, ""),
    },
  };
}

function describeRefund(r: RefundT): Described {
  const currency = upperCurrency(r.currency);
  const info = statusInfo(REFUND_STATUSES, r.status);
  const { amountMinor, amountAsSupplied } = amountOf(r.amount, currency);
  return {
    objectType: "refund",
    paymentReference: safeId(r.payment_intent_id),
    relatedReference: safeId(r.payment_attempt_id),
    status: r.status,
    stage: "refund",
    outcome: info?.outcome ?? "unknown",
    amountMinor,
    currency,
    updatedAt: toIsoTimestamp(r.updated_at),
    attributes: attrs([
      ["objectType", "refund"],
      ["refundId", safeId(r.id)],
      ["statusKnown", Boolean(info)],
      ["amountAsSupplied", amountAsSupplied],
      ["failureDetailsCode", r.failure_details?.code],
      ["hasRequestId", Boolean(r.request_id)],
      ["createdAt", toIsoTimestamp(r.created_at)],
      ["updatedAt", toIsoTimestamp(r.updated_at)],
    ]),
  };
}

function describeDispute(d: DisputeT): Described {
  const legacy = !d.id && Boolean(d.dispute_id);
  const currency = upperCurrency(d.currency ?? d.dispute_currency);
  const info = statusInfo(DISPUTE_STATUSES, d.status ?? undefined);
  const { amountMinor, amountAsSupplied } = amountOf(d.amount ?? d.dispute_amount, currency);
  return {
    objectType: "payment_dispute",
    paymentReference: safeId(d.payment_intent_id),
    relatedReference: safeId(d.payment_attempt_id),
    merchantReference: safeId(d.merchant_order_id),
    status: d.status ?? undefined,
    stage: "dispute",
    outcome: info?.outcome ?? "unknown",
    amountMinor,
    currency,
    updatedAt: toIsoTimestamp(d.updated_at),
    attributes: attrs([
      ["objectType", "payment_dispute"],
      ["disputeId", safeId(d.id ?? d.dispute_id)],
      ["legacyDisputeShape", legacy || undefined],
      ["statusKnown", Boolean(info)],
      ["disputeStage", d.stage],
      ["disputeMode", d.mode],
      ["reasonType", d.reason?.type ?? d.dispute_reason_type],
      ["reasonCode", d.reason?.original_code ?? d.dispute_original_reason_code],
      ["reasonDescription", safeText(d.reason?.description, 120)],
      ["transactionType", d.transaction_type],
      ["cardBrand", d.card_brand ?? d.card_scheme],
      ["paymentMethodType", d.payment_method_type],
      ["amountAsSupplied", amountAsSupplied],
      ["dueAt", toIsoTimestamp(d.due_at)],
      ["createdAt", toIsoTimestamp(d.created_at)],
      ["updatedAt", toIsoTimestamp(d.updated_at)],
    ]),
  };
}

function describe(o: ObjectParsed): Described {
  switch (o.kind) {
    case "payment_intent":
      return describeIntent(o.value);
    case "payment_attempt":
      return describeAttempt(o.value);
    case "refund":
      return describeRefund(o.value);
    case "payment_dispute":
      return describeDispute(o.value);
  }
}

function headerAttributes(meta: RecordMeta | undefined) {
  const h = meta?.http?.headers;
  if (!h) return {};
  const ts = h["x-timestamp"];
  return attrs([
    // Only the presence of the signature is reported; it cannot be verified here.
    ["signatureHeaderPresent", "x-signature" in h ? true : undefined],
    ["testEventHeaderPresent", "client-secret-key" in h ? true : undefined],
    ["deliveryTimestamp", ts && /^\d{13}$/.test(ts) ? toIsoTimestamp(Number(ts)) : undefined],
  ]);
}

const DECLINE_CODES_FOR_EVENT = new Set(
  Object.entries(API_ERROR_CODES)
    .filter(([, e]) => e.definitive)
    .map(([c]) => c),
);

function normalize(parsed: AirwallexParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

  if (parsed.kind === "error") {
    const e = parsed.value;
    const code = canonicalCode(e.code);
    const details = e.details ?? {};
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeText(e.code, 64) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        outcome: DECLINE_CODES_FOR_EVENT.has(code) ? "failure" : "unknown",
        attributes: attrs([
          ["code", e.code],
          ["httpStatus", ctx.meta?.http?.status],
          ["source", safeText(e.source, 100)],
          ["traceId", safeId(e.trace_id)],
          [
            "issuerResponseCode",
            issuerCodeFrom(e.provider_original_response_code, details.original_response_code),
          ],
          ["cardBrand", str(details.card_brand)],
          ["cardType", str(details.card_type)],
          [
            "isCommercial",
            typeof details.is_commercial === "boolean" ? details.is_commercial : undefined,
          ],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "webhook") {
    const evt = parsed.value;
    const name = evt.name;
    const mapping = lookup(WEBHOOK_EVENTS, name);
    const d = parsed.object ? describe(parsed.object) : undefined;
    const stage: LifecycleStage = !mapping
      ? "other"
      : mapping.stage === "from_status"
        ? (d?.stage ?? "other")
        : mapping.stage;
    const outcome: Outcome = !mapping
      ? "unknown"
      : mapping.outcome === "from_status"
        ? (d?.outcome ?? "unknown")
        : mapping.outcome;
    const created = toIsoTimestamp(evt.created_at ?? evt.createdAt ?? undefined);
    const eventId = safeId(evt.id);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: safeText(name, 128) ?? "unknown",
        eventTypeKnown: Boolean(mapping),
        stage,
        providerStatus: d?.status,
        eventReference: eventId,
        deliveryKey: eventId,
        paymentReference: d?.paymentReference,
        relatedReference: d?.relatedReference,
        merchantReference: d?.merchantReference,
        eventTimestamp: created ?? d?.updatedAt,
        amountMinor: d?.amountMinor,
        currency: d?.currency,
        outcome,
        attributes: {
          ...(d?.attributes ?? {}),
          ...attrs([
            ["apiVersion", evt.version],
            ["eventFamily", name.split(".")[0]],
            ["documentedEvent", OTHER_PAYMENTS_EVENTS.includes(name) ? true : undefined],
            [
              "eventTimeSource",
              created ? undefined : d?.updatedAt ? "data.object.updated_at" : undefined,
            ],
          ]),
          ...headerAttributes(ctx.meta),
        },
        source,
        ...observed,
      }),
    ];
  }

  const d = describe(parsed);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: `${d.objectType}.snapshot`,
      eventTypeKnown: true,
      stage: d.stage,
      providerStatus: d.status,
      paymentReference: d.paymentReference,
      relatedReference: d.relatedReference,
      merchantReference: d.merchantReference,
      // A snapshot shows the state as of its last update.
      eventTimestamp: d.updatedAt,
      amountMinor: d.amountMinor,
      currency: d.currency,
      outcome: d.outcome,
      attributes: d.attributes,
      source,
      ...observed,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

function canonicalCode(code: string): string {
  return lookup(API_ERROR_ALIASES, code) ?? code;
}

export type FailureInput = {
  /** Airwallex error code: error body `code` or `failure_details.code`. */
  code?: string | undefined;
  /** PaymentAttempt `failure_code`. */
  failureCode?: string | undefined;
  /** Issuer or provider response code (`provider_original_response_code`). */
  issuerCode?: string | undefined;
  brand?: string | undefined;
  merchantAdviceCode?: string | undefined;
  paymentMethodType?: string | undefined;
  avsResult?: string | undefined;
  cvcResult?: string | undefined;
  message?: string | undefined;
  source?: string | undefined;
  httpStatus?: number | undefined;
};

type IssuerResolution =
  | { kind: "match"; reading: IssuerReading; brands: readonly CardBrand[] }
  | { kind: "ambiguous"; readings: readonly IssuerReading[]; brandMismatch: boolean }
  | { kind: "unlisted" };

/** Pick the issuer code reading for the brand, or list all readings when the brand is unknown. */
export function resolveIssuerCode(code: string, brand: CardBrand | undefined): IssuerResolution {
  const readings = lookup(ISSUER_CODES, code);
  if (!readings || readings.length === 0) return { kind: "unlisted" };
  if (brand) {
    const match = readings.find((r) => r.brands.includes(brand));
    if (match) return { kind: "match", reading: match, brands: [brand] };
    return { kind: "ambiguous", readings, brandMismatch: true };
  }
  // One reading that covers every brand using this code format needs no brand.
  const family = brandsForCodeFormat(code);
  if (readings.length === 1 && family.every((b) => readings[0]!.brands.includes(b)))
    return { kind: "match", reading: readings[0]!, brands: readings[0]!.brands };
  return { kind: "ambiguous", readings, brandMismatch: false };
}

const brandList = (brands: readonly CardBrand[]) => brands.map((b) => BRAND_LABELS[b]).join(", ");
const readingText = (r: IssuerReading) => `${brandList(r.brands)}: ${r.meaning}`;

function same<T>(values: readonly T[]): T | undefined {
  return values.length > 0 && values.every((v) => v === values[0]) ? values[0] : undefined;
}

/** Shared by the error body, PaymentAttempt failures and Refund failure_details. */
export function decodeFailure(
  input: FailureInput,
): Omit<DecodedErrorDraft, "sourceFormat" | "source" | "paymentReference" | "attemptReference"> {
  const code = input.code ? canonicalCode(input.code) : undefined;
  const codeEntry = lookup(API_ERROR_CODES, code);
  const failureEntry = lookup(FAILURE_CODES, input.failureCode);
  const base: CatalogEntry | undefined = codeEntry ?? failureEntry;
  const subCodes: Record<string, string> = {};
  if (input.code && input.code !== code) subCodes.code_as_sent = input.code;
  if (input.failureCode && input.code) subCodes.failure_code = input.failureCode;
  if (input.issuerCode) subCodes.provider_original_response_code = input.issuerCode;
  if (input.brand) subCodes.card_brand = safeText(input.brand, 32) ?? "";
  if (input.merchantAdviceCode) subCodes.merchant_advice_code = input.merchantAdviceCode;
  if (input.source) subCodes.source = safeText(input.source, 100) ?? "";
  if (input.httpStatus !== undefined) subCodes.http_status = String(input.httpStatus);
  if (input.avsResult) subCodes.avs_result = safeText(input.avsResult, 32) ?? "";
  if (input.cvcResult) subCodes.cvc_result = safeText(input.cvcResult, 32) ?? "";

  const docs: DocumentationLink[] = [];
  const missing: string[] = [];
  if (codeEntry) docs.push({ title: `Airwallex error code: ${code}`, url: ERROR_CODES_URL });
  else if (code) docs.push({ title: "Airwallex error response codes", url: ERROR_CODES_URL });
  if (failureEntry || input.failureCode)
    docs.push({ title: "Airwallex payment statuses", url: STATUSES_URL });
  if (code === "too_many_requests")
    docs.push({ title: "Airwallex rate limits", url: RATE_LIMITS_URL });

  let category = base?.category ?? "unknown";
  let explanation =
    base?.explanation ?? "PandaPayLens does not recognize this Airwallex error code.";
  let nextAction =
    base?.nextAction ??
    "Check the Airwallex documentation and contact Airwallex support with the trace_id.";
  let retry: RetryGuidance = base?.retry ?? "unknown";
  let retryExplanation = base?.retryExplanation ?? "No retry guidance is available for this error.";
  let confidence: Confidence = !base
    ? "insufficient"
    : base.meaningDocumented === false
      ? "insufficient"
      : codeEntry
        ? "strong"
        : // failure_code values are documented without descriptions.
          "possible";
  let outcomeKnown = Boolean(base?.definitive);

  if (code && !codeEntry) {
    missing.push(
      `Error code "${code}" is not in the PandaPayLens catalog. Payout (transfer) error codes are not decoded by this version.`,
    );
  }
  if (input.failureCode && !failureEntry)
    missing.push(`failure_code "${input.failureCode}" is not one of the documented values.`);

  const brand = normalizeBrand(input.brand);
  const nonCardMethod =
    input.paymentMethodType !== undefined && input.paymentMethodType.toLowerCase() !== "card";
  // provider_declined codes of local payment methods are not published; with
  // a card brand present the code is read as an issuer code.
  const decodeIssuer =
    input.issuerCode !== undefined &&
    !nonCardMethod &&
    (code !== "provider_declined" || brand !== undefined);

  if (input.issuerCode && !decodeIssuer) {
    missing.push(
      `Response code "${input.issuerCode}" comes from the payment method provider. Airwallex does not publish these provider codes.`,
    );
  } else if (input.issuerCode) {
    const c = input.issuerCode;
    outcomeKnown = true;
    docs.push({ title: "Airwallex issuer response codes", url: ISSUER_CODES_URL });
    if (input.brand && !brand)
      missing.push(
        `Card brand "${safeText(input.brand, 32)}" is not one of the brands in Airwallex's issuer response code table.`,
      );
    const res = resolveIssuerCode(c, brand);
    if (res.kind === "match") {
      const label = brand ? BRAND_LABELS[brand] : brandList(res.brands);
      if (res.reading.kind === "approval") {
        explanation += ` Issuer response code ${c} is an approval code (${label}: ${res.reading.meaning}), so the issuer did not decline; the failure happened in another step.`;
      } else {
        category = res.reading.category;
        retry = res.reading.retry;
        retryExplanation = ISSUER_RETRY_EXPLANATIONS[retry];
        nextAction = CATEGORY_NEXT_ACTIONS[category];
        explanation += ` Issuer response code ${c} (${label}): ${res.reading.meaning}.`;
        confidence = "strong";
      }
    } else if (res.kind === "ambiguous") {
      const declines = res.readings.filter((r) => r.kind === "decline");
      const sharedCategory = same(declines.map((r) => r.category));
      const sharedRetry = same(declines.map((r) => r.retry));
      if (sharedCategory && declines.length === res.readings.length) category = sharedCategory;
      if (sharedRetry && declines.length === res.readings.length) {
        retry = sharedRetry;
        retryExplanation = ISSUER_RETRY_EXPLANATIONS[retry];
      }
      explanation += res.brandMismatch
        ? ` Issuer response code ${c} is not documented for ${BRAND_LABELS[brand!]}. Airwallex documents it for other brands: ${res.readings.map(readingText).join("; ")}.`
        : ` Issuer response code ${c} has brand-specific meanings: ${res.readings.map(readingText).join("; ")}.`;
      if (!res.brandMismatch)
        missing.push(
          "The card brand is not in this record, so one meaning of the issuer response code cannot be chosen.",
        );
      confidence = base && confidence !== "insufficient" ? "possible" : "insufficient";
    } else {
      missing.push(`Issuer response code "${c}" is not in Airwallex's issuer response code table.`);
    }
  } else if (code === "issuer_declined" || input.failureCode === "authorization_failed") {
    missing.push(
      "No issuer response code was supplied, so the issuer's specific reason is unknown.",
    );
  }

  if (input.merchantAdviceCode) {
    const mac = lookup(MERCHANT_ADVICE_CODES, input.merchantAdviceCode);
    docs.push({ title: "Mastercard Merchant Advice Codes", url: MAC_URL });
    if (mac) {
      // The Merchant Advice Code is the most specific retry signal available.
      retry = mac.retry;
      retryExplanation = `Merchant Advice Code ${input.merchantAdviceCode}: ${mac.meaning}. ${mac.retryExplanation}`;
      if (input.issuerCode && !mac.validWith.includes(input.issuerCode))
        missing.push(
          `Airwallex documents Merchant Advice Code ${input.merchantAdviceCode} only with issuer codes ${mac.validWith.join(", ")}.`,
        );
      if (brand && brand !== "mastercard")
        missing.push("Merchant Advice Codes are documented for Mastercard only.");
    } else {
      missing.push(
        `Merchant Advice Code "${input.merchantAdviceCode}" is not in Airwallex's table.`,
      );
    }
  }

  const avs = input.avsResult !== undefined ? lookup(AVS_CODES, input.avsResult) : undefined;
  if (avs) {
    explanation += ` AVS result ${input.avsResult}: ${avs.meaning} (${avs.bucket}).`;
    docs.push({ title: "Airwallex AVS codes", url: AVS_URL });
  }
  const cvc = input.cvcResult !== undefined ? lookup(CVC_CODES, input.cvcResult) : undefined;
  if (cvc) {
    explanation += ` CVC result: ${cvc}.`;
    docs.push({ title: "Airwallex CVC2/CVV2 codes", url: CVC_URL });
  }

  const message = safeText(input.message);
  return {
    code: code ?? input.failureCode ?? "unknown",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction,
    retry,
    retryExplanation,
    confidence,
    documentation: docs,
    missingInformation: missing,
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

function failureInputFromAttempt(a: AttemptFields): FailureInput {
  const fd: FailureDetailsT | undefined = a.failure_details ?? undefined;
  const fdDetails = fd?.details ?? {};
  return {
    code: fd?.code ?? undefined,
    failureCode: a.failure_code ?? undefined,
    issuerCode: issuerCodeFrom(a.provider_original_response_code, fdDetails.original_response_code),
    brand: a.payment_method?.card?.brand ?? undefined,
    merchantAdviceCode: a.merchant_advice_code ?? undefined,
    paymentMethodType: a.payment_method?.type ?? undefined,
    avsResult: a.authentication_data?.avs_result ?? undefined,
    cvcResult: a.authentication_data?.cvc_result ?? undefined,
    message: fd?.message ?? undefined,
  };
}

function decodeObject(o: ObjectParsed, ctx: NormalizeContext, prefix: string): DecodedErrorDraft[] {
  const at = (path: string) => ({
    recordIndex: ctx.recordIndex,
    path: [prefix, path].filter(Boolean).join("."),
  });
  if (o.kind === "payment_intent" || o.kind === "payment_attempt") {
    const intent = o.kind === "payment_intent" ? o.value : undefined;
    const a: AttemptFields | undefined =
      o.kind === "payment_attempt" ? o.value : (o.value.latest_payment_attempt ?? undefined);
    if (!a || !attemptFailed(a)) return [];
    const input = failureInputFromAttempt(a);
    if (!input.code && !input.failureCode && !input.issuerCode) return [];
    const paymentReference = safeId(intent?.id ?? a.payment_intent_id);
    const attemptReference = safeId(a.id);
    const path = intent ? "latest_payment_attempt" : "";
    return [
      {
        ...decodeFailure(input),
        sourceFormat: ctx.format,
        source: at(a.failure_details ? [path, "failure_details"].filter(Boolean).join(".") : path),
        ...(paymentReference ? { paymentReference } : {}),
        ...(attemptReference ? { attemptReference } : {}),
      },
    ];
  }
  if (o.kind === "refund") {
    const r = o.value;
    const fd = r.failure_details ?? undefined;
    if (!fd?.code) return [];
    const paymentReference = safeId(r.payment_intent_id);
    const refundReference = safeId(r.id);
    const decoded = decodeFailure({
      code: fd.code,
      issuerCode: issuerCodeFrom(fd.details?.original_response_code),
      message: fd.message ?? undefined,
    });
    return [
      {
        ...decoded,
        sourceFormat: ctx.format,
        source: at("failure_details"),
        ...(paymentReference ? { paymentReference } : {}),
        ...(refundReference ? { attemptReference: refundReference } : {}),
      },
    ];
  }
  return [];
}

function decodeErrors(parsed: AirwallexParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "error") {
    const e = parsed.value;
    const details = e.details ?? {};
    const decoded = decodeFailure({
      code: e.code,
      issuerCode: issuerCodeFrom(e.provider_original_response_code, details.original_response_code),
      brand: str(details.card_brand),
      message: e.message ?? undefined,
      source: e.source ?? undefined,
      httpStatus: ctx.meta?.http?.status,
    });
    const entry = lookup(API_ERROR_CODES, canonicalCode(e.code));
    if (entry?.definitive)
      decoded.missingInformation.push(
        "The error body carries no PaymentIntent id; retrieve the PaymentIntent to see its later state.",
      );
    const status = ctx.meta?.http?.status;
    if (entry?.http && status !== undefined && !entry.http.includes(status))
      decoded.missingInformation.push(
        `Airwallex documents this code with HTTP ${entry.http.join(" or ")}, but the response has HTTP ${status}.`,
      );
    return [
      { ...decoded, sourceFormat: ctx.format, source: { recordIndex: ctx.recordIndex, path: "" } },
    ];
  }
  if (parsed.kind === "webhook") {
    return parsed.object ? decodeObject(parsed.object, ctx, "data.object") : [];
  }
  return decodeObject(parsed, ctx, "");
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const airwallexAdapter: ProviderAdapter<AirwallexParsed> = {
  id: PROVIDER,
  displayName: "Airwallex",
  version: AIRWALLEX_ADAPTER_VERSION,
  manifest: airwallexManifest,
  supportedFormats: [
    {
      id: "airwallex.error",
      description:
        "Payments Client API error body ({ code, message, source, trace_id, details, provider_original_response_code })",
    },
    {
      id: "airwallex.payment_intent",
      description: "PaymentIntent snapshot with the embedded latest_payment_attempt",
    },
    { id: "airwallex.payment_attempt", description: "PaymentAttempt snapshot" },
    { id: "airwallex.refund", description: "Refund snapshot" },
    { id: "airwallex.payment_dispute", description: "PaymentDispute snapshot" },
    {
      id: "airwallex.webhook",
      description:
        "Payments webhook ({ id, name, data.object, created_at, version }) for PaymentIntent, PaymentAttempt, Refund and PaymentDispute events",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // PaymentIntent and PaymentAttempt ids are explicit links between objects.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default airwallexAdapter;
