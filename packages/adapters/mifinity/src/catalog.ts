/**
 * MiFinity code, status and product knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/mifinity.md, which
 * cites MiFinity's public developer hub (verified 2026-10-25):
 *
 * Error envelope, FATAL / VALIDATION_* codes: https://mifinity.readme.io/docs/error-codes
 * PayAnyBank error codes:                     https://mifinity.readme.io/docs/pab-error-codes
 * Deposit status values:                      https://mifinity.readme.io/docs/payment-status-api-1
 * Deposit callbacks:                          https://mifinity.readme.io/docs/payment-status-callback
 * Payout statuses (1-3, 5-8):                 https://mifinity.readme.io/docs/transaction-status
 * Payout status 4 (older page):               https://mifinity.readme.io/docs/transaction-status-1
 * Payout callbacks:                           https://mifinity.readme.io/docs/notification-callbacks
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions derived from the documented meaning; MiFinity gives no per-code
 * retry advice except the duplicate traceId rule and the status lookup rules.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://mifinity.readme.io";
export const ERROR_CODES_URL = `${DOCS}/docs/error-codes`;
export const PAB_ERROR_CODES_URL = `${DOCS}/docs/pab-error-codes`;
export const DEPOSIT_API_URL = `${DOCS}/reference/deposit-api`;
export const PAYMENT_STATUS_URL = `${DOCS}/docs/payment-status-api-1`;
export const DEPOSIT_CALLBACK_URL = `${DOCS}/docs/payment-status-callback`;
export const IFRAME_INIT_URL = `${DOCS}/docs/iframe-initialization-1`;
export const TRANSACTION_STATUS_URL = `${DOCS}/docs/transaction-status`;
export const TRANSACTION_STATUS_OLD_URL = `${DOCS}/docs/transaction-status-1`;
export const TRANSACTION_LIFECYCLE_URL = `${DOCS}/docs/transaction-lifecycle`;
export const PAYOUT_CALLBACKS_URL = `${DOCS}/docs/notification-callbacks`;
export const WITHDRAWAL_CALLBACKS_URL = `${DOCS}/docs/notification-callbacks-for-withdrawals`;
export const NOTIFICATION_MANAGEMENT_URL = `${DOCS}/docs/notification-management`;
export const PAB_FLOW_URL = `${DOCS}/docs/pab-flow`;
export const CARD_PAYOUT_API_URL = `${DOCS}/docs/the-api`;
export const A2A_URL = `${DOCS}/reference/account-to-account-transfer`;
export const PAYC_API_URL = `${DOCS}/docs/payanycoin-api`;
export const PAYC_MCP_URL = `${DOCS}/docs/mcp`;
export const HTTP_STATUS_URL = `${DOCS}/docs/http-response-status-codes`;
export const SIGNATURE_URL = `${DOCS}/docs/merchant-signature-verification`;

export type ErrorType = "FATAL" | "VALIDATION_FIELD" | "VALIDATION_GLOBAL";

/** The three documented values of `errors[].type`. */
export const ERROR_TYPES: Record<ErrorType, string> = {
  FATAL: "the request could not be processed",
  VALIDATION_FIELD: "a single request field failed validation",
  VALIDATION_GLOBAL: "the request as a whole failed a validation or velocity check",
};

export type ErrorMapping = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

export type ErrorCodeEntry = ErrorMapping & {
  /** `errors[].type` values the code is documented with. */
  types: readonly ErrorType[];
  /** Per-type meaning where the same code is documented under several types. */
  byType?: Partial<Record<ErrorType, ErrorMapping>>;
  /** At most "strong" for documented meanings; "possible" for catch-alls and example-only codes. */
  confidence: "strong" | "possible";
  /** Extra retry context from MiFinity's documentation. */
  retryNote?: string;
  /** Status lookup variant (HTTP 404 on a Transaction Status call). */
  lookup?: ErrorMapping & { retryNote: string };
  docs: readonly string[];
  note?: string;
};

const BOTH = [ERROR_CODES_URL, PAB_ERROR_CODES_URL] as const;

/**
 * The 25 documented `errors[].errorCode` values: 21 from the Error Codes page,
 * 3 more from the PAB Error Codes page and `00001` from an OpenAPI example.
 */
export const ERROR_CODES: Record<string, ErrorCodeEntry> = {
  BAD_ACCOUNT_NUMBER: {
    meaning: "The account number is invalid",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: BOTH,
  },
  CARD_EXPIRED: {
    meaning: "The card expiry date is invalid (card payout, PAC/PMC)",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "customer_action_required",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  EXPIRY_DATE_FUTURE: {
    meaning: "The card expiry date is too far in the future (card payout, PAC/PMC)",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "customer_action_required",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  OPERATION_NOT_POSSIBLE: {
    meaning:
      "The operation is not possible: for a PayAnyCard payout the amount currency must match the source account, or a generic reason is given in the message",
    types: ["FATAL", "VALIDATION_GLOBAL"],
    category: "invalid_request",
    retry: "do_not_retry",
    byType: {
      FATAL: {
        meaning:
          "The operation is not possible: for a PayAnyCard payout the amount currency must match the source account, or a generic reason is given in the message",
        category: "invalid_request",
        retry: "do_not_retry",
      },
      VALIDATION_GLOBAL: {
        meaning: "A velocity check rejected a zero amount",
        category: "invalid_amount",
        retry: "do_not_retry",
      },
    },
    confidence: "strong",
    docs: BOTH,
    note: "The same code is documented under FATAL and VALIDATION_GLOBAL with different meanings; the type decides which applies.",
  },
  TRANSACTION_FAILED: {
    meaning:
      "Catch-all failure. MiFinity documents it for card details not found, a processor error passed through, invalid data for queue processing and an invalid validationKey",
    types: ["FATAL"],
    category: "unknown",
    retry: "manual_review",
    confidence: "possible",
    docs: [ERROR_CODES_URL, PAYMENT_STATUS_URL],
    note: "TRANSACTION_FAILED covers several unrelated causes and can carry processor text; the message is the only clue to the actual cause.",
  },
  ELEMENT_NOT_FOUND: {
    meaning:
      "An element or id was not found (for example an empty card holder nationality or card name)",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "do_not_retry",
    lookup: {
      meaning: "The transaction was not found by the status lookup",
      category: "invalid_request",
      retry: "retry_conditionally",
      retryNote:
        "On a status lookup this can mean the reference does not exist yet; MiFinity treats HTTP 404 as a valid not-found answer. Look up again later before assuming the transaction was never created.",
    },
    confidence: "strong",
    docs: [ERROR_CODES_URL, TRANSACTION_STATUS_URL],
  },
  UNSUPPORTED_CURRENCY: {
    meaning: "The currency is not supported",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  ACCOUNT_DISABLED: {
    meaning: "The account is disabled",
    types: ["FATAL"],
    category: "configuration",
    retry: "manual_review",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  INSUFFICIENT_FUNDS: {
    meaning: "Not enough balance in the eWallet or merchant e-wallet",
    types: ["FATAL"],
    category: "insufficient_funds",
    retry: "retry_conditionally",
    retryNote: "A new attempt can only succeed after the e-wallet balance has been topped up.",
    confidence: "strong",
    docs: BOTH,
  },
  ACCESS_DENIED: {
    meaning: "Access denied or invalid authorization",
    types: ["FATAL"],
    category: "authentication_failed",
    retry: "do_not_retry",
    confidence: "strong",
    docs: BOTH,
  },
  BLACKLISTED: {
    meaning:
      "Blocked: BIN blacklisted, card scheme not permitted, card not processable, or blocked",
    types: ["FATAL"],
    category: "fraud_or_risk",
    retry: "do_not_retry",
    confidence: "strong",
    docs: BOTH,
  },
  INVALID_DATA_FORMAT: {
    meaning: "The card number is invalid",
    types: ["FATAL"],
    category: "invalid_request",
    retry: "customer_action_required",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  VALIDATION: {
    meaning: "Generic validation error; the field entry names the problem",
    types: ["FATAL", "VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: BOTH,
  },
  DUPLICATED_TRANSACTION_ID: {
    meaning: "The traceId was already submitted",
    types: ["FATAL"],
    category: "duplicate_request",
    retry: "do_not_retry",
    retryNote:
      "MiFinity says this means the first request with this traceId was received. Check its status by traceId instead of sending a new request.",
    confidence: "strong",
    docs: [PAB_ERROR_CODES_URL, PAB_FLOW_URL],
  },
  TRANSACTION_AMOUNT_LIMIT_ERROR: {
    meaning: "The amount is outside the permitted limits",
    types: ["FATAL"],
    category: "invalid_amount",
    retry: "do_not_retry",
    confidence: "strong",
    docs: [PAB_ERROR_CODES_URL],
  },
  OTHER: {
    meaning: "Other error (no further meaning documented)",
    types: ["FATAL"],
    category: "unknown",
    retry: "manual_review",
    confidence: "possible",
    docs: [PAB_ERROR_CODES_URL],
  },
  "01001": {
    meaning: "Invalid card number",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "customer_action_required",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  "01002": {
    meaning: "The expiry date is not valid",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "customer_action_required",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  "01003": {
    meaning: "The description length must be between 1 and 25 characters",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  "01004": {
    meaning: "Invalid currency",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  "01005": {
    meaning: "Unsupported currency",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "strong",
    docs: [ERROR_CODES_URL],
  },
  "00001": {
    meaning: "A field size constraint failed (the example shows traceId longer than 48 characters)",
    types: ["VALIDATION_FIELD"],
    category: "invalid_request",
    retry: "do_not_retry",
    confidence: "possible",
    docs: [DEPOSIT_API_URL],
    note: "This code appears only in an OpenAPI example, not in an error code table.",
  },
  DAILY_VELOCITY_EXCEEDED: {
    meaning: "The daily velocity limit was exceeded",
    types: ["VALIDATION_GLOBAL"],
    category: "fraud_or_risk",
    retry: "retry_conditionally",
    retryNote: "A new attempt can only succeed after the daily velocity period has passed.",
    confidence: "strong",
    docs: BOTH,
  },
  WEEKLY_VELOCITY_EXCEEDED: {
    meaning: "The weekly velocity limit was exceeded",
    types: ["VALIDATION_GLOBAL"],
    category: "fraud_or_risk",
    retry: "retry_conditionally",
    retryNote: "A new attempt can only succeed after the weekly velocity period has passed.",
    confidence: "strong",
    docs: BOTH,
  },
  MONTHLY_VELOCITY_EXCEEDED: {
    meaning: "The monthly velocity limit was exceeded",
    types: ["VALIDATION_GLOBAL"],
    category: "fraud_or_risk",
    retry: "retry_conditionally",
    retryNote: "A new attempt can only succeed after the monthly velocity period has passed.",
    confidence: "strong",
    docs: BOTH,
  },
};

/**
 * Documented causes of TRANSACTION_FAILED, matched against the message to
 * give a hint. A hint never changes the category: the code stays a catch-all.
 */
export const TRANSACTION_FAILED_HINTS: readonly { pattern: RegExp; cause: string }[] = [
  { pattern: /validation\s*key/i, cause: "an invalid validationKey" },
  { pattern: /card details/i, cause: "card details not found" },
  { pattern: /queue/i, cause: "invalid data for queue processing" },
];

export type TransactionStatusEntry = {
  label: string;
  meaning: string;
  outcome: Outcome;
  final: boolean | "unclear";
  /** Where the status is documented. */
  docs: readonly string[];
  /** A second, contradicting meaning documented elsewhere. */
  conflict?: { label: string; meaning: string; outcome: Outcome; docs: string };
  note?: string;
};

/**
 * The 8 numeric `transactionStatus` values of payouts (callbacks and
 * Transaction Status lookups). "Reversed" has no numeric id and is kept apart.
 */
export const TRANSACTION_STATUSES: Record<string, TransactionStatusEntry> = {
  "1": {
    label: "Received",
    meaning: "Submitted by the client to MiFinity",
    outcome: "pending",
    final: false,
    docs: [TRANSACTION_STATUS_URL],
  },
  "2": {
    label: "Internal Error",
    meaning: "MiFinity failed to initiate the transaction",
    outcome: "failure",
    final: true,
    docs: [TRANSACTION_STATUS_URL],
  },
  "3": {
    label: "Submitted",
    meaning:
      "Accepted and sent for processing; the funds are debited. MiFinity says the merchant should treat it as success, but Processed by acquirer, Rejected or Internal Error can still follow",
    outcome: "pending",
    final: false,
    docs: [TRANSACTION_STATUS_URL, TRANSACTION_LIFECYCLE_URL],
    note: "success-equivalent for payouts per MiFinity, not final",
  },
  "4": {
    label: "Processed by PSP",
    meaning: "Processed successfully (documented only on the older transaction status page)",
    outcome: "success",
    final: "unclear",
    docs: [TRANSACTION_STATUS_OLD_URL],
  },
  "5": {
    label: "Processed by acquirer",
    meaning: "The acquirer confirmed the payout; final success",
    outcome: "success",
    final: true,
    docs: [TRANSACTION_STATUS_URL, PAYOUT_CALLBACKS_URL],
    conflict: {
      label: "Failed",
      meaning: "The withdrawal callbacks page documents status 5 as Failed",
      outcome: "failure",
      docs: WITHDRAWAL_CALLBACKS_URL,
    },
  },
  "6": {
    label: "Rejected",
    meaning: "Rejected by MiFinity",
    outcome: "failure",
    final: true,
    docs: [TRANSACTION_STATUS_URL, PAYOUT_CALLBACKS_URL],
  },
  "7": {
    label: "In Progress",
    meaning: "Under review (KYC or compliance)",
    outcome: "pending",
    final: false,
    docs: [TRANSACTION_STATUS_URL],
  },
  "8": {
    label: "On Hold KYC",
    meaning: "Additional KYC checks are required",
    outcome: "pending",
    final: false,
    docs: [TRANSACTION_STATUS_URL],
  },
};

/** "Reversed": documented as a label only, with no numeric transactionStatus. */
export const REVERSED_STATUS = {
  label: "Reversed",
  meaning:
    "The destination bank or wallet returned the funds and they were credited back to the merchant",
  outcome: "success" as Outcome,
  stage: "reversal" as LifecycleStage,
  docs: [TRANSACTION_STATUS_OLD_URL, TRANSACTION_LIFECYCLE_URL],
};

export type DepositStatusEntry = { meaning: string; outcome: Outcome; final: boolean };

/** The 4 deposit `status` values of the Payment Status API. */
export const DEPOSIT_STATUSES: Record<string, DepositStatusEntry> = {
  SUCCESSFUL: { meaning: "The deposit completed", outcome: "success", final: true },
  PENDING: {
    meaning: "Submitted to the processor; the result is not yet determined",
    outcome: "pending",
    final: false,
  },
  NOT_COMPLETED: {
    meaning: "The deposit needs further input from the user",
    outcome: "pending",
    final: false,
  },
  FAILED: { meaning: "The deposit failed", outcome: "failure", final: true },
};

/** The 3 documented `detailedStatus` values on unsuccessful deposits. */
export const DETAILED_STATUSES: Record<string, ErrorMapping> = {
  ABANDONED_BY_USER: {
    meaning: "The user abandoned the deposit",
    category: "unknown",
    retry: "customer_action_required",
  },
  REFUSED_BY_RISK: {
    meaning: "MiFinity's risk checks refused the deposit",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
  FAILED: {
    meaning: "The deposit failed (no further detail)",
    category: "unknown",
    retry: "unknown",
  },
};

/**
 * Payout products named in `eventTypeDescription`. Keys are normalized
 * (lowercase, no spaces) because the enum text ("PayAnyBank") and the
 * examples ("Pay Any Bank") differ.
 */
export const PAYOUT_PRODUCTS: Record<string, { product: string; rail: string }> = {
  payanybank: { product: "PayAnyBank (PAB)", rail: "bank" },
  payanycard: { product: "PayAnyCard (PAC)", rail: "card" },
  accounttoaccounttransfer: { product: "Account to Account (A2A)", rail: "wallet" },
  payanycoin: { product: "PayAnyCoin (PAYC)", rail: "crypto" },
};

/** The only PayAnyCoin statusCode / statusMessage pair MiFinity documents. */
export const PAYC_STATUSES: Record<string, { meaning: string; outcome: Outcome }> = {
  PENDING: { meaning: "The crypto payout is pending (statusCode 7)", outcome: "pending" },
};

/** MiFinity-specific HTTP status rules; the generic list of 56 codes adds no meaning. */
export const HTTP_RULES: Record<string, ErrorMapping & { docs: string }> = {
  "401": {
    meaning:
      "Unauthorized. MiFinity documents 401 on Account to Account transfers when TOTP is enabled on the account",
    category: "authentication_required",
    retry: "do_not_retry",
    docs: A2A_URL,
  },
  "403": {
    meaning: "Forbidden (MiFinity's example pairs it with ACCESS_DENIED)",
    category: "authentication_failed",
    retry: "do_not_retry",
    docs: CARD_PAYOUT_API_URL,
  },
  "404": {
    meaning:
      "Not found. On a status lookup MiFinity treats 404 as a valid answer: the transaction was not found",
    category: "invalid_request",
    retry: "retry_conditionally",
    docs: TRANSACTION_STATUS_URL,
  },
  "5xx": {
    meaning:
      "Server error. MiFinity says to retry status lookups on 5xx, and to retry a payout request only with the same traceId",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    docs: TRANSACTION_STATUS_URL,
  },
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (correct their details or use another method).",
  retry_conditionally:
    "A later attempt may succeed, but first verify the current state: a Transaction Status lookup by traceId or transactionReference for payouts, or the Payment Status API for deposits. For payouts MiFinity says to resend only with the same traceId, so that a request that already took effect is not paid twice.",
  safe_to_retry_technical_request:
    "The request can be repeated as a technical retry; MiFinity says to retry status lookups on 5xx.",
  manual_review: "Review the transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the customer to use another card or payment method.",
  authentication_required:
    "Check the account's authentication settings (for example TOTP on Account to Account transfers) before sending the request again.",
  authentication_failed: "Check the API key, IP allowlist and account permissions.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, currency and the account's transaction limits.",
  insufficient_funds:
    "Top up the e-wallet that funds the operation, or ask the customer to use another method.",
  payment_method_unavailable: "Offer another payment or payout method.",
  fraud_or_risk: "Review the transaction and the risk or velocity outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Look up the transaction by traceId before sending a new request, and reuse the same traceId if you resend a payout.",
  network_or_timeout:
    "Look up the transaction by traceId before sending a new request, and reuse the same traceId if you resend a payout.",
  duplicate_request:
    "Check the status of the first request by traceId instead of sending it again.",
  configuration: "Check the merchant account configuration with MiFinity support.",
  unknown:
    "Contact MiFinity support with the traceId or transactionReference if the cause is unclear.",
};
