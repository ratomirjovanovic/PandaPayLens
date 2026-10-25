/**
 * Skrill adapter.
 *
 * Supported input families:
 * - `skrill.status_url`        status_url post (payments, chargebacks and the payout posts that
 *                              share its field set), also the MQI status_trn body
 * - `skrill.refund_status`     refund status report posted to refund_status_url
 * - `skrill.recurring_status`  recurring billing post to rec_status_url
 * - `skrill.ubp.error`         Unlinked Merchant Bank Payout JSON error response
 *
 * Recognized but not supported: `skrill.return_url` (redirect parameters that
 * only show the customer finished the checkout) and `skrill.balance.webhook`
 * (treasury notification).
 *
 * Skrill used inside Paysafe Checkout sends Paysafe JSON, which is left to a
 * Paysafe adapter: nothing here matches it. Detection relies on field
 * structure only.
 */

import {
  decimalToMinor,
  lookup,
  safeId,
  safeText,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type ProviderAdapter,
  type RecordMeta,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  API_ERROR_PATTERNS,
  API_ERRORS,
  BANK_API_ERRORS,
  BANK_PAYOUT_ONLY_STATUSES,
  FAILED_REASON_CODES,
  FAMILY_DOCS,
  MQI_HTTP_ERRORS,
  NEXT_ACTION,
  PAYMENT_STATUSES,
  PAYMENT_TYPES_DOCUMENTED,
  QC_INTRODUCTION_URL,
  RECURRING_STATUSES,
  REFUND_STATUSES,
  RETRY_EXPLANATION,
  STATUS_TEXT_REASONS,
  UBP_EXECUTION_ERRORS,
  UBP_GENERIC_CODES,
  UBP_PREPARATION_ERRORS,
  type CatalogEntry,
  type CodeFamily,
  type StatusInfo,
} from "./catalog.js";
import { skrillManifest, SKRILL_ADAPTER_VERSION } from "./manifest.js";

export { skrillManifest, SKRILL_ADAPTER_VERSION };

export const SKRILL_FORMATS = {
  statusReport: "skrill.status_url",
  refundStatus: "skrill.refund_status",
  recurringStatus: "skrill.recurring_status",
  ubpError: "skrill.ubp.error",
  returnUrl: "skrill.return_url",
  balanceWebhook: "skrill.balance.webhook",
} as const;

// ---------------------------------------------------------------------------
// Helpers

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Obj, k: string) => Object.hasOwn(o, k);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Form data arrives as strings, or string arrays for repeated keys. */
function isFlatStrings(o: Obj): boolean {
  return Object.values(o).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

const HEX32 = /^[0-9a-f]{32}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

/** Signatures are never verified; only presence and hex length are reported. */
function signatureClass(sig: unknown, hex: RegExp, label: string): string {
  if (typeof sig !== "string" || sig === "") return "absent";
  return hex.test(sig) ? `present_${label}` : "present_other";
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(values: Record<string, SafePrimitive | SafePrimitive[] | undefined>): Attrs {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Attrs;
}

function money(amount: unknown, currency: unknown) {
  const cur = upperCurrency(currency);
  const amountMinor = decimalToMinor(amount, cur);
  return { amountMinor, currency: amountMinor !== undefined ? cur : undefined };
}

function boolish(v: unknown): boolean | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase();
  if (t === "true") return true;
  if (t === "false") return false;
  return undefined;
}

const nonEmpty = (v: unknown) => typeof v === "string" && v.trim() !== "";

// ---------------------------------------------------------------------------
// Detection

/** Fields the status_url table lists for payments; refund reports carry none of them. */
const PAYMENT_POST_FIELDS = ["merchant_id", "pay_to_email", "pay_from_email", "amount", "currency"];

const KNOWN_POST_STATUSES = new Set([
  ...Object.keys(PAYMENT_STATUSES),
  ...Object.keys(BANK_PAYOUT_ONLY_STATUSES),
]);

const UBP_SPECIFIC_CODES = new Set(
  Object.keys(UBP_PREPARATION_ERRORS).filter(
    (c) => !(UBP_GENERIC_CODES as readonly string[]).includes(c),
  ),
);

function ubpCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  return typeof v === "string" ? v.trim() : undefined;
}

const EXECUTION_RANGE = /^70(?:0[1-9]|1[0-8])$/;

function ubpFamily(code: string | undefined): "ubp_preparation" | "ubp_execution" | undefined {
  if (code === undefined) return undefined;
  if (lookup(UBP_PREPARATION_ERRORS, code)) return "ubp_preparation";
  if (lookup(UBP_EXECUTION_ERRORS, code)) return "ubp_execution";
  return undefined;
}

function detectJson(input: Obj): DetectionResult | null {
  const base = { provider: "skrill" };

  // Balance Notification Webhook: treasury, out of scope.
  const data = input.data;
  if (
    (typeof input.notificationId === "string" || typeof input.notificationId === "number") &&
    has(input, "timestamp") &&
    isObj(data) &&
    has(data, "accountId") &&
    has(data, "availableBalance")
  ) {
    return {
      ...base,
      format: SKRILL_FORMATS.balanceWebhook,
      confidence: round(0.55 + (has(data, "currency") ? 0.1 : 0)),
      supported: false,
      reasons: ["notificationId and timestamp with data.accountId and data.availableBalance"],
      unsupportedReason:
        "This looks like a Skrill Balance Notification Webhook. It reports a wallet balance (treasury), not a payment, and is not analyzed.",
    };
  }

  // Unlinked Merchant Bank Payout error: flat { code, message, description }
  // or nested { error: { code, details } }. Paysafe JSON uses the nested
  // shape too, so only Skrill-specific codes are claimed there.
  const nested = isObj(input.error) ? input.error : undefined;
  const code = ubpCode(nested ? nested.code : input.code);
  const family = ubpFamily(code);
  if (!family && code !== undefined && EXECUTION_RANGE.test(code)) {
    // Undocumented code inside the documented execution range (for example
    // 7016): only offered below the threshold, for a manual provider choice.
    if (nested || !has(input, "message") || !has(input, "description")) return null;
    return {
      ...base,
      format: SKRILL_FORMATS.ubpError,
      confidence: 0.35,
      supported: true,
      reasons: ["code, message and description with an undocumented code in the 7001-7018 range"],
      unsupportedReason:
        "The code is not documented, so this response cannot be attributed to Skrill bank payouts reliably. Select the provider manually if it is one.",
    };
  }
  if (family) {
    const flat = !nested && has(input, "message") && has(input, "description");
    const nestedShape = nested !== undefined && has(nested, "details");
    if (!flat && !nestedShape) return null;
    const specific = family === "ubp_execution" || UBP_SPECIFIC_CODES.has(code!);
    let c = 0.4;
    const reasons = [
      flat
        ? "code, message and description like a bank payout error response"
        : "error.code with details like a bank payout error response",
    ];
    if (UBP_SPECIFIC_CODES.has(code!) || (flat && family === "ubp_execution")) {
      c = 0.6;
      reasons.push(
        `code "${code}" is a documented bank payout ${family === "ubp_execution" ? "execution" : "preparation"} code`,
      );
    } else if (specific) {
      reasons.push(
        "the numeric code is documented for bank payouts, but the nested shape is shared with Paysafe JSON",
      );
    }
    return {
      ...base,
      format: SKRILL_FORMATS.ubpError,
      confidence: round(c),
      supported: true,
      reasons,
      ...(c < 0.5
        ? {
            unsupportedReason:
              "The error code alone cannot attribute this response to Skrill bank payouts reliably. Select the provider manually if it is one.",
          }
        : {}),
    };
  }
  return null;
}

function detectForm(input: Obj): DetectionResult | null {
  const base = { provider: "skrill" };
  if (!isFlatStrings(input)) return null;
  const s = (k: string) => str(input[k]);
  const status = s("status")?.trim();

  // A repeated key arrives as an array; it is still detected so that parse
  // can report it.
  if (has(input, "mb_transaction_id") && has(input, "status")) {
    const hasMbAmount = has(input, "mb_amount");
    const hasMbCurrency = has(input, "mb_currency");
    if (!hasMbAmount && !hasMbCurrency) return null;
    const markers = PAYMENT_POST_FIELDS.filter((k) => has(input, k));
    const md5 = HEX32.test(s("md5sig") ?? "");
    const sha2 = HEX64.test(s("sha2sig") ?? "");
    let c = 0.45;
    const reasons = ["has mb_transaction_id, mb_amount/mb_currency and status"];
    if (md5) {
      c += 0.2;
      reasons.push("md5sig has the length of an MD5 hex signature");
    }
    if (sha2) c += 0.05;
    if (hasMbAmount && hasMbCurrency) c += 0.05;

    if (markers.length === 0) {
      reasons.push("no merchant_id, pay_to_email or amount fields, like a refund status report");
      if (status === "2" || status === "-2") c += 0.1;
      if (has(input, "transaction_id")) c += 0.05;
      return {
        ...base,
        format: SKRILL_FORMATS.refundStatus,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
    if (status !== undefined && KNOWN_POST_STATUSES.has(status)) {
      c += 0.1;
      reasons.push(`status "${status}" is a documented status_url value`);
    }
    c += Math.min(markers.length * 0.04, 0.15);
    reasons.push(`has ${markers.join(", ")}`);
    return {
      ...base,
      format: SKRILL_FORMATS.statusReport,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  if (has(input, "rec_payment_id") && has(input, "status") && !has(input, "mb_transaction_id")) {
    const extra = [
      has(input, "rec_payment_type"),
      HEX32.test(s("md5sig") ?? ""),
      has(input, "merchant_id"),
    ];
    if (!extra.some(Boolean)) return null;
    let c = 0.4;
    const reasons = ["has rec_payment_id and status without mb_transaction_id"];
    if (extra[0]) {
      c += 0.15;
      reasons.push("has rec_payment_type");
    }
    if (extra[1]) {
      c += 0.2;
      reasons.push("md5sig has the length of an MD5 hex signature");
    }
    if (extra[2]) c += 0.1;
    if (has(input, "transaction_id")) c += 0.05;
    if (status !== undefined && lookup(RECURRING_STATUSES, status)) c += 0.05;
    return {
      ...base,
      format: SKRILL_FORMATS.recurringStatus,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  if (
    HEX32.test(s("msid") ?? "") &&
    has(input, "transaction_id") &&
    !has(input, "status") &&
    !has(input, "mb_transaction_id")
  ) {
    return {
      ...base,
      format: SKRILL_FORMATS.returnUrl,
      confidence: 0.6,
      supported: false,
      reasons: ["transaction_id with a 32-hex msid, like the secure return_url parameters"],
      unsupportedReason:
        "This looks like the Skrill return_url redirect (transaction_id and msid). It only shows that the customer finished the checkout, not that the payment was processed. Paste the status_url post instead.",
    };
  }
  return null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "skrill",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  if (meta?.format !== "form") {
    const j = detectJson(input);
    if (j) return j;
  }
  return detectForm(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing

const opt = (max: number) => z.string().max(max).optional();

const StatusReport = z.looseObject({
  mb_transaction_id: z.string().min(1).max(64),
  status: z.string().min(1).max(8),
  mb_amount: z.string().min(1).max(32),
  mb_currency: z.string().min(1).max(8),
  transaction_id: opt(128),
  merchant_id: opt(64),
  amount: opt(32),
  currency: opt(8),
  md5sig: opt(256),
  sha2sig: opt(256),
  failed_reason_code: opt(16),
  payment_type: opt(32),
  rec_payment_id: opt(64),
  confirmed_by_provider: opt(8),
  customer_id: opt(256),
  instrument_id: opt(256),
  merchant_fields: opt(2000),
  pay_to_email: opt(320),
  pay_from_email: opt(320),
});

const RefundStatus = z.looseObject({
  mb_transaction_id: z.string().min(1).max(64),
  status: z.string().min(1).max(8),
  mb_amount: z.string().min(1).max(32),
  mb_currency: z.string().min(1).max(8),
  transaction_id: opt(128),
  md5sig: opt(256),
  sha2sig: opt(256),
});

const RecurringStatus = z.looseObject({
  rec_payment_id: z.string().min(1).max(64),
  status: z.string().min(1).max(8),
  transaction_id: opt(128),
  merchant_id: opt(64),
  rec_payment_type: opt(64),
  md5sig: opt(256),
  sha2sig: opt(256),
  merchant_fields: opt(2000),
});

const ubpCodeSchema = z.union([z.string().min(1).max(64), z.number().int()]);

const UbpFlat = z.looseObject({
  code: ubpCodeSchema,
  message: opt(2000),
  description: opt(2000),
});

const UbpNested = z.looseObject({
  error: z.looseObject({
    code: ubpCodeSchema,
    message: opt(2000),
    description: opt(2000),
  }),
});

type UbpError = { code: string; message?: string; description?: string; nested: boolean };

export type SkrillParsed =
  | { kind: "status_report"; value: z.infer<typeof StatusReport> }
  | { kind: "refund_status"; value: z.infer<typeof RefundStatus> }
  | { kind: "recurring_status"; value: z.infer<typeof RecurringStatus> }
  | { kind: "ubp_error"; value: UbpError };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: SkrillParsed } | { ok: false; issues: string[] } {
  if (!isObj(input))
    return { ok: false, issues: ["(root): expected an object or a set of form fields"] };
  if (format === SKRILL_FORMATS.statusReport) {
    const r = StatusReport.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "status_report", value: r.data } };
  }
  if (format === SKRILL_FORMATS.refundStatus) {
    const r = RefundStatus.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "refund_status", value: r.data } };
  }
  if (format === SKRILL_FORMATS.recurringStatus) {
    const r = RecurringStatus.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "recurring_status", value: r.data } };
  }
  if (format === SKRILL_FORMATS.ubpError) {
    if (isObj(input.error)) {
      const r = UbpNested.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const e = r.data.error;
      return {
        ok: true,
        value: {
          kind: "ubp_error",
          value: {
            code: String(e.code).trim(),
            nested: true,
            ...(e.message !== undefined ? { message: e.message } : {}),
            ...(e.description !== undefined ? { description: e.description } : {}),
          },
        },
      };
    }
    const r = UbpFlat.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return {
      ok: true,
      value: {
        kind: "ubp_error",
        value: {
          code: String(r.data.code).trim(),
          nested: false,
          ...(r.data.message !== undefined ? { message: r.data.message } : {}),
          ...(r.data.description !== undefined ? { description: r.data.description } : {}),
        },
      },
    };
  }
  return { ok: false, issues: [`Unsupported Skrill format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Code decoding

export type CodeDecoding = {
  code: string;
  /** Documented table the code was decoded from; null when unknown. */
  family: CodeFamily | null;
  entry: CatalogEntry;
  confidence: Confidence;
  missing: string[];
  subCodes: Record<string, string>;
  documentation: DocumentationLink[];
};

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Code not in the PandaPayLens Skrill catalog",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens does not recognize this Skrill code.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

function decoded(
  code: string,
  family: CodeFamily,
  entry: CatalogEntry,
  confidence: Confidence,
  missing: string[] = [],
  subCodes: Record<string, string> = {},
): CodeDecoding {
  return {
    code,
    family,
    entry,
    confidence,
    missing,
    subCodes: { family, ...subCodes },
    documentation: [...FAMILY_DOCS[family]],
  };
}

function unknownCode(code: string, family: CodeFamily, what: string): CodeDecoding {
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [`${what} "${safeText(code, 40) ?? ""}" is not in the documented Skrill tables.`],
    subCodes: {},
    documentation: [...FAMILY_DOCS[family]],
  };
}

/**
 * Canonical form of a failed_reason_code: the Quick Checkout table pads codes
 * below 10 (`05`), the Wallet Checkout table does not (`5`).
 */
export function canonicalReasonCode(raw: string): string {
  const t = raw.trim();
  if (!/^\d{1,6}$/.test(t)) return t;
  const n = t.replace(/^0+(?=\d)/, "");
  return n.length === 1 ? `0${n}` : n;
}

/** Decodes a `failed_reason_code` value. */
export function decodeFailedReason(raw: string): CodeDecoding {
  const code = canonicalReasonCode(raw);
  const sub: Record<string, string> =
    code !== raw.trim() ? { rawCode: safeText(raw, 16) ?? "" } : {};
  const e = lookup(FAILED_REASON_CODES, code);
  if (e) {
    const table = e.only ?? "both";
    return decoded(
      code,
      "failed_reason",
      e,
      e.conflict ? "possible" : "strong",
      e.conflict
        ? ["The post does not say whether the Quick Checkout or the Wallet Checkout table applies."]
        : [],
      { ...sub, table },
    );
  }
  const text = lookup(STATUS_TEXT_REASONS, code);
  if (text)
    return decoded(
      code,
      "status_text",
      text,
      "possible",
      [
        `Code ${code} is not in either failed reason code table; its meaning comes from the status -2 description.`,
      ],
      sub,
    );
  const u = unknownCode(code, "failed_reason", "failed_reason_code");
  return { ...u, subCodes: sub };
}

/**
 * Decodes an API / MQI `<error_msg>` string. Exact codes win over the
 * documented wildcard families (INVALID_*, MISSING_*, NOT_SUPPORTED_CURRENCY_*).
 */
export function decodeApiError(raw: string): CodeDecoding {
  const code = raw.trim();
  const exact = code.includes("*") ? undefined : lookup(API_ERRORS, code);
  if (exact) return decoded(code, "api", exact, "strong");
  // The docs print one code with a stray space ("CC_REFUND_ FAILED").
  const compact = code.replace(/\s+/g, "");
  if (compact !== code && !compact.includes("*")) {
    const e = lookup(API_ERRORS, compact);
    if (e)
      return decoded(compact, "api", e, "possible", [
        "The code contained whitespace; it was matched after removing it.",
      ]);
  }
  for (const pattern of API_ERROR_PATTERNS) {
    const prefix = pattern.slice(0, -1);
    if (code.startsWith(prefix) && code.length > prefix.length && /^[A-Z0-9_]+$/.test(code)) {
      return decoded(code, "api", API_ERRORS[pattern]!, "strong", [], {
        pattern,
        parameter: code.slice(prefix.length).toLowerCase(),
      });
    }
  }
  return unknownCode(code, "api", "Error");
}

/** Decodes an MQI HTTP error status. */
export function decodeMqiHttpError(status: number | string): CodeDecoding {
  const code = String(status).trim();
  const e = lookup(MQI_HTTP_ERRORS, code);
  return e ? decoded(code, "mqi_http", e, "strong") : unknownCode(code, "mqi_http", "HTTP status");
}

/** Decodes a Bank API error code. */
export function decodeBankApiError(raw: string | number): CodeDecoding {
  const code = String(raw).trim();
  const e = lookup(BANK_API_ERRORS, code);
  return e ? decoded(code, "bank_api", e, "strong") : unknownCode(code, "bank_api", "Code");
}

/** Decodes an Unlinked Merchant Bank Payout preparation or execution code. */
export function decodeBankPayoutError(raw: string | number): CodeDecoding {
  const code = String(raw).trim();
  const prep = lookup(UBP_PREPARATION_ERRORS, code);
  if (prep) return decoded(code, "ubp_preparation", prep, "strong");
  const exec = lookup(UBP_EXECUTION_ERRORS, code);
  if (exec) return decoded(code, "ubp_execution", exec, "strong");
  const u = unknownCode(code, "ubp_execution", "Code");
  if (code === "7016") u.missing.push("Code 7016 is not documented.");
  return { ...u, documentation: [...FAMILY_DOCS.ubp_preparation, ...FAMILY_DOCS.ubp_execution] };
}

// ---------------------------------------------------------------------------
// Normalization

type Operation = "payment" | "chargeback" | "bank_payout" | "payment_or_payout";

/** Fields the status_url table documents for payments and the payout posts do not list. */
const PAYMENT_ONLY_FIELDS = [
  "customer_id",
  "rec_payment_id",
  "instrument_id",
  "merchant_fields",
  "confirmed_by_provider",
  "payment_instrument_country",
  "country",
  "IP_country",
] as const;

function operationOf(r: Obj, status: string): { op: Operation; basis: string } {
  if (status === "-3") return { op: "chargeback", basis: "status" };
  if (lookup(BANK_PAYOUT_ONLY_STATUSES, status)) return { op: "bank_payout", basis: "status" };
  const field = PAYMENT_ONLY_FIELDS.find((k) => has(r, k));
  if (field) return { op: "payment", basis: field };
  if ((PAYMENT_TYPES_DOCUMENTED as readonly string[]).includes(str(r.payment_type) ?? ""))
    return { op: "payment", basis: "payment_type" };
  return { op: "payment_or_payout", basis: "none" };
}

function base(ctx: NormalizeContext) {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

const statusOf = (raw: string) => raw.trim();
const safeStatus = (raw: string) => safeText(statusOf(raw), 8) ?? "";

function postStatus(status: string): StatusInfo | undefined {
  return lookup(PAYMENT_STATUSES, status) ?? lookup(BANK_PAYOUT_ONLY_STATUSES, status);
}

function reasonCodeOf(v: string | undefined): string | undefined {
  return nonEmpty(v) ? safeId(v!.trim(), 16) : undefined;
}

function normalizeStatusReport(
  r: z.infer<typeof StatusReport>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const status = statusOf(r.status);
  const info = postStatus(status);
  const { op, basis } = operationOf(r, status);
  const mbId = safeId(r.mb_transaction_id, 64);
  const reason = reasonCodeOf(r.failed_reason_code);
  // amount/currency is the payment amount; mb_amount/mb_currency is the
  // merchant account amount and may carry more decimals than the currency has.
  const payment = money(r.amount, r.currency);
  const wallet = money(r.mb_amount, r.mb_currency);
  const useWallet = payment.amountMinor === undefined;
  const event = useWallet ? wallet : payment;
  const walletCurrency = upperCurrency(r.mb_currency);
  const tid = safeId(r.transaction_id, 128);
  const paymentType = /^[A-Z0-9_]{2,16}$/.test(r.payment_type ?? "") ? r.payment_type : undefined;
  const providerStatus = `status=${safeStatus(r.status)}${reason ? `; failed_reason_code=${reason}` : ""}`;

  return clean({
    ...base(ctx),
    eventType: `status_url.${info?.name ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? "other",
    providerStatus,
    paymentReference: mbId,
    merchantReference: tid,
    subscriptionReference: safeId(r.rec_payment_id, 64),
    // Skrill documents repeat posts for the same transaction but no event id;
    // the transaction id plus status identifies one state change.
    deliveryKey: info && mbId ? `status_url:${mbId}:${status}` : undefined,
    amountMinor: event.amountMinor,
    currency: event.currency,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      status: safeStatus(r.status),
      statusMeaning: info?.meaning,
      operation: op,
      operationBasis: basis,
      mbTransactionId: mbId,
      merchantId: safeId(r.merchant_id, 64),
      paymentType,
      failedReasonCode: reason,
      reasonCodeInPayload: status === "-2" ? reason !== undefined : undefined,
      recPaymentId: safeId(r.rec_payment_id, 64),
      confirmedByProvider: boolish(r.confirmed_by_provider),
      amountBasis: event.amountMinor === undefined ? undefined : useWallet ? "mb_amount" : "amount",
      walletAmountMinor: useWallet ? undefined : wallet.amountMinor,
      walletCurrency: useWallet ? undefined : walletCurrency,
      walletAmountExceedsMinorUnits:
        wallet.amountMinor === undefined && walletCurrency && nonEmpty(r.mb_amount)
          ? true
          : undefined,
      transactionIdIsSkrillId: tid !== undefined && tid === mbId ? true : undefined,
      parentReferenceInPayload: op === "chargeback" ? false : undefined,
      md5sig: signatureClass(r.md5sig, HEX32, "32_hex"),
      sha2sig: signatureClass(r.sha2sig, HEX64, "64_hex"),
      signatureVerified: false,
    }),
  });
}

function normalizeRefund(
  r: z.infer<typeof RefundStatus>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const status = statusOf(r.status);
  const info = lookup(REFUND_STATUSES, status);
  const mbId = safeId(r.mb_transaction_id, 64);
  return clean({
    ...base(ctx),
    eventType: `refund_status.${info?.name ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage: "refund",
    providerStatus: `status=${safeStatus(r.status)}`,
    // The refund's own Skrill id; the report has no field for the original payment.
    paymentReference: mbId,
    merchantReference: safeId(r.transaction_id, 128),
    deliveryKey: info && mbId ? `refund_status:${mbId}:${status}` : undefined,
    ...money(r.mb_amount, r.mb_currency),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      status: safeStatus(r.status),
      statusMeaning: info?.meaning,
      operation: "refund",
      mbTransactionId: mbId,
      parentReferenceInPayload: false,
      md5sig: signatureClass(r.md5sig, HEX32, "32_hex"),
      sha2sig: signatureClass(r.sha2sig, HEX64, "64_hex"),
      signatureVerified: false,
    }),
  });
}

function normalizeRecurring(
  r: z.infer<typeof RecurringStatus>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const status = statusOf(r.status);
  const info = lookup(RECURRING_STATUSES, status);
  const recId = safeId(r.rec_payment_id, 64);
  return clean({
    ...base(ctx),
    eventType: `recurring_status.${info?.name ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? "other",
    providerStatus: `status=${safeStatus(r.status)}`,
    paymentReference: recId,
    merchantReference: safeId(r.transaction_id, 128),
    subscriptionReference: recId,
    isRecurring: info ? true : undefined,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      status: safeStatus(r.status),
      statusMeaning: info?.meaning,
      operation: "recurring_payment",
      recPaymentId: recId,
      recPaymentType: safeText(r.rec_payment_type, 32),
      merchantId: safeId(r.merchant_id, 64),
      md5sig: signatureClass(r.md5sig, HEX32, "32_hex"),
      sha2sig: signatureClass(r.sha2sig, HEX64, "64_hex"),
      signatureVerified: false,
    }),
  });
}

function normalizeUbpError(e: UbpError, ctx: NormalizeContext): NormalizedEventDraft {
  const d = decodeBankPayoutError(e.code);
  const code = safeText(e.code, 64) ?? "";
  const http = ctx.meta?.http?.status;
  return clean({
    ...base(ctx),
    eventType: "bank_payout.error",
    eventTypeKnown: true,
    stage: "error",
    providerStatus: `code=${code}`,
    outcome: "failure",
    attributes: attrs({
      code,
      codeFamily: d.family ?? undefined,
      operation: "bank_payout",
      shape: e.nested ? "nested" : "flat",
      httpStatus: http,
    }),
  });
}

function normalize(parsed: SkrillParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "status_report":
      return [normalizeStatusReport(parsed.value, ctx)];
    case "refund_status":
      return [normalizeRefund(parsed.value, ctx)];
    case "recurring_status":
      return [normalizeRecurring(parsed.value, ctx)];
    case "ubp_error":
      return [normalizeUbpError(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding

const AMBIGUOUS_NOTE =
  "No field marks this post as a payment. Quick Checkout payout and bank payout status posts use the same fields; if this is a payout, the payment reason-code tables may not apply.";

function draftFrom(
  d: CodeDecoding,
  ctx: NormalizeContext,
  extra: { subCodes?: Record<string, string>; paymentReference?: string; message?: string },
): DecodedErrorDraft {
  const providerMessage = safeText(extra.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: d.code,
    subCodes: { ...d.subCodes, ...extra.subCodes },
    category: d.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: d.entry.explanation,
    nextAction: d.entry.nextAction,
    retry: d.entry.retry,
    retryExplanation: d.entry.retryExplanation,
    confidence: d.confidence,
    documentation: d.documentation,
    missingInformation: [...d.missing],
    ...(extra.paymentReference
      ? { paymentReference: extra.paymentReference, attemptReference: extra.paymentReference }
      : {}),
    // Status -2 and API rejections are definitive answers.
    outcomeKnown: true,
  };
}

/** A failed post without failed_reason_code: the failure is known, its reason is not. */
function reasonlessFailure(
  ctx: NormalizeContext,
  mbId: string | undefined,
  op: Operation,
): DecodedErrorDraft {
  const missing = [
    "failed_reason_code is absent. Skrill sends it only with status -2 and only when Skrill Merchant Services has enabled it for the account.",
  ];
  if (op === "payment_or_payout") missing.push(AMBIGUOUS_NOTE);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: "-2",
    subCodes: { field: "status" },
    category: "unknown",
    explanation:
      "Skrill reports the payment as failed (status -2). Skrill says a failure comes from a decline by the card or payment provider or from Skrill fraud rules; this post does not say which.",
    nextAction:
      "Ask Skrill Merchant Services to enable failed_reason_code, or look up the transaction in the Skrill merchant account to see the reason.",
    retry: "unknown",
    retryExplanation:
      "Without the reason, PandaPayLens cannot say whether a new attempt could succeed. Do not retry automatically.",
    confidence: "insufficient",
    documentation: [{ title: "Skrill Quick Checkout status_url", url: QC_INTRODUCTION_URL }],
    missingInformation: missing,
    ...(mbId ? { paymentReference: mbId, attemptReference: mbId } : {}),
    outcomeKnown: true,
  };
}

function decodeErrors(parsed: SkrillParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "status_report") {
    const r = parsed.value;
    const status = statusOf(r.status);
    if (status !== "-2") return [];
    const { op } = operationOf(r, status);
    const mbId = safeId(r.mb_transaction_id, 64);
    const raw = nonEmpty(r.failed_reason_code) ? r.failed_reason_code!.trim() : undefined;
    if (raw === undefined) return [reasonlessFailure(ctx, mbId, op)];
    const d = decodeFailedReason(raw);
    const draft = draftFrom(d, ctx, {
      subCodes: { field: "failed_reason_code", status: "-2" },
      ...(mbId ? { paymentReference: mbId } : {}),
    });
    const pt = safeId(r.payment_type, 16);
    if (pt) draft.subCodes.payment_type = pt;
    if (op === "payment_or_payout") draft.missingInformation.push(AMBIGUOUS_NOTE);
    return [draft];
  }
  if (parsed.kind === "ubp_error") {
    const e = parsed.value;
    const d = decodeBankPayoutError(e.code);
    const http = ctx.meta?.http?.status;
    return [
      draftFrom(d, ctx, {
        subCodes: {
          field: e.nested ? "error.code" : "code",
          ...(http ? { httpStatus: String(http) } : {}),
        },
        ...(e.message || e.description ? { message: e.message || e.description } : {}),
      }),
    ];
  }
  return [];
}

export const skrillAdapter: ProviderAdapter<SkrillParsed> = {
  id: "skrill",
  displayName: "Skrill",
  version: SKRILL_ADAPTER_VERSION,
  manifest: skrillManifest,
  supportedFormats: [
    {
      id: SKRILL_FORMATS.statusReport,
      description:
        "status_url post (mb_transaction_id, mb_amount, mb_currency, status, failed_reason_code), also payout posts with the same fields",
    },
    {
      id: SKRILL_FORMATS.refundStatus,
      description: "Refund status report (mb_transaction_id, status, mb_amount, mb_currency)",
    },
    {
      id: SKRILL_FORMATS.recurringStatus,
      description: "Recurring billing post (rec_payment_id, rec_payment_type, status)",
    },
    {
      id: SKRILL_FORMATS.ubpError,
      description: "Unlinked Merchant Bank Payout JSON error response",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // mb_transaction_id is Skrill's own id; refunds, chargebacks and payouts
    // get new ones, so they only join a payment if Skrill reused the id.
    // rec_payment_id is the recurring / 1-Tap mandate that links later debits
    // to the setup payment. transaction_id is a merchant reference and is
    // never used.
    const keys: string[] = [];
    const mb = event.attributes.mbTransactionId;
    if (typeof mb === "string" && mb) keys.push(`mb:${mb}`);
    if (event.subscriptionReference) keys.push(`rec:${event.subscriptionReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default skrillAdapter;
