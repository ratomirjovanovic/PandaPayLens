/**
 * Checkout.com code and status knowledge, kept as data.
 *
 * response_code values: https://www.checkout.com/docs/developer-resources/codes/api-response-codes
 * error_codes:          https://www.checkout.com/docs/developer-resources/codes/error-codes
 * Recommendation codes: https://www.checkout.com/docs/developer-resources/codes/recommendation-codes
 * Event types:          https://www.checkout.com/docs/developer-resources/event-notifications/event-types
 *
 * Checkout.com documents the range classification (10xxx approved, 20xxx soft
 * decline, 30xxx hard decline, 4xxxx risk response, 50xxx payout/refund
 * decline), Smart Dunning and downtime-retry eligibility, and recommendation
 * codes. The category and retry values per code are PandaPayLens suggestions
 * derived from the documented text.
 *
 * Precedence for retry guidance: recommendation code / Mastercard merchant
 * advice code > response_code entry > range classification.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const RESPONSE_CODES_URL =
  "https://www.checkout.com/docs/developer-resources/codes/api-response-codes";
export const ERROR_CODES_URL =
  "https://www.checkout.com/docs/developer-resources/codes/error-codes";
export const RECOMMENDATION_CODES_URL =
  "https://www.checkout.com/docs/developer-resources/codes/recommendation-codes";
export const PAYMENTS_API_URL =
  "https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-using-the-payments-api";
export const PAYMENT_DETAILS_URL =
  "https://www.checkout.com/docs/payments/manage-payments/get-payment-details";
export const REFUND_URL = "https://www.checkout.com/docs/payments/manage-payments/refund-a-payment";
export const RETRY_URL = "https://www.checkout.com/docs/payments/manage-payments/retry-a-payment";
export const SMART_DUNNING_URL =
  "https://www.checkout.com/docs/payments/manage-payments/retry-a-payment/smart-dunning-retries";
export const DOWNTIME_RETRY_URL =
  "https://www.checkout.com/docs/payments/manage-payments/retry-a-payment/automatic-downtime-retries";
export const SCA_RETRY_URL =
  "https://www.checkout.com/docs/payments/authenticate-payments/manage-sca-retries";
export const IDEMPOTENCY_URL = "https://www.checkout.com/docs/developer-resources/api/idempotency";
export const API_ENDPOINTS_URL =
  "https://www.checkout.com/docs/developer-resources/api/api-endpoints";
export const WEBHOOKS_URL =
  "https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks";
export const RESEND_WEBHOOKS_URL =
  "https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks/resend-webhooks";
export const EVENT_TYPES_URL =
  "https://www.checkout.com/docs/developer-resources/event-notifications/event-types";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

/** Checkout.com's own classification of a response_code, by range. */
export type DeclineClass = "soft_decline" | "hard_decline" | "risk" | "payout_refund_decline";

export type ResponseCodeEntry = {
  /** Response text as documented (several texts are joined with " / "). */
  text: string;
  class: DeclineClass;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Short form of the documented "Additional information". */
  note?: string;
  /** Listed by Checkout.com as eligible for Smart Dunning retries (MIT). */
  smartDunning?: true;
  /** Listed by Checkout.com as eligible for automatic downtime retries (MIT). */
  downtimeRetry?: true;
};

export type ErrorCodeEntry = {
  description: string;
  /** Endpoint table the code is documented in. */
  endpoint: "payments" | "accounts" | "tokens" | "instruments";
  category: ErrorCategory;
  retry: RetryGuidance;
};

export const CLASS_TEXT: Record<DeclineClass, string> = {
  soft_decline:
    "Checkout.com classifies this code as a soft decline: the payment was declined, though subsequent attempts may succeed.",
  hard_decline:
    "Checkout.com classifies this code as a hard decline: most hard declines require the issuer or cardholder to fix outstanding issues before you can retry.",
  risk: "Checkout.com classifies this code as a risk response: the result depends on the Fraud Detection risk strategy (41xxx client-level, 42xxx entity-level, 43xxx Checkout.com-level).",
  payout_refund_decline:
    "Checkout.com classifies this code as a payout or refund decline: Checkout.com declined the payout or refund.",
};

/** Fallback for codes that are not in the catalog, by documented range. */
export const RANGE_FALLBACK: Record<
  DeclineClass,
  { category: ErrorCategory; retry: RetryGuidance }
> = {
  soft_decline: { category: "card_declined", retry: "retry_conditionally" },
  hard_decline: { category: "card_declined", retry: "do_not_retry" },
  risk: { category: "fraud_or_risk", retry: "manual_review" },
  payout_refund_decline: { category: "unknown", retry: "manual_review" },
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer, correct their details, or use another card).",
  retry_conditionally:
    "A later attempt may succeed. Verify the current payment status first (GET /payments/{id}) so that a new request does not duplicate an operation that took effect, and reuse the same Cko-Idempotency-Key when repeating the same request.",
  safe_to_retry_technical_request:
    "The request can be repeated as a technical retry with backoff, using the same Cko-Idempotency-Key.",
  manual_review: "Review the payment manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the customer to use another card or contact their card issuer.",
  authentication_required: "Send the payment again with 3D Secure authentication.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another card.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds:
    "Ask the customer to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the payment and the risk outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable: "Check the current payment status before sending a new request.",
  network_or_timeout:
    "Check the current payment status with GET /payments/{id} before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the account, processing channel and API configuration, or request support from Checkout.com.",
  unknown: "Request support from Checkout.com with the payment id if the cause is unclear.",
};

/** `processing.recommendation_code` values. */
export const RECOMMENDATION_CODES: Record<string, { retry: RetryGuidance; meaning: string }> = {
  "01": {
    retry: "customer_action_required",
    meaning: "Updated or additional information is required.",
  },
  "02": { retry: "retry_conditionally", meaning: "Try again later." },
  "03": { retry: "do_not_retry", meaning: "Do not try again." },
};

/** Documented Mastercard merchant advice codes (processing.partner_merchant_advice_code). */
export const MERCHANT_ADVICE_CODES = new Set([
  "01",
  "02",
  "03",
  "04",
  "21",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "40",
  "41",
  "42",
]);
/** Advice codes documented as "retry after" a waiting period (1 hour up to 10 days). */
export const MERCHANT_ADVICE_RETRY_LATER = new Set(["24", "25", "26", "27", "28", "29", "30"]);

/**
 * Field validation suffixes (`<OBJECT_NAME>_<VALIDATION_ERROR_TYPE>`), longest
 * first so that `invalid_format` wins over `invalid`.
 */
export const VALIDATION_SUFFIXES: readonly { suffix: string; meaning: string }[] = [
  { suffix: "_invalid_option", meaning: "The field is not a valid option." },
  { suffix: "_invalid_format", meaning: "The value is not in the correct format." },
  { suffix: "_too_short", meaning: "The value has too few characters." },
  { suffix: "_too_long", meaning: "The value has too many characters." },
  { suffix: "_required", meaning: "The field is required but no value was provided." },
  { suffix: "_invalid", meaning: "The field or value is invalid for other reasons." },
];

/** Templated error codes documented for the payments endpoint. */
export const TEMPLATED_ERROR_CODES: readonly { pattern: RegExp; entry: ErrorCodeEntry }[] = [
  {
    pattern: /^[a-z]{3}_currency_not_configured$/,
    entry: {
      description: "The specified currency is not configured.",
      endpoint: "payments",
      category: "configuration",
      retry: "do_not_retry",
    },
  },
  {
    pattern: /^[a-z0-9]{2,32}_scheme_not_configured$/,
    entry: {
      description: "The specified scheme is not configured.",
      endpoint: "payments",
      category: "configuration",
      retry: "do_not_retry",
    },
  },
];

/** `error_type` values seen in the payments documentation. Used when no error code is known. */
export const ERROR_TYPES: Record<string, CatalogEntry> = {
  request_invalid: {
    category: "invalid_request",
    explanation: "Checkout.com rejected the request as invalid.",
    nextAction: NEXT_ACTION.invalid_request,
    retry: "do_not_retry",
    retryExplanation: RETRY_TEXT.do_not_retry,
  },
  request_malformed: {
    category: "invalid_request",
    explanation: "Checkout.com could not read the request.",
    nextAction: NEXT_ACTION.invalid_request,
    retry: "do_not_retry",
    retryExplanation: RETRY_TEXT.do_not_retry,
  },
  processing_error: {
    category: "unknown",
    explanation: "Checkout.com reported a processing error for the request.",
    nextAction: "Check the current payment status before deciding on a new request.",
    retry: "retry_conditionally",
    retryExplanation: RETRY_TEXT.retry_conditionally,
  },
  base_url_invalid: {
    category: "configuration",
    explanation:
      "The request was not sent to the merchant-specific base URL (https://{prefix}.api.checkout.com).",
    nextAction: "Use the account's {prefix} base URL for API requests.",
    retry: "do_not_retry",
    retryExplanation: "The same request to the same URL will be rejected again.",
  },
};

const statusEntry = (
  category: ErrorCategory,
  explanation: string,
  retry: RetryGuidance,
): CatalogEntry => ({
  category,
  explanation,
  nextAction: NEXT_ACTION[category],
  retry,
  retryExplanation: RETRY_TEXT[retry],
});

/** Documented HTTP statuses. Used only when neither the error code nor error_type is known. */
export const HTTP_STATUS: Record<number, CatalogEntry> = {
  400: statusEntry("invalid_request", "HTTP 400: the request was rejected.", "do_not_retry"),
  401: {
    ...statusEntry(
      "configuration",
      "HTTP 401 Unauthorized: the API request was not authenticated.",
      "do_not_retry",
    ),
    nextAction: "Check the API key or access token sent in the Authorization header.",
  },
  403: statusEntry(
    "configuration",
    "HTTP 403: the operation is not allowed (for example capture, refund or void not allowed, or the base URL is invalid).",
    "do_not_retry",
  ),
  404: statusEntry("invalid_request", "HTTP 404: the payment was not found.", "do_not_retry"),
  409: statusEntry(
    "duplicate_request",
    "HTTP 409: conflict with another request being processed with the same idempotency key.",
    "retry_conditionally",
  ),
  422: statusEntry("invalid_request", "HTTP 422: invalid data was sent.", "do_not_retry"),
  429: statusEntry(
    "rate_limiting",
    "HTTP 429: too many requests or duplicate request detected.",
    "retry_conditionally",
  ),
  500: statusEntry("provider_unavailable", "HTTP 500: server error.", "retry_conditionally"),
  502: statusEntry("provider_unavailable", "HTTP 502: bad gateway.", "retry_conditionally"),
  503: statusEntry("provider_unavailable", "HTTP 503: service unavailable.", "retry_conditionally"),
  504: statusEntry("network_or_timeout", "HTTP 504: gateway timeout.", "retry_conditionally"),
};

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome };

/**
 * Payment `status` values (PaymentResponse, PaymentDetails and bank payout
 * details), matched exactly and case-sensitively. Captured is not settlement.
 */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  Pending: { stage: "payment", outcome: "pending" },
  Authorized: { stage: "authorization", outcome: "success" },
  "Card Verified": { stage: "authorization", outcome: "success" },
  Declined: { stage: "authorization", outcome: "failure" },
  "Retry Scheduled": { stage: "payment", outcome: "pending" },
  Voided: { stage: "void", outcome: "success" },
  "Partially Captured": { stage: "capture", outcome: "success" },
  Captured: { stage: "capture", outcome: "success" },
  "Partially Refunded": { stage: "refund", outcome: "success" },
  Refunded: { stage: "refund", outcome: "success" },
  Canceled: { stage: "cancellation", outcome: "failure" },
  Expired: { stage: "cancellation", outcome: "failure" },
  Paid: { stage: "payment", outcome: "success" },
  Returned: { stage: "reversal", outcome: "failure" },
};

export type EventTypeInfo = StatusInfo & { description: string };

/**
 * Gateway webhook event types with known semantics. Webhooks carry no payment
 * status; the type is the transition.
 */
export const EVENT_TYPES: Record<string, EventTypeInfo> = {
  payment_approved: {
    stage: "authorization",
    outcome: "success",
    description: "An authorization (or payout) was approved. This is not a capture.",
  },
  payment_declined: {
    stage: "authorization",
    outcome: "failure",
    description: "An authorization timed out or was rejected.",
  },
  payment_authorization_incremented: {
    stage: "authorization",
    outcome: "success",
    description: "An authorization was incremented.",
  },
  payment_authorization_increment_declined: {
    stage: "authorization",
    outcome: "failure",
    description: "An authorization increment was declined.",
  },
  card_verified: {
    stage: "authorization",
    outcome: "success",
    description: "A card verification succeeded.",
  },
  card_verification_declined: {
    stage: "authorization",
    outcome: "failure",
    description: "A card verification was declined.",
  },
  payment_pending: {
    stage: "payment",
    outcome: "pending",
    description: "An asynchronous payment was initiated.",
  },
  payment_retry_scheduled: {
    stage: "payment",
    outcome: "pending",
    description: "A retry attempt failed and a new attempt is scheduled.",
  },
  payment_compliance_review: {
    stage: "other",
    outcome: "pending",
    description: "The payment is under compliance review.",
  },
  payment_paid: {
    stage: "payment",
    outcome: "success",
    description: "A bank payout was completed.",
  },
  payment_captured: {
    stage: "capture",
    outcome: "success",
    description: "A capture succeeded. This is not settlement.",
  },
  payment_capture_pending: {
    stage: "capture",
    outcome: "pending",
    description: "The customer approved the payment on their banking page; the capture is pending.",
  },
  payment_capture_declined: {
    stage: "capture",
    outcome: "failure",
    description: "A capture was declined.",
  },
  payment_refunded: {
    stage: "refund",
    outcome: "success",
    description: "A refund succeeded.",
  },
  payment_refund_pending: {
    stage: "refund",
    outcome: "pending",
    description: "A refund was initiated. It is not complete yet.",
  },
  payment_refund_declined: {
    stage: "refund",
    outcome: "failure",
    description: "A refund was declined.",
  },
  payment_voided: { stage: "void", outcome: "success", description: "A void succeeded." },
  payment_void_declined: {
    stage: "void",
    outcome: "failure",
    description: "The scheme rejected a void.",
  },
  payment_canceled: {
    stage: "cancellation",
    outcome: "failure",
    description: "An APM flow was canceled by the customer on the provider's platform.",
  },
  payment_expired: {
    stage: "cancellation",
    outcome: "failure",
    description: "An APM payment expired (not a 3DS expiry).",
  },
  payment_returned: {
    stage: "reversal",
    outcome: "failure",
    description: "A Pay to Bank or APM payment was returned after success.",
  },
  payment_optimized: {
    stage: "other",
    outcome: "unknown",
    description:
      "Intelligent Acceptance optimized the payment, or the payment was in the control group.",
  },
};

/** Approved `response_code` values (10xxx). Not errors. */
export const APPROVED_CODES: Record<string, string> = {
  "10000": "Approved",
  "10008": "Approved - Honor with ID (Debit Cards)",
  "10010": "Partial Value Approved",
  "10011": "Approved - VIP (not used)",
  "10076": "Approved (Country Club)",
  "10077": "Approved (Local Banks)",
  "10081": "Approved (Approved Commercial)",
  "10100": "Flagged as a potentially risky transaction",
  "10200": "Deferred capture",
};

/** Declined `response_code` values (20xxx, 30xxx, 4xxxx, 50xxx), keyed by code. */
export const RESPONSE_CODES: Record<string, ResponseCodeEntry> = {
  "20001": {
    text: "Refer to card issuer / Contact card issuer",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20002": {
    text: "Refer to card issuer - Special conditions",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20003": {
    text: "Invalid merchant or service provider",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20004": {
    text: "Card should be captured",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
  "20005": {
    text: "Declined - Do not honour",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
    smartDunning: true,
  },
  "20006": {
    text: "Error / Invalid request parameters",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20009": {
    text: "Request in progress",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20012": {
    text: "Invalid transaction",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20013": {
    text: "Invalid value/amount",
    class: "soft_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
    smartDunning: true,
  },
  "20014": {
    text: "Invalid account number (no such number)",
    class: "soft_decline",
    category: "invalid_request",
    retry: "customer_action_required",
    note: "The payment failed. Check the card details and try again with the same or another card.",
    smartDunning: true,
  },
  "20015": {
    text: "Transaction cannot be processed through debit network",
    class: "soft_decline",
    category: "configuration",
    retry: "retry_conditionally",
    note: "Route your transaction to the card's signature network.",
    smartDunning: true,
  },
  "20016": {
    text: "Card not initialised",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
    smartDunning: true,
  },
  "20017": {
    text: "Customer cancellation",
    class: "soft_decline",
    category: "card_declined",
    retry: "do_not_retry",
  },
  "20018": {
    text: "Customer dispute",
    class: "soft_decline",
    category: "card_declined",
    retry: "do_not_retry",
  },
  "20019": {
    text: "Re-enter transaction / Transaction has expired",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20020": {
    text: "Invalid response",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    smartDunning: true,
  },
  "20021": {
    text: "No action taken (unable to back out prior transaction)",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20022": {
    text: "Suspected malfunction",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    smartDunning: true,
  },
  "20023": {
    text: "Unacceptable transaction fee",
    class: "soft_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "20024": {
    text: "File update not supported by the receiver",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20025": {
    text: "Unable to locate record on file / Account number is missing from the inquiry",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20026": {
    text: "Duplicate file update record",
    class: "soft_decline",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  "20027": {
    text: "File update field edit error",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20028": {
    text: "File is temporarily unavailable",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20029": {
    text: "File update not successful",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20030": {
    text: "Format error",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. Either try again with the same card, or use a different card.",
    smartDunning: true,
  },
  "20031": {
    text: "Bank not supported by Switch",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "20032": {
    text: "Completed partially",
    class: "soft_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "20033": {
    text: "Previous scheme transaction ID invalid",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20038": {
    text: "Allowable PIN tries exceeded",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
  },
  "20039": {
    text: "No credit account",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20040": {
    text: "Requested function not supported",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "20042": {
    text: "No universal value/amount",
    class: "soft_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "20044": {
    text: "No investment account",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20045": {
    text: "The Issuer does not support fallback transactions of hybrid-card",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20046": {
    text: "Bank decline",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20051": {
    text: "Insufficient funds",
    class: "soft_decline",
    category: "insufficient_funds",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
    smartDunning: true,
  },
  "20052": {
    text: "No current (checking) account",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20053": {
    text: "No savings account",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20054": {
    text: "Expired card",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20055": {
    text: "Incorrect PIN / PIN validation not possible",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
  },
  "20056": {
    text: "No card record",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20057": {
    text: "Transaction not permitted to cardholder / Domestic debit transaction not allowed (Regional use only)",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
    smartDunning: true,
  },
  "20058": {
    text: "Transaction not permitted to terminal",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "20059": {
    text: "Suspected fraud",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20060": {
    text: "Card acceptor contact acquirer",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "20061": {
    text: "Activity amount limit exceeded",
    class: "soft_decline",
    category: "card_declined",
    retry: "retry_conditionally",
    note: "The defined amount was exceeded for the account or card. For recommended actions, see Recommendation codes.",
    smartDunning: true,
  },
  "20062": {
    text: "Restricted card",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20063": {
    text: "Security violation",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
  "20064": {
    text: "Original value incorrect",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20065": {
    text: "Exceeds Withdrawal Frequency Limit",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
    smartDunning: true,
  },
  "20066": {
    text: "Card acceptor call acquirer security",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
  "20067": {
    text: "Hard capture - Pick up card at ATM",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
  "20068": {
    text: "Response received too late / Timeout / Internal error",
    class: "soft_decline",
    category: "network_or_timeout",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
    smartDunning: true,
    downtimeRetry: true,
  },
  "20070": {
    text: "PIN required",
    class: "soft_decline",
    category: "authentication_required",
    retry: "customer_action_required",
  },
  "20072": {
    text: "Account not yet activated",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
  },
  "20075": {
    text: "Allowable PIN-entry tries exceeded",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20078": {
    text: "Blocked at first use - transaction from new or replacement card that is not properly unblocked",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
    smartDunning: true,
  },
  "20081": {
    text: "Card is local use only",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
  },
  "20082": {
    text: "No security model / PIN cryptographic error found (error found by VIC security module during PIN decryption) / Negative CAM, dCVV, iCVV, or CVV results",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
  },
  "20083": {
    text: "No accounts",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20084": { text: "No PBF", class: "soft_decline", category: "unknown", retry: "manual_review" },
  "20085": {
    text: "PBF update error",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20086": {
    text: "ATM malfunction / Invalid authorization type",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20087": {
    text: "Bad track data (invalid CVV and/or expiry date)",
    class: "soft_decline",
    category: "invalid_request",
    retry: "customer_action_required",
    note: "The payment failed. Check the card details and try again with the same or another card.",
  },
  "20088": {
    text: "Unable to dispense/process",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20089": {
    text: "Administration error",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20090": {
    text: "Cut-off in progress",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20091": {
    text: "Issuer unavailable or switch is inoperative",
    class: "soft_decline",
    category: "network_or_timeout",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
    downtimeRetry: true,
  },
  "20092": {
    text: "Destination cannot be found for routing",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "20093": {
    text: "Transaction cannot be completed; violation of law",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "20094": {
    text: "Duplicate transmission / invoice",
    class: "soft_decline",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  "20095": {
    text: "Reconcile error",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20096": {
    text: "System malfunction",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
    smartDunning: true,
    downtimeRetry: true,
  },
  "20097": {
    text: "Reconciliation totals reset",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20098": {
    text: "MAC error",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    smartDunning: true,
  },
  "20099": {
    text: "Other / Unidentified responses",
    class: "soft_decline",
    category: "unknown",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20100": {
    text: "Invalid expiry date format",
    class: "soft_decline",
    category: "invalid_request",
    retry: "customer_action_required",
    note: "The payment failed due to invalid expiry date. Try again, providing the correct value.",
  },
  "20101": {
    text: "No Account / No Customer (Token is incorrect or invalid)",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20102": {
    text: "Invalid merchant / wallet ID",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20103": {
    text: "Card type / payment method not supported",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try again with a different card or contact your bank for further support.",
  },
  "20104": {
    text: "Gateway reject - Invalid transaction",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
    smartDunning: true,
  },
  "20105": {
    text: "Gateway reject - Violation",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
    smartDunning: true,
  },
  "20106": {
    text: "Unsupported currency",
    class: "soft_decline",
    category: "configuration",
    retry: "do_not_retry",
  },
  "20107": {
    text: "Billing address is missing",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20108": {
    text: "Declined - Updated cardholder available",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "20109": {
    text: "Transaction already reversed (voided) / Previous message located for a repeat or reversal, but repeat or reversal data is inconsistent with the original message / Capture is larger than initial authorized value",
    class: "soft_decline",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  "20110": {
    text: "Authorization completed",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20111": {
    text: "Transaction already reversed",
    class: "soft_decline",
    category: "duplicate_request",
    retry: "do_not_retry",
    note: "The payment reversal has already been processed.",
  },
  "20112": {
    text: "Merchant not Mastercard SecureCode enabled",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
    note: "The payment failed due to a technical issue. Request support and provide the payment reference number.",
  },
  "20113": {
    text: "Invalid property",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20114": {
    text: "Token is incorrect",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20115": {
    text: "Missing / Invalid lifetime",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20116": {
    text: "Invalid encoding",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20117": {
    text: "Invalid API version",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20118": {
    text: "Transaction pending",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20119": {
    text: "Invalid batch data and/or batch data is missing",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20120": {
    text: "Invalid customer/user",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20121": {
    text: "Transaction limit for merchant/terminal exceeded",
    class: "soft_decline",
    category: "card_declined",
    retry: "retry_conditionally",
  },
  "20122": {
    text: "Mastercard installments not supported",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
  },
  "20123": {
    text: "Missing basic data: zip, addr, member",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "20124": {
    text: "Missing CVV value, required for ecommerce transaction",
    class: "soft_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "20150": {
    text: "Card not 3D Secure (3DS) enabled",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
  },
  "20151": {
    text: "Cardholder failed 3DS authentication",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
  },
  "20152": {
    text: "Initial 3DS transaction not completed within 15 minutes",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "customer_action_required",
    note: "The payment expired due to inactivity. Try again with the same card, or use a different card.",
  },
  "20153": {
    text: "3DS system malfunction",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue. Try again with the same card, or use a different card.",
  },
  "20154": {
    text: "3DS authentication required",
    class: "soft_decline",
    category: "authentication_required",
    retry: "customer_action_required",
    note: "The payment was declined due to 3D Secure authentication (3DS). Try again with the same card, or use a different card.",
  },
  "20155": {
    text: "3DS authentication service provided invalid authentication result",
    class: "soft_decline",
    category: "authentication_failed",
    retry: "retry_conditionally",
  },
  "20156": {
    text: "Requested function not supported by the acquirer",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "20157": {
    text: "Invalid merchant configurations - Contact Support",
    class: "soft_decline",
    category: "configuration",
    retry: "manual_review",
    note: "Request support.",
  },
  "20158": {
    text: "Refund validity period has expired",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20159": {
    text: "ACS Malfunction",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The payment failed due to a technical issue with the ACS used to perform 3DS authentication. If the issue persists, request support.",
  },
  "20179": {
    text: "Lifecycle",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "The transaction uses invalid card data. For recommended actions, see Recommendation codes.",
  },
  "20182": {
    text: "Policy",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "The transaction does not comply with card policies. For recommended actions, see Recommendation codes.",
  },
  "20183": {
    text: "Security",
    class: "soft_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction is suspected to be fraudulent. For recommended actions, see Recommendation codes.",
  },
  "20193": {
    text: "Invalid country code",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "20197": {
    text: "The ATM/POS terminal number has not been registered",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "20199": {
    text: "Mandate approval pending",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "30004": {
    text: "Pick up card (No fraud)",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30007": {
    text: "Pick up card - Special conditions",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30015": {
    text: "No such issuer",
    class: "hard_decline",
    category: "invalid_request",
    retry: "customer_action_required",
    note: "The payment was declined due to incorrect details. Try again with updated details.",
  },
  "30016": {
    text: "Issuer does not allow online gambling payout",
    class: "hard_decline",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30017": {
    text: "Issuer does not allow original credit transaction",
    class: "hard_decline",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30018": {
    text: "Issuer does not allow money transfer payout",
    class: "hard_decline",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30019": {
    text: "Issuer does not allow non-money transfer payout",
    class: "hard_decline",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30020": {
    text: "Invalid amount",
    class: "hard_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
    note: "The payment failed due to a technical issue. If the issue persists, request support.",
  },
  "30021": {
    text: "Total amount limit reached",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30022": {
    text: "Total transaction count limit reached",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30033": {
    text: "Expired card - Pick up",
    class: "hard_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30034": {
    text: "Suspected fraud - Pick up",
    class: "hard_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Contact your bank for further support.",
  },
  "30035": {
    text: "Contact acquirer - Pick up",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30036": {
    text: "Restricted card - Pick up",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30037": {
    text: "Call acquirer security - Pick up",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30038": {
    text: "Allowable PIN tries exceeded - Pick up",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30041": {
    text: "Lost card - Pick up",
    class: "hard_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Try a different card or contact your bank for further support.",
  },
  "30043": {
    text: "Stolen card - Pick up",
    class: "hard_decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The cardholder's bank declined the payment because the card has been reported stolen. - For a one-off transaction, do not retry the transaction.",
  },
  "30044": {
    text: "Transaction rejected - AMLD5",
    class: "hard_decline",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
    note: "The transaction was initiated from an anonymous, non-reloadable prepaid card and for an amount greater than 50 EUR. Due to the AMLD5 directive, the transaction cannot be fulfilled.",
  },
  "30045": {
    text: "Invalid payout fund transfer type",
    class: "hard_decline",
    category: "configuration",
    retry: "do_not_retry",
    note: "The fund transfer type is not allowed in your configuration.",
  },
  "30046": {
    text: "Closed account",
    class: "hard_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "Your bank declined the payment. Contact your bank for further support.",
  },
  "30401": {
    text: "Capture amount greater than allowed",
    class: "hard_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
    note: "The payment failed because the capture amount exceeds the overcapture limit.",
  },
  "30402": {
    text: "Overcapture not allowed for partial capture",
    class: "hard_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
    note: "Overcapture is not allowed when partial capture is requested.",
  },
  "30403": {
    text: "Overcapture not allowed for partial authorization",
    class: "hard_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
    note: "Overcapture is not allowed when partial authorization is requested.",
  },
  "30404": {
    text: "Sub-merchant ID missing",
    class: "hard_decline",
    category: "configuration",
    retry: "do_not_retry",
    note: "The payment failed because the sub-merchant ID field is required in the request.",
  },
  "30405": {
    text: "Invalid order description format",
    class: "hard_decline",
    category: "configuration",
    retry: "do_not_retry",
    note: "The payment failed because the billing descriptor name contained special characters that are not supported by the acquirer's formatting requirements.",
  },
  "41101": {
    text: "Risk Blocked Transaction",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined due to a client-level risk rule.",
  },
  "41201": {
    text: "Decline list - Card number",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined due to a client-level decline list.",
  },
  "41202": {
    text: "Decline list - BIN",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated BIN is on a client-level decline list.",
  },
  "41203": {
    text: "Decline list - Email address",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email address is on a client-level decline list.",
  },
  "41204": {
    text: "Decline list - Phone",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated phone number is on a client-level decline list.",
  },
  "41205": {
    text: "Decline list - Payment IP",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated payment IP is on a client-level decline list.",
  },
  "41206": {
    text: "Decline list - Email domain",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email domain is on a client-level decline list.",
  },
  "41301": {
    text: "Fraud score exceeds threshold",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined because it has a high risk score.",
  },
  "42101": {
    text: "Risk Blocked Transaction",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined due to an entity-level risk rule.",
  },
  "42201": {
    text: "Decline list - Card number",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined due to an entity-level decline list.",
  },
  "42202": {
    text: "Decline list - BIN",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated BIN is on an entity-level decline list.",
  },
  "42203": {
    text: "Decline list - Email address",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email address is on an entity-level decline list.",
  },
  "42204": {
    text: "Decline list - Phone",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated phone number is on an entity-level decline list.",
  },
  "42205": {
    text: "Decline list - Payment IP",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated payment IP is on an entity-level decline list.",
  },
  "42206": {
    text: "Decline list - Email domain",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email domain is on a client-level decline list.",
  },
  "42301": {
    text: "Fraud score exceeds threshold",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined because it has a high risk score.",
  },
  "43101": {
    text: "Potential fraud risk",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined because it has a high risk score.",
  },
  "43102": {
    text: "Risk blocked transaction - {Rule group name}",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined by a Checkout.com decline rule or by a fraud-specific model. The rule group name gives the available information about the type of risk identified.",
  },
  "43201": {
    text: "Decline list - Card number",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated card number is on Checkout.com's decline list.",
  },
  "43202": {
    text: "Decline list - BIN",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated BIN is on Checkout.com's decline list.",
  },
  "43203": {
    text: "Decline list - Email address",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email address on Checkout.com's decline list.",
  },
  "43204": {
    text: "Decline list - Phone",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated phone number is on Checkout.com's decline list.",
  },
  "43205": {
    text: "Decline list - Payment IP",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated payment IP is on Checkout.com's decline list.",
  },
  "43206": {
    text: "Decline list - Email domain",
    class: "risk",
    category: "fraud_or_risk",
    retry: "do_not_retry",
    note: "The transaction was declined because the associated email domain is on Checkout.com's decline list.",
  },
  "43301": {
    text: "Fraud score exceeds threshold",
    class: "risk",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "The transaction was declined by Autopilot.",
  },
  "43401": {
    text: "3DS authentication required",
    class: "risk",
    category: "authentication_required",
    retry: "customer_action_required",
    note: "The transaction was declined because additional authentication is required to process it. Retry the transaction with 3D Secure.",
  },
  "50001": {
    text: "Compliance error",
    class: "payout_refund_decline",
    category: "fraud_or_risk",
    retry: "manual_review",
  },
  "50002": {
    text: "Sanction screening failure",
    class: "payout_refund_decline",
    category: "fraud_or_risk",
    retry: "manual_review",
    note: "There was a sanctions screening hit or data corruption.",
  },
  "50003": {
    text: "Balance reservation insufficient funds",
    class: "payout_refund_decline",
    category: "insufficient_funds",
    retry: "manual_review",
    note: "The sub-account has insufficient funds. For refunds, card payouts, and issuing, the balance check is based on the combined sum of available, pending, and operational balances.",
  },
  "50004": {
    text: "Manual rejection",
    class: "payout_refund_decline",
    category: "fraud_or_risk",
    retry: "manual_review",
  },
  "50005": {
    text: "Barred Beneficiary Error",
    class: "payout_refund_decline",
    category: "fraud_or_risk",
    retry: "manual_review",
  },
  "50020": {
    text: "Recipient error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50021": {
    text: "Invalid recipient error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50022": {
    text: "Unsupported recipient error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50023": {
    text: "Recipient limit error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50025": {
    text: "Invalid Recipient Account Error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50026": {
    text: "Recipient Account Not Found",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50027": {
    text: "Recipient Bank Error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50030": {
    text: "Invalid Recipient Details Error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50070": {
    text: "Sender error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50100": {
    text: "Instruction error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50101": {
    text: "Instruction amount limit error",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50102": {
    text: "Instruction amount limit sender error",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50103": {
    text: "Instruction amount limit recipient error",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50104": {
    text: "Velocity limit",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50105": {
    text: "Velocity limit sender error",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50106": {
    text: "Velocity limit recipient limit error",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50150": {
    text: "Processing error",
    class: "payout_refund_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "50180": {
    text: "Validation error",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50200": {
    text: "Configuration error",
    class: "payout_refund_decline",
    category: "configuration",
    retry: "manual_review",
  },
  "50240": {
    text: "Cancellation error",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "50260": {
    text: "Returned error",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "50280": {
    text: "Insufficient funds",
    class: "payout_refund_decline",
    category: "insufficient_funds",
    retry: "manual_review",
  },
  "50399": {
    text: "Unmapped response",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "50401": {
    text: "Bank details invalid",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50402": {
    text: "Account not found",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50403": {
    text: "Account inactive",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50404": {
    text: "Account dormant",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50405": {
    text: "Account number invalid",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50406": {
    text: "Branch not found",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50407": {
    text: "Branch code invalid",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50408": {
    text: "Branch code required",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50409": {
    text: "Bank code invalid",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50410": {
    text: "Bank code required",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50441": {
    text: "Account type required",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50451": {
    text: "Account holder details invalid",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50452": {
    text: "Account holder identification number required",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50453": {
    text: "Account holder type not supported",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50454": {
    text: "Account holder type not allowed",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50466": {
    text: "Account closed",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50471": {
    text: "Account blocked",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50481": {
    text: "Invalid debtor account type",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50490": {
    text: "Duplicate Payment",
    class: "payout_refund_decline",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  "50491": {
    text: "Account holder billing address details incorrect",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50492": {
    text: "Account holder billing address details required",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50494": {
    text: "Account holder billing address can not be PO box",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  "50499": {
    text: "Payout Returned",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "50501": {
    text: "Unsupported characters",
    class: "payout_refund_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "50511": {
    text: "Invalid amount",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50512": {
    text: "Minimum amount not met",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50513": {
    text: "Exceeded transaction value",
    class: "payout_refund_decline",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  "50514": {
    text: "Exceeded daily limit",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50515": {
    text: "Exceeded weekly limit",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50517": {
    text: "Exceeded monthly limit",
    class: "payout_refund_decline",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  "50531": {
    text: "Recalled",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "50599": {
    text: "Unknown reason",
    class: "payout_refund_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "2005C": {
    text: "Transaction not supported / blocked by issuer",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "2006P": {
    text: "Cardholder ID verification failed",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
    note: "The cardholder could not be identified from their ID documentation as part of Know Your Customer (KYC) checks. The cardholder must contact their issuer to resolve this.",
  },
  "2009G": {
    text: "Blocked by cardholder / contact cardholder",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "200A4": {
    text: "Transaction with defect, contact issuer",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "The requests were not received.",
  },
  "200A5": {
    text: "Transaction with defect, contact issuer",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
    note: "The original transactions are rejected.",
  },
  "200A6": {
    text: "Transaction with defect, contact issuer",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    note: "UnionPay forwarded the original request, but did not receive a response from the issuer.",
  },
  "200E0": {
    text: "Unauthorised access",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "200E2": {
    text: "Signature verification failure",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "200E3": {
    text: "System busy. Try again later.",
    class: "soft_decline",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "200N0": {
    text: "Force STIP",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "200N7": {
    text: "Decline for CVV2 failure",
    class: "soft_decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "200P1": {
    text: "Over daily limit",
    class: "soft_decline",
    category: "card_declined",
    retry: "retry_conditionally",
    smartDunning: true,
  },
  "200P9": {
    text: "Limit exceeded. Enter a lesser value.",
    class: "soft_decline",
    category: "card_declined",
    retry: "retry_conditionally",
  },
  "200R1": {
    text: "Issuer initiated a stop payment (revocation order) for this authorization",
    class: "soft_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "The cardholder canceled the subscription.",
  },
  "200R3": {
    text: "Issuer initiated a stop payment (revocation order) for all authorizations",
    class: "soft_decline",
    category: "card_declined",
    retry: "do_not_retry",
    note: "The cardholder canceled all subscriptions.",
  },
  "200S4": {
    text: "PTLF full",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
  "200T2": {
    text: "Invalid transaction date",
    class: "soft_decline",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "200T3": {
    text: "Card not supported",
    class: "soft_decline",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
  },
  "200T5": {
    text: "CAF status = 0 or 9",
    class: "soft_decline",
    category: "unknown",
    retry: "manual_review",
  },
};

/** API `error_codes` values, keyed by code. */
export const ERROR_CODES: Record<string, ErrorCodeEntry> = {
  "3ds_malfunction": {
    description: "3DS has malfunctioned.",
    endpoint: "payments",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "3ds_not_configured": {
    description: "3DS is not configured.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  "3ds_not_enabled_for_card": {
    description: "3DS is not enabled for card.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  "3ds_not_supported": {
    description: "3DS is not supported.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  "3ds_payment_required": {
    description: "3DS payment required.",
    endpoint: "payments",
    category: "authentication_required",
    retry: "customer_action_required",
  },
  "3ds_version_invalid": {
    description: "The 3DS version is invalid.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  "3ds_version_not_supported": {
    description: "The 3DS version is not supported.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  action_failure_limit_exceeded: {
    description: "The quota of failed payment actions has been exceeded.",
    endpoint: "payments",
    category: "rate_limiting",
    retry: "manual_review",
  },
  address_invalid: {
    description: "The shipping address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  aft_processor_not_matched: {
    description: "Account funding transactions (AFTs) are not configured.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  amount_exceeds_balance: {
    description: "The payment amount exceeds the balance.",
    endpoint: "payments",
    category: "insufficient_funds",
    retry: "manual_review",
  },
  amount_invalid: {
    description: "The payment amount is invalid.",
    endpoint: "payments",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  amount_limit_exceeded: {
    description:
      "The transaction to this card exceeded the amount limit set by the scheme's velocity limit.",
    endpoint: "payments",
    category: "card_declined",
    retry: "retry_conditionally",
  },
  api_calls_quota_exceeded: {
    description: "The quota for API calls has been exceeded.",
    endpoint: "payments",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
  billing_descriptor_city_invalid: {
    description: "The city from which the charge originated is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  billing_descriptor_city_required: {
    description: "The city from which the charge originated is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  billing_descriptor_name_invalid: {
    description: "The dynamic description of the charge is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  billing_descriptor_name_required: {
    description: "A dynamic description of the charge is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  business_invalid: {
    description: "The business settings are invalid.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  business_settings_missing: {
    description: "The business settings are missing.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  capture_value_greater_than_authorized: {
    description: "The capture value is greater than the authorized value.",
    endpoint: "payments",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  capture_value_greater_than_remaining_authorized: {
    description: "The capture value is greater than the remaining authorized value.",
    endpoint: "payments",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  card_authorization_failed: {
    description: "The card authorization has failed.",
    endpoint: "payments",
    category: "card_declined",
    retry: "customer_action_required",
  },
  card_disabled: {
    description: "The card is disabled.",
    endpoint: "payments",
    category: "card_declined",
    retry: "customer_action_required",
  },
  card_expired: {
    description: "The card is expired.",
    endpoint: "payments",
    category: "card_declined",
    retry: "customer_action_required",
  },
  card_expiry_month_invalid: {
    description: "The two-digit expiry month is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_expiry_month_required: {
    description: "A two-digit expiry month is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_expiry_year_invalid: {
    description: "The four-digit expiry year is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_expiry_year_required: {
    description: "A four-digit expiry year is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_holder_invalid: {
    description: "The cardholder is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_not_eligible_domestic_money_transfer: {
    description:
      "The recipient cardholder's account is not eligible for domestic money transfer card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_eligible_cross_border_money_transfer: {
    description:
      "The recipient cardholder's account is not eligible for cross-border money transfer card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_eligible_domestic_non_money_transfer: {
    description:
      "The recipient cardholder's account is not eligible for domestic non-money transfer card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_eligible_cross_border_non_money_transfer: {
    description:
      "The recipient cardholder's account is not eligible for cross-border non-money transfer card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_eligible_domestic_online_gambling: {
    description:
      "The recipient cardholder's account is not eligible for domestic online gambling card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_eligible_cross_border_online_gambling: {
    description:
      "The recipient cardholder's account is not eligible for cross-border online gambling card payouts.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  card_not_found: {
    description: "The card was not found.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_number_invalid: {
    description: "The card number is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  card_number_required: {
    description: "The card number is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  channel_details_invalid: {
    description: "The channel details are invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  channel_url_missing: {
    description: "The channel URL is missing.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  charge_details_invalid: {
    description: "The charge details are invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  city_invalid: {
    description: "The city from which the charge originated is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_address_invalid: {
    description:
      "The first or second line of the payment source owner's billing address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_invalid: {
    description:
      "The two-letter ISO country code of the payment source owner's billing address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_phone_code_invalid: {
    description: "The international country calling code is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_phone_code_length_invalid: {
    description: "The international country calling code length is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  currency_invalid: {
    description: "The currency requested is not a valid ISO code.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  currency_required: {
    description: "The three-letter ISO currency code is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_already_exists: {
    description: "The customer details already exist.",
    endpoint: "payments",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  customer_email_invalid: {
    description: "The email address associated with the customer is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_id_invalid: {
    description: "The customer identifier is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_not_found: {
    description: "The customer's details cannot be found.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_number_invalid: {
    description: "The customer number is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_plan_edit_failed: {
    description: "Editing the customer plan has failed.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  customer_plan_id_invalid: {
    description: "The customer plan identifier is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  cvv_invalid: {
    description: "The CVV is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  destination_bank_not_found: {
    description: "Bank code not recognized.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  destination_bank_details_invalid: {
    description: "Invalid bank details provided.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  email_in_use: {
    description: "The email address is already in use.",
    endpoint: "payments",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  email_invalid: {
    description: "The email address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  email_required: {
    description: "The email address is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  endpoint_invalid: {
    description: "The endpoint is invalid.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  estimated_authorization_not_supported: {
    description: "Estimated authorization is not supported by the card issuer.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  expiry_date_format_invalid: {
    description: "The expiry date format is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  fail_url_invalid: {
    description: "The failure URL is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  first_name_required: {
    description: "The account holder's first name is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  last_name_required: {
    description: "The account holder's last name is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  ip_address_invalid: {
    description: "The IP address used to make the payment is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  issuer_network_unavailable: {
    description: "The issuer network is unavailable.",
    endpoint: "payments",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  metadata_key_invalid: {
    description: "The metadata key is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  no_authorization_enabled_processors_available: {
    description: "There are no authorization processors configured.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  parameter_invalid: {
    description: "The parameter is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  password_invalid: {
    description: "The password is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  payment_expired: {
    description: "The payment has expired.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  payment_invalid: {
    description: "The payment is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  payment_method_not_supported: {
    description: "The payment method is not supported.",
    endpoint: "payments",
    category: "payment_method_unavailable",
    retry: "do_not_retry",
  },
  payment_source_required: {
    description: "The payment source linked to a specific customer is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  payment_type_invalid: {
    description: "The payment type is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  phone_number_invalid: {
    description: "The phone number associated with the shipping address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  phone_number_length_invalid: {
    description: "The length of the phone number associated with the shipping address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  previous_payment_id_invalid: {
    description: "The previous payment identifier is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  processing_error: {
    description: "There was a general error when processing the request.",
    endpoint: "payments",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  processing_key_required: {
    description: "The processing key is required.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  processing_value_required: {
    description: "The processing value is required.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  recipient_account_number_invalid: {
    description: "The recipient's account number is invalid, or it's too long for the scheme.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_account_number_required: {
    description: "The recipient's account number is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_bank_details_invalid: {
    description: "Invalid bank details provided.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_bank_not_found: {
    description: "Bank code not recognized.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_dob_invalid: {
    description: "The recipient's date of birth is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_dob_required: {
    description: "The recipient's date of birth is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_last_name_required: {
    description: "The recipient's last name is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_zip_invalid: {
    description: "The first part of the recipient's UK post code is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recipient_zip_required: {
    description: "The first part of the recipient's UK post code is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recurring_plan_exists: {
    description: "The recurring plan exists.",
    endpoint: "payments",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  recurring_plan_not_exist: {
    description: "The recurring plan does not exist.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  recurring_plan_removal_failed: {
    description: "Removing the recurring plan has failed.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  request_invalid: {
    description: "The request is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  request_json_invalid: {
    description: "The JSON in the request is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  risk_enabled_required: {
    description: "The risk check that is enabled is required.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  server_api_not_allowed: {
    description: "The full API is not enabled on your sandbox account.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  source_email_invalid: {
    description: "The payment source owner's email address is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_email_required: {
    description: "The payment source owner's email address is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_id_invalid: {
    description: "The payment source identifier is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_id_or_email_required: {
    description: "The payment source identifier or email address is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_id_required: {
    description: "The payment source identifier is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_id_unknown: {
    description: "The payment source identifier is unknown.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_invalid: {
    description: "The payment source is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_or_destination_required: {
    description: "The payment source or destination is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_token_invalid: {
    description: "The Checkout.com token is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_token_required: {
    description: "The Checkout.com token number is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_token_type_required: {
    description: "The source token type is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_token_type_invalid: {
    description: "The source token type is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  source_type_required: {
    description: "The payment source type is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  sub_entities_count_invalid: {
    description: "This account type cannot request a split payment for multiple sub-entities.",
    endpoint: "payments",
    category: "configuration",
    retry: "do_not_retry",
  },
  success_url_invalid: {
    description: "The success URL provided is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_expired: {
    description: "The Checkout.com token has expired.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  token_in_use: {
    description: "The Checkout.com token is in use.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  token_invalid: {
    description: "The Checkout.com token is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_required: {
    description: "The Checkout.com token is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_type_required: {
    description: "The Checkout.com token type is required.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_used: {
    description: "The Checkout.com token has already been used.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  velocity_amount_limit_exceeded: {
    description:
      "The transaction to this card exceeded the amount limit set by the scheme's velocity limit.",
    endpoint: "payments",
    category: "card_declined",
    retry: "retry_conditionally",
  },
  velocity_count_limit_exceeded: {
    description:
      "The transaction to this card exceeded the transaction count limit set by the scheme's velocity limit.",
    endpoint: "payments",
    category: "card_declined",
    retry: "retry_conditionally",
  },
  void_amount_invalid: {
    description: "The void request amount is invalid.",
    endpoint: "payments",
    category: "invalid_amount",
    retry: "do_not_retry",
  },
  wallet_id_invalid: {
    description: "The wallet identifier is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  zip_invalid: {
    description: "The first part of the UK post code is invalid.",
    endpoint: "payments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  profile_mccs_invalid_for_processing_scope: {
    description:
      "The MCCs provided for the sub-entity are outside the processing scope of its Payfac/Marketplace.",
    endpoint: "accounts",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  principal_address_country_invalid_for_processing_scope: {
    description:
      "The principal address country provided for the sub-entity is outside the processing scope of its Payfac/Marketplace.",
    endpoint: "accounts",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  client_entity_cannot_onboard_subentities: {
    description: "The Payfac/Marketplace is not permitted to onboard new sub-entities.",
    endpoint: "accounts",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  service_unavailable: {
    description: "The service is unavailable.",
    endpoint: "tokens",
    category: "provider_unavailable",
    retry: "safe_to_retry_technical_request",
  },
  token_type_invalid: {
    description: "The token type is invalid.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_data_invalid: {
    description: "The token data is invalid.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  too_many_metadata_items: {
    description: "The metadata object contains more than 20 key-value pairs.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  metadata_key_too_long: {
    description: "A metadata key is longer than 100 characters.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  metadata_value_too_long: {
    description: "A metadata value is longer than 100 characters.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  metadata_value_invalid: {
    description: "A metadata value is null.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  metadata_only_supported_for_token_type_card: {
    description: "metadata was provided for a token with a type other than card.",
    endpoint: "tokens",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  identification_type_invalid: {
    description: "The bank account instrument identification type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  issuing_country_invalid: {
    description: "The bank account issuing country type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  date_of_birth_invalid: {
    description: "The bank account date of birth type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_of_birth_invalid: {
    description: "The bank account country of birth type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  country_required: {
    description: "The bank account country is required.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  residential_status_invalid: {
    description: "The bank account residential status is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  account_type_invalid: {
    description: "The bank account type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  account_holder_type_invalid: {
    description: "The bank account holder type is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  iban_invalid: {
    description: "The IBAN is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  swift_bic_invalid: {
    description: "The SWIFT code is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  token_data_required: {
    description: "The token data is required.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  instrument_already_has_customer: {
    description: "A customer already exists for that instrument.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  entity_id_invalid: {
    description: "The entity ID is invalid.",
    endpoint: "instruments",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  duplicate_request: {
    description: "Too many requests or duplicate request detected.",
    endpoint: "payments",
    category: "duplicate_request",
    retry: "do_not_retry",
  },
  refund_authorization_declined: {
    description: "The refund authorization was declined.",
    endpoint: "payments",
    category: "card_declined",
    retry: "manual_review",
  },
};
