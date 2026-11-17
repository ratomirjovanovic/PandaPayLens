/**
 * Xendit adapter.
 *
 * Supported input families:
 * - `xendit.api_error`        error response `{ error_code, message, errors? }`
 * - `xendit.webhook`          v3 webhook `{ event, business_id, created, data }` for payment.*,
 *                             payment_request.expiry, refund.* and v3_payout.* events
 * - `xendit.payment_request`  Payments API v3 Payment Request object (`payment_request_id`)
 * - `xendit.payment`          Payments API v3 Payment object (`payment_id`)
 * - `xendit.refund`           v3 Refund object (`refund_id`)
 * - `xendit.payout`           Payouts v3 Payout object (`payout_id`)
 * - `xendit.invoice`          legacy Invoice object and invoice callback
 * - `xendit.disbursement`     legacy Disbursement object and disbursement callback
 *
 * Recognized but not supported: `xendit.webhook.other` (payment token,
 * session, subscription, dispute and other events in the same envelope).
 */

import {
  decimalToMinor,
  safeId,
  safeText,
  toIsoTimestamp,
  upperCurrency,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
  type NormalizeContext,
  type NormalizedEvent,
  type NormalizedEventDraft,
  type Outcome,
  type ProviderAdapter,
  type RecordMeta,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  API_ERROR_CODES,
  DISBURSEMENT_FAILURE_CODES,
  DISBURSEMENT_STATUSES,
  GENERIC_ERROR_CODES,
  HANDLING_WEBHOOKS_URL,
  INVOICE_STATUSES,
  LEGACY_ERRORS_URL,
  PAYMENT_FAILURE_CODES,
  PAYMENT_REQUEST_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_WEBHOOK_URL,
  PAYOUT_FAILURE_CODES,
  PAYOUT_STATUSES,
  PAYOUT_STATUS_VALUES,
  PAYOUT_WEBHOOK_URL,
  REFUND_STATUSES,
  REFUND_WEBHOOK_URL,
  UNDESCRIBED_PAYOUT_EVENTS,
  WEBHOOK_EVENTS,
  lookup,
  type CatalogEntry,
  type StatusInfo,
} from "./catalog.js";
import { xenditManifest, XENDIT_ADAPTER_VERSION } from "./manifest.js";

export { xenditManifest, XENDIT_ADAPTER_VERSION };

const PROVIDER = "xendit";
const str = (max: number) => z.string().max(max);
const amount = z.union([z.number(), z.string().max(64)]);

const ErrorResponse = z.looseObject({
  error_code: str(128),
  message: z.string().optional(),
  errors: z.array(z.unknown()).optional(),
});

const Capture = z.looseObject({
  capture_id: str(255).optional(),
  capture_timestamp: str(64).optional(),
  capture_amount: amount.optional(),
});

const PaymentDetails = z.looseObject({
  authorization_data: z
    .looseObject({
      network_response_code: str(32).optional(),
      network_response_code_descriptor: z.string().optional(),
      cvn_verification_result: str(8).optional(),
      address_verification_result: str(8).optional(),
    })
    .optional(),
  authentication_data: z.looseObject({ flow: str(32).optional() }).optional(),
});

const PaymentObject = z.looseObject({
  payment_id: str(255),
  payment_request_id: str(255).optional(),
  reference_id: str(255).optional(),
  type: str(64).optional(),
  country: str(8).optional(),
  currency: str(8).optional(),
  request_amount: amount.optional(),
  capture_method: str(32).optional(),
  channel_code: str(128).optional(),
  status: str(64).optional(),
  failure_code: str(128).optional(),
  captures: z.array(Capture).optional(),
  payment_details: PaymentDetails.optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const PaymentRequestObject = z.looseObject({
  payment_request_id: str(255),
  reference_id: str(255).optional(),
  latest_payment_id: str(255).optional(),
  latest_payment: z.unknown().optional(),
  type: str(64).optional(),
  country: str(8).optional(),
  currency: str(8).optional(),
  request_amount: amount.optional(),
  capture_method: str(32).optional(),
  channel_code: str(128).optional(),
  status: str(64).optional(),
  failure_code: str(128).optional(),
  actions: z
    .array(z.looseObject({ type: str(64).optional(), descriptor: str(64).optional() }))
    .optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const RefundObject = z.looseObject({
  refund_id: str(255),
  payment_id: str(255).optional(),
  payment_request_id: str(255).optional(),
  reference_id: str(255).optional(),
  status: str(64).optional(),
  amount: amount.optional(),
  currency: str(8).optional(),
  channel_code: str(128).optional(),
  reason: str(64).optional(),
  failure_code: str(128).optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const PayoutObject = z.looseObject({
  payout_id: str(255),
  reference_id: str(255).optional(),
  status: str(64).optional(),
  type: str(16).optional(),
  source_currency: str(8).optional(),
  source_amount: amount.optional(),
  destination_currency: str(8).optional(),
  destination_amount: amount.optional(),
  purpose_code: str(64).optional(),
  failure_code: str(128).optional(),
  estimated_arrival_time: str(64).optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const InvoiceObject = z.looseObject({
  id: str(255),
  external_id: str(255).optional(),
  status: str(32),
  amount: amount.optional(),
  paid_amount: amount.optional(),
  currency: str(8).optional(),
  payment_method: str(64).optional(),
  payment_channel: str(64).optional(),
  bank_code: str(64).optional(),
  ewallet_type: str(64).optional(),
  paid_at: str(64).optional(),
  expiry_date: str(64).optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const DisbursementObject = z.looseObject({
  id: str(255),
  external_id: str(255).optional(),
  status: str(32),
  amount: amount.optional(),
  bank_code: str(64).optional(),
  failure_code: str(128).optional(),
  is_instant: z.boolean().optional(),
  created: str(64).optional(),
  updated: str(64).optional(),
});

const Webhook = z.looseObject({
  event: str(128),
  business_id: str(255).optional(),
  created: str(64).optional(),
  api_version: str(16).optional(),
  data: z.record(z.string(), z.unknown()),
});

type Payment = z.infer<typeof PaymentObject>;
type PaymentRequest = z.infer<typeof PaymentRequestObject>;
type Refund = z.infer<typeof RefundObject>;
type Payout = z.infer<typeof PayoutObject>;
type Invoice = z.infer<typeof InvoiceObject>;
type Disbursement = z.infer<typeof DisbursementObject>;

type WebhookObject =
  | { kind: "payment"; value: Payment }
  | { kind: "payment_request"; value: PaymentRequest }
  | { kind: "refund"; value: Refund }
  | { kind: "payout"; value: Payout };

export type XenditParsed =
  | { kind: "api_error"; value: z.infer<typeof ErrorResponse> }
  | { kind: "webhook"; value: z.infer<typeof Webhook>; object: WebhookObject }
  | WebhookObject
  | { kind: "invoice"; value: Invoice }
  | { kind: "disbursement"; value: Disbursement };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/;
const isStr = (v: unknown): v is string => typeof v === "string" && v !== "";
const ERROR_KEYS = new Set(["error_code", "message", "errors"]);

const PAYMENT_KEYS = ["payment_request_id", "capture_method", "channel_code", "request_amount"];

function none(): DetectionResult {
  return { provider: PROVIDER, format: null, confidence: 0, supported: false, reasons: [] };
}

function found(format: string, confidence: number, reasons: string[]): DetectionResult {
  return { provider: PROVIDER, format, confidence, supported: true, reasons };
}

/** Which v3 object a record (or a webhook's data) is, from its documented id fields. */
function objectKind(o: Record<string, unknown>): WebhookObject["kind"] | null {
  if (isStr(o.refund_id) && isStr(o.payment_id)) return "refund";
  if (isStr(o.payout_id)) return "payout";
  if (isStr(o.payment_id)) return "payment";
  if (isStr(o.payment_request_id)) return "payment_request";
  return null;
}

function detectObject(o: Record<string, unknown>): DetectionResult | null {
  const kind = objectKind(o);
  const status = typeof o.status === "string" ? o.status : undefined;
  if (kind === "refund") {
    if (!status || !lookup(REFUND_STATUSES, status)) return null;
    return found("xendit.refund", 0.85, [
      "has refund_id and payment_id",
      "status is a documented v3 refund status",
    ]);
  }
  if (kind === "payout") {
    if (!status || !PAYOUT_STATUS_VALUES.includes(status)) return null;
    if (!("source_amount" in o) && !("destination_amount" in o) && !("source_currency" in o))
      return null;
    return found("xendit.payout", 0.85, [
      "has payout_id",
      "status is a documented payout status",
      "has source or destination amount fields",
    ]);
  }
  if (kind === "payment" || kind === "payment_request") {
    const table = kind === "payment" ? PAYMENT_STATUSES : PAYMENT_REQUEST_STATUSES;
    if (!status || !lookup(table, status)) return null;
    const fields = PAYMENT_KEYS.filter((k) => k in o);
    if (fields.length < 2) return null;
    return found(`xendit.${kind}`, 0.85, [
      `has ${kind === "payment" ? "payment_id" : "payment_request_id"}`,
      `status is a documented ${kind === "payment" ? "Payment" : "Payment Request"} status`,
      `has ${fields.join(", ")}`,
    ]);
  }
  return null;
}

function detectLegacy(o: Record<string, unknown>): DetectionResult | null {
  if (!isStr(o.id) || !isStr(o.user_id) || !isStr(o.status) || !("external_id" in o)) return null;
  if (
    lookup(INVOICE_STATUSES, o.status) &&
    ("merchant_name" in o || "is_high" in o || "invoice_url" in o) &&
    ("amount" in o || "paid_amount" in o)
  )
    return found("xendit.invoice", 0.85, [
      "has id, external_id and user_id",
      "has invoice fields (merchant_name, is_high or invoice_url)",
      "status is a documented invoice status",
    ]);
  if (
    lookup(DISBURSEMENT_STATUSES, o.status) &&
    "bank_code" in o &&
    ("disbursement_description" in o || "account_holder_name" in o)
  )
    return found("xendit.disbursement", 0.85, [
      "has id, external_id and user_id",
      "has bank_code with disbursement_description or account_holder_name",
      "status is a documented disbursement status",
    ]);
  return null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  if (!isObj(input)) return none();

  // Error envelope: exactly the documented keys, an UPPER_SNAKE code and a message.
  if (typeof input.error_code === "string") {
    const keys = Object.keys(input);
    if (!keys.every((k) => ERROR_KEYS.has(k)) || !UPPER_SNAKE.test(input.error_code)) return none();
    if (typeof input.message !== "string") return none();
    const known = lookup(API_ERROR_CODES, input.error_code) !== undefined;
    const generic = GENERIC_ERROR_CODES.includes(input.error_code);
    const httpError = (meta?.http?.status ?? 0) >= 400;
    const reasons = ["has only error_code (UPPER_SNAKE), message and optional errors"];
    let confidence = 0.4;
    if (known && !generic) {
      confidence = 0.85;
      reasons.push("error_code is a documented Xendit error code");
    } else if (known) {
      confidence = 0.6;
      reasons.push("error_code is a documented, but widely used, Xendit error code");
    }
    if (httpError) {
      confidence += 0.05;
      reasons.push("came with an HTTP error status");
    }
    return found("xendit.api_error", confidence, reasons);
  }

  // v3 webhook envelope.
  if (
    typeof input.event === "string" &&
    isObj(input.data) &&
    isStr(input.business_id) &&
    isStr(input.created)
  ) {
    const kind = objectKind(input.data);
    const info = lookup(WEBHOOK_EVENTS, input.event);
    const payoutEvent = UNDESCRIBED_PAYOUT_EVENTS.includes(input.event);
    if ((info && info.object === kind) || (payoutEvent && kind === "payout"))
      return found("xendit.webhook", 0.95, [
        "has event, business_id, created and data",
        `event ${input.event} is a documented webhook event`,
        `data carries a ${kind} object`,
      ]);
    return {
      ...none(),
      format: "xendit.webhook.other",
      confidence: 0.7,
      reasons: ["has event, business_id, created and data"],
      unsupportedReason: `Xendit webhook events of type "${safeText(input.event, 64) ?? "unknown"}" are recognized but not supported. PandaPayLens analyzes payment, payment request, refund and payout events.`,
    };
  }

  return detectObject(input) ?? detectLegacy(input) ?? none();
}

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const path = [...(prefix ? [prefix] : []), ...i.path.map(String)].join(".");
    return `${path || "(root)"}: ${i.message}`;
  });
}

type ParseResult = { ok: true; value: XenditParsed } | { ok: false; issues: string[] };

function parseObject(kind: WebhookObject["kind"], input: unknown, prefix = ""): ParseResult {
  const schema = {
    payment: PaymentObject,
    payment_request: PaymentRequestObject,
    refund: RefundObject,
    payout: PayoutObject,
  }[kind];
  const r = schema.safeParse(input);
  if (!r.success) return { ok: false, issues: issuesOf(r.error, prefix) };
  return { ok: true, value: { kind, value: r.data } as WebhookObject };
}

function parse(input: unknown, format: string): ParseResult {
  switch (format) {
    case "xendit.api_error": {
      const r = ErrorResponse.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "api_error", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "xendit.webhook": {
      const r = Webhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const kind = objectKind(r.data.data);
      if (!kind) return { ok: false, issues: ["data: no payment, refund or payout id"] };
      const obj = parseObject(kind, r.data.data, "data");
      if (!obj.ok) return obj;
      return {
        ok: true,
        value: { kind: "webhook", value: r.data, object: obj.value as WebhookObject },
      };
    }
    case "xendit.payment":
      return parseObject("payment", input);
    case "xendit.payment_request":
      return parseObject("payment_request", input);
    case "xendit.refund":
      return parseObject("refund", input);
    case "xendit.payout":
      return parseObject("payout", input);
    case "xendit.invoice": {
      const r = InvoiceObject.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "invoice", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "xendit.disbursement": {
      const r = DisbursementObject.safeParse(input);
      return r.success
        ? { ok: true, value: { kind: "disbursement", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    default:
      return { ok: false, issues: [`Unsupported Xendit format "${format}".`] };
  }
}

type Attributes = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attributes {
  const out: Attributes = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 64) ?? "");
  }
  return out;
}

const iso = (v: unknown) => toIsoTimestamp(v);
/** Short UPPER_SNAKE or code-like values only. */
const code = (v: unknown, max = 64) => (typeof v === "string" ? safeId(v.trim(), max) : undefined);
/** Decimal amounts as a plain string, for display only. */
const decimalText = (v: unknown) => {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  return typeof s === "string" && /^-?\d{1,30}(\.\d{1,10})?$/.test(s) ? s : undefined;
};

/** Delivery context from a pasted HTTP message. The x-callback-token header is never read. */
function httpAttrs(meta: RecordMeta | undefined): Attributes {
  const http = meta?.http;
  if (!http) return {};
  return attrs([["httpStatus", http.status]]);
}

/** The webhook-id header Xendit documents for idempotent handling (legacy API reference). */
function webhookId(meta: RecordMeta | undefined): string | undefined {
  return safeId(meta?.http?.headers["webhook-id"], 255);
}

type Described = {
  eventType: string;
  paymentReference?: string | undefined;
  relatedReference?: string | undefined;
  merchantReference?: string | undefined;
  status?: string | undefined;
  info?: StatusInfo | undefined;
  amountMinor?: string | undefined;
  currency?: string | undefined;
  timestamp?: string | undefined;
  attributes: Attributes;
};

function isReusable(type: string | undefined): boolean {
  return type === "REUSABLE_PAYMENT_CODE";
}

function describePayment(p: Payment): Described {
  const currency = upperCurrency(p.currency);
  const captures = p.captures ?? [];
  const last = captures[captures.length - 1];
  const auth = p.payment_details?.authorization_data;
  // Only allowlisted fields: payer names and account numbers, receipt ids,
  // remarks, card details, metadata and customer ids are never copied.
  return {
    eventType: "payment.snapshot",
    paymentReference: safeId(p.payment_id),
    // A reusable payment code receives many payments, so its id does not
    // identify one payment and is not used for correlation.
    relatedReference: isReusable(p.type) ? undefined : safeId(p.payment_request_id),
    merchantReference: safeId(p.reference_id, 255),
    status: code(p.status),
    info: lookup(PAYMENT_STATUSES, p.status),
    amountMinor: decimalToMinor(p.request_amount, currency),
    currency,
    timestamp: iso(p.updated),
    attributes: attrs([
      ["objectType", "payment"],
      ["paymentRequestId", isReusable(p.type) ? safeId(p.payment_request_id) : undefined],
      ["requestType", code(p.type)],
      ["channelCode", code(p.channel_code, 128)],
      ["country", code(p.country, 8)],
      ["captureMethod", code(p.capture_method)],
      ["failureCode", code(p.failure_code, 128)],
      ["captureCount", captures.length > 0 ? captures.length : undefined],
      ["lastCaptureId", safeId(last?.capture_id)],
      ["lastCapturedAt", iso(last?.capture_timestamp)],
      ["lastCaptureAmountMinor", decimalToMinor(last?.capture_amount, currency)],
      ["networkResponseCode", code(auth?.network_response_code, 16)],
      ["cvnVerificationResult", code(auth?.cvn_verification_result, 4)],
      ["addressVerificationResult", code(auth?.address_verification_result, 4)],
      ["authenticationFlow", code(p.payment_details?.authentication_data?.flow)],
      ["createdAt", iso(p.created)],
    ]),
  };
}

function describePaymentRequest(r: PaymentRequest): Described {
  const currency = upperCurrency(r.currency);
  return {
    eventType: "payment_request.snapshot",
    paymentReference: safeId(r.latest_payment_id),
    // The request itself keeps its id; payments of a reusable code do not carry it.
    relatedReference: safeId(r.payment_request_id),
    merchantReference: safeId(r.reference_id, 255),
    status: code(r.status),
    info: lookup(PAYMENT_REQUEST_STATUSES, r.status),
    amountMinor: decimalToMinor(r.request_amount, currency),
    currency,
    timestamp: iso(r.updated),
    attributes: attrs([
      ["objectType", "payment_request"],
      ["requestType", code(r.type)],
      ["channelCode", code(r.channel_code, 128)],
      ["country", code(r.country, 8)],
      ["captureMethod", code(r.capture_method)],
      ["failureCode", code(r.failure_code, 128)],
      // Action types only; the values can hold account numbers, codes or URLs.
      [
        "actionDescriptors",
        r.actions?.map((a) => code(a.descriptor)).filter((x): x is string => Boolean(x)),
      ],
      ["createdAt", iso(r.created)],
    ]),
  };
}

function describeRefund(r: Refund): Described {
  const currency = upperCurrency(r.currency);
  return {
    eventType: "refund.snapshot",
    paymentReference: safeId(r.payment_id) ?? safeId(r.payment_request_id),
    relatedReference: safeId(r.refund_id),
    merchantReference: safeId(r.reference_id, 255),
    status: code(r.status),
    info: lookup(REFUND_STATUSES, r.status),
    amountMinor: decimalToMinor(r.amount, currency),
    currency,
    timestamp: iso(r.updated),
    attributes: attrs([
      ["objectType", "refund"],
      ["channelCode", code(r.channel_code, 128)],
      ["refundReason", code(r.reason)],
      ["failureCode", code(r.failure_code, 128)],
      ["createdAt", iso(r.created)],
    ]),
  };
}

function describePayout(p: Payout): Described {
  // Xendit calls these minor units but its examples contradict that for some
  // currencies, so the raw numbers are shown and no amountMinor is set.
  const num = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : undefined);
  return {
    eventType: "payout.snapshot",
    paymentReference: safeId(p.payout_id),
    merchantReference: safeId(p.reference_id, 255),
    status: code(p.status),
    info: lookup(PAYOUT_STATUSES, p.status),
    timestamp: iso(p.updated),
    attributes: attrs([
      ["objectType", "payout"],
      ["payoutType", code(p.type, 16)],
      ["sourceCurrency", upperCurrency(p.source_currency)],
      ["sourceAmountAsSent", num(p.source_amount)],
      ["destinationCurrency", upperCurrency(p.destination_currency)],
      ["destinationAmountAsSent", num(p.destination_amount)],
      ["purposeCode", code(p.purpose_code)],
      ["failureCode", code(p.failure_code, 128)],
      ["estimatedArrivalTime", iso(p.estimated_arrival_time)],
      ["createdAt", iso(p.created)],
    ]),
  };
}

function describeObject(o: WebhookObject): Described {
  switch (o.kind) {
    case "payment":
      return describePayment(o.value);
    case "payment_request":
      return describePaymentRequest(o.value);
    case "refund":
      return describeRefund(o.value);
    case "payout":
      return describePayout(o.value);
  }
}

function describeInvoice(inv: Invoice): Described {
  const currency = upperCurrency(inv.currency);
  const status = code(inv.status);
  return {
    eventType: "invoice.snapshot",
    paymentReference: safeId(inv.id),
    merchantReference: safeId(inv.external_id, 255),
    status,
    info: lookup(INVOICE_STATUSES, inv.status),
    amountMinor: decimalToMinor(inv.amount, currency),
    currency,
    timestamp: iso(status === "PAID" ? (inv.paid_at ?? inv.updated) : inv.updated),
    attributes: attrs([
      ["objectType", "invoice"],
      ["paidAmountMinor", decimalToMinor(inv.paid_amount, currency)],
      ["paymentMethod", code(inv.payment_method)],
      ["paymentChannel", code(inv.payment_channel)],
      ["bankCode", code(inv.bank_code)],
      ["ewalletType", code(inv.ewallet_type)],
      ["paidAt", iso(inv.paid_at)],
      ["expiryDate", iso(inv.expiry_date)],
      ["createdAt", iso(inv.created)],
    ]),
  };
}

function describeDisbursement(d: Disbursement): Described {
  return {
    eventType: "disbursement.snapshot",
    paymentReference: safeId(d.id),
    merchantReference: safeId(d.external_id, 255),
    status: code(d.status),
    info: lookup(DISBURSEMENT_STATUSES, d.status),
    timestamp: iso(d.updated),
    attributes: attrs([
      ["objectType", "disbursement"],
      // No currency field: the amount is shown as sent.
      ["amountAsSent", decimalText(d.amount)],
      ["bankCode", code(d.bank_code)],
      ["failureCode", code(d.failure_code, 128)],
      ["isInstant", d.is_instant],
      ["createdAt", iso(d.created)],
    ]),
  };
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function draft(
  d: Described,
  ctx: NormalizeContext,
  path: string,
  overrides: Partial<NormalizedEventDraft> = {},
): NormalizedEventDraft {
  return clean({
    sourceFormat: ctx.format,
    eventType: d.eventType,
    eventTypeKnown: d.info !== undefined,
    stage: d.info?.stage ?? "other",
    providerStatus: d.status,
    paymentReference: d.paymentReference,
    relatedReference: d.relatedReference,
    merchantReference: d.merchantReference,
    eventTimestamp: d.timestamp,
    amountMinor: d.amountMinor,
    currency: d.currency,
    outcome: d.info?.outcome ?? "unknown",
    attributes: { ...d.attributes, ...httpAttrs(ctx.meta) },
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    ...overrides,
  });
}

function normalize(parsed: XenditParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "api_error": {
      const e = parsed.value;
      const c = code(e.error_code, 128) ?? "unknown";
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `api_error.${c}`,
          eventTypeKnown: lookup(API_ERROR_CODES, e.error_code) !== undefined,
          stage: "error",
          providerStatus: c,
          outcome: "unknown",
          attributes: {
            ...attrs([
              ["errorCode", c],
              ["errorDetailCount", e.errors?.length],
            ]),
            ...httpAttrs(ctx.meta),
          },
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
    case "invoice":
      return [draft(describeInvoice(parsed.value), ctx, "", { deliveryKey: webhookId(ctx.meta) })];
    case "disbursement":
      return [
        draft(describeDisbursement(parsed.value), ctx, "", { deliveryKey: webhookId(ctx.meta) }),
      ];
    case "webhook": {
      const w = parsed.value;
      const d = describeObject(parsed.object);
      const info = lookup(WEBHOOK_EVENTS, w.event);
      const known = info !== undefined && info.object === parsed.object.kind;
      return [
        draft(d, ctx, "", {
          eventType: safeText(w.event, 128) ?? "unknown",
          eventTypeKnown: known,
          // The event names the transition; the object status is kept as providerStatus.
          stage: known ? info.stage : (d.info?.stage ?? "other"),
          outcome: known ? info.outcome : "unknown",
          eventTimestamp: d.timestamp ?? iso(w.created),
          deliveryKey: webhookId(ctx.meta),
          attributes: {
            ...d.attributes,
            ...attrs([
              ["eventCreatedAt", iso(w.created)],
              ["apiVersion", code(w.api_version, 16)],
            ]),
            ...httpAttrs(ctx.meta),
          },
        }),
      ];
    }
    default:
      return [draft(describeObject(parsed), ctx, "")];
  }
}

function docsFor(
  entry: CatalogEntry | undefined,
  title: string,
  fallback: string,
): DocumentationLink[] {
  return [{ title, url: entry?.docs ?? fallback }];
}

function decodeEntry(
  rawCode: string,
  entry: CatalogEntry | undefined,
  title: string,
  fallbackDocs: string,
  unknownText: string,
): Omit<DecodedErrorDraft, "sourceFormat" | "source"> {
  const c = code(rawCode, 128) ?? "unknown";
  const missing: string[] = [];
  if (!entry)
    missing.push(`Code "${safeText(rawCode, 64) ?? ""}" is not in the PandaPayLens catalog.`);
  if (entry?.confidence === "insufficient") missing.push("Xendit does not describe this code.");
  const confidence: Confidence = entry?.confidence ?? "insufficient";
  return {
    code: c,
    subCodes: {},
    category: entry?.category ?? "unknown",
    explanation: entry?.explanation ?? unknownText,
    nextAction: entry?.nextAction ?? "Check the transaction in the Xendit dashboard.",
    retry: entry?.retry ?? "unknown",
    retryExplanation: entry?.retryExplanation ?? "Retry safety cannot be assessed for this code.",
    confidence,
    documentation: docsFor(entry, `${title}: ${c}`, fallbackDocs),
    missingInformation: missing,
  };
}

function objectErrors(
  o: WebhookObject,
  ctx: NormalizeContext,
  prefix: string,
): DecodedErrorDraft[] {
  const at = (path: string) => ({ recordIndex: ctx.recordIndex, path: `${prefix}${path}` });
  if (o.kind === "payment" || o.kind === "payment_request") {
    const v = o.value;
    const raw = v.failure_code?.trim();
    if (!raw) return [];
    const d = decodeEntry(
      raw,
      lookup(PAYMENT_FAILURE_CODES, raw),
      "Xendit payment failure code",
      PAYMENT_WEBHOOK_URL,
      "PandaPayLens does not recognize this Xendit payment failure code.",
    );
    if (o.kind === "payment") {
      const auth = o.value.payment_details?.authorization_data;
      const nrc = code(auth?.network_response_code, 16);
      if (nrc) d.subCodes.networkResponseCode = nrc;
      const desc = safeText(auth?.network_response_code_descriptor, 120);
      if (desc) d.subCodes.networkResponseDescriptor = desc;
    }
    const paymentId =
      o.kind === "payment" ? safeId(o.value.payment_id) : safeId(o.value.latest_payment_id);
    const failed = v.status === "FAILED";
    if (!failed)
      d.missingInformation.push(
        `The object status is ${safeText(v.status, 32) ?? "missing"}, not FAILED.`,
      );
    return [
      {
        ...d,
        sourceFormat: ctx.format,
        source: at("failure_code"),
        outcomeKnown: failed,
        ...(paymentId ? { paymentReference: paymentId, attemptReference: paymentId } : {}),
      },
    ];
  }
  if (o.kind === "refund") {
    const raw = o.value.failure_code?.trim();
    if (!raw) return [];
    // Xendit documents refund failure codes only as channel specific.
    const d = decodeEntry(
      raw,
      undefined,
      "Xendit refund failure code",
      REFUND_WEBHOOK_URL,
      "Xendit documents refund failure codes as channel specific and does not list them.",
    );
    const ref = safeId(o.value.payment_id);
    const attempt = safeId(o.value.refund_id);
    return [
      {
        ...d,
        sourceFormat: ctx.format,
        source: at("failure_code"),
        outcomeKnown: o.value.status === "FAILED",
        ...(ref ? { paymentReference: ref } : {}),
        ...(attempt ? { attemptReference: attempt } : {}),
      },
    ];
  }
  const raw = o.value.failure_code?.trim();
  if (!raw) return [];
  const d = decodeEntry(
    raw,
    lookup(PAYOUT_FAILURE_CODES, raw),
    "Xendit payout failure code",
    PAYOUT_WEBHOOK_URL,
    "PandaPayLens does not recognize this Xendit payout failure code.",
  );
  const id = safeId(o.value.payout_id);
  return [
    {
      ...d,
      sourceFormat: ctx.format,
      source: at("failure_code"),
      outcomeKnown: o.value.status === "FAILED",
      ...(id ? { paymentReference: id, attemptReference: id } : {}),
    },
  ];
}

function decodeErrors(parsed: XenditParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "api_error": {
      const e = parsed.value;
      const entry = lookup(API_ERROR_CODES, e.error_code);
      const d = decodeEntry(
        e.error_code,
        entry,
        "Xendit error code",
        LEGACY_ERRORS_URL,
        "PandaPayLens does not recognize this Xendit error code.",
      );
      const status = ctx.meta?.http?.status;
      if (status !== undefined) {
        d.subCodes.httpStatus = String(status);
        if (entry?.http && !entry.http.includes(status))
          d.missingInformation.push(
            `Xendit documents this code with HTTP ${entry.http.join(" or ")}, not ${status}.`,
          );
      }
      const message = safeText(e.message, 300);
      if (message) d.providerMessage = message;
      if (d.category === "provider_unavailable")
        d.missingInformation.push(
          "The error does not show whether the original request took effect.",
        );
      return [
        { ...d, sourceFormat: ctx.format, source: { recordIndex: ctx.recordIndex, path: "" } },
      ];
    }
    case "webhook":
      return objectErrors(parsed.object, ctx, "data.");
    case "invoice":
      return [];
    case "disbursement": {
      const v = parsed.value;
      const raw = v.failure_code?.trim();
      if (!raw) return [];
      const d = decodeEntry(
        raw,
        lookup(DISBURSEMENT_FAILURE_CODES, raw),
        "Xendit disbursement failure code",
        HANDLING_WEBHOOKS_URL,
        "PandaPayLens does not recognize this Xendit disbursement failure code.",
      );
      const id = safeId(v.id);
      return [
        {
          ...d,
          sourceFormat: ctx.format,
          source: { recordIndex: ctx.recordIndex, path: "failure_code" },
          outcomeKnown: v.status === "FAILED",
          ...(id ? { paymentReference: id, attemptReference: id } : {}),
        },
      ];
    }
    default:
      return objectErrors(parsed, ctx, "");
  }
}

export const xenditAdapter: ProviderAdapter<XenditParsed> = {
  id: PROVIDER,
  displayName: "Xendit",
  version: XENDIT_ADAPTER_VERSION,
  manifest: xenditManifest,
  supportedFormats: [
    { id: "xendit.api_error", description: "Error response { error_code, message, errors? }" },
    {
      id: "xendit.webhook",
      description:
        "v3 webhooks: payment.capture, payment.authorization, payment.failure, payment.expiry, payment_request.expiry, refund.succeeded, refund.failed and v3_payout.* events",
    },
    { id: "xendit.payment_request", description: "Payments API v3 Payment Request object" },
    { id: "xendit.payment", description: "Payments API v3 Payment object" },
    { id: "xendit.refund", description: "v3 Refund object" },
    { id: "xendit.payout", description: "Payouts v3 Payout object" },
    { id: "xendit.invoice", description: "Legacy Invoice object and invoice callback" },
    {
      id: "xendit.disbursement",
      description: "Legacy Disbursement object and disbursement callback",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Payment, refund, payout, invoice and disbursement ids, and the payment
    // request id except for reusable payment codes. reference_id and
    // external_id are merchant references and never link events.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default xenditAdapter;
