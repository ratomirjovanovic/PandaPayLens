/**
 * BlueSnap adapter (Payment API JSON and webhooks).
 *
 * Supported input families:
 * - `bluesnap.card_transaction`  Payment API card transaction response
 *                                (cardTransactionType, transactionId, processingInfo.processingStatus),
 *                                including the refunds and chargebacks lists of a retrieved transaction
 * - `bluesnap.refund`            refund response (refundTransactionId, refundStatus)
 * - `bluesnap.error`             error body { message: [{ errorName, code, description,
 *                                invalidProperty, fraudEvents }] }
 * - `bluesnap.webhook`           form-encoded webhook (IPN) named by transactionType
 * - `bluesnap.throttling`        HTTP 429 or 503 with one of the documented plain-text messages
 *
 * Recognized but not analyzed: alt transaction responses (`bluesnap.alt_transaction`).
 * The XML Payment API and the Extended Payment API never reach the adapter
 * (XML input is rejected before detection).
 *
 * BlueSnap's numeric error code is a group, not a reason (37 card error names
 * share 14002), so every error is decoded by errorName first. Webhooks carry no
 * event id and no timestamp with a time zone.
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
  ACH_RETURN_CODES,
  ACH_URL,
  AVS_CODES,
  CARD_BRANDS,
  CARD_TRANSACTION_ERRORS,
  CARD_TRANSACTION_TYPES,
  CHARGEBACK_CYCLES,
  CHARGEBACK_STATUSES,
  CVV_CODES,
  DATA_CENTER_NODES,
  DECLINES_GUIDE_URL,
  ERROR_HANDLING_URL,
  ERRORS_BY_CODE,
  ERRORS_BY_NAME,
  FRAUD_DECISIONS,
  FRAUD_EVENT_CODES,
  FRAUD_EVENT_URL,
  NEXT_ACTION,
  PROCESSING_STATUSES,
  REFUND_STATUSES,
  RETRY_TEXT,
  THREE_DS_RESULTS,
  THROTTLING_MESSAGES,
  TRANSACTION_REGIONS,
  UNDESCRIBED_WEBHOOK_TYPES,
  WEBHOOK_NAMES_URL,
  WEBHOOK_PARAMETERS_URL,
  WEBHOOK_TYPES,
  type ErrorRow,
  type IndexedRow,
  type WebhookInfo,
} from "./catalog.js";
import { bluesnapManifest, BLUESNAP_ADAPTER_VERSION } from "./manifest.js";

export { bluesnapManifest, BLUESNAP_ADAPTER_VERSION };

const PROVIDER = "bluesnap";

export const BLUESNAP_FORMATS = {
  cardTransaction: "bluesnap.card_transaction",
  refund: "bluesnap.refund",
  error: "bluesnap.error",
  webhook: "bluesnap.webhook",
  throttling: "bluesnap.throttling",
  altTransaction: "bluesnap.alt_transaction",
} as const;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

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

/** First value of a form field (repeated keys arrive as lists). */
function field(o: Obj, key: string): string | undefined {
  const v = o[key];
  if (Array.isArray(v)) return str(v[0]);
  return str(v);
}

/** A form field that is present and not empty. */
function filled(o: Obj, key: string): string | undefined {
  const v = field(o, key)?.trim();
  return v ? v : undefined;
}

/**
 * BlueSnap IDs are documented as numbers but arrive as strings or numbers.
 * Numbers beyond 2^53 have lost precision and are dropped. Values that look
 * like personal data are dropped too.
 */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? String(v) : undefined;
  const id = safeId(typeof v === "string" ? v.trim() : v, 128);
  return id && safeText(id, 128) === id ? id : undefined;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  return idOf(v);
}

/** Error codes: integers in the JSON docs, strings in the XSD and the batch example. */
function intCode(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  if (typeof v === "string" && /^\d{1,9}$/.test(v.trim())) return v.trim();
  return undefined;
}

/** Short enum-like values only, never free text. */
function word(v: unknown, max = 40): string | undefined {
  const t = str(v)?.trim();
  return t && t.length <= max && /^[A-Za-z0-9_.+/-]+$/.test(t) ? t : undefined;
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const APPROVAL_DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const APPROVAL_TIME = /^\d{2}:\d{2}:\d{2}$/;
const WEBHOOK_DATE = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MD5_HEX = /^[0-9a-f]{32}$/i;
const ALT_KEYS = [
  "ecpTransaction",
  "sepaDirectDebitTransaction",
  "paypalTransaction",
  "becsDirectDebitTransaction",
  "acssDirectDebitTransaction",
] as const;

const round = (n: number) => Math.round(Math.min(0.95, n) * 100) / 100;

/**
 * The webhook name is sent in transactionType. The parameter reference shows
 * display names ("Charge", "Fraud Decline") where the name reference and the
 * examples use upper snake case (CHARGE); both map to the same name.
 */
export function webhookName(type: string): string {
  const t = type.trim();
  if (UPPER_SNAKE.test(t)) return t;
  return /^[A-Za-z][A-Za-z0-9 ]{0,60}$/.test(t) ? t.toUpperCase().replace(/ +/g, "_") : t;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

type Detected = Omit<DetectionResult, "provider">;

function detectWebhook(o: Obj, meta: RecordMeta | undefined): Detected | null {
  const raw = filled(o, "transactionType");
  if (!raw) return null;
  const name = webhookName(raw);
  const known = lookup(WEBHOOK_TYPES, name) !== undefined || UNDESCRIBED_WEBHOOK_TYPES.has(name);
  if (!known && !UPPER_SNAKE.test(name)) return null;

  const node = (k: string) => lookup(DATA_CENTER_NODES, filled(o, k)) !== undefined;
  const anchors: string[] = [];
  if (node("bluesnapNode")) anchors.push("bluesnapNode is 1, 2 or 99");
  if (node("plimusNode")) anchors.push("plimusNode is 1, 2 or 99");
  if (filled(o, "referenceNumber") && filled(o, "contractId"))
    anchors.push("has referenceNumber with contractId");
  if (field(o, "invoiceAmountUSD") !== undefined) anchors.push("has invoiceAmountUSD");
  const hasRef = filled(o, "referenceNumber") !== undefined;
  // transactionType alone is shared with other form posts (Nuvei uses it too).
  if (anchors.length === 0 && (!known || !hasRef)) return null;

  const reasons = [
    known
      ? `transactionType "${safeText(raw, 64)}" is a documented BlueSnap webhook name`
      : "transactionType is upper snake case",
    ...anchors,
  ];
  let c = known ? 0.3 : 0.15;
  c += anchors.length >= 2 ? 0.45 : anchors.length === 1 ? 0.2 : 0;
  if (hasRef) {
    c += 0.1;
    reasons.push("has referenceNumber");
  }
  if (field(o, "targetBalance") === "BLUESNAP_ACCOUNT") c += 0.05;
  if ("authKey" in o || "authkey" in o) {
    c += 0.05;
    reasons.push("has authKey");
  }
  if (WEBHOOK_DATE.test(field(o, "transactionDate") ?? "")) c += 0.05;
  const headers = meta?.http?.headers;
  if (
    headers &&
    (headers["bls-signature"] !== undefined || headers["bls-ipn-timestamp"] !== undefined)
  ) {
    c += 0.05;
    reasons.push("has a Bls-Signature or Bls-Ipn-Timestamp header");
  }
  if (anchors.length === 0) c = Math.min(c, 0.45);
  return { format: BLUESNAP_FORMATS.webhook, confidence: round(c), supported: true, reasons };
}

function detectError(o: Obj, meta: RecordMeta | undefined): Detected | null {
  const m = o.message;
  if (!Array.isArray(m) || m.length === 0 || m.length > 200) return null;
  if (!m.every((x) => isObj(x) && typeof x.errorName === "string" && UPPER_SNAKE.test(x.errorName)))
    return null;
  const items = m as Obj[];
  const reasons = ["message is an array of objects with an upper snake case errorName"];
  let c = 0.45;
  if (items.some((x) => intCode(x.code) !== undefined)) {
    c += 0.15;
    reasons.push("message items carry a numeric code");
  }
  if (items.some((x) => typeof x.description === "string")) c += 0.1;
  if (items.some((x) => ERRORS_BY_NAME.has(x.errorName as string))) {
    c += 0.2;
    reasons.push("errorName is a documented BlueSnap error name");
  }
  if (items.some((x) => isObj(x.invalidProperty) || isObj(x.fraudEvents))) {
    c += 0.05;
    reasons.push("has invalidProperty or fraudEvents");
  }
  if ((meta?.http?.status ?? 0) >= 400) c += 0.05;
  // Without a code the shape is generic enough to stay at the threshold.
  if (!items.some((x) => intCode(x.code) !== undefined)) c = Math.min(c, 0.5);
  return { format: BLUESNAP_FORMATS.error, confidence: round(c), supported: true, reasons };
}

function detectCardTransaction(o: Obj): Detected | null {
  const t = str(o.cardTransactionType);
  if (t === undefined) return null;
  const known = lookup(CARD_TRANSACTION_TYPES, t) !== undefined;
  if (!known && !UPPER_SNAKE.test(t)) return null;
  const reasons = [
    known
      ? `cardTransactionType "${t}" is a documented BlueSnap value`
      : "has cardTransactionType (not a documented value)",
  ];
  let c = known ? 0.4 : 0.2;
  const id = idOf(o.transactionId) !== undefined;
  const pi = isObj(o.processingInfo) ? o.processingInfo : undefined;
  const status = pi && typeof pi.processingStatus === "string";
  if (id) {
    c += 0.15;
    reasons.push("has transactionId");
  }
  if (status) {
    c += 0.2;
    reasons.push("has processingInfo.processingStatus");
  } else if (pi) c += 0.1;
  if (APPROVAL_DATE.test(str(o.transactionApprovalDate) ?? "")) {
    c += 0.05;
    reasons.push("transactionApprovalDate is MM/DD/YYYY");
  }
  if (["usdAmount", "vaultedShopperId", "openToCapture", "softDescriptor"].some((k) => k in o))
    c += 0.05;
  if (isObj(o.creditCard) || isObj(o.fraudResultInfo)) c += 0.05;
  if (!id && !status) c = Math.min(c, 0.45);
  return {
    format: BLUESNAP_FORMATS.cardTransaction,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectRefund(o: Obj): Detected | null {
  if (idOf(o.refundTransactionId) === undefined) return null;
  const reasons = ["has refundTransactionId"];
  let c = 0.45;
  const status = str(o.refundStatus);
  if (status && lookup(REFUND_STATUSES, status)) {
    c += 0.2;
    reasons.push("refundStatus is SUCCESS or PENDING");
  }
  if (typeof o.cancelSubscriptions === "boolean") {
    c += 0.1;
    reasons.push("has cancelSubscriptions");
  }
  if ("vendorAmount" in o || "taxAmount" in o) c += 0.05;
  return { format: BLUESNAP_FORMATS.refund, confidence: round(c), supported: true, reasons };
}

function detectAltTransaction(o: Obj): Detected | null {
  const key = ALT_KEYS.find((k) => isObj(o[k]));
  const pi = isObj(o.processingInfo) ? o.processingInfo : undefined;
  if (!key || !pi || typeof pi.processingStatus !== "string") return null;
  let c = 0.55;
  if (isObj(o.payerInfo) || "vaultedShopperId" in o) c += 0.05;
  if (idOf(o.transactionId)) c += 0.05;
  return {
    format: BLUESNAP_FORMATS.altTransaction,
    confidence: round(c),
    supported: false,
    reasons: [`has ${key} with processingInfo.processingStatus`],
    unsupportedReason:
      "This looks like a BlueSnap alt transaction response (ACH/ECP, SEPA, PayPal, BECS or Pre-Authorized Debit). It is recognized but not analyzed yet; the webhooks of the same transaction (CHARGE_PENDING, CHARGE, DECLINE, REFUND) are.",
  };
}

function throttlingMessage(meta: RecordMeta | undefined) {
  const status = meta?.http?.status;
  if (status !== 429 && status !== 503) return undefined;
  const text = meta?.http?.bodyText?.trim().replace(/\.$/, "").toLowerCase();
  const info = text ? lookup(THROTTLING_MESSAGES, text) : undefined;
  return info && text ? { status, text, info } : undefined;
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
  // Stripe payloads carry `object`; BlueSnap payloads never do.
  if ("object" in input) return none;
  let found: Detected | null = null;
  if (Object.keys(input).length === 0) {
    const t = throttlingMessage(meta);
    if (t)
      found = {
        format: BLUESNAP_FORMATS.throttling,
        confidence: 0.6,
        supported: true,
        reasons: [`HTTP ${t.status} with a documented BlueSnap throttling message`],
      };
  } else if (isFlatStrings(input)) {
    found = detectWebhook(input, meta);
  }
  if (!found && meta?.format !== "form" && Object.keys(input).length > 0) {
    found =
      detectError(input, meta) ??
      detectCardTransaction(input) ??
      detectRefund(input) ??
      detectAltTransaction(input);
  }
  return found ? { provider: PROVIDER, ...found } : none;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const Id = z.union([z.string().max(256), z.number()]);
const Amount = z.union([z.number(), z.string().max(64)]);
const Code = z.union([z.number().int(), z.string().max(32)]);
const Loose = z.looseObject({});

const CardTransaction = z.looseObject({
  cardTransactionType: z.string().max(64),
  transactionId: Id.optional(),
  originalTransactionId: Id.optional(),
  merchantTransactionId: Id.optional(),
  amount: Amount.optional(),
  usdAmount: Amount.optional(),
  currency: z.string().max(8).optional(),
  openToCapture: Amount.optional(),
  transactionApprovalDate: z.string().max(32).optional(),
  transactionApprovalTime: z.string().max(32).optional(),
  processingInfo: z.looseObject({ processingStatus: z.string().max(64).optional() }).optional(),
  creditCard: Loose.optional(),
  threeDSecure: Loose.optional(),
  refunds: Loose.optional(),
  chargebacks: Loose.optional(),
  fraudResultInfo: Loose.optional(),
});

const RefundResponse = z.looseObject({
  refundTransactionId: Id,
  refundStatus: z.string().max(32).optional(),
  amount: Amount.optional(),
  currency: z.string().max(8).optional(),
  date: z.string().max(32).optional(),
  cancelSubscriptions: z.union([z.boolean(), z.string().max(8)]).optional(),
});

const Message = z.looseObject({
  errorName: z.string().max(128).optional(),
  code: Code.optional(),
  description: z.string().optional(),
});

const ErrorBody = z.looseObject({ message: z.array(Message).min(1).max(200) });

const Webhook = z.looseObject({ transactionType: z.string().min(1).max(128) });

type CardTransactionFields = z.infer<typeof CardTransaction>;
type MessageFields = z.infer<typeof Message>;

export type BluesnapParsed =
  | { kind: "card_transaction"; value: CardTransactionFields }
  | { kind: "refund"; value: z.infer<typeof RefundResponse> }
  | { kind: "error"; value: z.infer<typeof ErrorBody> }
  | { kind: "webhook"; value: Obj }
  | { kind: "throttling"; value: Obj };

const FORMATS = {
  [BLUESNAP_FORMATS.cardTransaction]: ["card_transaction", CardTransaction],
  [BLUESNAP_FORMATS.refund]: ["refund", RefundResponse],
  [BLUESNAP_FORMATS.error]: ["error", ErrorBody],
  [BLUESNAP_FORMATS.webhook]: ["webhook", Webhook],
  [BLUESNAP_FORMATS.throttling]: ["throttling", Loose],
} as const;

function parse(
  input: unknown,
  format: string,
): { ok: true; value: BluesnapParsed } | { ok: false; issues: string[] } {
  const entry = lookup(FORMATS, format);
  if (!entry) return { ok: false, issues: [`Unsupported BlueSnap format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as BluesnapParsed };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type AttrValue = SafePrimitive | SafePrimitive[] | undefined;

function attrs(entries: [string, AttrValue][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (Array.isArray(v)) {
      if (v.length) out[k] = v.map((x) => (typeof x === "string" ? (safeText(x, 120) ?? "") : x));
    } else out[k] = v;
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, x]) => x !== undefined),
  ) as NormalizedEventDraft;
}

/** A documented code value, or "unrecognized" for anything else that is short. */
function documented(v: unknown, set: { has(k: string): boolean }): string | undefined {
  const w = word(v, 40);
  if (w === undefined) return undefined;
  return set.has(w) ? w : "unrecognized";
}

const keysOf = (r: Readonly<Record<string, unknown>>) => ({
  has: (k: string) => lookup(r, k) !== undefined,
});

/** API amounts are decimal major units, as numbers or strings. */
function apiAmount(v: unknown, currency: string | undefined): string | undefined {
  return currency ? decimalToMinor(v, currency) : undefined;
}

/** Webhook amounts use the #,###.## format. */
function webhookAmount(v: string | undefined, currency: string | undefined): string | undefined {
  const t = v?.trim();
  if (!t || !currency) return undefined;
  if (!/^-?(?:\d{1,3}(?:,\d{3})+|\d{1,30})(?:\.\d{1,10})?$/.test(t)) return undefined;
  return decimalToMinor(t.replace(/,/g, ""), currency);
}

const yesNo = (v: string | undefined) => (v === "Y" || v === "N" ? v : undefined);
const digits = (v: string | undefined) => (v && /^\d{1,6}$/.test(v.trim()) ? v.trim() : undefined);

function asList(v: unknown): Obj[] {
  if (Array.isArray(v)) return v.filter(isObj).slice(0, 500);
  return isObj(v) ? [v] : [];
}

function processingOutcome(status: string | undefined): Outcome {
  return (
    (status ? lookup(PROCESSING_STATUSES, status.toUpperCase())?.outcome : undefined) ?? "unknown"
  );
}

function normalizeCardTransaction(
  c: CardTransactionFields,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const t = c.cardTransactionType;
  const info = lookup(CARD_TRANSACTION_TYPES, t);
  const status = c.processingInfo?.processingStatus;
  const pi = c.processingInfo as Obj | undefined;
  const card = c.creditCard as Obj | undefined;
  const currency = upperCurrency(c.currency);
  const id = idOf(c.transactionId);
  const original = idOf(c.originalTransactionId);
  // A transaction retrieved by its refund ID carries the original transaction
  // in originalTransactionId; its own transactionId is then the refund's.
  const paymentReference = original ?? id;
  const relatedReference = original && id !== original ? id : undefined;
  const threeDs = isObj(c.threeDSecure) ? c.threeDSecure.authenticationResult : undefined;
  const refundsObj = c.refunds as Obj | undefined;
  const refundList = asList(refundsObj?.refund);
  const chargebackList = asList((c.chargebacks as Obj | undefined)?.chargeback);
  const name = safeText(t, 64) ?? "unknown";

  const events: NormalizedEventDraft[] = [
    clean({
      sourceFormat: ctx.format,
      eventType: `card_transaction.${name}`,
      eventTypeKnown: info !== undefined,
      stage: info?.stage ?? "payment",
      providerStatus: safeText(status, 64) ?? name,
      paymentReference,
      relatedReference,
      merchantReference: merchantRef(c.merchantTransactionId),
      // On a retrieved REFUND transaction, amount may be the original amount;
      // the refunds list carries the refunded amounts.
      amountMinor: t === "REFUND" ? undefined : apiAmount(c.amount, currency),
      currency,
      outcome: processingOutcome(status),
      attributes: attrs([
        ["cardTransactionType", name],
        ["processingStatus", safeText(status, 64)],
        ["httpStatus", ctx.meta?.http?.status],
        [
          "relatedReferenceKind",
          relatedReference ? (t === "REFUND" ? "refund" : "transaction") : undefined,
        ],
        ["cvvResponseCode", documented(pi?.cvvResponseCode, keysOf(CVV_CODES))],
        ["avsResponseCodeZip", documented(pi?.avsResponseCodeZip, keysOf(AVS_CODES))],
        ["avsResponseCodeAddress", documented(pi?.avsResponseCodeAddress, keysOf(AVS_CODES))],
        ["avsResponseCodeName", documented(pi?.avsResponseCodeName, keysOf(AVS_CODES))],
        ["transactionRegion", documented(pi?.transactionRegion, TRANSACTION_REGIONS)],
        [
          "authorizationCodePresent",
          pi?.authorizationCode !== undefined && pi.authorizationCode !== "" ? true : undefined,
        ],
        [
          "supportsMultiPartialCapture",
          typeof pi?.supportsMultiPartialCapture === "boolean"
            ? pi.supportsMultiPartialCapture
            : undefined,
        ],
        ["cardBrand", documented(card?.cardType, CARD_BRANDS)],
        ["cardSubType", word(card?.cardSubType, 20)],
        ["binCategory", word(card?.binCategory, 20)],
        ["cardRegulated", word(card?.cardRegulated, 1)],
        [
          "issuingCountryCode",
          typeof card?.issuingCountryCode === "string" &&
          /^[A-Za-z]{2}$/.test(card.issuingCountryCode)
            ? card.issuingCountryCode.toUpperCase()
            : undefined,
        ],
        ["threeDSecureResult", documented(threeDs, THREE_DS_RESULTS)],
        ["openToCaptureMinor", apiAmount(c.openToCapture, currency)],
        ["usdAmountMinor", apiAmount(c.usdAmount, "USD")],
        [
          "approvalDateAsSent",
          APPROVAL_DATE.test(c.transactionApprovalDate ?? "")
            ? c.transactionApprovalDate
            : undefined,
        ],
        [
          "approvalTimePacific",
          APPROVAL_TIME.test(c.transactionApprovalTime ?? "")
            ? c.transactionApprovalTime
            : undefined,
        ],
        ["refundsBalanceMinor", apiAmount(refundsObj?.balanceAmount, currency)],
        ["refundCount", refundList.length || undefined],
        ["chargebackCount", chargebackList.length || undefined],
      ]),
      source,
      ...observed,
    }),
  ];

  refundList.forEach((r, i) => {
    const rs = str(r.refundStatus);
    const cur = upperCurrency(r.currency) ?? currency;
    const rid = idOf(r.refundTransactionId);
    events.push(
      clean({
        sourceFormat: ctx.format,
        eventType: "card_transaction.refund",
        eventTypeKnown: true,
        stage: "refund",
        providerStatus: safeText(rs, 32),
        paymentReference: original ?? id,
        relatedReference: rid,
        amountMinor: apiAmount(r.amount, cur),
        currency: cur,
        outcome: (rs ? lookup(REFUND_STATUSES, rs)?.outcome : undefined) ?? "unknown",
        attributes: attrs([
          ["refundStatus", safeText(rs, 32)],
          ["relatedReferenceKind", rid ? "refund" : undefined],
          ["refundDate", ISO_DATE.test(str(r.date) ?? "") ? str(r.date) : undefined],
        ]),
        source: { recordIndex: ctx.recordIndex, path: `refunds.refund[${i}]` },
        ...observed,
      }),
    );
  });

  chargebackList.forEach((cb, i) => {
    const cur = upperCurrency(cb.currency) ?? currency;
    const cid = idOf(cb.chargebackTransactionId);
    events.push(
      clean({
        sourceFormat: ctx.format,
        eventType: "card_transaction.chargeback",
        eventTypeKnown: true,
        stage: "dispute",
        paymentReference: original ?? id,
        relatedReference: cid,
        amountMinor: apiAmount(cb.amount, cur),
        currency: cur,
        // The API chargeback object has no status.
        outcome: "unknown",
        attributes: attrs([
          ["relatedReferenceKind", cid ? "chargeback" : undefined],
          ["chargebackDate", ISO_DATE.test(str(cb.date) ?? "") ? str(cb.date) : undefined],
        ]),
        source: { recordIndex: ctx.recordIndex, path: `chargebacks.chargeback[${i}]` },
        ...observed,
      }),
    );
  });
  return events;
}

/** A message item decoded once, shared by normalize and decodeErrors. */
type MessageReading = {
  name?: string;
  code?: string;
  pick?: IndexedRow;
  candidates: readonly IndexedRow[];
  byName: boolean;
  codeMismatch: boolean;
  agree: boolean;
};

function readMessage(m: MessageFields): MessageReading {
  const name = m.errorName?.trim() || undefined;
  const code = intCode(m.code);
  const byName = name ? ERRORS_BY_NAME.get(name) : undefined;
  let candidates: readonly IndexedRow[] = [];
  let codeMismatch = false;
  if (byName) {
    const same = code !== undefined ? byName.filter((r) => r.row.code === code) : byName;
    codeMismatch = code !== undefined && same.length === 0;
    candidates = same.length ? same : byName;
  } else if (code !== undefined) {
    candidates = ERRORS_BY_CODE.get(code) ?? [];
  }
  const first = candidates[0]?.row;
  const agree =
    first !== undefined &&
    candidates.every((c) => c.row.category === first.category && c.row.retry === first.retry);
  // The card transaction table is the primary Payment API table.
  const pick =
    byName || agree
      ? (candidates.find((c) => c.table === CARD_TRANSACTION_ERRORS) ?? candidates[0])
      : undefined;
  return {
    ...(name ? { name } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(pick ? { pick } : {}),
    candidates,
    byName: byName !== undefined,
    codeMismatch,
    agree,
  };
}

function normalizeError(
  body: z.infer<typeof ErrorBody>,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  const status = ctx.meta?.http?.status;
  const readings = body.message.map(readMessage);
  const names = readings.map((r) => safeText(r.name, 128) ?? "unknown");
  const uncertain =
    (status !== undefined && status >= 500) ||
    readings.some((r) => !r.pick || r.pick.row.uncertain === true);
  const fraud = body.message
    .map((m) => (isObj(m.fraudEvents) ? idOf(m.fraudEvents.fraudReferenceId) : undefined))
    .find((x) => x !== undefined);
  const props = body.message
    .map((m) => (isObj(m.invalidProperty) ? propertyName(m.invalidProperty.name) : undefined))
    .filter((x): x is string => x !== undefined);
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: names.length === 1 ? `error.${names[0]}` : "error.messages",
      eventTypeKnown: readings.every((r) => r.byName),
      stage: "error",
      providerStatus: status !== undefined ? `HTTP ${status}` : names[0],
      outcome: uncertain ? "unknown" : "failure",
      attributes: attrs([
        ["errorNames", names.slice(0, 50)],
        ["errorCodes", readings.map((r) => r.code ?? "").slice(0, 50)],
        ["httpStatus", status],
        ["invalidProperties", props.slice(0, 50)],
        ["fraudReferenceId", fraud],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    }),
  ];
}

/** invalidProperty.name holds a property path; its message-value (the rejected value) is never read. */
function propertyName(v: unknown): string | undefined {
  const t = str(v)?.trim();
  return t && /^[A-Za-z0-9_.[\]-]{1,80}$/.test(t) ? t : undefined;
}

function authKeyStatus(o: Obj): string | undefined {
  const key = "authKey" in o ? "authKey" : "authkey" in o ? "authkey" : undefined;
  if (!key) return undefined;
  const v = field(o, key)?.trim() ?? "";
  if (v === "") return "empty";
  return MD5_HEX.test(v) ? "present_md5_hex" : "present_other_format";
}

type WebhookView = {
  raw: string;
  name: string;
  info: WebhookInfo | undefined;
  undescribed: boolean;
  captureFailed: boolean;
  reference?: string;
  reversal?: string;
  original?: string;
  captureRef?: string;
};

function viewWebhook(o: Obj): WebhookView {
  const raw = field(o, "transactionType")?.trim() ?? "";
  const name = webhookName(raw);
  const reference = idOf(filled(o, "referenceNumber"));
  const reversal = idOf(filled(o, "reversalRefNum"));
  const original = idOf(filled(o, "originalRefNum"));
  const captureRef = idOf(filled(o, "captureReferenceNumber"));
  return {
    raw,
    name,
    info: lookup(WEBHOOK_TYPES, name),
    undescribed: UNDESCRIBED_WEBHOOK_TYPES.has(name),
    // captureStatus is always FAIL when present.
    captureFailed: filled(o, "captureStatus")?.toUpperCase() === "FAIL",
    ...(reference ? { reference } : {}),
    ...(reversal ? { reversal } : {}),
    ...(original ? { original } : {}),
    ...(captureRef ? { captureRef } : {}),
  };
}

function normalizeWebhook(o: Obj, ctx: NormalizeContext): NormalizedEventDraft[] {
  const v = viewWebhook(o);
  const stage: LifecycleStage = v.captureFailed ? "capture" : (v.info?.stage ?? "other");
  const outcome: Outcome = v.captureFailed ? "failure" : (v.info?.outcome ?? "unknown");
  const cbStatus = filled(o, "cbStatus");
  const cbKnown = cbStatus !== undefined && lookup(CHARGEBACK_STATUSES, cbStatus) !== undefined;
  const transactionDate = filled(o, "transactionDate");
  const paymentReference =
    v.reference ?? (stage === "payout" ? idOf(filled(o, "paymentId")) : undefined);

  let relatedReference: string | undefined;
  let relatedKind: string | undefined;
  if (v.reversal) {
    relatedReference = v.reversal;
    relatedKind = v.info?.stage === "dispute" ? "chargeback" : "refund";
  } else if (v.captureFailed && v.captureRef) {
    relatedReference = v.captureRef;
    relatedKind = "capture";
  }

  // Amounts only for charges and authorizations; reversalAmount has no
  // documented currency.
  const moneyStage = stage === "payment" || stage === "authorization";
  const chargeCurrency = upperCurrency(filled(o, "invoiceChargeCurrency"));
  const invoiceCurrency = upperCurrency(filled(o, "currency"));
  const chargeAmount = webhookAmount(filled(o, "invoiceChargeAmount"), chargeCurrency);
  const invoiceAmount = webhookAmount(filled(o, "invoiceAmount"), invoiceCurrency);
  const amountMinor = moneyStage ? (chargeAmount ?? invoiceAmount) : undefined;
  const currency = moneyStage
    ? chargeAmount
      ? chargeCurrency
      : invoiceAmount
        ? invoiceCurrency
        : undefined
    : undefined;

  const deliveryKey =
    v.reference && transactionDate
      ? [v.name, v.reference, v.reversal ?? "", cbStatus ?? "", transactionDate].join("|")
      : undefined;

  const threeDs = filled(o, "3dStatus");
  const cycle = filled(o, "cycle");
  const reversalAmount = filled(o, "reversalAmount");
  const headers = ctx.meta?.http?.headers;
  const name = safeText(v.raw, 64) ?? "unknown";

  return [
    clean({
      sourceFormat: ctx.format,
      eventType: name,
      eventTypeKnown: v.info !== undefined,
      stage,
      providerStatus: cbStatus
        ? safeText(cbStatus, 40)
        : v.captureFailed
          ? "captureStatus=FAIL"
          : name,
      paymentReference,
      relatedReference,
      merchantReference: merchantRef(filled(o, "merchantTransactionId")),
      subscriptionReference: idOf(filled(o, "subscriptionId")),
      isRecurring: v.info?.recurring ? true : undefined,
      deliveryKey,
      amountMinor,
      currency,
      outcome,
      attributes: attrs([
        ["transactionType", name],
        ["webhookName", v.name !== v.raw && v.info ? v.name : undefined],
        ["webhookGroup", v.info?.group],
        ["webhookUndescribed", v.undescribed ? true : undefined],
        ["relatedReferenceKind", relatedKind],
        [
          "originalTransactionId",
          v.original && v.original !== paymentReference ? v.original : undefined,
        ],
        ["paymentMethod", word(field(o, "paymentMethod"))],
        ["paymentType", word(field(o, "paymentType"))],
        ["cardBrand", documented(field(o, "creditCardType"), CARD_BRANDS)],
        ["cardSubType", word(field(o, "cardSubType"), 20)],
        ["testMode", yesNo(filled(o, "testMode"))],
        [
          "dataCenter",
          lookup(DATA_CENTER_NODES, filled(o, "bluesnapNode") ?? filled(o, "plimusNode")),
        ],
        [
          "transactionDateAsSent",
          transactionDate && WEBHOOK_DATE.test(transactionDate) ? transactionDate : undefined,
        ],
        ["chargebackStatus", cbStatus ? (cbKnown ? cbStatus : "unrecognized") : undefined],
        [
          "chargebackCycle",
          cycle ? (lookup(CHARGEBACK_CYCLES, cycle) ?? "unrecognized") : undefined,
        ],
        [
          "chargebackDateDue",
          ISO_DATE.test(filled(o, "dateDue") ?? "") ? filled(o, "dateDue") : undefined,
        ],
        [
          "reversalAmount",
          reversalAmount && /^-?[\d,]{1,20}(?:\.\d{1,10})?$/.test(reversalAmount)
            ? reversalAmount
            : undefined,
        ],
        ["reversalReason", safeText(filled(o, "reversalReason"), 120)],
        ["cancelReason", safeText(filled(o, "cancelReason"), 120)],
        ["numberOfAttemptsDone", digits(filled(o, "numberOfAttemptsDone"))],
        ["lastAttempt", yesNo(filled(o, "lastAttempt"))],
        ["daysTillCancelDate", digits(filled(o, "daysTillCancelDate"))],
        ["captureStatus", v.captureFailed ? "FAIL" : undefined],
        [
          "threeDSecureStatus",
          threeDs
            ? THREE_DS_RESULTS.has(threeDs) || threeDs === "3DS Not Enabled"
              ? threeDs
              : "unrecognized"
            : undefined,
        ],
        ["cvvSent", yesNo(filled(o, "cvvSent"))],
        ["cvvResponse", safeText(filled(o, "cvvResponse"), 80)],
        ["avsSent", yesNo(filled(o, "avsSent"))],
        ["avsResponse", safeText(filled(o, "avsResponse"), 80)],
        ["targetBalance", word(field(o, "targetBalance"))],
        ["authKeyStatus", authKeyStatus(o)],
        [
          "signatureHeaderPresent",
          headers && headers["bls-signature"] !== undefined ? true : undefined,
        ],
        ["httpMethod", ctx.meta?.http?.method],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    }),
  ];
}

function normalize(parsed: BluesnapParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "card_transaction":
      return normalizeCardTransaction(parsed.value, ctx);
    case "error":
      return normalizeError(parsed.value, ctx);
    case "webhook":
      return normalizeWebhook(parsed.value, ctx);
    case "throttling": {
      const status = ctx.meta?.http?.status;
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: `http.${status ?? "unknown"}`,
          eventTypeKnown: true,
          stage: "error",
          providerStatus: status !== undefined ? `HTTP ${status}` : undefined,
          outcome: "unknown",
          attributes: attrs([["httpStatus", status]]),
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
    case "refund": {
      const r = parsed.value;
      const rs = r.refundStatus;
      const currency = upperCurrency(r.currency);
      const id = idOf(r.refundTransactionId);
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: "refund",
          eventTypeKnown: true,
          stage: "refund",
          providerStatus: safeText(rs, 32),
          // The refund response does not repeat the original transactionId.
          relatedReference: id,
          amountMinor: apiAmount(r.amount, currency),
          currency,
          outcome: (rs ? lookup(REFUND_STATUSES, rs)?.outcome : undefined) ?? "unknown",
          attributes: attrs([
            ["refundStatus", safeText(rs, 32)],
            ["relatedReferenceKind", id ? "refund" : undefined],
            ["httpStatus", ctx.meta?.http?.status],
            [
              "cancelSubscriptions",
              typeof r.cancelSubscriptions === "boolean" ? r.cancelSubscriptions : undefined,
            ],
            ["refundDate", ISO_DATE.test(r.date ?? "") ? r.date : undefined],
          ]),
          source: { recordIndex: ctx.recordIndex, path: "" },
          ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
        }),
      ];
    }
  }
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

const describeRow = (r: IndexedRow) =>
  `${r.row.name ?? "(no name)"} (code ${r.row.code ?? "none"}, ${r.table.title}): ${r.row.meaning}`;

/** Fallback guidance from the HTTP status, as BlueSnap describes the statuses. */
function byHttpStatus(
  status: number | undefined,
): { category: ErrorCategory; retry: RetryGuidance; text: string } | undefined {
  switch (status) {
    case 403:
      return {
        category: "configuration",
        retry: "do_not_retry",
        text: "BlueSnap returns HTTP 403 when the API user lacks the role for the operation, when a resource does not exist, or when the call was blocked as suspected malicious content.",
      };
    case 404:
      return {
        category: "invalid_request",
        retry: "do_not_retry",
        text: "BlueSnap returns HTTP 404 when a resource is not found.",
      };
    case 409:
      return {
        category: "duplicate_request",
        retry: "retry_conditionally",
        text: "BlueSnap returns HTTP 409 on a conflict with the resource state, possibly a request with the same idempotency-key still in progress.",
      };
    case 422:
      return {
        category: "invalid_request",
        retry: "do_not_retry",
        text: "BlueSnap returns HTTP 422 for a well-formed but semantically invalid request.",
      };
    case 429:
    case 503:
      return {
        category: "rate_limiting",
        retry: "retry_conditionally",
        text: `BlueSnap returns HTTP ${status} when call thresholds are exceeded or the service is temporarily unavailable.`,
      };
    case 500:
      return {
        category: "provider_unavailable",
        retry: "retry_conditionally",
        text: "BlueSnap returns HTTP 500 for an unexpected error in its system.",
      };
    default:
      return undefined;
  }
}

/** fraudEvents.fraudEvent may be a list or a single object. */
function fraudDetails(fraudEvents: unknown): {
  codes: string[];
  decisions: string[];
  unlisted: string[];
} {
  const out = { codes: [] as string[], decisions: [] as string[], unlisted: [] as string[] };
  if (!isObj(fraudEvents)) return out;
  for (const e of asList(fraudEvents.fraudEvent).slice(0, 50)) {
    const raw = word(e.fraudEventCode, 64);
    if (raw) {
      // Casing differs between BlueSnap's table and examples.
      const doc = FRAUD_EVENT_CODES.find((c) => c.toLowerCase() === raw.toLowerCase());
      out.codes.push(doc ?? raw);
      if (!doc) out.unlisted.push(raw);
    }
    const d = str(e.fraudEventDecision)?.trim().toUpperCase();
    if (d === "D" || d === "R") out.decisions.push(d);
  }
  return out;
}

function decodeMessage(
  m: MessageFields,
  status: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const r = readMessage(m);
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  const docs: DocumentationLink[] = [];
  const retryParts: string[] = [];
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "unknown";
  let confidence: Confidence = "insufficient";
  let explanation: string;
  let outcomeKnown: boolean | undefined;
  const nameText = r.name ? safeText(r.name, 128) : undefined;

  if (r.code !== undefined) subCodes.bluesnap_code = r.code;
  if (status !== undefined) subCodes.http_status = String(status);

  const distinct = [
    ...new Map(r.candidates.map((c) => [`${c.table.id}|${c.row.code}`, c])).values(),
  ];
  if (r.pick) {
    const row: ErrorRow = r.pick.row;
    category = row.category;
    retry = row.retry;
    subCodes.error_table = r.pick.table.id;
    docs.push({ title: r.pick.table.title, url: r.pick.table.url });
    outcomeKnown = row.uncertain ? undefined : true;
    if (r.byName) {
      confidence = r.agree && !r.codeMismatch ? "strong" : "possible";
      explanation = `BlueSnap errorName ${row.name}${row.code !== null ? ` (code ${row.code})` : ""}: ${row.meaning}.`;
      if (row.advice) retryParts.push(`BlueSnap's advice: ${row.advice}.`);
      if (r.codeMismatch) {
        const known = [...new Set(r.candidates.map((c) => c.row.code ?? "none"))].join(", ");
        explanation += ` BlueSnap documents this name with code ${known}, not ${r.code}.`;
        missing.push(`errorName ${row.name} is not documented with code ${r.code}.`);
      }
      if (distinct.length > 1 && r.agree) {
        explanation += ` The name is listed in ${distinct.length} BlueSnap error tables with the same guidance.`;
      } else if (distinct.length > 1) {
        explanation += ` The name is listed in several BlueSnap error tables with different guidance: ${distinct.map(describeRow).join("; ")}. The reading from ${r.pick.table.title} is used.`;
        missing.push(
          "The payload does not say which API call returned the error, and the documented guidance differs between tables.",
        );
        for (const c of distinct)
          if (!docs.some((d) => d.url === c.table.url))
            docs.push({ title: c.table.title, url: c.table.url });
      }
    } else {
      confidence = "possible";
      explanation = nameText
        ? `errorName "${nameText}" is not in BlueSnap's error tables. Code ${r.code} is documented for ${distinct.map(describeRow).join("; ")}.`
        : `The error carries no errorName. Code ${r.code} is documented for ${distinct.map(describeRow).join("; ")}.`;
      missing.push(
        nameText
          ? `errorName "${nameText}" is not documented in the reviewed sources.`
          : "No errorName was supplied.",
      );
    }
  } else {
    const http = byHttpStatus(status);
    if (r.code !== undefined && r.candidates.length > 1) {
      const names = [...new Set(r.candidates.map((c) => c.row.name ?? "(no name)"))];
      explanation = `${nameText ? `errorName "${nameText}" is not in BlueSnap's error tables. ` : "The error carries no errorName. "}Code ${r.code} is shared by ${names.length} documented error names (for example ${names.slice(0, 4).join(", ")}), so the code alone does not identify the reason.`;
    } else {
      explanation = nameText
        ? `errorName "${nameText}" is not in BlueSnap's error tables${r.code !== undefined ? `, and code ${r.code} is not documented either` : ""}.`
        : "The error carries no errorName.";
    }
    missing.push(
      nameText
        ? `errorName "${nameText}" is not documented in the reviewed sources.`
        : "No errorName was supplied.",
    );
    if (http) {
      category = http.category;
      retry = http.retry;
      confidence = "possible";
      explanation += ` The guidance below follows the HTTP status: ${http.text}`;
    }
    if (status !== undefined && status >= 400 && status < 500) outcomeKnown = true;
  }

  const description = m.description;
  if (description && /\.:\s*\S/.test(description))
    missing.push(
      "The description carries text appended from the processor (after '.:'). BlueSnap does not document processor codes, so it is shown as provider text only.",
    );

  const prop = isObj(m.invalidProperty) ? propertyName(m.invalidProperty.name) : undefined;
  if (prop) {
    subCodes.invalid_property = prop;
    explanation += ` Invalid property: ${prop}.`;
  }

  const fraud = fraudDetails(m.fraudEvents);
  if (fraud.codes.length) {
    subCodes.fraud_event_codes = fraud.codes.join(",");
    docs.push({ title: "BlueSnap fraud event", url: FRAUD_EVENT_URL });
  }
  if (fraud.decisions.length) {
    subCodes.fraud_decisions = fraud.decisions.join(",");
    const parts = fraud.codes.map((c, i) => {
      const d = fraud.decisions[i];
      return d ? `${c} (${FRAUD_DECISIONS[d]})` : c;
    });
    explanation += ` Fraud events: ${parts.join(", ")}.`;
    if (fraud.decisions.every((d) => d === "R"))
      explanation += " All triggered rules hold the order for review rather than decline it.";
  } else if (fraud.codes.length) {
    explanation += ` Fraud events: ${fraud.codes.join(", ")}.`;
  }
  if (fraud.unlisted.length)
    missing.push(
      `fraudEventCode ${fraud.unlisted.join(", ")} is not in BlueSnap's documented list.`,
    );

  if (status === undefined && !r.pick) missing.push("The HTTP status was not supplied.");
  if (!loc.paymentReference)
    missing.push(
      "BlueSnap returns no transactionId with an error, so this attempt cannot be linked to other records.",
    );

  retryParts.push(RETRY_TEXT[retry]);
  if (r.pick?.row.uncertain)
    retryParts.push("The original operation may or may not have taken effect.");
  docs.push({ title: "BlueSnap error handling", url: ERROR_HANDLING_URL });
  if (r.name === "DO_NOT_HONOR" || r.name === "GENERAL_PAYMENT_PROCESSING_ERROR")
    docs.push({ title: "Understanding your declined authorizations", url: DECLINES_GUIDE_URL });

  const message = safeText(description, 300);
  return {
    ...withRefs(loc),
    code:
      nameText ??
      (r.code !== undefined ? r.code : status !== undefined ? `HTTP ${status}` : "unknown"),
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
    ...(outcomeKnown ? { outcomeKnown } : {}),
  };
}

/** ACH return code inside a webhook reason field. */
function findAchCode(text: string): { code: string; exact: boolean } | undefined {
  const t = text.trim();
  const m = /\b(R\d{2})\b/.exec(t);
  if (!m || !lookup(ACH_RETURN_CODES, m[1])) return undefined;
  return { code: m[1]!, exact: t === m[1] };
}

/** A documented errorName inside free text; card transaction names first. */
function findErrorName(text: string): IndexedRow | undefined {
  const tokens = text.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? [];
  for (const t of tokens.slice(0, 20)) {
    const rows = ERRORS_BY_NAME.get(t);
    if (rows) return rows.find((r) => r.table === CARD_TRANSACTION_ERRORS) ?? rows[0];
  }
  return undefined;
}

function decodeAch(
  code: string,
  exact: boolean,
  fieldName: string,
  text: string,
  loc: Location,
): DecodedErrorDraft {
  const e = ACH_RETURN_CODES[code]!;
  const missing: string[] = [];
  if (!exact)
    missing.push(
      `The format of ${fieldName} is not documented; the ACH return code was read from its text.`,
    );
  const message = safeText(text, 200);
  return {
    ...withRefs(loc),
    code,
    subCodes: { code_table: "ach_return", source_field: fieldName },
    category: e.category,
    ...(message && !exact ? { providerMessage: message } : {}),
    explanation: `ACH return code ${code}: ${e.meaning}.${e.deactivates ? " Since 21 June 2026 BlueSnap deactivates the ACH account and cancels its subscriptions for this code." : ""}`,
    nextAction: NEXT_ACTION[e.category],
    retry: e.retry,
    retryExplanation: `BlueSnap's advice: ${e.advice}. ${RETRY_TEXT[e.retry]}`,
    confidence: exact ? "strong" : "possible",
    documentation: [{ title: "BlueSnap ACH/ECP return codes", url: ACH_URL }],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeReasonText(
  text: string | undefined,
  fieldName: string,
  what: string,
  loc: Location,
  extra: Record<string, string> = {},
): DecodedErrorDraft {
  if (text) {
    const ach = findAchCode(text);
    if (ach) {
      const d = decodeAch(ach.code, ach.exact, fieldName, text, loc);
      Object.assign(d.subCodes, extra);
      return d;
    }
  }
  const hit = text ? findErrorName(text) : undefined;
  const message = safeText(text, 300);
  const missing = [`The format of ${fieldName} is not documented.`];
  if (!loc.paymentReference) missing.push("The webhook carries no referenceNumber.");
  if (hit) {
    const row = hit.row;
    return {
      ...withRefs(loc),
      code: row.name ?? fieldName,
      subCodes: { error_table: hit.table.id, source_field: fieldName, ...extra },
      category: row.category,
      ...(message ? { providerMessage: message } : {}),
      explanation: `${what} The ${fieldName} text contains the documented errorName ${row.name}: ${row.meaning}. Because the format of ${fieldName} is not documented, this reading is possible only.`,
      nextAction: NEXT_ACTION[row.category],
      retry: row.retry,
      retryExplanation: [
        row.advice ? `BlueSnap's advice: ${row.advice}.` : "",
        RETRY_TEXT[row.retry],
      ]
        .filter(Boolean)
        .join(" "),
      confidence: "possible",
      documentation: [
        { title: hit.table.title, url: hit.table.url },
        { title: "BlueSnap webhook parameter reference", url: WEBHOOK_PARAMETERS_URL },
      ],
      missingInformation: missing,
      outcomeKnown: true,
    };
  }
  if (!text) missing.push(`The webhook carries no ${fieldName}.`);
  return {
    ...withRefs(loc),
    code: text ? fieldName : "no_reason",
    subCodes: { source_field: fieldName, ...extra },
    category: "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation: `${what} ${text ? `The reason is given only as free text in ${fieldName}, which BlueSnap does not structure; it is shown as provider text.` : "No reason is given."}`,
    nextAction:
      "Look up the transaction in the BlueSnap Merchant Portal or retrieve it through the API for the decline details.",
    retry: "unknown",
    retryExplanation: RETRY_TEXT.unknown,
    confidence: "insufficient",
    documentation: [{ title: "BlueSnap webhook parameter reference", url: WEBHOOK_PARAMETERS_URL }],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeWebhook(o: Obj, ctx: NormalizeContext): DecodedErrorDraft[] {
  const v = viewWebhook(o);
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const loc: Location = { sourceFormat: ctx.format, source };
  if (v.reference) {
    loc.paymentReference = v.reference;
    loc.attemptReference = v.reference;
  }
  const out: DecodedErrorDraft[] = [];
  const extra: Record<string, string> = {};
  const epc = filled(o, "errorProcessingCode");
  if (epc && /^[0-9A-Za-z_-]{1,32}$/.test(epc)) extra.error_processing_code = epc;

  switch (v.name) {
    case "DECLINE":
      out.push(
        decodeReasonText(
          filled(o, "declineReason"),
          "declineReason",
          "BlueSnap rejected the transaction (DECLINE webhook).",
          loc,
        ),
      );
      break;
    case "CC_CHARGE_FAILED":
      out.push(
        decodeReasonText(
          filled(o, "failureReason"),
          "failureReason",
          "The initial charge failed (CC_CHARGE_FAILED webhook).",
          loc,
          extra,
        ),
      );
      break;
    case "SUBSCRIPTION_CHARGE_FAILURE": {
      const d = decodeReasonText(
        filled(o, "failureReason"),
        "failureReason",
        "A recurring subscription charge failed (SUBSCRIPTION_CHARGE_FAILURE webhook).",
        loc,
        extra,
      );
      const attempts = digits(filled(o, "numberOfAttemptsDone"));
      const last = yesNo(filled(o, "lastAttempt"));
      const days = digits(filled(o, "daysTillCancelDate"));
      const facts = [
        attempts ? `numberOfAttemptsDone is ${attempts}` : "",
        last ? `lastAttempt is ${last}` : "",
        days ? `daysTillCancelDate is ${days}` : "",
      ].filter(Boolean);
      if (facts.length) d.retryExplanation += ` The webhook reports: ${facts.join(", ")}.`;
      d.missingInformation.push(
        "BlueSnap's retry schedule for failed recurring charges is not documented.",
      );
      out.push(d);
      break;
    }
    case "FRAUD_DECLINE":
      out.push({
        ...withRefs(loc),
        code: "FRAUD_DECLINE",
        subCodes: {},
        category: "fraud_or_risk",
        explanation:
          "BlueSnap's fraud screening declined the order (FRAUD_DECLINE webhook). The webhook does not name the rule that triggered.",
        nextAction: NEXT_ACTION.fraud_or_risk,
        retry: "manual_review",
        retryExplanation: RETRY_TEXT.manual_review,
        confidence: "strong",
        documentation: [{ title: "BlueSnap webhook name reference", url: WEBHOOK_NAMES_URL }],
        missingInformation: [
          "The fraud rule is only in the API error (fraudEvents) or the Merchant Portal.",
        ],
        outcomeKnown: true,
      });
      break;
    case "CANCELLATION":
    case "CANCELLATION_REFUND":
    case "REFUND": {
      // ACH returns reach the merchant in these reason fields.
      const fieldName = v.name === "REFUND" ? "reversalReason" : "cancelReason";
      const text = filled(o, fieldName);
      const ach = text ? findAchCode(text) : undefined;
      if (text && ach) out.push(decodeAch(ach.code, ach.exact, fieldName, text, loc));
      break;
    }
  }
  if (v.captureFailed) {
    out.push({
      ...withRefs(loc),
      code: "captureStatus=FAIL",
      subCodes: {},
      category: "unknown",
      explanation:
        "A capture of this authorization failed (captureStatus=FAIL). The webhook carries no failure reason.",
      nextAction:
        "Retrieve the transaction to see what remains open to capture before capturing again.",
      retry: "unknown",
      retryExplanation: RETRY_TEXT.unknown,
      confidence: "insufficient",
      documentation: [
        { title: "BlueSnap webhook parameter reference", url: WEBHOOK_PARAMETERS_URL },
      ],
      missingInformation: ["The reason for the failed capture is not in the webhook."],
      outcomeKnown: true,
    });
  }
  return out;
}

function decodeErrors(parsed: BluesnapParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "error") {
    const status = ctx.meta?.http?.status;
    return parsed.value.message.map((m, i) =>
      decodeMessage(m, status, {
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path: `message[${i}]` },
      }),
    );
  }
  if (parsed.kind === "webhook") return decodeWebhook(parsed.value, ctx);
  if (parsed.kind === "throttling") {
    const t = throttlingMessage(ctx.meta);
    if (!t) return [];
    const category = t.info.category;
    return [
      {
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path: "" },
        code: `HTTP ${t.status}`,
        subCodes: { http_status: String(t.status) },
        category,
        ...(ctx.meta?.http?.bodyText
          ? { providerMessage: safeText(ctx.meta.http.bodyText, 200)! }
          : {}),
        explanation: `${t.info.meaning}. BlueSnap documents this message for HTTP 429 and 503 responses.`,
        nextAction: NEXT_ACTION[category],
        retry: "retry_conditionally",
        retryExplanation: `Back off before the next request. ${RETRY_TEXT.retry_conditionally}`,
        confidence: "strong",
        documentation: [{ title: "BlueSnap error handling", url: ERROR_HANDLING_URL }],
        missingInformation: [
          "BlueSnap does not document whether a throttled request was processed, or which field carries the message.",
        ],
      },
    ];
  }
  return [];
}

export const bluesnapAdapter: ProviderAdapter<BluesnapParsed> = {
  id: PROVIDER,
  displayName: "BlueSnap",
  version: BLUESNAP_ADAPTER_VERSION,
  manifest: bluesnapManifest,
  supportedFormats: [
    {
      id: BLUESNAP_FORMATS.cardTransaction,
      description:
        "Payment API (JSON) card transaction response (cardTransactionType, transactionId, processingInfo.processingStatus)",
    },
    {
      id: BLUESNAP_FORMATS.refund,
      description: "Payment API (JSON) refund response (refundTransactionId, refundStatus)",
    },
    {
      id: BLUESNAP_FORMATS.error,
      description: "Payment API (JSON) error body (message[] with errorName, code, description)",
    },
    {
      id: BLUESNAP_FORMATS.webhook,
      description: "Form-encoded webhook (IPN) named by transactionType",
    },
    {
      id: BLUESNAP_FORMATS.throttling,
      description: "HTTP 429 or 503 with a documented plain-text throttling message",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transactionId (API) and referenceNumber (webhook) are the same BlueSnap
    // ID; Capture and Auth Reversal keep the Auth Only ID; originalRefNum and
    // originalTransactionId point at the parent transaction. Refund and
    // chargeback IDs share the reversal namespace. merchantTransactionId can
    // be reused and is never a key.
    const keys: string[] = [];
    if (event.paymentReference) keys.push(`txn:${event.paymentReference}`);
    const parent = event.attributes.originalTransactionId;
    if (typeof parent === "string" && parent) keys.push(`txn:${parent}`);
    const kind = event.attributes.relatedReferenceKind;
    if (event.relatedReference) {
      if (kind === "refund" || kind === "chargeback")
        keys.push(`reversal:${event.relatedReference}`);
      else if (kind === "transaction") keys.push(`txn:${event.relatedReference}`);
    }
    if (event.subscriptionReference) keys.push(`subscription:${event.subscriptionReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default bluesnapAdapter;
