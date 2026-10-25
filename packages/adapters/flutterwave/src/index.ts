/**
 * Flutterwave adapter.
 *
 * Supported input families:
 * - `flutterwave.v3.response`        v3 REST envelope `{ status, message, data, meta }` with a
 *                                    transaction, transfer, refund or chargeback object (or a
 *                                    list of them), an authorization prompt, or an error message
 * - `flutterwave.v3.object`          the same objects without the envelope
 * - `flutterwave.v3.webhook`         v3 webhook `{ event, data, "event.type" }`
 * - `flutterwave.v3.refund_webhook`  v3 refund webhook (PascalCase keys, no `event`)
 * - `flutterwave.v3.server_error`    v3 server error `{ error_id, message, code: "app_error" }`
 * - `flutterwave.v4.error`           v4 error `{ status: "failed", error: { type, code } }`
 * - `flutterwave.v4.response`        v4 REST response with a chg_, trf_, rfd_ or chb_ object
 * - `flutterwave.v4.webhook`         v4 webhook `{ webhook_id | id, timestamp, type, data }`
 *
 * Recognized but not analyzed: v3 webhooks outside payments acceptance
 * (BVN, bill payment, subscription, tokenization, quote), virtual card
 * notifications, the v3 transaction events timeline and v3 redirect
 * parameters.
 *
 * The v3 envelope `status` is about the API call, not the payment: a charge
 * can have envelope `success` and `data.status` `pending`. The literal key
 * `"event.type"` is read as one key, not as a path. Signature headers
 * (`verif-hash`, which carries the merchant's secret hash itself, and
 * `flutterwave-signature`) are never read or copied.
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
  CHARGEBACK_STAGES,
  CHARGEBACK_STATUSES,
  DISBURSE_FAILED_PREFIX,
  NEXT_ACTION,
  RETRY_TEXT,
  V3_AUTH_MODELS,
  V3_AUTH_MODES,
  V3_CARD_URL,
  V3_ERROR_MESSAGES,
  V3_EVENTS,
  V3_EVENT_TYPE_VALUES,
  V3_HTTP_FALLBACK,
  V3_OTHER_EVENTS,
  V3_PAYMENT_TYPES,
  V3_PROCESSOR_AUTH_PROMPTS,
  V3_PROCESSOR_FAILURES,
  V3_PROCESSOR_PENDING_TEXTS,
  V3_PROCESSOR_SUCCESS_TEXTS,
  V3_REFUND_STATUSES,
  V3_TIMEOUTS_URL,
  V3_TRANSACTION_STATUSES,
  V3_TRANSFERS_URL,
  V3_TRANSFER_FAILURES,
  V3_TRANSFER_PROGRESS_TEXTS,
  V3_TRANSFER_STATUSES,
  V3_VELOCITY_TRIGGERS,
  V3_VOID_TEXT,
  V3_WEBHOOKS_URL,
  V4_CHARGE_STATUSES,
  V4_CHARGE_URL,
  V4_ERRORS_BY_CODE,
  V4_ERRORS_BY_PAIR,
  V4_ERRORS_URL,
  V4_NEXT_ACTIONS,
  V4_PAYOUT_ERRORS,
  V4_PROCESSOR_BY_TYPE,
  V4_PROCESSOR_RESPONSES,
  V4_PROVIDER_RESPONSE_TYPES,
  V4_REFUND_STATUSES,
  V4_TESTING_URL,
  V4_TRANSFER_STATUSES,
  V4_TRANSFER_URL,
  V4_TYPE_ALIASES,
  V4_WEBHOOK_TYPES,
  type StatusEntry,
  type TextEntry,
} from "./catalog.js";

import { flutterwaveManifest, FLUTTERWAVE_ADAPTER_VERSION } from "./manifest.js";

export { flutterwaveManifest, FLUTTERWAVE_ADAPTER_VERSION };

const PROVIDER = "flutterwave";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** v3 numeric ids arrive as integers; some examples use strings. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  return safeId(v);
}

const isNumericId = (v: unknown) =>
  (typeof v === "number" && Number.isSafeInteger(v)) ||
  (typeof v === "string" && /^\d{1,20}$/.test(v));

// ---------------------------------------------------------------------------
// Identifier and value shapes
// ---------------------------------------------------------------------------

const V4_ID = {
  charge: /^chg_[A-Za-z0-9]{4,64}$/,
  transfer: /^trf_[A-Za-z0-9]{4,64}$/,
  refund: /^rfd_[A-Za-z0-9]{4,64}$/,
  chargeback: /^chb_[A-Za-z0-9]{4,64}$/,
} as const;
const WEBHOOK_ID = /^wbk_[A-Za-z0-9]{4,64}$/;
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\.?`?$/;
const RETRY_SUFFIX = /_RETRY_\d{1,4}$/;
const SHORT_WORD = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;

type V4Kind = keyof typeof V4_ID;

function v4KindOf(v: unknown): V4Kind | null {
  if (typeof v !== "string") return null;
  for (const k of Object.keys(V4_ID) as V4Kind[]) if (V4_ID[k].test(v)) return k;
  return null;
}

/** A short documented-looking word, or nothing. */
const word = (v: unknown): string | undefined =>
  typeof v === "string" && SHORT_WORD.test(v) ? v : undefined;

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

// Masked phone numbers ("*******0123") and long digit runs (phone or account
// numbers) are removed from provider texts before they are shown.
const MASKED_TOKEN = /\S*(?:\*\S*\d|\d\S*\*)\S*/g;
const LONG_DIGITS = /\d{9,}/g;

function freeText(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = safeText(v.replace(/\s+/g, " ").trim(), max);
  return t?.replace(MASKED_TOKEN, "[redacted]").replace(LONG_DIGITS, "[redacted]");
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      out[k] = v.map((x) => safeText(x, 64) ?? "");
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** v3 and v4 amounts are decimals in major units. */
const amountOf = (v: unknown, currency: string | undefined) =>
  typeof v === "number" || typeof v === "string" ? decimalToMinor(v, currency) : undefined;

/** 0/1 flags (v3 transfers) and booleans. */
function flag(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === 0 || v === 1) return v === 1;
  return undefined;
}

// ---------------------------------------------------------------------------
// Text matching (v3 messages)
// ---------------------------------------------------------------------------

const TEMPLATE_CACHE = new Map<string, RegExp>();

function templateRe(text: string): RegExp {
  let re = TEMPLATE_CACHE.get(text);
  if (!re) {
    const parts = text.split(/<[^>]+>/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    re = new RegExp(`^${parts.join("\\S(?:[^\\n]{0,62}\\S)?")}$`, "i");
    TEMPLATE_CACHE.set(text, re);
  }
  return re;
}

function matchText(text: string | undefined, lists: readonly (readonly TextEntry[])[]) {
  if (!text) return undefined;
  const t = norm(text);
  if (t.length > 1000) return undefined;
  // Exact texts first, so "Cardno is required" wins over "<field> is required".
  for (const mode of ["exact", "prefix", "template"] as const) {
    for (const list of lists) {
      for (const e of list) {
        if (e.match !== mode) continue;
        if (mode === "exact" && t === e.text.toLowerCase()) return e;
        if (mode === "prefix" && e.prefix && t.startsWith(e.prefix.toLowerCase())) return e;
        if (mode === "template" && templateRe(e.text).test(t)) return e;
      }
    }
  }
  return undefined;
}

const ENVELOPE_MESSAGE_LISTS = [V3_ERROR_MESSAGES, V3_VELOCITY_TRIGGERS, V3_PROCESSOR_FAILURES];
const PROCESSOR_FAILURE_LISTS = [V3_PROCESSOR_FAILURES, V3_VELOCITY_TRIGGERS, V3_ERROR_MESSAGES];

/** Documented processor_response text, as it may be shown. */
function knownProcessorText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const t = norm(text);
  if (V3_PROCESSOR_SUCCESS_TEXTS.has(t) || V3_PROCESSOR_PENDING_TEXTS.has(t) || t === V3_VOID_TEXT)
    return freeText(text, 120);
  const prompt = V3_PROCESSOR_AUTH_PROMPTS.find((p) => t.startsWith(p.prefix.toLowerCase()));
  if (prompt) return prompt.shown;
  const failure = matchText(text, PROCESSOR_FAILURE_LISTS);
  if (failure)
    return failure.match === "exact" ? freeText(text, 120) : (failure.prefix ?? failure.text);
  return undefined;
}

function isAuthPrompt(text: string | undefined): boolean {
  if (!text) return false;
  const t = norm(text);
  return V3_PROCESSOR_AUTH_PROMPTS.some((p) => t.startsWith(p.prefix.toLowerCase()));
}

// ---------------------------------------------------------------------------
// v3 object classification and detection scores
// ---------------------------------------------------------------------------

type V3Kind = "transaction" | "transfer" | "refund" | "chargeback";

function v3KindOf(o: Obj): V3Kind | null {
  if (
    typeof o.stage === "string" &&
    has(o, "flw_ref") &&
    (has(o, "due_date") || (isObj(o.meta) && Array.isArray(o.meta.history)))
  )
    return "chargeback";
  if (has(o, "amount_refunded") && (isNumericId(o.tx_id) || isNumericId(o.transaction_id)))
    return "refund";
  if (has(o, "complete_message") || (has(o, "requires_approval") && has(o, "is_approved")))
    return "transfer";
  if (typeof o.flw_ref === "string" || typeof o.tx_ref === "string") return "transaction";
  return null;
}

const TRANSACTION_EXTRAS = [
  "processor_response",
  "app_fee",
  "charged_amount",
  "auth_model",
  "payment_type",
  "merchant_fee",
  "charge_type",
  "fraud_status",
  "amount_settled",
];

/** Structural score of a v3 object of the given kind; 0 when it is not distinctive. */
function v3Score(o: Obj, kind: V3Kind): number {
  switch (kind) {
    case "transaction": {
      const extras = TRANSACTION_EXTRAS.filter((k) => has(o, k)).length;
      if (typeof o.flw_ref === "string" && typeof o.tx_ref === "string")
        return Math.min(0.96, 0.85 + 0.02 * extras);
      return extras >= 2 ? Math.min(0.8, 0.5 + 0.05 * extras) : 0;
    }
    case "transfer": {
      let s = 0;
      if (has(o, "complete_message")) s += 0.6;
      if (has(o, "requires_approval") && has(o, "is_approved")) s += 0.25;
      if (has(o, "debit_currency")) s += 0.05;
      if (typeof o.status === "string" && o.status in V3_TRANSFER_STATUSES) s += 0.05;
      return s >= 0.6 ? Math.min(0.95, s) : 0;
    }
    case "refund": {
      let s = 0.7;
      if (has(o, "flw_ref")) s += 0.15;
      if (has(o, "wallet_id") || has(o, "destination") || has(o, "settlement_id")) s += 0.05;
      return s;
    }
    case "chargeback": {
      let s = 0.8;
      if (typeof o.status === "string" && o.status.toLowerCase() in CHARGEBACK_STATUSES) s += 0.05;
      if (has(o, "tx_ref") || has(o, "transaction_id")) s += 0.05;
      return s;
    }
  }
}

function v4Score(o: Obj): number {
  const kind = v4KindOf(o.id);
  if (!kind) return 0;
  let s = 0.75;
  for (const k of [
    "next_action",
    "created_datetime",
    "payment_method_details",
    "charge_id",
    "provider_response",
  ])
    if (has(o, k)) s += 0.04;
  if (isObj(o.processor_response)) s += 0.05;
  return Math.min(0.95, s);
}

const round = (n: number) => Math.round(n * 100) / 100;

function none(): DetectionResult {
  return { provider: PROVIDER, format: null, confidence: 0, supported: false, reasons: [] };
}

function found(
  format: string,
  confidence: number,
  reasons: string[],
  unsupportedReason?: string,
): DetectionResult {
  return {
    provider: PROVIDER,
    format,
    confidence: round(confidence),
    supported: !unsupportedReason,
    reasons,
    ...(unsupportedReason ? { unsupportedReason } : {}),
  };
}

const EVENT_LIST_KEYS = ["note", "actor", "object", "action", "context"];

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  if (!isObj(input)) return none();

  // v3 redirect parameters appended to redirect_url (query string or form).
  if (
    typeof input.tx_ref === "string" &&
    typeof input.status === "string" &&
    has(input, "transaction_id") &&
    !has(input, "flw_ref") &&
    !has(input, "data")
  ) {
    return found(
      "flutterwave.v3.redirect",
      meta?.format === "form" || meta?.format === "http" ? 0.75 : 0.6,
      ["has status, tx_ref and transaction_id (v3 redirect parameters)"],
      "Flutterwave redirect parameters reach the browser and are not a trustworthy final state. Flutterwave says to verify the transaction server-side; paste the verify response or the charge.completed webhook instead.",
    );
  }
  if (meta?.format === "form") return none();

  // Stripe objects carry `object`; Flutterwave payloads never do at the top level.
  if (has(input, "object")) return none();

  // v4 webhook
  if (typeof input.type === "string" && isObj(input.data) && !has(input, "event")) {
    const hookId = str(input.webhook_id) ?? str(input.id);
    const wbk = hookId !== undefined && WEBHOOK_ID.test(hookId);
    const documented = lookup(V4_WEBHOOK_TYPES, input.type) !== undefined;
    const dataKind = v4KindOf(input.data.id);
    const ms = typeof input.timestamp === "number";
    let score = 0;
    const reasons: string[] = [];
    if (wbk) {
      score = 0.9;
      reasons.push("webhook id has the wbk_ prefix");
    } else if (documented && dataKind && (typeof input.webhook_id === "string" || ms)) {
      score = 0.8;
      reasons.push("type is a documented v4 webhook type and data.id has a v4 prefix");
    }
    if (score > 0) {
      if (documented) score += 0.04;
      if (dataKind) score += 0.03;
      if (ms) score += 0.01;
      return found("flutterwave.v4.webhook", Math.min(0.98, score), reasons);
    }
  }

  // v4 error
  if (input.status === "failed" && isObj(input.error)) {
    const e = input.error;
    const type = str(e.type);
    const code = typeof e.code === "string" && /^\d{2,8}$/.test(e.code) ? e.code : undefined;
    if (type && UPPER_SNAKE.test(type)) {
      const t = normalizeV4Type(type);
      if (code && V4_ERRORS_BY_PAIR.has(`${code}|${t}`))
        return found("flutterwave.v4.error", 0.92, [
          'status is "failed"',
          "error.code and error.type are a documented v4 pair",
        ]);
      if (code)
        return found("flutterwave.v4.error", 0.6, [
          'status is "failed"',
          "error has an upper-case type and a digit-string code",
        ]);
    }
  }

  // v3 server error (HTTP 500)
  if (
    input.code === "app_error" &&
    typeof input.error_id === "string" &&
    typeof input.message === "string" &&
    !has(input, "status")
  ) {
    return found("flutterwave.v3.server_error", input.error_id.startsWith("ERRNO") ? 0.85 : 0.6, [
      'code is "app_error"',
      "has error_id and message",
    ]);
  }

  // v3 refund webhook (PascalCase keys)
  if (has(input, "AmountRefunded")) {
    const markers = ["FlwRef", "TransactionId", "AccountId", "walletId"].filter((k) =>
      has(input, k),
    ).length;
    if (markers >= 2)
      return found("flutterwave.v3.refund_webhook", markers >= 3 ? 0.92 : 0.75, [
        "has AmountRefunded with PascalCase refund webhook keys",
      ]);
  }

  // v3 virtual card notifications (card issuing, out of scope)
  if (has(input, "MaskedPan") && has(input, "TransactionId") && has(input, "Type")) {
    return found(
      "flutterwave.v3.other_webhook",
      0.7,
      ["has MaskedPan, TransactionId and Type (virtual card notification)"],
      "Flutterwave virtual card notifications belong to card issuing and are not analyzed.",
    );
  }

  // v3 webhook
  if (typeof input.event === "string") {
    const dotKey = has(input, "event.type");
    const event = input.event;
    const entry = lookup(V3_EVENTS, event);
    const data = isObj(input.data) ? input.data : undefined;
    const kind = data ? v3KindOf(data) : null;
    const dataScore = data && kind ? v3Score(data, kind) : 0;
    const reasons: string[] = [];
    if (dotKey) reasons.push('has the literal "event.type" key');
    if (V3_OTHER_EVENTS.has(event)) {
      if (!dotKey && dataScore === 0) return none();
      return found(
        "flutterwave.v3.other_webhook",
        dotKey ? 0.85 : 0.6,
        [...reasons, "event is a documented v3 event outside payments acceptance"],
        `Flutterwave "${safeText(event, 64)}" webhooks are outside payments acceptance and are not analyzed.`,
      );
    }
    if (entry) {
      reasons.push("event is a documented v3 webhook event");
      if (dotKey) {
        const match = kind !== null && kind === entry.object;
        return found("flutterwave.v3.webhook", match ? 0.96 : 0.9, reasons);
      }
      if (kind === entry.object && dataScore >= 0.6) {
        reasons.push(`data has the v3 ${kind} fields`);
        return found("flutterwave.v3.webhook", Math.min(0.95, dataScore + 0.05), reasons);
      }
      return none();
    }
    if (dotKey && (data || has(input, "data"))) {
      return found("flutterwave.v3.webhook", kind ? 0.75 : 0.6, [
        ...reasons,
        "event is not a documented v3 event",
      ]);
    }
    if (kind && dataScore >= 0.8)
      return found("flutterwave.v3.webhook", 0.6, [`data has the v3 ${kind} fields`]);
    return none();
  }

  // v3 and v4 envelopes
  if (input.status === "success" || input.status === "error") {
    const reasons = [`envelope status is "${input.status}"`];
    const data = input.data;
    if (isObj(data)) {
      const kind = v3KindOf(data);
      const s = kind ? v3Score(data, kind) : 0;
      if (kind && s > 0)
        return found("flutterwave.v3.response", Math.min(0.98, s + 0.02), [
          ...reasons,
          `data has the v3 ${kind} fields`,
        ]);
      const s4 = input.status === "success" ? v4Score(data) : 0;
      if (s4 > 0)
        return found("flutterwave.v4.response", s4, [...reasons, "data.id has a v4 prefix"]);
    }
    if (Array.isArray(data) && data.length > 0 && isObj(data[0])) {
      const first = data[0];
      const kind = v3KindOf(first);
      const s = kind ? v3Score(first, kind) : 0;
      if (kind && s > 0)
        return found("flutterwave.v3.response", Math.min(0.95, s), [
          ...reasons,
          `data is a list of v3 ${kind} objects`,
        ]);
      const s4 = input.status === "success" ? v4Score(first) : 0;
      if (s4 > 0)
        return found("flutterwave.v4.response", s4, [
          ...reasons,
          "data is a list of objects with a v4 id prefix",
        ]);
      if (EVENT_LIST_KEYS.every((k) => has(first, k)) && typeof input.message === "string") {
        return found(
          "flutterwave.v3.transaction_events",
          0.7,
          [...reasons, "data is a list of note, actor, object, action and context entries"],
          "The Flutterwave v3 transaction events timeline carries no transaction id of its own and is not analyzed. Paste the verify response or the webhooks instead.",
        );
      }
    }
    if (data === undefined || data === null) {
      const auth =
        isObj(input.meta) && isObj(input.meta.authorization) ? input.meta.authorization : undefined;
      const mode = auth ? str(auth.mode) : undefined;
      if (auth && mode && lookup(V3_AUTH_MODES, mode)) {
        const detail =
          Array.isArray(auth.fields) ||
          (typeof auth.endpoint === "string" && auth.endpoint.includes("/v3/validate-charge"));
        return found("flutterwave.v3.response", detail ? 0.75 : 0.6, [
          ...reasons,
          "meta.authorization.mode is a documented v3 authorization mode",
        ]);
      }
      if (input.status === "error" && typeof input.message === "string") {
        const entry = matchText(input.message, ENVELOPE_MESSAGE_LISTS);
        // A bare error envelope is a generic shape; a documented message
        // only brings it to the acceptance threshold.
        if (entry)
          return found("flutterwave.v3.response", entry.match === "template" ? 0.45 : 0.5, [
            ...reasons,
            "message is a documented v3 error message",
          ]);
      }
    }
    return none();
  }

  // Bare v3 object
  const kind = v3KindOf(input);
  if (kind) {
    const s = v3Score(input, kind);
    if (s >= 0.6)
      return found("flutterwave.v3.object", Math.min(0.9, s), [`has the v3 ${kind} fields`]);
  }
  return none();
}

function normalizeV4Type(type: string): string {
  // A loop instead of /[`.]+$/ keeps the cost linear on any input.
  let end = type.length;
  while (end > 0 && (type[end - 1] === "." || type[end - 1] === "`")) end--;
  const t = type.slice(0, end).trim();
  return V4_TYPE_ALIASES[t] ?? t;
}

// ---------------------------------------------------------------------------
// Schemas and parse
// ---------------------------------------------------------------------------

const Id = z.union([z.number().int(), z.string().max(128)]);
const Amount = z.union([z.number(), z.string().max(64)]);

const V3Transaction = z.looseObject({
  id: Id.optional(),
  tx_ref: z.string().max(256).optional(),
  flw_ref: z.string().max(256).optional(),
  status: z.string().max(64),
  amount: Amount.optional(),
  currency: z.string().max(8).optional(),
});
const V3Transfer = z.looseObject({
  id: Id.optional(),
  status: z.string().max(64),
  reference: z.string().max(256).optional(),
  amount: Amount.optional(),
  currency: z.string().max(8).optional(),
});
const V3Refund = z.looseObject({
  id: Id.optional(),
  status: z.string().max(64),
  amount_refunded: Amount.optional(),
});
const V3Chargeback = z.looseObject({
  id: Id.optional(),
  status: z.string().max(64),
  stage: z.string().max(64).optional(),
  flw_ref: z.string().max(256).optional(),
});
const V3_SCHEMAS = {
  transaction: V3Transaction,
  transfer: V3Transfer,
  refund: V3Refund,
  chargeback: V3Chargeback,
} as const;

const V3Envelope = z.looseObject({
  status: z.enum(["success", "error"]),
  message: z.string().max(2000).optional(),
  data: z.unknown().optional(),
  meta: z.unknown().optional(),
});

const V3Webhook = z.looseObject({
  event: z.string().max(128),
  data: z.looseObject({}),
});

const V3RefundWebhook = z.looseObject({
  id: Id,
  status: z.string().max(64),
  AmountRefunded: Amount.optional(),
  TransactionId: Id.optional(),
  FlwRef: z.string().max(256).optional(),
  meta: z.unknown().optional(),
  createdAt: z.string().max(64).optional(),
});

const V3ServerError = z.looseObject({
  error_id: z.string().max(128),
  message: z.string().max(2000),
  code: z.literal("app_error"),
});

const V4Error = z.looseObject({
  status: z.literal("failed"),
  message: z.string().max(2000).optional(),
  error: z.looseObject({
    type: z.string().max(128),
    code: z.string().max(16).optional(),
    message: z.string().max(2000).optional(),
    validation_errors: z
      .array(z.looseObject({ field_name: z.string().max(128).optional() }))
      .max(100)
      .optional(),
  }),
});

const V4Object = z.looseObject({ id: z.string().max(128), status: z.string().max(64).optional() });

const V4Envelope = z.looseObject({
  status: z.literal("success"),
  message: z.string().max(2000).optional(),
  data: z.union([z.looseObject({}), z.array(z.unknown()).max(1000)]),
});

const V4Webhook = z.looseObject({
  webhook_id: z.string().max(128).optional(),
  id: z.string().max(128).optional(),
  timestamp: z.union([z.number(), z.string().max(64)]).optional(),
  type: z.string().max(128),
  data: z.looseObject({}),
});

type V3Item = { kind: V3Kind; value: Obj; path: string };
type V4Item = { kind: V4Kind; value: Obj; path: string };

export type FlutterwaveParsed =
  | {
      kind: "v3_response";
      envelope: z.infer<typeof V3Envelope>;
      items: V3Item[];
      authMode?: string;
    }
  | { kind: "v3_object"; items: V3Item[] }
  | { kind: "v3_webhook"; value: z.infer<typeof V3Webhook>; item: V3Item | null }
  | { kind: "v3_refund_webhook"; value: z.infer<typeof V3RefundWebhook> }
  | { kind: "v3_server_error"; value: z.infer<typeof V3ServerError> }
  | { kind: "v4_error"; value: z.infer<typeof V4Error> }
  | { kind: "v4_response"; envelope: z.infer<typeof V4Envelope>; items: V4Item[] }
  | { kind: "v4_webhook"; value: z.infer<typeof V4Webhook>; item: V4Item | null };

type ParseResult = { ok: true; value: FlutterwaveParsed } | { ok: false; issues: string[] };

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const p = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
    return `${p || "(root)"}: ${i.message}`;
  });
}

function v3Item(o: Obj, path: string, issues: string[]): V3Item | null {
  const kind = v3KindOf(o);
  if (!kind) return null;
  const r = V3_SCHEMAS[kind].safeParse(o);
  if (!r.success) {
    issues.push(...issuesOf(r.error, path));
    return null;
  }
  return { kind, value: r.data, path };
}

function v4Item(o: Obj, path: string, issues: string[], hint?: V4Kind | null): V4Item | null {
  const kind = v4KindOf(o.id) ?? hint ?? null;
  if (!kind) return null;
  const r = V4Object.safeParse(o);
  if (!r.success) {
    issues.push(...issuesOf(r.error, path));
    return null;
  }
  return { kind, value: r.data, path };
}

function parse(input: unknown, format: string): ParseResult {
  const issues: string[] = [];
  switch (format) {
    case "flutterwave.v3.response": {
      const r = V3Envelope.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const items: V3Item[] = [];
      const data = r.data.data;
      if (isObj(data)) {
        const it = v3Item(data, "data", issues);
        if (it) items.push(it);
      } else if (Array.isArray(data)) {
        data.slice(0, 1000).forEach((d, i) => {
          if (!isObj(d)) return;
          const it = v3Item(d, `data[${i}]`, issues);
          if (it) items.push(it);
        });
      }
      if (issues.length) return { ok: false, issues };
      const meta = r.data.meta;
      const mode =
        isObj(meta) && isObj(meta.authorization) ? str(meta.authorization.mode) : undefined;
      return {
        ok: true,
        value: {
          kind: "v3_response",
          envelope: r.data,
          items,
          ...(mode && lookup(V3_AUTH_MODES, mode) ? { authMode: mode } : {}),
        },
      };
    }
    case "flutterwave.v3.object": {
      if (!isObj(input)) return { ok: false, issues: ["(root): expected an object"] };
      const it = v3Item(input, "", issues);
      if (!it) return { ok: false, issues: issues.length ? issues : ["(root): not a v3 object"] };
      return { ok: true, value: { kind: "v3_object", items: [it] } };
    }
    case "flutterwave.v3.webhook": {
      const r = V3Webhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const entry = lookup(V3_EVENTS, r.data.event);
      const kind = v3KindOf(r.data.data) ?? entry?.object ?? null;
      let item: V3Item | null = null;
      if (kind) {
        const p = V3_SCHEMAS[kind].safeParse(r.data.data);
        if (!p.success) return { ok: false, issues: issuesOf(p.error, "data") };
        item = { kind, value: p.data, path: "data" };
      }
      return { ok: true, value: { kind: "v3_webhook", value: r.data, item } };
    }
    case "flutterwave.v3.refund_webhook": {
      const r = V3RefundWebhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return { ok: true, value: { kind: "v3_refund_webhook", value: r.data } };
    }
    case "flutterwave.v3.server_error": {
      const r = V3ServerError.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return { ok: true, value: { kind: "v3_server_error", value: r.data } };
    }
    case "flutterwave.v4.error": {
      const r = V4Error.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      return { ok: true, value: { kind: "v4_error", value: r.data } };
    }
    case "flutterwave.v4.response": {
      const r = V4Envelope.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const items: V4Item[] = [];
      const data = r.data.data;
      const list = Array.isArray(data) ? data : [data];
      list.forEach((d, i) => {
        if (!isObj(d)) return;
        const it = v4Item(d, Array.isArray(data) ? `data[${i}]` : "data", issues);
        if (it) items.push(it);
      });
      if (issues.length) return { ok: false, issues };
      return { ok: true, value: { kind: "v4_response", envelope: r.data, items } };
    }
    case "flutterwave.v4.webhook": {
      const r = V4Webhook.safeParse(input);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      const hint = lookup(V4_WEBHOOK_TYPES, r.data.type)?.object ?? null;
      const item = v4Item(r.data.data, "data", issues, hint);
      if (issues.length) return { ok: false, issues };
      return { ok: true, value: { kind: "v4_webhook", value: r.data, item } };
    }
    default:
      return { ok: false, issues: [`Unsupported Flutterwave format "${format}".`] };
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

type Common = {
  ctx: NormalizeContext;
  path: string;
  eventType: string;
  eventTypeKnown?: boolean;
  eventReference?: string;
  deliveryKey?: string;
  eventTimestamp?: string;
  extra?: [string, unknown][];
};

function base(c: Common) {
  return {
    sourceFormat: c.ctx.format,
    source: { recordIndex: c.ctx.recordIndex, path: c.path },
    ...(c.ctx.observedTimestamp ? { observedTimestamp: c.ctx.observedTimestamp } : {}),
  };
}

type V3TransactionView = {
  stage: LifecycleStage;
  outcome: Outcome;
  known: boolean;
  status: string | undefined;
  isVoid: boolean;
  processorResponse: string | undefined;
};

function viewV3Transaction(o: Obj, authMode?: string): V3TransactionView {
  const status = str(o.status)?.toLowerCase();
  const entry: StatusEntry | undefined = lookup(V3_TRANSACTION_STATUSES, status);
  const pr = str(o.processor_response);
  const isVoid = pr !== undefined && norm(pr) === V3_VOID_TEXT;
  let stage: LifecycleStage = entry?.stage ?? "payment";
  let outcome: Outcome = entry?.outcome ?? "unknown";
  if (isVoid) {
    // A void reports status successful; the void succeeded, not the payment.
    stage = "void";
    outcome = status === "successful" ? "success" : status === "failed" ? "failure" : "unknown";
  } else if (entry && o.charge_type === "preauth") {
    if (status === "pending") stage = "authorization";
    else if (status === "successful") stage = "capture";
  }
  if (!isVoid && outcome === "pending" && stage === "payment") {
    if (
      isAuthPrompt(pr) ||
      (authMode && lookup(V3_AUTH_MODES, authMode)?.stage === "authentication")
    )
      stage = "authentication";
  }
  return { stage, outcome, known: Boolean(entry), status, isVoid, processorResponse: pr };
}

function v3TransactionDraft(o: Obj, c: Common, authMode?: string): NormalizedEventDraft {
  const v = viewV3Transaction(o, authMode);
  const currency = upperCurrency(o.currency);
  const shownPr = knownProcessorText(v.processorResponse);
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? v.known,
    stage: v.stage,
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: idOf(o.id),
    relatedReference: safeId(o.flw_ref, 256),
    merchantReference: merchantRef(o.tx_ref),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_at),
    amountMinor: amountOf(o.amount, currency),
    currency,
    outcome: v.outcome,
    attributes: attrs([
      ["objectType", "transaction"],
      ["apiVersion", "v3"],
      ["operation", v.isVoid ? "void" : undefined],
      [
        "paymentType",
        typeof o.payment_type === "string" && V3_PAYMENT_TYPES.has(o.payment_type)
          ? o.payment_type
          : word(o.payment_type),
      ],
      [
        "authModel",
        typeof o.auth_model === "string" && V3_AUTH_MODELS.has(o.auth_model)
          ? o.auth_model
          : word(o.auth_model),
      ],
      ["chargeType", word(o.charge_type)],
      ["fraudStatus", word(o.fraud_status)],
      ["processorResponse", shownPr],
      ["processorResponseDocumented", v.processorResponse ? shownPr !== undefined : undefined],
      ["chargedAmountMinor", amountOf(o.charged_amount, currency)],
      ["appFeeMinor", amountOf(o.app_fee, currency)],
      ["merchantFeeMinor", amountOf(o.merchant_fee, currency)],
      ["amountSettledMinor", amountOf(o.amount_settled, currency)],
      ["authorizationMode", authMode],
      ["createdAt", toIsoTimestamp(o.created_at)],
      ...(c.extra ?? []),
    ]),
  });
}

function transferIsInflow(o: Obj): boolean {
  const narration = str(o.narration);
  return (
    (narration !== undefined && norm(narration) === "wallet funding") ||
    str(o.debit_currency)?.toUpperCase() === "PSA"
  );
}

function knownCompleteMessage(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  if (text === "") return "";
  const t = norm(text);
  if (V3_TRANSFER_PROGRESS_TEXTS.has(t)) return freeText(text, 120);
  const e = matchText(text, [V3_TRANSFER_FAILURES]);
  if (e) return freeText(text, 120);
  return undefined;
}

function v3TransferDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toUpperCase();
  const entry = lookup(V3_TRANSFER_STATUSES, status);
  const inflow = transferIsInflow(o);
  const currency = upperCurrency(o.currency);
  const reference = merchantRef(o.reference);
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? Boolean(entry),
    stage: inflow ? "other" : (entry?.stage ?? "payout"),
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: idOf(o.id),
    merchantReference: reference,
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_at),
    amountMinor: amountOf(o.amount, currency),
    currency,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "transfer"],
      ["apiVersion", "v3"],
      ["direction", inflow ? "inflow" : "payout"],
      ["completeMessage", knownCompleteMessage(str(o.complete_message))],
      ["debitCurrency", upperCurrency(o.debit_currency)],
      ["requiresApproval", flag(o.requires_approval)],
      ["isApproved", flag(o.is_approved)],
      ["isRetry", reference ? RETRY_SUFFIX.test(reference) : undefined],
      ["createdAt", toIsoTimestamp(o.created_at)],
      ...(c.extra ?? []),
    ]),
  });
}

function v3RefundDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toLowerCase();
  const entry = lookup(V3_REFUND_STATUSES, status);
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? Boolean(entry),
    stage: "refund",
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    paymentReference: idOf(o.tx_id ?? o.transaction_id),
    relatedReference: idOf(o.id),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_at),
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "refund"],
      ["apiVersion", "v3"],
      // The refund object has no currency, so the amount is shown as supplied.
      ["amountRefunded", typeof o.amount_refunded === "number" ? o.amount_refunded : undefined],
      ["destination", word(o.destination)],
      ["statusMeaning", entry?.meaning],
      ["createdAt", toIsoTimestamp(o.created_at)],
      ...(c.extra ?? []),
    ]),
  });
}

const HISTORY_ACTIONS = new Set(["initiated", "notification", "accept", "decline"]);

function chargebackAttrs(o: Obj, version: "v3" | "v4"): [string, unknown][] {
  const status = str(o.status)?.toLowerCase();
  const stage = str(o.stage)?.toLowerCase();
  const history =
    isObj(o.meta) && Array.isArray(o.meta.history)
      ? o.meta.history
          .map((h) => (isObj(h) ? str(h.action) : undefined))
          .filter((a): a is string => a !== undefined && HISTORY_ACTIONS.has(a))
      : undefined;
  return [
    ["objectType", "chargeback"],
    ["apiVersion", version],
    ["chargebackStatusMeaning", lookup(CHARGEBACK_STATUSES, status)],
    ["chargebackStage", stage && lookup(CHARGEBACK_STAGES, stage) ? stage : undefined],
    ["chargebackType", o.type === "local" || o.type === "international" ? o.type : undefined],
    ["dueDate", toIsoTimestamp(o.due_date ?? o.due_datetime)],
    ["historyActions", history?.length ? history : undefined],
  ];
}

function v3ChargebackDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toLowerCase();
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? lookup(CHARGEBACK_STATUSES, status) !== undefined,
    stage: "dispute",
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: idOf(o.transaction_id),
    relatedReference: safeId(o.flw_ref, 256),
    merchantReference: merchantRef(o.tx_ref),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_at),
    outcome: "unknown",
    attributes: attrs([
      ...chargebackAttrs(o, "v3"),
      ["chargebackId", idOf(o.id)],
      ["createdAt", toIsoTimestamp(o.created_at)],
      ...(c.extra ?? []),
    ]),
  });
}

function v3ItemDraft(item: V3Item, c: Common, authMode?: string): NormalizedEventDraft {
  switch (item.kind) {
    case "transaction":
      return v3TransactionDraft(item.value, c, authMode);
    case "transfer":
      return v3TransferDraft(item.value, c);
    case "refund":
      return v3RefundDraft(item.value, c);
    case "chargeback":
      return v3ChargebackDraft(item.value, c);
  }
}

/** Refund webhook `meta` is a JSON string; only two documented keys are read. */
function refundWebhookMeta(meta: unknown): [string, unknown][] {
  let m: unknown = meta;
  if (typeof meta === "string" && meta.length <= 4000) {
    try {
      m = JSON.parse(meta);
    } catch {
      return [["metaReadable", false]];
    }
  }
  if (!isObj(m)) return [];
  const partial =
    typeof m.isPartialRefund === "boolean"
      ? m.isPartialRefund
      : m.isPartialRefund === "true" || m.isPartialRefund === "false"
        ? m.isPartialRefund === "true"
        : undefined;
  return [
    ["disburseStatus", word(m.disburse_status)],
    ["isPartialRefund", partial],
  ];
}

function v4ChargeDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toLowerCase();
  const entry = lookup(V4_CHARGE_STATUSES, status);
  const next = isObj(o.next_action) ? str(o.next_action.type) : undefined;
  const nextEntry = lookup(V4_NEXT_ACTIONS, next);
  let stage: LifecycleStage = entry?.stage ?? "payment";
  if (status === "pending" && nextEntry) stage = nextEntry.stage;
  const pr = isObj(o.processor_response) ? o.processor_response : undefined;
  const prType = word(pr?.type);
  const prCode = typeof pr?.code === "string" && /^\d{2}$/.test(pr.code) ? pr.code : undefined;
  const pm = isObj(o.payment_method_details)
    ? o.payment_method_details
    : isObj(o.payment_method)
      ? o.payment_method
      : undefined;
  const currency = upperCurrency(o.currency);
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? Boolean(entry),
    stage,
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: safeId(o.id),
    merchantReference: merchantRef(o.reference),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_datetime),
    amountMinor: amountOf(o.amount, currency),
    currency,
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "charge"],
      ["apiVersion", "v4"],
      ["nextAction", nextEntry ? next : undefined],
      ["processorResponseType", prType],
      ["processorResponseCode", prCode],
      ["paymentMethodType", word(pm?.type)],
      ["disputed", typeof o.disputed === "boolean" ? o.disputed : undefined],
      ["settled", typeof o.settled === "boolean" ? o.settled : undefined],
      ["refunded", typeof o.refunded === "boolean" ? o.refunded : undefined],
      ["createdAt", toIsoTimestamp(o.created_datetime)],
      ...(c.extra ?? []),
    ]),
  });
}

const V4_TRANSFER_TYPES = new Set(["bank", "mobile_money", "wallet", "cash_pickup", "crypto"]);
const V4_TRANSFER_ACTIONS = new Set(["instant", "deferred", "scheduled", "retry", "duplicate"]);

function v4TransferDraft(o: Obj, c: Common, reversalEvent: boolean): NormalizedEventDraft {
  const status = str(o.status)?.toUpperCase();
  const entry = lookup(V4_TRANSFER_STATUSES, status);
  const rev = isObj(o.reversal) ? o.reversal : undefined;
  const reconciliation = str(rev?.reconciliation_status)?.toUpperCase();
  const isReversal = reversalEvent || reconciliation !== undefined;
  const src = upperCurrency(o.source_currency);
  const dst = upperCurrency(o.destination_currency);
  // The amount applies to one side; it is only unambiguous for same-currency transfers.
  const currency = src && src === dst ? src : undefined;
  const pr = isObj(o.provider_response) ? o.provider_response : undefined;
  const type = str(o.type)?.toLowerCase();
  const action = str(o.action)?.toLowerCase();
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? Boolean(entry),
    stage: isReversal ? "reversal" : (entry?.stage ?? "payout"),
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: safeId(o.id),
    merchantReference: merchantRef(o.reference),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_datetime),
    amountMinor:
      currency && typeof o.amount === "number" ? amountOf(o.amount, currency) : undefined,
    currency,
    outcome: isReversal
      ? reconciliation === "REVERSED"
        ? "success"
        : "unknown"
      : (entry?.outcome ?? "unknown"),
    attributes: attrs([
      ["objectType", "transfer"],
      ["apiVersion", "v4"],
      ["transferType", type && V4_TRANSFER_TYPES.has(type) ? type : undefined],
      ["transferAction", action && V4_TRANSFER_ACTIONS.has(action) ? action : undefined],
      ["sourceCurrency", src],
      ["destinationCurrency", dst],
      ["providerResponseType", word(pr?.type)],
      [
        "providerResponseCode",
        typeof pr?.code === "string" && /^\d{4}$/.test(pr.code) ? pr.code : undefined,
      ],
      ["reversalInitialStatus", word(rev?.initial_status)],
      ["reversalReconciliationStatus", word(rev?.reconciliation_status)],
      [
        "reversalReconciliationType",
        rev?.reconciliation_type === "D" || rev?.reconciliation_type === "C"
          ? rev.reconciliation_type
          : undefined,
      ],
      ["createdAt", toIsoTimestamp(o.created_datetime)],
      ...(c.extra ?? []),
    ]),
  });
}

const V4_REFUND_REASONS = new Set([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "expired_uncaptured_charge",
]);

function v4RefundDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toLowerCase();
  const entry = lookup(V4_REFUND_STATUSES, status);
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? Boolean(entry),
    stage: "refund",
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: safeId(o.charge_id),
    relatedReference: safeId(o.id),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_datetime),
    outcome: entry?.outcome ?? "unknown",
    attributes: attrs([
      ["objectType", "refund"],
      ["apiVersion", "v4"],
      ["amountRefunded", typeof o.amount_refunded === "number" ? o.amount_refunded : undefined],
      [
        "refundReason",
        typeof o.reason === "string" && V4_REFUND_REASONS.has(o.reason) ? o.reason : undefined,
      ],
      ["createdAt", toIsoTimestamp(o.created_datetime)],
      ...(c.extra ?? []),
    ]),
  });
}

function v4ChargebackDraft(o: Obj, c: Common): NormalizedEventDraft {
  const status = str(o.status)?.toLowerCase();
  return clean({
    ...base(c),
    eventType: c.eventType,
    eventTypeKnown: c.eventTypeKnown ?? lookup(CHARGEBACK_STATUSES, status) !== undefined,
    stage: "dispute",
    providerStatus: word(o.status),
    eventReference: c.eventReference,
    deliveryKey: c.deliveryKey,
    paymentReference: safeId(o.charge_id),
    relatedReference: safeId(o.id),
    eventTimestamp: c.eventTimestamp ?? toIsoTimestamp(o.created_datetime),
    outcome: "unknown",
    attributes: attrs([
      ...chargebackAttrs(o, "v4"),
      ["createdAt", toIsoTimestamp(o.created_datetime)],
      ...(c.extra ?? []),
    ]),
  });
}

function v4ItemDraft(item: V4Item, c: Common, reversalEvent = false): NormalizedEventDraft {
  switch (item.kind) {
    case "charge":
      return v4ChargeDraft(item.value, c);
    case "transfer":
      return v4TransferDraft(item.value, c, reversalEvent);
    case "refund":
      return v4RefundDraft(item.value, c);
    case "chargeback":
      return v4ChargebackDraft(item.value, c);
  }
}

function v3EnvelopeErrorOutcome(message: string | undefined): Outcome {
  const entry = matchText(message, ENVELOPE_MESSAGE_LISTS);
  return entry?.definitive ? "failure" : "unknown";
}

function normalize(parsed: FlutterwaveParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const httpStatus = ctx.meta?.http?.status;
  const http: [string, unknown][] = [["httpStatus", httpStatus]];

  switch (parsed.kind) {
    case "v3_response": {
      const env = parsed.envelope;
      const extra: [string, unknown][] = [
        ["envelopeStatus", env.status],
        ["envelopeMessage", env.status === "success" ? freeText(env.message, 120) : undefined],
        ...http,
      ];
      if (parsed.items.length) {
        return parsed.items.map((it) =>
          v3ItemDraft(
            it,
            { ctx, path: it.path, eventType: `${it.kind}.snapshot`, extra },
            parsed.authMode,
          ),
        );
      }
      if (env.status === "success" && parsed.authMode) {
        const mode = lookup(V3_AUTH_MODES, parsed.authMode)!;
        return [
          clean({
            ...base({ ctx, path: "meta.authorization", eventType: "" }),
            eventType: `authorization.${parsed.authMode}`,
            eventTypeKnown: true,
            stage: mode.stage,
            providerStatus: parsed.authMode,
            outcome: "pending",
            attributes: attrs([
              ["apiVersion", "v3"],
              ["authorizationMode", parsed.authMode],
              ["authorizationMeaning", mode.meaning],
              ...extra,
            ]),
          }),
        ];
      }
      return [
        clean({
          ...base({ ctx, path: "", eventType: "" }),
          eventType: "api_error",
          eventTypeKnown: true,
          stage: "error",
          providerStatus: httpStatus ? `HTTP ${httpStatus}` : env.status,
          outcome: env.status === "error" ? v3EnvelopeErrorOutcome(env.message) : "unknown",
          attributes: attrs([["apiVersion", "v3"], ...extra]),
        }),
      ];
    }

    case "v3_object":
      return parsed.items.map((it) =>
        v3ItemDraft(it, { ctx, path: it.path, eventType: `${it.kind}.snapshot`, extra: http }),
      );

    case "v3_webhook": {
      const w = parsed.value;
      const entry = lookup(V3_EVENTS, w.event);
      const eventType = safeText(w.event, 128) ?? "unknown";
      const dotType = str((w as Obj)["event.type"]);
      const extra: [string, unknown][] = [
        ["eventCategory", dotType && V3_EVENT_TYPE_VALUES.has(dotType) ? dotType : word(dotType)],
      ];
      const d = w.data;
      const id = idOf(d.id);
      const status = word(d.status);
      // Flutterwave's suggested duplicate key: event + data.id + data.status.
      const deliveryKey = id && status ? `${eventType}:${id}:${status}` : undefined;
      if (parsed.item) {
        const c: Common = {
          ctx,
          path: "data",
          eventType,
          eventTypeKnown: Boolean(entry),
          ...(deliveryKey ? { deliveryKey } : {}),
          extra,
        };
        // A known event with an unknown status stays known, with an unknown outcome.
        return [v3ItemDraft(parsed.item, c)];
      }
      return [
        clean({
          ...base({ ctx, path: "", eventType }),
          eventType,
          eventTypeKnown: false,
          stage: "other",
          providerStatus: status,
          deliveryKey,
          outcome: "unknown",
          attributes: attrs([["apiVersion", "v3"], ...extra]),
        }),
      ];
    }

    case "v3_refund_webhook": {
      const w = parsed.value as Obj;
      const status = str(w.status)?.toLowerCase();
      const entry = lookup(V3_REFUND_STATUSES, status);
      return [
        clean({
          ...base({ ctx, path: "", eventType: "" }),
          eventType: "refund.webhook",
          eventTypeKnown: Boolean(entry),
          stage: "refund",
          providerStatus: word(w.status),
          paymentReference: idOf(w.TransactionId),
          relatedReference: idOf(w.id),
          eventTimestamp: toIsoTimestamp(w.createdAt),
          outcome: entry?.outcome ?? "unknown",
          attributes: attrs([
            ["objectType", "refund"],
            ["apiVersion", "v3"],
            ["amountRefunded", typeof w.AmountRefunded === "number" ? w.AmountRefunded : undefined],
            ["destination", word(w.destination)],
            ["statusMeaning", entry?.meaning],
            ["updatedAt", toIsoTimestamp(w.updatedAt)],
            ...refundWebhookMeta(w.meta),
            ...http,
          ]),
        }),
      ];
    }

    case "v3_server_error": {
      const e = parsed.value;
      return [
        clean({
          ...base({ ctx, path: "", eventType: "" }),
          eventType: "api_error.app_error",
          eventTypeKnown: true,
          stage: "error",
          providerStatus: httpStatus ? `HTTP ${httpStatus}` : "app_error",
          eventReference: safeId(e.error_id),
          outcome: "unknown",
          attributes: attrs([["apiVersion", "v3"], ["errorCode", "app_error"], ...http]),
        }),
      ];
    }

    case "v4_error": {
      const e = parsed.value.error;
      const type = normalizeV4Type(e.type);
      const entry = e.code ? V4_ERRORS_BY_PAIR.get(`${e.code}|${type}`) : undefined;
      const fields = (e.validation_errors ?? [])
        .map((v) => v.field_name)
        .filter((f): f is string => typeof f === "string" && /^[A-Za-z0-9_.[\]]{1,64}$/.test(f));
      return [
        clean({
          ...base({ ctx, path: "", eventType: "" }),
          eventType: `api_error.${safeText(type, 64) ?? "unknown"}`,
          eventTypeKnown: true,
          stage: "error",
          providerStatus: httpStatus ? `HTTP ${httpStatus}` : "failed",
          outcome: entry && isDecline(entry.category) ? "failure" : "unknown",
          attributes: attrs([
            ["apiVersion", "v4"],
            ["errorType", safeText(type, 64)],
            ["errorCode", e.code && /^\d{1,16}$/.test(e.code) ? e.code : undefined],
            ["validationFields", fields.length ? fields : undefined],
            ...http,
          ]),
        }),
      ];
    }

    case "v4_response": {
      const extra: [string, unknown][] = [
        ["envelopeMessage", freeText(parsed.envelope.message, 120)],
        ...http,
      ];
      return parsed.items.map((it) =>
        v4ItemDraft(it, { ctx, path: it.path, eventType: `${it.kind}.snapshot`, extra }),
      );
    }

    case "v4_webhook": {
      const w = parsed.value;
      const entry = lookup(V4_WEBHOOK_TYPES, w.type);
      const eventType = safeText(w.type, 128) ?? "unknown";
      // The schema names the id webhook_id; the webhooks page example uses id.
      const hookId = safeId(w.webhook_id) ?? safeId(w.id);
      const c: Common = {
        ctx,
        path: "data",
        eventType,
        eventTypeKnown: Boolean(entry?.object),
        ...(hookId ? { eventReference: hookId, deliveryKey: hookId } : {}),
        ...(toIsoTimestamp(w.timestamp) ? { eventTimestamp: toIsoTimestamp(w.timestamp)! } : {}),
        extra: [["webhookIdField", w.webhook_id !== undefined ? "webhook_id" : "id"]],
      };
      if (parsed.item && entry?.object !== null)
        return [v4ItemDraft(parsed.item, c, w.type === "transfer.reversal")];
      return [
        clean({
          ...base(c),
          eventType,
          eventTypeKnown: false,
          stage: w.type === "order.authorization" ? "authorization" : "other",
          providerStatus: word(w.data.status),
          eventReference: c.eventReference,
          deliveryKey: c.deliveryKey,
          eventTimestamp: c.eventTimestamp,
          outcome: "unknown",
          attributes: attrs([["apiVersion", "v4"], ...(c.extra ?? [])]),
        }),
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// Error decoding
// ---------------------------------------------------------------------------

const DECLINE_CATEGORIES = new Set<ErrorCategory>([
  "card_declined",
  "authentication_failed",
  "insufficient_funds",
  "fraud_or_risk",
]);
const isDecline = (c: ErrorCategory) => DECLINE_CATEGORIES.has(c);

type Loc = {
  sourceFormat: string;
  source: { recordIndex: number; path: string };
  paymentReference?: string;
  attemptReference?: string;
};

const withLoc = (loc: Loc) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
  ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
});

const CARD_RETRY_NOTE =
  "Flutterwave advises against automatic retries for failed card charges, and blocks some immediate retries with velocity limits.";

function fromTextEntry(
  e: TextEntry,
  text: string,
  field: string,
  loc: Loc,
  outcomeKnown: boolean,
  extraSub: Record<string, string> = {},
): DecodedErrorDraft {
  const retryParts = [RETRY_TEXT[e.retry]];
  if (e.docs === V3_CARD_URL) retryParts.push(CARD_RETRY_NOTE);
  if (e.category === "network_or_timeout")
    retryParts.push(
      "Flutterwave says to query the status first; if it is pending, wait for the webhook, and retry only when no transaction is found.",
    );
  const message = freeText(text);
  const docs: DocumentationLink[] = [{ title: "Flutterwave documentation", url: e.docs }];
  if (e.category === "network_or_timeout" && e.docs !== V3_TIMEOUTS_URL)
    docs.push({ title: "Flutterwave error timeouts", url: V3_TIMEOUTS_URL });
  const missing: string[] = [];
  if (e.confidence === "possible")
    missing.push(
      "Flutterwave names this card error on its velocity limit page but does not show the exact response text, so the match is by name only.",
    );
  if (!loc.paymentReference && field !== "message")
    missing.push(
      "No transaction id; the later state of this operation cannot be checked from this record.",
    );
  return {
    ...withLoc(loc),
    code: e.match === "prefix" && e.prefix ? e.prefix : e.text,
    subCodes: { field, ...extraSub },
    category: e.category,
    ...(message ? { providerMessage: message } : {}),
    explanation: `${e.meaning}.`,
    nextAction: NEXT_ACTION[e.category],
    retry: e.retry,
    retryExplanation: retryParts.join(" "),
    confidence: e.confidence,
    documentation: docs,
    missingInformation: missing,
    ...(outcomeKnown || e.definitive ? { outcomeKnown: true } : {}),
  };
}

function unknownText(
  code: string,
  text: string | undefined,
  field: string,
  loc: Loc,
  outcomeKnown: boolean,
  docsUrl: string,
  fallback?: {
    meaning: string;
    category: ErrorCategory;
    retry: RetryGuidance;
    docs: string;
    http: number;
  },
): DecodedErrorDraft {
  const message = freeText(text);
  const missing = [
    text
      ? "This text is not among the messages Flutterwave documents. v3 publishes no readable error code table, so the reason cannot be classified."
      : `No ${field} text was supplied, so the reason is unknown.`,
  ];
  const subCodes: Record<string, string> = { field };
  if (fallback) subCodes.http_status = String(fallback.http);
  const category = fallback?.category ?? "unknown";
  const retry = fallback?.retry ?? "unknown";
  const retryParts = [RETRY_TEXT[retry]];
  if (category === "network_or_timeout")
    retryParts.push(
      "Flutterwave says to query the status first; if it is pending, wait for the webhook, and retry only when no transaction is found.",
    );
  return {
    ...withLoc(loc),
    code,
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation: fallback
      ? `${fallback.meaning}. The message itself is not documented.`
      : outcomeKnown
        ? "Flutterwave reports a failure, but the reason text is not documented."
        : "PandaPayLens does not recognize this Flutterwave error.",
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence: fallback ? "possible" : "insufficient",
    documentation: [{ title: "Flutterwave documentation", url: fallback?.docs ?? docsUrl }],
    missingInformation: missing,
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

function decodeV3Transaction(o: Obj, loc: Loc, envelopeMessage?: string): DecodedErrorDraft | null {
  const v = viewV3Transaction(o);
  if (v.isVoid || v.outcome !== "failure") return null;
  const pr = v.processorResponse;
  const e = matchText(pr, PROCESSOR_FAILURE_LISTS);
  if (e && pr) return fromTextEntry(e, pr, "processor_response", loc, true);
  const env = matchText(envelopeMessage, ENVELOPE_MESSAGE_LISTS);
  if (env && envelopeMessage) return fromTextEntry(env, envelopeMessage, "message", loc, true);
  return unknownText(v.status ?? "failed", pr, "processor_response", loc, true, V3_CARD_URL);
}

function decodeV3Transfer(o: Obj, loc: Loc, envelopeMessage?: string): DecodedErrorDraft | null {
  const status = str(o.status)?.toUpperCase();
  if (status !== "FAILED") return null;
  const text = str(o.complete_message);
  const sub: Record<string, string> = {};
  if (envelopeMessage) {
    const env = matchText(envelopeMessage, [V3_ERROR_MESSAGES]);
    if (env) sub.envelope_message = env.text;
  }
  const e = matchText(text, [V3_TRANSFER_FAILURES]);
  if (e && text) return fromTextEntry(e, text, "complete_message", loc, true, sub);
  if (text && norm(text).startsWith(DISBURSE_FAILED_PREFIX.toLowerCase())) {
    const message = freeText(text);
    return {
      ...withLoc(loc),
      code: DISBURSE_FAILED_PREFIX,
      subCodes: { field: "complete_message", ...sub },
      category: "unknown",
      ...(message ? { providerMessage: message } : {}),
      explanation:
        "The disbursement failed. Flutterwave uses the DISBURSE FAILED prefix for failed disbursements; this reason text is not among the documented ones.",
      nextAction: NEXT_ACTION.unknown,
      retry: "manual_review",
      retryExplanation: `${RETRY_TEXT.manual_review} Flutterwave's transfer guide says to re-initiate only when the transfer is confirmed failed; a failed transfer can be retried with POST /transfers/{id}/retries.`,
      confidence: "possible",
      documentation: [{ title: "Flutterwave transfers", url: V3_TRANSFERS_URL }],
      missingInformation: ["The reason after the prefix is not documented."],
      outcomeKnown: true,
    };
  }
  return unknownText("FAILED", text, "complete_message", loc, true, V3_TRANSFERS_URL);
}

function decodeV3Envelope(
  message: string | undefined,
  loc: Loc,
  httpStatus?: number,
): DecodedErrorDraft {
  const e = matchText(message, ENVELOPE_MESSAGE_LISTS);
  if (e && message) {
    const sub: Record<string, string> = {};
    if (httpStatus !== undefined) sub.http_status = String(httpStatus);
    return fromTextEntry(e, message, "message", loc, false, sub);
  }
  const fb = httpStatus !== undefined ? lookup(V3_HTTP_FALLBACK, httpStatus) : undefined;
  return unknownText(
    "error",
    message,
    "message",
    loc,
    false,
    V3_WEBHOOKS_URL,
    fb && httpStatus !== undefined ? { ...fb, http: httpStatus } : undefined,
  );
}

function decodeV3Item(item: V3Item, loc: Loc, envelopeMessage?: string): DecodedErrorDraft | null {
  if (item.kind === "transaction") return decodeV3Transaction(item.value, loc, envelopeMessage);
  if (item.kind === "transfer") return decodeV3Transfer(item.value, loc, envelopeMessage);
  return null;
}

function v3Loc(item: V3Item, ctx: NormalizeContext): Loc {
  const o = item.value;
  const source = { recordIndex: ctx.recordIndex, path: item.path };
  if (item.kind === "transfer") {
    // Retries carry <reference>_RETRY_<n>; the original reference links them,
    // so repeated failing retries of one payout are recognized.
    const ref = merchantRef(o.reference);
    const baseRef = ref?.replace(RETRY_SUFFIX, "");
    return {
      sourceFormat: ctx.format,
      source,
      ...(baseRef ? { paymentReference: baseRef } : {}),
      ...(idOf(o.id) ? { attemptReference: idOf(o.id)! } : {}),
    };
  }
  const id = idOf(o.id);
  return {
    sourceFormat: ctx.format,
    source,
    ...(id ? { paymentReference: id, attemptReference: id } : {}),
  };
}

export function decodeV4Error(
  type: string,
  code: string | undefined,
  httpStatus: number | undefined,
  loc: Loc,
  message?: string,
): DecodedErrorDraft {
  const t = normalizeV4Type(type);
  const pair = code ? V4_ERRORS_BY_PAIR.get(`${code}|${t}`) : undefined;
  const byCode = code ? (V4_ERRORS_BY_CODE.get(code) ?? []) : [];
  const byType = [...V4_ERRORS_BY_PAIR.values()].filter((e) => e.type === t);
  const subCodes: Record<string, string> = { error_type: safeText(t, 64) ?? "" };
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const missing: string[] = [];
  let entry = pair;
  let confidence: Confidence = "strong";
  if (!entry) {
    if (byCode.length === 1) {
      entry = byCode[0];
      confidence = "possible";
      missing.push(
        `Error type "${safeText(t, 64)}" does not match the documented type for code ${code} (${entry!.type}).`,
      );
    } else if (!code && byType.length === 1) {
      entry = byType[0];
      confidence = "possible";
      missing.push("No error.code was supplied; the type alone was used.");
    } else {
      confidence = "insufficient";
      if (byCode.length > 1)
        missing.push(
          `Code ${code} has several documented meanings (${byCode.map((e) => e.type).join(", ")}); the type does not match any of them.`,
        );
      else
        missing.push(
          `The pair ${code ?? "(no code)"} / ${safeText(t, 64)} is not in the documented v4 tables.`,
        );
    }
  }
  const category = entry?.category ?? "unknown";
  const retry = entry?.retry ?? "unknown";
  const retryParts = [RETRY_TEXT[retry]];
  if (entry?.table === "payouts" && retry === "retry_conditionally")
    retryParts.push(
      "For payouts, query the transfer by reference first; Flutterwave's transfer guide says to re-initiate only when no record exists.",
    );
  const text = freeText(message);
  return {
    ...withLoc(loc),
    code: code ?? safeText(t, 64) ?? "unknown",
    subCodes,
    category,
    ...(text ? { providerMessage: text } : {}),
    explanation: entry
      ? `${entry.type}: ${entry.meaning} (v4 ${entry.table} error table).`
      : "PandaPayLens does not recognize this Flutterwave v4 error.",
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence,
    documentation: [{ title: "Flutterwave v4 error codes", url: V4_ERRORS_URL }],
    missingInformation: missing,
  };
}

function decodeV4Charge(o: Obj, loc: Loc): DecodedErrorDraft | null {
  const status = str(o.status)?.toLowerCase();
  const next = isObj(o.next_action) ? str(o.next_action.type) : undefined;
  if (status === "pending" && next === "requires_requery") {
    return {
      ...withLoc(loc),
      code: "requires_requery",
      subCodes: { next_action: "requires_requery" },
      category: "network_or_timeout",
      explanation:
        "The charge request reached Flutterwave's 25 to 28 second limit and is still pending. Flutterwave says charges that stay unresolved for a minute move to failed.",
      nextAction:
        "Do not send a new charge. Retrieve this charge after 20 seconds and again after 40 seconds, as Flutterwave advises.",
      retry: "retry_conditionally",
      retryExplanation:
        "Flutterwave says not to retry a requires_requery charge: retrieve it instead. Only after the charge is confirmed failed may a new charge be considered.",
      confidence: "strong",
      documentation: [{ title: "Flutterwave v4 errors and timeouts", url: V4_ERRORS_URL }],
      missingInformation: [],
    };
  }
  if (status !== "failed") return null;
  const pr = isObj(o.processor_response) ? o.processor_response : undefined;
  const type = str(pr?.type);
  const code = str(pr?.code);
  const byType = type ? V4_PROCESSOR_BY_TYPE.get(type) : undefined;
  const missing: string[] = [];
  let entry = byType && byType.type !== "approved" ? byType : undefined;
  let confidence: Confidence = entry ? "strong" : "insufficient";
  if (entry && code && code !== entry.code)
    missing.push(
      `processor_response.code ${safeText(code, 8)} differs from the documented code ${entry.code} for this type.`,
    );
  if (!entry && !type && code) {
    // A code alone is not trusted for certain (the timeout example reuses 02).
    const c = V4_PROCESSOR_RESPONSES.find((e) => e.code === code && e.type !== "approved");
    if (c) {
      entry = c;
      confidence = "possible";
      missing.push("No processor_response.type was supplied; the code alone was used.");
    }
  }
  if (!entry)
    missing.push(
      pr
        ? "The processor_response type is not in the documented v4 list."
        : "No processor_response was supplied, so the reason is unknown.",
    );
  const category = entry?.category ?? "unknown";
  const retry = entry?.retry ?? "unknown";
  const text = freeText(pr?.message);
  const sub: Record<string, string> = {};
  if (type) sub.processor_response_type = safeText(type, 64) ?? "";
  if (code && /^\d{1,4}$/.test(code)) sub.processor_response_code = code;
  return {
    ...withLoc(loc),
    code: entry ? entry.type : (safeText(type, 64) ?? "failed"),
    subCodes: sub,
    category,
    ...(text ? { providerMessage: text } : {}),
    explanation: entry
      ? `Issuer response ${entry.code} (${entry.type}): ${entry.meaning}.`
      : "The charge failed with a processor response PandaPayLens does not recognize.",
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: `${RETRY_TEXT[retry]} ${CARD_RETRY_NOTE}`,
    confidence,
    documentation: [
      { title: "Flutterwave v4 charge schema", url: V4_CHARGE_URL },
      { title: "Flutterwave v4 issuer responses", url: V4_TESTING_URL },
    ],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeV4Transfer(o: Obj, loc: Loc): DecodedErrorDraft | null {
  if (str(o.status)?.toUpperCase() !== "FAILED") return null;
  const pr = isObj(o.provider_response) ? o.provider_response : undefined;
  const type = str(pr?.type)?.toLowerCase();
  const code = str(pr?.code);
  const entry = type
    ? V4_PAYOUT_ERRORS.slice(0, 14).find((e) => e.type.toLowerCase() === type)
    : undefined;
  const missing: string[] = [];
  if (!entry)
    missing.push(
      type === "invalid_wallet_currency"
        ? "invalid_wallet_currency is listed in the transfer schema without a code or meaning."
        : type && V4_PROVIDER_RESPONSE_TYPES.includes(type)
          ? "This provider_response type has no documented meaning."
          : pr
            ? "The provider_response type is not in the documented v4 list."
            : "No provider_response was supplied, so the reason is unknown.",
    );
  if (entry && code && code !== entry.code)
    missing.push(
      `provider_response.code ${safeText(code, 8)} differs from the documented code ${entry.code}.`,
    );
  const category = entry?.category ?? "unknown";
  const retry = entry?.retry ?? "unknown";
  const retryParts = [RETRY_TEXT[retry]];
  if (retry === "retry_conditionally")
    retryParts.push(
      "Query the transfer by reference first; re-initiate only when it is confirmed failed.",
    );
  const text = freeText(pr?.message);
  const sub: Record<string, string> = {};
  if (type) sub.provider_response_type = safeText(type, 64) ?? "";
  if (code && /^\d{1,4}$/.test(code)) sub.provider_response_code = code;
  return {
    ...withLoc(loc),
    code: entry ? entry.code : (safeText(type, 64) ?? "FAILED"),
    subCodes: sub,
    category,
    ...(text ? { providerMessage: text } : {}),
    explanation: entry
      ? `${entry.type}: ${entry.meaning}.`
      : "The transfer failed with a provider response PandaPayLens does not recognize.",
    nextAction: NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence: entry ? "strong" : "insufficient",
    documentation: [
      { title: "Flutterwave v4 transfer schema", url: V4_TRANSFER_URL },
      { title: "Flutterwave v4 payout error codes", url: V4_ERRORS_URL },
    ],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function v4Loc(item: V4Item, ctx: NormalizeContext): Loc {
  const o = item.value;
  const id = safeId(o.id);
  const payment = item.kind === "charge" || item.kind === "transfer" ? id : safeId(o.charge_id);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: item.path },
    ...(payment ? { paymentReference: payment } : {}),
    ...(id ? { attemptReference: id } : {}),
  };
}

function decodeV4Item(item: V4Item, ctx: NormalizeContext): DecodedErrorDraft | null {
  if (item.kind === "charge") return decodeV4Charge(item.value, v4Loc(item, ctx));
  if (item.kind === "transfer") return decodeV4Transfer(item.value, v4Loc(item, ctx));
  return null;
}

function decodeErrors(parsed: FlutterwaveParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const httpStatus = ctx.meta?.http?.status;
  const rootLoc: Loc = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
  };
  const out: DecodedErrorDraft[] = [];
  switch (parsed.kind) {
    case "v3_response": {
      const env = parsed.envelope;
      const envMessage = env.status === "error" ? env.message : undefined;
      for (const it of parsed.items) {
        const d = decodeV3Item(it, v3Loc(it, ctx), envMessage);
        if (d) out.push(d);
      }
      if (env.status === "error" && out.length === 0) {
        const it = parsed.items[0];
        const loc = it
          ? { ...v3Loc(it, ctx), source: { ...rootLoc.source, path: "message" } }
          : { ...rootLoc, source: { ...rootLoc.source, path: "message" } };
        out.push(decodeV3Envelope(env.message, loc, httpStatus));
      }
      return out;
    }
    case "v3_object":
      for (const it of parsed.items) {
        const d = decodeV3Item(it, v3Loc(it, ctx));
        if (d) out.push(d);
      }
      return out;
    case "v3_webhook": {
      if (!parsed.item) return [];
      const d = decodeV3Item(parsed.item, v3Loc(parsed.item, ctx));
      return d ? [d] : [];
    }
    case "v3_refund_webhook":
      return [];
    case "v3_server_error": {
      const e = parsed.value;
      const d = decodeV3Envelope(
        e.message,
        { ...rootLoc, source: { ...rootLoc.source, path: "message" } },
        httpStatus ?? 500,
      );
      d.subCodes.code = "app_error";
      return [d];
    }
    case "v4_error": {
      const v = parsed.value;
      return [
        decodeV4Error(
          v.error.type,
          v.error.code,
          httpStatus,
          { ...rootLoc, source: { ...rootLoc.source, path: "error" } },
          v.error.message,
        ),
      ];
    }
    case "v4_response":
      for (const it of parsed.items) {
        const d = decodeV4Item(it, ctx);
        if (d) out.push(d);
      }
      return out;
    case "v4_webhook": {
      if (!parsed.item) return [];
      const d = decodeV4Item(parsed.item, ctx);
      return d ? [d] : [];
    }
  }
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

function correlationKeys(event: NormalizedEvent): string[] {
  const a = event.attributes;
  const p = event.paymentReference;
  const r = event.relatedReference;
  const keys: (string | undefined)[] = [];
  if (a.apiVersion === "v3") {
    switch (a.objectType) {
      case "transaction":
        keys.push(p && `v3:tx:${p}`, r && `v3:flw:${r}`);
        break;
      case "refund":
        keys.push(p && `v3:tx:${p}`, r && `v3:refund:${r}`);
        break;
      case "chargeback":
        keys.push(p && `v3:tx:${p}`, r && `v3:flw:${r}`);
        break;
      case "transfer": {
        // Transfer ids are a separate number space from transaction ids. The
        // transfer reference is unique ("Payout with this ref already
        // exists"), and retries extend it with _RETRY_<n>.
        const m = event.merchantReference?.replace(RETRY_SUFFIX, "");
        keys.push(p && `v3:transfer:${p}`, m && `v3:transfer-ref:${m}`);
        break;
      }
    }
  } else if (a.apiVersion === "v4") {
    // v4 ids carry their type prefix (chg_, trf_, rfd_, chb_).
    keys.push(p && `v4:${p}`, r && `v4:${r}`);
  }
  return keys.filter((k): k is string => Boolean(k));
}

export const flutterwaveAdapter: ProviderAdapter<FlutterwaveParsed> = {
  id: PROVIDER,
  displayName: "Flutterwave",
  version: FLUTTERWAVE_ADAPTER_VERSION,
  manifest: flutterwaveManifest,
  supportedFormats: [
    {
      id: "flutterwave.v3.response",
      description:
        "v3 REST response (status, message, data) with a transaction, transfer, refund or chargeback object, an authorization prompt or an error message",
    },
    {
      id: "flutterwave.v3.object",
      description: "Bare v3 transaction, transfer, refund or chargeback object",
    },
    {
      id: "flutterwave.v3.webhook",
      description:
        "v3 webhook (event, data, event.type): charge.completed, preauth-card, transfer.completed, chargeback events",
    },
    {
      id: "flutterwave.v3.refund_webhook",
      description: "v3 refund webhook (AmountRefunded, FlwRef, TransactionId, meta string)",
    },
    {
      id: "flutterwave.v3.server_error",
      description: "v3 server error (error_id, message, code app_error)",
    },
    {
      id: "flutterwave.v4.error",
      description: "v4 error response (status failed, error.type, error.code)",
    },
    {
      id: "flutterwave.v4.response",
      description: "v4 response with a charge, transfer, refund or chargeback object",
    },
    {
      id: "flutterwave.v4.webhook",
      description: "v4 webhook (webhook_id or id, timestamp, type, data)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default flutterwaveAdapter;
