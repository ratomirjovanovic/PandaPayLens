/**
 * Worldpay (Access Worldpay) adapter.
 *
 * Supported input families:
 * - `worldpay.event`             Events v1 webhook: `{ eventId, eventTimestamp, eventDetails }`
 *                                for the payment, payout and chargeback classifications
 * - `worldpay.payment_response`  Payments API (2024-06-01) and Card Payments v7 responses
 *                                (`outcome`, `paymentId`, `commandId`, `refusalCode`, ...);
 *                                Card Payments v6 names (`code`, `rawCode`, `refusalAdvice`)
 *                                are read as aliases
 * - `worldpay.error`             Shared error body: `{ errorName, message, validationErrors[] }`
 * - `worldpay.payment_query`     Payment Queries v1 payment: `lastEvent` and `events[]`
 * - `worldpay.card_payments_events_query`
 *                                Deprecated Card Payments v7 events query (Title Case `lastEvent`)
 *
 * XML (see xml.ts):
 * - `worldpay.wpg.reply`            WPG paymentService replies (error, orderStatus, ok)
 * - `worldpay.wpg.notification`     WPG order notifications (notify/orderStatusEvent)
 * - `worldpay.cnpapi.online_response`
 *                                cnpAPI cnpOnlineResponse with a card transaction response
 *
 * Recognized but not supported: other WPG documents (`worldpay.wpg`: requests,
 * reports, other replies) and other cnpAPI documents (`worldpay.cnpapi`: batch
 * files, requests, other transaction responses).
 *
 * `refusalCode` holds the Worldpay refusal code by default and the raw scheme
 * code when the merchant is configured for raw codes. Only Card Payments v7
 * (`gatewayRefusalCode`) and v6 (`code` + `rawCode`) say which is which, so a
 * lone `refusalCode` is decoded with that ambiguity in mind.
 */

import {
  currencyExponent,
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
  type ProviderAdapter,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  ADVICE_CODES,
  AMEX_RAW_CODES,
  CARD_PAYMENTS_LAST_EVENTS,
  ERROR_NAMES,
  ERROR_RESPONSES_URL,
  EVENTS_OPENAPI_URL,
  EXEMPTION_REASONS,
  EXEMPTION_RESULTS,
  FRAUD_OUTCOME,
  NEXT_ACTION,
  ONLINE_REFUNDS_URL,
  OUTCOMES,
  PAYMENTS_OPENAPI_URL,
  PAYMENT_QUERIES_URL,
  QUERY_EVENT_NAMES,
  RAW_SCHEME_CODES,
  REFUSAL_CODES,
  REFUSAL_CODES_URL,
  RETRY_TEXT,
  RISK_FACTOR_DETAILS,
  RISK_FACTOR_RISKS,
  RISK_FACTOR_TYPES,
  SCHEME_CODES_URL,
  TEST_ONLY_REFUSAL_CODES,
  V7_MIGRATION_URL,
  VISA_CATEGORIES,
  WEBHOOK_EVENT_TYPES,
  type CodeKind,
  type EventInfo,
  type RefusalEntry,
} from "./catalog.js";
import { worldpayManifest, WORLDPAY_ADAPTER_VERSION } from "./manifest.js";
import {
  CNP_FORMATS,
  DOCTYPE_HINT,
  WPG_FORMATS,
  XML_FORMATS,
  decodeXmlErrors,
  detectXml,
  normalizeXml,
  parseXmlRecord,
  type XmlParsed,
} from "./xml.js";

export { worldpayManifest, WORLDPAY_ADAPTER_VERSION };

const PROVIDER = "worldpay";

// Codes are documented as strings; some pasted payloads carry numbers.
const Code = z.union([z.string().max(32), z.number().int()]);
const Ref = z.string().max(256);
const Obj = z.looseObject({});

const RiskFactor = z.looseObject({
  type: z.string().max(64).optional(),
  risk: z.string().max(64).optional(),
  detail: z.string().max(64).optional(),
});

const PaymentResponse = z.looseObject({
  outcome: z.string().max(64),
  paymentId: Ref.optional(),
  commandId: Ref.optional(),
  transactionReference: Ref.optional(),
  refusalCode: Code.optional(),
  gatewayRefusalCode: Code.optional(),
  refusalDescription: z.string().optional(),
  advice: z.looseObject({ code: Code.optional() }).optional(),
  // Card Payments v6 names (renamed in v7).
  code: Code.optional(),
  description: z.string().optional(),
  rawCode: Code.optional(),
  refusalAdvice: z.looseObject({ code: Code.optional() }).optional(),
  riskFactors: z.array(RiskFactor).max(100).optional(),
  fraud: Obj.optional(),
  threeDS: Obj.optional(),
  authentication: Obj.optional(),
  exemption: Obj.optional(),
  amounts: Obj.optional(),
  paymentInstrument: Obj.optional(),
  issuer: Obj.optional(),
  score: z.number().optional(),
  reason: z.array(z.string().max(256)).max(50).optional(),
  _links: Obj.optional(),
  _actions: Obj.optional(),
});

const EventDetails = z.looseObject({
  classification: z.string().max(32).optional(),
  type: z.string().max(64),
  transactionReference: Ref.optional(),
  paymentId: Ref.optional(),
  commandId: Ref.optional(),
  orderReference: Ref.optional(),
  downstreamReference: Ref.optional(),
  reference: Ref.optional(),
  date: z.string().max(64).optional(),
  amount: z
    .looseObject({
      value: z.union([z.number(), z.string().max(32)]).optional(),
      currencyCode: z.string().max(8).optional(),
    })
    .optional(),
  riskFactors: z.array(RiskFactor).max(100).optional(),
  refund: z
    .looseObject({
      refusal: z
        .looseObject({ code: Code.optional(), description: z.string().optional() })
        .optional(),
    })
    .optional(),
  octReference: Ref.optional(),
  paymentInstrument: Obj.optional(),
  updatedPaymentInstrument: Obj.optional(),
  issuer: Obj.optional(),
});

const Webhook = z
  .looseObject({
    eventId: z.string().max(128).optional(),
    eventTimestamp: z.string().max(64).optional(),
    // tokenCreated adds these at the top level.
    eventType: z.string().max(64).optional(),
    notificationId: z.string().max(128).optional(),
    createdAt: z.string().max(64).optional(),
    eventDetails: EventDetails,
  })
  .refine((w) => w.eventId !== undefined || w.notificationId !== undefined, {
    message: "eventId is required",
    path: ["eventId"],
  });

const ValidationError = z.looseObject({
  errorName: z.string().max(128).optional(),
  message: z.string().optional(),
  jsonPath: z.string().max(512).optional(),
});

const ApiError = z.looseObject({
  errorName: z.string().max(128),
  message: z.string().optional(),
  validationErrors: z.array(ValidationError).max(200).optional(),
  headerName: z.string().max(128).optional(),
});

const QueryEvent = z.looseObject({
  eventName: z.string().max(128),
  timestamp: z.string().max(64).optional(),
  commandId: Ref.optional(),
  code: Code.optional(),
  description: z.string().optional(),
  outcome: z.string().max(64).optional(),
  error: z
    .looseObject({ name: z.string().max(128).optional(), message: z.string().optional() })
    .optional(),
});

const PaymentQuery = z
  .looseObject({
    paymentId: Ref.optional(),
    transactionReference: Ref.optional(),
    lastEvent: z.string().max(128).optional(),
    events: z.array(QueryEvent).max(1000).optional(),
  })
  .refine((p) => p.lastEvent !== undefined || p.events !== undefined, {
    message: "lastEvent or events is required",
    path: ["events"],
  });

const CardEventsQuery = z.looseObject({
  lastEvent: z.string().max(64),
  _links: Obj.optional(),
});

type PaymentResponseFields = z.infer<typeof PaymentResponse>;

export type WorldpayParsed =
  | { kind: "event"; value: z.infer<typeof Webhook> }
  | { kind: "payment_response"; value: PaymentResponseFields }
  | { kind: "error"; value: z.infer<typeof ApiError> }
  | { kind: "payment_query"; value: z.infer<typeof PaymentQuery> }
  | { kind: "card_payments_events_query"; value: z.infer<typeof CardEventsQuery> }
  | XmlParsed;

const FORMATS = {
  "worldpay.event": ["event", Webhook],
  "worldpay.payment_response": ["payment_response", PaymentResponse],
  "worldpay.error": ["error", ApiError],
  "worldpay.payment_query": ["payment_query", PaymentQuery],
  "worldpay.card_payments_events_query": ["card_payments_events_query", CardEventsQuery],
} as const;

/** Documented pattern of paymentId and commandId (Card Payments v7 schema). */
const WORLDPAY_ID = /^[A-Za-z0-9_-]{21,36}$/;
const CLASSIFICATIONS = new Set(["payment", "payout", "chargeback"]);
const ACTION_KEYS = new Set([
  "settlePayment",
  "cancelPayment",
  "partiallySettlePayment",
  "partiallyCancelPayment",
  "reversePayment",
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const isWorldpayId = (v: unknown) => typeof v === "string" && WORLDPAY_ID.test(v);

/** A short refusal, advice or raw code from a string or an integer. */
function codeOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return String(v);
  return typeof v === "string" && /^[0-9A-Za-z]{1,20}$/.test(v.trim()) ? v.trim() : undefined;
}

/** Advice codes are two digits; an integer 1 means "01". */
function adviceCodeOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 100)
    return String(v).padStart(2, "0");
  return codeOf(v);
}

/** HAL links namespaced by the Card Payments (`cardPayments:`) or Payments (`payments:`) curies. */
function hasWorldpayLinks(links: unknown): boolean {
  if (!isObj(links)) return false;
  return Object.keys(links).some(
    (k) => k === "curies" || k.startsWith("cardPayments:") || k.startsWith("payments:"),
  );
}

function hasActions(actions: unknown): boolean {
  return isObj(actions) && Object.keys(actions).some((k) => ACTION_KEYS.has(k));
}

function riskFactorList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((f) => isObj(f) && typeof f.type === "string" && typeof f.risk === "string")
  );
}

function eventInfo(classification: string | undefined, type: string): EventInfo | undefined {
  if (classification !== undefined) {
    if (!CLASSIFICATIONS.has(classification)) return undefined;
    return lookup(WEBHOOK_EVENT_TYPES[classification as keyof typeof WEBHOOK_EVENT_TYPES], type);
  }
  // Without a classification, only a type that exists in one table is known
  // (payout and payment events share "refused").
  const hits = Object.values(WEBHOOK_EVENT_TYPES)
    .map((t) => lookup(t, type))
    .filter((x): x is EventInfo => Boolean(x));
  return hits.length === 1 ? hits[0] : undefined;
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

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
  // An XML document (or XML HTTP body) is only read as WPG or cnpAPI.
  if (meta?.xml) return detectXml(input, meta.xml) ?? none;
  // Stripe objects carry `object`; Access Worldpay bodies never do.
  if ("object" in input) return none;

  if (typeof input.errorName === "string") {
    const reasons = ["has errorName"];
    let score = 0.35;
    if (typeof input.message === "string") {
      score += 0.2;
      reasons.push("has message");
    }
    if (lookup(ERROR_NAMES, input.errorName)) {
      score += 0.25;
      reasons.push(`errorName "${input.errorName}" is a documented Worldpay error name`);
    }
    const ve = input.validationErrors;
    if (
      Array.isArray(ve) &&
      ve.length > 0 &&
      ve.every((e) => isObj(e) && typeof e.errorName === "string")
    ) {
      score += 0.1;
      reasons.push("has validationErrors with errorName entries");
      if (ve.some((e) => isObj(e) && typeof e.jsonPath === "string" && /^[$/]/.test(e.jsonPath)))
        score += 0.05;
    }
    if (typeof input.headerName === "string") score += 0.05;
    if ((meta?.http?.status ?? 0) >= 400) score += 0.05;
    return {
      ...base,
      format: "worldpay.error",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  if (isObj(input.eventDetails)) {
    const d = input.eventDetails;
    const reasons = ["has eventDetails"];
    let score = 0.2;
    if (typeof input.eventId === "string") {
      score += 0.15;
      reasons.push("has eventId");
    }
    if (typeof input.eventTimestamp === "string") {
      score += 0.1;
      reasons.push("has eventTimestamp");
    }
    const cls = str(d.classification);
    if (cls && CLASSIFICATIONS.has(cls)) {
      score += 0.25;
      reasons.push(`eventDetails.classification is "${cls}"`);
    }
    if (typeof d.type === "string") {
      if (eventInfo(cls, d.type)) {
        score += 0.15;
        reasons.push(`eventDetails.type "${d.type}" is a documented event type`);
      } else score += 0.05;
    }
    if (
      typeof input.eventType === "string" &&
      typeof input.notificationId === "string" &&
      typeof input.createdAt === "string"
    ) {
      score += 0.2;
      reasons.push("has the tokenCreated envelope (eventType, notificationId, createdAt)");
    }
    const links = d._links;
    if (isObj(links) && isObj(links.payment) && typeof links.payment.href === "string")
      score += 0.05;
    if (score > 0.4 && meta?.http?.headers["event-signature"] !== undefined) {
      score += 0.05;
      reasons.push("has an Event-Signature header");
    }
    return {
      ...base,
      format: "worldpay.event",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  if (Array.isArray(input.events) && input.events.length > 0) {
    const events = input.events;
    if (events.every((e) => isObj(e) && typeof e.eventName === "string")) {
      const list = events as Record<string, unknown>[];
      const reasons = ["has an events array with eventName entries"];
      let score = 0.3;
      if (list.some((e) => lookup(QUERY_EVENT_NAMES, e.eventName as string))) {
        score += 0.3;
        reasons.push("events[].eventName values are documented Payment Queries event names");
      }
      if (list.some((e) => typeof e.timestamp === "string")) score += 0.1;
      if (list.some((e) => isWorldpayId(e.commandId))) {
        score += 0.1;
        reasons.push("events carry commandId");
      }
      if (typeof input.lastEvent === "string" && lookup(QUERY_EVENT_NAMES, input.lastEvent)) {
        score += 0.15;
        reasons.push("lastEvent is a documented Payment Queries event name");
      }
      if (isWorldpayId(input.paymentId)) score += 0.05;
      return {
        ...base,
        format: "worldpay.payment_query",
        confidence: round(score),
        supported: true,
        reasons,
      };
    }
  }

  if (typeof input.lastEvent === "string" && !("outcome" in input)) {
    if (lookup(QUERY_EVENT_NAMES, input.lastEvent)) {
      const withId = isWorldpayId(input.paymentId);
      return {
        ...base,
        format: "worldpay.payment_query",
        confidence: withId ? 0.55 : 0.45,
        supported: true,
        reasons: [
          "lastEvent is a documented Payment Queries event name",
          ...(withId ? ["has a paymentId"] : []),
        ],
      };
    }
    if (lookup(CARD_PAYMENTS_LAST_EVENTS, input.lastEvent)) {
      const links = hasWorldpayLinks(input._links);
      return {
        ...base,
        format: "worldpay.card_payments_events_query",
        confidence: links ? 0.75 : 0.45,
        supported: true,
        reasons: [
          "lastEvent is a documented Card Payments events query value",
          ...(links ? ["_links use the cardPayments or payments curies"] : []),
        ],
      };
    }
    return none;
  }

  if (typeof input.outcome === "string") {
    const known = Boolean(lookup(OUTCOMES, input.outcome));
    const reasons = [
      known ? `outcome "${input.outcome}" is a documented Worldpay outcome` : "has outcome",
    ];
    let score = 0;
    if (isWorldpayId(input.commandId)) {
      score += 0.25;
      reasons.push("has a commandId");
    }
    if (codeOf(input.refusalCode) && typeof input.refusalDescription === "string") {
      score += 0.2;
      reasons.push("has refusalCode and refusalDescription");
    }
    if (codeOf(input.gatewayRefusalCode)) {
      score += 0.1;
      reasons.push("has gatewayRefusalCode");
    }
    if (isObj(input.advice) && adviceCodeOf(input.advice.code)) score += 0.05;
    if (isObj(input.refusalAdvice) || codeOf(input.rawCode) !== undefined) {
      score += 0.15;
      reasons.push("has Card Payments v6 refusal fields");
    } else if (
      input.outcome === "refused" &&
      codeOf(input.code) &&
      typeof input.description === "string" &&
      input.refusalCode === undefined
    ) {
      score += 0.1;
    }
    if (riskFactorList(input.riskFactors)) {
      score += 0.1;
      reasons.push("has riskFactors");
    }
    if (hasWorldpayLinks(input._links)) {
      score += 0.15;
      reasons.push("_links use the cardPayments or payments curies");
    }
    if (hasActions(input._actions)) {
      score += 0.15;
      reasons.push("_actions name documented payment actions");
    }
    if (
      isObj(input.fraud) &&
      typeof input.fraud.outcome === "string" &&
      FRAUD_OUTCOME.test(input.fraud.outcome)
    )
      score += 0.05;
    // paymentId alone is shared with other providers; it only adds to a match.
    if (score > 0 && isWorldpayId(input.paymentId)) {
      score += 0.15;
      reasons.push("has a paymentId");
    }
    if (score === 0) {
      return known && isWorldpayId(input.paymentId)
        ? {
            ...base,
            format: "worldpay.payment_response",
            confidence: 0.45,
            supported: true,
            reasons: [...reasons, "has a paymentId"],
          }
        : none;
    }
    return {
      ...base,
      format: "worldpay.payment_response",
      confidence: round((known ? 0.3 : 0.15) + score),
      supported: true,
      reasons,
    };
  }

  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: WorldpayParsed } | { ok: false; issues: string[] } {
  if (XML_FORMATS.includes(format)) return parseXmlRecord(input, format);
  const entry = lookup(FORMATS, format);
  if (!entry) return { ok: false, issues: [`Unsupported Worldpay format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as WorldpayParsed };
}

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

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, x]) => x !== undefined),
  ) as NormalizedEventDraft;
}

/** riskFactors as "type:detail:risk" strings, documented values only. */
function riskFactorsAttr(list: z.infer<typeof RiskFactor>[] | undefined): string[] | undefined {
  if (!list?.length) return undefined;
  return list.map((f) => {
    const type = f.type && RISK_FACTOR_TYPES.has(f.type) ? f.type : "unrecognized";
    const risk = f.risk && RISK_FACTOR_RISKS.has(f.risk) ? f.risk : "unrecognized";
    const detail = f.detail && RISK_FACTOR_DETAILS.has(f.detail) ? `:${f.detail}` : "";
    return `${type}${detail}:${risk}`;
  });
}

/** Non-sensitive descriptors of the payment instrument. Card digits, expiry and names are never read. */
function instrumentAttrs(pi: Record<string, unknown> | undefined): [string, AttrValue][] {
  const word = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9_+/.-]{1,40}$/.test(v) ? v : undefined;
  return [
    ["paymentInstrumentType", word(pi?.type)],
    ["cardBrand", word(pi?.cardBrand)],
    ["fundingType", word(pi?.fundingType)],
    ["apmMethod", word(pi?.method)],
  ];
}

const keysOf = (o: Record<string, unknown> | undefined, filter: (k: string) => boolean) => {
  const keys = o ? Object.keys(o).filter((k) => filter(k) && /^[A-Za-z:]{1,64}$/.test(k)) : [];
  return keys.length ? keys : undefined;
};

/** Which Access API produced a payment response, from documented markers only. */
function apiFamilyOf(r: PaymentResponseFields): string {
  if (r.refusalCode === undefined && (r.refusalAdvice !== undefined || r.rawCode !== undefined))
    return "card_payments_v6";
  if (
    r.gatewayRefusalCode !== undefined ||
    r.outcome === "Sent for Settlement" ||
    (r._links && Object.keys(r._links).some((k) => k.startsWith("cardPayments:")))
  )
    return "card_payments_v7";
  if (
    r._actions !== undefined ||
    r.transactionReference !== undefined ||
    (r._links && Object.keys(r._links).some((k) => k.startsWith("payments:"))) ||
    lookup(OUTCOMES, r.outcome)?.apis === "payments"
  )
    return "payments";
  return "unknown";
}

function threeDsAttrs(r: PaymentResponseFields): [string, AttrValue][] {
  const src = r.threeDS ?? r.authentication;
  const outcome = str(src?.outcome);
  const issuer = str(src?.issuerResponse);
  const version = str(src?.version);
  return [
    [
      "threeDSOutcome",
      outcome === "authenticated" || outcome === "authenticationOutage" ? outcome : undefined,
    ],
    [
      "threeDSIssuerResponse",
      issuer === "frictionless" || issuer === "challenged" ? issuer : undefined,
    ],
    ["threeDSVersion", version && /^\d(?:\.\d{1,2}){1,2}$/.test(version) ? version : undefined],
  ];
}

function exemptionAttrs(ex: Record<string, unknown> | undefined): [string, AttrValue][] {
  const word = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z]{1,40}$/.test(v) ? v : undefined;
  const result = str(ex?.result);
  const reason = str(ex?.reason);
  return [
    ["exemptionPlacement", word(ex?.placement)],
    ["exemptionType", word(ex?.type)],
    ["exemptionResult", result && EXEMPTION_RESULTS.has(result) ? result : undefined],
    ["exemptionReason", reason && EXEMPTION_REASONS.has(reason) ? reason : undefined],
  ];
}

function amountsAttrs(a: Record<string, unknown> | undefined): [string, AttrValue][] {
  if (!a) return [];
  const requested = minorUnits(a.requested);
  const total = minorUnits(a.totalAuthorized);
  const partial =
    typeof a.partialAuthorization === "boolean"
      ? a.partialAuthorization
      : requested && total && /^\d+$/.test(requested) && /^\d+$/.test(total)
        ? BigInt(total) < BigInt(requested)
        : undefined;
  return [
    ["amountsRequested", requested],
    ["amountsTotalAuthorized", total],
    ["amountsCurrency", upperCurrency(a.currency)],
    ["partialAuthorization", partial],
  ];
}

function signaturePresent(meta: RecordMeta | undefined): boolean | undefined {
  return meta?.http?.headers["event-signature"] !== undefined ? true : undefined;
}

function normalize(parsed: WorldpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "wpg" || parsed.kind === "cnp") return normalizeXml(parsed, ctx);
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const httpStatus = ctx.meta?.http?.status;

  if (parsed.kind === "error") {
    const e = parsed.value;
    const name = safeText(e.errorName, 128) ?? "unknown";
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `error.${name}`,
        eventTypeKnown: Boolean(lookup(ERROR_NAMES, e.errorName)),
        stage: "error",
        providerStatus: httpStatus ? `HTTP ${httpStatus}` : name,
        // A 4xx request was rejected; a 5xx or missing status leaves the outcome open.
        outcome:
          httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500 ? "failure" : "unknown",
        attributes: attrs([
          ["errorName", e.errorName],
          ["httpStatus", httpStatus],
          ["headerName", e.headerName],
          [
            "validationErrorNames",
            e.validationErrors?.map((x) => x.errorName ?? "unknown").slice(0, 50),
          ],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    const info = lookup(OUTCOMES, r.outcome);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `payment_response.${safeText(r.outcome, 64) ?? "unknown"}`,
        eventTypeKnown: Boolean(info),
        stage: info?.stage ?? "payment",
        providerStatus: safeText(r.outcome, 64),
        paymentReference: safeId(r.paymentId),
        relatedReference: safeId(r.commandId),
        merchantReference: merchantRef(r.transactionReference),
        outcome: info?.outcome ?? "unknown",
        attributes: attrs([
          ["apiFamily", apiFamilyOf(r)],
          ["httpStatus", httpStatus],
          ["refusalCode", codeOf(r.refusalCode)],
          ["gatewayRefusalCode", codeOf(r.gatewayRefusalCode)],
          ["refusalDescription", r.refusalDescription],
          ["adviceCode", adviceCodeOf(r.advice?.code) ?? adviceCodeOf(r.refusalAdvice?.code)],
          ["v6Code", r.refusalCode === undefined ? codeOf(r.code) : undefined],
          ["v6RawCode", codeOf(r.rawCode)],
          ["riskFactors", riskFactorsAttr(r.riskFactors)],
          [
            "fraudOutcome",
            typeof r.fraud?.outcome === "string" && FRAUD_OUTCOME.test(r.fraud.outcome)
              ? r.fraud.outcome
              : undefined,
          ],
          ["fraudScore", typeof r.fraud?.score === "number" ? r.fraud.score : r.score],
          [
            "fraudReasons",
            r.reason?.map((x) => safeId(x, 64)).filter((x): x is string => Boolean(x)),
          ],
          ...threeDsAttrs(r),
          ...exemptionAttrs(r.exemption),
          ...amountsAttrs(r.amounts),
          ...instrumentAttrs(r.paymentInstrument),
          [
            "issuerAuthorizationCodePresent",
            r.issuer?.authorizationCode !== undefined ? true : undefined,
          ],
          ["availableActions", keysOf(r._actions, (k) => ACTION_KEYS.has(k))],
          [
            "links",
            keysOf(r._links, (k) => k.startsWith("cardPayments:") || k.startsWith("payments:")),
          ],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "payment_query") {
    const p = parsed.value;
    const paymentReference = safeId(p.paymentId);
    const merchantReference = merchantRef(p.transactionReference);
    const lastEvent = safeText(p.lastEvent, 64);
    if (!p.events?.length) {
      const info = p.lastEvent ? lookup(QUERY_EVENT_NAMES, p.lastEvent) : undefined;
      return [
        clean({
          sourceFormat: ctx.format,
          eventType: lastEvent ?? "unknown",
          eventTypeKnown: Boolean(info),
          stage: info?.stage ?? "other",
          providerStatus: lastEvent,
          paymentReference,
          merchantReference,
          outcome: info?.outcome ?? "unknown",
          attributes: attrs([
            ["lastEvent", lastEvent],
            ["httpStatus", httpStatus],
          ]),
          source,
          ...observed,
        }),
      ];
    }
    return p.events.map((e, i) => {
      const info = lookup(QUERY_EVENT_NAMES, e.eventName);
      const name = safeText(e.eventName, 64) ?? "unknown";
      return clean({
        sourceFormat: ctx.format,
        eventType: name,
        eventTypeKnown: Boolean(info),
        stage: info?.stage ?? "other",
        providerStatus: name,
        paymentReference,
        relatedReference: safeId(e.commandId),
        merchantReference,
        eventTimestamp: toIsoTimestamp(e.timestamp),
        outcome: info?.outcome ?? "unknown",
        attributes: attrs([
          ["code", codeOf(e.code)],
          ["description", e.description],
          ["queryOutcome", safeId(e.outcome, 64)],
          ["errorName", safeId(e.error?.name, 128)],
          ["lastEvent", lastEvent],
          ["historyIndex", i],
          ["httpStatus", httpStatus],
        ]),
        source: { recordIndex: ctx.recordIndex, path: `events[${i}]` },
        ...observed,
      });
    });
  }

  if (parsed.kind === "card_payments_events_query") {
    const q = parsed.value;
    const info = lookup(CARD_PAYMENTS_LAST_EVENTS, q.lastEvent);
    const name = safeText(q.lastEvent, 64) ?? "unknown";
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: name,
        eventTypeKnown: Boolean(info),
        stage: info?.stage ?? "other",
        providerStatus: name,
        outcome: info?.outcome ?? "unknown",
        attributes: attrs([
          ["lastEvent", name],
          ["httpStatus", httpStatus],
        ]),
        source,
        ...observed,
      }),
    ];
  }

  const w = parsed.value;
  const d = w.eventDetails;
  const info = eventInfo(d.classification, d.type);
  const eventId = safeId(w.eventId) ?? safeId(w.notificationId);
  const eventTimestamp = toIsoTimestamp(w.eventTimestamp) ?? toIsoTimestamp(w.createdAt);
  const currency = upperCurrency(d.amount?.currencyCode);
  const value = minorUnits(d.amount?.value);
  // Events document amount.value with an exponent of 2; other currencies are
  // shown as supplied instead of being guessed.
  const exponentTwo = currency !== undefined && currencyExponent(currency) === 2;
  const refusal = d.refund?.refusal;
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: safeText(d.type, 64) ?? "unknown",
      eventTypeKnown: Boolean(info),
      stage: info?.stage ?? "other",
      providerStatus: safeText(d.type, 64),
      eventReference: eventId,
      // Whether a retried delivery keeps its eventId is not documented.
      deliveryKey: eventId,
      paymentReference: safeId(d.paymentId),
      relatedReference: safeId(d.commandId),
      merchantReference: merchantRef(d.transactionReference),
      eventTimestamp,
      amountMinor: exponentTwo ? value : undefined,
      currency,
      outcome: info?.outcome ?? "unknown",
      attributes: attrs([
        ["classification", safeId(d.classification, 32)],
        ["eventTimestampAsSent", eventTimestamp ? undefined : safeText(w.eventTimestamp, 40)],
        ["notificationEventType", safeId(w.eventType, 64)],
        ["paymentDate", d.date && ISO_DATE.test(d.date) ? d.date : undefined],
        ["downstreamReference", safeId(d.downstreamReference)],
        ["orderReference", merchantRef(d.orderReference)],
        ["requestReference", merchantRef(d.reference)],
        ["octReference", safeId(d.octReference)],
        ["amountValue", exponentTwo ? undefined : value],
        ["riskFactors", riskFactorsAttr(d.riskFactors)],
        ...instrumentAttrs(d.paymentInstrument),
        [
          "appliedNetworkToken",
          typeof d.updatedPaymentInstrument?.appliedNetworkToken === "boolean"
            ? d.updatedPaymentInstrument.appliedNetworkToken
            : undefined,
        ],
        [
          "issuerAuthorizationCodePresent",
          d.issuer?.authorizationCode !== undefined ? true : undefined,
        ],
        [
          "onlineRefundAuthorization",
          isObj(d.refund) && d.refund.onlineRefundAuthorization !== undefined ? true : undefined,
        ],
        ["refundRefusalCode", codeOf(refusal?.code)],
        ["refundRefusalDescription", refusal?.description],
        ["signatureHeaderPresent", signaturePresent(ctx.meta)],
      ]),
      source,
      ...observed,
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

type RawReading = {
  category: ErrorCategory;
  retry: RetryGuidance;
  kind: CodeKind;
  /** Scheme texts, for example "Visa: Do not honor (category 4)". */
  readings: string[];
  /** The suggested meaning differs by scheme (or between Amex and the other schemes). */
  schemeDependent: boolean;
  schemeNote?: string;
  visaCategory?: string;
};

/** Reading of a code in the raw scheme tables (Visa, Mastercard, Discover, Amex). */
export function rawReading(code: string): RawReading | undefined {
  const g = lookup(RAW_SCHEME_CODES, code);
  const a = lookup(AMEX_RAW_CODES, code);
  if (!g && !a) return undefined;
  const readings: string[] = [];
  if (g?.visa)
    readings.push(
      `Visa: ${g.visa}${g.visaCategory && g.visaCategory !== "n/a" ? ` (${g.visaCategory === "approval" ? "approval" : `category ${g.visaCategory}`})` : ""}`,
    );
  if (g?.mastercard) readings.push(`Mastercard: ${g.mastercard}`);
  if (g?.discover) readings.push(`Discover: ${g.discover}`);
  if (a) readings.push(`American Express: ${a.meaning}`);
  const primary = g ?? a!;
  const amexDiffers = Boolean(g && a && (g.kind !== a.kind || g.category !== a.category));
  return {
    category: primary.category,
    retry: primary.retry,
    kind: primary.kind,
    readings,
    // Amex categories are derived from the other schemes' rows, so an
    // Amex-only reading is never stronger than possible.
    schemeDependent: Boolean(g?.schemeNote) || amexDiffers || !g,
    ...(g?.schemeNote ? { schemeNote: g.schemeNote } : {}),
    ...(g?.visaCategory ? { visaCategory: g.visaCategory } : {}),
  };
}

function worldpayEntry(code: string): { entry: RefusalEntry; testOnly: boolean } | undefined {
  const ref = lookup(REFUSAL_CODES, code);
  if (ref) return { entry: ref, testOnly: false };
  const test = lookup(TEST_ONLY_REFUSAL_CODES, code);
  return test ? { entry: test, testOnly: true } : undefined;
}

/** Worldpay codes are unpadded numbers; "05" or "N7" can only be raw codes. */
const cannotBeWorldpayCode = (code: string) => /^0\d$/.test(code) || /[A-Za-z]/.test(code);

function kindText(kind: CodeKind): string {
  if (kind === "approval") return " This is an approval code, not a decline.";
  if (kind === "partial") return " This code reports a partial approval.";
  if (kind === "reserved") return " The scheme lists this code as reserved.";
  return "";
}

function visaCategoryText(cat: string | undefined): string[] {
  if (!cat) return [];
  return cat
    .split(",")
    .map((c) => lookup(VISA_CATEGORIES, c.trim()))
    .filter((x): x is string => Boolean(x));
}

export type RefusalInput = {
  /** `refusalCode`, `refund.refusal.code` or Payment Queries `events[].code`. */
  refusalCode?: string;
  /** Card Payments v7 `gatewayRefusalCode` (the Worldpay code when raw codes are enabled). */
  gatewayCode?: string;
  /** Card Payments v6 `code` (Worldpay code) and `rawCode`. */
  v6Code?: string;
  v6RawCode?: string;
  description?: string;
  adviceCode?: string;
  exemptionReason?: string;
  /** What was refused, for the explanation. */
  subject: "payment" | "refund";
};

/** Decodes a Worldpay refusal, keeping the Worldpay-code versus raw-code question open where it is. */
export function decodeRefusal(input: RefusalInput, loc: Location): DecodedErrorDraft {
  const docs: DocumentationLink[] = [{ title: "Worldpay refusal codes", url: REFUSAL_CODES_URL }];
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  const notes: string[] = [];
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "unknown";
  let confidence: Confidence = "insufficient";
  let explanation: string;
  let code: string | undefined;

  const explicitWorldpay = input.gatewayCode ?? input.v6Code;
  const explicitRaw = input.gatewayCode !== undefined ? input.refusalCode : input.v6RawCode;
  const what = input.subject === "refund" ? "refund" : "payment";

  const useRaw = (c: string, reading: RawReading, strong: boolean) => {
    category = reading.category;
    retry = reading.retry;
    confidence = strong ? "strong" : "possible";
    subCodes.code_table = "raw_scheme";
    if (reading.visaCategory) subCodes.visa_category = reading.visaCategory;
    docs.push({ title: "Worldpay raw scheme response codes", url: SCHEME_CODES_URL });
    notes.push(...visaCategoryText(reading.visaCategory));
    return `Raw scheme response code ${c}: ${reading.readings.join("; ")}.${reading.schemeNote ? ` ${reading.schemeNote}` : ""}${kindText(reading.kind)}`;
  };

  if (explicitWorldpay !== undefined) {
    code = explicitWorldpay;
    subCodes.code_table = "worldpay";
    if (input.gatewayCode !== undefined) subCodes.gateway_refusal_code = input.gatewayCode;
    const wp = worldpayEntry(explicitWorldpay);
    const raw = explicitRaw !== undefined ? rawReading(explicitRaw) : undefined;
    if (explicitRaw !== undefined) subCodes.raw_code = explicitRaw;
    if (wp) {
      category = wp.entry.category;
      retry = wp.entry.retry;
      confidence = wp.testOnly ? "possible" : "strong";
      explanation = `Worldpay refusal code ${explicitWorldpay}: ${wp.entry.meaning}.${wp.entry.note ? ` ${wp.entry.note}` : ""}${kindText(wp.entry.kind)}`;
      if (wp.testOnly)
        missing.push(`Code ${explicitWorldpay} appears only on Worldpay's testing pages.`);
    } else if (raw && explicitRaw !== undefined) {
      explanation = `Worldpay refusal code ${explicitWorldpay} is not in the documented table. ${useRaw(explicitRaw, raw, false)}`;
      subCodes.code_table = "raw_scheme";
      missing.push(`Worldpay refusal code "${explicitWorldpay}" is not documented.`);
    } else {
      explanation = `Worldpay refusal code "${explicitWorldpay}" is not in the documented table.`;
      missing.push(`Worldpay refusal code "${explicitWorldpay}" is not documented.`);
    }
    if (wp && explicitRaw !== undefined) {
      explanation += raw
        ? ` The raw scheme code is ${explicitRaw} (${raw.readings.join("; ")}).`
        : ` The raw scheme code ${explicitRaw} is not in Worldpay's raw code tables.`;
      if (raw) docs.push({ title: "Worldpay raw scheme response codes", url: SCHEME_CODES_URL });
    }
  } else if (input.refusalCode !== undefined) {
    const c = input.refusalCode;
    code = c;
    const wp = worldpayEntry(c);
    const raw = rawReading(c);
    const rawOnly = cannotBeWorldpayCode(c);
    if (wp && !rawOnly) {
      category = wp.entry.category;
      retry = wp.entry.retry;
      subCodes.code_table = wp.testOnly ? "worldpay_test" : "worldpay";
      explanation = `Worldpay refusal code ${c}: ${wp.entry.meaning}.${wp.entry.note ? ` ${wp.entry.note}` : ""}${kindText(wp.entry.kind)}`;
      if (wp.testOnly) {
        confidence = "possible";
        missing.push(`Code ${c} appears only on Worldpay's testing pages.`);
      } else if (raw && (raw.category !== wp.entry.category || raw.kind !== wp.entry.kind)) {
        confidence = "possible";
        explanation += ` If this merchant receives raw scheme codes, ${c} would instead mean: ${raw.readings.join("; ")}.`;
        docs.push({ title: "Worldpay raw scheme response codes", url: SCHEME_CODES_URL });
        missing.push(
          "Whether refusalCode carries the Worldpay code or the raw scheme code depends on the merchant's configuration, which the payload does not show.",
        );
      } else {
        confidence = "strong";
      }
    } else if (raw) {
      explanation = useRaw(c, raw, rawOnly && !raw.schemeDependent && raw.kind === "decline");
      if (!rawOnly || raw.schemeDependent)
        missing.push("The card scheme of this raw code is not in the payload.");
    } else {
      subCodes.code_table = "unknown";
      explanation = `Refusal code "${c}" is in neither Worldpay's refusal table nor its raw scheme code tables. Worldpay notes that both lists may be incomplete and that raw codes from third-party acquirers may not be listed.`;
      missing.push(`Refusal code "${c}" is not documented.`);
    }
  } else {
    explanation = `The ${what} was refused, but no refusal code was supplied.`;
    missing.push("No refusalCode was supplied, so the reason for the refusal is unknown.");
  }

  // Refusal advice codes are Worldpay's own retry guidance and take precedence.
  const retryParts: string[] = [];
  if (input.adviceCode !== undefined) {
    subCodes.advice_code = input.adviceCode;
    const advice = lookup(ADVICE_CODES, input.adviceCode);
    if (advice) {
      retry = advice.retry;
      retryParts.push(
        `Worldpay refusal advice code ${input.adviceCode} (${advice.scenario}): ${advice.advice}`,
      );
    } else {
      missing.push(`Refusal advice code "${input.adviceCode}" is not documented.`);
    }
  }
  if (input.exemptionReason) {
    subCodes.exemption_reason = input.exemptionReason;
    if (input.exemptionReason === "issuerRejected" && code === "65")
      notes.push(
        "The issuer rejected the SCA exemption; Worldpay documents that the payment may be retried with 3DS authentication.",
      );
  }
  // A refusal is final for this attempt, so the generic advice to check
  // whether the operation took effect does not apply.
  retryParts.push(
    ...notes,
    retry === "retry_conditionally"
      ? "This attempt was refused; a new attempt may succeed later, within the scheme's retry limits."
      : RETRY_TEXT[retry],
  );
  if (!loc.paymentReference)
    missing.push(
      "No paymentId; the later state of this payment cannot be checked from this record.",
    );

  const message = safeText(input.description, 200);
  return {
    ...withRefs(loc),
    code: code ?? "refused",
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
    // A refusal is a definitive answer from Worldpay, the scheme or the issuer.
    outcomeKnown: true,
  };
}

type ErrorNameOptions = {
  message?: string;
  jsonPath?: string;
  headerName?: string;
  parentName?: string;
  /** A failed event in Payment Queries records a final failure of that step. */
  fromQueryHistory?: boolean;
};

/** Decodes an `errorName` (top level, inside validationErrors, or a Payment Queries `error.name`). */
export function decodeErrorName(
  name: string | undefined,
  httpStatus: number | undefined,
  loc: Location,
  opts: ErrorNameOptions = {},
): DecodedErrorDraft {
  const entry = name ? lookup(ERROR_NAMES, name) : undefined;
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let explanation: string;

  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = "strong";
    explanation = `Worldpay errorName ${name}: ${entry.meaning}.${entry.note ? ` ${entry.note}` : ""}`;
    subCodes.documented_http = entry.http;
  } else {
    const s = httpStatus ?? 0;
    if (s === 401 || s === 403) {
      category = "configuration";
      retry = "do_not_retry";
    } else if (s >= 400 && s < 500) {
      category = "invalid_request";
      retry = "do_not_retry";
    } else if (s >= 500) {
      category = "provider_unavailable";
      retry = "retry_conditionally";
    } else {
      category = "unknown";
      retry = "unknown";
    }
    confidence = s >= 400 ? "possible" : "insufficient";
    explanation = name
      ? `errorName "${safeText(name, 80)}" is not in the PandaPayLens catalog. Worldpay states that its error-name list is not comprehensive.`
      : "The error carries no errorName.";
    if (s >= 400) explanation += ` The guidance below follows the HTTP status ${s}.`;
    missing.push(
      name
        ? `errorName "${safeText(name, 80)}" is not documented in the reviewed sources.`
        : "No errorName was supplied.",
    );
    if (httpStatus === undefined && !opts.fromQueryHistory)
      missing.push(
        "The HTTP status was not supplied; Worldpay names the HTTP status and errorName as the most reliable elements for automated decisions.",
      );
  }

  const path = safeText(opts.jsonPath, 160);
  if (path) {
    subCodes.json_path = path;
    explanation += ` Field: ${path}.`;
  }
  const header = safeText(opts.headerName, 80);
  if (header) {
    subCodes.header_name = header;
    explanation += ` Header: ${header}.`;
  }
  if (opts.parentName) subCodes.error_name = safeText(opts.parentName, 128) ?? "";
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);

  const retryParts = [RETRY_TEXT[retry]];
  const clientError =
    (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) ||
    (httpStatus === undefined && entry !== undefined && /^4/.test(entry.http));
  if (clientError && retry === "do_not_retry")
    retryParts.push(
      "Worldpay: once the problem in the request is resolved, it can be retried safely.",
    );
  if (category === "provider_unavailable" && !opts.fromQueryHistory)
    retryParts.push(
      "Worldpay describes 5xx errors as server-side and most commonly timeouts, so the original request may or may not have taken effect.",
    );

  const message = safeText(opts.message, 200);
  const unresolved = category === "provider_unavailable" || category === "network_or_timeout";
  return {
    ...withRefs(loc),
    code:
      (name ? safeText(name, 128) : undefined) ?? (httpStatus ? `HTTP ${httpStatus}` : "unknown"),
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence,
    documentation: [
      { title: "Worldpay error responses", url: ERROR_RESPONSES_URL },
      ...(opts.fromQueryHistory
        ? [{ title: "Worldpay Payment Queries API reference", url: PAYMENT_QUERIES_URL }]
        : []),
    ],
    missingInformation: missing,
    ...(opts.fromQueryHistory || !unresolved ? { outcomeKnown: true } : {}),
  };
}

function decodeOutcome(
  outcome: "fraudHighRisk" | "3dsAuthenticationFailed",
  r: PaymentResponseFields,
  loc: Location,
): DecodedErrorDraft {
  const fraud = outcome === "fraudHighRisk";
  const category: ErrorCategory = fraud ? "fraud_or_risk" : "authentication_failed";
  const retry: RetryGuidance = fraud ? "manual_review" : "customer_action_required";
  const subCodes: Record<string, string> = {};
  const score = typeof r.score === "number" ? r.score : r.fraud?.score;
  if (fraud && typeof score === "number") subCodes.fraud_score = String(score);
  const reasons = r.reason?.map((x) => safeId(x, 64)).filter((x): x is string => Boolean(x));
  if (fraud && reasons?.length) subCodes.fraud_reasons = reasons.join(",");
  return {
    ...withRefs(loc),
    code: outcome,
    subCodes,
    category,
    explanation: fraud
      ? "FraudSight assessed the payment as high risk; Worldpay advises to stop the transaction before payment. The payment was not authorized."
      : "3DS authentication failed, so the payment was not authorized.",
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence: "strong",
    documentation: [{ title: "Worldpay Payments API reference", url: PAYMENTS_OPENAPI_URL }],
    missingInformation: [],
    outcomeKnown: true,
  };
}

function decodeTimeout(eventName: string, loc: Location): DecodedErrorDraft {
  const info = lookup(QUERY_EVENT_NAMES, eventName);
  return {
    ...withRefs(loc),
    code: eventName,
    subCodes: {},
    category: "network_or_timeout",
    explanation: `Payment Queries reports ${eventName}: ${info?.meaning ?? "the step timed out"}. The record does not say whether the step took effect.`,
    nextAction: NEXT_ACTION.network_or_timeout,
    retry: "retry_conditionally",
    retryExplanation: RETRY_TEXT.retry_conditionally,
    confidence: "strong",
    documentation: [{ title: "Worldpay Payment Queries API reference", url: PAYMENT_QUERIES_URL }],
    missingInformation: [
      "Later events of this payment may resolve the outcome; query the payment again.",
    ],
  };
}

function decodeRefusedWebhook(
  classification: string | undefined,
  loc: Location,
): DecodedErrorDraft {
  const payout = classification === "payout";
  return {
    ...withRefs(loc),
    code: "refused",
    subCodes: classification ? { classification: safeText(classification, 32) ?? "" } : {},
    category: "unknown",
    explanation: payout
      ? "Worldpay reports that the payout was refused. The refused event carries no refusal code or description."
      : "Worldpay reports that the payment was refused. The refused event carries no refusal code or description, so the reason cannot be decoded from it.",
    nextAction: payout
      ? "Look up the payout's refusal reason before sending a new payout."
      : "Look up the refusal code in the authorization response (refusalCode) or in Payment Queries (events[].code).",
    retry: "unknown",
    retryExplanation: RETRY_TEXT.unknown,
    confidence: "insufficient",
    documentation: [{ title: "Worldpay Events API reference", url: EVENTS_OPENAPI_URL }],
    missingInformation: [
      "The refused webhook has no refusal code field; the reason is only in the synchronous response or in Payment Queries.",
    ],
    outcomeKnown: true,
  };
}

function decodeErrors(parsed: WorldpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "wpg" || parsed.kind === "cnp") return decodeXmlErrors(parsed, ctx);
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const at = (path: string) => ({ recordIndex: ctx.recordIndex, path });

  if (parsed.kind === "error") {
    const e = parsed.value;
    const status = ctx.meta?.http?.status;
    const items = e.validationErrors ?? [];
    if (items.length === 0)
      return [
        decodeErrorName(
          e.errorName,
          status,
          { sourceFormat: ctx.format, source },
          {
            ...(e.message !== undefined ? { message: e.message } : {}),
            ...(e.headerName !== undefined ? { headerName: e.headerName } : {}),
          },
        ),
      ];
    return items.map((item, i) =>
      decodeErrorName(
        item.errorName,
        status,
        { sourceFormat: ctx.format, source: at(`validationErrors[${i}]`) },
        {
          ...(item.message !== undefined ? { message: item.message } : {}),
          ...(item.jsonPath !== undefined ? { jsonPath: item.jsonPath } : {}),
          parentName: e.errorName,
        },
      ),
    );
  }

  if (parsed.kind === "payment_response") {
    const r = parsed.value;
    const loc: Location = { sourceFormat: ctx.format, source };
    const pay = safeId(r.paymentId);
    const cmd = safeId(r.commandId);
    if (pay) loc.paymentReference = pay;
    if (cmd) loc.attemptReference = cmd;
    if (r.outcome === "fraudHighRisk" || r.outcome === "3dsAuthenticationFailed")
      return [decodeOutcome(r.outcome, r, loc)];
    if (r.outcome !== "refused") return [];
    const v6 = r.refusalCode === undefined && r.gatewayRefusalCode === undefined;
    const input: RefusalInput = { subject: "payment" };
    const refusalCode = codeOf(r.refusalCode);
    const gateway = codeOf(r.gatewayRefusalCode);
    const v6Code = v6 ? codeOf(r.code) : undefined;
    const v6Raw = codeOf(r.rawCode);
    const advice = adviceCodeOf(r.advice?.code) ?? adviceCodeOf(r.refusalAdvice?.code);
    const description = r.refusalDescription ?? (v6 ? r.description : undefined);
    const reason = str(r.exemption?.reason);
    if (refusalCode !== undefined) input.refusalCode = refusalCode;
    if (gateway !== undefined) input.gatewayCode = gateway;
    if (v6Code !== undefined) input.v6Code = v6Code;
    if (v6Raw !== undefined) input.v6RawCode = v6Raw;
    if (description !== undefined) input.description = description;
    if (advice !== undefined) input.adviceCode = advice;
    if (reason && EXEMPTION_REASONS.has(reason)) input.exemptionReason = reason;
    const decoded = decodeRefusal(input, loc);
    if (v6Code !== undefined)
      decoded.documentation.push({
        title: "Card Payments v7 migration guide",
        url: V7_MIGRATION_URL,
      });
    return [decoded];
  }

  if (parsed.kind === "payment_query") {
    const p = parsed.value;
    const pay = safeId(p.paymentId);
    const out: DecodedErrorDraft[] = [];
    (p.events ?? []).forEach((e, i) => {
      const loc: Location = { sourceFormat: ctx.format, source: at(`events[${i}]`) };
      if (pay) loc.paymentReference = pay;
      const cmd = safeId(e.commandId);
      if (cmd) loc.attemptReference = cmd;
      const code = codeOf(e.code);
      if (e.eventName.endsWith("Refused") || e.outcome === "refused") {
        const input: RefusalInput = {
          subject: e.eventName.startsWith("refund") ? "refund" : "payment",
        };
        if (code !== undefined) input.refusalCode = code;
        if (e.description !== undefined) input.description = e.description;
        out.push(decodeRefusal(input, loc));
      } else if (e.eventName.endsWith("Failed") || e.error?.name !== undefined) {
        out.push(
          decodeErrorName(e.error?.name, undefined, loc, {
            ...(e.error?.message !== undefined ? { message: e.error.message } : {}),
            fromQueryHistory: true,
          }),
        );
      } else if (e.eventName.endsWith("TimedOut")) {
        out.push(decodeTimeout(e.eventName, loc));
      }
    });
    return out;
  }

  if (parsed.kind === "event") {
    const d = parsed.value.eventDetails;
    const loc: Location = { sourceFormat: ctx.format, source: at("eventDetails") };
    const pay = safeId(d.paymentId);
    const cmd = safeId(d.commandId);
    if (pay) loc.paymentReference = pay;
    if (cmd) loc.attemptReference = cmd;
    const info = eventInfo(d.classification, d.type);
    if (!info) return [];
    if (d.type === "refused") return [decodeRefusedWebhook(d.classification, loc)];
    const refusal = d.refund?.refusal;
    if (d.type === "refundFailed" && refusal) {
      const input: RefusalInput = { subject: "refund" };
      const code = codeOf(refusal.code);
      if (code !== undefined) input.refusalCode = code;
      if (refusal.description !== undefined) input.description = refusal.description;
      const decoded = decodeRefusal(input, { ...loc, source: at("eventDetails.refund.refusal") });
      decoded.documentation.push({ title: "Worldpay online refunds", url: ONLINE_REFUNDS_URL });
      return [decoded];
    }
  }

  return [];
}

export const worldpayAdapter: ProviderAdapter<WorldpayParsed> = {
  id: PROVIDER,
  displayName: "Worldpay",
  version: WORLDPAY_ADAPTER_VERSION,
  manifest: worldpayManifest,
  supportedFormats: [
    {
      id: "worldpay.event",
      description:
        "Access Events v1 webhook ({ eventId, eventTimestamp, eventDetails }) for payment, payout and chargeback events",
    },
    {
      id: "worldpay.payment_response",
      description:
        "Payments API (2024-06-01) or Card Payments v7 response (outcome, paymentId, commandId, refusalCode)",
    },
    {
      id: "worldpay.error",
      description: "Error response ({ errorName, message, validationErrors[] })",
    },
    {
      id: "worldpay.payment_query",
      description: "Payment Queries v1 payment (lastEvent and events[] history)",
    },
    {
      id: "worldpay.card_payments_events_query",
      description: "Deprecated Card Payments events query (Title Case lastEvent)",
    },
    {
      id: WPG_FORMATS.reply,
      description: `WPG paymentService reply with error, orderStatus (payment or error) or ok, pasted as XML or as the body of an HTTP response. ${DOCTYPE_HINT}`,
    },
    {
      id: WPG_FORMATS.notification,
      description: `WPG order notification (paymentService notify orderStatusEvent with payment and lastEvent). ${DOCTYPE_HINT}`,
    },
    {
      id: CNP_FORMATS.onlineResponse,
      description:
        "cnpAPI cnpOnlineResponse (namespace http://www.vantivcnp.com/schema) with an authorization, sale, capture, credit, void or authorization reversal response",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // WPG orders are linked by orderCode, which Worldpay requires to be unique.
    // cnpAPI responses are linked by cnpTxnId and by the merchant's orderId.
    if (event.sourceFormat.startsWith("worldpay.wpg"))
      return event.paymentReference ? [`wpg-order:${event.paymentReference}`] : [];
    if (event.sourceFormat.startsWith("worldpay.cnpapi")) {
      const keys: string[] = [];
      if (event.paymentReference) keys.push(`cnp-txn:${event.paymentReference}`);
      if (event.merchantReference) keys.push(`cnp-order:${event.merchantReference}`);
      return keys;
    }
    // paymentId spans the whole lifecycle; commandId identifies one request of
    // that payment; transactionReference is documented as identifying a payment
    // throughout its lifecycle and is the only link for events without a
    // paymentId. orderReference can be reused and is never a key.
    const keys: string[] = [];
    if (event.paymentReference) keys.push(`payment:${event.paymentReference}`);
    if (event.relatedReference) keys.push(`command:${event.relatedReference}`);
    if (event.merchantReference) keys.push(`txref:${event.merchantReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export {
  CNP_FORMATS,
  DOCTYPE_HINT,
  WPG_FORMATS,
  decodeWpgError,
  decodeWpgRefusal,
  providerText,
  wpgMinorUnits,
} from "./xml.js";
export default worldpayAdapter;
