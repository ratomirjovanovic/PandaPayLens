/**
 * PayU India adapter.
 *
 * Supported input families:
 * - `payu_india.payment_response`  form-encoded payment response posted to surl / furl / curl,
 *                                  and the payment webhook, which uses the same fields
 * - `payu_india.verify_payment`    Verify Payment API JSON (transaction_details keyed by txnid)
 * - `payu_india.command_response`  command API JSON envelope of refund, capture and cancel
 *                                  requests (status 0/1, msg, mihpayid, request_id, error_code)
 *
 * Recognized but not analyzed: refund webhooks, dispute webhooks, S2S interim
 * responses and the transaction listing.
 *
 * Detection relies on field structure only (mihpayid, unmappedstatus,
 * transaction_details, the command envelope), never on the word "PayU".
 * PayU platforms outside India use other formats and are not covered.
 */

import {
  lookup,
  safeId,
  safeText,
  type Confidence,
  type DecodedErrorDraft,
  type DetectionResult,
  type DocumentationLink,
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
  ALT_ID_ERROR_CODES,
  AUTH_MAPPING_CODES,
  COMMAND_MESSAGES,
  ERROR_CODES_URL,
  FIELD7_STAGES,
  NEXT_ACTION,
  OTHER_ERROR_CODES,
  PAYMENT_ERROR_CODES,
  PAYMENT_MODES,
  PAYMENT_STATES,
  PAYMENT_STATES_URL,
  PAYMENT_STATUSES,
  REFUND_API_URL,
  REFUND_CODE_STATES,
  REFUND_INITIATION_CODES,
  REFUND_INITIATION_CODES_URL,
  RETRY_EXPLANATION,
  SUBSCRIPTION_ERROR_CODES,
  UNDESCRIBED_FIELD7_VALUES,
  type CodeEntry,
  type Field7Stage,
} from "./catalog.js";
import { payuIndiaManifest, PAYU_INDIA_ADAPTER_VERSION } from "./manifest.js";

export { payuIndiaManifest, PAYU_INDIA_ADAPTER_VERSION };

export const PAYU_INDIA_FORMATS = {
  paymentResponse: "payu_india.payment_response",
  verifyPayment: "payu_india.verify_payment",
  commandResponse: "payu_india.command_response",
  refundWebhook: "payu_india.refund_webhook",
  disputeWebhook: "payu_india.dispute_webhook",
  s2sResponse: "payu_india.s2s_response",
  transactionDetails: "payu_india.transaction_details",
} as const;

// ---------------------------------------------------------------------------
// Helpers

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Obj, k: string) => Object.hasOwn(o, k);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Form data arrives as strings (arrays for repeated keys); its parsed JSON form may use numbers. */
function isFlat(o: Obj): boolean {
  return Object.values(o).every(
    (v) =>
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

const HEX128 = /^[0-9a-f]{128}$/i;
const ADDED_ON = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const DECIMAL = /^-?\d{1,15}(?:\.\d{1,4})?$/;

const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(values: Record<string, SafePrimitive | SafePrimitive[] | undefined>): Attrs {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Attrs;
}

/** The hash is never verified; only presence and length are reported. */
function hashClass(v: unknown): string {
  if (typeof v !== "string" || v === "") return "absent";
  return HEX128.test(v) ? "present_128_hex" : "present_other";
}

const pattern = (v: unknown, re: RegExp) => {
  const t = typeof v === "string" ? v.trim() : undefined;
  return t !== undefined && re.test(t) ? t : undefined;
};

const IDENTIFIER_LIKE = /[0-9Xx*#](?:[0-9Xx*# -]){6,}[0-9Xx*#]/g;

/**
 * Provider and bank texts (error_Message, field8, field9, msg) are free text.
 * Besides the core scrubbing, anything with "@" (UPI ids look like
 * name@bank) and long digit or mask runs (phone, account and masked card
 * numbers) is removed.
 */
function scrub(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v
    .replace(/\S*@\S*/g, "[redacted]")
    .replace(IDENTIFIER_LIKE, (m) => ((m.match(/[0-9Xx*#]/g)?.length ?? 0) >= 6 ? "[redacted]" : m))
    .replace(/\s+/g, " ")
    .trim();
  return safeText(t, max);
}

// ---------------------------------------------------------------------------
// Detection

const PAYMENT_MARKERS = [
  "error_Message",
  "error_message",
  "PG_TYPE",
  "field7",
  "field9",
  "bank_ref_num",
  "bank_ref_no",
  "payment_source",
  "net_amount_debit",
  "udf1",
];

const isBinaryStatus = (v: unknown) => v === 0 || v === 1 || v === "0" || v === "1";

const formBody = (meta?: RecordMeta) =>
  meta?.format === "form" ||
  (meta?.format === "http" && meta.http?.contentType === "application/x-www-form-urlencoded");

function detectVerify(input: Obj): DetectionResult | null {
  const td = input.transaction_details;
  if (!isObj(td) || !has(input, "status") || typeof input.msg !== "string") return null;
  const entries = Object.values(td).filter(isObj);
  let c = 0.4;
  const reasons = ["status, msg and a transaction_details object"];
  if (/^\d+ out of \d+ Transactions Fetched Successfully$/i.test(input.msg.trim())) {
    c += 0.35;
    reasons.push('msg has the documented "N out of M Transactions Fetched Successfully" form');
  }
  if (entries.length > 0 && entries.every((e) => has(e, "mihpayid"))) {
    c += 0.2;
    reasons.push("transaction_details entries carry mihpayid");
  }
  if (entries.some((e) => has(e, "unmappedstatus") || has(e, "error_code") || has(e, "PG_TYPE")))
    c += 0.05;
  if (c < 0.6) return null;
  return {
    provider: "payu_india",
    format: PAYU_INDIA_FORMATS.verifyPayment,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectCommand(input: Obj): DetectionResult | null {
  if (!isBinaryStatus(input.status) || typeof input.msg !== "string" || !has(input, "mihpayid"))
    return null;
  if (has(input, "transaction_details") || has(input, "txnid") || has(input, "unmappedstatus"))
    return null;
  let c = 0.55;
  const reasons = ["status 0/1, msg and mihpayid like a command API response"];
  if (has(input, "request_id")) {
    c += 0.15;
    reasons.push("has request_id");
  }
  if (lookup(COMMAND_MESSAGES, input.msg.trim().toLowerCase())) {
    c += 0.1;
    reasons.push("msg is a documented command API message");
  }
  if (has(input, "error_code")) c += 0.05;
  return {
    provider: "payu_india",
    format: PAYU_INDIA_FORMATS.commandResponse,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detectRecognized(input: Obj): DetectionResult | null {
  const base = { provider: "payu_india", supported: false };
  if (
    has(input, "mihpayid") &&
    has(input, "request_id") &&
    (input.action === "refund" || has(input, "refund_mode")) &&
    (has(input, "merchantTxnId") || has(input, "token"))
  ) {
    return {
      ...base,
      format: PAYU_INDIA_FORMATS.refundWebhook,
      confidence: 0.8,
      reasons: ["mihpayid, request_id and refund_mode or action refund like a refund webhook"],
      unsupportedReason:
        "This looks like a PayU India refund webhook or refund status callback. It is recognized but not analyzed yet; the refund request response (status, msg, request_id) is supported.",
    };
  }
  if (
    input.event === "dispute" &&
    input.type === "payments" &&
    has(input, "cb_id") &&
    has(input, "cb_status") &&
    has(input, "txn_id")
  ) {
    return {
      ...base,
      format: PAYU_INDIA_FORMATS.disputeWebhook,
      confidence: 0.8,
      reasons: ['event "dispute" and type "payments" with cb_id, cb_status and txn_id'],
      unsupportedReason:
        "This looks like a PayU India dispute (chargeback) webhook. It is recognized but not analyzed yet.",
    };
  }
  const md = input.metaData;
  if (
    isObj(md) &&
    (has(md, "unmappedStatus") || has(md, "txnStatus")) &&
    (has(md, "referenceId") || has(md, "txnId")) &&
    (isObj(input.binData) || isObj(input.result))
  ) {
    return {
      ...base,
      format: PAYU_INDIA_FORMATS.s2sResponse,
      confidence: 0.75,
      reasons: ["metaData with txnStatus or unmappedStatus and a result or binData object"],
      unsupportedReason:
        "This looks like a PayU India S2S interim response (for example a 3-D Secure redirect). It is not a final payment status and is not analyzed; check the payment with the Verify Payment API or the payment webhook.",
    };
  }
  const list = input.Transaction_details;
  if (
    Array.isArray(list) &&
    list.length > 0 &&
    isObj(list[0]) &&
    (has(list[0], "ibibo_code") || has(list[0], "mer_service_fee"))
  ) {
    return {
      ...base,
      format: PAYU_INDIA_FORMATS.transactionDetails,
      confidence: 0.75,
      reasons: ["Transaction_details array with ibibo_code or mer_service_fee"],
      unsupportedReason:
        "This looks like the PayU India transaction listing (get_Transaction_Details). It is recognized but not analyzed; use the Verify Payment response for a single payment.",
    };
  }
  return null;
}

function detectPayment(input: Obj): DetectionResult | null {
  if (!has(input, "mihpayid") || !isFlat(input)) return null;
  const s = (k: string) => str(input[k]);
  const reasons: string[] = [];
  const status = s("status")?.trim().toLowerCase();
  const unmapped = s("unmappedstatus")?.trim().toLowerCase();
  const markers = PAYMENT_MARKERS.filter((k) => has(input, k));
  const core = has(input, "txnid") && has(input, "status");
  if (!core && !has(input, "unmappedstatus")) {
    return {
      provider: "payu_india",
      format: PAYU_INDIA_FORMATS.paymentResponse,
      confidence: markers.length >= 2 ? 0.4 : 0.25,
      supported: true,
      reasons: ["has mihpayid without txnid, status or unmappedstatus"],
      unsupportedReason:
        "mihpayid alone is not enough to read this record as a PayU India payment response. Select the provider manually if it is one.",
    };
  }
  let c: number;
  if (core) {
    c = 0.6;
    reasons.push("has mihpayid, txnid and status");
    if (has(input, "unmappedstatus")) {
      c += 0.15;
      reasons.push("has unmappedstatus");
    }
  } else {
    c = 0.55;
    reasons.push("has mihpayid and unmappedstatus");
  }
  if (status !== undefined && lookup(PAYMENT_STATUSES, status)) {
    c += 0.05;
    reasons.push(`status "${status}" is a documented payment status`);
  }
  if (unmapped !== undefined && lookup(PAYMENT_STATES, unmapped)) c += 0.05;
  if (/^E[A-Z0-9]{1,6}$/.test(s("error")?.trim() ?? "")) c += 0.03;
  if (/-PG$/.test(s("PG_TYPE") ?? "")) c += 0.03;
  if (HEX128.test(s("hash") ?? "")) {
    c += 0.05;
    reasons.push("hash has the length of a SHA-512 hex digest");
  }
  if (markers.length >= 2) {
    c += 0.05;
    reasons.push(`has ${markers.slice(0, 4).join(", ")}`);
  }
  return {
    provider: "payu_india",
    format: PAYU_INDIA_FORMATS.paymentResponse,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "payu_india",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  if (!formBody(meta)) {
    const json =
      detectVerify(input) ?? detectRecognized(input) ?? detectCommand(input) ?? undefined;
    if (json) return json;
  }
  return detectPayment(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing

/** Fields read from a payment response, webhook or Verify Payment entry. */
const TXN_FIELDS = [
  "mihpayid",
  "txnid",
  "status",
  "unmappedstatus",
  "error",
  "error_code",
  "error_Message",
  "error_message",
  "field7",
  "field8",
  "field9",
  "mode",
  "PG_TYPE",
  "bankcode",
  "amount",
  "amt",
  "transaction_amount",
  "net_amount_debit",
  "addedon",
  "payment_source",
  "cardCategory",
  "threeDSVersion",
  "pa_name",
  "hash",
  "bank_ref_num",
  "bank_ref_no",
] as const;

const opt = (max: number) => z.string().max(max).optional();

const txnShape = {
  unmappedstatus: opt(64),
  error: opt(64),
  error_code: opt(64),
  error_Message: opt(2000),
  error_message: opt(2000),
  field7: opt(200),
  field8: opt(2000),
  field9: opt(2000),
  mode: opt(64),
  PG_TYPE: opt(64),
  bankcode: opt(64),
  amount: opt(64),
  amt: opt(64),
  transaction_amount: opt(64),
  net_amount_debit: opt(64),
  addedon: opt(64),
  payment_source: opt(64),
  cardCategory: opt(64),
  threeDSVersion: opt(32),
  pa_name: opt(200),
  hash: opt(1024),
  bank_ref_num: opt(256),
  bank_ref_no: opt(256),
};

const PaymentResponse = z.looseObject({
  mihpayid: z.string().trim().min(1).max(64),
  txnid: z.string().trim().min(1).max(128),
  status: z.string().trim().min(1).max(32),
  ...txnShape,
});

const VerifyEntry = z.looseObject({
  mihpayid: opt(64),
  txnid: opt(128),
  status: z.string().trim().min(1).max(32),
  ...txnShape,
});

const Verify = z.looseObject({
  status: z.union([z.number().int(), z.string().max(8)]),
  msg: z.string().max(2000),
  transaction_details: z.record(z.string(), z.unknown()),
});

const Command = z.looseObject({
  status: z.union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1")]),
  msg: z.string().max(2000),
  mihpayid: z.string().max(64).nullable().optional(),
  request_id: z.string().max(128).nullable().optional(),
  txn_update_id: z.string().max(128).nullable().optional(),
  error_code: z
    .union([z.string().max(16), z.number().int()])
    .nullable()
    .optional(),
});

export type TxnFields = z.infer<typeof VerifyEntry>;

export type PayuIndiaParsed =
  | { kind: "payment_response"; value: TxnFields }
  | {
      kind: "verify_payment";
      apiStatus: string;
      msg: string;
      entries: { key: string; index: number; notFound: boolean; value: TxnFields }[];
    }
  | { kind: "command_response"; value: z.infer<typeof Command> };

function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((i) => {
    const p = [prefix, ...i.path.map(String)].filter(Boolean).join(".");
    return `${p || "(root)"}: ${i.message}`;
  });
}

/**
 * The parsed JSON form of the response can carry numbers; form data only
 * strings. Numbers are read as their decimal text when they are exact.
 */
function txnRecord(input: Obj, prefix: string): { value: Obj; issues: string[] } {
  const value: Obj = { ...input };
  const issues: string[] = [];
  for (const k of TXN_FIELDS) {
    const v = input[k];
    if (Array.isArray(v)) issues.push(`${prefix}${k}: appears more than once`);
    else if (typeof v === "number") {
      if (Number.isSafeInteger(v) || (Number.isFinite(v) && !Number.isInteger(v)))
        value[k] = String(v);
      else issues.push(`${prefix}${k}: number too large to read exactly; paste it as a string`);
    } else if (v === null) delete value[k];
  }
  return { value, issues };
}

const MAX_VERIFY_ENTRIES = 500;

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PayuIndiaParsed } | { ok: false; issues: string[] } {
  if (!isObj(input))
    return { ok: false, issues: ["(root): expected an object or a set of form fields"] };

  if (format === PAYU_INDIA_FORMATS.paymentResponse) {
    const pre = txnRecord(input, "");
    if (pre.issues.length) return { ok: false, issues: pre.issues };
    const r = PaymentResponse.safeParse(pre.value);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "payment_response", value: r.data } };
  }

  if (format === PAYU_INDIA_FORMATS.verifyPayment) {
    const r = Verify.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    const keys = Object.keys(r.data.transaction_details);
    if (keys.length > MAX_VERIFY_ENTRIES)
      return {
        ok: false,
        issues: [`transaction_details: more than ${MAX_VERIFY_ENTRIES} entries`],
      };
    const issues: string[] = [];
    const entries: Extract<PayuIndiaParsed, { kind: "verify_payment" }>["entries"] = [];
    keys.forEach((key, index) => {
      const label = safeId(key, 128) ?? `[${index}]`;
      const raw = r.data.transaction_details[key];
      if (!isObj(raw)) {
        issues.push(`transaction_details.${label}: expected an object`);
        return;
      }
      const pre = txnRecord(raw, `transaction_details.${label}.`);
      if (pre.issues.length) {
        issues.push(...pre.issues);
        return;
      }
      const e = VerifyEntry.safeParse(pre.value);
      if (!e.success) {
        issues.push(...issuesOf(e.error, `transaction_details.${label}`));
        return;
      }
      const notFound =
        e.data.mihpayid?.trim().toLowerCase() === "not found" ||
        e.data.status.trim().toLowerCase() === "not found";
      entries.push({ key, index, notFound, value: e.data });
    });
    if (issues.length) return { ok: false, issues };
    return {
      ok: true,
      value: {
        kind: "verify_payment",
        apiStatus: String(r.data.status).trim(),
        msg: r.data.msg,
        entries,
      },
    };
  }

  if (format === PAYU_INDIA_FORMATS.commandResponse) {
    const r = Command.safeParse(input);
    if (!r.success) return { ok: false, issues: issuesOf(r.error) };
    return { ok: true, value: { kind: "command_response", value: r.data } };
  }

  return { ok: false, issues: [`Unsupported PayU India format "${format}".`] };
}

// ---------------------------------------------------------------------------
// Code decoding

export type CodeFamily =
  "payment" | "other" | "subscription" | "alt_id" | "authn_authz_mapping" | "refund_initiation";

export type CodeDecoding = {
  code: string;
  /** Documented table the code was decoded from; null when unknown. */
  family: CodeFamily | null;
  entry: CodeEntry | undefined;
  confidence: Confidence;
  missing: string[];
};

const ERROR_DOCS: DocumentationLink[] = [
  { title: "PayU India error codes", url: ERROR_CODES_URL },
  { title: "PayU India payment states", url: PAYMENT_STATES_URL },
];

/** Decodes a PayU gateway code from `error` / `error_code` of a payment. */
export function decodePaymentCode(raw: string): CodeDecoding {
  const code = raw.trim();
  const tables: [CodeFamily, Readonly<Record<string, CodeEntry>>][] = [
    ["payment", PAYMENT_ERROR_CODES],
    ["other", OTHER_ERROR_CODES],
    ["subscription", SUBSCRIPTION_ERROR_CODES],
    ["alt_id", ALT_ID_ERROR_CODES],
    ["authn_authz_mapping", AUTH_MAPPING_CODES],
  ];
  for (const [family, table] of tables) {
    const entry = lookup(table, code);
    if (!entry) continue;
    const missing: string[] = [];
    let confidence: Confidence = "strong";
    if (entry.conflict) {
      confidence = "possible";
      missing.push(
        `PayU lists code ${code} more than once with different texts; the payload does not say which one applies.`,
      );
    }
    if (family === "authn_authz_mapping") {
      confidence = entry.undocumented ? "insufficient" : "possible";
      missing.push(
        entry.undocumented
          ? `Code ${code} appears only in PayU's card authentication and authorization mapping tables, without a meaning.`
          : `Code ${code} appears only in PayU's card authentication and authorization mapping tables; its meaning is inferred from the bank texts mapped to it.`,
      );
    }
    return { code, family, entry, confidence, missing };
  }
  const missing = [
    `Code "${safeText(code, 40) ?? ""}" is not in the PayU India code tables used by PandaPayLens.`,
  ];
  if (code === "E4936")
    missing.push(
      "E4936 appears in a PayU Verify Payment example but in none of PayU's code tables, so its meaning is not documented.",
    );
  return { code, family: null, entry: undefined, confidence: "insufficient", missing };
}

/** Decodes a refund initiation status code (`error_code` of a refund request). */
export function decodeRefundCode(raw: string): CodeDecoding {
  const code = raw.trim();
  const entry = lookup(REFUND_INITIATION_CODES, code);
  if (entry) return { code, family: "refund_initiation", entry, confidence: "strong", missing: [] };
  return {
    code,
    family: null,
    entry: undefined,
    confidence: "insufficient",
    missing: [
      `error_code "${safeText(code, 16) ?? ""}" is not in PayU's refund initiation code table.`,
    ],
  };
}

function field7Of(v: string | undefined): { value?: string; stage?: Field7Stage } {
  const t = v?.trim();
  if (!t) return {};
  const stage = lookup(FIELD7_STAGES, t);
  if (stage) return { value: t, stage };
  if (UNDESCRIBED_FIELD7_VALUES.includes(t)) return { value: t };
  return {};
}

// ---------------------------------------------------------------------------
// Normalization

function base(ctx: NormalizeContext, path = "") {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

/** Documented spelling of an unmappedstatus key, used in event types. */
const STATE_NAMES: Record<string, string> = {
  "in progress": "in_progress",
  usercancelled: "userCancelled",
  autorefund: "autoRefund",
};

type TxnView = {
  statusKey: string;
  unmappedKey?: string;
  statusKnown: boolean;
  stateKnown: boolean;
  consistent: boolean;
  outcome: Outcome;
  stage: NormalizedEventDraft["stage"];
  name: string;
  payuId?: string;
  code?: string;
  codeField: "error" | "error_code";
  field7: { value?: string; stage?: Field7Stage };
};

function viewOf(r: TxnFields, codeField: "error" | "error_code"): TxnView {
  const statusKey = r.status.trim().toLowerCase();
  const unmappedKey = nonEmpty(r.unmappedstatus)
    ? r.unmappedstatus.trim().toLowerCase()
    : undefined;
  const statusInfo = lookup(PAYMENT_STATUSES, statusKey);
  const stateInfo = unmappedKey !== undefined ? lookup(PAYMENT_STATES, unmappedKey) : undefined;
  const canonical = statusKey === "failed" ? "failure" : statusKey;
  const consistent = !statusInfo || !stateInfo || stateInfo.status === canonical;
  const outcome: Outcome = !statusInfo ? "unknown" : consistent ? statusInfo.outcome : "unknown";
  const stage = stateInfo?.stage ?? (statusInfo ? "payment" : "other");
  const name = stateInfo
    ? (STATE_NAMES[unmappedKey!] ?? unmappedKey!)
    : statusInfo
      ? statusKey
      : "unknown";
  const rawCode = codeField === "error" ? (r.error ?? r.error_code) : (r.error_code ?? r.error);
  return {
    statusKey,
    ...(unmappedKey !== undefined ? { unmappedKey } : {}),
    statusKnown: Boolean(statusInfo),
    stateKnown: unmappedKey === undefined || Boolean(stateInfo),
    consistent,
    outcome,
    stage,
    name,
    ...(r.mihpayid ? { payuId: safeId(r.mihpayid.trim(), 64) } : {}),
    ...(nonEmpty(rawCode) ? { code: rawCode.trim() } : {}),
    codeField,
    field7: field7Of(r.field7),
  };
}

function txnEvent(
  r: TxnFields,
  v: TxnView,
  ctx: NormalizeContext,
  prefix: "payment" | "verify_payment",
  path = "",
  merchantKey?: string,
): NormalizedEventDraft {
  const mode = pattern(r.mode, /^[A-Z0-9_]{1,16}$/);
  const amount = pattern(r.amount ?? r.amt ?? r.transaction_amount, DECIMAL);
  const amountField =
    amount === undefined
      ? undefined
      : r.amount !== undefined
        ? "amount"
        : r.amt !== undefined
          ? "amt"
          : "transaction_amount";
  const message = scrub(r.error_Message ?? r.error_message, 200);
  return clean({
    ...base(ctx, path),
    eventType: `${prefix}.${v.name}`,
    eventTypeKnown: v.statusKnown && v.stateKnown,
    stage: v.stage,
    providerStatus: `status=${safeText(r.status.trim(), 32) ?? ""}${
      v.unmappedKey !== undefined
        ? `; unmappedstatus=${safeText(r.unmappedstatus!.trim(), 32)}`
        : ""
    }`,
    paymentReference: v.payuId,
    merchantReference: safeId(r.txnid?.trim() ?? merchantKey, 128),
    outcome: v.outcome,
    attributes: attrs({
      status: safeText(r.status.trim(), 32),
      unmappedStatus:
        v.unmappedKey !== undefined ? safeText(r.unmappedstatus!.trim(), 32) : undefined,
      statusMeaning: lookup(PAYMENT_STATUSES, v.statusKey)?.meaning,
      stateMeaning:
        v.unmappedKey !== undefined ? lookup(PAYMENT_STATES, v.unmappedKey)?.meaning : undefined,
      statusConsistent: v.consistent ? undefined : false,
      payuId: v.payuId,
      errorCode: v.code !== undefined ? safeId(v.code, 16) : undefined,
      errorMessage: v.outcome === "success" ? undefined : message,
      field7: v.field7.value,
      field7Stage: v.field7.stage?.meaning,
      mode,
      modeMeaning: mode !== undefined ? lookup(PAYMENT_MODES, mode) : undefined,
      pgType: pattern(r.PG_TYPE, /^[A-Za-z0-9_-]{1,32}$/),
      bankcode: pattern(r.bankcode, /^[A-Za-z0-9_]{1,24}$/),
      paymentSource: pattern(r.payment_source, /^[A-Za-z0-9_]{1,32}$/),
      cardCategory: pattern(r.cardCategory, /^[a-z]{1,24}$/),
      threeDSVersion: pattern(r.threeDSVersion, /^\d{1,2}(?:\.\d{1,2}){0,3}$/),
      routedVia: pattern(r.pa_name, /^[A-Za-z][A-Za-z0-9 ._-]{0,39}$/),
      amount,
      amountField,
      netAmountDebit: pattern(r.net_amount_debit, DECIMAL),
      addedOn: pattern(r.addedon, ADDED_ON),
      addedOnTimeZone: pattern(r.addedon, ADDED_ON) ? "not_documented" : undefined,
      bankReferencePresent: nonEmpty(r.bank_ref_num) || nonEmpty(r.bank_ref_no) ? true : undefined,
      hash: prefix === "payment" ? hashClass(r.hash) : undefined,
      signatureVerified: prefix === "payment" ? false : undefined,
    }),
  });
}

function notFoundEvent(
  key: string,
  ctx: NormalizeContext,
  path: string,
  apiStatus: string,
): NormalizedEventDraft {
  return clean({
    ...base(ctx, path),
    eventType: "verify_payment.not_found",
    eventTypeKnown: true,
    stage: "payment",
    providerStatus: "status=Not Found",
    merchantReference: safeId(key, 128),
    outcome: "unknown",
    attributes: attrs({
      lookupResult: "not_found",
      apiStatus: safeText(apiStatus, 8),
    }),
  });
}

function entryPath(key: string, index: number) {
  const k = safeId(key, 128);
  return k !== undefined && /^[A-Za-z0-9_-]+$/.test(k)
    ? `transaction_details.${k}`
    : `transaction_details[${index}]`;
}

type CommandView = {
  apiStatus: "0" | "1";
  operation: "refund" | "capture" | "cancel" | null;
  msgKnown: boolean;
  payuId?: string;
  code?: string;
  refund?: CodeDecoding;
  outcome: Outcome;
};

function commandView(r: z.infer<typeof Command>): CommandView {
  const apiStatus = String(r.status) as "0" | "1";
  const info = lookup(COMMAND_MESSAGES, r.msg.trim().toLowerCase());
  const operation = info?.operation ?? null;
  const code =
    r.error_code === null || r.error_code === undefined ? undefined : String(r.error_code).trim();
  const refund = operation === "refund" && nonEmpty(code) ? decodeRefundCode(code) : undefined;
  let outcome: Outcome;
  if (refund?.entry) outcome = lookup(REFUND_CODE_STATES, refund.code) ?? "failure";
  else if (apiStatus === "0") outcome = "failure";
  // Accepted means queued: the refund, capture or cancel is not done yet.
  else outcome = operation ? "pending" : "unknown";
  return {
    apiStatus,
    operation,
    msgKnown: Boolean(info),
    ...(nonEmpty(r.mihpayid) ? { payuId: safeId(r.mihpayid.trim(), 64) } : {}),
    ...(nonEmpty(code) ? { code } : {}),
    ...(refund ? { refund } : {}),
    outcome,
  };
}

const COMMAND_STAGE = { refund: "refund", capture: "capture", cancel: "cancellation" } as const;

function commandEvent(r: z.infer<typeof Command>, ctx: NormalizeContext): NormalizedEventDraft {
  const v = commandView(r);
  const stage = v.operation ? COMMAND_STAGE[v.operation] : v.apiStatus === "0" ? "error" : "other";
  return clean({
    ...base(ctx),
    eventType: v.operation
      ? `command.${v.operation}_request`
      : v.apiStatus === "0"
        ? "command.rejected"
        : "command.unknown",
    eventTypeKnown: v.msgKnown,
    stage,
    providerStatus: `status=${v.apiStatus}${v.code !== undefined ? `; error_code=${safeId(v.code, 16) ?? ""}` : ""}`,
    paymentReference: v.payuId,
    relatedReference: nonEmpty(r.request_id) ? safeId(r.request_id.trim(), 128) : undefined,
    outcome: v.outcome,
    attributes: attrs({
      apiStatus: v.apiStatus,
      msg: v.msgKnown ? r.msg.trim() : scrub(r.msg, 120),
      msgDocumented: v.msgKnown,
      operation: v.operation ?? "not_determined",
      payuId: v.payuId,
      requestId: nonEmpty(r.request_id) ? safeId(r.request_id.trim(), 128) : undefined,
      txnUpdateId: nonEmpty(r.txn_update_id) ? safeId(r.txn_update_id.trim(), 128) : undefined,
      errorCode: v.code !== undefined ? safeId(v.code, 16) : undefined,
      errorCodeMeaning: v.refund?.entry?.meaning,
    }),
  });
}

function normalize(parsed: PayuIndiaParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "payment_response":
      return [txnEvent(parsed.value, viewOf(parsed.value, "error"), ctx, "payment")];
    case "verify_payment":
      return parsed.entries.map((e) => {
        const path = entryPath(e.key, e.index);
        return e.notFound
          ? notFoundEvent(e.key, ctx, path, parsed.apiStatus)
          : txnEvent(e.value, viewOf(e.value, "error_code"), ctx, "verify_payment", path, e.key);
      });
    case "command_response":
      return [commandEvent(parsed.value, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Error decoding

const FIELD7_RETRY: Partial<Record<string, CodeEntry["retry"]>> = {
  card_declined: "customer_action_required",
  authentication_failed: "customer_action_required",
  payment_method_unavailable: "customer_action_required",
  invalid_request: "do_not_retry",
  network_or_timeout: "retry_conditionally",
  provider_unavailable: "retry_conditionally",
};

function txnErrors(
  r: TxnFields,
  v: TxnView,
  ctx: NormalizeContext,
  path = "",
): DecodedErrorDraft[] {
  if (v.statusKey === "success" || !v.statusKnown) return [];
  const failed = v.outcome === "failure";
  const pending = v.statusKey === "pending";
  const uncertain =
    !failed ||
    v.unmappedKey === "dropped" ||
    (v.field7.stage?.kind === "error" && v.field7.stage.category === "network_or_timeout");
  const subCodes: Record<string, string> = {
    field: v.codeField,
    status: safeText(r.status.trim(), 32) ?? "",
  };
  if (v.unmappedKey !== undefined)
    subCodes.unmappedstatus = safeText(r.unmappedstatus!.trim(), 32) ?? "";
  if (v.field7.value) subCodes.field7 = v.field7.value;
  const f8 = scrub(r.field8, 200);
  const f9 = scrub(r.field9, 200);
  if (f8) subCodes.field8 = f8;
  if (f9) subCodes.field9 = f9;
  const providerMessage = scrub(r.error_Message ?? r.error_message, 300);
  const common = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path },
    ...(providerMessage ? { providerMessage } : {}),
    ...(v.payuId ? { paymentReference: v.payuId, attemptReference: v.payuId } : {}),
    outcomeKnown: !uncertain,
  };
  const missing: string[] = [];
  if (v.field7.value && !v.field7.stage)
    missing.push(`Field7 value ${v.field7.value} is used by PayU but not described.`);
  if (!v.consistent)
    missing.push(
      "status and unmappedstatus contradict PayU's payment state table; verify the payment before acting.",
    );
  if (pending)
    missing.push(
      "The payment is pending; PayU sends a later webhook or the Verify Payment API shows the final state.",
    );

  if (v.code === undefined || v.code === "E000") {
    if (pending) return [];
    const stage = v.field7.stage;
    if (stage?.category) {
      const retry = FIELD7_RETRY[stage.category] ?? "unknown";
      return [
        {
          ...common,
          code: v.field7.value!,
          subCodes: { ...subCodes, field: "field7" },
          category: stage.category,
          explanation: `PayU reports the payment as failed at the stage "${v.field7.value}": ${stage.meaning}.${
            v.code === "E000"
              ? " The error field says E000 (no error), so only Field7 gives a reason."
              : ""
          }`,
          nextAction: NEXT_ACTION[stage.category],
          retry,
          retryExplanation: RETRY_EXPLANATION[retry],
          confidence: "possible",
          documentation: [...ERROR_DOCS],
          missingInformation: [
            ...missing,
            "No PayU error code explains this failure; the category and retry guidance come from the Field7 stage only.",
          ],
        },
      ];
    }
    return [
      {
        ...common,
        code: v.code ?? v.name,
        subCodes,
        category: "unknown",
        explanation:
          v.code === "E000"
            ? "PayU reports the payment as failed, but the error field says E000 (no error)."
            : "PayU reports the payment as failed without an error code.",
        nextAction: NEXT_ACTION.unknown,
        retry: "unknown",
        retryExplanation: RETRY_EXPLANATION.unknown,
        confidence: "insufficient",
        documentation: [...ERROR_DOCS],
        missingInformation: [
          ...missing,
          "Neither the error field nor Field7 gives a reason for the failure.",
        ],
      },
    ];
  }

  const d = decodePaymentCode(v.code);
  if (pending && d.entry?.informational) return [];
  const entry = d.entry;
  const category = entry?.category ?? "unknown";
  const retry = entry?.retry ?? "unknown";
  const explanation = entry
    ? `PayU code ${d.code}: ${entry.meaning}.${
        entry.informational
          ? " PayU lists this code as a success or informational value, not as an error."
          : ""
      }${v.field7.stage ? ` Field7 ${v.field7.value}: ${v.field7.stage.meaning}.` : ""}`
    : `PandaPayLens does not recognize PayU code ${safeText(d.code, 40) ?? ""}.`;
  return [
    {
      ...common,
      code: d.code,
      subCodes: d.family ? { ...subCodes, table: d.family } : subCodes,
      category,
      explanation,
      nextAction: NEXT_ACTION[category],
      retry,
      retryExplanation: RETRY_EXPLANATION[retry],
      confidence: d.confidence,
      documentation: [...ERROR_DOCS],
      missingInformation: [...missing, ...d.missing],
    },
  ];
}

const COMMAND_MESSAGE_ERRORS: Readonly<Record<string, string>> = {
  "token is empty": "The request did not carry the token (refund reference) PayU needs.",
  "parameter missing": "A required request parameter is missing.",
  "merchant key is empty": "The request did not carry the merchant key.",
  "transaction not exists": "PayU did not find the transaction named in the request.",
};

function commandErrors(r: z.infer<typeof Command>, ctx: NormalizeContext): DecodedErrorDraft[] {
  const v = commandView(r);
  const common = {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(v.payuId ? { paymentReference: v.payuId } : {}),
    ...(nonEmpty(r.request_id)
      ? { attemptReference: safeId(r.request_id.trim(), 128) ?? undefined }
      : {}),
    outcomeKnown: true,
  };
  const msg = scrub(r.msg, 300);
  const refundDocs: DocumentationLink[] = [
    { title: "PayU India refund initiation codes", url: REFUND_INITIATION_CODES_URL },
    { title: "PayU India Refund Transaction API", url: REFUND_API_URL },
  ];

  if (v.refund) {
    if (v.outcome !== "failure") return [];
    const entry = v.refund.entry;
    const category = entry?.category ?? "unknown";
    const retry = entry?.retry ?? "unknown";
    return [
      cleanError({
        ...common,
        code: v.refund.code,
        subCodes: {
          field: "error_code",
          status: v.apiStatus,
          operation: "refund",
          ...(v.refund.family ? { table: v.refund.family } : {}),
        },
        category,
        ...(msg ? { providerMessage: msg } : {}),
        explanation: entry
          ? `PayU refund initiation code ${v.refund.code}: ${entry.meaning}.`
          : `PandaPayLens does not recognize refund initiation code ${safeText(v.refund.code, 16) ?? ""}.`,
        nextAction: NEXT_ACTION[category],
        retry,
        retryExplanation: RETRY_EXPLANATION[retry],
        confidence: v.refund.confidence,
        documentation: refundDocs,
        missingInformation: v.refund.missing,
      }),
    ];
  }

  if (v.apiStatus !== "0" && v.code === undefined) return [];
  if (v.code !== undefined) {
    if (v.apiStatus !== "0") return [];
    return [
      cleanError({
        ...common,
        code: v.code,
        subCodes: {
          field: "error_code",
          status: v.apiStatus,
          operation: v.operation ?? "not_determined",
        },
        category: "unknown",
        ...(msg ? { providerMessage: msg } : {}),
        explanation:
          "PayU rejected the request with an error code. The code table depends on the command (refund and capture codes reuse the same numbers), and this response does not show which command it answers.",
        nextAction: NEXT_ACTION.unknown,
        retry: "unknown",
        retryExplanation: RETRY_EXPLANATION.unknown,
        confidence: "insufficient",
        documentation: refundDocs,
        missingInformation: [
          "The msg does not name the command, so the error_code cannot be decoded reliably.",
        ],
      }),
    ];
  }

  const known = lookup(COMMAND_MESSAGE_ERRORS, r.msg.trim().toLowerCase());
  return [
    cleanError({
      ...common,
      code: "status=0",
      subCodes: { field: "status", operation: v.operation ?? "not_determined" },
      category: known ? "invalid_request" : "unknown",
      ...(msg ? { providerMessage: msg } : {}),
      explanation: known
        ? `PayU rejected the request: ${known}`
        : "PayU rejected the request (status 0). Only the msg text describes the reason.",
      nextAction: known ? NEXT_ACTION.invalid_request : NEXT_ACTION.unknown,
      retry: known ? "do_not_retry" : "unknown",
      retryExplanation: known ? RETRY_EXPLANATION.do_not_retry : RETRY_EXPLANATION.unknown,
      confidence: known ? "possible" : "insufficient",
      documentation: refundDocs,
      missingInformation: [
        "The command API reports this failure only as msg text, without an error code.",
      ],
    }),
  ];
}

function cleanError(d: DecodedErrorDraft): DecodedErrorDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as DecodedErrorDraft;
}

function decodeErrors(parsed: PayuIndiaParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  switch (parsed.kind) {
    case "payment_response":
      return txnErrors(parsed.value, viewOf(parsed.value, "error"), ctx);
    case "verify_payment":
      return parsed.entries
        .filter((e) => !e.notFound)
        .flatMap((e) =>
          txnErrors(e.value, viewOf(e.value, "error_code"), ctx, entryPath(e.key, e.index)),
        );
    case "command_response":
      return commandErrors(parsed.value, ctx);
  }
}

export const payuIndiaAdapter: ProviderAdapter<PayuIndiaParsed> = {
  id: "payu_india",
  displayName: "PayU India",
  version: PAYU_INDIA_ADAPTER_VERSION,
  manifest: payuIndiaManifest,
  supportedFormats: [
    {
      id: PAYU_INDIA_FORMATS.paymentResponse,
      description:
        "Payment response posted to surl / furl / curl and the payment webhook (mihpayid, txnid, status, unmappedstatus, error, error_Message, field7-field9)",
    },
    {
      id: PAYU_INDIA_FORMATS.verifyPayment,
      description: "Verify Payment API JSON (status, msg, transaction_details keyed by txnid)",
    },
    {
      id: PAYU_INDIA_FORMATS.commandResponse,
      description:
        "Command API JSON of refund, capture and cancel requests (status, msg, mihpayid, request_id, error_code)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // mihpayid is PayU's transaction id: the payment response, the webhook,
    // Verify Payment entries and refund or capture requests all carry it.
    // txnid is the merchant's order reference and is not used.
    return event.paymentReference ? [`mihpayid:${event.paymentReference}`] : [];
  },
};

export * from "./catalog.js";
export default payuIndiaAdapter;
