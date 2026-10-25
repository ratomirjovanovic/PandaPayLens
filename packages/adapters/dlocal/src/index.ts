/**
 * dLocal adapter (Payins API and Payouts v3).
 *
 * dLocal sends the same object as a synchronous response and as a
 * notification, with no event id and no event type. Each object type is its
 * own format, and `status_code` is decoded only with that object's table,
 * because dLocal reuses numbers across objects (700 is a verified payment, a
 * won chargeback and a compliance hold on a payout):
 *
 * - `dlocal.payins.payment`      payment object (POST /payments, GET /payments/{id}, notification)
 * - `dlocal.payins.refund`       refund object and refund notification (payment_id)
 * - `dlocal.payins.chargeback`   chargeback notification and object (payment_id)
 * - `dlocal.api_error`           HTTP error envelope (code, message, param) of Payins and Payouts v3
 * - `dlocal.payouts_v3.payout`   Payouts v3 payout object and notification
 *
 * Recognized but not analyzed: `dlocal.payins.callback` (browser callback
 * POST, not final per dLocal), `dlocal.payouts_v2.notification` (legacy form
 * notification without a status) and `dlocal.platforms.notification`.
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
  ARN_NOTIFICATION_TYPES,
  CALLBACK_STATUSES,
  CALLBACK_URL_DOCS,
  CHARGEBACK_STATUSES,
  HTTP_ERRORS_PAYMENTS_URL,
  HTTP_FALLBACK,
  MERCHANT_ADVICE_CODES,
  NETWORK_RESPONSE_URL,
  NEXT_ACTION,
  PAYINS_ERROR_ROWS,
  PAYMENT_METHOD_FLOWS,
  PAYMENT_METHOD_TYPES,
  PAYMENT_PENDING_CODES,
  PAYMENT_REJECTION_CODES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_URL,
  PAYOUT_ERRORS_V3_URL,
  PAYOUT_V2_NOTIFICATION_URL,
  PAYOUT_V3_ERROR_ROWS,
  PAYOUT_V3_REJECTION_CODES,
  PAYOUT_V3_STATUSES,
  PLATFORMS_NOTIFICATIONS_URL,
  REFUND_STATUSES,
  RETRY_TEXT,
  SETTLES_LATER,
  reasonReadings,
  type ApiErrorRow,
  type StatusInfo,
} from "./catalog.js";

import { dlocalManifest, DLOCAL_ADAPTER_VERSION } from "./manifest.js";

export { dlocalManifest, DLOCAL_ADAPTER_VERSION };

const PROVIDER = "dlocal";

export const DLOCAL_FORMATS = {
  payment: "dlocal.payins.payment",
  refund: "dlocal.payins.refund",
  chargeback: "dlocal.payins.chargeback",
  apiError: "dlocal.api_error",
  payout: "dlocal.payouts_v3.payout",
  callback: "dlocal.payins.callback",
  payoutV2: "dlocal.payouts_v2.notification",
  platforms: "dlocal.platforms.notification",
} as const;

// `status_code` is a string for payments and payouts but an integer in some
// refund and chargeback examples; both are accepted.
const Code = z.union([z.string().max(16), z.number().int()]);
const NCode = Code.nullable().optional();
const NStr = (max: number) => z.string().max(max).nullable().optional();
const NNum = z
  .union([z.number(), z.string().max(40)])
  .nullable()
  .optional();
const Id = z.string().min(1).max(256);
const Status = z.string().min(1).max(64);

const Payment = z.looseObject({
  id: Id,
  status: Status,
  status_code: NCode,
  status_detail: NStr(1000),
  amount: NNum,
  currency: NStr(8),
  country: NStr(8),
  payment_method_id: NStr(64),
  payment_method_type: NStr(64),
  payment_method_flow: NStr(64),
  order_id: NStr(256),
  original_order_id: NStr(256),
  created_date: NStr(64),
  approved_date: NStr(64),
  authorization_id: NStr(256),
  type: NStr(32),
  card: z
    .looseObject({ brand: NStr(16) })
    .nullable()
    .optional(),
  acquirer: z
    .looseObject({
      network_response_code: NCode,
      network_response_description: NStr(500),
      merchant_advice_code: NCode,
      merchant_advice_description: NStr(500),
    })
    .nullable()
    .optional(),
  three_dsecure: z.looseObject({}).nullable().optional(),
  enrollment: z
    .looseObject({ id: NStr(256) })
    .nullable()
    .optional(),
  retry: z
    .looseObject({
      remaining_attempts: z.number().int().nullable().optional(),
      last_attemptable_date: NStr(64),
    })
    .nullable()
    .optional(),
  refunds: z.array(z.unknown()).max(1000).nullable().optional(),
});

const Refund = z.looseObject({
  id: Id,
  payment_id: Id,
  status: Status,
  status_code: NCode,
  status_detail: NStr(1000),
  amount: NNum,
  currency: NStr(8),
  amount_refunded: NNum,
  order_refund_id: NStr(256),
  created_date: NStr(64),
  type: NStr(32),
});

const Chargeback = z.looseObject({
  id: Id,
  payment_id: Id,
  status: Status,
  status_code: NCode,
  status_detail: NStr(1000),
  amount: NNum,
  currency: NStr(8),
  order_id: NStr(256),
  created_date: NStr(64),
  chargeback_date: NStr(64),
  chargeback_stage: NStr(64),
  processor_id: NCode,
  reason_code: NCode,
  reason_description: NStr(500),
  type: NStr(32),
});

const Payout = z.looseObject({
  id: Id,
  status: Status,
  status_code: NCode,
  status_detail: NStr(1000),
  external_id: NStr(256),
  last_updated: NStr(64),
  on_hold: z.boolean().nullable().optional(),
  flow_type: NStr(64),
});

const ApiError = z.looseObject({
  code: Code,
  message: NStr(2000),
  param: NStr(256),
});

export type DlocalParsed =
  | { kind: "payment"; value: z.infer<typeof Payment> }
  | { kind: "refund"; value: z.infer<typeof Refund> }
  | { kind: "chargeback"; value: z.infer<typeof Chargeback> }
  | { kind: "payout"; value: z.infer<typeof Payout> }
  | { kind: "api_error"; value: z.infer<typeof ApiError> };

const SCHEMAS = {
  [DLOCAL_FORMATS.payment]: ["payment", Payment],
  [DLOCAL_FORMATS.refund]: ["refund", Refund],
  [DLOCAL_FORMATS.chargeback]: ["chargeback", Chargeback],
  [DLOCAL_FORMATS.payout]: ["payout", Payout],
  [DLOCAL_FORMATS.apiError]: ["api_error", ApiError],
} as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** `status_code` as a decimal string; integer and string forms are both documented. */
export function statusCodeOf(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? String(v) : undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return /^\d{1,4}$/.test(t) ? t : undefined;
}

function codeOf(v: unknown, re = /^[A-Za-z0-9_.-]{1,64}$/): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) v = String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return re.test(t) ? t : undefined;
}

const STATUS_WORD = /^[A-Z][A-Z_ ]{0,63}$/;

/**
 * dLocal dates: `2018-12-26T20:26:09.000+0000` (Payins), `...-00:00` (some
 * examples) and `...00.00Z` (Payouts v3). Values without a zone stay unknown.
 */
function dlocalDate(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const t = v.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return undefined;
  return toIsoTimestamp(t);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const CHARGEBACK_FIELDS = [
  "chargeback_date",
  "chargeback_stage",
  "reason_code",
  "reason_description",
  "processor_id",
];
const CHARGEBACK_ONLY = new Set([
  "DISPUTE_RECEIVED",
  "IN_DISPUTE",
  "DISPUTE_LOST",
  "REVERSAL",
  "INQUIRY",
]);
const REFUND_FIELDS = ["order_refund_id", "amount_refunded"];
const PAYOUT_STRONG = ["flow_type", "currency_to_pay", "on_hold", "amount_details"];
const PAYOUT_WEAK = ["statement_descriptor", "purpose", "remitter", "beneficiary", "last_updated"];
const PAYOUT_ONLY = new Set(["DELIVERED", "ON_HOLD", "ON_HOLD_BY_COMPLIANCE"]);
const ERROR_KEYS = new Set(["code", "message", "param"]);

export function apiErrorRows(code: string | undefined): ApiErrorRow[] {
  if (!code) return [];
  return [...PAYINS_ERROR_ROWS, ...PAYOUT_V3_ERROR_ROWS].filter((r) => r.code === code);
}

function errorCodeOf(v: unknown): string | undefined {
  const s = statusCodeOf(v);
  return s && /^\d{4}$/.test(s) ? s : undefined;
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
  // Stripe payloads carry `object`, Adyen notifications `notificationItems`.
  if (has(input, "object") || has(input, "notificationItems")) return none;
  const ok = (format: string, score: number, reasons: string[]): DetectionResult => ({
    provider: PROVIDER,
    format,
    confidence: round(score),
    supported: true,
    reasons,
  });
  const recognized = (
    format: string,
    score: number,
    reasons: string[],
    why: string,
  ): DetectionResult => ({
    provider: PROVIDER,
    format,
    confidence: score,
    supported: false,
    reasons,
    unsupportedReason: why,
  });

  const status = typeof input.status === "string" ? input.status : undefined;
  const detail = typeof input.status_detail === "string";
  const code = statusCodeOf(input.status_code) !== undefined;
  const flow =
    typeof input.payment_method_flow === "string" &&
    PAYMENT_METHOD_FLOWS.has(input.payment_method_flow);
  const paymentId = nonEmpty(input.payment_id);

  // dLocal for Platforms notification envelope.
  if (
    nonEmpty(input.event_type) &&
    has(input, "account_id") &&
    has(input, "notification_date") &&
    isObj(input.payload)
  ) {
    return recognized(
      DLOCAL_FORMATS.platforms,
      0.6,
      ["has event_type, account_id, notification_date and payload"],
      `dLocal for Platforms notifications are outside the first scope of this adapter and are recognized but not analyzed (${PLATFORMS_NOTIFICATIONS_URL}).`,
    );
  }

  // Legacy Payouts v2 form notification.
  if (
    has(input, "cashout_id") &&
    has(input, "control") &&
    has(input, "external_id") &&
    (has(input, "bank_reference_id") || has(input, "status_reason"))
  ) {
    return recognized(
      DLOCAL_FORMATS.payoutV2,
      0.65,
      ["has cashout_id, external_id and control with bank_reference_id or status_reason"],
      `This is a legacy dLocal Payouts v2 notification. It has no status field and the status_reason values are not documented, so it is recognized but not analyzed (${PAYOUT_V2_NOTIFICATION_URL}).`,
    );
  }

  // Browser callback POST after a REDIRECT flow.
  if (
    has(input, "paymentId") &&
    has(input, "date") &&
    has(input, "signature") &&
    status !== undefined &&
    CALLBACK_STATUSES.has(status)
  ) {
    return recognized(
      DLOCAL_FORMATS.callback,
      0.6,
      ["has paymentId, status, date and signature"],
      `This is the browser callback_url POST. dLocal says not to use its status to update the final payment status, so it is recognized but not analyzed; use the payment notification or GET /payments/{payment_id} instead (${CALLBACK_URL_DOCS}).`,
    );
  }

  // Payins payment object.
  const mtype =
    typeof input.payment_method_type === "string" &&
    PAYMENT_METHOD_TYPES.has(input.payment_method_type);
  const mid = nonEmpty(input.payment_method_id);
  const knownPayment = status !== undefined && Boolean(lookup(PAYMENT_STATUSES, status));
  if ((flow || (mtype && mid)) && (detail || code || knownPayment)) {
    const why = [
      flow ? "has payment_method_flow" : "has payment_method_type and payment_method_id",
    ];
    let s = flow ? 0.5 : 0.35;
    if (detail) {
      s += 0.15;
      why.push("has status_detail");
    }
    if (code) {
      s += 0.1;
      why.push("has a numeric status_code");
    }
    if (knownPayment) s += 0.1;
    if (mtype) s += 0.05;
    if (mid) s += 0.03;
    const nested =
      (isObj(input.ticket) &&
        (has(input.ticket, "barcode") || has(input.ticket, "provider_name"))) ||
      (isObj(input.bank_transfer) && has(input.bank_transfer, "payment_instruction")) ||
      (isObj(input.three_dsecure) && has(input.three_dsecure, "redirect_url")) ||
      (isObj(input.acquirer) && has(input.acquirer, "network_response_code"));
    if (nested) {
      s += 0.05;
      why.push("has a dLocal nested block");
    }
    return ok(DLOCAL_FORMATS.payment, s, why);
  }
  if (flow) return none;

  // Chargeback notification or object.
  const cbFields = CHARGEBACK_FIELDS.filter((k) => has(input, k));
  const cbOnly = status !== undefined && CHARGEBACK_ONLY.has(status);
  const type = typeof input.type === "string" ? input.type : undefined;
  if (
    paymentId &&
    type !== "REFUND" &&
    type !== "PAYMENT" &&
    (cbFields.length > 0 || cbOnly) &&
    (detail || code)
  ) {
    const why = ["has payment_id with chargeback fields or a chargeback-only status"];
    let s = 0.55 + 0.05 * Math.min(cbFields.length, 4);
    if (detail) s += 0.1;
    if (code) s += 0.05;
    if (status !== undefined && lookup(CHARGEBACK_STATUSES, status)) s += 0.05;
    return ok(DLOCAL_FORMATS.chargeback, s, why);
  }

  // Refund object or notification.
  const refundFields = REFUND_FIELDS.filter((k) => has(input, k));
  if (
    paymentId &&
    (refundFields.length > 0 || status === "SUCCESS" || type === "REFUND") &&
    (detail || code)
  ) {
    const why = ["has payment_id with refund fields or a refund-only status"];
    let s = 0.55 + 0.1 * refundFields.length;
    if (detail) s += 0.1;
    if (code) s += 0.05;
    if (status !== undefined && lookup(REFUND_STATUSES, status)) s += 0.05;
    return ok(DLOCAL_FORMATS.refund, s, why);
  }

  // Payouts v3 payout object or notification.
  const strong = PAYOUT_STRONG.filter((k) => has(input, k)).length;
  const weak = PAYOUT_WEAK.filter((k) => has(input, k)).length;
  const payoutOnly = status !== undefined && PAYOUT_ONLY.has(status);
  if (!paymentId && strong >= 1 && strong + weak >= 2 && (detail || code || payoutOnly)) {
    const why = ["has Payouts v3 fields (flow_type, currency_to_pay, on_hold or amount_details)"];
    let s = 0.5 + 0.05 * Math.min(strong + weak, 6);
    if (status !== undefined && lookup(PAYOUT_V3_STATUSES, status)) s += 0.1;
    if (detail) s += 0.05;
    if (code) s += 0.03;
    return ok(DLOCAL_FORMATS.payout, s, why);
  }

  // HTTP error envelope. The shape is generic, so it never scores above 0.5.
  const keys = Object.keys(input);
  if (
    keys.length >= 2 &&
    keys.every((k) => ERROR_KEYS.has(k)) &&
    nonEmpty(input.message) &&
    (input.param === undefined || typeof input.param === "string")
  ) {
    const errCode = errorCodeOf(input.code);
    const rows = apiErrorRows(errCode);
    const http = meta?.http?.status;
    if (rows.length) {
      const mismatch = http !== undefined && !rows.some((r) => r.http.includes(http));
      return ok(DLOCAL_FORMATS.apiError, mismatch ? 0.4 : 0.5, [
        `code ${errCode} is a documented dLocal error code`,
        ...(http !== undefined && !mismatch ? ["HTTP status matches the documented status"] : []),
      ]);
    }
    if (errCode && Number(errCode) >= 3000 && Number(errCode) < 8000)
      return ok(DLOCAL_FORMATS.apiError, 0.25, [
        "code, message envelope with a four-digit code in a dLocal range",
      ]);
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: DlocalParsed } | { ok: false; issues: string[] } {
  if (!Object.prototype.hasOwnProperty.call(SCHEMAS, format))
    return { ok: false, issues: [`Unsupported dLocal format "${format}".`] };
  const [kind, schema] = SCHEMAS[format as keyof typeof SCHEMAS];
  const r = schema.safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind, value: r.data } as DlocalParsed };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function money(
  value: unknown,
  currencyField: unknown,
): { minor?: string; currency?: string; raw?: true } {
  const currency = upperCurrency(currencyField);
  if (value === undefined || value === null) return currency ? { currency } : {};
  const minor = decimalToMinor(value, currency);
  return {
    ...(currency ? { currency } : {}),
    ...(minor !== undefined ? { minor } : { raw: true }),
  };
}

/** A pasted HTTP request is a notification to the merchant; a response answers a request. */
function messageAttrs(meta: RecordMeta | undefined): [string, unknown][] {
  const http = meta?.http;
  if (!http) return [];
  const out: [string, unknown][] = [
    ["message", http.kind === "request" ? "notification" : "response"],
    ["httpStatus", http.status],
  ];
  if (http.kind === "request" && has(http.headers, "authorization"))
    out.push(["signatureHeaderPresent", true], ["signatureVerified", false]);
  return out;
}

type StatusRead = {
  info: StatusInfo | undefined;
  statusCode: string | undefined;
  /** The status_code is not the one documented for this status. */
  mismatch: boolean;
};

function readStatus(
  table: Record<string, StatusInfo>,
  status: string,
  rawCode: unknown,
): StatusRead {
  const info = lookup(table, status);
  const statusCode = statusCodeOf(rawCode);
  return { info, statusCode, mismatch: Boolean(info && statusCode && statusCode !== info.code) };
}

function eventName(object: string, status: string): string {
  return `${object}.${STATUS_WORD.test(status) ? status : "unknown"}`;
}

function base(ctx: NormalizeContext) {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

const APPROVED_STATUSES = new Set(["PAID", "AUTHORIZED", "VERIFIED"]);

function paymentEvent(v: z.infer<typeof Payment>, ctx: NormalizeContext): NormalizedEventDraft {
  const status = v.status;
  const info = lookup(PAYMENT_STATUSES, status);
  const statusCode = statusCodeOf(v.status_code);
  let stage: LifecycleStage = info?.stage ?? "payment";
  const outcome: Outcome = info?.outcome ?? "unknown";
  let codeMeaning: string | undefined;
  let codeKnown: boolean | undefined;
  let mismatch = false;
  if (status === "PENDING") {
    const p = lookup(PAYMENT_PENDING_CODES, statusCode);
    if (p) stage = p.stage;
    codeMeaning = p?.meaning;
    codeKnown = statusCode ? Boolean(p) : undefined;
  } else if (status === "REJECTED") {
    codeMeaning = lookup(PAYMENT_REJECTION_CODES, statusCode)?.meaning;
    codeKnown = statusCode ? Boolean(codeMeaning) : undefined;
  } else if (info && statusCode) {
    mismatch = statusCode !== info.code;
  }
  // A capture is a new payment carrying the authorization_id of the authorization.
  const authorizationId = safeId(v.authorization_id, 256);
  if (authorizationId && (status === "PAID" || status === "REJECTED")) stage = "capture";

  const methodType = codeOf(v.payment_method_type);
  const approved = APPROVED_STATUSES.has(status) ? dlocalDate(v.approved_date) : undefined;
  const created = dlocalDate(v.created_date);
  const amount = money(v.amount, v.currency);
  const acquirer = v.acquirer ?? undefined;
  const threeDs = v.three_dsecure ?? undefined;
  const arnType =
    typeof v.type === "string" && ARN_NOTIFICATION_TYPES.has(v.type) ? v.type : undefined;

  return clean({
    ...base(ctx),
    eventType: eventName("payment", status),
    eventTypeKnown: Boolean(info),
    stage,
    providerStatus: safeText(status, 64),
    paymentReference: safeId(v.id, 256),
    relatedReference: authorizationId,
    merchantReference: merchantRef(v.order_id),
    subscriptionReference: safeId(v.enrollment?.id, 256),
    eventTimestamp: approved ?? created,
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome,
    attributes: attrs([
      ["objectType", "payment"],
      ["apiFamily", "Payins"],
      ...messageAttrs(ctx.meta),
      ["statusCode", statusCode],
      ["statusMeaning", info?.meaning],
      ["statusCodeMeaning", codeMeaning],
      ["statusCodeKnown", codeKnown],
      ["statusCodeMismatch", mismatch || undefined],
      ["statusDetail", v.status_detail],
      ["paymentMethodId", codeOf(v.payment_method_id)],
      ["paymentMethodType", methodType],
      ["paymentMethodFlow", codeOf(v.payment_method_flow)],
      ["country", codeOf(v.country, /^[A-Z]{2}$/)],
      ["cardBrand", codeOf(v.card?.brand, /^[A-Z]{2,4}$/)],
      ["isCapture", authorizationId ? true : undefined],
      ["zeroAmountVerification", status === "VERIFIED" ? true : undefined],
      [
        "pendingReason",
        status === "PENDING" && methodType ? lookup(SETTLES_LATER, methodType) : undefined,
      ],
      ["threeDSecureRedirect", isObj(threeDs) && has(threeDs, "redirect_url") ? true : undefined],
      ["networkResponseCode", codeOf(acquirer?.network_response_code, /^[A-Za-z0-9]{1,4}$/)],
      ["networkResponseDescription", acquirer?.network_response_description],
      ["merchantAdviceCode", codeOf(acquirer?.merchant_advice_code, /^\d{2}$/)],
      ["retryRemainingAttempts", v.retry?.remaining_attempts],
      ["retryLastAttemptableDate", dlocalDate(v.retry?.last_attemptable_date)],
      ["originalOrderId", merchantRef(v.original_order_id)],
      ["refundCount", v.refunds?.length],
      ["notificationType", arnType],
      ["arnPresent", has(v, "arn") ? true : undefined],
      ["timestampSource", approved ? "approved_date" : created ? "created_date" : undefined],
      ["amountNotConvertible", amount.raw],
    ]),
  });
}

function refundEvent(v: z.infer<typeof Refund>, ctx: NormalizeContext): NormalizedEventDraft {
  const s = readStatus(REFUND_STATUSES, v.status, v.status_code);
  const amount = money(v.amount, v.currency);
  const refunded = money(v.amount_refunded, v.currency);
  const arnType =
    typeof v.type === "string" && ARN_NOTIFICATION_TYPES.has(v.type) ? v.type : undefined;
  return clean({
    ...base(ctx),
    eventType: eventName("refund", v.status),
    eventTypeKnown: Boolean(s.info),
    stage: "refund",
    providerStatus: safeText(v.status, 64),
    paymentReference: safeId(v.payment_id, 256),
    relatedReference: safeId(v.id, 256),
    merchantReference: merchantRef(v.order_refund_id),
    eventTimestamp: dlocalDate(v.created_date),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: s.info?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "refund"],
      ["apiFamily", "Payins"],
      ...messageAttrs(ctx.meta),
      ["statusCode", s.statusCode],
      ["statusCodeType", v.status_code == null ? undefined : typeof v.status_code],
      ["statusMeaning", s.info?.meaning],
      ["statusCodeMismatch", s.mismatch || undefined],
      ["statusDetail", v.status_detail],
      ["amountRefundedMinor", refunded.minor],
      ["notificationType", arnType],
      ["arnPresent", has(v, "arn") ? true : undefined],
      ["amountNotConvertible", amount.raw],
    ]),
  });
}

function reasonAttrs(raw: unknown): [string, unknown][] {
  const code = codeOf(raw, /^[A-Za-z0-9.]{1,16}$/);
  if (!code) return [];
  const readings = reasonReadings(code);
  if (!readings.length)
    return [
      ["reasonCode", code],
      ["reasonCodeKnown", false],
    ];
  const fraud = new Set(readings.map((r) => r.fraudGroup));
  return [
    ["reasonCode", code],
    ["reasonCodeKnown", true],
    ["reasonNetworks", readings.map((r) => r.network)],
    ["reasonReadings", readings.map((r) => `${r.network}: ${r.meaning} (${r.group})`)],
    ["reasonFraudGroup", fraud.size === 1 ? readings[0]!.fraudGroup : undefined],
    ["reasonCodeAmbiguous", readings.length > 1 ? true : undefined],
  ];
}

function chargebackEvent(
  v: z.infer<typeof Chargeback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const s = readStatus(CHARGEBACK_STATUSES, v.status, v.status_code);
  const amount = money(v.amount, v.currency);
  return clean({
    ...base(ctx),
    eventType: eventName("chargeback", v.status),
    eventTypeKnown: Boolean(s.info),
    stage: "dispute",
    providerStatus: safeText(v.status, 64),
    paymentReference: safeId(v.payment_id, 256),
    relatedReference: safeId(v.id, 256),
    merchantReference: merchantRef(v.order_id),
    eventTimestamp: dlocalDate(v.created_date),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: s.info?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "chargeback"],
      ["apiFamily", "Payins"],
      ...messageAttrs(ctx.meta),
      ["statusCode", s.statusCode],
      ["statusCodeType", v.status_code == null ? undefined : typeof v.status_code],
      ["statusMeaning", s.info?.meaning],
      ["statusCodeMismatch", s.mismatch || undefined],
      ["statusFinal", s.info?.final],
      ["statusDetail", v.status_detail],
      ["chargebackDate", dlocalDate(v.chargeback_date)],
      ["chargebackStage", codeOf(v.chargeback_stage)],
      ["processorId", codeOf(v.processor_id)],
      ...reasonAttrs(v.reason_code),
      ["reasonDescription", v.reason_description],
      ["arnPresent", has(v, "arn") ? true : undefined],
      ["amountNotConvertible", amount.raw],
    ]),
  });
}

function payoutEvent(v: z.infer<typeof Payout>, ctx: NormalizeContext): NormalizedEventDraft {
  const info = lookup(PAYOUT_V3_STATUSES, v.status);
  const statusCode = statusCodeOf(v.status_code);
  // After a rejection, status_code carries the rejection code instead of 300.
  const rejection =
    v.status === "REJECTED" ? lookup(PAYOUT_V3_REJECTION_CODES, statusCode) : undefined;
  const mismatch =
    Boolean(info && statusCode && statusCode !== info.code) && v.status !== "REJECTED";
  return clean({
    ...base(ctx),
    eventType: eventName("payout", v.status),
    eventTypeKnown: Boolean(info),
    stage: "payout",
    providerStatus: safeText(v.status, 64),
    paymentReference: safeId(v.id, 256),
    merchantReference: merchantRef(v.external_id),
    eventTimestamp: dlocalDate(v.last_updated),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "payout"],
      ["apiFamily", "Payouts v3"],
      ...messageAttrs(ctx.meta),
      ["statusCode", statusCode],
      ["statusMeaning", info?.meaning],
      ["statusNote", info?.note],
      ["statusCodeMeaning", rejection?.meaning],
      [
        "statusCodeKnown",
        v.status === "REJECTED" && statusCode && statusCode !== "300"
          ? Boolean(rejection)
          : undefined,
      ],
      ["statusCodeMismatch", mismatch || undefined],
      ["statusDetail", v.status_detail],
      ["onHold", v.on_hold],
      ["flowType", codeOf(v.flow_type)],
      ["amountNotRead", true],
    ]),
  });
}

const FIELD_NAME = /^[A-Za-z0-9_.[\]-]{1,64}$/;

function errorEvent(e: z.infer<typeof ApiError>, ctx: NormalizeContext): NormalizedEventDraft {
  const code = errorCodeOf(e.code) ?? codeOf(e.code);
  const http = ctx.meta?.http?.status;
  return clean({
    ...base(ctx),
    eventType: `api_error${code ? `.${code}` : ""}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: http !== undefined ? `HTTP ${http}` : code,
    outcome: "unknown",
    attributes: attrs([
      ["code", code],
      ["message", e.message],
      ["param", codeOf(e.param, FIELD_NAME)],
      ["httpStatus", http],
    ]),
  });
}

function normalize(parsed: DlocalParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "payment":
      return [paymentEvent(parsed.value, ctx)];
    case "refund":
      return [refundEvent(parsed.value, ctx)];
    case "chargeback":
      return [chargebackEvent(parsed.value, ctx)];
    case "payout":
      return [payoutEvent(parsed.value, ctx)];
    case "api_error":
      return [errorEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
  attemptReference?: string;
};

type Verdict = {
  code: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  retryNotes?: string[];
  docs: DocumentationLink[];
  missing: string[];
  subCodes: Record<string, string>;
  message?: string;
  outcomeKnown?: boolean;
};

function uniqueDocs(docs: DocumentationLink[]): DocumentationLink[] {
  const seen = new Set<string>();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

function draft(loc: Location, v: Verdict): DecodedErrorDraft {
  return {
    sourceFormat: loc.sourceFormat,
    source: loc.source,
    ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
    ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
    code: v.code,
    subCodes: v.subCodes,
    category: v.category,
    ...(v.message ? { providerMessage: v.message } : {}),
    explanation: v.explanation,
    nextAction: NEXT_ACTION[v.category],
    retry: v.retry,
    retryExplanation: [RETRY_TEXT[v.retry], ...(v.retryNotes ?? [])].join(" "),
    confidence: v.confidence,
    documentation: uniqueDocs(v.docs),
    missingInformation: v.missing,
    ...(v.outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

export function decodePaymentRejection(
  v: z.infer<typeof Payment>,
  loc: Location,
): DecodedErrorDraft {
  const statusCode = statusCodeOf(v.status_code);
  const entry = lookup(PAYMENT_REJECTION_CODES, statusCode);
  const acquirer = v.acquirer ?? undefined;
  const nrc = codeOf(acquirer?.network_response_code, /^[A-Za-z0-9]{1,4}$/);
  const mac = codeOf(acquirer?.merchant_advice_code, /^\d{2}$/);
  const advice = lookup(MERCHANT_ADVICE_CODES, mac);
  const subCodes: Record<string, string> = { object: "payment", status: "REJECTED" };
  if (nrc) subCodes.network_response_code = nrc;
  if (mac) subCodes.merchant_advice_code = mac;
  const docs: DocumentationLink[] = [
    { title: "dLocal payment status codes", url: PAYMENT_STATUS_URL },
  ];
  if (acquirer) docs.push({ title: "dLocal network response data", url: NETWORK_RESPONSE_URL });
  const missing: string[] = [];
  const parts: string[] = [];
  const retryNotes: string[] = [];

  if (entry) parts.push(`dLocal payment rejection ${statusCode}: ${entry.meaning}.`);
  else if (statusCode)
    missing.push(
      `Rejection code "${statusCode}" is not in the PandaPayLens catalog for dLocal payments.`,
    );
  else missing.push("The rejected payment carries no status_code, so the reason is unknown.");
  if (nrc)
    parts.push(
      `The acquirer block passes on network response code ${nrc}; dLocal does not list the meaning of raw network codes.`,
    );
  if (advice) {
    parts.push(`Mastercard merchant advice code ${mac} (${advice.type}): ${advice.meaning}.`);
    retryNotes.push(
      "dLocal: when a merchant advice code is present, it takes precedence over the network response code for retry decisions.",
    );
  } else if (mac) missing.push(`Merchant advice code "${mac}" is not in the PandaPayLens catalog.`);
  if (!entry && !parts.length) parts.push("dLocal rejected the payment.");

  const retry: RetryGuidance = advice?.retry ?? entry?.retry ?? "unknown";
  return draft(loc, {
    code: statusCode ?? "REJECTED",
    category: entry?.category ?? "unknown",
    retry,
    confidence: entry ? "strong" : "insufficient",
    explanation: parts.join(" "),
    retryNotes,
    docs,
    missing,
    subCodes,
    ...(v.status_detail ? { message: safeText(v.status_detail, 200) } : {}),
    // A REJECTED payment is a definitive answer.
    outcomeKnown: true,
  });
}

export function decodePayoutRejection(v: z.infer<typeof Payout>, loc: Location): DecodedErrorDraft {
  const statusCode = statusCodeOf(v.status_code);
  const entry = lookup(PAYOUT_V3_REJECTION_CODES, statusCode);
  const subCodes: Record<string, string> = { object: "payout", status: "REJECTED" };
  const docs = [{ title: "dLocal Payouts v3 rejection codes", url: PAYOUT_ERRORS_V3_URL }];
  const message = v.status_detail ? safeText(v.status_detail, 200) : undefined;
  const common = { subCodes, docs, outcomeKnown: true, ...(message ? { message } : {}) };
  if (entry)
    return draft(loc, {
      ...common,
      code: statusCode!,
      category: entry.category,
      retry: entry.retry,
      confidence: "strong",
      explanation: `dLocal payout rejection ${statusCode}: ${entry.meaning}.`,
      retryNotes:
        entry.retry === "retry_conditionally"
          ? [
              "A new payout should only be sent once GET /payouts/v3 confirms this one was not paid.",
            ]
          : [],
      missing: [],
    });
  if (statusCode === "300" || !statusCode)
    return draft(loc, {
      ...common,
      code: statusCode ?? "REJECTED",
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      explanation: "The payout was rejected without a specific rejection code.",
      missing: ["status_code carries no payout rejection code, so the reason is not shown."],
    });
  return draft(loc, {
    ...common,
    code: statusCode,
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation:
      "The payout was rejected with a code that is not a documented payout rejection code.",
    missing: [
      `Rejection code "${statusCode}" is not in the PandaPayLens catalog for dLocal payouts.`,
    ],
  });
}

function rowLabel(r: ApiErrorRow): string {
  return r.family === "payouts_v3" ? "Payouts v3" : `Payins (${(r.pages ?? []).join(", ")})`;
}

export function decodeApiError(
  e: z.infer<typeof ApiError>,
  http: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = errorCodeOf(e.code);
  let rows = apiErrorRows(code);
  const subCodes: Record<string, string> = {};
  if (http !== undefined) subCodes.http_status = String(http);
  const param = codeOf(e.param, FIELD_NAME);
  if (param) subCodes.param = param;
  const missing: string[] = [];
  const message = safeText(e.message ?? undefined, 200);
  const shown = code ?? codeOf(e.code) ?? "unknown";

  if (rows.length && http !== undefined) {
    const same = rows.filter((r) => r.http.includes(http));
    if (same.length) rows = same;
    else
      missing.push(
        `The documented HTTP status for ${code} is ${[...new Set(rows.flatMap((r) => r.http))].join(" or ")}, but the record arrived with HTTP ${http}.`,
      );
  }
  if (rows.length && http === undefined)
    missing.push("No HTTP status was supplied, so the documented status could not be checked.");

  if (!rows.length) {
    const fb = http !== undefined ? lookup(HTTP_FALLBACK, http) : undefined;
    missing.push(
      `Code "${shown}" is not in the PandaPayLens catalog for the dLocal Payins API or Payouts v3.`,
    );
    return draft(loc, {
      code: shown,
      category: fb?.category ?? "unknown",
      retry: fb?.retry ?? "unknown",
      confidence: fb && fb.category !== "unknown" ? "possible" : "insufficient",
      explanation: fb
        ? `HTTP ${http}: ${fb.meaning}. The dLocal code ${shown} is not documented in the tables PandaPayLens knows.`
        : `PandaPayLens does not recognize the dLocal error code ${shown}.`,
      docs: [{ title: "dLocal HTTP errors: payments", url: HTTP_ERRORS_PAYMENTS_URL }],
      missing,
      subCodes,
      ...(message ? { message } : {}),
    });
  }

  const docs = rows.map((r) => ({ title: `dLocal error codes: ${rowLabel(r)}`, url: r.docsUrl }));
  const families = [...new Set(rows.map((r) => r.family))];
  subCodes.api_family = families
    .map((f) => (f === "payins" ? "Payins" : "Payouts v3"))
    .join(" or ");

  if (rows.length === 1) {
    const r = rows[0]!;
    const matched = http !== undefined && r.http.includes(http);
    return draft(loc, {
      code: shown,
      category: r.category,
      retry: r.retry,
      confidence: matched ? "strong" : "possible",
      explanation: `dLocal ${rowLabel(r)} error ${shown}: ${r.meaning}.`,
      retryNotes: r.providerAdvice ? [`dLocal advice: ${r.providerAdvice}.`] : [],
      docs,
      missing,
      subCodes,
      ...(message ? { message } : {}),
    });
  }

  // The body does not show which API family or page answered.
  const categories = new Set(rows.map((r) => r.category));
  const retries = new Set(rows.map((r) => r.retry));
  const category = categories.size === 1 ? rows[0]!.category : "unknown";
  const retry = retries.size === 1 ? rows[0]!.retry : "manual_review";
  missing.push(
    `Code ${shown} has several documented meanings (${rows.map(rowLabel).join("; ")}); the error body does not show which API answered.`,
  );
  return draft(loc, {
    code: shown,
    category,
    retry,
    confidence: category === "unknown" ? "insufficient" : "possible",
    explanation: `dLocal error ${shown} has several documented meanings: ${rows
      .map((r) => `${rowLabel(r)}: ${r.meaning}`)
      .join("; ")}.`,
    docs,
    missing,
    subCodes,
    ...(message ? { message } : {}),
  });
}

function decodeErrors(parsed: DlocalParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const loc = { sourceFormat: ctx.format, source: { recordIndex: ctx.recordIndex, path: "" } };
  switch (parsed.kind) {
    case "payment": {
      if (parsed.value.status !== "REJECTED") return [];
      const ref = safeId(parsed.value.id, 256);
      return [
        decodePaymentRejection(parsed.value, {
          ...loc,
          ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
        }),
      ];
    }
    case "payout": {
      if (parsed.value.status !== "REJECTED") return [];
      const ref = safeId(parsed.value.id, 256);
      return [
        decodePayoutRejection(parsed.value, {
          ...loc,
          ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
        }),
      ];
    }
    case "api_error":
      return [decodeApiError(parsed.value, ctx.meta?.http?.status, loc)];
    default:
      return [];
  }
}

export const dlocalAdapter: ProviderAdapter<DlocalParsed> = {
  id: PROVIDER,
  displayName: "dLocal",
  version: DLOCAL_ADAPTER_VERSION,
  manifest: dlocalManifest,
  supportedFormats: [
    {
      id: DLOCAL_FORMATS.payment,
      description: "Payins payment object (response or payment notification)",
    },
    {
      id: DLOCAL_FORMATS.refund,
      description: "Payins refund object (response or refund notification)",
    },
    {
      id: DLOCAL_FORMATS.chargeback,
      description: "Payins chargeback notification or chargeback object",
    },
    {
      id: DLOCAL_FORMATS.apiError,
      description: "HTTP error envelope (code, message, param) of the Payins API and Payouts v3",
    },
    {
      id: DLOCAL_FORMATS.payout,
      description: "Payouts v3 payout object (response or payout notification)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // dLocal identifiers only, in a key space per object: payment ids (and the
    // authorization_id of a capture), refund ids and chargeback ids, which
    // join payments through payment_id, and payout ids. Merchant references
    // are never keys.
    const p = event.paymentReference;
    const r = event.relatedReference;
    const keys: string[] = [];
    switch (event.sourceFormat) {
      case DLOCAL_FORMATS.payment:
        if (p) keys.push(`payin:${p}`);
        if (r) keys.push(`payin:${r}`);
        break;
      case DLOCAL_FORMATS.refund:
        if (p) keys.push(`payin:${p}`);
        if (r) keys.push(`refund:${r}`);
        break;
      case DLOCAL_FORMATS.chargeback:
        if (p) keys.push(`payin:${p}`);
        if (r) keys.push(`chargeback:${r}`);
        break;
      case DLOCAL_FORMATS.payout:
        if (p) keys.push(`payout:${p}`);
        break;
    }
    return keys;
  },
};

export * from "./catalog.js";
export default dlocalAdapter;
