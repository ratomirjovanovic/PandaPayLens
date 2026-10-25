/**
 * PXP Financial adapter (PXP Unity Gateway).
 *
 * Supported input families:
 * - `pxp.transaction_response`  Transactions API v1 response: initiation, modification or a
 *                               lookup item (`state`, `stateData`, `systemTransactionId`)
 * - `pxp.api_error`             API error envelope `{ correlationId, details, errorCode, errorReason }`
 * - `pxp.webhook`               Merchant webhook envelope `{ eventCategory, eventDate, eventData,
 *                               eventOwner }` for transaction and authentication events
 *
 * Recognized but not supported: `pxp.webhook.non_payment` (token, reporting,
 * user and test-connection webhooks).
 *
 * A card decline is not an HTTP error: it comes back as HTTP 200 with
 * `state: Refused` or `state: Error` and a normalized `stateData.code`.
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
  ABOUT_WEBHOOKS_URL,
  API_ERROR_CODES,
  API_OVERVIEW_URL,
  APM_ERROR_CODES,
  APM_STATE_CODES,
  CARD_CODES,
  CHALLENGE_COMPLETED_EVENT,
  EVENT_CATEGORIES,
  FUNDING_TYPES,
  HOW_IT_WORKS_URL,
  HTTP_STATUSES,
  INFERRED_EVENT_NAMES,
  INTENTS,
  NEXT_ACTION,
  NON_PAYMENT_CATEGORIES,
  NON_PAYMENT_EVENT_CODES,
  PAYOUT_AUTHORISED_EVENT,
  RETRY_TEXT,
  TEST_EVENT_CATEGORY,
  THREEDS_AUTH_STATES,
  THREEDS_REASONS,
  THREEDS_STATES_URL,
  THREEDS_TRANS_STATUS,
  TRANSACTION_STATES,
  VERIFICATION_RESULTS,
  WEBHOOK_API_URL,
  WEBHOOK_EVENT_CODES,
  type CodeEntry,
} from "./catalog.js";

import { pxpManifest, PXP_ADAPTER_VERSION } from "./manifest.js";

export { pxpManifest, PXP_ADAPTER_VERSION };

const PROVIDER = "pxp";

// Codes and amounts are documented as strings or numbers but examples mix both.
const Code = z.union([z.string().max(64), z.number().int()]);
const Num = z.union([z.number(), z.string().max(40)]);
const NStr = (max: number) => z.string().max(max).nullable().optional();
const NCode = Code.nullable().optional();

const StateData = z.looseObject({ code: NCode, message: NStr(2000) });

const Amounts = z.looseObject({
  transaction: Num.nullable().optional(),
  transactionValue: Num.nullable().optional(),
  currencyCode: NStr(8),
});

const ProviderResponse = z.looseObject({
  provider: NStr(64),
  code: NCode,
  message: NStr(2000),
  merchantAdvice: z
    .looseObject({ code: NCode, message: NStr(500) })
    .nullable()
    .optional(),
  electronicCommerceIndicatorAdjustment: NCode,
  authorisedAmount: Num.nullable().optional(),
  settlementDate: NStr(64),
  issuerResponseCode: NCode,
  // Pay-by-bank and Aeropay providerResponse at the eventData root.
  providerTransactionStatus: NStr(64),
  providerResponseCode: NCode,
  providerResponseMessage: NStr(2000),
});

const cardShape = {
  cardScheme: NStr(64),
  cardVerificationCodeResult: NStr(64),
  addressVerificationServiceResult: NStr(64),
  nameVerificationResult: NStr(64),
  providerResponse: ProviderResponse.nullable().optional(),
};
const Card = z.looseObject(cardShape);

const FundingData = z.looseObject({
  ...cardShape,
  card: Card.nullable().optional(),
  payByBank: z
    .looseObject({
      apmProvider: NStr(64),
      achStatus: NStr(64),
      isRtp: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const TransactionMethod = z.union([
  z.looseObject({ intent: NStr(64), fundingType: NStr(64), entryType: NStr(64) }),
  // PayPal payouts send transactionMethod as the plain string "Payout".
  z.string().max(64),
]);

const transactionShape = {
  stateData: StateData.nullable().optional(),
  systemTransactionId: NStr(128),
  originalSystemTransactionId: NStr(128),
  merchantTransactionId: NStr(256),
  merchantTransactionDate: NStr(64),
  merchantOrderId: NStr(256),
  providerTransactionId: NStr(256),
  transactionMethod: TransactionMethod.nullable().optional(),
  amounts: Amounts.nullable().optional(),
  // Singular amount object in payout examples.
  amount: z.union([Amounts, Num]).nullable().optional(),
  fundingData: FundingData.nullable().optional(),
  providerResponse: ProviderResponse.nullable().optional(),
};

const TransactionResponse = z.looseObject({ state: z.string().max(64), ...transactionShape });

const EventData = z.looseObject({
  ...transactionShape,
  state: NStr(64),
  eventCode: NStr(128),
  transactionUpdateDatetime: NStr(64),
  // 3DS: the schema calls the field `state`, examples use `authenticationState`.
  authenticationState: NStr(64),
  authenticationId: NStr(128),
  transactionStatus: NStr(8),
  transactionStatusReason: NCode,
  challengeCancel: NCode,
});

const Webhook = z.looseObject({
  eventCategory: z.string().max(64),
  eventDate: z.string().max(64),
  eventData: EventData,
});

const ApiError = z.looseObject({
  correlationId: z.string().max(128),
  errorCode: z.string().max(64),
  errorReason: z.string().max(2000),
  details: z
    .array(z.union([z.string().max(2000), z.looseObject({})]))
    .max(100)
    .nullable()
    .optional(),
});

type Txn = z.infer<typeof TransactionResponse> | z.infer<typeof EventData>;
type ProviderResponseFields = z.infer<typeof ProviderResponse>;
type WebhookValue = z.infer<typeof Webhook>;

export type PxpParsed =
  | { kind: "transaction_response"; value: z.infer<typeof TransactionResponse> }
  | { kind: "api_error"; value: z.infer<typeof ApiError> }
  | { kind: "webhook"; value: WebhookValue };

const FORMATS = {
  "pxp.transaction_response": ["transaction_response", TransactionResponse],
  "pxp.api_error": ["api_error", ApiError],
  "pxp.webhook": ["webhook", Webhook],
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOSE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
const STATE_CODE = /^(?:CRD\d{3}|APM\d{3,4}|VAN0001)$/;
const PAY_BY_BANK_EVENT =
  /^(?:spei|cvu|breb)-transaction-order-[a-z-]+$|^flashflow-transaction-[a-z-]+$/;
const SHORT_EVENT = /^(?:TXN|TXNAP|TXNPP|TS)_[A-Z]+$/;
const API_ERROR_PREFIX = /^(?:CAR|TOK|GEN|SES)\d{4}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function idKind(v: unknown): "strict" | "loose" | null {
  if (typeof v !== "string") return null;
  if (UUID.test(v)) return "strict";
  return LOOSE_ID.test(v) ? "loose" : null;
}
const txnId = (v: unknown) => (idKind(v) ? safeId(v) : undefined);

/** Normalized code from a string or number, trimmed. */
function codeOf(v: unknown, re = /^[0-9A-Za-z_-]{1,32}$/): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return re.test(t) ? t : undefined;
}

/** Two-digit advice and reason codes may arrive as numbers; "01" and 1 mean the same. */
function twoDigit(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 100)
    return String(v).padStart(2, "0");
  return typeof v === "string" && /^[0-9A-Za-z]{1,4}$/.test(v) ? v : undefined;
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : undefined);

function webhookFormat(input: Record<string, unknown>): {
  format: "pxp.webhook" | "pxp.webhook.non_payment";
  reason?: string;
} {
  const category = lower(input.eventCategory);
  const data = isObj(input.eventData) ? input.eventData : {};
  const code = typeof data.eventCode === "string" ? data.eventCode : undefined;
  if (category && NON_PAYMENT_CATEGORIES.has(category))
    return {
      format: "pxp.webhook.non_payment",
      reason: `PXP ${category} webhooks carry no payment lifecycle and are recognized but not analyzed.`,
    };
  if (code && lookup(NON_PAYMENT_EVENT_CODES, code))
    return {
      format: "pxp.webhook.non_payment",
      reason: `PXP ${lookup(NON_PAYMENT_EVENT_CODES, code)} webhooks (${code}) carry no payment lifecycle and are recognized but not analyzed.`,
    };
  return { format: "pxp.webhook" };
}

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
  // Stripe payloads carry `object`; PXP payloads never do.
  if ("object" in input) return none;

  // Webhook envelope.
  // eventDate is required by the schema; a record without it is still
  // claimed so that parse can report the missing field.
  if (typeof input.eventCategory === "string" && isObj(input.eventData)) {
    const data = input.eventData;
    const reasons = ["has the eventCategory / eventData envelope"];
    let score = 0.35;
    if (typeof input.eventDate === "string") {
      score += 0.1;
      reasons.push("has eventDate");
    }
    const category = input.eventCategory.toLowerCase();
    if (
      (EVENT_CATEGORIES as readonly string[]).includes(category) ||
      category === TEST_EVENT_CATEGORY
    ) {
      score += 0.2;
      reasons.push(`eventCategory "${safeText(input.eventCategory, 32)}" is a documented category`);
    }
    const owner = input.eventOwner;
    if (isObj(owner) && ("merchantGroup" in owner || "merchant" in owner || "site" in owner)) {
      score += 0.15;
      reasons.push("eventOwner has the merchantGroup / merchant / site hierarchy");
    }
    const code = typeof data.eventCode === "string" ? data.eventCode : undefined;
    if (
      idKind(data.systemTransactionId) ||
      (isObj(data.stateData) && codeOf(data.stateData.code, STATE_CODE)) ||
      typeof data.authenticationState === "string" ||
      (code && (PAY_BY_BANK_EVENT.test(code) || SHORT_EVENT.test(code)))
    ) {
      score += 0.15;
      reasons.push("eventData carries PXP transaction, 3DS or event code fields");
    }
    const fmt = webhookFormat(input);
    return {
      ...base,
      format: fmt.format,
      confidence: round(score),
      supported: fmt.format === "pxp.webhook",
      reasons,
      ...(fmt.reason ? { unsupportedReason: fmt.reason } : {}),
    };
  }

  // API error envelope. errorCode / errorReason alone is generic, so a
  // correlationId and a known code or PXP code shape are needed to claim it.
  if (typeof input.errorCode === "string" && "errorReason" in input) {
    const correlation = typeof input.correlationId === "string";
    const known = Boolean(lookup(API_ERROR_CODES, input.errorCode));
    const prefix = API_ERROR_PREFIX.test(input.errorCode);
    const httpError = (meta?.http?.status ?? 0) >= 400;
    let confidence = 0;
    if (correlation) {
      confidence = known ? 0.9 : prefix ? 0.75 : 0.45;
      if (httpError && confidence < 0.9) confidence += 0.1;
      if (Array.isArray(input.details) && confidence < 0.9) confidence += 0.05;
    } else if (known) confidence = 0.4;
    if (confidence === 0) return none;
    const reasons = ["has errorCode and errorReason"];
    if (correlation) reasons.push("has correlationId");
    if (known) reasons.push("errorCode is a value seen in PXP examples");
    else if (prefix) reasons.push("errorCode has a PXP-style prefix");
    return {
      ...base,
      format: "pxp.api_error",
      confidence: round(confidence),
      supported: true,
      reasons,
    };
  }

  // Transactions API response.
  const sys = idKind(input.systemTransactionId);
  const stateCode = isObj(input.stateData) ? codeOf(input.stateData.code, STATE_CODE) : undefined;
  if (sys) {
    const reasons = ["has systemTransactionId"];
    let score = sys === "strict" ? 0.45 : 0.3;
    if (typeof input.state === "string" && lookup(TRANSACTION_STATES, input.state)) {
      score += 0.15;
      reasons.push(`state "${input.state}" is a documented PXP state`);
    }
    if (stateCode) {
      score += 0.2;
      reasons.push("stateData.code is a normalized PXP code");
    } else if (isObj(input.stateData)) score += 0.05;
    const tm = input.transactionMethod;
    if (isObj(tm) && typeof tm.intent === "string") {
      score += lookup(INTENTS, tm.intent) ? 0.15 : 0.1;
      reasons.push("has transactionMethod.intent");
    } else if (tm === "Payout") score += 0.1;
    if ("merchantTransactionId" in input) score += 0.05;
    if (isObj(input.fundingData)) score += 0.05;
    const confidence = score <= (sys === "strict" ? 0.45 : 0.3) ? 0.4 : round(score);
    return {
      ...base,
      format: "pxp.transaction_response",
      confidence,
      supported: true,
      reasons,
    };
  }
  if (
    stateCode &&
    isObj(input.stateData) &&
    typeof input.stateData.message === "string" &&
    typeof input.state === "string"
  ) {
    const known = Boolean(lookup(TRANSACTION_STATES, input.state));
    return {
      ...base,
      format: "pxp.transaction_response",
      confidence: known ? 0.7 : 0.6,
      supported: true,
      reasons: ["stateData has a normalized PXP code and message", "has state"],
    };
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PxpParsed } | { ok: false; issues: string[] } {
  const entry = (FORMATS as Record<string, (typeof FORMATS)[keyof typeof FORMATS]>)[format];
  if (!entry || !Object.prototype.hasOwnProperty.call(FORMATS, format))
    return { ok: false, issues: [`Unsupported PXP format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as PxpParsed };
}

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

/**
 * PXP timestamps drift: ISO with Z, a space separator with an offset, or no
 * offset at all. Only values with an explicit zone are converted, so the
 * timeline never depends on the local time zone of the machine.
 */
function pxpTime(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 64) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/i.exec(
    v.trim(),
  );
  if (!m) return undefined;
  const frac = m[3] ? m[3].slice(0, 4) : "";
  return toIsoTimestamp(`${m[1]}T${m[2]}${frac}${m[4]!.toUpperCase()}`);
}

const hasNoZone = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v.trim());

type Method = {
  intent?: string;
  fundingType?: string;
  entryType?: string;
  shape: "object" | "string" | "missing";
};

function methodOf(d: Txn): Method {
  const tm = d.transactionMethod;
  if (typeof tm === "string") return { intent: tm, shape: "string" };
  if (isObj(tm))
    return {
      intent: tm.intent ?? undefined,
      fundingType: tm.fundingType ?? undefined,
      entryType: tm.entryType ?? undefined,
      shape: "object",
    };
  return { shape: "missing" };
}

/** Amount in major units, read from every documented variant. */
function amountOf(d: Txn): { minor?: string; currency?: string; field?: string; raw?: boolean } {
  const candidates: [string, unknown, unknown][] = [];
  if (d.amounts) {
    candidates.push(["amounts.transaction", d.amounts.transaction, d.amounts.currencyCode]);
    candidates.push([
      "amounts.transactionValue",
      d.amounts.transactionValue,
      d.amounts.currencyCode,
    ]);
  }
  if (isObj(d.amount)) {
    const a = d.amount as z.infer<typeof Amounts>;
    candidates.push(["amount.transaction", a.transaction, a.currencyCode]);
    candidates.push(["amount.transactionValue", a.transactionValue, a.currencyCode]);
  }
  for (const [field, value, cur] of candidates) {
    if (value === undefined || value === null) continue;
    const currency = upperCurrency(cur);
    const minor = decimalToMinor(value, currency);
    return { field, currency, ...(minor !== undefined ? { minor } : { raw: true }) };
  }
  const currency = upperCurrency(d.amounts?.currencyCode);
  return currency ? { currency } : {};
}

function cardOf(d: Txn): {
  card?: z.infer<typeof Card>;
  shape?: "nested" | "flat";
} {
  const f = d.fundingData;
  if (!f) return {};
  if (f.card) return { card: f.card, shape: "nested" };
  if (f.cardScheme || f.providerResponse) return { card: f, shape: "flat" };
  return {};
}

const verification = (v: unknown) =>
  typeof v === "string" && VERIFICATION_RESULTS.has(v) ? v : undefined;

function apmOf(code: string | undefined): string | undefined {
  const info = code ? lookup(WEBHOOK_EVENT_CODES, code) : undefined;
  return info && info.apm !== "card" ? info.apm : undefined;
}

function familyOf(code: string | undefined, fundingType: string | undefined): string | undefined {
  const info = code ? lookup(WEBHOOK_EVENT_CODES, code) : undefined;
  if (info) return info.apm === "card" ? "card" : "pay_by_bank";
  return fundingType ? lookup(FUNDING_TYPES, fundingType) : undefined;
}

type Classified = { stage: LifecycleStage; outcome: Outcome; known: boolean; stageFrom: string };

/**
 * Stage and outcome from the provider's own state, intent and event code.
 * The state decides the outcome; unknown states stay unknown.
 */
function classify(
  state: string | undefined,
  intent: string | undefined,
  code: string | undefined,
): Classified {
  const st = state ? lookup(TRANSACTION_STATES, state) : undefined;
  const ev = code ? lookup(WEBHOOK_EVENT_CODES, code) : undefined;
  const outcome: Outcome = state ? (st?.outcome ?? "unknown") : (ev?.outcome ?? "unknown");
  const known = state ? Boolean(st) : Boolean(ev);
  const fixed = st?.stage ?? ev?.stage;
  const intentStage = intent ? lookup(INTENTS, intent) : undefined;

  if (fixed === "refund") return { stage: "refund", outcome, known, stageFrom: "state" };
  if (intentStage === "payout") return { stage: "payout", outcome, known, stageFrom: "intent" };
  if (fixed) return { stage: fixed, outcome, known, stageFrom: st?.stage ? "state" : "eventCode" };
  if (state === "Cancelled")
    return {
      stage: intentStage === "void" ? "void" : "cancellation",
      outcome,
      known,
      stageFrom: "state",
    };
  if (intentStage) return { stage: intentStage, outcome, known, stageFrom: "intent" };
  // No intent: the operation is not stated, so it is shown as a generic payment.
  if (!intent) return { stage: "payment", outcome, known, stageFrom: "default" };
  return { stage: "other", outcome, known, stageFrom: "unknown intent" };
}

function providerAttrs(
  pr: ProviderResponseFields | null | undefined,
  currency: string | undefined,
): [string, unknown][] {
  if (!pr) return [];
  const advice = pr.merchantAdvice;
  return [
    ["provider", pr.provider ?? undefined],
    ["providerCode", codeOf(pr.code)],
    ["providerMessage", pr.message ?? undefined],
    ["merchantAdviceCode", twoDigit(advice?.code)],
    ["merchantAdviceMessage", advice?.message ?? undefined],
    ["eciAdjustment", twoDigit(pr.electronicCommerceIndicatorAdjustment)],
    ["issuerResponseCode", codeOf(pr.issuerResponseCode)],
    [
      "authorisedAmountMinor",
      pr.authorisedAmount === undefined || pr.authorisedAmount === null
        ? undefined
        : decimalToMinor(pr.authorisedAmount, currency),
    ],
    [
      "settlementDate",
      typeof pr.settlementDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(pr.settlementDate)
        ? pr.settlementDate.slice(0, 10)
        : undefined,
    ],
    ["providerTransactionStatus", codeOf(pr.providerTransactionStatus)],
    ["providerResponseCode", codeOf(pr.providerResponseCode)],
    ["providerResponseMessage", pr.providerResponseMessage ?? undefined],
  ];
}

/** References: the original transaction is primary where PXP links it (Aeropay). */
function refsOf(d: Txn): { paymentReference?: string; relatedReference?: string } {
  const sys = txnId(d.systemTransactionId);
  const original = txnId(d.originalSystemTransactionId);
  if (original && original !== sys) return { paymentReference: original, relatedReference: sys };
  return { paymentReference: sys };
}

type WebhookCtx = { category: string; eventDate: string; eventCode?: string };

function inferEventName(d: Txn, method: Method): string | undefined {
  const state = d.state ?? undefined;
  if (!state) return undefined;
  if (state === "Authorised" && method.intent === "Payout") return PAYOUT_AUTHORISED_EVENT;
  // transaction-created is documented for the PayPal family Create flow only.
  if (state === "Pending" && method.intent !== "Create" && method.fundingType !== "Paypal")
    return undefined;
  return lookup(INFERRED_EVENT_NAMES, state);
}

function transactionEvent(d: Txn, ctx: NormalizeContext, hook?: WebhookCtx): NormalizedEventDraft {
  const source = { recordIndex: ctx.recordIndex, path: hook ? "eventData" : "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const method = methodOf(d);
  const state = typeof d.state === "string" ? d.state : undefined;
  const eventCode = hook?.eventCode;
  const codeInfo = eventCode ? lookup(WEBHOOK_EVENT_CODES, eventCode) : undefined;
  const { stage, outcome, known, stageFrom } = classify(state, method.intent, eventCode);
  const amount = amountOf(d);
  const { card, shape } = cardOf(d);
  const stateCode = codeOf(d.stateData?.code);
  const codeEntry = stateCode ? codeEntryOf(stateCode) : undefined;
  const refs = refsOf(d);
  const sys = txnId(d.systemTransactionId);

  let eventType: string;
  let eventTypeKnown = known;
  let inferred: string | undefined;
  if (hook && eventCode) {
    eventType = safeText(eventCode, 128) ?? "unknown";
    eventTypeKnown = Boolean(codeInfo) && (state === undefined || known);
  } else if (hook) {
    const name = inferEventName(d, method);
    if (name) inferred = name;
    eventType =
      name ?? `${safeText(hook.category, 32) ?? "transaction"}.${safeText(state, 64) ?? "unknown"}`;
  } else {
    const op = method.intent ? safeText(method.intent, 64) : "transaction";
    eventType = `${op}.${safeText(state, 64) ?? "unknown"}`;
  }

  // Webhooks: eventDate. Responses: the merchant-supplied transaction date,
  // only when it carries a time zone.
  const eventDate = hook ? pxpTime(hook.eventDate) : undefined;
  const merchantDate = pxpTime(d.merchantTransactionDate);
  const eventTimestamp = eventDate ?? merchantDate;
  const timestampSource = eventDate
    ? "eventDate"
    : merchantDate
      ? "merchantTransactionDate (merchant supplied)"
      : undefined;

  const deliveryKey =
    hook && eventCode && sys ? `${safeId(eventCode) ?? "unknown"}:${sys}` : undefined;
  const pbb = d.fundingData?.payByBank;
  const httpStatus = ctx.meta?.http?.status;

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown,
    stage,
    providerStatus: state ? (safeText(state, 64) ?? undefined) : undefined,
    ...refs,
    merchantReference: merchantRef(d.merchantTransactionId),
    deliveryKey,
    eventTimestamp,
    amountMinor: amount.minor,
    currency: amount.currency,
    outcome,
    attributes: attrs([
      ["eventCategory", hook?.category],
      ["eventCode", eventCode],
      ["eventTypeInferred", inferred ? true : hook && !eventCode ? false : undefined],
      [
        "eventTypeInferredFrom",
        inferred ? "eventCategory, state, intent and funding type (no eventCode)" : undefined,
      ],
      ["state", state],
      ["stateDataCode", stateCode],
      ["stateDataMessage", d.stateData?.message ?? undefined],
      ["stateDataCodeExampleDerived", codeEntry?.exampleDerived ? true : undefined],
      ["partialApproval", codeEntry?.kind === "partial" ? true : undefined],
      ["intent", method.intent],
      ["fundingType", method.fundingType],
      ["entryType", method.entryType],
      ["transactionMethodShape", method.shape === "object" ? undefined : method.shape],
      ["operationNotStated", method.intent ? undefined : true],
      ["stageFrom", stageFrom],
      ["paymentFamily", familyOf(eventCode, method.fundingType)],
      ["localMethod", apmOf(eventCode)],
      ["cardScheme", card?.cardScheme ?? undefined],
      ["fundingDataShape", shape],
      ["cardVerificationCodeResult", verification(card?.cardVerificationCodeResult)],
      ["addressVerificationServiceResult", verification(card?.addressVerificationServiceResult)],
      ["nameVerificationResult", verification(card?.nameVerificationResult)],
      ...providerAttrs(card?.providerResponse, amount.currency),
      ...providerAttrs(d.providerResponse, amount.currency),
      ["apmProvider", pbb?.apmProvider ?? undefined],
      ["achStatus", codeOf(pbb?.achStatus)],
      ["isRtp", pbb?.isRtp ?? undefined],
      ["providerTransactionId", safeId(d.providerTransactionId)],
      ["originalSystemTransactionId", txnId(d.originalSystemTransactionId)],
      ["merchantOrderId", merchantRef(d.merchantOrderId)],
      ["amountField", amount.field],
      ["amountNotConvertible", amount.raw],
      ["timestampSource", timestampSource],
      [
        "merchantTransactionDateWithoutZone",
        hasNoZone(d.merchantTransactionDate) ? true : undefined,
      ],
      ["transactionUpdatedAt", pxpTime(d.transactionUpdateDatetime)],
      ["httpStatus", httpStatus],
    ]),
    source,
    ...observed,
  });
}

function authenticationEvent(
  d: z.infer<typeof EventData>,
  hook: WebhookCtx,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const stateField = d.authenticationState ? "authenticationState" : d.state ? "state" : undefined;
  const state = d.authenticationState ?? d.state ?? undefined;
  const info = state ? lookup(THREEDS_AUTH_STATES, state) : undefined;
  const transStatus =
    d.transactionStatus && lookup(THREEDS_TRANS_STATUS, d.transactionStatus)
      ? d.transactionStatus
      : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: CHALLENGE_COMPLETED_EVENT,
    eventTypeKnown: Boolean(info),
    stage: "authentication",
    providerStatus: state ? (safeText(state, 64) ?? undefined) : undefined,
    paymentReference: txnId(d.systemTransactionId),
    relatedReference: txnId(d.authenticationId),
    eventTimestamp: pxpTime(hook.eventDate),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs([
      ["eventCategory", hook.category],
      ["eventTypeInferred", true],
      ["eventTypeInferredFrom", "eventCategory authentication (no eventCode)"],
      ["authenticationState", state],
      ["authenticationStateField", stateField],
      ["transactionStatus", transStatus],
      [
        "transactionStatusMeaning",
        transStatus ? lookup(THREEDS_TRANS_STATUS, transStatus) : undefined,
      ],
      ["transactionStatusReason", twoDigit(d.transactionStatusReason)],
      ["challengeCancel", twoDigit(d.challengeCancel)],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "eventData" },
    ...observed,
  });
}

function webhookCtx(w: WebhookValue): WebhookCtx {
  const code = codeOf(w.eventData.eventCode, /^[A-Za-z0-9_-]{1,128}$/);
  return {
    category: w.eventCategory,
    eventDate: w.eventDate,
    ...(code ? { eventCode: code } : {}),
  };
}

function normalize(parsed: PxpParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "api_error") {
    const e = parsed.value;
    const httpStatus = ctx.meta?.http?.status;
    const details = (e.details ?? [])
      .filter((x): x is string => typeof x === "string")
      .slice(0, 10)
      .map((x) => safeText(x, 200) ?? "");
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `api_error.${codeOf(e.errorCode) ?? "unknown"}`,
        eventTypeKnown: true,
        stage: "error",
        providerStatus: httpStatus ? `HTTP ${httpStatus}` : (codeOf(e.errorCode) ?? undefined),
        outcome: "unknown",
        attributes: {
          ...attrs([
            ["errorCode", codeOf(e.errorCode)],
            ["errorReason", e.errorReason],
            ["correlationId", safeId(e.correlationId)],
            ["httpStatus", httpStatus],
          ]),
          ...(details.length ? { details } : {}),
        },
        source: { recordIndex: ctx.recordIndex, path: "" },
        ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
      }),
    ];
  }
  if (parsed.kind === "transaction_response") return [transactionEvent(parsed.value, ctx)];

  const w = parsed.value;
  const hook = webhookCtx(w);
  const category = w.eventCategory.toLowerCase();
  if (category === "authentication") return [authenticationEvent(w.eventData, hook, ctx)];
  if (category === "transaction") return [transactionEvent(w.eventData, ctx, hook)];
  // Undocumented or non-payment categories: shown without lifecycle semantics.
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: `${safeText(w.eventCategory, 64) ?? "unknown"}${hook.eventCode ? `.${hook.eventCode}` : ""}`,
      eventTypeKnown: false,
      stage: "other",
      paymentReference: txnId(w.eventData.systemTransactionId),
      eventTimestamp: pxpTime(w.eventDate),
      outcome: "unknown",
      attributes: attrs([
        ["eventCategory", w.eventCategory],
        ["eventCode", hook.eventCode],
      ]),
      source: { recordIndex: ctx.recordIndex, path: "eventData" },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
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

function codeEntryOf(
  code: string,
): (CodeEntry & { table: "card" | "apm_state" | "apm_error" }) | undefined {
  const card = lookup(CARD_CODES, code);
  if (card) return { ...card, table: "card" };
  const apm = lookup(APM_STATE_CODES, code);
  if (apm) return { ...apm, table: "apm_state" };
  const err = lookup(APM_ERROR_CODES, code);
  return err ? { ...err, table: "apm_error" } : undefined;
}

/** Decodes a transaction's normalized `stateData.code` with the raw provider fields. */
export function decodeStateCode(d: Txn, loc: Location): DecodedErrorDraft | undefined {
  const code = codeOf(d.stateData?.code);
  const state = typeof d.state === "string" ? d.state : undefined;
  const st = state ? lookup(TRANSACTION_STATES, state) : undefined;
  const entry = code ? codeEntryOf(code) : undefined;

  if (entry && entry.kind !== "decline") return undefined;
  // Without a decline code, only a documented failure state is an error.
  if (!entry && st?.outcome !== "failure") return undefined;

  const missing: string[] = [];
  const docs: DocumentationLink[] = [];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let explanation: string;

  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = entry.exampleDerived || category === "unknown" ? "possible" : "strong";
    explanation = `PXP code ${code}: ${entry.meaning}.`;
    if (entry.exampleDerived) {
      explanation +=
        " PXP publishes no definition table for this code; the meaning comes from the message paired with it in PXP examples.";
      docs.push({ title: "PXP webhooks (pay-by-bank examples)", url: ABOUT_WEBHOOKS_URL });
    } else if (code === "VAN0001") {
      docs.push({ title: "PXP merchant webhooks OpenAPI", url: WEBHOOK_API_URL });
    } else {
      docs.push({ title: "PXP card and APM response codes", url: HOW_IT_WORKS_URL });
    }
  } else {
    category = "unknown";
    retry = "unknown";
    confidence = "insufficient";
    explanation = code
      ? `The transaction is in state ${safeText(state, 64)} with code "${safeText(code, 32)}", which is not a documented PXP code.`
      : `The transaction is in state ${safeText(state, 64)}, but no stateData.code was supplied.`;
    missing.push(
      code
        ? `Code "${safeText(code, 32)}" is not in the PandaPayLens catalog.`
        : "No stateData.code was supplied, so the reason is unknown.",
    );
    docs.push({ title: "PXP transaction states", url: HOW_IT_WORKS_URL });
  }

  const subCodes: Record<string, string> = {};
  if (state) subCodes.state = safeText(state, 64) ?? "";
  const method = methodOf(d);
  if (method.intent) subCodes.intent = safeText(method.intent, 64) ?? "";
  const { card } = cardOf(d);
  const pr = card?.providerResponse;
  if (pr?.provider) subCodes.provider = safeText(pr.provider, 64) ?? "";
  const raw = codeOf(pr?.code);
  if (raw) {
    subCodes.provider_code = raw;
    missing.push(
      "The raw acquirer code in providerResponse.code is acquirer specific and not documented by PXP; it is shown but not interpreted.",
    );
  }
  const advice = twoDigit(pr?.merchantAdvice?.code);
  if (advice) {
    subCodes.merchant_advice_code = advice;
    missing.push(
      `Merchant advice code "${advice}" is shown but not interpreted; PXP publishes no list of these codes.`,
    );
  }
  const pbbCode = codeOf(d.providerResponse?.providerResponseCode);
  if (pbbCode) subCodes.provider_response_code = pbbCode;
  if (!loc.paymentReference)
    missing.push(
      "No systemTransactionId; the later state of this transaction cannot be checked from this record.",
    );

  const retryParts = [RETRY_TEXT[retry]];
  if (retry === "retry_conditionally")
    docs.push({ title: "PXP API overview (idempotency)", url: API_OVERVIEW_URL });
  const message = safeText(d.stateData?.message ?? undefined, 200);
  // Refused means the issuer or provider answered; timeouts and provider
  // errors leave the outcome of the original operation open.
  const outcomeKnown =
    state === "Refused" && category !== "network_or_timeout" && category !== "provider_unavailable";

  return {
    ...withRefs(loc),
    code: code ?? safeText(state, 64) ?? "unknown",
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
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

/** Decodes an API error envelope with the HTTP status when it is known. */
export function decodeApiError(
  e: z.infer<typeof ApiError>,
  httpStatus: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = codeOf(e.errorCode);
  const entry = code ? lookup(API_ERROR_CODES, code) : undefined;
  const status = httpStatus !== undefined ? lookup(HTTP_STATUSES, httpStatus) : undefined;
  const missing: string[] = [];
  const docs: DocumentationLink[] = [];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let explanation: string;

  if (entry) {
    ({ category, retry } = entry);
    // Seen only in PXP examples, so never more than possible.
    confidence = "possible";
    explanation = `PXP API error ${code}: ${entry.meaning}. PXP does not publish a list of errorCode values; this meaning comes from a PXP example shown with HTTP ${entry.httpStatus}.`;
    missing.push("PXP does not publish a list of API errorCode values.");
    docs.push({ title: "PXP OpenAPI error examples", url: entry.docsUrl });
  } else if (status && httpStatus !== undefined && httpStatus >= 400) {
    ({ category, retry } = status);
    confidence = "possible";
    explanation = `HTTP ${httpStatus} (${status.label}): ${status.meaning}. The errorCode "${safeText(e.errorCode, 64)}" is not in the PandaPayLens catalog.`;
    missing.push(`Error code "${safeText(e.errorCode, 64)}" is not in the PandaPayLens catalog.`);
    docs.push({ title: "PXP API overview (HTTP status codes)", url: API_OVERVIEW_URL });
  } else {
    category = "unknown";
    retry = "unknown";
    confidence = "insufficient";
    explanation = `PandaPayLens does not recognize the PXP error code "${safeText(e.errorCode, 64)}".`;
    missing.push(`Error code "${safeText(e.errorCode, 64)}" is not in the PandaPayLens catalog.`);
    if (httpStatus === undefined)
      missing.push("No HTTP status was supplied, so no fallback category is available.");
    docs.push({ title: "PXP API overview (HTTP status codes)", url: API_OVERVIEW_URL });
  }

  const subCodes: Record<string, string> = {};
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const correlation = safeId(e.correlationId);
  if (correlation) subCodes.correlation_id = correlation;
  if (retry === "retry_conditionally" && !docs.some((d) => d.url === API_OVERVIEW_URL))
    docs.push({ title: "PXP API overview (idempotency)", url: API_OVERVIEW_URL });
  const message = safeText(e.errorReason, 200);

  return {
    ...withRefs(loc),
    code: code ?? safeText(e.errorCode, 64) ?? "unknown",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence,
    documentation: docs,
    missingInformation: missing,
  };
}

function decodeAuthentication(
  d: z.infer<typeof EventData>,
  loc: Location,
): DecodedErrorDraft | undefined {
  const state = d.authenticationState ?? d.state ?? undefined;
  const info = state ? lookup(THREEDS_AUTH_STATES, state) : undefined;
  if (!info?.category || !info.retry || !state) return undefined;
  const subCodes: Record<string, string> = {};
  const missing: string[] = [];
  const trans = d.transactionStatus ?? undefined;
  if (trans && lookup(THREEDS_TRANS_STATUS, trans)) subCodes.trans_status = trans;
  const reason = twoDigit(d.transactionStatusReason);
  let explanation = `3DS authentication state ${state}: ${info.description}.`;
  if (reason) {
    subCodes.trans_status_reason = reason;
    const meaning = lookup(THREEDS_REASONS, reason);
    if (meaning) explanation += ` Reason ${reason}: ${meaning}.`;
    else
      missing.push(
        `3DS reason code "${reason}" is shown without a meaning in the PandaPayLens catalog.`,
      );
  }
  if (!loc.paymentReference)
    missing.push("3DS events carry no documented link to the card transaction.");
  return {
    ...withRefs(loc),
    code: state,
    subCodes,
    category: info.category,
    explanation,
    nextAction: NEXT_ACTION[info.category],
    retry: info.retry,
    retryExplanation:
      state === "AuthenticationError"
        ? `PXP says to retry the authentication once. ${RETRY_TEXT.retry_conditionally}`
        : RETRY_TEXT[info.retry],
    confidence: "strong",
    documentation: [{ title: "PXP 3DS authentication states", url: THREEDS_STATES_URL }],
    missingInformation: missing,
  };
}

function decodeErrors(parsed: PxpParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  if (parsed.kind === "api_error")
    return [
      decodeApiError(parsed.value, ctx.meta?.http?.status, { sourceFormat: ctx.format, source }),
    ];

  if (parsed.kind === "transaction_response") {
    const d = parsed.value;
    const refs = refsOf(d);
    const err = decodeStateCode(d, {
      sourceFormat: ctx.format,
      source,
      ...(refs.paymentReference ? { paymentReference: refs.paymentReference } : {}),
      ...(txnId(d.systemTransactionId) ? { attemptReference: txnId(d.systemTransactionId)! } : {}),
    });
    return err ? [err] : [];
  }

  const w = parsed.value;
  const category = w.eventCategory.toLowerCase();
  const loc = { sourceFormat: ctx.format, source: { ...source, path: "eventData" } };
  if (category === "authentication") {
    const pay = txnId(w.eventData.systemTransactionId);
    const err = decodeAuthentication(w.eventData, {
      ...loc,
      ...(pay ? { paymentReference: pay } : {}),
    });
    return err ? [err] : [];
  }
  if (category !== "transaction") return [];
  const d = w.eventData;
  const refs = refsOf(d);
  const sys = txnId(d.systemTransactionId);
  const err = decodeStateCode(d, {
    ...loc,
    ...(refs.paymentReference ? { paymentReference: refs.paymentReference } : {}),
    ...(sys ? { attemptReference: sys } : {}),
  });
  return err ? [err] : [];
}

export const pxpAdapter: ProviderAdapter<PxpParsed> = {
  id: PROVIDER,
  displayName: "PXP Financial",
  version: PXP_ADAPTER_VERSION,
  manifest: pxpManifest,
  supportedFormats: [
    {
      id: "pxp.transaction_response",
      description:
        "Transactions API v1 response or lookup item (state, stateData, systemTransactionId)",
    },
    {
      id: "pxp.api_error",
      description: "API error envelope ({ correlationId, details, errorCode, errorReason })",
    },
    {
      id: "pxp.webhook",
      description:
        "Merchant webhook (eventCategory, eventDate, eventData, eventOwner) for transaction and authentication events",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // systemTransactionId, and originalSystemTransactionId where PXP sends it
    // (Aeropay), or the 3DS authenticationId. merchantTransactionId and
    // merchantOrderId are merchant references and are never keys.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default pxpAdapter;
