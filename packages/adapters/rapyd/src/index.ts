/**
 * Rapyd adapter.
 *
 * Supported input families:
 * - `rapyd.api_response`  Merchant API REST response: a `status` object
 *                         (`error_code`, `status`, `message`, `response_code`,
 *                         `operation_id`) with a payment, refund, payout or
 *                         dispute in `data`, a list of them, or a webhook record
 *                         returned by the webhook methods
 * - `rapyd.webhook`       Webhook for payments, refunds, disputes and payouts:
 *                         the body (`id` wh_, `type`, `data`,
 *                         `trigger_operation_id`, `status`, `created_at`,
 *                         `extended_timestamp`), the same body inside the HTTP
 *                         client wrapper of the webhook format page, or an
 *                         internal delivery record whose `token` is the wh_ id
 *
 * Recognized but not supported: `rapyd.wallet_transfer` and
 * `rapyd.wallet_webhook` (transfers between Rapyd Wallets, a lifecycle of its
 * own).
 *
 * Status vocabularies depend on the object: `CLO` is a closed payment, a
 * closed transfer and a delivered webhook, and `REV` is a reversed payment or
 * a reversed dispute. The object kind is always decided first.
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
  type SourceLocation,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ADVICE_WAIT,
  CARD_NETWORK_ERRORS_URL,
  CREATE_PAYMENT_ERRORS_URL,
  DISPUTE_STATUSES,
  ERROR_CODES,
  ERROR_MESSAGES_URL,
  EVENT_TYPES,
  EXAMPLE_SOURCES,
  HTTP_STATUS,
  IDEMPOTENCY_URL,
  MERCHANT_ADVICE_CODES,
  MERCHANT_ADVICE_CODES_URL,
  NETWORK_CODES,
  NEXT_ACTION,
  NEXT_ACTIONS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  PAYOUT_URL,
  RATE_LIMITS_URL,
  REFUND_FAILURE_REASONS,
  REFUND_STATUSES,
  REFUND_URL,
  RETRY_TEXT,
  SECTIONS,
  TRANSFER_STATUSES,
  WALLET_EVENT_TYPES,
  WEBHOOK_STATUSES,
  splitCode,
  type CodeEntry,
  type NetworkEntry,
  type ObjectKind,
  type StateInfo,
} from "./catalog.js";

import { rapydManifest, RAPYD_ADAPTER_VERSION } from "./manifest.js";

export { rapydManifest, RAPYD_ADAPTER_VERSION };

const PROVIDER = "rapyd";

type Obj = Record<string, unknown>;

// Codes are strings in the documentation; the payment error_code is described
// as "string and number".
const CodeValue = z
  .union([z.string().max(512), z.number()])
  .nullable()
  .optional();

const StatusObject = z.looseObject({
  status: z.string().max(32),
  error_code: CodeValue,
  response_code: CodeValue,
  message: z.string().max(20_000).nullable().optional(),
  operation_id: z.string().max(128).nullable().optional(),
});

const ApiResponse = z.looseObject({
  status: StatusObject,
  data: z.unknown().optional(),
});

const Timestamp = z
  .union([z.number(), z.string().max(64)])
  .nullable()
  .optional();

const WebhookBody = z
  .looseObject({
    id: z.string().max(128).nullable().optional(),
    token: z.string().max(128).nullable().optional(),
    type: z.string().min(1).max(128),
    data: z.union([z.looseObject({}), z.array(z.unknown()).max(1000)]),
    trigger_operation_id: z.string().max(128).nullable().optional(),
    status: z.string().max(32).nullable().optional(),
    created_at: Timestamp,
    extended_timestamp: Timestamp,
  })
  .refine((w) => Boolean(webhookId(w.id) ?? webhookId(w.token)), {
    message: "id (or token in a delivery record) must be a wh_ webhook id",
    path: ["id"],
  });

type ApiResponseValue = z.infer<typeof ApiResponse>;
type WebhookValue = z.infer<typeof WebhookBody>;

type WebhookShape = "body" | "wrapper" | "delivery_record" | "api_record";

export type RapydParsed =
  | { kind: "api_response"; value: ApiResponseValue }
  | { kind: "webhook"; value: WebhookValue; shape: WebhookShape; signaturePresent: boolean };

const HEX32 = /^[0-9a-f]{32}$/;
const ID_BODY = /^[A-Za-z0-9]{6,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATION_ID = /^[A-Za-z0-9-]{8,64}$/;
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const WORD = /^[A-Za-z0-9_]{1,64}$/;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Rapyd ids are a prefix plus 32 hex characters; synthetic data uses other characters. */
function prefixed(v: unknown, prefix: string): "strict" | "loose" | null {
  if (typeof v !== "string" || !v.startsWith(prefix)) return null;
  const rest = v.slice(prefix.length);
  if (HEX32.test(rest)) return "strict";
  return ID_BODY.test(rest) ? "loose" : null;
}
const idOf = (v: unknown, prefix: string) => (prefixed(v, prefix) ? safeId(v) : undefined);
const paymentId = (v: unknown) => idOf(v, "payment_");
const refundId = (v: unknown) => idOf(v, "refund_");
const payoutId = (v: unknown) => idOf(v, "payout_");
const disputeId = (v: unknown) => idOf(v, "dispute_");
function webhookId(v: unknown): string | undefined {
  return idOf(v, "wh_");
}
const operationId = (v: unknown) => (typeof v === "string" && OPERATION_ID.test(v) ? v : undefined);

const word = (v: unknown) => (typeof v === "string" && WORD.test(v) ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);

/** A code value as text, or undefined when empty. */
function codeValue(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" || t.length > 256 ? undefined : t;
}

/** Code for display in attributes. */
function codeAttr(v: unknown): string | undefined {
  const c = codeValue(v);
  return c && /^[\x20-\x7e]{1,160}$/.test(c) ? safeText(c, 160) : undefined;
}

/** Two-character card network or advice code; numbers are padded ("5" and 5 mean "05"). */
function shortCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 100)
    return String(v).padStart(2, "0");
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (/^\d$/.test(t)) return `0${t}`;
  return /^[A-Za-z0-9_ ]{1,120}$/.test(t) ? t : undefined;
}

/** Unix seconds or milliseconds; 0 means "not set" in Rapyd's delivery records. */
function unixTime(v: unknown): string | undefined {
  const n =
    typeof v === "string" && /^\d{9,13}$/.test(v)
      ? Number(v)
      : typeof v === "number" && Number.isFinite(v)
        ? v
        : undefined;
  if (n === undefined || n <= 0) return undefined;
  return toIsoTimestamp(n);
}

/** Merchant API amounts are decimals in the major unit. */
function amountOf(v: unknown, currency: string | undefined): string | undefined {
  if (v === null || v === undefined || !currency) return undefined;
  return decimalToMinor(v, currency);
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 128);
  return id && safeText(id, 128) === id ? id : undefined;
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

function classify(o: Obj, hint?: ObjectKind): ObjectKind | undefined {
  if (hint) return hint;
  if (prefixed(o.id, "payment_")) return "payment";
  if (prefixed(o.id, "refund_")) return "refund";
  if (prefixed(o.id, "payout_")) return "payout";
  if (prefixed(o.token, "dispute_")) return "dispute";
  return undefined;
}

function hasRapydObject(data: unknown): boolean {
  const first = Array.isArray(data) ? data[0] : data;
  return isObj(first) && (classify(first) !== undefined || Boolean(webhookId(first.token)));
}

function isWebhookRecord(data: unknown): data is Obj {
  return isObj(data) && Boolean(webhookId(data.token)) && typeof data.type === "string";
}

function isTransfer(data: unknown): boolean {
  return (
    isObj(data) &&
    ("source_ewallet_id" in data || "destination_ewallet_id" in data) &&
    typeof data.status === "string" &&
    TRANSFER_STATUSES.has(data.status) &&
    classify(data) === undefined
  );
}

type Score = { score: number; reasons: string[] };

function envelopeScore(input: Obj): Score | null {
  const s = input.status;
  if (!isObj(s)) return null;
  const reasons: string[] = [];
  let score = 0;
  const op = operationId(s.operation_id);
  if (op) {
    score += UUID.test(op) ? 0.4 : 0.35;
    reasons.push("status object has operation_id");
  }
  if (s.status === "SUCCESS" || s.status === "ERROR") {
    score += 0.2;
    reasons.push(`status.status is ${s.status}`);
  }
  const codes = typeof s.error_code === "string" && typeof s.response_code === "string";
  if (codes) {
    score += 0.2;
    reasons.push("status object has error_code and response_code");
  }
  if (typeof s.message === "string") score += 0.05;
  // Without operation_id a status object with a status and both codes is
  // still too generic to claim; with less it is not considered at all.
  if (!op) return codes ? { score: Math.min(score, 0.45), reasons } : null;
  if (hasRapydObject(input.data)) {
    score += 0.1;
    reasons.push("data carries a prefixed Rapyd id");
  }
  return { score, reasons };
}

function webhookScore(body: Obj): Score | null {
  const kind = prefixed(body.id, "wh_") ?? prefixed(body.token, "wh_");
  if (!kind) return null;
  if (!isObj(body.data) && !Array.isArray(body.data)) return null;
  const reasons = [`${prefixed(body.id, "wh_") ? "id" : "token"} is a wh_ webhook id`];
  let score = kind === "strict" ? 0.35 : 0.25;
  const type = typeof body.type === "string" ? body.type : undefined;
  if (type && (type in EVENT_TYPES || WALLET_EVENT_TYPES.has(type))) {
    score += 0.2;
    reasons.push(`type ${type} is a documented webhook type`);
  } else if (type && UPPER_SNAKE.test(type)) {
    score += 0.1;
  }
  if (operationId(body.trigger_operation_id)) {
    score += 0.2;
    reasons.push("has trigger_operation_id");
  }
  const ext = body.extended_timestamp;
  if (typeof ext === "number" && ext >= 1e12 && ext < 1e13) {
    score += 0.15;
    reasons.push("extended_timestamp in milliseconds");
  }
  if (typeof body.status === "string" && (body.status in WEBHOOK_STATUSES || body.status === ""))
    score += 0.05;
  if (Array.isArray(body.attempts) || "next_attempt_at" in body) {
    score += 0.1;
    reasons.push("has delivery attempt fields");
  }
  if (hasRapydObject(body.data)) score += 0.1;
  return { score, reasons };
}

function wrapperBody(input: Obj): Obj | undefined {
  return isObj(input.body) && isObj(input.headers) ? input.body : undefined;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  // Rapyd sends and returns JSON only.
  if (meta?.format === "form" || !isObj(input)) return none;
  // Stripe payloads carry `object`; Rapyd payloads never do.
  if ("object" in input) return none;

  const env = envelopeScore(input);
  if (env) {
    const failed = isObj(input.status) && input.status.status === "ERROR";
    if (!failed && isTransfer(input.data)) {
      return {
        provider: PROVIDER,
        format: "rapyd.wallet_transfer",
        confidence: round(env.score),
        supported: false,
        reasons: [...env.reasons, "data is a transfer between Rapyd Wallets"],
        unsupportedReason:
          "Rapyd wallet transfers (between Rapyd Wallets) are recognized but not analyzed. They are not payments or payouts.",
      };
    }
    return {
      provider: PROVIDER,
      format: "rapyd.api_response",
      confidence: round(env.score),
      supported: true,
      reasons: env.reasons,
    };
  }

  const body = wrapperBody(input) ?? input;
  const wh = webhookScore(body);
  if (!wh) return none;
  const reasons = [...wh.reasons];
  let score = wh.score;
  if (body !== input) {
    score += 0.05;
    reasons.push("webhook body inside the documented HTTP client wrapper");
  }
  if (typeof body.type === "string" && WALLET_EVENT_TYPES.has(body.type)) {
    return {
      provider: PROVIDER,
      format: "rapyd.wallet_webhook",
      confidence: round(score),
      supported: false,
      reasons,
      unsupportedReason:
        "Rapyd wallet transaction webhooks are recognized but not analyzed. Wallet transfers are a separate lifecycle from payments and payouts.",
    };
  }
  return {
    provider: PROVIDER,
    format: "rapyd.webhook",
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function issues(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => `${prefix}${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
  meta?: RecordMeta,
): { ok: true; value: RapydParsed } | { ok: false; issues: string[] } {
  if (format === "rapyd.api_response") {
    const r = ApiResponse.safeParse(input);
    return r.success
      ? { ok: true, value: { kind: "api_response", value: r.data } }
      : { ok: false, issues: issues(r.error) };
  }
  if (format === "rapyd.webhook") {
    const body = isObj(input) ? wrapperBody(input) : undefined;
    const r = WebhookBody.safeParse(body ?? input);
    if (!r.success) return { ok: false, issues: issues(r.error, body ? "body." : "") };
    const headers = body && isObj(input) && isObj(input.headers) ? input.headers : undefined;
    const signaturePresent =
      (typeof headers?.signature === "string" && headers.signature !== "") ||
      meta?.http?.headers.signature !== undefined;
    const shape: WebhookShape = body
      ? "wrapper"
      : webhookId(r.data.id)
        ? "body"
        : "delivery_record";
    return { ok: true, value: { kind: "webhook", value: r.data, shape, signaturePresent } };
  }
  return { ok: false, issues: [`Unsupported Rapyd format "${format}".`] };
}

type Attr = [string, unknown];

function attrs(entries: Attr[]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type ObjectState = { stage: LifecycleStage; outcome: Outcome; known: boolean; status?: string };

const STATUS_TABLES: Record<ObjectKind, Readonly<Record<string, StateInfo>>> = {
  payment: PAYMENT_STATUSES,
  refund: REFUND_STATUSES,
  dispute: DISPUTE_STATUSES,
  payout: PAYOUT_STATUSES,
};

function stateOf(kind: ObjectKind, o: Obj): ObjectState {
  const status = typeof o.status === "string" && o.status.length <= 32 ? o.status : undefined;
  const info = lookup(STATUS_TABLES[kind], status);
  if (!info) return { stage: kind, outcome: "unknown", known: false, status };
  if (kind === "payment" && status === "ACT") {
    const next = lookup(NEXT_ACTIONS, word(o.next_action));
    if (next) return { stage: next.stage, outcome: next.outcome, known: true, status };
  }
  return { stage: info.stage, outcome: info.outcome, known: true, status };
}

type ObjectFields = {
  paymentReference?: string;
  relatedReference?: string;
  merchantReference?: string;
  amountMinor?: string;
  currency?: string;
  time?: string;
  attributes: Attr[];
};

function threeDs(o: Obj): Attr[] {
  const a = isObj(o.authentication_result) ? o.authentication_result : undefined;
  const short = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9._]{1,16}$/.test(v) ? v : undefined;
  return [
    ["threeDsResult", short(a?.result)],
    ["threeDsEci", short(a?.eci)],
    ["threeDsVersion", short(a?.version)],
  ];
}

/** Allowlisted fields of a payment, refund, payout or dispute. */
function objectFields(kind: ObjectKind | undefined, o: Obj): ObjectFields {
  if (kind === "payment") {
    const currency = upperCurrency(o.currency_code);
    const status = word(o.status);
    return {
      paymentReference: paymentId(o.id),
      merchantReference: merchantRef(o.merchant_reference_id),
      amountMinor: amountOf(o.amount, currency),
      currency,
      // paid_at is the time of the last capture.
      time: (status === "CLO" ? unixTime(o.paid_at) : undefined) ?? unixTime(o.created_at),
      attributes: [
        ["objectType", "payment"],
        ["nextAction", word(o.next_action)],
        ["paymentMethodType", word(o.payment_method_type)],
        ["paymentMethodTypeCategory", word(o.payment_method_type_category)],
        ["captured", bool(o.captured)],
        ["paid", bool(o.paid)],
        ["isPartial", bool(o.is_partial)],
        ["refunded", bool(o.refunded)],
        ["refundedAmountMinor", amountOf(o.refunded_amount, currency)],
        ["initiationType", word(o.initiation_type)],
        ["errorCode", codeAttr(o.error_code)],
        ["failureCode", shortCode(o.failure_code)],
        ["failureMessage", safeText(o.failure_message, 200)],
        ["merchantAdviceCode", shortCode(o.merchant_advice_code)],
        ["merchantAdviceMessage", safeText(o.merchant_advice_message, 200)],
        ["cancelReason", word(o.cancel_reason)],
        ...threeDs(o),
        ["disputed", isObj(o.dispute) ? true : undefined],
      ],
    };
  }
  if (kind === "refund") {
    const currency = upperCurrency(o.currency);
    const reason = word(o.failure_reason);
    return {
      paymentReference: paymentId(o.payment),
      relatedReference: refundId(o.id),
      merchantReference: merchantRef(o.merchant_reference_id),
      amountMinor: amountOf(o.amount, currency),
      currency,
      time: unixTime(o.updated_at) ?? unixTime(o.created_at),
      attributes: [
        ["objectType", "refund"],
        ["failureReason", reason],
        [
          "failureReasonDocumented",
          reason ? lookup(REFUND_FAILURE_REASONS, reason) !== undefined : undefined,
        ],
        ["failureCode", shortCode(o.failure_code)],
        ["proportionalRefund", bool(o.proportional_refund)],
        ["paymentMethodType", word(o.payment_method_type)],
      ],
    };
  }
  if (kind === "payout") {
    const currency = upperCurrency(o.payout_currency);
    const senderCurrency = upperCurrency(o.sender_currency);
    return {
      paymentReference: payoutId(o.id),
      merchantReference: merchantRef(o.merchant_reference_id),
      amountMinor: amountOf(o.payout_amount, currency),
      currency,
      time: unixTime(o.created_at),
      attributes: [
        ["objectType", "payout"],
        ["payoutMethodType", word(o.payout_method_type)],
        ["senderCurrency", senderCurrency],
        ["senderAmountMinor", amountOf(o.sender_amount, senderCurrency)],
        ["paidAmountMinor", amountOf(o.paid_amount, currency)],
        ["errorCode", codeAttr(o.error)],
        ["gcErrorCode", codeAttr(o.gc_error_code)],
      ],
    };
  }
  if (kind === "dispute") {
    return {
      paymentReference: paymentId(o.original_transaction_id),
      relatedReference: disputeId(o.token),
      merchantReference: merchantRef(o.merchant_reference_id),
      attributes: [
        ["objectType", "dispute"],
        ["disputeCategory", safeText(o.dispute_category, 64)],
        ["disputeReasonDescription", safeText(o.dispute_reason_description, 200)],
        ["preDispute", bool(o.pre_dispute)],
      ],
    };
  }
  return { attributes: [["objectType", "unknown"]] };
}

type Item = { obj: Obj; path: string };

const MAX_ITEMS = 500;

function itemsOf(data: unknown, path: string): Item[] {
  if (Array.isArray(data))
    return data
      .slice(0, MAX_ITEMS)
      .flatMap((obj, i) => (isObj(obj) ? [{ obj, path: `${path}[${i}]` }] : []));
  return isObj(data) ? [{ obj: data, path }] : [];
}

function normalizeApiResponse(v: ApiResponseValue, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const st = v.status;
  const httpStatus = ctx.meta?.http?.status;
  const envAttrs: Attr[] = [
    ["envelopeStatus", st.status],
    ["operationId", operationId(st.operation_id)],
    ["httpStatus", httpStatus],
  ];
  if (isWebhookRecord(v.data)) {
    const record = WebhookBody.safeParse(v.data);
    if (record.success)
      return normalizeWebhook(record.data, "api_record", false, ctx, "data", envAttrs);
  }
  const failed = st.status === "ERROR";
  const events = itemsOf(v.data, "data").flatMap(({ obj, path }): NormalizedEventDraft[] => {
    const kind = classify(obj);
    if (!kind) return [];
    const state = stateOf(kind, obj);
    const f = objectFields(kind, obj);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `${kind}.${safeText(state.status, 32) ?? "unknown"}`,
        eventTypeKnown: state.known,
        stage: state.stage,
        providerStatus: state.status,
        paymentReference: f.paymentReference,
        relatedReference: f.relatedReference,
        merchantReference: f.merchantReference,
        eventTimestamp: f.time,
        amountMinor: f.amountMinor,
        currency: f.currency,
        outcome: state.outcome,
        attributes: attrs([
          ...f.attributes,
          ...envAttrs,
          ["responseErrorCode", failed ? codeAttr(st.error_code) : undefined],
        ]),
        source: { recordIndex: ctx.recordIndex, path },
        ...observed,
      }),
    ];
  });
  if (events.length) return events;

  // An error without an object, a response without data, or an object this
  // adapter does not analyze (customers, wallets, checkout pages and others).
  const known = failed || v.data === undefined || v.data === null;
  const ec = codeAttr(st.error_code);
  const rc = codeAttr(st.response_code);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: failed ? "api_error" : "api_response",
      eventTypeKnown: known,
      stage: failed ? "error" : "other",
      providerStatus: st.status,
      outcome: failed ? "failure" : st.status === "SUCCESS" ? "success" : "unknown",
      attributes: attrs([
        ...envAttrs,
        ["errorCode", ec],
        ["responseCode", rc !== ec ? rc : undefined],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...observed,
    }),
  ];
}

function webhookTime(w: WebhookValue): string | undefined {
  return unixTime(w.extended_timestamp) ?? unixTime(w.created_at);
}

/**
 * Delivery key: the wh_ id, which a resent webhook keeps (the Resend Webhook
 * sample returns the same id with status RET). Every recognized webhook has
 * one. Items of a webhook whose data is a list get their own key.
 */
function deliveryKeyOf(whId: string | undefined, index: number, count: number) {
  return whId && count > 1 ? `${whId}#${index}` : whId;
}

function normalizeWebhook(
  w: WebhookValue,
  shape: WebhookShape,
  signaturePresent: boolean,
  ctx: NormalizeContext,
  basePath: string,
  extra: Attr[] = [],
): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const info = lookup(EVENT_TYPES, w.type);
  const dataPath = basePath ? `${basePath}.data` : "data";
  const items = itemsOf(w.data, dataPath);
  const list: (Item | undefined)[] = items.length ? items : [undefined];
  const whId = webhookId(w.id) ?? webhookId(w.token);
  const notificationTime = webhookTime(w);
  const webhookStatus =
    typeof w.status === "string" && w.status in WEBHOOK_STATUSES ? w.status : undefined;
  const attempts = Array.isArray((w as Obj).attempts)
    ? ((w as Obj).attempts as unknown[])
    : undefined;
  return list.map((item, i) => {
    const obj = item?.obj;
    const kind = obj ? classify(obj, info?.object) : info?.object;
    const state = kind && obj ? stateOf(kind, obj) : undefined;
    const f = obj ? objectFields(kind, obj) : { attributes: [] as Attr[] };
    return clean({
      sourceFormat: ctx.format,
      eventType: safeText(w.type, 128) ?? "unknown",
      eventTypeKnown: Boolean(info),
      stage: info?.stage ?? state?.stage ?? (kind ? kind : "other"),
      providerStatus: state?.status,
      eventReference: whId,
      deliveryKey: deliveryKeyOf(whId, i, list.length),
      paymentReference: f.paymentReference,
      relatedReference: f.relatedReference,
      merchantReference: f.merchantReference,
      // The webhook time is when the state change was reported; the object's
      // created_at is when the payment or payout was created.
      eventTimestamp: notificationTime ?? f.time,
      amountMinor: f.amountMinor,
      currency: f.currency,
      outcome: info ? (state?.known ? state.outcome : info.outcome) : "unknown",
      attributes: attrs([
        ...f.attributes,
        ["webhookShape", shape],
        ["webhookStatus", webhookStatus],
        ["triggerOperationId", operationId(w.trigger_operation_id)],
        ["notificationCreatedAt", notificationTime],
        ["deliveryAttempts", attempts ? attempts.length : undefined],
        [
          "signaturePresent",
          shape === "wrapper" || signaturePresent ? signaturePresent : undefined,
        ],
        ...extra,
      ]),
      source: { recordIndex: ctx.recordIndex, path: item?.path ?? basePath },
      ...observed,
    });
  });
}

function normalize(parsed: RapydParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "api_response") return normalizeApiResponse(parsed.value, ctx);
  return normalizeWebhook(
    parsed.value,
    parsed.shape,
    parsed.signaturePresent,
    ctx,
    parsed.shape === "wrapper" ? "body" : "",
  );
}

/* ------------------------------------------------------------------------ */
/* Error decoding                                                            */
/* ------------------------------------------------------------------------ */

type Loc = {
  sourceFormat: string;
  source: SourceLocation;
  paymentReference?: string;
  attemptReference?: string;
};

type DecodeOptions = {
  loc: Loc;
  /** Field that carried the code. */
  field: string;
  message?: string;
  /** Highest confidence allowed, with the reason. */
  cap?: { confidence: Confidence; reason: string };
  /** Payment failure_code next to the code. */
  failureCode?: string;
  advice?: { code: string; message?: string };
  httpStatus?: number;
  /** The object in the same record shows a final failure. */
  objectFailed?: boolean;
  /** A bare failure_code may be a card network code. */
  allowNetwork?: boolean;
};

const CONFIDENCE_ORDER: Confidence[] = ["insufficient", "possible", "strong", "confirmed"];
const minConfidence = (a: Confidence, b: Confidence) =>
  CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b;

// From least to most restrictive; advice codes only make guidance stricter.
const RETRY_ORDER: RetryGuidance[] = [
  "unknown",
  "safe_to_retry_technical_request",
  "retry_conditionally",
  "customer_action_required",
  "manual_review",
  "do_not_retry",
];
const stricter = (a: RetryGuidance, b: RetryGuidance) =>
  RETRY_ORDER.indexOf(b) > RETRY_ORDER.indexOf(a);

/** Network codes 00, 08 and 11 read "Success" and 10 "Partial approval", yet Rapyd lists them as errors. */
const SUCCESS_LISTED_AS_ERROR = new Set(["00", "08", "10", "11"]);

type Resolved = {
  code: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  retryNotes: string[];
  docs: DocumentationLink[];
  missing: string[];
  subCodes: Record<string, string>;
  outcomeKnown?: boolean;
};

function pushDoc(docs: DocumentationLink[], doc: DocumentationLink) {
  if (!docs.some((d) => d.url === doc.url)) docs.push(doc);
}

function fromEntries(code: string, entries: readonly CodeEntry[]): Resolved {
  const first = entries[0]!;
  const categories = new Set(entries.map((e) => e.category));
  const retries = new Set(entries.map((e) => e.retry));
  const agree = categories.size === 1 && retries.size === 1;
  const meanings = [...new Set(entries.map((e) => e.meaning))];
  const docs: DocumentationLink[] = [];
  for (const e of entries) {
    const s = SECTIONS[e.section];
    pushDoc(
      docs,
      e.section === "example"
        ? { title: "Rapyd documentation sample", url: lookup(EXAMPLE_SOURCES, code) ?? s.url }
        : { title: s.title, url: s.url },
    );
  }
  const missing: string[] = [];
  let explanation: string;
  if (meanings.length === 1) {
    explanation = `${code}: ${first.meaning}.`;
  } else if (agree) {
    explanation = `${code} appears in several Rapyd error tables: ${entries
      .map((e) => `${e.meaning} (${SECTIONS[e.section].title.replace(/^Rapyd /, "")})`)
      .join("; ")}.`;
  } else {
    explanation = `Rapyd lists ${code} with ${meanings.length} different meanings: ${meanings.join("; ")}. The supplied data does not show which one applies.`;
    missing.push(`Rapyd documents more than one meaning for ${code}.`);
  }
  let confidence: Confidence = agree ? "strong" : "possible";
  if (entries.every((e) => e.section === "example")) {
    confidence = "possible";
    explanation +=
      " This code appears only in a Rapyd documentation sample, not in an error table.";
  }
  if (entries.some((e) => e.section === "simulated")) {
    explanation +=
      " Rapyd documents this code for sandbox error simulation; Rapyd notes that sandbox and production codes can differ.";
  }
  return {
    code,
    category: categories.size === 1 ? first.category : "unknown",
    retry: retries.size === 1 ? first.retry : "manual_review",
    confidence,
    explanation,
    retryNotes: [],
    docs,
    missing,
    subCodes: {},
  };
}

function networkMeaning(e: NetworkEntry): string {
  return `${e.meaning}${e.scheme ? ` (${e.scheme} row)` : ""}`;
}

/** Decodes a card network code (the bracket suffix or the payment failure_code). */
function fromNetwork(code: string, entries: readonly NetworkEntry[], base: string): Resolved {
  const first = entries[0]!;
  const categories = new Set(entries.map((e) => e.category));
  const retries = new Set(entries.map((e) => e.retry));
  const agree = categories.size === 1 && retries.size === 1;
  const docs: DocumentationLink[] = [
    { title: "Rapyd card network errors", url: CARD_NETWORK_ERRORS_URL },
  ];
  const missing: string[] = [];
  let explanation: string;
  let confidence: Confidence = "strong";
  if (entries.length === 1) {
    explanation = `${base}: card network code ${code}, ${networkMeaning(first)}.`;
  } else {
    explanation = `${base}: Rapyd lists card network code ${code} more than once: ${entries
      .map(networkMeaning)
      .join("; ")}. The supplied data does not show which row applies.`;
    missing.push(
      `Card network code ${code} has several rows; the card scheme or table is not known from the supplied data.`,
    );
    if (!agree) confidence = "possible";
  }
  if (entries.some((e) => e.table === "payout_eligibility"))
    explanation += " This code is in Rapyd's card eligibility table for payouts to cards.";
  if (entries.some((e) => e.table === "other"))
    explanation +=
      " For codes in the other errors table Rapyd asks the cardholder to contact the issuing bank with this code.";
  if (SUCCESS_LISTED_AS_ERROR.has(code)) {
    confidence = "possible";
    explanation +=
      " The network's short message for this code is a success or partial approval, yet Rapyd lists it as an error; check the payment status.";
  }
  return {
    code: base,
    category: categories.size === 1 ? first.category : "unknown",
    retry: retries.size === 1 ? first.retry : "manual_review",
    confidence,
    explanation,
    retryNotes: [],
    docs,
    missing,
    subCodes: { network_code: code },
    // The card network answered, so the payment's outcome is known.
    outcomeKnown: true,
  };
}

function unknownCode(code: string, httpStatus: number | undefined): Resolved {
  const http = httpStatus !== undefined ? lookup(HTTP_STATUS, httpStatus) : undefined;
  const display = safeText(code, 120) ?? "unknown";
  const missing = [
    code === "ERROR"
      ? "The response has status ERROR but no error_code."
      : `Error code "${display}" is not in Rapyd's documented error tables or the PandaPayLens catalog.`,
  ];
  const docs: DocumentationLink[] = [{ title: "Rapyd error messages", url: ERROR_MESSAGES_URL }];
  if (httpStatus === 429)
    pushDoc(docs, { title: "Rapyd request rate limits", url: RATE_LIMITS_URL });
  if (http) {
    return {
      code: display,
      category: http.category,
      retry: http.retry,
      confidence: "possible",
      explanation: `The code is not documented; the HTTP status ${httpStatus} (${http.meaning}) gives only the general category.`,
      retryNotes: [],
      docs,
      missing,
      subCodes: {},
    };
  }
  return {
    code: display,
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: "PandaPayLens does not recognize this Rapyd error code.",
    retryNotes: [],
    docs,
    missing,
    subCodes: {},
  };
}

function resolve(raw: string, opts: DecodeOptions): Resolved {
  const { base, suffix } = splitCode(raw);
  const key = base.replace(/\s+/g, "");
  const entries = lookup(ERROR_CODES, key);
  if (key === "ERROR_PROCESSING_CARD") {
    const fromSuffix = suffix ? shortCode(suffix) : undefined;
    const net = fromSuffix ?? opts.failureCode;
    const netEntries = net ? lookup(NETWORK_CODES, net) : undefined;
    if (net && netEntries) {
      const r = fromNetwork(net, netEntries, key);
      if (fromSuffix && opts.failureCode && fromSuffix !== opts.failureCode) {
        r.confidence = minConfidence(r.confidence, "possible");
        r.missing.push(
          `The network code in the error code (${fromSuffix}) differs from failure_code (${safeText(opts.failureCode, 40)}).`,
        );
      }
      return r;
    }
    const r = fromEntries(key, entries ?? []);
    r.confidence = "possible";
    r.retry = "unknown";
    if (net) r.subCodes.network_code = safeText(net, 40) ?? "";
    r.missing.push(
      net
        ? `Card network code "${safeText(net, 40)}" is not in Rapyd's card network tables.`
        : "No card network code was supplied, so the reason for the refusal is unknown.",
    );
    pushDoc(r.docs, { title: "Rapyd card network errors", url: CARD_NETWORK_ERRORS_URL });
    return r;
  }
  if (entries) {
    const r = fromEntries(key, entries);
    if (suffix) r.subCodes.detail = safeText(suffix, 120) ?? "";
    return r;
  }
  if (opts.allowNetwork) {
    const net = shortCode(raw);
    const netEntries = net ? lookup(NETWORK_CODES, net) : undefined;
    if (net && netEntries) {
      const r = fromNetwork(net, netEntries, net);
      r.code = net;
      r.confidence = minConfidence(r.confidence, "possible");
      r.missing.push(
        "failure_code was supplied without ERROR_PROCESSING_CARD; Rapyd also uses failure_code for bank transfer reasons and sandbox codes, so the card network meaning is not certain.",
      );
      return r;
    }
  }
  return unknownCode(base || "ERROR", opts.httpStatus);
}

function applyAdvice(r: Resolved, advice: DecodeOptions["advice"]) {
  if (!advice) return;
  r.subCodes.merchant_advice_code = advice.code;
  const a = lookup(MERCHANT_ADVICE_CODES, advice.code);
  if (!a) {
    r.missing.push(`Merchant advice code "${safeText(advice.code, 20)}" is not documented.`);
    return;
  }
  pushDoc(r.docs, { title: "Rapyd merchant advice codes", url: MERCHANT_ADVICE_CODES_URL });
  if (a.retry === "unknown") {
    r.retryNotes.push(`Merchant advice code ${advice.code} is informational: ${a.meaning}.`);
    return;
  }
  const wait = lookup(ADVICE_WAIT, advice.code);
  r.retryNotes.push(
    `Merchant advice code ${advice.code}: ${a.meaning}${wait ? `; a new attempt makes sense only ${wait}` : ""}.`,
  );
  // Advice codes make the guidance stricter, never looser.
  if (r.retry === "unknown" || stricter(r.retry, a.retry)) r.retry = a.retry;
}

function decodeCode(raw: string, opts: DecodeOptions): DecodedErrorDraft {
  const r = resolve(raw, opts);
  applyAdvice(r, opts.advice);
  let confidence = r.confidence;
  if (opts.cap) {
    confidence = minConfidence(confidence, opts.cap.confidence);
    r.missing.push(opts.cap.reason);
  }
  const subCodes: Record<string, string> = { field: opts.field, ...r.subCodes };
  if (opts.failureCode && !r.subCodes.network_code)
    subCodes.failure_code = safeText(opts.failureCode, 40) ?? "";
  if (r.retry === "retry_conditionally" || r.category === "duplicate_request")
    pushDoc(r.docs, { title: "Rapyd idempotency", url: IDEMPOTENCY_URL });
  if (!opts.loc.paymentReference)
    r.missing.push(
      "No payment, refund or payout id in this record; the object's later state cannot be checked from it.",
    );
  const retryExplanation = [...r.retryNotes, RETRY_TEXT[r.retry]].join(" ");
  const message = safeText(opts.message, 500);
  const outcomeKnown = r.outcomeKnown || opts.objectFailed;
  return {
    sourceFormat: opts.loc.sourceFormat,
    source: opts.loc.source,
    ...(opts.loc.paymentReference ? { paymentReference: opts.loc.paymentReference } : {}),
    ...(opts.loc.attemptReference ? { attemptReference: opts.loc.attemptReference } : {}),
    code: r.code,
    subCodes,
    category: r.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: r.explanation,
    nextAction: NEXT_ACTION[r.category],
    retry: r.retry,
    retryExplanation,
    confidence,
    documentation: r.docs,
    missingInformation: r.missing,
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

/** An object that failed without any code. */
function statusOnlyError(
  kind: ObjectKind,
  status: string,
  loc: Loc,
  extra: { failureCode?: string } = {},
): DecodedErrorDraft {
  const info = lookup(STATUS_TABLES[kind], status);
  const refundNotClosed = kind === "refund" && status === "Error";
  const category: ErrorCategory = refundNotClosed ? "invalid_request" : "unknown";
  const retry: RetryGuidance = refundNotClosed ? "retry_conditionally" : "manual_review";
  const docs: DocumentationLink[] =
    kind === "refund"
      ? [{ title: "Rapyd refunds", url: REFUND_URL }]
      : kind === "payout"
        ? [{ title: "Rapyd payouts", url: PAYOUT_URL }]
        : [{ title: "Rapyd Create Payment error examples", url: CREATE_PAYMENT_ERRORS_URL }];
  const missing = ["No error code was supplied, so only the status is known."];
  const subCodes: Record<string, string> = { field: "status" };
  if (extra.failureCode) {
    subCodes.failure_code = safeText(extra.failureCode, 40) ?? "";
    missing.push("Rapyd does not document the values of the refund failure_code.");
  }
  return {
    sourceFormat: loc.sourceFormat,
    source: loc.source,
    ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
    ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
    code: safeText(status, 32) ?? "unknown",
    subCodes,
    category,
    explanation: `${kind[0]!.toUpperCase()}${kind.slice(1)} status ${status}: ${info?.meaning ?? "not documented"}.${
      refundNotClosed ? " A refund is possible only once the payment is closed (CLO)." : ""
    }`,
    nextAction: refundNotClosed
      ? "Check that the payment is closed before creating the refund again."
      : NEXT_ACTION.unknown,
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence: refundNotClosed ? "possible" : "insufficient",
    documentation: docs,
    missingInformation: missing,
    outcomeKnown: true,
  };
}

const GC_CAP = {
  confidence: "possible" as Confidence,
  reason:
    "Rapyd documents gc_error_code as reserved, although its samples carry the payout error there; the code is decoded as a possibility only.",
};

function paymentRefOf(kind: ObjectKind, o: Obj): string | undefined {
  return objectFields(kind, o).paymentReference;
}

/** Errors carried by one payment, refund or payout (webhook data or REST data). */
function objectErrors(
  kind: ObjectKind | undefined,
  o: Obj,
  loc: Omit<Loc, "paymentReference">,
): DecodedErrorDraft[] {
  if (!kind || kind === "dispute") return [];
  const state = stateOf(kind, o);
  const at: Loc = { ...loc, paymentReference: paymentRefOf(kind, o) };
  const failed = state.outcome === "failure";

  if (kind === "payment") {
    const code = codeValue(o.error_code);
    const failure = shortCode(o.failure_code);
    const adviceCode = shortCode(o.merchant_advice_code);
    const advice = adviceCode
      ? { code: adviceCode, message: safeText(o.merchant_advice_message, 200) }
      : undefined;
    const ended = failed || state.status === "REV";
    const base = {
      loc: at,
      objectFailed: ended,
      advice,
      message: safeText(o.failure_message, 200),
    };
    if (code) return [decodeCode(code, { ...base, field: "error_code", failureCode: failure })];
    if (ended && failure)
      return [decodeCode(failure, { ...base, field: "failure_code", allowNetwork: true })];
    return state.status === "ERR" ? [statusOnlyError("payment", "ERR", at)] : [];
  }

  if (!failed) return [];

  if (kind === "refund") {
    const reason = word(o.failure_reason);
    const entry =
      reason && reason !== "unknown" ? lookup(REFUND_FAILURE_REASONS, reason) : undefined;
    const failureCode = shortCode(o.failure_code);
    if (reason && entry) {
      return [
        {
          sourceFormat: at.sourceFormat,
          source: at.source,
          ...(at.paymentReference ? { paymentReference: at.paymentReference } : {}),
          ...(at.attemptReference ? { attemptReference: at.attemptReference } : {}),
          code: reason,
          subCodes: {
            field: "failure_reason",
            ...(failureCode ? { failure_code: failureCode } : {}),
            ...(state.status ? { status: state.status } : {}),
          },
          category: entry.category,
          explanation: `Refund failure_reason ${reason}: ${entry.meaning}. The refund cannot go back to this card.`,
          nextAction:
            "Arrange the refund to the customer in another way; the original card cannot receive it.",
          retry: entry.retry,
          retryExplanation: RETRY_TEXT[entry.retry],
          confidence: "possible",
          documentation: [{ title: "Rapyd refunds", url: REFUND_URL }],
          missingInformation: [
            "Rapyd lists the failure_reason values without describing what follows from them; the guidance is a PandaPayLens suggestion.",
          ],
          outcomeKnown: true,
        },
      ];
    }
    return [statusOnlyError("refund", state.status ?? "unknown", at, { failureCode })];
  }

  // Payout: `error` is the documented field, `gc_error_code` is reserved.
  const error = codeValue(o.error);
  const gc = codeValue(o.gc_error_code);
  const out: DecodedErrorDraft[] = [];
  if (error) out.push(decodeCode(error, { loc: at, field: "error", objectFailed: true }));
  if (gc && (!error || splitCode(gc).base !== splitCode(error).base))
    out.push(decodeCode(gc, { loc: at, field: "gc_error_code", objectFailed: true, cap: GC_CAP }));
  if (!out.length) out.push(statusOnlyError("payout", state.status ?? "unknown", at));
  return out;
}

function sameCode(a: string, b: string): boolean {
  return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
}

function apiResponseErrors(v: ApiResponseValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const st = v.status;
  const httpStatus = ctx.meta?.http?.status;
  const op = operationId(st.operation_id);
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const out: DecodedErrorDraft[] = [];
  const ec = codeValue(st.error_code);
  const rc = codeValue(st.response_code);
  const items = itemsOf(v.data, "data");

  if (st.status === "ERROR" || ec || rc) {
    // Create Payment errors carry the PAYMENT_FAILED webhook data in `data`.
    const first = items.find((i) => classify(i.obj));
    const kind = first ? classify(first.obj) : undefined;
    const obj = first?.obj;
    const payment = kind === "payment" ? obj : undefined;
    const failureCode = payment ? shortCode(payment.failure_code) : undefined;
    const adviceCode = payment ? shortCode(payment.merchant_advice_code) : undefined;
    const base = {
      loc: {
        sourceFormat: ctx.format,
        source,
        ...(kind && obj ? { paymentReference: paymentRefOf(kind, obj) } : {}),
        ...(op ? { attemptReference: op } : {}),
      },
      message: st.message ?? undefined,
      httpStatus,
      failureCode,
      advice: adviceCode
        ? { code: adviceCode, message: safeText(payment?.merchant_advice_message, 200) }
        : undefined,
      objectFailed: kind && obj ? stateOf(kind, obj).outcome === "failure" : undefined,
    };
    if (ec && rc && !sameCode(ec, rc)) {
      const cap = {
        confidence: "possible" as Confidence,
        reason:
          "error_code and response_code differ, although Rapyd documents them as the same value; both are shown.",
      };
      out.push(decodeCode(ec, { ...base, field: "status.error_code", cap }));
      out.push(
        decodeCode(rc, {
          ...base,
          loc: { ...base.loc, source: { ...source, path: "status.response_code" } },
          field: "status.response_code",
          cap,
        }),
      );
    } else {
      const code = ec ?? rc ?? (payment ? codeValue(payment.error_code) : undefined) ?? "ERROR";
      out.push(
        decodeCode(code, {
          ...base,
          field: ec ? "status.error_code" : rc ? "status.response_code" : "status.status",
        }),
      );
    }
    if (isWebhookRecord(v.data)) out.push(...webhookRecordErrors(v.data, ctx, "data"));
    return out;
  }

  if (isWebhookRecord(v.data)) return webhookRecordErrors(v.data, ctx, "data");
  for (const { obj, path } of items) {
    out.push(
      ...objectErrors(classify(obj), obj, {
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path },
        ...(op ? { attemptReference: op } : {}),
      }),
    );
  }
  return out;
}

function webhookRecordErrors(
  record: Obj,
  ctx: NormalizeContext,
  path: string,
): DecodedErrorDraft[] {
  const r = WebhookBody.safeParse(record);
  return r.success ? webhookErrors(r.data, ctx, path) : [];
}

function webhookErrors(
  w: WebhookValue,
  ctx: NormalizeContext,
  basePath: string,
): DecodedErrorDraft[] {
  const info = lookup(EVENT_TYPES, w.type);
  const op = operationId(w.trigger_operation_id);
  return itemsOf(w.data, basePath ? `${basePath}.data` : "data").flatMap(({ obj, path }) =>
    objectErrors(classify(obj, info?.object), obj, {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path },
      ...(op ? { attemptReference: op } : {}),
    }),
  );
}

function decodeErrors(parsed: RapydParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "api_response") return apiResponseErrors(parsed.value, ctx);
  return webhookErrors(parsed.value, ctx, parsed.shape === "wrapper" ? "body" : "");
}

export const rapydAdapter: ProviderAdapter<RapydParsed> = {
  id: PROVIDER,
  displayName: "Rapyd",
  version: RAPYD_ADAPTER_VERSION,
  manifest: rapydManifest,
  supportedFormats: [
    {
      id: "rapyd.api_response",
      description:
        "Merchant API REST response (status object with error_code, status, message, response_code, operation_id; payment, refund, payout or dispute in data)",
    },
    {
      id: "rapyd.webhook",
      description:
        "Payment, refund, dispute and payout webhook (id wh_, type, data, trigger_operation_id), also inside the HTTP client wrapper or as a delivery record",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Payment ids link a payment with its refunds and disputes (refund
    // `payment`, dispute `original_transaction_id`); refund, dispute and payout
    // ids link a REST response with its webhooks. Operation ids and
    // merchant_reference_id are never keys.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default rapydAdapter;
