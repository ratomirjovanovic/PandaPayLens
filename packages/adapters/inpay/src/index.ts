/**
 * Inpay adapter (bank payouts and pay-by-bank collections).
 *
 * Supported input families:
 * - `inpay.payout` Payouts API payment request: status response, search item,
 *                  create response and webhook body (`inpay_unique_reference`, `state`)
 * - `inpay.order`  Collections API Order: GetOrder and order webhook body
 *                  (`uuid`, `status`, `payments[]`, `refund`)
 * - `inpay.error`  Error bodies (`errors[]`, `error`, `message`)
 * - `inpay.iso20022` ISO 20022 payment status reports (pain.002 / pacs.002 XML):
 *                  group status and status reasons of a payout message
 *
 * A payout is its own operation (`payout`); `completed` means accepted by the
 * banking layer, not credited to the beneficiary. A pay-in order is a bank
 * transfer collection (`payment`); a payment attempt inside it is not the
 * order outcome, and a bank authorisation is not a card authorization.
 */

import {
  decimalToMinor,
  lookup,
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
  ATTEMPT_STATUSES,
  ATTEMPT_STATUSES_IN_JSON_EXAMPLES,
  BANK_TRANSFER_STATUS_URL,
  COLLECTION_OPENAPI_URL,
  COLLECTION_REASON_CODES_URL,
  COLLECTION_WEBHOOKS_URL,
  ERROR_TITLES,
  EXAMPLE_ONLY_REASONS,
  FX_OPENAPI_URL,
  HTTP_STATUSES,
  INSTANT_BANK_TRANSFER_STATUS_URL,
  ISO_DOCUMENTED_VERSIONS,
  ISO_GROUP_STATUSES,
  ISO_INTRO_URL,
  ISO_REASON_CODES,
  ISO_REASON_TEXTS,
  ISO_STATUS_URL,
  JWT_ERRORS,
  JWT_ERRORS_URL,
  NEXT_ACTION,
  NUMERIC_ERRORS,
  ORDER_LIFECYCLE_URL,
  ORDER_REASONS,
  ORDER_REASON_HINTS,
  ORDER_STATUS_REASONS_URL,
  ORDER_STATUSES,
  PAYMENT_TYPES,
  PAYOUT_REASON_CODES_URL,
  PAYOUT_REASONS,
  PAYOUT_STATES,
  PAYOUT_WEBHOOKS_URL,
  PAYOUTS_INTRO_URL,
  PAYOUTS_OPENAPI_URL,
  REFUND_STATUSES,
  RESPONSE_CODES_URL,
  RETRY_TEXT,
  WALLET_TRANSFER_STATUS_URL,
  X_REQUEST_ID_URL,
  type AttemptStatusEntry,
  type ErrorMapping,
  type PayoutReasonEntry,
} from "./catalog.js";
import { inpayManifest, INPAY_ADAPTER_VERSION } from "./manifest.js";

export { inpayManifest, INPAY_ADAPTER_VERSION };

const PROVIDER = "inpay";

const NStr = (max: number) => z.string().max(max).nullable().optional();
const Amount = z
  .union([z.number(), z.string().max(40)])
  .nullable()
  .optional();

const Reason = z.looseObject({
  category: NStr(128),
  code: NStr(256),
  details: z.unknown().optional(),
});

const Payout = z.looseObject({
  inpay_unique_reference: z.string().max(128),
  end_to_end_id: NStr(256),
  state: z.string().max(64),
  amount: Amount,
  currency: NStr(16),
  timestamp: NStr(64),
  reasons: z.array(Reason).max(100).nullable().optional(),
  debtor_account: z.looseObject({ scheme_name: z.unknown().optional() }).nullable().optional(),
});

const Attempt = z.looseObject({
  uuid: NStr(128),
  status: NStr(64),
  type: NStr(64),
  inpay_unique_reference: NStr(128),
  debtor_country_iso: NStr(8),
  debtor_bank_status_code: NStr(16),
  debtor_paid_amount: Amount,
});

const Refund = z.looseObject({
  uuid: NStr(128),
  amount: Amount,
  currency_iso: NStr(16),
  status: NStr(64),
});

const Order = z.looseObject({
  uuid: z.string().max(128),
  status: z.string().max(64),
  amount: Amount,
  amount_cents: z
    .union([z.number().int(), z.string().max(40)])
    .nullable()
    .optional(),
  currency: NStr(16),
  reference: NStr(256),
  business_unit: NStr(128),
  language: NStr(16),
  expires_at: NStr(64),
  primary_payment: NStr(128),
  status_reasons: z.array(z.string().max(2000)).max(50).nullable().optional(),
  refund: Refund.nullable().optional(),
  payments: z.array(Attempt).max(100).nullable().optional(),
});

const ErrorCode = z
  .union([z.number().int(), z.string().max(64)])
  .nullable()
  .optional();

const ErrorsBody = z.looseObject({
  errors: z
    .array(
      z.looseObject({
        title: NStr(500),
        detail: z.unknown().optional(),
        details: z.unknown().optional(),
        code: ErrorCode,
      }),
    )
    .min(1)
    .max(50),
});

const ErrorBody = z.looseObject({
  error: z.looseObject({
    title: NStr(500),
    details: z.unknown().optional(),
    detail: z.unknown().optional(),
    code: ErrorCode,
  }),
});

const MessageBody = z.looseObject({ message: z.string().max(2000) });

// ISO 20022 status reports arrive as XML; core turns every value into a
// string, a single element into a value and repeated elements into an array.
// Repeatable elements are validated as arrays so issues name the element.
const oneOrMany = <T extends z.ZodType>(item: T, max: number) =>
  z.preprocess(
    (v) => (v === undefined || Array.isArray(v) ? v : [v]),
    z.array(item).max(max).optional(),
  );
const IsoText = (max: number) => z.string().max(max).optional();

const IsoReason = z.looseObject({
  Rsn: z
    .union([z.looseObject({ Cd: IsoText(35), Prtry: IsoText(35) }), z.string().max(0)])
    .optional(),
  AddtlInf: oneOrMany(z.string().max(2000), 20),
});

const IsoGroup = z.looseObject({
  OrgnlMsgId: IsoText(256),
  OrgnlMsgNmId: IsoText(64),
  GrpSts: IsoText(64),
  StsRsnInf: oneOrMany(IsoReason, 50),
});

const IsoTx = z.looseObject({ TxSts: IsoText(64) });

const IsoPmtInf = z.looseObject({
  PmtInfSts: IsoText(64),
  TxInfAndSts: oneOrMany(IsoTx, 10_000),
});

const IsoReport = z.looseObject({
  GrpHdr: z
    .looseObject({ MsgId: IsoText(256), CreDtTm: IsoText(64), InitgPty: z.unknown().optional() })
    .optional(),
  OrgnlGrpInfAndSts: oneOrMany(IsoGroup, 100),
  OrgnlPmtInfAndSts: oneOrMany(IsoPmtInf, 1000),
  TxInfAndSts: oneOrMany(IsoTx, 10_000),
});

type PayoutT = z.infer<typeof Payout>;
type OrderT = z.infer<typeof Order>;
type AttemptT = z.infer<typeof Attempt>;
type IsoReportT = z.infer<typeof IsoReport>;
type IsoGroupT = z.infer<typeof IsoGroup>;

/** One error item, flattened from any of the three documented body shapes. */
type ErrorItem = { code?: string; title?: string; detail?: unknown };

export type InpayParsed =
  | { kind: "payout"; value: PayoutT }
  | { kind: "order"; value: OrderT }
  | { kind: "error"; shape: "errors" | "error" | "message"; items: ErrorItem[] }
  | {
      kind: "iso20022";
      element: IsoElement;
      message: "pain.002" | "pacs.002";
      /** Message version from the namespace, e.g. pain.002.001.11. */
      version?: string;
      report: IsoReportT;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYOUT_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.[\]-]{0,63}$/;
const DECIMAL = /^-?\d{1,30}(?:\.\d{1,10})?$/;
/** Inpay field names that make an otherwise generic error body distinctive. */
const INPAY_FIELDS = new Set(["inpay_unique_reference", "end_to_end_id"]);
const ERROR_ITEM_KEYS = new Set(["title", "detail", "details", "code"]);

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** Docs tables write statuses in capitals with spaces; JSON uses lower snake case. */
const statusKey = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function codeOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  if (typeof v === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(v.trim())) return v.trim();
  return undefined;
}

/** Documented JWT error code carried by an error item, from any documented field. */
function jwtCodeOf(item: ErrorItem): string | undefined {
  for (const v of [item.code, item.title, item.detail]) {
    if (typeof v === "string" && lookup(JWT_ERRORS, v.trim())) return v.trim();
  }
  return undefined;
}

function hasInpayField(detail: unknown): boolean {
  return isObj(detail) && Object.keys(detail).some((k) => INPAY_FIELDS.has(k));
}

const none = (): DetectionResult => ({
  provider: PROVIDER,
  format: null,
  confidence: 0,
  supported: false,
  reasons: [],
});

function detectPayout(input: Record<string, unknown>): DetectionResult | undefined {
  if (typeof input.inpay_unique_reference !== "string") return undefined;
  const hasState = typeof input.state === "string";
  const hasE2e = typeof input.end_to_end_id === "string";
  if (!hasState && !hasE2e) return undefined;
  const reasons = ["has inpay_unique_reference"];
  let score = 0.55;
  if (hasState && lookup(PAYOUT_STATES, statusKey(input.state as string))) {
    score += 0.15;
    reasons.push("state is a documented payout state");
  }
  if (hasE2e) {
    score += 0.1;
    reasons.push("has end_to_end_id");
  }
  const account = input.debtor_account;
  if (isObj(account) && account.scheme_name === "VirtualAccount") {
    score += 0.1;
    reasons.push('debtor_account.scheme_name is "VirtualAccount"');
  }
  if (Array.isArray(input.reasons) && input.reasons.some((r) => isObj(r) && "code" in r)) {
    score += 0.05;
    reasons.push("reasons[] items carry category and code");
  }
  if (typeof input.timestamp === "string" && PAYOUT_TIMESTAMP.test(input.timestamp)) score += 0.03;
  return { ...none(), format: "inpay.payout", confidence: round(score), supported: true, reasons };
}

function detectOrder(input: Record<string, unknown>): DetectionResult | undefined {
  const amountPair =
    typeof input.amount_cents === "number" &&
    (typeof input.amount === "string" || typeof input.amount === "number");
  const distinctive: string[] = [];
  if ("primary_payment" in input) distinctive.push("has primary_payment");
  if ("back_to_merchant_url" in input) distinctive.push("has back_to_merchant_url");
  if (Array.isArray(input.status_reasons)) distinctive.push("has status_reasons[]");
  const first = Array.isArray(input.payments) ? input.payments.find(isObj) : undefined;
  if (
    first &&
    (typeof first.inpay_unique_reference === "string" ||
      "debtor_bank_status_code" in first ||
      (typeof first.type === "string" && lookup(PAYMENT_TYPES, first.type)))
  )
    distinctive.push("payments[] items are Inpay payment attempts");
  if (distinctive.length === 0 || (!amountPair && distinctive.length < 2)) return undefined;
  const reasons = [...distinctive];
  let score = 0.3 + Math.min(3, distinctive.length) * 0.12;
  if (amountPair) {
    score += 0.15;
    reasons.unshift("has amount with amount_cents");
  }
  if (typeof input.status === "string" && lookup(ORDER_STATUSES, statusKey(input.status))) {
    score += 0.15;
    reasons.push("status is a documented order status");
  }
  if (typeof input.uuid === "string" && UUID.test(input.uuid)) score += 0.05;
  return { ...none(), format: "inpay.order", confidence: round(score), supported: true, reasons };
}

function detectError(
  input: Record<string, unknown>,
  meta: RecordMeta | undefined,
): DetectionResult | undefined {
  const status = meta?.http?.status;
  const documentedStatus = status !== undefined && Boolean(lookup(HTTP_STATUSES, status));
  const result = (confidence: number, reasons: string[]): DetectionResult => ({
    ...none(),
    format: "inpay.error",
    confidence: round(confidence),
    supported: true,
    reasons,
  });
  const keys = Object.keys(input);

  if (Array.isArray(input.errors) && keys.length === 1) {
    const items = input.errors;
    if (items.length === 0 || !items.every(isObj)) return undefined;
    const plain = items.every(
      (i) =>
        Object.keys(i).every((k) => ERROR_ITEM_KEYS.has(k)) &&
        (typeof i.title === "string" || typeof i.code === "string" || typeof i.code === "number"),
    );
    if (!plain) return undefined;
    const flat = items.map((i) => ({ code: i.code, title: i.title, detail: i.detail }));
    if (flat.some((i) => jwtCodeOf(i as ErrorItem)))
      return result(0.75, ["has the errors[] envelope", "carries a documented JWT error code"]);
    if (items.some((i) => lookup(NUMERIC_ERRORS, codeOf(i.code))))
      return result(0.7, ["has the errors[] envelope", "code is a documented numeric API code"]);
    if (items.some((i) => hasInpayField(i.detail) || hasInpayField(i.details)))
      return result(0.75, ["has the errors[] envelope", "detail names an Inpay field"]);
    // A bare { errors: [{ title, detail }] } is a common shape: kept below the
    // analysis threshold so it is analyzed only when Inpay is selected.
    return result(documentedStatus ? 0.45 : 0.35, [
      "has the generic errors[] envelope with title or code",
    ]);
  }

  if (isObj(input.error) && keys.length === 1) {
    const e = input.error;
    if (!Object.keys(e).every((k) => ERROR_ITEM_KEYS.has(k))) return undefined;
    const numeric = lookup(NUMERIC_ERRORS, codeOf(e.code));
    if (numeric && typeof e.title === "string") {
      const titleMatches = e.title.trim().toLowerCase() === numeric.title.toLowerCase();
      return result(titleMatches ? 0.8 : 0.7, [
        "has the error object",
        "code is a documented numeric API code",
        ...(titleMatches ? ["title matches the documented title for the code"] : []),
      ]);
    }
    if (jwtCodeOf({ code: e.code as string, title: e.title as string, detail: e.detail }))
      return result(0.75, ["has the error object", "carries a documented JWT error code"]);
    if (hasInpayField(e.details) || hasInpayField(e.detail))
      return result(0.75, ["has the error object", "details name an Inpay field"]);
    if (isObj(e.details) || typeof e.title === "string")
      return result(documentedStatus ? 0.45 : 0.35, ["has the generic error object"]);
    return undefined;
  }

  if (typeof input.message === "string" && keys.length === 1) {
    // The documented 412 body names Inpay's own request headers.
    if (/\bX-Auth-Uuid\b/i.test(input.message))
      return result(status === 412 ? 0.8 : 0.7, ["message names the X-Auth-Uuid header"]);
  }
  return undefined;
}

// ISO 20022 status reports

const ISO_FORMAT = "inpay.iso20022";
const ISO_REPORTS = { CstmrPmtStsRpt: "pain.002", FIToFIPmtStsRpt: "pacs.002" } as const;
type IsoElement = keyof typeof ISO_REPORTS;
const ISO_NAMESPACE = /^urn:iso:std:iso:20022:tech:xsd:((pain|pacs)\.002\.\d{3}\.\d{2})$/;
const ISO_CODE = /^[A-Za-z0-9_.-]{1,35}$/;
const ISO_TIMESTAMP = /^\d[\dT:./+ Z-]{0,39}$/;

const listOf = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

const isoCode = (v: unknown): string | undefined =>
  typeof v === "string" && ISO_CODE.test(v.trim()) ? v.trim() : undefined;

/** The report element of a `Document` record, if it is a payment status report. */
function isoShapeOf(
  input: Record<string, unknown>,
): { element: IsoElement; report: Record<string, unknown> } | undefined {
  if (Object.keys(input).length !== 1 || !isObj(input.Document)) return undefined;
  const children = Object.keys(input.Document).filter((k) => !k.startsWith("@"));
  const element = children[0];
  if (
    children.length !== 1 ||
    !element ||
    !Object.prototype.hasOwnProperty.call(ISO_REPORTS, element)
  )
    return undefined;
  const report = input.Document[element];
  return isObj(report) ? { element: element as IsoElement, report } : undefined;
}

/**
 * Message version from the root namespace. Undefined when no namespace is
 * declared; null when the namespace is not the status report of the element.
 */
function isoVersionOf(
  meta: RecordMeta | undefined,
  element: IsoElement,
): string | undefined | null {
  const ns = meta?.xml?.namespace;
  if (ns === undefined) return undefined;
  const m = ISO_NAMESPACE.exec(ns.trim());
  return m && m[2] === ISO_REPORTS[element].slice(0, 4) ? m[1]! : null;
}

/** GrpHdr/InitgPty/Nm "Inpay", as in Inpay's status report examples. */
function isoNamesInpay(report: Record<string, unknown>): boolean {
  const header = report.GrpHdr;
  const party = isObj(header) ? header.InitgPty : undefined;
  return isObj(party) && typeof party.Nm === "string" && party.Nm.trim().toLowerCase() === "inpay";
}

const ISO_NOT_PROVEN =
  "ISO 20022 is a generic standard, and nothing in this status report shows that Inpay sent it. Select Inpay manually to analyze it as an Inpay status report.";

function detectIso(
  input: Record<string, unknown>,
  meta: RecordMeta | undefined,
): DetectionResult | undefined {
  const shape = isoShapeOf(input);
  if (!shape) return undefined;
  const version = isoVersionOf(meta, shape.element);
  if (version === null) return undefined;
  const reasons = [`root Document with ${shape.element} (ISO 20022 payment status report)`];
  let score: number;
  if (version === undefined) {
    score = 0.15;
    reasons.push("no ISO 20022 namespace is declared");
  } else if (lookup(ISO_DOCUMENTED_VERSIONS, version)) {
    score = 0.35;
    reasons.push(`namespace is ${version}, a version Inpay documents`);
  } else {
    score = 0.25;
    reasons.push(`namespace is ${version}, a version Inpay does not document`);
  }
  const statuses = listOf(shape.report.OrgnlGrpInfAndSts as unknown)
    .filter(isObj)
    .map((g) => g.GrpSts);
  if (statuses.length && statuses.every((s) => lookup(ISO_GROUP_STATUSES, isoCode(s)))) {
    score += 0.05;
    reasons.push("GrpSts is one of the four group statuses Inpay documents");
  }
  // The initiating party name is the only Inpay-specific marker. Without a
  // namespace the record may not be ISO 20022 at all, so it does not count.
  const named = version !== undefined && isoNamesInpay(shape.report);
  if (named) {
    score += 0.3;
    reasons.push("GrpHdr/InitgPty/Nm is Inpay, as in Inpay's examples");
  }
  return {
    ...none(),
    format: ISO_FORMAT,
    confidence: round(score),
    supported: true,
    reasons,
    ...(named ? {} : { unsupportedReason: ISO_NOT_PROVEN }),
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  if (!isObj(input)) return none();
  // Stripe payloads carry `object`; Inpay payloads never do.
  if ("object" in input) return none();
  return (
    detectIso(input, meta) ??
    detectPayout(input) ??
    detectOrder(input) ??
    detectError(input, meta) ??
    none()
  );
}

type ParseResult = { ok: true; value: InpayParsed } | { ok: false; issues: string[] };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parseIso(input: unknown, meta: RecordMeta | undefined): ParseResult {
  const shape = isObj(input) ? isoShapeOf(input) : undefined;
  if (!shape)
    return {
      ok: false,
      issues: ["(root): expected a Document with CstmrPmtStsRpt or FIToFIPmtStsRpt"],
    };
  const version = isoVersionOf(meta, shape.element);
  if (version === null)
    return {
      ok: false,
      issues: [`(root): the namespace is not a ${ISO_REPORTS[shape.element]} status report`],
    };
  const r = IsoReport.safeParse(shape.report);
  if (!r.success)
    return {
      ok: false,
      issues: r.error.issues.map(
        (i) => `Document.${shape.element}.${i.path.join(".")}: ${i.message}`,
      ),
    };
  return {
    ok: true,
    value: {
      kind: "iso20022",
      element: shape.element,
      message: ISO_REPORTS[shape.element],
      ...(version ? { version } : {}),
      report: r.data,
    },
  };
}

function parse(input: unknown, format: string, meta?: RecordMeta): ParseResult {
  switch (format) {
    case ISO_FORMAT:
      return parseIso(input, meta);
    case "inpay.payout": {
      const r = Payout.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "payout", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "inpay.order": {
      const r = Order.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "order", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "inpay.error": {
      if (isObj(input) && "errors" in input) {
        const r = ErrorsBody.safeParse(input);
        if (!r.success) return { ok: false, issues: issuesOf(r.error) };
        return {
          ok: true,
          value: {
            kind: "error",
            shape: "errors",
            items: r.data.errors.map((e) => ({
              code: codeOf(e.code),
              title: e.title ?? undefined,
              detail: e.detail ?? e.details,
            })),
          },
        };
      }
      if (isObj(input) && "error" in input) {
        const r = ErrorBody.safeParse(input);
        if (!r.success) return { ok: false, issues: issuesOf(r.error) };
        const e = r.data.error;
        return {
          ok: true,
          value: {
            kind: "error",
            shape: "error",
            items: [
              { code: codeOf(e.code), title: e.title ?? undefined, detail: e.details ?? e.detail },
            ],
          },
        };
      }
      const r = MessageBody.safeParse(input);
      return r.success
        ? {
            ok: true,
            value: { kind: "error", shape: "message", items: [{ title: r.data.message }] },
          }
        : { ok: false, issues: issuesOf(r.error) };
    }
    default:
      return { ok: false, issues: [`Unsupported Inpay format "${format}".`] };
  }
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v))
      out[k] = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => safeText(x, 200) ?? "");
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

const refOf = (v: unknown) => safeId(v, 128);

/** Merchant-supplied references: drop values that look like personal data. */
function merchantRefOf(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

/** Enum-like provider values only (e.g. instant_bank_transfer, ACSC, default). */
const enumOf = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9_ -]{0,63}$/.test(v) ? v : undefined;

function amountOf(
  amount: unknown,
  currencyValue: unknown,
): { minor?: string; currency?: string; raw?: boolean } {
  const currency = upperCurrency(currencyValue);
  if (amount === undefined || amount === null) return currency ? { currency } : {};
  const minor = decimalToMinor(amount, currency);
  return minor !== undefined
    ? { minor, currency }
    : { ...(currency ? { currency } : {}), raw: true };
}

function observedOf(ctx: NormalizeContext) {
  return ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
}

/** How the record arrived: a webhook (HTTP request), an API response, or unknown. */
function deliveryOf(ctx: NormalizeContext): {
  deliveredAs?: string;
  requestId?: string;
  webhook: boolean;
  authorizationHeaderPresent?: boolean;
} {
  const http = ctx.meta?.http;
  if (!http) return { webhook: false };
  const requestId = safeId(http.headers["x-request-id"], 128);
  if (http.kind === "request")
    return {
      deliveredAs: "webhook (HTTP request)",
      webhook: true,
      ...(requestId ? { requestId } : {}),
      ...(http.headers.authorization !== undefined ? { authorizationHeaderPresent: true } : {}),
    };
  return { deliveredAs: "API response", webhook: false, ...(requestId ? { requestId } : {}) };
}

/** X-Request-ID identifies a webhook delivery; Inpay redelivers a state with the same value. */
function deliveryFields(ctx: NormalizeContext) {
  const d = deliveryOf(ctx);
  return d.webhook && d.requestId
    ? { eventReference: d.requestId, deliveryKey: `x-request-id:${d.requestId}` }
    : {};
}

function deliveryAttrs(ctx: NormalizeContext): [string, unknown][] {
  const d = deliveryOf(ctx);
  return [
    ["deliveredAs", d.deliveredAs],
    ["signatureVerified", d.webhook ? false : undefined],
    ["authorizationHeaderPresent", d.authorizationHeaderPresent],
    // A response echoes the merchant's own X-Request-ID; it is not a delivery id.
    ["requestIdEchoed", !d.webhook && d.requestId ? true : undefined],
    ["httpStatus", ctx.meta?.http?.status],
  ];
}

// Payouts

type ReasonInfo = {
  category?: string;
  code?: string;
  entry?: PayoutReasonEntry;
  matchedBy?: "category and code" | "code only";
  exampleOnly?: boolean;
};

const reasonsOf = (p: PayoutT) => (p.reasons ?? []).filter((r) => r.code || r.category);

/** Unique table entry for a code, used when the category is missing or differs. */
function entryByCode(code: string): PayoutReasonEntry | undefined {
  const matches = Object.values(PAYOUT_REASONS).filter((e) => e.code === code);
  return matches.length === 1 ? matches[0] : undefined;
}

function reasonInfo(r: z.infer<typeof Reason>): ReasonInfo {
  const category = str(r.category);
  const code = str(r.code);
  if (!code) return { category };
  const exact = category ? lookup(PAYOUT_REASONS, `${category}:${code}`) : undefined;
  if (exact) return { category, code, entry: exact, matchedBy: "category and code" };
  const byCode = entryByCode(code);
  if (byCode) return { category, code, entry: byCode, matchedBy: "code only" };
  return { category, code, exampleOnly: Boolean(lookup(EXAMPLE_ONLY_REASONS, code)) };
}

const reasonLabel = (i: ReasonInfo) =>
  `${safeText(i.category, 64) ?? "?"}/${safeText(i.code, 128) ?? "?"}`;

function payoutEvent(p: PayoutT, ctx: NormalizeContext): NormalizedEventDraft {
  const state = statusKey(p.state);
  const entry = lookup(PAYOUT_STATES, state);
  const amount = amountOf(p.amount, p.currency);
  const infos = reasonsOf(p).map(reasonInfo);
  const vop = infos.find((i) => i.entry?.reasonCategory === "vop_info");
  const scheduled = infos.some((i) => i.entry?.code === "waiting_future_execution");
  const stamp = str(p.timestamp);
  const scheme = p.debtor_account?.scheme_name;

  return clean({
    sourceFormat: ctx.format,
    eventType: `payout.${safeText(state, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: "payout",
    providerStatus: safeText(p.state, 64),
    paymentReference: refOf(p.inpay_unique_reference),
    merchantReference: merchantRefOf(p.end_to_end_id),
    // The payout timestamp has no documented time zone; toIsoTimestamp keeps it off the timeline.
    eventTimestamp: toIsoTimestamp(stamp),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", "payout (bank transfer from the merchant's virtual account)"],
      ["state", safeText(p.state, 64)],
      ["stateMeaning", entry?.meaning],
      ["stateFinal", entry?.final],
      ["stateNote", entry?.note],
      ["stateUndocumented", entry ? undefined : true],
      ["reasonCodes", infos.length ? infos.map(reasonLabel) : undefined],
      ["verificationOfPayee", vop?.entry?.code],
      ["scheduledForFutureExecution", scheduled ? true : undefined],
      ["debtorAccountScheme", typeof scheme === "string" ? enumOf(scheme) : undefined],
      ["providerTimestamp", stamp && PAYOUT_TIMESTAMP.test(stamp) ? stamp : undefined],
      [
        "timestampZone",
        stamp && !toIsoTimestamp(stamp) ? "not documented (not placed on the timeline)" : undefined,
      ],
      ["amountNotConvertible", amount.raw],
      ...deliveryAttrs(ctx),
    ]),
    ...deliveryFields(ctx),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

// Orders

/** Attempt status: documented label, documented JSON value or inferred snake case. */
function attemptStatusOf(
  type: string | undefined,
  raw: string | undefined,
): { entry?: AttemptStatusEntry; inferred?: boolean } {
  if (!raw || !type) return {};
  const table = lookup(ATTEMPT_STATUSES, type);
  if (!table) return {};
  const key = statusKey(raw);
  const entry =
    lookup(table, key) ??
    (type === "instant_bank_transfer" && key.startsWith("redirected_to_")
      ? table.redirected_to
      : undefined);
  if (!entry) return {};
  const tableForm = raw.trim() === entry.label || raw.trim().toUpperCase() === entry.label;
  const inferred = !tableForm && !ATTEMPT_STATUSES_IN_JSON_EXAMPLES.has(raw.trim());
  return { entry, inferred };
}

const ATTEMPT_DOCS: Record<string, string> = {
  bank_transfer: BANK_TRANSFER_STATUS_URL,
  instant_bank_transfer: INSTANT_BANK_TRANSFER_STATUS_URL,
  wallet_transfer: WALLET_TRANSFER_STATUS_URL,
};

function attemptEvent(
  a: AttemptT,
  order: OrderT,
  i: number,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const type = str(a.type);
  const typeEntry = type ? lookup(PAYMENT_TYPES, type) : undefined;
  const status = str(a.status);
  const s = attemptStatusOf(type, status);
  const ref = refOf(a.inpay_unique_reference);
  const paid = a.debtor_paid_amount;
  const paidText =
    typeof paid === "number" ? String(paid) : typeof paid === "string" ? paid.trim() : undefined;

  return clean({
    sourceFormat: ctx.format,
    eventType: `payment_attempt.${enumOf(type) ?? "unknown"}.${safeText(status ? statusKey(status) : undefined, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(s.entry),
    stage: "payment",
    providerStatus: safeText(status, 64),
    paymentReference: refOf(order.uuid),
    relatedReference: ref,
    outcome: s.entry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", typeEntry?.operation ?? "payment attempt of an unknown type"],
      [
        "record",
        "payment attempt inside a pay-in order (the order status decides the pay-in outcome)",
      ],
      ["attemptType", enumOf(type)],
      ["attemptStatusLabel", s.entry?.label],
      ["statusSpellingInferred", s.inferred ? true : undefined],
      ["attemptStatusesDocumented", typeEntry ? typeEntry.statusesDocumented : undefined],
      ["primaryPayment", ref && ref === refOf(order.primary_payment) ? true : undefined],
      ["debtorCountry", enumOf(a.debtor_country_iso)],
      ["debtorBankStatusCode", enumOf(a.debtor_bank_status_code)],
      [
        "debtorBankStatusSource",
        a.debtor_bank_status_code ? "reported by the open-banking provider" : undefined,
      ],
      // The currency of debtor_paid_amount is not documented, so it is not converted.
      ["debtorPaidAmount", paidText && DECIMAL.test(paidText) ? paidText : undefined],
      ["attemptChangesNotified", false],
    ]),
    source: { recordIndex: ctx.recordIndex, path: `payments[${i}]` },
    ...observedOf(ctx),
  });
}

function refundEvent(order: OrderT, ctx: NormalizeContext): NormalizedEventDraft | undefined {
  const r = order.refund;
  if (!r) return undefined;
  const status = str(r.status);
  const entry = status ? lookup(REFUND_STATUSES, statusKey(status)) : undefined;
  const amount = amountOf(r.amount, r.currency_iso);
  const delivery = deliveryFields(ctx);
  return clean({
    sourceFormat: ctx.format,
    eventType: `refund.${safeText(status ? statusKey(status) : undefined, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: "refund",
    providerStatus: safeText(status, 64),
    paymentReference: refOf(order.uuid),
    relatedReference: refOf(r.uuid),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: entry?.outcome ?? "unknown",
    // A redelivered order webhook repeats the nested refund; the same key
    // keeps the refund amount from being counted twice.
    ...(delivery.deliveryKey ? { deliveryKey: `${delivery.deliveryKey}:refund` } : {}),
    attributes: attrs([
      ["operation", "refund of a pay-in order to the payer's bank account"],
      ["refundStatusMeaning", entry?.meaning],
      ["refundStatusListDocumented", false],
      ["amountNotConvertible", amount.raw],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "refund" },
    ...observedOf(ctx),
  });
}

function orderAmount(o: OrderT): {
  minor?: string;
  currency?: string;
  field?: string;
  mismatch?: boolean;
} {
  const currency = upperCurrency(o.currency);
  const fromDecimal =
    o.amount !== undefined && o.amount !== null ? decimalToMinor(o.amount, currency) : undefined;
  const cents = minorUnits(o.amount_cents);
  if (fromDecimal !== undefined) {
    const mismatch = cents !== undefined && cents !== fromDecimal ? true : undefined;
    return { minor: fromDecimal, currency, field: "amount", ...(mismatch ? { mismatch } : {}) };
  }
  if (cents !== undefined && currency) return { minor: cents, currency, field: "amount_cents" };
  return currency ? { currency } : {};
}

function orderEvent(o: OrderT, ctx: NormalizeContext): NormalizedEventDraft {
  const status = statusKey(o.status);
  const entry = lookup(ORDER_STATUSES, status);
  const amount = orderAmount(o);
  // At refund statuses the order amount is not the refund amount; the nested
  // refund event carries that.
  const refundStage = entry?.stage === "refund";
  const reasons = (o.status_reasons ?? []).slice(0, 10);
  const expires = toIsoTimestamp(o.expires_at);

  return clean({
    sourceFormat: ctx.format,
    eventType: `order.${safeText(status, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: entry?.stage ?? "payment",
    providerStatus: safeText(o.status, 64),
    paymentReference: refOf(o.uuid),
    relatedReference: refOf(o.primary_payment),
    merchantReference: merchantRefOf(o.reference),
    amountMinor: refundStage ? undefined : amount.minor,
    currency: refundStage ? undefined : amount.currency,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", "pay-in order (bank transfer collection, not a card payment)"],
      ["status", safeText(o.status, 64)],
      ["statusMeaning", entry?.meaning],
      ["statusFinal", entry?.final],
      ["statusUndocumented", entry ? undefined : true],
      ["statusReasons", reasons.length ? reasons : undefined],
      ["paymentAttempts", o.payments ? o.payments.length : undefined],
      ["refundPresent", o.refund ? true : undefined],
      ["businessUnit", enumOf(o.business_unit)],
      ["expiresAt", expires],
      ["amountField", refundStage ? undefined : amount.field],
      ["orderAmountMinor", refundStage ? amount.minor : undefined],
      ["orderCurrency", refundStage ? amount.currency : undefined],
      ["amountCentsMismatch", amount.mismatch],
      ["orderTimestamp", "not documented (order webhooks carry no timestamp)"],
      ...deliveryAttrs(ctx),
    ]),
    ...deliveryFields(ctx),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

function errorEvent(
  parsed: Extract<InpayParsed, { kind: "error" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const httpStatus = ctx.meta?.http?.status;
  const codes = parsed.items.slice(0, 20).map((i) => jwtCodeOf(i) ?? i.code ?? "unknown");
  return clean({
    sourceFormat: ctx.format,
    eventType: `error.${codes[0] !== "unknown" ? codes[0] : httpStatus ? `HTTP ${httpStatus}` : "unknown"}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: httpStatus ? `HTTP ${httpStatus}` : codes[0],
    outcome: "unknown",
    attributes: attrs([
      ["errorShape", parsed.shape],
      ["errorCodes", codes],
      ["errorCount", parsed.items.length],
      ["httpStatus", httpStatus],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...observedOf(ctx),
  });
}

// ISO 20022 status reports

type IsoParsed = Extract<InpayParsed, { kind: "iso20022" }>;
type IsoReasonInfo = { code?: string; proprietary?: boolean; texts: string[] };

function isoReasonsOf(g: IsoGroupT | undefined): IsoReasonInfo[] {
  return listOf(g?.StsRsnInf)
    .map((r) => {
      const rsn = isObj(r.Rsn) ? r.Rsn : undefined;
      const cd = isoCode(rsn?.Cd);
      const prtry = cd ? undefined : isoCode(rsn?.Prtry);
      const texts = listOf(r.AddtlInf)
        .map((t) => t.trim())
        .filter((t) => t !== "");
      return { code: cd ?? prtry, ...(prtry ? { proprietary: true } : {}), texts };
    })
    .filter((i) => i.code || i.texts.length);
}

/** Payment information and transaction statuses; Inpay documents neither. */
function isoTransactionsOf(r: IsoReportT) {
  const pmtInf = listOf(r.OrgnlPmtInfAndSts);
  const txs = [...listOf(r.TxInfAndSts), ...pmtInf.flatMap((p) => listOf(p.TxInfAndSts))];
  const unique = (values: unknown[]) => [
    ...new Set(values.map(isoCode).filter((v): v is string => v !== undefined)),
  ];
  return {
    count: txs.length,
    statuses: unique(txs.map((t) => t.TxSts)).slice(0, 20),
    paymentInformationStatuses: unique(pmtInf.map((p) => p.PmtInfSts)).slice(0, 20),
  };
}

const isoMessageOf = (p: IsoParsed) => p.version ?? p.message;

function isoPath(p: IsoParsed, i: number, count: number): string {
  const base = `Document.${p.element}`;
  if (count === 0) return base;
  return `${base}.OrgnlGrpInfAndSts${count > 1 ? `[${i}]` : ""}`;
}

function isoEvent(
  p: IsoParsed,
  g: IsoGroupT | undefined,
  i: number,
  count: number,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const header = p.report.GrpHdr;
  const status = isoCode(g?.GrpSts);
  const entry = status ? lookup(ISO_GROUP_STATUSES, status) : undefined;
  const tx = isoTransactionsOf(p.report);
  const created = str(header?.CreDtTm);
  const stamp = toIsoTimestamp(created);
  const named = Boolean(p.version) && isoNamesInpay(p.report);
  const delivery = deliveryFields(ctx);
  const msgId = refOf(header?.MsgId);
  const codes = isoReasonsOf(g)
    .map((r) => r.code)
    .filter((c): c is string => c !== undefined)
    .slice(0, 20);
  const undocumentedParts = tx.count > 0 || tx.paymentInformationStatuses.length > 0;

  return clean({
    sourceFormat: ctx.format,
    eventType: `iso20022.group_status.${safeText(status, 35) ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: "payout",
    providerStatus: safeText(status, 35),
    // The report names the original payout message only by the merchant's
    // message id, so OrgnlMsgId is the reference that links its reports.
    paymentReference: merchantRefOf(g?.OrgnlMsgId),
    ...delivery,
    eventReference: msgId ?? delivery.eventReference,
    eventTimestamp: stamp,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", "ISO 20022 status report on a payout message sent to Inpay"],
      ["message", isoMessageOf(p)],
      [
        "messageVersionDocumented",
        p.version ? Boolean(lookup(ISO_DOCUMENTED_VERSIONS, p.version)) : undefined,
      ],
      ["namespaceDeclared", p.version ? undefined : false],
      ["originalMessageType", safeId(g?.OrgnlMsgNmId, 64)],
      ["paymentReferenceSource", g?.OrgnlMsgId ? "OrgnlMsgId (original message id)" : undefined],
      ["groupStatus", status],
      ["groupStatusMeaning", entry?.meaning],
      ["groupStatusFinal", entry?.final],
      ["groupStatusNote", entry?.note],
      ["groupStatusUndocumented", status && !entry ? true : undefined],
      ["groupStatusMissing", status ? undefined : true],
      ["reasonCodes", codes.length ? codes : undefined],
      ["transactionCount", tx.count || undefined],
      ["transactionStatuses", tx.statuses.length ? tx.statuses : undefined],
      [
        "paymentInformationStatuses",
        tx.paymentInformationStatuses.length ? tx.paymentInformationStatuses : undefined,
      ],
      ["transactionStatusesDocumented", undocumentedParts ? false : undefined],
      [
        "providerIdentification",
        named
          ? "GrpHdr/InitgPty/Nm is Inpay"
          : "not shown by the report (ISO 20022 is a generic standard)",
      ],
      ["providerTimestamp", created && ISO_TIMESTAMP.test(created) ? created : undefined],
      [
        "timestampZone",
        created && !stamp
          ? "no ISO date-time with a time zone (not placed on the timeline)"
          : undefined,
      ],
      ...deliveryAttrs(ctx),
    ]),
    source: { recordIndex: ctx.recordIndex, path: isoPath(p, i, count) },
    ...observedOf(ctx),
  });
}

function isoEvents(p: IsoParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const groups = listOf(p.report.OrgnlGrpInfAndSts);
  if (groups.length === 0) return [isoEvent(p, undefined, 0, 0, ctx)];
  return groups.map((g, i) => isoEvent(p, g, i, groups.length, ctx));
}

function normalize(parsed: InpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "iso20022":
      return isoEvents(parsed, ctx);
    case "payout":
      return [payoutEvent(parsed.value, ctx)];
    case "order": {
      // Attempts and the refund first, the order last: the order status is
      // the authoritative pay-in state of this snapshot.
      const o = parsed.value;
      const out = (o.payments ?? []).map((a, i) => attemptEvent(a, o, i, ctx));
      const refund = refundEvent(o, ctx);
      if (refund) out.push(refund);
      out.push(orderEvent(o, ctx));
      return out;
    }
    case "error":
      return [errorEvent(parsed, ctx)];
  }
}

// Error decoding

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
};

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference
    ? { paymentReference: loc.paymentReference, attemptReference: loc.paymentReference }
    : {}),
});

const DOC_TITLES: Record<string, string> = {
  [PAYOUTS_INTRO_URL]: "Inpay payouts introduction (states)",
  [PAYOUT_REASON_CODES_URL]: "Inpay payout reason codes",
  [PAYOUTS_OPENAPI_URL]: "Inpay Payouts API (OpenAPI)",
  [PAYOUT_WEBHOOKS_URL]: "Inpay payout webhooks",
  [ORDER_LIFECYCLE_URL]: "Inpay order lifecycle",
  [ORDER_STATUS_REASONS_URL]: "Inpay order status reasons",
  [COLLECTION_REASON_CODES_URL]: "Inpay pay-in reason codes",
  [COLLECTION_WEBHOOKS_URL]: "Inpay Collections webhooks",
  [COLLECTION_OPENAPI_URL]: "Inpay Collections API (OpenAPI)",
  [FX_OPENAPI_URL]: "Inpay FX API (OpenAPI)",
  [API_ERRORS_URL]: "Inpay API errors",
  [RESPONSE_CODES_URL]: "Inpay HTTP response codes",
  [JWT_ERRORS_URL]: "Inpay JWT signing errors",
  [X_REQUEST_ID_URL]: "Inpay X-Request-ID header",
  [ISO_STATUS_URL]: "Inpay ISO 20022 status codes",
  [ISO_INTRO_URL]: "Inpay ISO 20022 introduction",
};

const docLink = (url: string): DocumentationLink => ({
  title: lookup(DOC_TITLES, url) ?? "Inpay documentation",
  url,
});

function docsOf(...urls: string[]): DocumentationLink[] {
  return [...new Set(urls)].map(docLink);
}

const retryText = (retry: RetryGuidance, note?: string) =>
  note ? `${note} ${RETRY_TEXT[retry]}` : RETRY_TEXT[retry];

/** Field names and the first message of a `{ field: [messages] }` detail object. */
function detailSummary(detail: unknown): { fields: string[]; message?: string } {
  if (typeof detail === "string") return { fields: [], message: detail };
  if (!isObj(detail)) return { fields: [] };
  const fields = Object.keys(detail)
    .filter((k) => IDENTIFIER.test(k))
    .slice(0, 10);
  let message: string | undefined;
  for (const v of Object.values(detail)) {
    const first = Array.isArray(v) ? v.find((x) => typeof x === "string") : v;
    if (typeof first === "string") {
      message = first;
      break;
    }
  }
  return { fields, ...(message ? { message } : {}) };
}

function decodePayoutReason(
  info: ReasonInfo,
  details: unknown,
  state: string,
  loc: Location,
): DecodedErrorDraft {
  const summary = detailSummary(details);
  const subCodes: Record<string, string> = { state: safeText(state, 64) ?? "" };
  if (info.category) subCodes.category = safeText(info.category, 64) ?? "";
  if (summary.fields.length) subCodes.detail_fields = summary.fields.join(",");
  const missing: string[] = [];
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation: string;
  let retryNote: string | undefined;
  const code = safeText(info.code, 128) ?? "unknown";

  if (info.entry) {
    const e = info.entry;
    mapping = e;
    retryNote = e.retryNote;
    confidence = info.matchedBy === "category and code" ? "strong" : "possible";
    explanation = `Inpay payout reason ${e.reasonCategory}/${e.code}: ${e.meaning}.`;
    if (e.keys.length === 2 && (state === "rejected" || state === "returned"))
      explanation += ` The payout ended ${state}, so this is the ${state === "rejected" ? "Cancelled" : "Returned"} row of the reason table.`;
    if (info.matchedBy === "code only")
      missing.push(
        info.category
          ? `The reason category "${safeText(info.category, 64)}" does not match the documented category ${e.reasonCategory}; the code was matched alone.`
          : `No reason category was supplied; the code was matched alone (documented category ${e.reasonCategory}).`,
      );
  } else if (info.exampleOnly) {
    const ex = lookup(EXAMPLE_ONLY_REASONS, info.code)!;
    mapping = { meaning: "", category: "unknown", retry: "manual_review" };
    confidence = "possible";
    explanation = `Inpay payout reason ${reasonLabel(info)}: this code appears in ${ex.seenIn} but not in the reason code table, so its meaning is not documented.`;
    missing.push(`"${code}" is not in Inpay's payout reason code table.`);
  } else {
    mapping = { meaning: "", category: "unknown", retry: "unknown" };
    confidence = "insufficient";
    explanation = `PandaPayLens does not recognize the Inpay payout reason ${reasonLabel(info)}.`;
    missing.push(`Reason "${reasonLabel(info)}" is not in the PandaPayLens catalog.`);
  }
  if (state === "action_required")
    explanation +=
      " The payout is on hold, not failed: it returns to processing once the merchant acts, or is rejected.";
  if (!loc.paymentReference) missing.push("No inpay_unique_reference was supplied.");
  const providerMessage = safeText(summary.message, 200);

  return {
    ...withRefs(loc),
    code,
    subCodes,
    category: mapping.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: NEXT_ACTION[mapping.category],
    retry: mapping.retry,
    retryExplanation: retryText(mapping.retry, retryNote),
    confidence,
    documentation: docsOf(PAYOUT_REASON_CODES_URL, PAYOUTS_INTRO_URL),
    missingInformation: missing,
    // Rejected and returned are final answers; action_required is a hold.
    ...(state === "rejected" || state === "returned" ? { outcomeKnown: true } : {}),
  };
}

function decodePayout(p: PayoutT, ctx: NormalizeContext): DecodedErrorDraft[] {
  const state = statusKey(p.state);
  if (state !== "rejected" && state !== "returned" && state !== "action_required") return [];
  const ref = refOf(p.inpay_unique_reference);
  const loc: Location = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ref ? { paymentReference: ref } : {}),
  };
  const decoded: DecodedErrorDraft[] = [];
  reasonsOf(p).forEach((r, i) => {
    const info = reasonInfo(r);
    if (info.entry?.informational) return;
    decoded.push(
      decodePayoutReason(info, r.details, state, {
        ...loc,
        source: { recordIndex: ctx.recordIndex, path: `reasons[${i}]` },
      }),
    );
  });
  if (decoded.length) return decoded;

  const entry = PAYOUT_STATES[state]!;
  return [
    {
      ...withRefs(loc),
      code: `state ${state}`,
      subCodes: { state },
      category: "unknown",
      explanation: `Inpay payout state ${state}: ${entry.meaning}.`,
      nextAction: NEXT_ACTION.unknown,
      retry: "manual_review",
      retryExplanation: RETRY_TEXT.manual_review,
      confidence: "possible",
      documentation: docsOf(PAYOUTS_INTRO_URL, PAYOUT_REASON_CODES_URL),
      missingInformation: ["No reasons[] were supplied, so the cause is unknown."],
      ...(state === "action_required" ? {} : { outcomeKnown: true }),
    },
  ];
}

/** Order statuses whose reason table group lists the documented causes. */
const ORDER_REASON_GROUPS: Record<string, string> = {
  cancelled: "order_cancelled",
  action_required: "action_required",
  action_required_for_refund: "action_required_for_refund",
};

function decodeOrder(o: OrderT, ctx: NormalizeContext): DecodedErrorDraft[] {
  const status = statusKey(o.status);
  const group = lookup(ORDER_REASON_GROUPS, status);
  if (!group) return [];
  const ref = refOf(o.uuid);
  const texts = (o.status_reasons ?? []).filter((t) => typeof t === "string");
  const candidates = Object.entries(ORDER_REASONS).filter(([, r]) => r.group === group);
  const hint = ORDER_REASON_HINTS.find((h) => texts.some((t) => t.trim().toLowerCase() === h.text));
  const hinted = hint ? candidates.find(([k]) => k === hint.key) : undefined;
  const single = candidates.length === 1 ? candidates[0] : undefined;
  const chosen = hinted ?? single;
  const missing: string[] = [];
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation = `Inpay order status ${status}: ${ORDER_STATUSES[status]!.meaning}.`;

  if (chosen) {
    const [key, row] = chosen;
    mapping = row;
    confidence = hinted ? "possible" : "strong";
    explanation += hinted
      ? ` The status reason text matches reason ${key} of the pay-in reason table: ${row.meaning}. Webhooks carry no reason code, so this is a text match.`
      : ` The pay-in reason table documents one reason for this status (${key}): ${row.meaning}.`;
  } else {
    mapping = { meaning: "", category: "unknown", retry: "manual_review" };
    confidence = "possible";
    explanation += ` The pay-in reason table documents these reasons for the status: ${candidates
      .map(([k, r]) => `${k} ${r.meaning}`)
      .join("; ")}.`;
    missing.push(
      texts.length
        ? "The status reason text does not match a documented reason; webhooks carry no reason code."
        : "No status_reasons were supplied, so the documented reason cannot be told apart.",
    );
  }
  if (!ref) missing.push("No order uuid was supplied.");
  const providerMessage = safeText(texts.slice(0, 3).join("; "), 200);
  const subCodes: Record<string, string> = { status };
  if (chosen) subCodes.reason_key = chosen[0];

  return [
    {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
      code: `order ${status}`,
      subCodes,
      category: mapping.category,
      ...(providerMessage ? { providerMessage } : {}),
      explanation,
      nextAction: NEXT_ACTION[mapping.category],
      retry: mapping.retry,
      retryExplanation: RETRY_TEXT[mapping.retry],
      confidence,
      documentation: docsOf(
        COLLECTION_REASON_CODES_URL,
        ORDER_STATUS_REASONS_URL,
        ORDER_LIFECYCLE_URL,
      ),
      missingInformation: missing,
      ...(status === "cancelled" ? { outcomeKnown: true } : {}),
    },
  ];
}

function httpRule(status: number | undefined) {
  return status === undefined ? undefined : lookup(HTTP_STATUSES, status);
}

function decodeErrorItem(
  item: ErrorItem,
  httpStatus: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const subCodes: Record<string, string> = {};
  const missing: string[] = [];
  const docs: string[] = [];
  const summary = detailSummary(item.detail);
  if (summary.fields.length) subCodes.fields = summary.fields.join(",");
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const title = str(item.title);
  if (title && item.code) subCodes.title = safeText(title, 64) ?? "";
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation: string;
  let retryNote: string | undefined;
  let code: string;
  const rule = httpRule(httpStatus);

  const jwt = jwtCodeOf(item);
  const numeric = item.code ? lookup(NUMERIC_ERRORS, item.code) : undefined;
  const titleRule = title ? lookup(ERROR_TITLES, title.toLowerCase()) : undefined;

  if (jwt) {
    const e = JWT_ERRORS[jwt]!;
    mapping = e;
    retryNote = e.retryNote;
    code = jwt;
    confidence = "strong";
    explanation = `Inpay JWT error ${jwt}: ${e.meaning}. The request was rejected before processing.`;
    missing.push("Inpay does not document which response field carries the JWT error code.");
    docs.push(JWT_ERRORS_URL);
  } else if (numeric && item.code) {
    mapping = numeric;
    code = item.code;
    confidence = "strong";
    explanation = `Inpay API error ${item.code}: ${numeric.meaning}.`;
    docs.push(numeric.docs, API_ERRORS_URL);
  } else if (
    title &&
    httpStatus === 412 &&
    /\bmissing\b/i.test(title) &&
    /X-(?:Auth-Uuid|Request-ID)/i.test(title)
  ) {
    mapping = {
      meaning: "",
      category: "configuration",
      retry: "do_not_retry",
    };
    code = "HTTP 412";
    confidence = "strong";
    explanation =
      "Inpay HTTP 412: a required header (X-Auth-Uuid or X-Request-ID) is missing. Add the header and send the request again.";
    docs.push(X_REQUEST_ID_URL, RESPONSE_CODES_URL);
  } else if (rule && httpStatus !== undefined) {
    mapping = rule;
    code = item.code ?? `HTTP ${httpStatus}`;
    confidence = "possible";
    explanation = `Inpay HTTP ${httpStatus}: ${rule.meaning}.`;
    if (item.code)
      missing.push(`Error code "${safeText(item.code, 64)}" is not in the PandaPayLens catalog.`);
    if (httpStatus === 412)
      missing.push(
        "HTTP 412 has two documented causes (a duplicate X-Request-ID or missing headers); the body does not say which applies.",
      );
    if (httpStatus === 401 && !item.code)
      explanation +=
        " No error code was given, which Inpay documents for an Authorization header that is not a parsable JWT.";
    docs.push(rule.docs);
  } else if (titleRule) {
    mapping = titleRule;
    code = item.code ?? safeText(title, 64) ?? "unknown";
    confidence = "possible";
    explanation = `Inpay error "${safeText(title, 64)}": ${titleRule.meaning}. No HTTP status was supplied, so the meaning comes from the title alone.`;
    docs.push(API_ERRORS_URL);
  } else {
    mapping = { meaning: "", category: "unknown", retry: "unknown" };
    code = item.code ?? "unknown";
    confidence = "insufficient";
    explanation = item.code
      ? `PandaPayLens does not recognize the Inpay error code "${safeText(item.code, 64)}".`
      : "The Inpay error carries no recognizable code.";
    if (httpStatus === undefined)
      missing.push("No HTTP status was supplied, so no fallback category is available.");
    docs.push(API_ERRORS_URL);
  }

  let category: ErrorCategory = mapping.category;
  let retry: RetryGuidance = mapping.retry;
  // A 5xx leaves the outcome of the original request open.
  if (httpStatus !== undefined && httpStatus >= 500) {
    if (category === "unknown") category = "provider_unavailable";
    if (retry !== "do_not_retry") retry = "retry_conditionally";
    retryNote =
      "HTTP 5xx: Inpay stopped or could not reach its infrastructure, and the response does not say whether the request took effect.";
    docs.push(RESPONSE_CODES_URL);
  }
  const outcomeKnown =
    httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500 ? true : undefined;
  const providerMessage = safeText(
    [title && title !== code ? title : undefined, summary.message].filter(Boolean).join(": "),
    200,
  );

  return {
    ...withRefs(loc),
    code: safeText(code, 128) ?? "unknown",
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryText(retry, retryNote),
    confidence,
    documentation: docsOf(...docs),
    missingInformation: missing,
    ...(outcomeKnown ? { outcomeKnown } : {}),
  };
}

const ISO_NEXT_ACTION_UNKNOWN =
  "Contact Inpay support with the status report's GrpHdr/MsgId and the original message id (OrgnlMsgId) if the cause is unclear.";

function decodeIsoReason(
  info: IsoReasonInfo | undefined,
  p: IsoParsed,
  loc: Location,
): DecodedErrorDraft {
  const subCodes: Record<string, string> = { group_status: "RJCT", message: isoMessageOf(p) };
  if (info?.proprietary) subCodes.reason_type = "proprietary";
  const missing: string[] = [];
  const code = safeText(info?.code, 35);
  const known = code && !info?.proprietary ? lookup(ISO_REASON_CODES, code) : undefined;
  const textKey = info?.texts.find((t) => lookup(ISO_REASON_TEXTS, t));
  const text = textKey ? ISO_REASON_TEXTS[textKey] : undefined;
  let mapping: ErrorMapping;
  let confidence: Confidence;
  let explanation = `Inpay rejected the original payout message (group status RJCT: ${ISO_GROUP_STATUSES.RJCT!.meaning}).`;

  if (!info) {
    mapping = { meaning: "", category: "unknown", retry: "manual_review" };
    confidence = "possible";
    explanation += " The report carries no status reason.";
    missing.push("No StsRsnInf was supplied, so the cause is unknown.");
  } else if (text) {
    mapping = text;
    confidence = "possible";
    explanation += ` The reason text "${textKey}" appears in Inpay's rejected example: ${text.meaning}.`;
    if (known) explanation += ` Reason code ${code} appears there too; ${known.note}.`;
    else
      missing.push(
        code
          ? `Reason code "${code}" is not in Inpay's ISO 20022 documentation.`
          : "No reason code was supplied.",
      );
  } else if (known) {
    mapping = { meaning: "", category: "unknown", retry: "manual_review" };
    confidence = "possible";
    explanation += ` Reason code ${code} appears in ${known.seenIn}; ${known.note}.`;
    missing.push(
      info.texts.length
        ? "The AddtlInf text is not one Inpay documents; it is shown as the provider message."
        : "No AddtlInf text was supplied, so the reason is unknown.",
    );
  } else {
    mapping = { meaning: "", category: "unknown", retry: "unknown" };
    confidence = "insufficient";
    explanation += code
      ? ` PandaPayLens does not recognize the reason code "${code}"; Inpay publishes no ISO 20022 reason code list.`
      : " The status reason carries no code.";
    if (code) missing.push(`Reason code "${code}" is not in Inpay's ISO 20022 documentation.`);
  }
  if (!loc.paymentReference) missing.push("No OrgnlMsgId was supplied.");
  const providerMessage = safeText((info?.texts ?? []).slice(0, 3).join("; "), 200);

  return {
    ...withRefs(loc),
    code: code ?? "RJCT",
    subCodes,
    category: mapping.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction:
      mapping.category === "unknown" ? ISO_NEXT_ACTION_UNKNOWN : NEXT_ACTION[mapping.category],
    retry: mapping.retry,
    retryExplanation: RETRY_TEXT[mapping.retry],
    confidence,
    documentation: docsOf(ISO_STATUS_URL, ISO_INTRO_URL),
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeIso(p: IsoParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const groups = listOf(p.report.OrgnlGrpInfAndSts);
  const out: DecodedErrorDraft[] = [];
  groups.forEach((g, i) => {
    if (isoCode(g.GrpSts) !== "RJCT") return;
    const ref = merchantRefOf(g.OrgnlMsgId);
    const path = isoPath(p, i, groups.length);
    const loc = (sub: string): Location => ({
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: sub },
      ...(ref ? { paymentReference: ref } : {}),
    });
    const reasons = isoReasonsOf(g);
    if (reasons.length === 0) out.push(decodeIsoReason(undefined, p, loc(path)));
    reasons.forEach((r, k) =>
      out.push(
        decodeIsoReason(r, p, loc(`${path}.StsRsnInf${reasons.length > 1 ? `[${k}]` : ""}`)),
      ),
    );
  });
  return out;
}

function decodeErrors(parsed: InpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "iso20022":
      return decodeIso(parsed, ctx);
    case "payout":
      return decodePayout(parsed.value, ctx);
    case "order":
      return decodeOrder(parsed.value, ctx);
    case "error":
      return parsed.items.map((item, i) =>
        decodeErrorItem(item, ctx.meta?.http?.status, {
          sourceFormat: ctx.format,
          source: {
            recordIndex: ctx.recordIndex,
            path: parsed.shape === "errors" ? `errors[${i}]` : parsed.shape,
          },
        }),
      );
  }
}

export const inpayAdapter: ProviderAdapter<InpayParsed> = {
  id: PROVIDER,
  displayName: "Inpay",
  version: INPAY_ADAPTER_VERSION,
  manifest: inpayManifest,
  supportedFormats: [
    {
      id: "inpay.payout",
      description:
        "Payout payment request (status response, search item or webhook: inpay_unique_reference, end_to_end_id, state, reasons)",
    },
    {
      id: "inpay.order",
      description: "Pay-in Order (GetOrder or order webhook: uuid, status, payments[], refund)",
    },
    {
      id: "inpay.error",
      description:
        "Error body ({ errors: [...] }, { error: { code, title, details } } or { message })",
    },
    {
      id: ISO_FORMAT,
      description:
        "ISO 20022 payment status report (XML Document with CstmrPmtStsRpt or FIToFIPmtStsRpt): group status and status reasons",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    if (event.sourceFormat === ISO_FORMAT) {
      // Reports on the same original message share its OrgnlMsgId. Inpay
      // documents no per-transaction ids, so they are not linked to JSON
      // payouts by end_to_end_id.
      return event.paymentReference ? [`iso-orgnl-msg:${event.paymentReference}`] : [];
    }
    const keys: string[] = [];
    if (event.paymentReference) keys.push(event.paymentReference);
    if (event.stage === "payout") {
      // end_to_end_id is the merchant's unique payout reference; Inpay looks
      // payouts up by it.
      if (event.merchantReference) keys.push(`e2e:${event.merchantReference}`);
      return keys;
    }
    if (event.relatedReference) {
      // Order relatedReference is primary_payment or an attempt's
      // inpay_unique_reference, except on refund events (refund uuid).
      keys.push(
        event.eventType.startsWith("refund.")
          ? `refund:${event.relatedReference}`
          : `payment:${event.relatedReference}`,
      );
    }
    return keys;
  },
};

export * from "./catalog.js";
export default inpayAdapter;
