/**
 * payabl. adapter.
 *
 * Supported input families (all URL-encoded `key=value` strings that reach the
 * adapter as a flat object of strings):
 * - `payabl.gateway.response`  Gateway API synchronous response (`transactionid`/`transid`, `status`, `errormessage`/`errmsg`)
 * - `payabl.notification`      Notification / callback (`transactionid`, `type`, `errorcode`, `security`, `timestamp`)
 * - `payabl.session.init`      Hosted Payment Page init or Web SDK session response
 *
 * Recognized but not supported: `payabl.websdk.callback`, the Web SDK browser
 * JavaScript callback JSON, which payabl. says must not be used to update the
 * merchant's systems.
 */

import {
  decimalToMinor,
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
  CFT_CODES,
  EPS_CODES,
  FAMILY_DOCS,
  GATEWAY_CODES,
  HPP_INIT_URL,
  ISSUER_CODES,
  MAC_CODES,
  NOTIFICATION_RETRY_URL,
  NOTIFICATION_TYPES,
  OBSERVED_CODES,
  OCT_CODES,
  PAYMENT_STATES,
  RETRY_EXPLANATION,
  RISK_SUBCODES,
  SCHEME_CODES,
  SOFORT_CODES,
  STATUS_CODES,
  THREEDS_REASON_URL,
  THREEDS_STATUS_REASONS,
  TRUSTLY_CODES,
  WEBSDK_CALLBACK_STATUSES,
  WEBSDK_CODES,
  WEBSDK_PARAMETERS_URL,
  NEXT_ACTION,
  type CatalogEntry,
  type CodeFamily,
} from "./catalog.js";

import { payablManifest, PAYABL_ADAPTER_VERSION } from "./manifest.js";

export { payablManifest, PAYABL_ADAPTER_VERSION };

export const PAYABL_FORMATS = {
  gatewayResponse: "payabl.gateway.response",
  notification: "payabl.notification",
  sessionInit: "payabl.session.init",
  webSdkCallback: "payabl.websdk.callback",
} as const;

const opt = (max: number) => z.string().max(max).optional();

const GatewayResponse = z.looseObject({
  transactionid: opt(64),
  transid: opt(64),
  status: z.string().max(32),
  errormessage: opt(2000),
  errmsg: opt(2000),
  amount: opt(32),
  price: opt(32),
  currency: opt(8),
  orderid: opt(256),
  payment_method: opt(16),
  card_type: opt(128),
  url_3ds: opt(4096),
  redirect_url: opt(4096),
});

const Notification = z.looseObject({
  transactionid: z.string().min(1).max(64),
  type: z.string().max(32),
  // The documented refund callback example has an empty errorcode.
  errorcode: z.string().max(32),
  errormessage: opt(2000),
  security: opt(256),
  timestamp: opt(32),
  amount: opt(32),
  currency: opt(8),
  orderid: opt(256),
  payment_method: opt(16),
  payment_state: opt(32),
  card_type: opt(128),
  "3dstatus": opt(64),
  "3dauthentication_status": opt(8),
  "3dauthentication_flow": opt(64),
  "3dProtocolVersion": opt(16),
  "3dtransactionStatusReason": opt(8),
  eci: opt(8),
});

const SessionInit = z.looseObject({
  errorcode: z.string().max(32),
  errormessage: opt(2000),
  transactionid: opt(64),
  orderid: opt(256),
  sessionid: opt(256),
  session_id: opt(256),
  start_url: opt(4096),
  signature: opt(256),
});

type Common = { repaired: boolean };

export type PayablParsed =
  | ({ kind: "gateway_response"; value: z.infer<typeof GatewayResponse> } & Common)
  | ({ kind: "notification"; value: z.infer<typeof Notification> } & Common)
  | ({
      kind: "session_init";
      variant: "hpp" | "websdk";
      value: z.infer<typeof SessionInit>;
    } & Common);

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Own-property lookup, so codes like "toString" never hit the prototype. */
function get<T>(table: Record<string, T>, key: string | undefined): T | undefined {
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

const SIGNATURE_HEX = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const SHA1_HEX = /^[0-9a-f]{40}$/i;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function knownCode(code: string | undefined): boolean {
  if (code === undefined) return false;
  const c = code.trim();
  return get(STATUS_CODES, c) !== undefined || decodePayablCode(c).family !== null;
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const base = { provider: "payabl" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;

  const md = input.metadata;
  if (
    meta?.format !== "form" &&
    isObj(md) &&
    typeof input.status === "string" &&
    (WEBSDK_CALLBACK_STATUSES as readonly string[]).includes(input.status) &&
    typeof md.transactionid === "string" &&
    typeof md.errorcode === "string" &&
    typeof md.type === "string"
  ) {
    return {
      ...base,
      format: PAYABL_FORMATS.webSdkCallback,
      confidence: 0.85,
      supported: false,
      reasons: [
        `status "${input.status}" with metadata.transactionid, errorcode and type, like the payabl. Web SDK browser callback`,
      ],
      unsupportedReason:
        "This looks like the payabl. Web SDK browser callback. payabl. says it must not be used to update merchant systems, so it is not analyzed. Paste the server notification sent to notification_url instead.",
    };
  }

  if (!formTransport(meta) || !isFlatStrings(input)) return none;
  const has = (k: string) => Object.hasOwn(input, k);
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : undefined);

  if (has("type") && has("errorcode")) {
    const type = s("type");
    const documentedType = get(NOTIFICATION_TYPES, type) !== undefined;
    if (has("security") || has("timestamp")) {
      let c = 0.3;
      const reasons = ["has type and errorcode with security and/or timestamp"];
      if (has("transactionid")) {
        c += 0.15;
        reasons.push("has transactionid");
      }
      if (documentedType) {
        c += 0.2;
        reasons.push(`type "${type}" is a documented notification type`);
      }
      if (SIGNATURE_HEX.test(s("security") ?? "")) {
        c += 0.2;
        reasons.push("security has the length of a SHA-1 or SHA-256 hex signature");
      }
      if (/^\d{9,10}$/.test(s("timestamp") ?? "")) c += 0.05;
      if (has("errormessage")) c += 0.05;
      if (knownCode(s("errorcode"))) c += 0.05;
      return {
        ...base,
        format: PAYABL_FORMATS.notification,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
    if (has("transactionid") && documentedType) {
      // Without the signature or timestamp these fields are too generic to claim.
      return {
        ...base,
        format: PAYABL_FORMATS.notification,
        confidence: 0.4,
        supported: true,
        reasons: ["has transactionid, type and errorcode, but neither security nor timestamp"],
        unsupportedReason:
          "The record has some notification fields but lacks security and timestamp, so it cannot be attributed to payabl. reliably. Select the provider manually if it is a payabl. notification.",
      };
    }
  }

  if (
    has("status") &&
    (has("transactionid") || has("transid")) &&
    (has("errormessage") || has("errmsg"))
  ) {
    let c = 0.4;
    const reasons = ["has status, transactionid/transid and errormessage/errmsg"];
    const tid = s("transactionid");
    if (tid !== undefined && tid !== "" && tid === s("transid")) {
      c += 0.25;
      reasons.push("transactionid and transid carry the same value");
    }
    if (has("errormessage") && has("errmsg")) {
      c += 0.15;
      reasons.push("has both errormessage and errmsg");
    }
    if (has("amount") && has("price")) c += 0.1;
    if (knownCode(s("status"))) {
      c += 0.1;
      reasons.push("status is a documented payabl. code");
    }
    return {
      ...base,
      format: PAYABL_FORMATS.gatewayResponse,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  if (has("errorcode")) {
    const hpp = has("sessionid") && has("start_url");
    const websdk = has("session_id") && SHA1_HEX.test(s("signature") ?? "");
    if (hpp || websdk) {
      let c = 0.5;
      const reasons = [
        hpp
          ? "has errorcode, sessionid and start_url like a Hosted Payment Page init response"
          : "has errorcode, session_id and a 40-hex signature like a Web SDK session response",
      ];
      if (hpp && has("errorcodes")) c += 0.2;
      if (!hpp && has("orderid")) c += 0.1;
      if (has("transactionid")) c += 0.15;
      if (knownCode(s("errorcode"))) c += 0.1;
      return {
        ...base,
        format: PAYABL_FORMATS.sessionInit,
        confidence: round(c),
        supported: true,
        reasons,
      };
    }
  }

  return none;
}

/**
 * Documentation pages render `&curren` and `&times` as entities, so examples
 * copied from them contain `¤cy=` and `×tamp=` instead of `&currency=` and
 * `&timestamp=`. Repair only these two documented defects.
 */
const DOCS_DEFECTS = [
  ["¤cy", "currency"],
  ["×tamp", "timestamp"],
] as const;

function repairDocsDefects(input: Record<string, unknown>): {
  value: Record<string, unknown>;
  repaired: boolean;
} {
  const out: Record<string, unknown> = { ...input };
  let repaired = false;
  for (const [token, key] of DOCS_DEFECTS) {
    if (Object.hasOwn(out, token) && !Object.hasOwn(out, key)) {
      out[key] = out[token];
      delete out[token];
      repaired = true;
    }
    for (const [k, v] of Object.entries(out)) {
      if (typeof v !== "string" || Object.hasOwn(out, key)) continue;
      const i = v.indexOf(`${token}=`);
      if (i < 0) continue;
      out[k] = v.slice(0, i);
      out[key] = v.slice(i + token.length + 1);
      repaired = true;
    }
  }
  return { value: out, repaired };
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PayablParsed } | { ok: false; issues: string[] } {
  if (!isObj(input)) return { ok: false, issues: ["(root): expected a set of form fields"] };
  const { value, repaired } = repairDocsDefects(input);

  if (format === PAYABL_FORMATS.gatewayResponse) {
    const r = GatewayResponse.safeParse(value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    if (!r.data.transactionid && !r.data.transid)
      return { ok: false, issues: ["transactionid: required (or its alias transid)"] };
    return { ok: true, value: { kind: "gateway_response", value: r.data, repaired } };
  }
  if (format === PAYABL_FORMATS.notification) {
    const r = Notification.safeParse(value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "notification", value: r.data, repaired } };
  }
  if (format === PAYABL_FORMATS.sessionInit) {
    const r = SessionInit.safeParse(value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const variant = r.data.sessionid !== undefined ? "hpp" : "websdk";
    return { ok: true, value: { kind: "session_init", variant, value: r.data, repaired } };
  }
  return { ok: false, issues: [`Unsupported payabl. format "${format}".`] };
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
  subCodes: Record<string, string>;
  documentation: DocumentationLink[];
};

export type CodeContext = {
  /** Card brand from `card_type`, used to pick a Visa or Mastercard meaning. */
  cardType?: string;
};

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Code not in the PandaPayLens payabl. catalog",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens does not recognize this payabl. code.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

type Brand = "visa" | "mastercard";

function brandOf(cardType: string | undefined): Brand | undefined {
  if (!cardType) return undefined;
  // Only `VISA` is shown in the docs; other brands are matched by prefix.
  if (/^visa/i.test(cardType)) return "visa";
  if (/^master/i.test(cardType)) return "mastercard";
  return undefined;
}

const BRAND_NAME: Record<Brand, string> = { visa: "Visa", mastercard: "Mastercard" };

function result(
  code: string,
  family: CodeFamily,
  entry: CatalogEntry,
  confidence: Confidence,
  missing: string[] = [],
  subCodes: Record<string, string> = {},
): CodeDecoding {
  return {
    code,
    family,
    entry,
    confidence,
    missing,
    subCodes: { family, ...subCodes },
    documentation: FAMILY_DOCS[family],
  };
}

/**
 * Decodes a value of `status` (synchronous) or `errorcode` (notifications).
 * Both fields carry the same overlapping code space, so the family is chosen
 * by exact string match in a fixed order: payabl. tables first, then the
 * issuer table (padded codes), Mastercard advice suffixes, and finally the
 * raw Visa/Mastercard tables (un-padded codes).
 */
export function decodePayablCode(raw: string, ctx: CodeContext = {}): CodeDecoding {
  const code = raw.trim();
  const shown = safeText(code, 40) ?? "";

  const gateway = get(GATEWAY_CODES, code);
  if (gateway) return result(code, "gateway", gateway, "strong");
  const cft = get(CFT_CODES, code);
  if (cft) return result(code, "cft", cft, "strong");

  if (code.startsWith("-5004.")) {
    const risk = get(RISK_SUBCODES, code);
    if (risk) return result(code, "risk", risk, "strong");
    return result(
      code,
      "risk",
      GATEWAY_CODES["-5004"]!,
      "possible",
      [
        `Risk sub-code "${shown}" is not in the documented list; it is decoded as the general -5004 risk cancellation.`,
      ],
      { baseCode: "-5004" },
    );
  }

  const observed = get(OBSERVED_CODES, code);
  if (observed)
    return result(code, "observed", observed, "possible", [
      `Code "${shown}" appears only in a payabl. documentation example (SEPA Direct Debit), not in a code table.`,
    ]);

  const websdk = get(WEBSDK_CODES, code);
  if (websdk) return result(code, "websdk", websdk, "strong");
  const sofort = get(SOFORT_CODES, code);
  if (sofort) return result(code, "apm_sofort", sofort, "strong");
  const trustly = get(TRUSTLY_CODES, code);
  if (trustly) return result(code, "apm_trustly", trustly, "strong");
  const oct = get(OCT_CODES, code);
  if (oct) return result(code, "oct", oct, "strong");

  const eps = get(EPS_CODES, code);
  if (eps)
    return result(code, "apm_eps", eps, "possible", [
      `"${shown}" is a documented EPS code. payabl. says APM codes must be read together with the payment method, and the EPS payment_method id is not documented in the PandaPayLens research, so confirm that this was an EPS payment.`,
    ]);

  const issuer = get(ISSUER_CODES, code);
  if (issuer) {
    // Padded issuer codes ("05") have un-padded raw scheme counterparts ("5").
    const scheme =
      get(SCHEME_CODES, code) ??
      (/^0\d$/.test(code) ? get(SCHEME_CODES, code.slice(1)) : undefined);
    const differs =
      scheme &&
      (scheme.conflict ||
        scheme.category !== issuer.category ||
        Boolean(scheme.outcomeUncertain) !== Boolean(issuer.outcomeUncertain));
    if (scheme && differs) {
      return result(code, "issuer", issuer, "possible", [
        `The raw Visa/Mastercard tables give a different meaning for this code (${scheme.meaning}); the payabl. issuer table meaning is used.`,
      ]);
    }
    return result(code, "issuer", issuer, "strong");
  }

  const mac = /^(\d{1,2})\.(\d{2})$/.exec(code);
  if (mac) {
    const baseCode = mac[1]!.padStart(2, "0");
    const advice = get(MAC_CODES, mac[2]!);
    const base = decodePayablCode(baseCode, ctx);
    if (base.family !== null) {
      const subCodes = { ...base.subCodes, baseCode, merchantAdviceCode: mac[2]! };
      if (!advice) {
        return {
          ...base,
          code,
          confidence: "possible",
          subCodes,
          missing: [
            ...base.missing,
            `Merchant advice suffix "${mac[2]}" is not in the documented Mastercard list.`,
          ],
        };
      }
      const entry: CatalogEntry = {
        ...base.entry,
        retry: advice.retry,
        explanation: `${base.entry.explanation} Mastercard merchant advice ${mac[2]}: ${advice.meaning}.`,
        retryExplanation: `Mastercard merchant advice code ${mac[2]} says: ${advice.meaning}. payabl. does not retry or block on the merchant's behalf.`,
      };
      return {
        code,
        family: base.family,
        entry,
        confidence: base.confidence,
        missing: base.missing,
        subCodes,
        documentation: [...base.documentation, ...FAMILY_DOCS.mac],
      };
    }
  }

  const scheme = get(SCHEME_CODES, code);
  if (scheme) {
    const missing: string[] = [];
    let confidence: Confidence = "strong";
    let meaning = scheme.meaning;
    const brand = brandOf(ctx.cardType);
    if (scheme.conflict) {
      confidence = "possible";
      missing.push(
        `The Visa and Mastercard tables give conflicting meanings for "${shown}"${brand ? "" : ", and card_type does not identify the scheme"}.`,
      );
    }
    if (brand) {
      const text = scheme[brand];
      if (text) meaning = `${BRAND_NAME[brand]}: ${text}`;
      else {
        confidence = "possible";
        missing.push(
          `Code "${shown}" is documented only for ${BRAND_NAME[brand === "visa" ? "mastercard" : "visa"]}, but card_type indicates ${BRAND_NAME[brand]}.`,
        );
      }
    } else if (
      !scheme.conflict &&
      scheme.mastercard &&
      scheme.visa &&
      scheme.mastercard !== scheme.visa
    ) {
      missing.push("card_type is not present, so the scheme-specific wording cannot be chosen.");
    }
    if (/^\d$/.test(code)) {
      const padded = get(ISSUER_CODES, `0${code}`);
      if (padded && padded.category !== scheme.category) {
        confidence = "possible";
        missing.push(
          `The padded issuer code "0${code}" means "${padded.meaning}" (${padded.category}); the un-padded value is decoded with the raw scheme table.`,
        );
      }
    }
    return result(code, "scheme", { ...scheme, explanation: `${meaning}.` }, confidence, missing);
  }

  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing: [
      `Code "${shown}" is not in the payabl. code tables known to PandaPayLens. payabl. notes that its lists contain only the most common codes.`,
    ],
    subCodes: {},
    documentation: [...FAMILY_DOCS.gateway, ...FAMILY_DOCS.issuer],
  };
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

/** Codes that are not errors, or empty values, are not decoded. */
function decodable(code: string): boolean {
  return code !== "" && get(STATUS_CODES, code) === undefined;
}

function codeOutcome(code: string, decoded: CodeDecoding | undefined): Outcome {
  const status = get(STATUS_CODES, code);
  if (status) return status.outcome;
  if (code === "") return "unknown";
  // A timeout or internal error does not say whether the operation took effect.
  return decoded?.entry.outcomeUncertain ? "unknown" : "failure";
}

const REQUEST_LEVEL = new Set([
  "invalid_request",
  "configuration",
  "rate_limiting",
  "duplicate_request",
]);

/** Gateway-side request rejections (as opposed to declines) are shown with stage `error`. */
function isRequestRejection(d: CodeDecoding | undefined): boolean {
  return Boolean(
    d &&
    (d.family === "gateway" || d.family === "cft" || d.family === "websdk") &&
    REQUEST_LEVEL.has(d.entry.category),
  );
}

function money(
  amount: string | undefined,
  price: string | undefined,
  currency: string | undefined,
) {
  const cur = upperCurrency(currency);
  const value = amount !== undefined && amount !== "" ? amount : price;
  return { amountMinor: decimalToMinor(value, cur), currency: cur };
}

function signatureClass(sig: string | undefined): string {
  if (sig === undefined || sig === "") return "absent";
  if (/^[0-9a-f]{64}$/i.test(sig)) return "present_sha256_length";
  if (/^[0-9a-f]{40}$/i.test(sig)) return "present_sha1_length";
  return "present_other";
}

function unixSeconds(value: string | undefined): string | undefined {
  return value && /^\d{10}$/.test(value) ? toIsoTimestamp(Number(value)) : undefined;
}

function decodeFor(code: string, cardType: string | undefined): CodeDecoding | undefined {
  return decodable(code) ? decodePayablCode(code, cardType ? { cardType } : {}) : undefined;
}

function normalize(parsed: PayablParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const repaired = parsed.repaired ? { docsDefectRepaired: true } : {};

  if (parsed.kind === "gateway_response") {
    const r = parsed.value;
    const code = r.status.trim();
    const decoded = decodeFor(code, r.card_type);
    const tid = safeId(r.transactionid) ?? safeId(r.transid);
    const mismatch =
      r.transactionid !== undefined && r.transid !== undefined && r.transactionid !== r.transid;
    const threeDs = Boolean(r.url_3ds);
    let stage: LifecycleStage = "payment";
    if (code === "2000" && threeDs) stage = "authentication";
    else if (isRequestRejection(decoded)) stage = "error";
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: "gateway_response",
        eventTypeKnown: true,
        stage,
        providerStatus: `status=${safeText(code, 32) ?? ""}`,
        paymentReference: tid,
        merchantReference: safeId(r.orderid, 256),
        ...money(r.amount, r.price, r.currency),
        outcome: codeOutcome(code, decoded),
        attributes: attrs({
          status: safeText(code, 32) ?? "",
          codeFamily: decoded?.family ?? undefined,
          paymentMethod: safeId(r.payment_method, 16),
          cardType: safeText(r.card_type, 64),
          // Only the presence of redirect URLs is kept: they carry session paths.
          threeDsRedirect: threeDs,
          apmRedirect: Boolean(r.redirect_url),
          ...(mismatch ? { transidMismatch: true } : {}),
          ...repaired,
        }),
        source,
        ...observed,
      }),
    ];
  }

  if (parsed.kind === "notification") {
    const n = parsed.value;
    const code = n.errorcode.trim();
    const typeInfo = get(NOTIFICATION_TYPES, n.type);
    const decoded = decodeFor(code, n.card_type);
    const tid = safeId(n.transactionid);
    const state =
      n.payment_state !== undefined && n.payment_state !== "" ? n.payment_state : undefined;
    let outcome: Outcome = typeInfo ? codeOutcome(code, decoded) : "unknown";
    if (typeInfo && code === "0" && state !== undefined)
      outcome = get(PAYMENT_STATES, state)?.outcome ?? "unknown";
    const ts = unixSeconds(n.timestamp);
    const safeType = safeText(n.type, 32) ?? "";
    const stateText = state !== undefined ? safeText(state, 32) : undefined;
    return [
      clean({
        sourceFormat: ctx.format,
        eventType: `notification.${safeType || "unknown"}`,
        eventTypeKnown: Boolean(typeInfo),
        stage: typeInfo?.stage ?? "other",
        providerStatus: `errorcode=${safeText(code, 32) ?? ""}${stateText ? `; payment_state=${stateText}` : ""}`,
        paymentReference: tid,
        merchantReference: safeId(n.orderid, 256),
        // payabl. documents no event id. The research suggests this field
        // combination; timestamp is left out because its behavior across
        // retries is not documented.
        deliveryKey: tid
          ? [tid, safeType, code, stateText ?? "", n.amount ?? ""]
              .map((p) => safeText(p, 64) ?? "")
              .join("|")
          : undefined,
        eventTimestamp: ts,
        ...money(n.amount, undefined, n.currency),
        outcome,
        attributes: attrs({
          type: safeType,
          errorcode: safeText(code, 32) ?? "",
          codeFamily: decoded?.family ?? undefined,
          paymentState: stateText,
          paymentMethod: safeId(n.payment_method, 16),
          cardType: safeText(n.card_type, 64),
          signature: signatureClass(n.security),
          threeDsStatus: safeText(n["3dstatus"], 32),
          threeDsAuthenticationStatus: safeText(n["3dauthentication_status"], 8),
          threeDsAuthenticationFlow: safeText(n["3dauthentication_flow"], 32),
          threeDsProtocolVersion: safeText(n["3dProtocolVersion"], 16),
          threeDsStatusReason: safeText(n["3dtransactionStatusReason"], 8),
          eci: safeText(n.eci, 8),
          ...(n.timestamp && !ts ? { timestampUnparsed: true } : {}),
          ...repaired,
        }),
        source,
        ...observed,
      }),
    ];
  }

  const r = parsed.value;
  const code = r.errorcode.trim();
  const decoded = decodeFor(code, undefined);
  let outcome = codeOutcome(code, decoded);
  // A created session is not a payment result: the customer has not paid yet.
  if (outcome === "success") outcome = "pending";
  return [
    clean({
      sourceFormat: ctx.format,
      eventType: parsed.variant === "hpp" ? "hpp.init" : "websdk.session",
      eventTypeKnown: true,
      stage: isRequestRejection(decoded) ? "error" : "payment",
      providerStatus: `errorcode=${safeText(code, 32) ?? ""}`,
      paymentReference: safeId(r.transactionid),
      merchantReference: safeId(r.orderid, 256),
      outcome,
      attributes: attrs({
        errorcode: safeText(code, 32) ?? "",
        codeFamily: decoded?.family ?? undefined,
        variant: parsed.variant,
        ...repaired,
      }),
      source,
      ...observed,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Error decoding

function errorDraft(
  code: string,
  field: "status" | "errorcode",
  ctx: NormalizeContext,
  opts: {
    transactionId?: string;
    message?: string;
    cardType?: string;
    paymentMethod?: string;
    threeDsReason?: string;
  },
): DecodedErrorDraft {
  const d = decodePayablCode(code, opts.cardType ? { cardType: opts.cardType } : {});
  const missing = [...d.missing];
  const subCodes: Record<string, string> = { field, ...d.subCodes };
  // Issuer and scheme codes are answers from the card network, so the outcome
  // of the attempt is known. `decline_code` is the shared name rules look for.
  if (d.family === "issuer" || d.family === "scheme") subCodes.decline_code = d.code;
  let explanation = d.entry.explanation;
  const documentation = [...d.documentation];

  const pm = safeId(opts.paymentMethod, 16);
  if (pm) subCodes.payment_method = pm;

  const reason = opts.threeDsReason?.trim();
  if (reason) {
    const r =
      get(THREEDS_STATUS_REASONS, reason) ?? get(THREEDS_STATUS_REASONS, reason.padStart(2, "0"));
    subCodes["3dtransactionStatusReason"] = safeText(reason, 8) ?? "";
    if (r) explanation += ` The 3DS transaction status reason is: ${r.meaning}.`;
    else missing.push("The 3DS transaction status reason is not in the documented list.");
    documentation.push({
      title: "payabl. 3DS transaction status reason codes",
      url: THREEDS_REASON_URL,
    });
  }
  if (!opts.transactionId)
    missing.push("No transactionid; the transaction cannot be looked up from this record.");

  const providerMessage = safeText(opts.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: d.code,
    subCodes,
    category: d.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation,
    nextAction: d.entry.nextAction,
    retry: d.entry.retry,
    retryExplanation: d.entry.retryExplanation,
    confidence: d.confidence,
    documentation,
    missingInformation: missing,
    ...(opts.transactionId ? { paymentReference: opts.transactionId } : {}),
  };
}

function decodeErrors(parsed: PayablParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "gateway_response") {
    const r = parsed.value;
    const code = r.status.trim();
    if (!decodable(code)) return [];
    const tid = safeId(r.transactionid) ?? safeId(r.transid);
    return [
      errorDraft(code, "status", ctx, {
        ...(tid ? { transactionId: tid } : {}),
        ...(r.errormessage || r.errmsg ? { message: r.errormessage || r.errmsg } : {}),
        ...(r.card_type ? { cardType: r.card_type } : {}),
        ...(r.payment_method ? { paymentMethod: r.payment_method } : {}),
      }),
    ];
  }
  if (parsed.kind === "notification") {
    const n = parsed.value;
    const code = n.errorcode.trim();
    if (!decodable(code)) return [];
    const tid = safeId(n.transactionid);
    const draft = errorDraft(code, "errorcode", ctx, {
      ...(tid ? { transactionId: tid } : {}),
      ...(n.errormessage ? { message: n.errormessage } : {}),
      ...(n.card_type ? { cardType: n.card_type } : {}),
      ...(n.payment_method ? { paymentMethod: n.payment_method } : {}),
      ...(n["3dtransactionStatusReason"] ? { threeDsReason: n["3dtransactionStatusReason"] } : {}),
    });
    const type = safeText(n.type, 32);
    if (type) draft.subCodes.type = type;
    if (!get(NOTIFICATION_TYPES, n.type))
      draft.missingInformation.push(
        "The notification type is not documented, so the operation this error belongs to is unknown.",
      );
    draft.documentation.push({
      title: "payabl. notification retries",
      url: NOTIFICATION_RETRY_URL,
    });
    return [draft];
  }
  const r = parsed.value;
  const code = r.errorcode.trim();
  if (!decodable(code)) return [];
  const tid = safeId(r.transactionid);
  const draft = errorDraft(code, "errorcode", ctx, {
    ...(tid ? { transactionId: tid } : {}),
    ...(r.errormessage ? { message: r.errormessage } : {}),
  });
  draft.documentation.push(
    parsed.variant === "hpp"
      ? { title: "payabl. Hosted Payment Page init", url: HPP_INIT_URL }
      : { title: "payabl. Web SDK parameters", url: WEBSDK_PARAMETERS_URL },
  );
  return [draft];
}

export const payablAdapter: ProviderAdapter<PayablParsed> = {
  id: "payabl",
  displayName: "payabl.",
  version: PAYABL_ADAPTER_VERSION,
  manifest: payablManifest,
  supportedFormats: [
    {
      id: PAYABL_FORMATS.gatewayResponse,
      description:
        "Gateway API synchronous response (URL-encoded status, transactionid, errormessage)",
    },
    {
      id: PAYABL_FORMATS.notification,
      description: "Notification / callback (URL-encoded transactionid, type, errorcode, security)",
    },
    {
      id: PAYABL_FORMATS.sessionInit,
      description: "Hosted Payment Page init or Web SDK session response",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // transactionid is reused by capture, reversal and refund of the same
    // payment. orderid is merchant-chosen and may repeat across attempts, so
    // it is never a correlation key.
    return [event.paymentReference, event.relatedReference].filter((x): x is string => Boolean(x));
  },
};

export * from "./catalog.js";
export default payablAdapter;
