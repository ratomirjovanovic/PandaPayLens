/**
 * Paymentwall adapter.
 *
 * Supported input families:
 * - `paymentwall.pingback`             pingback query string (uid, type, ref, sig, ...)
 * - `paymentwall.brick.error`          Brick error JSON { type: "Error", error, code }
 * - `paymentwall.brick.sdk_error`      PHP SDK envelope { success: 0, error: { message, code } }
 * - `paymentwall.brick.charge`         Brick charge object
 * - `paymentwall.brick.subscription`   Brick subscription object
 * - `paymentwall.brick.3ds`            Brick 3-D Secure step { success: 0, secure: {...} }
 * - `paymentwall.mobiamo.error`        Mobiamo error (W codes)
 * - `paymentwall.mobiamo.response`     Mobiamo payment response (ref, flow, completed)
 * - `paymentwall.error.unidentified`   { code, error | message } whose product family the
 *                                      structure does not show; scored below the analysis
 *                                      threshold, so it is analyzed only when Paymentwall is
 *                                      selected manually
 *
 * Recognized but not supported: `paymentwall.client_callback` (browser postMessage events).
 *
 * Detection relies on field structure only. Terminal3 uses the same formats
 * and cannot be told apart; it is treated as the Paymentwall family.
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
  APIS_URL,
  BRICK_PAYMENT_ERRORS,
  BRICK_TOKEN_ERRORS,
  CHARGE_RISK_VALUES,
  CLIENT_EVENTS,
  codeCandidates,
  FAMILY_DOCS,
  FAMILY_LABELS,
  MOBIAMO_CODES,
  MOBIAMO_FLOWS,
  NEGATIVE_REASONS,
  PINGBACK_TYPES,
  SIGN_VERSIONS,
  type CodeEntry,
  type CodeFamily,
} from "./catalog.js";
import { paymentwallManifest, PAYMENTWALL_ADAPTER_VERSION } from "./manifest.js";

export { paymentwallManifest, PAYMENTWALL_ADAPTER_VERSION };

export const PAYMENTWALL_FORMATS = {
  pingback: "paymentwall.pingback",
  brickError: "paymentwall.brick.error",
  sdkError: "paymentwall.brick.sdk_error",
  charge: "paymentwall.brick.charge",
  subscription: "paymentwall.brick.subscription",
  threeDS: "paymentwall.brick.3ds",
  mobiamoError: "paymentwall.mobiamo.error",
  mobiamoResponse: "paymentwall.mobiamo.response",
  unidentifiedError: "paymentwall.error.unidentified",
  clientCallback: "paymentwall.client_callback",
} as const;

// ---------------------------------------------------------------------------
// Helpers

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Obj, k: string) => Object.hasOwn(o, k);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);
const documented = (list: readonly string[], v: unknown) =>
  typeof v === "string" && list.includes(v) ? v : undefined;
const round = (n: number) => Math.round(Math.min(n, 0.98) * 100) / 100;

/** Form data arrives as strings, or string arrays for repeated keys. */
function isFlatStrings(o: Obj): boolean {
  return Object.values(o).every(
    (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string")),
  );
}

/** Numeric codes, or Mobiamo `W` codes. Codes are numbers in the samples, strings are accepted. */
function codeOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (/^-?\d{1,6}$/.test(t) || /^W\d{1,2}$/.test(t)) return t;
  }
  return undefined;
}

/** Paymentwall uses 0/1 integers for flags; booleans and strings are accepted too. */
function boolish(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "1" || t === "true") return true;
    if (t === "0" || t === "false") return false;
  }
  return undefined;
}

const isFailureFlag = (v: unknown) => boolish(v) === false;

/** Brick ids are numeric strings in the samples; numbers are accepted too. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return String(v);
  return safeId(v, 64);
}

const digits = (v: unknown, max = 6) =>
  typeof v === "string" && new RegExp(`^\\d{1,${max}}$`).test(v) ? v : undefined;
const word = (v: unknown) => (typeof v === "string" && /^[a-z]{1,12}$/i.test(v) ? v : undefined);

function signatureClass(sig: unknown): string {
  if (typeof sig !== "string" || sig === "") return "absent";
  if (/^[0-9a-f]{64}$/i.test(sig)) return "present_sha256_length";
  if (/^[0-9a-f]{32}$/i.test(sig)) return "present_md5_length";
  return "present_other";
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(values: Record<string, SafePrimitive | SafePrimitive[] | undefined>): Attrs {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Attrs;
}

function money(amount: unknown, currency: unknown) {
  const cur = upperCurrency(currency);
  const amountMinor = decimalToMinor(amount, cur);
  return { amountMinor, currency: amountMinor !== undefined ? cur : undefined };
}

const isBrickCode = (code: string) =>
  lookup(BRICK_PAYMENT_ERRORS, code) !== undefined ||
  lookup(BRICK_TOKEN_ERRORS, code) !== undefined;

// ---------------------------------------------------------------------------
// Detection

const BRICK_ERROR_KEYS = new Set(["type", "error", "code"]);
const UNIDENTIFIED_KEYS = new Set(["code", "error", "message", "success"]);

function detectJson(input: Obj, meta: RecordMeta | undefined): DetectionResult | null {
  const base = { provider: "paymentwall", supported: true };

  // Brick error JSON: { "code": 3002, "error": "Wrong charge amount", "type": "Error" }.
  if (input.type === "Error" && typeof input.error === "string") {
    const code = codeOf(input.code);
    if (code !== undefined) {
      let c = 0.6;
      const reasons = ['type "Error" with error text and a numeric code, like a Brick error'];
      if (isBrickCode(code)) {
        c += 0.25;
        reasons.push(`code ${code} is a documented Brick error code`);
      } else if (codeCandidates(code).length > 0) c += 0.1;
      if (Object.keys(input).every((k) => BRICK_ERROR_KEYS.has(k))) c += 0.05;
      const status = meta?.http?.status;
      if (status !== undefined && status >= 400 && status < 500) c += 0.05;
      return { ...base, format: PAYMENTWALL_FORMATS.brickError, confidence: round(c), reasons };
    }
  }

  // Client-side postMessage events.
  if (
    oneOf(CLIENT_EVENTS, input.event) &&
    Object.keys(input).every((k) => k === "event" || k === "data")
  ) {
    let c = 0.6;
    if (isObj(input.data)) c += 0.15;
    return {
      ...base,
      format: PAYMENTWALL_FORMATS.clientCallback,
      confidence: round(c),
      supported: false,
      reasons: [`event "${String(input.event)}" is a documented client-side callback event`],
      unsupportedReason:
        "This looks like a client-side postMessage event from the payment widget. It comes from the browser and is not an authoritative payment result. Paste the pingback or the Brick API response instead.",
    };
  }

  const failedFlag = isFailureFlag(input.success);

  // Brick 3-D Secure step.
  const secure = input.secure;
  if (
    failedFlag &&
    isObj(secure) &&
    (typeof secure.redirect === "string" || typeof secure.formHTML === "string")
  ) {
    const c = typeof secure.formHTML === "string" ? 0.8 : 0.65;
    return {
      ...base,
      format: PAYMENTWALL_FORMATS.threeDS,
      confidence: c,
      reasons: ["success 0 with secure.redirect or secure.formHTML, like a Brick 3-D Secure step"],
    };
  }

  // Brick charge object.
  if (input.object === "charge") {
    const card = input.card;
    const marks = [
      has(input, "amount_paid"),
      has(input, "currency_paid"),
      has(input, "support_link"),
      typeof input.risk === "string",
      isObj(card) && has(card, "token"),
    ].filter(Boolean).length;
    if (marks >= 2) {
      let c = 0.45 + 0.12 * marks;
      if (typeof input.amount === "string" && /^\d+(?:\.\d+)?$/.test(input.amount)) c += 0.03;
      return {
        ...base,
        format: PAYMENTWALL_FORMATS.charge,
        confidence: round(c),
        reasons: [
          `object "charge" with ${marks} Brick charge fields (amount_paid, currency_paid, support_link, risk, card.token)`,
        ],
      };
    }
  }

  // Brick subscription object.
  if (input.object === "subscription") {
    const marks = [
      has(input, "period_duration"),
      has(input, "payments_limit"),
      has(input, "date_next"),
      has(input, "date_started"),
      has(input, "is_trial"),
      Array.isArray(input.charges),
    ].filter(Boolean).length;
    if (marks >= 2) {
      return {
        ...base,
        format: PAYMENTWALL_FORMATS.subscription,
        confidence: round(0.45 + 0.1 * marks),
        reasons: [
          `object "subscription" with ${marks} Brick subscription fields (period_duration, payments_limit, date_next, date_started, is_trial, charges)`,
        ],
      };
    }
  }

  // PHP SDK error envelope.
  const err = input.error;
  if (failedFlag && isObj(err) && typeof err.message === "string") {
    const code = codeOf(err.code);
    if (code !== undefined) {
      let c = 0.4;
      const reasons = ["success 0 with error.message and error.code, like the PHP SDK envelope"];
      if (input.success === 0) c += 0.05;
      if (isBrickCode(code)) {
        c += 0.15;
        reasons.push(`code ${code} is a documented Brick error code`);
      } else if (codeCandidates(code).length > 0) c += 0.05;
      return { ...base, format: PAYMENTWALL_FORMATS.sdkError, confidence: round(c), reasons };
    }
  }

  // Mobiamo error with a W code.
  if (typeof input.code === "string" && /^W\d{1,2}$/.test(input.code.trim())) {
    if (typeof input.error === "string") {
      let c = 0.6;
      const reasons = [`code "${input.code.trim()}" has the Mobiamo W code form, with error text`];
      if (lookup(MOBIAMO_CODES, input.code.trim())) {
        c += 0.2;
        reasons.push("the code is a documented Mobiamo response code");
      }
      if (has(input, "success")) c += 0.05;
      return { ...base, format: PAYMENTWALL_FORMATS.mobiamoError, confidence: round(c), reasons };
    }
  }

  // Mobiamo payment response.
  if (typeof input.ref === "string") {
    if (oneOf(MOBIAMO_FLOWS, input.flow)) {
      let c = 0.55;
      if (has(input, "instructions")) c += 0.1;
      if (has(input, "price")) c += 0.05;
      if (has(input, "success")) c += 0.05;
      return {
        ...base,
        format: PAYMENTWALL_FORMATS.mobiamoResponse,
        confidence: round(c),
        reasons: [`ref with flow "${String(input.flow)}", a documented Mobiamo flow`],
      };
    }
    if (typeof input.completed === "boolean") {
      // ref + completed is too generic to be analyzed without a manual selection.
      return {
        ...base,
        format: PAYMENTWALL_FORMATS.mobiamoResponse,
        confidence: 0.45,
        reasons: ["ref with a completed flag, like a Mobiamo payment result"],
      };
    }
  }

  // An error code without a structure that shows the product family.
  const code = codeOf(input.code);
  if (
    code !== undefined &&
    (typeof input.error === "string" || typeof input.message === "string") &&
    Object.keys(input).every((k) => UNIDENTIFIED_KEYS.has(k))
  ) {
    const known = codeCandidates(code).length > 0;
    return {
      ...base,
      format: PAYMENTWALL_FORMATS.unidentifiedError,
      confidence: known ? 0.3 : 0.1,
      reasons: [
        known
          ? `generic error shape; code ${code} is documented by Paymentwall (product family not shown)`
          : "generic error shape with a code",
      ],
      unsupportedReason:
        "This is a generic error shape. If it comes from Paymentwall (for example MINT, whose error envelope is not documented), select Paymentwall manually to list the documented meanings of the code.",
    };
  }
  return null;
}

const SIGNATURE_HEX = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/i;

function detectPingback(f: Obj): DetectionResult | null {
  if (!isFlatStrings(f)) return null;
  if (!has(f, "ref") || !has(f, "type") || !(has(f, "uid") || has(f, "sig"))) return null;
  let c = 0.35;
  const reasons = ["has ref and type with uid or sig, like a pingback"];
  if (has(f, "uid")) c += 0.1;
  const sig = str(f.sig);
  if (sig !== undefined && SIGNATURE_HEX.test(sig)) {
    c += 0.15;
    reasons.push("sig has the length of an MD5 or SHA-256 hex signature");
  } else if (sig !== undefined && sig !== "") c += 0.05;
  const type = str(f.type);
  if (lookup(PINGBACK_TYPES, type)) {
    c += 0.15;
    reasons.push(`type ${type} is a documented pingback type`);
  }
  if (lookup(SIGN_VERSIONS, str(f.sign_version))) {
    c += 0.1;
    reasons.push("sign_version is a documented signature version");
  }
  const markers = [
    has(f, "goodsid"),
    has(f, "slength"),
    has(f, "speriod"),
    has(f, "is_test"),
    type === "2" && lookup(NEGATIVE_REASONS, str(f.reason)) !== undefined,
  ].filter(Boolean).length;
  c += Math.min(markers * 0.03, 0.1);
  return {
    provider: "paymentwall",
    format: PAYMENTWALL_FORMATS.pingback,
    confidence: round(c),
    supported: true,
    reasons,
  };
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: "paymentwall",
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  if (meta?.format !== "form") {
    const j = detectJson(input, meta);
    if (j) return j;
  }
  return detectPingback(input) ?? none;
}

// ---------------------------------------------------------------------------
// Parsing

const opt = (max: number) => z.string().max(max).optional();
const optN = (max: number) => z.string().max(max).nullish();
const idLike = z.union([z.string().min(1).max(64), z.number()]);
const codeLike = z.union([z.number().int(), z.string().min(1).max(16)]);
const amountLike = z.union([z.string().max(32), z.number()]);
const flagLike = z.union([z.boolean(), z.number(), z.string().max(8)]);

const Pingback = z.looseObject({
  type: z.string().min(1).max(16),
  ref: z.string().min(1).max(128),
  uid: opt(512),
  sign_version: opt(8),
  sig: opt(256),
  goodsid: opt(256),
  slength: opt(16),
  speriod: opt(32),
  currency: opt(64),
  reason: opt(16),
  is_test: opt(8),
});

const BrickError = z.looseObject({
  type: z.literal("Error"),
  error: z.string().max(2000),
  code: codeLike,
});

const SdkError = z.looseObject({
  success: flagLike,
  error: z.looseObject({ message: z.string().max(2000), code: codeLike }),
});

const Charge = z.looseObject({
  id: idLike,
  object: z.literal("charge"),
  amount: amountLike.nullish(),
  currency: optN(8),
  amount_paid: amountLike.nullish(),
  currency_paid: optN(8),
  captured: flagLike.nullish(),
  refunded: flagLike.nullish(),
  risk: optN(32),
  card: z.looseObject({ type: optN(64) }).nullish(),
});

const Subscription = z.looseObject({
  id: idLike,
  object: z.literal("subscription"),
  active: flagLike.nullish(),
  started: flagLike.nullish(),
  expired: flagLike.nullish(),
  is_trial: flagLike.nullish(),
  period: optN(16),
  period_duration: z.union([z.number().int(), z.string().max(8)]).nullish(),
  payments_limit: z.union([z.number().int(), z.string().max(8)]).nullish(),
  charges: z.array(z.unknown()).max(1000).nullish(),
});

const ThreeDS = z.looseObject({
  success: flagLike,
  secure: z.looseObject({
    redirect: z.string().max(4096).optional(),
    formHTML: z.string().max(100_000).optional(),
  }),
});

const MobiamoError = z.looseObject({
  success: flagLike.optional(),
  error: z.string().max(2000),
  code: z.string().min(1).max(8),
});

const MobiamoResponse = z.looseObject({
  ref: z.string().min(1).max(128),
  success: flagLike.optional(),
  flow: opt(16),
  completed: z.boolean().optional(),
});

const UnidentifiedError = z.looseObject({
  code: codeLike,
  error: z.string().max(2000).optional(),
  message: z.string().max(2000).optional(),
});

export type PaymentwallParsed =
  | { kind: "pingback"; value: z.infer<typeof Pingback> }
  | { kind: "brick_error"; value: z.infer<typeof BrickError> }
  | { kind: "sdk_error"; value: z.infer<typeof SdkError> }
  | { kind: "charge"; value: z.infer<typeof Charge> }
  | { kind: "subscription"; value: z.infer<typeof Subscription> }
  | { kind: "three_ds"; value: z.infer<typeof ThreeDS> }
  | { kind: "mobiamo_error"; value: z.infer<typeof MobiamoError> }
  | { kind: "mobiamo_response"; value: z.infer<typeof MobiamoResponse> }
  | { kind: "unidentified_error"; value: z.infer<typeof UnidentifiedError> };

const SCHEMAS = {
  [PAYMENTWALL_FORMATS.pingback]: ["pingback", Pingback],
  [PAYMENTWALL_FORMATS.brickError]: ["brick_error", BrickError],
  [PAYMENTWALL_FORMATS.sdkError]: ["sdk_error", SdkError],
  [PAYMENTWALL_FORMATS.charge]: ["charge", Charge],
  [PAYMENTWALL_FORMATS.subscription]: ["subscription", Subscription],
  [PAYMENTWALL_FORMATS.threeDS]: ["three_ds", ThreeDS],
  [PAYMENTWALL_FORMATS.mobiamoError]: ["mobiamo_error", MobiamoError],
  [PAYMENTWALL_FORMATS.mobiamoResponse]: ["mobiamo_response", MobiamoResponse],
  [PAYMENTWALL_FORMATS.unidentifiedError]: ["unidentified_error", UnidentifiedError],
} as const;

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: PaymentwallParsed } | { ok: false; issues: string[] } {
  if (!isObj(input))
    return { ok: false, issues: ["(root): expected an object or a set of fields"] };
  const entry = lookup(
    SCHEMAS as unknown as Record<string, readonly [PaymentwallParsed["kind"], z.ZodType]>,
    format,
  );
  if (!entry) return { ok: false, issues: [`Unsupported Paymentwall format "${format}".`] };
  const [kind, schema] = entry;
  const r = schema.safeParse(input);
  if (!r.success) return { ok: false, issues: issuesOf(r.error) };
  return { ok: true, value: { kind, value: r.data } as PaymentwallParsed };
}

// ---------------------------------------------------------------------------
// Error decoding

type DecodedEntry = Omit<CodeEntry, "code" | "family">;

export type CodeDecoding = {
  code: string;
  /** The family whose meaning was used; null when none or several apply. */
  family: CodeFamily | null;
  entry: DecodedEntry;
  confidence: Confidence;
  missing: string[];
  documentation: DocumentationLink[];
};

/** Product family the payload structure indicates. */
export type FamilyHint = "brick" | "mobiamo";

const UNKNOWN_ENTRY: DecodedEntry = {
  meaning: "Undocumented code",
  category: "unknown",
  retry: "unknown",
  explanation: "This code is not in any Paymentwall code table known to PandaPayLens.",
  nextAction:
    "Check the operation in the Paymentwall Merchant Area before doing anything else, and contact Paymentwall support for the meaning of the code.",
  retryExplanation:
    "Without a documented meaning, PandaPayLens cannot say whether the original operation took effect or whether a retry is safe.",
  outcomeKnown: false,
};

const HINT_FAMILIES: Record<FamilyHint, readonly CodeFamily[]> = {
  brick: ["brick_token", "brick_payment"],
  mobiamo: ["mobiamo"],
};
const HINT_LABELS: Record<FamilyHint, string> = { brick: "Brick", mobiamo: "Mobiamo" };

const describe = (e: CodeEntry) => `${FAMILY_LABELS[e.family]} (${e.meaning})`;

function docsOf(entries: readonly CodeEntry[]): DocumentationLink[] {
  return [
    ...new Map(
      entries.flatMap((e) => FAMILY_DOCS[e.family]).map((d) => [d.url + d.title, d]),
    ).values(),
  ];
}

function strip(e: CodeEntry): DecodedEntry {
  const { code: _code, family: _family, ...rest } = e;
  return rest;
}

/**
 * Decodes a Paymentwall error code. Brick and MINT redemption reuse several
 * numbers with different meanings, so the product family the payload
 * structure indicates (`hint`) selects the table. Without a hint, or when the
 * hinted family does not document the code, every documented meaning is
 * listed with possible confidence.
 */
export function decodePaymentwallCode(raw: string, hint?: FamilyHint): CodeDecoding {
  const code = raw.trim();
  const shown = safeText(code, 40) ?? "";
  const all = codeCandidates(code);
  const notes: string[] = [];
  if (code === "200")
    notes.push(
      "200 is also a pingback type (Brick payment under risk review) and the HTTP success status; neither applies to an error code field.",
    );

  if (all.length === 0) {
    return {
      code,
      family: null,
      entry: UNKNOWN_ENTRY,
      confidence: "insufficient",
      missing: [
        `Code "${shown}" is not in the Paymentwall Brick, Mobiamo or MINT code tables known to PandaPayLens.`,
      ],
      documentation: hint
        ? [...FAMILY_DOCS[HINT_FAMILIES[hint][0]!]]
        : [{ title: "Paymentwall API reference", url: APIS_URL }],
    };
  }

  const hinted = hint ? all.filter((e) => HINT_FAMILIES[hint].includes(e.family)) : [];
  if (hinted.length === 1) {
    const match = hinted[0]!;
    const others = all.filter((e) => e !== match);
    if (others.length)
      notes.push(
        `Code ${shown} has a different documented meaning in ${others.map(describe).join(", ")}; the payload structure indicates ${HINT_LABELS[hint!]}.`,
      );
    return {
      code,
      family: match.family,
      entry: strip(match),
      confidence: "strong",
      missing: notes,
      documentation: docsOf([match]),
    };
  }

  const why = hint
    ? `Code ${shown} is not in the ${HINT_LABELS[hint]} tables, although the payload has the ${HINT_LABELS[hint]} structure.`
    : "The payload structure does not show which Paymentwall product (Brick, Mobiamo or MINT) returned this code.";

  if (all.length === 1) {
    const only = all[0]!;
    return {
      code,
      family: only.family,
      entry: strip(only),
      confidence: "possible",
      missing: [why, `The only documented meaning is ${describe(only)}.`, ...notes],
      documentation: docsOf(all),
    };
  }

  const first = all[0]!;
  const list = all.map((e) => `${FAMILY_LABELS[e.family]}: ${e.meaning}`).join("; ");
  const agree = all.every((e) => e.category === first.category && e.retry === first.retry);
  const entry: DecodedEntry = agree
    ? {
        ...strip(first),
        meaning: list,
        explanation: `Paymentwall code ${shown} is documented as: ${list}.`,
        outcomeKnown: all.every((e) => e.outcomeKnown),
      }
    : {
        meaning: list,
        category: "unknown",
        retry: "manual_review",
        explanation: `Paymentwall code ${shown} has different documented meanings depending on the product: ${list}.`,
        nextAction:
          "Find out which Paymentwall product answered the request (Brick card payment or MINT ePIN), then use that product's meaning.",
        retryExplanation:
          "The right decision depends on the product. Do not resend until it is known; where one of the meanings is an internal error, check first whether the original operation took effect.",
        outcomeKnown: all.every((e) => e.outcomeKnown),
      };
  return {
    code,
    family: null,
    entry,
    confidence: "possible",
    missing: [
      why,
      `Code ${shown} is reused by Paymentwall products with several meanings.`,
      ...notes,
    ],
    documentation: docsOf(all),
  };
}

function draft(
  ctx: NormalizeContext,
  d: CodeDecoding,
  opts: { message?: string; extraMissing?: string[]; subCodes?: Record<string, string> } = {},
): DecodedErrorDraft {
  const providerMessage = safeText(opts.message, 300);
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    code: safeText(d.code, 40) ?? "",
    subCodes: { ...(d.family ? { family: d.family } : {}), ...(opts.subCodes ?? {}) },
    category: d.entry.category,
    ...(providerMessage ? { providerMessage } : {}),
    explanation: d.entry.explanation,
    nextAction: d.entry.nextAction,
    retry: d.entry.retry,
    retryExplanation: d.entry.retryExplanation,
    confidence: d.confidence,
    documentation: d.documentation,
    missingInformation: [...d.missing, ...(opts.extraMissing ?? [])],
    outcomeKnown: d.entry.outcomeKnown,
  };
}

function httpSubCodes(ctx: NormalizeContext): Record<string, string> {
  const s = ctx.meta?.http?.status;
  return s !== undefined ? { httpStatus: String(s) } : {};
}

const SDK_NOTE =
  "The record is the PHP SDK getPublicData() envelope, not the raw API response; the Brick tables are used.";

function errorCode(parsed: PaymentwallParsed): { code: string; hint?: FamilyHint } | undefined {
  switch (parsed.kind) {
    case "brick_error":
      return { code: String(parsed.value.code), hint: "brick" };
    case "sdk_error":
      return { code: String(parsed.value.error.code), hint: "brick" };
    case "mobiamo_error":
      return { code: parsed.value.code, hint: "mobiamo" };
    case "unidentified_error":
      return { code: String(parsed.value.code) };
    default:
      return undefined;
  }
}

function errorMessage(parsed: PaymentwallParsed): string | undefined {
  switch (parsed.kind) {
    case "brick_error":
    case "mobiamo_error":
      return parsed.value.error;
    case "sdk_error":
      return parsed.value.error.message;
    case "unidentified_error":
      return parsed.value.error ?? parsed.value.message;
    default:
      return undefined;
  }
}

function decodeErrors(parsed: PaymentwallParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const c = errorCode(parsed);
  if (!c) return [];
  const d = decodePaymentwallCode(c.code, c.hint);
  const message = errorMessage(parsed);
  return [
    draft(ctx, d, {
      ...(message !== undefined ? { message } : {}),
      extraMissing: parsed.kind === "sdk_error" ? [SDK_NOTE] : [],
      subCodes: httpSubCodes(ctx),
    }),
  ];
}

// ---------------------------------------------------------------------------
// Normalization

function base(ctx: NormalizeContext) {
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  };
}

const EVENT_TYPES: Record<string, string> = {
  brick_error: "brick.error",
  sdk_error: "brick.sdk_error",
  mobiamo_error: "mobiamo.error",
  unidentified_error: "error",
};

function normalizePingback(
  p: z.infer<typeof Pingback>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const type = safeId(p.type, 16);
  const info = lookup(PINGBACK_TYPES, type);
  const ref = safeId(p.ref, 128);
  const reasonRaw = p.reason !== undefined && p.reason !== "" ? digits(p.reason, 4) : undefined;
  const negative = type === "2";
  const reason = negative ? lookup(NEGATIVE_REASONS, reasonRaw) : undefined;
  const stage: LifecycleStage = (info && (reason?.stage ?? info.stage)) ?? "other";
  const outcome: Outcome = (info && (reason?.outcome ?? info.outcome)) ?? "unknown";
  const slength = digits(p.slength);
  const speriod = word(p.speriod);
  const subscriptionPayment =
    (type === "0" || type === "1") && slength !== undefined && speriod !== undefined
      ? true
      : undefined;
  // No event id exists; the SDK's unique pingback id is ref + "_" + type.
  const deliveryKey =
    info && ref && info.uniquePerRef && !reason?.repeatable ? `${ref}_${type}` : undefined;
  const virtualAmount =
    typeof p.currency === "string" && /^\d{1,15}(?:\.\d{1,6})?$/.test(p.currency)
      ? p.currency
      : undefined;

  return clean({
    ...base(ctx),
    eventType: `pingback.${type ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage,
    providerStatus: [
      `type=${type ?? "?"}`,
      negative && reasonRaw ? `reason=${reasonRaw}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    paymentReference: ref,
    isRecurring: info?.isRecurring,
    deliveryKey,
    outcome,
    attributes: attrs({
      type,
      typeMeaning: info?.meaning,
      typeNote: info?.note,
      product: info?.product,
      ref,
      reason: negative ? reasonRaw : undefined,
      reasonMeaning: reason?.meaning,
      reasonDocumented: negative && reasonRaw !== undefined && !reason ? false : undefined,
      productId: safeId(p.goodsid, 128),
      subscriptionLength: slength,
      subscriptionPeriod: speriod,
      subscriptionPayment,
      virtualCurrencyAmount: virtualAmount,
      testMode: p.is_test !== undefined ? boolish(p.is_test) : undefined,
      signVersion: lookup(SIGN_VERSIONS, p.sign_version) ? p.sign_version : undefined,
      signature: signatureClass(p.sig),
    }),
  });
}

function normalizeCharge(c: z.infer<typeof Charge>, ctx: NormalizeContext): NormalizedEventDraft {
  const id = idOf(c.id);
  const captured = boolish(c.captured);
  const refunded = boolish(c.refunded);
  const risk = documented(CHARGE_RISK_VALUES, c.risk);
  let stage: LifecycleStage;
  let outcome: Outcome;
  if (refunded === true) {
    stage = "refund";
    outcome = "success";
  } else if (risk === "pending") {
    // PHP SDK: risk == "pending" means the charge is under review (pingback 200 follows).
    stage = "payment";
    outcome = "pending";
  } else if (captured === true) {
    stage = "payment";
    outcome = "success";
  } else if (captured === false) {
    stage = "authorization";
    outcome = "success";
  } else {
    stage = "payment";
    outcome = "unknown";
  }
  const paid = money(c.amount_paid, c.currency_paid);
  return clean({
    ...base(ctx),
    eventType: "brick.charge",
    eventTypeKnown: true,
    stage,
    providerStatus: [
      captured !== undefined ? `captured=${captured}` : undefined,
      refunded !== undefined ? `refunded=${refunded}` : undefined,
      c.risk != null ? `risk=${risk ?? "undocumented"}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    paymentReference: id,
    ...money(c.amount, c.currency),
    outcome,
    attributes: attrs({
      chargeId: id,
      captured,
      refunded,
      risk,
      riskDocumented: c.risk != null && !risk ? false : undefined,
      paidAmountMinor: paid.amountMinor,
      paidCurrency: paid.currency,
      cardBrand: safeText(c.card?.type ?? undefined, 32),
      secureStepPresent: c.secure != null ? true : undefined,
      product: "brick",
    }),
  });
}

function normalizeSubscription(
  s: z.infer<typeof Subscription>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const id = idOf(s.id);
  const active = boolish(s.active);
  const expired = boolish(s.expired);
  const trial = boolish(s.is_trial);
  const chargeIds = (s.charges ?? []).map((x) => idOf(x)).filter((x): x is string => Boolean(x));
  const num = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : digits(v);
  return clean({
    ...base(ctx),
    eventType: "brick.subscription",
    eventTypeKnown: true,
    stage: "subscription",
    providerStatus: [
      active !== undefined ? `active=${active}` : undefined,
      expired !== undefined ? `expired=${expired}` : undefined,
      trial !== undefined ? `is_trial=${trial}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    paymentReference: id,
    subscriptionReference: id,
    // The object is a state snapshot: active or expired is a known state,
    // otherwise its meaning is not documented.
    outcome: active === true || expired === true ? "success" : "unknown",
    attributes: attrs({
      subscriptionId: id,
      active,
      started: boolish(s.started),
      expired,
      isTrial: trial,
      period: word(s.period ?? undefined),
      periodDuration: num(s.period_duration),
      paymentsLimit: num(s.payments_limit),
      chargeIds: chargeIds.length ? chargeIds : undefined,
      product: "brick",
    }),
  });
}

function normalizeThreeDS(t: z.infer<typeof ThreeDS>, ctx: NormalizeContext): NormalizedEventDraft {
  const step = typeof t.secure.formHTML === "string" ? "formHTML" : "redirect";
  return clean({
    ...base(ctx),
    eventType: "brick.3ds_required",
    eventTypeKnown: true,
    stage: "authentication",
    providerStatus: `success=0; secure.${step}`,
    outcome: "pending",
    // The redirect URL and form HTML (PaReq, MD) are never copied.
    attributes: attrs({ secureStep: step, product: "brick" }),
  });
}

function normalizeMobiamo(
  r: z.infer<typeof MobiamoResponse>,
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const ref = safeId(r.ref, 128);
  const flow = documented(MOBIAMO_FLOWS, r.flow);
  const completed = r.completed;
  const outcome: Outcome =
    completed === true ? "success" : completed === false ? "failure" : flow ? "pending" : "unknown";
  return clean({
    ...base(ctx),
    eventType:
      completed !== undefined ? "mobiamo.completed" : flow ? `mobiamo.flow.${flow}` : "mobiamo",
    eventTypeKnown: completed !== undefined || flow !== undefined,
    stage: "payment",
    providerStatus: [
      completed !== undefined ? `completed=${completed}` : undefined,
      flow ? `flow=${flow}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
    paymentReference: ref,
    outcome,
    attributes: attrs({
      mobiamoRef: ref,
      flow,
      completed,
      instructionsPresent: r.instructions != null ? true : undefined,
      product: "mobiamo",
    }),
  });
}

function normalizeError(parsed: PaymentwallParsed, ctx: NormalizeContext): NormalizedEventDraft {
  const c = errorCode(parsed)!;
  const d = decodePaymentwallCode(c.code, c.hint);
  const known = d.confidence !== "insufficient";
  const status = ctx.meta?.http?.status;
  return clean({
    ...base(ctx),
    eventType: EVENT_TYPES[parsed.kind] ?? "error",
    eventTypeKnown: true,
    stage: "error",
    providerStatus: `code=${safeText(c.code, 40) ?? "?"}${status !== undefined ? `; HTTP ${status}` : ""}`,
    // A documented rejection means the request was not performed; internal
    // errors and unknown codes leave the original outcome open.
    outcome: known && d.entry.outcomeKnown ? "failure" : "unknown",
    attributes: attrs({
      errorCode: safeText(c.code, 40),
      family: d.family ?? undefined,
      httpStatus: status,
      product: c.hint,
    }),
  });
}

function normalize(parsed: PaymentwallParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "pingback":
      return [normalizePingback(parsed.value, ctx)];
    case "charge":
      return [normalizeCharge(parsed.value, ctx)];
    case "subscription":
      return [normalizeSubscription(parsed.value, ctx)];
    case "three_ds":
      return [normalizeThreeDS(parsed.value, ctx)];
    case "mobiamo_response":
      return [normalizeMobiamo(parsed.value, ctx)];
    case "brick_error":
    case "sdk_error":
    case "mobiamo_error":
    case "unidentified_error":
      return [normalizeError(parsed, ctx)];
  }
}

// ---------------------------------------------------------------------------
// Correlation

function correlationKeys(event: NormalizedEvent): string[] {
  // Namespaced: the relation between pingback refs, Brick charge ids and
  // Mobiamo refs is not documented. uid and goodsid are never used: a user or
  // product appears in many payments.
  const a = event.attributes;
  const keys: string[] = [];
  if (typeof a.ref === "string") keys.push(`ref:${a.ref}`);
  if (typeof a.chargeId === "string") keys.push(`charge:${a.chargeId}`);
  if (Array.isArray(a.chargeIds))
    for (const id of a.chargeIds) if (typeof id === "string") keys.push(`charge:${id}`);
  if (typeof a.subscriptionId === "string") keys.push(`sub:${a.subscriptionId}`);
  if (typeof a.mobiamoRef === "string") keys.push(`mobiamo:${a.mobiamoRef}`);
  return keys;
}

export const paymentwallAdapter: ProviderAdapter<PaymentwallParsed> = {
  id: "paymentwall",
  displayName: "Paymentwall",
  version: PAYMENTWALL_ADAPTER_VERSION,
  manifest: paymentwallManifest,
  supportedFormats: [
    {
      id: PAYMENTWALL_FORMATS.pingback,
      description: "Pingback query string (uid, type, ref, sign_version, sig)",
    },
    {
      id: PAYMENTWALL_FORMATS.brickError,
      description: 'Brick error JSON { type: "Error", error, code }',
    },
    {
      id: PAYMENTWALL_FORMATS.sdkError,
      description: "PHP SDK error envelope { success: 0, error: { message, code } }",
    },
    { id: PAYMENTWALL_FORMATS.charge, description: "Brick charge object" },
    { id: PAYMENTWALL_FORMATS.subscription, description: "Brick subscription object" },
    {
      id: PAYMENTWALL_FORMATS.threeDS,
      description: "Brick 3-D Secure step { success: 0, secure: { redirect | formHTML } }",
    },
    { id: PAYMENTWALL_FORMATS.mobiamoError, description: "Mobiamo error (W codes)" },
    {
      id: PAYMENTWALL_FORMATS.mobiamoResponse,
      description: "Mobiamo payment response (ref, flow, completed)",
    },
    {
      id: PAYMENTWALL_FORMATS.unidentifiedError,
      description:
        "Error code without a product-specific structure (selected manually); all documented meanings are listed",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys,
};

export * from "./catalog.js";
export default paymentwallAdapter;
