/**
 * PayPal error and status knowledge, kept as data.
 *
 * Orders v2 errors:      https://developer.paypal.com/api/rest/reference/orders/v2/errors/
 * Payments v2 errors:    `x-errors` in https://developer.paypal.com/api/payments/v2/schema.json
 * HTTP status codes:     https://developer.paypal.com/api/rest/responses/
 * Processor responses:   https://developer.paypal.com/api/orders/v2/definitions/processor_response
 * Webhook event names:   https://developer.paypal.com/api/rest/webhooks/event-names/
 *
 * PayPal does not publish categories or retry guidance. The `category` and
 * `retry` values below are PandaPayLens proposals based on PayPal's wording.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

export const ORDERS_ERRORS_URL =
  "https://developer.paypal.com/api/rest/reference/orders/v2/errors/";
export const RESPONSES_URL = "https://developer.paypal.com/api/rest/responses/";
export const ERRORS_OVERVIEW_URL = "https://developer.paypal.com/api/errors/overview";
export const PAYMENT_FAILURES_URL = "https://developer.paypal.com/api/handle-payment-failures";
export const ORDERS_API_URL = "https://developer.paypal.com/api/orders/v2";
export const PAYMENTS_API_URL = "https://developer.paypal.com/api/payments/v2";
export const PROCESSOR_RESPONSE_URL =
  "https://developer.paypal.com/api/orders/v2/definitions/processor_response";
export const ORDER_STATUS_URL =
  "https://developer.paypal.com/api/orders/v2/definitions/order_status";
export const CAPTURE_STATUS_URL =
  "https://developer.paypal.com/api/orders/v2/definitions/capture_status";
export const AUTHORIZATION_STATUS_URL =
  "https://developer.paypal.com/api/orders/v2/definitions/authorization_status";
export const REFUND_STATUS_URL =
  "https://developer.paypal.com/api/orders/v2/definitions/refund_status";
export const WEBHOOK_EVENTS_URL = "https://developer.paypal.com/api/rest/webhooks/event-names/";
export const WEBHOOKS_URL = "https://developer.paypal.com/api/rest/webhooks/";
export const WEBHOOKS_REST_URL = "https://developer.paypal.com/api/rest/webhooks/rest/";
export const IDEMPOTENCY_URL = "https://developer.paypal.com/api/rest/reference/idempotency/";
export const CARD_DECLINE_URL =
  "https://developer.paypal.com/docs/checkout/advanced/card-decline-errors/";

const noRetry = (
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retryExplanation = "Sending the same request again will fail the same way.",
): CatalogEntry => ({ category, explanation, nextAction, retry: "do_not_retry", retryExplanation });

const customer = (
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retryExplanation = "A new attempt needs the buyer to act first (another payment method, new details, or returning to PayPal).",
): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "customer_action_required",
  retryExplanation,
});

const review = (
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retryExplanation = "Do not retry automatically. A person needs to review the account or transaction first.",
): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "manual_review",
  retryExplanation,
});

const verifyFirst = (
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retryExplanation: string,
): CatalogEntry => ({
  category,
  explanation,
  nextAction,
  retry: "retry_conditionally",
  retryExplanation,
});

const VERIFY_5XX =
  "PayPal documents that a 5xx or network timeout from a capture call could still have created a transaction. Check the order or capture first (GET), and if you retry, send the same PayPal-Request-Id header as before.";

const internalError = verifyFirst(
  "provider_unavailable",
  "PayPal reported an internal server error. The outcome of the original request is not known from this error.",
  "Look up the order or capture before doing anything else. Retry only with the same PayPal-Request-Id.",
  VERIFY_5XX,
);

const rateLimited: CatalogEntry = {
  category: "rate_limiting",
  explanation: "Too many requests were sent; PayPal blocked this one because of rate limiting.",
  nextAction: "Slow down and retry with backoff.",
  retry: "safe_to_retry_technical_request",
  retryExplanation:
    "A rate-limited request was not processed. Retry with backoff and the same PayPal-Request-Id.",
};

const schema = (explanation: string) =>
  noRetry(
    "invalid_request",
    explanation,
    "Fix the field named in details[].field and send a corrected request.",
    "The same request fails validation again.",
  );

const amount = (explanation: string) =>
  noRetry(
    "invalid_amount",
    explanation,
    "Correct the amounts or breakdown and send a new request.",
  );

const accountSetup = (explanation: string) =>
  noRetry(
    "configuration",
    explanation,
    "Check the PayPal account setup, permissions and the API credentials in use.",
    "Requests keep failing until the account or integration is changed.",
  );

/** `details[].issue` values with documented meanings, from Orders v2 (S1) and Payments v2 `x-errors` (S8). */
export const ISSUES: Record<string, CatalogEntry & { api: "orders" | "payments" | "both" }> = {
  INSTRUMENT_DECLINED: {
    api: "both",
    ...customer(
      "card_declined",
      "The processor or bank declined the funding instrument, or it cannot be used for this payment.",
      "Ask the buyer to choose another payment method.",
    ),
  },
  PAYER_ACTION_REQUIRED: {
    api: "orders",
    ...customer(
      "authentication_required",
      "The buyer must return to PayPal to complete the payment, for example for 3-D Secure.",
      "Redirect the buyer to the rel=payer-action link of the order, then try again.",
    ),
  },
  CONTINGENCY_NOT_SUCCESSFUL: {
    api: "orders",
    ...customer(
      "authentication_failed",
      "3-D Secure payer authentication was not successful, so the payment cannot complete.",
      "Ask the buyer to authenticate again or to use another payment method.",
    ),
  },
  ORDER_NOT_APPROVED: {
    api: "orders",
    ...customer(
      "authentication_required",
      "The buyer has not approved the order yet.",
      "Redirect the buyer to the rel=approve link, or provide a payment_source, before authorizing or capturing.",
    ),
  },
  ORDER_ALREADY_CAPTURED: {
    api: "orders",
    ...noRetry(
      "duplicate_request",
      "The order was already captured. With intent=CAPTURE an order allows only one capture.",
      "No action is needed for the payment. GET the order to find the existing capture id.",
      "The capture already exists; capturing again is not possible.",
    ),
  },
  ORDER_ALREADY_AUTHORIZED: {
    api: "orders",
    ...noRetry(
      "duplicate_request",
      "The order was already authorized. With intent=AUTHORIZE an order allows only one authorization.",
      "GET the order to find the existing authorization id.",
      "The authorization already exists; authorizing again is not possible.",
    ),
  },
  ORDER_COMPLETION_IN_PROGRESS: {
    api: "orders",
    ...verifyFirst(
      "duplicate_request",
      "The order completes on payment approval and PayPal is still capturing it.",
      "GET the order instead of capturing it again.",
      "The capture is already in progress. Check the order state first; capturing again is not the fix.",
    ),
  },
  ORDER_AUTHORIZATION_IN_PROGRESS: {
    api: "orders",
    ...verifyFirst(
      "duplicate_request",
      "The order authorizes automatically and PayPal is still authorizing it.",
      "GET the order instead of authorizing it again.",
      "The authorization is already in progress. Check the order state first.",
    ),
  },
  AUTO_CAPTURE_ENABLED: {
    api: "orders",
    ...accountSetup(
      "The order is captured automatically, so a merchant capture call is not allowed.",
    ),
  },
  ORDER_EXPIRED: {
    api: "orders",
    ...noRetry(
      "invalid_request",
      "The order has expired and can no longer be authorized.",
      "Create a new order.",
    ),
  },
  ORDER_COMPLETED_OR_VOIDED: {
    api: "orders",
    ...noRetry(
      "invalid_request",
      "The order was already completed or voided and cannot be authorized.",
      "GET the order to see its final state.",
    ),
  },
  ORDER_ALREADY_COMPLETED: {
    api: "orders",
    ...noRetry(
      "invalid_request",
      "The order was already completed and can no longer be patched.",
      "Create a new order if the details must change.",
    ),
  },
  ACTION_DOES_NOT_MATCH_INTENT: {
    api: "orders",
    ...accountSetup(
      "The call does not match the order intent: authorize was called on a CAPTURE order, or capture on an AUTHORIZE order.",
    ),
  },
  PREVIOUS_REQUEST_IN_PROGRESS: {
    api: "both",
    ...verifyFirst(
      "duplicate_request",
      "Another request for this resource is still in progress, so its outcome is not known yet.",
      "Wait, then GET the resource to see whether the earlier request completed.",
      "Verify the result of the earlier request first. Retry only if it did not complete, with the same PayPal-Request-Id.",
    ),
  },
  DUPLICATE_INVOICE_ID: {
    api: "both",
    ...noRetry(
      "duplicate_request",
      "The account requires a unique invoice_id and this one was already used or captured.",
      "Check whether the earlier transaction with this invoice_id is the one you wanted; use a new invoice_id only for a genuinely new payment.",
      "Sending the same invoice_id again is rejected again.",
    ),
  },
  DUPLICATE_TRANSACTION: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "PayPal detected a duplicate invoice id.",
      "Check the earlier transaction with the same invoice id before creating another.",
    ),
  },
  DUPLICATE_REFUND: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "This invoice_id was already refunded.",
      "Check the existing refund before issuing another.",
    ),
  },
  DUPLICATE_REFERENCE_ID: {
    api: "orders",
    ...schema("purchase_units[].reference_id is duplicated within the order."),
  },
  TRANSACTION_REFUSED: {
    api: "both",
    ...review(
      "fraud_or_risk",
      "The request was refused. For captures, PayPal's internal controls or the processor prevented it.",
      "Review the transaction; contact PayPal support if it persists.",
    ),
  },
  PAYMENT_DENIED: {
    api: "orders",
    ...customer(
      "fraud_or_risk",
      "PayPal declined to process the transaction.",
      "Investigate the transaction and offer the buyer another payment method.",
    ),
  },
  PAYEE_BLOCKED_TRANSACTION: {
    api: "orders",
    ...review(
      "fraud_or_risk",
      "The merchant's own fraud tool (Fraud Protection or Chargeback Protection) declined the transaction.",
      "Review the fraud filter settings and the decision in the PayPal account.",
    ),
  },
  TRANSACTION_BLOCKED_BY_PAYEE: {
    api: "orders",
    ...review(
      "fraud_or_risk",
      "The payee's Fraud Protection settings blocked the transaction.",
      "Review the fraud filter settings and the decision in the PayPal account.",
    ),
  },
  COMPLIANCE_VIOLATION: {
    api: "both",
    ...noRetry(
      "fraud_or_risk",
      "The transaction was declined because of a compliance violation.",
      "Do not resend. Contact PayPal support if you believe this is wrong.",
    ),
  },
  REDIRECT_PAYER_FOR_ALTERNATE_FUNDING: {
    api: "orders",
    ...customer(
      "payment_method_unavailable",
      "Funding failed; the buyer must choose another funding source.",
      "Redirect the buyer to PayPal to pick another funding source.",
    ),
  },
  PAYER_CANNOT_PAY: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "The payer cannot pay for this transaction.",
      "Ask the buyer to use another payment method.",
    ),
  },
  PAYER_ACCOUNT_RESTRICTED: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "The payer's account is restricted.",
      "Ask the buyer to use another payment method.",
    ),
  },
  PAYER_ACCOUNT_LOCKED_OR_CLOSED: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "The payer's account is locked or closed and cannot be used.",
      "Ask the buyer to use another payment method.",
    ),
  },
  MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED: {
    api: "orders",
    ...customer(
      "payment_method_unavailable",
      "Too many payment attempts were made.",
      "Ask the buyer for a different payment method.",
    ),
  },
  CARD_EXPIRED: {
    api: "both",
    ...customer("card_declined", "The card has expired.", "Ask the buyer to use another card."),
  },
  REFERENCED_CARD_EXPIRED: {
    api: "orders",
    ...customer(
      "card_declined",
      "The card behind the token or vaulted reference has expired.",
      "Ask the buyer to add a new card.",
    ),
  },
  INVALID_CARD_NUMBER: {
    api: "payments",
    ...customer(
      "card_declined",
      "The card number is invalid.",
      "Ask the buyer to check the card details or use another card.",
    ),
  },
  CARD_BRAND_NOT_SUPPORTED: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "The card brand is not supported.",
      "Ask the buyer to use another card or method.",
    ),
  },
  CARD_TYPE_NOT_SUPPORTED: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "The card type is not supported.",
      "Ask the buyer to use another card or method.",
    ),
  },
  CARD_COUNTRY_NOT_SUPPORTED: {
    api: "both",
    ...customer(
      "payment_method_unavailable",
      "Cards issued in this country are not supported.",
      "Ask the buyer to use another card or method.",
    ),
  },
  PAYEE_ACCOUNT_RESTRICTED: {
    api: "both",
    ...review(
      "configuration",
      "The merchant (payee) account is restricted.",
      "Contact PayPal support about the account restriction.",
    ),
  },
  PAYEE_ACCOUNT_LOCKED_OR_CLOSED: {
    api: "both",
    ...review(
      "configuration",
      "The merchant (payee) account is locked or closed.",
      "Contact PayPal support about the account.",
    ),
  },
  PAYEE_ACCOUNT_INVALID: { api: "both", ...accountSetup("The payee account is invalid.") },
  INVALID_PAYEE_ACCOUNT: { api: "both", ...accountSetup("The payee account is invalid.") },
  PAYEE_NOT_CONSENTED: {
    api: "both",
    ...accountSetup("The payee has not consented to the API caller acting on its behalf."),
  },
  PERMISSION_DENIED: {
    api: "both",
    ...accountSetup("The API caller has no permission for this resource."),
  },
  PERMISSION_NOT_GRANTED: {
    api: "both",
    ...accountSetup("The API caller has not been granted permission for this resource."),
  },
  NOT_ENABLED_FOR_CARD_PROCESSING: {
    api: "orders",
    ...accountSetup("The account is not set up for card processing."),
  },
  PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING: {
    api: "orders",
    ...accountSetup("The payee account is not set up for card processing."),
  },
  NOT_ENABLED_FOR_PAYMENT_SOURCE: {
    api: "orders",
    ...accountSetup("The account is not set up for this payment source."),
  },
  AUTH_CAPTURE_NOT_ENABLED: {
    api: "orders",
    ...accountSetup("The account is not set up for separate authorization and capture."),
  },
  INVALID_ACCOUNT_STATUS: {
    api: "both",
    ...accountSetup("Account validations failed for the user."),
  },
  TRANSACTION_LIMIT_EXCEEDED: {
    api: "orders",
    ...customer(
      "invalid_amount",
      "The total amount exceeds the transaction limit.",
      "Ask the buyer to use another payment method or split the purchase.",
    ),
  },
  TRANSACTION_RECEIVING_LIMIT_EXCEEDED: {
    api: "orders",
    ...review(
      "configuration",
      "The transaction exceeds the receiver's receiving limit.",
      "Review the receiving limits of the PayPal account.",
    ),
  },
  AMOUNT_MISMATCH: { api: "orders", ...amount("The amount does not match the breakdown totals.") },
  ITEM_TOTAL_MISMATCH: {
    api: "orders",
    ...amount("The item total does not match the sum of the items."),
  },
  TAX_TOTAL_MISMATCH: {
    api: "orders",
    ...amount("The tax total does not match the sum of the item taxes."),
  },
  DISCOUNT_TOTAL_MISMATCH: {
    api: "orders",
    ...amount("The discount total does not match the breakdown."),
  },
  CANNOT_BE_ZERO_OR_NEGATIVE: {
    api: "both",
    ...amount("An amount must be greater than zero."),
  },
  CANNOT_BE_NEGATIVE: { api: "both", ...amount("An amount cannot be negative.") },
  DECIMAL_PRECISION: {
    api: "both",
    ...amount("An amount has more decimal places than the currency allows."),
  },
  DECIMALS_NOT_SUPPORTED: {
    api: "both",
    ...amount("The currency does not support decimal amounts."),
  },
  MAX_VALUE_EXCEEDED: { api: "both", ...amount("An amount exceeds the maximum allowed value.") },
  INVALID_CURRENCY_CODE: { api: "both", ...schema("The currency code is invalid.") },
  CURRENCY_NOT_SUPPORTED: { api: "both", ...schema("The currency is not supported.") },
  MULTI_CURRENCY_ORDER: {
    api: "orders",
    ...schema("The order mixes currencies, which is not allowed."),
  },
  INVALID_PARAMETER_VALUE: { api: "both", ...schema("A field has an invalid value.") },
  MISSING_REQUIRED_PARAMETER: { api: "both", ...schema("A required field is missing.") },
  INVALID_STRING_LENGTH: { api: "both", ...schema("A string field has an invalid length.") },
  INVALID_PARAMETER_SYNTAX: { api: "both", ...schema("A field has invalid syntax.") },
  MALFORMED_REQUEST_JSON: { api: "both", ...schema("The request body is not valid JSON.") },
  INVALID_ARRAY_MAX_ITEMS: { api: "both", ...schema("An array has too many items.") },
  INVALID_ARRAY_MIN_ITEMS: { api: "both", ...schema("An array has too few items.") },
  INVALID_COUNTRY_CODE: { api: "both", ...schema("The country code is invalid.") },
  INVALID_STRING_MAX_LENGTH: { api: "both", ...schema("A string field is too long.") },
  INVALID_ARRAY_LENGTH: { api: "both", ...schema("An array has an invalid length.") },
  INVALID_RESOURCE_ID: {
    api: "both",
    ...noRetry(
      "invalid_request",
      "The resource id does not exist.",
      "Check the order, authorization, capture or refund id and the environment (sandbox or live).",
    ),
  },
  SHIPPING_ADDRESS_INVALID: {
    api: "orders",
    ...customer(
      "invalid_request",
      "The shipping address is invalid.",
      "Ask the buyer to correct the shipping address.",
    ),
  },
  BILLING_ADDRESS_INVALID: {
    api: "orders",
    ...customer(
      "invalid_request",
      "The billing address is invalid.",
      "Ask the buyer to correct the billing address.",
    ),
  },
  POSTAL_CODE_REQUIRED: {
    api: "orders",
    ...customer(
      "invalid_request",
      "A postal code is required for this address.",
      "Ask the buyer to provide the postal code.",
    ),
  },
  TOKEN_EXPIRED: {
    api: "orders",
    ...noRetry(
      "invalid_request",
      "The payment token has expired.",
      "Obtain a new token or vault reference.",
    ),
  },
  TOKEN_ID_NOT_FOUND: {
    api: "orders",
    ...noRetry(
      "invalid_request",
      "The payment token was not found.",
      "Check the token or vault reference.",
    ),
  },
  INVALID_VAULT_ID: {
    api: "orders",
    ...noRetry("invalid_request", "The vault id is invalid.", "Check the vault reference."),
  },
  AUTHORIZATION_EXPIRED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "An expired authorization cannot be captured.",
      "Reauthorize if still allowed, or create a new order.",
    ),
  },
  AUTHORIZATION_VOIDED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "A voided authorization cannot be captured or reauthorized.",
      "Create a new order if the payment is still needed.",
    ),
  },
  AUTHORIZATION_DENIED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "A denied authorization cannot be captured.",
      "Create a new order if the payment is still needed.",
    ),
  },
  AUTHORIZATION_ALREADY_CAPTURED: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "The authorization was already captured; no more captures are allowed after final_capture=true.",
      "GET the authorization to find the existing captures.",
    ),
  },
  PREVIOUSLY_CAPTURED: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "A captured authorization cannot be voided.",
      "Refund the capture instead if money must go back.",
    ),
  },
  PREVIOUSLY_VOIDED: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "The authorization was already voided.",
      "No action is needed for the void.",
    ),
  },
  CANNOT_BE_VOIDED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "A reauthorization cannot be voided.",
      "Void the parent authorization instead.",
    ),
  },
  MAX_CAPTURE_AMOUNT_EXCEEDED: {
    api: "payments",
    ...amount(
      "The capture amount exceeds the allowed limit (by default 115% of the authorization).",
    ),
  },
  MAX_CAPTURE_COUNT_EXCEEDED: {
    api: "payments",
    ...amount("The number of captures exceeds the limit for this authorization."),
  },
  AUTH_CAPTURE_CURRENCY_MISMATCH: {
    api: "payments",
    ...schema("The capture currency differs from the authorization currency."),
  },
  AUTH_CURRENCY_MISMATCH: {
    api: "payments",
    ...schema("The currency differs from the authorization currency."),
  },
  REAUTHORIZATION_TOO_SOON: {
    api: "payments",
    ...verifyFirst(
      "invalid_request",
      "Reauthorization is allowed only once, from day 4 to day 29 of the authorization.",
      "Wait until the honor period has passed, then reauthorize.",
      "A later reauthorization can succeed once the honor period has passed.",
    ),
  },
  REAUTHORIZATION_NOT_SUPPORTED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "Reauthorization is not allowed in this case.",
      "Create a new order if the payment is still needed.",
    ),
  },
  REAUTHORIZATION_NOT_SUPPORTED_FOR_PAYMENT_SOURCE: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "Reauthorization is not supported for this payment source.",
      "Create a new order if the payment is still needed.",
    ),
  },
  REAUTHORIZATION_DECLINED_BY_PROCESSOR: {
    api: "payments",
    ...customer(
      "card_declined",
      "The processor declined the reauthorization.",
      "Ask the buyer for another payment method.",
    ),
  },
  AUTHORIZATION_AMOUNT_EXCEEDED: {
    api: "both",
    ...amount("The authorization amount exceeds the allowable limit."),
  },
  MULTIPLE_AUTHORIZATIONS_FOUND: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "More than one authorization matches the invoice_id, so it cannot be voided this way.",
      "Void each authorization by its id.",
    ),
  },
  CAPTURE_FULLY_REFUNDED: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "The capture is already fully refunded.",
      "No further refund is possible for this capture.",
    ),
  },
  CAPTURED_AMOUNT_FULLY_REFUNDED: {
    api: "payments",
    ...noRetry(
      "duplicate_request",
      "The captured amount is already fully refunded.",
      "No further refund is possible for this capture.",
    ),
  },
  REFUND_AMOUNT_EXCEEDED: {
    api: "payments",
    ...amount(
      "The refund amount is greater than the part of the capture that has not been refunded yet.",
    ),
  },
  MAX_NUMBER_OF_REFUNDS_EXCEEDED: {
    api: "payments",
    ...review(
      "invalid_request",
      "The number of refunds allowed for this capture was exceeded.",
      "Contact PayPal support.",
    ),
  },
  MAX_REFUND_LIMIT_EXCEEDED: {
    api: "payments",
    ...review("invalid_amount", "A refund limit was exceeded.", "Review the refund limits."),
  },
  MAX_PAYER_AMOUNT_LIMIT_EXCEEDED: {
    api: "payments",
    ...review("invalid_amount", "A payer amount limit was exceeded.", "Review the refund limits."),
  },
  MAX_PAYEE_AMOUNT_LIMIT_EXCEEDED: {
    api: "payments",
    ...review("invalid_amount", "A payee amount limit was exceeded.", "Review the refund limits."),
  },
  PAYER_REFUND_AMOUNT_LIMIT_EXCEEDED: {
    api: "payments",
    ...review(
      "invalid_amount",
      "The payer's refund amount limit was exceeded.",
      "Review the refund limits.",
    ),
  },
  PAYEE_REFUND_AMOUNT_LIMIT_EXCEEDED: {
    api: "payments",
    ...review(
      "invalid_amount",
      "The payee's refund amount limit was exceeded.",
      "Review the refund limits.",
    ),
  },
  REFUND_TIME_LIMIT_EXCEEDED: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "The refund window for this capture has passed.",
      "Return funds to the buyer another way if needed.",
    ),
  },
  REFUND_TIME_EXCEEDED_FOR_PAYMENT_SOURCE: {
    api: "payments",
    ...noRetry(
      "invalid_request",
      "The refund window for this payment source has passed.",
      "Return funds to the buyer another way if needed.",
    ),
  },
  PARTIAL_REFUND_NOT_ALLOWED: {
    api: "payments",
    ...amount("Only a full refund is allowed for this capture."),
  },
  TRANSACTION_DISPUTED: {
    api: "payments",
    ...review(
      "fraud_or_risk",
      "A partial refund is not possible while a case is open for this transaction.",
      "Resolve the open case first.",
    ),
  },
  REFUND_NOT_PERMITTED_DUE_TO_CHARGEBACK: {
    api: "payments",
    ...review(
      "fraud_or_risk",
      "A refund is not possible because of a chargeback.",
      "Handle the chargeback instead.",
    ),
  },
  PENDING_CAPTURE: {
    api: "payments",
    ...verifyFirst(
      "invalid_request",
      "The capture is still pending (for example an eCheck or bank payment), so it cannot be refunded yet.",
      "Wait until the capture completes, then refund.",
      "A refund can succeed once the capture has completed. Check the capture status first.",
    ),
  },
  REFUND_FAILED_INSUFFICIENT_FUNDS: {
    api: "payments",
    ...review(
      "insufficient_funds",
      "The merchant balance or linked bank account does not have enough funds for the refund.",
      "Add funds to the PayPal account, then refund again.",
    ),
  },
  REFUND_FUNDS_NOT_AVAILABLE: {
    api: "payments",
    ...review(
      "insufficient_funds",
      "There is no valid funding instrument to refund from.",
      "Check the funding setup of the PayPal account.",
    ),
  },
  REFUND_NOT_ALLOWED: {
    api: "payments",
    ...review("fraud_or_risk", "The refund was refused by policy.", "Review the transaction."),
  },
  REFUND_IS_RESTRICTED: {
    api: "payments",
    ...review("fraud_or_risk", "The refund is restricted.", "Review the transaction."),
  },
  REFUND_TRANSACTION_REFUSED: {
    api: "payments",
    ...review(
      "fraud_or_risk",
      "The refund was refused by PayPal's controls.",
      "Review the transaction.",
    ),
  },
  REFUND_NOT_SUPPORTED_FOR_PAYMENT_SOURCE: {
    api: "payments",
    ...review(
      "payment_method_unavailable",
      "The payment source does not support refunds.",
      "Return funds to the buyer another way.",
    ),
  },
  REFUND_FAILED_BY_PAYMENT_SOURCE: {
    api: "payments",
    ...review(
      "payment_method_unavailable",
      "The payment source refused the refund.",
      "Return funds to the buyer another way.",
    ),
  },
  REFUND_REFUSED_BY_PROCESSOR: {
    api: "payments",
    ...review(
      "payment_method_unavailable",
      "The processor refused the refund.",
      "Return funds to the buyer another way.",
    ),
  },
  REFUND_CAPTURE_CURRENCY_MISMATCH: {
    api: "payments",
    ...amount("The refund currency differs from the capture currency."),
  },
  REFUND_CURRENCY_MISMATCH: { api: "payments", ...amount("The refund currency is not allowed.") },
  REFUND_AMOUNT_TOO_LOW: {
    api: "payments",
    ...amount("The refund amount becomes zero after currency conversion."),
  },
  CANNOT_REFUND_SELF: {
    api: "payments",
    ...noRetry("invalid_request", "Payer and payee are the same account.", "Do not resend."),
  },
  KYC_HOLD: {
    api: "payments",
    ...review(
      "configuration",
      "The request is on hold because the merchant's identity verification (KYC) is incomplete.",
      "Complete the verification in the PayPal account.",
    ),
  },
  RATE_LIMIT_REACHED: { api: "payments", ...rateLimited },
  INTERNAL_SERVER_ERROR: { api: "payments", ...internalError },
};

/** Top-level `name` values and their documented HTTP status (S2, S3). */
export const ERROR_NAMES: Record<string, { http: number; entry: CatalogEntry | null }> = {
  INVALID_REQUEST: {
    http: 400,
    entry: schema("The request is malformed or fails schema validation."),
  },
  AUTHENTICATION_FAILURE: {
    http: 401,
    entry: noRetry(
      "configuration",
      "The API credentials are missing or invalid. This is about API authentication, not buyer 3-D Secure.",
      "Check the access token, client id and environment (sandbox or live).",
      "Requests keep failing until the credentials are fixed.",
    ),
  },
  NOT_AUTHORIZED: {
    http: 403,
    entry: noRetry(
      "configuration",
      "The credentials are valid but lack permission or scope for this request.",
      "Check the permissions and scopes granted to the API credentials.",
      "Requests keep failing until the permissions are fixed.",
    ),
  },
  RESOURCE_NOT_FOUND: {
    http: 404,
    entry: noRetry(
      "invalid_request",
      "The resource or URI was not found.",
      "Check the id, the path and the environment (sandbox or live).",
    ),
  },
  METHOD_NOT_SUPPORTED: {
    http: 405,
    entry: noRetry(
      "invalid_request",
      "The HTTP method is not supported.",
      "Use the documented method.",
    ),
  },
  MEDIA_TYPE_NOT_ACCEPTABLE: {
    http: 406,
    entry: noRetry(
      "invalid_request",
      "PayPal cannot produce the media type in the Accept header.",
      "Request a media type that PayPal can produce.",
    ),
  },
  RESOURCE_CONFLICT: {
    http: 409,
    entry: verifyFirst(
      "duplicate_request",
      "The request conflicts with another request that is in progress.",
      "Wait, then GET the resource to see whether the earlier request completed.",
      "PayPal says to retry later. Verify the earlier request's result first and reuse the same PayPal-Request-Id.",
    ),
  },
  UNSUPPORTED_MEDIA_TYPE: {
    http: 415,
    entry: noRetry(
      "invalid_request",
      "The request Content-Type is not supported.",
      "Send the request with a supported Content-Type.",
    ),
  },
  // 422 is decided by details[].issue; the name alone carries no category.
  UNPROCESSABLE_ENTITY: { http: 422, entry: null },
  RATE_LIMIT_REACHED: { http: 429, entry: rateLimited },
  INTERNAL_SERVER_ERROR: { http: 500, entry: internalError },
  SERVICE_UNAVAILABLE: {
    http: 503,
    entry: verifyFirst(
      "provider_unavailable",
      "PayPal is temporarily unavailable (maintenance). The outcome of the original request is not known from this error.",
      "Look up the order or capture before retrying.",
      VERIFY_5XX,
    ),
  },
};

/** PayPal's own examples sometimes spell UNPROCESSABLE_ENTITY with a double C. */
export const ERROR_NAME_ALIASES: Record<string, string> = {
  UNPROCCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
};

/** OAuth (identity) error names (S2). Used for recognition only. */
export const OAUTH_ERROR_NAMES = new Set([
  "INVALID_CLIENT",
  "INVALID_AUTHZ_CODE",
  "INVALID_REDIRECT_URI",
  "INVALID_TOKEN",
  "UNAUTHORIZED_CLIENT",
  "UNSUPPORTED_GRANT_TYPE",
  "INVALID_RESPONSE_TYPE",
  "INVALID_USER",
  "RISK_DECLINE",
  "REMEMBER_ME_EXPIRED",
]);

export type ProcessorCode = {
  /** The S9 token for the code. */
  token: string;
  /** Approved codes carry no error. */
  approved?: boolean;
  /** Absent when the token alone does not justify a category. */
  entry?: CatalogEntry;
};

const card = (nextAction = "Ask the buyer to use another card or payment method.") =>
  customer("card_declined", "The card issuer or processor declined the card.", nextAction);

const proc = (token: string, entry?: CatalogEntry, approved = false): ProcessorCode => ({
  token,
  ...(entry ? { entry } : {}),
  ...(approved ? { approved } : {}),
});

const processorUnavailable = verifyFirst(
  "provider_unavailable",
  "The processor reported a system problem.",
  "Check the capture status, then try again later.",
  "A later attempt may succeed. Check the current state of the order before retrying, and reuse the same PayPal-Request-Id.",
);

/** `processor_response.response_code` values with their S9 tokens (subset documented in the research). */
export const PROCESSOR_RESPONSE_CODES: Record<string, ProcessorCode> = {
  "0000": proc("APPROVED", undefined, true),
  "00N7": proc(
    "CVV2_FAILURE_POSSIBLE_RETRY_WITH_CVV",
    customer(
      "card_declined",
      "The CVV check failed.",
      "Ask the buyer to re-enter the card security code.",
    ),
  ),
  "0100": proc("REFERRAL", card("Ask the buyer to contact the issuer or use another card.")),
  "0390": proc("ACCOUNT_NOT_FOUND", card()),
  "0500": proc("DO_NOT_HONOR", card()),
  "0580": proc("UNAUTHORIZED_TRANSACTION", card()),
  "0800": proc(
    "BAD_RESPONSE_REVERSAL_REQUIRED",
    review(
      "provider_unavailable",
      "The processor returned a bad response and a reversal is required.",
      "Check the transaction in the PayPal account before acting.",
    ),
  ),
  "0880": proc(
    "CRYPTOGRAPHIC_FAILURE",
    noRetry("configuration", "A cryptographic failure occurred.", "Contact PayPal support."),
  ),
  "0890": proc("UNACCEPTABLE_PIN", card()),
  "0960": proc("SYSTEM_MALFUNCTION", processorUnavailable),
  "0R00": proc("CANCELLED_PAYMENT", card()),
  "1000": proc(
    "PARTIAL_AUTHORIZATION",
    review(
      "invalid_amount",
      "Only part of the amount was authorized.",
      "Review the authorized amount before capturing.",
    ),
  ),
  "10BR": proc("ISSUER_REJECTED", card()),
  "1300": proc(
    "INVALID_DATA_FORMAT",
    noRetry(
      "invalid_request",
      "The processor rejected the data format.",
      "Check the request data.",
    ),
  ),
  "1310": proc(
    "INVALID_AMOUNT",
    noRetry("invalid_amount", "The processor rejected the amount.", "Check the amount."),
  ),
  "1312": proc("INVALID_TRANSACTION_CARD_ISSUER_ACQUIRER", card()),
  "1317": proc(
    "INVALID_CAPTURE_DATE",
    noRetry("invalid_request", "The capture date is invalid.", "Check the capture timing."),
  ),
  "1320": proc(
    "INVALID_CURRENCY_CODE",
    noRetry("invalid_request", "The processor rejected the currency.", "Check the currency."),
  ),
  "1330": proc("INVALID_ACCOUNT", card()),
  "1335": proc("INVALID_ACCOUNT_RECURRING", card()),
  "1340": proc(
    "INVALID_TERMINAL",
    noRetry("configuration", "The terminal configuration is invalid.", "Contact PayPal support."),
  ),
  "1350": proc(
    "INVALID_MERCHANT",
    noRetry("configuration", "The merchant configuration is invalid.", "Contact PayPal support."),
  ),
  "1352": proc("RESTRICTED_OR_INACTIVE_ACCOUNT", card()),
  "1360": proc(
    "BAD_PROCESSING_CODE",
    noRetry("configuration", "The processing code is invalid.", "Contact PayPal support."),
  ),
  "1370": proc(
    "INVALID_MCC",
    noRetry("configuration", "The merchant category code is invalid.", "Contact PayPal support."),
  ),
  "1380": proc(
    "INVALID_EXPIRATION",
    card("Ask the buyer to check the expiry date or use another card."),
  ),
  "1382": proc(
    "INVALID_CARD_VERIFICATION_VALUE",
    card("Ask the buyer to re-enter the card security code."),
  ),
  "1384": proc(
    "INVALID_LIFE_CYCLE_OF_TRANSACTION",
    noRetry("invalid_request", "The transaction lifecycle is invalid.", "Check the order state."),
  ),
  "1390": proc(
    "INVALID_ORDER",
    noRetry("invalid_request", "The processor rejected the order.", "Check the order."),
  ),
  "1393": proc(
    "TRANSACTION_CANNOT_BE_COMPLETED",
    noRetry("invalid_request", "The transaction cannot be completed.", "Check the order."),
  ),
  "5100": proc("GENERIC_DECLINE", card()),
  "5110": proc("CVV2_FAILURE", card("Ask the buyer to re-enter the card security code.")),
  "5120": proc(
    "INSUFFICIENT_FUNDS",
    customer(
      "insufficient_funds",
      "The card has insufficient funds.",
      "Ask the buyer to use another card or payment method.",
    ),
  ),
  "5130": proc("INVALID_PIN", card()),
  "5135": proc("DECLINED_PIN_TRY_EXCEEDED", card()),
  "5140": proc("CARD_CLOSED", card()),
  "5150": proc(
    "PICKUP_CARD_SPECIAL_CONDITIONS",
    customer(
      "fraud_or_risk",
      "The issuer flagged the card (pick up card, special conditions).",
      "Ask the buyer to use another card. Do not retry the same card.",
      "PayPal: try another card, do not retry the same card.",
    ),
  ),
  "5160": proc("UNAUTHORIZED_USER", card()),
  "5170": proc("AVS_FAILURE", card("Ask the buyer to check the billing address.")),
  "5180": proc(
    "INVALID_OR_RESTRICTED_CARD",
    customer(
      "card_declined",
      "The card is invalid or restricted.",
      "Ask the buyer to use another card.",
      "PayPal: do not retry the same card.",
    ),
  ),
  "5190": proc("SOFT_AVS", card("Ask the buyer to check the billing address.")),
  "5200": proc(
    "DUPLICATE_TRANSACTION",
    noRetry(
      "duplicate_request",
      "The processor saw this as a duplicate transaction.",
      "Check for an earlier successful transaction before creating another.",
    ),
  ),
  "5210": proc(
    "INVALID_TRANSACTION",
    noRetry(
      "card_declined",
      "The processor rejected the transaction as invalid.",
      "Review the transaction.",
    ),
  ),
  "5400": proc("EXPIRED_CARD", card("Ask the buyer to use a card that has not expired.")),
  "5500": proc("INCORRECT_PIN_REENTER", card()),
  "5650": proc(
    "DECLINED_SCA_REQUIRED",
    customer(
      "authentication_required",
      "Strong customer authentication is required.",
      "Have the buyer complete 3-D Secure, then try again.",
    ),
  ),
  "5700": proc(
    "TRANSACTION_NOT_PERMITTED",
    noRetry(
      "card_declined",
      "The transaction is outside the scope of accepted business.",
      "Do not resend this transaction with this card.",
    ),
  ),
  "5710": proc("TX_ATTEMPTS_EXCEED_LIMIT", card()),
  "5800": proc(
    "REVERSAL_REJECTED",
    review(
      "unknown",
      "The processor rejected a reversal.",
      "Check the transaction in the PayPal account.",
    ),
  ),
  "5900": proc("INVALID_ISSUE", card()),
  "5910": proc(
    "ISSUER_NOT_AVAILABLE_NOT_RETRIABLE",
    noRetry(
      "provider_unavailable",
      "The issuer is not available and the processor marked this as not retriable.",
      "Ask the buyer for another payment method.",
    ),
  ),
  "5920": proc(
    "ISSUER_NOT_AVAILABLE_RETRIABLE",
    verifyFirst(
      "provider_unavailable",
      "The issuer is not available; the processor marked this as retriable.",
      "Try again later.",
      "A later attempt may succeed. Check the order state first and reuse the same PayPal-Request-Id.",
    ),
  ),
  "5930": proc("CARD_NOT_ACTIVATED", card()),
  "5950": proc(
    "DECLINED_DUE_TO_UPDATED_ACCOUNT",
    card("An updated card has been issued; ask the buyer to use the new card."),
  ),
  "6300": proc("ACCOUNT_NOT_ON_FILE", card()),
  "7600": proc("APPROVED_NON_CAPTURE", undefined, true),
  "7700": proc(
    "ERROR_3DS",
    customer(
      "authentication_failed",
      "3-D Secure failed.",
      "Ask the buyer to authenticate again or use another method.",
    ),
  ),
  "7710": proc(
    "AUTHENTICATION_FAILED",
    customer(
      "authentication_failed",
      "Authentication failed.",
      "Ask the buyer to authenticate again or use another method.",
    ),
  ),
  "7800": proc("BIN_ERROR", card()),
  "7900": proc("PIN_ERROR", card()),
  "8000": proc("PROCESSOR_SYSTEM_ERROR", processorUnavailable),
  "8010": proc("HOST_KEY_ERROR", processorUnavailable),
  "8020": proc(
    "CONFIGURATION_ERROR",
    noRetry(
      "configuration",
      "The processor reported a configuration error.",
      "Contact PayPal support.",
    ),
  ),
  "8030": proc(
    "UNSUPPORTED_OPERATION",
    noRetry("configuration", "The operation is not supported.", "Contact PayPal support."),
  ),
  "8100": proc(
    "FATAL_COMMUNICATION_ERROR",
    review(
      "network_or_timeout",
      "A fatal communication error occurred with the processor.",
      "Check the transaction state in the PayPal account before acting.",
    ),
  ),
  "8110": proc("RETRIABLE_COMMUNICATION_ERROR", {
    category: "network_or_timeout",
    explanation: "A retriable communication error occurred with the processor.",
    nextAction: "Retry the request.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "The processor marked this communication error as retriable. Reuse the same PayPal-Request-Id.",
  }),
  "8220": proc("SYSTEM_UNAVAILABLE", processorUnavailable),
  "9100": proc(
    "DECLINED_PLEASE_RETRY",
    verifyFirst(
      "card_declined",
      "The processor declined but asked for a retry.",
      "Retry once after a short delay.",
      "PayPal's guidance for this code is to retry. Check the order state first.",
    ),
  ),
  "9500": proc(
    "SUSPECTED_FRAUD",
    customer(
      "fraud_or_risk",
      "The issuer suspects fraud.",
      "Ask the buyer to use another card. Do not retry the same card.",
      "PayPal: do not retry the same card.",
    ),
  ),
  "9510": proc(
    "SECURITY_VIOLATION",
    noRetry(
      "fraud_or_risk",
      "The processor reported a security violation.",
      "Review the transaction.",
    ),
  ),
  "9520": proc(
    "LOST_OR_STOLEN",
    customer(
      "fraud_or_risk",
      "The card was reported lost or stolen.",
      "Do not retry the same card.",
      "PayPal: do not retry the same card.",
    ),
  ),
  "9530": proc(
    "HOLD_CALL_CENTER",
    review(
      "fraud_or_risk",
      "The issuer asks for a call to its call center.",
      "Ask the buyer to contact the issuer.",
    ),
  ),
  "9540": proc("REFUSED_CARD", card()),
  "9600": proc("UNRECOGNIZED_RESPONSE_CODE"),
  PCNR: proc(
    "CONTINGENCIES_NOT_RESOLVED",
    customer(
      "authentication_required",
      "Contingencies such as 3-D Secure were not resolved.",
      "Have the buyer complete the required authentication.",
    ),
  ),
  PCVV: proc("CVV_FAILURE", card("Ask the buyer to re-enter the card security code.")),
  PP06: proc("ACCOUNT_CLOSED", card()),
  PPRN: proc(
    "REATTEMPT_NOT_PERMITTED",
    noRetry("card_declined", "A reattempt is not permitted.", "Do not retry this transaction."),
  ),
  PPIF: proc(
    "IDEMPOTENCY_FAILURE",
    noRetry(
      "duplicate_request",
      "The request failed an idempotency check.",
      "Check for an earlier request with the same PayPal-Request-Id.",
    ),
  ),
  PPER: proc("INTERNAL_SYSTEM_ERROR", processorUnavailable),
  PPNT: proc("NETWORK_ERROR", {
    ...processorUnavailable,
    category: "network_or_timeout",
    explanation: "A network error occurred.",
  }),
  PPEF: proc("EXPIRED_FUNDING_INSTRUMENT", card()),
  PPEX: proc("EXPIRY_DATE", card()),
  PPDT: proc(
    "DECLINE_THRESHOLD_BREACH",
    noRetry("rate_limiting", "A decline threshold was breached.", "Stop retrying this card."),
  ),
  PPEL: proc(
    "EXCEEDS_FREQUENCY_LIMIT",
    noRetry("rate_limiting", "A frequency limit was exceeded.", "Stop retrying this card."),
  ),
  PPNL: proc(
    "EXCEEDS_NETWORK_FREQUENCY_LIMIT",
    noRetry("rate_limiting", "A network frequency limit was exceeded.", "Stop retrying this card."),
  ),
  // Tokens only; PayPal gives no guidance that would justify a category.
  PPAD: proc("BILLING_ADDRESS"),
  PPCT: proc("CARD_TYPE_UNSUPPORTED"),
  PPCU: proc("CURRENCY_USED_INVALID"),
  PPFV: proc("FIELD_VALIDATION_FAILED"),
  PPVE: proc("VALIDATION_ERROR"),
};

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome; description: string };

/** Order status (`order_status`). The order status never decides the payment outcome. */
export const ORDER_STATUSES: Record<string, StatusInfo> = {
  CREATED: { stage: "payment", outcome: "pending", description: "The order was created." },
  SAVED: {
    stage: "payment",
    outcome: "pending",
    description: "The order was saved and stays in progress until a final capture.",
  },
  APPROVED: {
    stage: "payment",
    outcome: "pending",
    description:
      "The buyer approved the payment. No money has moved; the order still needs to be captured or authorized.",
  },
  PAYER_ACTION_REQUIRED: {
    stage: "authentication",
    outcome: "pending",
    description: "The buyer must act (for example 3-D Secure) via the rel=payer-action link.",
  },
  VOIDED: { stage: "void", outcome: "success", description: "All purchase units were voided." },
  COMPLETED: {
    stage: "payment",
    outcome: "unknown",
    description:
      "The order intent completed. This does not mean it was paid: check purchase_units[].payments.captures[].status (or the authorization) before fulfilling.",
  },
};

/** Capture status (`capture_status`). */
export const CAPTURE_STATUSES: Record<string, StatusInfo> = {
  COMPLETED: {
    stage: "capture",
    outcome: "success",
    description: "Funds were credited to the payee's PayPal account.",
  },
  DECLINED: {
    stage: "capture",
    outcome: "failure",
    description: "The funds could not be captured.",
  },
  FAILED: {
    stage: "capture",
    outcome: "failure",
    description: "An error occurred while capturing.",
  },
  PENDING: {
    stage: "capture",
    outcome: "pending",
    description: "The funds are not credited yet; see status_details. Do not fulfill yet.",
  },
  PARTIALLY_REFUNDED: {
    stage: "capture",
    outcome: "success",
    description: "The capture succeeded; less than the captured amount was refunded since.",
  },
  REFUNDED: {
    stage: "capture",
    outcome: "success",
    description: "The capture succeeded; an amount equal to or greater than it was refunded since.",
  },
};

/** Authorization status (`authorization_status`). */
export const AUTHORIZATION_STATUSES: Record<string, StatusInfo> = {
  CREATED: {
    stage: "authorization",
    outcome: "success",
    description: "The authorization exists and has no captures yet. Funds are not captured.",
  },
  CAPTURED: {
    stage: "authorization",
    outcome: "success",
    description: "The authorization has one or more captures.",
  },
  PARTIALLY_CAPTURED: {
    stage: "authorization",
    outcome: "success",
    description: "Part of the authorization was captured.",
  },
  DENIED: {
    stage: "authorization",
    outcome: "failure",
    description: "PayPal cannot authorize the payment.",
  },
  PENDING: {
    stage: "authorization",
    outcome: "pending",
    description: "The authorization is pending; see status_details.",
  },
  VOIDED: {
    stage: "void",
    outcome: "success",
    description: "The authorization was voided; no further captures are possible.",
  },
};

/** Refund status (`refund_status`). */
export const REFUND_STATUSES: Record<string, StatusInfo> = {
  COMPLETED: { stage: "refund", outcome: "success", description: "The refund completed." },
  PENDING: { stage: "refund", outcome: "pending", description: "The refund is pending." },
  FAILED: { stage: "refund", outcome: "failure", description: "The refund failed." },
  CANCELLED: { stage: "refund", outcome: "failure", description: "The refund was cancelled." },
};

/** `status_details.reason` values for captures, authorizations and refunds. */
export const STATUS_REASONS: Record<string, string> = {
  BUYER_COMPLAINT: "The buyer filed a complaint.",
  CHARGEBACK: "A chargeback was filed.",
  ECHECK: "An eCheck has not cleared yet.",
  INTERNATIONAL_WITHDRAWAL: "International withdrawal.",
  OTHER: "Other reason.",
  PENDING_REVIEW: "The payment is under manual review.",
  RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION:
    "The payee's receiving preferences require manual action (for example a currency the payee does not hold).",
  REFUNDED: "The payment was refunded.",
  TRANSACTION_APPROVED_AWAITING_FUNDING: "Approved, awaiting funding (manual EFT).",
  UNILATERAL: "The payee does not have a PayPal account.",
  VERIFICATION_REQUIRED: "The payee's account is not verified.",
  DECLINED_BY_RISK_FRAUD_FILTERS: "The payee's risk or fraud filters declined the payment.",
};

export const RISK_FILTER_DECLINE: CatalogEntry = review(
  "fraud_or_risk",
  "The payee's risk or fraud filters declined the payment.",
  "Review the fraud filter decision in the PayPal account.",
);

export type ResourceKind = "capture" | "authorization" | "refund";

export type WebhookEventInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  /** What `resource` holds. `capture_or_refund`: not documented, inferred from the resource. */
  resource: "order" | ResourceKind | "capture_or_refund";
  description: string;
};

/** Event names in scope (S11 Payments v2, Orders v2 and Checkout buyer approval). */
export const WEBHOOK_EVENTS: Record<string, WebhookEventInfo> = {
  "CHECKOUT.ORDER.APPROVED": {
    stage: "payment",
    outcome: "pending",
    resource: "order",
    description:
      "A buyer approved a checkout order. Approval is not capture; capture the payment next.",
  },
  "CHECKOUT.ORDER.COMPLETED": {
    stage: "payment",
    outcome: "unknown",
    resource: "order",
    description:
      "A checkout order was processed (marketplaces and platforms). The payment outcome comes from the capture, not from this event.",
  },
  "CHECKOUT.PAYMENT-APPROVAL.REVERSED": {
    stage: "cancellation",
    outcome: "success",
    resource: "order",
    description:
      "A problem occurred after the buyer approved the order but before it was captured. PayPal cancels the order and refunds the buyer.",
  },
  "PAYMENT.AUTHORIZATION.CREATED": {
    stage: "authorization",
    outcome: "success",
    resource: "authorization",
    description: "A payment authorization was created. Funds are not captured yet.",
  },
  "PAYMENT.AUTHORIZATION.VOIDED": {
    stage: "void",
    outcome: "success",
    resource: "authorization",
    description: "The authorization was voided, manually or at the end of its 30-day validity.",
  },
  "PAYMENT.CAPTURE.COMPLETED": {
    stage: "capture",
    outcome: "success",
    resource: "capture",
    description: "A payment capture completed.",
  },
  "PAYMENT.CAPTURE.DECLINED": {
    stage: "capture",
    outcome: "failure",
    resource: "capture",
    description: "A payment capture was declined.",
  },
  "PAYMENT.CAPTURE.DENIED": {
    stage: "capture",
    outcome: "failure",
    resource: "capture",
    description: "A payment capture was denied.",
  },
  "PAYMENT.CAPTURE.PENDING": {
    stage: "capture",
    outcome: "pending",
    resource: "capture",
    description: "The capture is pending. Do not fulfill until it completes.",
  },
  "PAYMENT.CAPTURE.REFUNDED": {
    stage: "refund",
    outcome: "success",
    resource: "capture_or_refund",
    description: "A merchant refunded a payment capture.",
  },
  "PAYMENT.CAPTURE.REVERSED": {
    stage: "reversal",
    outcome: "unknown",
    resource: "capture_or_refund",
    description: "PayPal reversed a payment capture.",
  },
  "PAYMENT.REFUND.PENDING": {
    stage: "refund",
    outcome: "pending",
    resource: "refund",
    description: "A refund is pending (for example an eCheck-funded refund).",
  },
  "PAYMENT.REFUND.FAILED": {
    stage: "refund",
    outcome: "failure",
    resource: "refund",
    description: "A refund failed.",
  },
};

/** Event name prefixes of families that are recognized but not analyzed. */
export const UNSUPPORTED_EVENT_FAMILIES: { prefix: string; family: string }[] = [
  { prefix: "BILLING.SUBSCRIPTION.", family: "Subscriptions" },
];
