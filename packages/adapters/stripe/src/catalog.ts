/**
 * Stripe error knowledge, kept as data so it can be reviewed and versioned.
 *
 * Stripe distinguishes three layers and the decoder keeps them apart:
 * - `code`: the API error code (https://docs.stripe.com/error-codes)
 * - `decline_code`: the issuer's reason for a card decline (https://docs.stripe.com/declines/codes)
 * - `advice_code`: Stripe's retry advice for a decline, when present
 *
 * Precedence for retry guidance: advice_code > decline_code > code > error type.
 */

import type { ErrorCategory, RetryGuidance } from "@pandapaylens/core";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

const ERROR_CODES_URL = "https://docs.stripe.com/error-codes";
const DECLINE_CODES_URL = "https://docs.stripe.com/declines/codes";

export const docsForCode = (code: string) =>
  /^[a-z0-9_]{1,64}$/.test(code)
    ? `${ERROR_CODES_URL}#${code.replace(/_/g, "-")}`
    : ERROR_CODES_URL;
export const docsForDecline = () => DECLINE_CODES_URL;

const customerNewMethod =
  "Ask the customer to use a different payment method or contact their card issuer.";

export const DECLINE_CODES: Record<string, CatalogEntry> = {
  insufficient_funds: {
    category: "insufficient_funds",
    explanation: "The card has insufficient funds to complete the purchase.",
    nextAction: "Ask the customer to use an alternative payment method or try again later.",
    retry: "customer_action_required",
    retryExplanation:
      "Retrying the same card immediately is unlikely to succeed. A later attempt may succeed if funds become available.",
  },
  generic_decline: {
    category: "card_declined",
    explanation: "The issuer declined the card without giving a specific reason.",
    nextAction: "Ask the customer to contact their card issuer or use a different payment method.",
    retry: "customer_action_required",
    retryExplanation:
      "Do not retry automatically. The customer needs to resolve this with their issuer or choose another method.",
  },
  do_not_honor: {
    category: "card_declined",
    explanation: "The issuer declined the card for an unspecified reason.",
    nextAction: "Ask the customer to contact their card issuer for more information.",
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically.",
  },
  card_not_supported: {
    category: "payment_method_unavailable",
    explanation: "The card does not support this type of purchase.",
    nextAction: "Ask the customer to use a different card or payment method.",
    retry: "do_not_retry",
    retryExplanation: "The same card will be declined again for this purchase type.",
  },
  currency_not_supported: {
    category: "payment_method_unavailable",
    explanation: "The card does not support the specified currency.",
    nextAction: "Ask the customer to use a card that supports this currency.",
    retry: "do_not_retry",
    retryExplanation: "The same card and currency combination will be declined again.",
  },
  expired_card: {
    category: "card_declined",
    explanation: "The card has expired.",
    nextAction: "Ask the customer to use another card.",
    retry: "customer_action_required",
    retryExplanation: "The same card details will be declined again.",
  },
  incorrect_cvc: {
    category: "card_declined",
    explanation: "The CVC number is incorrect.",
    nextAction: "Ask the customer to re-enter their card details.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details entered by the customer.",
  },
  invalid_cvc: {
    category: "card_declined",
    explanation: "The CVC number is invalid.",
    nextAction: "Ask the customer to re-enter their card details.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details entered by the customer.",
  },
  incorrect_number: {
    category: "card_declined",
    explanation: "The card number is incorrect.",
    nextAction: "Ask the customer to re-enter their card details.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details entered by the customer.",
  },
  incorrect_zip: {
    category: "card_declined",
    explanation: "The postal code is incorrect.",
    nextAction: "Ask the customer to re-enter their billing details.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details entered by the customer.",
  },
  authentication_required: {
    category: "authentication_required",
    explanation: "The issuer requires authentication (for example 3D Secure) for this transaction.",
    nextAction: "Bring the customer back on-session to complete authentication.",
    retry: "customer_action_required",
    retryExplanation: "An off-session retry without authentication will be declined again.",
  },
  approve_with_id: {
    category: "card_declined",
    explanation: "The payment cannot be authorized.",
    nextAction: "Retry once; if it fails again, ask the customer to contact their issuer.",
    retry: "retry_conditionally",
    retryExplanation:
      "Stripe documents that this decline can be retried, but repeated failures need customer action.",
  },
  try_again_later: {
    category: "card_declined",
    explanation: "The card was declined for an unknown, possibly temporary reason.",
    nextAction:
      "Ask the customer to try again later. If it keeps failing, they should contact their issuer.",
    retry: "retry_conditionally",
    retryExplanation: "A later retry may succeed. Do not retry in a tight loop.",
  },
  issuer_not_available: {
    category: "provider_unavailable",
    explanation: "The card issuer could not be reached, so the payment could not be authorized.",
    nextAction: "Retry the payment later.",
    retry: "retry_conditionally",
    retryExplanation:
      "The decline is reported as an issuer-side availability problem; a later retry may succeed.",
  },
  processing_error: {
    category: "provider_unavailable",
    explanation: "An error occurred while processing the card.",
    nextAction: "Retry later. If the problem persists, ask the customer to use a different method.",
    retry: "retry_conditionally",
    retryExplanation: "A later retry may succeed.",
  },
  reenter_transaction: {
    category: "card_declined",
    explanation: "The issuer could not process the payment for an unknown reason.",
    nextAction: "Ask the customer to attempt the payment again.",
    retry: "retry_conditionally",
    retryExplanation: "The issuer indicated the transaction can be re-entered.",
  },
  card_velocity_exceeded: {
    category: "card_declined",
    explanation:
      "The customer has exceeded the balance, credit limit, or transaction amount limit on their card.",
    nextAction: "Ask the customer to contact their issuer or use another payment method.",
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically.",
  },
  withdrawal_count_limit_exceeded: {
    category: "card_declined",
    explanation: "The customer has exceeded the balance or credit limit available on their card.",
    nextAction: "Ask the customer to use an alternative payment method.",
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically.",
  },
  lost_card: {
    category: "fraud_or_risk",
    explanation: "The card was reported lost.",
    nextAction: "Present a generic decline to the customer. Do not reveal the specific reason.",
    retry: "do_not_retry",
    retryExplanation: "This card must not be retried.",
  },
  stolen_card: {
    category: "fraud_or_risk",
    explanation: "The card was reported stolen.",
    nextAction: "Present a generic decline to the customer. Do not reveal the specific reason.",
    retry: "do_not_retry",
    retryExplanation: "This card must not be retried.",
  },
  pickup_card: {
    category: "fraud_or_risk",
    explanation:
      "The card cannot be used to make this payment (it may have been reported lost or stolen).",
    nextAction: "Present a generic decline and ask the customer to contact their issuer.",
    retry: "do_not_retry",
    retryExplanation: "This card must not be retried.",
  },
  restricted_card: {
    category: "fraud_or_risk",
    explanation:
      "The card cannot be used for this payment (it may have been reported lost or stolen).",
    nextAction: "Ask the customer to contact their issuer.",
    retry: "do_not_retry",
    retryExplanation: "This card must not be retried.",
  },
  fraudulent: {
    category: "fraud_or_risk",
    explanation: "The payment was declined because it was identified as potentially fraudulent.",
    nextAction:
      "Present a generic decline. Do not reveal that the payment was flagged as fraudulent.",
    retry: "do_not_retry",
    retryExplanation: "Do not retry. Review the payment in your risk tooling if needed.",
  },
  merchant_blacklist: {
    category: "fraud_or_risk",
    explanation: "The payment matched a value on your block list.",
    nextAction: "Present a generic decline. Review your block list if this is unexpected.",
    retry: "do_not_retry",
    retryExplanation: "The same details will be blocked again.",
  },
  security_violation: {
    category: "fraud_or_risk",
    explanation: "The card was declined for a security reason.",
    nextAction: "Ask the customer to contact their issuer.",
    retry: "do_not_retry",
    retryExplanation: "Do not retry automatically.",
  },
  transaction_not_allowed: {
    category: "card_declined",
    explanation: "The card was declined for an unknown reason.",
    nextAction: "Ask the customer to contact their issuer.",
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically.",
  },
  invalid_amount: {
    category: "invalid_amount",
    explanation: "The payment amount is invalid or exceeds the amount allowed for the card.",
    nextAction: "Check the amount. If it is correct, the customer should contact their issuer.",
    retry: "do_not_retry",
    retryExplanation: "The same amount will be declined again.",
  },
  invalid_account: {
    category: "card_declined",
    explanation: "The card, or the account it is connected to, is invalid.",
    nextAction: "Ask the customer to contact their issuer or use another card.",
    retry: "do_not_retry",
    retryExplanation: "This card will be declined again.",
  },
  testmode_decline: {
    category: "card_declined",
    explanation: "A Stripe test card was used in live mode or a test decline card was used.",
    nextAction: "Use a real card in live mode, or a success test card in test mode.",
    retry: "do_not_retry",
    retryExplanation: "This card will always be declined.",
  },
};

export const ERROR_CODES: Record<string, CatalogEntry> = {
  card_declined: {
    category: "card_declined",
    explanation:
      "The card was declined. The decline code, when present, gives the issuer's reason.",
    nextAction: customerNewMethod,
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically without a decline or advice code that allows it.",
  },
  expired_card: DECLINE_CODES.expired_card!,
  incorrect_cvc: DECLINE_CODES.incorrect_cvc!,
  incorrect_number: DECLINE_CODES.incorrect_number!,
  incorrect_zip: DECLINE_CODES.incorrect_zip!,
  invalid_cvc: DECLINE_CODES.invalid_cvc!,
  processing_error: DECLINE_CODES.processing_error!,
  invalid_expiry_month: {
    category: "invalid_request",
    explanation: "The card's expiration month is incorrect.",
    nextAction: "Ask the customer to correct the expiry date.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details.",
  },
  invalid_expiry_year: {
    category: "invalid_request",
    explanation: "The card's expiration year is incorrect.",
    nextAction: "Ask the customer to correct the expiry date.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details.",
  },
  invalid_number: {
    category: "invalid_request",
    explanation: "The card number is not a valid card number.",
    nextAction: "Ask the customer to re-enter their card number.",
    retry: "customer_action_required",
    retryExplanation: "Retry only with corrected details.",
  },
  authentication_required: DECLINE_CODES.authentication_required!,
  payment_intent_authentication_failure: {
    category: "authentication_failed",
    explanation:
      "The payment method failed authentication (for example a failed or abandoned 3D Secure challenge).",
    nextAction: "Ask the customer to authenticate again or provide a different payment method.",
    retry: "customer_action_required",
    retryExplanation: "A new attempt requires the customer to complete authentication.",
  },
  payment_intent_unexpected_state: {
    category: "invalid_request",
    explanation: "The PaymentIntent's state is incompatible with the operation you attempted.",
    nextAction: "Retrieve the PaymentIntent and check its current status before acting on it.",
    retry: "do_not_retry",
    retryExplanation: "Repeating the same operation in the same state will fail again.",
  },
  payment_intent_payment_attempt_failed: {
    category: "card_declined",
    explanation: "The latest payment attempt for the PaymentIntent failed.",
    nextAction:
      "Check last_payment_error for the decline reason and collect a new payment method if needed.",
    retry: "customer_action_required",
    retryExplanation: "Retry only after resolving the reason for the failed attempt.",
  },
  amount_too_small: {
    category: "invalid_amount",
    explanation: "The amount is below the minimum allowed for the currency or payment method.",
    nextAction: "Increase the amount to at least the documented minimum.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
  },
  amount_too_large: {
    category: "invalid_amount",
    explanation: "The amount is above the maximum allowed.",
    nextAction: "Reduce the amount or split the charge if your business model allows it.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
  },
  parameter_missing: {
    category: "invalid_request",
    explanation: "A required parameter is missing from the request.",
    nextAction: "Check the `param` field and add the missing parameter.",
    retry: "do_not_retry",
    retryExplanation: "Fix the request before sending it again.",
  },
  parameter_invalid_integer: {
    category: "invalid_request",
    explanation: "A parameter that must be an integer received another value.",
    nextAction: "Check the `param` field. Amounts are integers in the currency's minor unit.",
    retry: "do_not_retry",
    retryExplanation: "Fix the request before sending it again.",
  },
  parameter_unknown: {
    category: "invalid_request",
    explanation: "The request contains a parameter Stripe does not recognize.",
    nextAction: "Remove the unknown parameter or check the API version you are using.",
    retry: "do_not_retry",
    retryExplanation: "Fix the request before sending it again.",
  },
  resource_missing: {
    category: "invalid_request",
    explanation:
      "The ID provided is not valid, or the object exists in a different account or mode.",
    nextAction:
      "Check the ID and whether you are using the right API key, account, and live/test mode.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
  },
  idempotency_key_in_use: {
    category: "duplicate_request",
    explanation: "Another request with the same idempotency key is still being processed.",
    nextAction: "Wait for the first request to finish, then retry with the same idempotency key.",
    retry: "retry_conditionally",
    retryExplanation:
      "Retry with the same key after a short delay. Do not use a new key: the first request may still succeed.",
  },
  lock_timeout: {
    category: "network_or_timeout",
    explanation: "The object is being accessed by another concurrent request.",
    nextAction: "Retry the request after a short delay, using the same idempotency key.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "Safe to retry with the same idempotency key; without one, verify state first.",
  },
  rate_limit: {
    category: "rate_limiting",
    explanation: "Too many requests were sent in a short period.",
    nextAction: "Back off and retry with exponential delays.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: "Retry with backoff using the same idempotency key.",
  },
  api_key_expired: {
    category: "configuration",
    explanation: "The API key used for the request has expired.",
    nextAction: "Rotate to a valid API key in your server configuration.",
    retry: "do_not_retry",
    retryExplanation: "Requests will fail until the key is replaced.",
  },
  secret_key_required: {
    category: "configuration",
    explanation: "This request requires a secret key but a publishable key was used.",
    nextAction: "Make the request from your server with a secret key.",
    retry: "do_not_retry",
    retryExplanation: "Fix the configuration first.",
  },
  account_invalid: {
    category: "configuration",
    explanation: "The account ID in the Stripe-Account header is invalid.",
    nextAction: "Check the connected account ID.",
    retry: "do_not_retry",
    retryExplanation: "Fix the configuration first.",
  },
  payment_method_unactivated: {
    category: "configuration",
    explanation: "The payment method type is not activated on the account.",
    nextAction: "Activate the payment method in the Stripe Dashboard.",
    retry: "do_not_retry",
    retryExplanation: "Fix the configuration first.",
  },
  payment_method_not_available: {
    category: "payment_method_unavailable",
    explanation: "The payment method is not available for this payment.",
    nextAction: "Offer another payment method.",
    retry: "do_not_retry",
    retryExplanation: "The same method will be unavailable again.",
  },
  charge_already_captured: {
    category: "invalid_request",
    explanation: "The charge has already been captured.",
    nextAction: "Retrieve the charge; no further capture is needed.",
    retry: "do_not_retry",
    retryExplanation: "Capturing again will fail.",
  },
  charge_already_refunded: {
    category: "invalid_request",
    explanation: "The charge has already been fully refunded.",
    nextAction: "Retrieve the charge and its refunds to confirm the current state.",
    retry: "do_not_retry",
    retryExplanation: "Refunding again will fail.",
  },
  charge_expired_for_capture: {
    category: "invalid_request",
    explanation: "The authorization expired before it was captured.",
    nextAction: "Create a new payment if you still need to collect funds.",
    retry: "do_not_retry",
    retryExplanation: "This authorization can no longer be captured.",
  },
};

/** Stripe advice codes; they take precedence over other retry signals. */
export const ADVICE_CODES: Record<string, { retry: RetryGuidance; retryExplanation: string }> = {
  try_again_later: {
    retry: "retry_conditionally",
    retryExplanation: "Stripe advises that a later retry may succeed.",
  },
  do_not_try_again: {
    retry: "do_not_retry",
    retryExplanation:
      "Stripe advises not to retry this card. Repeated attempts can be penalized by card networks.",
  },
  confirm_card_data: {
    retry: "customer_action_required",
    retryExplanation:
      "Stripe advises asking the customer to confirm or update their card details before retrying.",
  },
};

/** Fallbacks by Stripe error `type` when the code is unknown or absent. */
export const ERROR_TYPES: Record<string, CatalogEntry> = {
  card_error: {
    category: "card_declined",
    explanation: "The card could not be charged.",
    nextAction: customerNewMethod,
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically without more specific guidance.",
  },
  invalid_request_error: {
    category: "invalid_request",
    explanation: "The request had invalid parameters.",
    nextAction: "Check the `param` and `message` fields and fix the request.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
  },
  idempotency_error: {
    category: "duplicate_request",
    explanation: "An idempotency key was reused with different request parameters.",
    nextAction:
      "Use the original parameters with this key, or a new key for a genuinely new operation.",
    retry: "do_not_retry",
    retryExplanation: "Retrying with mismatched parameters will fail again.",
  },
  api_error: {
    category: "provider_unavailable",
    explanation:
      "Stripe reported an internal problem. The outcome of the original request is not known from this error.",
    nextAction: "Check the object's current state (or the related webhook) before trying again.",
    retry: "retry_conditionally",
    retryExplanation:
      "The original request may or may not have taken effect. Verify its status first, then retry only with the same idempotency key.",
  },
};
