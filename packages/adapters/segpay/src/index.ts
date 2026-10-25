/**
 * Segpay adapter.
 *
 * Segpay runs two technically separate products; their formats are kept apart.
 *
 * Processing (hosted pay page, Segpay-managed subscriptions), URL-encoded
 * postbacks with Segpay's default key names:
 * - `segpay.processing.transaction`     transaction postback (trantype, action, stage, approved)
 * - `segpay.processing.member`          member management postbacks (Probe, Enable, Disable, Cancel, Reactivation)
 * - `segpay.processing.paypal_dispute`  PayPal Dispute postback
 *
 * Gateway (merchant's own MIDs):
 * - `segpay.gateway.notification`       URL-encoded Event Notification
 *
 * Recognized but not analyzed: `segpay.processing.custom_postback`, postbacks
 * whose keys were renamed by the merchant. Gateway XML responses and SRS XML
 * are not recognized, because core does not parse XML.
 *
 * Postbacks also arrive as a full URL with a query string in Segpay's own
 * examples; the URL before `?` is dropped from the first key. The same fields
 * pasted as a flat JSON object are accepted too.
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
  CONVERSION_ERRORS,
  ERROR_CODES_URL,
  FAMILY_DOCS,
  FRAUD_CODES,
  GATEWAY_APPROVALS,
  GATEWAY_EVENT_CODES,
  GATEWAY_GUIDE_URL,
  GATEWAY_RESPONSE_CODES,
  MASTERCARD_BUCKETS,
  MEMBER_ACTIONS,
  MPI_ERRORS,
  NEXT_ACTION,
  PAYPAL_DISPUTE,
  POSTBACK_PARAMETERS_URL,
  RETRY_EXPLANATION,
  SIGNED_REQUESTS_URL,
  STAGES,
  STAND_IN_URL,
  SUB_EVENT_TYPES,
  TRANSACTION_ACTIONS,
  TRANSACTION_MATRIX,
  TRANSACTION_MATRIX_URL,
  TRANTYPE_STAGE,
  TRANTYPES,
  VISA_CATEGORIES,
  type CatalogEntry,
  type CodeFamily,
  type MatrixEntry,
  type VisaCategory,
} from "./catalog.js";
import { segpayManifest, SEGPAY_ADAPTER_VERSION } from "./manifest.js";

export { segpayManifest, SEGPAY_ADAPTER_VERSION };

export const SEGPAY_FORMATS = {
  transaction: "segpay.processing.transaction",
  member: "segpay.processing.member",
  paypalDispute: "segpay.processing.paypal_dispute",
  customPostback: "segpay.processing.custom_postback",
  gatewayNotification: "segpay.gateway.notification",
} as const;

// ---------------------------------------------------------------------------
// Input shape

type Flat = {
  /** Lowercased keys; Segpay says not to rely on key or value case. */
  fields: Record<string, string>;
  repeated: string[];
  urlPrefix: boolean;
};

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * A flat set of fields: form data (strings, or string arrays for repeated
 * keys) or a flat JSON object of primitives. Returns null for anything nested.
 */
function flatten(input: unknown): Flat | null {
  if (!isObj(input)) return null;
  const fields: Record<string, string> = {};
  const repeated: string[] = [];
  let urlPrefix = false;
  for (const [rawKey, raw] of Object.entries(input)) {
    let key = rawKey;
    const q = key.lastIndexOf("?");
    if (q >= 0 && /^https?:\/\//i.test(key)) {
      key = key.slice(q + 1);
      urlPrefix = true;
    }
    key = key.trim().toLowerCase();
    if (key === "") continue;
    let value: string;
    if (typeof raw === "string") value = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") value = String(raw);
    else if (raw === null) value = "";
    else if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
      repeated.push(key);
      value = raw[0] ?? "";
    } else return null;
    if (Object.hasOwn(fields, key)) {
      repeated.push(key);
      continue;
    }
    fields[key] = value;
  }
  return { fields, repeated, urlPrefix };
}

const canon = (v: string | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, "");

/** Case- and space-insensitive lookup of a documented vocabulary value. */
function vocab(table: Record<string, string>, value: string | undefined): string | undefined {
  return value === undefined ? undefined : lookup(table, canon(value));
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const c = canon(value);
  return list.find((x) => canon(x) === c);
}

const GMT_LABEL = /\(\s*GMT\s+STANDARD\s+TIME\s*\)\s*$/i;
const ETICKET = /^\d+:\d+$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_CODE = /^\d+-\d+-\d+$/;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function yesNo(v: string | undefined): "Yes" | "No" | undefined {
  const c = canon(v);
  return c === "yes" ? "Yes" : c === "no" ? "No" : undefined;
}

/** "0" and empty values mean "no such transaction" in Segpay payloads. */
function realId(v: string | undefined, max = 64): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t === "" || t === "0") return undefined;
  return safeId(t, max);
}

/** Short code-like values only (reason codes, product codes). */
function safeCode(v: string | undefined, max = 32): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return new RegExp(`^[A-Za-z0-9_.:-]{1,${max}}$`).test(t) ? t : undefined;
}

// ---------------------------------------------------------------------------
// Detection

const MEMBER_ACTION_KEYS = Object.keys(MEMBER_ACTIONS);

function gatewayEventCode(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (lookup(GATEWAY_EVENT_CODES, t)) return t;
  const u = t.toUpperCase();
  return lookup(GATEWAY_EVENT_CODES, u) ? u : undefined;
}

function detect(input: unknown, _meta?: RecordMeta): DetectionResult {
  const base = { provider: "segpay" };
  const none: DetectionResult = {
    ...base,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  const flat = flatten(input);
  if (!flat) return none;
  const f = flat.fields;
  const has = (k: string) => Object.hasOwn(f, k);
  const gmt = (k: string) => GMT_LABEL.test(f[k] ?? "");
  const anyGmt = gmt("transtime") || gmt("processingtime");

  // PayPal Dispute postback. The Segpay keys (purchaseid, transguid, urlid)
  // separate it from a native PayPal payload.
  if (has("disputeid") && canon(f.action).startsWith("dispute")) {
    let c = 0.3;
    const reasons = ["has disputeid and a Dispute* action"];
    if (oneOf(PAYPAL_DISPUTE.actions, f.action)) c += 0.05;
    if (/^PP-/i.test(f.disputeid ?? "")) c += 0.1;
    if (oneOf(PAYPAL_DISPUTE.stages, f.disputestage)) c += 0.05;
    if (oneOf(PAYPAL_DISPUTE.statuses, f.currentstatus)) c += 0.05;
    if (oneOf(PAYPAL_DISPUTE.channels, f.disputechannel)) c += 0.05;
    const segpayKeys = ["purchaseid", "transguid", "urlid", "postbackconfiguniqueid"].filter(has);
    if (segpayKeys.length === 0) {
      return {
        ...base,
        format: SEGPAY_FORMATS.paypalDispute,
        confidence: Math.min(round(c), 0.45),
        supported: true,
        reasons: [...reasons, "no Segpay identifiers (purchaseid, transguid, urlid)"],
      };
    }
    c += 0.2;
    reasons.push(`has Segpay keys ${segpayKeys.join(", ")}`);
    if (GUID.test(f.transguid ?? "")) c += 0.05;
    if (gmt("transtime") || gmt("processingtime") || gmt("disputecreatedate")) {
      c += 0.1;
      reasons.push("timestamps end in (GMT STANDARD TIME)");
    }
    return {
      ...base,
      format: SEGPAY_FORMATS.paypalDispute,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  // Gateway Event Notification.
  const eventCode = gatewayEventCode(f.eventcode);
  if (eventCode !== undefined && has("transactionid")) {
    let c = 0.3;
    const reasons = [
      `EventCode "${eventCode}" is a documented Gateway event code, with TransactionID`,
    ];
    if (lookup(SUB_EVENT_TYPES, (f.subeventtypeid ?? "").trim())) {
      c += 0.2;
      reasons.push("SubEventTypeID is documented");
    }
    if (has("subscriberid")) c += 0.1;
    if (has("originaleventcode")) c += 0.1;
    if (PRODUCT_CODE.test(f.productcode ?? "")) {
      c += 0.15;
      reasons.push("ProductCode has the nnnnn-nnnnn-nnn shape");
    }
    if (has("siteid") || has("accountid")) c += 0.05;
    if (has("originaltransactionid") || has("refundtransactionid")) c += 0.05;
    if (has("sitepassword") || has("siteusername")) c += 0.05;
    return {
      ...base,
      format: SEGPAY_FORMATS.gatewayNotification,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }
  // Session-expired notice of a signed Gateway hosted pay page.
  if (/^jwt-/i.test(f.transactionid ?? "") && (f.responsecode ?? "").trim() === "804") {
    return {
      ...base,
      format: SEGPAY_FORMATS.gatewayNotification,
      confidence: 0.6,
      supported: true,
      reasons: [
        "TransactionID jwt-<jti> with ResponseCode 804, like a hosted pay page session-expired notice",
      ],
    };
  }

  // Member management postbacks.
  const memberAction = MEMBER_ACTION_KEYS.includes(canon(f.action)) ? canon(f.action) : undefined;
  if (memberAction && has("purchaseid")) {
    let c = 0.45;
    const reasons = [`action "${MEMBER_ACTIONS[memberAction]!.name}" with purchaseid`];
    if (/^\d+$/.test((f.purchaseid ?? "").trim())) c += 0.1;
    if (has("urlid")) c += 0.1;
    if (ETICKET.test(f.eticketid ?? "")) {
      c += 0.15;
      reasons.push("eticketid has the PackageID:BillConfigID shape");
    }
    if (["cancelreasoncode", "cancelledby", "refundreasoncode", "refundedby"].some(has)) c += 0.1;
    if (["reactivationtimestamp", "lastbilldate", "nextbilldate"].some(has)) c += 0.1;
    if (has("username")) c += 0.05;
    if (has("postbackconfiguniqueid")) c += 0.1;
    if (anyGmt) c += 0.1;
    return {
      ...base,
      format: SEGPAY_FORMATS.member,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  // Transaction postback with default key names.
  const trantype = vocab(TRANTYPES, f.trantype);
  const stage = vocab(STAGES, f.stage);
  const eticket = ETICKET.test(f.eticketid ?? "");
  if ((has("purchaseid") || eticket) && (trantype || stage)) {
    let c = 0;
    const reasons: string[] = [];
    if (has("purchaseid")) {
      c += 0.2;
      reasons.push("has purchaseid");
    }
    if (eticket) {
      c += 0.25;
      reasons.push("eticketid has the PackageID:BillConfigID shape");
    }
    if (trantype) {
      c += 0.15;
      reasons.push(`trantype "${trantype}" is documented`);
    }
    if (stage) {
      c += 0.1;
      reasons.push(`stage "${stage}" is documented`);
    }
    if (yesNo(f.approved)) c += 0.05;
    if (vocab(TRANSACTION_ACTIONS, f.action)) c += 0.05;
    if (["-1", "0", "1"].includes((f.standin ?? "").trim())) c += 0.05;
    if (/^\d+$/.test(f.xsellnum ?? "")) c += 0.03;
    if (["ival", "iint", "rval", "rint"].some(has)) c += 0.05;
    if (GUID.test(f.transguid ?? "")) c += 0.05;
    if (has("urlid")) c += 0.03;
    if (has("postbackconfiguniqueid")) c += 0.05;
    if (has("tranid")) c += 0.05;
    if (anyGmt) {
      c += 0.1;
      reasons.push("transtime/processingtime end in (GMT STANDARD TIME)");
    }
    return {
      ...base,
      format: SEGPAY_FORMATS.transaction,
      confidence: round(c),
      supported: true,
      reasons,
    };
  }

  // Custom postback: merchant-chosen key names, recognized only by value shapes.
  const values = Object.values(f);
  const gmtValue = values.some((v) => GMT_LABEL.test(v));
  const eticketValue = values.some((v) => ETICKET.test(v));
  const trantypeValue = values.some((v) => vocab(TRANTYPES, v) !== undefined);
  const stageValue = values.some((v) => vocab(STAGES, v) !== undefined);
  if (gmtValue && (eticketValue || (trantypeValue && stageValue))) {
    return {
      ...base,
      format: SEGPAY_FORMATS.customPostback,
      confidence: 0.55,
      supported: false,
      reasons: [
        "values look like a Segpay postback ((GMT STANDARD TIME) timestamp with an eticket or trantype/stage value), but the default key names are missing",
      ],
      unsupportedReason:
        "This looks like a Segpay postback whose keys were renamed in a custom postback URL. Segpay lets merchants choose key names, so the fields cannot be mapped reliably. Configure the default postback (or paste one) to analyze it.",
    };
  }
  return none;
}

// ---------------------------------------------------------------------------
// Parsing

const str = (max: number) => z.string().max(max);
const opt = (max: number) => z.string().max(max).optional();

const Transaction = z.looseObject({
  purchaseid: str(64).min(1),
  tranid: opt(64),
  relatedtranid: opt(64),
  trantype: opt(32),
  action: opt(32),
  stage: opt(32),
  approved: opt(8),
  price: opt(32),
  currencycode: opt(8),
  authcode: opt(2000),
  standin: opt(8),
  transtime: opt(64),
});

const Member = z.looseObject({
  action: str(32),
  purchaseid: str(64).min(1),
  tranid: opt(64),
  transtime: opt(64),
  reactivationtimestamp: opt(64),
});

const PayPalDispute = z.looseObject({
  disputeid: str(64).min(1),
  action: str(32),
  purchaseid: opt(64),
  tranid: opt(64),
  transamount: opt(32),
});

const GatewayNotification = z.looseObject({
  eventcode: opt(4),
  transactionid: str(64).min(1),
  subeventtypeid: opt(8),
  responsecode: opt(8),
  responsecodedescription: opt(500),
  amount: opt(32),
  currencycode: opt(8),
  timestamp: opt(64),
});

export type SegpayParsed = {
  kind: "transaction" | "member" | "paypal_dispute" | "gateway_notification";
  fields: Record<string, string>;
  urlPrefix: boolean;
};

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: SegpayParsed } | { ok: false; issues: string[] } {
  const flat = flatten(input);
  if (!flat) return { ok: false, issues: ["(root): expected a flat set of postback fields"] };
  if (flat.repeated.length > 0)
    return {
      ok: false,
      issues: flat.repeated.map((k) => `${safeText(k, 40) ?? "key"}: repeated key`),
    };
  const f = flat.fields;
  const ok = (kind: SegpayParsed["kind"]) =>
    ({ ok: true, value: { kind, fields: f, urlPrefix: flat.urlPrefix } }) as const;

  if (format === SEGPAY_FORMATS.transaction) {
    const r = Transaction.safeParse(f);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    if (f.trantype === undefined && f.approved === undefined)
      return { ok: false, issues: ["trantype: required (or approved)"] };
    return ok("transaction");
  }
  if (format === SEGPAY_FORMATS.member) {
    const r = Member.safeParse(f);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return ok("member");
  }
  if (format === SEGPAY_FORMATS.paypalDispute) {
    const r = PayPalDispute.safeParse(f);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return ok("paypal_dispute");
  }
  if (format === SEGPAY_FORMATS.gatewayNotification) {
    const r = GatewayNotification.safeParse(f);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const sessionExpired = /^jwt-/i.test(f.transactionid ?? "");
    if (!sessionExpired && gatewayEventCode(f.eventcode) === undefined)
      return { ok: false, issues: ["eventcode: required (a documented Gateway event code)"] };
    return ok("gateway_notification");
  }
  return { ok: false, issues: [`Unsupported Segpay format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Timestamps

/** `M/D/YYYY h:mm:ss AM/PM (GMT STANDARD TIME)`, read as GMT. */
function processingTime(value: string | undefined): string | undefined {
  if (!value || value.length > 64) return undefined;
  const m =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?\s*(?:\(\s*GMT\s+STANDARD\s+TIME\s*\))?$/i.exec(
      value.trim(),
    );
  if (!m) return undefined;
  let hour = Number(m[4]);
  const ampm = m[7]?.toUpperCase();
  if (ampm) {
    if (hour < 1 || hour > 12) return undefined;
    if (ampm === "AM" && hour === 12) hour = 0;
    if (ampm === "PM" && hour !== 12) hour += 12;
  }
  return utc(Number(m[3]), Number(m[1]), Number(m[2]), hour, Number(m[5]), Number(m[6]));
}

/** Gateway `YYYY-MM-DD HH:MM:SS`, read as GMT. */
function gatewayTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  return utc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

function utc(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // Reject dates that roll over, such as 2/31.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Code decoding

export type CodeDecoding = {
  code: string;
  family: CodeFamily | null;
  entry: CatalogEntry;
  confidence: Confidence;
  missing: string[];
  subCodes: Record<string, string>;
  documentation: DocumentationLink[];
  /** The code is an issuer or scheme answer: the decline itself is known. */
  issuerAnswer?: boolean;
};

const UNKNOWN_ENTRY: CatalogEntry = {
  meaning: "Code not in the PandaPayLens Segpay catalog",
  category: "unknown",
  retry: "unknown",
  explanation: "PandaPayLens does not recognize this Segpay code.",
  nextAction: NEXT_ACTION.unknown,
  retryExplanation: RETRY_EXPLANATION.unknown,
};

function known(
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

function unknown(code: string, missing: string[], docs: DocumentationLink[]): CodeDecoding {
  return {
    code,
    family: null,
    entry: UNKNOWN_ENTRY,
    confidence: "insufficient",
    missing,
    subCodes: {},
    documentation: docs,
  };
}

/** Gateway `ResponseCode` (Appendix C). */
export function decodeGatewayResponseCode(raw: string): CodeDecoding {
  const code = raw.trim();
  const e = lookup(GATEWAY_RESPONSE_CODES, code);
  if (e) return known(code, "gateway_response", e, "strong");
  return unknown(
    code,
    [
      `ResponseCode "${safeText(code, 16) ?? ""}" is not in Segpay's Gateway response code table (Appendix C).`,
    ],
    FAMILY_DOCS.gateway_response,
  );
}

type Brand = "visa" | "mastercard";

function brandOf(cardType: string | undefined): Brand | undefined {
  if (!cardType) return undefined;
  if (/^visa/i.test(cardType.trim())) return "visa";
  if (/^master/i.test(cardType.trim())) return "mastercard";
  return undefined;
}

function visaCategoryOf(code: string): VisaCategory | undefined {
  for (const k of [1, 2, 3] as const) if (VISA_CATEGORIES[k].codes.includes(code)) return k;
  return undefined;
}

function mastercardBucketOf(code: string): "79" | "82" | "83" | undefined {
  for (const k of ["79", "82", "83"] as const)
    if (MASTERCARD_BUCKETS[k].codes.includes(code)) return k;
  return undefined;
}

/** A two-character issuer code, decoded with Segpay's Visa categories or Mastercard buckets. */
export function decodeSchemeCode(raw: string, cardType?: string): CodeDecoding {
  const code = raw.trim().toUpperCase();
  const brand = brandOf(cardType);
  const cat = visaCategoryOf(code);
  const bucket = mastercardBucketOf(code);
  const sub = { decline_code: code };

  const fromBucket = (b: "79" | "82" | "83", confidence: Confidence, missing: string[]) => {
    const def = MASTERCARD_BUCKETS[b];
    return {
      ...known(
        code,
        "mastercard_bucket",
        entryOf(def.meaning, def.category, def.retry),
        confidence,
        missing,
        {
          ...sub,
          mastercardBucket: b,
        },
      ),
      issuerAnswer: true,
    };
  };
  const fromCategory = (k: VisaCategory, confidence: Confidence, missing: string[]) => {
    const def = VISA_CATEGORIES[k];
    return {
      ...known(
        code,
        "visa_category",
        entryOf(def.meaning, "card_declined", def.retry, def.strategy),
        confidence,
        missing,
        { ...sub, visaCategory: String(k) },
      ),
      issuerAnswer: true,
    };
  };

  if (brand === "mastercard" && bucket) return fromBucket(bucket, "strong", []);
  if (cat) {
    if (brand === "visa") return fromCategory(cat, "strong", []);
    return fromCategory(cat, "possible", [
      brand === "mastercard"
        ? `Code "${code}" is in Segpay's Visa decline categories but not in its Mastercard buckets; the Visa guidance is shown for a Mastercard card.`
        : "The card type does not identify Visa or Mastercard; Segpay's Visa decline category is shown.",
    ]);
  }
  if (bucket)
    return fromBucket(bucket, "possible", [
      "The card type does not identify Mastercard; Segpay's Mastercard bucket is shown.",
    ]);
  return unknown(
    code,
    [
      `Code "${safeText(code, 8) ?? ""}" is not listed in Segpay's Visa categories 1 to 3 or Mastercard buckets. Segpay's Visa category 4 covers all other codes (reattempts allowed), but the authcode prefix is not guaranteed to be an issuer code, so it is not applied.`,
    ],
    FAMILY_DOCS.visa_category,
  );
}

function entryOf(
  meaning: string,
  category: CatalogEntry["category"],
  retry: CatalogEntry["retry"],
  why?: string,
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: `${meaning}.`,
    nextAction: NEXT_ACTION[category],
    retryExplanation: why ?? RETRY_EXPLANATION[retry],
  };
}

/**
 * Decodes a Processing `authcode`. Its format is not specified by Segpay, so
 * only a prefix that is a documented code is decoded. The rest of the value
 * can contain customer data (fraud codes embed the blocked email) and is
 * never returned.
 */
export function decodeAuthcode(raw: string | undefined, cardType?: string): CodeDecoding {
  const value = (raw ?? "").trim();
  const docs = [{ title: "Segpay postback parameters", url: POSTBACK_PARAMETERS_URL }];
  if (value === "")
    return unknown(
      "authcode",
      ["The postback has no authcode, so the decline reason is not in the payload."],
      docs,
    );
  const prefix = value.split(/[:\s-]/)[0] ?? "";
  const upper = prefix.toUpperCase();
  const note =
    "Segpay does not specify the authcode format; the code was read from the prefix of the value.";
  const fraud = lookup(FRAUD_CODES, upper);
  if (fraud) return known(upper, "fraud", fraud, "strong", [note]);
  const conv = lookup(CONVERSION_ERRORS, upper);
  if (conv) return known(upper, "conversion", conv, "strong", [note]);
  if (/^[0-9A-Z]{2}$/.test(upper)) {
    const d = decodeSchemeCode(upper, cardType);
    return { ...d, missing: [...d.missing, note] };
  }
  const shown = /^[A-Za-z0-9]{1,10}$/.test(prefix) ? prefix : "authcode";
  return unknown(
    shown,
    [
      "The authcode does not start with a documented Segpay fraud code, Instant Conversion / One-Click error or scheme code. Its content is not shown because it can contain customer data.",
    ],
    [...docs, { title: "Segpay Processing API error codes", url: ERROR_CODES_URL }],
  );
}

/** Looks a code up in every Segpay table (for decoder views). */
export function decodeSegpayCode(raw: string, cardType?: string): CodeDecoding {
  const code = raw.trim();
  const gw = lookup(GATEWAY_RESPONSE_CODES, code);
  if (gw) return known(code, "gateway_response", gw, "strong");
  const upper = code.toUpperCase();
  const fraud = lookup(FRAUD_CODES, upper);
  if (fraud) return known(upper, "fraud", fraud, "strong");
  const conv = lookup(CONVERSION_ERRORS, upper);
  if (conv) return known(upper, "conversion", conv, "strong");
  const mpi = lookup(MPI_ERRORS, code);
  if (mpi) return known(code, "mpi", mpi, "strong");
  if (/^[0-9A-Z]{2}$/.test(upper)) return decodeSchemeCode(upper, cardType);
  return unknown(
    code,
    [`Code "${safeText(code, 16) ?? ""}" is not in the Segpay code tables known to PandaPayLens.`],
    [...FAMILY_DOCS.gateway_response, ...FAMILY_DOCS.fraud],
  );
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

const DECIMAL = /^-?\d{1,20}(?:\.\d{1,10})?$/;
const decimal = (v: string | undefined) =>
  v !== undefined && DECIMAL.test(v.trim()) ? v.trim() : undefined;
const digits = (v: string | undefined, max = 12) =>
  v !== undefined && new RegExp(`^-?\\d{1,${max}}$`).test(v.trim()) ? v.trim() : undefined;

function money(amount: string | undefined, currency: string | undefined) {
  const cur = upperCurrency(currency?.trim());
  return { amountMinor: decimalToMinor(amount?.trim(), cur), currency: cur };
}

function testFlag(f: Record<string, string>): true | undefined {
  return (f.testtrans ?? f.testrans)?.trim() === "1" ? true : undefined;
}

/** Shown token: the canonical documented value, or a marker for anything else. */
function token(canonical: string | undefined, raw: string | undefined): string {
  if (canonical) return canonical;
  return raw === undefined || raw.trim() === "" ? "none" : "undocumented";
}

type TransactionView = {
  trantype?: string;
  action?: string;
  stage?: string;
  approved?: "Yes" | "No";
  matrix?: MatrixEntry;
  standIn: boolean;
  tranid?: string;
  cryptoCancel: boolean;
};

function transactionView(f: Record<string, string>): TransactionView {
  const trantype = vocab(TRANTYPES, f.trantype);
  const action = vocab(TRANSACTION_ACTIONS, f.action);
  const stage = vocab(STAGES, f.stage);
  const approved = yesNo(f.approved);
  let matrix = lookup(TRANSACTION_MATRIX, `${trantype}|${action}|${stage}|${approved}`);
  // The matrix lists one void row and says it covers a void of any stage.
  if (!matrix && trantype === "Sale" && action === "Void" && approved === "Yes")
    matrix = TRANSACTION_MATRIX["Sale|Void|Initial|Yes"];
  const rawTranid = (f.tranid ?? "").trim();
  const cryptoCancel = rawTranid.toUpperCase() === "SPDECLINE";
  return {
    ...(trantype ? { trantype } : {}),
    ...(action ? { action } : {}),
    ...(stage ? { stage } : {}),
    ...(approved ? { approved } : {}),
    ...(matrix ? { matrix } : {}),
    standIn: (f.standin ?? "").trim() === "1",
    // SPDECLINE is a pseudo id shared by every cancelled crypto payment.
    ...(!cryptoCancel && realId(f.tranid) ? { tranid: realId(f.tranid)! } : {}),
    cryptoCancel,
  };
}

function normalizeTransaction(p: SegpayParsed, ctx: NormalizeContext): NormalizedEventDraft {
  const f = p.fields;
  const v = transactionView(f);
  let stage: LifecycleStage =
    v.matrix?.stage ??
    (v.action === "Void" ? "void" : v.trantype ? TRANTYPE_STAGE[v.trantype]! : "other");
  let outcome: Outcome = v.matrix?.outcome ?? (v.approved === "No" ? "failure" : "unknown");
  if (v.cryptoCancel && stage === "other") stage = "payment";
  if (v.cryptoCancel) outcome = "failure";
  // A Stand-In approval is temporary: the bank has not answered yet.
  const temporaryApproval = v.standIn && outcome === "success" && stage === "payment";
  if (temporaryApproval) outcome = "pending";
  const isRecurring =
    stage === "payment"
      ? (v.matrix?.isRecurring ??
        (v.stage ? v.stage === "Conversion" || v.stage === "Rebill" : undefined))
      : undefined;

  const providerStatus = [
    `trantype=${token(v.trantype, f.trantype)}`,
    `action=${token(v.action, f.action)}`,
    `stage=${token(v.stage, f.stage)}`,
    `approved=${v.approved ?? token(undefined, f.approved)}`,
    ...(f.standin !== undefined ? [`standin=${digits(f.standin, 2) ?? "undocumented"}`] : []),
  ].join("; ");

  const complete = Boolean(v.trantype && v.action && v.stage && v.approved);
  return clean({
    sourceFormat: ctx.format,
    eventType: `transaction.${token(v.trantype, f.trantype)}.${token(v.action, f.action)}.${token(v.stage, f.stage)}`,
    eventTypeKnown: Boolean(v.matrix) || v.cryptoCancel,
    stage,
    providerStatus,
    paymentReference: v.tranid,
    relatedReference: realId(f.relatedtranid),
    subscriptionReference: realId(f.purchaseid),
    ...(isRecurring !== undefined ? { isRecurring } : {}),
    // No event id is documented. A retried postback repeats these documented
    // fields; Stand-In postbacks reuse tranid for a different outcome, so they
    // never get a key.
    deliveryKey:
      v.tranid && complete && !v.standIn
        ? ["trans", v.tranid, v.trantype, v.action, v.stage, v.approved].join("|")
        : undefined,
    eventTimestamp: processingTime(f.transtime),
    ...money(f.price, f.currencycode),
    outcome,
    attributes: attrs({
      matrixResult: v.matrix?.result,
      trantype: token(v.trantype, f.trantype),
      action: token(v.action, f.action),
      stage: token(v.stage, f.stage),
      approved: v.approved,
      standin: digits(f.standin, 2),
      ...(temporaryApproval ? { standInTemporaryApproval: true } : {}),
      ...(v.cryptoCancel ? { cryptoConsumerCancel: true } : {}),
      xsellnum: digits(f.xsellnum, 3),
      eticketid: ETICKET.test(f.eticketid ?? "") ? f.eticketid : undefined,
      urlid: digits(f.urlid),
      merchantid: digits(f.merchantid),
      postbackconfiguniqueid: digits(f.postbackconfiguniqueid),
      cardtype: safeCode(f.cardtype, 24),
      paymenttype: safeCode(f.paymenttype, 24),
      paytype: safeCode(f.paytype, 24),
      paymentchoice: safeCode(f.paymentchoice, 16),
      ccbincountry: safeCode(f.ccbincountry, 2),
      prepaidindicator: safeCode(f.prepaidindicator, 1),
      is3dsauthenticated: yesNo(f.is3dsauthenticated ?? f["3dsauthenticated"]),
      scarequired: yesNo(f.scarequired),
      issingleusepromo: yesNo(f.issingleusepromo ?? f.singleusepromo),
      threedsversion: safeCode(f.threedsversion, 16),
      membershipupgrade: canon(f.membershipupgrade) === "true" ? true : undefined,
      ival: decimal(f.ival),
      iint: digits(f.iint, 5),
      rval: decimal(f.rval),
      rint: digits(f.rint, 5),
      authprice: decimal(f.authprice),
      authcurrency: upperCurrency(f.authcurrency?.trim()),
      authcodePresent: f.authcode !== undefined && f.authcode.trim() !== "" ? true : undefined,
      test: testFlag(f),
      ...(f.transtime && !processingTime(f.transtime) ? { transtimeUnparsed: true } : {}),
      ...(p.urlPrefix ? { postbackUrlRemoved: true } : {}),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizeMember(p: SegpayParsed, ctx: NormalizeContext): NormalizedEventDraft {
  const f = p.fields;
  const info = lookup(MEMBER_ACTIONS, canon(f.action));
  const name = info?.name ?? "undocumented";
  return clean({
    sourceFormat: ctx.format,
    eventType: `member.${name}`,
    eventTypeKnown: Boolean(info),
    stage: "subscription",
    providerStatus: `action=${name}`,
    // tranid is only present for a refund, void or chargeback behind the change.
    relatedReference: realId(f.tranid),
    subscriptionReference: realId(f.purchaseid),
    eventTimestamp: processingTime(f.transtime) ?? processingTime(f.reactivationtimestamp),
    outcome: info?.outcome ?? "unknown",
    attributes: attrs({
      action: name,
      postback: info?.postback,
      description: info?.description,
      urlid: digits(f.urlid),
      eticketid: ETICKET.test(f.eticketid ?? "") ? f.eticketid : undefined,
      trantype:
        f.trantype !== undefined ? token(vocab(TRANTYPES, f.trantype), f.trantype) : undefined,
      stage: f.stage !== undefined ? token(vocab(STAGES, f.stage), f.stage) : undefined,
      approved: yesNo(f.approved),
      standin: digits(f.standin, 2),
      rval: decimal(f.rval),
      rint: digits(f.rint, 5),
      currencycode: upperCurrency(f.currencycode?.trim()),
      cancelreasoncode: safeCode(f.cancelreasoncode),
      refundreasoncode: safeCode(f.refundreasoncode),
      lastbilldate: safeCode(f.lastbilldate, 10),
      nextbilldate: safeCode(f.nextbilldate, 10),
      ...(p.urlPrefix ? { postbackUrlRemoved: true } : {}),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalizeDispute(p: SegpayParsed, ctx: NormalizeContext): NormalizedEventDraft {
  const f = p.fields;
  const action = oneOf(PAYPAL_DISPUTE.actions, f.action);
  const when =
    action === "DisputeResolved"
      ? (processingTime(f.disputeresolveddate) ?? processingTime(f.disputeupdatedate))
      : action === "DisputeCreated"
        ? processingTime(f.disputecreatedate)
        : (processingTime(f.disputeupdatedate) ?? processingTime(f.disputecreatedate));
  const stageValue = oneOf(PAYPAL_DISPUTE.stages, f.disputestage);
  const status = oneOf(PAYPAL_DISPUTE.statuses, f.currentstatus);
  const enumAttr = (value: string | undefined, raw: string | undefined) =>
    value ?? (raw !== undefined && raw.trim() !== "" ? "undocumented" : undefined);
  return clean({
    sourceFormat: ctx.format,
    eventType: `paypal_dispute.${action ?? "undocumented"}`,
    eventTypeKnown: Boolean(action),
    stage: "dispute",
    providerStatus: `action=${action ?? "undocumented"}; stage=${stageValue ?? "none"}; status=${status ?? "none"}`,
    paymentReference: realId(f.tranid),
    relatedReference: safeId(f.disputeid?.trim(), 64),
    subscriptionReference: realId(f.purchaseid),
    eventTimestamp: when,
    // A dispute's financial result is not a payment outcome.
    outcome: "unknown",
    attributes: attrs({
      disputeid: safeId(f.disputeid?.trim(), 64),
      disputeStage: enumAttr(stageValue, f.disputestage),
      disputeChannel: enumAttr(oneOf(PAYPAL_DISPUTE.channels, f.disputechannel), f.disputechannel),
      currentStatus: enumAttr(status, f.currentstatus),
      outcomeCode: enumAttr(oneOf(PAYPAL_DISPUTE.outcomes, f.outcomecode), f.outcomecode),
      disputeReason: enumAttr(oneOf(PAYPAL_DISPUTE.reasons, f.disputereason), f.disputereason),
      disputeDueDate: processingTime(f.disputeduedate),
      transamount: decimal(f.transamount),
      urlid: digits(f.urlid),
      ...(p.urlPrefix ? { postbackUrlRemoved: true } : {}),
    }),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function gatewayOutcome(
  eventCode: string,
  rc: string | undefined,
): {
  outcome: Outcome;
  conflict: boolean;
} {
  const info = GATEWAY_EVENT_CODES[eventCode]!;
  const approval = rc !== undefined && lookup(GATEWAY_APPROVALS, rc) !== undefined;
  const decoded = rc !== undefined && !approval ? lookup(GATEWAY_RESPONSE_CODES, rc) : undefined;
  if (info.outcome === "response_code" || eventCode === "T") {
    if (rc === undefined)
      return { outcome: eventCode === "T" ? "unknown" : "success", conflict: false };
    if (approval) return { outcome: "success", conflict: false };
    return {
      outcome: decoded?.outcomeUncertain ? "unknown" : decoded ? "failure" : "unknown",
      conflict: false,
    };
  }
  if (eventCode === "!")
    return { outcome: decoded?.outcomeUncertain ? "unknown" : "failure", conflict: false };
  // A decline code on an event that reports success contradicts itself.
  if (info.outcome === "success" && rc !== undefined && !approval)
    return { outcome: "unknown", conflict: true };
  return { outcome: info.outcome, conflict: false };
}

function normalizeGateway(p: SegpayParsed, ctx: NormalizeContext): NormalizedEventDraft {
  const f = p.fields;
  const rc = f.responsecode?.trim() || undefined;
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const observed = ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {};
  const eventCode = gatewayEventCode(f.eventcode);

  if (eventCode === undefined) {
    // Signed hosted pay page session expired: Segpay says to treat it as an
    // abandoned payment. TransactionID is a pseudo id (jwt-<jti>), not a transaction.
    return clean({
      sourceFormat: ctx.format,
      eventType: "gateway.session_expired",
      eventTypeKnown: rc === "804",
      stage: "payment",
      providerStatus: `ResponseCode=${safeCode(rc, 8) ?? "none"}`,
      eventTimestamp: gatewayTime(f.timestamp),
      outcome: rc === "804" ? "failure" : "unknown",
      attributes: attrs({ responseCode: safeCode(rc, 8), sessionExpired: true }),
      source,
      ...observed,
    });
  }

  const info = GATEWAY_EVENT_CODES[eventCode]!;
  const subId = (f.subeventtypeid ?? "").trim();
  const subEvent = lookup(SUB_EVENT_TYPES, subId);
  const { outcome, conflict } = gatewayOutcome(eventCode, rc);
  const isRecurring =
    info.stage === "payment"
      ? (info.isRecurring ??
        (subEvent?.subscriptionState === "rebilled"
          ? true
          : subEvent?.subscriptionState === "initial"
            ? false
            : undefined))
      : undefined;
  const tid = realId(f.transactionid);
  const currency = upperCurrency(f.currencycode?.trim());
  const originalEvent = gatewayEventCode(f.originaleventcode);
  return clean({
    sourceFormat: ctx.format,
    eventType: `gateway.${info.name}`,
    eventTypeKnown: true,
    stage: info.stage,
    providerStatus: `EventCode=${eventCode}${subId ? `; SubEventTypeID=${safeCode(subId, 8) ?? "undocumented"}` : ""}${rc ? `; ResponseCode=${safeCode(rc, 8) ?? "undocumented"}` : ""}`,
    paymentReference: tid,
    relatedReference: realId(f.originaltransactionid),
    subscriptionReference: realId(f.subscriberid),
    ...(isRecurring !== undefined ? { isRecurring } : {}),
    // Segpay documents no event id; TransactionID with EventCode identifies the event.
    deliveryKey: tid ? ["gw", tid, eventCode].join("|") : undefined,
    eventTimestamp: gatewayTime(f.timestamp),
    ...money(f.amount, currency),
    outcome,
    attributes: attrs({
      eventCode,
      eventName: info.name,
      eventMeaning: info.meaning,
      originalEventCode: originalEvent ?? (f.originaleventcode ? "undocumented" : undefined),
      subEventTypeId: subId ? (safeCode(subId, 8) ?? "undocumented") : undefined,
      subEventMeaning: subEvent?.meaning,
      productClass: subEvent?.productClass,
      subscriptionState: subEvent?.subscriptionState,
      batching: subEvent?.batching,
      responseCode: safeCode(rc, 8),
      ...(conflict ? { responseCodeConflict: true } : {}),
      refundTransactionId: realId(f.refundtransactionid),
      cardType: /^[VMDAJ]$/i.test((f.cardtype ?? "").trim())
        ? f.cardtype!.trim().toUpperCase()
        : undefined,
      paymentType: safeCode(f.paymenttype, 16),
      productCode: PRODUCT_CODE.test(f.productcode ?? "") ? f.productcode : undefined,
      siteId: digits(f.siteid),
      subAccountId: digits(f.subaccountid),
      offerId: digits(f.offerid),
      packageId: digits(f.packageid),
      chargebackReasonCode: safeCode(f.chargebackreasoncode, 16),
      amount: currency ? undefined : decimal(f.amount),
      ...(eventCode === "T" ? { test: true } : {}),
    }),
    source,
    ...observed,
  });
}

function normalize(parsed: SegpayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "transaction":
      return [normalizeTransaction(parsed, ctx)];
    case "member":
      return [normalizeMember(parsed, ctx)];
    case "paypal_dispute":
      return [normalizeDispute(parsed, ctx)];
    case "gateway_notification":
      return [normalizeGateway(parsed, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding

function draftFrom(
  d: CodeDecoding,
  ctx: NormalizeContext,
  opts: {
    field: string;
    paymentReference?: string;
    attemptReference?: string;
    message?: string;
    outcomeKnown?: boolean;
    docs?: DocumentationLink[];
    missing?: string[];
  },
): DecodedErrorDraft {
  const providerMessage = safeText(opts.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: d.code,
    subCodes: { field: opts.field, ...d.subCodes },
    category: d.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: d.entry.explanation,
    nextAction: d.entry.nextAction,
    retry: d.entry.retry,
    retryExplanation: d.entry.retryExplanation,
    confidence: d.confidence,
    documentation: [...d.documentation, ...(opts.docs ?? [])],
    missingInformation: [...d.missing, ...(opts.missing ?? [])],
    ...(opts.paymentReference ? { paymentReference: opts.paymentReference } : {}),
    ...(opts.attemptReference ? { attemptReference: opts.attemptReference } : {}),
    ...(opts.outcomeKnown !== undefined ? { outcomeKnown: opts.outcomeKnown } : {}),
  };
}

const CRYPTO_CANCEL: CatalogEntry = {
  meaning: "Crypto payment cancelled by the consumer",
  category: "unknown",
  retry: "customer_action_required",
  explanation:
    "Crypto payment cancelled by the consumer (transaction ID SPDECLINE). Segpay crypto payments are one-time only and cannot be refunded.",
  nextAction: "Let the customer start a new purchase if they still want to pay.",
  retryExplanation: "Only the customer can start a new payment.",
};

const UNCERTAIN = new Set(["provider_unavailable", "network_or_timeout"]);

function decodeErrors(parsed: SegpayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const f = parsed.fields;
  if (parsed.kind === "transaction") {
    const v = transactionView(f);
    if (v.cryptoCancel) {
      return [
        draftFrom(known("SPDECLINE", "crypto", CRYPTO_CANCEL, "strong"), ctx, {
          field: "tranid",
          ...(realId(f.purchaseid) ? { paymentReference: realId(f.purchaseid)! } : {}),
          outcomeKnown: true,
        }),
      ];
    }
    if (v.approved !== "No") return [];
    const d = decodeAuthcode(f.authcode, f.cardtype);
    const missing: string[] = [];
    if (v.standIn)
      missing.push(
        "This is a Stand-In postback; a Stand-In decline reuses the tranid and purchaseid of the temporary approval.",
      );
    if (v.matrix?.isRecurring)
      missing.push(
        "Segpay does not document its rebill retry schedule, so the record does not show whether the rebill will be retried.",
      );
    const purchase = realId(f.purchaseid);
    return [
      draftFrom(d, ctx, {
        field: "authcode",
        ...(purchase ? { paymentReference: purchase } : {}),
        ...(v.tranid ? { attemptReference: v.tranid } : {}),
        // A declined postback is a final answer for this attempt.
        outcomeKnown: true,
        docs: [
          { title: "Segpay Transaction Postback Matrix", url: TRANSACTION_MATRIX_URL },
          ...(v.standIn ? [{ title: "Segpay Stand-In", url: STAND_IN_URL }] : []),
        ],
        missing,
      }),
    ];
  }

  if (parsed.kind === "gateway_notification") {
    const rc = f.responsecode?.trim() || undefined;
    const eventCode = gatewayEventCode(f.eventcode);
    const tid = realId(f.transactionid);
    const subscriber = realId(f.subscriberid);
    const refs = {
      ...(subscriber || tid ? { paymentReference: (subscriber ?? tid)! } : {}),
      ...(tid ? { attemptReference: tid } : {}),
    };
    if (eventCode === undefined) {
      if (rc !== "804") return [];
      const entry: CatalogEntry = {
        ...GATEWAY_RESPONSE_CODES["804"]!,
        meaning: "Hosted pay page session expired",
        explanation:
          "The signed hosted pay page session expired (ResponseCode 804, Transaction timeout). Segpay says to treat it as a cardholder abandoned payment.",
        retry: "customer_action_required",
        retryExplanation:
          "No transaction was created for this session; the customer can start a new payment session.",
        nextAction: "Treat the payment as abandoned; create a new session if the customer returns.",
      };
      return [
        draftFrom(known("804", "gateway_response", entry, "possible"), ctx, {
          field: "ResponseCode",
          outcomeKnown: true,
          message: f.responsecodedescription,
          docs: [{ title: "Segpay hosted pay page signed requests", url: SIGNED_REQUESTS_URL }],
          missing: [
            "Segpay does not state which postback format carries the session-expired notice; it is read as a Gateway notification.",
          ],
        }),
      ];
    }
    if (rc !== undefined && lookup(GATEWAY_APPROVALS, rc) !== undefined) return [];
    if (rc === undefined) {
      if (eventCode !== "!") return [];
      return [
        draftFrom(
          unknown(
            "EventCode=!",
            [
              "The declined notification has no ResponseCode, so the decline reason is not in the payload.",
            ],
            FAMILY_DOCS.gateway_response,
          ),
          ctx,
          { field: "EventCode", ...refs, outcomeKnown: true },
        ),
      ];
    }
    const d = decodeGatewayResponseCode(rc);
    return [
      draftFrom(d, ctx, {
        field: "ResponseCode",
        ...refs,
        message: f.responsecodedescription,
        ...(UNCERTAIN.has(d.entry.category) ? {} : { outcomeKnown: true }),
        docs: [{ title: "Segpay Gateway Integration Guide", url: GATEWAY_GUIDE_URL }],
        missing:
          eventCode === "!" || eventCode === "R" || eventCode === "F"
            ? []
            : [
                `ResponseCode ${safeCode(rc, 8) ?? ""} is not an approval, but EventCode ${eventCode} reports a ${GATEWAY_EVENT_CODES[eventCode]!.name} event.`,
              ],
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Correlation

function correlationKeys(event: NormalizedEvent): string[] {
  const keys: string[] = [];
  const add = (prefix: string, v: unknown) => {
    if (typeof v === "string" && v !== "") keys.push(`${prefix}:${v}`);
  };
  if (event.sourceFormat === SEGPAY_FORMATS.gatewayNotification) {
    // Gateway TransactionID, its parent/child links and the stable SubscriberID.
    add("gw-tx", event.paymentReference);
    add("gw-tx", event.relatedReference);
    add("gw-tx", event.attributes.refundTransactionId);
    add("gw-sub", event.subscriptionReference);
    return keys;
  }
  // Processing: purchaseid spans the subscription; tranid and relatedtranid
  // link refunds, voids and chargebacks to the sale. Merchant references
  // (REF1-REF10, merchantpartnerid) are never used.
  add("purchase", event.subscriptionReference);
  add("tran", event.paymentReference);
  if (event.sourceFormat === SEGPAY_FORMATS.paypalDispute)
    add("pp-dispute", event.relatedReference);
  else add("tran", event.relatedReference);
  return keys;
}

export const segpayAdapter: ProviderAdapter<SegpayParsed> = {
  id: "segpay",
  displayName: "Segpay",
  version: SEGPAY_ADAPTER_VERSION,
  manifest: segpayManifest,
  supportedFormats: [
    {
      id: SEGPAY_FORMATS.transaction,
      description:
        "Processing transaction postback (default keys: trantype, action, stage, approved)",
    },
    {
      id: SEGPAY_FORMATS.member,
      description:
        "Processing member management postback (Probe, Enable, Disable, Cancel, Reactivation)",
    },
    {
      id: SEGPAY_FORMATS.paypalDispute,
      description: "Processing PayPal Dispute postback",
    },
    {
      id: SEGPAY_FORMATS.gatewayNotification,
      description: "Gateway Event Notification (EventCode, SubEventTypeID, ResponseCode)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default segpayAdapter;
