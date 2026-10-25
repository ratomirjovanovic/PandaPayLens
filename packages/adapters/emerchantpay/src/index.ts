/**
 * emerchantpay adapter (Genesis gateway, API version 61.1).
 *
 * Supported input families:
 * - `emerchantpay.notification`             processing notification (form-encoded), incl. dispute events
 * - `emerchantpay.wpf.notification`         WPF notification (form-encoded)
 * - `emerchantpay.payment_response.xml`     XML document with root payment_response (Processing API,
 *                                           reconcile and Smart Routing responses), also as an HTTP body
 * - `emerchantpay.payment_response.object`  JSON object with the documented payment_response fields
 *
 * Recognized but not supported:
 * - `emerchantpay.xml`                      other Genesis XML roots (wpf_payment, notification_echo,
 *                                           reconcile, payment_transaction, blacklist_response), and
 *                                           Genesis XML inside a JSON string
 * - `emerchantpay.apm_external_event`       APM external event notification
 *
 * Detection is structural only. The same Genesis payloads are produced by
 * other Genesis instances, so a match means "Genesis platform".
 */

import {
  minorUnits,
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
  AVS_LETTER_MEANINGS,
  AVS_RESULT_LETTERS,
  AVS_SINGLE_CODES,
  AVS_SOURCE_PREFIXES,
  CRYPTOGRAM_RESULTS,
  CVV_RESULTS,
  DISPUTE_EVENTS,
  FAMILY_DOCS,
  GATEWAY_CODES,
  GATEWAY_RANGES,
  GATEWAY_SUCCESS_CODES,
  NEXT_ACTION,
  NOTIFICATIONS_DOC,
  RECURRING_ADVICE,
  RECURRING_ADVICE_DOC,
  RETRY_EXPLANATION,
  SCHEME_CODES,
  SDK_GATEWAY_CODES,
  SDK_SCHEME_CODES,
  THREEDS_REASON_DOC,
  THREEDS_REASONS,
  THREEDS_RESERVED_RANGE,
  TRANSACTION_STATES,
  TRANSACTION_TYPES,
  WPF_STATES,
  XML_ROOTS,
  type AdviceEntry,
  type CatalogEntry,
  type CodeFamily,
  type StateInfo,
} from "./catalog.js";
import { emerchantpayManifest, EMERCHANTPAY_ADAPTER_VERSION } from "./manifest.js";

export { emerchantpayManifest, EMERCHANTPAY_ADAPTER_VERSION };

export const EMERCHANTPAY_FORMATS = {
  notification: "emerchantpay.notification",
  wpfNotification: "emerchantpay.wpf.notification",
  paymentResponse: "emerchantpay.payment_response.object",
  paymentResponseXml: "emerchantpay.payment_response.xml",
  xml: "emerchantpay.xml",
  apmExternalEvent: "emerchantpay.apm_external_event",
} as const;

const opt = (max: number) => z.string().max(max).optional();
const scalar = (max: number) => z.union([z.string().max(max), z.number()]).optional();

/** Optional result and advice fields shared by responses and notifications. */
const resultFields = {
  scheme_response_code: opt(8),
  recurring_advice_code: opt(8),
  recurring_advice_text: opt(500),
  threeds_authentication_status_reason_code: opt(8),
  avs_response_code: opt(8),
  cvv_result_code: opt(8),
  cryptogram_result: opt(8),
  eci: opt(8),
};

const Notification = z.looseObject({
  unique_id: z.string().min(1).max(64),
  transaction_type: z.string().min(1).max(64),
  status: z.string().min(1).max(64),
  transaction_id: opt(255),
  terminal_token: opt(256),
  amount: opt(32),
  signature: opt(512),
  error_code: opt(16),
  error_message: opt(2000),
  technical_message: opt(2000),
  event: opt(64),
  chargeback_unique_id: opt(64),
  reference_transaction_unique_id: opt(64),
  rc_code: opt(32),
  rc_description: opt(2000),
  ...resultFields,
});

const WpfNotification = z.looseObject({
  wpf_unique_id: z.string().min(1).max(64),
  wpf_status: z.string().min(1).max(64),
  notification_type: opt(32),
  wpf_transaction_id: opt(255),
  payment_transaction_unique_id: opt(64),
  payment_transaction_transaction_type: opt(64),
  payment_transaction_terminal_token: opt(256),
  payment_transaction_amount: opt(32),
  signature: opt(512),
});

const PaymentResponse = z.looseObject({
  transaction_type: z.string().min(1).max(64),
  status: z.string().min(1).max(64),
  unique_id: opt(64),
  transaction_id: opt(255),
  mode: opt(16),
  code: scalar(16),
  technical_message: opt(2000),
  message: opt(2000),
  response_code: opt(8),
  timestamp: opt(64),
  amount: scalar(32),
  currency: opt(8),
  sent_to_acquirer: z.union([z.string().max(8), z.boolean()]).optional(),
  redirect_url: opt(4096),
  ...resultFields,
});

type NotificationValue = z.infer<typeof Notification>;
type WpfNotificationValue = z.infer<typeof WpfNotification>;
type PaymentResponseValue = z.infer<typeof PaymentResponse>;

export type EmerchantpayParsed =
  | { kind: "notification"; value: NotificationValue; repeatedKeysCollapsed: boolean }
  | { kind: "wpf_notification"; value: WpfNotificationValue; repeatedKeysCollapsed: boolean }
  | {
      kind: "payment_response";
      value: PaymentResponseValue;
      /** A JSON `{ "payment_response": {...} }` wrapper (not the XML root element). */
      wrapped: boolean;
      /** Read from an XML document with root payment_response. */
      xml: boolean;
    };

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Own-property lookup, so codes like "toString" never hit the prototype. */
function get<T>(table: Readonly<Record<string, T>>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
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
  if (meta.format === "json" || meta.format === "jsonl") return true;
  if (meta.format === "http") return (meta.http?.contentType ?? "json").includes("json");
  return false;
}

const SIGNATURE_HEX = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/i;
const UNIQUE_ID_HEX = /^[0-9a-f]{32}$/;
const GATEWAY_CODE = /^\d{3}$/;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

// ---------------------------------------------------------------------------
// Detection

/** Children of a payment_response or payment_transaction that identify a Genesis transaction. */
const TRANSACTION_CHILDREN = ["transaction_type", "unique_id", "transaction_id", "status"];

/**
 * Structural check of a Genesis XML root and its child element names: each
 * root needs documented children before it is attributed to Genesis.
 */
function xmlRootMatch(
  root: string,
  children: readonly string[],
): { confidence: number; reasons: string[] } | null {
  const what = get(XML_ROOTS, root);
  if (!what) return null;
  const has = (c: string) => children.includes(c);
  const contains = (found: string[]) => `contains ${found.map((c) => `<${c}>`).join(", ")}`;
  const reasons = [`XML root <${root}> (${what})`];
  if (root === "payment_response" || root === "payment_transaction") {
    const found = TRANSACTION_CHILDREN.filter(has);
    if (found.length < 2) return null;
    return { confidence: 0.8, reasons: [...reasons, contains(found)] };
  }
  if (root === "notification_echo" || root === "wpf_payment") {
    const found = ["unique_id", "wpf_unique_id"].filter(has);
    if (!found.length) return null;
    return { confidence: 0.75, reasons: [...reasons, contains(found)] };
  }
  if (root === "reconcile") {
    const found = ["unique_id", "transaction_id"].filter(has);
    if (!found.length) return null;
    return { confidence: 0.6, reasons: [...reasons, contains(found)] };
  }
  if (root === "blacklist_response") {
    // Error responses of other Genesis APIs carry code and message under their own root.
    if (!has("code") || !has("message")) return null;
    return { confidence: 0.6, reasons: [...reasons, contains(["code", "message"])] };
  }
  return null;
}

/** Why a recognized Genesis XML document is not analyzed, by root element. */
const XML_UNSUPPORTED: Record<string, string> = {
  payment_response:
    "This Genesis payment_response XML lacks the fields needed to analyze it: transaction_type and status, with unique_id or with code and technical_message.",
  wpf_payment:
    "This is Genesis WPF create or reconcile XML (wpf_payment). It is recognized but not analyzed, because the PandaPayLens research does not record its fields. Paste the WPF notification, or the payment_response of the payment inside it, instead.",
  notification_echo:
    "This is a notification_echo, the acknowledgement a merchant returns for a Genesis notification. It carries no payment result, so there is nothing to analyze.",
  reconcile:
    "This is a Genesis reconcile request, not a response. Paste the payment_response XML that reconcile returns instead.",
  payment_transaction:
    "This is a Genesis Processing API request (payment_transaction), which may contain card data. It is not analyzed; paste the payment_response XML instead.",
  blacklist_response:
    "This is a Genesis blacklist API response. It is recognized but not analyzed, because that API is outside the scope of the PandaPayLens research.",
};

/** Genesis XML pasted inside a JSON string: recognized, but the string is not read as XML. */
function detectXmlString(input: string): DetectionResult | null {
  const text = input
    .trimStart()
    .replace(/^<\?xml[^>]{0,200}\?>\s*/, "")
    .slice(0, 4096);
  const m = /^<([a-z_]+)[\s>]/.exec(text);
  if (!m) return null;
  const root = m[1]!;
  const children = [...text.matchAll(/<([a-z_]+)>/g)].map((x) => x[1]!).filter((c) => c !== root);
  const match = xmlRootMatch(root, children);
  if (!match) return null;
  return {
    provider: "emerchantpay",
    format: EMERCHANTPAY_FORMATS.xml,
    confidence: match.confidence,
    supported: false,
    reasons: [`text starts with the Genesis ${match.reasons[0]!}`, ...match.reasons.slice(1)],
    unsupportedReason:
      "This is Genesis XML inside a JSON string, which is not read as XML. Paste the XML document itself, or the raw HTTP response, instead.",
  };
}

/** A parsed XML document: `{ <root>: {...} }` with string values. */
function detectXmlRecord(
  input: Record<string, unknown>,
  xml: NonNullable<RecordMeta["xml"]>,
): DetectionResult | null {
  // Genesis XML is documented without a namespace.
  if (xml.namespace !== undefined) return null;
  const root = xml.root;
  const body = Object.hasOwn(input, root) ? input[root] : undefined;
  if (!isObj(body)) return null;
  if (root === "payment_response") {
    const found = detectPaymentResponse(input, "xml");
    if (found) return found;
  }
  const match = xmlRootMatch(root, Object.keys(body));
  if (!match) return null;
  return {
    provider: "emerchantpay",
    format: EMERCHANTPAY_FORMATS.xml,
    confidence: match.confidence,
    supported: false,
    reasons: [`document has the Genesis ${match.reasons[0]!}`, ...match.reasons.slice(1)],
    unsupportedReason: get(XML_UNSUPPORTED, root) ?? "This Genesis XML is not analyzed.",
  };
}

function detectNotification(input: Record<string, unknown>): DetectionResult | null {
  const has = (k: string) => Object.hasOwn(input, k);
  const s = (k: string) => str(input[k]);
  if (!has("unique_id") || !has("transaction_type") || !has("status")) return null;
  let c = 0.3;
  const reasons = [
    "has unique_id, transaction_type and status like a Genesis processing notification",
  ];
  const hasToken = has("terminal_token");
  const hasSig = has("signature");
  if (hasToken) {
    c += 0.2;
    reasons.push("has terminal_token");
  }
  if (hasSig) {
    c += 0.15;
    if (SIGNATURE_HEX.test(s("signature") ?? "")) {
      c += 0.1;
      reasons.push("signature has the length of a SHA-1, SHA-256 or SHA-512 hex digest");
    } else reasons.push("has signature");
  }
  if (has("transaction_id")) c += 0.05;
  const status = s("status") ?? "";
  if (get(TRANSACTION_STATES, status) || get(WPF_STATES, status)) {
    c += 0.1;
    reasons.push(`status "${safeText(status, 32) ?? ""}" is a documented transaction state`);
  }
  if (UNIQUE_ID_HEX.test(s("unique_id") ?? "")) c += 0.05;
  if (GATEWAY_CODE.test(s("error_code") ?? "") && has("technical_message")) {
    c += 0.05;
    reasons.push("has a three-digit error_code with technical_message");
  }
  if (!hasToken && !hasSig) {
    // These three fields alone are too generic to claim the record.
    return {
      provider: "emerchantpay",
      format: EMERCHANTPAY_FORMATS.notification,
      confidence: Math.min(round(c), 0.45),
      supported: true,
      reasons,
      unsupportedReason:
        "The record has some Genesis notification fields but neither terminal_token nor signature, so it cannot be attributed to the Genesis platform reliably. Select the provider manually if it is an emerchantpay notification.",
    };
  }
  return {
    provider: "emerchantpay",
    format: EMERCHANTPAY_FORMATS.notification,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectWpf(input: Record<string, unknown>): DetectionResult | null {
  const has = (k: string) => Object.hasOwn(input, k);
  if (!has("wpf_unique_id") || !has("wpf_status")) return null;
  let c = 0.35;
  const reasons = ["has wpf_unique_id and wpf_status like a Genesis WPF notification"];
  if (str(input.notification_type) === "wpf") {
    c += 0.25;
    reasons.push("notification_type is wpf");
  }
  if (has("payment_transaction_unique_id")) {
    c += 0.1;
    reasons.push("has payment_transaction_unique_id");
  }
  if (has("payment_transaction_terminal_token") || has("payment_transaction_transaction_type"))
    c += 0.1;
  if (SIGNATURE_HEX.test(str(input.signature) ?? "")) {
    c += 0.15;
    reasons.push("signature has the length of a SHA-1, SHA-256 or SHA-512 hex digest");
  }
  if (get(WPF_STATES, str(input.wpf_status))) c += 0.05;
  return {
    provider: "emerchantpay",
    format: EMERCHANTPAY_FORMATS.wpfNotification,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectApmEvent(input: Record<string, unknown>): DetectionResult | null {
  if (str(input.notification_type) !== "apm_external_event") return null;
  if (!Object.hasOwn(input, "payment_transaction_unique_id")) return null;
  let c = 0.6;
  const reasons = [
    "notification_type is apm_external_event with payment_transaction_unique_id, like a Genesis APM external event notification",
  ];
  for (const k of ["category", "priority", "code", "signature"])
    if (Object.hasOwn(input, k)) c += 0.05;
  return {
    provider: "emerchantpay",
    format: EMERCHANTPAY_FORMATS.apmExternalEvent,
    confidence: round(c),
    supported: false,
    reasons,
    unsupportedReason:
      "This looks like a Genesis APM external event notification. It is recognized but not analyzed, because its category and code values are not documented in the PandaPayLens research.",
  };
}

/** A `{ "payment_response": {...} }` wrapper, as produced by XML-to-JSON converters. */
function unwrapResponse(input: Record<string, unknown>): {
  value: Record<string, unknown>;
  wrapped: boolean;
} {
  const keys = Object.keys(input);
  if (keys.length === 1 && keys[0] === "payment_response" && isObj(input.payment_response))
    return { value: input.payment_response, wrapped: true };
  return { value: input, wrapped: false };
}

function detectPaymentResponse(
  input: Record<string, unknown>,
  source: "json" | "xml",
): DetectionResult | null {
  const { value: o, wrapped } = unwrapResponse(input);
  if (source === "xml" && !wrapped) return null;
  const has = (k: string) => Object.hasOwn(o, k);
  const scalarField = (k: string) =>
    typeof o[k] === "string" || typeof o[k] === "number" || typeof o[k] === "boolean";
  if (!scalarField("transaction_type") || !scalarField("status")) return null;
  const code = o.code === undefined ? undefined : String(o.code);
  const identified = scalarField("unique_id") || (code !== undefined && has("technical_message"));
  if (!identified) return null;
  let c = 0.3;
  const reasons = [
    source === "xml"
      ? "XML root <payment_response> with transaction_type and status, like a Genesis Processing API or reconcile response"
      : wrapped
        ? "payment_response object with transaction_type and status"
        : "has transaction_type and status with unique_id or code and technical_message, like a Genesis payment_response",
  ];
  // The root element name is the documented wire format; a JSON wrapper mirrors it.
  if (wrapped) c += 0.2;
  const markers = ["mode", "sent_to_acquirer"].filter(has);
  if (o.mode === "test" || o.mode === "live") {
    c += 0.15;
    reasons.push(`mode is ${o.mode}`);
  }
  if (has("sent_to_acquirer")) {
    c += 0.2;
    reasons.push("has sent_to_acquirer");
  }
  if (typeof o.unique_id === "string" && UNIQUE_ID_HEX.test(o.unique_id)) c += 0.05;
  if (get(TRANSACTION_STATES, typeof o.status === "string" ? o.status : undefined)) c += 0.1;
  if (has("technical_message") && has("message")) c += 0.05;
  if (code !== undefined && GATEWAY_CODE.test(code)) c += 0.05;
  const format =
    source === "xml"
      ? EMERCHANTPAY_FORMATS.paymentResponseXml
      : EMERCHANTPAY_FORMATS.paymentResponse;
  if (markers.length === 0 && !wrapped) {
    return {
      provider: "emerchantpay",
      format,
      confidence: Math.min(round(c), 0.45),
      supported: true,
      reasons,
      unsupportedReason:
        "The object has some Genesis payment_response fields but neither mode nor sent_to_acquirer, so it cannot be attributed to the Genesis platform reliably. Select the provider manually if it is an emerchantpay response.",
    };
  }
  return {
    provider: "emerchantpay",
    format,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "emerchantpay",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (typeof input === "string") return detectXmlString(input) ?? none;
  if (!isObj(input)) return none;
  // An XML document (or XML HTTP body) is only read as Genesis XML.
  if (meta?.xml) return detectXmlRecord(input, meta.xml) ?? none;

  if (formTransport(meta) && isFlatStrings(input)) {
    const found = detectApmEvent(input) ?? detectWpf(input) ?? detectNotification(input);
    if (found) return found;
  }
  if (jsonTransport(meta)) {
    const found = detectPaymentResponse(input, "json");
    if (found) return found;
  }
  return none;
}

// ---------------------------------------------------------------------------
// Parsing

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

/** Repeated form keys with one value are collapsed; conflicting values are an issue. */
function collapse(input: Record<string, unknown>): {
  value: Record<string, unknown>;
  collapsed: boolean;
  issues: string[];
} {
  const value: Record<string, unknown> = {};
  const issues: string[] = [];
  let collapsed = false;
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      if (new Set(v).size === 1) {
        value[k] = v[0];
        collapsed = true;
      } else {
        issues.push(`${k}: repeated with different values`);
        value[k] = v;
      }
    } else value[k] = v;
  }
  return { value, collapsed, issues };
}

const INTEGER = /^\d{1,30}$/;

function parse(
  input: unknown,
  format: string,
): { ok: true; value: EmerchantpayParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected an object of fields"] };

  if (
    format === EMERCHANTPAY_FORMATS.notification ||
    format === EMERCHANTPAY_FORMATS.wpfNotification
  ) {
    const { value, collapsed, issues } = collapse(input);
    if (issues.length) return { ok: false, issues };
    if (format === EMERCHANTPAY_FORMATS.notification) {
      const r = Notification.safeParse(value);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      if (r.data.amount !== undefined && r.data.amount !== "" && !INTEGER.test(r.data.amount))
        return { ok: false, issues: ["amount: expected an integer amount in minor units"] };
      return {
        ok: true,
        value: { kind: "notification", value: r.data, repeatedKeysCollapsed: collapsed },
      };
    }
    const r = WpfNotification.safeParse(value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const amount = r.data.payment_transaction_amount;
    if (amount !== undefined && amount !== "" && !INTEGER.test(amount))
      return {
        ok: false,
        issues: ["payment_transaction_amount: expected an integer amount in minor units"],
      };
    return {
      ok: true,
      value: { kind: "wpf_notification", value: r.data, repeatedKeysCollapsed: collapsed },
    };
  }

  if (
    format === EMERCHANTPAY_FORMATS.paymentResponse ||
    format === EMERCHANTPAY_FORMATS.paymentResponseXml
  ) {
    const xml = format === EMERCHANTPAY_FORMATS.paymentResponseXml;
    const { value, wrapped } = unwrapResponse(input);
    if (xml && !wrapped)
      return { ok: false, issues: ["(root): expected an XML document with root payment_response"] };
    const r = PaymentResponse.safeParse(value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    // XML values are text; amount is documented as an integer in minor units.
    const amount = r.data.amount;
    if (amount !== undefined && amount !== "" && minorUnits(amount) === undefined)
      return { ok: false, issues: ["amount: expected an integer amount in minor units"] };
    return {
      ok: true,
      value: { kind: "payment_response", value: r.data, wrapped: wrapped && !xml, xml },
    };
  }

  return { ok: false, issues: [`Unsupported emerchantpay format "${format}".`] };
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
};

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Code not in the PandaPayLens emerchantpay catalog",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens does not recognize this Genesis code.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

function decoding(
  code: string,
  family: CodeFamily,
  entry: CatalogEntry,
  confidence: Confidence,
  missing: string[] = [],
): CodeDecoding {
  return { code, family, entry, confidence, missing, documentation: [...FAMILY_DOCS[family]] };
}

export function isGatewaySuccessCode(raw: string): boolean {
  return (GATEWAY_SUCCESS_CODES as readonly string[]).includes(raw.trim());
}

/** Decodes a gateway error code (`code` in responses, `error_code` in notifications). */
export function decodeGatewayCode(raw: string): CodeDecoding {
  const code = raw.trim();
  const shown = safeText(code, 16) ?? "";
  const documented = get(GATEWAY_CODES, code);
  if (documented) return decoding(code, "gateway", documented, "strong");
  const sdk = get(SDK_GATEWAY_CODES, code);
  if (sdk)
    return decoding(code, "gateway_sdk", sdk, "possible", [
      `Code "${shown}" appears only in the official Genesis PHP SDK, not in the API reference error table.`,
    ]);
  if (GATEWAY_CODE.test(code)) {
    const n = Number(code);
    const range = GATEWAY_RANGES.find((r) => n >= r.from && n <= r.to);
    if (range)
      return decoding(code, "gateway_range", range.entry, "possible", [
        `Code "${shown}" is not in the documented error table; it is decoded by its documented range group (${range.group}).`,
      ]);
  }
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [`Code "${shown}" is not a Genesis gateway error code known to PandaPayLens.`],
    documentation: [...FAMILY_DOCS.gateway],
  };
}

export type SchemeDecoding = CodeDecoding & { success: boolean };

/** Decodes a card scheme response code (`scheme_response_code`). */
export function decodeSchemeCode(raw: string): SchemeDecoding {
  const code = raw.trim().toUpperCase();
  const shown = safeText(code, 8) ?? "";
  const scheme = get(SCHEME_CODES, code);
  if (scheme) {
    const missing = scheme.conflict
      ? [
          `The Visa and Mastercard tables give different meanings for "${shown}", and no documented field identifies the card brand.`,
        ]
      : [];
    return {
      ...decoding(code, "scheme", scheme, scheme.conflict ? "possible" : "strong", missing),
      success: Boolean(scheme.success),
    };
  }
  const sdk = get(SDK_SCHEME_CODES, code);
  if (sdk)
    return {
      ...decoding(code, "scheme_sdk", sdk, "possible", [
        `Issuer code "${shown}" appears only in the official Genesis PHP SDK, not in the API reference scheme tables.`,
      ]),
      success: false,
    };
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [
      `Scheme response code "${shown}" is not in the documented Visa or Mastercard tables.`,
    ],
    documentation: [...FAMILY_DOCS.scheme],
    success: false,
  };
}

export function describeRecurringAdvice(raw: string): AdviceEntry | undefined {
  const code = raw.trim();
  return get(RECURRING_ADVICE, code) ?? get(RECURRING_ADVICE, code.padStart(2, "0"));
}

/** 3DS authentication status reason, including the EMVCo reserved range. */
export function describeThreedsReason(raw: string): { meaning: string; known: boolean } {
  const code = raw.trim().padStart(2, "0");
  const r = get(THREEDS_REASONS, code);
  if (r) return { meaning: r.meaning, known: true };
  if (/^\d{2}$/.test(code)) {
    const n = Number(code);
    if (n >= THREEDS_RESERVED_RANGE.from && n <= THREEDS_RESERVED_RANGE.to)
      return { meaning: "reserved by EMVCo", known: true };
  }
  return { meaning: "not in the documented list", known: false };
}

/** AVS result: a single letter `A`-`J`, or a source prefix (2 or 5) plus a result letter. */
export function describeAvs(raw: string): {
  known: boolean;
  source?: string;
  meaning?: string;
} {
  const code = raw.trim().toUpperCase();
  if (code.length === 1) return { known: (AVS_SINGLE_CODES as readonly string[]).includes(code) };
  if (code.length === 2) {
    const source = get(AVS_SOURCE_PREFIXES, code[0]);
    const letter = code[1]!;
    if (source && (AVS_RESULT_LETTERS as readonly string[]).includes(letter)) {
      const meaning = get(AVS_LETTER_MEANINGS, letter);
      return { known: true, source, ...(meaning ? { meaning } : {}) };
    }
  }
  return { known: false };
}

// ---------------------------------------------------------------------------
// Normalization

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

function attrs(values: Record<string, SafePrimitive | undefined>): Record<string, SafePrimitive> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Record<
    string,
    SafePrimitive
  >;
}

function signatureClass(sig: string | undefined): string {
  if (sig === undefined || sig === "") return "absent";
  if (/^[0-9a-f]{40}$/i.test(sig)) return "present_sha1_length";
  if (/^[0-9a-f]{64}$/i.test(sig)) return "present_sha256_length";
  if (/^[0-9a-f]{128}$/i.test(sig)) return "present_sha512_length";
  return "present_other";
}

const nonEmpty = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : undefined;
};

const REQUEST_LEVEL = new Set(["invalid_request", "configuration", "duplicate_request"]);

/** The gateway code of a record, when it is an error (not empty, not a success code). */
function errorCodeOf(v: string | number | undefined): string | undefined {
  const code = v === undefined ? undefined : nonEmpty(String(v));
  return code !== undefined && !isGatewaySuccessCode(code) ? code : undefined;
}

function stateOf(status: string): StateInfo | undefined {
  // `chargeback_reversal` is the WPF spelling of `chargeback_reversed`.
  return get(TRANSACTION_STATES, status) ?? get(WPF_STATES, status);
}

/**
 * Outcome of a transaction status. `error` is a failure unless the gateway
 * code says the outcome is unknown (for example an issuer timeout).
 */
function outcomeOf(info: StateInfo | undefined, status: string, code: string | undefined): Outcome {
  if (!info) return "unknown";
  if ((status === "error" || status === "declined") && code !== undefined) {
    if (decodeGatewayCode(code).entry.outcomeUncertain) return "unknown";
  }
  return info.outcome;
}

function stageOf(
  info: StateInfo | undefined,
  status: string,
  code: string | undefined,
  typeStage: LifecycleStage | undefined,
): LifecycleStage {
  if (info?.stage) return info.stage;
  if (status === "error" && code !== undefined) {
    const d = decodeGatewayCode(code);
    // Gateway-side request rejections (as opposed to declines) are shown as errors.
    if (d.family !== null && REQUEST_LEVEL.has(d.entry.category)) return "error";
  }
  return typeStage ?? "other";
}

/** Informational verification results, kept as attributes. */
function verificationAttrs(v: {
  avs_response_code?: string | undefined;
  cvv_result_code?: string | undefined;
  cryptogram_result?: string | undefined;
  threeds_authentication_status_reason_code?: string | undefined;
  eci?: string | undefined;
  recurring_advice_code?: string | undefined;
  scheme_response_code?: string | undefined;
}): Record<string, SafePrimitive | undefined> {
  const avs = nonEmpty(v.avs_response_code);
  const avsInfo = avs ? describeAvs(avs) : undefined;
  const cvv = nonEmpty(v.cvv_result_code)?.toUpperCase();
  const crypto = nonEmpty(v.cryptogram_result);
  const threeds = nonEmpty(v.threeds_authentication_status_reason_code);
  const advice = nonEmpty(v.recurring_advice_code);
  return {
    schemeResponseCode: safeText(nonEmpty(v.scheme_response_code), 8),
    recurringAdviceCode: safeText(advice, 8),
    recurringAdvice: advice ? describeRecurringAdvice(advice)?.meaning : undefined,
    avsResponseCode: safeText(avs, 8),
    avsSource: avsInfo?.source,
    avsResult: avsInfo?.meaning,
    cvvResultCode: safeText(cvv, 8),
    cvvResult: cvv ? get(CVV_RESULTS, cvv) : undefined,
    cryptogramResult: crypto ? (get(CRYPTOGRAM_RESULTS, crypto) ?? safeText(crypto, 8)) : undefined,
    threedsStatusReasonCode: safeText(threeds, 8),
    threedsStatusReason: threeds ? describeThreedsReason(threeds).meaning : undefined,
    eci: safeText(nonEmpty(v.eci), 8),
  };
}

const INSTANCE_NOTE =
  "Genesis platform; the operating instance is not identifiable from the payload";

function normalizeNotification(
  parsed: Extract<EmerchantpayParsed, { kind: "notification" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const n = parsed.value;
  const status = n.status.trim();
  const type = n.transaction_type.trim();
  const event = nonEmpty(n.event);
  const typeInfo = get(TRANSACTION_TYPES, type);
  const eventInfo = event !== undefined ? get(DISPUTE_EVENTS, event) : undefined;
  const info = stateOf(status);
  const code = errorCodeOf(n.error_code);
  const uniqueId = safeId(n.unique_id, 64);
  const chargebackId = safeId(nonEmpty(n.chargeback_unique_id), 64);
  const safeStatus = safeText(status, 32) ?? "";
  const safeType = safeText(type, 64) ?? "";
  const safeEvent = event !== undefined ? safeText(event, 64) : undefined;

  let stage: LifecycleStage;
  let outcome: Outcome;
  if (event !== undefined) {
    // A dispute event does not show the dispute's final outcome.
    stage = eventInfo ? "dispute" : "other";
    outcome = "unknown";
  } else {
    stage = stageOf(info, status, code, typeInfo?.stage);
    outcome = outcomeOf(info, status, code);
  }

  return clean({
    sourceFormat: ctx.format,
    eventType: `notification.${(event !== undefined ? safeEvent : safeType) || "unknown"}`,
    eventTypeKnown: event !== undefined ? Boolean(eventInfo) : Boolean(typeInfo),
    stage,
    providerStatus: `status=${safeStatus}${safeEvent ? `; event=${safeEvent}` : ""}`,
    paymentReference: uniqueId,
    relatedReference: safeId(nonEmpty(n.reference_transaction_unique_id), 64),
    merchantReference: safeId(nonEmpty(n.transaction_id), 255),
    ...(typeInfo?.recurring !== undefined ? { isRecurring: typeInfo.recurring } : {}),
    // Genesis documents no event id. The research suggests unique_id + status,
    // plus event and chargeback_unique_id for dispute notifications.
    deliveryKey: uniqueId
      ? [uniqueId, safeStatus, safeEvent ?? "", chargebackId ?? ""].join("|")
      : undefined,
    amountMinor: minorUnits(nonEmpty(n.amount)),
    outcome,
    attributes: attrs({
      transactionType: safeType,
      status: safeStatus,
      statusKnown: Boolean(info),
      event: safeEvent,
      chargebackUniqueId: chargebackId,
      errorCode: safeText(code, 16),
      codeFamily: code !== undefined ? (decodeGatewayCode(code).family ?? undefined) : undefined,
      rcCode: safeText(nonEmpty(n.rc_code), 32),
      ...verificationAttrs(n),
      signature: signatureClass(n.signature),
      signatureVerified: false,
      terminalTokenPresent: Boolean(nonEmpty(n.terminal_token)),
      amountCurrency: n.amount ? "not included in processing notifications" : undefined,
      genesisInstance: INSTANCE_NOTE,
      ...(parsed.repeatedKeysCollapsed ? { repeatedKeysCollapsed: true } : {}),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizeWpf(
  parsed: Extract<EmerchantpayParsed, { kind: "wpf_notification" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const n = parsed.value;
  const status = n.wpf_status.trim();
  const info = get(WPF_STATES, status);
  const type = nonEmpty(n.payment_transaction_transaction_type);
  const typeInfo = type !== undefined ? get(TRANSACTION_TYPES, type) : undefined;
  const wpfId = safeId(n.wpf_unique_id, 64);
  const safeStatus = safeText(status, 32) ?? "";
  // WPF is a hosted payment form: without an inner transaction type the
  // operation is a payment; an unknown inner type stays `other`.
  const typeStage: LifecycleStage = type === undefined ? "payment" : (typeInfo?.stage ?? "other");
  return clean({
    sourceFormat: ctx.format,
    eventType: "wpf_notification",
    eventTypeKnown: true,
    stage: info?.stage ?? typeStage,
    providerStatus: `wpf_status=${safeStatus}`,
    paymentReference: safeId(nonEmpty(n.payment_transaction_unique_id), 64) ?? wpfId,
    relatedReference: wpfId,
    merchantReference: safeId(nonEmpty(n.wpf_transaction_id), 255),
    ...(typeInfo?.recurring !== undefined ? { isRecurring: typeInfo.recurring } : {}),
    deliveryKey: wpfId ? `wpf|${wpfId}|${safeStatus}` : undefined,
    amountMinor: minorUnits(nonEmpty(n.payment_transaction_amount)),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      wpfStatus: safeStatus,
      statusKnown: Boolean(info),
      notificationType: safeText(nonEmpty(n.notification_type), 32),
      transactionType: safeText(type, 64),
      transactionTypeKnown: type !== undefined ? Boolean(typeInfo) : undefined,
      signature: signatureClass(n.signature),
      signatureVerified: false,
      terminalTokenPresent: Boolean(nonEmpty(n.payment_transaction_terminal_token)),
      genesisInstance: INSTANCE_NOTE,
      ...(parsed.repeatedKeysCollapsed ? { repeatedKeysCollapsed: true } : {}),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function sentToAcquirer(v: string | boolean | undefined): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function normalizeResponse(
  parsed: Extract<EmerchantpayParsed, { kind: "payment_response" }>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const r = parsed.value;
  const status = r.status.trim();
  const type = r.transaction_type.trim();
  const typeInfo = get(TRANSACTION_TYPES, type);
  const info = stateOf(status);
  const code = errorCodeOf(r.code);
  const safeType = safeText(type, 64) ?? "";
  const safeStatus = safeText(status, 32) ?? "";
  const currency = upperCurrency(r.currency);
  const amount = r.amount === undefined ? undefined : minorUnits(r.amount);
  const ts = r.timestamp !== undefined ? toIsoTimestamp(r.timestamp) : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `payment_response.${safeType || "unknown"}`,
    eventTypeKnown: Boolean(typeInfo),
    stage: stageOf(info, status, code, typeInfo?.stage),
    providerStatus: `status=${safeStatus}${code !== undefined ? `; code=${safeText(code, 16) ?? ""}` : ""}`,
    paymentReference: safeId(nonEmpty(r.unique_id), 64),
    merchantReference: safeId(nonEmpty(r.transaction_id), 255),
    ...(typeInfo?.recurring !== undefined ? { isRecurring: typeInfo.recurring } : {}),
    eventTimestamp: ts,
    amountMinor: amount,
    currency,
    outcome: outcomeOf(info, status, code),
    attributes: attrs({
      transactionType: safeType,
      status: safeStatus,
      statusKnown: Boolean(info),
      mode: r.mode === "test" || r.mode === "live" ? r.mode : undefined,
      code: safeText(code, 16),
      codeFamily: code !== undefined ? (decodeGatewayCode(code).family ?? undefined) : undefined,
      responseCode: safeText(nonEmpty(r.response_code), 8),
      ...verificationAttrs(r),
      sentToAcquirer: sentToAcquirer(r.sent_to_acquirer),
      // Only the presence of the redirect URL is kept: it carries a session path.
      redirectUrlPresent: r.redirect_url ? true : undefined,
      timestampUnparsed: r.timestamp && !ts ? true : undefined,
      wrappedInPaymentResponse: parsed.wrapped ? true : undefined,
      genesisInstance: INSTANCE_NOTE,
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: EmerchantpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "notification") return [normalizeNotification(parsed, ctx)];
  if (parsed.kind === "wpf_notification") return [normalizeWpf(parsed, ctx)];
  return [normalizeResponse(parsed, ctx)];
}

// ---------------------------------------------------------------------------
// Error decoding

type ErrorInput = {
  field: "code" | "error_code";
  code: string | undefined;
  status: string;
  transactionType: string;
  uniqueId: string | undefined;
  message: string | undefined;
  responseCode?: string | undefined;
  scheme: string | undefined;
  advice: string | undefined;
  threeds: string | undefined;
  cvv: string | undefined;
  avs: string | undefined;
};

/** Generic issuer declines, refined by the scheme response code when one is present. */
const GENERIC_DECLINES = new Set(["500", "501"]);

const CONFIDENCE_ORDER: Confidence[] = ["insufficient", "possible", "strong", "confirmed"];
const minConfidence = (a: Confidence, b: Confidence): Confidence =>
  CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b;

function errorDraft(e: ErrorInput, ctx: NormalizeContext): DecodedErrorDraft | null {
  const schemeDec = e.scheme !== undefined ? decodeSchemeCode(e.scheme) : undefined;
  const failed = e.status === "declined" || e.status === "error";

  let primary: CodeDecoding;
  let field: string = e.field;
  if (e.code !== undefined) primary = decodeGatewayCode(e.code);
  else if (schemeDec && !schemeDec.success && failed) {
    primary = schemeDec;
    field = "scheme_response_code";
  } else return null;

  const missing = [...primary.missing];
  const documentation = [...primary.documentation];
  const subCodes: Record<string, string> = { field, status: safeText(e.status, 32) ?? "" };
  if (primary.family) subCodes.family = primary.family;
  const tt = safeText(e.transactionType, 64);
  if (tt) subCodes.transaction_type = tt;

  let category = primary.entry.category;
  let retry = primary.entry.retry;
  let explanation = primary.entry.explanation;
  let nextAction = primary.entry.nextAction;
  let retryExplanation = primary.entry.retryExplanation;
  let confidence = primary.confidence;
  let outcomeKnown =
    primary.family === "gateway" && /^5\d\d$/.test(primary.code) && !primary.entry.outcomeUncertain;

  if (schemeDec) {
    subCodes.scheme_response_code = schemeDec.code;
    if (!schemeDec.success && schemeDec.family !== null) {
      // An answer from the card network: the attempt's outcome is known.
      subCodes.decline_code = schemeDec.code;
      outcomeKnown = true;
    }
    if (primary !== schemeDec) {
      if (schemeDec.family === null) missing.push(...schemeDec.missing);
      else {
        explanation += ` Scheme response code ${schemeDec.code}: ${schemeDec.entry.meaning}.`;
        documentation.push(...schemeDec.documentation);
        if (GENERIC_DECLINES.has(primary.code) && !schemeDec.success) {
          category = schemeDec.entry.category;
          retry = schemeDec.entry.retry;
          nextAction = schemeDec.entry.nextAction;
          retryExplanation = schemeDec.entry.retryExplanation;
          confidence = minConfidence(confidence, schemeDec.confidence);
          missing.push(...schemeDec.missing);
        }
      }
    }
  }

  const responseCode = e.responseCode !== undefined ? nonEmpty(e.responseCode) : undefined;
  if (responseCode !== undefined) {
    subCodes.response_code = safeText(responseCode, 8) ?? "";
    if (responseCode.toUpperCase() !== schemeDec?.code)
      missing.push(
        "response_code is the acquirer's result; its meaning is not documented, so it is not decoded.",
      );
  }

  if (e.advice !== undefined) {
    const a = describeRecurringAdvice(e.advice);
    subCodes.recurring_advice_code = safeText(e.advice, 8) ?? "";
    documentation.push(RECURRING_ADVICE_DOC);
    if (a) {
      // The issuer's recurring advice overrides the generic retry guidance.
      retry = a.retry;
      retryExplanation = `Recurring advice ${e.advice}: ${a.meaning}. ${
        a.retry === "do_not_retry"
          ? "Do not retry this recurring charge."
          : a.retry === "retry_conditionally"
            ? "Only retry within the timing the advice gives, and avoid repeated automatic attempts."
            : "Act on the advice before any new recurring charge."
      }`;
      explanation += ` The issuer's recurring advice is: ${a.meaning}.`;
    } else missing.push("The recurring advice code is not in the documented list.");
  }

  if (e.threeds !== undefined) {
    const t = describeThreedsReason(e.threeds);
    subCodes.threeds_authentication_status_reason_code = safeText(e.threeds, 8) ?? "";
    documentation.push(THREEDS_REASON_DOC);
    if (t.known) explanation += ` 3DS authentication status reason: ${t.meaning}.`;
    else missing.push("The 3DS authentication status reason code is not in the documented list.");
  }

  if (e.cvv !== undefined) {
    const c = get(CVV_RESULTS, e.cvv.toUpperCase());
    subCodes.cvv_result_code = safeText(e.cvv, 8) ?? "";
    if (c) explanation += ` CVV result: ${c}.`;
  }
  if (e.avs !== undefined) {
    subCodes.avs_response_code = safeText(e.avs, 8) ?? "";
    const a = describeAvs(e.avs);
    if (a.meaning) explanation += ` AVS result: ${a.meaning}.`;
  }

  if (!e.uniqueId)
    missing.push("No unique_id; the transaction cannot be reconciled from this record.");

  const providerMessage = safeText(e.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: primary.code,
    subCodes,
    category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction,
    retry,
    retryExplanation,
    confidence,
    documentation,
    missingInformation: missing,
    ...(outcomeKnown ? { outcomeKnown: true } : {}),
    ...(e.uniqueId ? { paymentReference: e.uniqueId, attemptReference: e.uniqueId } : {}),
  };
}

function decodeErrors(parsed: EmerchantpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "wpf_notification") return [];
  const v = parsed.value;
  const common = {
    status: v.status.trim(),
    transactionType: v.transaction_type.trim(),
    uniqueId: safeId(nonEmpty(v.unique_id), 64),
    scheme: nonEmpty(v.scheme_response_code),
    advice: nonEmpty(v.recurring_advice_code),
    threeds: nonEmpty(v.threeds_authentication_status_reason_code),
    cvv: nonEmpty(v.cvv_result_code),
    avs: nonEmpty(v.avs_response_code),
  };
  if (parsed.kind === "notification") {
    const n = parsed.value;
    // A dispute notification reports a chargeback, not a processing error.
    if (nonEmpty(n.event) !== undefined) return [];
    const draft = errorDraft(
      {
        ...common,
        field: "error_code",
        code: errorCodeOf(n.error_code),
        message: nonEmpty(n.technical_message) ?? nonEmpty(n.error_message),
      },
      ctx,
    );
    if (!draft) return [];
    draft.documentation.push(NOTIFICATIONS_DOC);
    return [draft];
  }
  const r = parsed.value;
  const draft = errorDraft(
    {
      ...common,
      field: "code",
      code: errorCodeOf(r.code),
      message: nonEmpty(r.technical_message) ?? nonEmpty(r.message),
      responseCode: r.response_code,
    },
    ctx,
  );
  return draft ? [draft] : [];
}

export const emerchantpayAdapter: ProviderAdapter<EmerchantpayParsed> = {
  id: "emerchantpay",
  displayName: "emerchantpay",
  version: EMERCHANTPAY_ADAPTER_VERSION,
  manifest: emerchantpayManifest,
  supportedFormats: [
    {
      id: EMERCHANTPAY_FORMATS.notification,
      description:
        "Genesis processing notification (form-encoded unique_id, transaction_type, status, terminal_token, signature), incl. dispute events",
    },
    {
      id: EMERCHANTPAY_FORMATS.wpfNotification,
      description: "Genesis WPF notification (form-encoded wpf_unique_id, wpf_status)",
    },
    {
      id: EMERCHANTPAY_FORMATS.paymentResponseXml,
      description:
        "Genesis XML response with root payment_response (Processing API, reconcile, Smart Routing), pasted as XML or as the body of an HTTP response",
    },
    {
      id: EMERCHANTPAY_FORMATS.paymentResponse,
      description: "JSON object with the documented Genesis payment_response fields",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // unique_id, reference_transaction_unique_id, wpf_unique_id and
    // payment_transaction_unique_id are gateway ids. transaction_id and
    // order_id are merchant references and are never used.
    return [...new Set([event.paymentReference, event.relatedReference])].filter((x): x is string =>
      Boolean(x),
    );
  },
};

export * from "./catalog.js";
export default emerchantpayAdapter;
