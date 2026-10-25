/**
 * EBANX adapter (Pay-in Direct API, payment notifications, Payout API).
 *
 * Supported input families:
 * - `ebanx.payin_response`        JSON response of /ws/direct, /ws/query, /ws/capture,
 *                                 /ws/cancel and /ws/refund: status SUCCESS with the
 *                                 payment object (status OP, PE, CO or CA, transaction_status,
 *                                 refunds, chargeback, claims)
 * - `ebanx.payin_error`           error envelope: status ERROR, status_code, status_message
 * - `ebanx.payment_notification`  form post with operation payment_status_change,
 *                                 notification_type and hash_codes
 * - `ebanx.payout_response`       Payout API JSON (type with a payout object or an HP-* error)
 * - `ebanx.payout_notification`   form post with operation payout_status_* and hash_codes
 *
 * Recognized but not analyzed: enrollment notifications.
 *
 * A payment notification carries no status, amount, time or event id. It is
 * a signal to call /ws/query, so it is shown with outcome unknown. A
 * successful envelope (status SUCCESS) can describe a declined or cancelled
 * payment: the outcome comes from payment.status.
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
} from "@pandapaylens/core";
import { z } from "zod";
import {
  API_ERRORS_URL,
  APM_DESCRIPTION_CODES,
  APM_ERRORS_URL,
  BRAND_MANDATE_CATEGORIES,
  CARD_DESCRIPTION_CODES,
  CARD_ERRORS_URL,
  CARD_RESPONSE_DESCRIPTIONS,
  CHARGEBACK_REASONS,
  CHARGEBACK_URL,
  CONFLICTING_CODES,
  CREDIT_CARDS_URL,
  DISPUTE_STATUSES,
  ECI_VALUES,
  ENROLLMENT_NOTIFICATION_OPERATION,
  EVIDENCE_HTTP_STATUS,
  ISO8583_CODES,
  ISO8583_URL,
  MAC_CODES,
  MED_CLAIM_REASONS,
  NEXT_ACTION,
  NOTIFICATION_TYPES,
  PAYIN_ERROR_CODES,
  PAYIN_OPENAPI_URL,
  PAYMENT_NOTIFICATION_OPERATION,
  PAYMENT_STATUSES,
  PAYOUT_BALANCE_CODES,
  PAYOUT_ERROR_CODES,
  PAYOUT_ERRORS_URL,
  PAYOUT_NOTIFICATION_OPERATIONS,
  PAYOUT_RESPONSE_TYPES,
  PAYOUT_STATUSES,
  PIX_AUTOMATICO_ERRORS_URL,
  REFUND_DECLINE_CODES,
  REFUND_STATUSES,
  RETRY_TEXT,
  SYSTEM_FAILURES_URL,
  THREE_DS_LIABILITY,
  THREE_DS_STATUSES,
  TRANSACTION_STATUS_CODES,
  type AlternativeMeaning,
  type CodeEntry,
  type CodeSource,
  type DescriptionEntry,
} from "./catalog.js";
import { ebanxManifest, EBANX_ADAPTER_VERSION } from "./manifest.js";

export { ebanxManifest, EBANX_ADAPTER_VERSION };

const PROVIDER = "ebanx";

export const EBANX_FORMATS = {
  payinResponse: "ebanx.payin_response",
  payinError: "ebanx.payin_error",
  paymentNotification: "ebanx.payment_notification",
  payoutResponse: "ebanx.payout_response",
  payoutNotification: "ebanx.payout_notification",
  enrollmentNotification: "ebanx.enrollment_notification",
  payinRequest: "ebanx.payin_request",
} as const;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const own = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function strOf(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const nonEmpty = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** Form records: every value is a string, or a list of strings for a repeated key. */
function isFlatStrings(o: Obj): boolean {
  const values = Object.values(o);
  return (
    values.length > 0 &&
    values.length <= 1000 &&
    values.every(
      (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
    )
  );
}

/** Documentation templates such as {{YYYY-MM-DD HH:mm:ss}} or {{unique_payment_hash}}. */
const PLACEHOLDER = /^\{\{[^{}]{1,80}\}\}$/;
const isPlaceholder = (v: unknown) => typeof v === "string" && PLACEHOLDER.test(v.trim());

/**
 * EBANX payment hashes and payout uids. The documented examples are 47 to 49
 * lowercase hex characters; the length is not enforced.
 */
function hashOf(v: unknown): string | undefined {
  const t = nonEmpty(v);
  if (!t || isPlaceholder(t)) return undefined;
  return /^[0-9A-Za-z_-]{8,128}$/.test(t) ? t : undefined;
}

/** Merchant-assigned references: identifier-like and free of personal data. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? String(v) : undefined;
  const t = nonEmpty(v);
  if (!t || isPlaceholder(t)) return undefined;
  const id = safeId(t, 128);
  return id && safeText(id, 128) === id && !looksLikeTaxId(id) ? id : undefined;
}

/** Codes of documented vocabularies: identifier-like only, never free text. */
function codeOf(v: unknown, max = 64): string | undefined {
  const t = typeof v === "number" && Number.isFinite(v) ? String(v) : nonEmpty(v);
  return t !== undefined && t.length <= max && /^[0-9A-Za-z._/-]+$/.test(t) ? t : undefined;
}

function flag(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  const t = strOf(v)?.trim().toLowerCase();
  return t === "true" ? true : t === "false" ? false : undefined;
}

function intOf(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return v;
  const t = nonEmpty(v);
  return t && /^\d{1,6}$/.test(t) ? Number(t) : undefined;
}

/**
 * Tax ids, phone and account numbers that error messages can echo. Core
 * redaction already removes emails, IBANs and card numbers.
 */
const MESSAGE_SCRUB: RegExp[] = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, // CPF
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, // CNPJ
  /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/g, // RUT
  /(?<![\w.])\d{8,}(?![\w.])/g, // long digit runs (documents, phones, accounts)
];

function looksLikeTaxId(text: string): boolean {
  return MESSAGE_SCRUB.slice(0, 3).some((re) => new RegExp(re.source).test(text));
}

function scrubText(text: string): string {
  let out = text;
  for (const re of MESSAGE_SCRUB) out = out.replace(re, "[redacted]");
  return out;
}

function message(v: unknown, max = 300): string | undefined {
  const t = safeText(nonEmpty(v), max);
  return t ? scrubText(t) : undefined;
}

/**
 * EBANX dates are YYYY-MM-DD HH:mm:ss without a zone; the OpenAPI calls them
 * UTC. Date-only values are read as midnight UTC.
 */
function timeOf(v: unknown): string | undefined {
  const t = nonEmpty(v);
  if (!t || t.length > 40) return undefined;
  const dt = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?$/.exec(t);
  if (dt) return toIsoTimestamp(`${dt[1]}T${dt[2]}Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return toIsoTimestamp(`${t}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(t))
    return toIsoTimestamp(t);
  return undefined;
}

const round = (n: number) => Math.round(Math.min(0.95, n) * 100) / 100;

const PAYIN_CODE = /^(?:BP|DA|RP|RF|IPBP)-[A-Z0-9]{1,8}(?:-[A-Z0-9]{1,8}){0,2}$/;
const PAYOUT_CODE = /^(?:HP-[A-Z]{2}-\d{2}|BP-HI-\d{4})$/;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const base = { provider: PROVIDER, supported: true };

function detectNotification(o: Obj): DetectionResult | null {
  const op = nonEmpty(o.operation);
  const type = nonEmpty(o.notification_type);
  const hashes = own(o, "hash_codes");
  const typeKnown = type !== undefined && lookup(NOTIFICATION_TYPES, type) !== undefined;

  if (op === ENROLLMENT_NOTIFICATION_OPERATION && own(o, "merchant_enrollment_code")) {
    return {
      ...base,
      supported: false,
      format: EBANX_FORMATS.enrollmentNotification,
      confidence: type === "update" ? 0.85 : 0.75,
      reasons: ["operation is enrollment_status_change with merchant_enrollment_code"],
      unsupportedReason:
        "This looks like an EBANX enrollment notification. It carries only the enrollment code, so it is recognized but not analyzed; query the enrollment to see its status.",
    };
  }

  if (op !== undefined && lookup(PAYOUT_NOTIFICATION_OPERATIONS, op) !== undefined) {
    let c = 0.6;
    const reasons = [`operation is a documented payout notification value`];
    if (hashes) {
      c += 0.25;
      reasons.push("has hash_codes");
    }
    if (type === "update") {
      c += 0.1;
      reasons.push("notification_type is update");
    }
    return { ...base, format: EBANX_FORMATS.payoutNotification, confidence: round(c), reasons };
  }

  if (op === PAYMENT_NOTIFICATION_OPERATION) {
    if (!hashes && type === undefined) {
      return {
        ...base,
        format: EBANX_FORMATS.paymentNotification,
        confidence: 0.4,
        reasons: ["operation is payment_status_change without notification_type or hash_codes"],
      };
    }
    let c = 0.6;
    const reasons = ["operation is payment_status_change"];
    if (hashes) {
      c += 0.25;
      reasons.push("has hash_codes");
    }
    if (typeKnown) {
      c += 0.1;
      reasons.push("notification_type is a documented value");
    }
    return { ...base, format: EBANX_FORMATS.paymentNotification, confidence: round(c), reasons };
  }

  // A body without operation, but with the two other documented fields.
  if (op === undefined && hashes && typeKnown) {
    return {
      ...base,
      format: EBANX_FORMATS.paymentNotification,
      confidence: 0.6,
      reasons: ["has hash_codes and a documented notification_type, but no operation"],
    };
  }
  return null;
}

function detectPayin(o: Obj): DetectionResult | null {
  const p = o.payment;
  if (!isObj(p)) return null;
  const hash = typeof p.hash === "string";
  // Developers often paste the request next to the response.
  if (
    typeof p.merchant_payment_code === "string" &&
    !own(p, "status") &&
    (own(o, "integration_key") || own(p, "amount_total") || own(p, "currency_code"))
  ) {
    return {
      ...base,
      supported: false,
      format: EBANX_FORMATS.payinRequest,
      confidence: own(o, "integration_key") ? 0.7 : 0.55,
      reasons: ["payment object with merchant_payment_code and request fields, without a status"],
      unsupportedReason:
        "This looks like an EBANX pay-in request, not a response. Requests are not analyzed; paste the response (or a /ws/query response) instead. Requests contain card, customer and integration key data.",
    };
  }
  const mpc = typeof p.merchant_payment_code === "string";
  const approval = own(p, "pre_approved") || own(p, "capture_available");
  // A bare "hash" is common; one EBANX-specific field must accompany it.
  if (!(hash || mpc) || !(mpc || own(p, "amount_ext") || approval)) return null;
  let c = 0.3;
  const reasons = ["payment object with hash or merchant_payment_code"];
  if (o.status === "SUCCESS") {
    c += 0.2;
    reasons.push('top-level status is "SUCCESS"');
  }
  const status = strOf(p.status)?.trim();
  if (status && lookup(PAYMENT_STATUSES, status)) {
    c += 0.15;
    reasons.push("payment.status is OP, PE, CO or CA");
  }
  if (hash && mpc) {
    c += 0.1;
    reasons.push("has both hash and merchant_payment_code");
  }
  if (["amount_br", "amount_ext", "amount_iof"].filter((k) => own(p, k)).length >= 2) {
    c += 0.1;
    reasons.push("has the amount_br, amount_ext and amount_iof fields");
  }
  const ts = p.transaction_status;
  if (isObj(ts) && (own(ts, "acquirer") || own(ts, "description_code"))) {
    c += 0.05;
    reasons.push("has a transaction_status object");
  }
  if (approval) c += 0.05;
  if (own(p, "currency_ext")) c += 0.05;
  if (typeof p.payment_type_code === "string") c += 0.05;
  return { ...base, format: EBANX_FORMATS.payinResponse, confidence: round(c), reasons };
}

function detectPayinError(o: Obj): DetectionResult | null {
  if (o.status !== "ERROR") return null;
  const code = strOf(o.status_code)?.trim();
  if (!code || !PAYIN_CODE.test(code)) return null;
  let c = 0.6;
  const reasons = ['status is "ERROR" with a BP-, DA-, RP-, RF- or IPBP- status_code'];
  if (lookup(PAYIN_ERROR_CODES, code)) {
    c += 0.2;
    reasons.push("status_code is a documented EBANX code");
  }
  if (typeof o.status_message === "string" || typeof o.message === "string") {
    c += 0.1;
    reasons.push("has status_message");
  }
  return { ...base, format: EBANX_FORMATS.payinError, confidence: round(c), reasons };
}

function detectPayout(o: Obj): DetectionResult | null {
  const type = strOf(o.type);
  if (type === undefined || lookup(PAYOUT_RESPONSE_TYPES, type) === undefined) return null;
  const reasons = [`type is a documented Payout API value`];
  const payout = o.payout;
  if (isObj(payout) && (own(payout, "uid") || own(payout, "external_reference"))) {
    let c = 0.5;
    if (typeof payout.uid === "string") {
      c += 0.15;
      reasons.push("payout has uid");
    }
    if (typeof payout.external_reference === "string") {
      c += 0.1;
      reasons.push("payout has external_reference");
    }
    if (lookup(PAYOUT_STATUSES, strOf(payout.status)?.trim())) {
      c += 0.1;
      reasons.push("payout.status is a documented value");
    }
    if (["request_amount", "debit_amount_total", "local_amount_total"].some((k) => own(payout, k)))
      c += 0.1;
    return { ...base, format: EBANX_FORMATS.payoutResponse, confidence: round(c), reasons };
  }
  if (
    Array.isArray(o.payouts) &&
    o.payouts.length > 0 &&
    o.payouts.every((x) => isObj(x) && own(x, "uid"))
  ) {
    let c = 0.7;
    reasons.push("payouts array of objects with uid (search response)");
    if (own(o, "total_pages") || own(o, "records")) c += 0.1;
    return { ...base, format: EBANX_FORMATS.payoutResponse, confidence: round(c), reasons };
  }
  const sc = strOf(o.status_code)?.trim();
  const code = strOf(o.code)?.trim();
  const scOk = sc !== undefined && PAYOUT_CODE.test(sc);
  const codeOk = code !== undefined && PAYOUT_CODE.test(code);
  if (!scOk && !codeOk) return null;
  let c = scOk && codeOk && sc === code ? 0.8 : 0.6;
  reasons.push(
    scOk && codeOk && sc === code
      ? "status_code and code carry the same HP-* value"
      : "has an HP-* or BP-HI-* code",
  );
  const value = (scOk ? sc : code)!;
  if (lookup(PAYOUT_ERROR_CODES, value) || lookup(PAYOUT_BALANCE_CODES, value)) {
    c += 0.1;
    reasons.push("the code is a documented payout code");
  }
  return { ...base, format: EBANX_FORMATS.payoutResponse, confidence: round(c), reasons };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe payloads carry `object`; EBANX payloads never do.
  if ("object" in input) return none;
  if (isFlatStrings(input)) {
    const n = detectNotification(input);
    if (n) return n;
  }
  if (meta?.format === "form") return none;
  return detectPayin(input) ?? detectPayinError(input) ?? detectPayout(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const NStr = (max: number) => z.string().max(max).nullable().optional();
const Amount = z
  .union([z.string().max(64), z.number()])
  .nullable()
  .optional();
const Flag = z
  .union([z.boolean(), z.string().max(16)])
  .nullable()
  .optional();
const Code = z
  .union([z.string().max(64), z.number()])
  .nullable()
  .optional();

const TransactionStatus = z.looseObject({
  acquirer: NStr(128),
  code: NStr(64),
  description: NStr(4000),
  description_code: NStr(128),
  iso_code: Code,
  mac_code: Code,
  brand_mandate: z
    .looseObject({
      blocking_category: NStr(64),
      retry_after: NStr(64),
    })
    .nullable()
    .optional(),
});

const ThreeDSecure = z.looseObject({
  status: NStr(64),
  threeds_result: z
    .looseObject({
      eci: Code,
      liability: NStr(64),
    })
    .nullable()
    .optional(),
});

const Payment = z.looseObject({
  hash: NStr(256),
  merchant_payment_code: NStr(256),
  status: z.string().max(16),
  status_date: NStr(64),
  open_date: NStr(64),
  confirm_date: NStr(64),
  transfer_date: NStr(64),
  due_date: NStr(64),
  country: NStr(16),
  payment_type_code: NStr(64),
  amount_ext: Amount,
  amount_ext_requested: Amount,
  currency_ext: NStr(16),
  instalments: Amount,
  pre_approved: Flag,
  capture_available: Flag,
  transaction_status: TransactionStatus.nullable().optional(),
  threedsecure: ThreeDSecure.nullable().optional(),
  refunds: z.array(z.unknown()).max(1000).nullable().optional(),
  chargeback: z.unknown().optional(),
  claims: z.unknown().optional(),
});

const PayinResponse = z.looseObject({
  payment: Payment,
  status: NStr(32),
  operation: NStr(64),
});

const PayinError = z.looseObject({
  status: z.literal("ERROR"),
  status_code: z.string().max(64),
  status_message: NStr(4000),
  message: NStr(4000),
});

const Refund = z.looseObject({
  id: Code,
  merchant_refund_code: NStr(256),
  status: z.string().max(16),
  request_date: NStr(64),
  pending_date: NStr(64),
  confirm_date: NStr(64),
  cancel_date: NStr(64),
  amount_ext: Amount,
  refund_status_details: z.unknown().optional(),
});

const Chargeback = z.looseObject({
  chargeback_public_id: NStr(128),
  create_date: NStr(64),
  chargeback_date: NStr(64),
  reason_code: Code,
  amount_ext: Amount,
  dispute_status: NStr(64),
  settled: Flag,
  settlement_date: NStr(64),
});

const Claim = z.looseObject({
  return_request_id: Code,
  status: NStr(64),
  reason: NStr(64),
  claims_type: NStr(32),
  date_paid_to_customer: NStr(64),
});

const Payout = z.looseObject({
  uid: NStr(256),
  external_reference: NStr(256),
  status: z.string().max(16),
  request_date: NStr(64),
  status_date: NStr(64),
  paid_date: NStr(64),
  cancel_date: NStr(64),
  request_amount: Amount,
  request_currency: NStr(16),
});

const PayoutResponse = z.looseObject({
  type: z.string().max(64),
  payout: Payout.nullable().optional(),
  payouts: z.array(z.unknown()).max(1000).nullable().optional(),
  status_code: NStr(64),
  code: NStr(64),
  message: NStr(4000),
});

type PayinValue = z.infer<typeof PayinResponse>;
type PaymentValue = z.infer<typeof Payment>;
type PayinErrorValue = z.infer<typeof PayinError>;
type RefundValue = z.infer<typeof Refund>;
type ChargebackValue = z.infer<typeof Chargeback>;
type ClaimValue = z.infer<typeof Claim>;
type PayoutValue = z.infer<typeof Payout>;
type PayoutResponseValue = z.infer<typeof PayoutResponse>;

type NotificationValue = {
  operation?: string;
  notification_type?: string;
  hash_codes?: string;
};

export type EbanxParsed =
  | { kind: "payin"; value: PayinValue }
  | { kind: "payin_error"; value: PayinErrorValue }
  | { kind: "payment_notification"; value: NotificationValue }
  | { kind: "payout"; value: PayoutResponseValue }
  | { kind: "payout_notification"; value: NotificationValue };

const NOTIFICATION_FIELDS = ["operation", "notification_type", "hash_codes"] as const;

function pickNotification(
  input: unknown,
  required: readonly (typeof NOTIFICATION_FIELDS)[number][],
): { ok: true; value: NotificationValue } | { ok: false; issues: string[] } {
  if (!isObj(input) || !isFlatStrings(input))
    return { ok: false, issues: ["(root): expected name-value pairs with text values"] };
  const out: NotificationValue = {};
  const issues: string[] = [];
  for (const key of NOTIFICATION_FIELDS) {
    const v = own(input, key) ? input[key] : undefined;
    if (v === undefined) continue;
    if (typeof v !== "string") {
      issues.push(`${key}: appears more than once`);
      continue;
    }
    if (v.length > 20_000) {
      issues.push(`${key}: value is too long`);
      continue;
    }
    out[key] = v;
  }
  for (const key of required) {
    if (nonEmpty(out[key]) === undefined && !issues.some((i) => i.startsWith(`${key}:`)))
      issues.push(`${key}: required`);
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: out };
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: EbanxParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case EBANX_FORMATS.payinResponse: {
      const r = PayinResponse.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payin", value: r.data } }
        : { ok: false, issues: zodIssues(r.error) };
    }
    case EBANX_FORMATS.payinError: {
      const r = PayinError.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payin_error", value: r.data } }
        : { ok: false, issues: zodIssues(r.error) };
    }
    case EBANX_FORMATS.payoutResponse: {
      const r = PayoutResponse.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payout", value: r.data } }
        : { ok: false, issues: zodIssues(r.error) };
    }
    case EBANX_FORMATS.paymentNotification: {
      const r = pickNotification(input, NOTIFICATION_FIELDS);
      return r.ok ? { ok: true, value: { kind: "payment_notification", value: r.value } } : r;
    }
    case EBANX_FORMATS.payoutNotification: {
      const r = pickNotification(input, ["operation", "hash_codes"]);
      return r.ok ? { ok: true, value: { kind: "payout_notification", value: r.value } } : r;
    }
    default:
      return { ok: false, issues: [`Unsupported EBANX format "${format}".`] };
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

function clean(dr: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(dr).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

const observedOf = (ctx: NormalizeContext) =>
  ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};

const UNCERTAIN: ReadonlySet<ErrorCategory> = new Set([
  "provider_unavailable",
  "network_or_timeout",
  "unknown",
]);

/** Higher is stricter. */
const RETRY_RANK: Record<RetryGuidance, number> = {
  unknown: 0,
  safe_to_retry_technical_request: 1,
  retry_conditionally: 2,
  customer_action_required: 3,
  manual_review: 4,
  do_not_retry: 5,
};

const stricter = (a: RetryGuidance, b: RetryGuidance) => (RETRY_RANK[b] > RETRY_RANK[a] ? b : a);

/** Several documented meanings: one category if they agree, the strictest retry. */
function combine(entries: readonly CodeEntry[]): { category: ErrorCategory; retry: RetryGuidance } {
  const categories = new Set(entries.map((x) => x.category));
  return {
    category: categories.size === 1 ? entries[0]!.category : "unknown",
    retry: entries.reduce<RetryGuidance>((r, x) => stricter(r, x.retry), "unknown"),
  };
}

const SOURCE_DOCS: Record<CodeSource, DocumentationLink> = {
  P: { title: "EBANX pay-in API error codes", url: API_ERRORS_URL },
  O: { title: "EBANX pay-in OpenAPI enumerations", url: PAYIN_OPENAPI_URL },
  S: { title: "EBANX sandbox system failure simulation", url: SYSTEM_FAILURES_URL },
  X: { title: "EBANX Pix Automatico error scenarios", url: PIX_AUTOMATICO_ERRORS_URL },
  C: { title: "EBANX chargebacks and disputes", url: CHARGEBACK_URL },
};

function docsFor(...entries: readonly CodeEntry[]): DocumentationLink[] {
  const seen = new Set<CodeSource>();
  for (const x of entries) for (const s of x.sources ?? ["P"]) seen.add(s);
  return [...seen].map((s) => SOURCE_DOCS[s]);
}

const CARD_DOC: DocumentationLink = { title: "EBANX card error codes", url: CARD_ERRORS_URL };
const APM_DOC: DocumentationLink = { title: "EBANX APM error codes", url: APM_ERRORS_URL };
const ISO_DOC: DocumentationLink = { title: "EBANX ISO 8583 and MAC codes", url: ISO8583_URL };
const OPENAPI_DOC: DocumentationLink = SOURCE_DOCS.O;
const PAYOUT_DOC: DocumentationLink = { title: "EBANX payout error codes", url: PAYOUT_ERRORS_URL };

type Decoded = {
  code: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  docs: DocumentationLink[];
  missing: string[];
  outcomeKnown: boolean;
  subCodes: Record<string, string>;
  message?: string;
};

type Location = {
  ctx: NormalizeContext;
  path: string;
  paymentReference?: string;
  attemptReference?: string;
};

function draft(loc: Location, dec: Decoded): DecodedErrorDraft {
  return {
    sourceFormat: loc.ctx.format,
    source: { recordIndex: loc.ctx.recordIndex, path: loc.path },
    ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
    ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
    code: dec.code,
    subCodes: dec.subCodes,
    category: dec.category,
    ...(dec.message ? { providerMessage: dec.message } : {}),
    explanation: dec.explanation,
    nextAction: NEXT_ACTION[dec.category],
    retry: dec.retry,
    retryExplanation: RETRY_TEXT[dec.retry],
    confidence: dec.confidence,
    documentation: dec.docs,
    missingInformation: dec.missing,
    ...(dec.outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Pay-in error envelope
// ---------------------------------------------------------------------------

const FAMILIES: [RegExp, string][] = [
  [/^BP-DR-/, "payment creation (BP-DR)"],
  [/^BP-REF-/, "refund (BP-REF)"],
  [/^BP-CAN-/, "cancel (BP-CAN)"],
  [/^BP-CAP-/, "capture (BP-CAP)"],
  [/^BP-Q-/, "query (BP-Q)"],
  [/^BP-SA-|^BP-DPAR-/, "authentication and parser (BP-SA, BP-DPAR)"],
  [/^BP-3DS/, "3DS (BP-3DS)"],
  [/^BP-UE-/, "enrollment (BP-UE)"],
  [/^BP-R-/, "payment page and retry (BP-R)"],
  [/^BP-CH-/, "chargeback evidence (BP-CH)"],
  [/^BP-US-/, "status and subscription update (BP-US)"],
];

const familyOf = (code: string) => FAMILIES.find(([re]) => re.test(code))?.[1];

/** Decodes a pay-in `status_code`; exported for tests and reuse. */
export function decodeStatusCode(
  code: string,
  messageText?: string,
  httpStatus?: number,
): Omit<Decoded, "subCodes" | "message"> {
  const entry = lookup(PAYIN_ERROR_CODES, code);
  if (!entry) {
    const family = familyOf(code);
    return {
      code,
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      explanation: `EBANX returned status_code ${code}, which is not in EBANX's documented code tables${family ? `; its prefix belongs to the ${family} family` : ""}.`,
      docs: [SOURCE_DOCS.P, OPENAPI_DOC],
      missing: [`status_code ${code} is not documented.`],
      outcomeKnown: false,
    };
  }
  const missing: string[] = [];
  let explanation: string;
  let category = entry.category;
  let retry = entry.retry;
  let confidence: Confidence = entry.category === "unknown" ? "possible" : "strong";
  let docs = docsFor(entry);
  const conflict = lookup(CONFLICTING_CODES, code);
  if (conflict) {
    const options: AlternativeMeaning[] = [
      {
        ...entry,
        context: "API error page",
        ...(conflict.primaryHint ? { messageHint: conflict.primaryHint } : {}),
      },
      ...conflict.alternatives,
    ];
    const hinted = messageText
      ? options.filter((o) => o.messageHint !== undefined && o.messageHint.test(messageText))
      : [];
    const listed = options.map((o) => `"${o.meaning}" (${o.context})`).join(" or ");
    docs = docsFor(...options);
    confidence = "possible";
    if (hinted.length === 1) {
      const chosen = hinted[0]!;
      category = chosen.category;
      retry = chosen.retry;
      explanation = `EBANX status_code ${code} has more than one documented meaning: ${listed}. The message text matches: ${chosen.meaning}.`;
      missing.push(
        `${code} is documented with different meanings depending on the endpoint; the message text was used as a hint, and the response does not name the endpoint.`,
      );
      if (chosen !== options[0])
        missing.push(
          `The message text disagrees with the meaning on EBANX's main error code table.`,
        );
    } else {
      ({ category, retry } = combine(options));
      explanation = `EBANX status_code ${code} has more than one documented meaning: ${listed}. Which one applies depends on the endpoint, which the response does not show.`;
      missing.push(
        `${code} is documented with different meanings depending on the endpoint; the response does not say which endpoint returned it.`,
      );
    }
  } else {
    explanation = `EBANX status_code ${code}: ${entry.meaning}.`;
  }
  const documentedHttp = lookup(EVIDENCE_HTTP_STATUS, code);
  if (documentedHttp !== undefined && httpStatus !== undefined && documentedHttp !== httpStatus)
    missing.push(
      `EBANX documents HTTP ${documentedHttp} for ${code}, but the record arrived with HTTP ${httpStatus}.`,
    );
  return {
    code,
    category,
    retry,
    confidence,
    explanation,
    docs,
    missing,
    outcomeKnown: !UNCERTAIN.has(category),
  };
}

function payinErrorState(v: PayinErrorValue) {
  const code = v.status_code.trim();
  const text = message(v.status_message ?? v.message);
  return { code, text, entry: lookup(PAYIN_ERROR_CODES, code) };
}

function payinErrorEvent(v: PayinErrorValue, ctx: NormalizeContext): NormalizedEventDraft {
  const s = payinErrorState(v);
  const dec = decodeStatusCode(s.code, s.text, ctx.meta?.http?.status);
  const code = codeOf(s.code);
  return clean({
    sourceFormat: ctx.format,
    eventType: "api_error",
    eventTypeKnown: true,
    stage: "error",
    providerStatus: code,
    outcome: UNCERTAIN.has(dec.category) ? "unknown" : "failure",
    attributes: attrs([
      ["deliveryChannel", "api_response"],
      ["envelopeStatus", "ERROR"],
      ["statusCode", code],
      ["statusCodeKnown", s.entry ? undefined : false],
      ["codeFamily", familyOf(s.code)],
      ["meaningConflict", lookup(CONFLICTING_CODES, s.code) ? true : undefined],
      ["messageField", v.status_message == null && v.message != null ? "message" : undefined],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function payinErrorErrors(v: PayinErrorValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const s = payinErrorState(v);
  const http = ctx.meta?.http?.status;
  const dec = decodeStatusCode(s.code, s.text, http);
  const subCodes: Record<string, string> = { status: "ERROR" };
  if (http !== undefined) subCodes.http_status = String(http);
  return [
    draft(
      { ctx, path: "status_code" },
      { ...dec, subCodes, ...(s.text ? { message: s.text } : {}) },
    ),
  ];
}

// ---------------------------------------------------------------------------
// Pay-in payment responses
// ---------------------------------------------------------------------------

const CARD_TYPE_CODES: ReadonlySet<string> = new Set(["creditcard", "visa"]);
const APM_TYPE_CODES: ReadonlySet<string> = new Set([
  "boleto",
  "pix",
  "pix-automatico",
  "oxxopay",
  "spei",
]);

type Table = "card" | "apm" | "unknown";

/** Which description_code table applies, from payment_type_code and card-only fields. */
function tableOf(p: PaymentValue): Table {
  const type = nonEmpty(p.payment_type_code)?.toLowerCase();
  if (type && CARD_TYPE_CODES.has(type)) return "card";
  if (type && APM_TYPE_CODES.has(type)) return "apm";
  const ts = p.transaction_status ?? undefined;
  const raw = p as Obj;
  if (
    (ts &&
      (own(ts, "authcode") || ts.iso_code != null || ts.mac_code != null || ts.brand_mandate)) ||
    p.threedsecure ||
    own(raw, "masked_card_number")
  )
    return "card";
  return "unknown";
}

type Resolved = {
  code: string;
  entry: DescriptionEntry;
  table: "card" | "apm" | "both";
  confidence: Confidence;
  missing: string[];
};

function resolveDescriptionCode(code: string, table: Table): Resolved | undefined {
  const card = lookup(CARD_DESCRIPTION_CODES, code);
  const apm = lookup(APM_DESCRIPTION_CODES, code);
  const refund = lookup(REFUND_DECLINE_CODES, code) !== undefined;
  const strong = (t: "card" | "apm", entry: DescriptionEntry): Resolved => ({
    code,
    entry,
    table: t,
    confidence: refund || entry.category === "unknown" ? "possible" : "strong",
    missing: refund
      ? ["EBANX gives no meaning for refund decline codes beyond the code name."]
      : [],
  });
  if (card && apm) {
    if (table === "card") return strong("card", card);
    if (table === "apm") return strong("apm", apm);
    if (card.category === apm.category && card.retry === apm.retry && card.kind === apm.kind)
      return strong("card", card);
    const { category, retry } = combine([card, apm]);
    return {
      code,
      entry: {
        meaning: `card table: ${card.meaning}; APM table: ${apm.meaning}`,
        category,
        retry,
        ...(card.kind && card.kind === apm.kind ? { kind: card.kind } : {}),
      },
      table: "both",
      confidence: "possible",
      missing: [
        `${code} is in both the card and the APM table with different guidance, and the payment method is not clear from the response.`,
      ],
    };
  }
  if (card) {
    const r = strong("card", card);
    if (table === "apm") {
      r.confidence = "possible";
      r.missing.push(`${code} is documented for cards, but the payment looks like an APM.`);
    }
    return r;
  }
  if (apm) {
    const r = strong("apm", apm);
    if (table === "card") {
      r.confidence = "possible";
      r.missing.push(`${code} is documented for APMs, but the payment looks like a card payment.`);
    }
    return r;
  }
  return undefined;
}

function resolvedOutcome(p: PaymentValue): Resolved | undefined {
  const ts = p.transaction_status ?? undefined;
  if (!ts) return undefined;
  const dc = codeOf(ts.description_code, 128)?.toUpperCase();
  if (dc) return resolveDescriptionCode(dc, tableOf(p));
  const desc = nonEmpty(ts.description)?.toLowerCase().replace(/\.$/, "");
  const entry = desc ? lookup(CARD_RESPONSE_DESCRIPTIONS, desc) : undefined;
  if (entry && tableOf(p) !== "apm")
    return {
      code: nonEmpty(ts.description)!.replace(/\.$/, ""),
      entry,
      table: "card",
      confidence: "strong",
      missing: [],
    };
  return undefined;
}

type PayinState = {
  stage: LifecycleStage;
  outcome: Outcome;
  eventType: string;
  known: boolean;
  status: string;
  resolved?: Resolved;
  tsCode?: string;
  threeDs?: string;
  threeDsConflict: boolean;
  cancelled: boolean;
};

function payinState(v: PayinValue): PayinState {
  const p = v.payment;
  const status = p.status.trim().toUpperCase();
  const info = lookup(PAYMENT_STATUSES, status);
  const ts = p.transaction_status ?? undefined;
  const tsCode = nonEmpty(ts?.code)?.toUpperCase();
  const resolved = resolvedOutcome(p);
  const threeDs = nonEmpty(p.threedsecure?.status)?.toUpperCase();
  const authPending =
    tsCode === "PENDING_AUTHENTICATION" ||
    tsCode === "PENDING_CARD_PIN" ||
    resolved?.entry.kind === "pending" ||
    threeDs === "PENDING_AUTHENTICATION";
  const operation = nonEmpty(v.operation)?.toLowerCase();
  const threeDsConflict =
    threeDs === "PENDING_AUTHENTICATION" && (status === "CO" || status === "CA");
  const tsKnown = tsCode === undefined || lookup(TRANSACTION_STATUS_CODES, tsCode) !== undefined;
  const common = { status, resolved, tsCode, threeDs, threeDsConflict };

  if (operation === "cancel") {
    return {
      ...common,
      stage: "cancellation",
      outcome: status === "CA" ? "success" : "unknown",
      eventType: "payment.cancel",
      known: info !== undefined,
      cancelled: status === "CA",
    };
  }
  if (!info) {
    return {
      ...common,
      stage: "payment",
      outcome: "unknown",
      eventType: "payment",
      known: false,
      cancelled: false,
    };
  }
  let stage: LifecycleStage = info.stage;
  let outcome: Outcome = info.outcome;
  let cancelled = false;
  if (status === "OP" || status === "PE") {
    if (status === "PE" && flag(p.pre_approved) === true) {
      // An approved authorization waiting for /ws/capture (auto_capture false).
      stage = "authorization";
      outcome = "success";
    } else if (authPending && !threeDsConflict) {
      stage = "authentication";
    }
  } else if (status === "CA" && resolved?.entry.kind === "cancellation") {
    stage = "cancellation";
    outcome = "success";
    cancelled = true;
  }
  return {
    ...common,
    stage,
    outcome,
    eventType: "payment",
    known: tsKnown,
    cancelled,
  };
}

function payinRefs(p: PaymentValue) {
  const hash = hashOf(p.hash);
  return {
    hash,
    merchantReference: idOf(p.merchant_payment_code),
    placeholder:
      isPlaceholder(p.hash) ||
      isPlaceholder(p.status_date) ||
      isPlaceholder(p.merchant_payment_code) ||
      isPlaceholder(p.open_date) ||
      isPlaceholder(p.confirm_date),
  };
}

function paymentTime(p: PaymentValue, status: string): { ts?: string; field?: string } {
  const candidates: [string, unknown][] = [["status_date", p.status_date]];
  if (status === "CO") candidates.push(["confirm_date", p.confirm_date]);
  if (status === "OP" || status === "PE") candidates.push(["open_date", p.open_date]);
  for (const [field, value] of candidates) {
    const ts = timeOf(value);
    if (ts) return { ts, field };
  }
  return {};
}

function amountOf(value: unknown, currency: string | undefined): string | undefined {
  if (!currency || value === null || value === undefined) return undefined;
  return decimalToMinor(value, currency);
}

function paymentEvent(v: PayinValue, ctx: NormalizeContext): NormalizedEventDraft {
  const p = v.payment;
  const s = payinState(v);
  const refs = payinRefs(p);
  const currency = upperCurrency(nonEmpty(p.currency_ext));
  const amount = amountOf(p.amount_ext, currency) ?? amountOf(p.amount_ext_requested, currency);
  const time = paymentTime(p, s.status);
  const ts = p.transaction_status ?? undefined;
  const tsCode = s.tsCode;
  const dc = codeOf(ts?.description_code, 128)?.toUpperCase();
  const type = codeOf(p.payment_type_code)?.toLowerCase();
  const country = nonEmpty(p.country);
  const eci = codeOf(p.threedsecure?.threeds_result?.eci, 4);
  const liability = nonEmpty(p.threedsecure?.threeds_result?.liability);
  const mandate = ts?.brand_mandate ?? undefined;
  const mandateCategory = nonEmpty(mandate?.blocking_category);
  const refunds = Array.isArray(p.refunds) ? p.refunds.length : undefined;
  const iso = codeOf(ts?.iso_code, 4)?.toUpperCase();
  const mac = codeOf(ts?.mac_code, 4);
  return clean({
    sourceFormat: ctx.format,
    eventType: s.eventType,
    eventTypeKnown: s.known,
    stage: s.stage,
    providerStatus: codeOf(s.status, 16),
    paymentReference: refs.hash,
    merchantReference: refs.merchantReference,
    eventTimestamp: time.ts,
    amountMinor: amount,
    currency: amount ? currency : undefined,
    outcome: s.outcome,
    attributes: attrs([
      ["deliveryChannel", "api_response"],
      ["envelopeStatus", codeOf(v.status, 16)],
      ["operation", nonEmpty(v.operation)?.toLowerCase() === "cancel" ? "cancel" : undefined],
      ["paymentStatus", codeOf(s.status, 16)],
      ["paymentStatusKnown", lookup(PAYMENT_STATUSES, s.status) ? undefined : false],
      ["paymentTypeCode", type],
      ["country", country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined],
      ["instalments", intOf(p.instalments)],
      ["preApproved", flag(p.pre_approved)],
      ["captureAvailable", flag(p.capture_available)],
      ["acquirer", nonEmpty(ts?.acquirer) ? message(ts?.acquirer, 32) : undefined],
      ["transactionStatusCode", tsCode ? codeOf(tsCode) : undefined],
      [
        "transactionStatusCodeKnown",
        tsCode && !lookup(TRANSACTION_STATUS_CODES, tsCode) ? false : undefined,
      ],
      ["descriptionCode", dc],
      ["descriptionCodeKnown", dc && !s.resolved ? false : undefined],
      ["descriptionCodeTable", s.resolved?.table],
      ["isoCode", iso],
      ["macCode", mac],
      ["cancelledBy", s.cancelled ? dc : undefined],
      ["threeDsStatus", s.threeDs && lookup(THREE_DS_STATUSES, s.threeDs) ? s.threeDs : undefined],
      [
        "threeDsStatusKnown",
        s.threeDs && !lookup(THREE_DS_STATUSES, s.threeDs) ? false : undefined,
      ],
      // EBANX's own 3DS example shows a pending challenge on a confirmed payment.
      ["threeDsStatusConflict", s.threeDsConflict ? true : undefined],
      ["threeDsLiability", liability && THREE_DS_LIABILITY.has(liability) ? liability : undefined],
      ["eci", eci && lookup(ECI_VALUES, eci) ? eci : undefined],
      [
        "brandMandateCategory",
        mandateCategory && BRAND_MANDATE_CATEGORIES.has(mandateCategory)
          ? mandateCategory
          : undefined,
      ],
      ["brandMandateRetryAfter", timeOf(mandate?.retry_after)],
      ["timestampField", time.field],
      ["timestampZone", time.ts ? "UTC (as the EBANX OpenAPI describes its dates)" : undefined],
      ["openDate", timeOf(p.open_date)],
      ["confirmDate", timeOf(p.confirm_date)],
      ["settlementDate", timeOf(p.transfer_date)],
      ["dueDate", /^\d{4}-\d{2}-\d{2}$/.test(nonEmpty(p.due_date) ?? "") ? p.due_date : undefined],
      ["refundCount", refunds],
      ["hasChargeback", isObj(p.chargeback) ? true : undefined],
      ["docsPlaceholder", refs.placeholder ? true : undefined],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "payment" },
    ...observedOf(ctx),
  });
}

function refundEvents(
  p: PaymentValue,
  hash: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  if (!Array.isArray(p.refunds)) return [];
  const currency = upperCurrency(nonEmpty(p.currency_ext));
  const out: NormalizedEventDraft[] = [];
  p.refunds.forEach((item, i) => {
    const r = Refund.safeParse(item);
    if (!r.success) return;
    const refund: RefundValue = r.data;
    const status = refund.status.trim().toUpperCase();
    const info = lookup(REFUND_STATUSES, status);
    const dates: Record<string, unknown> = {
      request_date: refund.request_date,
      pending_date: refund.pending_date,
      confirm_date: refund.confirm_date,
      cancel_date: refund.cancel_date,
    };
    const field = info && timeOf(dates[info.dateField]) ? info.dateField : "request_date";
    const ts = timeOf(dates[field]);
    const amount = amountOf(refund.amount_ext, currency);
    const details = isObj(refund.refund_status_details) ? refund.refund_status_details : {};
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: "refund",
        eventTypeKnown: info !== undefined,
        stage: "refund",
        providerStatus: codeOf(status, 16),
        paymentReference: hash,
        relatedReference: idOf(refund.id),
        eventTimestamp: ts,
        amountMinor: amount,
        currency: amount ? currency : undefined,
        outcome: info?.outcome ?? "unknown",
        attributes: attrs([
          ["deliveryChannel", "api_response"],
          ["objectType", "refund"],
          ["refundStatus", codeOf(status, 16)],
          ["refundStatusKnown", info ? undefined : false],
          ["refundStatusMeaning", info?.meaning],
          ["refundId", idOf(refund.id)],
          ["merchantRefundReference", idOf(refund.merchant_refund_code)],
          ["pendingReasonCode", codeOf(details.pending_reason_code)],
          ["statusReasonCode", codeOf(details.status_reason_code)],
          ["cancellationReasonCode", codeOf(details.cancellation_reason_code)],
          ["timestampField", ts ? field : undefined],
          ["timestampZone", ts ? "UTC (as the EBANX OpenAPI describes its dates)" : undefined],
        ]),
        source: { recordIndex: ctx.recordIndex, path: `payment.refunds[${i}]` },
        ...observedOf(ctx),
      }),
    );
  });
  return out;
}

function chargebackEvent(
  p: PaymentValue,
  hash: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  if (!isObj(p.chargeback)) return [];
  const r = Chargeback.safeParse(p.chargeback);
  if (!r.success) return [];
  const c: ChargebackValue = r.data;
  const currency = upperCurrency(nonEmpty(p.currency_ext));
  const amount = amountOf(c.amount_ext, currency);
  const reason = codeOf(c.reason_code, 16);
  const reasonInfo = reason ? lookup(CHARGEBACK_REASONS, reason) : undefined;
  const dispute = nonEmpty(c.dispute_status);
  const disputeInfo = dispute ? lookup(DISPUTE_STATUSES, dispute) : undefined;
  const createTs = timeOf(c.create_date);
  const ts = createTs ?? timeOf(c.chargeback_date);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: "chargeback",
      eventTypeKnown: true,
      stage: "dispute",
      providerStatus: disputeInfo ? dispute : undefined,
      paymentReference: hash,
      relatedReference: idOf(c.chargeback_public_id),
      eventTimestamp: ts,
      amountMinor: amount,
      currency: amount ? currency : undefined,
      // The dispute status is shown as supplied; its result is not a payment outcome.
      outcome: "unknown",
      attributes: attrs([
        ["deliveryChannel", "api_response"],
        ["objectType", "chargeback"],
        ["chargebackPublicId", idOf(c.chargeback_public_id)],
        ["reasonCode", reason],
        ["reasonCodeKnown", reason && !reasonInfo ? false : undefined],
        ["reasonMeaning", reasonInfo?.meaning],
        ["reasonCategory", reasonInfo?.ebanxCategory],
        ["reasonGroup", reasonInfo?.group],
        ["disputable", reasonInfo?.disputable],
        ["disputeStatus", disputeInfo ? dispute : undefined],
        ["disputeStatusKnown", dispute && !disputeInfo ? false : undefined],
        ["disputeFinal", disputeInfo?.final],
        ["settled", flag(c.settled)],
        ["settlementDate", timeOf(c.settlement_date)],
        ["timestampField", ts ? (createTs ? "create_date" : "chargeback_date") : undefined],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "payment.chargeback" },
      ...observedOf(ctx),
    }),
  ];
}

function claimEvents(
  p: PaymentValue,
  hash: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  // The guide shows claims as one node; a list is accepted as well.
  const list: [unknown, string][] = Array.isArray(p.claims)
    ? p.claims.map((c, i) => [c, `payment.claims[${i}]`])
    : isObj(p.claims)
      ? [[p.claims, "payment.claims"]]
      : [];
  const out: NormalizedEventDraft[] = [];
  for (const [item, path] of list) {
    const r = Claim.safeParse(item);
    if (!r.success) continue;
    const c: ClaimValue = r.data;
    const status = nonEmpty(c.status);
    const reason = nonEmpty(c.reason)?.toLowerCase();
    const ts = timeOf(c.date_paid_to_customer);
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: "claim.med",
        eventTypeKnown: status === "Returned",
        stage: "reversal",
        providerStatus: status === "Returned" ? status : undefined,
        paymentReference: hash,
        relatedReference: idOf(c.return_request_id),
        eventTimestamp: ts,
        outcome: status === "Returned" ? "success" : "unknown",
        attributes: attrs([
          ["deliveryChannel", "api_response"],
          ["objectType", "pix_med_claim"],
          ["returnRequestId", idOf(c.return_request_id)],
          ["claimReason", reason && MED_CLAIM_REASONS.has(reason) ? reason : undefined],
          ["claimReasonKnown", reason && !MED_CLAIM_REASONS.has(reason) ? false : undefined],
          ["claimsType", nonEmpty(c.claims_type) === "med" ? "med" : undefined],
          ["timestampField", ts ? "date_paid_to_customer" : undefined],
        ]),
        source: { recordIndex: ctx.recordIndex, path },
        ...observedOf(ctx),
      }),
    );
  }
  return out;
}

function payinEvents(v: PayinValue, ctx: NormalizeContext): NormalizedEventDraft[] {
  const hash = hashOf(v.payment.hash);
  return [
    paymentEvent(v, ctx),
    ...refundEvents(v.payment, hash, ctx),
    ...chargebackEvent(v.payment, hash, ctx),
    ...claimEvents(v.payment, hash, ctx),
  ];
}

function declineDecoded(
  p: PaymentValue,
  s: PayinState,
  http: number | undefined,
): Decoded | undefined {
  const ts = p.transaction_status ?? undefined;
  const tsCode = s.tsCode;
  const tsEntry = tsCode ? lookup(TRANSACTION_STATUS_CODES, tsCode) : undefined;
  const failedCode = tsCode === "NOK" || tsCode === "NO_RETRY" || tsCode === "RETRY";
  const declined =
    failedCode || (s.status === "CA" && !s.cancelled && ts !== undefined && tsCode !== "OK");
  const resolved = s.resolved;
  // Accepted, cancelled and pending-authentication codes are not errors.
  if (!declined || resolved?.entry.kind) return undefined;
  const final = s.status === "CA";
  const subCodes: Record<string, string> = { "payment.status": s.status };
  if (tsCode) subCodes["transaction_status.code"] = codeOf(tsCode) ?? "";
  const type = codeOf(p.payment_type_code)?.toLowerCase();
  if (type) subCodes.payment_type_code = type;
  if (http !== undefined) subCodes.http_status = String(http);
  const iso = codeOf(ts?.iso_code, 4)?.toUpperCase();
  const isoEntry = iso ? lookup(ISO8583_CODES, iso) : undefined;
  const mac = codeOf(ts?.mac_code, 4);
  const macEntry = mac ? lookup(MAC_CODES, mac) : undefined;
  if (iso) subCodes.iso_code = iso;
  if (mac) subCodes.mac_code = mac;
  const text = message(ts?.description, 200);

  let dec: Decoded;
  if (resolved) {
    const dc = codeOf(ts?.description_code, 128) !== undefined;
    if (dc) subCodes.description_code = resolved.code;
    const docs =
      resolved.table === "card"
        ? [CARD_DOC, OPENAPI_DOC]
        : resolved.table === "apm"
          ? [APM_DOC, OPENAPI_DOC]
          : [CARD_DOC, APM_DOC, OPENAPI_DOC];
    dec = {
      code: resolved.code,
      category: resolved.entry.category,
      retry: resolved.entry.retry,
      confidence: resolved.confidence,
      explanation: dc
        ? `EBANX ${resolved.table === "both" ? "" : `${resolved.table === "card" ? "card" : "APM"} `}description_code ${resolved.code}: ${resolved.entry.meaning}.`
        : `EBANX card response description "${resolved.code}": ${resolved.entry.meaning}.`,
      docs,
      missing: [...resolved.missing],
      outcomeKnown: final || !UNCERTAIN.has(resolved.entry.category),
      subCodes,
    };
  } else if (isoEntry && !isoEntry.approved) {
    dec = {
      code: iso!,
      category: isoEntry.category,
      retry: isoEntry.retry,
      confidence: "possible",
      explanation: `ISO 8583 response code ${iso}: ${isoEntry.meaning} (EBANX group: ${isoEntry.group}).`,
      docs: [ISO_DOC],
      missing: [
        codeOf(ts?.description_code, 128)
          ? `description_code ${codeOf(ts?.description_code, 128)!.toUpperCase()} is not documented, so the ISO 8583 code is used. EBANX warns that issuers interpret ISO 8583 codes differently.`
          : "No description_code was sent. EBANX warns that issuers interpret ISO 8583 codes differently and recommends its own description.",
      ],
      outcomeKnown: true,
      subCodes,
    };
  } else if (tsEntry?.category && tsEntry.retry) {
    dec = {
      code: tsCode!,
      category: tsEntry.category,
      retry: tsEntry.retry,
      confidence: "possible",
      explanation: `EBANX transaction_status.code ${tsCode}: ${tsEntry.meaning}. No description_code says why.`,
      docs: [OPENAPI_DOC],
      missing: ["The response carries no description_code."],
      outcomeKnown: final,
      subCodes,
    };
  } else {
    const dcRaw = codeOf(ts?.description_code, 128);
    dec = {
      code: dcRaw?.toUpperCase() ?? tsCode ?? s.status,
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      explanation: dcRaw
        ? `EBANX did not accept the payment and sent description_code ${dcRaw.toUpperCase()}, which is not in EBANX's card or APM tables.`
        : "EBANX did not accept the payment but sent no description_code, so the reason is unknown.",
      docs: [CARD_DOC, APM_DOC],
      missing: [
        dcRaw
          ? `description_code ${dcRaw.toUpperCase()} is not documented.`
          : "The response carries no description_code.",
      ],
      outcomeKnown: final,
      subCodes,
    };
  }

  if (tsCode === "NO_RETRY" && dec.retry !== "do_not_retry") {
    dec.retry = "do_not_retry";
    dec.explanation += " transaction_status.code NO_RETRY: EBANX advises not to retry.";
  }
  if (isoEntry && !isoEntry.approved && dec.code !== iso) {
    dec.explanation += ` ISO 8583 code ${iso}: ${isoEntry.meaning} (EBANX group: ${isoEntry.group}).`;
    if (!dec.docs.includes(ISO_DOC)) dec.docs = [...dec.docs, ISO_DOC];
  } else if (iso && !isoEntry) {
    dec.missing.push(`ISO 8583 code ${iso} is not in EBANX's list.`);
  }
  if (macEntry) {
    dec.explanation += ` Mastercard Merchant Advice Code ${mac}: ${macEntry.meaning} (${macEntry.group}).`;
    if (macEntry.retry && RETRY_RANK[macEntry.retry] > RETRY_RANK[dec.retry]) {
      dec.retry = macEntry.retry;
      dec.explanation += " The advice code's stricter retry guidance is used.";
    }
    if (!dec.docs.includes(ISO_DOC)) dec.docs = [...dec.docs, ISO_DOC];
  } else if (mac) {
    dec.missing.push(`Mastercard Merchant Advice Code ${mac} is not in EBANX's list.`);
  }
  const mandate = ts?.brand_mandate ?? undefined;
  if (mandate) {
    const category = nonEmpty(mandate.blocking_category);
    const retryAfter = timeOf(mandate.retry_after);
    if (category && BRAND_MANDATE_CATEGORIES.has(category))
      subCodes["brand_mandate.blocking_category"] = category;
    if (retryAfter)
      dec.explanation += ` The card brand mandate blocks new attempts until ${retryAfter}.`;
  }
  // "Retry at any time" is EBANX's advice for a final, failed attempt. Without
  // a final status the earlier attempt may still go through.
  if (dec.retry === "safe_to_retry_technical_request" && !final) {
    dec.retry = "retry_conditionally";
    dec.explanation +=
      " The payment is not cancelled yet, so the attempt may still succeed; check /ws/query first.";
  }
  if (final) dec.explanation += " The payment status is CA (cancelled or failed).";
  if (text) dec.message = text;
  return dec;
}

function threeDsDecoded(s: PayinState): Decoded | undefined {
  if (s.outcome !== "failure" || !s.threeDs) return undefined;
  const info = lookup(THREE_DS_STATUSES, s.threeDs);
  if (!info?.category || !info.retry) return undefined;
  return {
    code: s.threeDs,
    category: info.category,
    retry: info.retry,
    confidence: "strong",
    explanation: `3DS authentication status ${s.threeDs}: ${info.meaning}.`,
    docs: [OPENAPI_DOC, { title: "EBANX credit cards", url: CREDIT_CARDS_URL }],
    missing: [],
    outcomeKnown: true,
    subCodes: { "threedsecure.status": s.threeDs, "payment.status": s.status },
  };
}

function payinErrors(v: PayinValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const p = v.payment;
  const s = payinState(v);
  const hash = hashOf(p.hash);
  const loc = (path: string): Location => ({
    ctx,
    path,
    ...(hash ? { paymentReference: hash, attemptReference: hash } : {}),
  });
  const out: DecodedErrorDraft[] = [];
  const threeDs = threeDsDecoded(s);
  if (s.stage !== "cancellation") {
    const decline = declineDecoded(p, s, ctx.meta?.http?.status);
    // A decline without any reason adds nothing next to a failed 3DS status.
    if (decline && !(threeDs && decline.confidence === "insufficient"))
      out.push(draft(loc("payment.transaction_status"), decline));
  }
  if (threeDs) out.push(draft(loc("payment.threedsecure.status"), threeDs));
  return out;
}

// ---------------------------------------------------------------------------
// Payment and payout notifications
// ---------------------------------------------------------------------------

function hashList(v: string | undefined): { hashes: string[]; placeholder: boolean } {
  const parts = (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "");
  return {
    hashes: [...new Set(parts.map(hashOf).filter((x): x is string => x !== undefined))],
    placeholder: parts.some(isPlaceholder),
  };
}

function signaturePresent(meta: RecordMeta | undefined): boolean | undefined {
  const h = meta?.http?.headers;
  if (!h) return undefined;
  return "x-signature-content" in h || "x-signature-type" in h || "x-signature-fingerprint" in h
    ? true
    : undefined;
}

function paymentNotificationEvents(
  v: NotificationValue,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const type = nonEmpty(v.notification_type)!.toLowerCase();
  const info = lookup(NOTIFICATION_TYPES, type);
  const op = nonEmpty(v.operation);
  const list = hashList(v.hash_codes);
  const typeLabel = info ? type : (codeOf(type, 32) ?? "undocumented");
  const make = (hash: string | undefined, i: number): NormalizedEventDraft =>
    clean({
      sourceFormat: ctx.format,
      eventType: `notification.${typeLabel}`,
      eventTypeKnown: info !== undefined && op === PAYMENT_NOTIFICATION_OPERATION,
      stage: info?.stage ?? "other",
      paymentReference: hash,
      // A payment reaches CO or CA once, so a second update for the same hash
      // is a redelivery. Two refunds or chargebacks produce identical bodies.
      deliveryKey: hash && type === "update" ? `update:${hash}` : undefined,
      // The notification only says "check this payment".
      outcome: "unknown",
      attributes: attrs([
        ["deliveryChannel", "notification"],
        ["operation", op === PAYMENT_NOTIFICATION_OPERATION ? op : undefined],
        ["operationKnown", op !== PAYMENT_NOTIFICATION_OPERATION ? false : undefined],
        ["notificationType", info ? type : undefined],
        ["notificationTypeKnown", info ? undefined : false],
        ["notificationMeaning", info?.meaning],
        ["carriesStatus", false],
        ["nextStep", "Call /ws/query with this hash to see the payment's state."],
        ["hashCount", list.hashes.length],
        ["hashIndex", list.hashes.length > 1 ? i : undefined],
        ["docsPlaceholder", list.placeholder ? true : undefined],
        ["httpMethod", ctx.meta?.http?.method ? safeId(ctx.meta.http.method, 8) : undefined],
        ["signaturePresent", signaturePresent(ctx.meta)],
        // Signatures are never verified; a pasted notification is not proof of origin.
        ["signatureVerified", false],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "hash_codes" },
      ...observedOf(ctx),
    });
  return list.hashes.length ? list.hashes.map((h, i) => make(h, i)) : [make(undefined, 0)];
}

function payoutNotificationEvents(
  v: NotificationValue,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const op = nonEmpty(v.operation)!;
  const status = lookup(PAYOUT_NOTIFICATION_OPERATIONS, op);
  const info = status ? lookup(PAYOUT_STATUSES, status) : undefined;
  const type = nonEmpty(v.notification_type);
  const list = hashList(v.hash_codes);
  const make = (uid: string | undefined, i: number): NormalizedEventDraft =>
    clean({
      sourceFormat: ctx.format,
      eventType: `payout_notification.${op}`,
      eventTypeKnown: info !== undefined,
      stage: "payout",
      providerStatus: status,
      paymentReference: uid,
      deliveryKey: uid && status ? `${op}:${uid}` : undefined,
      outcome: info?.outcome ?? "unknown",
      attributes: attrs([
        ["deliveryChannel", "notification"],
        ["operation", op],
        ["payoutStatus", status],
        ["payoutStatusMeaning", info?.meaning],
        ["notificationType", type === "update" ? type : undefined],
        ["notificationTypeKnown", type !== undefined && type !== "update" ? false : undefined],
        ["payoutId", uid],
        ["hashIndex", list.hashes.length > 1 ? i : undefined],
        ["docsPlaceholder", list.placeholder ? true : undefined],
        ["signaturePresent", signaturePresent(ctx.meta)],
        ["signatureVerified", false],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "hash_codes" },
      ...observedOf(ctx),
    });
  return list.hashes.length ? list.hashes.map((h, i) => make(h, i)) : [make(undefined, 0)];
}

// ---------------------------------------------------------------------------
// Payout API responses
// ---------------------------------------------------------------------------

function payoutEvent(
  payout: PayoutValue,
  type: string,
  path: string,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const status = payout.status.trim().toUpperCase();
  const info = lookup(PAYOUT_STATUSES, status);
  const uid = hashOf(payout.uid);
  const currency = upperCurrency(nonEmpty(payout.request_currency));
  const amount = amountOf(payout.request_amount, currency);
  const dateField = status === "PA" ? "paid_date" : status === "CA" ? "cancel_date" : "status_date";
  const dates: Record<string, unknown> = {
    status_date: payout.status_date,
    paid_date: payout.paid_date,
    cancel_date: payout.cancel_date,
    request_date: payout.request_date,
  };
  const field = timeOf(dates.status_date)
    ? "status_date"
    : timeOf(dates[dateField])
      ? dateField
      : "request_date";
  const ts = timeOf(dates[field]);
  return clean({
    sourceFormat: ctx.format,
    eventType: "payout",
    eventTypeKnown: info !== undefined,
    stage: "payout",
    providerStatus: codeOf(status, 16),
    paymentReference: uid,
    merchantReference: idOf(payout.external_reference),
    eventTimestamp: ts,
    amountMinor: amount,
    currency: amount ? currency : undefined,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs([
      ["deliveryChannel", "api_response"],
      ["responseType", codeOf(type, 32)],
      ["payoutStatus", codeOf(status, 16)],
      ["payoutStatusKnown", info ? undefined : false],
      ["payoutStatusMeaning", info?.meaning],
      ["statusDocumentedOnlyForNotifications", info?.notificationOnly ? true : undefined],
      ["payoutId", uid],
      ["timestampField", ts ? field : undefined],
      ["timestampZone", ts ? "UTC (as the EBANX OpenAPI describes its dates)" : undefined],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path },
    ...observedOf(ctx),
  });
}

function payoutCode(v: PayoutResponseValue) {
  const sc = nonEmpty(v.status_code);
  const code = nonEmpty(v.code);
  const value = sc ?? code;
  const entry = value
    ? (lookup(PAYOUT_ERROR_CODES, value) ?? lookup(PAYOUT_BALANCE_CODES, value))
    : undefined;
  return { value, entry, mismatch: sc !== undefined && code !== undefined && sc !== code };
}

function payoutResponseEvents(
  v: PayoutResponseValue,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const out: NormalizedEventDraft[] = [];
  if (v.payout) out.push(payoutEvent(v.payout, v.type, "payout", ctx));
  if (Array.isArray(v.payouts)) {
    v.payouts.forEach((item, i) => {
      const r = Payout.safeParse(item);
      if (r.success) out.push(payoutEvent(r.data, v.type, `payouts[${i}]`, ctx));
    });
  }
  const c = payoutCode(v);
  if (c.value) {
    const dec = payoutDecoded(v, ctx.meta?.http?.status);
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: "payout_api_error",
        eventTypeKnown: true,
        stage: "error",
        providerStatus: codeOf(c.value),
        outcome: dec && UNCERTAIN.has(dec.category) ? "unknown" : "failure",
        attributes: attrs([
          ["deliveryChannel", "api_response"],
          ["apiFamily", "payout"],
          ["responseType", codeOf(v.type, 32)],
          ["statusCode", codeOf(c.value)],
          ["statusCodeKnown", c.entry ? undefined : false],
          ["codesDisagree", c.mismatch ? true : undefined],
          ["httpStatus", ctx.meta?.http?.status],
        ]),
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...observedOf(ctx),
      }),
    );
  }
  return out;
}

function payoutDecoded(v: PayoutResponseValue, http: number | undefined): Decoded | undefined {
  const c = payoutCode(v);
  if (!c.value) return undefined;
  const code = codeOf(c.value) ?? "unknown";
  const type = nonEmpty(v.type);
  const subCodes: Record<string, string> = {};
  if (type) subCodes.type = codeOf(type, 32) ?? "";
  if (http !== undefined) subCodes.http_status = String(http);
  const text = message(v.message);
  const missing: string[] = [];
  if (c.mismatch)
    missing.push("status_code and code differ; EBANX documents them with the same value.");
  if (c.entry) {
    return {
      code,
      category: c.entry.category,
      retry: c.entry.retry,
      confidence: c.entry.category === "unknown" ? "possible" : "strong",
      explanation: `EBANX payout code ${code}: ${c.entry.meaning}.`,
      docs: [PAYOUT_DOC],
      missing,
      outcomeKnown: !UNCERTAIN.has(c.entry.category),
      subCodes,
      ...(text ? { message: text } : {}),
    };
  }
  const typeCategory = type ? lookup(PAYOUT_RESPONSE_TYPES, type) : undefined;
  return {
    code,
    category: typeCategory ?? "unknown",
    retry: "unknown",
    confidence: typeCategory ? "possible" : "insufficient",
    explanation: `EBANX returned payout code ${code}, which is not in EBANX's payout code table${typeCategory ? `; the response type ${type} suggests the category` : ""}.`,
    docs: [PAYOUT_DOC],
    missing: [...missing, `Payout code ${code} is not documented.`],
    outcomeKnown: false,
    subCodes,
    ...(text ? { message: text } : {}),
  };
}

function payoutErrors(v: PayoutResponseValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const dec = payoutDecoded(v, ctx.meta?.http?.status);
  return dec ? [draft({ ctx, path: v.status_code != null ? "status_code" : "code" }, dec)] : [];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

function normalize(parsed: EbanxParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "payin":
      return payinEvents(parsed.value, ctx);
    case "payin_error":
      return [payinErrorEvent(parsed.value, ctx)];
    case "payment_notification":
      return paymentNotificationEvents(parsed.value, ctx);
    case "payout":
      return payoutResponseEvents(parsed.value, ctx);
    case "payout_notification":
      return payoutNotificationEvents(parsed.value, ctx);
  }
}

function decodeErrors(parsed: EbanxParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "payin":
      return payinErrors(parsed.value, ctx);
    case "payin_error":
      return payinErrorErrors(parsed.value, ctx);
    case "payout":
      return payoutErrors(parsed.value, ctx);
    case "payment_notification":
    case "payout_notification":
      return [];
  }
}

const PAYIN_FORMATS: ReadonlySet<string> = new Set([
  EBANX_FORMATS.payinResponse,
  EBANX_FORMATS.paymentNotification,
]);
const PAYOUT_FORMATS: ReadonlySet<string> = new Set([
  EBANX_FORMATS.payoutResponse,
  EBANX_FORMATS.payoutNotification,
]);

function correlationKeys(event: NormalizedEvent): string[] {
  // The payment hash is shared by every pay-in operation and notification;
  // refunds, chargebacks and claims are nested in the payment. Payouts use
  // their uid. merchant_payment_code is never used.
  const ref = event.paymentReference;
  if (!ref) return [];
  if (PAYIN_FORMATS.has(event.sourceFormat)) return [`hash:${ref}`];
  if (PAYOUT_FORMATS.has(event.sourceFormat)) return [`payout:${ref}`];
  return [];
}

export const ebanxAdapter: ProviderAdapter<EbanxParsed> = {
  id: PROVIDER,
  displayName: "EBANX",
  version: EBANX_ADAPTER_VERSION,
  manifest: ebanxManifest,
  supportedFormats: [
    {
      id: EBANX_FORMATS.payinResponse,
      description:
        "Pay-in Direct API response (/ws/direct, /ws/query, /ws/capture, /ws/cancel, /ws/refund) with the payment object",
    },
    {
      id: EBANX_FORMATS.payinError,
      description: "Pay-in error envelope (status ERROR, status_code, status_message)",
    },
    {
      id: EBANX_FORMATS.paymentNotification,
      description: "Payment notification form post (operation, notification_type, hash_codes)",
    },
    {
      id: EBANX_FORMATS.payoutResponse,
      description: "Payout API response (type with a payout object, or an HP-* error)",
    },
    {
      id: EBANX_FORMATS.payoutNotification,
      description: "Payout notification form post (operation payout_status_*, hash_codes)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default ebanxAdapter;
