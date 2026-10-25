/**
 * Airwallex code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/airwallex.md, which cites
 * Airwallex's public documentation and its official OpenAPI files, verified
 * 2026-10-25:
 *
 * API error codes:          https://www.airwallex.com/docs/payments/troubleshooting/error-response-codes
 *                           (plus the endpoint error lists, the rate-limits page and the login page)
 * Issuer response codes:    https://www.airwallex.com/docs/payments/troubleshooting/response-codes/issuer-response-codes
 * Merchant Advice Codes:    https://www.airwallex.com/docs/payments/troubleshooting/response-codes/merchant-advice-code
 * AVS and CVC results:      https://www.airwallex.com/docs/payments/troubleshooting/response-codes/avs-codes
 *                           https://www.airwallex.com/docs/payments/troubleshooting/response-codes/cvc2cvv2-codes
 * Statuses:                 https://www.airwallex.com/docs/payments/reference/payment-statuses
 * Webhook event names:      https://www.airwallex.com/docs/payments/reference/payments-webhooks
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file; where Airwallex gives advice (for
 * example "try again later"), the suggestion follows it. Airwallex marks
 * error messages as "subject to change", so decoding never reads them.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const D = "https://www.airwallex.com/docs";
export const ERROR_CODES_URL = `${D}/payments/troubleshooting/error-response-codes`;
export const ISSUER_CODES_URL = `${D}/payments/troubleshooting/response-codes/issuer-response-codes`;
export const MAC_URL = `${D}/payments/troubleshooting/response-codes/merchant-advice-code`;
export const AVS_URL = `${D}/payments/troubleshooting/response-codes/avs-codes`;
export const CVC_URL = `${D}/payments/troubleshooting/response-codes/cvc2cvv2-codes`;
export const STATUSES_URL = `${D}/payments/reference/payment-statuses`;
export const PAYMENTS_WEBHOOKS_URL = `${D}/payments/reference/payments-webhooks`;
export const WEBHOOKS_OVERVIEW_URL = `${D}/developer-tools/webhooks/webhooks-overview`;
export const LISTEN_WEBHOOKS_URL = `${D}/developer-tools/webhooks/listen-for-webhook-events`;
export const TRANSFER_WEBHOOKS_URL = `${D}/developer-tools/webhooks/listen-for-webhook-events/transfers`;
export const RATE_LIMITS_URL = `${D}/developer-tools/api/rate-limits`;
export const LOGIN_URL = `${D}/api/authentication/api_access_token/login`;
export const PAYMENT_INTENT_URL = `${D}/api/payments/payment_intents/retrieve`;
export const PAYMENT_ATTEMPT_URL = `${D}/api/payments/payment_attempts/retrieve`;
export const REFUND_URL = `${D}/api/payments/refunds/retrieve`;
export const REFUNDS_GUIDE_URL = `${D}/payments/payment-operations/manage-payments/refunds`;
export const DISPUTE_URL = `${D}/api/payments/payment_disputes/retrieve`;
export const DISPUTE_NOTIFICATIONS_URL = `${D}/payments/payment-operations/disputes/dispute-notifications`;
export const INTENT_GUIDE_URL = `${D}/payments/get-started/using-payments-intent-api`;
export const CANCELLATIONS_URL = `${D}/payments/payment-operations/manage-payments/cancellations`;
export const TEST_CARDS_URL = `${D}/payments/test-and-go-live/test-card-numbers`;
export const TRANSFER_ERRORS_URL = `${D}/payouts/errors/transfer-error-codes`;

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  /** HTTP statuses the code is documented with. */
  http?: readonly number[];
  /** True when the code is a definitive answer (a decline), not an uncertain outcome. */
  definitive?: boolean;
  /** False when Airwallex lists the code without describing it. */
  meaningDocumented?: boolean;
};

const UNCERTAIN_RETRY =
  "The original operation may or may not have taken effect. Retrieve the PaymentIntent first; if you retry, resend with the same request_id, which returns the original response when the first call succeeded.";
const FIX_REQUEST = "Resending the same request will fail again; fix the cause first.";
const NO_AUTO_RETRY =
  "Do not retry automatically. The customer needs to resolve this with the issuer or choose another payment method.";
const CONTACT_SUPPORT =
  "Contact Airwallex support with the trace_id; retrying will not help until the configuration is changed.";

/** API error `code` values (error body and failure_details.code): 31 codes. */
export const API_ERROR_CODES: Record<string, CatalogEntry> = {
  "3ds_not_supported": {
    category: "authentication_failed",
    explanation: "3D Secure is required, but the card does not support it.",
    nextAction: "Ask the customer to use a different card or payment method.",
    retry: "customer_action_required",
    retryExplanation: "The same card will fail again for this payment.",
    http: [400],
    definitive: true,
  },
  amount_above_limit: {
    category: "invalid_amount",
    explanation: "The amount is above the allowed limit.",
    nextAction:
      "Check the amount against the limit for this operation (for example the captured amount).",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  amount_below_limit: {
    category: "invalid_amount",
    explanation: "The amount is below the allowed limit.",
    nextAction: "Check the amount against the minimum for this payment method.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  authentication_declined: {
    category: "authentication_failed",
    explanation: "The shopper failed authentication (3D Secure).",
    nextAction: "Ask the customer to try again and complete authentication, or use another card.",
    retry: "customer_action_required",
    retryExplanation: "A new attempt needs the customer to complete authentication.",
    http: [400],
    definitive: true,
  },
  card_brand_not_supported: {
    category: "payment_method_unavailable",
    explanation:
      "The card brand is not supported. Airwallex's test card page notes that this happens when the brand is not configured on the account.",
    nextAction: "Ask the customer to use another card, or ask Airwallex to enable the card brand.",
    retry: "customer_action_required",
    retryExplanation:
      "The same card brand will be rejected until the account configuration changes.",
    http: [400],
    definitive: true,
  },
  configuration_error: {
    category: "configuration",
    explanation: "The request conflicts with the merchant account's configuration.",
    nextAction: "Contact Airwallex support with the trace_id.",
    retry: "manual_review",
    retryExplanation: CONTACT_SUPPORT,
    http: [400],
  },
  currency_not_supported: {
    category: "configuration",
    explanation: "The currency is not supported.",
    nextAction: "Use a currency that Airwallex supports for this account and payment method.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  duplicate_request: {
    category: "duplicate_request",
    explanation:
      "The request_id was already used for a different request. Retrying with the same request_id and the same request returns the original response instead.",
    nextAction:
      "Check whether the original request succeeded. Use a new request_id only for a genuinely new operation.",
    retry: "do_not_retry",
    retryExplanation: "Retrying with this request_id will be rejected again.",
    http: [400],
  },
  frequency_above_limit: {
    category: "rate_limiting",
    explanation: "The frequency limit for this resource and operation was reached.",
    nextAction: "Slow down operations on this resource and retry later.",
    retry: "retry_conditionally",
    retryExplanation: "A later retry can succeed once the frequency is below the limit.",
    http: [400],
  },
  invalid_status_for_operation: {
    category: "invalid_request",
    explanation: "The resource's current status does not allow this operation.",
    nextAction: "Retrieve the resource and check its status before choosing the next operation.",
    retry: "do_not_retry",
    retryExplanation: "The same operation will be rejected while the status is unchanged.",
    http: [400],
  },
  issuer_declined: {
    category: "card_declined",
    explanation:
      "The card issuer declined the transaction. The issuer response code (provider_original_response_code) gives the actual reason.",
    nextAction:
      "Read the issuer response code. Usually the customer must contact the issuer or use another card.",
    retry: "customer_action_required",
    retryExplanation: NO_AUTO_RETRY,
    http: [400],
    definitive: true,
  },
  issuer_unavailable: {
    category: "provider_unavailable",
    explanation: "The card issuer was temporarily unavailable.",
    nextAction: "Check the payment's status, then try again later.",
    retry: "retry_conditionally",
    retryExplanation: UNCERTAIN_RETRY,
    http: [400],
  },
  no_3ds_liability_shift: {
    category: "authentication_failed",
    explanation:
      "Declined because a 3D Secure liability shift could not be obtained, for example during a network outage or when the issuer was unavailable.",
    nextAction: "Ask the customer to try again later or use another card.",
    retry: "retry_conditionally",
    retryExplanation: "A later attempt may obtain the liability shift.",
    http: [400],
    definitive: true,
  },
  operation_not_supported: {
    category: "invalid_request",
    explanation: "The operation is not supported.",
    nextAction: "Check whether this operation is available for the payment method.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  payment_method_not_allowed: {
    category: "configuration",
    explanation: "The payment method is not enabled for the account.",
    nextAction: "Enable the payment method with Airwallex or offer another one.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  provider_declined: {
    category: "card_declined",
    explanation:
      "The payment method provider declined the payment. The provider's original response code, when present, gives the reason.",
    nextAction: "Ask the customer to use another payment method or contact the provider.",
    retry: "customer_action_required",
    retryExplanation: NO_AUTO_RETRY,
    http: [400],
    definitive: true,
  },
  provider_unavailable: {
    category: "provider_unavailable",
    explanation: "The payment provider was temporarily unavailable.",
    nextAction: "Check the payment's status, then try again later.",
    retry: "retry_conditionally",
    retryExplanation: UNCERTAIN_RETRY,
    http: [400],
  },
  quote_expired: {
    category: "invalid_request",
    explanation: "The FX quote expired.",
    nextAction: "Create a new quote and retry with it.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: "The request was rejected; retrying with a new quote is expected.",
    http: [400],
  },
  rejected_by_routing_rules: {
    category: "configuration",
    explanation: "The payment was rejected by the merchant's routing rules.",
    nextAction: "Review the routing rules, or contact Airwallex support with the trace_id.",
    retry: "manual_review",
    retryExplanation: CONTACT_SUPPORT,
    http: [400],
    definitive: true,
  },
  resource_already_exists: {
    category: "duplicate_request",
    explanation: "A resource with this ID already exists.",
    nextAction: "Retrieve the existing resource instead of creating it again.",
    retry: "do_not_retry",
    retryExplanation: "Creating the same resource again will be rejected.",
    http: [400],
  },
  resource_not_found: {
    category: "invalid_request",
    explanation: "The referenced resource ID does not exist.",
    nextAction: "Check the ID and the environment (production or sandbox).",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400, 404],
  },
  risk_declined: {
    category: "fraud_or_risk",
    explanation: "The payment was blocked by Airwallex risk controls.",
    nextAction: "Do not retry the same payment; review the order.",
    retry: "do_not_retry",
    retryExplanation: "Repeating a payment that risk controls blocked is not advised.",
    http: [400],
    definitive: true,
  },
  suspended_from_online_payments: {
    category: "configuration",
    explanation: "The account is suspended from online payments.",
    nextAction: "Contact Airwallex support.",
    retry: "manual_review",
    retryExplanation: CONTACT_SUPPORT,
    http: [400],
  },
  validation_error: {
    category: "invalid_request",
    explanation: "The request failed validation. The source field names the parameter.",
    nextAction: "Fix the parameter named in source and send the request again.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [400],
  },
  unauthorized: {
    category: "configuration",
    explanation: "Access was denied: the access token is missing or invalid.",
    nextAction: "Obtain a new access token and check the API credentials.",
    retry: "do_not_retry",
    retryExplanation: "The request will be rejected again with the same token.",
    http: [401],
  },
  not_found: {
    category: "configuration",
    explanation: "The endpoint does not exist.",
    nextAction: "Check the request path and HTTP method.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [404],
  },
  internal_error: {
    category: "provider_unavailable",
    explanation: "An internal Airwallex error occurred.",
    nextAction: "Check the payment's status, then try again later.",
    retry: "retry_conditionally",
    retryExplanation: UNCERTAIN_RETRY,
    http: [500],
  },
  operation_above_limit: {
    category: "unknown",
    explanation:
      "Airwallex lists this code for the confirm and confirm_continue endpoints but does not describe it.",
    nextAction: "Contact Airwallex support with the trace_id for the meaning of this code.",
    retry: "unknown",
    retryExplanation: "No retry guidance is documented for this code.",
    http: [400],
    meaningDocumented: false,
  },
  too_many_requests: {
    category: "rate_limiting",
    explanation: "A rate or concurrency limit was exceeded (HTTP 429).",
    nextAction: "Retry with exponential back-off and jitter, as Airwallex advises.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: "The request was rejected before processing; retry after a back-off.",
    http: [429],
  },
  credentials_invalid: {
    category: "configuration",
    explanation: "Login was attempted with invalid API credentials.",
    nextAction: "Check the client ID and API key.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [401],
  },
  credentials_expired: {
    category: "configuration",
    explanation: "Login was attempted with expired API credentials.",
    nextAction: "Create new API credentials.",
    retry: "do_not_retry",
    retryExplanation: FIX_REQUEST,
    http: [401],
  },
};

/**
 * Spellings seen in Airwallex's own pages that map to a catalog code. The test
 * card page writes `authentication_decline` once.
 */
export const API_ERROR_ALIASES: Record<string, string> = {
  authentication_decline: "authentication_declined",
};

/**
 * PaymentAttempt `failure_code`: 6 values. Airwallex lists the values without
 * descriptions, so meanings restate the names.
 */
export const FAILURE_CODES: Record<string, CatalogEntry> = {
  authentication_failed: {
    category: "authentication_failed",
    explanation: "Authentication (for example 3D Secure) failed.",
    nextAction: "Ask the customer to try again and complete authentication.",
    retry: "customer_action_required",
    retryExplanation: "A new attempt needs the customer to complete authentication.",
    definitive: true,
  },
  authorization_failed: {
    category: "card_declined",
    explanation: "Authorization was declined.",
    nextAction: "Read the issuer response code for the reason.",
    retry: "customer_action_required",
    retryExplanation: NO_AUTO_RETRY,
    definitive: true,
  },
  capture_failed: {
    category: "unknown",
    explanation: "Capture failed.",
    nextAction: "Check the authorization's state and the failure details before capturing again.",
    retry: "manual_review",
    retryExplanation: "Review why the capture failed before any new capture request.",
  },
  provider_unavailable: {
    category: "provider_unavailable",
    explanation: "The payment provider was unavailable.",
    nextAction: "Check the payment's status, then try again later.",
    retry: "retry_conditionally",
    retryExplanation: UNCERTAIN_RETRY,
  },
  system_unavailable: {
    category: "provider_unavailable",
    explanation: "The Airwallex system was unavailable.",
    nextAction: "Check the payment's status, then try again later.",
    retry: "retry_conditionally",
    retryExplanation: UNCERTAIN_RETRY,
  },
  fraud_rejected: {
    category: "fraud_or_risk",
    explanation: "The attempt was rejected by fraud screening.",
    nextAction: "Do not retry the same payment; review the order.",
    retry: "do_not_retry",
    retryExplanation: "Repeating a payment that fraud screening rejected is not advised.",
    definitive: true,
  },
};

/** Card brands as used by the issuer response code table. */
export type CardBrand =
  "visa" | "mastercard" | "unionpay" | "cartes_bancaires" | "amex" | "jcb" | "discover" | "diners";

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  cartes_bancaires: "Cartes Bancaires",
  amex: "American Express",
  jcb: "JCB",
  discover: "Discover",
  diners: "Diners Club",
};

export type IssuerReading = {
  brands: readonly CardBrand[];
  meaning: string;
  /** Approval codes are not declines; they never set a category. */
  kind: "decline" | "approval";
  category: ErrorCategory;
  retry: RetryGuidance;
};

const V = "visa" as const;
const MC = "mastercard" as const;
const UP = "unionpay" as const;
const CB = "cartes_bancaires" as const;
const ALL4 = [V, MC, UP, CB] as const;
const AMEX = ["amex"] as const;
const JCB = ["jcb"] as const;
const DD = ["discover", "diners"] as const;

type Row = readonly [
  string,
  readonly CardBrand[],
  string,
  ErrorCategory | "approval",
  RetryGuidance?,
];

const CAR = "customer_action_required" as const;
const DNR = "do_not_retry" as const;
const RC = "retry_conditionally" as const;
const MR = "manual_review" as const;

/** Two-character codes (Visa, Mastercard, UnionPay, Cartes Bancaires): 82 rows. */
const TWO_CHAR_ROWS: readonly Row[] = [
  ["00", ALL4, "Approved", "approval"],
  ["01", [V, MC, UP], "Declined; the shopper should contact the issuer", "card_declined", CAR],
  ["02", [CB], "Refer to card issuer", "card_declined", CAR],
  ["03", ALL4, "Invalid merchant (issuer decline)", "card_declined", CAR],
  [
    "04",
    ALL4,
    "Pick up card: possible counterfeit or stolen card, mostly card-present",
    "fraud_or_risk",
    DNR,
  ],
  ["05", ALL4, "Do not honor, a generic decline", "card_declined", CAR],
  ["06", [V, MC, UP], "Error at the issuer", "card_declined", CAR],
  [
    "07",
    [V, CB],
    "Pick up card, special condition: suspected counterfeit or stolen card",
    "fraud_or_risk",
    DNR,
  ],
  ["08", [CB], "Approved with cardholder identification (card-present)", "approval"],
  [
    "10",
    ALL4,
    "Partial approval; Airwallex does not support it, so the transaction was cancelled",
    "unknown",
    MR,
  ],
  [
    "11",
    [V, UP],
    "Approved (VIP); Airwallex's explanation for this code repeats the text of code 10",
    "unknown",
    MR,
  ],
  [
    "12",
    ALL4,
    "Invalid transaction: the issuer's policy does not allow this transaction type",
    "card_declined",
    CAR,
  ],
  [
    "13",
    ALL4,
    "Invalid amount or amount format; often debit or prepaid cards not allowed online",
    "invalid_amount",
    CAR,
  ],
  ["14", ALL4, "Invalid card number", "card_declined", CAR],
  ["15", ALL4, "Invalid issuer: the card range belongs to no issuer", "card_declined", CAR],
  ["17", [CB], "Customer cancelled; do not retry", "card_declined", DNR],
  [
    "19",
    [V, CB],
    "Re-enter transaction: a temporary processing problem, retry recommended",
    "provider_unavailable",
    RC,
  ],
  ["20", [CB], "Invalid response from the issuer", "provider_unavailable", RC],
  ["21", [UP], "No action taken: the card is not activated or is dormant", "card_declined", CAR],
  ["22", [UP], "Operation error; the transaction type may be disallowed", "card_declined", CAR],
  ["30", [MC, UP, CB], "Format error; check for invalid characters", "invalid_request", CAR],
  ["31", [CB], "Bank not supported by the switch", "payment_method_unavailable", CAR],
  ["33", [CB], "Expired card", "card_declined", CAR],
  ["34", [UP], "Fraudulent card", "fraud_or_risk", DNR],
  ["34", [CB], "Suspected fraud", "fraud_or_risk", DNR],
  ["38", [CB], "Allowed PIN tries exceeded", "authentication_failed", CAR],
  ["40", [UP], "Transaction type not supported by the issuer", "card_declined", CAR],
  ["41", ALL4, "Lost card", "fraud_or_risk", DNR],
  ["43", ALL4, "Stolen card", "fraud_or_risk", DNR],
  ["46", [V, MC], "Closed account; do not retry the same card number", "card_declined", DNR],
  ["46", [CB], "Business-specific decline without detail", "card_declined", CAR],
  ["51", ALL4, "Insufficient funds or over the credit limit", "insufficient_funds", CAR],
  ["52", [V], "No checking account linked to the card", "card_declined", CAR],
  ["53", [V], "No savings account linked to the card", "card_declined", CAR],
  ["54", ALL4, "Expired card", "card_declined", CAR],
  ["55", ALL4, "Invalid PIN", "authentication_failed", CAR],
  ["56", [CB], "No card record", "card_declined", CAR],
  [
    "57",
    ALL4,
    "Transaction not permitted to the issuer or cardholder (for example a prepaid wallet top-up)",
    "card_declined",
    CAR,
  ],
  [
    "58",
    [MC, CB],
    "Transaction not permitted to the acquirer or terminal (for example international use blocked)",
    "card_declined",
    CAR,
  ],
  ["59", [V, UP, CB], "Suspected fraud", "fraud_or_risk", DNR],
  [
    "60",
    [CB],
    "The card acceptor should contact the acquirer; contact Airwallex",
    "configuration",
    MR,
  ],
  ["61", ALL4, "Exceeds the withdrawal amount limit", "card_declined", CAR],
  ["62", ALL4, "Restricted card (issuer risk policy or delinquency)", "card_declined", CAR],
  ["63", [V, MC, CB], "Security violation", "fraud_or_risk", CAR],
  ["64", [V, UP], "AML requirement failure or original amount mismatch", "fraud_or_risk", MR],
  ["65", [V], "Exceeds the withdrawal count (usage frequency) limit", "card_declined", CAR],
  [
    "65",
    [MC],
    "Soft decline: the issuer requests additional authentication",
    "authentication_required",
    CAR,
  ],
  ["68", [CB], "The issuer response arrived too late; retry", "network_or_timeout", RC],
  [
    "6P",
    [V],
    "Customer ID verification failed (Visa Direct); not related to CVV",
    "authentication_failed",
    CAR,
  ],
  ["6P", [CB], "Verification data failed", "authentication_failed", CAR],
  ["70", [MC], "Contact the card issuer", "card_declined", CAR],
  ["72", [MC], "Account not yet activated", "card_declined", CAR],
  ["75", [CB], "Allowed PIN entries exceeded", "authentication_failed", CAR],
  ["77", [CB], "Closed account; do not retry the same card number", "card_declined", DNR],
  [
    "78",
    [V, MC, CB],
    "Invalid or nonexistent account; Airwallex's explanation repeats the text of code 72",
    "card_declined",
    CAR,
  ],
  [
    "79",
    [MC],
    "Lifecycle decline (invalid card data); read the Merchant Advice Code",
    "card_declined",
    CAR,
  ],
  ["80", [V], "Credit issuer unavailable", "provider_unavailable", RC],
  ["82", [MC], "Policy decline; read the Merchant Advice Code", "card_declined", CAR],
  [
    "82",
    [V, CB],
    "Negative CAM, dCVV, iCVV, CVV or CAVV result, or offline PIN interrupted",
    "authentication_failed",
    CAR,
  ],
  ["83", [MC], "Fraud or security decline; read the Merchant Advice Code", "fraud_or_risk", DNR],
  [
    "85",
    [V, MC],
    "No reason to decline (approval for zero-amount or verification requests)",
    "approval",
  ],
  [
    "90",
    [UP],
    "Daily cutoff in progress; retry with the same credentials",
    "provider_unavailable",
    RC,
  ],
  ["91", [V, UP], "Issuer or authorization platform not available", "provider_unavailable", RC],
  ["91", [MC, CB], "Issuer unavailable or switch inoperative", "provider_unavailable", RC],
  ["92", [V, MC, UP], "Cannot route; possibly a wrong or test card number", "card_declined", CAR],
  ["93", [V, MC, CB], "Violation of law", "card_declined", DNR],
  [
    "94",
    [CB],
    "Duplicate transmission; do not retry the same authorization",
    "duplicate_request",
    DNR,
  ],
  ["96", ALL4, "System malfunction at the issuer", "provider_unavailable", RC],
  ["97", [CB], "General monitoring timeout; retry", "network_or_timeout", RC],
  ["98", [CB], "Server inaccessible", "provider_unavailable", RC],
  [
    "1A",
    [V],
    "Authentication required (soft decline; SCA in the EEA and UK)",
    "authentication_required",
    CAR,
  ],
  ["R0", [V, CB], "Stop payment order for one recurring payment", "card_declined", DNR],
  [
    "R1",
    [V, CB],
    "Revocation of the authorisation order (all recurring payments of this order)",
    "card_declined",
    DNR,
  ],
  ["R3", [V, CB], "Revocation of all authorisation orders for the card", "card_declined", DNR],
  ["N7", [V], "CVV2 failure", "card_declined", CAR],
  ["5C", [V], "Transaction not supported or blocked by the issuer", "card_declined", CAR],
  ["9G", [V], "Blocked by the cardholder", "card_declined", CAR],
  ["A0", [CB], "Fallback to contact chip mode (card-present)", "payment_method_unavailable", CAR],
  [
    "A1",
    [CB],
    "Soft decline; retry with authentication such as 3D Secure",
    "authentication_required",
    CAR,
  ],
  [
    "A2",
    [CB],
    "PIN requested in single-tap contactless mode (card-present)",
    "authentication_required",
    CAR,
  ],
  [
    "A3",
    [CB],
    "New contactless tap with authentication required (card-present)",
    "authentication_required",
    CAR,
  ],
  ["A4", [CB], "TRA exemption misused; retry with SCA", "authentication_required", CAR],
];

/** American Express (three digits): 21 rows. */
const AMEX_ROWS: readonly Row[] = [
  ["000", AMEX, "Approved", "approval"],
  ["100", AMEX, "Deny (policy decline)", "card_declined", CAR],
  ["109", AMEX, "Invalid merchant; the acquirer should check the merchant ID", "configuration", MR],
  ["110", AMEX, "Invalid amount", "invalid_amount", CAR],
  ["111", AMEX, "Invalid account", "card_declined", CAR],
  ["115", AMEX, "Requested function not supported", "payment_method_unavailable", CAR],
  ["116", AMEX, "Not sufficient funds", "insufficient_funds", CAR],
  [
    "119",
    AMEX,
    "Cardmember not enrolled or not permitted (for example 3D Secure or AVS)",
    "card_declined",
    CAR,
  ],
  ["121", AMEX, "Limit exceeded (usage frequency)", "card_declined", CAR],
  ["122", AMEX, "Invalid card security code", "card_declined", CAR],
  [
    "130",
    AMEX,
    "Additional customer identification required (soft decline)",
    "authentication_required",
    CAR,
  ],
  ["181", AMEX, "Format error", "invalid_request", CAR],
  ["183", AMEX, "Invalid currency code", "configuration", DNR],
  ["187", AMEX, "Deny, new card issued", "card_declined", CAR],
  ["189", AMEX, "Deny, merchant cancelled or closed", "configuration", MR],
  ["190", AMEX, "National ID mismatch", "authentication_failed", CAR],
  ["200", AMEX, "Deny, pick up card (lost or stolen)", "fraud_or_risk", DNR],
  ["909", AMEX, "System malfunction (cryptographic error)", "provider_unavailable", CAR],
  ["912", AMEX, "Issuer not available", "provider_unavailable", RC],
  ["977", AMEX, "Invalid payment plan (recurring frequency or amount)", "invalid_request", DNR],
  ["978", AMEX, "Invalid payment times (recurring frequency or amount)", "invalid_request", DNR],
];

/** JCB (dotted nine-digit codes): 40 rows. */
const JCB_ROWS: readonly Row[] = [
  ["000.000.000", JCB, "Succeeded", "approval"],
  ["800.100.100", JCB, "Declined, reason unknown", "card_declined", CAR],
  [
    "800.100.150",
    JCB,
    "Refund on a gambling transaction not allowed",
    "payment_method_unavailable",
    DNR,
  ],
  ["800.100.151", JCB, "Invalid card", "card_declined", CAR],
  ["800.100.152", JCB, "Declined by the authorization system", "card_declined", CAR],
  ["800.100.153", JCB, "Invalid CVV", "card_declined", CAR],
  ["800.100.154", JCB, "Transaction marked invalid", "card_declined", CAR],
  ["800.100.155", JCB, "Amount exceeds credit", "insufficient_funds", CAR],
  ["800.100.156", JCB, "Format error", "invalid_request", CAR],
  ["800.100.157", JCB, "Wrong expiry date", "card_declined", CAR],
  ["800.100.158", JCB, "Suspected manipulation", "fraud_or_risk", DNR],
  ["800.100.159", JCB, "Stolen card", "fraud_or_risk", DNR],
  ["800.100.160", JCB, "Card blocked", "card_declined", CAR],
  ["800.100.161", JCB, "Too many invalid tries", "card_declined", CAR],
  ["800.100.162", JCB, "Limit exceeded", "card_declined", CAR],
  ["800.100.163", JCB, "Maximum transaction frequency exceeded", "card_declined", CAR],
  ["800.100.164", JCB, "The merchant's processing limit was exceeded", "configuration", MR],
  ["800.100.165", JCB, "Card lost", "fraud_or_risk", DNR],
  ["800.100.168", JCB, "Restricted card", "card_declined", CAR],
  [
    "800.100.169",
    JCB,
    "Card type not processed by the authorization center",
    "payment_method_unavailable",
    CAR,
  ],
  ["800.100.170", JCB, "Transaction not permitted", "card_declined", CAR],
  ["800.100.171", JCB, "Pick up card", "fraud_or_risk", DNR],
  ["800.100.172", JCB, "Account blocked", "card_declined", CAR],
  ["800.100.173", JCB, "Invalid currency", "configuration", DNR],
  ["800.100.174", JCB, "Insufficient funds", "insufficient_funds", CAR],
  ["800.100.176", JCB, "Account temporarily unavailable; try later", "provider_unavailable", RC],
  ["800.100.179", JCB, "Exceeds the withdrawal count limit", "card_declined", CAR],
  [
    "800.100.190",
    JCB,
    "Invalid configuration data (currency or amount limits)",
    "configuration",
    MR,
  ],
  [
    "800.100.192",
    JCB,
    "Invalid CVV; the amount stays reserved for a few business days",
    "card_declined",
    CAR,
  ],
  ["800.100.195", JCB, "Account number or ID unknown", "card_declined", CAR],
  ["800.100.200", JCB, "Refer to payer, reason not specified", "card_declined", CAR],
  ["800.100.201", JCB, "Account or bank details incorrect", "card_declined", CAR],
  ["800.100.202", JCB, "Account closed", "card_declined", DNR],
  ["800.100.203", JCB, "Insufficient funds", "insufficient_funds", CAR],
  ["800.100.204", JCB, "Mandate expired (recurring)", "card_declined", CAR],
  ["800.100.205", JCB, "Mandate discarded (recurring)", "card_declined", CAR],
  ["800.100.402", JCB, "Card or account holder not valid", "card_declined", CAR],
  ["800.100.403", JCB, "Revocation of the authorisation order", "card_declined", DNR],
  [
    "800.100.500",
    JCB,
    "The cardholder asked the bank to stop this recurring payment",
    "card_declined",
    DNR,
  ],
  [
    "800.100.501",
    JCB,
    "The cardholder asked the bank to stop all recurring payments for this merchant",
    "card_declined",
    DNR,
  ],
];

/** Discover and Diners Club (three digits): 33 rows. */
const DISCOVER_ROWS: readonly Row[] = [
  ["081", DD, "Approved", "approval"],
  ["100", DD, "Do not honor", "card_declined", CAR],
  ["101", DD, "Expired card", "card_declined", CAR],
  ["102", DD, "Suspected fraud", "fraud_or_risk", DNR],
  ["103", DD, "Customer authentication required (soft decline)", "authentication_required", CAR],
  ["104", DD, "Restricted card", "card_declined", CAR],
  ["106", DD, "Allowed PIN tries exceeded", "authentication_failed", CAR],
  ["109", DD, "Invalid merchant", "card_declined", CAR],
  ["110", DD, "Invalid amount", "invalid_amount", CAR],
  ["111", DD, "Invalid card number", "card_declined", CAR],
  ["115", DD, "Requested function not supported", "payment_method_unavailable", CAR],
  ["117", DD, "Incorrect PIN", "authentication_failed", CAR],
  ["118", DD, "Cycle range suspended (invalid card data)", "card_declined", CAR],
  ["119", DD, "Not permitted to the cardholder", "card_declined", CAR],
  ["120", DD, "Not permitted to the originator", "card_declined", CAR],
  ["122", DD, "Card validity period exceeded", "card_declined", CAR],
  ["124", DD, "Violation of law", "card_declined", DNR],
  ["125", DD, "Card not effective (not yet activated)", "card_declined", CAR],
  ["129", DD, "Suspected counterfeit card", "fraud_or_risk", DNR],
  ["163", DD, "Security violation", "fraud_or_risk", DNR],
  ["182", DD, "Decline given by the issuer (generic)", "card_declined", CAR],
  ["192", DD, "Restricted merchant", "card_declined", CAR],
  ["197", DD, "Card account verification failed", "card_declined", CAR],
  ["198", DD, "TVR or CVR validation failed", "card_declined", CAR],
  ["200", DD, "Do not honor", "card_declined", CAR],
  ["201", DD, "Expired card", "card_declined", CAR],
  ["202", DD, "Suspected fraud", "fraud_or_risk", DNR],
  ["204", DD, "Restricted card", "card_declined", CAR],
  ["206", DD, "Allowed PIN tries exceeded", "authentication_failed", CAR],
  ["207", DD, "Special conditions (suspected counterfeit or stolen card)", "fraud_or_risk", DNR],
  ["208", DD, "Lost card", "fraud_or_risk", DNR],
  ["209", DD, "Stolen card", "fraud_or_risk", DNR],
  ["210", DD, "Suspected counterfeit card", "fraud_or_risk", DNR],
];

/** All issuer response code rows, in the order of Airwallex's table: 176 rows. */
export const ISSUER_CODE_ROWS: readonly (IssuerReading & { code: string })[] = [
  ...TWO_CHAR_ROWS,
  ...AMEX_ROWS,
  ...JCB_ROWS,
  ...DISCOVER_ROWS,
].map(([code, brands, meaning, category, retry]): IssuerReading & { code: string } =>
  category === "approval"
    ? { code, brands, meaning, kind: "approval", category: "unknown", retry: "unknown" }
    : { code, brands, meaning, kind: "decline", category, retry: retry ?? "unknown" },
);

/** Issuer response code string to its readings (several when the meaning depends on the brand). */
export const ISSUER_CODES: Record<string, readonly IssuerReading[]> = (() => {
  const out: Record<string, IssuerReading[]> = {};
  for (const { code, ...reading } of ISSUER_CODE_ROWS) {
    if (Object.prototype.hasOwnProperty.call(out, code)) out[code]!.push(reading);
    else out[code] = [reading];
  }
  return out;
})();

/** Brands whose codes share a code format, used when the brand is unknown. */
export function brandsForCodeFormat(code: string): readonly CardBrand[] {
  if (/^\d{3}\.\d{3}\.\d{3}$/.test(code)) return JCB;
  if (/^\d{3}$/.test(code)) return ["amex", "discover", "diners"];
  return ALL4;
}

export const ISSUER_RETRY_EXPLANATIONS: Record<RetryGuidance, string> = {
  customer_action_required: NO_AUTO_RETRY,
  do_not_retry:
    "Do not retry this card for this payment; the issuer's answer is not expected to change.",
  retry_conditionally:
    "The issuer or network could not give a final answer. A later retry can succeed; check the payment's status first and reuse the same request_id.",
  safe_to_retry_technical_request: "The request can be sent again.",
  manual_review: "Review the case, or contact Airwallex, before any retry.",
  unknown: "No retry guidance is available for this code.",
};

export const CATEGORY_NEXT_ACTIONS: Record<ErrorCategory, string> = {
  card_declined: "Ask the customer to contact the card issuer or use another payment method.",
  authentication_required:
    "Bring the customer back to complete authentication (for example 3D Secure).",
  authentication_failed: "Ask the customer to retry authentication or use another card.",
  invalid_request: "Correct the request data before sending it again.",
  invalid_amount: "Check the amount and whether this card type is allowed for it.",
  insufficient_funds: "Ask the customer to use another payment method or try again later.",
  payment_method_unavailable: "Ask the customer to use another card or payment method.",
  fraud_or_risk: "Do not retry the card; review the order for fraud.",
  rate_limiting: "Slow down and retry later.",
  provider_unavailable: "Check the payment's status, then try again later.",
  network_or_timeout: "Check the payment's status, then try again later.",
  duplicate_request: "Check the original request's result instead of sending it again.",
  configuration: "Contact Airwallex support to review the account configuration.",
  unknown: "Retrieve the payment and contact Airwallex support if the reason is unclear.",
};

export type MacEntry = {
  validWith: readonly string[];
  meaning: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

/** Mastercard Merchant Advice Codes (`merchant_advice_code`): 5 values. */
export const MERCHANT_ADVICE_CODES: Record<string, MacEntry> = {
  "01": {
    validWith: ["00", "05", "14", "51", "54", "79", "82"],
    meaning: "New account information is available; update it before the next billing",
    retry: "customer_action_required",
    retryExplanation:
      "Update the card details (for example through the customer) before charging again.",
  },
  "02": {
    validWith: ["51", "79", "82", "83"],
    meaning: "Cannot approve at this time",
    retry: "retry_conditionally",
    retryExplanation: "Airwallex suggests retrying 72 hours later, not immediately.",
  },
  "03": {
    validWith: ["05", "14", "51", "54", "79", "82", "83"],
    meaning: "Do not try again (account closed or fraud)",
    retry: "do_not_retry",
    retryExplanation: "Mastercard advises not to try this card again.",
  },
  "04": {
    validWith: ["39"],
    meaning:
      "POS cardholder presence indicator problem (SLI and cryptography data); resubmit with correct data",
    retry: "do_not_retry",
    retryExplanation: "Do not resend the same data; correct it first.",
  },
  "21": {
    validWith: ["05"],
    meaning: "Payment cancellation: the cardholder cancelled the agreement",
    retry: "do_not_retry",
    retryExplanation: "The cardholder cancelled the agreement; do not charge it again.",
  },
};

export type AvsEntry = {
  bucket: "Match" | "Partial Match" | "Not Match" | "Unavailable or Not Applicable";
  meaning: string;
};

/**
 * AVS result letters (18). How these letters appear in the API fields is not
 * documented: the API reference example shows "pass" instead.
 */
export const AVS_CODES: Record<string, AvsEntry> = {
  A: { bucket: "Partial Match", meaning: "Address matches, ZIP does not" },
  B: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Visa: street matches, postal code not verified (format)",
  },
  C: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Visa: street and postal code not verified (format)",
  },
  D: { bucket: "Match", meaning: "Visa: street and postal code match" },
  E: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Error response for merchant category code",
  },
  F: { bucket: "Match", meaning: "Visa: street and postal code match (UK only)" },
  G: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Visa: address unavailable, international, non-AVS participant",
  },
  I: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Visa: address not verified (international)",
  },
  M: { bucket: "Match", meaning: "Visa: street and postal code match" },
  N: { bucket: "Not Match", meaning: "Neither address nor postal code matches" },
  P: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Visa: postal code matches, street not verified (format)",
  },
  R: {
    bucket: "Unavailable or Not Applicable",
    meaning: "Retry: system unable to process or timed out",
  },
  S: { bucket: "Unavailable or Not Applicable", meaning: "AVS not supported" },
  U: {
    bucket: "Unavailable or Not Applicable",
    meaning:
      "Mastercard: no data from issuer; Visa: address not verified or issuer not participating",
  },
  W: {
    bucket: "Partial Match",
    meaning:
      "Visa: nine-digit ZIP matches, address does not; Mastercard: postal code matches, address does not",
  },
  X: {
    bucket: "Match",
    meaning: "Mastercard and Visa: address and (nine-digit) postal code match",
  },
  Y: {
    bucket: "Match",
    meaning: "Mastercard (US, five-digit) and Visa: address and postal code match",
  },
  Z: {
    bucket: "Partial Match",
    meaning: "Mastercard and Visa: five-digit postal code matches, address does not",
  },
};

/** CVC2/CVV2 result values (6, including a single space). */
export const CVC_CODES: Record<string, string> = {
  M: "Match",
  N: "No match",
  P: "Not processed (issuer temporarily unavailable)",
  S: "Visa: the merchant indicated no CVV2 although it should be on the card",
  U: "Visa: issuer not participating or no keys; Mastercard: unverified",
  " ": "Visa: no result",
};

export type StatusEntry = { stage: LifecycleStage; outcome: Outcome; meaning: string };

/** PaymentIntent `status` (7). Airwallex says the list "is not exhaustive". */
export const PAYMENT_INTENT_STATUSES: Record<string, StatusEntry> = {
  REQUIRES_PAYMENT_METHOD: {
    stage: "payment",
    outcome: "pending",
    meaning: "Created, or the previous attempt failed or expired; waiting for confirm",
  },
  REQUIRES_CUSTOMER_ACTION: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for 3D Secure, a redirect or a QR scan (see next_action)",
  },
  REQUIRES_CAPTURE: {
    stage: "authorization",
    outcome: "success",
    meaning: "Authorized, not captured",
  },
  PENDING: { stage: "payment", outcome: "pending", meaning: "Asynchronous processing" },
  PENDING_REVIEW: {
    stage: "authorization",
    outcome: "pending",
    meaning: "Authorized but under risk review; capture is not possible in this status",
  },
  SUCCEEDED: {
    stage: "payment",
    outcome: "success",
    meaning: "Captured; funds are guaranteed and will settle",
  },
  CANCELLED: {
    stage: "cancellation",
    outcome: "success",
    meaning: "Cancelled by the merchant, or the authorization expired before capture",
  },
};

/** PaymentAttempt `status` (10). */
export const PAYMENT_ATTEMPT_STATUSES: Record<string, StatusEntry> = {
  RECEIVED: { stage: "payment", outcome: "pending", meaning: "Attempt created" },
  AUTHENTICATION_REDIRECTED: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for customer authentication (3D Secure, QR scan)",
  },
  PENDING_AUTHORIZATION: {
    stage: "authorization",
    outcome: "pending",
    meaning: "Authorization request accepted, final result pending",
  },
  AUTHORIZED: {
    stage: "authorization",
    outcome: "success",
    meaning: "Authorized; will be captured automatically or needs a manual capture",
  },
  CAPTURE_REQUESTED: {
    stage: "capture",
    outcome: "success",
    meaning: "Capture requested; Airwallex describes the payment as complete",
  },
  SETTLED: {
    stage: "settlement",
    outcome: "success",
    meaning: "Airwallex received settlement from the provider",
  },
  PAID: {
    stage: "settlement",
    outcome: "success",
    meaning: "Funds settled to the merchant's Airwallex Wallet",
  },
  CANCELLED: {
    stage: "cancellation",
    outcome: "success",
    meaning: "Cancelled; any authorized amount is released",
  },
  EXPIRED: {
    stage: "payment",
    outcome: "failure",
    meaning: "Expired after the allowed payment time",
  },
  FAILED: { stage: "payment", outcome: "failure", meaning: "Failed; a new attempt is needed" },
};

/**
 * Stage of a FAILED attempt by `failure_code`. Airwallex does not document the
 * link explicitly; it follows the value names.
 */
export const FAILURE_CODE_STAGES: Record<string, LifecycleStage> = {
  authentication_failed: "authentication",
  authorization_failed: "authorization",
  capture_failed: "capture",
  fraud_rejected: "payment",
  provider_unavailable: "payment",
  system_unavailable: "payment",
};

/** Refund `status` (4). */
export const REFUND_STATUSES: Record<string, StatusEntry> = {
  RECEIVED: {
    stage: "refund",
    outcome: "pending",
    meaning: "Created; the amount is valid and the payment is not in dispute",
  },
  ACCEPTED: {
    stage: "refund",
    outcome: "success",
    meaning: "Accepted by the provider; effectively completed from Airwallex's side",
  },
  SETTLED: {
    stage: "refund",
    outcome: "success",
    meaning: "Reconciled; appears in settlement reports",
  },
  FAILED: { stage: "refund", outcome: "failure", meaning: "Rejected" },
};

/** PaymentDispute `stage` (5). */
export const DISPUTE_STAGES: Record<string, string> = {
  RFI: "Request for information",
  PRE_CHARGEBACK: "Pre-chargeback",
  CHARGEBACK: "Chargeback",
  PRE_ARBITRATION: "Pre-arbitration",
  ARBITRATION: "Arbitration",
};

/**
 * PaymentDispute `status` (9). Only WON and LOST state the result; the others
 * are open or their effect on funds is not described, so they stay pending or
 * unknown.
 */
export const DISPUTE_STATUSES: Record<string, StatusEntry> = {
  REQUIRES_RESPONSE: {
    stage: "dispute",
    outcome: "pending",
    meaning: "Waiting for the merchant's response",
  },
  CHALLENGED: { stage: "dispute", outcome: "pending", meaning: "Challenged by the merchant" },
  ACCEPTED: { stage: "dispute", outcome: "unknown", meaning: "Accepted" },
  REVERSED: { stage: "dispute", outcome: "unknown", meaning: "Reversed" },
  WON: { stage: "dispute", outcome: "success", meaning: "Won" },
  LOST: { stage: "dispute", outcome: "failure", meaning: "Lost" },
  PENDING_CLOSURE: { stage: "dispute", outcome: "pending", meaning: "Pending closure" },
  EXPIRED: { stage: "dispute", outcome: "unknown", meaning: "Expired" },
  PENDING_DECISION: { stage: "dispute", outcome: "pending", meaning: "Pending decision" },
};

/** PaymentDispute `reason.type` (17). */
export const DISPUTE_REASON_TYPES: readonly string[] = [
  "CREDIT_NOT_PROCESSED",
  "FRAUDULENT",
  "DUPLICATE_CHARGE",
  "PRODUCT_NOT_RECEIVED",
  "PRODUCT_UNACCEPTABLE",
  "UNRECOGNIZED_CHARGE",
  "CANCELLED_PRODUCT",
  "MISREPRESENTATION",
  "COUNTERFEIT_PRODUCT",
  "PROCESSING_ERRORS",
  "AUTHORIZATION",
  "NOT_RECOGNIZED",
  "BANK_REJECTION",
  "FUND_REVERSAL",
  "CONSUMER_DISPUTE",
  "POINT_OF_INTERACTION_ERROR",
  "UNKNOWN",
];

/** `next_action.type` values; `redirect_form` is used before API version 2022-11-11. */
export const NEXT_ACTION_TYPES: readonly string[] = [
  "render_qrcode",
  "call_sdk",
  "redirect",
  "redirect_iframe",
  "request_pin",
  "redirect_form",
];

export type EventEntry = {
  stage: LifecycleStage | "from_status";
  outcome: Outcome | "from_status";
};

/** Payments webhook events with known semantics: 37 names. */
export const WEBHOOK_EVENTS: Record<string, EventEntry> = {
  "payment_intent.created": { stage: "payment", outcome: "pending" },
  "payment_intent.requires_payment_method": { stage: "payment", outcome: "from_status" },
  "payment_intent.updated": { stage: "from_status", outcome: "from_status" },
  "payment_intent.requires_capture": { stage: "authorization", outcome: "success" },
  "payment_intent.requires_customer_action": { stage: "authentication", outcome: "pending" },
  "payment_intent.pending": { stage: "payment", outcome: "pending" },
  "payment_intent.pending_review": { stage: "authorization", outcome: "pending" },
  "payment_intent.succeeded": { stage: "payment", outcome: "success" },
  "payment_intent.cancelled": { stage: "cancellation", outcome: "success" },
  "payment_intent.payment_failed": { stage: "payment", outcome: "failure" },
  "payment_attempt.received": { stage: "payment", outcome: "pending" },
  "payment_attempt.authentication_failed": { stage: "authentication", outcome: "failure" },
  "payment_attempt.authentication_redirected": { stage: "authentication", outcome: "pending" },
  "payment_attempt.pending_authorization": { stage: "authorization", outcome: "pending" },
  "payment_attempt.authorization_failed": { stage: "authorization", outcome: "failure" },
  "payment_attempt.authorized": { stage: "authorization", outcome: "success" },
  "payment_attempt.capture_requested": { stage: "capture", outcome: "success" },
  "payment_attempt.settled": { stage: "settlement", outcome: "success" },
  "payment_attempt.paid": { stage: "settlement", outcome: "success" },
  "payment_attempt.cancelled": { stage: "cancellation", outcome: "success" },
  "payment_attempt.expired": { stage: "payment", outcome: "failure" },
  "payment_attempt.risk_declined": { stage: "payment", outcome: "failure" },
  "payment_attempt.failed_to_process": { stage: "payment", outcome: "failure" },
  "payment_attempt.capture_failed": { stage: "capture", outcome: "failure" },
  "refund.received": { stage: "refund", outcome: "pending" },
  "refund.accepted": { stage: "refund", outcome: "success" },
  "refund.settled": { stage: "refund", outcome: "success" },
  "refund.failed": { stage: "refund", outcome: "failure" },
  "payment_dispute.requires_response": { stage: "dispute", outcome: "pending" },
  "payment_dispute.challenged": { stage: "dispute", outcome: "pending" },
  "payment_dispute.accepted": { stage: "dispute", outcome: "unknown" },
  "payment_dispute.expired": { stage: "dispute", outcome: "unknown" },
  "payment_dispute.pending_closure": { stage: "dispute", outcome: "pending" },
  "payment_dispute.pending_decision": { stage: "dispute", outcome: "pending" },
  "payment_dispute.won": { stage: "dispute", outcome: "success" },
  "payment_dispute.lost": { stage: "dispute", outcome: "failure" },
  "payment_dispute.reversed": { stage: "dispute", outcome: "unknown" },
};

/**
 * Other documented payments events. They are recognized but carry objects
 * whose schemas were not researched, so they are shown without lifecycle
 * semantics. POS terminal events are not listed.
 */
export const OTHER_PAYMENTS_EVENTS: readonly string[] = [
  "payment_consent.created",
  "payment_consent.updated",
  "payment_consent.pending",
  "payment_consent.verified",
  "payment_consent.disabled",
  "payment_consent.paused",
  "payment_consent.requires_payment_method",
  "payment_consent.requires_customer_action",
  "payment_consent.verification_failed",
  "payment_method.created",
  "payment_method.updated",
  "payment_method.attached",
  "payment_method.detached",
  "payment_method.disabled",
  "customer.created",
  "customer.updated",
  "payment_link.created",
  "payment_link.paid",
  "fraud.merchant_notified",
  "funds_split.created",
  "funds_split.failed",
  "funds_split.released",
  "funds_split.settled",
];

/** Event name prefixes of the analyzed objects. */
export const ANALYZED_EVENT_FAMILIES = [
  "payment_intent",
  "payment_attempt",
  "refund",
  "payment_dispute",
] as const;

/** Event name prefixes that are documented but not analyzed. */
export const OTHER_EVENT_FAMILIES: readonly string[] = [
  "payment_consent",
  "payment_method",
  "customer",
  "payment_link",
  "fraud",
  "funds_split",
];
