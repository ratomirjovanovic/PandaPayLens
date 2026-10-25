/**
 * eZeeWallet adapter (direct eZeeWallet JSON API, v2.0.2).
 *
 * Supported input families:
 * - `ezeewallet.transfer`        POST /transfers and /transfers_new responses (wrapped in
 *                                `transfer`) and unwrapped GET /transfers list items
 * - `ezeewallet.refund`          POST /refunds responses (wrapped in `refund`)
 * - `ezeewallet.transaction`     GET /transaction lookup `{ ezw_reference_id, status, type }`
 * - `ezeewallet.single_payout`   POST /single_payouts and /single_payouts_new responses
 * - `ezeewallet.batch_payout`    POST /batch_payouts and /batch_payouts_new responses
 * - `ezeewallet.error`           error envelope `{ "error": { "code", "message" } }`
 * - `ezeewallet.notification`    transfer and payout notifications sent to notification_url
 *
 * Recognized but not supported: `ezeewallet.account` (GET /account).
 *
 * eZeeWallet is a wallet: a transfer moves e-money from the consumer wallet to
 * the merchant wallet in one step. It is shown as a payment, never as a card
 * authorization. Payloads of the emerchantpay Genesis route (transaction_type
 * ezeewallet) are Genesis payloads and are never claimed here.
 */

import {
  lookup,
  minorUnits,
  safeId,
  safeText,
  upperCurrency,
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
  API_DOCS_URL,
  ERROR_CODES,
  LOOKUP_TYPES,
  NEXT_ACTION,
  RETRY_TEXT,
  STATUSES,
  VOCABULARY_STAGE,
  type StatusEntry,
  type Vocabulary,
} from "./catalog.js";

import { ezeewalletManifest, EZEEWALLET_ADAPTER_VERSION } from "./manifest.js";

export { ezeewalletManifest, EZEEWALLET_ADAPTER_VERSION };

const PROVIDER = "ezeewallet";

// The Error data type says `code` is a string; every example shows an integer.
const Code = z.union([z.string().max(16), z.number().int()]);
const Num = z.union([z.number(), z.string().max(40)]);
const NStr = (max: number) => z.string().max(max).nullable().optional();
const Status = z.string().max(64);

const TransferFields = z.looseObject({
  status: Status,
  transaction_id: NStr(256),
  merchant_transaction_id: NStr(256),
  ezw_reference_id: NStr(128),
  amount: Num.nullable().optional(),
  currency: NStr(16),
  redirect_url: NStr(4096),
});
const Transfer = z.looseObject({ transfer: TransferFields });

const Refund = z.looseObject({
  refund: z.looseObject({
    status: Status,
    ezw_reference_id: NStr(128),
    merchant_transaction_id: NStr(256),
    amount: Num.nullable().optional(),
    currency: NStr(16),
  }),
});

const Lookup = z.looseObject({
  ezw_reference_id: z.string().max(128),
  status: Status,
  type: z.string().max(64),
});

const SinglePayout = z.looseObject({
  status: Status,
  unique_id: NStr(128),
  ezw_reference_id: NStr(128),
  merchant_reference: NStr(256),
});

const BatchItem = z.looseObject({
  amount: Num.nullable().optional(),
  currency: NStr(16),
  merchant_reference: NStr(256),
});
const BatchItems = z.array(BatchItem).max(10_000);
const BatchPayout = z.looseObject({
  status: Status,
  // Legacy: a string id. New: the example calls the array unique_ids, the
  // data type calls it unique_id.
  unique_id: z
    .union([z.string().max(128), BatchItems])
    .nullable()
    .optional(),
  unique_ids: BatchItems.nullable().optional(),
});

const ErrorEnvelope = z.looseObject({
  error: z.looseObject({ code: Code, message: NStr(2000) }),
});

const Notification = z.looseObject({
  status: Status,
  unique_id: z.string().max(128),
  transaction_id: NStr(256),
  ezw_reference_id: NStr(128),
  merchant_reference: NStr(256),
  signature: NStr(512),
  decline_reason: NStr(2000),
});

type TransferValue = z.infer<typeof TransferFields>;
type BatchValue = z.infer<typeof BatchPayout>;
type NotificationValue = z.infer<typeof Notification>;

export type EzeewalletParsed =
  | { kind: "transfer"; value: TransferValue; wrapped: boolean }
  | { kind: "refund"; value: z.infer<typeof Refund>["refund"] }
  | { kind: "transaction"; value: z.infer<typeof Lookup> }
  | { kind: "single_payout"; value: z.infer<typeof SinglePayout> }
  | { kind: "batch_payout"; value: BatchValue }
  | { kind: "error"; value: z.infer<typeof ErrorEnvelope>["error"] }
  | { kind: "notification"; value: NotificationValue };

const SUPPORTED_FORMATS = [
  "ezeewallet.transfer",
  "ezeewallet.refund",
  "ezeewallet.transaction",
  "ezeewallet.single_payout",
  "ezeewallet.batch_payout",
  "ezeewallet.error",
  "ezeewallet.notification",
] as const;

const NOTIFICATION_KEYS = new Set([
  "transaction_id",
  "unique_id",
  "status",
  "signature",
  "decline_reason",
  "ezw_reference_id",
  "merchant_reference",
]);
const TRANSFER_KEYS = new Set([
  "transaction_id",
  "merchant_transaction_id",
  "ezw_reference_id",
  "usage",
  "first_name",
  "last_name",
  "amount",
  "currency",
  "source_wallet_id",
  "consumer_email",
  "return_success_url",
  "return_failure_url",
  "status",
  "redirect_url",
]);
const LOOKUP_KEYS = new Set(["ezw_reference_id", "status", "type"]);
const PAYOUT_NEW_KEYS = new Set(["ezw_reference_id", "status", "merchant_reference"]);
const BATCH_KEYS = new Set(["unique_ids", "unique_id", "status"]);
const ACCOUNT_KEYS = ["account_number", "verification_status", "account_status"];

// Phrases from the documented error messages; a bare { error: { code } } is
// too generic to claim without one of them.
const ERROR_MESSAGE_HINT =
  /wallet|currency mismatch|already processed|transfer failed|payout|top[- ]?up|industry type|maximum deposit|password parameter/i;
const SHA1_HEX = /^[0-9a-f]{40}$/i;
const ID = /^[\x21-\x7e]{1,128}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const has = (o: Record<string, unknown>, k: string) => typeof o[k] === "string" && o[k] !== "";
const subset = (keys: string[], allowed: Set<string>) => keys.every((k) => allowed.has(k));
const round = (n: number) => Math.round(Math.min(0.98, Math.max(0, n)) * 100) / 100;
const txnId = (v: unknown) => (typeof v === "string" && ID.test(v) ? safeId(v) : undefined);

/** Error code as a string, from the documented integer or the typed string. */
function codeOf(v: unknown): string | undefined {
  const s = typeof v === "number" && Number.isInteger(v) ? String(v) : v;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return /^[0-9A-Za-z_-]{1,16}$/.test(t) ? t : undefined;
}

function isFormRecord(meta?: RecordMeta): boolean {
  return (
    meta?.format === "form" ||
    (meta?.format === "http" && meta.http?.contentType === "application/x-www-form-urlencoded")
  );
}

/** Any vocabulary that knows the status word. */
function knownAnywhere(status: unknown): boolean {
  if (typeof status !== "string") return false;
  return Object.values(STATUSES).some((t) => Boolean(lookup(t, status)));
}

function result(
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

function detectTransfer(inner: Record<string, unknown>, wrapped: boolean): DetectionResult | null {
  const keys = Object.keys(inner);
  const reasons = [wrapped ? "has the transfer wrapper" : "flat transfer list item fields"];
  let score = wrapped ? 0.3 : 0.2;
  let specific = false;
  if (has(inner, "ezw_reference_id")) {
    score += 0.45;
    specific = true;
    reasons.push("has ezw_reference_id");
  }
  if (has(inner, "source_wallet_id") || has(inner, "consumer_email")) {
    score += 0.2;
    specific = true;
    reasons.push("has source_wallet_id or consumer_email");
  }
  if (has(inner, "transaction_id") || has(inner, "merchant_transaction_id")) {
    score += 0.1;
    reasons.push("has transaction_id or merchant_transaction_id");
  }
  if ("return_success_url" in inner || "return_failure_url" in inner) {
    score += 0.1;
    specific = true;
    reasons.push("has return_success_url / return_failure_url");
  }
  if (typeof inner.status === "string") score += 0.05;
  if (Number.isInteger(inner.amount) && upperCurrency(inner.currency)) {
    score += 0.05;
    reasons.push("amount is an integer in minor units with a currency");
  }
  if (!specific) return null;
  // A list item must look like a whole transfer, not a fragment.
  if (
    !wrapped &&
    (!subset(keys, TRANSFER_KEYS) ||
      !has(inner, "ezw_reference_id") ||
      !(
        has(inner, "merchant_transaction_id") ||
        has(inner, "consumer_email") ||
        has(inner, "source_wallet_id")
      ))
  )
    return null;
  return result("ezeewallet.transfer", score, reasons);
}

function detectError(inner: Record<string, unknown>, meta?: RecordMeta): DetectionResult | null {
  if (!subset(Object.keys(inner), new Set(["code", "message"])) || !("code" in inner)) return null;
  const code = codeOf(inner.code);
  const entry = code ? lookup(ERROR_CODES, code) : undefined;
  const reasons = ['has the { "error": { "code", "message" } } envelope'];
  let score = 0.2;
  if (entry) {
    score += 0.2;
    reasons.push(`error.code ${code} is a documented eZeeWallet code`);
  } else if (!code || !/^\d{3}$/.test(code)) return null;
  const message = str(inner.message);
  const hinted = Boolean(message && ERROR_MESSAGE_HINT.test(message));
  if (hinted) {
    score += 0.25;
    reasons.push("error.message uses wording of the documented eZeeWallet messages");
  }
  const status = meta?.http?.kind === "response" ? meta.http.status : undefined;
  if (entry ? status === entry.httpStatus : status === 400 || status === 500) {
    score += 0.1;
    reasons.push(`arrived with HTTP ${status}, a status eZeeWallet documents for its errors`);
  }
  // Without message wording the envelope stays a generic shape.
  if (!hinted) score = Math.min(score, 0.45);
  return result("ezeewallet.error", score, reasons);
}

function detectNotification(
  input: Record<string, unknown>,
  meta?: RecordMeta,
): DetectionResult | null {
  const keys = Object.keys(input);
  if (!subset(keys, NOTIFICATION_KEYS) || typeof input.signature !== "string") return null;
  if (!has(input, "unique_id") && !has(input, "transaction_id") && !has(input, "ezw_reference_id"))
    return null;
  const reasons = ["flat notification fields (id, status, signature) and nothing else"];
  let score = 0.35;
  if (SHA1_HEX.test(input.signature)) {
    score += 0.15;
    reasons.push("signature has the documented SHA-1 hex shape");
  }
  if (knownAnywhere(input.status)) {
    score += 0.1;
    reasons.push("status is a documented eZeeWallet status");
  }
  if (has(input, "ezw_reference_id")) {
    score += 0.3;
    reasons.push("has ezw_reference_id");
  }
  if (has(input, "transaction_id") && has(input, "unique_id")) score += 0.05;
  if (typeof input.decline_reason === "string") {
    score += 0.05;
    reasons.push("has decline_reason");
  }
  if (isFormRecord(meta)) {
    // The reference shows JSON bodies only; form-encoded notifications with
    // these fields are possible but less likely.
    score -= 0.15;
    reasons.push("form-encoded (the notification content type is not documented)");
  }
  return result("ezeewallet.notification", score, reasons);
}

function detect(input: unknown, meta?: RecordMeta): DetectionResult {
  const none: DetectionResult = {
    provider: PROVIDER,
    format: null,
    confidence: 0,
    supported: false,
    reasons: [],
  };
  if (!isObj(input)) return none;
  // Stripe payloads carry `object`. Genesis payloads (including the eZeeWallet
  // APM route) carry transaction_type and terminal_token; they belong to the
  // emerchantpay adapter.
  if ("object" in input || "transaction_type" in input || "terminal_token" in input) return none;
  const keys = Object.keys(input);

  const notification = detectNotification(input, meta);
  if (notification) return notification;
  // Everything else is a JSON API response.
  if (isFormRecord(meta)) return none;

  if (keys.length === 1) {
    const [key] = keys as [string];
    const inner = input[key];
    if (isObj(inner)) {
      if (key === "transfer") return detectTransfer(inner, true) ?? none;
      if (key === "error") return detectError(inner, meta) ?? none;
      if (key === "refund") {
        if (!("status" in inner || "ezw_reference_id" in inner)) return none;
        const reasons = ["has the refund wrapper"];
        let score = 0.3;
        if (has(inner, "ezw_reference_id")) {
          score += 0.45;
          reasons.push("has ezw_reference_id (the original transfer)");
        }
        if (has(inner, "merchant_transaction_id")) score += 0.1;
        if (typeof inner.status === "string") score += 0.05;
        if (Number.isInteger(inner.amount) && upperCurrency(inner.currency)) score += 0.05;
        return result("ezeewallet.refund", score, reasons);
      }
    }
  }

  if (has(input, "ezw_reference_id") && subset(keys, LOOKUP_KEYS) && "type" in input) {
    const typed = typeof input.type === "string" && Boolean(lookup(LOOKUP_TYPES, input.type));
    return result("ezeewallet.transaction", typed ? 0.9 : 0.75, [
      "has ezw_reference_id, status and type (transaction lookup)",
      ...(typed ? ["type is transfer or payout"] : []),
    ]);
  }
  if (
    has(input, "ezw_reference_id") &&
    subset(keys, PAYOUT_NEW_KEYS) &&
    "status" in input &&
    "merchant_reference" in input
  ) {
    return result("ezeewallet.single_payout", 0.85, [
      "has ezw_reference_id, status and merchant_reference (single payout)",
    ]);
  }
  if (
    subset(keys, BATCH_KEYS) &&
    (Array.isArray(input.unique_ids) || Array.isArray(input.unique_id))
  ) {
    const items = (
      Array.isArray(input.unique_ids) ? input.unique_ids : input.unique_id
    ) as unknown[];
    const itemShape = items.every(
      (i) => isObj(i) && ("email" in i || "merchant_reference" in i) && "amount" in i,
    );
    if (!itemShape) return none;
    const known =
      typeof input.status === "string" && Boolean(lookup(STATUSES.batch_payouts_new, input.status));
    return result("ezeewallet.batch_payout", known ? 0.75 : 0.65, [
      "has a unique_ids array of payout items (email, amount, currency, merchant_reference)",
      ...(known ? ["status is a documented batch payout status"] : []),
    ]);
  }
  if (
    keys.length === 3 &&
    has(input, "unique_id") &&
    "status" in input &&
    "merchant_reference" in input
  ) {
    const known =
      typeof input.status === "string" && Boolean(lookup(STATUSES.single_payouts, input.status));
    return result("ezeewallet.single_payout", known ? 0.55 : 0.4, [
      "exactly unique_id, status and merchant_reference (legacy single payout)",
      ...(known ? ["status is succeeded or failed"] : []),
    ]);
  }
  if (keys.length === 2 && has(input, "unique_id") && typeof input.status === "string") {
    // The legacy batch payout response is a generic shape; it is only analyzed
    // when the provider is selected manually.
    return result("ezeewallet.batch_payout", 0.3, [
      "exactly unique_id and status (legacy batch payout shape, too generic to claim)",
    ]);
  }
  if (has(input, "ezw_reference_id") && "status" in input) {
    const transfer = detectTransfer(input, false);
    if (transfer) return transfer;
  }
  if (keys.length === 3 && ACCOUNT_KEYS.every((k) => k in input)) {
    return result(
      "ezeewallet.account",
      0.6,
      ["has account_number, verification_status and account_status"],
      "eZeeWallet account responses carry account data and no payment lifecycle; they are recognized but not analyzed.",
    );
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: EzeewalletParsed } | { ok: false; issues: string[] } {
  if (!(SUPPORTED_FORMATS as readonly string[]).includes(format))
    return { ok: false, issues: [`Unsupported eZeeWallet format "${format}".`] };
  const issuesOf = (e: z.ZodError) =>
    e.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  const run = <T extends z.ZodType>(schema: T) => schema.safeParse(input);

  switch (format) {
    case "ezeewallet.transfer": {
      if (isObj(input) && "transfer" in input) {
        const r = run(Transfer);
        return r.success
          ? { ok: true, value: { kind: "transfer", value: r.data.transfer, wrapped: true } }
          : { ok: false, issues: issuesOf(r.error) };
      }
      const r = run(TransferFields);
      return r.success
        ? { ok: true, value: { kind: "transfer", value: r.data, wrapped: false } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "ezeewallet.refund": {
      const r = run(Refund);
      return r.success
        ? { ok: true, value: { kind: "refund", value: r.data.refund } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "ezeewallet.transaction": {
      const r = run(Lookup);
      return r.success
        ? { ok: true, value: { kind: "transaction", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "ezeewallet.single_payout": {
      const r = run(SinglePayout);
      if (!r.success) return { ok: false, issues: issuesOf(r.error) };
      if (!r.data.unique_id && !r.data.ezw_reference_id)
        return { ok: false, issues: ["unique_id or ezw_reference_id: required"] };
      return { ok: true, value: { kind: "single_payout", value: r.data } };
    }
    case "ezeewallet.batch_payout": {
      const r = run(BatchPayout);
      return r.success
        ? { ok: true, value: { kind: "batch_payout", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    case "ezeewallet.error": {
      const r = run(ErrorEnvelope);
      return r.success
        ? { ok: true, value: { kind: "error", value: r.data.error } }
        : { ok: false, issues: issuesOf(r.error) };
    }
    default: {
      const r = run(Notification);
      return r.success
        ? { ok: true, value: { kind: "notification", value: r.data } }
        : { ok: false, issues: issuesOf(r.error) };
    }
  }
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = safeText(v, 200) ?? "";
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

/** Merchant references are free text; drop any that look like personal data. */
function merchantRef(v: unknown): string | undefined {
  const id = safeId(v, 256);
  return id && safeText(id, 256) === id ? id : undefined;
}

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

/** Integer minor units only; decimals or floats are reported, never converted. */
function amountOf(
  amount: unknown,
  currency: unknown,
): { minor?: string; currency?: string; raw?: true } {
  const cur = upperCurrency(currency);
  if (amount === undefined || amount === null) return cur ? { currency: cur } : {};
  const minor =
    typeof amount === "number" && !Number.isSafeInteger(amount) ? undefined : minorUnits(amount);
  return {
    ...(cur ? { currency: cur } : {}),
    ...(minor !== undefined ? { minor } : { raw: true }),
  };
}

/** Status entry, known only when every candidate vocabulary agrees on it. */
function statusOf(vocabs: readonly Vocabulary[], status: string): StatusEntry | undefined {
  const entries = vocabs.map((v) => lookup(STATUSES[v], status));
  const first = entries[0];
  if (!first || entries.some((e) => !e || e.outcome !== first.outcome)) return undefined;
  return first;
}

type Shape = {
  label: string;
  vocabs: readonly Vocabulary[];
  stage: LifecycleStage;
  status: string;
  paymentReference?: string;
  referenceField?: "ezw_reference_id" | "unique_id";
  relatedReference?: string;
  relatedReferenceField?: "unique_id";
  merchantReference?: string;
  merchantReferenceField?: string;
  transactionIdLink?: true;
  amount?: { minor?: string; currency?: string; raw?: true };
  deliveryKey?: string;
  extra?: [string, unknown][];
  path: string;
};

function transferShape(v: TransferValue, wrapped: boolean): Shape {
  const legacyId = merchantRef(v.transaction_id);
  const newId = merchantRef(v.merchant_transaction_id);
  const ezw = txnId(v.ezw_reference_id);
  const isNew = !wrapped || Boolean(v.merchant_transaction_id || v.ezw_reference_id);
  const isLegacy = wrapped && Boolean(v.transaction_id) && !isNew;
  const vocabs: Vocabulary[] = isLegacy
    ? ["transfers"]
    : isNew && !v.transaction_id
      ? ["transfers_new"]
      : ["transfers", "transfers_new"];
  const label = vocabs.length === 2 ? "transfer" : vocabs[0]!;
  return {
    label,
    vocabs,
    stage: "payment",
    status: v.status,
    ...(ezw ? { paymentReference: ezw, referenceField: "ezw_reference_id" as const } : {}),
    ...(isLegacy && legacyId
      ? {
          merchantReference: legacyId,
          merchantReferenceField: "transaction_id",
          transactionIdLink: true as const,
        }
      : newId
        ? { merchantReference: newId, merchantReferenceField: "merchant_transaction_id" }
        : {}),
    amount: amountOf(v.amount, v.currency),
    extra: [
      ["operation", "transfer"],
      ["transferVariant", isLegacy ? "legacy" : vocabs.length === 2 ? "not determined" : "new"],
      ["transferWrapper", wrapped ? undefined : false],
      // The top-up URL carries a one-time token; only its presence is shown.
      [
        "topUpRedirect",
        typeof v.redirect_url === "string" && v.redirect_url !== "" ? true : undefined,
      ],
    ],
    path: wrapped ? "transfer" : "",
  };
}

function batchShape(v: BatchValue): Shape {
  const items = Array.isArray(v.unique_ids)
    ? v.unique_ids
    : Array.isArray(v.unique_id)
      ? v.unique_id
      : undefined;
  const legacyId = typeof v.unique_id === "string" ? txnId(v.unique_id) : undefined;
  const vocabs: Vocabulary[] = items
    ? ["batch_payouts_new"]
    : legacyId
      ? ["batch_payouts"]
      : ["batch_payouts", "batch_payouts_new"];
  const currencies = items
    ? [
        ...new Set(
          items.map((i) => upperCurrency(i.currency)).filter((c): c is string => Boolean(c)),
        ),
      ]
    : [];
  return {
    label: vocabs.length === 2 ? "batch_payout" : vocabs[0]!,
    vocabs,
    stage: "payout",
    status: v.status,
    ...(legacyId ? { paymentReference: legacyId, referenceField: "unique_id" as const } : {}),
    ...(currencies.length === 1 ? { amount: { currency: currencies[0]! } } : {}),
    extra: [
      ["operation", "batch_payout"],
      ["itemCount", items ? items.length : undefined],
      ["itemsField", Array.isArray(v.unique_ids) ? "unique_ids" : items ? "unique_id" : undefined],
      ["perItemResultsDocumented", false],
    ],
    path: "",
  };
}

function notificationShape(v: NotificationValue): Shape {
  const ezw = txnId(v.ezw_reference_id);
  const uid = txnId(v.unique_id);
  const payoutFields = Boolean(v.ezw_reference_id || v.merchant_reference);
  const transferFields = Boolean(v.transaction_id);
  const variant =
    payoutFields && !transferFields
      ? "payout"
      : transferFields && !payoutFields
        ? "transfer"
        : undefined;
  const vocab: Vocabulary =
    variant === "payout"
      ? "payout_notification"
      : variant === "transfer"
        ? "transfer_notification"
        : "notification";
  const merchant = merchantRef(variant === "payout" ? v.merchant_reference : v.transaction_id);
  const signature = typeof v.signature === "string" ? v.signature : undefined;
  return {
    label: vocab,
    vocabs: [vocab],
    stage: VOCABULARY_STAGE[vocab],
    status: v.status,
    ...(ezw
      ? {
          paymentReference: ezw,
          referenceField: "ezw_reference_id" as const,
          ...(uid ? { relatedReference: uid, relatedReferenceField: "unique_id" as const } : {}),
        }
      : uid
        ? { paymentReference: uid, referenceField: "unique_id" as const }
        : {}),
    ...(merchant
      ? {
          merchantReference: merchant,
          merchantReferenceField: variant === "payout" ? "merchant_reference" : "transaction_id",
          ...(variant === "transfer" ? { transactionIdLink: true as const } : {}),
        }
      : {}),
    // The payload has nothing but the id and the status, so two copies with
    // the same unique_id and status are the same business event.
    ...(uid && safeId(v.status, 64) ? { deliveryKey: `${uid}:${v.status}` } : {}),
    extra: [
      ["operation", "notification"],
      ["notificationVariant", variant ?? "not determined"],
      ["signaturePresent", signature !== undefined],
      [
        "signatureShape",
        signature === undefined
          ? undefined
          : SHA1_HEX.test(signature)
            ? "40 hex characters"
            : "unexpected format",
      ],
      ["signatureVerified", signature === undefined ? undefined : false],
      ["declineReasonText", v.decline_reason ?? undefined],
      ["declineReasonClassified", typeof v.decline_reason === "string" ? false : undefined],
    ],
    path: "",
  };
}

function shapeOf(parsed: Exclude<EzeewalletParsed, { kind: "error" }>): Shape {
  switch (parsed.kind) {
    case "transfer":
      return transferShape(parsed.value, parsed.wrapped);
    case "refund": {
      const v = parsed.value;
      const ezw = txnId(v.ezw_reference_id);
      const merchant = merchantRef(v.merchant_transaction_id);
      return {
        label: "refunds",
        vocabs: ["refunds"],
        stage: "refund",
        status: v.status,
        ...(ezw ? { paymentReference: ezw, referenceField: "ezw_reference_id" as const } : {}),
        ...(merchant
          ? { merchantReference: merchant, merchantReferenceField: "merchant_transaction_id" }
          : {}),
        amount: amountOf(v.amount, v.currency),
        extra: [
          ["operation", "refund"],
          ["parentReference", ezw ? "ezw_reference_id of the original transfer" : undefined],
        ],
        path: "refund",
      };
    }
    case "transaction": {
      const v = parsed.value;
      const typeStage = lookup(LOOKUP_TYPES, v.type);
      const ezw = txnId(v.ezw_reference_id);
      return {
        label: "transaction",
        vocabs: ["transaction"],
        stage: typeStage ?? "other",
        status: v.status,
        ...(ezw ? { paymentReference: ezw, referenceField: "ezw_reference_id" as const } : {}),
        extra: [
          ["operation", "lookup"],
          ["lookupType", v.type],
          ["lookupTypeKnown", Boolean(typeStage)],
        ],
        path: "",
      };
    }
    case "single_payout": {
      const v = parsed.value;
      const ezw = txnId(v.ezw_reference_id);
      const uid = txnId(v.unique_id);
      const vocab: Vocabulary = v.ezw_reference_id ? "single_payouts_new" : "single_payouts";
      const merchant = merchantRef(v.merchant_reference);
      return {
        label: vocab,
        vocabs: [vocab],
        stage: "payout",
        status: v.status,
        ...(ezw
          ? { paymentReference: ezw, referenceField: "ezw_reference_id" as const }
          : uid
            ? { paymentReference: uid, referenceField: "unique_id" as const }
            : {}),
        ...(merchant
          ? { merchantReference: merchant, merchantReferenceField: "merchant_reference" }
          : {}),
        extra: [["operation", "payout"]],
        path: "",
      };
    }
    case "batch_payout":
      return batchShape(parsed.value);
    case "notification":
      return notificationShape(parsed.value);
  }
}

function lifecycleEvent(shape: Shape, ctx: NormalizeContext): NormalizedEventDraft {
  const entry = statusOf(shape.vocabs, shape.status);
  const status = safeText(shape.status, 64) ?? "unknown";
  const outcome: Outcome = entry?.outcome ?? "unknown";
  const httpStatus = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `${shape.label}.${status}`,
    eventTypeKnown: Boolean(entry),
    stage: shape.stage,
    providerStatus: status,
    paymentReference: shape.paymentReference,
    relatedReference: shape.relatedReference,
    merchantReference: shape.merchantReference,
    deliveryKey: shape.deliveryKey,
    amountMinor: shape.amount?.minor,
    currency: shape.amount?.currency,
    outcome,
    attributes: attrs([
      ["paymentFamily", "wallet"],
      ["statusVocabulary", shape.vocabs.join(" / ")],
      ["statusDocumentedIn", entry?.documentedIn],
      ["statusMeaning", entry?.meaning],
      ["referenceField", shape.referenceField],
      ["relatedReferenceField", shape.relatedReferenceField],
      [
        "merchantReferenceField",
        shape.merchantReference ? shape.merchantReferenceField : undefined,
      ],
      ["transactionIdLink", shape.transactionIdLink],
      ["amountNotConvertible", shape.amount?.raw],
      ...(shape.extra ?? []),
      ["httpStatus", httpStatus],
    ]),
    source: { recordIndex: ctx.recordIndex, path: shape.path },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function errorEvent(
  e: z.infer<typeof ErrorEnvelope>["error"],
  ctx: NormalizeContext,
): NormalizedEventDraft {
  const code = codeOf(e.code);
  const entry = code ? lookup(ERROR_CODES, code) : undefined;
  const httpStatus = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `error.${code ?? "unknown"}`,
    eventTypeKnown: Boolean(entry),
    stage: "error",
    providerStatus: httpStatus ? `HTTP ${httpStatus}` : code,
    // A documented business error is a definitive rejection of the request;
    // an internal error (500) or an unknown code leaves the outcome open.
    outcome: entry && entry.httpStatus === 400 ? "failure" : "unknown",
    attributes: attrs([
      ["errorCode", code],
      ["errorMessage", e.message ?? undefined],
      ["errorCodeType", typeof e.code === "number" ? "integer" : "string"],
      ["httpStatus", httpStatus],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "error" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function normalize(parsed: EzeewalletParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  if (parsed.kind === "error") return [errorEvent(parsed.value, ctx)];
  return [lifecycleEvent(shapeOf(parsed), ctx)];
}

const DOCS: DocumentationLink = { title: "eZeeWallet API reference (Errors)", url: API_DOCS_URL };

/** Decodes the error envelope with the HTTP status when it is known. */
export function decodeError(
  e: z.infer<typeof ErrorEnvelope>["error"],
  httpStatus: number | undefined,
  ctx: NormalizeContext,
): DecodedErrorDraft {
  const code = codeOf(e.code);
  const entry = code ? lookup(ERROR_CODES, code) : undefined;
  const raw = safeText(String(e.code), 16) ?? "unknown";
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  if (httpStatus !== undefined) subCodes.http_status = String(httpStatus);
  const message = safeText(e.message ?? undefined, 200);
  const source = { recordIndex: ctx.recordIndex, path: "error" };

  if (entry) {
    let explanation = `eZeeWallet error ${code}: ${entry.meaning}. This is an eZeeWallet application code, not an HTTP status; eZeeWallet documents it with HTTP ${entry.httpStatus}.`;
    if (code === "401")
      explanation +=
        " The same code is used for missing or invalid parameters and for the deprecated password parameter; the message tells which.";
    if (httpStatus !== undefined && httpStatus !== entry.httpStatus)
      missing.push(
        `The HTTP status ${httpStatus} differs from the documented HTTP ${entry.httpStatus} for this code; check that the response was captured completely.`,
      );
    missing.push(
      "Category and retry guidance are PandaPayLens suggestions; eZeeWallet gives no per-code retry advice.",
    );
    return {
      sourceFormat: ctx.format,
      source,
      code: code!,
      subCodes,
      category: entry.category,
      ...(message ? { providerMessage: message } : {}),
      explanation,
      nextAction: entry.nextAction ?? NEXT_ACTION[entry.category],
      retry: entry.retry,
      retryExplanation: entry.retryNote ?? RETRY_TEXT[entry.retry],
      confidence: "strong",
      documentation: [DOCS],
      missingInformation: missing,
      // Every documented code except 500 is a definitive rejection.
      ...(entry.httpStatus === 400 ? { outcomeKnown: true } : {}),
    };
  }

  missing.push(`Error code "${raw}" is not in the documented eZeeWallet error table.`);
  if (code === "411") missing.push("Code 411 does not exist in the documented table.");
  if (httpStatus === 500) {
    return {
      sourceFormat: ctx.format,
      source,
      code: code ?? raw,
      subCodes,
      category: "provider_unavailable",
      ...(message ? { providerMessage: message } : {}),
      explanation: `HTTP 500 with the undocumented error code "${raw}". eZeeWallet documents HTTP 500 for internal errors, so the outcome of the request is not known.`,
      nextAction: NEXT_ACTION.provider_unavailable,
      retry: "retry_conditionally",
      retryExplanation: RETRY_TEXT.retry_conditionally,
      confidence: "possible",
      documentation: [DOCS],
      missingInformation: missing,
    };
  }
  if (httpStatus === undefined)
    missing.push("No HTTP status was supplied, so no fallback category is available.");
  return {
    sourceFormat: ctx.format,
    source,
    code: code ?? raw,
    subCodes,
    category: "unknown",
    ...(message ? { providerMessage: message } : {}),
    explanation: `PandaPayLens does not recognize the eZeeWallet error code "${raw}".`,
    nextAction: NEXT_ACTION.unknown,
    retry: "unknown",
    retryExplanation: RETRY_TEXT.unknown,
    confidence: "insufficient",
    documentation: [DOCS],
    missingInformation: missing,
  };
}

/**
 * A documented failure status carries no reason code. A notification may add
 * decline_reason, whose values are not documented: it is shown as provider
 * text and never classified.
 */
function decodeFailureStatus(
  shape: Shape,
  ctx: NormalizeContext,
  declineReason?: string,
): DecodedErrorDraft | undefined {
  const entry = statusOf(shape.vocabs, shape.status);
  if (entry?.outcome !== "failure") return undefined;
  const status = safeText(shape.status, 64) ?? "unknown";
  const reason = safeText(declineReason, 200);
  const missing = [
    reason
      ? "decline_reason is free text whose values eZeeWallet does not document; it is shown as written and not classified."
      : "eZeeWallet gives no reason code for this status, so the reason is unknown.",
  ];
  if (shape.vocabs.includes("batch_payouts") || shape.vocabs.includes("batch_payouts_new"))
    missing.push("Per-item results of a batch payout are not documented.");
  if (!shape.paymentReference)
    missing.push(
      "No eZeeWallet id was supplied; the transaction cannot be looked up from this record.",
    );
  return {
    sourceFormat: ctx.format,
    source: { recordIndex: ctx.recordIndex, path: shape.path },
    ...(shape.paymentReference
      ? { paymentReference: shape.paymentReference, attemptReference: shape.paymentReference }
      : {}),
    code: status,
    subCodes: { endpoint: shape.label },
    category: "unknown",
    ...(reason ? { providerMessage: reason } : {}),
    explanation: `eZeeWallet reports status "${status}" on ${shape.label}: ${entry.meaning}. The status is a definitive result, but eZeeWallet does not say why.`,
    nextAction: NEXT_ACTION.unknown,
    retry: "unknown",
    retryExplanation: RETRY_TEXT.unknown,
    confidence: "insufficient",
    documentation: [{ title: "eZeeWallet API reference", url: API_DOCS_URL }],
    missingInformation: missing,
    outcomeKnown: true,
  };
}

function decodeErrors(parsed: EzeewalletParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  if (parsed.kind === "error") {
    const status = ctx.meta?.http?.kind === "response" ? ctx.meta.http.status : undefined;
    return [decodeError(parsed.value, status, ctx)];
  }
  const shape = shapeOf(parsed);
  const reason =
    parsed.kind === "notification" ? (parsed.value.decline_reason ?? undefined) : undefined;
  const err = decodeFailureStatus(shape, ctx, reason);
  return err ? [err] : [];
}

export const ezeewalletAdapter: ProviderAdapter<EzeewalletParsed> = {
  id: PROVIDER,
  displayName: "eZeeWallet",
  version: EZEEWALLET_ADAPTER_VERSION,
  manifest: ezeewalletManifest,
  supportedFormats: [
    {
      id: "ezeewallet.transfer",
      description:
        "POST /transfers and /transfers_new responses (transfer wrapper) and GET /transfers list items",
    },
    { id: "ezeewallet.refund", description: "POST /refunds responses (refund wrapper)" },
    {
      id: "ezeewallet.transaction",
      description: "GET /transaction lookup (ezw_reference_id, status, type)",
    },
    {
      id: "ezeewallet.single_payout",
      description: "POST /single_payouts and /single_payouts_new responses",
    },
    {
      id: "ezeewallet.batch_payout",
      description:
        "POST /batch_payouts_new responses (and legacy /batch_payouts when selected manually)",
    },
    { id: "ezeewallet.error", description: 'Error envelope { "error": { "code", "message" } }' },
    {
      id: "ezeewallet.notification",
      description:
        "Transfer and payout notifications (unique_id, status, signature, decline_reason)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // ezw_reference_id and unique_id are kept in separate namespaces because
    // the reference does not say whether they hold the same value. The
    // merchant's transaction_id links a legacy transfer response to its
    // notification only: eZeeWallet refuses to process it twice (code 408) and
    // the legacy response carries no eZeeWallet id.
    const keys: string[] = [];
    const a = event.attributes;
    if (event.paymentReference && typeof a.referenceField === "string")
      keys.push(`${a.referenceField}:${event.paymentReference}`);
    if (event.relatedReference && typeof a.relatedReferenceField === "string")
      keys.push(`${a.relatedReferenceField}:${event.relatedReference}`);
    if (a.transactionIdLink === true && event.merchantReference)
      keys.push(`transaction_id:${event.merchantReference}`);
    return keys;
  },
};

export * from "./catalog.js";
export default ezeewalletAdapter;
