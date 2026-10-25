/**
 * Adyen error knowledge, kept as data.
 *
 * Refusal reasons: https://docs.adyen.com/development-resources/refusal-reasons
 * Result codes:    https://docs.adyen.com/online-payments/build-your-integration/payment-result-codes
 * API errors:      https://docs.adyen.com/development-resources/error-codes
 */

import type { ErrorCategory, LifecycleStage, RetryGuidance } from "@pandapaylens/core";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

export const REFUSAL_REASONS_URL = "https://docs.adyen.com/development-resources/refusal-reasons";
export const RESULT_CODES_URL = "https://docs.adyen.com/online-payments/build-your-integration/payment-result-codes";
export const ERROR_CODES_URL = "https://docs.adyen.com/development-resources/error-codes";
export const WEBHOOK_TYPES_URL = "https://docs.adyen.com/development-resources/webhooks/webhook-types";

const noRetry = (explanation: string, nextAction: string, category: ErrorCategory = "card_declined"): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "do_not_retry",
  retryExplanation: "Retrying with the same payment details will not change the result.",
});
const customer = (explanation: string, nextAction: string, category: ErrorCategory = "card_declined"): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "customer_action_required",
  retryExplanation: "A new attempt needs the shopper to act first (new details, another method, or contacting their issuer).",
});
const later = (explanation: string, nextAction: string, category: ErrorCategory): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "retry_conditionally",
  retryExplanation: "A later attempt may succeed. Avoid immediate repeated retries.",
});

/** Keyed by refusalReasonCode (string), with the documented refusalReason text as label. */
export const REFUSAL_REASONS: Record<string, { label: string } & CatalogEntry> = {
  "2": { label: "Refused", ...customer("The issuer refused the transaction without a specific reason.", "Ask the shopper to use another payment method or contact their issuer.") },
  "3": { label: "Referral", ...customer("The issuer asked for a referral (voice authorization).", "Ask the shopper to contact their issuer or use another method.") },
  "4": { label: "Acquirer Error", ...later("The transaction did not go through because of an error at the acquirer.", "Retry later; if it persists, contact Adyen support.", "provider_unavailable") },
  "5": { label: "Blocked Card", ...noRetry("The card is blocked or blacklisted.", "Ask the shopper to use another payment method.", "fraud_or_risk") },
  "6": { label: "Expired Card", ...customer("The card has expired.", "Ask the shopper to use another card.") },
  "7": { label: "Invalid Amount", ...noRetry("The amount is invalid or exceeds what the card allows.", "Check the amount and currency.", "invalid_amount") },
  "8": { label: "Invalid Card Number", ...customer("The card number is incorrect or invalid.", "Ask the shopper to re-enter their card details.") },
  "9": { label: "Issuer Unavailable", ...later("The issuer could not be reached for authorization.", "Retry later or offer another payment method.", "provider_unavailable") },
  "10": { label: "Not supported", ...noRetry("The issuer does not support this payment method or transaction type.", "Offer another payment method.", "payment_method_unavailable") },
  "11": { label: "3D Not Authenticated", ...customer("3D Secure authentication was not completed or failed.", "Ask the shopper to try again and complete authentication.", "authentication_failed") },
  "12": { label: "Not enough balance", ...customer("The card does not have enough balance for the amount.", "Ask the shopper to use another payment method.", "insufficient_funds") },
  "14": { label: "Acquirer Fraud", ...noRetry("The payment was flagged as possible fraud by the acquirer.", "Present a generic decline.", "fraud_or_risk") },
  "15": { label: "Cancelled", ...noRetry("The transaction was cancelled.", "Check whether the cancellation was intended.", "unknown") },
  "16": { label: "Shopper Cancelled", ...customer("The shopper cancelled the payment.", "Let the shopper start a new payment if they wish.", "unknown") },
  "17": { label: "Invalid Pin", ...customer("The PIN entered was incorrect.", "Ask the shopper to try again with the correct PIN.") },
  "18": { label: "Pin tries exceeded", ...noRetry("The shopper entered an incorrect PIN too many times.", "Ask the shopper to use another payment method.") },
  "19": { label: "Pin validation not possible", ...later("The PIN could not be validated.", "Retry later or use another method.", "provider_unavailable") },
  "20": { label: "FRAUD", ...noRetry("The payment was refused by risk checks (Adyen or your risk rules).", "Review the risk settings if this is unexpected. Present a generic decline.", "fraud_or_risk") },
  "21": { label: "Not Submitted", ...later("The transaction was not submitted correctly.", "Check the request and retry.", "invalid_request") },
  "22": { label: "FRAUD-CANCELLED", ...noRetry("The transaction was cancelled by risk checks after authorization.", "Review the risk case before acting.", "fraud_or_risk") },
  "23": { label: "Transaction Not Permitted", ...noRetry("The issuer does not permit this transaction for this card.", "Ask the shopper to use another payment method.") },
  "24": { label: "CVC Declined", ...customer("The CVC/security code is incorrect.", "Ask the shopper to re-enter their card details.") },
  "25": { label: "Restricted Card", ...noRetry("The card is restricted (for example, in this country).", "Ask the shopper to use another payment method.") },
  "26": { label: "Revocation Of Auth", ...noRetry("The shopper asked to stop recurring payments with this merchant.", "Do not retry recurring payments on this card.") },
  "27": { label: "Declined Non Generic", ...customer("The issuer declined with a reason that does not map to a specific refusal reason.", "Ask the shopper to contact their issuer.") },
  "28": { label: "Withdrawal amount exceeded", ...customer("The amount exceeds the card's limit.", "Ask the shopper to use another method or a lower amount.", "insufficient_funds") },
  "29": { label: "Withdrawal count exceeded", ...customer("The card's transaction count limit was exceeded.", "Ask the shopper to use another method.") },
  "31": { label: "Issuer Suspected Fraud", ...noRetry("The issuer suspects fraud.", "Present a generic decline.", "fraud_or_risk") },
  "32": { label: "AVS Declined", ...customer("The address did not match the issuer's records.", "Ask the shopper to check their billing address.") },
  "33": { label: "Card requires online pin", ...customer("The card requires an online PIN.", "Ask the shopper to retry with PIN entry.", "authentication_required") },
  "34": { label: "No checking account available on Card", ...customer("No checking account is linked to the card.", "Ask the shopper to choose another account type or card.") },
  "35": { label: "No savings account available on Card", ...customer("No savings account is linked to the card.", "Ask the shopper to choose another account type or card.") },
  "36": { label: "Mobile pin required", ...customer("The card requires a mobile PIN.", "Ask the shopper to retry with mobile PIN entry.", "authentication_required") },
  "37": { label: "Contactless fallback", ...customer("The contactless payment needs to fall back to chip or swipe.", "Ask the shopper to insert or swipe the card.", "authentication_required") },
  "38": { label: "Authentication required", ...customer("The issuer requires authentication (for example 3D Secure).", "Retry with 3D Secure authentication, with the shopper present.", "authentication_required") },
  "39": { label: "RReq not received from DS", ...later("The 3D Secure result was not received from the directory server.", "Ask the shopper to try again.", "authentication_failed") },
  "42": { label: "3DS Authentication Error", ...later("An error occurred during 3D Secure authentication.", "Ask the shopper to try again.", "authentication_failed") },
};

/** Lookup by refusalReason text when the numeric code is absent. */
export const REFUSAL_REASON_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(REFUSAL_REASONS).map(([code, e]) => [e.label.toLowerCase(), code]),
);

export type ResultCodeInfo = { outcome: "success" | "failure" | "pending" | "unknown"; explanation: string };

export const RESULT_CODES: Record<string, ResultCodeInfo> = {
  Authorised: { outcome: "success", explanation: "The payment was authorized. Authorization is not settlement; capture may still be required." },
  Refused: { outcome: "failure", explanation: "The payment was refused. See the refusal reason for details." },
  Error: { outcome: "failure", explanation: "An error occurred while processing the payment." },
  Cancelled: { outcome: "failure", explanation: "The payment was cancelled before it completed." },
  Pending: { outcome: "pending", explanation: "The final result is not yet known. Wait for the AUTHORISATION webhook." },
  Received: { outcome: "pending", explanation: "The payment request was received; the final result is not yet known. Wait for the webhook." },
  RedirectShopper: { outcome: "pending", explanation: "The shopper must be redirected to complete the payment." },
  IdentifyShopper: { outcome: "pending", explanation: "3D Secure device fingerprinting is required." },
  ChallengeShopper: { outcome: "pending", explanation: "The shopper must complete a 3D Secure challenge." },
  PresentToShopper: { outcome: "pending", explanation: "A voucher or code must be presented to the shopper." },
  PartiallyAuthorised: { outcome: "pending", explanation: "Only part of the amount was authorized." },
  AuthenticationFinished: { outcome: "pending", explanation: "3D Secure authentication finished; the payment still needs to be authorized." },
  AuthenticationNotRequired: { outcome: "pending", explanation: "3D Secure authentication was not required; the payment still needs to be authorized." },
};

export const API_ERROR_TYPES: Record<string, CatalogEntry> = {
  validation: {
    category: "invalid_request",
    explanation: "The request failed validation.",
    nextAction: "Fix the field named in the error message and resend.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
  },
  security: {
    category: "configuration",
    explanation: "The request was rejected for authentication or permission reasons.",
    nextAction: "Check the API key, its roles, and the merchant account.",
    retry: "do_not_retry",
    retryExplanation: "Requests will fail until credentials or permissions are fixed.",
  },
  configuration: {
    category: "configuration",
    explanation: "The account is not configured for this request.",
    nextAction: "Check the payment method and account configuration in the Customer Area.",
    retry: "do_not_retry",
    retryExplanation: "Requests will fail until the configuration is fixed.",
  },
  internal: {
    category: "provider_unavailable",
    explanation: "Adyen reported an internal error. The outcome of the original request is not known from this error.",
    nextAction: "Check whether the payment exists (by merchantReference or webhook) before trying again.",
    retry: "retry_conditionally",
    retryExplanation: "Verify the original request's status first. Retry only with the same idempotency key.",
  },
};

/** Fallback by HTTP status when errorType is missing. */
export const HTTP_STATUS: Record<number, CatalogEntry> = {
  401: { ...API_ERROR_TYPES.security!, explanation: "The API credentials are missing or invalid." },
  403: { ...API_ERROR_TYPES.security!, explanation: "The API credentials lack permission for this request." },
  422: API_ERROR_TYPES.validation!,
  429: {
    category: "rate_limiting",
    explanation: "Too many requests were sent.",
    nextAction: "Back off and retry with delays.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: "Retry with backoff using the same idempotency key.",
  },
  500: API_ERROR_TYPES.internal!,
  503: { ...API_ERROR_TYPES.internal!, explanation: "The service is temporarily unavailable. The outcome of the original request is not known from this error." },
};

export type EventCodeInfo = { stage: LifecycleStage; description: string; /** true: pspReference identifies a modification, originalReference the payment. */ modification: boolean };

/** Standard payment webhook event codes. */
export const EVENT_CODES: Record<string, EventCodeInfo> = {
  AUTHORISATION: { stage: "authorization", description: "Result of an authorization request.", modification: false },
  AUTHORISATION_ADJUSTMENT: { stage: "authorization", description: "Result of an authorization adjustment.", modification: true },
  CANCELLATION: { stage: "cancellation", description: "Result of a cancel request.", modification: true },
  CANCEL_OR_REFUND: { stage: "cancellation", description: "Result of a cancel-or-refund request.", modification: true },
  CAPTURE: { stage: "capture", description: "Result of a capture request. success=true means the request was processed, not that funds settled.", modification: true },
  CAPTURE_FAILED: { stage: "capture", description: "A capture failed at the scheme after initially being accepted.", modification: true },
  REFUND: { stage: "refund", description: "Result of a refund request. success=true means the request was processed, not that the shopper has received funds.", modification: true },
  REFUND_FAILED: { stage: "refund", description: "A refund failed at the scheme after initially being accepted.", modification: true },
  REFUNDED_REVERSED: { stage: "refund", description: "A refund was reversed (funds returned to the merchant).", modification: true },
  REFUND_WITH_DATA: { stage: "refund", description: "Result of an unreferenced refund.", modification: false },
  TECHNICAL_CANCEL: { stage: "cancellation", description: "A technical cancellation.", modification: true },
  VOID_PENDING_REFUND: { stage: "refund", description: "A pending refund was voided.", modification: true },
  EXPIRE: { stage: "cancellation", description: "The remaining authorized amount expired.", modification: true },
  OFFER_CLOSED: { stage: "cancellation", description: "The payment offer expired without completion.", modification: false },
  PENDING: { stage: "payment", description: "The payment is pending at a third party.", modification: false },
  ORDER_OPENED: { stage: "payment", description: "A partial-payment order was opened.", modification: false },
  ORDER_CLOSED: { stage: "payment", description: "A partial-payment order was closed.", modification: false },
  MANUAL_REVIEW_ACCEPT: { stage: "authorization", description: "A payment under manual risk review was accepted.", modification: false },
  MANUAL_REVIEW_REJECT: { stage: "authorization", description: "A payment under manual risk review was rejected.", modification: false },
  CHARGEBACK: { stage: "dispute", description: "A chargeback was booked.", modification: false },
  CHARGEBACK_REVERSED: { stage: "dispute", description: "A chargeback was reversed.", modification: false },
  SECOND_CHARGEBACK: { stage: "dispute", description: "A second chargeback was booked.", modification: false },
  NOTIFICATION_OF_CHARGEBACK: { stage: "dispute", description: "A dispute was opened.", modification: false },
  NOTIFICATION_OF_FRAUD: { stage: "dispute", description: "The issuer reported fraud.", modification: false },
  REQUEST_FOR_INFORMATION: { stage: "dispute", description: "The issuer requested information about a payment.", modification: false },
  PREARBITRATION_WON: { stage: "dispute", description: "Pre-arbitration was decided in the merchant's favor.", modification: false },
  PREARBITRATION_LOST: { stage: "dispute", description: "Pre-arbitration was decided against the merchant.", modification: false },
};
