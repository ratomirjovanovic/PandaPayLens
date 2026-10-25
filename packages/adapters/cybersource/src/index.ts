/**
 * Cybersource adapter.
 *
 * Supported input families:
 * - `cybersource.payment_response`     REST Payments API v2 HTTP 201 response (authorization,
 *                                      sale, capture, reversal, refund, credit, void)
 * - `cybersource.error_response`       HTTP 400 / 502 flat error body
 *                                      (`submitTimeUtc`, `status`, `reason`, `message`, `details[]`)
 * - `cybersource.webhook`              Webhook notification envelope, version 3
 * - `cybersource.transaction_details`  Transaction Details response (`rootId`, `applicationInformation`)
 * - `cybersource.pay_by_bank_payload`  Decrypted Pay by Bank notification payload (dotted keys)
 *
 * Recognized but not analyzed: `cybersource.encrypted_message`, a REST body
 * wrapped in message-level encryption (`{ "encryptedResponse": "<JWE>" }`).
 *
 * A decline comes back as HTTP 201 with `status: "DECLINED"` and the reason in
 * `errorInformation.reason`, so declines are decoded from the reason, never
 * from the HTTP status. `processorInformation.responseCode` is processor
 * specific and Cybersource says not to evaluate it; it is shown verbatim.
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
  APPLICATION_NAMES,
  CITED_NUMERIC_CODES,
  ENCRYPTED_PRODUCTS,
  MERCHANT_ADVICE_CODES,
  NEXT_ACTION,
  NUMERIC_REASON_CODES,
  PAYMENTS_GUIDE_URL,
  PAYMENT_INSIGHTS,
  PAYMENT_INSIGHTS_RETRY_TEXT,
  PAY_BY_BANK_STATUSES,
  PAY_BY_BANK_WEBHOOK_URL,
  R_CODES,
  REASONS,
  REASON_CODES_URL,
  RESPONSE_CODES_URL,
  RETRY_TEXT,
  STATUSES,
  TXN_SEARCH_URL,
  WEBHOOKS_URL,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_PRODUCTS,
  type NumericCodeEntry,
} from "./catalog.js";
import { cybersourceManifest, CYBERSOURCE_ADAPTER_VERSION } from "./manifest.js";

export { cybersourceManifest, CYBERSOURCE_ADAPTER_VERSION };

const PROVIDER = "cybersource";

// ---------------------------------------------------------------------------
// Schemas. Optional fields accept null so that pasted records with explicit
// nulls still parse.
// ---------------------------------------------------------------------------

const Text = (max: number) => z.string().max(max).nullish();
const Amount = z.union([z.string().max(64), z.number()]).nullish();
const Code = z.union([z.string().max(32), z.number().int()]).nullish();

const Detail = z.looseObject({ field: Text(512), reason: Text(64) });
const Details = z.array(Detail).max(500).nullish();

const AmountDetails = z.looseObject({
  authorizedAmount: Amount,
  totalAmount: Amount,
  currency: Text(16),
});

const ProcessorInformation = z.looseObject({
  responseCode: Code,
  responseDetails: Text(1000),
  name: Text(128),
  avs: z.looseObject({ code: Code, codeRaw: Code }).nullish(),
  cardVerification: z.looseObject({ resultCode: Code, resultCodeRaw: Code }).nullish(),
  merchantAdvice: z.looseObject({ code: Code, codeRaw: Code }).nullish(),
});

const PaymentResponse = z.looseObject({
  id: z.string().max(64),
  status: z.string().max(64),
  submitTimeUtc: Text(64),
  _links: z.looseObject({}).nullish(),
  errorInformation: z
    .looseObject({ reason: Text(128), message: Text(5000), details: Details })
    .nullish(),
  clientReferenceInformation: z.looseObject({ code: Text(512) }).nullish(),
  orderInformation: z.looseObject({ amountDetails: AmountDetails.nullish() }).nullish(),
  processorInformation: ProcessorInformation.nullish(),
  paymentInsightsInformation: z
    .looseObject({
      responseInsights: z.looseObject({ category: Text(128), categoryCode: Code }).nullish(),
    })
    .nullish(),
  reversalAmountDetails: z.looseObject({ reversedAmount: Amount }).nullish(),
  creditAmountDetails: z.looseObject({ creditAmount: Amount }).nullish(),
  voidAmountDetails: z.looseObject({ voidAmount: Amount }).nullish(),
});

const ErrorResponse = z.looseObject({
  status: z.string().max(64),
  reason: z.string().max(128),
  message: Text(5000),
  submitTimeUtc: Text(64),
  id: Text(64),
  details: Details,
});

const Webhook = z.looseObject({
  eventType: z.string().max(256),
  webhookId: Text(256),
  transactionTraceId: Text(256),
  productId: Text(128),
  organizationId: Text(256),
  eventDate: Text(64),
  requestType: Text(64),
  retryNumber: z.number().int().nullish(),
  payload: z.unknown().optional(),
  metadata: z
    .looseObject({
      notificationTypeID: z.union([z.string().max(32), z.number().int()]).nullish(),
      notificationReason: Text(128),
    })
    .nullish(),
});

const Application = z.looseObject({
  name: z.string().max(128),
  status: Text(64),
  reasonCode: Code,
  rCode: Code,
  rFlag: Text(64),
  rMessage: Text(2000),
});

const TransactionDetails = z.looseObject({
  id: Text(64),
  rootId: Text(64),
  submitTimeUTC: Text(64),
  _links: z.looseObject({}).nullish(),
  clientReferenceInformation: z.looseObject({ code: Text(512) }).nullish(),
  applicationInformation: z.looseObject({
    status: Text(64),
    reasonCode: Code,
    rCode: Code,
    rFlag: Text(64),
    applications: z.array(Application).max(100).nullish(),
  }),
});

const PayByBankPayload = z.looseObject({
  id: z.string().max(64),
  status: z.string().max(64),
  submitTimeUTC: Text(64),
  "clientReferenceInformation.code": Text(512),
  "orderInformation.amountDetails.totalAmount": Amount,
  "orderInformation.amountDetails.currency": Text(16),
});

type PaymentFields = z.infer<typeof PaymentResponse>;
type DetailFields = z.infer<typeof Detail>;
type PayByBankFields = z.infer<typeof PayByBankPayload>;

export type CybersourceParsed =
  | { kind: "payment_response"; value: PaymentFields }
  | { kind: "error_response"; value: z.infer<typeof ErrorResponse> }
  | { kind: "webhook"; value: z.infer<typeof Webhook> }
  | { kind: "transaction_details"; value: z.infer<typeof TransactionDetails> }
  | { kind: "pay_by_bank_payload"; value: PayByBankFields };

const FORMATS = {
  "cybersource.payment_response": ["payment_response", PaymentResponse],
  "cybersource.error_response": ["error_response", ErrorResponse],
  "cybersource.webhook": ["webhook", Webhook],
  "cybersource.transaction_details": ["transaction_details", TransactionDetails],
  "cybersource.pay_by_bank_payload": ["pay_by_bank_payload", PayByBankPayload],
} as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const UPPER_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const REQUEST_ID = /^[A-Za-z0-9]{1,26}$/;
const EVENT_TYPE = /^[A-Za-z]+(?:\.[A-Za-z-]+){2,5}$/;
const JWE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ICS_NAME = /^ics_[a-z0-9_]{1,60}$/;
const PTS_HREF =
  /^(?:https:\/\/[A-Za-z0-9.-]{1,253})?\/pts\/v2\/(payments|captures|reversals|refunds|credits|voids)\/([A-Za-z0-9]{1,26})(?:\/(captures|reversals|refunds|voids))?$/;
const TSS_HREF =
  /^(?:https:\/\/[A-Za-z0-9.-]{1,253})?\/tss\/v2\/transactions\/([A-Za-z0-9]{1,26})$/;

/** Documented `...Information` and service amount objects of a payments response. */
const INFO_KEYS = [
  "clientReferenceInformation",
  "processorInformation",
  "orderInformation",
  "paymentInformation",
  "errorInformation",
  "paymentInsightsInformation",
  "pointOfSaleInformation",
  "paymentAccountInformation",
  "processingInformation",
  "issuerInformation",
  "consumerAuthenticationInformation",
  "riskInformation",
  "installmentInformation",
  "tokenInformation",
  "buyerInformation",
  "merchantInformation",
  "clearingInformation",
  "watchlistScreeningInformation",
  "reversalAmountDetails",
  "creditAmountDetails",
  "voidAmountDetails",
] as const;

/** Keys of the decrypted Pay by Bank payload that only that payload uses. */
const PAY_BY_BANK_KEYS = [
  "clientReferenceInformation.code",
  "orderInformation.amountDetails.totalAmount",
  "orderInformation.amountDetails.currency",
] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** Short code-like value, from a string or an integer. */
function shortCode(v: unknown, max = 10): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  return typeof s === "string" && s.length <= max && /^[0-9A-Za-z][0-9A-Za-z:,_-]*$/.test(s)
    ? s
    : undefined;
}

const upperCode = (v: unknown) => (typeof v === "string" && UPPER_CODE.test(v) ? v : undefined);

const requestId = (v: unknown) =>
  typeof v === "string" && REQUEST_ID.test(v) ? safeId(v) : undefined;

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

function hrefOf(link: unknown): string | undefined {
  if (typeof link === "string") return link;
  return isObj(link) && typeof link.href === "string" ? link.href : undefined;
}

type PtsResource = { collection: string; id: string; action?: string };

function ptsResource(href: string | undefined): PtsResource | undefined {
  const m = href && href.length <= 512 ? PTS_HREF.exec(href) : null;
  return m ? { collection: m[1]!, id: m[2]!, ...(m[3] ? { action: m[3] } : {}) } : undefined;
}

function hasPtsLink(links: unknown): boolean {
  if (!isObj(links)) return false;
  return Object.values(links).some((l) => ptsResource(hrefOf(l)) !== undefined);
}

function relatedTransactionIds(links: unknown): string[] {
  if (!isObj(links) || !Array.isArray(links.relatedTransactions)) return [];
  const out: string[] = [];
  for (const l of links.relatedTransactions.slice(0, 50)) {
    const href = hrefOf(l);
    const m = href && href.length <= 512 ? TSS_HREF.exec(href) : null;
    if (m) out.push(m[1]!);
  }
  return out;
}

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) {
      const list = v.filter(
        (x): x is string | number | boolean =>
          typeof x === "string" || typeof x === "number" || typeof x === "boolean",
      );
      if (list.length)
        out[k] = list.map((x) => (typeof x === "string" ? (safeText(x, 100) ?? "") : x));
    }
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** Field names of `details[]`, never values. */
function detailFields(details: readonly DetailFields[] | null | undefined): string[] {
  return (details ?? [])
    .slice(0, 20)
    .map((d) => {
      const field = safeText(d.field ?? undefined, 120);
      const reason = upperCode(d.reason);
      return field ? (reason ? `${field} (${reason})` : field) : undefined;
    })
    .filter((x): x is string => Boolean(x));
}

/** Integer rCode as a string ("-1", "0", "1"). */
function rCodeOf(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  return typeof s === "string" && /^-?\d{1,3}$/.test(s) ? s : undefined;
}

/** Numeric reason code as a three-digit string. */
function numericCode(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  return typeof s === "string" && /^\d{1,4}$/.test(s) ? s : undefined;
}

/**
 * Two independent 32-bit FNV-1a hashes over a canonical serialization. Used
 * only to compare webhook deliveries without copying the webhook id or the
 * ciphertext into the result.
 */
function fingerprint(value: unknown): string {
  const text = canonical(value, 0);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  const hex = (x: number) => (x >>> 0).toString(16).padStart(8, "0");
  return `${hex(a)}${hex(b)}`;
}

function canonical(v: unknown, depth: number): string {
  if (depth > 80) return '"..."';
  if (Array.isArray(v)) return `[${v.map((x) => canonical(x, depth + 1)).join(",")}]`;
  if (isObj(v)) {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k], depth + 1)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: PROVIDER };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input) || meta?.format === "form") return none;
  // Stripe payloads carry `object`; Cybersource bodies never do at the top level.
  if ("object" in input) return none;
  const headers = meta?.http?.headers ?? {};

  // Message-level encryption wrapper: an object whose only key is the JWE.
  const keys = Object.keys(input);
  if (
    keys.length === 1 &&
    (keys[0] === "encryptedResponse" || keys[0] === "encryptedRequest") &&
    typeof input[keys[0]] === "string"
  ) {
    const jwe = JWE.test(input[keys[0]] as string);
    return {
      ...base,
      format: "cybersource.encrypted_message",
      confidence: jwe ? 0.85 : 0.6,
      supported: false,
      reasons: [
        `the only key is ${keys[0]}`,
        ...(jwe ? ["its value has the five-part JWE compact form"] : []),
      ],
      unsupportedReason:
        "This Cybersource body is wrapped in message-level encryption (JWE). It cannot be decrypted offline; paste the decrypted response instead.",
    };
  }

  if (typeof input.eventType === "string") return detectWebhook(input, headers);

  const appInfo = isObj(input.applicationInformation) ? input.applicationInformation : undefined;
  const apps = Array.isArray(appInfo?.applications) ? appInfo.applications : [];
  const icsApps = apps.filter(
    (a) => isObj(a) && typeof a.name === "string" && ICS_NAME.test(a.name),
  );
  const tssSelf = isObj(input._links) && TSS_HREF.test(hrefOf(input._links.self) ?? "");
  if (appInfo && (icsApps.length > 0 || (typeof input.rootId === "string" && tssSelf))) {
    let score = 0.1;
    const reasons: string[] = [];
    if (icsApps.length > 0) {
      score += 0.45;
      reasons.push("applicationInformation.applications[] lists ics_ service names");
    }
    if (typeof input.rootId === "string") {
      score += 0.2;
      reasons.push("has rootId");
    }
    if (typeof input.submitTimeUTC === "string") {
      score += 0.15;
      reasons.push("has submitTimeUTC");
    }
    if (appInfo.rCode !== undefined || appInfo.reasonCode !== undefined) score += 0.1;
    if (tssSelf) {
      score += 0.15;
      reasons.push("_links.self points to /tss/v2/transactions/");
    }
    return {
      ...base,
      format: "cybersource.transaction_details",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  const pbbKeys = PAY_BY_BANK_KEYS.filter((k) => k in input);
  if (pbbKeys.length > 0 && typeof input.status === "string" && typeof input.id === "string") {
    let score = 0.1 + 0.2 * pbbKeys.length;
    const reasons = [`has the dotted keys ${pbbKeys.join(", ")}`];
    if ("reconcillationID" in input) {
      score += 0.15;
      reasons.push("has reconcillationID");
    }
    if (typeof input.submitTimeUTC === "string") score += 0.1;
    if (lookup(PAY_BY_BANK_STATUSES, input.status.toUpperCase())) {
      score += 0.1;
      reasons.push(`status "${input.status}" is a documented Pay by Bank status`);
    }
    return {
      ...base,
      format: "cybersource.pay_by_bank_payload",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  if (typeof input.status !== "string") return none;
  const status = input.status;
  const submitTime = typeof input.submitTimeUtc === "string" && ISO_UTC.test(input.submitTimeUtc);
  const httpStatus = meta?.http?.status;

  if (
    typeof input.reason === "string" &&
    !("errorInformation" in input) &&
    (status === "INVALID_REQUEST" || status === "SERVER_ERROR")
  ) {
    if (!UPPER_CODE.test(input.reason)) return none;
    let score = 0.25;
    const reasons = [`flat status ${status} with a reason`];
    if (lookup(REASONS, input.reason)) {
      score += 0.15;
      reasons.push(`reason "${input.reason}" is a documented Cybersource reason`);
    }
    if (typeof input.message === "string") score += 0.05;
    if (submitTime) {
      score += 0.35;
      reasons.push("has submitTimeUtc");
    }
    if (
      Array.isArray(input.details) &&
      input.details.length > 0 &&
      input.details.every(
        (d) => isObj(d) && typeof d.field === "string" && typeof d.reason === "string",
      )
    ) {
      score += 0.1;
      reasons.push("details[] entries have field and reason");
    }
    if (
      (status === "INVALID_REQUEST" && httpStatus === 400) ||
      (status === "SERVER_ERROR" && httpStatus === 502)
    ) {
      score += 0.1;
      reasons.push(`arrived as HTTP ${httpStatus}`);
    }
    return {
      ...base,
      format: "cybersource.error_response",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  if (!UPPER_CODE.test(status)) return none;
  const reasons: string[] = [];
  let markers = 0;
  let score = 0.1;
  if (submitTime) {
    score += 0.3;
    markers++;
    reasons.push("has submitTimeUtc");
  }
  if (hasPtsLink(input._links)) {
    score += 0.3;
    markers++;
    reasons.push("_links point to /pts/v2/ resources");
  }
  const info = INFO_KEYS.filter((k) => isObj(input[k]));
  if (info.length > 0) {
    score += info.length > 1 ? 0.3 : 0.2;
    markers++;
    reasons.push(`has ${info.slice(0, 4).join(", ")}`);
  }
  // A status word alone is too generic to claim the record.
  if (markers === 0) return none;
  if (lookup(STATUSES, status)) {
    score += 0.15;
    reasons.push(`status "${status}" is a documented Cybersource status`);
  }
  const errorInfo = isObj(input.errorInformation) ? input.errorInformation : undefined;
  if (typeof errorInfo?.reason === "string" && lookup(REASONS, errorInfo.reason)) {
    score += 0.1;
    reasons.push("errorInformation.reason is a documented Cybersource reason");
  }
  if (typeof input.id === "string" && REQUEST_ID.test(input.id)) score += 0.05;
  if (httpStatus === 201) score += 0.05;
  return {
    ...base,
    format: "cybersource.payment_response",
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function detectWebhook(
  input: Record<string, unknown>,
  headers: Record<string, string>,
): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  const eventType = input.eventType as string;
  const trace = typeof input.transactionTraceId === "string";
  const product = typeof input.productId === "string";
  const org = typeof input.organizationId === "string";
  // webhookId, eventType and eventDate are shared with other gateways'
  // envelopes; at least one Cybersource-only key is required.
  if (!trace && !product && !org) return none;
  const reasons: string[] = [];
  let score = 0.2;
  if (lookup(WEBHOOK_EVENT_TYPES, eventType)) {
    score += 0.35;
    reasons.push(`eventType "${eventType}" is a documented Cybersource event type`);
  } else if (EVENT_TYPE.test(eventType)) {
    score += 0.1;
  }
  if (trace) {
    score += 0.2;
    reasons.push("has transactionTraceId");
  }
  if (product) {
    score += WEBHOOK_PRODUCTS.has(input.productId as string) ? 0.2 : 0.15;
    reasons.push("has productId");
  }
  if (org) score += 0.1;
  if (typeof input.webhookId === "string") score += 0.05;
  if (typeof input.eventDate === "string") score += 0.05;
  if ("payload" in input) score += 0.05;
  if (typeof input.requestType === "string" || typeof input.retryNumber === "number") score += 0.05;
  if (isObj(input.metadata) && "notificationTypeID" in input.metadata) score += 0.05;
  if (headers["v-c-transaction-trace-id"] || headers["v-c-event-type"]) {
    score += 0.15;
    reasons.push("has v-c- notification headers");
  }
  return {
    provider: PROVIDER,
    format: "cybersource.webhook",
    confidence: round(score),
    supported: true,
    reasons,
  };
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: CybersourceParsed } | { ok: false; issues: string[] } {
  const entry = FORMATS[format as keyof typeof FORMATS];
  if (!entry) return { ok: false, issues: [`Unsupported Cybersource format "${format}".`] };
  const res = entry[1].safeParse(input);
  if (!res.success) {
    return {
      ok: false,
      issues: res.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: res.data } as CybersourceParsed };
}

// ---------------------------------------------------------------------------
// Payments responses
// ---------------------------------------------------------------------------

type Operation =
  | "authorization"
  | "sale"
  | "payment"
  | "capture"
  | "reversal"
  | "refund"
  | "refund_or_credit"
  | "void"
  | "follow_on"
  | "unknown";

const COLLECTION_OPERATION: Record<string, Operation> = {
  captures: "capture",
  reversals: "reversal",
  refunds: "refund",
  credits: "refund_or_credit",
  voids: "void",
};

const PAYMENT_STATUSES = new Set([
  "AUTHORIZED",
  "PARTIAL_AUTHORIZED",
  "AUTHORIZED_PENDING_REVIEW",
  "AUTHORIZED_RISK_DECLINED",
  "PENDING_AUTHENTICATION",
  "PENDING_REVIEW",
  "DECLINED",
  "INVALID_REQUEST",
  "SERVER_ERROR",
]);

/** Which operation produced a 201 response, and from what it was inferred. */
function operationOf(v: PaymentFields): { op: Operation; source: string } {
  const links = isObj(v._links) ? v._links : {};
  const self = ptsResource(hrefOf(links.self));
  const voidLink = ptsResource(hrefOf(links.void));
  const authLinks =
    ptsResource(hrefOf(links.capture))?.action === "captures" ||
    ptsResource(hrefOf(links.authReversal))?.action === "reversals";
  if (self && !self.action) {
    if (self.collection === "payments") {
      if (authLinks) return { op: "authorization", source: "_links" };
      if (voidLink) return { op: "sale", source: "_links" };
      return { op: "payment", source: "_links.self" };
    }
    const op = lookup(COLLECTION_OPERATION, self.collection);
    if (op) return { op, source: "_links.self" };
  }
  if (authLinks) return { op: "authorization", source: "_links" };
  if (voidLink?.action === "voids") {
    if (voidLink.collection === "payments") return { op: "sale", source: "_links.void" };
    const op = lookup(COLLECTION_OPERATION, voidLink.collection);
    if (op && op !== "void") return { op, source: "_links.void" };
  }
  if (v.reversalAmountDetails) return { op: "reversal", source: "amount details" };
  if (v.voidAmountDetails) return { op: "void", source: "amount details" };
  if (v.creditAmountDetails) return { op: "refund_or_credit", source: "amount details" };
  if (v.status === "REVERSED") return { op: "reversal", source: "status" };
  if (v.status === "VOIDED" || v.status === "CANCELLED" || v.status === "FAILED")
    return { op: "void", source: "status" };
  if (v.status === "PENDING") return { op: "follow_on", source: "status" };
  if (PAYMENT_STATUSES.has(v.status)) return { op: "payment", source: "status" };
  return { op: "unknown", source: "status" };
}

const AUTH_STATUSES = new Set([
  "PENDING_AUTHENTICATION",
  "AUTHENTICATION_SUCCESSFUL",
  "AUTHENTICATION_FAILED",
]);

function stageOf(op: Operation, status: string): LifecycleStage {
  if (AUTH_STATUSES.has(status)) return "authentication";
  switch (op) {
    case "authorization":
      return "authorization";
    case "sale":
    case "payment":
      return "payment";
    case "capture":
      return "capture";
    case "reversal":
      return "reversal";
    case "refund":
    case "refund_or_credit":
      return "refund";
    case "void":
      return "void";
    default:
      return "other";
  }
}

const PAYMENT_OPS = new Set<Operation>(["authorization", "sale", "payment"]);

function amountOf(
  v: PaymentFields,
  op: Operation,
): { raw?: unknown; minor?: string; currency?: string } {
  const ad = v.orderInformation?.amountDetails ?? undefined;
  const currency = upperCurrency(ad?.currency);
  let raw: unknown;
  if (op === "reversal") raw = v.reversalAmountDetails?.reversedAmount ?? ad?.totalAmount;
  else if (op === "void") raw = v.voidAmountDetails?.voidAmount ?? ad?.totalAmount;
  else if (op === "refund" || op === "refund_or_credit")
    raw = v.creditAmountDetails?.creditAmount ?? ad?.totalAmount;
  else if (PAYMENT_OPS.has(op)) raw = ad?.authorizedAmount ?? ad?.totalAmount;
  else raw = ad?.totalAmount;
  raw = raw ?? undefined;
  const minor = currency ? decimalToMinor(raw, currency) : undefined;
  return {
    ...(raw !== undefined ? { raw } : {}),
    ...(minor ? { minor } : {}),
    ...(currency ? { currency } : {}),
  };
}

function decimalText(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : v;
  return typeof s === "string" && /^-?\d{1,30}(?:\.\d{1,10})?$/.test(s) ? s : undefined;
}

function processorAttrs(p: PaymentFields["processorInformation"]): [string, unknown][] {
  return [
    ["processorResponseCode", shortCode(p?.responseCode)],
    ["processorName", safeText(p?.name ?? undefined, 64)],
    ["processorResponseDetails", safeText(p?.responseDetails ?? undefined, 120)],
    ["avsCode", shortCode(p?.avs?.code, 2)],
    ["cvnResultCode", shortCode(p?.cardVerification?.resultCode, 2)],
    ["merchantAdviceCode", shortCode(p?.merchantAdvice?.code, 4)],
    ["merchantAdviceCodeRaw", shortCode(p?.merchantAdvice?.codeRaw, 8)],
  ];
}

function insightsOf(v: PaymentFields): { code?: string; category?: string } {
  const ri = v.paymentInsightsInformation?.responseInsights ?? undefined;
  const code = shortCode(ri?.categoryCode, 4);
  const category = upperCode(ri?.category);
  return { ...(code ? { code } : {}), ...(category ? { category } : {}) };
}

function normalizePayment(v: PaymentFields, ctx: NormalizeContext): NormalizedEventDraft {
  const { op, source } = operationOf(v);
  const statusEntry = lookup(STATUSES, v.status);
  const amount = amountOf(v, op);
  const id = requestId(v.id);
  const ad = v.orderInformation?.amountDetails ?? undefined;
  const partial =
    v.status === "PARTIAL_AUTHORIZED" && ad?.totalAmount !== undefined && amount.currency
      ? decimalToMinor(ad.totalAmount, amount.currency)
      : undefined;
  const insights = insightsOf(v);
  return clean({
    sourceFormat: ctx.format,
    eventType: `${op}.${safeText(v.status, 64) ?? "unknown"}`,
    eventTypeKnown: Boolean(statusEntry),
    stage: stageOf(op, v.status),
    providerStatus: safeText(v.status, 64),
    paymentReference: PAYMENT_OPS.has(op) ? id : undefined,
    relatedReference: PAYMENT_OPS.has(op) ? undefined : id,
    merchantReference: merchantRef(v.clientReferenceInformation?.code),
    eventTimestamp: toIsoTimestamp(v.submitTimeUtc),
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome: statusEntry?.outcome ?? "unknown",
    attributes: attrs([
      ["operation", op],
      ["operationInferredFrom", source],
      ["httpStatus", ctx.meta?.http?.status],
      ["reason", upperCode(v.errorInformation?.reason)],
      ["errorFields", detailFields(v.errorInformation?.details)],
      ...processorAttrs(v.processorInformation),
      ["paymentInsightsCategoryCode", insights.code],
      ["paymentInsightsCategory", insights.category],
      ["requestedAmountMinor", partial],
      ["amount", amount.minor ? undefined : decimalText(amount.raw)],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

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

/** Status-level guidance when a response carries no reason. */
const STATUS_FALLBACK: Record<
  string,
  { category: ErrorCategory; retry: RetryGuidance; confidence: Confidence }
> = {
  DECLINED: { category: "unknown", retry: "unknown", confidence: "insufficient" },
  INVALID_REQUEST: { category: "invalid_request", retry: "do_not_retry", confidence: "possible" },
  SERVER_ERROR: {
    category: "provider_unavailable",
    retry: "retry_conditionally",
    confidence: "possible",
  },
  AUTHORIZED_PENDING_REVIEW: {
    category: "fraud_or_risk",
    retry: "manual_review",
    confidence: "possible",
  },
  AUTHORIZED_RISK_DECLINED: {
    category: "fraud_or_risk",
    retry: "manual_review",
    confidence: "possible",
  },
  PENDING_AUTHENTICATION: {
    category: "authentication_required",
    retry: "customer_action_required",
    confidence: "possible",
  },
  PENDING_REVIEW: { category: "fraud_or_risk", retry: "manual_review", confidence: "possible" },
  FAILED: { category: "unknown", retry: "manual_review", confidence: "insufficient" },
  REJECTED: { category: "fraud_or_risk", retry: "manual_review", confidence: "possible" },
  CHALLENGE: { category: "fraud_or_risk", retry: "manual_review", confidence: "possible" },
  AUTHENTICATION_FAILED: {
    category: "authentication_failed",
    retry: "customer_action_required",
    confidence: "possible",
  },
};

const RETRY_STRICTNESS: Record<RetryGuidance, number> = {
  unknown: -1,
  safe_to_retry_technical_request: 0,
  retry_conditionally: 1,
  manual_review: 2,
  customer_action_required: 3,
  do_not_retry: 4,
};

const stricter = (a: RetryGuidance, b: RetryGuidance) =>
  RETRY_STRICTNESS[b] > RETRY_STRICTNESS[a] ? b : a;

type ReasonInput = {
  reason?: string;
  status: string;
  message?: string | null;
  details?: readonly DetailFields[] | null;
  httpStatus?: number;
  insights?: { code?: string; category?: string };
  adviceCode?: string;
  processorCode?: string;
  loc: Location;
};

/** Decodes a REST `reason` (201 errorInformation.reason, or top-level on 400 and 502). */
export function decodeReason(input: ReasonInput): DecodedErrorDraft {
  const { reason, status } = input;
  const entry = reason ? lookup(REASONS, reason) : undefined;
  const statusEntry = lookup(STATUSES, status);
  const missing: string[] = [];
  const docs: DocumentationLink[] = [
    { title: "Cybersource transaction response codes", url: RESPONSE_CODES_URL },
  ];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let explanation: string;
  const retryParts: string[] = [];

  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = entry.confidence;
    explanation = `Reason ${reason}: ${entry.meaning}.`;
    if (entry.note) explanation += ` ${entry.note}`;
    if (entry.source === "s")
      explanation +=
        " This value appears only as an enum name in the OpenAPI specification, without a description.";
    if (entry.action) retryParts.push(`Cybersource: ${entry.action}`);
  } else {
    const fallback = lookup(STATUS_FALLBACK, status);
    category = fallback?.category ?? "unknown";
    retry = fallback?.retry ?? "unknown";
    confidence = reason ? "insufficient" : (fallback?.confidence ?? "insufficient");
    explanation = reason
      ? `Reason "${reason}" is not in the documented Cybersource status and reason tables.`
      : `The response has status ${status} but no reason.`;
    if (statusEntry) explanation += ` Status ${status}: ${statusEntry.meaning}.`;
    missing.push(
      reason
        ? `Reason "${reason}" is not in the PandaPayLens catalog; Cybersource says new reasons can be added at any time.`
        : "No reason was supplied, so only the status is known.",
    );
    if (reason) category = "unknown";
    if (reason && status === "SERVER_ERROR") retry = "retry_conditionally";
    else if (reason) retry = "unknown";
  }

  const subCodes: Record<string, string> = { status: safeText(status, 64) ?? "" };
  if (input.httpStatus !== undefined) subCodes.http_status = String(input.httpStatus);
  if (input.processorCode) subCodes.processor_response_code = input.processorCode;
  const fields = detailFields(input.details);
  if (fields.length) {
    subCodes.fields = fields.join(", ");
    explanation += ` Fields: ${fields.join(", ")}.`;
  }

  // Cybersource's payment insights and the card networks' merchant advice
  // are retry signals for declines only. The documented example of a
  // successful authorization also carries an insights category.
  const declined = status === "DECLINED";
  const ins = input.insights;
  if (ins?.code) subCodes.payment_insights_category_code = ins.code;
  if (ins?.category) subCodes.payment_insights_category = ins.category;
  const insEntry = ins?.code ? lookup(PAYMENT_INSIGHTS, ins.code) : undefined;
  if (declined && insEntry) {
    retry = insEntry.retry;
    retryParts.push(
      `Payment insights category ${ins!.code} (${insEntry.category}): ${
        insEntry.retry === "do_not_retry"
          ? "the issuer will never approve this transaction."
          : PAYMENT_INSIGHTS_RETRY_TEXT
      }`,
    );
    docs.push({
      title: "Cybersource payments guide: declined authorizations",
      url: PAYMENTS_GUIDE_URL,
    });
  } else if (declined && ins?.code) {
    missing.push(`Payment insights category "${ins.code}" is not documented.`);
  }
  const advice = input.adviceCode ? lookup(MERCHANT_ADVICE_CODES, input.adviceCode) : undefined;
  if (input.adviceCode) subCodes.merchant_advice_code = input.adviceCode;
  if (declined && advice && advice.retry !== "unknown") {
    const before = retry;
    retry = retry === "unknown" ? advice.retry : stricter(retry, advice.retry);
    retryParts.push(
      `${advice.network} merchant advice code ${input.adviceCode}: ${advice.meaning}.${
        retry !== before ? " This stricter guidance is used." : ""
      }`,
    );
  } else if (declined && input.adviceCode && !advice) {
    missing.push(`Merchant advice code "${input.adviceCode}" is not documented.`);
  }

  const outcomeUnknown = entry?.outcomeUnknown === true || status === "SERVER_ERROR";
  if (outcomeUnknown) {
    // Never present a retry as safe while the original outcome is unknown.
    if (retry !== "do_not_retry") retry = "retry_conditionally";
    docs.push({ title: "Cybersource payments guide: timeout scenarios", url: PAYMENTS_GUIDE_URL });
    docs.push({ title: "Cybersource Transaction Search and Details", url: TXN_SEARCH_URL });
  }
  retryParts.push(RETRY_TEXT[retry]);
  if (!input.loc.paymentReference)
    missing.push(
      "No request id; the later state of this transaction cannot be checked from this record.",
    );

  const message = safeText(input.message ?? undefined, 300);
  return {
    ...withRefs(input.loc),
    code: reason ?? safeText(status, 64) ?? "unknown",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: [...new Set(retryParts)].join(" "),
    confidence,
    documentation: [...new Map(docs.map((d) => [d.url + d.title, d])).values()],
    missingInformation: missing,
    outcomeKnown: !outcomeUnknown,
  };
}

/** Decodes a numeric reason code from Transaction Details. */
export function decodeNumericCode(
  code: string,
  extra: { rFlag?: string; rMessage?: string; application?: string; loc: Location },
): DecodedErrorDraft {
  const listed = lookup(NUMERIC_REASON_CODES, code);
  const cited = listed ? undefined : lookup(CITED_NUMERIC_CODES, code);
  const entry: NumericCodeEntry | undefined = listed ?? cited;
  const missing: string[] = [];
  let explanation: string;
  let confidence: Confidence;
  if (entry) {
    explanation = `Reason code ${code}: ${entry.meaning}.`;
    confidence = listed ? "strong" : "possible";
  } else {
    explanation = `Reason code ${code} is not in the documented reason code table.`;
    confidence = "insufficient";
    missing.push(`Reason code "${code}" is not in the PandaPayLens catalog.`);
  }
  let retry = entry?.retry ?? "unknown";
  const outcomeUnknown = entry?.outcomeUnknown === true;
  if (outcomeUnknown && retry !== "do_not_retry") retry = "retry_conditionally";
  const category = entry?.category ?? "unknown";
  const subCodes: Record<string, string> = {};
  if (extra.application) subCodes.application = extra.application;
  if (extra.rFlag) subCodes.r_flag = extra.rFlag;
  const message = safeText(extra.rMessage, 300);
  return {
    ...withRefs(extra.loc),
    code,
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence,
    documentation: [
      { title: "Cybersource reason codes", url: REASON_CODES_URL },
      { title: "Cybersource Transaction Search and Details", url: TXN_SEARCH_URL },
    ],
    missingInformation: missing,
    outcomeKnown: !outcomeUnknown && entry !== undefined,
  };
}

// ---------------------------------------------------------------------------
// Webhooks and Pay by Bank payloads
// ---------------------------------------------------------------------------

function payByBankOf(payload: unknown): PayByBankFields | undefined {
  if (!isObj(payload) || !PAY_BY_BANK_KEYS.some((k) => k in payload)) return undefined;
  const res = PayByBankPayload.safeParse(payload);
  return res.success ? res.data : undefined;
}

function payByBankFacts(p: PayByBankFields) {
  const status = p.status.toUpperCase();
  const info = lookup(PAY_BY_BANK_STATUSES, status);
  const currency = upperCurrency(p["orderInformation.amountDetails.currency"]);
  const raw = p["orderInformation.amountDetails.totalAmount"] ?? undefined;
  const minor = currency ? decimalToMinor(raw, currency) : undefined;
  return {
    status,
    info,
    paymentReference: requestId(p.id),
    merchantReference: merchantRef(p["clientReferenceInformation.code"]),
    eventTimestamp: toIsoTimestamp(p.submitTimeUTC),
    amountMinor: minor,
    currency,
    amount: minor ? undefined : decimalText(raw),
  };
}

function payloadFormat(payload: unknown): string {
  if (payload === undefined || payload === null) return "missing";
  if (typeof payload === "string")
    return payload.startsWith("{CBC}") ? "cbc_prefixed" : JWE.test(payload) ? "jwe" : "string";
  return isObj(payload) ? "object" : "other";
}

function normalizeWebhook(w: z.infer<typeof Webhook>, ctx: NormalizeContext): NormalizedEventDraft {
  const info = lookup(WEBHOOK_EVENT_TYPES, w.eventType);
  const format = payloadFormat(w.payload);
  const encrypted = typeof w.payload === "string";
  const pbb = payByBankOf(w.payload);
  const facts = pbb ? payByBankFacts(pbb) : undefined;
  const headers = ctx.meta?.http?.headers ?? {};
  const headerRetry = Number.parseInt(headers["v-c-retry-count"] ?? "", 10);
  const retryNumber =
    w.retryNumber ?? (Number.isSafeInteger(headerRetry) ? headerRetry : undefined);
  const productId = safeId(w.productId, 64);
  const data = isObj(w.payload) && isObj(w.payload.data) ? w.payload.data : undefined;
  const eventType = safeText(w.eventType, 128) ?? "unknown";
  // The delivery fingerprint covers the payload or ciphertext, so different
  // events with the same type and second are not merged; transactionTraceId
  // changes on every retry and is left out.
  const deliveryKey =
    w.payload === undefined || w.payload === null
      ? undefined
      : `${eventType}:${fingerprint([w.webhookId ?? null, w.eventType, w.eventDate ?? null, w.payload])}`;
  const stage = facts?.info?.stage ?? info?.stage ?? "other";
  const outcome = facts?.info?.outcome ?? info?.outcome ?? "unknown";
  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: Boolean(info),
    stage,
    providerStatus: facts?.status ? safeText(facts.status, 32) : undefined,
    eventReference: safeId(w.transactionTraceId),
    deliveryKey,
    paymentReference: facts?.paymentReference,
    merchantReference: facts?.merchantReference,
    isRecurring: info?.recurring,
    eventTimestamp: toIsoTimestamp(w.eventDate) ?? facts?.eventTimestamp,
    amountMinor: facts?.amountMinor,
    currency: facts?.currency,
    outcome,
    attributes: attrs([
      ["productId", productId],
      ["productKnown", productId ? WEBHOOK_PRODUCTS.has(productId) : undefined],
      ["eventDate", safeText(w.eventDate ?? undefined, 40)],
      ["requestType", safeId(w.requestType ?? headers["v-c-request-type"], 32)],
      ["retryNumber", retryNumber],
      ["payloadFormat", format],
      ["payloadEncrypted", encrypted],
      ["payloadEncryptionRequired", productId ? ENCRYPTED_PRODUCTS.has(productId) : undefined],
      ["documentedStatuses", info?.statuses ? [...info.statuses] : undefined],
      ["notificationTypeId", shortCode(w.metadata?.notificationTypeID, 16)],
      ["notificationReason", safeId(w.metadata?.notificationReason, 64)],
      ["payloadDataType", data ? safeId(data.type, 64) : undefined],
      ["amount", facts?.amount],
      ["signatureHeaderPresent", ctx.meta?.http ? "v-c-signature" in headers : undefined],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizePayByBank(p: PayByBankFields, ctx: NormalizeContext): NormalizedEventDraft {
  const f = payByBankFacts(p);
  return clean({
    sourceFormat: ctx.format,
    eventType: `pay_by_bank.${safeText(f.status, 32) ?? "unknown"}`,
    eventTypeKnown: Boolean(f.info),
    stage: f.info?.stage ?? "payment",
    providerStatus: safeText(p.status, 32),
    paymentReference: f.paymentReference,
    merchantReference: f.merchantReference,
    eventTimestamp: f.eventTimestamp,
    amountMinor: f.amountMinor,
    currency: f.currency,
    outcome: f.info?.outcome ?? "unknown",
    attributes: attrs([["amount", f.amount]]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

// ---------------------------------------------------------------------------
// Transaction Details
// ---------------------------------------------------------------------------

const STAGE_PRIORITY = ["ics_auth_reversal", "ics_void", "ics_credit", "ics_auth"] as const;

function normalizeTransactionDetails(
  t: z.infer<typeof TransactionDetails>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const ai = t.applicationInformation;
  const names = (ai.applications ?? [])
    .map((a) => (ICS_NAME.test(a.name) ? a.name : undefined))
    .filter((x): x is string => Boolean(x));
  const main = STAGE_PRIORITY.find((n) => names.includes(n)) ?? names[0];
  const mainInfo = main ? lookup(APPLICATION_NAMES, main) : undefined;
  const rc = rCodeOf(ai.rCode);
  const reasonCode = numericCode(ai.reasonCode);
  let outcome: Outcome = rc ? (lookup(R_CODES, rc)?.outcome ?? "unknown") : "unknown";
  if (!rc && reasonCode) {
    const e = lookup(NUMERIC_REASON_CODES, reasonCode);
    if (e) outcome = e.kind === "error" ? (e.outcomeUnknown ? "unknown" : "failure") : "success";
  }
  const id = requestId(t.id);
  const root = requestId(t.rootId);
  return clean({
    sourceFormat: ctx.format,
    eventType: `transaction_details.${main ?? "unknown"}`,
    eventTypeKnown: Boolean(mainInfo),
    stage: mainInfo?.stage ?? "other",
    providerStatus: safeText(ai.status ?? undefined, 64) ?? reasonCode,
    paymentReference: root ?? (main === "ics_auth" ? id : undefined),
    relatedReference: id,
    merchantReference: merchantRef(t.clientReferenceInformation?.code),
    eventTimestamp: toIsoTimestamp(t.submitTimeUTC),
    outcome,
    attributes: attrs([
      ["applications", names],
      [
        "applicationReasonCodes",
        (ai.applications ?? []).map((a) => numericCode(a.reasonCode) ?? ""),
      ],
      ["reasonCode", reasonCode],
      ["rCode", rc],
      ["rFlag", safeId(ai.rFlag, 32)],
      ["relatedTransactionIds", relatedTransactionIds(t._links)],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

// ---------------------------------------------------------------------------
// Adapter entry points
// ---------------------------------------------------------------------------

function normalize(parsed: CybersourceParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  switch (parsed.kind) {
    case "payment_response":
      return [normalizePayment(parsed.value, ctx)];
    case "webhook":
      return [normalizeWebhook(parsed.value, ctx)];
    case "transaction_details":
      return [normalizeTransactionDetails(parsed.value, ctx)];
    case "pay_by_bank_payload":
      return [normalizePayByBank(parsed.value, ctx)];
    case "error_response": {
      const e = parsed.value;
      const reason = upperCode(e.reason);
      const entry = reason ? lookup(REASONS, reason) : undefined;
      const unknownOutcome = e.status === "SERVER_ERROR" || entry?.outcomeUnknown === true;
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `error.${reason ?? "unknown"}`,
          eventTypeKnown: Boolean(entry),
          stage: "error",
          providerStatus: safeText(e.status, 64),
          relatedReference: requestId(e.id),
          eventTimestamp: toIsoTimestamp(e.submitTimeUtc),
          outcome: unknownOutcome ? "unknown" : "failure",
          attributes: attrs([
            ["reason", reason],
            ["httpStatus", ctx.meta?.http?.status],
            ["errorFields", detailFields(e.details)],
          ]),
          source,
          ...observed,
        }),
      ];
    }
  }
}

/** Statuses of a 201 response that carry a reason worth decoding. */
const DECODED_STATUSES = new Set(Object.keys(STATUS_FALLBACK));

const WEBHOOK_FAILURE_STAGES = new Set<LifecycleStage>([
  "payment",
  "authorization",
  "capture",
  "refund",
  "void",
  "reversal",
]);

function decodeErrors(parsed: CybersourceParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const httpStatus = ctx.meta?.http?.status;

  if (parsed.kind === "payment_response") {
    const v = parsed.value;
    const reason = upperCode(v.errorInformation?.reason);
    if (!DECODED_STATUSES.has(v.status) && !(reason && !lookup(STATUSES, v.status))) return [];
    const id = requestId(v.id);
    return [
      decodeReason({
        ...(reason ? { reason } : {}),
        status: v.status,
        message: v.errorInformation?.message,
        details: v.errorInformation?.details,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        insights: insightsOf(v),
        ...(shortCode(v.processorInformation?.merchantAdvice?.code, 4)
          ? { adviceCode: shortCode(v.processorInformation?.merchantAdvice?.code, 4)! }
          : {}),
        ...(shortCode(v.processorInformation?.responseCode)
          ? { processorCode: shortCode(v.processorInformation?.responseCode)! }
          : {}),
        loc: {
          sourceFormat: ctx.format,
          source: reason ? { ...source, path: "errorInformation" } : source,
          ...(id ? { paymentReference: id, attemptReference: id } : {}),
        },
      }),
    ];
  }

  if (parsed.kind === "error_response") {
    const e = parsed.value;
    const reason = upperCode(e.reason);
    const id = requestId(e.id);
    return [
      decodeReason({
        ...(reason ? { reason } : {}),
        status: e.status,
        message: e.message,
        details: e.details,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        loc: {
          sourceFormat: ctx.format,
          source,
          ...(id ? { paymentReference: id, attemptReference: id } : {}),
        },
      }),
    ];
  }

  if (parsed.kind === "transaction_details") {
    const t = parsed.value;
    const ai = t.applicationInformation;
    const id = requestId(t.id);
    const ref = requestId(t.rootId) ?? id;
    const loc = (path: string): Location => ({
      sourceFormat: ctx.format,
      source: { ...source, path },
      ...(ref ? { paymentReference: ref } : {}),
      ...(id ? { attemptReference: id } : {}),
    });
    const isError = (code: string | undefined) =>
      code !== undefined &&
      lookup(NUMERIC_REASON_CODES, code)?.kind !== "success" &&
      lookup(NUMERIC_REASON_CODES, code)?.kind !== "partial";
    const out: DecodedErrorDraft[] = [];
    (ai.applications ?? []).forEach((a, i) => {
      const code = numericCode(a.reasonCode);
      if (!isError(code)) return;
      out.push(
        decodeNumericCode(code!, {
          ...(safeId(a.rFlag, 32) ? { rFlag: safeId(a.rFlag, 32)! } : {}),
          ...(a.rMessage ? { rMessage: a.rMessage } : {}),
          ...(ICS_NAME.test(a.name) ? { application: a.name } : {}),
          loc: loc(`applicationInformation.applications[${i}]`),
        }),
      );
    });
    const top = numericCode(ai.reasonCode);
    if (out.length === 0 && isError(top)) {
      out.push(
        decodeNumericCode(top!, {
          ...(safeId(ai.rFlag, 32) ? { rFlag: safeId(ai.rFlag, 32)! } : {}),
          loc: loc("applicationInformation"),
        }),
      );
    }
    return out;
  }

  if (parsed.kind === "webhook") {
    const w = parsed.value;
    const info = lookup(WEBHOOK_EVENT_TYPES, w.eventType);
    const pbb = payByBankOf(w.payload);
    const outcome = pbb
      ? lookup(PAY_BY_BANK_STATUSES, pbb.status.toUpperCase())?.outcome
      : info?.outcome;
    if (!info || outcome !== "failure" || !WEBHOOK_FAILURE_STAGES.has(info.stage)) return [];
    const encrypted = typeof w.payload === "string";
    const statuses = info.statuses?.length
      ? ` The event table lists these statuses for it: ${info.statuses.join(", ")}.`
      : "";
    const why = encrypted
      ? "The reason is inside the encrypted payload and cannot be read offline."
      : "The notification carries no documented reason field.";
    const ref = pbb ? requestId(pbb.id) : undefined;
    return [
      {
        sourceFormat: ctx.format,
        source: { ...source, path: "" },
        ...(ref ? { paymentReference: ref } : {}),
        code: safeText(w.eventType, 128) ?? "unknown",
        subCodes: safeId(w.productId, 64) ? { product: safeId(w.productId, 64)! } : {},
        category: "unknown",
        explanation: `The notification reports a failed or rejected ${info.stage}.${statuses} ${why}${
          info.note ? ` ${info.note}` : ""
        }`,
        nextAction: NEXT_ACTION.unknown,
        retry: "unknown",
        retryExplanation:
          "The notification does not say why the operation failed, and a rejection can also stand for a timeout. Check the transaction with Transaction Details before any new attempt.",
        confidence: "insufficient",
        documentation: [
          { title: "Cybersource Webhooks Implementation Guide", url: WEBHOOKS_URL },
          ...(pbb
            ? [{ title: "Cybersource Pay by Bank webhooks", url: PAY_BY_BANK_WEBHOOK_URL }]
            : []),
        ],
        missingInformation: [
          encrypted
            ? "Decrypt the payload, or retrieve the transaction with Transaction Details, to see the reason."
            : "Retrieve the transaction with Transaction Details to see the reason.",
        ],
      },
    ];
  }

  return [];
}

export const cybersourceAdapter: ProviderAdapter<CybersourceParsed> = {
  id: PROVIDER,
  displayName: "Cybersource",
  version: CYBERSOURCE_ADAPTER_VERSION,
  manifest: cybersourceManifest,
  supportedFormats: [
    {
      id: "cybersource.payment_response",
      description:
        "REST Payments API v2 HTTP 201 response (authorization, sale, capture, reversal, refund, credit, void)",
    },
    {
      id: "cybersource.error_response",
      description: "REST HTTP 400 or 502 error body (status, reason, message, details[])",
    },
    {
      id: "cybersource.webhook",
      description: "Webhook notification envelope, version 3 (eventType, productId, payload)",
    },
    {
      id: "cybersource.transaction_details",
      description: "Transaction Details response (rootId, applicationInformation)",
    },
    {
      id: "cybersource.pay_by_bank_payload",
      description: "Decrypted Pay by Bank notification payload (dotted keys)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // The request id of a payment links its incremental authorizations and
    // its Transaction Details record; rootId and relatedTransactions links in
    // Transaction Details link follow-on operations to the payment. The
    // merchant reference can be reused across attempts and is never a key.
    const related = event.attributes.relatedTransactionIds;
    const extra = Array.isArray(related)
      ? related.filter((x): x is string => typeof x === "string" && x !== "")
      : [];
    return [
      ...new Set(
        [event.paymentReference, event.relatedReference, ...extra].filter((x): x is string =>
          Boolean(x),
        ),
      ),
    ];
  },
};

export * from "./catalog.js";
export default cybersourceAdapter;
