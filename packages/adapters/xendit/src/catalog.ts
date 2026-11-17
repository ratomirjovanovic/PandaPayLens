/**
 * Xendit error, failure and status knowledge, kept as data so it can be
 * reviewed and versioned. Every entry comes from docs/providers/research/xendit.md.
 *
 * Xendit documents API error codes (error_code with an HTTP status and a short
 * description) per endpoint, payout and legacy disbursement failure codes with
 * descriptions, and payment failure codes only as an enum without
 * descriptions. The PandaPayLens category and retry class of each entry is a
 * proposal derived from the documented description. Explanations are
 * paraphrased; the linked pages hold Xendit's own wording.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

export { lookup } from "@pandapaylens/core";

const DOCS = "https://docs.xendit.co";
const ARCHIVE = "https://archive.developers.xendit.co/api-reference";

export const CREATE_PAYMENT_REQUEST_URL = `${DOCS}/apidocs/create-payment-request`;
export const GET_PAYMENT_REQUEST_URL = `${DOCS}/apidocs/get-payment-request`;
export const GET_PAYMENT_URL = `${DOCS}/apidocs/get-payment`;
export const CAPTURE_PAYMENT_URL = `${DOCS}/apidocs/capture-payment`;
export const CANCEL_PAYMENT_REQUEST_URL = `${DOCS}/apidocs/cancel-payment-request`;
export const PAYMENT_WEBHOOK_URL = `${DOCS}/apidocs/payment-webhook-notification`;
export const CREATE_REFUND_URL = `${DOCS}/apidocs/create-a-refund`;
export const REFUND_WEBHOOK_URL = `${DOCS}/apidocs/refund-webhook-notification`;
export const CREATE_PAYOUT_URL = `${DOCS}/apidocs/create-payout-v3`;
export const CANCEL_PAYOUT_URL = `${DOCS}/apidocs/cancel-payout`;
export const PAYOUT_WEBHOOK_URL = `${DOCS}/apidocs/payout-v3-webhook`;
export const PAYOUT_STATUS_URL = `${DOCS}/docs/payout-status-lifecycle`;
export const PAYMENTS_WEBHOOKS_GUIDE_URL = `${DOCS}/docs/payments-api-webhooks`;
export const ONE_OFF_PAYMENT_URL = `${DOCS}/docs/pay-one-off-payment`;
export const REUSABLE_CODES_URL = `${DOCS}/docs/reusable-payment-codes`;
export const REFUND_GUIDE_URL = `${DOCS}/docs/refund-payment-request`;
export const CARD_DECLINES_URL = `${DOCS}/docs/cards-card-declines-and-error-codes`;
export const HANDLING_WEBHOOKS_URL = `${DOCS}/docs/handling-webhooks`;
export const WEBHOOK_BEHAVIOR_URL = `${DOCS}/apidocs/webhook-behavior`;
export const LEGACY_ERRORS_URL = `${ARCHIVE}/#errors`;
export const LEGACY_EWALLET_URL = `${ARCHIVE}/#payment-status-callback`;
export const LEGACY_INVOICE_URL = `${ARCHIVE}/#invoices`;
export const LEGACY_INVOICE_CALLBACK_URL = `${ARCHIVE}/#invoice-callback`;
export const LEGACY_DISBURSEMENT_URL = `${ARCHIVE}/#disbursements`;
export const LEGACY_DISBURSEMENT_CALLBACK_URL = `${ARCHIVE}/#disbursement-callback`;

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  docs: string;
  /** HTTP statuses Xendit documents for this code. */
  http?: readonly number[];
  confidence: Confidence;
};

type Opts = { http?: readonly number[]; confidence?: Confidence; retryExplanation?: string };

function entry(
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retry: RetryGuidance,
  defaultRetryExplanation: string,
  docs: string,
  opts: Opts = {},
): CatalogEntry {
  return {
    category,
    explanation,
    nextAction,
    retry,
    retryExplanation: opts.retryExplanation ?? defaultRetryExplanation,
    docs,
    confidence: opts.confidence ?? "strong",
    ...(opts.http ? { http: opts.http } : {}),
  };
}

const FIX_REQUEST =
  "The request was rejected before processing. Correct it and send it again with a new idempotency key.";
const NOT_AS_IS = "Retrying the same request will fail the same way.";
const INDETERMINATE =
  "Xendit's error handling guide says a 500 result is indeterminate: the operation may have had side effects. Check the object's status (for example with the Get endpoint) before sending a new request.";
const UNAVAILABLE =
  "The channel or provider is unavailable. Check the status of the original request before trying again; a new attempt can be made once the channel recovers.";

/**
 * error_code values of Xendit API error responses `{ error_code, message }`.
 * Payments API v3, refunds and payouts v3 (docs.xendit.co API reference), and
 * the legacy invoice and disbursement endpoints (archived API reference).
 */
export const API_ERROR_CODES: Record<string, CatalogEntry> = {
  API_VALIDATION_ERROR: entry(
    "invalid_request",
    "Fields or values in the request do not follow the API specification. The message, and for some endpoints an errors list, names the problem.",
    "Fix the fields named in the message and send the request again.",
    "do_not_retry",
    FIX_REQUEST,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  INVALID_VALUE_ERROR: entry(
    "invalid_request",
    "A value is outside the expected range or configuration (for example an unsupported currency or an amount below or above the allowed limit).",
    "Read the message, correct the value and send the request again.",
    "do_not_retry",
    FIX_REQUEST,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  CARD_EXPIRED: entry(
    "card_declined",
    "The card expiry in the request is earlier than the current month.",
    "Ask the customer for a valid card.",
    "customer_action_required",
    "The same card details will be rejected again.",
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  INVALID_PAYMENT_DETAILS: entry(
    "invalid_request",
    "The payment details entered by the end user are invalid.",
    "Read the message and ask the customer to correct the details.",
    "customer_action_required",
    "The same details will be rejected again.",
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  PAYMENT_REQUEST_RATE_LIMITED: entry(
    "rate_limiting",
    "Too many requests were sent to this payment channel within a time window.",
    "Slow down requests to this channel and try again later.",
    "retry_conditionally",
    "The request was rejected because of the rate limit; it can be sent again after a pause.",
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  INVALID_TOKEN: entry(
    "payment_method_unavailable",
    "The payment token in the request has expired or was cancelled.",
    "Ask the end user to link the account or save the payment method again, then use the new token.",
    "customer_action_required",
    "Xendit says linking must be redone before retrying.",
    CREATE_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  SKIP_3DS_FORBIDDEN: entry(
    "configuration",
    "Card payment requests without 3DS are not enabled for this account.",
    "Enable the feature in the Xendit dashboard or send the payment with 3DS.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [403] },
  ),
  INVALID_MERCHANT_SETTINGS: entry(
    "configuration",
    "The merchant configuration with the provider is not valid (for example credentials with the channel, or a payout source currency that is not activated).",
    "Contact Xendit support to fix the account configuration.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [403] },
  ),
  ACCOUNT_ACCESS_BLOCKED: entry(
    "payment_method_unavailable",
    "The payment method provider denied access to the payment token in the request.",
    "Ask the end user to resolve the restriction with their provider or use another payment method.",
    "customer_action_required",
    NOT_AS_IS,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [403] },
  ),
  DUPLICATE_ERROR: entry(
    "duplicate_request",
    "A duplicate was rejected (for payouts: the idempotency key was already used for another payout).",
    "Look up the existing object before creating another one; use a new idempotency key only for a genuinely different request.",
    "do_not_retry",
    "The original request already exists, so a retry would not create anything new.",
    CREATE_PAYMENT_REQUEST_URL,
    { http: [409] },
  ),
  ACCOUNT_ALREADY_LINKED: entry(
    "duplicate_request",
    "The end user already linked this account earlier.",
    "Use the existing payment token instead of linking again.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [409] },
  ),
  SERVER_ERROR: entry(
    "provider_unavailable",
    "An unexpected error occurred at Xendit.",
    "Check the status of the object before trying again.",
    "retry_conditionally",
    INDETERMINATE,
    LEGACY_ERRORS_URL,
    { http: [500] },
  ),
  CHANNEL_UNAVAILABLE: entry(
    "provider_unavailable",
    "The requested channel is having unexpected issues; Xendit notifies the provider.",
    "Offer another channel or try again later.",
    "retry_conditionally",
    UNAVAILABLE,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [503] },
  ),
  ISSUER_UNAVAILABLE: entry(
    "provider_unavailable",
    "The end user's payment method provider is having unexpected issues.",
    "Offer another payment method or try again later.",
    "retry_conditionally",
    UNAVAILABLE,
    CREATE_PAYMENT_REQUEST_URL,
    { http: [503] },
  ),
  INVALID_API_KEY: entry(
    "configuration",
    "The API key is missing, malformed or invalid.",
    "Send a valid secret API key for the right environment.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [401] },
  ),
  REQUEST_FORBIDDEN_ERROR: entry(
    "configuration",
    "The API key or the account is not allowed to perform this request.",
    "Give the key the needed permission, or ask Xendit to enable the feature for the account.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_PAYOUT_URL,
    { http: [403] },
  ),
  DATA_NOT_FOUND: entry(
    "invalid_request",
    "The id in the request was not found.",
    "Check the id and the environment (test or live) it belongs to.",
    "do_not_retry",
    NOT_AS_IS,
    GET_PAYMENT_URL,
    { http: [404] },
  ),
  INELIGIBLE_TRANSACTION_STATUS: entry(
    "invalid_request",
    "The operation is not allowed for the object in its current status.",
    "Fetch the object, check its status and act on that state instead.",
    "do_not_retry",
    NOT_AS_IS,
    CAPTURE_PAYMENT_URL,
    { http: [400, 403] },
  ),
  TEMPORARILY_UNAVAILABLE: entry(
    "provider_unavailable",
    "The requested feature is not available at this time.",
    "Try again later.",
    "retry_conditionally",
    "Xendit gives no further detail; check the object's status before sending the request again.",
    CANCEL_PAYMENT_REQUEST_URL,
    { http: [400], confidence: "possible" },
  ),
  INACTIVE_PAYMENT_REQUEST: entry(
    "invalid_request",
    "The payment request is already inactive.",
    "Fetch the payment request to see its final status.",
    "do_not_retry",
    NOT_AS_IS,
    CANCEL_PAYMENT_REQUEST_URL,
    { http: [400] },
  ),
  CAPTURE_AMOUNT_EXCEEDED: entry(
    "invalid_amount",
    "The capture amount is larger than the authorized amount that is not captured yet.",
    "Capture at most the remaining authorized amount.",
    "do_not_retry",
    NOT_AS_IS,
    CAPTURE_PAYMENT_URL,
    { http: [400] },
  ),
  REFUND_NOT_SUPPORTED: entry(
    "payment_method_unavailable",
    "This payment channel does not support refunds.",
    "Return the money another way, for example with a payout.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400, 403] },
  ),
  PARTIAL_REFUND_NOT_SUPPORTED: entry(
    "payment_method_unavailable",
    "This payment or channel does not support partial refunds.",
    "Refund the full amount or return the money another way.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400, 403] },
  ),
  INELIGIBLE_TRANSACTION: entry(
    "invalid_request",
    "The payment is not eligible for a refund; the message gives details.",
    "Read the message and check the payment.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [403] },
  ),
  REFUND_TEMPORARILY_UNAVAILABLE: entry(
    "provider_unavailable",
    "Refunds are temporarily unavailable for this payment or channel.",
    "Try the refund again later.",
    "retry_conditionally",
    "Xendit says to try again later. List the payment's refunds first so a second refund is not created.",
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  REFUND_IN_PROGRESS: entry(
    "duplicate_request",
    "Another refund for this payment is still pending.",
    "Wait for the pending refund to finish (refund webhook or Get refund) before creating a new one.",
    "retry_conditionally",
    "A new refund can be requested only after the pending one is completed.",
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  REFUND_AMOUNT_EXCEEDED: entry(
    "invalid_amount",
    "The refund amount is larger than the captured amount that is not refunded yet.",
    "Refund at most the remaining refundable amount.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  PARTIAL_REFUND_COUNTS_EXCEEDED: entry(
    "invalid_request",
    "The channel's limit on the number of partial refunds for this payment was reached.",
    "Check the channel's refund limitations.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  MAXIMUM_REFUND_TRANSACTION_REACHED: entry(
    "invalid_request",
    "The maximum number of refunds for this payment was reached.",
    "No further refunds can be made for this payment.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  MAXIMUM_REFUND_AMOUNT_REACHED: entry(
    "invalid_amount",
    "The maximum refundable amount for this payment was reached.",
    "No further amount can be refunded for this payment.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  INSUFFICIENT_BALANCE: entry(
    "insufficient_funds",
    "The merchant's Xendit balance is too low to make the refund.",
    "Top up the Xendit balance, then request the refund again.",
    "retry_conditionally",
    "Xendit says to retry after topping up the balance.",
    CREATE_REFUND_URL,
    { http: [400] },
  ),
  INVALID_QUOTE: entry(
    "invalid_request",
    "The quote was created for a different transaction type.",
    "Create a new quote with the correct transaction type.",
    "do_not_retry",
    NOT_AS_IS,
    CREATE_PAYOUT_URL,
    { http: [400] },
  ),
  CANCELLATION_NOT_ALLOWED: entry(
    "invalid_request",
    "Xendit lists this code for Cancel Payout (HTTP 403) without a description; the payout could not be cancelled.",
    "Fetch the payout and check its status.",
    "do_not_retry",
    NOT_AS_IS,
    CANCEL_PAYOUT_URL,
    { http: [403], confidence: "possible" },
  ),
  CONVERSION_TRADE_NOT_YET_CANCELLABLE: entry(
    "invalid_request",
    "Xendit lists this code for Cancel Payout (HTTP 403) without a description; the currency conversion of the payout could not be cancelled yet.",
    "Fetch the payout and check its status before trying to cancel again.",
    "retry_conditionally",
    "The name suggests a later attempt may succeed; Xendit gives no guidance.",
    CANCEL_PAYOUT_URL,
    { http: [403], confidence: "possible" },
  ),
  // Legacy invoice and disbursement endpoints (archived API reference).
  INVALID_JSON_FORMAT: entry(
    "invalid_request",
    "The request body is not valid JSON.",
    "Send a valid JSON body.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_INVOICE_URL,
    { http: [400] },
  ),
  NO_COLLECTION_METHODS_ERROR: entry(
    "configuration",
    "The account has no payment methods configured for invoices.",
    "Contact Xendit support to set up payment methods.",
    "do_not_retry",
    NOT_AS_IS,
    LEGACY_INVOICE_URL,
    { http: [400] },
  ),
  UNAVAILABLE_PAYMENT_METHOD_ERROR: entry(
    "payment_method_unavailable",
    "The requested payment methods do not match the ones available to the business.",
    "Request only payment methods that are enabled for the account.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_INVOICE_URL,
    { http: [400] },
  ),
  INVOICE_NOT_FOUND_ERROR: entry(
    "invalid_request",
    "No invoice was found for the id.",
    "Check the invoice id and environment.",
    "do_not_retry",
    NOT_AS_IS,
    LEGACY_INVOICE_URL,
    { http: [404] },
  ),
  DISBURSEMENT_DESCRIPTION_NOT_FOUND_ERROR: entry(
    "configuration",
    "No default disbursement description is set in the dashboard settings.",
    "Add a default description in the disbursement settings, then retry.",
    "do_not_retry",
    NOT_AS_IS,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  DIRECT_DISBURSEMENT_BALANCE_INSUFFICIENT_ERROR: entry(
    "insufficient_funds",
    "The balance is too low for the disbursement.",
    "Add balance, then send the disbursement again.",
    "retry_conditionally",
    "Xendit says to add balance before retrying.",
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  DUPLICATE_TRANSACTION_ERROR: entry(
    "duplicate_request",
    "The idempotency key was used before.",
    "Look up the existing disbursement; use a unique key only for a different disbursement.",
    "do_not_retry",
    "The original disbursement already exists.",
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  BANK_CODE_NOT_SUPPORTED_ERROR: entry(
    "invalid_request",
    "The destination bank code is not supported.",
    "Use a supported bank or e-wallet code.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  // The error example of Create Disbursement shows this spelling, while the
  // error table lists BANK_CODE_NOT_SUPPORTED_ERROR.
  BANK_CODE_NOT_SUPPORTED: entry(
    "invalid_request",
    "The destination bank code is not supported.",
    "Use a supported bank or e-wallet code.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_DISBURSEMENT_URL,
    { http: [400], confidence: "possible" },
  ),
  RECIPIENT_ACCOUNT_NUMBER_ERROR: entry(
    "invalid_request",
    "The account number does not have the required format for the bank (for example 10 digits for BCA).",
    "Check the account number length before retrying.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  RECIPIENT_AMOUNT_ERROR: entry(
    "invalid_amount",
    "The amount is below the minimum for the destination bank.",
    "Change the amount before retrying.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  MAXIMUM_TRANSFER_LIMIT_ERROR: entry(
    "invalid_amount",
    "The amount is above the maximum for the destination bank.",
    "Change the amount before retrying.",
    "do_not_retry",
    FIX_REQUEST,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  INVALID_DESTINATION: entry(
    "invalid_request",
    "The destination account number cannot be processed.",
    "Use a different account number.",
    "do_not_retry",
    NOT_AS_IS,
    LEGACY_DISBURSEMENT_URL,
    { http: [400] },
  ),
  DIRECT_DISBURSEMENT_NOT_FOUND_ERROR: entry(
    "invalid_request",
    "No disbursement was found.",
    "Check the id or external id and the environment.",
    "do_not_retry",
    NOT_AS_IS,
    LEGACY_DISBURSEMENT_URL,
    { http: [404] },
  ),
};

/**
 * error_code values so generic that they also appear in other APIs. A bare
 * error envelope with one of these is detected with lower confidence.
 */
export const GENERIC_ERROR_CODES: readonly string[] = [
  "API_VALIDATION_ERROR",
  "SERVER_ERROR",
  "INVALID_API_KEY",
  "REQUEST_FORBIDDEN_ERROR",
  "DATA_NOT_FOUND",
  "DUPLICATE_ERROR",
  "INVALID_JSON_FORMAT",
  "INSUFFICIENT_BALANCE",
  "INVALID_DESTINATION",
];

const PAYMENT_FAILED =
  "The payment failed; this outcome is final for this payment. A new payment attempt is a separate payment.";
const NAME_ONLY =
  "Xendit lists this value in the Payments API failure_code enum but the pages read do not describe it (the error scenario table is an embedded table that could not be read).";

function failure(
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retry: RetryGuidance,
  docs: string,
  confidence: Confidence = "possible",
  retryExplanation = PAYMENT_FAILED,
): CatalogEntry {
  return { category, explanation, nextAction, retry, retryExplanation, docs, confidence };
}

function nameOnly(): CatalogEntry {
  return failure(
    "unknown",
    NAME_ONLY,
    "Check the payment in the Xendit dashboard for details.",
    "unknown",
    PAYMENT_WEBHOOK_URL,
    "insufficient",
    "Retry safety cannot be assessed for an undocumented failure code.",
  );
}

/**
 * Payments API v3 `failure_code` values (Payment and Payment Request objects).
 * Xendit documents only the names. Meanings come from three secondary sources,
 * so every entry has at most `possible` confidence:
 * - the description of the API error code with the same name (v3),
 * - the legacy eWallet failure code table (same names, older API),
 * - the card network response code table, which maps network codes to these names.
 */
export const PAYMENT_FAILURE_CODES: Record<string, CatalogEntry> = {
  ACCOUNT_ACCESS_BLOCKED: failure(
    "payment_method_unavailable",
    "The end user's account is restricted by the payment method provider (meaning from the legacy eWallet table and the v3 API error of the same name).",
    "Ask the end user to contact their provider or use another payment method.",
    "customer_action_required",
    LEGACY_EWALLET_URL,
  ),
  INVALID_MERCHANT_SETTINGS: failure(
    "configuration",
    "The merchant credentials met an error with the provider (meaning from the v3 API error of the same name).",
    "Contact Xendit support.",
    "do_not_retry",
    CREATE_PAYMENT_REQUEST_URL,
  ),
  INVALID_ACCOUNT_DETAILS: failure(
    "invalid_request",
    "The end user gave incorrect information for the transaction (meaning from the legacy eWallet table).",
    "Ask the end user to check their details.",
    "customer_action_required",
    LEGACY_EWALLET_URL,
  ),
  PAYMENT_ATTEMPT_COUNTS_EXCEEDED: nameOnly(),
  USER_DEVICE_UNREACHABLE: nameOnly(),
  CHANNEL_UNAVAILABLE: failure(
    "provider_unavailable",
    "The payment channel had unexpected issues (meaning from the legacy eWallet table and the v3 API error of the same name).",
    "Offer another channel or ask the end user to try later.",
    "retry_conditionally",
    CREATE_PAYMENT_REQUEST_URL,
  ),
  INSUFFICIENT_BALANCE: failure(
    "insufficient_funds",
    "The end user's balance or card limit was not enough (meaning from the legacy eWallet table; card network codes 51 and 61 also map here).",
    "Ask the end user to top up or use another payment method.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  ACCOUNT_NOT_ACTIVATED: failure(
    "payment_method_unavailable",
    "The end user's account is not activated with the provider (meaning from the legacy eWallet table).",
    "Ask the end user to activate the account before paying again.",
    "customer_action_required",
    LEGACY_EWALLET_URL,
  ),
  INVALID_TOKEN: failure(
    "payment_method_unavailable",
    "The payment token expired or was cancelled (meaning from the v3 API error of the same name).",
    "Ask the end user to link the account or save the payment method again.",
    "customer_action_required",
    CREATE_PAYMENT_REQUEST_URL,
  ),
  SERVER_ERROR: failure(
    "provider_unavailable",
    "An unexpected error occurred (meaning from the v3 API error of the same name).",
    "Check the payment in the Xendit dashboard.",
    "retry_conditionally",
    CREATE_PAYMENT_REQUEST_URL,
  ),
  PARTNER_TIMEOUT_ERROR: nameOnly(),
  TIMEOUT_ERROR: nameOnly(),
  USER_DECLINED_PAYMENT: failure(
    "card_declined",
    "The end user declined the payment (meaning from the legacy eWallet table).",
    "Ask the end user whether they want to pay again.",
    "customer_action_required",
    LEGACY_EWALLET_URL,
  ),
  USER_DID_NOT_AUTHORIZE: nameOnly(),
  PAYMENT_REQUEST_EXPIRED: nameOnly(),
  FAILURE_DETAILS_UNAVAILABLE: failure(
    "unknown",
    "The provider gave no details about the failure (meaning from the legacy eWallet table).",
    "Check the payment in the Xendit dashboard.",
    "unknown",
    LEGACY_EWALLET_URL,
  ),
  EXPIRED_OTP: nameOnly(),
  INVALID_OTP: nameOnly(),
  PAYMENT_AMOUNT_LIMITS_EXCEEDED: nameOnly(),
  OTP_ATTEMPT_COUNTS_EXCEEDED: nameOnly(),
  CARD_DECLINED: failure(
    "card_declined",
    "The card payment was declined. Card network codes such as 71, 87, 88, 90 and 9G map to this value.",
    "Check payment_details.authorization_data for the network response code; ask the customer to use another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  DECLINED_BY_ISSUER: failure(
    "card_declined",
    "The issuing bank declined the card payment. Network codes such as 01, 02, 05 (do not honor), 62 and 65 map to this value.",
    "Ask the customer to contact their bank or use another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  ISSUER_UNAVAILABLE: failure(
    "provider_unavailable",
    "The issuer or the end user's provider was unavailable. Network codes 91 and 96 (temporary system error) map to this value.",
    "Ask the customer to try again later or use another payment method.",
    "retry_conditionally",
    CARD_DECLINES_URL,
  ),
  INVALID_CVV: failure(
    "card_declined",
    "The card security code was rejected. Network code 82 (invalid CVN) maps to this value.",
    "Ask the customer to re-enter the card details. Xendit advises not telling shoppers that the CVN was the problem.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  DECLINED_BY_PROCESSOR: failure(
    "card_declined",
    "The processor declined the card payment. Network codes such as 64, 74, 81 and 94 map to this value.",
    "Ask the customer to use another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  // The schema lists this value with a trailing space; the lookup trims codes.
  CAPTURE_AMOUNT_EXCEEDED: failure(
    "invalid_amount",
    "The capture amount was larger than the remaining authorized amount (meaning from the v3 API error of the same name).",
    "Capture at most the remaining authorized amount.",
    "do_not_retry",
    CAPTURE_PAYMENT_URL,
  ),
  AUTHENTICATION_FAILED: failure(
    "authentication_failed",
    "Card authentication failed. Network code 1A (authentication required) maps to this value.",
    "Ask the customer to complete 3DS authentication again or use another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  PROCESSOR_ERROR: failure(
    "provider_unavailable",
    "A processing error occurred. Network codes such as 19, 28, 30 and 80 map to this value.",
    "Check the payment in the Xendit dashboard before asking the customer to pay again.",
    "retry_conditionally",
    CARD_DECLINES_URL,
  ),
  EXPIRED_CARD: failure(
    "card_declined",
    "The card has expired. Network code 54 maps to this value.",
    "Ask the customer for another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  STOLEN_CARD: failure(
    "fraud_or_risk",
    "The card is reported lost or stolen or must be retained. Network codes 04, 07, 41 and 43 map to this value.",
    "Do not retry this card.",
    "do_not_retry",
    CARD_DECLINES_URL,
  ),
  INACTIVE_OR_UNAUTHORIZED_CARD: failure(
    "card_declined",
    "The card is inactive or not allowed for this transaction. Network codes such as 12, 46, 57 and 78 map to this value.",
    "Ask the customer to use another card.",
    "customer_action_required",
    CARD_DECLINES_URL,
  ),
  INVALID_MERCHANT_CREDENTIALS: failure(
    "configuration",
    "The merchant credentials met an error with the provider (meaning from the legacy eWallet table).",
    "Contact Xendit support.",
    "do_not_retry",
    LEGACY_EWALLET_URL,
  ),
  SUSPECTED_FRAUDULENT: nameOnly(),
};

/** Payouts v3 `failure_code` values. Descriptions and retry advice from the payout status page. */
export const PAYOUT_FAILURE_CODES: Record<string, CatalogEntry> = {
  INSUFFICIENT_BALANCE: entry(
    "insufficient_funds",
    "The merchant's balance is too low for the payout amount.",
    "Top up the balance, then create the payout again.",
    "retry_conditionally",
    "Xendit says to retry after making sure the balance is sufficient.",
    PAYOUT_STATUS_URL,
  ),
  INVALID_DESTINATION: entry(
    "invalid_request",
    "The recipient account does not exist or is invalid.",
    "Confirm the account details with the recipient.",
    "do_not_retry",
    "Xendit says the same payout is unlikely to succeed if retried.",
    PAYOUT_STATUS_URL,
  ),
  DESTINATION_MAXIMUM_LIMIT: entry(
    "invalid_amount",
    "The recipient cannot receive this amount.",
    "Confirm with the recipient whether their account can receive the payout.",
    "do_not_retry",
    "Xendit says the same payout is unlikely to succeed if retried.",
    PAYOUT_STATUS_URL,
  ),
  ACCOUNT_NAME_MISMATCH: entry(
    "invalid_request",
    "The account holder name does not match the account.",
    "Confirm the account name with the recipient.",
    "do_not_retry",
    "Xendit says the same payout is unlikely to succeed if retried.",
    PAYOUT_STATUS_URL,
  ),
  REJECTED_BY_CHANNEL: entry(
    "payment_method_unavailable",
    "The destination channel returned an error, usually while crediting the destination account.",
    "Check that the destination account is active and can receive this currency, then retry.",
    "retry_conditionally",
    "Xendit says to retry after validating the destination account.",
    PAYOUT_STATUS_URL,
  ),
  TEMPORARY_TRANSFER_ERROR: entry(
    "network_or_timeout",
    "The channel networks had a temporary error.",
    "Create the payout again in 1 to 3 hours.",
    "retry_conditionally",
    "Xendit says to retry in 1 to 3 hours. The payout failed, so a retry is a new payout.",
    PAYOUT_STATUS_URL,
  ),
  TRANSFER_ERROR: entry(
    "invalid_request",
    "A fatal error occurred while processing the payout, usually because some request fields are invalid.",
    "Review the payout request fields.",
    "do_not_retry",
    "Xendit says the same payout is unlikely to succeed if retried.",
    PAYOUT_STATUS_URL,
  ),
  SLS_SENDER: {
    category: "unknown",
    explanation:
      "Listed in the payout FailureCode enum without a description; the name suggests a screening result about the sender, which Xendit does not explain.",
    nextAction: "Contact Xendit support about this payout.",
    retry: "unknown",
    retryExplanation: "Retry safety cannot be assessed for an undocumented failure code.",
    docs: PAYOUT_WEBHOOK_URL,
    confidence: "insufficient",
  },
  SLS_RECIPIENT: {
    category: "unknown",
    explanation:
      "Listed in the payout FailureCode enum without a description; the name suggests a screening result about the recipient, which Xendit does not explain.",
    nextAction: "Contact Xendit support about this payout.",
    retry: "unknown",
    retryExplanation: "Retry safety cannot be assessed for an undocumented failure code.",
    docs: PAYOUT_WEBHOOK_URL,
    confidence: "insufficient",
  },
};

/** Legacy disbursement `failure_code` values (archived API reference). */
export const DISBURSEMENT_FAILURE_CODES: Record<string, CatalogEntry> = {
  INSUFFICIENT_BALANCE: entry(
    "insufficient_funds",
    "The balance was too low for the disbursement amount.",
    "Top up the balance, then create the disbursement again.",
    "retry_conditionally",
    "The disbursement failed; a new one can be made after topping up.",
    LEGACY_DISBURSEMENT_URL,
  ),
  UNKNOWN_BANK_NETWORK_ERROR: entry(
    "network_or_timeout",
    "The bank network returned an unknown error.",
    "Contact Xendit support or the destination bank before sending the money again.",
    "manual_review",
    "Xendit says it cannot predict whether a retry of the same disbursement will succeed.",
    LEGACY_DISBURSEMENT_URL,
  ),
  TEMPORARY_BANK_NETWORK_ERROR: entry(
    "network_or_timeout",
    "The bank networks had a temporary error.",
    "Create the disbursement again in 1 to 3 hours.",
    "retry_conditionally",
    "Xendit says to retry in 1 to 3 hours.",
    LEGACY_DISBURSEMENT_URL,
  ),
  INVALID_DESTINATION: entry(
    "invalid_request",
    "The banks reported the destination account as unregistered or blocked.",
    "Confirm the account with the recipient or the destination bank.",
    "manual_review",
    "Xendit suggests retrying only when unsure, or checking the account with the bank first.",
    LEGACY_DISBURSEMENT_URL,
  ),
  SWITCHING_NETWORK_ERROR: entry(
    "network_or_timeout",
    "At least one switching network had an issue.",
    "Create the disbursement again in 1 to 3 hours.",
    "retry_conditionally",
    "Xendit says to retry in 1 to 3 hours.",
    LEGACY_DISBURSEMENT_URL,
  ),
  REJECTED_BY_BANK: entry(
    "payment_method_unavailable",
    "The bank rejected the transfer without a clear reason.",
    "Contact Xendit support or the destination bank.",
    "manual_review",
    "Xendit says it cannot predict whether a retry of the same disbursement will succeed.",
    LEGACY_DISBURSEMENT_URL,
  ),
  TRANSFER_ERROR: entry(
    "invalid_request",
    "A fatal error occurred while processing the disbursement; some request fields may be invalid.",
    "Contact Xendit support.",
    "do_not_retry",
    "Xendit points to invalid fields and support, not to a retry.",
    LEGACY_DISBURSEMENT_URL,
  ),
  TEMPORARY_TRANSFER_ERROR: entry(
    "network_or_timeout",
    "A temporary issue occurred while processing the disbursement.",
    "Create the disbursement again in 1 to 2 hours.",
    "retry_conditionally",
    "Xendit says to retry in 1 to 2 hours.",
    LEGACY_DISBURSEMENT_URL,
  ),
};

export type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  explanation: string;
};

/** Payment (v3) `status`. */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    stage: "payment",
    outcome: "pending",
    explanation: "The payment partner has not answered yet; wait for the payment webhook.",
  },
  AUTHORIZED: {
    stage: "authorization",
    outcome: "success",
    explanation:
      "Funds are reserved on the end user's account and wait for a manual capture. Not captured.",
  },
  SUCCEEDED: {
    stage: "capture",
    outcome: "success",
    explanation:
      "The payment was collected and confirmed by the payment method. This is not a settlement confirmation.",
  },
  FAILED: {
    stage: "payment",
    outcome: "failure",
    explanation: "The payment failed; failure_code gives the reason.",
  },
  CANCELED: {
    stage: "void",
    outcome: "failure",
    explanation:
      "The authorization was cancelled (voided) before capture, releasing the hold on the funds.",
  },
  EXPIRED: {
    stage: "cancellation",
    outcome: "failure",
    explanation: "A successful authorization expired without capture.",
  },
};

/** Payment Request (v3) `status`. */
export const PAYMENT_REQUEST_STATUSES: Record<string, StatusInfo> = {
  REQUIRES_ACTION: {
    stage: "payment",
    outcome: "pending",
    explanation: "The end user must complete the returned actions (redirect, code, QR or OTP).",
  },
  PENDING: {
    stage: "payment",
    outcome: "pending",
    explanation: "The payment partner has not answered yet; wait for the payment webhook.",
  },
  ACCEPTING_PAYMENTS: {
    stage: "payment",
    outcome: "pending",
    explanation:
      "A reusable payment code is ready to receive several payments; each payment arrives as its own payment.capture webhook.",
  },
  AUTHORIZED: {
    stage: "authorization",
    outcome: "success",
    explanation: "The payment is authorized and waits for capture.",
  },
  SUCCEEDED: {
    stage: "capture",
    outcome: "success",
    explanation: "The payment was completed; store the payment_id as proof.",
  },
  FAILED: {
    stage: "payment",
    outcome: "failure",
    explanation: "The payment failed; failure_code gives the reason.",
  },
  CANCELED: {
    stage: "cancellation",
    outcome: "failure",
    explanation: "The payment request was cancelled and its actions can no longer be completed.",
  },
  EXPIRED: {
    stage: "cancellation",
    outcome: "failure",
    explanation: "The payment request expired before it was paid.",
  },
};

/** Refund (v3) `status`. */
export const REFUND_STATUSES: Record<string, StatusInfo> = {
  PENDING: { stage: "refund", outcome: "pending", explanation: "The refund is still processing." },
  SUCCEEDED: {
    stage: "refund",
    outcome: "success",
    explanation:
      "Xendit processed the refund and sent it to the payment channel. Xendit says this does not guarantee that the money already reached the end user's account.",
  },
  FAILED: {
    stage: "refund",
    outcome: "failure",
    explanation: "The refund could not be completed; failure_code gives a channel-specific reason.",
  },
};

/**
 * Payout (v3) `status`. The payout status page and the API schema enum
 * disagree: the page lists COMPLIANCE_REJECTED, the enum lists REJECTED,
 * ROUTING, READY, LOCKED and EXPIRED without descriptions. Values without a
 * description are left out, so they decode as unknown.
 */
export const PAYOUT_STATUSES: Record<string, StatusInfo> = {
  ACCEPTED: {
    stage: "payout",
    outcome: "pending",
    explanation:
      "Accepted by Xendit but not sent to the destination yet (it can wait here while the destination is offline).",
  },
  PENDING_COMPLIANCE_ASSESSMENT: {
    stage: "payout",
    outcome: "pending",
    explanation: "Under compliance review; Xendit contacts the merchant by email.",
  },
  COMPLIANCE_REJECTED: {
    stage: "payout",
    outcome: "failure",
    explanation: "Rejected for compliance reasons.",
  },
  REQUESTED: {
    stage: "payout",
    outcome: "pending",
    explanation: "Sent to the channel for processing; it can still fail.",
  },
  SUCCEEDED: {
    stage: "payout",
    outcome: "success",
    explanation: "The payout was sent. A succeeded payout can still be reversed by the network.",
  },
  FAILED: {
    stage: "payout",
    outcome: "failure",
    explanation: "The payout failed; failure_code gives the reason.",
  },
  CANCELLED: {
    stage: "payout",
    outcome: "failure",
    explanation: "Cancelled at the merchant's request.",
  },
  REVERSED: {
    stage: "reversal",
    outcome: "failure",
    explanation:
      "The processor rejected the payout after it had succeeded, commonly because the account is invalid or dormant.",
  },
};

/** Legacy invoice `status`. */
export const INVOICE_STATUSES: Record<string, StatusInfo> = {
  PENDING: { stage: "payment", outcome: "pending", explanation: "Created and not paid yet." },
  PAID: { stage: "payment", outcome: "success", explanation: "The invoice was paid." },
  SETTLED: {
    stage: "settlement",
    outcome: "success",
    explanation: "The paid amount was settled to the cash balance.",
  },
  EXPIRED: {
    stage: "cancellation",
    outcome: "failure",
    explanation: "The invoice expired before the customer paid.",
  },
};

/** Legacy disbursement `status`. */
export const DISBURSEMENT_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    stage: "payout",
    outcome: "pending",
    explanation: "The transfer was started but the bank has not completed it.",
  },
  COMPLETED: {
    stage: "payout",
    outcome: "success",
    explanation: "The bank confirmed the transfer of funds.",
  },
  FAILED: {
    stage: "payout",
    outcome: "failure",
    explanation: "The disbursement failed; failure_code gives the reason.",
  },
};

export type WebhookEventInfo = {
  object: "payment" | "payment_request" | "refund" | "payout";
  stage: LifecycleStage;
  outcome: Outcome;
  description: string;
};

/**
 * v3 webhook `event` values with semantics. payment.expiry and
 * payment_request.expiry appear only in the Payments API webhooks guide table,
 * without a payload example.
 */
export const WEBHOOK_EVENTS: Record<string, WebhookEventInfo> = {
  "payment.capture": {
    object: "payment",
    stage: "capture",
    outcome: "success",
    description: "The payment was collected and confirmed by the payment method.",
  },
  "payment.authorization": {
    object: "payment",
    stage: "authorization",
    outcome: "success",
    description: "The payment was reserved on the end user's account. Not captured.",
  },
  "payment.failure": {
    object: "payment",
    stage: "payment",
    outcome: "failure",
    description: "The payment could not be collected.",
  },
  "payment.expiry": {
    object: "payment",
    stage: "cancellation",
    outcome: "failure",
    description: "A successful authorization expired.",
  },
  "payment_request.expiry": {
    object: "payment_request",
    stage: "cancellation",
    outcome: "failure",
    description:
      "The payment request expired and accepts no new payments. Xendit notes that a payment can still race with the expiry.",
  },
  "refund.succeeded": {
    object: "refund",
    stage: "refund",
    outcome: "success",
    description:
      "Xendit processed the refund and sent it to the channel; it may not be in the end user's account yet.",
  },
  "refund.failed": {
    object: "refund",
    stage: "refund",
    outcome: "failure",
    description: "The refund could not be processed.",
  },
  "v3_payout.succeeded": {
    object: "payout",
    stage: "payout",
    outcome: "success",
    description: "The payout was sent.",
  },
  "v3_payout.failed": {
    object: "payout",
    stage: "payout",
    outcome: "failure",
    description: "The payout failed.",
  },
  "v3_payout.reversed": {
    object: "payout",
    stage: "reversal",
    outcome: "failure",
    description: "A succeeded payout was reversed by the processor.",
  },
};

/**
 * Payout webhook events in the schema enum without a description. They are
 * read as payout snapshots with an unknown event outcome.
 */
export const UNDESCRIBED_PAYOUT_EVENTS: readonly string[] = [
  "v3_payout.rejected",
  "v3_payout.pending_compliance",
];

/** Payment Request `type` values; REUSABLE_PAYMENT_CODE receives many payments. */
export const PAYMENT_REQUEST_TYPES: readonly string[] = [
  "PAY",
  "PAY_AND_SAVE",
  "REUSABLE_PAYMENT_CODE",
];

/** All documented payout status values (page and schema enum). */
export const PAYOUT_STATUS_VALUES: readonly string[] = [
  "ACCEPTED",
  "PENDING_COMPLIANCE_ASSESSMENT",
  "COMPLIANCE_REJECTED",
  "REJECTED",
  "ROUTING",
  "REQUESTED",
  "READY",
  "LOCKED",
  "EXPIRED",
  "FAILED",
  "SUCCEEDED",
  "CANCELLED",
  "REVERSED",
];
