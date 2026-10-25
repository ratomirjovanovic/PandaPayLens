/**
 * Checkout.com adapter.
 *
 * Supported input families:
 * - `checkout.api_error`         API error response: `{ request_id, error_type, error_codes[] }`
 * - `checkout.payment_response`  Unified Payments API request response or payment details
 *                                (`pay_` id, `status`, `approved`, `response_code`)
 * - `checkout.action_accepted`   Capture/refund/void accepted response
 *                                (`{ action_id, reference, _links.payment }`)
 * - `checkout.webhook`           Workflows webhook for gateway events, with either the
 *                                `created_on` envelope or the `timestamp` + `source` envelope
 *
 * Recognized but not supported: `checkout.webhook.payment_setup` (flat Payment
 * Setup events whose payload is base64 encoded in `event_data`).
 *
 * A declined payment comes back as HTTP 201 with `approved: false` and
 * `status: "Declined"`, so declines are decoded from `response_code`, never
 * from the HTTP status.
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
  type DocumentationLink,
  type ErrorCategory,
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
  APPROVED_CODES,
  CLASS_TEXT,
  DOWNTIME_RETRY_URL,
  ERROR_CODES,
  ERROR_CODES_URL,
  ERROR_TYPES,
  EVENT_TYPES,
  HTTP_STATUS,
  IDEMPOTENCY_URL,
  MERCHANT_ADVICE_CODES,
  MERCHANT_ADVICE_RETRY_LATER,
  NEXT_ACTION,
  PAYMENT_STATUSES,
  RANGE_FALLBACK,
  RECOMMENDATION_CODES,
  RECOMMENDATION_CODES_URL,
  REFUND_URL,
  RESPONSE_CODES,
  RESPONSE_CODES_URL,
  RETRY_TEXT,
  SCA_RETRY_URL,
  SMART_DUNNING_URL,
  TEMPLATED_ERROR_CODES,
  VALIDATION_SUFFIXES,
  type CatalogEntry,
  type DeclineClass,
  type ErrorCodeEntry,
} from "./catalog.js";

import { checkoutManifest, CHECKOUT_ADAPTER_VERSION } from "./manifest.js";

export { checkoutManifest, CHECKOUT_ADAPTER_VERSION };

const PROVIDER = "checkout";

// response_code, recommendation codes and processing ids are documented as
// strings but appear as numbers in some official examples.
const Code = z.union([z.string().max(32), z.number().int()]);

const Processing = z.looseObject({
  partner_response_code: Code.optional(),
  recommendation_code: Code.optional(),
  partner_merchant_advice_code: Code.optional(),
  scheme: z.string().max(64).optional(),
});

const Balances = z.looseObject({});

const ApiError = z.looseObject({
  request_id: z.string().max(128).optional(),
  error_type: z.string().max(128),
  error_codes: z.array(z.string().max(256)).max(100).optional(),
});

const PaymentResponse = z.looseObject({
  id: z.string().max(64).optional(),
  action_id: z.string().max(64).optional(),
  status: z.string().max(64).optional(),
  approved: z.boolean().optional(),
  amount: z.number().int().optional(),
  amount_requested: z.number().int().optional(),
  currency: z.string().max(8).optional(),
  response_code: Code.optional(),
  response_summary: z.string().optional(),
  processed_on: z.string().max(64).optional(),
  reference: z.string().optional(),
  processing: Processing.optional(),
  balances: Balances.optional(),
  risk: z.looseObject({ flagged: z.boolean().optional() }).optional(),
  source: z.looseObject({ type: z.string().max(64).optional() }).optional(),
});

const ActionAccepted = z.looseObject({
  action_id: z.string().max(64),
  reference: z.string().optional(),
});

const WebhookData = z.looseObject({
  id: z.string().max(64).optional(),
  payment_id: z.string().max(64).optional(),
  action_id: z.string().max(64).optional(),
  reference: z.string().optional(),
  amount: z.number().int().optional(),
  currency: z.string().max(8).optional(),
  processed_on: z.string().max(64).optional(),
  response_code: Code.optional(),
  response_summary: z.string().optional(),
  payment_type: z.string().max(64).optional(),
  trigger: z.string().max(64).optional(),
  processing: Processing.optional(),
  balances: Balances.optional(),
  retry: z
    .looseObject({
      attempts_made: z.number().int().optional(),
      max_attempts: z.number().int().optional(),
    })
    .optional(),
});

const Webhook = z.looseObject({
  id: z.string().max(128),
  type: z.string().max(128),
  version: z.string().max(32).optional(),
  created_on: z.string().max(64).optional(),
  timestamp: z.string().max(64).optional(),
  source: z.string().max(64).optional(),
  data: WebhookData,
});

type ProcessingFields = z.infer<typeof Processing>;

export type CheckoutParsed =
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | { kind: "payment_response"; value: z.infer<typeof PaymentResponse> }
  | { kind: "action_accepted"; value: z.infer<typeof ActionAccepted> }
  | { kind: "webhook"; value: z.infer<typeof Webhook> };

const FORMATS = {
  "checkout.api_error": ["api_error", ApiError],
  "checkout.payment_response": ["payment_response", PaymentResponse],
  "checkout.action_accepted": ["action_accepted", ActionAccepted],
  "checkout.webhook": ["webhook", Webhook],
} as const;

const PAY_STRICT = /^pay_\w{26}$/;
const PAY_LOOSE = /^pay_[A-Za-z0-9]{6,64}$/;
const ACT_STRICT = /^act_\w{26}$/;
const ACT_LOOSE = /^act_[A-Za-z0-9]{6,64}$/;
const PAY_IN_PATH = /\/payments\/(pay_[A-Za-z0-9]{6,64})(?:[/?#]|$)/;
const RESPONSE_CODE = /^[1-5][0-9A-Z]{4}$/;
const DOTTED_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
const SNAKE_TYPE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function idKind(v: unknown, strict: RegExp, loose: RegExp): "strict" | "loose" | null {
  if (typeof v !== "string") return null;
  if (strict.test(v)) return "strict";
  return loose.test(v) ? "loose" : null;
}
const payKind = (v: unknown) => idKind(v, PAY_STRICT, PAY_LOOSE);
const actKind = (v: unknown) => idKind(v, ACT_STRICT, ACT_LOOSE);
const payId = (v: unknown) => (payKind(v) ? safeId(v) : undefined);
const actId = (v: unknown) => (actKind(v) ? safeId(v) : undefined);

/** A documented 5-character response_code, from a string or a number. */
function responseCode(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  return typeof s === "string" && RESPONSE_CODE.test(s.trim()) ? s.trim() : undefined;
}

/** Two-digit advice codes may arrive as numbers; "01" and 1 mean the same. */
function adviceCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 100)
    return String(v).padStart(2, "0");
  return typeof v === "string" && /^[0-9A-Za-z]{1,4}$/.test(v) ? v : undefined;
}

function shortCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  return typeof v === "string" && /^[0-9A-Za-z]{1,8}$/.test(v) ? v : undefined;
}

function classOf(code: string): DeclineClass | "approved" | undefined {
  if (code.startsWith("10")) return "approved";
  if (code.startsWith("20")) return "soft_decline";
  if (code.startsWith("30")) return "hard_decline";
  if (code.startsWith("4")) return "risk";
  if (code.startsWith("50")) return "payout_refund_decline";
  return undefined;
}

function linksOf(input: Record<string, unknown>): Record<string, unknown> | undefined {
  // The 201 example in the payments guide uses `links`, the schema `_links`.
  if (isObj(input._links)) return input._links;
  return isObj(input.links) ? input.links : undefined;
}

function hrefOf(links: Record<string, unknown> | undefined, key: string): string | undefined {
  const link = links?.[key];
  if (typeof link === "string") return link;
  return isObj(link) && typeof link.href === "string" ? link.href : undefined;
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: PROVIDER };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe payloads carry `object` ("event", "payment_intent", ...);
  // Checkout.com payloads never do.
  if ("object" in input) return none;

  if (typeof input.error_type === "string") {
    const codes =
      Array.isArray(input.error_codes) && input.error_codes.every((c) => typeof c === "string");
    const requestId = typeof input.request_id === "string";
    const knownType = input.error_type in ERROR_TYPES;
    const httpError = (meta?.http?.status ?? 0) >= 400;
    const confidence =
      codes && requestId
        ? 0.92
        : codes
          ? 0.75
          : requestId && knownType
            ? 0.75
            : requestId && httpError
              ? 0.6
              : requestId
                ? 0.45
                : 0;
    if (confidence === 0) return none;
    const reasons = ["has error_type"];
    if (codes) reasons.push("has an error_codes array of strings");
    if (requestId) reasons.push("has request_id");
    if (knownType) reasons.push("error_type is a documented Checkout.com error type");
    return { ...base, format: "checkout.api_error", confidence, supported: true, reasons };
  }

  if (
    typeof input.event_type === "string" &&
    typeof input.event_subject_id === "string" &&
    typeof input.id === "string" &&
    input.id.startsWith("set_")
  ) {
    return {
      ...base,
      format: "checkout.webhook.payment_setup",
      confidence: 0.85,
      supported: false,
      reasons: ["id has the set_ prefix", "has event_type and event_subject_id"],
      unsupportedReason:
        "Checkout.com Payment Setup events (flat event_type / event_data envelope) are recognized but not analyzed. Their payload is base64 encoded in event_data.",
    };
  }

  if (isObj(input.data)) {
    const data = input.data;
    if ("object" in data) return none;
    let score = 0;
    const reasons: string[] = [];
    const pay = payKind(data.id) ?? payKind(data.payment_id);
    if (pay) {
      score += pay === "strict" ? 0.4 : 0.25;
      reasons.push("data carries a pay_ payment id");
    }
    if (actKind(data.action_id)) {
      score += 0.15;
      reasons.push("data.action_id has the act_ prefix");
    }
    const version = typeof input.version === "string" && DOTTED_VERSION.test(input.version);
    const createdOn = typeof input.created_on === "string";
    const tsSource = typeof input.timestamp === "string" && typeof input.source === "string";
    if (version && (createdOn || tsSource)) {
      score += 0.25;
      reasons.push("dotted version with a created_on or timestamp + source envelope");
    }
    const links = isObj(input._links) ? input._links : undefined;
    if (
      hrefOf(links, "self")?.includes("/workflows/events/") ||
      hrefOf(links, "subject")?.includes("/workflows/events/subject/")
    ) {
      score += 0.2;
      reasons.push("_links point to workflow events");
    }
    // Everything below is shared with other providers (Stripe also uses
    // evt_, type and data), so it only adds to an existing match.
    if (score === 0) return none;
    if (typeof input.id === "string" && input.id.startsWith("evt_")) {
      score += 0.1;
      reasons.push("id has the evt_ prefix");
    }
    if (typeof input.type === "string" && SNAKE_TYPE.test(input.type)) score += 0.1;
    if (isObj(data.event_links)) score += 0.05;
    if (responseCode(data.response_code)) score += 0.05;
    return {
      ...base,
      format: "checkout.webhook",
      confidence: round(0.2 + score),
      supported: true,
      reasons,
    };
  }

  const pay = payKind(input.id);
  if (pay) {
    const reasons = ["id has the pay_ prefix"];
    let score = 0;
    if (actKind(input.action_id)) {
      score += 0.15;
      reasons.push("action_id has the act_ prefix");
    }
    if (typeof input.status === "string" && input.status in PAYMENT_STATUSES) {
      score += 0.15;
      reasons.push(`status "${input.status}" is a documented payment status`);
    }
    if (typeof input.approved === "boolean") {
      score += 0.1;
      reasons.push("has approved");
    }
    if (responseCode(input.response_code) && typeof input.response_summary === "string") {
      score += 0.1;
      reasons.push("has a 5-character response_code and response_summary");
    }
    if (linksOf(input)) score += 0.05;
    // A bare pay_ id says nothing about the record.
    const confidence = score === 0 ? 0.4 : round((pay === "strict" ? 0.5 : 0.3) + score);
    return { ...base, format: "checkout.payment_response", confidence, supported: true, reasons };
  }

  const act = actKind(input.action_id);
  if (act && !("id" in input)) {
    const payHref = hrefOf(linksOf(input), "payment");
    if (payHref && PAY_IN_PATH.test(payHref)) {
      return {
        ...base,
        format: "checkout.action_accepted",
        confidence: 0.85,
        supported: true,
        reasons: ["action_id has the act_ prefix", "_links.payment points to a pay_ payment"],
      };
    }
    return {
      ...base,
      format: "checkout.action_accepted",
      confidence: act === "strict" ? 0.6 : 0.4,
      supported: true,
      reasons: ["action_id has the act_ prefix"],
    };
  }

  const code = responseCode(input.response_code);
  if (
    code &&
    (code in RESPONSE_CODES || code in APPROVED_CODES) &&
    typeof input.response_summary === "string"
  ) {
    return {
      ...base,
      format: "checkout.payment_response",
      confidence: 0.6,
      supported: true,
      reasons: ["response_code is a documented Checkout.com response code", "has response_summary"],
    };
  }

  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: CheckoutParsed } | { ok: false; issues: string[] } {
  const entry = FORMATS[format as keyof typeof FORMATS];
  if (!entry) return { ok: false, issues: [`Unsupported Checkout.com format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as CheckoutParsed };
}

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

const BALANCE_FIELDS: [string, string][] = [
  ["total_authorized", "totalAuthorized"],
  ["total_voided", "totalVoided"],
  ["available_to_void", "availableToVoid"],
  ["total_captured", "totalCaptured"],
  ["available_to_capture", "availableToCapture"],
  ["total_refunded", "totalRefunded"],
  ["available_to_refund", "availableToRefund"],
];

function balanceAttrs(b: Record<string, unknown> | undefined): [string, unknown][] {
  if (!b) return [];
  return BALANCE_FIELDS.map(([from, to]) => [to, minorUnits(b[from])]);
}

function processingAttrs(p: ProcessingFields | undefined): [string, unknown][] {
  return [
    ["partnerResponseCode", shortCode(p?.partner_response_code)],
    ["recommendationCode", adviceCode(p?.recommendation_code)],
    ["merchantAdviceCode", adviceCode(p?.partner_merchant_advice_code)],
    ["scheme", p?.scheme],
  ];
}

function declineClassOf(code: string | undefined): string | undefined {
  return code ? classOf(code) : undefined;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function paymentOutcome(
  status: string | undefined,
  approved: boolean | undefined,
  code: string | undefined,
): { stage: LifecycleStage; outcome: Outcome; known: boolean } {
  if (status !== undefined) {
    const info = PAYMENT_STATUSES[status];
    return info
      ? { stage: info.stage, outcome: info.outcome, known: true }
      : { stage: "payment", outcome: "unknown", known: false };
  }
  if (approved !== undefined)
    return { stage: "authorization", outcome: approved ? "success" : "failure", known: true };
  const cls = code ? classOf(code) : undefined;
  if (cls === "approved") return { stage: "payment", outcome: "success", known: true };
  if (cls) return { stage: "payment", outcome: "failure", known: true };
  return { stage: "payment", outcome: "unknown", known: false };
}

function normalize(parsed: CheckoutParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const httpStatus = ctx.meta?.http?.status;

  if (parsed.kind === "api_error") {
    const e = parsed.value;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${safeText(e.error_type, 64) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: httpStatus ? `HTTP ${httpStatus}` : e.error_type,
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["errorType", e.error_type],
            ["requestId", safeId(e.request_id)],
            ["httpStatus", httpStatus],
          ]),
          errorCodes: (e.error_codes ?? []).map((c) => safeText(c, 64) ?? ""),
        },
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    const code = responseCode(r.response_code);
    const { stage, outcome, known } = paymentOutcome(r.status, r.approved, code);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: r.status ? `payment.${safeText(r.status, 64)}` : "payment.response",
        eventTypeKnown: known,
        stage,
        providerStatus: r.status,
        paymentReference: payId(r.id),
        relatedReference: actId(r.action_id),
        merchantReference: merchantRef(r.reference),
        eventTimestamp: toIsoTimestamp(r.processed_on),
        amountMinor: minorUnits(r.amount),
        currency: upperCurrency(r.currency),
        outcome,
        attributes: attrs([
          ["approved", r.approved],
          ["responseCode", code],
          ["responseSummary", r.response_summary],
          ["declineClass", declineClassOf(code)],
          ...processingAttrs(r.processing),
          ["sourceType", r.source?.type],
          ["riskFlagged", r.risk?.flagged],
          ["amountRequested", minorUnits(r.amount_requested)],
          ...balanceAttrs(r.balances),
          ["httpStatus", httpStatus],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "action_accepted") {
    const a = parsed.value;
    const href = hrefOf(linksOf(a), "payment");
    const pay = href ? PAY_IN_PATH.exec(href)?.[1] : undefined;
    // 202 accepts the action without confirming it; 200 is documented as
    // "already captured/refunded/voided".
    const already = httpStatus === 200;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "action_accepted",
        eventTypeKnown: true,
        stage: "other",
        providerStatus: httpStatus ? `HTTP ${httpStatus}` : undefined,
        paymentReference: payId(pay),
        relatedReference: actId(a.action_id),
        merchantReference: merchantRef(a.reference),
        outcome: already ? "success" : "pending",
        attributes: attrs([
          ["httpStatus", httpStatus],
          ["alreadyProcessed", httpStatus === undefined ? undefined : already],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  const evt = parsed.value;
  const d = evt.data;
  const info = EVENT_TYPES[evt.type];
  const code = responseCode(d.response_code);
  const eventId = safeId(evt.id);
  const createdAt = toIsoTimestamp(evt.created_on ?? evt.timestamp);
  const envelope =
    evt.created_on !== undefined
      ? "created_on"
      : evt.timestamp !== undefined
        ? "timestamp_source"
        : "unknown";
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(evt.type, 128) ?? "unknown",
      eventTypeKnown: Boolean(info),
      stage: info?.stage ?? (evt.type.startsWith("dispute_") ? "dispute" : "other"),
      eventReference: eventId,
      // Same evt_ id means the same event. Whether a retried or resent
      // delivery keeps its id is not documented (see manifest limitations).
      deliveryKey: eventId,
      // data.id is the payment id; payment_optimized uses data.payment_id.
      paymentReference: payId(d.id) ?? payId(d.payment_id),
      relatedReference: actId(d.action_id),
      merchantReference: merchantRef(d.reference),
      // Delivery order may vary, so the processing time is preferred over the
      // notification time.
      eventTimestamp: toIsoTimestamp(d.processed_on) ?? createdAt,
      amountMinor: minorUnits(d.amount),
      currency: upperCurrency(d.currency),
      outcome: info?.outcome ?? "unknown",
      attributes: attrs([
        ["envelope", envelope],
        ["version", evt.version],
        ["eventSource", evt.source],
        ["notificationCreatedAt", createdAt],
        ["responseCode", code],
        ["responseSummary", d.response_summary],
        ["declineClass", declineClassOf(code)],
        ...processingAttrs(d.processing),
        ["paymentType", d.payment_type],
        ["trigger", d.trigger],
        ["retryAttemptsMade", d.retry?.attempts_made],
        ["retryMaxAttempts", d.retry?.max_attempts],
        ...balanceAttrs(d.balances),
      ]),
      source,
      ...observed,
    }),
  ];
}

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
  attemptReference?: string;
};

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
  ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
});

/** Decodes a payment `response_code` with the processing advice fields. */
export function decodeResponseCode(
  code: string | undefined,
  processing: ProcessingFields | undefined,
  summary: string | undefined,
  loc: Location,
): DecodedErrorDraft {
  const entry = code ? RESPONSE_CODES[code] : undefined;
  const cls = code ? classOf(code) : undefined;
  const declineClass = cls && cls !== "approved" ? cls : undefined;
  const missing: string[] = [];
  const docs: DocumentationLink[] = [
    { title: "Checkout.com API response codes", url: RESPONSE_CODES_URL },
  ];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let explanation: string;

  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = "strong";
    explanation = `Response code ${code}: ${entry.text}.${entry.note ? ` ${entry.note}` : ""}`;
  } else if (declineClass) {
    ({ category, retry } = RANGE_FALLBACK[declineClass]);
    confidence = "possible";
    explanation = `Response code ${code} is in a documented range but not in the PandaPayLens catalog. ${CLASS_TEXT[declineClass]}`;
    missing.push(`Response code "${code}" is not in the PandaPayLens catalog yet.`);
  } else {
    category = "unknown";
    retry = "unknown";
    confidence = "insufficient";
    explanation = code
      ? `Response code "${code}" does not match a documented Checkout.com range.`
      : "The payment was declined, but no response_code was supplied.";
    missing.push(
      code
        ? `Response code "${code}" is not documented.`
        : "No response_code was supplied, so the reason for the decline is unknown.",
    );
  }

  const retryParts: string[] = [];
  if (declineClass && entry) retryParts.push(CLASS_TEXT[declineClass]);
  const subCodes: Record<string, string> = {};
  if (declineClass) subCodes.decline_class = declineClass;
  const partner = shortCode(processing?.partner_response_code);
  if (partner) subCodes.partner_response_code = partner;
  if (processing?.scheme) subCodes.scheme = safeText(processing.scheme, 32) ?? "";

  // Recommendation and merchant advice codes override the code-based guidance.
  const rec = adviceCode(processing?.recommendation_code);
  const mac = adviceCode(processing?.partner_merchant_advice_code);
  const recEntry = rec ? RECOMMENDATION_CODES[rec] : undefined;
  if (rec) subCodes.recommendation_code = rec;
  if (mac) subCodes.merchant_advice_code = mac;
  if (recEntry) {
    retry = recEntry.retry;
    retryParts.push(`Checkout.com recommendation code ${rec}: ${recEntry.meaning}`);
    docs.push({ title: "Checkout.com recommendation codes", url: RECOMMENDATION_CODES_URL });
  } else if (mac && MERCHANT_ADVICE_RETRY_LATER.has(mac)) {
    retry = "retry_conditionally";
    retryParts.push(
      `Mastercard merchant advice code ${mac} asks to retry only after a waiting period (between 1 hour and 10 days depending on the code).`,
    );
    docs.push({ title: "Checkout.com recommendation codes", url: RECOMMENDATION_CODES_URL });
  }
  if (rec && !recEntry) missing.push(`Recommendation code "${rec}" is not documented.`);
  if (mac && !recEntry && !MERCHANT_ADVICE_RETRY_LATER.has(mac)) {
    missing.push(
      MERCHANT_ADVICE_CODES.has(mac)
        ? `Mastercard merchant advice code "${mac}" is shown but not interpreted.`
        : `Mastercard merchant advice code "${mac}" is not documented.`,
    );
  }

  retryParts.push(RETRY_TEXT[retry]);
  if (entry?.smartDunning) {
    retryParts.push(
      "Checkout.com lists this code as eligible for Smart Dunning retries of merchant-initiated payments.",
    );
    docs.push({ title: "Checkout.com Smart Dunning retries", url: SMART_DUNNING_URL });
  }
  if (entry?.downtimeRetry) {
    retryParts.push(
      "Checkout.com lists this code as eligible for automatic downtime retries of merchant-initiated payments.",
    );
    docs.push({ title: "Checkout.com automatic downtime retries", url: DOWNTIME_RETRY_URL });
  }
  if (code === "20154" || code === "43401")
    docs.push({ title: "Checkout.com SCA retries", url: SCA_RETRY_URL });
  if (declineClass === "payout_refund_decline")
    docs.push({ title: "Checkout.com refunds", url: REFUND_URL });
  if (!loc.paymentReference)
    missing.push(
      "No pay_ payment id; the later state of this payment cannot be checked from this record.",
    );

  const message = safeText(summary, 200);
  return {
    ...withRefs(loc),
    code: code ?? "Declined",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function errorCodeEntry(code: string): { entry: ErrorCodeEntry; confidence: Confidence } | null {
  const direct = ERROR_CODES[code];
  if (direct) return { entry: direct, confidence: "strong" };
  const templated = TEMPLATED_ERROR_CODES.find((t) => t.pattern.test(code));
  if (templated) return { entry: templated.entry, confidence: "strong" };
  if (/^[a-z0-9_]{1,128}$/.test(code)) {
    const v = VALIDATION_SUFFIXES.find(
      (s) => code.endsWith(s.suffix) && code !== s.suffix.slice(1),
    );
    if (v) {
      return {
        entry: {
          description: `Field validation error: ${v.meaning}`,
          endpoint: "payments",
          category: "invalid_request",
          retry: "do_not_retry",
        },
        confidence: "possible",
      };
    }
  }
  return null;
}

/** Decodes one entry of an API error body. */
export function decodeApiError(
  code: string | undefined,
  errorType: string,
  httpStatus: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const found = code ? errorCodeEntry(code) : null;
  const typeEntry: CatalogEntry | undefined = ERROR_TYPES[errorType];
  const statusEntry: CatalogEntry | undefined =
    httpStatus !== undefined ? HTTP_STATUS[httpStatus] : undefined;
  const missing: string[] = [];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let explanation: string;
  let nextAction: string;
  let retryExplanation: string;
  let confidence: Confidence;

  if (found) {
    ({ category, retry } = found.entry);
    explanation = found.entry.description;
    nextAction = NEXT_ACTION[category];
    retryExplanation = RETRY_TEXT[retry];
    confidence = found.confidence;
  } else {
    const fallback = typeEntry ?? statusEntry;
    category = fallback?.category ?? "unknown";
    retry = fallback?.retry ?? "unknown";
    explanation =
      fallback?.explanation ?? "PandaPayLens does not recognize this Checkout.com error.";
    nextAction = fallback?.nextAction ?? NEXT_ACTION.unknown;
    retryExplanation = fallback?.retryExplanation ?? RETRY_TEXT.unknown;
    confidence = fallback ? "possible" : "insufficient";
    if (code)
      missing.push(`Error code "${safeText(code, 80)}" is not in the PandaPayLens catalog yet.`);
    else missing.push("No error_codes were supplied, so only the error_type is known.");
    if (!fallback) missing.push("Neither error_type nor the HTTP status maps to a known category.");
  }

  const subCodes: Record<string, string> = { error_type: safeText(errorType, 64) ?? "" };
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const docs: DocumentationLink[] = [{ title: "Checkout.com error codes", url: ERROR_CODES_URL }];
  if (retry === "retry_conditionally" || category === "duplicate_request")
    docs.push({ title: "Checkout.com idempotency", url: IDEMPOTENCY_URL });

  return {
    ...withRefs(loc),
    code: (code ? safeText(code, 128) : undefined) ?? safeText(errorType, 128) ?? "unknown",
    subCodes,
    category,
    explanation,
    nextAction,
    retry,
    retryExplanation,
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

const DECLINE_EVENT = /_declined$/;

function decodeErrors(parsed: CheckoutParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };

  if (parsed.kind === "api_error") {
    const e = parsed.value;
    const status = ctx.meta?.http?.status;
    const codes = e.error_codes ?? [];
    if (codes.length === 0)
      return [
        decodeApiError(undefined, e.error_type, status, { sourceFormat: ctx.format, source }),
      ];
    return codes.map((c, i) =>
      decodeApiError(c, e.error_type, status, {
        sourceFormat: ctx.format,
        source: { ...source, path: `error_codes[${i}]` },
      }),
    );
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    const code = responseCode(r.response_code);
    const declined = code
      ? classOf(code) !== "approved"
      : r.approved === false || r.status === "Declined";
    if (!declined) return [];
    return [
      decodeResponseCode(code, r.processing, r.response_summary, {
        sourceFormat: ctx.format,
        source,
        paymentReference: payId(r.id),
        attemptReference: actId(r.action_id),
      }),
    ];
  }

  if (parsed.kind === "webhook") {
    const evt = parsed.value;
    const d = evt.data;
    const code = responseCode(d.response_code);
    const declined = code ? classOf(code) !== "approved" : DECLINE_EVENT.test(evt.type);
    if (!declined) return [];
    return [
      decodeResponseCode(code, d.processing, d.response_summary, {
        sourceFormat: ctx.format,
        source: { ...source, path: "data" },
        paymentReference: payId(d.id) ?? payId(d.payment_id),
        attemptReference: actId(d.action_id),
      }),
    ];
  }

  return [];
}

export const checkoutAdapter: ProviderAdapter<CheckoutParsed> = {
  id: PROVIDER,
  displayName: "Checkout.com",
  version: CHECKOUT_ADAPTER_VERSION,
  manifest: checkoutManifest,
  supportedFormats: [
    {
      id: "checkout.api_error",
      description: "API error response ({ request_id, error_type, error_codes[] })",
    },
    {
      id: "checkout.payment_response",
      description:
        "Payments API response or payment details (pay_ id, status, approved, response_code)",
    },
    {
      id: "checkout.action_accepted",
      description: "Capture, refund or void accepted response ({ action_id, reference, _links })",
    },
    {
      id: "checkout.webhook",
      description:
        "Workflows webhook for gateway payment events (created_on, or timestamp + source envelope)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // The pay_ payment id links every action of a payment; act_ action ids
    // link a request response to its webhook. The merchant reference can be
    // reused across attempts, so it is never a key.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export { EVENT_TYPES as CHECKOUT_EVENT_TYPES };
export * from "./catalog.js";
export default checkoutAdapter;
