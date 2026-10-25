/**
 * AstroPay status, code and error knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/astropay.md, which
 * cites AstroPay's public developer portal (verified 2026-10-25). The portal is
 * client-rendered; the research rebuilt its tables from the site's public
 * content bundles, so a cell can be misplaced. Confidence is kept modest for
 * that reason (see `strong` handling in index.ts).
 *
 * AstroPay runs several merchant product families with their own identifiers,
 * status vocabularies and signature schemes. Every table below belongs to one
 * family and is never used for another one.
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file; where AstroPay gives advice, it is kept
 * in `providerAdvice`.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://developers.astropay.com/docs";
const CHECKOUT = `${DOCS}/accept-astropay/checkout`;
const WOF = `${DOCS}/accept-astropay/wallet-on-file`;
const CASHOUT_V1 = `${DOCS}/accept-astropay/wallet-payouts/cashouts-v1`;
const DIRECT_PAYMENT = `${DOCS}/payment-processing/direct-payment`;
const DIRECT_WITHDRAWAL = `${DOCS}/payment-processing/direct-withdrawal`;
const QR = `${DOCS}/accept-astropay/qr-payments`;

export const CHECKOUT_GETTING_STARTED_URL = `${CHECKOUT}/getting-started`;
export const CHECKOUT_CREATE_URL = `${CHECKOUT}/payment-lifecycle/creating-payments`;
export const CHECKOUT_CALLBACK_URL = `${CHECKOUT}/payment-lifecycle/callback-and-status`;
export const CHECKOUT_STATUS_URL = `${CHECKOUT}/payment-lifecycle/checking-payment-status`;
export const CHECKOUT_REFUND_URL = `${CHECKOUT}/payment-lifecycle/refunding-payments`;
export const WOF_FUNDS_PULLING_URL = `${WOF}/funds-pulling`;
export const WOF_STATUS_URL = `${WOF}/check-transaction-status`;
export const WOF_REFUND_URL = `${WOF}/refund-transactions`;
export const WOF_ERRORS_URL = `${WOF}/errors`;
export const WOF_WEBHOOKS_URL = `${WOF}/webhooks`;
export const CASHOUT_V1_GETTING_STARTED_URL = `${CASHOUT_V1}/getting-started`;
export const CASHOUT_V1_REQUEST_URL = `${CASHOUT_V1}/request-parameters`;
export const CASHOUT_V1_CALLBACKS_URL = `${CASHOUT_V1}/callbacks`;
export const CASHOUT_V1_STATUS_URL = `${CASHOUT_V1}/check-cashout-status`;
export const CASHOUT_V1_ERRORS_URL = `${CASHOUT_V1}/error-codes`;
export const DIRECT_PAYMENT_GETTING_STARTED_URL = `${DIRECT_PAYMENT}/getting-started`;
export const DIRECT_PAYMENT_CALLBACKS_URL = `${DIRECT_PAYMENT}/callbacks`;
export const DIRECT_PAYMENT_ERRORS_URL = `${DIRECT_PAYMENT}/error-codes`;
export const DIRECT_PAYMENT_BRAZIL_URL = `${DIRECT_PAYMENT}/supported-countries/brazil`;
export const DIRECT_WITHDRAWAL_GETTING_STARTED_URL = `${DIRECT_WITHDRAWAL}/getting-started`;
export const DIRECT_WITHDRAWAL_CALLBACKS_URL = `${DIRECT_WITHDRAWAL}/callbacks`;
export const DIRECT_WITHDRAWAL_STATUS_URL = `${DIRECT_WITHDRAWAL}/status`;
export const DIRECT_WITHDRAWAL_CANCEL_REASONS_URL = `${DIRECT_WITHDRAWAL}/cancel-reasons`;
export const DIRECT_WITHDRAWAL_ERRORS_URL = `${DIRECT_WITHDRAWAL}/error-codes`;
export const QR_CALLBACKS_URL = `${QR}/callbacks`;
export const QR_SECURITY_URL = `${QR}/security-authentication`;
export const PLATFORM_INTRO_URL = `${DOCS}/platform/introduction`;
export const PLATFORM_ERRORS_URL = `${DOCS}/platform/errors-codes`;
export const PLATFORM_WEBHOOKS_URL = `${DOCS}/platform/callbacks/webhooks`;

/**
 * Merchant product families. Checkout and Wallet on File share one payment
 * object shape; when a record does not show which of the two it is, the
 * family is `checkout_or_wallet_on_file`.
 */
export type Family =
  | "checkout"
  | "wallet_on_file"
  | "checkout_or_wallet_on_file"
  | "cashout_v1"
  | "direct_payment"
  | "direct_withdrawal"
  | "qr_payments";

export const FAMILY_LABELS: Record<Family, string> = {
  checkout: "Checkout",
  wallet_on_file: "Wallet on File",
  checkout_or_wallet_on_file: "Checkout or Wallet on File (shared payment object)",
  cashout_v1: "Wallet Payouts / Cashouts V1",
  direct_payment: "Direct Payment",
  direct_withdrawal: "Direct Withdrawal",
  qr_payments: "QR Payments",
};

export type StatusInfo = {
  outcome: Outcome;
  stage: LifecycleStage;
  meaning: string;
  /** AstroPay documents the status as final. */
  final?: true;
  /** The status is documented as able to change later (Brazil CANCELLED). */
  mayChange?: true;
  /** Seen only in an example, not in the documented status list. */
  exampleOnly?: true;
};

/** Checkout `status` / `payment_status`. Only finals trigger callbacks. */
export const CHECKOUT_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "payment",
    meaning: "Created and waiting for the user; no callback is sent for this status",
  },
  COMPLETED: { outcome: "success", stage: "payment", meaning: "Payment completed", final: true },
  EXPIRED: {
    outcome: "failure",
    stage: "payment",
    meaning: "The payment failed, expired or was cancelled",
    final: true,
  },
  REJECTED: { outcome: "failure", stage: "payment", meaning: "Payment rejected", final: true },
  PARTIALLY_REFUNDED: {
    outcome: "success",
    stage: "refund",
    meaning: "Part of the payment was refunded",
  },
  REFUNDED: { outcome: "success", stage: "refund", meaning: "The payment was fully refunded" },
};

/** Wallet on File payment `status`. Transitions to COMPLETED, PENDING and REJECTED are not documented. */
export const WOF_STATUSES: Record<string, StatusInfo> = {
  PENDING: { outcome: "pending", stage: "payment", meaning: "Pending" },
  REJECTED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Rejected (the rejected operation is not stated)",
  },
  COMPLETED: { outcome: "success", stage: "payment", meaning: "Completed" },
  AUTHORIZED: {
    outcome: "success",
    stage: "authorization",
    meaning: "Funds authorized on the linked wallet, not captured",
  },
  CAPTURED: {
    outcome: "success",
    stage: "capture",
    meaning: "Authorization captured in full (also the result of auth-capture)",
  },
  PARTIALLY_CAPTURED: {
    outcome: "success",
    stage: "capture",
    meaning: "Part of the authorization captured",
  },
  REVERSED: {
    outcome: "success",
    stage: "reversal",
    meaning: "Authorization reversed in full (released without capture)",
  },
  PARTIALLY_REVERSED: {
    outcome: "success",
    stage: "reversal",
    meaning: "Part of the authorization reversed",
  },
  REFUNDED: { outcome: "success", stage: "refund", meaning: "Fully refunded" },
  PARTIALLY_REFUNDED: { outcome: "success", stage: "refund", meaning: "Partially refunded" },
};

/**
 * Statuses that Checkout and Wallet on File both document with the same
 * stage and outcome. Only these are interpreted when a payment object does
 * not show its family.
 */
export const SHARED_PAYMENT_STATUSES: Record<string, StatusInfo> = Object.fromEntries(
  Object.entries(CHECKOUT_STATUSES)
    .filter(([k, c]) => {
      const w = Object.prototype.hasOwnProperty.call(WOF_STATUSES, k) ? WOF_STATUSES[k] : undefined;
      return w !== undefined && w.stage === c.stage && w.outcome === c.outcome;
    })
    .map(([k, c]) => [
      k,
      {
        outcome: c.outcome,
        stage: c.stage,
        meaning: `${WOF_STATUSES[k]!.meaning} (same meaning for Checkout and Wallet on File)`,
      },
    ]),
);

/** Payment statuses that only one of the two families documents. */
export const CHECKOUT_ONLY_STATUSES = new Set(
  Object.keys(CHECKOUT_STATUSES).filter((k) => !(k in WOF_STATUSES)),
);
export const WOF_ONLY_STATUSES = new Set(
  Object.keys(WOF_STATUSES).filter((k) => !(k in CHECKOUT_STATUSES)),
);

/** `payment_transactions[].type` of the shared payment object. */
export const PAYMENT_TRANSACTION_TYPES: Record<string, LifecycleStage> = {
  AUTHORIZATION: "authorization",
  CAPTURE: "capture",
  REVERSAL: "reversal",
  REFUND: "refund",
};

/** `payment_transactions[].result`: OK/FAILED on the refund page, APPROVED on status pages. */
export const PAYMENT_TRANSACTION_RESULTS: Record<string, Outcome> = {
  OK: "success",
  APPROVED: "success",
  FAILED: "failure",
};

/** Cashouts V1 (merchant to AstroPay wallet). Not reversible. */
export const CASHOUT_V1_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "payout",
    meaning: "No AstroPay user matches the cashout yet; it waits up to 24 hours",
  },
  APPROVED: {
    outcome: "success",
    stage: "payout",
    meaning: "Credited to the user's AstroPay wallet (cashouts are not reversible)",
    final: true,
  },
  CANCELLED: {
    outcome: "failure",
    stage: "payout",
    meaning: "The user did not register within 24 hours",
    final: true,
  },
};

/** Direct Payment (local method such as PIX). The full enum is not documented. */
export const DIRECT_PAYMENT_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "payment",
    meaning: "Created; payment data (for example a PIX QR) returned",
  },
  APPROVED: { outcome: "success", stage: "payment", meaning: "Approved" },
  CANCELLED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Cancelled. In Brazil this is not final and can change to APPROVED after 30 minutes",
    mayChange: true,
  },
};

/** Direct Withdrawal (merchant to bank account). */
export const DIRECT_WITHDRAWAL_STATUSES: Record<string, StatusInfo> = {
  CREATED: {
    outcome: "pending",
    stage: "payout",
    meaning: "Created (seen only in the create response example, not in the status list)",
    exampleOnly: true,
  },
  PENDING: { outcome: "pending", stage: "payout", meaning: "Pending" },
  APPROVED: {
    outcome: "success",
    stage: "payout",
    meaning: "Approved (not reversible)",
    final: true,
  },
  CANCELLED: {
    outcome: "failure",
    stage: "payout",
    meaning: "Cancelled; the reason is in description",
    final: true,
  },
};

/** QR Payments deposit callback `status`. */
export const QR_STATUSES: Record<string, StatusInfo> = {
  PENDING: { outcome: "pending", stage: "payment", meaning: "Pending" },
  APPROVED: { outcome: "success", stage: "payment", meaning: "Approved" },
  CANCELLED: { outcome: "failure", stage: "payment", meaning: "Cancelled" },
};

/** QR payment code `qr_status` values (payment code, not a payment). */
export const QR_CODE_STATUSES = new Set(["ACTIVE", "INACTIVE", "DEACTIVATED"]);

export const STATUS_TABLES: Record<Family, Record<string, StatusInfo>> = {
  checkout: CHECKOUT_STATUSES,
  wallet_on_file: WOF_STATUSES,
  checkout_or_wallet_on_file: SHARED_PAYMENT_STATUSES,
  cashout_v1: CASHOUT_V1_STATUSES,
  direct_payment: DIRECT_PAYMENT_STATUSES,
  direct_withdrawal: DIRECT_WITHDRAWAL_STATUSES,
  qr_payments: QR_STATUSES,
};

export type ErrorEntry = {
  meaning: string;
  /** HTTP status the documentation lists for this row, when it lists one. */
  httpStatus?: number;
  category: ErrorCategory;
  retry: RetryGuidance;
  docsTitle: string;
  docsUrl: string;
  /** Advice that AstroPay itself gives for this value. */
  providerAdvice?: string;
  /** Overrides the category's generic next action. */
  nextAction?: string;
};

const MERCHANT_BALANCE_ACTION =
  "Check and top up the merchant balance with AstroPay before a new attempt.";

const refund = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<ErrorEntry> = {},
): ErrorEntry => ({
  meaning,
  httpStatus: 412,
  category,
  retry,
  docsTitle: "AstroPay refunds (Checkout and Wallet on File refund errors)",
  docsUrl: CHECKOUT_REFUND_URL,
  ...extra,
});

/** Checkout refund and Wallet on File refund errors (`error`, HTTP 412; identical tables). */
export const REFUND_ERRORS: Record<string, ErrorEntry> = {
  PAYMENT_NOT_FOUND: refund("No such payment", "invalid_request", "do_not_retry"),
  INVALID_AUTHORIZATION_STATUS: refund(
    "The authorization is not closed, so the payment cannot be refunded yet",
    "invalid_request",
    "retry_conditionally",
  ),
  REFUND_AMOUNT_EXCEEDED: refund(
    "The refund is above the captured amount",
    "invalid_amount",
    "do_not_retry",
  ),
  USER_NOT_FOUND: refund("The wallet user is missing", "invalid_request", "manual_review"),
  PAYMENT_GENERIC_ERROR: refund(
    "The merchant balance could not be debited for the refund",
    "insufficient_funds",
    "manual_review",
    { nextAction: MERCHANT_BALANCE_ACTION },
  ),
  PAYMENT_PROCESSING_ERROR: refund(
    "Wallet refund processing failed",
    "provider_unavailable",
    "retry_conditionally",
  ),
};

const wof = (
  meaning: string,
  httpStatus: number | undefined,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<ErrorEntry> = {},
): ErrorEntry => ({
  meaning,
  ...(httpStatus !== undefined ? { httpStatus } : {}),
  category,
  retry,
  docsTitle: "AstroPay Wallet on File errors",
  docsUrl: WOF_ERRORS_URL,
  ...extra,
});

/** Wallet on File auth-capture errors (`error`). */
export const WOF_AUTH_CAPTURE_ERRORS: Record<string, ErrorEntry> = {
  PARTNER_CONFIGURATION_ERROR: wof(
    "Payments are disabled for the merchant",
    412,
    "configuration",
    "do_not_retry",
  ),
  DUPLICATE_PAYMENT: wof("The payment already exists", 412, "duplicate_request", "do_not_retry"),
  USER_NOT_FOUND: wof("The user is missing", 412, "invalid_request", "do_not_retry"),
  PAYMENT_PROCESSING_ERROR: wof(
    "Wallet payment processing failed",
    412,
    "provider_unavailable",
    "retry_conditionally",
  ),
  PAYMENT_GENERIC_ERROR: wof("Generic payment error", 400, "unknown", "unknown"),
  INSUFFICIENT_BALANCE: wof(
    "The wallet balance is too low",
    412,
    "insufficient_funds",
    "customer_action_required",
  ),
  ACCOUNT_TOKEN_NOT_FOUND: wof(
    "The account token is unknown for this partner",
    400,
    "authentication_failed",
    "customer_action_required",
  ),
};

/** Lowercase `error` values in Wallet on File inline examples (with `message`, no HTTP status). */
export const WOF_EXAMPLE_ERRORS: Record<string, ErrorEntry> = {
  bad_request: wof("Bad request (inline example)", undefined, "invalid_request", "do_not_retry"),
  not_found: wof("Not found (inline example)", undefined, "invalid_request", "do_not_retry"),
  insufficient_balance: wof(
    "Insufficient wallet balance (inline example)",
    undefined,
    "insufficient_funds",
    "customer_action_required",
  ),
};

/** Wallet on File account linking errors (10 keys; some keys have several documented messages). */
export const WOF_ACCOUNT_LINKING_ERRORS: Record<string, ErrorEntry> = {
  ACCOUNT_TOKEN_NOT_FOUND: wof(
    "The account token is unknown",
    400,
    "authentication_failed",
    "customer_action_required",
  ),
  PARTNER_LINK_ACCOUNT_ERROR: wof(
    "No active link, the partner is not allowed to link, or the user is not authorized (three documented messages; the category can be configuration or authentication)",
    400,
    "configuration",
    "manual_review",
  ),
  BAD_REQUEST: wof(
    "The user is not linked with the partner",
    400,
    "authentication_required",
    "customer_action_required",
    { nextAction: "Ask the user to link their AstroPay account again." },
  ),
  PARTNER_SCOPE_ERROR: wof(
    "The scope is not allowed for the partner",
    400,
    "configuration",
    "do_not_retry",
  ),
  REDIRECT_URL_ERROR: wof(
    "The redirect URL format is wrong",
    400,
    "invalid_request",
    "do_not_retry",
  ),
  USER_NOT_HAVE_WALLET: wof(
    "The user has no active wallet",
    412,
    "payment_method_unavailable",
    "customer_action_required",
  ),
  TRUSTED_DEVICE_CHALLENGE_ERROR: wof(
    "The request does not come from the user's trusted device",
    412,
    "authentication_failed",
    "customer_action_required",
  ),
  AUTHORIZATION_NOT_FOUND: wof(
    "The authorization request is unknown",
    400,
    "invalid_request",
    "do_not_retry",
  ),
  CONFIRM_INVALID_USER: wof(
    "The session user differs from the user in the request",
    400,
    "authentication_failed",
    "customer_action_required",
  ),
  INVALID_AUTHORIZATION_CODE: wof(
    "The authorization code is invalid, expired, belongs to another partner, or has no user",
    400,
    "authentication_failed",
    "customer_action_required",
  ),
};

/** Partner API (Checkout and Wallet on File) tables, by documented operation. */
export const PARTNER_ERROR_TABLES: readonly {
  operation: string;
  table: Record<string, ErrorEntry>;
}[] = [
  { operation: "refund (Checkout or Wallet on File)", table: REFUND_ERRORS },
  { operation: "Wallet on File auth-capture", table: WOF_AUTH_CAPTURE_ERRORS },
  { operation: "Wallet on File inline example", table: WOF_EXAMPLE_ERRORS },
  { operation: "Wallet on File account linking", table: WOF_ACCOUNT_LINKING_ERRORS },
];

/** Partner codes too generic to identify AstroPay on their own. */
export const GENERIC_PARTNER_CODES = new Set([
  "BAD_REQUEST",
  "bad_request",
  "not_found",
  "USER_NOT_FOUND",
  "PAYMENT_NOT_FOUND",
  "INSUFFICIENT_BALANCE",
  "insufficient_balance",
  "DUPLICATE_PAYMENT",
]);

const gateway = (
  meaning: string,
  httpStatus: number | undefined,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<ErrorEntry> = {},
): ErrorEntry => ({
  meaning,
  ...(httpStatus !== undefined ? { httpStatus } : {}),
  category,
  retry,
  docsTitle: "AstroPay Direct Payment and Direct Withdrawal error codes",
  docsUrl: DIRECT_PAYMENT_ERRORS_URL,
  ...extra,
});

const QR_DOCS = {
  docsTitle: "AstroPay QR Payments security and authentication",
  docsUrl: QR_SECURITY_URL,
};

const TIMEOUT_ADVICE = "the error page says to try again.";

/**
 * `error` values of the OneTouch / merchant-api envelope
 * `{ error, description, internal_term, reasons, detail }`. The Direct Payment
 * and Direct Withdrawal error pages are identical; the last two rows come from
 * the QR Payments authentication page.
 */
export const GATEWAY_ERRORS: Record<string, ErrorEntry> = {
  commons_invalid_request: gateway(
    "Field values are invalid; see detail",
    400,
    "invalid_request",
    "do_not_retry",
  ),
  merchant_gateway_payment_creation_timeout: gateway(
    "Creating the payment took too long",
    408,
    "network_or_timeout",
    "retry_conditionally",
    { providerAdvice: TIMEOUT_ADVICE },
  ),
  merchant_gateway_generic_error: gateway(
    "The payment mode is disabled for the merchant (the QR pages also use this error for an invalid request signature)",
    412,
    "configuration",
    "manual_review",
  ),
  commons_internal_error: gateway(
    "Internal error",
    500,
    "provider_unavailable",
    "retry_conditionally",
  ),
  merchant_gateway_fields_validation_error: gateway(
    "User data validation failed; see reasons",
    412,
    "invalid_request",
    "customer_action_required",
  ),
  merchant_gateway_user_limit_exceeded: gateway(
    "The user's transaction limits are reached",
    412,
    "invalid_amount",
    "do_not_retry",
  ),
  commons_unauthorized: gateway(
    "The Merchants-Backend-Api-Key is not accepted",
    undefined,
    "authentication_failed",
    "do_not_retry",
    { ...QR_DOCS, nextAction: "Check the merchant API key configured for this environment." },
  ),
  internal_error: gateway(
    "Internal error (generic example)",
    undefined,
    "provider_unavailable",
    "retry_conditionally",
    QR_DOCS,
  ),
};

/** `internal_term` values of the same envelope. */
export const GATEWAY_INTERNAL_TERMS: Record<string, ErrorEntry & { pairsWith: string }> = {
  invalid_request: {
    ...gateway("Invalid request", 400, "invalid_request", "do_not_retry"),
    pairsWith: "commons_invalid_request",
  },
  PAYMENT_CREATION_TIMEOUT: {
    ...gateway("Payment creation timeout", 408, "network_or_timeout", "retry_conditionally", {
      providerAdvice: TIMEOUT_ADVICE,
    }),
    pairsWith: "merchant_gateway_payment_creation_timeout",
  },
  INVALID_CONFIGURATION: {
    ...gateway(
      "The payment mode is disabled for the merchant",
      412,
      "configuration",
      "manual_review",
    ),
    pairsWith: "merchant_gateway_generic_error",
  },
  FIELDS_VALIDATION_ERROR: {
    ...gateway("User data validation failed", 412, "invalid_request", "customer_action_required"),
    pairsWith: "merchant_gateway_fields_validation_error",
  },
  USER_LIMITS_EXCEEDED: {
    ...gateway("User transaction limits exceeded", 412, "invalid_amount", "do_not_retry"),
    pairsWith: "merchant_gateway_user_limit_exceeded",
  },
  unauthorized: {
    ...gateway(
      "The Merchants-Backend-Api-Key is not accepted",
      undefined,
      "authentication_failed",
      "do_not_retry",
      { ...QR_DOCS, nextAction: "Check the merchant API key configured for this environment." },
    ),
    pairsWith: "commons_unauthorized",
  },
  INVALID_SIGNATURE: {
    ...gateway("The HMAC request signature is wrong", undefined, "configuration", "do_not_retry", {
      ...QR_DOCS,
      nextAction:
        "Check how the request Signature header is computed (HMAC SHA256 with the merchant secret).",
    }),
    pairsWith: "merchant_gateway_generic_error",
  },
};

/** `reasons[].reason_code` values. */
export const GATEWAY_REASON_CODES: Record<string, ErrorEntry> = {
  document_format_invalid: gateway(
    "The CPF has a problem; its status is in the reason description",
    412,
    "invalid_request",
    "customer_action_required",
  ),
  required_fields: gateway(
    "Required fields are missing (listed in fields)",
    412,
    "invalid_request",
    "do_not_retry",
  ),
};

/**
 * CPF statuses carried in `reasons[].description` with `document_format_invalid`.
 * `CPF_UNDER_SACTION` is AstroPay's spelling.
 */
export const CPF_DOCUMENT_STATUSES: Record<string, ErrorEntry> = {
  NOT_FOUND: gateway(
    "The CPF is unknown to Receita Federal",
    412,
    "invalid_request",
    "customer_action_required",
  ),
  INVALID: gateway(
    "The CPF is invalid at Receita Federal",
    412,
    "invalid_request",
    "customer_action_required",
  ),
  SUSPENDED: gateway("The CPF is suspended", 412, "fraud_or_risk", "do_not_retry", {
    providerAdvice: "do not retry.",
  }),
  UNDER_AGE: gateway("The payer is under the legal age", 412, "fraud_or_risk", "do_not_retry", {
    providerAdvice: "do not retry.",
  }),
  DEAD: gateway("The CPF holder is legally deceased", 412, "fraud_or_risk", "do_not_retry", {
    providerAdvice: "do not retry.",
  }),
  CPF_UNDER_SACTION: gateway("The CPF is sanctioned", 412, "fraud_or_risk", "manual_review", {
    providerAdvice: "escalate to compliance.",
    nextAction: "Escalate to your compliance team before any new attempt.",
  }),
};

const cancel = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<ErrorEntry> = {},
): ErrorEntry => ({
  meaning,
  category,
  retry,
  docsTitle: "AstroPay Direct Withdrawal cancel reasons",
  docsUrl: DIRECT_WITHDRAWAL_CANCEL_REASONS_URL,
  ...extra,
});

const UNEXPECTED = "Unexpected error at the payout rail";
const ALLOW_RETRY = "a new attempt is allowed.";

/** Direct Withdrawal cancel reasons (`description` on a CANCELLED withdrawal). */
export const WITHDRAWAL_CANCEL_REASONS: Record<string, ErrorEntry> = {
  GENERIC_ERROR: cancel(UNEXPECTED, "provider_unavailable", "retry_conditionally", {
    providerAdvice: ALLOW_RETRY,
  }),
  TRX_COULD_NOT_BE_PROCESSED: cancel(UNEXPECTED, "provider_unavailable", "retry_conditionally", {
    providerAdvice: ALLOW_RETRY,
  }),
  NOT_AUTHORIZED: cancel(UNEXPECTED, "provider_unavailable", "retry_conditionally", {
    providerAdvice: ALLOW_RETRY,
  }),
  CPF_MISMATCH: cancel(
    "The CPF of the PIX key owner differs from the beneficiary",
    "invalid_request",
    "customer_action_required",
  ),
  INVALID_PIX_KEY: cancel(
    "The PIX key is invalid or missing",
    "invalid_request",
    "customer_action_required",
  ),
  ACCOUNT_BLOCKED: cancel(
    "The beneficiary account is blocked",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  INVALID_BANK_ACCOUNT: cancel(
    "The bank details are invalid or the account cannot receive funds",
    "invalid_request",
    "customer_action_required",
  ),
  INVALID_ALIAS: cancel(
    "The account and the receiver do not match (Argentina)",
    "invalid_request",
    "customer_action_required",
  ),
};

export type CashoutErrorEntry = ErrorEntry & {
  httpStatus: number;
  /**
   * Matches the documented description. AstroPay gives no machine code for
   * Cashout V1 errors and the research paraphrases the texts, so the pattern
   * looks for the documented key words only.
   */
  pattern: RegExp;
};

const cashout = (
  httpStatus: number,
  pattern: RegExp,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<ErrorEntry> = {},
): CashoutErrorEntry => ({
  httpStatus,
  pattern,
  meaning,
  category,
  retry,
  docsTitle: "AstroPay Cashouts V1 error codes",
  docsUrl: CASHOUT_V1_ERRORS_URL,
  ...extra,
});

const CREDENTIALS_ACTION = "Check the merchant API key and secret configured for cashouts.";

/**
 * The 13 Cashouts V1 error rows, ordered from the most specific pattern to
 * the most generic one. Matching also requires the documented HTTP status
 * when the status is known.
 */
export const CASHOUT_V1_ERRORS: readonly CashoutErrorEntry[] = [
  cashout(
    412,
    /merchant_user_id\b.*\bblocked\b|\bblocked\b.*\bmerchant_user_id/i,
    "The merchant_user_id is blocked",
    "fraud_or_risk",
    "manual_review",
  ),
  cashout(
    412,
    /\binvalid\b.*\bphone\b|\bphone\b.*\b(?:invalid|not valid)\b/i,
    "The phone number is invalid",
    "invalid_request",
    "customer_action_required",
  ),
  cashout(
    412,
    /\b(?:missing|required)\b.*\bphone\b|\bphone\b.*\b(?:missing|required|empty)\b/i,
    "The phone number is missing",
    "invalid_request",
    "do_not_retry",
  ),
  cashout(
    412,
    /\baccounting currency\b/i,
    "The accounting currency is not configured",
    "configuration",
    "manual_review",
  ),
  cashout(
    412,
    /\binvalid\b.*\bsignature\b|\bsignature\b.*\b(?:invalid|not valid|mismatch)\b/i,
    "The request signature is invalid",
    "configuration",
    "do_not_retry",
    { nextAction: CREDENTIALS_ACTION },
  ),
  cashout(
    412,
    /\bcashouts?\b.*\b(?:disabled|not enabled)\b|\b(?:disabled|not enabled)\b.*\bcashouts?\b/i,
    "Cashouts are disabled for the merchant",
    "configuration",
    "manual_review",
  ),
  cashout(
    412,
    /\balready exists?\b/i,
    "A cashout with the same merchant id already exists",
    "duplicate_request",
    "do_not_retry",
  ),
  cashout(
    412,
    /\binvalid\b.*\buser[_ ]?id\b|\buser[_ ]?id\b.*\binvalid\b/i,
    "The AstroPay user_id is invalid",
    "invalid_request",
    "do_not_retry",
  ),
  cashout(
    412,
    /\b(?:in+s+uf+icient|not enough)\b.*\bbalance\b|\bbalance\b.*\b(?:too low|insufficient|not enough)\b/i,
    "The merchant balance is too low",
    "insufficient_funds",
    "retry_conditionally",
    { nextAction: MERCHANT_BALANCE_ACTION },
  ),
  cashout(
    404,
    /\bcashout\b.*\bnot found\b|\bnot found\b.*\bcashout\b/i,
    "Cashout not found",
    "invalid_request",
    "do_not_retry",
  ),
  cashout(
    404,
    /\bconfiguration\b.*\b(?:missing|not found)\b|\b(?:missing|not found)\b.*\bconfiguration\b/i,
    "The merchant configuration is missing",
    "configuration",
    "manual_review",
  ),
  cashout(
    401,
    /\bnot authori[sz]ed\b|\bunauthori[sz]ed\b/i,
    "The merchant is not authorized (API key)",
    "authentication_failed",
    "do_not_retry",
    { nextAction: CREDENTIALS_ACTION },
  ),
  cashout(
    400,
    /\binvalid\b.*\bbody\b|\bbody\b.*\binvalid\b|\binvalid request\b/i,
    "The request body is invalid",
    "invalid_request",
    "do_not_retry",
  ),
];

export type HttpStatusEntry = { meaning: string; category: ErrorCategory; retry: RetryGuidance };

/**
 * HTTP statuses the merchant APIs use for error classes (400, 401, 404, 408,
 * 412, 500). Used only as a fallback for unknown codes.
 */
export const HTTP_STATUSES: Record<number, HttpStatusEntry> = {
  400: { meaning: "Invalid request", category: "invalid_request", retry: "do_not_retry" },
  401: {
    meaning: "Merchant credentials not accepted",
    category: "authentication_failed",
    retry: "do_not_retry",
  },
  404: { meaning: "Resource not found", category: "invalid_request", retry: "do_not_retry" },
  408: {
    meaning: "The operation took too long",
    category: "network_or_timeout",
    retry: "retry_conditionally",
  },
  412: {
    meaning: "Business rule error (the usual AstroPay error class); the code says which one",
    category: "unknown",
    retry: "manual_review",
  },
  500: {
    meaning: "Internal error",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

/**
 * Platform (Partners API, BaaS) error codes. Out of first scope: they are
 * listed for recognition only and are never decoded.
 */
export const PLATFORM_ERROR_CODES: Record<string, string> = {
  INVALID_USER_DATA: "general",
  USER_NOT_FOUND: "general",
  INVALID_CURRENCY: "general",
  USER_ACCOUNT_NOT_FOUND: "general",
  INVALID_TRANSFER_TYPE: "general",
  INVALID_REQUEST: "general",
  INVALID_WITHDRAWAL_TYPE: "general",
  CARD_NOT_FOUND: "general",
  PARTNER_NOT_FOUND: "general",
  USER_CLAIMED: "general",
  USER_ALREADY_EXISTS: "general",
  USER_CLAIMED_ACCOUNT: "general",
  QUOTE_TOKEN_EXPIRED: "general",
  user_validation_failed: "payouts",
  invalid_account_status: "payouts",
  transaction_max_limit_exceeded: "payouts",
  user_not_found: "payouts",
  insufficient_balance: "payouts",
  partner_configuration_error: "payouts",
  already_created: "payouts",
  bad_request: "payouts",
  payout_creation_error: "payouts",
  cashout_not_found: "payouts",
  partner_balance_error: "payouts",
  unauthorized: "payouts",
  business_account_not_found: "payouts",
  business_account_access_denied: "payouts",
  payout_target_currency_wallet_not_available: "payouts",
  payout_not_found: "payout refunds",
  payout_refund_not_found: "payout refunds",
  internal_error: "two-phase transfers",
  transfer_already_exists: "two-phase transfers",
  cci_hold_timeout: "two-phase transfers",
  cci_origin_account_not_found: "two-phase transfers",
  cci_restriction_applied: "two-phase transfers",
  transfer_failed: "two-phase transfers",
  request_timeout: "two-phase transfers",
  balance_error: "two-phase transfers",
  ACCOUNT_NOT_FOUND: "savings and users",
  INVALID_ACCOUNT_STATUS: "savings and users",
  DISABLE_USER_ERROR: "savings and users",
  security_error: "savings and users",
  user_secret_already_exists: "savings and users",
};

/** Platform codes too generic to recognize a Platform record on their own. */
export const GENERIC_PLATFORM_CODES = new Set([
  "INVALID_REQUEST",
  "INVALID_CURRENCY",
  "INVALID_USER_DATA",
  "CARD_NOT_FOUND",
  "USER_NOT_FOUND",
  "USER_ALREADY_EXISTS",
  "ACCOUNT_NOT_FOUND",
  "user_not_found",
  "insufficient_balance",
  "already_created",
  "bad_request",
  "unauthorized",
  "internal_error",
  "request_timeout",
  "transfer_failed",
  "balance_error",
  "security_error",
  "cashout_not_found",
  "partner_configuration_error",
]);

/** Platform webhook event names, sent in the URL path (`{baseWebhookUrl}/{eventName}`). */
export const PLATFORM_EVENTS = new Set([
  "USER_CREATION",
  "ONBOARDING_FINISHED",
  "ONBOARDING_STEP_FINISHED",
  "USER_COUNTRY_OF_RESIDENCE_SET",
  "IDENTITY_VALIDATION_REJECTED",
  "WALLET_BALANCE_UPDATED",
  "TOP_UP",
  "WITHDRAWAL",
  "PROMO_REWARD_UPDATED",
  "TRANSFER_COMPLETED",
  "USER_RESTRICTION",
  "DEBIT_CARD_TRANSACTION",
]);

/** How to check the current state before any new attempt, per family. */
export const STATUS_CHECK: Record<Family | "direct_payment_or_withdrawal" | "partner", string> = {
  checkout: "Check the payment first with GET /v1/payments/{paymentId}?method=CHECKOUT.",
  wallet_on_file: "Check the payment first with GET /v1/wof/payments/{payment_id}.",
  checkout_or_wallet_on_file:
    "Check the payment first (Checkout: GET /v1/payments/{paymentId}?method=CHECKOUT; Wallet on File: GET /v1/wof/payments/{payment_id}).",
  partner:
    "Check the payment first (Checkout: GET /v1/payments/{paymentId}?method=CHECKOUT; Wallet on File: GET /v1/wof/payments/{payment_id}).",
  cashout_v1:
    "Check the cashout first with GET merchant/v2/cashout/external/{merchant_cashout_id}/status; resending with the same merchant_cashout_id is rejected as a duplicate.",
  direct_payment:
    "The reviewed Direct Payment pages document no status endpoint; wait for the callback before creating a new payment.",
  direct_withdrawal:
    "Check the withdrawal first with GET /merchant/v2/cashout/external/{merchantCashoutId}/status.",
  direct_payment_or_withdrawal:
    "Check whether the operation was created first (Direct Withdrawal: GET /merchant/v2/cashout/external/{merchantCashoutId}/status; Direct Payment documents no status endpoint, so wait for its callback).",
  qr_payments: "Check the payment code status before creating a new one.",
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the user to act first (for example top up the wallet, correct their data or bank details, link the account again or use another method).",
  retry_conditionally:
    "A later attempt may succeed, but first verify whether the original operation took effect, so that a new request does not create a second payment or cashout.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry.",
  manual_review:
    "Review the case manually (merchant configuration, balance or compliance) before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the user to use another payment method.",
  authentication_required: "Ask the user to authenticate or link their AstroPay account again.",
  authentication_failed:
    "Ask the user to authenticate again (trusted device, account link or authorization code).",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, the currency and the user's limits.",
  insufficient_funds:
    "Ask the user to top up their wallet or use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another payment or payout method.",
  fraud_or_risk: "Review the case and the risk or compliance outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Check the current state of the operation before sending a new request, and check the AstroPay status page.",
  network_or_timeout: "Check the current state of the operation before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the merchant configuration and credentials, or contact AstroPay support with the identifiers of the operation.",
  unknown:
    "Contact AstroPay support with the identifiers of the operation if the cause is unclear.",
};
