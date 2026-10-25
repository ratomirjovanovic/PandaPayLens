/**
 * Trust Payments adapter (TRU Connect, formerly Secure Trading STPP).
 *
 * Supported input families:
 * - `trust_payments.webservices.envelope`  Webservices API JSON response envelope
 *                                          (`response[]`, or `responses[]` from the client libraries),
 *                                          including TRANSACTIONQUERY `records[]`
 * - `trust_payments.jwt.payload`           Decoded response JWT ({ iat, payload: envelope, aud })
 * - `trust_payments.response.object`       One response object copied out of the array
 * - `trust_payments.url_notification`      Form-encoded URL notification (`notificationreference`)
 * - `trust_payments.payment_pages.redirect` Form-encoded Payment Pages redirect fields
 *
 * Recognized but not supported: `trust_payments.webservices.request` (request
 * envelopes, which carry card data) and envelopes declaring a version other
 * than the documented "1.00".
 *
 * Every request processed by the gateway gets its own `transactionreference`;
 * children name their parent in `parenttransactionreference`. Those two are
 * the only correlation keys. URL notifications have no event-type field, so
 * their meaning is inferred from the fields present and marked as inferred.
 */

import {
  lookup,
  minorUnits,
  safeId,
  safeText,
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
  ACCOUNT_TYPES,
  ADVICE_CODES,
  ADVICE_CODES_URL,
  CHECKS_URL,
  CLIENT_LIBRARY_CODES,
  CLIENT_LIBRARY_URL,
  DECLINES_URL,
  ERROR_CODES_HELP_URL,
  ERROR_CODES_URL,
  GATEWAY_CODES,
  INVALID_PROCESS_CODES,
  JWT_URL,
  NEXT_ACTION,
  OFFLINE_REFUND_AUTHCODES,
  PAYOUT_MCC,
  PAYOUTS_URL,
  PORTAL_CODES,
  RECURRING_URL,
  REQUEST_TYPES,
  RETRY_TEXT,
  SCHEMEUPDATE_URL,
  SECURITY_RESPONSES,
  SETTLE_STATUSES,
  SHIELD_STATUSES,
  SOFT_DECLINE_URL,
  SUBSCRIPTION_STATES,
  THREEDS_ENROLLED,
  THREEDS_HANDLING_URL,
  THREEDS_STATUSES,
  TRANSACTIONUPDATE_URL,
  URL_NOTIFICATION_ACTION_URL,
  type CodeEntry,
  type CodeFamily,
} from "./catalog.js";

import { trustPaymentsManifest, TRUST_PAYMENTS_ADAPTER_VERSION } from "./manifest.js";

export { trustPaymentsManifest, TRUST_PAYMENTS_ADAPTER_VERSION };

const PROVIDER = "trust_payments";

export const TRUST_PAYMENTS_FORMATS = {
  envelope: "trust_payments.webservices.envelope",
  jwt: "trust_payments.jwt.payload",
  object: "trust_payments.response.object",
  notification: "trust_payments.url_notification",
  redirect: "trust_payments.payment_pages.redirect",
  request: "trust_payments.webservices.request",
} as const;

// ---------------------------------------------------------------------------
// Schemas. All documented values are strings, including numbers.

const opt = (max: number) => z.string().max(max).optional();

const Fields = {
  errormessage: opt(2000),
  // The Python client returns errordata as a list.
  errordata: z.union([z.string().max(2000), z.array(z.string().max(2000)).max(50)]).optional(),
  requesttypedescription: opt(32),
  accounttypedescription: opt(32),
  transactionreference: opt(64),
  parenttransactionreference: opt(64),
  orderreference: opt(256),
  baseamount: opt(32),
  settlebaseamount: opt(32),
  currencyiso3a: opt(8),
  settlestatus: opt(8),
  settleduedate: opt(32),
  transactionstartedtimestamp: opt(32),
  settledtimestamp: opt(32),
  acquirerresponsecode: opt(255),
  acquirerresponsemessage: opt(2000),
  schemeresponsecode: opt(16),
  acquireradvicecode: opt(8),
  status: opt(8),
  enrolled: opt(8),
  rules: z
    .array(z.looseObject({ ruleidentifier: opt(64) }))
    .max(100)
    .optional(),
};

const RecordObject = z.looseObject({ errorcode: opt(16), ...Fields });

const ResponseObject = z.looseObject({
  errorcode: z.string().max(16),
  ...Fields,
  found: opt(16),
  records: z.array(RecordObject).max(1000).optional(),
});

const ResponseArray = z.array(ResponseObject).max(100);

const Envelope = z.looseObject({
  requestreference: opt(64),
  version: opt(16),
  secrand: opt(64),
  response: ResponseArray.optional(),
  responses: ResponseArray.optional(),
});

const JwtPayload = z.looseObject({
  iat: z.number().optional(),
  aud: opt(256),
  payload: Envelope,
});

const FormFields = z.record(
  z.string().max(256),
  z.union([z.string().max(100_000), z.array(z.string().max(100_000)).max(100)]),
);

type RecordFields = z.infer<typeof RecordObject>;
type EnvelopeValue = z.infer<typeof Envelope>;

type Item = {
  value: RecordFields;
  path: string;
  /** Set for records returned inside a TRANSACTIONQUERY response. */
  query?: { found?: string };
};

export type TrustPaymentsParsed =
  | {
      kind: "response";
      variant: "raw" | "library" | "jwt" | "object";
      items: Item[];
      requestReference?: string;
      jwtIssuedAt?: number;
    }
  | {
      kind: "form";
      variant: "notification" | "redirect";
      fields: Record<string, string | string[]>;
    };

// ---------------------------------------------------------------------------
// Detection

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Form data arrives as strings, or string arrays for repeated keys. */
function isFlatStrings(o: Record<string, unknown>): boolean {
  return Object.values(o).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

function formTransport(meta: RecordMeta | undefined): boolean {
  if (!meta) return true;
  if (meta.format === "form") return true;
  if (meta.format === "http") return !(meta.http?.contentType ?? "").includes("json");
  return false;
}

function jsonTransport(meta: RecordMeta | undefined): boolean {
  if (!meta) return true;
  if (meta.format === "form") return false;
  if (meta.format === "http") return !(meta.http?.contentType ?? "").includes("form");
  return true;
}

// Documented examples look like `23-9-80006`; the field itself is documented
// as alphanumeric with hyphens, up to 25 characters.
const TX_STRICT = /^\d{1,8}-\d{1,8}-\d{1,12}$/;
const TX_LOOSE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+){2,}$/;
const CODE_SHAPE = /^\d{1,5}$/;
const HEX64 = /^[0-9a-f]{64}$/i;

function txShape(v: unknown): "strict" | "loose" | null {
  if (typeof v !== "string" || v.length > 25) return null;
  if (TX_STRICT.test(v)) return "strict";
  return TX_LOOSE.test(v) ? "loose" : null;
}

const txBonus = (shape: "strict" | "loose" | null) =>
  shape === "strict" ? 0.15 : shape === "loose" ? 0.1 : 0;

/** Field names from the AUTH response specification that are distinctive together. */
const VOCAB = [
  "errormessage",
  "settlestatus",
  "settleduedate",
  "accounttypedescription",
  "baseamount",
  "currencyiso3a",
  "livestatus",
  "transactionstartedtimestamp",
  "parenttransactionreference",
  "paymenttypedescription",
  "issuercountryiso2a",
  "securityresponseaddress",
  "securityresponsepostcode",
  "securityresponsesecuritycode",
  "acquirerresponsecode",
  "authcode",
];

type Signals = {
  code: boolean;
  rt: boolean;
  rtKnown: boolean;
  tx: "strict" | "loose" | null;
  vocab: number;
};

function signals(el: Record<string, unknown>): Signals {
  const rt = typeof el.requesttypedescription === "string" ? el.requesttypedescription : undefined;
  return {
    code: typeof el.errorcode === "string" && CODE_SHAPE.test(el.errorcode.trim()),
    rt: rt !== undefined,
    rtKnown: rt !== undefined && lookup(REQUEST_TYPES, rt) !== undefined,
    tx: txShape(el.transactionreference),
    vocab: VOCAB.filter((k) => typeof el[k] === "string").length,
  };
}

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function responseArray(env: Record<string, unknown>): { key: string; arr: unknown[] } | undefined {
  if (Array.isArray(env.response)) return { key: "response", arr: env.response };
  if (Array.isArray(env.responses)) return { key: "responses", arr: env.responses };
  return undefined;
}

/** Scores a `{ requestreference, version, response[] | responses[], secrand }` envelope. */
function envelopeScore(env: Record<string, unknown>): { score: number; reasons: string[] } | null {
  const found = responseArray(env);
  if (!found) return null;
  const sigs = found.arr.filter(isObj).map(signals);
  if (!sigs.some((s) => s.code && (s.rt || s.tx))) return null;
  let score = 0.3;
  const reasons = [
    `has a ${found.key} array whose objects carry errorcode with requesttypedescription or transactionreference`,
  ];
  if (sigs.some((s) => s.rtKnown)) {
    score += 0.15;
    reasons.push("requesttypedescription is a documented request type");
  }
  const tx = sigs.some((s) => s.tx === "strict")
    ? "strict"
    : sigs.some((s) => s.tx)
      ? "loose"
      : null;
  if (tx) {
    score += txBonus(tx);
    reasons.push("transactionreference has the documented hyphenated shape");
  }
  const vocab = Math.max(0, ...sigs.map((s) => s.vocab));
  if (vocab > 0) {
    score += Math.min(0.2, 0.05 * vocab);
    reasons.push(`${vocab} further documented response field name(s)`);
  }
  if (typeof env.requestreference === "string") {
    score += 0.1;
    reasons.push("has requestreference");
  }
  if (typeof env.secrand === "string") {
    score += 0.1;
    reasons.push("has secrand");
  }
  if (env.version === "1.00") score += 0.05;
  return { score, reasons };
}

const VERSION_UNSUPPORTED =
  "Only version 1.00 of the Trust Payments JSON Webservices API is documented; this envelope declares another version and is not analyzed.";

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
  // Stripe payloads carry `object`; Trust Payments payloads never do.
  if ("object" in input) return none;

  if (formTransport(meta) && isFlatStrings(input)) {
    const form = detectForm(input);
    if (form) return { ...base, ...form };
  }
  if (!jsonTransport(meta)) return none;

  const env = envelopeScore(input);
  if (env) {
    const supported = input.version === undefined || input.version === "1.00";
    return {
      ...base,
      format: TRUST_PAYMENTS_FORMATS.envelope,
      confidence: round(env.score),
      supported,
      reasons: env.reasons,
      ...(supported ? {} : { unsupportedReason: VERSION_UNSUPPORTED }),
    };
  }

  if (isObj(input.payload)) {
    const inner = envelopeScore(input.payload);
    if (inner) {
      const reasons = [
        "payload holds a response envelope, like a decoded response JWT",
        ...inner.reasons,
      ];
      let score = inner.score;
      if (typeof input.iat === "number") score += 0.05;
      if (typeof input.aud === "string") score += 0.05;
      const version = input.payload.version;
      const supported = version === undefined || version === "1.00";
      return {
        ...base,
        format: TRUST_PAYMENTS_FORMATS.jwt,
        confidence: round(score),
        supported,
        reasons,
        ...(supported ? {} : { unsupportedReason: VERSION_UNSUPPORTED }),
      };
    }
  }

  if (Array.isArray(input.request)) {
    const reqs = input.request.filter(isObj);
    const typed = reqs.some(
      (r) =>
        typeof r.requesttypedescription === "string" || Array.isArray(r.requesttypedescriptions),
    );
    if (typed) {
      let score = 0.5;
      const reasons = ["has a request array with requesttypedescription(s)"];
      if (typeof input.alias === "string") {
        score += 0.2;
        reasons.push("has alias");
      }
      if (typeof input.version === "string") score += 0.1;
      if (reqs.some((r) => typeof r.sitereference === "string")) score += 0.1;
      return {
        ...base,
        format: TRUST_PAYMENTS_FORMATS.request,
        confidence: round(score),
        supported: false,
        reasons,
        unsupportedReason:
          "This looks like a Trust Payments Webservices request, which can contain card data and credentials. Requests are not analyzed; paste the response instead.",
      };
    }
  }

  const s = signals(input);
  if (s.code && s.rtKnown) {
    let score = 0.45 + txBonus(s.tx) + Math.min(0.25, 0.05 * s.vocab);
    const reasons = ["has errorcode and a documented requesttypedescription"];
    if (s.tx) reasons.push("transactionreference has the documented hyphenated shape");
    if (s.vocab) reasons.push(`${s.vocab} further documented response field name(s)`);
    if (Array.isArray(input.records)) score += 0.05;
    return {
      ...base,
      format: TRUST_PAYMENTS_FORMATS.object,
      confidence: round(score),
      supported: true,
      reasons,
    };
  }
  return none;
}

function one(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : undefined;
}

const FORM_EXTRAS = [
  "baseamount",
  "currencyiso3a",
  "sitereference",
  "orderreference",
  "requestreference",
  "paymenttypedescription",
  "accounttypedescription",
];

function detectForm(input: Record<string, unknown>): Omit<DetectionResult, "provider"> | null {
  const s = (k: string) => one(input[k]);
  const has = (k: string) => Object.hasOwn(input, k);
  const sig = s("responsesitesecurity");
  const extras = Math.min(0.1, 0.02 * FORM_EXTRAS.filter(has).length);
  const settleKnown = lookup(SETTLE_STATUSES, s("settlestatus")) !== undefined;
  const rtKnown = lookup(REQUEST_TYPES, s("requesttypedescription")) !== undefined;
  const codeOk = CODE_SHAPE.test(s("errorcode") ?? "");
  const tx = txShape(s("transactionreference"));

  if (has("notificationreference")) {
    let c = 0.35;
    const reasons = ["has notificationreference"];
    if (sig !== undefined) {
      c += HEX64.test(sig) ? 0.3 : 0.1;
      reasons.push(
        HEX64.test(sig)
          ? "responsesitesecurity has the length of a SHA-256 hex hash"
          : "has responsesitesecurity",
      );
    }
    if (tx) {
      c += txBonus(tx);
      reasons.push("transactionreference has the documented hyphenated shape");
    }
    if (codeOk) c += 0.05;
    if (settleKnown) c += 0.05;
    if (rtKnown) c += 0.05;
    c += extras;
    return {
      format: TRUST_PAYMENTS_FORMATS.notification,
      confidence: round(c),
      supported: true,
      reasons,
      ...(c < 0.5
        ? {
            unsupportedReason:
              "The record has notificationreference but too few other Trust Payments notification fields to attribute it reliably. Select the provider manually if it is a Trust Payments URL notification.",
          }
        : {}),
    };
  }

  if (codeOk && has("settlestatus") && tx) {
    let c = 0.5;
    const reasons = [
      "has errorcode, settlestatus and a hyphenated transactionreference, the minimum Payment Pages redirect fields",
    ];
    if (sig !== undefined && HEX64.test(sig)) {
      c += 0.2;
      reasons.push("responsesitesecurity has the length of a SHA-256 hex hash");
    }
    if (settleKnown) c += 0.05;
    if (rtKnown) c += 0.05;
    c += extras;
    return {
      format: TRUST_PAYMENTS_FORMATS.redirect,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parsing

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const p = [prefix, i.path.join(".")].filter(Boolean).join(".");
    return `${p || "(root)"}: ${i.message}`;
  });
}

function itemsOf(env: EnvelopeValue, prefix: string): { key: string; items: Item[] } | undefined {
  const key =
    env.response !== undefined ? "response" : env.responses !== undefined ? "responses" : undefined;
  const arr = env.response ?? env.responses;
  if (!key || !arr) return undefined;
  const items: Item[] = [];
  arr.forEach((el, i) => items.push(...expand(el, `${prefix}${key}[${i}]`)));
  return { key, items };
}

/** A TRANSACTIONQUERY response is represented by its records. */
function expand(el: z.infer<typeof ResponseObject>, path: string): Item[] {
  const records = el.records ?? [];
  const query = el.requesttypedescription === "TRANSACTIONQUERY";
  if (!query || records.length === 0 || el.errorcode.trim() !== "0") return [{ value: el, path }];
  const found = el.found !== undefined ? { found: el.found } : {};
  return records.map((r, j) => ({ value: r, path: `${path}.records[${j}]`, query: found }));
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: TrustPaymentsParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected an object"] };

  if (format === TRUST_PAYMENTS_FORMATS.envelope) {
    const r = Envelope.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const found = itemsOf(r.data, "");
    if (!found) return { ok: false, issues: ["response: required (or responses)"] };
    const ref = safeId(r.data.requestreference, 64);
    return {
      ok: true,
      value: {
        kind: "response",
        variant: found.key === "responses" ? "library" : "raw",
        items: found.items,
        ...(ref ? { requestReference: ref } : {}),
      },
    };
  }
  if (format === TRUST_PAYMENTS_FORMATS.jwt) {
    const r = JwtPayload.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const found = itemsOf(r.data.payload, "payload.");
    if (!found) return { ok: false, issues: ["payload.response: required (or responses)"] };
    const ref = safeId(r.data.payload.requestreference, 64);
    return {
      ok: true,
      value: {
        kind: "response",
        variant: "jwt",
        items: found.items,
        ...(ref ? { requestReference: ref } : {}),
        ...(r.data.iat !== undefined ? { jwtIssuedAt: r.data.iat } : {}),
      },
    };
  }
  if (format === TRUST_PAYMENTS_FORMATS.object) {
    const r = ResponseObject.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "response", variant: "object", items: expand(r.data, "") } };
  }
  if (
    format === TRUST_PAYMENTS_FORMATS.notification ||
    format === TRUST_PAYMENTS_FORMATS.redirect
  ) {
    const r = FormFields.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const f = r.data;
    const need =
      format === TRUST_PAYMENTS_FORMATS.notification
        ? ["notificationreference"]
        : ["errorcode", "settlestatus", "transactionreference"];
    const missing = need.filter((k) => !one(f[k]));
    if (missing.length) return { ok: false, issues: missing.map((k) => `${k}: required`) };
    return {
      ok: true,
      value: {
        kind: "form",
        variant: format === TRUST_PAYMENTS_FORMATS.notification ? "notification" : "redirect",
        fields: f,
      },
    };
  }
  return { ok: false, issues: [`Unsupported Trust Payments format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Code decoding

export type CodeDecoding = {
  code: string;
  /** Documented part of the error list the code was found in; null when unknown. */
  family: CodeFamily | null;
  entry: CodeEntry | undefined;
  confidence: Confidence;
  missing: string[];
  documentation: DocumentationLink[];
};

const LIST_DOCS: DocumentationLink[] = [
  { title: "Trust Payments error codes (full list)", url: ERROR_CODES_URL },
  { title: "Trust Payments error codes", url: ERROR_CODES_HELP_URL },
];

/** Decodes an `errorcode` value. `0` (success) is not an error and returns no entry. */
export function decodeTrustPaymentsCode(raw: string): CodeDecoding {
  const code = raw.trim();
  const entry =
    lookup(GATEWAY_CODES, code) ??
    lookup(CLIENT_LIBRARY_CODES, code) ??
    lookup(INVALID_PROCESS_CODES, code) ??
    lookup(PORTAL_CODES, code);
  if (!entry) {
    return {
      code,
      family: null,
      entry: undefined,
      confidence: "insufficient",
      missing: [
        `Error code "${safeText(code, 40) ?? ""}" is not on the Trust Payments error code list known to PandaPayLens.`,
      ],
      documentation: [...LIST_DOCS],
    };
  }
  const missing = entry.note ? [entry.note] : [];
  const documentation = [...LIST_DOCS];
  if (entry.family === "client_library")
    documentation.push({ title: "Trust Payments Python client library", url: CLIENT_LIBRARY_URL });
  const extra = CODE_DOCS[code];
  if (extra) documentation.push(extra);
  return {
    code,
    family: entry.family,
    entry,
    confidence: entry.confidence,
    missing,
    documentation,
  };
}

const CODE_DOCS: Record<string, DocumentationLink> = {
  "70000": { title: "How do I handle declined transactions?", url: DECLINES_URL },
  "71000": { title: "71000 soft decline", url: SOFT_DECLINE_URL },
  "22000": { title: "Handling 3DS API responses", url: THREEDS_HANDLING_URL },
  "60031": { title: "Handling 3DS API responses", url: THREEDS_HANDLING_URL },
  "60022": { title: "Handling 3DS API responses", url: THREEDS_HANDLING_URL },
  "20004": { title: "TRANSACTIONUPDATE", url: TRANSACTIONUPDATE_URL },
  "50000": { title: "JSON Web Token", url: JWT_URL },
};

// ---------------------------------------------------------------------------
// Interpretation shared by responses, records, notifications and redirects

type Get = (key: string) => string | undefined;

type Interpretation = {
  requestType?: string;
  requestTypeKnown: boolean;
  stage: LifecycleStage;
  outcome: Outcome;
  code?: string;
  decoded?: CodeDecoding;
  isRecurring?: boolean;
  flags: Record<string, SafePrimitive>;
};

const REQUEST_LEVEL = new Set(["invalid_request", "configuration"]);

const isSchemeStop = (
  rt: string | undefined,
  code: string | undefined,
  settle: string | undefined,
) => rt === "SCHEMEUPDATE" && code === "70000" && settle === "3";

/** Generic meaning of a settle status when the request type is not known. */
function settleOutcome(settle: string | undefined): Outcome {
  if (settle === "100") return "success";
  if (settle === "3") return "failure";
  if (settle === "0" || settle === "1" || settle === "2" || settle === "10") return "pending";
  return "unknown";
}

function interpret(get: Get): Interpretation {
  const rawRt = get("requesttypedescription");
  const rtInfo = lookup(REQUEST_TYPES, rawRt);
  const rt = rtInfo ? rawRt : undefined;
  const account = get("accounttypedescription");
  const code = get("errorcode")?.trim();
  const settle = get("settlestatus")?.trim();
  const flags: Record<string, SafePrimitive> = {};

  let stage: LifecycleStage = rtInfo?.stage ?? "other";
  if (rt === "REFUND" && account === "CFT") stage = "payout";
  // A RECUR AUTH is a merchant- or engine-initiated rebill: a payment of its own.
  if (rt === "AUTH" && account === "RECUR") stage = "payment";
  const isRecurring = rt === "AUTH" && account !== undefined ? account === "RECUR" : undefined;

  const base = {
    ...(rawRt !== undefined ? { requestType: rawRt } : {}),
    requestTypeKnown: Boolean(rtInfo),
    ...(isRecurring !== undefined ? { isRecurring } : {}),
    flags,
  };

  if (isSchemeStop(rt, code, settle)) {
    flags.recurringStoppedByCardholder = true;
    return {
      ...base,
      stage: "cancellation",
      outcome: "success",
      code: "70000",
      decoded: decodeTrustPaymentsCode("70000"),
    };
  }

  if (code !== undefined && code !== "" && code !== "0") {
    const decoded = decodeTrustPaymentsCode(code);
    const entry = decoded.entry;
    let outcome: Outcome = "unknown";
    if (entry?.effect === "failure") outcome = "failure";
    else if (entry?.effect === "pending") outcome = "pending";
    if (entry?.effect === "informational") flags.threeDsBypassed = true;
    if (
      entry &&
      entry.effect === "failure" &&
      (entry.family === "portal" || REQUEST_LEVEL.has(entry.category))
    )
      stage = "error";
    return { ...base, stage, outcome, code, decoded };
  }

  if (code !== "0") {
    // No errorcode at all (possible in merchant-configured notifications).
    return { ...base, stage, outcome: settleOutcome(settle) };
  }

  const ok = { ...base, code };
  switch (rt) {
    case "AUTH": {
      if (settle === "100") return { ...ok, stage: "settlement", outcome: "success" };
      if (settle === "3") {
        flags.cancelledBeforeSettlement = true;
        return { ...ok, stage: "cancellation", outcome: "success" };
      }
      if (settle === "10") {
        if (get("redirecturl") !== undefined) return { ...ok, stage, outcome: "pending" };
        return { ...ok, stage: "settlement", outcome: "pending" };
      }
      if (settle === "2") return { ...ok, stage, outcome: "pending" };
      if (settle === undefined || settle === "0" || settle === "1")
        return { ...ok, stage, outcome: "success" };
      return { ...ok, stage, outcome: "unknown" };
    }
    case "REFUND":
      if (settle === "3") flags.cancelledBeforeSettlement = true;
      // A refund or payout request is complete only once settled.
      return { ...ok, stage, outcome: settle === undefined ? "pending" : settleOutcome(settle) };
    case "SCHEMEUPDATE":
      return { ...ok, stage, outcome: settleOutcome(settle) };
    case "THREEDQUERY":
    case "THREEDRESULT": {
      const st = lookup(THREEDS_STATUSES, get("status"));
      return { ...ok, stage, outcome: st?.outcome ?? "unknown" };
    }
    case "THREEDLOOKUP":
      return { ...ok, stage, outcome: "pending" };
    case "ERROR":
      return { ...ok, stage, outcome: "unknown" };
    case undefined:
      return { ...ok, stage, outcome: settleOutcome(settle) };
    default:
      return { ...ok, stage, outcome: "success" };
  }
}

// ---------------------------------------------------------------------------
// Normalization

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function attrs(entries: [string, unknown][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

const txRef = (v: unknown) => safeId(v, 64);

const TP_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * `YYYY-MM-DD hh:mm:ss` with no documented time zone. Read as UTC so the
 * result does not depend on the machine running the analysis.
 */
function tpTimestamp(v: string | undefined): string | undefined {
  const m = v ? TP_TIMESTAMP.exec(v.trim()) : null;
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) || d.toISOString() !== iso ? undefined : iso;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function described(table: Record<string, string>, v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const meaning = lookup(table, v);
  return meaning ? `${v} (${meaning})` : safeText(v, 16);
}

function signatureClass(sig: string | undefined): string {
  if (sig === undefined || sig === "") return "absent";
  return HEX64.test(sig) ? "present_sha256_length" : "present_other";
}

function shortCode(v: string | undefined, max = 32): string | undefined {
  return v !== undefined && /^[0-9A-Za-z_ .-]{1,64}$/.test(v) ? safeText(v, max) : undefined;
}

function ruleIds(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = v
    .map((r) => (isObj(r) ? safeId(r.ruleidentifier, 32) : undefined))
    .filter((x): x is string => Boolean(x));
  return ids.length ? ids : undefined;
}

function commonAttributes(get: Get, it: Interpretation): [string, unknown][] {
  const settle = get("settlestatus");
  const settleInfo = lookup(SETTLE_STATUSES, settle);
  const advice = get("acquireradvicecode");
  const adviceInfo = lookup(ADVICE_CODES, advice);
  const threeDs = get("status");
  const threeDsInfo = lookup(THREEDS_STATUSES, threeDs);
  const enrolled = get("enrolled");
  const account = get("accounttypedescription");
  const mcc = get("merchantcategorycode");
  const live = get("livestatus");
  const authcode = get("authcode");
  const due = get("settleduedate");
  const subscriptionState = get("active") ?? get("transactionactive");
  const shield = get("fraudcontrolshieldstatuscode");
  const country = get("issuercountryiso2a");
  const settledAt = tpTimestamp(get("settledtimestamp"));
  return [
    ["requestType", it.requestType !== undefined ? safeText(it.requestType, 32) : undefined],
    ["accountType", account !== undefined ? safeText(account, 32) : undefined],
    [
      "accountTypeKnown",
      account !== undefined ? lookup(ACCOUNT_TYPES, account) !== undefined : undefined,
    ],
    ["errorcode", it.code !== undefined ? safeText(it.code, 16) : undefined],
    ["codeFamily", it.decoded?.family ?? undefined],
    ["settleStatus", settle !== undefined ? safeText(settle, 8) : undefined],
    ["settleStatusLabel", settleInfo?.label],
    ["settleDueDate", due !== undefined && DATE_ONLY.test(due) ? due : undefined],
    ["settledAt", settledAt],
    ["settleBaseAmount", minorUnits(get("settlebaseamount"))],
    ["liveStatus", live === "0" ? "test" : live === "1" ? "live" : undefined],
    ["paymentType", shortCode(get("paymenttypedescription"))],
    ["walletSource", shortCode(get("walletsource"))],
    ["acquirerResponseCode", shortCode(get("acquirerresponsecode"))],
    ["acquirerResponseMessage", safeText(get("acquirerresponsemessage"), 120)],
    ["schemeResponseCode", shortCode(get("schemeresponsecode"), 8)],
    ["acquirerAdviceCode", advice !== undefined ? shortCode(advice, 8) : undefined],
    ["acquirerAdviceMeaning", adviceInfo?.meaning],
    ["securityResponseAddress", described(SECURITY_RESPONSES, get("securityresponseaddress"))],
    ["securityResponsePostcode", described(SECURITY_RESPONSES, get("securityresponsepostcode"))],
    [
      "securityResponseSecurityCode",
      described(SECURITY_RESPONSES, get("securityresponsesecuritycode")),
    ],
    ["threeDsEnrolled", enrolled !== undefined ? described(THREEDS_ENROLLED, enrolled) : undefined],
    ["threeDsStatus", threeDsInfo ? `${threeDs} (${threeDsInfo.meaning})` : undefined],
    ["threeDsVersion", shortCode(get("threedversion"), 16)],
    ["issuerCountry", country !== undefined && /^[A-Z]{2}$/.test(country) ? country : undefined],
    ["authMethod", shortCode(get("authmethod"), 16)],
    ["credentialsOnFile", shortCode(get("credentialsonfile"), 4)],
    ["initiationReason", shortCode(get("initiationreason"), 4)],
    ["scaExemptionIndicator", shortCode(get("scaexemptionindicator"), 4)],
    ["subscriptionType", shortCode(get("subscriptiontype"), 16)],
    ["subscriptionUnit", shortCode(get("subscriptionunit"), 16)],
    ["subscriptionFrequency", shortCode(get("subscriptionfrequency"), 8)],
    ["subscriptionNumber", shortCode(get("subscriptionnumber"), 8)],
    ["subscriptionFinalNumber", shortCode(get("subscriptionfinalnumber"), 8)],
    ["subscriptionBeginDate", shortCode(get("subscriptionbegindate"), 16)],
    ["subscriptionState", described(SUBSCRIPTION_STATES, subscriptionState)],
    ["fraudRating", shortCode(get("fraudrating"), 8)],
    ["interface", shortCode(get("interface"), 32)],
    [
      "fraudControlShieldStatus",
      shield !== undefined && SHIELD_STATUSES.includes(shield) ? shield : undefined,
    ],
    ["fraudControlResponseCode", shortCode(get("fraudcontrolresponsecode"), 8)],
    ["customerOutput", shortCode(get("customeroutput"), 32)],
    ["tokenisedPayment", shortCode(get("tokenisedpayment"), 4)],
    ["dccEnabled", shortCode(get("dccenabled"), 4)],
    ["merchantCategoryCode", mcc !== undefined && /^\d{4}$/.test(mcc) ? mcc : undefined],
    [
      "payoutVertical",
      it.stage === "payout" && mcc !== undefined ? lookup(PAYOUT_MCC, mcc) : undefined,
    ],
    [
      "offlineRefund",
      authcode !== undefined && OFFLINE_REFUND_AUTHCODES.includes(authcode) ? true : undefined,
    ],
    // Only the presence of APM redirect data is kept: the URL carries session data.
    ["apmRedirect", get("redirecturl") !== undefined ? true : undefined],
    ...Object.entries(it.flags),
  ];
}

function eventTimestamp(get: Get): { ts?: string; zoneNote: boolean } {
  const settled = get("settlestatus") === "100" ? tpTimestamp(get("settledtimestamp")) : undefined;
  const ts = settled ?? tpTimestamp(get("transactionstartedtimestamp"));
  return ts ? { ts, zoneNote: true } : { zoneNote: false };
}

function providerStatus(it: Interpretation, settle: string | undefined): string {
  const parts: string[] = [];
  if (it.code !== undefined) parts.push(`errorcode=${safeText(it.code, 16) ?? ""}`);
  if (settle !== undefined) {
    const label = lookup(SETTLE_STATUSES, settle)?.label;
    parts.push(`settlestatus=${safeText(settle, 8) ?? ""}${label ? ` (${label})` : ""}`);
  }
  return parts.join("; ") || "no errorcode or settlestatus";
}

function itemGetter(value: Record<string, unknown>): Get {
  return (k) => {
    const v = value[k];
    return typeof v === "string" ? v : undefined;
  };
}

function formGetter(fields: Record<string, string | string[]>): Get {
  return (k) => one(fields[k]);
}

function normalizeItem(
  parsed: Extract<TrustPaymentsParsed, { kind: "response" }>,
  item: Item,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const get = itemGetter(item.value);
  const it = interpret(get);
  const tx = txRef(get("transactionreference"));
  const { ts, zoneNote } = eventTimestamp(get);
  const rt = it.requestType !== undefined ? safeText(it.requestType, 32) : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: rt ?? "response",
    eventTypeKnown: it.requestTypeKnown,
    stage: it.stage,
    providerStatus: providerStatus(it, get("settlestatus")),
    paymentReference: tx,
    relatedReference: txRef(get("parenttransactionreference")),
    merchantReference: merchantRef(get("orderreference")),
    subscriptionReference: it.requestType === "SUBSCRIPTION" ? tx : undefined,
    isRecurring: it.isRecurring,
    eventTimestamp: ts,
    amountMinor: minorUnits(get("baseamount")),
    currency: upperCurrency(get("currencyiso3a")),
    outcome: it.outcome,
    attributes: attrs([
      ["envelope", parsed.variant],
      ["requestReference", parsed.requestReference],
      [
        "jwtIssuedAt",
        parsed.jwtIssuedAt !== undefined && Number.isInteger(parsed.jwtIssuedAt)
          ? parsed.jwtIssuedAt
          : undefined,
      ],
      ["transactionQueryRecord", item.query ? true : undefined],
      ["queryFound", item.query?.found !== undefined ? shortCode(item.query.found, 8) : undefined],
      ...commonAttributes(get, it),
      ["rules", ruleIds(item.value.rules)],
      ["timestampTimeZone", zoneNote ? "not_documented_read_as_utc" : undefined],
    ]),
    source: { recordIndex: ctx.recordIndex, path: item.path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function presentInference(get: Get): string[] {
  return ["requesttypedescription", "accounttypedescription", "errorcode", "settlestatus"].filter(
    (k) => get(k) !== undefined,
  );
}

function normalizeForm(
  parsed: Extract<TrustPaymentsParsed, { kind: "form" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const get = formGetter(parsed.fields);
  const it = interpret(get);
  const notification = parsed.variant === "notification";
  const ref = notification ? safeId(get("notificationreference"), 64) : undefined;
  const { ts, zoneNote } = eventTimestamp(get);
  const prefix = notification ? "notification" : "redirect";
  const rt = it.requestType !== undefined ? safeText(it.requestType, 32) : undefined;
  // Field names are untrusted too: only plain lowercase names are listed.
  const repeated = Object.entries(parsed.fields)
    .filter(([k, v]) => Array.isArray(v) && /^[a-z][a-z0-9_]{0,63}$/.test(k))
    .map(([k]) => k);
  return clean({
    sourceFormat: ctx.format,
    eventType: rt ? `${prefix}.${rt}` : prefix,
    eventTypeKnown: it.requestTypeKnown,
    stage: it.stage,
    providerStatus: providerStatus(it, get("settlestatus")),
    eventReference: ref,
    // Trust Payments resends a notification with the same notificationreference.
    deliveryKey: ref,
    paymentReference: txRef(get("transactionreference")),
    relatedReference: txRef(get("parenttransactionreference")),
    merchantReference: merchantRef(get("orderreference")),
    subscriptionReference:
      it.requestType === "SUBSCRIPTION" ? txRef(get("transactionreference")) : undefined,
    isRecurring: it.isRecurring,
    eventTimestamp: ts,
    amountMinor: minorUnits(get("baseamount")),
    currency: upperCurrency(get("currencyiso3a")),
    outcome: it.outcome,
    attributes: attrs([
      // Notifications have no event-type field: the event is always inferred.
      ["eventInferred", true],
      ["inferredFrom", presentInference(get)],
      ["browserRedirect", notification ? undefined : true],
      ["requestReference", safeId(get("requestreference"), 64)],
      ["signature", signatureClass(get("responsesitesecurity"))],
      ["signatureVerified", false],
      ...commonAttributes(get, it),
      ["repeatedFields", repeated.length ? repeated : undefined],
      ["timestampTimeZone", zoneNote ? "not_documented_read_as_utc" : undefined],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: TrustPaymentsParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "form") return [normalizeForm(parsed, ctx)];
  return parsed.items.map((item) => normalizeItem(parsed, item, ctx));
}

// ---------------------------------------------------------------------------
// Error decoding

const UNKNOWN_ENTRY_TEXT = "PandaPayLens does not recognize this Trust Payments error code.";

function errorDraft(get: Get, ctx: NormalizeContext, path: string): DecodedErrorDraft | undefined {
  const code = get("errorcode")?.trim();
  if (code === undefined || code === "" || code === "0") return undefined;
  const rt = get("requesttypedescription");
  const account = get("accounttypedescription");
  const settle = get("settlestatus");
  const tx = txRef(get("transactionreference"));
  const d = decodeTrustPaymentsCode(code);
  const entry = d.entry;
  const missing = [...d.missing];
  const documentation = [...d.documentation];
  const shown = safeText(code, 16) ?? "";

  let category = entry?.category ?? "unknown";
  let retry = entry?.retry ?? "unknown";
  let confidence = d.confidence;
  let explanation = entry
    ? `Trust Payments errorcode ${shown}: ${entry.meaning}.`
    : UNKNOWN_ENTRY_TEXT;
  let nextAction = entry?.advice ?? NEXT_ACTION[category];
  const retryParts: string[] = [];

  const subCodes: Record<string, string> = {};
  if (d.family) subCodes.family = d.family;
  const put = (k: string, v: string | undefined, max = 32) => {
    const s = v !== undefined ? safeText(v, max) : undefined;
    if (s) subCodes[k] = s;
  };
  put("requesttypedescription", rt);
  put("accounttypedescription", account);
  put("settlestatus", settle, 8);
  put("acquirerresponsecode", shortCode(get("acquirerresponsecode")));
  put("schemeresponsecode", shortCode(get("schemeresponsecode"), 8), 8);

  const errordata = get("errordata");
  if (errordata !== undefined) {
    put("errordata", errordata, 100);
    explanation += ` errordata: ${safeText(errordata, 100) ?? ""}.`;
  }

  if (isSchemeStop(rt, code, settle)) {
    category = "card_declined";
    retry = "do_not_retry";
    confidence = "strong";
    explanation =
      "Trust Payments errorcode 70000 on a SCHEMEUPDATE with settle status 3: the cardholder asked to stop recurring payments.";
    nextAction =
      "Stop the recurring payments for this card and contact the customer if the service should continue.";
    retryParts.push("Further recurring charges on this card should not be attempted.");
    documentation.push({ title: "SCHEMEUPDATE", url: SCHEMEUPDATE_URL });
    // The decline-reason note does not apply: the payload states the reason.
    missing.splice(0, missing.length);
  }

  const effect = entry?.effect;
  if (effect === "pending")
    retryParts.push(
      "The request is still being processed; sending it again could duplicate it. Query the transaction later.",
    );
  if (effect === "informational") {
    retryParts.push(
      "No retry is needed: the 3-D Secure step was bypassed and the payment may continue, but without liability shift.",
    );
  }
  if (entry?.advice && effect !== "informational") retryParts.push(entry.advice);

  const advice = get("acquireradvicecode");
  if (advice !== undefined) {
    put("acquireradvicecode", advice, 8);
    const a = lookup(ADVICE_CODES, advice);
    documentation.push({ title: "Acquirer advice code mapping", url: ADVICE_CODES_URL });
    if (!a)
      missing.push(
        `Acquirer advice code "${safeText(advice, 8) ?? ""}" is not in the documented mapping.`,
      );
    else {
      explanation += ` Acquirer advice code ${advice}${a.mastercard ? " (Mastercard)" : ""}: ${a.meaning}.`;
      // Advice only refines the guidance for a known decline; it never makes
      // an unknown outcome look safe to retry.
      if (a.retry && effect === "failure") {
        retry = a.retry;
        retryParts.push(`Acquirer advice code ${advice}: ${a.meaning}.`);
      }
    }
  }

  if (account === "RECUR" && effect === "failure" && rt === "AUTH") {
    retryParts.push(
      "Trust Payments: after a declined recurring payment, Mastercard rules say the request must not be retried more than once per day for the next 31 days.",
    );
    documentation.push({ title: "Recurring payments", url: RECURRING_URL });
  }
  if (rt === "REFUND" && account === "CFT")
    documentation.push({ title: "Payouts with Webservices API", url: PAYOUTS_URL });

  if (code === "70000" && !isSchemeStop(rt, code, settle)) {
    const acq = shortCode(get("acquirerresponsecode"));
    if (acq)
      explanation += ` The acquirer returned acquirerresponsecode ${acq}; Trust Payments does not publish what acquirer codes mean.`;
  }
  if (rt === "ERROR")
    explanation += " requesttypedescription is ERROR: the request may not have been processed.";
  if (!tx)
    missing.push("No transactionreference; the transaction cannot be looked up from this record.");

  retryParts.push(RETRY_TEXT[retry]);
  if (!documentation.some((x) => x.url === CHECKS_URL))
    documentation.push({ title: "Checks to perform following payment", url: CHECKS_URL });

  const providerMessage = safeText(get("errormessage"), 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    code: shown,
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction,
    retry,
    retryExplanation: [...new Set(retryParts)].join(" "),
    confidence,
    documentation,
    missingInformation: missing,
    ...(tx ? { paymentReference: tx, attemptReference: tx } : {}),
    ...(effect === "failure" || effect === "informational" ? { outcomeKnown: true } : {}),
  };
}

function decodeErrors(parsed: TrustPaymentsParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "form") {
    const draft = errorDraft(formGetter(parsed.fields), ctx, "");
    if (!draft) return [];
    if (parsed.variant === "notification") {
      draft.documentation.push({ title: "URL notification", url: URL_NOTIFICATION_ACTION_URL });
      if (draft.subCodes.requesttypedescription === undefined)
        draft.missingInformation.push(
          "The notification does not include requesttypedescription, so the operation this error belongs to is unknown.",
        );
    }
    return [draft];
  }
  return parsed.items
    .map((item) => {
      const draft = errorDraft(itemGetter(item.value), ctx, item.path);
      if (draft && item.value.errordata !== undefined && Array.isArray(item.value.errordata)) {
        const list = item.value.errordata.map((x) => safeText(x, 64) ?? "").filter(Boolean);
        if (list.length) {
          draft.subCodes.errordata = list.join(", ");
          draft.explanation += ` errordata: ${list.join(", ")}.`;
        }
      }
      return draft;
    })
    .filter((d): d is DecodedErrorDraft => Boolean(d));
}

export const trustPaymentsAdapter: ProviderAdapter<TrustPaymentsParsed> = {
  id: PROVIDER,
  displayName: "Trust Payments",
  version: TRUST_PAYMENTS_ADAPTER_VERSION,
  manifest: trustPaymentsManifest,
  supportedFormats: [
    {
      id: TRUST_PAYMENTS_FORMATS.envelope,
      description:
        "Webservices API JSON response envelope (response[] or responses[]), including TRANSACTIONQUERY records",
    },
    {
      id: TRUST_PAYMENTS_FORMATS.jwt,
      description: "Decoded response JWT payload ({ iat, payload: { response[] }, aud })",
    },
    {
      id: TRUST_PAYMENTS_FORMATS.object,
      description:
        "One Webservices response object (errorcode, requesttypedescription, transactionreference)",
    },
    {
      id: TRUST_PAYMENTS_FORMATS.notification,
      description: "URL notification (form-encoded, notificationreference, responsesitesecurity)",
    },
    {
      id: TRUST_PAYMENTS_FORMATS.redirect,
      description: "Payment Pages redirect fields (errorcode, settlestatus, transactionreference)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transactionreference is unique per request and parenttransactionreference
    // names the request a child inherited from. orderreference and
    // requestreference are not business keys and are never used.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default trustPaymentsAdapter;
