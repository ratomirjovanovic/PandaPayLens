/**
 * Paysafe adapter (Payments API v1, `/paymenthub/v1/`).
 *
 * Supported input families:
 * - `paysafe.resource`  Resource response: payment handle, payment, settlement,
 *                       refund, void authorization, standalone or original
 *                       credit, verification. HTTP 402 declines carry the
 *                       resource together with an `error` object.
 * - `paysafe.error`     Error body `{ error: { code, message, details,
 *                       fieldErrors, additionalDetails } }`, or an error
 *                       response that carries only the X-Application-Status-Code
 *                       header (plain-text or empty body).
 * - `paysafe.webhook`   Payments API webhook envelope (`eventName`, `payload`,
 *                       `attemptNumber`, `resourceId`, `eventDate`, ...).
 *
 * Recognized but not analyzed: list responses (`meta.numberOfRecords`) and
 * legacy Cards API requests (`/cardpayments/v1/`).
 *
 * Settlements, refunds and voids name their parent only in the request path,
 * so a parent link is made only when a pasted HTTP request line carries it.
 * Skrill or other downstream data nested in `gatewayResponse` stays part of
 * the Paysafe record; Skrill's own formats belong to the Skrill adapter.
 */

import {
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
  AVS_CODES,
  AVS_RESPONSES,
  CARD_ERRORS_URL,
  CARD_TYPES,
  CHARGEBACKS_URL,
  CVV_VERIFICATIONS,
  ERROR_CODES,
  ERROR_CODE_NOTES,
  ERROR_TABLE_TITLES,
  EVENT_NAMES,
  GET_STARTED_URL,
  INTERCHECKS_ADD_CARD_CODES,
  INTERCHECKS_CODES,
  ISO_RESPONSE_CODES,
  LINK_RELS,
  NEXT_ACTION,
  OPENAPI_URL,
  API_REFERENCE_URL,
  PROCESSOR_TABLE_BY_GATEWAY_CODE,
  RESOURCE_STATUSES,
  RESOURCE_TITLES,
  RETRY_TEXT,
  SA_CREDIT_RETURN_COMPLETED,
  STATUS_REASONS,
  THREE_D_RESULTS,
  WEBHOOK_TYPES,
  processorEntry,
  type EventInfo,
  type ResourceKind,
  type StatusInfo,
} from "./catalog.js";
import { paysafeManifest, PAYSAFE_ADAPTER_VERSION } from "./manifest.js";

export { paysafeManifest, PAYSAFE_ADAPTER_VERSION };

const PROVIDER = "paysafe";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const Code = z.union([z.string().max(64), z.number().int()]);
const Text = z.string().max(5000);

const FieldError = z.looseObject({ field: z.unknown().optional(), error: z.unknown().optional() });
const AdditionalDetail = z.looseObject({
  type: z.unknown().optional(),
  code: z.unknown().optional(),
  message: z.unknown().optional(),
});

const ErrorObject = z.looseObject({
  code: Code.optional(),
  message: Text.optional(),
  details: z.array(z.unknown()).max(100).optional(),
  fieldErrors: z.array(FieldError).max(200).optional(),
  additionalDetails: z.array(AdditionalDetail).max(50).optional(),
});

const Amount = z.union([z.number(), z.string().max(40)]);
const Time = z.union([z.string().max(64), z.number()]);

const SettlementEntry = z.looseObject({
  id: z.string().max(128).optional(),
  status: z.string().max(64).optional(),
  amount: Amount.optional(),
  txnTime: Time.optional(),
  error: ErrorObject.optional(),
});

const Resource = z
  .looseObject({
    id: z.string().max(128).optional(),
    merchantRefNum: z.string().max(255).optional(),
    status: z.string().max(64).optional(),
    amount: Amount.optional(),
    currencyCode: z.string().max(8).optional(),
    txnTime: Time.optional(),
    updatedTime: Time.optional(),
    statusTime: Time.optional(),
    settleWithAuth: z.boolean().optional(),
    availableToSettle: Amount.optional(),
    availableToRefund: Amount.optional(),
    paymentType: z.string().max(64).optional(),
    statusReason: z.string().max(128).optional(),
    gatewayResponse: z.looseObject({}).optional(),
    settlements: z.array(SettlementEntry).max(200).optional(),
    error: ErrorObject.optional(),
  })
  .refine(
    (r) =>
      r.id !== undefined ||
      r.status !== undefined ||
      r.error !== undefined ||
      r.merchantRefNum !== undefined,
    { message: "id, status, merchantRefNum or error is required", path: ["id"] },
  );

const Webhook = z.looseObject({
  eventName: z.string().max(128),
  payload: z.looseObject({
    id: z.string().max(128).optional(),
    status: z.string().max(64).optional(),
    amount: Amount.optional(),
    error: ErrorObject.optional(),
    settlements: z.array(SettlementEntry).max(200).optional(),
  }),
  eventType: z.string().max(128).optional(),
  type: z.string().max(64).optional(),
  resourceId: z.string().max(128).optional(),
  eventDate: Time.optional(),
  attemptNumber: z.union([z.string().max(8), z.number().int()]).optional(),
  mode: z.string().max(32).optional(),
  links: z.array(z.unknown()).max(50).optional(),
  settlements: z.array(SettlementEntry).max(200).optional(),
});

const ErrorBody = z.looseObject({ error: ErrorObject.optional() });

type ResourceValue = z.infer<typeof Resource>;
type WebhookValue = z.infer<typeof Webhook>;
type ErrorValue = z.infer<typeof ErrorObject>;

export type PaysafeParsed =
  | { kind: "resource"; value: ResourceValue }
  | { kind: "webhook"; value: WebhookValue }
  | { kind: "error"; value: z.infer<typeof ErrorBody> };

const FORMATS = {
  "paysafe.resource": ["resource", Resource],
  "paysafe.webhook": ["webhook", Webhook],
  "paysafe.error": ["error", ErrorBody],
} as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const UPPER_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
const upperWord = (v: unknown) => (typeof v === "string" && UPPER_WORD.test(v) ? v : undefined);

/** Paysafe error codes: four digits, PAYMENTHUB-n or ALTERNATE-PAYMENTS-GATEWAY-n. */
const FOUR_DIGITS = /^\d{4}$/;
const PREFIXED_CODE = /^(?:PAYMENTHUB|ALTERNATE-PAYMENTS-GATEWAY)-\d{1,3}$/;
/** Other upper-case hyphenated codes, such as DW-CUSTOMER-CONFLICT from an SDK fixture. */
const HYPHEN_CODE = /^[A-Z]{2,}(?:-[A-Z0-9]+){1,5}$/;

function codeOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : undefined;
}

const ALL_STATUSES: ReadonlySet<string> = new Set(
  Object.values(RESOURCE_STATUSES).flatMap((t) => Object.keys(t)),
);

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
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

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, x]) => x !== undefined),
  ) as NormalizedEventDraft;
}

/**
 * One-way key for the paymentHandleToken. The token can fund a payment while
 * the handle is PAYABLE, so it is never copied; two FNV-1a hashes with
 * different offsets only let records that carry the same token be linked.
 */
export function handleKey(token: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
  }
  return `h-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

function header(meta: RecordMeta | undefined, name: string): string | undefined {
  const v = meta?.http?.headers[name];
  return v === undefined || v === "[redacted]" ? undefined : v;
}

/** Documented Payments API paths (OpenAPI paths are written with and without /paymenthub). */
const API_PATH =
  /^(\/paymenthub)?\/v1\/(paymenthandles|payments|settlements|refunds|voidauths|standalonecredits|originalcredits|verifications)(?:\/([A-Za-z0-9_-]{1,128})(?:\/(settlements|voidauths|refunds))?)?\/?$/;
const LEGACY_CARDS_PATH = /^\/cardpayments\/v1\/accounts\//;

const PATH_KINDS: Readonly<Record<string, ResourceKind>> = {
  paymenthandles: "payment_handle",
  payments: "payment",
  settlements: "settlement",
  refunds: "refund",
  voidauths: "void_auth",
  standalonecredits: "standalone_credit",
  originalcredits: "original_credit",
  verifications: "verification",
};

type PathInfo = {
  kind: ResourceKind;
  /** The path starts with /paymenthub, the documented base path. */
  hub: boolean;
  parent?: string;
  ownId?: string;
  method?: string;
};

/** Resource type and ids named by a pasted request line. */
function pathInfo(meta: RecordMeta | undefined): PathInfo | undefined {
  const http = meta?.http;
  if (http?.kind !== "request" || !http.path) return undefined;
  const m = API_PATH.exec(http.path);
  if (!m) return undefined;
  const hub = m[1] !== undefined;
  const base = PATH_KINDS[m[2]!]!;
  const method = http.method;
  if (m[4]) {
    return { kind: PATH_KINDS[m[4]]!, hub, parent: m[3]!, ...(method ? { method } : {}) };
  }
  return { kind: base, hub, ...(m[3] ? { ownId: m[3] } : {}), ...(method ? { method } : {}) };
}

const HANDLE_FIELDS = ["usage", "action", "executionMode", "timeToLiveSeconds", "transactionType"];

function handleMarkers(o: Record<string, unknown>): number {
  let n = 0;
  if (o.usage === "SINGLE_USE" || o.usage === "MULTI_USE") n++;
  if (o.action === "NONE" || o.action === "REDIRECT") n++;
  if (o.executionMode === "SYNCHRONOUS" || o.executionMode === "ASYNCHRONOUS") n++;
  if (typeof o.timeToLiveSeconds === "number") n++;
  if (
    typeof o.transactionType === "string" &&
    ["PAYMENT", "STANDALONE_CREDIT", "ORIGINAL_CREDIT", "VERIFICATION"].includes(o.transactionType)
  )
    n++;
  return n;
}

/** Resource type from the body alone, when no path, event name or type says it. */
function kindFromBody(o: Record<string, unknown>): ResourceKind | undefined {
  if (typeof o.paymentHandleToken === "string" && HANDLE_FIELDS.some((f) => f in o))
    return "payment_handle";
  if (typeof o.type === "string") {
    const k = lookup(WEBHOOK_TYPES, o.type);
    if (k) return k;
  }
  if (
    typeof o.settleWithAuth === "boolean" ||
    o.availableToSettle !== undefined ||
    Array.isArray(o.settlements) ||
    typeof o.preAuth === "boolean"
  )
    return "payment";
  if (o.availableToRefund !== undefined) return "settlement";
  return undefined;
}

function eventInfo(name: string): EventInfo | undefined {
  return lookup(EVENT_NAMES, name);
}

/** Resource type of a webhook: event name first, then `type`, then `links[].rel`, then the payload. */
function webhookKind(w: Record<string, unknown>, payload: Record<string, unknown>) {
  const name = str(w.eventName);
  if (name === SA_CREDIT_RETURN_COMPLETED) return "standalone_credit" as const;
  const info = name ? eventInfo(name) : undefined;
  if (info && "status" in info) return info.resource;
  if (info) return undefined;
  const t = typeof w.type === "string" ? lookup(WEBHOOK_TYPES, w.type) : undefined;
  if (t) return t;
  if (Array.isArray(w.links)) {
    for (const l of w.links) {
      const rel = isObj(l) ? str(l.rel) : undefined;
      const k = rel ? lookup(LINK_RELS, rel) : undefined;
      if (k) return k;
    }
  }
  return kindFromBody(payload);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function errorShapeScore(
  e: Record<string, unknown>,
  meta: RecordMeta | undefined,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const code = e.code;
  if (typeof code !== "string") return { score: 0, reasons };
  let score = 0;
  if (PREFIXED_CODE.test(code)) {
    score = 0.45;
    reasons.push(`error.code "${code}" has a Paysafe code prefix`);
  } else if (FOUR_DIGITS.test(code)) {
    score = 0.25;
    reasons.push("error.code is a four-digit string");
  } else if (lookup(INTERCHECKS_CODES, code)) {
    score = 0.2;
    reasons.push(`error.code "${code}" is a documented Interchecks name`);
  } else if (HYPHEN_CODE.test(code)) {
    score = 0.15;
  } else return { score: 0, reasons };
  const entry = lookup(ERROR_CODES, code);
  if (entry) {
    score += 0.1;
    reasons.push(`error.code "${code}" is a documented Paysafe error code`);
  }
  if (typeof e.message === "string") score += 0.1;
  if (
    Array.isArray(e.details) &&
    e.details.length > 0 &&
    e.details.every((d) => typeof d === "string")
  ) {
    score += 0.1;
    reasons.push("has error.details");
  }
  const fe = e.fieldErrors;
  if (
    Array.isArray(fe) &&
    fe.length > 0 &&
    fe.every((f) => isObj(f) && typeof f.field === "string")
  ) {
    score += 0.15;
    reasons.push("has error.fieldErrors with field entries");
  }
  const ad = e.additionalDetails;
  if (
    Array.isArray(ad) &&
    ad.length > 0 &&
    ad.every((d) => isObj(d) && typeof d.type === "string")
  ) {
    score += 0.1;
    if (ad.some((d) => isObj(d) && (d.type === "ADVICE" || d.type === "ISO_RESPONSE"))) {
      score += 0.1;
      reasons.push("error.additionalDetails has ADVICE or ISO_RESPONSE entries");
    }
  }
  const statusHeader = header(meta, "x-application-status-code");
  if (statusHeader !== undefined && statusHeader === code) {
    score += 0.2;
    reasons.push("the X-Application-Status-Code header repeats error.code");
  }
  if (header(meta, "x-internal-correlation-id") !== undefined) score += 0.05;
  const status = meta?.http?.status;
  if (entry && status !== undefined && String(status) === entry.http) score += 0.05;
  return { score, reasons };
}

type ResourceScore = { score: number; reasons: string[]; decisive: boolean };

function resourceScore(o: Record<string, unknown>, meta: RecordMeta | undefined): ResourceScore {
  const reasons: string[] = [];
  let score = 0;
  let decisive = false;
  if (typeof o.merchantRefNum === "string") {
    score += 0.25;
    decisive = true;
    reasons.push("has merchantRefNum");
  }
  if (typeof o.paymentHandleToken === "string") {
    score += 0.25;
    decisive = true;
    reasons.push("has paymentHandleToken");
  }
  if (typeof o.settleWithAuth === "boolean") {
    score += 0.2;
    decisive = true;
    reasons.push("has settleWithAuth");
  }
  if (typeof o.availableToSettle === "number" || typeof o.availableToRefund === "number") {
    score += 0.1;
    decisive = true;
    reasons.push("has availableToSettle or availableToRefund");
  }
  const gr = o.gatewayResponse;
  if (
    isObj(gr) &&
    (gr.responseCode !== undefined ||
      typeof gr.processor === "string" ||
      (typeof gr.avsResponse === "string" && AVS_RESPONSES.has(gr.avsResponse)) ||
      (typeof gr.cvvVerification === "string" && CVV_VERIFICATIONS.has(gr.cvvVerification)) ||
      typeof gr.responseCodeDescription === "string")
  ) {
    score += 0.1;
    decisive = true;
    reasons.push("has gatewayResponse");
  }
  const path = pathInfo(meta);
  // /v1/payments alone is a common path; only the /paymenthub base path is decisive.
  if (path?.hub) {
    score += 0.3;
    decisive = true;
    reasons.push("the request path is a Payments API path");
  }
  if (Array.isArray(o.settlements) && o.settlements.every(isObj)) score += 0.05;
  if (typeof o.txnTime === "string" || typeof o.txnTime === "number") score += 0.1;
  if (typeof o.currencyCode === "string" && /^[A-Z]{3}$/.test(o.currencyCode)) score += 0.05;
  if (typeof o.status === "string" && ALL_STATUSES.has(o.status)) {
    score += 0.1;
    reasons.push(`status "${o.status}" is a documented Paysafe status`);
  }
  if (upperWord(o.paymentType)) score += 0.05;
  score += Math.min(0.2, handleMarkers(o) * 0.05);
  // A flat resource posted as a webhook carries its category in `type`.
  if (typeof o.type === "string" && lookup(WEBHOOK_TYPES, o.type)) score += 0.1;
  if (typeof o.liveMode === "boolean" || o.simulator === "INTERNAL" || o.simulator === "EXTERNAL")
    score += 0.05;
  if (typeof o.gatewayReconciliationId === "string") score += 0.05;
  if (typeof o.dupCheck === "boolean") score += 0.05;
  if (isObj(o.error)) {
    const e = errorShapeScore(o.error, meta);
    if (e.score > 0) {
      score += 0.15;
      reasons.push(...e.reasons.slice(0, 1));
    }
  }
  if (header(meta, "x-application-status-code") !== undefined) score += 0.1;
  return { score, reasons, decisive };
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
  if (!isObj(input) || meta?.format === "form") return none;
  // Stripe objects carry `object`; Paysafe bodies never do.
  if ("object" in input) return none;

  const http = meta?.http;
  if (http?.kind === "request" && http.path && LEGACY_CARDS_PATH.test(http.path)) {
    return {
      ...base,
      format: "paysafe.legacy_cards",
      confidence: 0.8,
      supported: false,
      reasons: ["the request path is a legacy Cards API path (/cardpayments/v1/accounts/)"],
      unsupportedReason:
        "Legacy Cards API requests are not analyzed. PandaPayLens reads the Payments API (/paymenthub/v1/).",
    };
  }

  // Webhook envelope.
  const eventName = upperWord(input.eventName);
  if (eventName && (isObj(input.payload) || typeof input.resourceId === "string")) {
    const reasons = ["has an UPPER_SNAKE eventName"];
    let score = 0.25;
    const payload = isObj(input.payload) ? input.payload : undefined;
    if (payload) reasons.push("has a payload object");
    if (eventInfo(eventName) || eventName === SA_CREDIT_RETURN_COMPLETED) {
      score += 0.2;
      reasons.push(`eventName "${eventName}" is a documented Paysafe webhook event`);
    }
    if (typeof input.resourceId === "string") {
      score += 0.1;
      reasons.push("has resourceId");
      if (payload && payload.id === input.resourceId) score += 0.05;
    }
    if (typeof input.eventDate === "string") score += 0.05;
    const att = input.attemptNumber;
    if ((typeof att === "string" && /^\d{1,3}$/.test(att)) || typeof att === "number") {
      score += 0.1;
      reasons.push("has attemptNumber");
    }
    if (input.eventType === eventName) score += 0.05;
    if (typeof input.type === "string" && lookup(WEBHOOK_TYPES, input.type)) score += 0.05;
    if (
      Array.isArray(input.links) &&
      input.links.some((l) => isObj(l) && typeof l.rel === "string" && lookup(LINK_RELS, l.rel))
    )
      score += 0.05;
    if (
      payload &&
      (typeof payload.merchantRefNum === "string" ||
        typeof payload.paymentHandleToken === "string" ||
        typeof payload.settleWithAuth === "boolean")
    ) {
      score += 0.1;
      reasons.push("the payload carries Paysafe resource fields");
    }
    if (score > 0.4 && http?.headers.signature !== undefined) {
      score += 0.03;
      reasons.push("has a Signature header");
    }
    return {
      ...base,
      format: "paysafe.webhook",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  // List response: documented meta object with Paysafe resources in an array.
  if (
    isObj(input.meta) &&
    typeof input.meta.numberOfRecords === "number" &&
    typeof input.meta.limit === "number"
  ) {
    const lists = Object.values(input).filter(
      (v): v is unknown[] =>
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((x) => isObj(x) && resourceScore(x, undefined).decisive),
    );
    if (lists.length > 0) {
      return {
        ...base,
        format: "paysafe.list",
        confidence: 0.7,
        supported: false,
        reasons: [
          "has meta.numberOfRecords and meta.limit",
          "contains an array of Paysafe resources",
        ],
        unsupportedReason:
          "List responses are not analyzed. Paste a single resource (or the webhooks) instead.",
      };
    }
  }

  const rs = resourceScore(input, meta);
  if (rs.decisive) {
    return {
      ...base,
      format: "paysafe.resource",
      confidence: round(rs.score),
      supported: true,
      reasons: rs.reasons,
    };
  }

  if (isObj(input.error)) {
    const { score, reasons } = errorShapeScore(input.error, meta);
    if (score === 0) return none;
    return {
      ...base,
      format: "paysafe.error",
      confidence: round(score),
      supported: true,
      reasons: ["has an error object", ...reasons],
    };
  }

  // Error response without a JSON body: only the documented header identifies Paysafe.
  const statusHeader = header(meta, "x-application-status-code");
  if (
    statusHeader !== undefined &&
    http?.kind === "response" &&
    (http.status ?? 0) >= 400 &&
    Object.keys(input).length === 0 &&
    (FOUR_DIGITS.test(statusHeader) || PREFIXED_CODE.test(statusHeader))
  ) {
    let score = 0.45;
    const reasons = ["error response with an X-Application-Status-Code header"];
    if (lookup(ERROR_CODES, statusHeader)) {
      score += 0.1;
      reasons.push(
        `X-Application-Status-Code "${statusHeader}" is a documented Paysafe error code`,
      );
    }
    if (header(meta, "x-internal-correlation-id") !== undefined) {
      score += 0.05;
      reasons.push("has an X-INTERNAL-CORRELATION-ID header");
    }
    return {
      ...base,
      format: "paysafe.error",
      confidence: round(score),
      supported: true,
      reasons,
    };
  }

  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PaysafeParsed } | { ok: false; issues: string[] } {
  const entry = lookup(FORMATS, format);
  if (!entry) return { ok: false, issues: [`Unsupported Paysafe format "${format}".`] };
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, value: { kind: entry[0], value: r.data } as PaysafeParsed };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** The first parseable time of the candidates, plus the raw value of the first one when none parses. */
function timeOf(...candidates: unknown[]): { iso?: string; asSent?: string } {
  for (const c of candidates) {
    const iso = toIsoTimestamp(c);
    if (iso) return { iso };
  }
  const first = candidates.find((c) => typeof c === "string");
  return first ? { asSent: safeText(first, 40) } : {};
}

function gatewayAttrs(gr: Record<string, unknown> | undefined): [string, AttrValue][] {
  if (!gr) return [];
  const avs = str(gr.avsResponse);
  const cvv = str(gr.cvvVerification);
  return [
    ["gatewayCode", safeId(gr.code, 16)],
    ["gatewayResponseCode", codeOf(gr.responseCode)],
    ["gatewayResponseCodeDescription", str(gr.responseCodeDescription)],
    ["gatewayProcessor", upperWord(gr.processor)],
    ["gatewayStatus", codeOf(gr.status)],
    ["avsResponse", avs && AVS_RESPONSES.has(avs) ? avs : undefined],
    ["cvvVerification", cvv && CVV_VERIFICATIONS.has(cvv) ? cvv : undefined],
  ];
}

function cardAttrs(o: Record<string, unknown>): [string, AttrValue][] {
  const card = isObj(o.card) ? o.card : undefined;
  const type = str(card?.cardType) ?? str(o.cardType);
  const category = str(card?.cardCategory);
  const auth = isObj(o.authentication) ? o.authentication : undefined;
  const three = str(auth?.threeDResult);
  return [
    ["cardType", type && CARD_TYPES.has(type) ? type : undefined],
    ["cardCategory", category && /^[A-Z]{3,12}$/.test(category) ? category : undefined],
    ["threeDResult", three && THREE_D_RESULTS.has(three) ? three : undefined],
  ];
}

function riskReasonCodes(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const list = v.filter((x): x is number => typeof x === "number" && Number.isInteger(x));
  return list.length ? list.slice(0, 20) : undefined;
}

function webhookContext(meta: RecordMeta | undefined): [string, AttrValue][] {
  return [
    ["signatureHeaderPresent", meta?.http?.headers.signature !== undefined ? true : undefined],
    ["internalCorrelationId", safeId(header(meta, "x-internal-correlation-id"))],
    ["applicationStatusCode", codeOf(header(meta, "x-application-status-code"))],
  ];
}

type ResourceOptions = {
  ctx: NormalizeContext;
  kind: ResourceKind | undefined;
  /** JSON path of the resource inside the record. */
  path: string;
  parent?: string;
  ownId?: string;
  request?: PathInfo;
  webhook?: {
    eventName: string;
    info?: EventInfo;
    eventDate?: unknown;
    deliveryKey?: string;
    attributes: [string, AttrValue][];
  };
  /** Currency of the payment, for settlements listed inside it. */
  currency?: string;
};

const MODIFICATIONS: ReadonlySet<ResourceKind> = new Set(["settlement", "refund", "void_auth"]);

/** Stage, outcome and whether the semantics are known, for one resource state. */
function semantics(
  kind: ResourceKind | undefined,
  status: string | undefined,
  o: Record<string, unknown>,
  ctx: NormalizeContext,
  request: PathInfo | undefined,
): {
  info?: StatusInfo;
  stage: NormalizedEventDraft["stage"];
  outcome: NormalizedEventDraft["outcome"];
  known: boolean;
} {
  const httpStatus = ctx.meta?.http?.status;
  if (request && ctx.meta?.http?.kind === "request") {
    // A request body states what was asked for, not what happened.
    const cancel = status === "CANCELLED";
    const stage = kind
      ? cancel
        ? "cancellation"
        : RESOURCE_STATUSES[kind].COMPLETED!.stage
      : "other";
    return { stage, outcome: "pending", known: kind !== undefined };
  }
  const info = kind && status ? lookup(RESOURCE_STATUSES[kind], status) : undefined;
  if (info) {
    let stage = info.stage;
    if (kind === "payment" && stage === "payment" && o.settleWithAuth === false)
      stage = "authorization";
    return { info, stage, outcome: info.outcome, known: true };
  }
  const failed =
    status === "FAILED" ||
    status === "ERROR" ||
    httpStatus === 402 ||
    (status === undefined &&
      isObj(o.error) &&
      (httpStatus === undefined || (httpStatus >= 400 && httpStatus < 500)));
  const stage = kind
    ? kind === "payment" && o.settleWithAuth === false
      ? "authorization"
      : (RESOURCE_STATUSES[kind].COMPLETED?.stage ?? "other")
    : "other";
  if (failed)
    return { stage, outcome: "failure", known: kind !== undefined && status === undefined };
  return { stage, outcome: "unknown", known: false };
}

function resourceEvents(o: Record<string, unknown>, opts: ResourceOptions): NormalizedEventDraft[] {
  const { ctx, kind } = opts;
  const source = { recordIndex: ctx.recordIndex, path: opts.path };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const httpStatus = ctx.meta?.http?.status;
  const status =
    upperWord(o.status) ?? (o.status !== undefined ? safeText(o.status, 64) : undefined);
  const id = safeId(o.id) ?? opts.ownId;
  const isRequest = Boolean(opts.request && ctx.meta?.http?.kind === "request");
  const sem = semantics(kind, status, o, ctx, opts.request);
  const hook = opts.webhook;

  let stage = sem.stage;
  let outcome = sem.outcome;
  let known = sem.known;
  let eventType: string;
  if (hook) {
    eventType = hook.eventName;
    const info = hook.info;
    if (hook.eventName === SA_CREDIT_RETURN_COMPLETED) {
      stage = "reversal";
      outcome = "failure";
      known = true;
    } else if (info && !("status" in info)) {
      stage = info.stage;
      outcome = info.outcome;
      known = true;
    } else if (info && "status" in info) {
      // The event name states the status; the payload status, when present, wins.
      const byName = lookup(RESOURCE_STATUSES[info.resource], info.status)!;
      if (!sem.info) {
        stage = byName.stage;
        if (info.resource === "payment" && stage === "payment" && o.settleWithAuth === false)
          stage = "authorization";
        outcome = byName.outcome;
      }
      known = true;
    } else known = false;
  } else {
    const title = kind ?? "resource";
    eventType = isRequest
      ? `${title}.request`
      : `${title}.${status ?? (isObj(o.error) ? "error" : "snapshot")}`;
  }

  let paymentReference: string | undefined;
  let relatedReference: string | undefined;
  const parent = opts.parent;
  if (kind === "payment_handle") relatedReference = id;
  else if (kind && MODIFICATIONS.has(kind)) {
    paymentReference = parent ?? id;
    relatedReference = parent ? id : undefined;
  } else if (hook?.info && !("status" in hook.info)) {
    // Registration and Payment Scheduler payloads are not documented: their
    // id is shown, not used as a payment reference.
  } else paymentReference = id ?? parent;

  const currency = upperCurrency(o.currencyCode) ?? opts.currency;
  const time = hook
    ? timeOf(hook.eventDate, o.updatedTime, o.statusTime, o.txnTime)
    : timeOf(o.updatedTime, o.statusTime, o.txnTime);
  const gr = isObj(o.gatewayResponse) ? o.gatewayResponse : undefined;
  const token =
    typeof o.paymentHandleToken === "string" && o.paymentHandleToken
      ? o.paymentHandleToken
      : undefined;
  const statusReason = upperWord(o.statusReason);
  const settleWithAuth = typeof o.settleWithAuth === "boolean" ? o.settleWithAuth : undefined;

  return [
    clean({
      sourceFormat: ctx.format,
      eventType,
      eventTypeKnown: known,
      stage,
      providerStatus: status,
      deliveryKey: hook?.deliveryKey,
      paymentReference,
      relatedReference,
      merchantReference: merchantRef(o.merchantRefNum),
      eventTimestamp: time.iso,
      amountMinor: minorUnits(o.amount),
      currency,
      outcome,
      attributes: attrs([
        ["resourceType", kind ?? "unknown"],
        ["resourceId", hook?.info && !("status" in hook.info) ? id : undefined],
        // Set only when the parent is unknown and the own id stands in for it,
        // which is what the generic missing-link check looks for.
        ["isModification", kind && MODIFICATIONS.has(kind) && !parent ? true : undefined],
        [
          "parentReferenceSource",
          parent && opts.request ? "request_path" : parent ? "parent_resource" : undefined,
        ],
        ["requestMethod", isRequest ? safeId(opts.request?.method, 8) : undefined],
        ["requestedStatus", isRequest ? status : undefined],
        ["timeAsSent", time.asSent],
        ["httpStatus", httpStatus],
        ["paymentType", upperWord(o.paymentType)],
        ["settleWithAuth", kind === "payment" ? settleWithAuth : undefined],
        ["preAuth", typeof o.preAuth === "boolean" ? o.preAuth : undefined],
        ["availableToSettle", minorUnits(o.availableToSettle)],
        ["availableToRefund", minorUnits(o.availableToRefund)],
        ["statusReason", statusReason],
        ["statusReasonMeaning", statusReason ? lookup(STATUS_REASONS, statusReason) : undefined],
        ["statusMeaning", sem.info?.meaning],
        ["action", upperWord(o.action)],
        ["usage", upperWord(o.usage)],
        ["executionMode", upperWord(o.executionMode)],
        ["transactionType", upperWord(o.transactionType)],
        [
          "timeToLiveSeconds",
          typeof o.timeToLiveSeconds === "number" ? o.timeToLiveSeconds : undefined,
        ],
        ["paymentHandleKey", token ? handleKey(token) : undefined],
        ["liveMode", typeof o.liveMode === "boolean" ? o.liveMode : undefined],
        [
          "simulator",
          o.simulator === "INTERNAL" || o.simulator === "EXTERNAL" ? o.simulator : undefined,
        ],
        ["dupCheck", typeof o.dupCheck === "boolean" ? o.dupCheck : undefined],
        ["gatewayReconciliationId", safeId(o.gatewayReconciliationId, 64)],
        ["processorCode", safeId(o.processorCode, 16)],
        ["riskReasonCode", riskReasonCodes(o.riskReasonCode)],
        ["errorCode", isObj(o.error) ? codeOf(o.error.code) : undefined],
        ...gatewayAttrs(gr),
        ...cardAttrs(o),
        ...(hook?.attributes ?? []),
        ...webhookContext(ctx.meta),
      ]),
      source,
      ...observed,
    }),
  ];
}

function settlementEvents(
  list: unknown[] | undefined,
  basePath: string,
  parent: Record<string, unknown>,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  if (!list) return [];
  const parentId = safeId(parent.id);
  // Settlements listed inside a payment take no HTTP context from the record.
  const { meta: _meta, ...childCtx } = ctx;
  const out: NormalizedEventDraft[] = [];
  list.forEach((entry, i) => {
    if (!isObj(entry)) return;
    out.push(
      ...resourceEvents(entry, {
        ctx: childCtx,
        kind: "settlement",
        path: `${basePath}settlements[${i}]`,
        ...(parentId ? { parent: parentId } : {}),
        ...(upperCurrency(parent.currencyCode)
          ? { currency: upperCurrency(parent.currencyCode)! }
          : {}),
      }),
    );
  });
  return out;
}

function normalize(parsed: PaysafeParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const httpStatus = ctx.meta?.http?.status;

  if (parsed.kind === "error") {
    const e = parsed.value.error;
    const code = codeOf(e?.code) ?? codeOf(header(ctx.meta, "x-application-status-code"));
    const entry = code ? lookup(ERROR_CODES, code) : undefined;
    const outcome: NormalizedEventDraft["outcome"] =
      httpStatus !== undefined
        ? httpStatus >= 400 && httpStatus < 500
          ? "failure"
          : "unknown"
        : entry && entry.http.startsWith("4")
          ? "failure"
          : "unknown";
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `error.${code ?? (httpStatus ? `HTTP_${httpStatus}` : "unknown")}`,
        eventTypeKnown: Boolean(entry ?? (code ? lookup(INTERCHECKS_CODES, code) : undefined)),
        stage: "error",
        providerStatus: httpStatus ? `HTTP ${httpStatus}` : code,
        outcome,
        attributes: attrs([
          ["errorCode", code],
          ["httpStatus", httpStatus],
          ["errorTables", entry?.tables],
          ["fieldErrorFields", fieldPaths(e)],
          ["adviceCode", additional(e, "ADVICE")],
          ["isoResponseCode", additional(e, "ISO_RESPONSE")],
          ...webhookContext(ctx.meta),
        ]),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "resource") {
    const o = parsed.value as Record<string, unknown>;
    const request = pathInfo(ctx.meta);
    const kind = request?.kind ?? kindFromBody(o);
    const events = resourceEvents(o, {
      ctx,
      kind,
      path: "",
      ...(request?.parent ? { parent: request.parent } : {}),
      ...(request?.ownId ? { ownId: request.ownId } : {}),
      ...(request ? { request } : {}),
    });
    if (kind === "payment") events.push(...settlementEvents(parsed.value.settlements, "", o, ctx));
    return events;
  }

  const w = parsed.value;
  const raw = w as Record<string, unknown>;
  const payload = w.payload as Record<string, unknown>;
  const name = safeText(w.eventName, 128) ?? "unknown";
  const info = eventInfo(w.eventName);
  const kind = webhookKind(raw, payload);
  const resourceId = safeId(w.resourceId) ?? safeId(payload.id);
  const payloadStatus = upperWord(payload.status);
  const eventDate =
    typeof w.eventDate === "string" || typeof w.eventDate === "number" ? String(w.eventDate) : "";
  const deliveryKey = resourceId
    ? [name, resourceId, payloadStatus ?? "", safeText(eventDate, 64) ?? ""].join("|")
    : undefined;
  const attempt =
    typeof w.attemptNumber === "number"
      ? w.attemptNumber
      : typeof w.attemptNumber === "string" && /^\d{1,3}$/.test(w.attemptNumber)
        ? Number(w.attemptNumber)
        : undefined;
  const rels = Array.isArray(w.links)
    ? w.links
        .map((l) => (isObj(l) ? safeId(l.rel, 40) : undefined))
        .filter((x): x is string => Boolean(x))
    : undefined;
  const events = resourceEvents(payload, {
    ctx,
    kind,
    path: "payload",
    // resourceId equals the payload id; it stands in when the payload omits it.
    ...(safeId(w.resourceId) ? { ownId: safeId(w.resourceId)! } : {}),
    webhook: {
      eventName: name,
      ...(info ? { info } : {}),
      eventDate: w.eventDate,
      ...(deliveryKey ? { deliveryKey } : {}),
      attributes: [
        ["attemptNumber", attempt],
        ["redelivery", attempt !== undefined && attempt > 1 ? true : undefined],
        ["webhookEventType", upperWord(w.eventType)],
        ["webhookType", upperWord(w.type)],
        ["webhookMode", safeId(w.mode, 16)],
        ["linkRels", rels?.slice(0, 10)],
        [
          "envelopeShape",
          w.eventType !== undefined || w.mode !== undefined
            ? "full"
            : w.type !== undefined
              ? "sdk"
              : "minimal",
        ],
      ],
    },
  });
  if (kind === "payment") {
    events.push(...settlementEvents(w.payload.settlements, "payload.", payload, ctx));
    // The Java SDK example puts settlements[] next to the payload.
    events.push(...settlementEvents(w.settlements, "", payload, ctx));
  }
  return events;
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

function fieldPaths(e: ErrorValue | undefined): string[] | undefined {
  const list = e?.fieldErrors
    ?.map((f) =>
      typeof f.field === "string" && /^[A-Za-z0-9_.[\]-]{1,120}$/.test(f.field)
        ? f.field
        : undefined,
    )
    .filter((x): x is string => Boolean(x));
  return list?.length ? list.slice(0, 20) : undefined;
}

function additional(
  e: ErrorValue | undefined,
  type: "ADVICE" | "ISO_RESPONSE",
): string | undefined {
  const d = e?.additionalDetails?.find((x) => x.type === type);
  return d ? codeOf(d.code) : undefined;
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

type DecodeInput = {
  error?: ErrorValue;
  headerCode?: string;
  bodyText?: string;
  httpStatus?: number;
  gateway?: Record<string, unknown>;
  /** The resource reports a final failure (status FAILED or ERROR). */
  finalFailure?: boolean;
};

function fallbackByHttp(status: number | undefined): {
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
} {
  if (status === 401 || status === 403)
    return { category: "configuration", retry: "do_not_retry", confidence: "possible" };
  if (status === 429)
    return {
      category: "rate_limiting",
      retry: "safe_to_retry_technical_request",
      confidence: "possible",
    };
  if (status === 402)
    return { category: "unknown", retry: "manual_review", confidence: "insufficient" };
  if (status !== undefined && status >= 400 && status < 500)
    return { category: "invalid_request", retry: "do_not_retry", confidence: "possible" };
  if (status !== undefined && status >= 500)
    return {
      category: "provider_unavailable",
      retry: "retry_conditionally",
      confidence: "possible",
    };
  return { category: "unknown", retry: "unknown", confidence: "insufficient" };
}

/** Decodes a Paysafe error object (or the X-Application-Status-Code header). */
export function decodePaysafeError(input: DecodeInput, loc: Location): DecodedErrorDraft {
  const e = input.error;
  const bodyCode = codeOf(e?.code);
  const code = bodyCode ?? input.headerCode;
  const docs: DocumentationLink[] = [
    { title: "Paysafe Payments API error summary", url: API_REFERENCE_URL },
  ];
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  const explanation: string[] = [];
  let category: ErrorCategory;
  let retry: RetryGuidance;
  let confidence: Confidence;
  let documentedHttp: string | undefined;

  const entry = code ? lookup(ERROR_CODES, code) : undefined;
  const interchecks = code && !entry ? lookup(INTERCHECKS_CODES, code) : undefined;
  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = "strong";
    documentedHttp = entry.http;
    subCodes.error_table = entry.tables.join(",");
    if (entry.http !== "-") subCodes.documented_http = entry.http;
    explanation.push(
      `Paysafe error ${code} (${entry.tables.map((t) => ERROR_TABLE_TITLES[t]).join("; ")}): ${entry.meaning}.`,
    );
    const note = lookup(ERROR_CODE_NOTES, code!);
    if (note) explanation.push(note);
    if (
      entry.tables.some(
        (t) => t === "payment" || t === "void" || t === "settlement" || t === "refund",
      )
    )
      docs.push({ title: "Paysafe card errors", url: CARD_ERRORS_URL });
  } else if (interchecks) {
    category = interchecks.category;
    retry = interchecks.retry;
    const addCard = INTERCHECKS_ADD_CARD_CODES.has(code!);
    confidence = addCard ? "strong" : "possible";
    subCodes.error_table = "interchecks";
    explanation.push(
      `Interchecks (instant card payout) error ${code}: ${interchecks.meaning}. Paysafe maps it to ${interchecks.newMapping} (HTTP/code) in its newer table${interchecks.existingMapping !== "-" ? ` and ${interchecks.existingMapping} in the older one` : ""}.`,
    );
    if (!addCard)
      missing.push("Paysafe does not document in which field this Interchecks name is returned.");
  } else {
    const fb = fallbackByHttp(input.httpStatus);
    category = fb.category;
    retry = fb.retry;
    confidence = fb.confidence;
    if (code) {
      explanation.push(
        `Paysafe error code "${safeText(code, 64)}" is not in the documented tables.`,
      );
      missing.push(`Error code "${safeText(code, 64)}" is not documented in the reviewed sources.`);
      if (code === "DW-CUSTOMER-CONFLICT")
        explanation.push("It appears only in a test fixture of Paysafe's Java SDK (HTTP 409).");
    } else {
      explanation.push("The error carries no code.");
      missing.push("No error code was supplied.");
    }
    if (input.httpStatus !== undefined && fb.confidence !== "insufficient")
      explanation.push(`The guidance below follows the HTTP status ${input.httpStatus}.`);
  }

  if (input.httpStatus !== undefined) subCodes.http_status = String(input.httpStatus);
  if (input.headerCode !== undefined) {
    subCodes.application_status_code = input.headerCode;
    if (bodyCode !== undefined && bodyCode !== input.headerCode)
      missing.push(
        `The X-Application-Status-Code header (${input.headerCode}) differs from error.code (${bodyCode}); Paysafe documents them as the same value.`,
      );
  }
  if (
    documentedHttp &&
    documentedHttp !== "-" &&
    input.httpStatus !== undefined &&
    String(input.httpStatus) !== documentedHttp &&
    code !== "5272"
  )
    missing.push(
      `Paysafe documents code ${code} with HTTP ${documentedHttp}, but the response status is ${input.httpStatus}.`,
    );

  // Field errors: JSON paths and Paysafe's short texts.
  const fields = (e?.fieldErrors ?? [])
    .map((f) => {
      const path =
        typeof f.field === "string" && /^[A-Za-z0-9_.[\]-]{1,120}$/.test(f.field)
          ? f.field
          : undefined;
      const text = safeText(f.error, 160);
      return path ? `${path}${text ? ` (${text})` : ""}` : undefined;
    })
    .filter((x): x is string => Boolean(x))
    .slice(0, 10);
  if (fields.length) {
    explanation.push(`Fields: ${fields.join("; ")}.`);
    subCodes.fields = fields
      .map((f) => f.split(" ")[0]!)
      .join(",")
      .slice(0, 300);
  }

  // Merchant advice code: Paysafe's own retry advice, so it wins.
  const retryParts: string[] = [];
  const adviceCode = additional(e, "ADVICE");
  if (adviceCode) {
    subCodes.advice_code = adviceCode;
    const advice = lookup(ADVICE_CODES, adviceCode);
    if (advice) {
      retry = advice.retry;
      retryParts.push(`Paysafe merchant advice code ${adviceCode}: ${advice.meaning}.`);
    } else missing.push(`Merchant advice code "${adviceCode}" is not documented.`);
    docs.push({ title: "Paysafe merchant advice codes", url: CARD_ERRORS_URL });
  }
  const isoCode = additional(e, "ISO_RESPONSE");
  if (isoCode) {
    subCodes.iso_response_code = isoCode;
    const iso = lookup(ISO_RESPONSE_CODES, isoCode);
    explanation.push(
      iso
        ? `ISO response code ${isoCode}: ${iso.meaning}${iso.approval ? " (an approval code)" : ""}.`
        : `ISO response code "${isoCode}" is not in Paysafe's ISO table.`,
    );
    if (!iso) missing.push(`ISO response code "${isoCode}" is not documented.`);
  }
  const otherDetail = e?.additionalDetails?.find(
    (d) => typeof d.type === "string" && d.type !== "ADVICE" && d.type !== "ISO_RESPONSE",
  );
  if (otherDetail) {
    const t = safeId(otherDetail.type, 32);
    const c = codeOf(otherDetail.code);
    if (t) subCodes.additional_detail = c ? `${t}:${c}` : t;
  }

  // AVS letters listed under error 3007.
  const gr = input.gateway;
  const avsCode = gr ? str(gr.avsCode) : undefined;
  if (code === "3007" && avsCode && /^[A-Z]$/.test(avsCode)) {
    subCodes.avs_code = avsCode;
    const meaning = lookup(AVS_CODES, avsCode);
    explanation.push(
      meaning
        ? `gatewayResponse.avsCode ${avsCode}: ${meaning}. Paysafe lists the AVS letters under error 3007; reading avsCode with that list is an inference.`
        : `gatewayResponse.avsCode "${avsCode}" is not in the AVS list of error 3007.`,
    );
  }
  const downstream = gr ? safeText(gr.responseCodeDescription, 160) : undefined;
  if (downstream) explanation.push(`The downstream gateway response says: "${downstream}".`);

  // Outcome: a 402 or a failed resource is a definitive answer.
  const definitive =
    input.httpStatus === 402 ||
    input.finalFailure === true ||
    documentedHttp === "402" ||
    (category !== "provider_unavailable" &&
      category !== "network_or_timeout" &&
      category !== "unknown");
  const declined = input.httpStatus === 402 || documentedHttp === "402";
  if (retry === "retry_conditionally" && declined)
    retryParts.push(
      "This attempt was declined; a later attempt may succeed, within the card scheme's retry limits.",
    );
  else if (retry === "retry_conditionally" && input.finalFailure)
    retryParts.push(
      "Paysafe reports this attempt as failed, so it did not take effect; a new attempt may succeed later.",
    );
  else retryParts.push(RETRY_TEXT[retry]);
  if (code === "1100") retryParts.push("Paysafe says to retry later.");
  if (!definitive)
    retryParts.push("The record does not show whether the original operation took effect.");
  if (!loc.paymentReference && (category === "card_declined" || input.httpStatus === 402))
    missing.push(
      "No resource id; the later state of this transaction cannot be checked from this record.",
    );
  if (code === "3425")
    docs.push({ title: "Paysafe transactions and chargebacks", url: CHARGEBACKS_URL });

  const messageParts = [
    safeText(e?.message, 200),
    ...(e?.details ?? []).map((d) => safeText(d, 200)).slice(0, 3),
    !e ? safeText(input.bodyText, 200) : undefined,
  ].filter((x): x is string => Boolean(x));
  const providerMessage = messageParts.length ? safeText(messageParts.join(" "), 500) : undefined;

  return {
    ...withRefs(loc),
    code: code ?? (input.httpStatus !== undefined ? `HTTP ${input.httpStatus}` : "unknown"),
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: explanation.join(" "),
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence,
    documentation: docs,
    missingInformation: missing,
    ...(definitive ? { outcomeKnown: true } : {}),
  };
}

/** Raw processor response in gatewayResponse, read with the processor table by inference. */
function decodeGateway(
  gr: Record<string, unknown>,
  loc: Location,
  hasPaysafeError: boolean,
): DecodedErrorDraft | undefined {
  const responseCode = codeOf(gr.responseCode);
  if (!responseCode) return undefined;
  const gatewayCode = safeId(gr.code, 16);
  const table = gatewayCode ? lookup(PROCESSOR_TABLE_BY_GATEWAY_CODE, gatewayCode) : undefined;
  const entry = table ? processorEntry(table, responseCode) : undefined;
  if (entry?.approval) return undefined;
  if (!entry && hasPaysafeError) return undefined;
  const subCodes: Record<string, string> = { response_code: responseCode };
  if (gatewayCode) subCodes.gateway_code = gatewayCode;
  if (table) subCodes.processor_table = table;
  const missing: string[] = [];
  let explanation: string;
  if (entry && table) {
    explanation = `Raw processor response ${responseCode} in the ${table} table: ${entry.meaning}. The OpenAPI file lists this table by processor name without naming the field; reading gatewayResponse.responseCode with it is an inference.`;
    if (entry.vsps)
      explanation += " This is a Visa Stop Payment Service code with Paysafe's own rebill advice.";
    missing.push(
      "Paysafe does not document which payload field carries the processor table codes.",
    );
  } else {
    explanation = table
      ? `Raw processor response "${responseCode}" is not in the ${table} table.`
      : `Raw processor response "${responseCode}" cannot be decoded: ${gatewayCode ? `no processor table is documented for gateway code ${gatewayCode}` : "the processor is not named"}.`;
    missing.push("The processor table for this response code is unknown.");
  }
  const category = entry?.category ?? "unknown";
  const retry = entry?.retry ?? "unknown";
  const message = safeText(gr.responseCodeDescription, 200);
  return {
    ...withRefs(loc),
    code: responseCode,
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: RETRY_TEXT[retry],
    confidence: entry ? "possible" : "insufficient",
    documentation: [{ title: "Paysafe Payments API OpenAPI file", url: OPENAPI_URL }],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function resourceErrors(
  o: Record<string, unknown>,
  kind: ResourceKind | undefined,
  basePath: string,
  ctx: NormalizeContext,
  parentRef: string | undefined,
  httpStatus: number | undefined,
  ownId?: string,
): DecodedErrorDraft[] {
  const id = safeId(o.id) ?? ownId;
  const ref =
    kind && MODIFICATIONS.has(kind)
      ? (parentRef ?? id)
      : kind === "payment_handle"
        ? undefined
        : (id ?? parentRef);
  const loc = (path: string): Location => ({
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ref ? { paymentReference: ref } : {}),
    ...(id ? { attemptReference: id } : {}),
  });
  const status = upperWord(o.status);
  const finalFailure = status === "FAILED" || status === "ERROR";
  const gr = isObj(o.gatewayResponse) ? o.gatewayResponse : undefined;
  const out: DecodedErrorDraft[] = [];
  const err = isObj(o.error) ? (o.error as ErrorValue) : undefined;
  const headerCode =
    basePath === "" ? codeOf(header(ctx.meta, "x-application-status-code")) : undefined;
  if (err) {
    const decoded = decodePaysafeError(
      {
        error: err,
        ...(headerCode ? { headerCode } : {}),
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(gr ? { gateway: gr } : {}),
        finalFailure,
      },
      loc(`${basePath}error`),
    );
    if (kind === "payment_handle")
      decoded.documentation.push({ title: "Paysafe payment handles", url: GET_STARTED_URL });
    out.push(decoded);
  }
  const failed = Boolean(err) || finalFailure || httpStatus === 402;
  if (gr && failed) {
    const g = decodeGateway(gr, loc(`${basePath}gatewayResponse`), Boolean(err));
    if (g) out.push(g);
  }
  return out;
}

function decodeErrors(parsed: PaysafeParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const httpStatus = ctx.meta?.http?.status;
  if (parsed.kind === "error") {
    const e = parsed.value.error;
    const headerCode = codeOf(header(ctx.meta, "x-application-status-code"));
    const bodyText = ctx.meta?.http?.bodyText;
    return [
      decodePaysafeError(
        {
          ...(e ? { error: e } : {}),
          ...(headerCode ? { headerCode } : {}),
          ...(bodyText ? { bodyText } : {}),
          ...(httpStatus !== undefined ? { httpStatus } : {}),
        },
        {
          sourceFormat: ctx.format,
          source: { recordIndex: ctx.recordIndex, path: e ? "error" : "" },
        },
      ),
    ];
  }

  if (parsed.kind === "resource") {
    const o = parsed.value as Record<string, unknown>;
    const request = pathInfo(ctx.meta);
    if (request && ctx.meta?.http?.kind === "request") return [];
    const kind = request?.kind ?? kindFromBody(o);
    const out = resourceErrors(o, kind, "", ctx, request?.parent, httpStatus);
    if (kind === "payment") {
      const pid = safeId(o.id);
      (parsed.value.settlements ?? []).forEach((s, i) => {
        out.push(...resourceErrors(s, "settlement", `settlements[${i}].`, ctx, pid, undefined));
      });
    }
    return out;
  }

  const w = parsed.value;
  const payload = w.payload as Record<string, unknown>;
  const kind = webhookKind(w as Record<string, unknown>, payload);
  const resourceId = safeId(w.resourceId);
  const out = resourceErrors(payload, kind, "payload.", ctx, undefined, undefined, resourceId);
  if (kind === "payment") {
    const pid = safeId(payload.id) ?? resourceId;
    (w.payload.settlements ?? []).forEach((s, i) => {
      out.push(
        ...resourceErrors(s, "settlement", `payload.settlements[${i}].`, ctx, pid, undefined),
      );
    });
  }
  return out;
}

export const paysafeAdapter: ProviderAdapter<PaysafeParsed> = {
  id: PROVIDER,
  displayName: "Paysafe",
  version: PAYSAFE_ADAPTER_VERSION,
  manifest: paysafeManifest,
  supportedFormats: [
    {
      id: "paysafe.resource",
      description:
        "Payments API v1 resource response (payment handle, payment, settlement, refund, void, credit, verification), including HTTP 402 declines with an error object",
    },
    {
      id: "paysafe.error",
      description:
        "Payments API v1 error body ({ error: { code, message, details, fieldErrors, additionalDetails } }) or an error response with an X-Application-Status-Code header",
    },
    {
      id: "paysafe.webhook",
      description:
        "Payments API webhook envelope (eventName, payload, attemptNumber, resourceId, eventDate)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // Resource ids share one namespace because a settlement made with the
    // payment (settleWithAuth true, one-step APMs) reuses the payment id. The
    // handle key links a payment handle to the payment it funded.
    // merchantRefNum is never a key.
    const keys: string[] = [];
    if (event.paymentReference) keys.push(`ref:${event.paymentReference}`);
    if (event.relatedReference) keys.push(`ref:${event.relatedReference}`);
    const handle = event.attributes.paymentHandleKey;
    if (typeof handle === "string" && handle) keys.push(`handle:${handle}`);
    return keys;
  },
};

export * from "./catalog.js";
export default paysafeAdapter;
