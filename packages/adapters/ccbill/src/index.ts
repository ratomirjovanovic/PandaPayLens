/**
 * CCBill adapter.
 *
 * Supported input families:
 * - `ccbill.webhook`          Webhook body, URL-encoded or JSON (flat strings). The
 *                             event type travels only in the URL query string.
 * - `ccbill.background_post`  Background Post to the Approval / Denial Post URL (form fields)
 * - `ccbill.rest.charge`      RESTful Transaction API charge response (HTTP 200 also for declines)
 * - `ccbill.rest.error`       RESTful API and 3DS error envelope
 *
 * Recognized but not supported: `ccbill.rest.payment_token` (payment token
 * objects) and `ccbill.unrecognized` (clientAccnum / clientSubacc without the
 * fields of a supported family).
 *
 * Webhook event type: CCBill sends `eventType` in the query string of the
 * webhook URL, never in the body. PandaPayLens keeps the path of a pasted HTTP
 * request without its query string, so the event type is read from the record
 * itself (when the query string was pasted together with the body), from the
 * request path if it ever carries a query string, and otherwise inferred from
 * the documented field sets only where they are unambiguous.
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
  type LifecycleStage,
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
  AFFILIATE_SYSTEMS,
  BP_AFFILIATE_SYSTEMS,
  CARD_SUB_TYPES,
  CARD_TYPES,
  CURRENCY_CODES,
  DECLINE_CODE_15_ALTERNATIVE,
  DECLINE_CODES,
  ERROR_CODES_URL,
  FAMILY_DOCS,
  NEXT_ACTION,
  PAYMENT_TYPES,
  REST_API_URL,
  REST_ERROR_CODES,
  REST_EXAMPLE_CODES,
  RETRY_EXPLANATION,
  SCA_RESPONSE_STATUSES,
  SOURCES,
  THREE_D_SECURE_VALUES,
  THREEDS_ERRORS,
  WEB_VERIFY_URL,
  WEBHOOK_APPENDIX_B_MAX,
  WEBHOOK_EVENT_TYPES,
  LEGACY_RESULT_CODES,
  SUBSCRIPTION_STATUSES,
  type CatalogEntry,
  type CodeFamily,
  type EventInfo,
  type RestErrorRow,
  type WebhookEventName,
} from "./catalog.js";

import { ccbillManifest, CCBILL_ADAPTER_VERSION } from "./manifest.js";

export { ccbillManifest, CCBILL_ADAPTER_VERSION };

export const CCBILL_FORMATS = {
  webhook: "ccbill.webhook",
  backgroundPost: "ccbill.background_post",
  restCharge: "ccbill.rest.charge",
  restError: "ccbill.rest.error",
  paymentToken: "ccbill.rest.payment_token",
  unrecognized: "ccbill.unrecognized",
} as const;

const EVENT_NAMES = Object.keys(WEBHOOK_EVENT_TYPES) as WebhookEventName[];

// ---------------------------------------------------------------------------
// Flat field access. CCBill field names vary in case between tables
// (flexId / flexID), so form and webhook fields are looked up lowercased.

type Value = string | number | boolean | null;
/** Lowercased field name to value. */
type Fields = Record<string, Value>;

const MAX_VALUE = 2000;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isPrimitive(v: unknown): v is Value {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

/** Lowercased keys of a flat record, or null when a value is nested. */
function flatKeys(input: Record<string, unknown>): Set<string> | null {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(input)) {
    if (!isPrimitive(v) && !(Array.isArray(v) && v.every((x) => typeof x === "string")))
      return null;
    keys.add(k.toLowerCase());
  }
  return keys;
}

function toFields(input: Record<string, unknown>): {
  fields: Fields;
  collapsed: boolean;
  issues: string[];
} {
  const fields: Fields = {};
  const issues: string[] = [];
  let collapsed = false;
  for (const [key, raw] of Object.entries(input)) {
    const lk = key.toLowerCase();
    let v: unknown = raw;
    // The query string pasted together with the body repeats clientAccnum and
    // clientSubacc; identical repeats are harmless.
    if (Array.isArray(v)) {
      const list: unknown[] = v;
      if (list.length > 0 && list.every((x) => typeof x === "string" && x === list[0])) {
        v = list[0];
        collapsed = true;
      } else {
        issues.push(`${key}: repeated with different values`);
        continue;
      }
    }
    if (!isPrimitive(v)) {
      issues.push(`${key}: expected a single value`);
      continue;
    }
    if (typeof v === "string" && v.length > MAX_VALUE) {
      issues.push(`${key}: value exceeds ${MAX_VALUE} characters`);
      continue;
    }
    if (Object.hasOwn(fields, lk)) {
      if (String(fields[lk]) !== String(v))
        issues.push(`${key}: present twice with different values`);
      else collapsed = true;
      continue;
    }
    fields[lk] = v;
  }
  return { fields, collapsed, issues };
}

const has = (f: Fields, k: string) => Object.hasOwn(f, k);

/** Non-empty trimmed text of a field; numbers only when they are exact. */
function str(f: Fields, k: string): string | undefined {
  const v = has(f, k) ? f[k] : undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  return undefined;
}

type IdValue = { id?: string; unsafe: boolean };

/**
 * Identifier from a string or JSON number. CCBill ids are up to 19 digits, so
 * a JSON number above 2^53 has already lost precision in JSON.parse: it is
 * flagged and never used as a reference.
 */
function idOf(v: unknown): IdValue {
  if (typeof v === "number") {
    if (Number.isSafeInteger(v) && v >= 0) return { id: String(v), unsafe: false };
    return { unsafe: Number.isInteger(v) };
  }
  if (typeof v === "string") {
    const id = safeId(v.trim(), 64);
    return id ? { id, unsafe: false } : { unsafe: false };
  }
  return { unsafe: false };
}

const idField = (f: Fields, k: string) => idOf(has(f, k) ? f[k] : undefined);

function enumValue(value: string | undefined, allowed: readonly string[]): string | undefined {
  if (value === undefined) return undefined;
  return allowed.includes(value) ? value : "other";
}

/** Documentation examples use U+2010 instead of an ASCII hyphen in dates. */
const normalizeHyphen = (s: string) => s.replace(/‐/g, "-");

function dateText(f: Fields, k: string): string | undefined {
  const v = str(f, k);
  if (v === undefined) return undefined;
  const s = normalizeHyphen(v);
  return /^[\d\-: ]{4,32}$/.test(s) ? s : undefined;
}

const WEBHOOK_TS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

/** Webhook `timestamp` (YYYY-MM-DD HH:MM:SS, time zone not documented), read as UTC. */
function webhookTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = WEBHOOK_TS.exec(normalizeHyphen(raw).trim());
  if (!m) return undefined;
  return toIsoTimestamp(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

/** Alphabetic or Appendix A numeric currency. */
function currencyOf(
  alpha: string | undefined,
  numeric: string | undefined,
): { currency?: string; conflict: boolean } {
  const a = upperCurrency(alpha);
  const n =
    numeric !== undefined && /^\d{1,3}$/.test(numeric)
      ? lookup(CURRENCY_CODES, numeric.padStart(3, "0"))
      : upperCurrency(numeric);
  if (a && n && a !== n) return { currency: a, conflict: true };
  const currency = a ?? n;
  return currency ? { currency, conflict: false } : { conflict: false };
}

function attrs(
  values: Record<string, SafePrimitive | SafePrimitive[] | undefined>,
): Record<string, SafePrimitive | SafePrimitive[]> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Record<
    string,
    SafePrimitive | SafePrimitive[]
  >;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

// ---------------------------------------------------------------------------
// Detection

const CHARGE_KEYS = [
  "declineCode",
  "declineText",
  "denialId",
  "paymentUniqueId",
  "sessionId",
  "subscriptionId",
  "newPaymentTokenId",
] as const;

const BP_MARKERS = [
  "subscription_id",
  "denialid",
  "reasonfordeclinecode",
  "reasonfordecline",
  "reasonfordeclinecodebeforeoverride",
  "typeid",
  "customer_fname",
  "customer_lname",
  "ccbill_referer",
  "initialformattedprice",
  "recurringformattedprice",
  "initialprice",
  "responsedigest",
  "clientdrivensettlement",
  "consumeruniqueid",
  "start_date",
  "ip_address",
  "affiliate_system",
  "basecurrency",
  "allowedtypes",
];

const WEBHOOK_MARKERS = [
  "subscriptionid",
  "transactionid",
  "failurecode",
  "failurereason",
  "nextretrydate",
  "renewaldate",
  "nextrenewaldate",
  "billedamount",
  "billedinitialprice",
  "subscriptioninitialprice",
  "accountinginitialprice",
  "billedcurrencycode",
  "accountingcurrencycode",
  "originalsubscriptionid",
  "dynamicpricingvalidationdigest",
  "threedsecure",
  "cardsubtype",
  "subscriptiontypeid",
  "enddate",
  "eventtype",
];

function contentType(meta: RecordMeta | undefined): string {
  return meta?.http?.contentType ?? "";
}

function detectRest(input: Record<string, unknown>, meta?: RecordMeta): DetectionResult | null {
  const base = { provider: "ccbill" };
  const ct = contentType(meta);
  if (typeof input.approved === "boolean") {
    const present = CHARGE_KEYS.filter((k) => Object.hasOwn(input, k));
    if (
      present.length >= 4 &&
      Object.hasOwn(input, "declineCode") &&
      Object.hasOwn(input, "denialId")
    ) {
      let c = 0.6 + 0.05 * (present.length - 4);
      const reasons = [
        `approved with ${present.length} fields of the REST charge response (${present.join(", ")})`,
      ];
      if (ct.startsWith("application/vnd.mcn.transaction-service")) {
        c += 0.2;
        reasons.push("Content-Type is the REST transaction service media type");
      }
      return {
        ...base,
        format: CCBILL_FORMATS.restCharge,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
  }
  const code = input.errorCode;
  if (
    typeof input.generalMessage === "string" &&
    ((typeof code === "number" && Number.isInteger(code)) ||
      (typeof code === "string" && /^\d{1,9}$/.test(code)))
  ) {
    const extras = ["id", "url", "errors", "timestamp"].filter((k) => Object.hasOwn(input, k));
    if (extras.length === 0) return null;
    let c = 0.55 + 0.08 * extras.length;
    const reasons = [`generalMessage and a numeric errorCode with ${extras.join(", ")}`];
    if (ct.startsWith("application/vnd.com.cwie.error")) {
      c += 0.1;
      reasons.push("Content-Type is the REST error media type");
    }
    if (restRows(String(code)).length > 0) {
      c += 0.03;
      reasons.push("errorCode is a documented CCBill REST or 3DS code");
    }
    return {
      ...base,
      format: CCBILL_FORMATS.restError,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }
  return null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: "ccbill" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  if (meta?.format !== "form") {
    const rest = detectRest(input, meta);
    if (rest) return rest;
  }

  const keys = flatKeys(input);
  if (!keys || !keys.has("clientaccnum") || !keys.has("clientsubacc")) return none;
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) lower[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

  if (keys.has("paymenttokenid") && (keys.has("timetolive") || keys.has("validnumberofuse"))) {
    return {
      ...base,
      format: CCBILL_FORMATS.paymentToken,
      confidence: 0.8,
      supported: false,
      reasons: ["clientAccnum, clientSubacc and paymentTokenId with timeToLive / validNumberOfUse"],
      unsupportedReason:
        "This looks like a CCBill REST payment token object. Token objects are not analyzed; paste the charge response, the error response or the webhook instead.",
    };
  }

  let c = 0.45;
  const reasons = ["has clientAccnum and clientSubacc"];
  const acc = String(lower.clientaccnum ?? "");
  const sub = String(lower.clientsubacc ?? "");
  if (/^\d+$/.test(acc) && /^\d+$/.test(sub)) {
    c += 0.1;
    if (/^\d{6}$/.test(acc) && /^\d{4}$/.test(sub)) {
      c += 0.1;
      reasons.push("clientAccnum has 6 digits and clientSubacc 4 digits");
    }
  }
  if (meta?.http?.headers["x-allowed-satellites"] !== undefined) {
    c += 0.05;
    reasons.push("X-Allowed-Satellites header is present");
  }
  if (typeof lower.timestamp === "string" && WEBHOOK_TS.test(normalizeHyphen(lower.timestamp)))
    c += 0.05;

  const bp = BP_MARKERS.filter((k) => keys.has(k));
  const wh = WEBHOOK_MARKERS.filter((k) => keys.has(k));
  if (bp.length > 0 && bp.length >= wh.length) {
    reasons.push(`Background Post fields: ${bp.slice(0, 5).join(", ")}`);
    return {
      ...base,
      format: CCBILL_FORMATS.backgroundPost,
      confidence: round(c + 0.05 * Math.min(bp.length, 5)),
      supported: true,
      reasons,
    };
  }
  if (wh.length > 0) {
    reasons.push(`webhook fields: ${wh.slice(0, 5).join(", ")}`);
    return {
      ...base,
      format: CCBILL_FORMATS.webhook,
      confidence: round(c + 0.05 * Math.min(wh.length, 5)),
      supported: true,
      reasons,
    };
  }
  return {
    ...base,
    format: CCBILL_FORMATS.unrecognized,
    confidence: round(c),
    supported: false,
    reasons,
    unsupportedReason:
      "The record has CCBill account fields (clientAccnum, clientSubacc) but none of the fields of a webhook, Background Post or REST response, so it is not analyzed.",
  };
}

// ---------------------------------------------------------------------------
// Parsing

const NullableText = (max: number) => z.string().max(max).nullable().optional();
const IdInput = z.union([z.string().max(64), z.number(), z.null()]).optional();

const RestCharge = z.looseObject({
  approved: z.boolean(),
  declineCode: z.union([z.number().int(), z.string().max(16), z.null()]).optional(),
  declineText: NullableText(1000),
  denialId: IdInput,
  subscriptionId: IdInput,
  paymentUniqueId: NullableText(256),
  sessionId: z.union([z.string().max(256), z.number(), z.null()]).optional(),
  newPaymentTokenId: NullableText(256),
});

const RestError = z.looseObject({
  id: z.string().max(128).optional(),
  url: z.string().max(2048).optional(),
  errors: z
    .array(
      z.looseObject({
        field: NullableText(256),
        message: NullableText(2000),
      }),
    )
    .max(200)
    .optional(),
  generalMessage: z.string().max(2000),
  errorCode: z.union([z.number().int(), z.string().regex(/^\d{1,9}$/)]),
  timestamp: z.string().max(64).optional(),
});

export type EventResolution = {
  /** Resolved documented event type. */
  name?: WebhookEventName;
  /** Explicit value that is not one of the documented event types. */
  raw?: string;
  source: "record_field" | "request_url" | "inferred_from_fields" | "unavailable";
  /** Documented event types the body is compatible with, when not resolved. */
  candidates: WebhookEventName[];
  /** Whether stage and outcome may be taken from the candidates when they agree. */
  shareSemantics: boolean;
  note?: string;
};

export type CcbillParsed =
  | { kind: "webhook"; f: Fields; collapsed: boolean; event: EventResolution }
  | {
      kind: "background_post";
      f: Fields;
      collapsed: boolean;
      variant: "approval" | "denial";
    }
  | { kind: "rest_charge"; value: z.infer<typeof RestCharge> }
  | { kind: "rest_error"; value: z.infer<typeof RestError> };

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function requireAccount(f: Fields, issues: string[]) {
  if (!safeId(str(f, "clientaccnum"), 16)) issues.push("clientAccnum: required");
  if (!safeId(str(f, "clientsubacc"), 16)) issues.push("clientSubacc: required");
}

function parse(
  input: unknown,
  format: string,
  meta?: RecordMeta,
): { ok: true; value: CcbillParsed } | { ok: false; issues: string[] } {
  if (!isObj(input))
    return { ok: false, issues: ["(root): expected an object or a set of form fields"] };

  if (format === CCBILL_FORMATS.restCharge) {
    const r = RestCharge.safeParse(input);
    return r.success
      ? { ok: true, value: { kind: "rest_charge", value: r.data } }
      : { ok: false, issues: issuesOf(r.error) };
  }
  if (format === CCBILL_FORMATS.restError) {
    const r = RestError.safeParse(input);
    return r.success
      ? { ok: true, value: { kind: "rest_error", value: r.data } }
      : { ok: false, issues: issuesOf(r.error) };
  }
  if (format === CCBILL_FORMATS.webhook || format === CCBILL_FORMATS.backgroundPost) {
    const { fields: f, collapsed, issues } = toFields(input);
    requireAccount(f, issues);
    if (format === CCBILL_FORMATS.webhook) {
      if (
        !idField(f, "subscriptionid").id &&
        !idField(f, "transactionid").id &&
        !idField(f, "subscriptionid").unsafe
      )
        issues.push("subscriptionId or transactionId: required");
      if (issues.length) return { ok: false, issues };
      return { ok: true, value: { kind: "webhook", f, collapsed, event: resolveEvent(f, meta) } };
    }
    const approval = Boolean(str(f, "subscription_id"));
    const denial = Boolean(str(f, "denialid") ?? str(f, "reasonfordeclinecode"));
    if (!approval && !denial)
      issues.push(
        "subscription_id (approval) or denialId / reasonForDeclineCode (denial): required",
      );
    if (issues.length) return { ok: false, issues };
    return {
      ok: true,
      value: { kind: "background_post", f, collapsed, variant: approval ? "approval" : "denial" },
    };
  }
  return { ok: false, issues: [`Unsupported CCBill format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Webhook event type resolution

function named(value: string, source: EventResolution["source"]): EventResolution {
  const name = EVENT_NAMES.find((n) => n.toLowerCase() === value.toLowerCase());
  return name
    ? { name, source, candidates: [name], shareSemantics: true }
    : { raw: value, source, candidates: [], shareSemantics: false };
}

/** eventType from the request line's query string (core keeps it in meta.http.query). */
function queryEventType(meta: RecordMeta | undefined): string | undefined {
  const fromQuery = meta?.http?.query?.["eventType"]?.trim();
  if (fromQuery) return fromQuery;
  const path = meta?.http?.path;
  const q = path?.indexOf("?") ?? -1;
  if (!path || q < 0) return undefined;
  for (const pair of path.slice(q + 1).split("&")) {
    const i = pair.indexOf("=");
    if (i < 0 || pair.slice(0, i) !== "eventType") continue;
    try {
      return decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " ")).trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const SALE_PRICE_FIELDS = [
  "billedinitialprice",
  "subscriptioninitialprice",
  "accountinginitialprice",
  "billedrecurringprice",
  "initialperiod",
  "pricedescription",
];
const CUSTOMER_FIELDS = [
  "firstname",
  "lastname",
  "email",
  "address1",
  "postalcode",
  "phonenumber",
  "paymenttype",
  "cardtype",
  "expdate",
  "username",
];
const BASE_FIELDS = new Set([
  "subscriptionid",
  "clientaccnum",
  "clientsubacc",
  "timestamp",
  "eventgrouptype",
]);

function inferred(name: WebhookEventName, note: string): EventResolution {
  return {
    name,
    source: "inferred_from_fields",
    candidates: [name],
    shareSemantics: true,
    note: `Event type inferred from the field set: ${note}`,
  };
}

function ambiguous(candidates: WebhookEventName[], note: string): EventResolution {
  return {
    source: "unavailable",
    candidates,
    shareSemantics: true,
    note: `The event type is only sent in the webhook URL query string (eventType). ${note}`,
  };
}

/** Body-only inference from the documented field tables (research section 6.2). */
function inferEvent(f: Fields): EventResolution {
  const h = (k: string) => has(f, k);
  const failure = h("failurecode") || h("failurereason");
  const original =
    h("originalsubscriptionid") || h("originalclientaccnum") || h("originalclientsubacc");
  if (failure) {
    if (h("nextretrydate") || h("renewaldate"))
      return inferred(
        "RenewalFailure",
        "failureCode with nextRetryDate or renewalDate occurs only in RenewalFailure.",
      );
    if (original)
      return ambiguous(
        ["UpgradeFailure", "UpSaleFailure", "CrossSaleFailure"],
        "originalSubscriptionId marks an upgrade, upsale or cross-sale, and their failure bodies cannot be told apart.",
      );
    return inferred(
      "NewSaleFailure",
      "failureCode without originalSubscriptionId or rebill dates matches NewSaleFailure.",
    );
  }
  if (h("renewaldate")) {
    if (h("billedamount"))
      return inferred(
        "RenewalSuccess",
        "renewalDate with billedAmount occurs only in RenewalSuccess.",
      );
    return ambiguous(
      ["RenewalSuccess", "RenewalFailure"],
      "renewalDate occurs in both rebill events.",
    );
  }
  if (original)
    return ambiguous(
      ["UpgradeSuccess", "UpSaleSuccess", "CrossSaleSuccess"],
      "originalSubscriptionId marks an upgrade, upsale or cross-sale, and their bodies cannot be told apart.",
    );
  if (SALE_PRICE_FIELDS.some(h))
    return inferred(
      "NewSaleSuccess",
      "initial price fields without failureCode or originalSubscriptionId match NewSaleSuccess.",
    );
  if (h("enddate")) return inferred("ManualAdd", "endDate occurs only in ManualAdd.");
  if (h("price") && !h("amount"))
    return inferred("UserReactivation", "price occurs only in UserReactivation.");
  if (h("amount") || h("accountingamount")) {
    if (h("bin"))
      return inferred(
        "Chargeback",
        "among Refund, Void, Chargeback and Return only Chargeback carries bin.",
      );
    const candidates: WebhookEventName[] = ["Refund", "Void", "Chargeback"];
    if (!["cardtype", "currency", "accountingcurrency", "expdate"].some(h))
      candidates.push("Return");
    return ambiguous(
      candidates,
      "Refund and Void have identical fields, and Chargeback and Return differ only by fields that older event versions may not send, so the body alone cannot tell them apart.",
    );
  }
  if (h("reason") || h("source"))
    return inferred(
      "Cancellation",
      "reason or source without an amount occurs only in Cancellation.",
    );
  if (h("nextrenewaldate") && !h("transactionid"))
    return inferred(
      "BillingDateChange",
      "nextRenewalDate without transaction or price fields matches BillingDateChange.",
    );
  if (CUSTOMER_FIELDS.some(h) && !h("transactionid"))
    return inferred(
      "CustomerDataUpdate",
      "customer and payment fields without a transaction match CustomerDataUpdate.",
    );
  if (h("subscriptionid") && Object.keys(f).every((k) => BASE_FIELDS.has(k))) {
    return {
      source: "unavailable",
      candidates: ["Expiration"],
      shareSemantics: false,
      note: "The event type is only sent in the webhook URL query string (eventType). The body has only subscriptionId, clientAccnum, clientSubacc and timestamp: that is the Expiration field set, but it is also a subset of every other event's fields, so the event cannot be confirmed from the body alone.",
    };
  }
  return {
    source: "unavailable",
    candidates: [],
    shareSemantics: false,
    note: "The event type is only sent in the webhook URL query string (eventType), and the field set does not match a documented event type.",
  };
}

function resolveEvent(f: Fields, meta: RecordMeta | undefined): EventResolution {
  const explicit = str(f, "eventtype");
  if (explicit) return named(explicit, "record_field");
  const fromUrl = queryEventType(meta);
  if (fromUrl) return named(fromUrl, "request_url");
  return inferEvent(f);
}

type Semantics = { stage: LifecycleStage; outcome: Outcome; isRecurring?: boolean };

/** Stage, outcome and recurrence shared by all candidates, if any. */
function sharedSemantics(r: EventResolution): Semantics {
  const infos: EventInfo[] = r.candidates.map((n) => WEBHOOK_EVENT_TYPES[n]);
  const first = infos[0];
  if (!r.shareSemantics || !first || infos.length < 2)
    return { stage: "other", outcome: "unknown" };
  if (!infos.every((i) => i.stage === first.stage)) return { stage: "other", outcome: "unknown" };
  const sem: Semantics = {
    stage: first.stage,
    outcome: infos.every((i) => i.outcome === first.outcome) ? first.outcome : "unknown",
  };
  if (infos.every((i) => i.isRecurring === first.isRecurring) && first.isRecurring !== undefined)
    sem.isRecurring = first.isRecurring;
  return sem;
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
  documentation: DocumentationLink[];
  /** HTTP status of the documented row, for REST errors. */
  status?: number;
};

export type DeclineSource = "background_post" | "webhook" | "rest";

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Code not in the PandaPayLens CCBill catalog",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens does not recognize this CCBill code.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

/**
 * Decodes a payment decline code: Background Post `reasonForDeclineCode`,
 * webhook `failureCode`, or REST / billing API `declineCode`.
 */
export function decodeDeclineCode(raw: string, source: DeclineSource): CodeDecoding {
  const code = raw.trim();
  const shown = safeText(code, 40) ?? "";
  const numeric = /^\d{1,3}$/.test(code) ? String(Number(code)) : undefined;
  const found = numeric !== undefined ? lookup(DECLINE_CODES, numeric) : undefined;
  if (found && numeric !== undefined) {
    const family: CodeFamily = source === "webhook" ? "webhook_failure" : "decline";
    const missing: string[] = [];
    let confidence: Confidence = source === "background_post" ? "strong" : "possible";
    if (numeric === "15") {
      confidence = "possible";
      missing.push(
        `Code 15 has two documented meanings: the decline code tables say the account is still being processed, while ${DECLINE_CODE_15_ALTERNATIVE}.`,
      );
    }
    if (source === "webhook") {
      missing.push(
        "CCBill does not document which table webhook failureCode values come from; this numeric value was decoded with the decline code table.",
      );
      if (Number(numeric) > WEBHOOK_APPENDIX_B_MAX)
        missing.push(
          `The webhooks guide lists decline codes 1 to ${WEBHOOK_APPENDIX_B_MAX} only; this meaning comes from the Background Post table.`,
        );
    }
    if (source === "rest")
      missing.push(
        "CCBill does not state that declineCode uses the Background Post decline table; the documented REST examples match it.",
      );
    return {
      code,
      family,
      entry: found,
      confidence,
      missing,
      documentation: [
        ...FAMILY_DOCS[family],
        ...(numeric === "45" ? [{ title: "CCBill Web Verify", url: WEB_VERIFY_URL }] : []),
      ],
    };
  }
  if (source === "webhook" && numeric === undefined) {
    return {
      code,
      family: null,
      entry: {
        meaning: "Bank decline code not in any published CCBill table",
        category: "unknown",
        retry: "unknown",
        explanation: `CCBill describes failureCode as the decline code sent from the bank. "${shown}" is not in any published CCBill code table, so only the failureReason text describes it.`,
        nextAction:
          "Read the failureReason text and check the transaction in the CCBill Admin Portal, or ask CCBill Merchant Support what the code means.",
        retryExplanation: RETRY_EXPLANATION.unknown,
      },
      confidence: "insufficient",
      missing: [
        "Webhook failureCode values in this format (documented example BE-140) are not in any published CCBill table.",
      ],
      documentation: FAMILY_DOCS.webhook_failure,
    };
  }
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [`Code "${shown}" is not in the CCBill decline code tables known to PandaPayLens.`],
    documentation: FAMILY_DOCS.decline,
  };
}

type RowRef = { row: RestErrorRow; family: CodeFamily };

function restRows(code: string): RowRef[] {
  const out: RowRef[] = [];
  for (const row of Object.values(REST_ERROR_CODES))
    if (row.code === code) out.push({ row, family: "rest_error" });
  for (const row of Object.values(REST_EXAMPLE_CODES))
    if (row.code === code) out.push({ row, family: "rest_example" });
  for (const row of Object.values(THREEDS_ERRORS))
    if (row.code === code) out.push({ row, family: "threeds" });
  return out;
}

function fromRow(ref: RowRef, confidence: Confidence, missing: string[] = []): CodeDecoding {
  // Rows that appear only in OpenAPI examples are never better than possible.
  const conf: Confidence = ref.family === "rest_example" ? "possible" : confidence;
  const extra =
    ref.family === "rest_example"
      ? ["This code appears only in the OpenAPI examples, not on the CCBill error codes page."]
      : [];
  return {
    code: ref.row.code,
    family: ref.family,
    entry: ref.row,
    confidence: conf,
    missing: [...missing, ...extra],
    documentation: FAMILY_DOCS[ref.family],
    status: ref.row.status,
  };
}

/**
 * Decodes a REST or 3DS `errorCode` by the pair (HTTP status, errorCode),
 * because CCBill reuses numbers with different meanings. Without the status,
 * `generalMessage` is used as a hint; otherwise all meanings are listed.
 */
export function decodeRestError(
  rawCode: string,
  status?: number,
  generalMessage?: string,
): CodeDecoding {
  const code = rawCode.trim();
  const shown = safeText(code, 40) ?? "";
  const rows = restRows(code);
  if (rows.length === 0) {
    return {
      code,
      family: null,
      entry: UNKNOWN_ENTRY,
      confidence: "insufficient",
      missing: [
        `errorCode "${shown}" is not in the CCBill REST or 3DS error tables known to PandaPayLens.`,
      ],
      documentation: [{ title: "CCBill error codes", url: ERROR_CODES_URL }],
    };
  }
  if (status !== undefined) {
    const exact = rows.find((r) => r.row.status === status);
    if (exact) return fromRow(exact, "strong");
    if (rows.length === 1)
      return fromRow(rows[0]!, "possible", [
        `errorCode ${shown} is documented with HTTP ${rows[0]!.row.status}, but the record has HTTP ${status}.`,
      ]);
  } else {
    if (rows.length === 1) return fromRow(rows[0]!, "strong");
    const msg = generalMessage ?? "";
    const hint =
      code === "200000" && /validation/i.test(msg)
        ? rows.find((r) => r.family === "rest_error")
        : code === "100100" && /try again later/i.test(msg)
          ? rows.find((r) => r.family === "rest_example")
          : undefined;
    if (hint)
      return fromRow(hint, "possible", [
        `The HTTP status is not in the record; errorCode ${shown} has several documented meanings and this one was chosen from generalMessage.`,
      ]);
  }
  // Several documented meanings and nothing to choose between them.
  const first = rows[0]!.row;
  const list = rows.map((r) => `HTTP ${r.row.status}: ${r.row.meaning}`).join("; ");
  const agree = rows.every((r) => r.row.category === first.category && r.row.retry === first.retry);
  const why =
    status === undefined
      ? "The HTTP status is not in the record."
      : `None of the documented meanings is for HTTP ${status}.`;
  const entry: CatalogEntry = agree
    ? { ...first, meaning: list, explanation: `errorCode ${shown} is documented as: ${list}.` }
    : {
        meaning: list,
        category: "unknown",
        retry: "manual_review",
        explanation: `errorCode ${shown} has different documented meanings depending on the HTTP status: ${list}.`,
        nextAction:
          "Check the HTTP status of the response: 4xx means the request was rejected, 5xx means the outcome must be verified before any new attempt.",
        retryExplanation:
          "The right retry decision depends on the HTTP status. Do not resend until it is known; for a 5xx answer, verify first whether the original request took effect.",
        outcomeUncertain: true,
      };
  return {
    code,
    family: rows[0]!.family,
    entry,
    confidence: "possible",
    missing: [`${why} errorCode ${shown} is reused by CCBill with several meanings.`],
    documentation: [
      ...new Map(
        rows.flatMap((r) => FAMILY_DOCS[r.family]).map((d) => [d.url + d.title, d]),
      ).values(),
    ],
  };
}

/** A failure record that carries no code at all. */
function noCode(field: string, family: CodeFamily): CodeDecoding {
  return {
    code: "not_provided",
    family: null,
    entry: {
      ...UNKNOWN_ENTRY,
      meaning: `No ${field} in the record`,
      explanation: `The record reports a failure without ${field}.`,
    },
    confidence: "insufficient",
    missing: [`The record has no ${field}.`],
    documentation: FAMILY_DOCS[family],
  };
}

/** Result code of the legacy subscriptionManagement.cgi / billingApi.cgi API. */
export function decodeLegacyResult(raw: string): CodeDecoding {
  const code = raw.trim();
  const found = lookup(LEGACY_RESULT_CODES, code);
  if (found)
    return {
      code,
      family: "legacy",
      entry: found,
      confidence: "strong",
      missing: [],
      documentation: FAMILY_DOCS.legacy,
    };
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [`Result code "${safeText(code, 40) ?? ""}" is not in the CCBill API guide.`],
    documentation: FAMILY_DOCS.legacy,
  };
}

/** Meaning of a legacy `subscriptionStatus` value, if documented. */
export function describeSubscriptionStatus(raw: string): string | undefined {
  return lookup(SUBSCRIPTION_STATUSES, raw.trim())?.meaning;
}

// ---------------------------------------------------------------------------
// Normalization

function money(f: Fields) {
  let amount: string | undefined;
  let cur: { currency?: string; conflict: boolean };
  if (has(f, "billedamount")) {
    amount = str(f, "billedamount");
    cur = currencyOf(str(f, "billedcurrency"), str(f, "billedcurrencycode"));
  } else if (has(f, "amount")) {
    amount = str(f, "amount");
    cur = currencyOf(str(f, "currency"), str(f, "currencycode"));
  } else if (has(f, "billedinitialprice")) {
    amount = str(f, "billedinitialprice");
    cur = currencyOf(str(f, "billedcurrency"), str(f, "billedcurrencycode"));
  } else if (has(f, "initialprice")) {
    amount = str(f, "initialprice");
    cur = currencyOf(undefined, str(f, "currencycode"));
  } else {
    cur = { conflict: false };
  }
  const acc = currencyOf(str(f, "accountingcurrency"), str(f, "accountingcurrencycode"));
  const accAmount = str(f, "accountingamount") ?? str(f, "accountinginitialprice");
  const recurring = str(f, "billedrecurringprice") ?? str(f, "recurringprice");
  return {
    amountMinor: decimalToMinor(amount, cur.currency),
    currency: cur.currency,
    accountingAmountMinor: decimalToMinor(accAmount, acc.currency),
    accountingCurrency: acc.currency,
    recurringAmountMinor: decimalToMinor(recurring, cur.currency),
    currencyConflict: cur.conflict || acc.conflict ? true : undefined,
  };
}

const digits = (v: string | undefined, max = 6) =>
  v !== undefined && new RegExp(`^\\d{1,${max}}$`).test(v) ? v : undefined;

function passThroughCount(f: Fields): number | undefined {
  const n = Object.keys(f).filter((k) => k.startsWith("x-")).length;
  return n > 0 ? n : undefined;
}

function normalizeWebhook(
  p: Extract<CcbillParsed, { kind: "webhook" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const f = p.f;
  const r = p.event;
  const info: EventInfo | undefined = r.name ? WEBHOOK_EVENT_TYPES[r.name] : undefined;
  const sem: Semantics = info
    ? {
        stage: info.stage,
        outcome: info.outcome,
        ...(info.isRecurring !== undefined ? { isRecurring: info.isRecurring } : {}),
      }
    : r.raw !== undefined
      ? { stage: "other", outcome: "unknown" }
      : sharedSemantics(r);
  const eventType =
    r.name ?? (r.raw !== undefined ? (safeText(r.raw, 64) ?? "unknown") : "unidentified_webhook");

  const sub = idField(f, "subscriptionid");
  const txn = idField(f, "transactionid");
  const orig = idField(f, "originalsubscriptionid");
  const rawTs = str(f, "timestamp");
  const ts = webhookTime(rawTs);
  const m = money(f);
  const failureCode = str(f, "failurecode");

  return clean({
    sourceFormat: ctx.format,
    eventType,
    eventTypeKnown: Boolean(info),
    stage: sem.stage,
    providerStatus: failureCode
      ? `${eventType}; failureCode=${safeText(failureCode, 32) ?? ""}`
      : eventType,
    paymentReference: sub.id ?? txn.id,
    relatedReference: sub.id ? txn.id : undefined,
    subscriptionReference: sub.id,
    isRecurring: sem.isRecurring,
    eventTimestamp: ts,
    amountMinor: m.amountMinor,
    currency: m.currency,
    outcome: sem.outcome,
    attributes: attrs({
      eventTypeSource: r.source,
      candidateEventTypes: !r.name && r.candidates.length ? [...r.candidates] : undefined,
      eventTypeNote: r.note,
      eventGroupType: safeText(str(f, "eventgrouptype"), 32),
      clientAccnum: safeId(str(f, "clientaccnum"), 16),
      clientSubacc: safeId(str(f, "clientsubacc"), 16),
      originalSubscriptionId: orig.id,
      originalClientAccnum: safeId(str(f, "originalclientaccnum"), 16),
      originalClientSubacc: safeId(str(f, "originalclientsubacc"), 16),
      providerTimestamp: rawTs !== undefined ? safeText(normalizeHyphen(rawTs), 32) : undefined,
      timestampTimeZone: ts ? "not documented; read as UTC" : undefined,
      timestampUnparsed: rawTs !== undefined && !ts ? true : undefined,
      failureCode: safeText(failureCode, 32),
      failureReason: safeText(str(f, "failurereason"), 200),
      nextRetryDate: dateText(f, "nextretrydate"),
      renewalDate: dateText(f, "renewaldate"),
      nextRenewalDate: dateText(f, "nextrenewaldate"),
      endDate: dateText(f, "enddate"),
      reason: safeText(str(f, "reason"), 200),
      source: enumValue(str(f, "source"), SOURCES),
      paymentType: enumValue(str(f, "paymenttype"), PAYMENT_TYPES),
      cardType: enumValue(str(f, "cardtype"), CARD_TYPES),
      cardSubType: enumValue(str(f, "cardsubtype"), CARD_SUB_TYPES),
      prePaid: digits(str(f, "prepaid"), 1),
      threeDSecure: enumValue(str(f, "threedsecure"), THREE_D_SECURE_VALUES),
      scaResponseStatus: enumValue(str(f, "scaresponsestatus"), SCA_RESPONSE_STATUSES),
      avsResponse: safeId(str(f, "avsresponse"), 4),
      cvv2Response: safeId(str(f, "cvv2response"), 4),
      affiliateSystem: enumValue(str(f, "affiliatesystem"), AFFILIATE_SYSTEMS),
      subscriptionTypeId: safeId(str(f, "subscriptiontypeid"), 32),
      formName: safeId(str(f, "formname"), 32),
      flexId: safeId(str(f, "flexid"), 64),
      initialPeriod: digits(str(f, "initialperiod")),
      recurringPeriod: digits(str(f, "recurringperiod")),
      rebills: digits(str(f, "rebills")),
      lifeTimeSubscription: digits(str(f, "lifetimesubscription"), 1),
      billedRecurringAmountMinor: m.recurringAmountMinor,
      accountingAmountMinor: m.accountingAmountMinor,
      accountingCurrency: m.accountingCurrency,
      currencyConflict: m.currencyConflict,
      dynamicPricingDigestPresent: str(f, "dynamicpricingvalidationdigest") ? true : undefined,
      passThroughFields: passThroughCount(f),
      subscriptionIdPrecisionLost: sub.unsafe ? true : undefined,
      transactionIdPrecisionLost: txn.unsafe ? true : undefined,
      repeatedKeysCollapsed: p.collapsed ? true : undefined,
      signatureVerified: false,
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizeBackgroundPost(
  p: Extract<CcbillParsed, { kind: "background_post" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const f = p.f;
  const approval = p.variant === "approval";
  const sub = idField(f, "subscription_id");
  const denial = idField(f, "denialid");
  const m = money(f);
  const cds = str(f, "clientdrivensettlement");
  const declineCode = str(f, "reasonfordeclinecode");
  const before = str(f, "reasonfordeclinecodebeforeoverride");
  const beforeEntry =
    before !== undefined && /^\d{1,3}$/.test(before)
      ? lookup(DECLINE_CODES, String(Number(before)))
      : undefined;
  // Merchant-driven settlement approvals are pre-authorizations: funds are
  // collected when the consumer first logs in.
  const stage: LifecycleStage = approval && cds === "1" ? "authorization" : "payment";
  const ref = approval ? sub.id : denial.id;
  return clean({
    sourceFormat: ctx.format,
    eventType: approval ? "background_post.approval" : "background_post.denial",
    eventTypeKnown: true,
    stage,
    providerStatus: approval
      ? "Approval Post"
      : `Denial Post; reasonForDeclineCode=${safeText(declineCode, 16) ?? ""}`,
    paymentReference: ref,
    subscriptionReference: approval ? sub.id : undefined,
    isRecurring: false,
    // CCBill resends unsuccessful posts; one post reports one transaction.
    deliveryKey: ref ? `${approval ? "approval" : "denial"}|${ref}` : undefined,
    amountMinor: m.amountMinor,
    currency: m.currency,
    outcome: approval ? "success" : "failure",
    attributes: attrs({
      clientAccnum: safeId(str(f, "clientaccnum"), 16),
      clientSubacc: safeId(str(f, "clientsubacc"), 16),
      formName: safeId(str(f, "formname"), 32),
      typeId: safeId(str(f, "typeid"), 32),
      initialPeriod: digits(str(f, "initialperiod")),
      recurringPeriod: digits(str(f, "recurringperiod")),
      rebills: digits(str(f, "rebills")),
      recurringAmountMinor: m.recurringAmountMinor,
      cardType: enumValue(str(f, "cardtype"), CARD_TYPES),
      clientDrivenSettlement: cds === "1" ? true : cds === "0" ? false : undefined,
      lifeTimeSubscription: digits(str(f, "lifetimesubscription"), 1),
      affiliateSystem: lookup(BP_AFFILIATE_SYSTEMS, str(f, "affiliate_system")),
      reasonForDeclineCode: safeText(declineCode, 16),
      reasonForDecline: safeText(str(f, "reasonfordecline"), 200),
      softDeclineOverridden: approval && before !== undefined ? true : undefined,
      declineCodeBeforeOverride: approval ? safeText(before, 16) : undefined,
      declineBeforeOverrideMeaning: approval ? beforeEntry?.meaning : undefined,
      responseDigestPresent: str(f, "responsedigest") ? true : undefined,
      passThroughFields: passThroughCount(f),
      denialIdPrecisionLost: denial.unsafe ? true : undefined,
      repeatedKeysCollapsed: p.collapsed ? true : undefined,
      signatureVerified: false,
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function apiVersion(v: z.infer<typeof RestCharge>, ct: string): "v1" | "v2" | "undetermined" {
  if (ct.includes("api.v.1")) return "v1";
  if (ct.includes("api.v.2")) return "v2";
  if (typeof v.subscriptionId === "number") return "v1";
  if (typeof v.subscriptionId === "string") return "v2";
  return "undetermined";
}

const declineCodeText = (v: z.infer<typeof RestCharge>) =>
  v.declineCode === null || v.declineCode === undefined
    ? undefined
    : String(v.declineCode).trim() || undefined;

/** Request path of a REST error with identifier segments replaced, so tokens never leak. */
function endpointOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const path = url.split("?")[0]!;
  const segments = path
    .split("/")
    .filter((s) => s !== "")
    .slice(0, 8);
  if (!segments.length) return undefined;
  return `/${segments.map((s) => (/^[a-z][a-z-]{0,40}$/i.test(s) ? s : "{id}")).join("/")}`;
}

function normalize(parsed: CcbillParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "webhook") return [normalizeWebhook(parsed, ctx)];
  if (parsed.kind === "background_post") return [normalizeBackgroundPost(parsed, ctx)];
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const httpStatus = ctx.meta?.http?.status;

  if (parsed.kind === "rest_charge") {
    const v = parsed.value;
    const sub = idOf(v.subscriptionId);
    const den = idOf(v.denialId);
    const code = declineCodeText(v);
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "charge_response",
        eventTypeKnown: true,
        stage: "payment",
        providerStatus: v.approved
          ? "approved=true"
          : `approved=false; declineCode=${safeText(code, 16) ?? ""}`,
        paymentReference: sub.id ?? den.id,
        relatedReference: sub.id ? den.id : undefined,
        subscriptionReference: sub.id,
        outcome: v.approved ? "success" : "failure",
        attributes: attrs({
          approved: v.approved,
          declineCode: safeText(code, 16),
          declineText: safeText(v.declineText ?? undefined, 200),
          apiVersion: apiVersion(v, contentType(ctx.meta)),
          httpStatus,
          newPaymentTokenIssued: v.newPaymentTokenId ? true : undefined,
          subscriptionIdPrecisionLost: sub.unsafe ? true : undefined,
          denialIdPrecisionLost: den.unsafe ? true : undefined,
        }),
        source,
        ...observed,
      }),
    ];
  }

  const e = parsed.value;
  const code = String(e.errorCode);
  const d = decodeRestError(code, httpStatus, e.generalMessage);
  const fieldNames = (e.errors ?? [])
    .map((x) => safeId(x.field ?? undefined, 64))
    .filter((x): x is string => Boolean(x));
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: d.family === "threeds" ? "threeds_error" : "rest_error",
      eventTypeKnown: true,
      stage: "error",
      providerStatus: httpStatus
        ? `HTTP ${httpStatus}; errorCode=${safeText(code, 16)}`
        : `errorCode=${safeText(code, 16)}`,
      eventTimestamp: toIsoTimestamp(e.timestamp),
      // A 4xx answer rejected the request; a 5xx answer leaves the outcome open.
      outcome:
        httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500 ? "failure" : "unknown",
      attributes: attrs({
        httpStatus,
        errorCode: safeText(code, 16),
        codeTable: d.family ?? undefined,
        generalMessage: safeText(e.generalMessage, 200),
        errorId: safeId(e.id, 64),
        endpoint: endpointOf(e.url),
        fieldNames: fieldNames.length ? fieldNames : undefined,
      }),
      source,
      ...observed,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Error decoding

function draftFrom(
  d: CodeDecoding,
  ctx: NormalizeContext,
  opts: {
    field: string;
    message?: string;
    paymentReference?: string;
    attemptReference?: string;
    outcomeKnown?: boolean;
    subCodes?: Record<string, string>;
    missing?: string[];
    explanationSuffix?: string;
    retryExplanationSuffix?: string;
    nextAction?: string;
  },
): DecodedErrorDraft {
  const subCodes: Record<string, string> = { field: opts.field, ...(opts.subCodes ?? {}) };
  if (d.family) subCodes.table = d.family;
  // Decline codes are answers to a submitted payment; `decline_code` is the
  // shared name the rules look for.
  if (d.family === "decline" || d.family === "webhook_failure") subCodes.decline_code = d.code;
  const providerMessage = safeText(opts.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: d.code,
    subCodes,
    category: d.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: opts.explanationSuffix
      ? `${d.entry.explanation} ${opts.explanationSuffix}`
      : d.entry.explanation,
    nextAction: opts.nextAction ?? d.entry.nextAction,
    retry: d.entry.retry,
    retryExplanation: opts.retryExplanationSuffix
      ? `${d.entry.retryExplanation} ${opts.retryExplanationSuffix}`
      : d.entry.retryExplanation,
    confidence: d.confidence,
    documentation: [...d.documentation],
    missingInformation: [...d.missing, ...(opts.missing ?? [])],
    ...(opts.paymentReference ? { paymentReference: opts.paymentReference } : {}),
    ...(opts.attemptReference ? { attemptReference: opts.attemptReference } : {}),
    ...(opts.outcomeKnown !== undefined ? { outcomeKnown: opts.outcomeKnown } : {}),
  };
}

const PRECISION_NOTE = (field: string) =>
  `${field} arrived as a JSON number larger than 2^53, so its exact value was lost when the JSON was parsed and it is not used as a reference. Use the raw response text, or the v2 media type for subscriptionId.`;

/** Code 20 is documented as "no decline"; it is not decoded as an error. */
const isNoDecline = (code: string) => /^0*20$/.test(code);

function decodeErrors(parsed: CcbillParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "webhook") {
    const f = parsed.f;
    const code = str(f, "failurecode");
    const reason = str(f, "failurereason");
    if (code === undefined && reason === undefined) return [];
    if (code !== undefined && isNoDecline(code)) return [];
    const d = code ? decodeDeclineCode(code, "webhook") : noCode("failureCode", "webhook_failure");
    const sub = idField(f, "subscriptionid").id;
    const txn = idField(f, "transactionid").id;
    const ref = sub ?? txn;
    const name = parsed.event.name;
    const nextRetry = dateText(f, "nextretrydate");
    const missing: string[] = [];
    if (!name)
      missing.push(
        "The webhook event type is not available (it is sent only in the URL query string), so the operation this failure belongs to is uncertain.",
      );
    const retryNote = nextRetry
      ? `The payload says CCBill will attempt billing again on ${nextRetry} (nextRetryDate); its retry schedule beyond that date is not documented.`
      : undefined;
    return [
      draftFrom(d, ctx, {
        field: "failureCode",
        ...(reason ? { message: reason } : {}),
        ...(ref ? { paymentReference: ref } : {}),
        ...(txn ? { attemptReference: txn } : {}),
        // A Failure event is CCBill's final answer for that attempt.
        outcomeKnown: true,
        subCodes: {
          ...(name ? { eventType: name } : {}),
          ...(nextRetry ? { nextRetryDate: nextRetry } : {}),
        },
        missing,
        ...(retryNote
          ? {
              retryExplanationSuffix: retryNote,
              ...(d.family === null ? { nextAction: `${d.entry.nextAction} ${retryNote}` } : {}),
            }
          : {}),
      }),
    ];
  }

  if (parsed.kind === "background_post") {
    if (parsed.variant !== "denial") return [];
    const f = parsed.f;
    const code = str(f, "reasonfordeclinecode");
    if (code !== undefined && isNoDecline(code)) return [];
    const den = idField(f, "denialid");
    const missing: string[] = [];
    if (den.unsafe) missing.push(PRECISION_NOTE("denialId"));
    const d = code
      ? decodeDeclineCode(code, "background_post")
      : noCode("reasonForDeclineCode", "decline");
    const message = str(f, "reasonfordecline");
    return [
      draftFrom(d, ctx, {
        field: "reasonForDeclineCode",
        ...(message ? { message } : {}),
        ...(den.id ? { paymentReference: den.id, attemptReference: den.id } : {}),
        outcomeKnown: true,
        missing,
      }),
    ];
  }

  if (parsed.kind === "rest_charge") {
    const v = parsed.value;
    if (v.approved) return [];
    const code = declineCodeText(v);
    if (code !== undefined && isNoDecline(code)) return [];
    const sub = idOf(v.subscriptionId);
    const den = idOf(v.denialId);
    const missing: string[] = [];
    if (den.unsafe) missing.push(PRECISION_NOTE("denialId"));
    if (sub.unsafe) missing.push(PRECISION_NOTE("subscriptionId"));
    const d = code ? decodeDeclineCode(code, "rest") : noCode("declineCode", "decline");
    const ref = sub.id ?? den.id;
    return [
      draftFrom(d, ctx, {
        field: "declineCode",
        ...(v.declineText ? { message: v.declineText } : {}),
        ...(ref ? { paymentReference: ref } : {}),
        ...(den.id ? { attemptReference: den.id } : {}),
        // HTTP 200 with approved=false is a definitive decline.
        outcomeKnown: true,
        missing,
      }),
    ];
  }

  const e = parsed.value;
  const status = ctx.meta?.http?.status;
  const d = decodeRestError(String(e.errorCode), status, e.generalMessage);
  const messages = (e.errors ?? []).map((x) => x.message ?? "").filter((x) => x !== "");
  const fields = (e.errors ?? [])
    .map((x) => safeId(x.field ?? undefined, 64))
    .filter((x): x is string => Boolean(x));
  const subCodes: Record<string, string> = {};
  if (status !== undefined) subCodes.http_status = String(status);
  if (fields.length) subCodes.fields = fields.join(",");
  const errorId = safeId(e.id, 64);
  if (errorId) subCodes.errorId = errorId;
  const detail = messages.length
    ? `Field messages: ${messages
        .slice(0, 5)
        .map((m) => safeText(m, 160) ?? "")
        .join("; ")}.`
    : undefined;
  let draft = draftFrom(d, ctx, {
    field: "errorCode",
    message: e.generalMessage,
    subCodes,
    ...(status !== undefined && status >= 400 && status < 500 ? { outcomeKnown: true } : {}),
    ...(detail ? { explanationSuffix: detail } : {}),
    missing: errorId
      ? []
      : ["The error id (used by CCBill support to locate the error) is missing."],
  });
  // The validation error covers customer data too (card number, email).
  if (
    d.family === "rest_error" &&
    d.status === 400 &&
    d.code === "200000" &&
    messages.some((m) => /card number|email/i.test(m))
  ) {
    draft = {
      ...draft,
      retry: "customer_action_required",
      retryExplanation: RETRY_EXPLANATION.customer_action_required,
      nextAction: "Ask the customer to correct the card number or email address named in errors[].",
    };
  }
  draft.documentation.push({ title: "CCBill RESTful Transaction API", url: REST_API_URL });
  return [draft];
}

// ---------------------------------------------------------------------------

export const ccbillAdapter: ProviderAdapter<CcbillParsed> = {
  id: "ccbill",
  displayName: "CCBill",
  version: CCBILL_ADAPTER_VERSION,
  manifest: ccbillManifest,
  supportedFormats: [
    {
      id: CCBILL_FORMATS.webhook,
      description:
        "Webhook body (URL-encoded or JSON); event type from the query string when available",
    },
    {
      id: CCBILL_FORMATS.backgroundPost,
      description: "Background Post (Approval / Denial Post URL)",
    },
    { id: CCBILL_FORMATS.restCharge, description: "RESTful Transaction API charge response" },
    { id: CCBILL_FORMATS.restError, description: "RESTful API and 3DS error envelope" },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // subscriptionId spans sale, rebills, cancellation, refunds and
    // chargebacks; originalSubscriptionId links an upgrade, upsale or
    // cross-sale to its parent. paymentAccount (a card hash) links payers,
    // not payments, so it is never used.
    const orig = event.attributes.originalSubscriptionId;
    return [
      ...new Set(
        [
          event.subscriptionReference,
          event.paymentReference,
          event.relatedReference,
          typeof orig === "string" ? orig : undefined,
        ].filter((x): x is string => Boolean(x)),
      ),
    ];
  },
};

export * from "./catalog.js";
export default ccbillAdapter;
