/**
 * AstroPay adapter (merchant APIs of the public developer portal).
 *
 * AstroPay runs several merchant product families with their own identifiers,
 * status vocabularies and signature schemes. Each family is its own format and
 * its statuses are read only with its own table:
 *
 * - `astropay.checkout.create_response`  Checkout create response (payment_external_id, status)
 * - `astropay.checkout.callback`         Checkout callback (payment_status, payment_info)
 * - `astropay.checkout.payment`          payment object with a Checkout-only status
 * - `astropay.wof.payment`               payment object with a Wallet on File-only status
 * - `astropay.payment_object`            payment object whose family is not visible
 * - `astropay.cashout_v1`                Cashouts V1 response or callback (payout to a wallet)
 * - `astropay.direct_payment`            Direct Payment response or callback (deposit)
 * - `astropay.direct_withdrawal`         Direct Withdrawal response or callback (payout to a bank)
 * - `astropay.qr.callback`               QR Payments deposit callback
 * - `astropay.merchant_gateway.error`    OneTouch / merchant-api error envelope
 * - `astropay.partner.error`             Checkout and Wallet on File error body
 * - `astropay.cashout_v1.error`          Cashouts V1 error (no machine code)
 *
 * Recognized but not analyzed: `astropay.wallet_deposit` (classic wallet
 * Deposit API, documented only in private sections that were not read),
 * `astropay.platform.error` and `astropay.platform.webhook` (Platform API,
 * out of first scope).
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
  type ProviderAdapter,
  type RecordMeta,
  type RetryGuidance,
  type SafePrimitive,
} from "@pandapaylens/core";
import { z } from "zod";
import {
  CASHOUT_V1_ERRORS,
  CASHOUT_V1_ERRORS_URL,
  CASHOUT_V1_STATUSES,
  CHECKOUT_ONLY_STATUSES,
  CHECKOUT_STATUSES,
  CPF_DOCUMENT_STATUSES,
  DIRECT_PAYMENT_ERRORS_URL,
  DIRECT_PAYMENT_STATUSES,
  DIRECT_WITHDRAWAL_CANCEL_REASONS_URL,
  DIRECT_WITHDRAWAL_ERRORS_URL,
  DIRECT_WITHDRAWAL_STATUSES,
  GATEWAY_ERRORS,
  GATEWAY_INTERNAL_TERMS,
  GATEWAY_REASON_CODES,
  GENERIC_PARTNER_CODES,
  GENERIC_PLATFORM_CODES,
  HTTP_STATUSES,
  NEXT_ACTION,
  PARTNER_ERROR_TABLES,
  PAYMENT_TRANSACTION_RESULTS,
  PAYMENT_TRANSACTION_TYPES,
  PLATFORM_ERROR_CODES,
  PLATFORM_EVENTS,
  QR_CODE_STATUSES,
  QR_STATUSES,
  RETRY_TEXT,
  STATUS_CHECK,
  STATUS_TABLES,
  WITHDRAWAL_CANCEL_REASONS,
  WOF_ERRORS_URL,
  WOF_ONLY_STATUSES,
  WOF_STATUSES,
  type CashoutErrorEntry,
  type ErrorEntry,
  type Family,
} from "./catalog.js";

import { astropayManifest, ASTROPAY_ADAPTER_VERSION } from "./manifest.js";

export { astropayManifest, ASTROPAY_ADAPTER_VERSION };

const PROVIDER = "astropay";

// Identifiers are strings, except Cashouts V1 cashout_id (integer in the
// tables, string in the callback example).
const Id = z.union([z.string().max(256), z.number().int()]);
const Num = z.union([z.number(), z.string().max(40)]);
const NStr = (max: number) => z.string().max(max).nullable().optional();
const NId = Id.nullable().optional();
const NBool = z.boolean().nullable().optional();

const CheckoutCreate = z.looseObject({
  payment_external_id: z.string().max(256),
  status: z.string().max(64),
  merchant_payment_id: NStr(256),
});

const CheckoutCallback = z.looseObject({
  payment_external_id: z.string().max(256),
  payment_status: z.string().max(64),
  merchant_payment_id: NStr(256),
  payment_info: z
    .looseObject({
      payment_amount: z
        .looseObject({ currency: NStr(8), value: Num.nullable().optional() })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

const PaymentTransaction = z.looseObject({
  payment_transaction_id: NId,
  type: NStr(64),
  result: NStr(64),
});

const PaymentObject = z.looseObject({
  payment_id: z.string().max(256),
  status: z.string().max(64),
  merchant_payment_id: NStr(256),
  payment_transactions: z.array(PaymentTransaction).max(500).nullable().optional(),
  is_authorization_completed: NBool,
  is_reversible: NBool,
  // AstroPay's own spelling on the refund pages.
  is_reversable: NBool,
  is_refundable: NBool,
});

const CashoutV1 = z
  .looseObject({
    status: z.string().max(64),
    cashout_id: NId,
    merchant_cashout_id: NStr(256),
    end_status_date: NStr(64),
  })
  .refine((v) => v.cashout_id != null || v.merchant_cashout_id != null, {
    message: "cashout_id or merchant_cashout_id is required",
    path: ["cashout_id"],
  });

const DirectPayment = z
  .looseObject({
    status: z.string().max(64),
    deposit_external_id: NStr(256),
    merchant_deposit_id: NStr(256),
    end_status_date: NStr(64),
  })
  .refine((v) => v.deposit_external_id != null || v.merchant_deposit_id != null, {
    message: "deposit_external_id or merchant_deposit_id is required",
    path: ["deposit_external_id"],
  });

const DirectWithdrawal = z
  .looseObject({
    status: z.string().max(64),
    cashout_external_id: NId,
    merchant_cashout_id: NStr(256),
    description: NStr(500),
    end_status_date: NStr(64),
  })
  .refine((v) => v.cashout_external_id != null || v.merchant_cashout_id != null, {
    message: "cashout_external_id or merchant_cashout_id is required",
    path: ["cashout_external_id"],
  });

const QrCallback = z.looseObject({
  status: z.string().max(64),
  deposit_external_id: z.string().max(256),
  payment_code_external_id: NId,
  amount: Num.nullable().optional(),
  currency: NStr(8),
  merchant_amount: Num.nullable().optional(),
  merchant_currency: NStr(8),
  qr_status: NStr(64),
  end_status_date: NStr(64),
});

const Reason = z.looseObject({
  reason_code: NStr(128),
  description: NStr(500),
  fields: z.array(z.string().max(128)).max(100).nullable().optional(),
});

const GatewayError = z.looseObject({
  error: z.string().max(128),
  description: NStr(2000),
  internal_term: NStr(128),
  message: NStr(2000),
  reasons: z.array(Reason).max(50).nullable().optional(),
  detail: z.looseObject({}).nullable().optional(),
});

const PartnerError = z.looseObject({
  error: z.string().max(128),
  message: NStr(2000),
  description: NStr(2000),
});

const CashoutV1Error = z
  .looseObject({ description: NStr(2000), message: NStr(2000), error: NStr(128) })
  .refine((v) => Boolean(v.description ?? v.message), {
    message: "description or message is required",
    path: ["description"],
  });

type PaymentFamily = "checkout" | "wallet_on_file" | "checkout_or_wallet_on_file";

export type AstropayParsed =
  | { kind: "checkout_create"; value: z.infer<typeof CheckoutCreate> }
  | { kind: "checkout_callback"; value: z.infer<typeof CheckoutCallback> }
  | { kind: "payment_object"; family: PaymentFamily; value: z.infer<typeof PaymentObject> }
  | { kind: "cashout_v1"; value: z.infer<typeof CashoutV1> }
  | { kind: "direct_payment"; value: z.infer<typeof DirectPayment> }
  | { kind: "direct_withdrawal"; value: z.infer<typeof DirectWithdrawal> }
  | { kind: "qr_callback"; value: z.infer<typeof QrCallback> }
  | { kind: "gateway_error"; value: z.infer<typeof GatewayError> }
  | { kind: "partner_error"; value: z.infer<typeof PartnerError> }
  | { kind: "cashout_v1_error"; value: z.infer<typeof CashoutV1Error> };

const FORMATS = {
  "astropay.checkout.create_response": ["checkout_create", CheckoutCreate],
  "astropay.checkout.callback": ["checkout_callback", CheckoutCallback],
  "astropay.checkout.payment": ["payment_object", PaymentObject],
  "astropay.wof.payment": ["payment_object", PaymentObject],
  "astropay.payment_object": ["payment_object", PaymentObject],
  "astropay.cashout_v1": ["cashout_v1", CashoutV1],
  "astropay.direct_payment": ["direct_payment", DirectPayment],
  "astropay.direct_withdrawal": ["direct_withdrawal", DirectWithdrawal],
  "astropay.qr.callback": ["qr_callback", QrCallback],
  "astropay.merchant_gateway.error": ["gateway_error", GatewayError],
  "astropay.partner.error": ["partner_error", PartnerError],
  "astropay.cashout_v1.error": ["cashout_v1_error", CashoutV1Error],
} as const;

const PAYMENT_FAMILY: Record<string, PaymentFamily> = {
  "astropay.checkout.payment": "checkout",
  "astropay.wof.payment": "wallet_on_file",
  "astropay.payment_object": "checkout_or_wallet_on_file",
};

/** Correlation key space per format: identifiers of different families never link. */
const KEY_SPACE: Record<string, string> = {
  "astropay.checkout.create_response": "payment",
  "astropay.checkout.callback": "payment",
  "astropay.checkout.payment": "payment",
  "astropay.wof.payment": "payment",
  "astropay.payment_object": "payment",
  "astropay.cashout_v1": "cashout_v1",
  "astropay.direct_payment": "deposit",
  "astropay.qr.callback": "qr_deposit",
  "astropay.direct_withdrawal": "direct_withdrawal",
};

const PREFIX: Record<Family, string> = {
  checkout: "checkout",
  wallet_on_file: "wof",
  checkout_or_wallet_on_file: "checkout_or_wof",
  cashout_v1: "cashout_v1",
  direct_payment: "direct_payment",
  direct_withdrawal: "direct_withdrawal",
  qr_payments: "qr",
};

/** Stage when the status is unknown: the operation itself is known. */
const DEFAULT_STAGE: Record<Family, LifecycleStage> = {
  checkout: "payment",
  wallet_on_file: "payment",
  checkout_or_wallet_on_file: "payment",
  cashout_v1: "payout",
  direct_payment: "payment",
  direct_withdrawal: "payout",
  qr_payments: "payment",
};

/** Documented signature scheme per family; others do not state one. */
const EXPECTED_SIGNATURE: Partial<Record<Family, "rsa" | "hmac">> = {
  checkout: "rsa",
  cashout_v1: "hmac",
  qr_payments: "hmac",
};

const PAYMENT_FLAGS = [
  "captured_amount",
  "reversed_amount",
  "refunded_amount",
  "is_authorization_completed",
  "is_reversible",
  "is_reversable",
  "is_refundable",
] as const;

const CASHOUT_ERROR_KEYS = new Set(["description", "message", "error"]);

const CLASSIC_DEPOSIT_REASON =
  "This looks like a classic AstroPay wallet deposit callback (deposit_user_id). The classic Deposit API is documented only in private sections that were not reviewed, so it is recognized but not analyzed.";

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function idLike(v: unknown): boolean {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0;
  return typeof v === "string" && v.length > 0 && v.length <= 256;
}

/** Identifier as a string; integer ids (Cashouts V1) become their decimal form. */
function idOf(v: unknown): string | undefined {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? String(v) : undefined;
  return safeId(v, 256);
}

function codeOf(v: unknown, re = /^[A-Za-z0-9_.-]{1,64}$/): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return re.test(t) ? t : undefined;
}

const round = (n: number) => Math.round(Math.min(0.98, n) * 100) / 100;

function signatureHeaders(meta?: RecordMeta): { rsa: boolean; hmac: boolean; partner: boolean } {
  const h = meta?.http?.headers ?? {};
  const rsa = has(h, "partner-signature");
  return {
    rsa,
    hmac: has(h, "signature"),
    partner: rsa || has(h, "partner-request-id") || has(h, "partner-certificate-serial-number"),
  };
}

function paymentFormat(status: unknown): string {
  if (typeof status === "string" && WOF_ONLY_STATUSES.has(status)) return "astropay.wof.payment";
  if (typeof status === "string" && CHECKOUT_ONLY_STATUSES.has(status))
    return "astropay.checkout.payment";
  return "astropay.payment_object";
}

function partnerVariants(code: string | undefined): (ErrorEntry & { operation: string })[] {
  if (!code) return [];
  return PARTNER_ERROR_TABLES.flatMap(({ operation, table }) => {
    const entry = lookup(table, code);
    return entry ? [{ ...entry, operation }] : [];
  });
}

function cashoutText(o: { description?: unknown; message?: unknown; error?: unknown }) {
  if (nonEmpty(o.description)) return o.description;
  if (nonEmpty(o.message)) return o.message;
  return undefined;
}

/** First Cashouts V1 row whose key words match; the HTTP status must agree when known. */
export function matchCashoutError(
  text: string | undefined,
  httpStatus: number | undefined,
): CashoutErrorEntry | undefined {
  if (!text) return undefined;
  const t = text.slice(0, 500);
  return CASHOUT_V1_ERRORS.find(
    (e) => e.pattern.test(t) && (httpStatus === undefined || e.httpStatus === httpStatus),
  );
}

function detectError(
  input: Record<string, unknown>,
  meta: RecordMeta | undefined,
): DetectionResult | undefined {
  const code = input.error as string;
  const http = meta?.http?.status;
  const base = { provider: PROVIDER, supported: true };
  const term = typeof input.internal_term === "string" ? input.internal_term : undefined;
  const reasons =
    Array.isArray(input.reasons) && input.reasons.some((r) => isObj(r) && has(r, "reason_code"));
  const gw = lookup(GATEWAY_ERRORS, code);
  const gwPrefix = /^(?:commons|merchant_gateway)_[a-z_]+$/.test(code);

  if (term !== undefined || gwPrefix || reasons) {
    const why = ["has the error envelope"];
    let s = term !== undefined ? 0.75 : gwPrefix ? 0.7 : 0.6;
    if (term !== undefined) why.push("has internal_term");
    if (gwPrefix) why.push("error has a commons_ or merchant_gateway_ prefix");
    if (reasons) {
      s += 0.05;
      why.push("has reasons[].reason_code");
    }
    if (gw) {
      s += 0.1;
      why.push("error is a documented value");
    }
    if (term && lookup(GATEWAY_INTERNAL_TERMS, term)) s += 0.05;
    if (http !== undefined && gw?.httpStatus === http) s += 0.05;
    return {
      ...base,
      format: "astropay.merchant_gateway.error",
      confidence: round(s),
      reasons: why,
    };
  }

  // The generic internal_error example: claimed only with its HTTP class.
  if (gw && (nonEmpty(input.description) || nonEmpty(input.message))) {
    return {
      ...base,
      format: "astropay.merchant_gateway.error",
      confidence: http === 500 ? 0.5 : 0.4,
      reasons: ["error is a generic documented value"],
    };
  }

  const variants = partnerVariants(code);
  if (variants.length) {
    const generic = GENERIC_PARTNER_CODES.has(code);
    let s = generic ? 0.4 : 0.7;
    const why = [`error "${safeText(code, 64)}" is a documented Checkout / Wallet on File value`];
    if (http !== undefined && variants.some((v) => v.httpStatus === http)) {
      s += 0.1;
      why.push("HTTP status matches the documented status");
    }
    if (!generic && (has(input, "message") || has(input, "description"))) s += 0.05;
    return { ...base, format: "astropay.partner.error", confidence: round(s), reasons: why };
  }

  if (
    lookup(PLATFORM_ERROR_CODES, code) &&
    !GENERIC_PLATFORM_CODES.has(code) &&
    (nonEmpty(input.description) || nonEmpty(input.message))
  ) {
    return {
      provider: PROVIDER,
      format: "astropay.platform.error",
      confidence: 0.6,
      supported: false,
      reasons: [`error "${safeText(code, 64)}" is a Platform API value`],
      unsupportedReason:
        "This is an AstroPay Platform (Partners API, BaaS) error. The Platform API is outside the first scope of this adapter, so it is recognized but not analyzed.",
    };
  }
  return undefined;
}

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
  // Stripe payloads carry `object`; AstroPay payloads never do.
  if (has(input, "object")) return none;
  const ok = (format: string, score: number, reasons: string[]): DetectionResult => ({
    ...base,
    format,
    confidence: round(score),
    supported: true,
    reasons,
  });
  const sig = signatureHeaders(meta);
  const status = typeof input.status === "string" ? input.status : undefined;
  const known = (table: Record<string, unknown>) => Boolean(status && lookup(table, status));

  // Platform webhooks name the event in the URL path, not in the body.
  const http = meta?.http;
  if (http?.kind === "request" && http.path && sig.partner) {
    const last = http.path.split("/").filter(Boolean).pop();
    if (last && PLATFORM_EVENTS.has(last))
      return {
        ...base,
        format: "astropay.platform.webhook",
        confidence: 0.6,
        supported: false,
        reasons: [
          `request path ends with the Platform event name ${last}`,
          "has Partner signature headers",
        ],
        unsupportedReason: `AstroPay Platform ${last} webhooks are outside the first scope of this adapter and are recognized but not analyzed.`,
      };
  }

  const depositExt = idLike(input.deposit_external_id);
  const merchantDeposit = idLike(input.merchant_deposit_id);
  if (has(input, "deposit_user_id") && (depositExt || merchantDeposit)) {
    return {
      ...base,
      format: "astropay.wallet_deposit",
      confidence: 0.7,
      supported: false,
      reasons: ["has deposit_user_id with a deposit identifier"],
      unsupportedReason: CLASSIC_DEPOSIT_REASON,
    };
  }

  if (depositExt && has(input, "payment_code_external_id")) {
    const why = ["has deposit_external_id with payment_code_external_id"];
    let s = 0.75;
    if (known(QR_STATUSES)) s += 0.1;
    if (has(input, "end_status_date")) s += 0.05;
    if (sig.hmac) s += 0.05;
    return ok("astropay.qr.callback", s, why);
  }

  if (
    depositExt ||
    (merchantDeposit && (has(input, "end_status_date") || isObj(input.payment_detail)))
  ) {
    const why: string[] = [];
    let s = 0.5;
    if (depositExt) {
      s += 0.2;
      why.push("has deposit_external_id");
    }
    if (merchantDeposit) {
      s += 0.15;
      why.push("has merchant_deposit_id");
    }
    if (known(DIRECT_PAYMENT_STATUSES)) s += 0.1;
    if (has(input, "end_status_date")) s += 0.05;
    if (isObj(input.payment_detail)) s += 0.05;
    return ok("astropay.direct_payment", s, why);
  }

  if (idLike(input.cashout_external_id)) {
    const why = ["has cashout_external_id"];
    let s = 0.6;
    if (idLike(input.merchant_cashout_id)) {
      s += 0.15;
      why.push("has merchant_cashout_id");
    }
    if (known(DIRECT_WITHDRAWAL_STATUSES)) s += 0.1;
    if (has(input, "end_status_date")) s += 0.05;
    return ok("astropay.direct_withdrawal", s, why);
  }

  const cashoutPair = idLike(input.cashout_id) && idLike(input.merchant_cashout_id);
  if (has(input, "cashout_user_id") || cashoutPair) {
    const why = [cashoutPair ? "has cashout_id with merchant_cashout_id" : "has cashout_user_id"];
    let s = 0.6;
    if (cashoutPair && has(input, "cashout_user_id")) s += 0.1;
    if (known(CASHOUT_V1_STATUSES)) s += 0.1;
    if (has(input, "end_status_date")) s += 0.05;
    if (sig.hmac) s += 0.05;
    return ok("astropay.cashout_v1", s, why);
  }

  if (nonEmpty(input.payment_external_id)) {
    if (has(input, "payment_status") || isObj(input.payment_info)) {
      const why = ["has payment_external_id with payment_status or payment_info"];
      let s = 0.6;
      const ps = input.payment_status;
      if (typeof ps === "string" && lookup(CHECKOUT_STATUSES, ps)) s += 0.15;
      if (isObj(input.payment_info) && isObj(input.payment_info.payment_amount)) {
        s += 0.1;
        why.push("has payment_info.payment_amount");
      }
      if (has(input, "merchant_payment_id")) s += 0.05;
      if (has(input, "merchant_notification_url")) s += 0.05;
      if (sig.rsa) s += 0.05;
      return ok("astropay.checkout.callback", s, why);
    }
    const why = ["has payment_external_id"];
    let s = 0.45;
    if (known(CHECKOUT_STATUSES)) s += 0.15;
    if (has(input, "redirect_url") || has(input, "fallback_url")) {
      s += 0.15;
      why.push("has redirect_url or fallback_url");
    }
    if (has(input, "merchant_payment_id")) s += 0.05;
    return ok("astropay.checkout.create_response", s, why);
  }

  if (nonEmpty(input.payment_id)) {
    const flags = PAYMENT_FLAGS.filter((k) => has(input, k)).length;
    const txs =
      Array.isArray(input.payment_transactions) &&
      input.payment_transactions.some((t) => isObj(t) && has(t, "payment_transaction_id"));
    if (flags || txs) {
      const why = ["has payment_id"];
      let s = 0.45 + 0.1 * Math.min(flags, 3);
      if (flags) why.push("has payment object amount or flag fields");
      if (txs) {
        s += 0.2;
        why.push("has payment_transactions[].payment_transaction_id");
      }
      if (known(CHECKOUT_STATUSES) || known(WOF_STATUSES)) s += 0.1;
      return ok(paymentFormat(status), s, why);
    }
  }

  if (typeof input.error === "string") {
    const d = detectError(input, meta);
    if (d) return d;
  }

  // Cashouts V1 errors: only a description, matched on documented key words.
  const keys = Object.keys(input);
  if (keys.length && keys.every((k) => CASHOUT_ERROR_KEYS.has(k))) {
    const text = cashoutText(input);
    const status = meta?.http?.status;
    if (text && matchCashoutError(text, status))
      return ok("astropay.cashout_v1.error", status !== undefined ? 0.55 : 0.45, [
        "description matches a documented Cashouts V1 error",
        ...(status !== undefined ? ["HTTP status matches the documented status"] : []),
      ]);
  }
  return none;
}

function parse(
  input: unknown,
  format: string,
): { ok: true; value: AstropayParsed } | { ok: false; issues: string[] } {
  if (!Object.prototype.hasOwnProperty.call(FORMATS, format))
    return { ok: false, issues: [`Unsupported AstroPay format "${format}".`] };
  const entry = FORMATS[format as keyof typeof FORMATS];
  const r = entry[1].safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const family = lookup(PAYMENT_FAMILY, format);
  return {
    ok: true,
    value: { kind: entry[0], value: r.data, ...(family ? { family } : {}) } as AstropayParsed,
  };
}

type Attrs = Record<string, SafePrimitive | SafePrimitive[]>;

function attrs(entries: [string, unknown][]): Attrs {
  const out: Attrs = {};
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

function clean(d: NormalizedEventDraft): NormalizedEventDraft {
  return Object.fromEntries(
    Object.entries(d).filter(([, v]) => v !== undefined),
  ) as NormalizedEventDraft;
}

const DATE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * `end_status_date` is documented as YYYY-MM-DD HH:MM:SS without a zone;
 * examples use T and fractional seconds. Only values with an explicit zone
 * are placed on the timeline.
 */
function endStatus(v: unknown): { iso?: string; text?: string; noZone?: true } {
  if (typeof v !== "string") return {};
  const m = DATE.exec(v.trim());
  if (!m) return {};
  if (!m[4]) return { text: v.trim(), noZone: true };
  const frac = m[3] ? m[3].slice(0, 4) : "";
  const iso = toIsoTimestamp(`${m[1]}T${m[2]}${frac}${m[4].toUpperCase()}`);
  return { text: v.trim(), ...(iso ? { iso } : {}) };
}

function signatureAttrs(family: Family, meta: RecordMeta | undefined): [string, unknown][] {
  const s = signatureHeaders(meta);
  if (!s.rsa && !s.hmac) return [];
  const present =
    s.rsa && s.hmac
      ? "Partner-Signature and Signature"
      : s.rsa
        ? "Partner-Signature (RSA)"
        : "Signature (HMAC SHA256)";
  const expected = EXPECTED_SIGNATURE[family];
  const unexpected = expected ? (expected === "rsa" ? !s.rsa : !s.hmac) : false;
  return [
    ["signatureHeader", present],
    ["signatureVerified", false],
    ["signatureSchemeUnexpected", unexpected ? true : undefined],
  ];
}

type Message = "create" | "callback" | "response" | "payment";

/** Response or callback: the HTTP direction wins, otherwise callback-only fields decide. */
function messageKind(
  meta: RecordMeta | undefined,
  callbackHint: boolean,
): { message: Message; from: string } {
  if (meta?.http?.kind === "request") return { message: "callback", from: "HTTP request" };
  if (meta?.http?.kind === "response") return { message: "response", from: "HTTP response" };
  return callbackHint
    ? { message: "callback", from: "callback-only fields" }
    : { message: "response", from: "no callback-only fields" };
}

type StatusEventInput = {
  family: Family;
  message: Message;
  messageFrom?: string;
  status: string | undefined;
  paymentReference?: string | undefined;
  merchantReference?: string | undefined;
  callbackKey?: boolean;
  amount?: { minor?: string; currency?: string; raw?: true };
  endStatusDate?: unknown;
  attributes?: [string, unknown][];
};

function statusEvent(i: StatusEventInput, ctx: NormalizeContext): NormalizedEventDraft {
  const info = i.status ? lookup(STATUS_TABLES[i.family], i.status) : undefined;
  const statusCode = codeOf(i.status);
  const end = endStatus(i.endStatusDate);
  // No event id in merchant callbacks: family, AstroPay id and status.
  const deliveryKey =
    i.callbackKey && i.message === "callback" && i.paymentReference && statusCode
      ? `${PREFIX[i.family]}:${i.paymentReference}:${statusCode}`
      : undefined;
  return clean({
    sourceFormat: ctx.format,
    eventType: `${PREFIX[i.family]}.${i.message}.${statusCode ?? "unknown"}`,
    eventTypeKnown: Boolean(info),
    stage: info?.stage ?? DEFAULT_STAGE[i.family],
    providerStatus: i.status ? (safeText(i.status, 64) ?? undefined) : undefined,
    paymentReference: i.paymentReference,
    merchantReference: i.merchantReference,
    deliveryKey,
    eventTimestamp: end.iso,
    amountMinor: i.amount?.minor,
    currency: i.amount?.currency,
    outcome: info?.outcome ?? "unknown",
    attributes: attrs([
      ["productFamily", i.family],
      ["message", i.message],
      ["messageKindFrom", i.messageFrom],
      ["statusMeaning", info?.meaning],
      ["statusFinal", info?.final],
      ["statusMayChange", info?.mayChange],
      ["statusExampleOnly", info?.exampleOnly],
      ...(i.attributes ?? []),
      ["endStatusDate", end.text],
      ["endStatusDateWithoutZone", end.noZone],
      ["amountNotConvertible", i.amount?.raw],
      ...signatureAttrs(i.family, ctx.meta),
      ["httpStatus", ctx.meta?.http?.status],
    ]),
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

function money(value: unknown, currencyField: unknown): StatusEventInput["amount"] {
  const currency = upperCurrency(currencyField);
  if (value === undefined || value === null) return currency ? { currency } : undefined;
  const minor = decimalToMinor(value, currency);
  return {
    ...(currency ? { currency } : {}),
    ...(minor !== undefined ? { minor } : { raw: true }),
  };
}

function transactionEvents(
  txs: z.infer<typeof PaymentTransaction>[],
  family: PaymentFamily,
  paymentReference: string | undefined,
  ctx: NormalizeContext,
): NormalizedEventDraft[] {
  return txs.slice(0, 100).map((t, i) => {
    const type = t.type ?? undefined;
    const result = t.result ?? undefined;
    const stage = type ? lookup(PAYMENT_TRANSACTION_TYPES, type) : undefined;
    const outcome = result ? lookup(PAYMENT_TRANSACTION_RESULTS, result) : undefined;
    return clean({
      sourceFormat: ctx.format,
      eventType: `${PREFIX[family]}.transaction.${codeOf(type) ?? "unknown"}`,
      eventTypeKnown: Boolean(stage) && (result === undefined || Boolean(outcome)),
      stage: stage ?? "other",
      providerStatus: result ? (safeText(result, 64) ?? undefined) : undefined,
      paymentReference,
      relatedReference: idOf(t.payment_transaction_id),
      outcome: outcome ?? "unknown",
      attributes: attrs([
        ["productFamily", family],
        ["transactionType", type],
        ["transactionResult", result],
        ["stepTimestampNotDocumented", true],
      ]),
      source: { recordIndex: ctx.recordIndex, path: `payment_transactions[${i}]` },
      ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
    });
  });
}

function errorEvent(
  ctx: NormalizeContext,
  prefix: string,
  code: string | undefined,
  entries: [string, unknown][],
  extra: Attrs = {},
): NormalizedEventDraft {
  const http = ctx.meta?.http?.status;
  return clean({
    sourceFormat: ctx.format,
    eventType: `${prefix}.error${code ? `.${code}` : ""}`,
    eventTypeKnown: true,
    stage: "error",
    providerStatus: http !== undefined ? `HTTP ${http}` : code,
    outcome: "unknown",
    attributes: { ...attrs([...entries, ["httpStatus", http]]), ...extra },
    source: { recordIndex: ctx.recordIndex, path: "" },
    ...(ctx.observedTimestamp ? { observedTimestamp: ctx.observedTimestamp } : {}),
  });
}

const FIELD_NAME = /^[A-Za-z0-9_.[\]-]{1,64}$/;

/** Field names only; values in `detail` can repeat the rejected personal data. */
function fieldNames(names: unknown[]): string[] {
  return [
    ...new Set(names.filter((n): n is string => typeof n === "string" && FIELD_NAME.test(n))),
  ].slice(0, 20);
}

function normalize(parsed: AstropayParsed, ctx: NormalizeContext): NormalizedEventDraft[] {
  switch (parsed.kind) {
    case "checkout_create": {
      const v = parsed.value;
      return [
        statusEvent(
          {
            family: "checkout",
            message: "create",
            status: v.status,
            paymentReference: idOf(v.payment_external_id),
            merchantReference: merchantRef(v.merchant_payment_id),
            attributes: [["hasRedirectUrl", typeof v.redirect_url === "string" ? true : undefined]],
          },
          ctx,
        ),
      ];
    }
    case "checkout_callback": {
      const v = parsed.value;
      const amount = v.payment_info?.payment_amount;
      return [
        statusEvent(
          {
            family: "checkout",
            message: "callback",
            status: v.payment_status,
            paymentReference: idOf(v.payment_external_id),
            merchantReference: merchantRef(v.merchant_payment_id),
            callbackKey: true,
            amount: amount ? money(amount.value, amount.currency) : undefined,
          },
          ctx,
        ),
      ];
    }
    case "payment_object": {
      const v = parsed.value;
      const ref = idOf(v.payment_id);
      const reversible = v.is_reversible ?? v.is_reversable ?? undefined;
      const main = statusEvent(
        {
          family: parsed.family,
          message: "payment",
          status: v.status,
          paymentReference: ref,
          merchantReference: merchantRef(v.merchant_payment_id),
          attributes: [
            [
              "familyFrom",
              parsed.family === "checkout_or_wallet_on_file"
                ? "not visible in the record; only meanings shared by both families are used"
                : "status documented for this family only",
            ],
            ["isAuthorizationCompleted", v.is_authorization_completed ?? undefined],
            ["isRefundable", v.is_refundable ?? undefined],
            ["isReversible", reversible],
            [
              "reversibleField",
              v.is_reversible != null
                ? "is_reversible"
                : v.is_reversable != null
                  ? "is_reversable"
                  : undefined,
            ],
            ["transactionCount", v.payment_transactions?.length],
          ],
        },
        ctx,
      );
      // Steps first, then the payment's current status.
      return [...transactionEvents(v.payment_transactions ?? [], parsed.family, ref, ctx), main];
    }
    case "cashout_v1": {
      const v = parsed.value;
      const kind = messageKind(ctx.meta, has(v, "cashout_user_id") || v.end_status_date != null);
      return [
        statusEvent(
          {
            family: "cashout_v1",
            message: kind.message,
            messageFrom: kind.from,
            status: v.status,
            paymentReference: idOf(v.cashout_id),
            merchantReference: merchantRef(v.merchant_cashout_id),
            callbackKey: true,
            endStatusDate: v.end_status_date,
            attributes: [["cashoutIdType", v.cashout_id == null ? undefined : typeof v.cashout_id]],
          },
          ctx,
        ),
      ];
    }
    case "direct_payment": {
      const v = parsed.value;
      const kind = messageKind(ctx.meta, v.end_status_date != null || has(v, "merchant_user_id"));
      return [
        statusEvent(
          {
            family: "direct_payment",
            message: kind.message,
            messageFrom: kind.from,
            status: v.status,
            paymentReference: idOf(v.deposit_external_id),
            merchantReference: merchantRef(v.merchant_deposit_id),
            callbackKey: true,
            endStatusDate: v.end_status_date,
            attributes: [["hasPaymentDetail", isObj(v.payment_detail) ? true : undefined]],
          },
          ctx,
        ),
      ];
    }
    case "direct_withdrawal": {
      const v = parsed.value;
      const kind = messageKind(ctx.meta, v.end_status_date != null);
      const desc = v.description ?? undefined;
      const cancelled = v.status === "CANCELLED";
      const reason = cancelled ? codeOf(desc, /^[A-Z0-9_]{1,64}$/) : undefined;
      return [
        statusEvent(
          {
            family: "direct_withdrawal",
            message: kind.message,
            messageFrom: kind.from,
            status: v.status,
            paymentReference: idOf(v.cashout_external_id),
            merchantReference: merchantRef(v.merchant_cashout_id),
            callbackKey: true,
            endStatusDate: v.end_status_date,
            attributes: [
              ["cancelReason", reason],
              [
                "cancelReasonKnown",
                reason ? Boolean(lookup(WITHDRAWAL_CANCEL_REASONS, reason)) : undefined,
              ],
              ["statusDescription", !reason && desc ? desc : undefined],
              ["descriptionCodeSpaceNotDocumented", !cancelled && desc ? true : undefined],
            ],
          },
          ctx,
        ),
      ];
    }
    case "qr_callback": {
      const v = parsed.value;
      const merchantAmount = money(v.merchant_amount, v.merchant_currency);
      return [
        statusEvent(
          {
            family: "qr_payments",
            message: "callback",
            status: v.status,
            paymentReference: idOf(v.deposit_external_id),
            callbackKey: true,
            endStatusDate: v.end_status_date,
            amount: money(v.amount, v.currency),
            attributes: [
              ["paymentCodeExternalId", idOf(v.payment_code_external_id)],
              [
                "qrStatus",
                v.qr_status && QR_CODE_STATUSES.has(v.qr_status) ? v.qr_status : undefined,
              ],
              ["merchantAmountMinor", merchantAmount?.minor],
              ["merchantCurrency", merchantAmount?.currency],
              ["endStatusDateMeaning", "time the callback was sent (QR pages)"],
            ],
          },
          ctx,
        ),
      ];
    }
    case "gateway_error": {
      const e = parsed.value;
      const reasons = e.reasons ?? [];
      const reasonCodes = fieldNames(reasons.map((r) => r.reason_code));
      const fields = fieldNames(reasons.flatMap((r) => r.fields ?? []));
      const detail = isObj(e.detail) ? fieldNames(Object.keys(e.detail)) : [];
      return [
        errorEvent(
          ctx,
          "merchant_gateway",
          codeOf(e.error),
          [
            ["error", codeOf(e.error)],
            ["internalTerm", codeOf(e.internal_term)],
            ["description", e.description ?? e.message ?? undefined],
          ],
          {
            ...(reasonCodes.length ? { reasonCodes } : {}),
            ...(fields.length ? { fields } : {}),
            ...(detail.length ? { detailFields: detail } : {}),
          },
        ),
      ];
    }
    case "partner_error": {
      const e = parsed.value;
      return [
        errorEvent(ctx, "partner", codeOf(e.error), [
          ["error", codeOf(e.error)],
          ["message", e.message ?? e.description ?? undefined],
        ]),
      ];
    }
    case "cashout_v1_error": {
      const e = parsed.value;
      return [
        errorEvent(ctx, "cashout_v1", undefined, [
          ["description", cashoutText(e)],
          ["machineCodeDocumented", false],
        ]),
      ];
    }
  }
}

type Location = Pick<DecodedErrorDraft, "sourceFormat" | "source"> & {
  paymentReference?: string;
  attemptReference?: string;
};

const withRefs = (loc: Location) => ({
  sourceFormat: loc.sourceFormat,
  source: loc.source,
  ...(loc.paymentReference ? { paymentReference: loc.paymentReference } : {}),
  ...(loc.attemptReference ? { attemptReference: loc.attemptReference } : {}),
});

function uniqueDocs(docs: DocumentationLink[]): DocumentationLink[] {
  const seen = new Set<string>();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

function retryExplanation(
  retry: RetryGuidance,
  check: keyof typeof STATUS_CHECK,
  advice?: string,
): string {
  const parts = [RETRY_TEXT[retry]];
  if (retry === "retry_conditionally") parts.push(STATUS_CHECK[check]);
  if (advice) parts.push(`AstroPay advice: ${advice}`);
  return parts.join(" ");
}

type Verdict = {
  code: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  nextAction?: string;
  advice?: string;
  docs: DocumentationLink[];
  missing: string[];
  subCodes: Record<string, string>;
  message?: string;
  outcomeKnown?: boolean;
  check: keyof typeof STATUS_CHECK;
};

function draft(loc: Location, v: Verdict): DecodedErrorDraft {
  return {
    ...withRefs(loc),
    code: v.code,
    subCodes: v.subCodes,
    category: v.category,
    ...(v.message ? { providerMessage: v.message } : {}),
    explanation: v.explanation,
    nextAction: v.nextAction ?? NEXT_ACTION[v.category],
    retry: v.retry,
    retryExplanation: retryExplanation(v.retry, v.check, v.advice),
    confidence: v.confidence,
    documentation: uniqueDocs(v.docs),
    missingInformation: v.missing,
    ...(v.outcomeKnown ? { outcomeKnown: true } : {}),
  };
}

/** Fallback by HTTP class when no documented code matched. */
function httpFallback(
  http: number | undefined,
  docs: DocumentationLink,
): Pick<Verdict, "category" | "retry" | "confidence" | "docs"> & { text?: string } {
  const h = http !== undefined ? lookup(HTTP_STATUSES, http) : undefined;
  if (!h)
    return { category: "unknown", retry: "unknown", confidence: "insufficient", docs: [docs] };
  return {
    category: h.category,
    retry: h.retry,
    confidence: h.category === "unknown" ? "insufficient" : "possible",
    docs: [docs],
    text: `HTTP ${http}: ${h.meaning}.`,
  };
}

/** Confidence for a table row: strong only when the documented HTTP status agrees. */
function rowConfidence(entry: ErrorEntry, http: number | undefined): Confidence {
  if (entry.category === "unknown") return "possible";
  return http !== undefined && entry.httpStatus === http ? "strong" : "possible";
}

const CPF_TOKENS = Object.keys(CPF_DOCUMENT_STATUSES);

/** CPF status token in a reason description, matched as a whole upper-case word. */
function cpfStatusOf(text: string): string | undefined {
  const t = text.slice(0, 200);
  return CPF_TOKENS.find((k) => new RegExp(`(?:^|[^A-Z0-9_])${k}(?:$|[^A-Z0-9_])`).test(t));
}

export function decodeGatewayError(
  e: z.infer<typeof GatewayError>,
  http: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = codeOf(e.error);
  const errEntry = code ? lookup(GATEWAY_ERRORS, code) : undefined;
  const term = codeOf(e.internal_term);
  const termEntry = term ? lookup(GATEWAY_INTERNAL_TERMS, term) : undefined;
  const reasons = (e.reasons ?? []).slice(0, 20);
  const reasonCodes = fieldNames(reasons.map((r) => r.reason_code));
  const knownReasons = reasonCodes.filter((c) => lookup(GATEWAY_REASON_CODES, c));
  let cpf: string | undefined;
  for (const r of reasons) {
    if (r.reason_code === "document_format_invalid" && typeof r.description === "string") {
      cpf = cpfStatusOf(r.description);
      if (cpf) break;
    }
  }

  const parts: string[] = [];
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  if (http !== undefined) subCodes.http_status = String(http);
  if (term) subCodes.internal_term = term;
  if (reasonCodes.length) subCodes.reason_codes = reasonCodes.join(",");
  if (cpf) subCodes.document_status = cpf;

  if (errEntry) parts.push(`AstroPay error ${code}: ${errEntry.meaning}.`);
  else
    missing.push(
      `Error "${safeText(e.error, 64)}" is not in the PandaPayLens catalog for Direct Payment, Direct Withdrawal or QR Payments.`,
    );
  if (termEntry) parts.push(`internal_term ${term}: ${termEntry.meaning}.`);
  else if (term) missing.push(`internal_term "${term}" is not in the PandaPayLens catalog.`);
  for (const c of knownReasons)
    parts.push(`Reason ${c}: ${lookup(GATEWAY_REASON_CODES, c)!.meaning}.`);
  const fields = fieldNames(reasons.flatMap((r) => r.fields ?? []));
  if (fields.length) parts.push(`Fields named in reasons: ${fields.join(", ")}.`);
  if (cpf) parts.push(`CPF status ${cpf}: ${CPF_DOCUMENT_STATUSES[cpf]!.meaning}.`);
  else if (knownReasons.includes("document_format_invalid"))
    missing.push("The reason description names no documented CPF status.");

  let pairMismatch = false;
  if (errEntry && termEntry && termEntry.pairsWith !== code) {
    pairMismatch = true;
    missing.push(
      `internal_term ${term} is documented with error ${termEntry.pairsWith}, not ${code}; the two values disagree.`,
    );
  }

  // The most specific documented value decides the category and retry.
  const chosen: ErrorEntry | undefined =
    (cpf ? CPF_DOCUMENT_STATUSES[cpf] : undefined) ??
    (knownReasons.length === 1 ? lookup(GATEWAY_REASON_CODES, knownReasons[0]!) : undefined) ??
    termEntry ??
    errEntry;

  const docs: DocumentationLink[] = [];
  let verdict: Pick<Verdict, "category" | "retry" | "confidence">;
  if (chosen) {
    verdict = {
      category: chosen.category,
      retry: chosen.retry,
      confidence: pairMismatch ? "possible" : rowConfidence(chosen, http),
    };
    docs.push({ title: chosen.docsTitle, url: chosen.docsUrl });
    if (chosen.docsUrl === DIRECT_PAYMENT_ERRORS_URL)
      docs.push({
        title: "AstroPay Direct Withdrawal error codes (identical page)",
        url: DIRECT_WITHDRAWAL_ERRORS_URL,
      });
    if (http !== undefined && chosen.httpStatus !== undefined && chosen.httpStatus !== http)
      missing.push(
        `The documented HTTP status for this value is ${chosen.httpStatus}, but the record arrived with HTTP ${http}.`,
      );
    if (http === undefined && chosen.httpStatus !== undefined)
      missing.push("No HTTP status was supplied, so the documented status could not be checked.");
  } else {
    const fb = httpFallback(http, {
      title: "AstroPay Direct Payment error codes",
      url: DIRECT_PAYMENT_ERRORS_URL,
    });
    verdict = fb;
    docs.push(...fb.docs);
    if (fb.text) parts.push(fb.text);
    if (http === undefined)
      missing.push("No HTTP status was supplied, so no fallback category is available.");
  }

  const qr = chosen?.docsUrl !== undefined && chosen.docsUrl !== DIRECT_PAYMENT_ERRORS_URL;
  return draft(loc, {
    code: code ?? safeText(e.error, 64) ?? "unknown",
    ...verdict,
    explanation: parts.length
      ? parts.join(" ")
      : `PandaPayLens does not recognize the AstroPay error "${safeText(e.error, 64)}".`,
    ...(chosen?.nextAction ? { nextAction: chosen.nextAction } : {}),
    ...(chosen?.providerAdvice ? { advice: chosen.providerAdvice } : {}),
    docs,
    missing,
    subCodes,
    message: safeText(e.description ?? e.message ?? undefined, 200),
    check: qr ? "qr_payments" : "direct_payment_or_withdrawal",
  });
}

export function decodePartnerError(
  e: z.infer<typeof PartnerError>,
  http: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const code = codeOf(e.error);
  let variants = partnerVariants(code);
  const missing: string[] = [];
  const subCodes: Record<string, string> = {};
  if (http !== undefined) subCodes.http_status = String(http);
  if (http !== undefined && variants.length) {
    const same = variants.filter((v) => v.httpStatus === http);
    if (same.length) variants = same;
    else if (variants.some((v) => v.httpStatus !== undefined))
      missing.push(
        `The documented HTTP status for ${code} is ${[...new Set(variants.map((v) => v.httpStatus).filter((s) => s !== undefined))].join(" or ")}, but the record arrived with HTTP ${http}.`,
      );
  }
  const message = safeText(e.message ?? e.description ?? undefined, 200);

  if (!variants.length) {
    const fb = httpFallback(http, { title: "AstroPay Wallet on File errors", url: WOF_ERRORS_URL });
    missing.push(`Error "${safeText(e.error, 64)}" is not in the PandaPayLens catalog.`);
    return draft(loc, {
      code: code ?? safeText(e.error, 64) ?? "unknown",
      category: fb.category,
      retry: fb.retry,
      confidence: fb.confidence,
      explanation: fb.text
        ? `${fb.text} The error "${safeText(e.error, 64)}" is not a documented Checkout or Wallet on File value.`
        : `PandaPayLens does not recognize the AstroPay error "${safeText(e.error, 64)}".`,
      docs: fb.docs,
      missing,
      subCodes,
      ...(message ? { message } : {}),
      check: "partner",
    });
  }

  const operations = [...new Set(variants.map((v) => v.operation))];
  subCodes.operation = operations.join(" or ");
  const docs = variants.map((v) => ({ title: v.docsTitle, url: v.docsUrl }));
  if (variants.length === 1) {
    const v = variants[0]!;
    if (http === undefined && v.httpStatus !== undefined)
      missing.push("No HTTP status was supplied, so the documented status could not be checked.");
    return draft(loc, {
      code: code!,
      category: v.category,
      retry: v.retry,
      confidence: missing.length && http !== undefined ? "possible" : rowConfidence(v, http),
      explanation: `AstroPay ${v.operation} error ${code}: ${v.meaning}.`,
      ...(v.nextAction ? { nextAction: v.nextAction } : {}),
      ...(v.providerAdvice ? { advice: v.providerAdvice } : {}),
      docs,
      missing,
      subCodes,
      ...(message ? { message } : {}),
      check: v.operation.startsWith("Wallet on File") ? "wallet_on_file" : "partner",
    });
  }

  // The same code means different things per operation, and the body does
  // not say which operation failed.
  const categories = new Set(variants.map((v) => v.category));
  const retries = new Set(variants.map((v) => v.retry));
  const category = categories.size === 1 ? variants[0]!.category : "unknown";
  const retry = retries.size === 1 ? variants[0]!.retry : "manual_review";
  missing.push(
    `${code} is documented for several operations (${operations.join("; ")}); the record does not show which operation failed.`,
  );
  return draft(loc, {
    code: code!,
    category,
    retry,
    confidence: category === "unknown" ? "insufficient" : "possible",
    explanation: `AstroPay error ${code} has several documented meanings: ${variants
      .map((v) => `${v.operation}: ${v.meaning}`)
      .join("; ")}.`,
    docs,
    missing,
    subCodes,
    ...(message ? { message } : {}),
    check: "partner",
  });
}

export function decodeCashoutV1Error(
  e: z.infer<typeof CashoutV1Error>,
  http: number | undefined,
  loc: Location,
): DecodedErrorDraft {
  const text = cashoutText(e);
  const entry = matchCashoutError(text, http);
  const subCodes: Record<string, string> = {};
  if (http !== undefined) subCodes.http_status = String(http);
  const err = codeOf(e.error);
  if (err) subCodes.error = err;
  const missing = [
    "Cashouts V1 errors have no machine code; the row is matched on documented key words in the description text, which the research only has in paraphrased form.",
  ];
  if (http === undefined)
    missing.push("No HTTP status was supplied, so the documented status could not be checked.");
  const code = http !== undefined ? `HTTP ${http}` : "description only";
  const message = safeText(text, 200);
  if (entry) {
    if (entry.httpStatus === 404 || entry.httpStatus === 412)
      subCodes.documented_status_rows = String(
        CASHOUT_V1_ERRORS.filter((x) => x.httpStatus === entry.httpStatus).length,
      );
    return draft(loc, {
      code,
      category: entry.category,
      retry: entry.retry,
      confidence: "possible",
      explanation: `AstroPay Cashouts V1 error (HTTP ${entry.httpStatus}): ${entry.meaning}.`,
      ...(entry.nextAction ? { nextAction: entry.nextAction } : {}),
      docs: [{ title: entry.docsTitle, url: entry.docsUrl }],
      missing,
      subCodes,
      ...(message ? { message } : {}),
      check: "cashout_v1",
    });
  }
  const fb = httpFallback(http, {
    title: "AstroPay Cashouts V1 error codes",
    url: CASHOUT_V1_ERRORS_URL,
  });
  missing.push("The description matches no documented Cashouts V1 error.");
  return draft(loc, {
    code,
    category: fb.category,
    retry: fb.retry,
    confidence: fb.confidence,
    explanation: fb.text
      ? `${fb.text} The description matches no documented Cashouts V1 error.`
      : "The description matches no documented Cashouts V1 error.",
    docs: fb.docs,
    missing,
    subCodes,
    ...(message ? { message } : {}),
    check: "cashout_v1",
  });
}

/** Decodes the cancel reason of a CANCELLED Direct Withdrawal (final status). */
export function decodeCancelReason(
  d: z.infer<typeof DirectWithdrawal>,
  loc: Location,
): DecodedErrorDraft | undefined {
  if (d.status !== "CANCELLED") return undefined;
  const raw = d.description ?? undefined;
  const token = codeOf(raw, /^[A-Z0-9_]{1,64}$/);
  const entry = token ? lookup(WITHDRAWAL_CANCEL_REASONS, token) : undefined;
  const docs = [
    {
      title: "AstroPay Direct Withdrawal cancel reasons",
      url: DIRECT_WITHDRAWAL_CANCEL_REASONS_URL,
    },
  ];
  if (!entry) {
    return draft(loc, {
      code: token ?? "CANCELLED",
      category: "unknown",
      retry: "unknown",
      confidence: "insufficient",
      explanation: raw
        ? "The withdrawal was cancelled with a reason that is not a documented cancel reason."
        : "The withdrawal was cancelled without a cancel reason in description.",
      docs,
      missing: [
        raw
          ? `Cancel reason "${safeText(raw, 64)}" is not in the PandaPayLens catalog.`
          : "No description was supplied, so the reason is unknown.",
      ],
      subCodes: { status: "CANCELLED" },
      ...(raw ? { message: safeText(raw, 200) } : {}),
      outcomeKnown: true,
      check: "direct_withdrawal",
    });
  }
  const conditional = entry.retry === "retry_conditionally";
  return {
    ...draft(loc, {
      code: token!,
      category: entry.category,
      retry: entry.retry,
      // Exact token on a documented final status.
      confidence: "strong",
      explanation: `The withdrawal was cancelled (final): ${entry.meaning}.`,
      ...(entry.nextAction ? { nextAction: entry.nextAction } : {}),
      docs,
      missing: [],
      subCodes: { status: "CANCELLED" },
      outcomeKnown: true,
      check: "direct_withdrawal",
    }),
    ...(conditional
      ? {
          retryExplanation: `AstroPay advice: ${entry.providerAdvice ?? "a new attempt is allowed."} The cancelled withdrawal is final and is not repeated by a new request; before sending one, check that no other withdrawal for the same payout is still pending (GET /merchant/v2/cashout/external/{merchantCashoutId}/status).`,
        }
      : {}),
  };
}

function decodeErrors(parsed: AstropayParsed, ctx: NormalizeContext): DecodedErrorDraft[] {
  const source = { recordIndex: ctx.recordIndex, path: "" };
  const loc = { sourceFormat: ctx.format, source };
  const http = ctx.meta?.http?.status;
  switch (parsed.kind) {
    case "gateway_error":
      return [decodeGatewayError(parsed.value, http, loc)];
    case "partner_error":
      return [decodePartnerError(parsed.value, http, loc)];
    case "cashout_v1_error":
      return [decodeCashoutV1Error(parsed.value, http, loc)];
    case "direct_withdrawal": {
      const ref = idOf(parsed.value.cashout_external_id);
      const err = decodeCancelReason(parsed.value, {
        ...loc,
        ...(ref ? { paymentReference: ref, attemptReference: ref } : {}),
      });
      return err ? [err] : [];
    }
    default:
      return [];
  }
}

export const astropayAdapter: ProviderAdapter<AstropayParsed> = {
  id: PROVIDER,
  displayName: "AstroPay",
  version: ASTROPAY_ADAPTER_VERSION,
  manifest: astropayManifest,
  supportedFormats: [
    {
      id: "astropay.checkout.create_response",
      description: "Checkout create payment response (payment_external_id, status)",
    },
    {
      id: "astropay.checkout.callback",
      description: "Checkout callback (payment_external_id, payment_status, payment_info)",
    },
    {
      id: "astropay.checkout.payment",
      description: "Payment object with a Checkout-only status",
    },
    {
      id: "astropay.wof.payment",
      description: "Wallet on File payment object (authorize, capture, reversal, refund)",
    },
    {
      id: "astropay.payment_object",
      description: "Checkout or Wallet on File payment object whose family is not visible",
    },
    { id: "astropay.cashout_v1", description: "Cashouts V1 response or callback" },
    { id: "astropay.direct_payment", description: "Direct Payment response or callback" },
    { id: "astropay.direct_withdrawal", description: "Direct Withdrawal response or callback" },
    { id: "astropay.qr.callback", description: "QR Payments deposit callback" },
    {
      id: "astropay.merchant_gateway.error",
      description: "OneTouch / merchant-api error envelope (error, internal_term, reasons)",
    },
    {
      id: "astropay.partner.error",
      description: "Checkout and Wallet on File error body (error, message)",
    },
    {
      id: "astropay.cashout_v1.error",
      description: "Cashouts V1 error (description text and HTTP status only)",
    },
  ],
  detect,
  parse,
  normalize,
  decodeErrors,
  correlationKeys(event: NormalizedEvent): string[] {
    // AstroPay identifiers only, in a key space per family: the payment id
    // (payment_external_id = payment_id), deposit_external_id, cashout_id or
    // cashout_external_id, and payment_transaction_id. Merchant references are
    // never keys.
    const space = lookup(KEY_SPACE, event.sourceFormat);
    if (!space) return [];
    return [event.paymentReference, event.relatedReference]
      .filter((x): x is string => Boolean(x))
      .map((x) => `${space}:${x}`);
  },
};

export * from "./catalog.js";
export default astropayAdapter;
