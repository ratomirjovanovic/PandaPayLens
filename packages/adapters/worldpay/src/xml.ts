/**
 * Worldpay XML: WPG (Worldwide Payment Gateway) and cnpAPI.
 *
 * WPG documents have the root `paymentService` without a namespace (DTD
 * 1.4.2). Analyzed: replies (`<reply>` with `<error>`, `<orderStatus>` or
 * `<ok>`) and order notifications (`<notify><orderStatusEvent>`). Requests
 * (`submit`, `modify`, `inquiry`, `verify`), reports and other replies are
 * recognized and reported as unsupported. WPG documents start with a DOCTYPE
 * line, which the XML reader rejects, so they must be pasted without it.
 *
 * cnpAPI documents use the namespace http://www.vantivcnp.com/schema.
 * Analyzed: `cnpOnlineResponse` with one of the card transaction responses in
 * CNP_TRANSACTION_RESPONSES. Batch files (`cnpResponse`, `batchResponse`),
 * requests and other transaction responses are recognized and reported as
 * unsupported.
 *
 * The core XML reader turns one document into one record
 * `{ <root>: { "@attr": "...", child: "text" | {...} | [...] } }` with string
 * values. Card numbers, names, addresses, email addresses, merchant codes and
 * authorisation codes in these documents are never read.
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
  type NormalizeContext,
  type NormalizedEventDraft,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import {
  CNP_CATEGORIES,
  CNP_HEADER_ERRORS_URL,
  CNP_HEADER_RESPONSES,
  CNP_NAMESPACE,
  CNP_RESPONSE_CODES,
  CNP_RESPONSE_CODES_URL,
  CNP_TRANSACTION_RESPONSES,
  CNP_XML_VALIDATION_URL,
  WPG_ERROR_CODES,
  WPG_LAST_EVENTS,
  WPG_NOTIFICATIONS_URL,
  WPG_OK_REPLIES,
  WPG_PAYMENT_PROCESS_URL,
  WPG_STANDARD_RETURN_CODES,
  WPG_TROUBLESHOOT_URL,
  WPG_USEFUL_TABLES_URL,
  XML_NEXT_ACTION,
  XML_RETRY_TEXT,
  type CnpResponseType,
} from "./catalog.js";

const PROVIDER = "worldpay";

export const WPG_FORMATS = {
  reply: "worldpay.wpg.reply",
  notification: "worldpay.wpg.notification",
  other: "worldpay.wpg",
} as const;

export const CNP_FORMATS = {
  onlineResponse: "worldpay.cnpapi.online_response",
  other: "worldpay.cnpapi",
} as const;

export const WPG_ROOT = "paymentService";
export const CNP_ONLINE_ROOT = "cnpOnlineResponse";

/** Said wherever WPG input is rejected or unsupported. */
export const DOCTYPE_HINT =
  "WPG documents begin with <!DOCTYPE paymentService ...>; PandaPayLens does not accept DOCTYPE declarations, so paste the document without that line.";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const items = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const attr = (o: Obj, name: string): string | undefined => {
  const v = o[`@${name}`];
  return typeof v === "string" ? v : undefined;
};
/** Text of an element: a plain string, or "#text" next to attributes. */
const textOf = (v: unknown): string | undefined =>
  typeof v === "string" ? v : isObj(v) && typeof v["#text"] === "string" ? v["#text"] : undefined;
/** Child element names, without attributes and text. */
const childNames = (o: Obj) => Object.keys(o).filter((k) => !k.startsWith("@") && k !== "#text");
/** Path of the i-th of n repeated elements (a single element has no index). */
const itemPath = (base: string, i: number, n: number) => (n > 1 ? `${base}[${i}]` : base);
const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6 = /\b(?:[0-9A-Fa-f]{1,4}:){3,7}[0-9A-Fa-f]{1,4}\b/g;
const MASKED_PAN = /\b\d{4,8}[*xX#.]{3,}\d{2,4}\b/g;

/**
 * Provider text (WPG error text, ISO8583ReturnCode descriptions, cnpAPI
 * messages): length-limited and scrubbed, with IP addresses and masked card
 * numbers removed as well, because WPG error messages can echo request data.
 */
export function providerText(v: unknown, max = 200): string | undefined {
  const t = safeText(typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v, max);
  return t
    ?.replace(IPV4, "[redacted]")
    .replace(IPV6, "[redacted]")
    .replace(MASKED_PAN, "[redacted]");
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

const word = (v: unknown, max = 40) =>
  typeof v === "string" && v.length <= max && /^[A-Za-z0-9_+/.-]+$/.test(v) ? v : undefined;

// ---------------------------------------------------------------------------
// Parsed shapes

export type WpgAmount = {
  value: string;
  currencyCode: string;
  exponent: string;
  debitCreditIndicator?: string;
};

export type WpgPayment = {
  path: string;
  paymentMethod?: string;
  amount?: WpgAmount;
  lastEvent?: string;
  returnCode?: string;
  returnDescription?: string;
  cvcResult?: string;
  avsResult?: string;
  authorisationIdPresent: boolean;
};

export type WpgJournal = {
  journalType?: string;
  /** YYYY-MM-DD from bookingDate; WPG dates carry no time zone. */
  bookingDate?: string;
  amounts: WpgAmount[];
};

export type WpgError = { code: string; message?: string; path: string };

export type WpgOrder = {
  orderCode: string;
  path: string;
  payments: WpgPayment[];
  error?: WpgError;
  journal?: WpgJournal;
};

export type WpgAck = { name: string; orderCode: string; amount?: WpgAmount; path: string };

export type WpgDocument = {
  message: "reply" | "notification";
  version?: string;
  orders: WpgOrder[];
  /** Reply-level error, outside any orderStatus. */
  error?: WpgError;
  acks: WpgAck[];
};

export type CnpTransaction = {
  name: string;
  path: string;
  response: string;
  message?: string;
  cnpTxnId?: string;
  orderId?: string;
  responseTime?: string;
  postDate?: string;
  authCodePresent: boolean;
  approvedAmount?: string;
};

export type CnpDocument = {
  response?: string;
  message?: string;
  version?: string;
  transactions: CnpTransaction[];
};

// ---------------------------------------------------------------------------
// Detection

function supported(format: string, confidence: number, reasons: string[]): DetectionResult {
  return { provider: PROVIDER, format, confidence: round(confidence), supported: true, reasons };
}

function unsupported(
  format: string,
  confidence: number,
  reasons: string[],
  unsupportedReason: string,
): DetectionResult {
  return {
    provider: PROVIDER,
    format,
    confidence: round(confidence),
    supported: false,
    reasons,
    unsupportedReason,
  };
}

/** A WPG `<payment>`: the DTD requires paymentMethod and amount. */
function isWpgPayment(v: unknown): boolean {
  return items(v).some(
    (p) =>
      isObj(p) && isObj(p.amount) && (p.paymentMethod !== undefined || p.lastEvent !== undefined),
  );
}

const wpgErrorCodeOf = (v: unknown) => (isObj(v) ? attr(v, "code") : undefined);

const WPG_REQUESTS: Record<string, string> = {
  submit: "an order or other submission",
  modify: "a modification request",
  inquiry: "an inquiry",
  verify: "a verification request",
};

function detectWpg(input: Obj, meta: NonNullable<RecordMeta["xml"]>): DetectionResult | null {
  if (meta.root !== WPG_ROOT || meta.namespace !== undefined) return null;
  const body = input[WPG_ROOT];
  if (!isObj(body)) return null;
  const reasons = ["XML root <paymentService> (WPG)"];
  const version = attr(body, "version");
  let base = 0.8;
  if (version !== undefined && /^1\.[0-4]$/.test(version)) {
    base += 0.1;
    reasons.push(`version ${version} is a documented paymentService DTD version`);
  }
  if (attr(body, "merchantCode") !== undefined) {
    base += 0.05;
    reasons.push("has the merchantCode attribute");
  }

  const reply = body.reply;
  if (isObj(reply)) {
    const errorCode = wpgErrorCodeOf(reply.error);
    if (errorCode !== undefined && /^\d{1,4}$/.test(errorCode)) {
      const documented = Boolean(lookup(WPG_ERROR_CODES, errorCode));
      return supported(WPG_FORMATS.reply, documented ? base : base - 0.05, [
        ...reasons,
        documented
          ? "<reply> carries <error> with a documented WPG error code"
          : "<reply> carries <error> with a numeric code",
      ]);
    }
    const statuses = items(reply.orderStatus).filter(isObj);
    if (statuses.length && statuses.every((s) => attr(s, "orderCode") !== undefined)) {
      const analyzable = statuses.some(
        (s) => isWpgPayment(s.payment) || /^\d{1,4}$/.test(wpgErrorCodeOf(s.error) ?? ""),
      );
      if (analyzable)
        return supported(WPG_FORMATS.reply, base, [
          ...reasons,
          "<reply> has <orderStatus orderCode> with <payment> or <error>",
        ]);
      return unsupported(
        WPG_FORMATS.other,
        base - 0.1,
        [...reasons, "<reply> has <orderStatus orderCode> without <payment> or <error>"],
        "This WPG orderStatus carries neither a payment nor an error (for example a 3DS challenge, a redirect reference or an authentication result). It is recognized but not analyzed.",
      );
    }
    const ok = reply.ok;
    if (isObj(ok)) {
      const acks = childNames(ok).filter(
        (k) => /Received$/.test(k) && isObj(ok[k]) && attr(ok[k] as Obj, "orderCode") !== undefined,
      );
      if (acks.length)
        return supported(WPG_FORMATS.reply, base - 0.05, [
          ...reasons,
          "<reply><ok> acknowledges a modification with orderCode",
        ]);
    }
    return unsupported(
      WPG_FORMATS.other,
      base - 0.1,
      [...reasons, "has <reply>"],
      "This WPG reply is recognized but not analyzed. PandaPayLens reads replies with <error>, <orderStatus> (payment or error) and <ok> modification acknowledgements; batch status, token, address check and other replies are not analyzed.",
    );
  }

  const notify = body.notify;
  if (isObj(notify)) {
    const ev = notify.orderStatusEvent;
    if (isObj(ev) && attr(ev, "orderCode") !== undefined && isWpgPayment(ev.payment)) {
      return supported(WPG_FORMATS.notification, base, [
        ...reasons,
        "<notify><orderStatusEvent orderCode> with <payment>",
      ]);
    }
    return unsupported(
      WPG_FORMATS.other,
      base - 0.1,
      [...reasons, "has <notify>"],
      notify.report !== undefined
        ? "This is a WPG order or transfer report (<notify><report>). Reports are recognized but not analyzed; paste the order notification (orderStatusEvent) instead."
        : "This WPG notification has no orderStatusEvent with a payment, so it is not analyzed.",
    );
  }

  for (const [name, what] of Object.entries(WPG_REQUESTS)) {
    if (body[name] !== undefined)
      return unsupported(
        WPG_FORMATS.other,
        base - 0.1,
        [...reasons, `has <${name}> (${what})`],
        "This is a WPG request, which may contain card and shopper data. Requests are not analyzed; paste the reply or the order notification instead.",
      );
  }
  return null;
}

const CNP_BATCH_ROOTS = new Set(["cnpResponse", "batchResponse"]);
const CNP_REQUEST_ROOTS = new Set(["cnpOnlineRequest", "cnpRequest", "batchRequest"]);

function detectCnp(input: Obj, meta: NonNullable<RecordMeta["xml"]>): DetectionResult | null {
  if (meta.namespace !== CNP_NAMESPACE) return null;
  const root = meta.root;
  const reasons = [`XML root <${root}> in the cnpAPI namespace ${CNP_NAMESPACE}`];
  if (CNP_BATCH_ROOTS.has(root))
    return unsupported(
      CNP_FORMATS.other,
      0.85,
      reasons,
      "This is a cnpAPI batch file. Batch responses are recognized but not analyzed; paste an Online response (cnpOnlineResponse) instead.",
    );
  if (CNP_REQUEST_ROOTS.has(root))
    return unsupported(
      CNP_FORMATS.other,
      0.85,
      reasons,
      "This is a cnpAPI request, which may contain card and customer data. Requests are not analyzed; paste the cnpOnlineResponse instead.",
    );
  if (root !== CNP_ONLINE_ROOT)
    return unsupported(
      CNP_FORMATS.other,
      0.6,
      reasons,
      "This cnpAPI document is recognized but not analyzed; only cnpOnlineResponse is read.",
    );

  const raw = input[root];
  const body: Obj = isObj(raw) ? raw : {};
  const response = attr(body, "response");
  if (response === undefined || !lookup(CNP_HEADER_RESPONSES, response))
    return unsupported(
      CNP_FORMATS.other,
      0.6,
      reasons,
      "This cnpOnlineResponse has no documented response attribute, so it is not analyzed.",
    );
  reasons.push(`response attribute ${response} is a documented cnpAPI value`);
  if (response !== "0")
    return supported(CNP_FORMATS.onlineResponse, 0.9, [
      ...reasons,
      "the response attribute reports a rejected request",
    ]);
  const children = childNames(body);
  const known = children.filter(
    (k) =>
      lookup(CNP_TRANSACTION_RESPONSES, k) &&
      items(body[k]).some((t) => isObj(t) && textOf(t.response) !== undefined),
  );
  if (known.length)
    return supported(CNP_FORMATS.onlineResponse, 0.95, [
      ...reasons,
      `has <${known[0]!}> with <response>`,
    ]);
  return unsupported(
    CNP_FORMATS.other,
    0.85,
    reasons,
    `This cnpAPI response is recognized but not analyzed. PandaPayLens reads ${Object.keys(CNP_TRANSACTION_RESPONSES).join(", ")}.`,
  );
}

/** Detection for a parsed XML record. */
export function detectXml(
  input: unknown,
  xml: NonNullable<RecordMeta["xml"]>,
): DetectionResult | null {
  if (!isObj(input)) return null;
  return detectWpg(input, xml) ?? detectCnp(input, xml);
}

// ---------------------------------------------------------------------------
// Parsing

type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

function readAmount(v: unknown, path: string, issues: string[]): WpgAmount | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    issues.push(`${path}: expected value, currencyCode and exponent attributes`);
    return undefined;
  }
  const value = attr(v, "value");
  const currencyCode = attr(v, "currencyCode");
  const exponent = attr(v, "exponent");
  if (!value || !/^\d{1,18}$/.test(value) || !currencyCode || !/^(?:0|2|3)$/.test(exponent ?? "")) {
    issues.push(
      `${path}: expected an integer value, a currencyCode and an exponent of 0, 2 or 3 (as in the paymentService DTD)`,
    );
    return undefined;
  }
  const dc = attr(v, "debitCreditIndicator");
  return {
    value,
    currencyCode,
    exponent: exponent!,
    ...(dc === "debit" || dc === "credit" ? { debitCreditIndicator: dc } : {}),
  };
}

function readPayment(p: Obj, path: string, issues: string[]): WpgPayment {
  const iso = isObj(p.ISO8583ReturnCode) ? p.ISO8583ReturnCode : undefined;
  const isoCode = iso ? attr(iso, "code") : undefined;
  const lastEvent = textOf(p.lastEvent)?.trim();
  const cvc = isObj(p.CVCResultCode) ? attr(p.CVCResultCode, "description") : undefined;
  const avs = isObj(p.AVSResultCode) ? attr(p.AVSResultCode, "description") : undefined;
  const amount = readAmount(p.amount, `${path}.amount`, issues);
  const out: WpgPayment = { path, authorisationIdPresent: p.AuthorisationId !== undefined };
  const method = word(textOf(p.paymentMethod)?.trim());
  if (method) out.paymentMethod = method;
  if (amount) out.amount = amount;
  if (lastEvent) out.lastEvent = lastEvent.slice(0, 64);
  if (isoCode !== undefined) {
    if (/^\d{1,6}$/.test(isoCode)) out.returnCode = isoCode;
    else issues.push(`${path}.ISO8583ReturnCode: expected a numeric code`);
    const description = attr(iso!, "description");
    if (description !== undefined) out.returnDescription = description;
  }
  if (cvc) out.cvcResult = cvc;
  if (avs) out.avsResult = avs;
  return out;
}

function readJournal(v: unknown, path: string, issues: string[]): WpgJournal | undefined {
  const j = items(v).find(isObj);
  if (!j) return undefined;
  const out: WpgJournal = { amounts: [] };
  const type = attr(j, "journalType");
  if (type && /^[A-Z_]{1,64}$/.test(type)) out.journalType = type;
  const date = isObj(j.bookingDate) && isObj(j.bookingDate.date) ? j.bookingDate.date : undefined;
  if (date) {
    const [d, m, y] = [attr(date, "dayOfMonth"), attr(date, "month"), attr(date, "year")];
    if (d && m && y && /^\d{1,2}$/.test(d) && /^\d{1,2}$/.test(m) && /^\d{4}$/.test(y))
      out.bookingDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  items(j.accountTx).forEach((tx, i, all) => {
    if (!isObj(tx)) return;
    const a = readAmount(
      tx.amount,
      `${itemPath(`${path}.accountTx`, i, all.length)}.amount`,
      issues,
    );
    if (a) out.amounts.push(a);
  });
  return out;
}

function readError(v: unknown, path: string, issues: string[]): WpgError | undefined {
  if (v === undefined) return undefined;
  const code = wpgErrorCodeOf(v);
  if (code === undefined || !/^\d{1,4}$/.test(code)) {
    issues.push(`${path}: expected a numeric code attribute`);
    return undefined;
  }
  const message = textOf(v);
  return { code, path, ...(message ? { message } : {}) };
}

function readOrder(o: Obj, path: string, issues: string[]): WpgOrder | undefined {
  const orderCode = attr(o, "orderCode");
  if (orderCode === undefined || orderCode === "") {
    issues.push(`${path}: the orderCode attribute is required`);
    return undefined;
  }
  const order: WpgOrder = { orderCode, path, payments: [] };
  const payments = items(o.payment);
  payments.forEach((p, i) => {
    if (isObj(p))
      order.payments.push(readPayment(p, itemPath(`${path}.payment`, i, payments.length), issues));
  });
  const error = readError(o.error, `${path}.error`, issues);
  if (error) order.error = error;
  const journal = readJournal(o.journal, `${path}.journal`, issues);
  if (journal) order.journal = journal;
  return order;
}

function parseWpg(input: unknown, format: string): ParseResult<WpgDocument> {
  const body = isObj(input) ? input[WPG_ROOT] : undefined;
  if (!isObj(body))
    return { ok: false, issues: [`(root): expected an XML document with root ${WPG_ROOT}`] };
  const issues: string[] = [];
  const version = attr(body, "version");
  const doc: WpgDocument = {
    message: format === WPG_FORMATS.notification ? "notification" : "reply",
    orders: [],
    acks: [],
    ...(version && /^1\.[0-4]$/.test(version) ? { version } : {}),
  };
  if (format === WPG_FORMATS.notification) {
    const notify = body.notify;
    const ev = isObj(notify) ? notify.orderStatusEvent : undefined;
    if (!isObj(ev))
      return { ok: false, issues: ["paymentService.notify: expected an orderStatusEvent element"] };
    const order = readOrder(ev, "paymentService.notify.orderStatusEvent", issues);
    if (order) doc.orders.push(order);
  } else {
    const reply = body.reply;
    if (!isObj(reply)) return { ok: false, issues: ["paymentService: expected a reply element"] };
    const error = readError(reply.error, "paymentService.reply.error", issues);
    if (error) doc.error = error;
    const statuses = items(reply.orderStatus);
    statuses.forEach((s, i) => {
      if (!isObj(s)) return;
      const order = readOrder(
        s,
        itemPath("paymentService.reply.orderStatus", i, statuses.length),
        issues,
      );
      if (order) doc.orders.push(order);
    });
    const ok = reply.ok;
    if (isObj(ok)) {
      for (const name of childNames(ok)) {
        const ack = ok[name];
        if (!/^[A-Za-z]{1,64}Received$/.test(name) || !isObj(ack)) continue;
        const orderCode = attr(ack, "orderCode");
        if (!orderCode) continue;
        const path = `paymentService.reply.ok.${name}`;
        const amount = readAmount(ack.amount, `${path}.amount`, issues);
        doc.acks.push({ name, orderCode, path, ...(amount ? { amount } : {}) });
      }
    }
  }
  if (issues.length) return { ok: false, issues };
  if (!doc.orders.length && !doc.error && !doc.acks.length)
    return {
      ok: false,
      issues: ["paymentService: no orderStatus, error or ok element to analyze"],
    };
  return { ok: true, value: doc };
}

function parseCnp(input: unknown): ParseResult<CnpDocument> {
  const raw = isObj(input) ? input[CNP_ONLINE_ROOT] : undefined;
  if (raw === undefined)
    return { ok: false, issues: [`(root): expected an XML document with root ${CNP_ONLINE_ROOT}`] };
  const body: Obj = isObj(raw) ? raw : {};
  const issues: string[] = [];
  const response = attr(body, "response");
  const message = attr(body, "message");
  const version = attr(body, "version");
  const doc: CnpDocument = {
    transactions: [],
    ...(response !== undefined ? { response } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(version !== undefined && /^\d{1,2}\.\d{1,3}$/.test(version) ? { version } : {}),
  };
  for (const name of childNames(body)) {
    if (!lookup(CNP_TRANSACTION_RESPONSES, name)) continue;
    const list = items(body[name]);
    list.forEach((t, i) => {
      const path = itemPath(`${CNP_ONLINE_ROOT}.${name}`, i, list.length);
      if (!isObj(t)) {
        issues.push(`${path}: expected a transaction response element`);
        return;
      }
      const code = textOf(t.response)?.trim();
      if (code === undefined || code === "") {
        issues.push(`${path}.response: required`);
        return;
      }
      const tx: CnpTransaction = {
        name,
        path,
        response: code,
        authCodePresent: textOf(t.authCode) !== undefined && textOf(t.authCode) !== "",
      };
      const m = textOf(t.message);
      if (m) tx.message = m;
      const id = textOf(t.cnpTxnId)?.trim();
      if (id) tx.cnpTxnId = id;
      const orderId = textOf(t.orderId)?.trim();
      if (orderId) tx.orderId = orderId;
      const time = textOf(t.responseTime)?.trim();
      if (time) tx.responseTime = time;
      const post = textOf(t.postDate)?.trim();
      if (post && /^\d{4}-\d{2}-\d{2}$/.test(post)) tx.postDate = post;
      const approved = textOf(t.approvedAmount)?.trim();
      if (approved && /^\d{1,12}$/.test(approved)) tx.approvedAmount = approved;
      doc.transactions.push(tx);
    });
  }
  if (issues.length) return { ok: false, issues };
  if (doc.response === undefined)
    return { ok: false, issues: [`${CNP_ONLINE_ROOT}: the response attribute is required`] };
  if (doc.response === "0" && !doc.transactions.length)
    return { ok: false, issues: [`${CNP_ONLINE_ROOT}: no analyzed transaction response`] };
  return { ok: true, value: doc };
}

export type XmlParsed = { kind: "wpg"; value: WpgDocument } | { kind: "cnp"; value: CnpDocument };

export const XML_FORMATS: readonly string[] = [
  WPG_FORMATS.reply,
  WPG_FORMATS.notification,
  CNP_FORMATS.onlineResponse,
];

export function parseXmlRecord(input: unknown, format: string): ParseResult<XmlParsed> {
  if (format === CNP_FORMATS.onlineResponse) {
    const r = parseCnp(input);
    return r.ok ? { ok: true, value: { kind: "cnp", value: r.value } } : r;
  }
  const r = parseWpg(input, format);
  return r.ok ? { ok: true, value: { kind: "wpg", value: r.value } } : r;
}

// ---------------------------------------------------------------------------
// Normalization

type AttrValue = SafePrimitive | SafePrimitive[] | undefined;

function attrs(entries: [string, AttrValue][]): Record<string, SafePrimitive | SafePrimitive[]> {
  const out: Record<string, SafePrimitive | SafePrimitive[]> = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    out[k] = typeof v === "string" ? (safeText(v, 120) ?? "") : v;
  }
  return out;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, x]) => x !== undefined),
  ) as NormalizedEventDraft;
}

/**
 * Minor units of a WPG amount. `value` counts units of 10^-exponent; it is
 * converted to the ISO 4217 minor unit of the currency, and left out when that
 * would need rounding.
 */
export function wpgMinorUnits(a: WpgAmount): { amountMinor?: string; currency?: string } {
  const currency = upperCurrency(a.currencyCode);
  if (!currency) return {};
  const exp = Number(a.exponent);
  const digits = a.value.padStart(exp + 1, "0");
  const decimal = exp === 0 ? digits : `${digits.slice(0, -exp)}.${digits.slice(-exp)}`;
  const amountMinor = decimalToMinor(decimal, currency);
  return { currency, ...(amountMinor !== undefined ? { amountMinor } : {}) };
}

const sameAmount = (a: WpgAmount, b: WpgAmount) =>
  a.value === b.value && a.currencyCode === b.currencyCode && a.exponent === b.exponent;

/** Stages whose amount is the moved amount in the journal, not the order amount. */
const JOURNAL_STAGES = new Set(["capture", "refund", "settlement", "dispute"]);

function wpgAmountFields(
  stage: string,
  payment: WpgAmount | undefined,
  journal: WpgJournal | undefined,
): { amountMinor?: string; currency?: string; extra: [string, AttrValue][] } {
  const extra: [string, AttrValue][] = [];
  let chosen: WpgAmount | undefined = payment;
  if (JOURNAL_STAGES.has(stage)) {
    const list = journal?.amounts ?? [];
    chosen = list.length && list.every((a) => sameAmount(a, list[0]!)) ? list[0] : undefined;
    if (payment) {
      const p = wpgMinorUnits(payment);
      extra.push(["orderAmountMinor", p.amountMinor], ["orderAmountCurrency", p.currency]);
    }
  }
  if (!chosen) return { extra };
  const m = wpgMinorUnits(chosen);
  if (m.amountMinor === undefined)
    extra.push(["amountValue", chosen.value], ["amountExponent", Number(chosen.exponent)]);
  // A journal moves the amount between accounts (debit on one, credit on the
  // other), so only the indicator of the payment amount itself is shown.
  if (chosen === payment && chosen.debitCreditIndicator === "debit")
    extra.push(["amountDebitCreditIndicator", "debit"]);
  return {
    ...(m.amountMinor !== undefined ? { amountMinor: m.amountMinor } : {}),
    ...(m.currency !== undefined ? { currency: m.currency } : {}),
    extra,
  };
}

function normalizeWpg(doc: WpgDocument, ctx: NormalizeContext): NormalizedEventDraft[] {
  const out: NormalizedEventDraft[] = [];
  const at = (path: string) => ({ recordIndex: ctx.recordIndex, path });
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const common: [string, AttrValue][] = [
    ["apiFamily", "wpg"],
    ["wpgMessage", doc.message],
    ["dtdVersion", doc.version],
    ["httpStatus", ctx.meta?.http?.status],
  ];
  const errorEvent = (e: WpgError, orderCode?: string) => {
    const entry = lookup(WPG_ERROR_CODES, e.code);
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: `error.${e.code}`,
        eventTypeKnown: Boolean(entry),
        stage: "error",
        providerStatus: entry ? `error ${e.code} ${entry.name}` : `error ${e.code}`,
        paymentReference: safeId(orderCode),
        outcome: entry?.rejected ? "failure" : "unknown",
        attributes: attrs([...common, ["errorCode", e.code], ["errorName", entry?.name]]),
        source: at(e.path),
        ...observed,
      }),
    );
  };

  if (doc.error) errorEvent(doc.error);
  for (const order of doc.orders) {
    const orderCode = safeId(order.orderCode);
    if (order.error) errorEvent(order.error, order.orderCode);
    for (const p of order.payments) {
      const info = p.lastEvent ? lookup(WPG_LAST_EVENTS, p.lastEvent) : undefined;
      const stage = info?.stage ?? "other";
      const amount = wpgAmountFields(stage, p.amount, order.journal);
      out.push(
        clean({
          sourceFormat: ctx.format,
          eventType: p.lastEvent ? (safeText(p.lastEvent, 64) ?? "unknown") : "payment",
          eventTypeKnown: Boolean(info),
          stage,
          providerStatus: p.lastEvent ? safeText(p.lastEvent, 64) : undefined,
          paymentReference: orderCode,
          amountMinor: amount.amountMinor,
          currency: amount.currency,
          outcome: info?.outcome ?? "unknown",
          attributes: attrs([
            ...common,
            ["lastEvent", p.lastEvent],
            ["paymentMethod", p.paymentMethod],
            ["iso8583ReturnCode", p.returnCode],
            ["cvcResult", p.cvcResult],
            ["avsResult", p.avsResult],
            ["authorisationIdPresent", p.authorisationIdPresent ? true : undefined],
            ["journalType", order.journal?.journalType],
            ["bookingDate", order.journal?.bookingDate],
            ...amount.extra,
          ]),
          source: at(p.path),
          ...observed,
        }),
      );
    }
  }
  for (const ack of doc.acks) {
    const info = lookup(WPG_OK_REPLIES, ack.name);
    const stage = info?.stage ?? "other";
    const amount = ack.amount ? wpgMinorUnits(ack.amount) : {};
    out.push(
      clean({
        sourceFormat: ctx.format,
        eventType: safeText(ack.name, 64) ?? "unknown",
        eventTypeKnown: Boolean(info),
        stage,
        providerStatus: safeText(ack.name, 64),
        paymentReference: safeId(ack.orderCode),
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        outcome: info?.outcome ?? "unknown",
        attributes: attrs(common),
        source: at(ack.path),
        ...observed,
      }),
    );
  }
  return out;
}

/** Outcome of a cnpAPI transaction by the documented Response Type. */
function cnpOutcome(type: CnpResponseType | undefined): NormalizedEventDraft["outcome"] {
  if (type === "Approved" || type === "Success") return "success";
  if (type === "Advise") return "pending";
  if (type === undefined || type === "Info" || type === "N/A") return "unknown";
  return "failure";
}

function normalizeCnp(doc: CnpDocument, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const common: [string, AttrValue][] = [
    ["apiFamily", "cnpapi"],
    ["cnpVersion", doc.version],
    ["httpStatus", ctx.meta?.http?.status],
  ];
  if (doc.response !== "0") {
    const known = Boolean(lookup(CNP_HEADER_RESPONSES, doc.response ?? ""));
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `response.${safeId(doc.response, 8) ?? "unknown"}`,
        eventTypeKnown: known,
        stage: "error",
        providerStatus: `response ${safeId(doc.response, 8) ?? "unknown"}`,
        outcome: "failure",
        attributes: attrs([...common, ["headerResponse", doc.response]]),
        source: { recordIndex: ctx.recordIndex, path: CNP_ONLINE_ROOT },
        ...observed,
      }),
    ];
  }
  return doc.transactions.map((t) => {
    const info = lookup(CNP_TRANSACTION_RESPONSES, t.name);
    const entry = lookup(CNP_RESPONSE_CODES, t.response);
    const time = toIsoTimestamp(t.responseTime);
    const asSent =
      !time && t.responseTime && /^\d{4}-\d{2}-\d{2}T[\d:.]{5,15}$/.test(t.responseTime)
        ? t.responseTime
        : undefined;
    return clean({
      sourceFormat: ctx.format,
      eventType: t.name,
      eventTypeKnown: Boolean(info),
      stage: info?.stage ?? "other",
      providerStatus: safeId(t.response, 8),
      paymentReference: safeId(t.cnpTxnId, 64),
      merchantReference: merchantRef(t.orderId),
      eventTimestamp: time,
      outcome: cnpOutcome(entry?.[1]),
      attributes: attrs([
        ...common,
        ["responseCode", safeId(t.response, 8)],
        ["responseType", entry?.[1]],
        ["responseTimeAsSent", asSent],
        ["postDate", t.postDate],
        ["approvedAmount", t.approvedAmount],
        ["authCodePresent", t.authCodePresent ? true : undefined],
      ]),
      source: { recordIndex: ctx.recordIndex, path: t.path },
      ...observed,
    });
  });
}

export function normalizeXml(parsed: XmlParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  return parsed.kind === "wpg" ? normalizeWpg(parsed.value, ctx) : normalizeCnp(parsed.value, ctx);
}

// ---------------------------------------------------------------------------
// Error decoding

type Loc = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & { paymentReference?: string };

const refs = (loc: Loc) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
});

export function decodeWpgError(e: WpgError, loc: Loc): DecodedErrorDraft {
  const entry = lookup(WPG_ERROR_CODES, e.code);
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "unknown";
  let confidence: Confidence = "insufficient";
  let explanation: string;
  if (entry) {
    category = entry.category;
    retry = entry.retry;
    confidence = "strong";
    subCodes.error_name = entry.name;
    explanation = `WPG error code ${e.code} (${entry.name}): ${entry.meaning}.`;
    if (e.code === "5" || e.code === "7")
      explanation += " Worldpay says to examine the error message to find the exact cause.";
    if (e.code === "2")
      explanation +=
        " A pasted document must also not start with a DOCTYPE line for PandaPayLens to read it.";
  } else {
    explanation = `WPG error code "${safeText(e.code, 8)}" is not one of the 14 codes in the paymentService DTD.`;
    missing.push(`WPG error code "${safeText(e.code, 8)}" is not documented.`);
  }
  const retryParts = [XML_RETRY_TEXT[retry]];
  if (entry && !entry.rejected)
    retryParts.push(
      "The error is on Worldpay's side, so the request may or may not have taken effect.",
    );
  if (!loc.paymentReference && entry && !entry.rejected)
    missing.push("No orderCode in the reply; check the order status before sending it again.");
  const message = providerText(e.message);
  return {
    ...refs(loc),
    code: safeText(e.code, 8) ?? "unknown",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: XML_NEXT_ACTION[category],
    retry,
    retryExplanation: retryParts.join(" "),
    confidence,
    documentation: [{ title: "WPG error codes", url: WPG_TROUBLESHOOT_URL }],
    missingInformation: missing,
    ...(entry?.rejected ? { outcomeKnown: true } : {}),
  };
}

const WPG_SUBJECT: Record<string, { what: string; docs: DocumentationLink[] }> = {
  REFUSED: { what: "payment", docs: [] },
  REFUND_FAILED: {
    what: "refund",
    docs: [{ title: "WPG order notifications", url: WPG_NOTIFICATIONS_URL }],
  },
  PUSH_REFUSED: {
    what: "Fast Access disbursement",
    docs: [{ title: "WPG order notifications", url: WPG_NOTIFICATIONS_URL }],
  },
};

/** Decodes a WPG refusal (REFUSED, REFUND_FAILED, PUSH_REFUSED) by its ISO8583ReturnCode. */
export function decodeWpgRefusal(p: WpgPayment, loc: Loc): DecodedErrorDraft {
  const subject = lookup(WPG_SUBJECT, p.lastEvent) ?? WPG_SUBJECT.REFUSED!;
  const docs: DocumentationLink[] = [
    { title: "WPG authorisation response codes", url: WPG_USEFUL_TABLES_URL },
    ...subject.docs,
  ];
  const missing: string[] = [];
  const subCodes: Record<string, string> = { last_event: p.lastEvent ?? "" };
  let category: ErrorCategory = "unknown";
  let retry: RetryGuidance = "unknown";
  let confidence: Confidence = "insufficient";
  let explanation: string;
  const code = p.returnCode;
  const prefix = `The ${subject.what} was refused (${p.lastEvent}).`;
  if (code === undefined) {
    explanation = `${prefix} The payment carries no ISO8583ReturnCode, so the reason cannot be decoded.`;
    missing.push("No ISO8583ReturnCode was supplied.");
    if (p.lastEvent === "REFUND_FAILED")
      missing.push("Worldpay says to refer to the description for the reason of a failed refund.");
  } else {
    const std = lookup(WPG_STANDARD_RETURN_CODES, code);
    if (std) {
      subCodes.code_table = "wpg_standard";
      category = std.category;
      retry = std.retry;
      confidence = std.confidence;
      explanation = `${prefix} WPG ISO8583ReturnCode ${code}: ${std.message}.${std.note ? ` ${std.note}` : ""}`;
      if (std.kind === "approval") {
        confidence = "possible";
        explanation += ` It does not match the ${p.lastEvent} status.`;
      }
    } else {
      subCodes.code_table = "not_decoded";
      explanation = `${prefix} ISO8583ReturnCode ${code} is not one of the standard WPG response codes. Worldpay's description is shown as the provider message. Extended response codes (listed on the WPG useful tables page and activated per merchant) and codes from other acquirers are not decoded by PandaPayLens, and the WPG documentation does not say that they follow the Access Worldpay refusal codes.`;
      missing.push(`ISO8583ReturnCode "${code}" is not decoded.`);
    }
  }
  const message = providerText(p.returnDescription);
  return {
    ...refs(loc),
    code: code ?? p.lastEvent ?? "REFUSED",
    subCodes,
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation,
    nextAction: XML_NEXT_ACTION[category],
    retry,
    retryExplanation:
      retry === "do_not_retry" || retry === "customer_action_required" || retry === "manual_review"
        ? XML_RETRY_TEXT[retry]
        : "This attempt was refused; whether a new attempt can succeed is not known from this record.",
    confidence,
    documentation: docs,
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeWpgPaymentError(p: WpgPayment, loc: Loc): DecodedErrorDraft {
  return {
    ...refs(loc),
    code: "ERROR",
    subCodes: p.returnCode ? { iso8583_return_code: p.returnCode } : {},
    category: "unknown",
    explanation:
      "WPG reports the status ERROR: the payment was not completed. Worldpay says the shopper may want to reattempt it. The record carries no reason.",
    nextAction: "Let the shopper try again, or contact Worldpay support with the order code.",
    retry: "retry_conditionally",
    retryExplanation: XML_RETRY_TEXT.retry_conditionally,
    confidence: "possible",
    documentation: [{ title: "WPG payment statuses", url: WPG_PAYMENT_PROCESS_URL }],
    missingInformation: ["The ERROR status carries no reason."],
    outcomeKnown: true,
  };
}

function decodeWpg(doc: WpgDocument, ctx: NormalizeContext): DecodedErrorDraft[] {
  const at = (path: string) => ({ recordIndex: ctx.recordIndex, path });
  const out: DecodedErrorDraft[] = [];
  if (doc.error)
    out.push(decodeWpgError(doc.error, { sourceFormat: ctx.format, source: at(doc.error.path) }));
  for (const order of doc.orders) {
    const ref = safeId(order.orderCode);
    const loc = (path: string): Loc => ({
      sourceFormat: ctx.format,
      source: at(path),
      ...(ref ? { paymentReference: ref } : {}),
    });
    if (order.error) out.push(decodeWpgError(order.error, loc(order.error.path)));
    for (const p of order.payments) {
      if (p.lastEvent && lookup(WPG_SUBJECT, p.lastEvent))
        out.push(decodeWpgRefusal(p, loc(p.path)));
      else if (p.lastEvent === "ERROR") out.push(decodeWpgPaymentError(p, loc(p.path)));
    }
  }
  return out;
}

function cnpRetry(type: CnpResponseType): RetryGuidance {
  if (type === "Soft Decline" || type === "Soft") return "retry_conditionally";
  if (type === "Hard Decline") return "do_not_retry";
  if (type === "Referral") return "customer_action_required";
  return "unknown";
}

const CNP_TYPE_TEXT: Partial<Record<CnpResponseType, string>> = {
  "Soft Decline": "A soft decline may succeed on a later attempt.",
  Soft: "A soft decline may succeed on a later attempt.",
  "Hard Decline": "A hard decline will not succeed if the same request is sent again.",
  Referral: "The documented action is to contact the issuer or the card network.",
  "Hard or Soft Decline":
    "The code can be a hard or a soft decline; the Mastercard merchant advice code decides, and it is not read here.",
  "Soft or Hard Decline": "The code can be a soft or a hard decline.",
};

function decodeCnpTransaction(t: CnpTransaction, loc: Loc): DecodedErrorDraft | undefined {
  const entry = lookup(CNP_RESPONSE_CODES, t.response);
  const docs = [
    { title: "cnpAPI payment transaction response codes", url: CNP_RESPONSE_CODES_URL },
  ];
  const message = providerText(t.message);
  const code = safeId(t.response, 8) ?? "unknown";
  if (entry && cnpOutcome(entry[1]) !== "failure") return undefined;
  if (!entry) {
    return {
      ...refs(loc),
      code,
      subCodes: { transaction: t.name },
      category: "unknown",
      ...(message ? { providerMessage: message } : {}),
      explanation: `cnpAPI response code "${code}" is not in the payment transaction response code table recorded by PandaPayLens. The message text is shown as sent by Worldpay.`,
      nextAction: XML_NEXT_ACTION.unknown,
      retry: "unknown",
      retryExplanation: XML_RETRY_TEXT.unknown,
      confidence: "insufficient",
      documentation: docs,
      missingInformation: [
        `cnpAPI response code "${code}" is not documented in the reviewed table.`,
      ],
    };
  }
  const [meaning, type] = entry;
  const category = lookup(CNP_CATEGORIES, t.response) ?? "unknown";
  const retry = cnpRetry(type);
  const possible =
    type === "Hard or Soft Decline" || type === "Soft or Hard Decline" || type === "Other";
  return {
    ...refs(loc),
    code,
    subCodes: { response_type: type, transaction: t.name },
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation: `cnpAPI response ${code}: ${meaning}. Worldpay classifies it as ${type}.${CNP_TYPE_TEXT[type] ? ` ${CNP_TYPE_TEXT[type]}` : ""}`,
    nextAction: XML_NEXT_ACTION[category],
    retry,
    retryExplanation:
      retry === "retry_conditionally"
        ? "This attempt was declined; a new attempt may succeed later. Check the transaction's state first so that a new request does not duplicate one that took effect."
        : XML_RETRY_TEXT[retry],
    confidence: possible ? "possible" : "strong",
    documentation: docs,
    missingInformation: [],
    outcomeKnown: true,
  };
}

function decodeCnpHeader(doc: CnpDocument, loc: Loc): DecodedErrorDraft {
  const code = safeId(doc.response, 8) ?? "unknown";
  const entry = lookup(CNP_HEADER_RESPONSES, doc.response ?? "");
  const category: ErrorCategory = entry?.category ?? "unknown";
  const retry: RetryGuidance = entry?.retry ?? "unknown";
  const message = providerText(doc.message);
  return {
    ...refs(loc),
    code,
    subCodes: { attribute: "cnpOnlineResponse.response" },
    category,
    ...(message ? { providerMessage: message } : {}),
    explanation: entry
      ? `cnpOnlineResponse response ${code}: ${entry.meaning}. The request was not processed as a transaction.`
      : `cnpOnlineResponse response "${code}" is not a documented value.`,
    nextAction: XML_NEXT_ACTION[category],
    retry,
    retryExplanation: XML_RETRY_TEXT[retry],
    confidence: entry ? "strong" : "insufficient",
    documentation: [
      { title: "cnpAPI XML validation messages", url: CNP_XML_VALIDATION_URL },
      { title: "cnpAPI additional response header error messages", url: CNP_HEADER_ERRORS_URL },
    ],
    missingInformation: entry ? [] : [`response "${code}" is not documented.`],
    ...(entry ? { outcomeKnown: true } : {}),
  };
}

function decodeCnp(doc: CnpDocument, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (doc.response !== "0")
    return [
      decodeCnpHeader(doc, {
        sourceFormat: ctx.format,
        source: { recordIndex: ctx.recordIndex, path: CNP_ONLINE_ROOT },
      }),
    ];
  const out: DecodedErrorDraft[] = [];
  for (const t of doc.transactions) {
    const ref = safeId(t.cnpTxnId, 64);
    const decoded = decodeCnpTransaction(t, {
      sourceFormat: ctx.format,
      source: { recordIndex: ctx.recordIndex, path: t.path },
      ...(ref ? { paymentReference: ref } : {}),
    });
    if (decoded) out.push(decoded);
  }
  return out;
}

export function decodeXmlErrors(parsed: XmlParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  return parsed.kind === "wpg" ? decodeWpg(parsed.value, ctx) : decodeCnp(parsed.value, ctx);
}
