/**
 * Nuvei adapter (REST API 1.0 and DMNs).
 *
 * Supported input families:
 * - `nuvei.rest_response`   REST API 1.0 JSON response: status, errCode and reason
 *                           (the request), transactionStatus with gwErrorCode,
 *                           gwExtendedErrorCode and gwErrorReason (gateway and bank)
 *                           and paymentMethodErrorCode / paymentMethodErrorReason (APM)
 * - `nuvei.payment_dmn`     payment DMN as a query string or form body (ppp_status,
 *                           Status, ErrCode, ExErrCode, Reason, ReasonCode)
 * - `nuvei.withdrawal_dmn`  withdrawal DMN (wdRequestId, wdRequestStatus, wdOrderStatus)
 * - `nuvei.chargeback_dmn`  Control Panel event DMN with EventType Chargeback
 *
 * Recognized but not analyzed: other Control Panel event types
 * (`nuvei.event_dmn`), subscription DMNs (`nuvei.subscription_dmn`) and the
 * Payment Page redirect parameters (`nuvei.payment_page_redirect`).
 *
 * Nuvei's numeric code spaces overlap (errCode 1001 is an invalid checksum,
 * gwExtendedErrorCode 1001 an invalid expiry date), so every code is decoded
 * by the field that carries it. APPROVED and PENDING share the gateway pair
 * 0/0; outcomes come from the status fields only.
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
  AMBIGUOUS_THREE_DS_REASONS,
  API_STATUSES,
  AUTO_SETTLE_MODES,
  AVS_CODES,
  CARD_PAYMENT_METHODS,
  CHARGEBACK_STATUS_CATEGORIES,
  CHARGEBACK_TYPES,
  CVV2_REPLIES,
  DMN_STATUSES,
  DMN_TYPES,
  DUPLICATED_FILTER_CODES,
  EVENT_TYPES,
  FILTER_ERROR_CODES,
  FRAUD_DECISIONS,
  GATEWAY_RESPONSE_ROWS,
  JAVA_SDK_URL,
  MARKETPLACE_ERROR_CODES,
  MERCHANT_ADVICE_CODES,
  NEXT_ACTION,
  PARTIAL_APPROVAL_STATUSES,
  PAYMENT_DMNS_URL,
  PPP_STATUSES,
  PROCESSING_ENTITY_TYPES,
  REQUEST_ERROR_CODES,
  RESPONSE_HANDLING_URL,
  REST_FLOW_URL,
  RETRY_TEXT,
  SDK_ERROR_CODE_NAMES,
  SETTLEMENT_TYPES,
  SUBSCRIPTION_DMN_TYPES,
  THREE_DS_REASONS,
  THREE_DS_RESPONSES_URL,
  THREE_DS_RESULTS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  WD_ORDER_STATUSES,
  WD_REQUEST_STATES,
  WD_REQUEST_STATUSES,
  WITHDRAWAL_DMNS_URL,
  WITHDRAWAL_NOTIFICATION_TYPE,
  findDeclineReason,
  type CodeEntry,
  type GatewayRow,
  type StatusInfo,
  type TransactionTypeInfo,
} from "./catalog.js";
import { nuveiManifest, NUVEI_ADAPTER_VERSION } from "./manifest.js";

export { nuveiManifest, NUVEI_ADAPTER_VERSION };

const PROVIDER = "nuvei";

export const NUVEI_FORMATS = {
  restResponse: "nuvei.rest_response",
  paymentDmn: "nuvei.payment_dmn",
  withdrawalDmn: "nuvei.withdrawal_dmn",
  chargebackDmn: "nuvei.chargeback_dmn",
  eventDmn: "nuvei.event_dmn",
  subscriptionDmn: "nuvei.subscription_dmn",
  paymentPageRedirect: "nuvei.payment_page_redirect",
} as const;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const own = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * DMN field names differ in case between Nuvei's tables and examples
 * (PPP_TransactionID, ppp_TransactionId, TransactionID, TransactionId), so
 * the exact name wins and a case-insensitive match is the fallback.
 */
function fieldOf(o: Obj, name: string): unknown {
  if (own(o, name)) return o[name];
  const lower = name.toLowerCase();
  for (const k of Object.keys(o)) if (k.toLowerCase() === lower) return o[k];
  return undefined;
}

const hasField = (o: Obj, name: string) => fieldOf(o, name) !== undefined;

function strOf(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

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

/** Integer codes arrive as JSON numbers or as numeric strings. */
function intCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (/^-?\d{1,9}$/.test(t)) return String(Number(t));
  }
  return undefined;
}

/** Codes of undocumented vocabularies: identifier-like only, never free text. */
function looseCode(v: unknown): string | undefined {
  const t = typeof v === "number" && Number.isFinite(v) ? String(v) : strOf(v)?.trim();
  return t !== undefined && /^[0-9A-Za-z._-]{1,32}$/.test(t) ? t : undefined;
}

/** Two-digit code values ("01"), also when sent as a JSON number. */
function twoDigit(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 100)
    return String(v).padStart(2, "0");
  const t = strOf(v)?.trim();
  return t !== undefined && /^\d{1,2}$/.test(t) ? t.padStart(2, "0") : undefined;
}

/**
 * Nuvei identifiers. Numbers beyond 2^53 have lost precision in JSON parsing
 * and are dropped; all-zero values mean "none".
 */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? String(v) : undefined;
  const id = safeId(v, 128);
  if (!id || /^0+$/.test(id)) return undefined;
  // Merchant-assigned values are free text; drop any that look like personal data.
  return safeText(id, 128) === id ? id : undefined;
}

const HEX_CHECKSUM = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/i;
const DMN_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})\.(\d{2}:\d{2}:\d{2})$/;
const APM_METHOD = /^apmgw_[A-Za-z0-9_]{1,40}$/;

const round = (n: number) => Math.round(Math.min(0.95, n) * 100) / 100;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectForm(o: Obj): DetectionResult | null {
  const base = { provider: PROVIDER, supported: true };
  const text = (k: string) => strOf(fieldOf(o, k));

  // Withdrawal DMN: the wd* request and order fields are Nuvei-specific.
  if (
    hasField(o, "wdRequestId") &&
    (hasField(o, "wdRequestStatus") ||
      hasField(o, "wdRequestState") ||
      hasField(o, "wdOrderStatus"))
  ) {
    let c = 0.55;
    const reasons = ["has wdRequestId with a withdrawal request or order status field"];
    if (text("notificationType") === WITHDRAWAL_NOTIFICATION_TYPE) {
      c += 0.2;
      reasons.push(`notificationType is ${WITHDRAWAL_NOTIFICATION_TYPE}`);
    }
    if (hasField(o, "wdOrderStatus") || hasField(o, "wdOrderId")) {
      c += 0.1;
      reasons.push("has withdrawal order fields");
    }
    if (/^[0-9a-f]{64}$/i.test(text("checksum") ?? "")) {
      c += 0.1;
      reasons.push("checksum has the length of a SHA-256 hex digest");
    }
    if (hasField(o, "userPMId") || hasField(o, "pmDisplayName")) c += 0.05;
    return { ...base, format: NUVEI_FORMATS.withdrawalDmn, confidence: round(c), reasons };
  }

  // Subscription DMNs of the rebilling service.
  const dmnType = text("dmnType");
  if (
    dmnType !== undefined &&
    SUBSCRIPTION_DMN_TYPES.has(dmnType) &&
    (hasField(o, "subscriptionId") || hasField(o, "planId") || hasField(o, "subscriptionState"))
  ) {
    let c = 0.6;
    if (HEX_CHECKSUM.test(text("responsechecksum") ?? "")) c += 0.1;
    if (hasField(o, "subscriptionId") && hasField(o, "planId")) c += 0.05;
    return {
      ...base,
      supported: false,
      format: NUVEI_FORMATS.subscriptionDmn,
      confidence: round(c),
      reasons: [`dmnType is "${dmnType}" with subscription fields`],
      unsupportedReason:
        "This looks like a Nuvei subscription DMN. The fields that tell a failed or retried rebill apart are not documented, so it is recognized but not analyzed. The payment DMN of the same rebill carries the payment status.",
    };
  }

  // Payment DMN or Payment Page redirect: any two of ppp_status,
  // PPP_TransactionID and advanceResponseChecksum are decisive.
  const ppp = text("ppp_status");
  const pppKnown =
    ppp !== undefined && lookup(PPP_STATUSES, ppp.trim().toUpperCase()) !== undefined;
  const pppId = hasField(o, "PPP_TransactionID");
  const checksum = HEX_CHECKSUM.test(text("advanceResponseChecksum") ?? "");
  const anchors = [pppKnown, pppId, checksum].filter(Boolean).length;
  if (anchors === 0) return null;
  const reasons: string[] = [];
  if (pppKnown) reasons.push("ppp_status is OK, FAIL or PENDING");
  if (pppId) reasons.push("has PPP_TransactionID");
  if (checksum)
    reasons.push("advanceResponseChecksum has the length of a SHA-256 or MD5 hex digest");
  let c = anchors === 1 ? 0.3 : anchors === 2 ? 0.6 : 0.7;
  // DMNs use Status and ErrCode; the redirect parameters are lower case.
  const dmnStatus = own(o, "Status");
  const redirect = !dmnStatus && own(o, "status") && !own(o, "ErrCode");
  if (dmnStatus && lookup(DMN_STATUSES, strOf(o.Status)?.trim().toUpperCase())) {
    c += 0.1;
    reasons.push("Status is a documented DMN status");
  }
  if (own(o, "ErrCode") && own(o, "ExErrCode")) {
    c += 0.1;
    reasons.push("has ErrCode and ExErrCode");
  }
  if (DMN_TIMESTAMP.test(text("responseTimeStamp") ?? "")) c += 0.05;
  const method = text("payment_method");
  if (method && (CARD_PAYMENT_METHODS.has(method) || APM_METHOD.test(method))) {
    c += 0.05;
    reasons.push("payment_method has a documented Nuvei value");
  }
  if (anchors === 1) {
    c = Math.min(c, 0.45);
    reasons.push(
      "only one of ppp_status, PPP_TransactionID and advanceResponseChecksum is present",
    );
  }
  if (redirect) {
    return {
      ...base,
      supported: false,
      format: NUVEI_FORMATS.paymentPageRedirect,
      confidence: round(c),
      reasons: [
        ...reasons,
        "lower-case status without Status or ErrCode, like the redirect parameters",
      ],
      unsupportedReason:
        "This looks like the Nuvei Payment Page parameters appended to the Success, Pending or Error URL. They reach the browser and are not a trustworthy final state; paste the payment DMN instead.",
    };
  }
  return { ...base, format: NUVEI_FORMATS.paymentDmn, confidence: round(c), reasons };
}

const EVENT_BLOCKS = ["Chargeback", "TransactionDetails", "Alert", "RDREvent", "Correction"];

function detectJson(o: Obj): DetectionResult | null {
  const base = { provider: PROVIDER, supported: true };

  // Control Panel event DMN (JSON with PascalCase keys).
  const eventType = strOf(o.EventType);
  if (eventType !== undefined) {
    const hasId = o.EventId != null || o.EventCorrelationId != null;
    if (!hasId) return null;
    const documented = EVENT_TYPES.has(eventType);
    let c = documented ? 0.35 : 0.15;
    const reasons = [
      documented
        ? "EventType is a documented Control Panel event"
        : "has EventType (not a documented value)",
    ];
    if (o.EventCorrelationId != null) {
      c += 0.2;
      reasons.push("has EventCorrelationId");
    }
    if (o.EventId != null) {
      c += 0.15;
      reasons.push("has EventId");
    }
    if (o.ClientId != null) c += 0.1;
    if (typeof o.EventDateUTC === "string") c += 0.05;
    if (o.AttemptNumber != null) c += 0.05;
    if (
      typeof o.ProcessingEntityType === "string" &&
      PROCESSING_ENTITY_TYPES.has(o.ProcessingEntityType)
    )
      c += 0.1;
    if (EVENT_BLOCKS.some((k) => isObj(o[k]))) {
      c += 0.1;
      reasons.push("has an event block such as Chargeback or TransactionDetails");
    }
    if (eventType === "Chargeback") {
      return { ...base, format: NUVEI_FORMATS.chargebackDmn, confidence: round(c), reasons };
    }
    return {
      ...base,
      supported: false,
      format: NUVEI_FORMATS.eventDmn,
      confidence: round(c),
      reasons,
      unsupportedReason: documented
        ? `Nuvei Control Panel "${safeText(eventType, 64)}" events are recognized but not analyzed; only Chargeback events are.`
        : "This looks like a Nuvei Control Panel event DMN with an undocumented EventType, so it is not analyzed.",
    };
  }

  // REST API 1.0. REST 2.0 (beta) is a different format.
  if (o.version === "2.0" || o.version === 2) return null;
  const status = strOf(o.status);
  const statusKnown = status !== undefined && lookup(API_STATUSES, status) !== undefined;
  const errCode = intCode(o.errCode) !== undefined;
  const internal = idLike(o.internalRequestId);
  const gwPair =
    intCode(o.gwErrorCode) !== undefined && intCode(o.gwExtendedErrorCode) !== undefined;
  const envelope = internal && statusKnown && errCode;
  if (!envelope && !gwPair) {
    // A REST error without internalRequestId. Small and generic, so it stays
    // below the automatic detection threshold.
    if (statusKnown && errCode && ("reason" in o || "errReason" in o) && "merchantSiteId" in o) {
      return {
        ...base,
        format: NUVEI_FORMATS.restResponse,
        confidence: 0.45,
        reasons: ["status, errCode, reason and merchantSiteId without internalRequestId"],
        unsupportedReason:
          "Without internalRequestId or the gateway code pair this response cannot be attributed to Nuvei reliably. Select Nuvei as the provider if it is one.",
      };
    }
    return null;
  }
  const reasons: string[] = [];
  let c = 0;
  if (envelope) {
    c += 0.5;
    reasons.push("has internalRequestId, status (SUCCESS, ERROR or PENDING) and errCode");
  }
  if (gwPair) {
    c += envelope ? 0.3 : 0.45;
    reasons.push("has the gateway code pair gwErrorCode and gwExtendedErrorCode");
  }
  const ts = strOf(o.transactionStatus);
  if (ts && lookup(TRANSACTION_STATUSES, ts.toUpperCase())) {
    c += 0.1;
    reasons.push("transactionStatus is a documented value");
  }
  if ("merchantId" in o && "merchantSiteId" in o) c += 0.05;
  if (o.version === "1.0" || o.version === "1") {
    c += 0.05;
    reasons.push(`version is "${o.version}"`);
  }
  if ("gwErrorReason" in o || "paymentMethodErrorCode" in o) c += 0.05;
  return { ...base, format: NUVEI_FORMATS.restResponse, confidence: round(c), reasons };
}

function idLike(v: unknown): boolean {
  return (
    (typeof v === "number" && Number.isInteger(v)) ||
    (typeof v === "string" && /^[0-9A-Za-z_-]{1,64}$/.test(v))
  );
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
  // Stripe payloads carry `object`; Nuvei payloads never do.
  if ("object" in input) return none;
  if (isFlatStrings(input)) {
    const form = detectForm(input);
    if (form) return form;
  }
  if (meta?.format === "form") return none;
  return detectJson(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const Code = z.union([z.number(), z.string().max(64)]);
const OptCode = Code.nullable().optional();
const NStr = (max: number) => z.string().max(max).nullable().optional();
const Id = z
  .union([z.string().max(256), z.number()])
  .nullable()
  .optional();
const Flag = z
  .union([z.boolean(), z.string().max(16)])
  .nullable()
  .optional();

const ThreeD = z.looseObject({
  threeDReasonId: OptCode,
  threeDReason: NStr(2000),
  flow: NStr(64),
  result: NStr(16),
  v2supported: Flag,
});

const RestResponse = z.looseObject({
  status: z.string().max(32),
  errCode: OptCode,
  reason: NStr(4000),
  errReason: NStr(4000),
  transactionStatus: NStr(32),
  transactionType: NStr(64),
  gwErrorCode: OptCode,
  gwExtendedErrorCode: OptCode,
  gwErrorReason: NStr(4000),
  paymentMethodErrorCode: OptCode,
  paymentMethodErrorReason: NStr(4000),
  transactionId: Id,
  relatedTransactionId: Id,
  orderId: Id,
  internalRequestId: Id,
  clientUniqueId: NStr(512),
  merchantAdviceCode: OptCode,
  version: z
    .union([z.string().max(16), z.number()])
    .nullable()
    .optional(),
  paymentOption: z
    .looseObject({
      card: z
        .looseObject({
          threeD: ThreeD.nullable().optional(),
          cvv2Reply: NStr(8),
          avsCode: NStr(8),
        })
        .nullable()
        .optional(),
      redirectUrl: NStr(16384),
    })
    .nullable()
    .optional(),
  fraudDetails: z
    .looseObject({ finalDecision: NStr(32) })
    .nullable()
    .optional(),
  partialApproval: z.looseObject({}).nullable().optional(),
  isAFT: Flag,
});

const Chargeback = z.looseObject({
  Type: NStr(64),
  Status: NStr(2000),
  StatusCategory: NStr(64),
  ChargebackStatusCategory: NStr(64),
  Amount: z
    .union([z.number(), z.string().max(64)])
    .nullable()
    .optional(),
  Currency: NStr(16),
  ChargebackReason: NStr(2000),
  ReasonMessage: NStr(2000),
  ChargebackReasonCategory: NStr(128),
  DisputeId: Id,
  DisputeEventId: Id,
  DisputeUnifiedStatusCode: NStr(64),
  DisputeDueDate: NStr(64),
});

const ChargebackEvent = z.looseObject({
  EventType: z.literal("Chargeback"),
  EventId: Id,
  EventCorrelationId: Id,
  EventDateUTC: NStr(64),
  AttemptNumber: z
    .union([z.number(), z.string().max(16)])
    .nullable()
    .optional(),
  Chargeback,
  TransactionDetails: z
    .looseObject({ TransactionId: Id, ClientUniqueId: NStr(512) })
    .nullable()
    .optional(),
});

type RestValue = z.infer<typeof RestResponse>;
type ChargebackValue = z.infer<typeof ChargebackEvent>;

/** Payment DMN fields this adapter reads, by documented name. */
const DMN_FIELDS = {
  pppStatus: "ppp_status",
  status: "Status",
  errCode: "ErrCode",
  exErrCode: "ExErrCode",
  reason: "Reason",
  reasonCode: "ReasonCode",
  message: "message",
  transactionId: "TransactionID",
  pppTransactionId: "PPP_TransactionID",
  relatedTransactionId: "relatedTransactionId",
  clientUniqueId: "clientUniqueId",
  merchantUniqueId: "merchant_unique_id",
  transactionType: "transactionType",
  type: "type",
  paymentMethod: "payment_method",
  totalAmount: "totalAmount",
  currency: "currency",
  responseTimeStamp: "responseTimeStamp",
  errApmCode: "errApmCode",
  errApmDescription: "errApmDescription",
  errScCode: "errScCode",
  errScDescription: "errScDescription",
  merchantAdviceCode: "merchantAdviceCode",
  avsCode: "AvsCode",
  cvv2Reply: "Cvv2Reply",
  threeDReasonId: "3DReasonId",
  finalFraudDecision: "finalFraudDecision",
  systemDecision: "systemDecision",
  partialApprovalStatus: "partialApprovalStatus",
  autoSettleMode: "autoSettleMode",
  advanceResponseChecksum: "advanceResponseChecksum",
} as const;

/** Withdrawal DMN fields this adapter reads, by documented name. */
const WITHDRAWAL_FIELDS = {
  wdRequestId: "wdRequestId",
  wdOrderId: "wdOrderId",
  wdRequestState: "wdRequestState",
  wdRequestStatus: "wdRequestStatus",
  wdOrderStatus: "wdOrderStatus",
  notificationType: "notificationType",
  gwTrxId: "gwTrxId",
  gwRelatedTransactionId: "gwRelatedTransactionId",
  gwErrCode: "gwErrCode",
  gwExtendedErrorCode: "gwExtendedErrorCode",
  gwReason: "gwReason",
  gwReasonCode: "gwReasonCode",
  apmErrorCode: "apmErrorCode",
  apmErrorDetails: "apmErrorDetails",
  merchantWDRequestId: "merchantWDRequestId",
  settlementType: "settlementType",
  checksum: "checksum",
} as const;

type Fields<T extends Record<string, string>> = { [K in keyof T]?: string };
type DmnValue = Fields<typeof DMN_FIELDS>;
type WithdrawalValue = Fields<typeof WITHDRAWAL_FIELDS>;

export type NuveiParsed =
  | { kind: "rest"; value: RestValue }
  | { kind: "payment_dmn"; value: DmnValue }
  | { kind: "withdrawal_dmn"; value: WithdrawalValue }
  | { kind: "chargeback_dmn"; value: ChargebackValue };

/** Picks the documented fields of a form record; a repeated key is a parse issue. */
function pickFields<T extends Record<string, string>>(
  input: unknown,
  names: T,
  required: (keyof T)[][],
): { ok: true; value: Fields<T> } | { ok: false; issues: string[] } {
  if (!isObj(input) || !isFlatStrings(input))
    return { ok: false, issues: ["(root): expected name-value pairs with text values"] };
  const out: Fields<T> = {};
  const issues: string[] = [];
  for (const key of Object.keys(names) as (keyof T & string)[]) {
    const v = fieldOf(input, names[key]!);
    if (v === undefined) continue;
    if (typeof v !== "string") {
      issues.push(`${names[key]}: appears more than once`);
      continue;
    }
    if (v.length > 4000) {
      issues.push(`${names[key]}: value is too long`);
      continue;
    }
    out[key] = v;
  }
  for (const group of required) {
    if (!group.some((k) => out[k] !== undefined && out[k] !== "")) {
      issues.push(`${group.map((k) => names[k]).join(" or ")}: required`);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: out };
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: NuveiParsed } | { ok: false; issues: string[] } {
  switch (format) {
    case NUVEI_FORMATS.restResponse: {
      const r = RestResponse.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "rest", value: r.data } }
        : { ok: false, issues: zodIssues(r.error) };
    }
    case NUVEI_FORMATS.paymentDmn: {
      const r = pickFields(input, DMN_FIELDS, [
        ["pppStatus"],
        ["transactionId", "pppTransactionId"],
      ]);
      return r.ok ? { ok: true, value: { kind: "payment_dmn", value: r.value } } : r;
    }
    case NUVEI_FORMATS.withdrawalDmn: {
      const r = pickFields(input, WITHDRAWAL_FIELDS, [
        ["wdRequestId"],
        ["wdRequestStatus", "wdOrderStatus"],
      ]);
      return r.ok ? { ok: true, value: { kind: "withdrawal_dmn", value: r.value } } : r;
    }
    case NUVEI_FORMATS.chargebackDmn: {
      const r = ChargebackEvent.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "chargeback_dmn", value: r.data } }
        : { ok: false, issues: zodIssues(r.error) };
    }
    default:
      return { ok: false, issues: [`Unsupported Nuvei format "${format}".`] };
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
    else if (Array.isArray(v) && v.length > 0)
      out[k] = v.map((x) =>
        typeof x === "string" ? (safeText(x, 64) ?? "") : x,
      ) as SafePrimitive[];
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

const nonEmpty = (v: string | null | undefined) =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/** Documented letter codes only. */
const letter = (table: Readonly<Record<string, string>>, v: unknown) => {
  const t = strOf(v)?.trim();
  return t && lookup(table, t) ? t : undefined;
};

const transactionTypeOf = (v: string | null | undefined) => {
  const t = nonEmpty(v);
  const info: TransactionTypeInfo | undefined = t
    ? lookup(TRANSACTION_TYPES, t.toLowerCase())
    : undefined;
  return { raw: t, info };
};

/** responseTimeStamp is YYYY-MM-DD.HH:MM:SS in GMT. */
function dmnTimestamp(v: string | undefined): string | undefined {
  const m = v ? DMN_TIMESTAMP.exec(v.trim()) : null;
  return m ? toIsoTimestamp(`${m[1]}T${m[2]}Z`) : undefined;
}

/** ISO date-times with an explicit zone; fractions beyond milliseconds are cut. */
function isoOf(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(v.trim());
  if (!m) return undefined;
  return toIsoTimestamp(`${m[1]}${m[2] ? m[2].slice(0, 4) : ""}${m[3]!.toUpperCase()}`);
}

function flag(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  const t = strOf(v)?.trim().toLowerCase();
  return t === "true" || t === "1" ? true : t === "false" || t === "0" ? false : undefined;
}

const UNCERTAIN: ReadonlySet<ErrorCategory> = new Set([
  "provider_unavailable",
  "network_or_timeout",
  "unknown",
]);

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

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

const DMN_DOC: DocumentationLink = { title: "Nuvei payment DMNs", url: PAYMENT_DMNS_URL };
const WITHDRAWAL_DOC: DocumentationLink = {
  title: "Nuvei withdrawal DMNs",
  url: WITHDRAWAL_DMNS_URL,
};

const CODES_DOC: DocumentationLink = {
  title: "Nuvei response handling and code tables",
  url: RESPONSE_HANDLING_URL,
};

/** Higher is stricter. */
const RETRY_RANK: Record<RetryGuidance, number> = {
  unknown: 0,
  safe_to_retry_technical_request: 1,
  retry_conditionally: 2,
  customer_action_required: 3,
  manual_review: 4,
  do_not_retry: 5,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  insufficient: 0,
  possible: 1,
  strong: 2,
  confirmed: 3,
};

const capConfidence = (c: Confidence, max: Confidence): Confidence =>
  CONFIDENCE_RANK[c] > CONFIDENCE_RANK[max] ? max : c;

const describeEntry = (entry: CodeEntry) =>
  `${entry.meaning}.${entry.note ? ` ${entry.note}` : ""}`;

/** errCode / reason: the request itself (stage 1). */
export function decodeRequestError(code: string): Omit<Decoded, "subCodes"> {
  const documented = lookup(REQUEST_ERROR_CODES, code) ?? lookup(MARKETPLACE_ERROR_CODES, code);
  if (documented) {
    return {
      code,
      category: documented.category,
      retry: documented.retry,
      confidence: documented.category === "unknown" ? "possible" : "strong",
      explanation: `Nuvei request error errCode ${code}: ${describeEntry(documented)} The request was rejected before or outside the payment gateway.`,
      docs: [CODES_DOC],
      missing: [],
      outcomeKnown: !UNCERTAIN.has(documented.category),
    };
  }
  const sdk = lookup(SDK_ERROR_CODE_NAMES, code);
  if (sdk) {
    return {
      code,
      category: sdk.category,
      retry: sdk.retry,
      confidence: "possible",
      explanation: `Nuvei errCode ${code} is named "${sdk.meaning}" in the official Java SDK constants.`,
      docs: [CODES_DOC, { title: "Nuvei Java SDK", url: JAVA_SDK_URL }],
      missing: [
        `errCode ${code} is named only in the Java SDK constants; Nuvei's error code table does not list it.`,
      ],
      outcomeKnown: false,
    };
  }
  return {
    code,
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: `Nuvei returned errCode ${code}, which is not in Nuvei's errCode table.`,
    docs: [CODES_DOC],
    missing: [`errCode ${code} is not documented.`],
    outcomeKnown: false,
  };
}

export type GatewayInput = {
  gwErrorCode?: string;
  gwExtendedErrorCode?: string;
  reason?: string;
  /** Upper-case transaction status (DECLINED, ERROR, ...). */
  status?: string;
  /** Names of the fields that carried the codes, as they appear in this format. */
  names: { gw: string; ext: string; reason: string };
  /** DMN field names are mapped to the gateway table by inference. */
  inferred: boolean;
  /** Whether the reason field is documented as carrying the decline reason list. */
  reasonDocumented: boolean;
};

function gatewayRow(gw: string, ext: string): GatewayRow | undefined {
  return GATEWAY_RESPONSE_ROWS.find(
    (r) => r.gwErrorCode === gw && r.gwExtendedErrorCode === ext && r.status === "ERROR",
  );
}

function declineReason(input: GatewayInput, base: Record<string, string>): Decoded {
  const found = findDeclineReason(input.reason);
  if (found) {
    return {
      code: found.reason,
      category: found.entry.category,
      retry: found.entry.retry,
      confidence:
        input.reasonDocumented && found.entry.category !== "unknown" ? "strong" : "possible",
      explanation: `Nuvei gateway decline reason "${found.reason}": ${describeEntry(found.entry)}`,
      docs: [CODES_DOC],
      missing: input.reasonDocumented
        ? []
        : [
            `${input.names.reason} is matched to Nuvei's gwErrorReason list by the field description.`,
          ],
      outcomeKnown: true,
      subCodes: { ...base, [input.names.reason]: found.reason },
    };
  }
  return {
    code: input.gwErrorCode ?? "DECLINED",
    category: "card_declined",
    retry: "customer_action_required",
    confidence: "possible",
    explanation: input.reason
      ? "Nuvei reports a decline whose reason text is not in Nuvei's list of decline reasons. Nuvei calls that list non-exhaustive."
      : `Nuvei reports a decline without a reason text in ${input.names.reason}.`,
    docs: [CODES_DOC],
    missing: [
      input.reason
        ? "The decline reason is not documented, so its category is a fallback."
        : `${input.names.reason} is empty, so the reason for the decline is unknown.`,
    ],
    outcomeKnown: true,
    subCodes: base,
  };
}

/**
 * Gateway layer (stage 2): gwErrorCode with gwExtendedErrorCode and the
 * decline reason. 0/0 is no error: it stands for both APPROVED and PENDING.
 */
export function decodeGateway(input: GatewayInput): Decoded | undefined {
  const gw = input.gwErrorCode;
  const ext = input.gwExtendedErrorCode;
  const base: Record<string, string> = {};
  if (gw !== undefined) base[input.names.gw] = gw;
  if (ext !== undefined) base[input.names.ext] = ext;
  const declined = input.status === "DECLINED";
  const cap = input.inferred ? ("possible" as const) : ("strong" as const);
  const inferredNote = input.inferred
    ? [
        `${input.names.gw} and ${input.names.ext} are matched to the REST gwErrorCode and gwExtendedErrorCode tables by inference from the field descriptions.`,
      ]
    : [];

  if ((gw === undefined || gw === "0") && (ext === undefined || ext === "0")) {
    // A DMN can say DECLINED when no financial transaction happened, so without
    // a reason only the REST transactionStatus is read as an issuer decline.
    return declined && (input.reason || !input.inferred) ? declineReason(input, base) : undefined;
  }
  if (gw !== undefined && ext !== undefined) {
    const row = gatewayRow(gw, ext);
    if (row) {
      return {
        code: gw,
        category: row.category,
        retry: row.retry,
        confidence: cap,
        explanation: `Nuvei gateway code ${gw} with extended code ${ext}: ${row.meaning}.`,
        docs: [CODES_DOC],
        missing: [...inferredNote],
        outcomeKnown: !UNCERTAIN.has(row.category),
        subCodes: base,
      };
    }
  }
  if (gw === "-1" && (ext === undefined || ext === "0")) {
    const dec = declineReason(input, base);
    // The decline reason list is documented for both gwErrorReason and the DMN
    // Reason field; only the code pair itself is inferred.
    if (input.reasonDocumented && declined) return dec;
    return {
      ...dec,
      confidence: capConfidence(dec.confidence, cap),
      missing: [...dec.missing, ...inferredNote],
    };
  }
  if (gw === "-1100") {
    const n = ext !== undefined ? Number(ext) : NaN;
    if (!(n > 0)) {
      return unknownGateway(
        gw,
        base,
        "A filter error (-1100) without a positive extended code is not documented.",
      );
    }
    const single = lookup(FILTER_ERROR_CODES, ext);
    if (single) {
      const reserved = single.retry === "unknown" && single.category === "unknown";
      return {
        code: ext!,
        category: single.category,
        retry: single.retry,
        confidence: reserved
          ? "insufficient"
          : capConfidence(single.category === "unknown" ? "possible" : "strong", cap),
        explanation: `Nuvei gateway filter error ${ext} (${input.names.ext} with ${input.names.gw} -1100): ${describeEntry(single)}`,
        docs: [CODES_DOC],
        missing: reserved
          ? [`Filter code ${ext} is listed by Nuvei only as reserved.`, ...inferredNote]
          : [...inferredNote],
        outcomeKnown: !UNCERTAIN.has(single.category),
        subCodes: base,
      };
    }
    const dup = lookup(DUPLICATED_FILTER_CODES, ext);
    if (dup && dup.length > 0) {
      const categories = new Set(dup.map((d) => d.category));
      const retry = dup.reduce<RetryGuidance>(
        (r, d) => (RETRY_RANK[d.retry] > RETRY_RANK[r] ? d.retry : r),
        "unknown",
      );
      const category = categories.size === 1 ? dup[0]!.category : "unknown";
      return {
        code: ext!,
        category,
        retry,
        confidence: "possible",
        explanation: `Nuvei gateway filter error ${ext} is listed twice in Nuvei's table with different meanings: ${dup
          .map((d) => `"${d.meaning}"`)
          .join(" or ")}. The stricter retry guidance of the two is used.`,
        docs: [CODES_DOC],
        missing: [
          `Nuvei documents two meanings for filter code ${ext}; the payload does not say which one applies.`,
          ...inferredNote,
        ],
        outcomeKnown: false,
        subCodes: base,
      };
    }
    return unknownGateway(ext!, base, `Filter code ${ext} is not in Nuvei's filter error table.`);
  }
  const gwNum = gw !== undefined ? Number(gw) : NaN;
  if (gwNum < 0 && ext !== undefined && ext !== "0") {
    const generic = GATEWAY_RESPONSE_ROWS.find((r) => r.gwErrorCode === "less than 0")!;
    return {
      code: gw!,
      category: generic.category,
      retry: generic.retry,
      confidence: "possible",
      explanation: `Nuvei gateway code ${gw} with extended code ${ext}: ${generic.meaning}. Nuvei does not document these values individually.`,
      docs: [CODES_DOC],
      missing: [
        `The combination ${gw} / ${ext} is covered only by the generic "gateway or bank error" row.`,
        ...inferredNote,
      ],
      outcomeKnown: false,
      subCodes: base,
    };
  }
  return unknownGateway(
    gw ?? ext ?? "unknown",
    base,
    `The gateway code pair ${gw ?? "(none)"} / ${ext ?? "(none)"} is not documented.`,
  );
}

function unknownGateway(code: string, subCodes: Record<string, string>, missing: string): Decoded {
  return {
    code,
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: "Nuvei returned a gateway code that is not in Nuvei's gateway code tables.",
    docs: [CODES_DOC],
    missing: [missing],
    outcomeKnown: false,
    subCodes,
  };
}

/** Stricter Mastercard Merchant Advice Code guidance, read only next to a failure. */
function applyAdvice(dec: Decoded, advice: string | undefined): Decoded {
  if (!advice) return dec;
  const entry = lookup(MERCHANT_ADVICE_CODES, advice);
  const out = { ...dec, subCodes: { ...dec.subCodes, merchantAdviceCode: advice } };
  if (!entry) {
    out.missing = [
      ...out.missing,
      `Merchant Advice Code "${advice}" is not one of the 16 documented values.`,
    ];
    return out;
  }
  out.explanation += ` Mastercard Merchant Advice Code ${advice}: ${entry.meaning}.`;
  if (RETRY_RANK[entry.retry] > RETRY_RANK[out.retry]) {
    out.retry = entry.retry;
    out.explanation += " The advice code's stricter retry guidance is used.";
  }
  return out;
}

function decodeThreeDsReason(id: string, message: string | undefined): Decoded {
  const entry = lookup(THREE_DS_REASONS, id);
  if (!entry) {
    return {
      code: id,
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      explanation: `The 3-D Secure reason id ${id} is not in Nuvei's list.`,
      docs: [{ title: "Nuvei 3-D Secure responses", url: THREE_DS_RESPONSES_URL }],
      missing: [`3-D Secure reason id ${id} is not documented.`],
      outcomeKnown: false,
      subCodes: { threeDReasonId: id },
      ...(message ? { message } : {}),
    };
  }
  const ambiguous = AMBIGUOUS_THREE_DS_REASONS.has(id);
  return {
    code: id,
    category: entry.category,
    retry: entry.retry,
    confidence: ambiguous ? "possible" : "strong",
    explanation: `3-D Secure authentication failed, reason id ${id}: ${entry.meaning}.`,
    docs: [{ title: "Nuvei 3-D Secure responses", url: THREE_DS_RESPONSES_URL }],
    missing: ambiguous
      ? [
          `Reason id ${id} has a different meaning for each card scheme; the scheme is not in the payload.`,
        ]
      : [],
    outcomeKnown: true,
    subCodes: { threeDReasonId: id },
    ...(message ? { message } : {}),
  };
}

function undocumentedApmError(
  field: string,
  code: string | undefined,
  message: string | undefined,
  source: string,
): Decoded {
  return {
    code: code ?? "unknown",
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: `${source} reports an error in ${field}${code ? ` (code ${code})` : ""}. These codes are not documented by Nuvei.`,
    docs: [CODES_DOC],
    missing: [`The values of ${field} are not documented.`],
    outcomeKnown: false,
    subCodes: { field },
    ...(message ? { message } : {}),
  };
}

function codeless(what: string, status: string): Decoded {
  return {
    code: status,
    category: "unknown",
    retry: "unknown",
    confidence: "insufficient",
    explanation: `${what} reports ${status} without an error code or reason, so the cause is unknown.`,
    docs: [CODES_DOC],
    missing: ["The record carries no error code or reason."],
    outcomeKnown: false,
    subCodes: { status },
  };
}

type Location = {
  ctx: NormalizeContext;
  paymentReference?: string;
  attemptReference?: string;
};

function draft(loc: Location, path: string, dec: Decoded): DecodedErrorDraft {
  return {
    sourceFormat: loc.ctx.format,
    source: { recordIndex: loc.ctx.recordIndex, path },
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
// REST API 1.0 responses
// ---------------------------------------------------------------------------

type RestState = {
  stage: LifecycleStage;
  outcome: Outcome;
  eventType: string;
  known: boolean;
  providerStatus?: string;
  stageInferredFrom?: string;
  gateway?: Decoded;
  transactionType: ReturnType<typeof transactionTypeOf>;
};

function restGateway(v: RestValue): Decoded | undefined {
  const ts = nonEmpty(v.transactionStatus)?.toUpperCase();
  const gw = intCode(v.gwErrorCode);
  const ext = intCode(v.gwExtendedErrorCode);
  if (gw === undefined && ext === undefined && ts !== "DECLINED") return undefined;
  return decodeGateway({
    gwErrorCode: gw,
    gwExtendedErrorCode: ext,
    reason: nonEmpty(v.gwErrorReason),
    status: ts,
    names: { gw: "gwErrorCode", ext: "gwExtendedErrorCode", reason: "gwErrorReason" },
    inferred: false,
    reasonDocumented: true,
  });
}

function restState(v: RestValue): RestState {
  const type = transactionTypeOf(v.transactionType);
  const ts = nonEmpty(v.transactionStatus);
  const tsInfo: StatusInfo | undefined = ts
    ? lookup(TRANSACTION_STATUSES, ts.toUpperCase())
    : undefined;
  const status = v.status.trim();
  const statusInfo: StatusInfo | undefined = lookup(API_STATUSES, status);
  const gateway = restGateway(v);
  const typeKnown = type.raw ? Boolean(type.info && !type.info.meaningUndocumented) : true;
  const eventType = `api_response${type.raw ? `.${safeText(type.raw, 64)}` : ""}`;
  const threeD = v.paymentOption?.card?.threeD ?? undefined;
  const uncertain = (dec: Decoded | undefined) => dec !== undefined && UNCERTAIN.has(dec.category);

  if (ts !== undefined) {
    // Without transactionType the operation (payment, settle, refund, void,
    // payout) cannot be told from the response.
    let stage: LifecycleStage = type.info?.stage ?? "other";
    let stageInferredFrom: string | undefined = type.raw
      ? undefined
      : "no transactionType, so the operation is not known";
    if (!type.raw && flag(threeD?.v2supported) !== undefined) {
      stage = "authentication";
      stageInferredFrom = "threeD.v2supported, which /initPayment returns";
    }
    let outcome: Outcome = tsInfo?.outcome ?? "unknown";
    // An ERROR caused by a timeout or system error does not show that the
    // operation failed; the original may have gone through.
    if (ts.toUpperCase() === "ERROR" && uncertain(gateway)) outcome = "unknown";
    if (stage === "dispute") outcome = "unknown";
    return {
      stage,
      outcome,
      eventType,
      known: typeKnown && tsInfo !== undefined,
      providerStatus: safeText(ts, 32),
      ...(stageInferredFrom ? { stageInferredFrom } : {}),
      gateway,
      transactionType: type,
    };
  }
  if (status === "PENDING") {
    // Documented only for asynchronous APM refunds (/refundTransaction).
    return {
      stage: type.info?.stage ?? (type.raw ? "other" : "refund"),
      outcome: "pending",
      eventType,
      known: typeKnown,
      providerStatus: status,
      ...(type.raw
        ? {}
        : { stageInferredFrom: "status PENDING, documented only for asynchronous APM refunds" }),
      gateway,
      transactionType: type,
    };
  }
  if (status === "ERROR") {
    const code = intCode(v.errCode);
    const req = code && code !== "0" ? decodeRequestError(code) : undefined;
    return {
      stage: "error",
      outcome: req && UNCERTAIN.has(req.category) ? "unknown" : "failure",
      eventType,
      known: true,
      providerStatus: status,
      gateway,
      transactionType: type,
    };
  }
  return {
    stage: type.info?.stage ?? "other",
    outcome: statusInfo?.outcome ?? "unknown",
    eventType,
    known: typeKnown && statusInfo !== undefined,
    providerStatus: safeText(status, 32),
    gateway,
    transactionType: type,
  };
}

function restRefs(v: RestValue) {
  const transactionId = idOf(v.transactionId);
  const relatedTransactionId = idOf(v.relatedTransactionId);
  return {
    transactionId,
    relatedTransactionId,
    orderId: idOf(v.orderId),
    paymentReference: relatedTransactionId ?? transactionId,
    relatedReference: relatedTransactionId ? transactionId : undefined,
  };
}

function restEvent(v: RestValue, ctx: NormalizeContext): NormalizedEventDraft {
  const s = restState(v);
  const refs = restRefs(v);
  const raw = v as Obj;
  const card = v.paymentOption?.card ?? undefined;
  const threeD = card?.threeD ?? undefined;
  const failed = s.outcome === "failure" || s.outcome === "unknown";
  const ts = nonEmpty(v.transactionStatus);
  const advice = twoDigit(v.merchantAdviceCode);
  const pending: string[] = [];
  if (nonEmpty(strOf((threeD as Obj | undefined)?.acsUrl)))
    pending.push("threeD.acsUrl (3-D Secure challenge)");
  if (nonEmpty(v.paymentOption?.redirectUrl))
    pending.push("paymentOption.redirectUrl (APM redirect)");
  const threeDReasonId = twoDigit(threeD?.threeDReasonId);
  const fraud = nonEmpty(v.fraudDetails?.finalDecision);
  return clean({
    sourceFormat: ctx.format,
    eventType: s.eventType,
    eventTypeKnown: s.known,
    stage: s.stage,
    providerStatus: s.providerStatus,
    paymentReference: refs.paymentReference,
    relatedReference: refs.relatedReference,
    merchantReference: idOf(v.clientUniqueId),
    outcome: s.outcome,
    attributes: attrs([
      ["deliveryChannel", "api_response"],
      ["apiStatus", safeText(v.status, 32)],
      ["apiStatusKnown", lookup(API_STATUSES, v.status.trim()) ? undefined : false],
      ["transactionStatus", ts],
      [
        "transactionStatusKnown",
        ts && !lookup(TRANSACTION_STATUSES, ts.toUpperCase()) ? false : undefined,
      ],
      ["transactionType", s.transactionType.raw],
      [
        "transactionTypeKnown",
        s.transactionType.raw && !s.transactionType.info ? false : undefined,
      ],
      ["stageInferredFrom", s.stageInferredFrom],
      ["errCode", intCode(v.errCode)],
      ["gwErrorCode", intCode(v.gwErrorCode)],
      ["gwExtendedErrorCode", intCode(v.gwExtendedErrorCode)],
      ["gwErrorReason", nonEmpty(v.gwErrorReason)],
      ["paymentMethodErrorCode", looseCode(v.paymentMethodErrorCode)],
      ["transactionId", refs.transactionId],
      ["relatedTransactionId", refs.relatedTransactionId],
      ["orderId", refs.orderId],
      ["internalRequestId", idOf(v.internalRequestId)],
      ["threeDResult", letter(THREE_DS_RESULTS, threeD?.result ?? raw.threeDresult)],
      ["threeDFlow", safeId(threeD?.flow ?? undefined, 32)],
      ["softDecline", threeD?.flow === "softDecline" ? true : undefined],
      ["threeDReasonId", threeDReasonId],
      ["threeDSv2Supported", flag(threeD?.v2supported ?? raw.v2supported)],
      ["cvv2Reply", letter(CVV2_REPLIES, card?.cvv2Reply ?? raw.CVV2Reply)],
      ["avsCode", letter(AVS_CODES, card?.avsCode ?? raw.AVSCode)],
      ["fraudDecision", fraud && FRAUD_DECISIONS.has(fraud) ? fraud : undefined],
      ["merchantAdviceCode", failed ? advice : undefined],
      ["partialApproval", v.partialApproval ? true : undefined],
      ["isAFT", flag(v.isAFT)],
      ["pendingAction", pending],
      [
        "apiVersion",
        typeof v.version === "string" ? safeId(v.version, 16) : (v.version ?? undefined),
      ],
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function restErrors(v: RestValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const s = restState(v);
  const refs = restRefs(v);
  const loc: Location = {
    ctx,
    ...(refs.paymentReference ? { paymentReference: refs.paymentReference } : {}),
    ...(refs.transactionId ? { attemptReference: refs.transactionId } : {}),
  };
  const shared: Record<string, string> = { status: safeText(v.status, 32) ?? "" };
  const ts = nonEmpty(v.transactionStatus);
  if (ts) shared.transactionStatus = safeText(ts, 32) ?? "";
  if (s.transactionType.raw) shared.transactionType = safeText(s.transactionType.raw, 64) ?? "";
  const http = ctx.meta?.http?.status;
  if (http !== undefined) shared.http_status = String(http);
  const advice = twoDigit(v.merchantAdviceCode);
  const threeD = v.paymentOption?.card?.threeD ?? undefined;
  const out: DecodedErrorDraft[] = [];

  const errCode = intCode(v.errCode);
  if (errCode !== undefined && errCode !== "0") {
    const dec = decodeRequestError(errCode);
    const message = safeText(nonEmpty(v.reason) ?? nonEmpty(v.errReason), 200);
    out.push(
      draft(loc, "errCode", {
        ...dec,
        subCodes: { ...shared, field: "errCode" },
        ...(message ? { message } : {}),
      }),
    );
  }

  if (s.gateway) {
    let dec: Decoded = {
      ...s.gateway,
      subCodes: { ...shared, ...s.gateway.subCodes },
      ...(nonEmpty(v.gwErrorReason) ? { message: safeText(v.gwErrorReason, 200) } : {}),
    };
    if (threeD?.flow === "softDecline") {
      dec.explanation +=
        " Nuvei marks this payment as a soft decline: a new /initPayment with relatedTransactionId and 3-D Secure may follow.";
      dec.docs = [
        ...dec.docs,
        { title: "Nuvei REST API 1.0 flow (soft decline)", url: REST_FLOW_URL },
      ];
    }
    dec = applyAdvice(dec, advice);
    out.push(draft(loc, "gwErrorCode", dec));
  }

  const apmCode = looseCode(v.paymentMethodErrorCode);
  const apmReason = nonEmpty(v.paymentMethodErrorReason);
  if ((apmCode !== undefined && apmCode !== "0") || apmReason) {
    const dec = undocumentedApmError(
      "paymentMethodErrorCode",
      apmCode && apmCode !== "0" ? apmCode : undefined,
      safeText(apmReason, 200),
      "The alternative payment method",
    );
    out.push(
      draft(loc, "paymentMethodErrorCode", { ...dec, subCodes: { ...shared, ...dec.subCodes } }),
    );
  }

  const reasonId = twoDigit(threeD?.threeDReasonId);
  if (reasonId && s.outcome === "failure") {
    const dec = decodeThreeDsReason(reasonId, safeText(nonEmpty(threeD?.threeDReason), 200));
    out.push(
      draft(loc, "paymentOption.card.threeD.threeDReasonId", {
        ...dec,
        subCodes: { ...shared, ...dec.subCodes },
      }),
    );
  }

  if (out.length === 0 && s.outcome === "failure") {
    out.push(
      draft(loc, "", { ...codeless("The Nuvei response", ts ?? v.status), subCodes: shared }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Payment DMNs
// ---------------------------------------------------------------------------

type DmnState = {
  stage: LifecycleStage;
  outcome: Outcome;
  known: boolean;
  status?: string;
  statusInfo?: StatusInfo;
  ppp?: string;
  pppInfo?: StatusInfo;
  type?: string;
  transactionType: ReturnType<typeof transactionTypeOf>;
  gateway?: Decoded;
};

function dmnGateway(v: DmnValue, status: string | undefined): Decoded | undefined {
  const gw = intCode(v.errCode);
  const ext = intCode(v.exErrCode);
  const reason = nonEmpty(v.reason);
  const failed = status === "DECLINED" || status === "ERROR";
  if (!failed && (gw === undefined || gw === "0") && (ext === undefined || ext === "0"))
    return undefined;
  return decodeGateway({
    gwErrorCode: gw,
    gwExtendedErrorCode: ext,
    reason: reason && reason.toUpperCase() !== "N/A" ? reason : undefined,
    status,
    names: { gw: "ErrCode", ext: "ExErrCode", reason: "Reason" },
    inferred: true,
    reasonDocumented: true,
  });
}

function dmnState(v: DmnValue): DmnState {
  const type = transactionTypeOf(v.transactionType);
  const status = nonEmpty(v.status)?.toUpperCase();
  const statusInfo = status ? lookup(DMN_STATUSES, status) : undefined;
  const ppp = nonEmpty(v.pppStatus)?.toUpperCase();
  const pppInfo = ppp ? lookup(PPP_STATUSES, ppp) : undefined;
  const kind = nonEmpty(v.type)?.toUpperCase();
  const gateway = dmnGateway(v, status);
  let stage: LifecycleStage;
  if (kind === "WITHDRAWAL") stage = "payout";
  else if (kind === "KYC" || kind === "DOCUP") stage = "other";
  else stage = type.info?.stage ?? (type.raw ? "other" : "payment");
  let outcome: Outcome = status
    ? (statusInfo?.outcome ?? "unknown")
    : (pppInfo?.outcome ?? "unknown");
  if (status === "ERROR" && gateway && UNCERTAIN.has(gateway.category)) outcome = "unknown";
  if (stage === "dispute" || kind === "KYC" || kind === "DOCUP") outcome = "unknown";
  const typeKnown = type.raw ? Boolean(type.info && !type.info.meaningUndocumented) : true;
  const statusKnown = status
    ? Boolean(statusInfo && !statusInfo.meaningUndocumented)
    : pppInfo !== undefined;
  const kindKnown = kind ? kind === "DEPOSIT" || kind === "WITHDRAWAL" : true;
  return {
    stage,
    outcome,
    known: typeKnown && statusKnown && kindKnown,
    ...(status ? { status } : {}),
    ...(statusInfo ? { statusInfo } : {}),
    ...(ppp ? { ppp } : {}),
    ...(pppInfo ? { pppInfo } : {}),
    ...(kind ? { type: kind } : {}),
    transactionType: type,
    gateway,
  };
}

function dmnRefs(v: DmnValue) {
  const transactionId = idOf(v.transactionId);
  const pppTransactionId = idOf(v.pppTransactionId);
  const relatedTransactionId = idOf(v.relatedTransactionId);
  return {
    transactionId,
    pppTransactionId,
    relatedTransactionId,
    paymentReference: relatedTransactionId ?? transactionId ?? pppTransactionId,
    relatedReference: relatedTransactionId ? transactionId : undefined,
  };
}

function dmnEvent(v: DmnValue, ctx: NormalizeContext): NormalizedEventDraft {
  const s = dmnState(v);
  const refs = dmnRefs(v);
  const currency = upperCurrency(nonEmpty(v.currency));
  const amount = currency ? decimalToMinor(nonEmpty(v.totalAmount), currency) : undefined;
  const timestamp = dmnTimestamp(v.responseTimeStamp);
  const idForKey = refs.transactionId ?? refs.pppTransactionId;
  const deliveryKey =
    idForKey && timestamp
      ? [
          "dmn",
          idForKey,
          s.status ?? "",
          s.ppp ?? "",
          s.transactionType.raw ?? "",
          v.responseTimeStamp!.trim(),
        ].join("|")
      : undefined;
  const method = nonEmpty(v.paymentMethod);
  const failed = s.outcome === "failure" || s.outcome === "unknown";
  const checksum = nonEmpty(v.advanceResponseChecksum);
  const fraud = nonEmpty(v.finalFraudDecision);
  const system = nonEmpty(v.systemDecision);
  const partial = nonEmpty(v.partialApprovalStatus)?.toUpperCase();
  const settle = nonEmpty(v.autoSettleMode)?.toUpperCase();
  const reason = nonEmpty(v.reason);
  return clean({
    sourceFormat: ctx.format,
    eventType: `payment_dmn${s.transactionType.raw ? `.${safeText(s.transactionType.raw, 64)}` : ""}`,
    eventTypeKnown: s.known,
    stage: s.stage,
    providerStatus: s.status ?? s.ppp,
    paymentReference: refs.paymentReference,
    relatedReference: refs.relatedReference,
    merchantReference: idOf(v.clientUniqueId) ?? idOf(v.merchantUniqueId),
    deliveryKey,
    eventTimestamp: timestamp,
    amountMinor: amount,
    currency: amount ? currency : undefined,
    outcome: s.outcome,
    attributes: attrs([
      ["deliveryChannel", "dmn"],
      ["httpMethod", ctx.meta?.http?.method ? safeId(ctx.meta.http.method, 8) : undefined],
      ["pppStatus", s.ppp],
      ["pppStatusKnown", s.ppp && !s.pppInfo ? false : undefined],
      ["dmnStatus", s.status],
      ["dmnStatusKnown", s.status && !s.statusInfo ? false : undefined],
      ["dmnStatusMeaningDocumented", s.statusInfo?.meaningUndocumented ? false : undefined],
      [
        "statusFieldsDisagree",
        s.statusInfo &&
        s.pppInfo &&
        s.statusInfo.outcome !== s.pppInfo.outcome &&
        !s.statusInfo.meaningUndocumented
          ? true
          : undefined,
      ],
      ["transactionType", s.transactionType.raw],
      [
        "transactionTypeKnown",
        s.transactionType.raw && !s.transactionType.info ? false : undefined,
      ],
      ["transactionTypeSent", s.transactionType.raw ? undefined : false],
      ["dmnType", s.type && lookup(DMN_TYPES, s.type) ? s.type : undefined],
      ["errCode", intCode(v.errCode)],
      ["exErrCode", intCode(v.exErrCode)],
      ["reason", reason],
      ["reasonCode", looseCode(v.reasonCode)],
      ["message", safeText(nonEmpty(v.message), 64)],
      [
        "paymentMethod",
        method && (CARD_PAYMENT_METHODS.has(method) || APM_METHOD.test(method))
          ? method
          : undefined,
      ],
      ["transactionId", refs.transactionId],
      ["pppTransactionId", refs.pppTransactionId],
      ["relatedTransactionId", refs.relatedTransactionId],
      ["financialTransaction", refs.transactionId ? undefined : false],
      ["merchantAdviceCode", failed ? twoDigit(v.merchantAdviceCode) : undefined],
      ["cvv2Reply", letter(CVV2_REPLIES, v.cvv2Reply)],
      ["avsCode", letter(AVS_CODES, v.avsCode)],
      ["threeDReasonId", twoDigit(v.threeDReasonId)],
      ["finalFraudDecision", fraud && FRAUD_DECISIONS.has(fraud) ? fraud : undefined],
      ["systemDecision", system && FRAUD_DECISIONS.has(system) ? system : undefined],
      [
        "partialApprovalStatus",
        partial && PARTIAL_APPROVAL_STATUSES.has(partial) ? partial : undefined,
      ],
      ["autoSettleMode", settle && AUTO_SETTLE_MODES.has(settle) ? settle : undefined],
      ["timestampZone", timestamp ? "GMT (as documented for responseTimeStamp)" : undefined],
      ["checksumLength", checksum ? checksum.length : undefined],
      // Checksums are never verified; a pasted DMN is not proof of origin.
      ["signatureVerified", false],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function dmnErrors(v: DmnValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const s = dmnState(v);
  const refs = dmnRefs(v);
  const loc: Location = {
    ctx,
    ...(refs.paymentReference ? { paymentReference: refs.paymentReference } : {}),
    ...(refs.transactionId ? { attemptReference: refs.transactionId } : {}),
  };
  const shared: Record<string, string> = {};
  if (s.ppp) shared.ppp_status = s.ppp;
  if (s.status) shared.Status = s.status;
  if (s.transactionType.raw) shared.transactionType = safeText(s.transactionType.raw, 64) ?? "";
  const reasonCode = looseCode(v.reasonCode);
  if (reasonCode && reasonCode !== "0") shared.ReasonCode = reasonCode;
  const failed = s.outcome === "failure" || s.outcome === "unknown";
  const out: DecodedErrorDraft[] = [];

  if (s.gateway && s.stage !== "dispute") {
    const reason = nonEmpty(v.reason);
    let dec: Decoded = {
      ...s.gateway,
      subCodes: { ...shared, ...s.gateway.subCodes },
      ...(reason && reason.toUpperCase() !== "N/A" ? { message: safeText(reason, 200) } : {}),
    };
    if (failed) dec = applyAdvice(dec, twoDigit(v.merchantAdviceCode));
    out.push(draft(loc, "ErrCode", dec));
  }

  for (const [field, codeKey, textKey, source] of [
    ["errApmCode", "errApmCode", "errApmDescription", "The alternative payment method"],
    ["errScCode", "errScCode", "errScDescription", "Nuvei, for this APM transaction,"],
  ] as const) {
    const code = looseCode(v[codeKey]);
    const text = nonEmpty(v[textKey]);
    if ((code !== undefined && code !== "0") || text) {
      const dec = undocumentedApmError(
        field,
        code && code !== "0" ? code : undefined,
        safeText(text, 200),
        source,
      );
      out.push(draft(loc, field, { ...dec, subCodes: { ...shared, ...dec.subCodes } }));
    }
  }

  const reasonId = twoDigit(v.threeDReasonId);
  if (reasonId && s.outcome === "failure") {
    const dec = decodeThreeDsReason(reasonId, undefined);
    out.push(draft(loc, "3DReasonId", { ...dec, subCodes: { ...shared, ...dec.subCodes } }));
  }

  if (out.length === 0 && s.outcome === "failure") {
    out.push(
      draft(loc, "", {
        ...codeless("The Nuvei payment DMN", s.status ?? s.ppp ?? "FAIL"),
        subCodes: shared,
      }),
    );
  }
  return out.map((e) => ({ ...e, documentation: [...e.documentation, DMN_DOC] }));
}

// ---------------------------------------------------------------------------
// Withdrawal DMNs
// ---------------------------------------------------------------------------

function withdrawalState(v: WithdrawalValue) {
  const order = nonEmpty(v.wdOrderStatus);
  const request = nonEmpty(v.wdRequestStatus);
  const state = nonEmpty(v.wdRequestState);
  const orderInfo = order ? lookup(WD_ORDER_STATUSES, order) : undefined;
  const requestInfo = request ? lookup(WD_REQUEST_STATUSES, request) : undefined;
  const settlement = nonEmpty(v.settlementType);
  const stage: LifecycleStage = settlement === "Refund" ? "refund" : "payout";
  const outcome: Outcome = order
    ? (orderInfo?.outcome ?? "unknown")
    : (requestInfo?.outcome ?? "unknown");
  const known = order ? orderInfo !== undefined : requestInfo !== undefined;
  return { order, request, state, orderInfo, requestInfo, settlement, stage, outcome, known };
}

function withdrawalGateway(v: WithdrawalValue, failed: boolean): Decoded | undefined {
  const gw = intCode(v.gwErrCode);
  const ext = intCode(v.gwExtendedErrorCode);
  const reason = nonEmpty(v.gwReason);
  if ((gw === undefined || gw === "0") && (ext === undefined || ext === "0") && !(failed && reason))
    return undefined;
  return decodeGateway({
    gwErrorCode: gw,
    gwExtendedErrorCode: ext,
    reason,
    // A gateway reason with the -1 code is read as a decline reason.
    status: gw === "-1" && (ext === undefined || ext === "0") ? "DECLINED" : undefined,
    names: { gw: "gwErrCode", ext: "gwExtendedErrorCode", reason: "gwReason" },
    inferred: true,
    reasonDocumented: false,
  });
}

function withdrawalEvent(v: WithdrawalValue, ctx: NormalizeContext): NormalizedEventDraft {
  const s = withdrawalState(v);
  const checksum = nonEmpty(v.checksum);
  const notification = nonEmpty(v.notificationType);
  return clean({
    sourceFormat: ctx.format,
    eventType: "withdrawal_dmn",
    eventTypeKnown: s.known,
    stage: s.stage,
    providerStatus: safeText(s.order ?? s.request, 64),
    paymentReference: idOf(v.wdRequestId),
    relatedReference: idOf(v.wdOrderId),
    merchantReference: idOf(v.merchantWDRequestId),
    outcome: s.outcome,
    attributes: attrs([
      ["deliveryChannel", "dmn"],
      ["wdRequestState", s.state && WD_REQUEST_STATES.has(s.state) ? s.state : undefined],
      ["wdRequestStateKnown", s.state && !WD_REQUEST_STATES.has(s.state) ? false : undefined],
      ["wdRequestStatus", s.request],
      ["wdRequestStatusKnown", s.request && !s.requestInfo ? false : undefined],
      ["wdOrderStatus", s.order],
      ["wdOrderStatusKnown", s.order && !s.orderInfo ? false : undefined],
      ["outcomeFrom", s.order ? "wdOrderStatus" : "wdRequestStatus"],
      [
        "settlementType",
        s.settlement && SETTLEMENT_TYPES.has(s.settlement) ? s.settlement : undefined,
      ],
      [
        "notificationType",
        notification === WITHDRAWAL_NOTIFICATION_TYPE ? notification : undefined,
      ],
      [
        "notificationTypeKnown",
        notification && notification !== WITHDRAWAL_NOTIFICATION_TYPE ? false : undefined,
      ],
      ["wdRequestId", idOf(v.wdRequestId)],
      ["wdOrderId", idOf(v.wdOrderId)],
      ["gwTrxId", idOf(v.gwTrxId)],
      ["gwRelatedTransactionId", idOf(v.gwRelatedTransactionId)],
      ["gwErrCode", intCode(v.gwErrCode)],
      ["gwExtendedErrorCode", intCode(v.gwExtendedErrorCode)],
      ["gwReason", nonEmpty(v.gwReason)],
      ["gwReasonCode", looseCode(v.gwReasonCode)],
      ["apmErrorCode", looseCode(v.apmErrorCode)],
      ["checksumLength", checksum ? checksum.length : undefined],
      ["signatureVerified", false],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function withdrawalErrors(v: WithdrawalValue, ctx: NormalizeContext): DecodedErrorDraft[] {
  const s = withdrawalState(v);
  const wdRequestId = idOf(v.wdRequestId);
  const attempt = idOf(v.wdOrderId) ?? idOf(v.gwTrxId);
  const loc: Location = {
    ctx,
    ...(wdRequestId ? { paymentReference: wdRequestId } : {}),
    ...(attempt ? { attemptReference: attempt } : {}),
  };
  const shared: Record<string, string> = {};
  if (s.request) shared.wdRequestStatus = safeText(s.request, 64) ?? "";
  if (s.order) shared.wdOrderStatus = safeText(s.order, 64) ?? "";
  const failed = s.outcome === "failure";
  const out: DecodedErrorDraft[] = [];
  const gateway = withdrawalGateway(v, failed);
  if (gateway) {
    const reason = nonEmpty(v.gwReason);
    out.push(
      draft(loc, "gwErrCode", {
        ...gateway,
        subCodes: { ...shared, ...gateway.subCodes },
        ...(reason ? { message: safeText(reason, 200) } : {}),
      }),
    );
  }
  const apmCode = looseCode(v.apmErrorCode);
  const apmText = nonEmpty(v.apmErrorDetails);
  if ((apmCode !== undefined && apmCode !== "0") || apmText) {
    const dec = undocumentedApmError(
      "apmErrorCode",
      apmCode && apmCode !== "0" ? apmCode : undefined,
      safeText(apmText, 200),
      "The payout method",
    );
    out.push(draft(loc, "apmErrorCode", { ...dec, subCodes: { ...shared, ...dec.subCodes } }));
  }
  // A declined or cancelled request is a decision, not an error; only Error is reported without a code.
  const errorStatus = s.order === "Error" || (!s.order && s.request === "Error");
  if (out.length === 0 && errorStatus) {
    out.push(
      draft(loc, "", { ...codeless("The Nuvei withdrawal DMN", "Error"), subCodes: shared }),
    );
  }
  return out.map((e) => ({ ...e, documentation: [...e.documentation, WITHDRAWAL_DOC] }));
}

// ---------------------------------------------------------------------------
// Control Panel chargeback event DMNs
// ---------------------------------------------------------------------------

function chargebackRefs(v: ChargebackValue) {
  const td = v.TransactionDetails ?? undefined;
  const raw = td?.TransactionId;
  const transactionId = idOf(raw);
  const precisionLost = typeof raw === "number" && !Number.isSafeInteger(raw);
  return { transactionId, precisionLost };
}

function chargebackEvent(v: ChargebackValue, ctx: NormalizeContext): NormalizedEventDraft {
  const cb = v.Chargeback;
  const refs = chargebackRefs(v);
  const eventId = idOf(v.EventId) ?? idOf(v.EventCorrelationId);
  const currency = upperCurrency(cb.Currency ?? undefined);
  const amount = currency && cb.Amount != null ? decimalToMinor(cb.Amount, currency) : undefined;
  const category = nonEmpty(cb.ChargebackStatusCategory) ?? nonEmpty(cb.StatusCategory);
  const type = nonEmpty(cb.Type);
  const attempt = intCode(v.AttemptNumber);
  return clean({
    sourceFormat: ctx.format,
    eventType: "Chargeback",
    eventTypeKnown: true,
    stage: "dispute",
    providerStatus: safeText(category ?? type, 64),
    eventReference: eventId,
    paymentReference: refs.transactionId,
    relatedReference: idOf(cb.DisputeId),
    merchantReference: idOf(v.TransactionDetails?.ClientUniqueId),
    deliveryKey: eventId ? `event|${eventId}` : undefined,
    eventTimestamp: isoOf(v.EventDateUTC),
    amountMinor: amount,
    currency: amount ? currency : undefined,
    // A chargeback's final outcome is decided later in the dispute process.
    outcome: "unknown",
    attributes: attrs([
      ["deliveryChannel", "event_dmn"],
      ["disputeType", type && lookup(CHARGEBACK_TYPES, type) ? type : undefined],
      ["disputeTypeKnown", type && !lookup(CHARGEBACK_TYPES, type) ? false : undefined],
      ["statusCategory", category],
      [
        "statusCategoryKnown",
        category && !CHARGEBACK_STATUS_CATEGORIES.has(category) ? false : undefined,
      ],
      ["chargebackStatus", nonEmpty(cb.Status)],
      ["chargebackReason", nonEmpty(cb.ChargebackReason)],
      ["chargebackReasonInterpreted", nonEmpty(cb.ChargebackReason) ? false : undefined],
      ["reasonCategory", nonEmpty(cb.ChargebackReasonCategory)],
      ["disputeUnifiedStatusCode", looseCode(cb.DisputeUnifiedStatusCode)],
      ["disputeDueDate", safeText(nonEmpty(cb.DisputeDueDate), 32)],
      ["disputeEventId", idOf(cb.DisputeEventId)],
      ["transactionId", refs.transactionId],
      ["transactionIdPrecisionLost", refs.precisionLost || undefined],
      ["eventCorrelationId", idOf(v.EventCorrelationId)],
      ["attemptNumber", attempt !== undefined ? Number(attempt) : undefined],
      ["redelivery", attempt !== undefined && Number(attempt) > 1 ? true : undefined],
      ["signatureVerified", false],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

function normalize(parsed: NuveiParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "rest":
      return [restEvent(parsed.value, ctx)];
    case "payment_dmn":
      return [dmnEvent(parsed.value, ctx)];
    case "withdrawal_dmn":
      return [withdrawalEvent(parsed.value, ctx)];
    case "chargeback_dmn":
      return [chargebackEvent(parsed.value, ctx)];
  }
}

function decodeErrors(parsed: NuveiParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "rest":
      return restErrors(parsed.value, ctx);
    case "payment_dmn":
      return dmnErrors(parsed.value, ctx);
    case "withdrawal_dmn":
      return withdrawalErrors(parsed.value, ctx);
    case "chargeback_dmn":
      return [];
  }
}

function correlationKeys(event: NormalizedEvent): string[] {
  const a = event.attributes;
  const keys: string[] = [];
  const add = (prefix: string, v: unknown) => {
    if (typeof v === "string" && v !== "") keys.push(`${prefix}:${v}`);
  };
  // Gateway transaction ids are shared by REST responses, DMNs and event DMNs;
  // each operation has its own id and links to its parent by relatedTransactionId.
  switch (event.sourceFormat) {
    case NUVEI_FORMATS.restResponse:
      add("trx", a.transactionId);
      add("trx", a.relatedTransactionId);
      add("order", a.orderId);
      break;
    case NUVEI_FORMATS.paymentDmn:
      add("trx", a.transactionId);
      add("trx", a.relatedTransactionId);
      add("ppp", a.pppTransactionId);
      break;
    case NUVEI_FORMATS.withdrawalDmn:
      add("wd", a.wdRequestId);
      add("trx", a.gwTrxId);
      add("trx", a.gwRelatedTransactionId);
      break;
    case NUVEI_FORMATS.chargebackDmn:
      add("trx", a.transactionId);
      break;
  }
  return [...new Set(keys)];
}

export const nuveiAdapter: ProviderAdapter<NuveiParsed> = {
  id: PROVIDER,
  displayName: "Nuvei",
  version: NUVEI_ADAPTER_VERSION,
  manifest: nuveiManifest,
  supportedFormats: [
    {
      id: NUVEI_FORMATS.restResponse,
      description:
        "REST API 1.0 JSON response (status, errCode, transactionStatus and the gateway and APM error fields)",
    },
    {
      id: NUVEI_FORMATS.paymentDmn,
      description: "Payment DMN (query string or form body with ppp_status and Status)",
    },
    {
      id: NUVEI_FORMATS.withdrawalDmn,
      description: "Withdrawal DMN (wdRequestId, wdRequestStatus, wdOrderStatus)",
    },
    {
      id: NUVEI_FORMATS.chargebackDmn,
      description: "Control Panel event DMN with EventType Chargeback",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default nuveiAdapter;
