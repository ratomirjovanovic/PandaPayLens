/**
 * Skrill code and status knowledge, kept as data.
 *
 * Every code and status below comes from
 * docs/providers/high-risk/research/skrill.md, which cites the Skrill digital
 * wallet guides on the Paysafe developer portal (linked in the URL constants).
 * Category and retry values are PandaPayLens interpretations of the
 * documented meanings, not Skrill statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.paysafe.com/docs/digital-wallets";

export const QC_URL = `${DOCS}/quick-checkout`;
export const QC_INTRODUCTION_URL = `${QC_URL}/introduction`;
export const QC_ERROR_CODES_URL = `${QC_URL}/error-codes`;
export const QC_ACCOUNT_OPTIONS_URL = `${QC_URL}/account-and-integration-options`;
export const QC_RECURRING_URL = `${QC_URL}/skrill-recurring-billing`;
export const QC_ONE_TAP_URL = `${QC_URL}/one-tap`;
export const QC_MD5_URL = `${QC_URL}/md5`;
export const QC_SHA256_URL = `${QC_URL}/sha-256`;
export const QC_PAYMENT_METHOD_CODES_URL = `${QC_URL}/payment-method-codes`;
export const API_URL = `${DOCS}/api-mqi`;
export const API_ABOUT_URL = `${API_URL}/about`;
export const API_ERROR_MESSAGES_URL = `${API_URL}/error-messages`;
export const API_SEND_MONEY_URL = `${API_URL}/send-money`;
export const API_REFUNDS_URL = `${API_URL}/refunds`;
export const API_QCO_PAYOUTS_URL = `${API_URL}/quick-checkout-payouts`;
export const API_MQI_URL = `${API_URL}/mqi`;
export const API_BALANCE_EXCHANGE_URL = `${API_URL}/balance-exchange`;
export const WC_URL = `${DOCS}/wallet-checkout`;
export const WC_INTRODUCTION_URL = `${WC_URL}/introduction`;
export const WC_FAILED_REASON_CODES_URL = `${WC_URL}/failed-reason-codes`;
export const UBP_URL = `${DOCS}/unlinked-merchant-bank-payouts`;
export const UBP_PREPARATION_URL = `${UBP_URL}/preparation-response`;
export const UBP_EXECUTION_URL = `${UBP_URL}/execution-response`;
export const UBP_STATUS_URL = `${UBP_URL}/payout-status-notification`;
export const IGAMING_URL = "https://www.paysafe.com/en/industries-we-serve/igaming/";
export const PAYSAFE_CHECKOUT_SKRILL_URL =
  "https://developer.paysafe.com/en/api-docs/paysafe-checkout/payment-methods/wallets/skrill/";

/** Which documented code table an entry comes from. */
export type CodeFamily =
  | "failed_reason"
  | "status_text"
  | "api"
  | "mqi_http"
  | "bank_api"
  | "ubp_preparation"
  | "ubp_execution";

export const FAMILY_DOCS: Record<CodeFamily, { title: string; url: string }[]> = {
  failed_reason: [
    { title: "Skrill Quick Checkout failed reason codes", url: QC_ERROR_CODES_URL },
    { title: "Skrill Wallet Checkout failed reason codes", url: WC_FAILED_REASON_CODES_URL },
  ],
  status_text: [{ title: "Skrill Quick Checkout status_url", url: QC_INTRODUCTION_URL }],
  api: [{ title: "Skrill API error messages", url: API_ERROR_MESSAGES_URL }],
  mqi_http: [{ title: "Skrill Merchant Query Interface", url: API_MQI_URL }],
  bank_api: [{ title: "Skrill Quick Checkout Bank API", url: QC_INTRODUCTION_URL }],
  ubp_preparation: [{ title: "Skrill bank payout preparation response", url: UBP_PREPARATION_URL }],
  ubp_execution: [{ title: "Skrill bank payout execution response", url: UBP_EXECUTION_URL }],
};

export type CatalogEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method in the Skrill checkout, or to contact their card issuer.",
  authentication_required: "Ask the customer to complete authentication in a new payment attempt.",
  authentication_failed:
    "Ask the customer to complete authentication again or to use another payment method.",
  invalid_request: "Correct the fields named by the code before sending a new request.",
  invalid_amount: "Check the amount, currency and the applicable limits.",
  insufficient_funds:
    "Ask the customer to add funds or use another payment method. For merchant-side operations, check the Skrill account balance.",
  payment_method_unavailable: "Offer the customer another payment method.",
  fraud_or_risk:
    "Do not retry. Review the transaction and contact Skrill Merchant Services if you need details.",
  rate_limiting: "Wait before trying again and avoid automated repeated attempts.",
  provider_unavailable:
    "Check the transaction status (MQI status_trn or a later status_url post) before asking the customer to try again.",
  network_or_timeout:
    "Check the transaction status (MQI status_trn or a later status_url post) before starting a new attempt.",
  duplicate_request: "Check whether the earlier request with the same reference already succeeded.",
  configuration:
    "Check the Skrill merchant account settings (enabled features, API/MQI password, IP whitelist, secret word) with Skrill Merchant Services.",
  unknown:
    "Check the transaction in the Skrill merchant account or contact Skrill Merchant Services.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Repeating the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another payment method, or contacting their bank or card issuer).",
  retry_conditionally:
    "The condition may be temporary. A new attempt is a new payment or request: check the current status first and avoid immediate automatic repeats.",
  safe_to_retry_technical_request:
    "The request was rejected before anything was executed; it can be prepared and sent again.",
  manual_review:
    "The code does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this code.",
};

function entry(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation?: string,
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: explanation ?? `${meaning}.`,
    nextAction: NEXT_ACTION[category],
    retryExplanation: RETRY_EXPLANATION[retry],
  };
}

// ---------------------------------------------------------------------------
// Status values

export type StatusInfo = {
  /** Short name used in event types, e.g. `processed`. */
  name: string;
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
};

/**
 * The 5 documented `status` values of the Quick Checkout / Wallet Checkout
 * status_url post. Wallet semantics: `2` means the funds reached the
 * merchant's Skrill account; it is not a card authorization.
 */
export const PAYMENT_STATUSES: Readonly<Record<string, StatusInfo>> = {
  "2": {
    name: "processed",
    meaning: "Processed: the funds were received in the merchant's Skrill account",
    stage: "payment",
    outcome: "success",
  },
  "0": {
    name: "pending",
    meaning:
      "Pending, for example an offline bank transfer that has not arrived yet; Skrill says not to fulfil the order yet",
    stage: "payment",
    outcome: "pending",
  },
  "-1": {
    name: "cancelled",
    meaning: "Cancelled by the customer, or automatically after 14 days pending",
    stage: "cancellation",
    outcome: "failure",
  },
  "-2": {
    name: "failed",
    meaning: "Failed: declined by the provider or by Skrill fraud rules",
    stage: "payment",
    outcome: "failure",
  },
  "-3": {
    name: "chargeback",
    meaning:
      "Chargeback: Skrill debits the merchant account with a separate transaction and notifies the merchant by email",
    stage: "dispute",
    outcome: "unknown",
  },
};

/** Status values documented only for the Unlinked Merchant Bank Payout status post. */
export const BANK_PAYOUT_ONLY_STATUSES: Readonly<Record<string, StatusInfo>> = {
  "1": {
    name: "scheduled",
    meaning: "Bank payout scheduled",
    stage: "payout",
    outcome: "pending",
  },
  "-4": {
    name: "returned",
    meaning: "Bank payout returned by the recipient's bank",
    stage: "payout",
    outcome: "failure",
  },
};

/** Refund status report (`refund_status_url`). */
export const REFUND_STATUSES: Readonly<Record<string, StatusInfo>> = {
  "2": { name: "processed", meaning: "Refund processed", stage: "refund", outcome: "success" },
  "-2": { name: "failed", meaning: "Refund failed", stage: "refund", outcome: "failure" },
};

/** Recurring billing post (`rec_status_url`). A recurring charge is a payment. */
export const RECURRING_STATUSES: Readonly<Record<string, StatusInfo>> = {
  "2": {
    name: "processed",
    meaning: "Recurring payment processed",
    stage: "payment",
    outcome: "success",
  },
  "-2": {
    name: "failed",
    meaning: "Recurring payment failed",
    stage: "payment",
    outcome: "failure",
  },
};

/** `payment_type` values the status_url field table documents for payments. */
export const PAYMENT_TYPES_DOCUMENTED = ["WLT", "MDB"] as const;

// ---------------------------------------------------------------------------
// failed_reason_code (Quick Checkout table, plus one Wallet Checkout code)

export type FailedReasonEntry = CatalogEntry & {
  /** Set when the research marks the code as present in only one table. */
  only?: "quick_checkout" | "wallet_checkout";
  /** Wallet Checkout wording, when it differs from the Quick Checkout table. */
  walletCheckoutMeaning?: string;
  /** The two tables give meanings that lead to different categories. */
  conflict?: boolean;
};

type ReasonRow = [
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra?: Pick<FailedReasonEntry, "only" | "walletCheckoutMeaning" | "conflict">,
];

const QC_ONLY = { only: "quick_checkout" } as const;

const REASON_ROWS: readonly ReasonRow[] = [
  ["01", "Referral to the card issuer", "card_declined", "customer_action_required"],
  ["02", "Merchant invalid or inactive", "configuration", "manual_review"],
  ["03", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["04", "Declined by the issuer", "card_declined", "customer_action_required"],
  ["05", "Not enough funds", "insufficient_funds", "customer_action_required"],
  [
    "06",
    "Declined by the merchant or processor",
    "card_declined",
    "retry_conditionally",
    { walletCheckoutMeaning: "Transaction failed" },
  ],
  ["07", "Wrong PIN", "authentication_failed", "customer_action_required"],
  ["08", "PIN attempts exceeded, card blocked", "authentication_failed", "do_not_retry"],
  ["09", "Invalid transaction", "invalid_request", "do_not_retry"],
  ["10", "Frequency limit reached", "rate_limiting", "retry_conditionally"],
  [
    "11",
    "Amount invalid, too high or too low, or over a limit",
    "invalid_amount",
    "customer_action_required",
  ],
  ["12", "Invalid card or bank account", "invalid_request", "customer_action_required"],
  ["13", "Invalid issuer", "card_declined", "customer_action_required"],
  ["15", "Duplicate reference", "duplicate_request", "do_not_retry"],
  [
    "19",
    "Credentials invalid or expired, or not authorized",
    "unknown",
    "manual_review",
    { walletCheckoutMeaning: "Retry transaction", conflict: true },
  ],
  ["20", "Neteller member in a blocked region", "payment_method_unavailable", "do_not_retry"],
  ["22", "Unsupported Accept or content type", "invalid_request", "do_not_retry"],
  ["24", "Card expired", "card_declined", "customer_action_required"],
  ["27", "Function not supported or not available", "configuration", "do_not_retry"],
  ["28", "Lost or stolen card", "fraud_or_risk", "do_not_retry"],
  ["30", "Format failure", "invalid_request", "do_not_retry"],
  ["31", "Provider limit exceeded", "payment_method_unavailable", "customer_action_required"],
  ["32", "CVV/CVC check failed", "card_declined", "customer_action_required"],
  ["34", "Illegal transaction", "fraud_or_risk", "do_not_retry"],
  ["35", "Not entitled, account closed or unauthorized", "configuration", "manual_review", QC_ONLY],
  ["37", "Card restricted by the issuer", "card_declined", "customer_action_required"],
  ["38", "Security violation", "fraud_or_risk", "do_not_retry"],
  ["42", "Card blocked by the issuer", "card_declined", "do_not_retry"],
  ["44", "Issuer or network unavailable", "provider_unavailable", "retry_conditionally"],
  ["45", "Card type not processed", "payment_method_unavailable", "customer_action_required"],
  ["51", "System error", "provider_unavailable", "retry_conditionally"],
  ["58", "Not permitted by the acquirer", "payment_method_unavailable", "do_not_retry"],
  ["63", "Not permitted for the cardholder", "card_declined", "customer_action_required"],
  ["64", "Invalid data or entity not found", "invalid_request", "do_not_retry", QC_ONLY],
  ["67", "BitPay session expired", "network_or_timeout", "customer_action_required"],
  ["68", "Referenced transaction not settled", "invalid_request", "retry_conditionally", QC_ONLY],
  [
    "69",
    "Referenced transaction not fully authenticated",
    "authentication_required",
    "do_not_retry",
    QC_ONLY,
  ],
  ["70", "Customer failed 3-D Secure", "authentication_failed", "customer_action_required"],
  ["80", "Declined by fraud rules", "fraud_or_risk", "do_not_retry"],
  ["81", "Matching criteria not met", "fraud_or_risk", "manual_review"],
  ["98", "Provider communication error", "network_or_timeout", "retry_conditionally"],
  ["99", "Other reason", "unknown", "unknown"],
  ["102", "Six-digit code invalid", "authentication_failed", "customer_action_required"],
  [
    "103",
    "Six-digit code expired",
    "authentication_failed",
    "customer_action_required",
    { only: "wallet_checkout" },
  ],
  ["104", "PaysafeCard name match failed", "fraud_or_risk", "manual_review", QC_ONLY],
  ["105", "Token invalid", "invalid_request", "customer_action_required", QC_ONLY],
  ["110", "Cancelled by the customer", "unknown", "customer_action_required"],
  ["115", "Abandoned by the customer", "unknown", "customer_action_required"],
  ["120", "Funds not settled", "insufficient_funds", "retry_conditionally", QC_ONLY],
  [
    "130",
    "Not permitted by the bank",
    "payment_method_unavailable",
    "customer_action_required",
    QC_ONLY,
  ],
  ["135", "Transaction expired", "network_or_timeout", "customer_action_required", QC_ONLY],
];

const ONLY_TEXT = {
  quick_checkout: "The code is listed only in the Quick Checkout table.",
  wallet_checkout: "The code is listed only in the Wallet Checkout table.",
} as const;

function reasonEntry(row: ReasonRow): FailedReasonEntry {
  const [, meaning, category, retry, extra = {}] = row;
  let explanation = `${meaning}.`;
  if (extra.walletCheckoutMeaning) {
    explanation = `The two Skrill reason-code tables word this code differently. Quick Checkout table: ${meaning}. Wallet Checkout table: ${extra.walletCheckoutMeaning}.`;
    if (extra.conflict)
      explanation +=
        " The meanings point to different causes, and the post does not say which table applies.";
  }
  if (extra.only) explanation += ` ${ONLY_TEXT[extra.only]}`;
  const base = entry(meaning, category, retry, explanation);
  if (extra.conflict) {
    base.nextAction =
      "Check which checkout (Quick Checkout or Wallet Checkout) produced the payment, then review the account credentials or the transaction with Skrill Merchant Services.";
    base.retryExplanation =
      "The Wallet Checkout table says to retry, while the Quick Checkout table describes invalid credentials, where a retry does not help. Review before any new attempt.";
  }
  return { ...base, ...extra };
}

/**
 * `failed_reason_code` values (50 in the Quick Checkout table plus code 103
 * from the Wallet Checkout table). Keys are canonical: two-digit padded below
 * 100, as in the Quick Checkout table.
 */
export const FAILED_REASON_CODES: Readonly<Record<string, FailedReasonEntry>> = Object.fromEntries(
  REASON_ROWS.map((row) => [row[0], reasonEntry(row)]),
);

/**
 * Code 54 is cited in the Quick Checkout description of status -2 but is not
 * in either reason-code table. It is kept apart and decoded with lower
 * confidence.
 */
export const STATUS_TEXT_REASONS: Readonly<Record<string, CatalogEntry>> = {
  "54": entry(
    "Internal security restrictions",
    "fraud_or_risk",
    "manual_review",
    "Internal security restrictions. Skrill cites this code in the description of status -2, but it is not in either failed reason code table.",
  ),
};

// ---------------------------------------------------------------------------
// API / MQI error strings (`<error_msg>`): 58 distinct values, 3 of them
// wildcard patterns whose suffix names the parameter.

type Row = [code: string, meaning: string, category: ErrorCategory, retry: RetryGuidance];

function table(rows: readonly Row[]): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [code, meaning, category, retry] of rows) out[code] = entry(meaning, category, retry);
  return out;
}

export const API_ERRORS: Readonly<Record<string, CatalogEntry>> = table([
  [
    "INVALID_OR_MISSING_ACTION",
    "Invalid or missing action parameter",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_*",
    "Invalid parameter (the suffix names the parameter)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_*",
    "Missing parameter (the suffix names the parameter)",
    "invalid_request",
    "do_not_retry",
  ],
  ["NOT_SUPPORTED_CURRENCY_*", "Currency not supported", "invalid_request", "do_not_retry"],
  ["LOGIN_INVALID", "Email or password missing", "authentication_failed", "do_not_retry"],
  ["CANNOT_LOGIN", "Wrong email or API/MQI password", "authentication_failed", "do_not_retry"],
  [
    "PAYMENT_DENIED",
    "API not enabled or IP address not whitelisted",
    "configuration",
    "do_not_retry",
  ],
  ["NO_LOGIN_EXPLANATION", "Merchant email does not exist", "configuration", "do_not_retry"],
  [
    "PAYOUTS_NOT_ENABLED",
    "Quick Checkout payouts are not enabled",
    "configuration",
    "do_not_retry",
  ],
  ["REFUND_DENIED", "Refunds are not activated", "configuration", "do_not_retry"],
  [
    "LOCK_LEVEL_9",
    "Merchant account locked after failed logins",
    "authentication_failed",
    "manual_review",
  ],
  ["LL_NO_PAYMENT", "Account locked for security reasons", "fraud_or_risk", "manual_review"],
  ["CHECK_FOR_VERIFIED_EMAIL", "Merchant email not verified", "configuration", "manual_review"],
  ["INVALID_EMAIL", "Invalid email parameter", "invalid_request", "do_not_retry"],
  ["INVALID_PASSWORD", "Password too long (Balance Exchange)", "invalid_request", "do_not_retry"],
  ["INVALID_AMOUNT", "Invalid amount format", "invalid_amount", "do_not_retry"],
  ["INVALID_BNF_EMAIL", "Invalid beneficiary email", "invalid_request", "do_not_retry"],
  ["INVALID_CURRENCY", "Invalid currency", "invalid_request", "do_not_retry"],
  ["INVALID_FRN_TRN_ID", "frn_trn_id too long", "invalid_request", "do_not_retry"],
  ["INVALID_NOTE", "Note too long", "invalid_request", "do_not_retry"],
  ["INVALID_SUBJECT", "Subject too long", "invalid_request", "do_not_retry"],
  ["MISSING_AMOUNT", "Amount missing", "invalid_request", "do_not_retry"],
  [
    "MISSING_REGION_IDENTIFIER",
    "account_id is required to separate EEA and non-EEA balances",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ALREADY_EXECUTED",
    "A transfer with this frn_trn_id was already executed",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "EXECUTION_PENDING",
    "The same session is still executing",
    "duplicate_request",
    "retry_conditionally",
  ],
  [
    "SESSION_EXPIRED",
    "Session ID older than 15 minutes; prepare a new session",
    "network_or_timeout",
    "safe_to_retry_technical_request",
  ],
  [
    "BALANCE_NOT_ENOUGH",
    "Balance too low (the merchant's for send money, refunds and payouts; the customer's for 1-Tap)",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "RESERVE_EXCEEDED",
    "Refund blocked by the account reserve",
    "insufficient_funds",
    "manual_review",
  ],
  ["CC_REFUND_FAILED", "Card refund failed", "payment_method_unavailable", "manual_review"],
  ["GENERIC_ERROR", "Other error, or the payment was already refunded", "unknown", "manual_review"],
  ["REQUEST_FAILED", "1-Tap request failed", "unknown", "manual_review"],
  [
    "COUNTRY_BLOCKED_FOR_PAYMENTS",
    "Customer country blocked for outgoing payments",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "DISALLOWED_CROSS_REGION_PAYMENT",
    "account_id region does not match",
    "configuration",
    "do_not_retry",
  ],
  [
    "DISALLOWED_RECIPIENT",
    "Recipient not allowed (for example gaming merchants to US customers)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "GAMING_RESTRICTED_MONEY_API",
    "Recipient type restricted for regulatory reasons",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "MERCHANT_CLASS_RESTRICTED_TO_SEND_MONEY_TO_INC_RECIPIENT",
    "Cannot send money to an INC recipient",
    "configuration",
    "do_not_retry",
  ],
  [
    "CUSTOMER_TYPES_MISMATCH_N_T",
    "Test and normal accounts mixed",
    "configuration",
    "do_not_retry",
  ],
  [
    "CANNOT_SEND_MONEY_YOURSELF",
    "Transfer to the merchant's own account",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "SINGLE_TRN_LIMIT_VIOLATED",
    "Over the per-transaction maximum (EUR 10,000)",
    "invalid_amount",
    "do_not_retry",
  ],
  ["TRANSACTION_LIMIT_VIOLATION", "Payout limit reached", "invalid_amount", "manual_review"],
  [
    "CUMULATIVE_LIMIT_VIOLATION",
    "Payout limit for the period reached",
    "rate_limiting",
    "retry_conditionally",
  ],
  [
    "ORIGINAL_PAYMENT_NOT_PROCESSED",
    "The referenced deposit is not processed",
    "invalid_request",
    "retry_conditionally",
  ],
  [
    "ORIGINAL_PAYMENT_UNSUPPORTED_FOR_PAYOUT",
    "The deposit's payment method cannot receive payouts",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "CARD_FAILED",
    "The customer's card failed (1-Tap)",
    "card_declined",
    "customer_action_required",
  ],
  ["CUSTOMER_IS_LOCKED", "Customer locked for outgoing payments", "fraud_or_risk", "do_not_retry"],
  [
    "MAX_AMOUNT_REACHED",
    "Over the 1-Tap mandate maximum",
    "invalid_amount",
    "customer_action_required",
  ],
  [
    "MAX_REQ_REACHED",
    "Too many failed 1-Tap attempts (2 per 24 hours)",
    "rate_limiting",
    "retry_conditionally",
  ],
  [
    "ONDEMAND_CANCELLED",
    "The customer cancelled the 1-Tap mandate",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["ONDEMAND_INVALID", "The 1-Tap mandate does not exist", "invalid_request", "do_not_retry"],
  [
    "RECIPIENT_LIMIT_EXCEEDED",
    "Customer account limits too low",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "TOKEN_INVAILD",
    "PaysafeCard token invalidated (spelled as documented)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "MISSING_FROM_ACCOUNT_ID",
    "Balance Exchange source account id missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_FROM_ACCOUNT_ID",
    "Balance Exchange source account id invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_TO_ACCOUNT_ID",
    "Balance Exchange target account id missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_TO_ACCOUNT_ID",
    "Balance Exchange target account id invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "FROM_ACCOUNT_ID_MUST_BE_DIFFERENT_THAN_TO_ACCOUNT_ID",
    "Source and target account are the same",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ACCOUNT_ID_DOES_NOT_BELONG_TO_CUSTOMER",
    "The account does not belong to the merchant",
    "configuration",
    "do_not_retry",
  ],
  [
    "CURRENCY_MUST_BE_THE_SAME_AS_ACCOUNT_CURRENCY",
    "Currency differs from the account currency",
    "invalid_request",
    "do_not_retry",
  ],
]);

/** Wildcard API error patterns, most specific first. */
export const API_ERROR_PATTERNS = ["NOT_SUPPORTED_CURRENCY_*", "INVALID_*", "MISSING_*"] as const;

// ---------------------------------------------------------------------------
// MQI HTTP errors, Bank API codes, Unlinked Merchant Bank Payout codes

export const MQI_HTTP_ERRORS: Readonly<Record<string, CatalogEntry>> = table([
  ["401", "Cannot log in", "authentication_failed", "do_not_retry"],
  ["402", "Reserved", "unknown", "do_not_retry"],
  ["403", "Forbidden, or transaction not found", "invalid_request", "do_not_retry"],
  ["404", "Not found", "invalid_request", "do_not_retry"],
  ["405", "Method not allowed", "invalid_request", "do_not_retry"],
]);

export const BANK_API_ERRORS: Readonly<Record<string, CatalogEntry>> = table([
  [
    "5068",
    "Field errors (also an invalid countryId or an invalid merchant)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5003",
    "Invalid amount (also an unknown currency or a payment method that is not available)",
    "invalid_request",
    "do_not_retry",
  ],
]);

export const UBP_PREPARATION_ERRORS: Readonly<Record<string, CatalogEntry>> = table([
  ["MISSING_PARAMETER", "A required parameter is missing", "invalid_request", "do_not_retry"],
  ["INVALID_PARAMETER", "A parameter is invalid", "invalid_request", "do_not_retry"],
  [
    "NOT_MATCHING_PAYMENT_INSTRUMENT_COUNTRY",
    "The payment instrument country does not match",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "SWIFT_NOT_MATCH_WITH_IBAN",
    "The SWIFT code does not match the IBAN",
    "invalid_request",
    "do_not_retry",
  ],
  ["UNSUPPORTED_BANK", "The bank is not supported", "payment_method_unavailable", "do_not_retry"],
  ["ALREADY_PAID", "The payout was already paid", "duplicate_request", "do_not_retry"],
  [
    "COUNTRY_NOT_SUPPORTED_FOR_PAYOUTS",
    "The country is not supported for payouts",
    "configuration",
    "do_not_retry",
  ],
  [
    "BAD_REQUEST",
    "Bad request (IP address not allowed, or the initial payout is not confirmed)",
    "configuration",
    "do_not_retry",
  ],
  [
    "GENERAL_ERROR",
    "General error (several token or merchant mismatches)",
    "invalid_request",
    "manual_review",
  ],
]);

export const UBP_EXECUTION_ERRORS: Readonly<Record<string, CatalogEntry>> = table([
  ["7001", "Bad request", "invalid_request", "do_not_retry"],
  ["7002", "Bad signature", "authentication_failed", "do_not_retry"],
  [
    "7003",
    "Session expired; prepare the payout again",
    "network_or_timeout",
    "safe_to_retry_technical_request",
  ],
  ["7004", "Bad session data", "invalid_request", "do_not_retry"],
  ["7005", "Insufficient balance", "insufficient_funds", "retry_conditionally"],
  ["7006", "Account restricted", "configuration", "manual_review"],
  ["7007", "Minimum amount limit not met", "invalid_amount", "do_not_retry"],
  ["7008", "Per-transaction limit exceeded", "invalid_amount", "do_not_retry"],
  ["7009", "Daily limit exceeded", "rate_limiting", "retry_conditionally"],
  ["7010", "Weekly limit exceeded", "rate_limiting", "retry_conditionally"],
  ["7011", "Monthly limit exceeded", "rate_limiting", "retry_conditionally"],
  ["7012", "Bank country blocked", "fraud_or_risk", "do_not_retry"],
  ["7013", "Country not enabled for the merchant", "configuration", "do_not_retry"],
  ["7014", "Account not found", "configuration", "manual_review"],
  ["7015", "Recipient country blocked", "fraud_or_risk", "do_not_retry"],
  ["7017", "Recipient country blocked for gaming", "fraud_or_risk", "do_not_retry"],
  [
    "7018",
    "Recipient payment instrument country blocked for gaming",
    "fraud_or_risk",
    "do_not_retry",
  ],
]);

/**
 * UBP preparation codes that are too generic to identify Skrill on their own
 * (other APIs use the same words).
 */
export const UBP_GENERIC_CODES = [
  "MISSING_PARAMETER",
  "INVALID_PARAMETER",
  "BAD_REQUEST",
  "GENERAL_ERROR",
  "ALREADY_PAID",
] as const;
