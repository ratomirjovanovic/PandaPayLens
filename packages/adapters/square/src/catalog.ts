/**
 * Square error and status knowledge, kept as data so it can be reviewed and versioned.
 *
 * Square publishes the ErrorCode and ErrorCategory enums but no mapping from a
 * code to its category, and official retry guidance only for RATE_LIMITED and
 * TEMPORARY_ERROR. The PandaPayLens category and retry class of every other
 * entry is derived from the documented code description.
 *
 * ErrorCode:     https://developer.squareup.com/reference/square/enums/ErrorCode
 * ErrorCategory: https://developer.squareup.com/reference/square/enums/ErrorCategory
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

export const ERROR_CODE_URL = "https://developer.squareup.com/reference/square/enums/ErrorCode";
export const ERROR_CATEGORY_URL =
  "https://developer.squareup.com/reference/square/enums/ErrorCategory";
export const PAYMENTS_ERROR_CODES_URL =
  "https://developer.squareup.com/docs/payments-api/error-codes";
export const HANDLING_ERRORS_URL =
  "https://developer.squareup.com/docs/build-basics/handling-errors";
export const CREATE_PAYMENT_URL =
  "https://developer.squareup.com/reference/square/payments-api/create-payment";
export const REFUND_PAYMENT_URL =
  "https://developer.squareup.com/reference/square/refunds-api/refund-payment";
export const REFUND_PAYMENTS_GUIDE_URL =
  "https://developer.squareup.com/docs/payments-api/refund-payments";
export const DELAYED_CAPTURE_URL =
  "https://developer.squareup.com/docs/payments-api/take-payments/card-payments/delayed-capture";
export const IDEMPOTENCY_URL =
  "https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency";
export const VERSIONING_URL =
  "https://developer.squareup.com/docs/build-basics/versioning-overview";
export const PAYMENT_OBJECT_URL = "https://developer.squareup.com/reference/square/objects/Payment";
export const CARD_PAYMENT_DETAILS_URL =
  "https://developer.squareup.com/reference/square/objects/CardPaymentDetails";
export const REFUND_OBJECT_URL =
  "https://developer.squareup.com/reference/square/objects/PaymentRefund";
export const TAKE_PAYMENTS_URL = "https://developer.squareup.com/docs/payments-api/take-payments";
export const WEBHOOKS_OVERVIEW_URL = "https://developer.squareup.com/docs/webhooks/overview";
export const WEBHOOK_SUBSCRIBE_URL = "https://developer.squareup.com/docs/webhooks/step2subscribe";
export const WEBHOOK_VALIDATE_URL = "https://developer.squareup.com/docs/webhooks/step3validate";
export const WEBHOOK_EVENTS_URL =
  "https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  /** Most specific documentation page for this code. */
  docs: string;
  /** HTTP status documented for this code, when Square documents one. */
  http?: number;
  /** Lower than the default `strong` when the documented meaning is ambiguous. */
  confidence?: Confidence;
};

type Opts = { http?: number; docs?: string; confidence?: Confidence; retryExplanation?: string };

const make =
  (retry: RetryGuidance, defaultRetryExplanation: string) =>
  (
    category: ErrorCategory,
    explanation: string,
    nextAction: string,
    opts: Opts = {},
  ): CatalogEntry => ({
    category,
    explanation,
    nextAction,
    retry,
    retryExplanation: opts.retryExplanation ?? defaultRetryExplanation,
    docs: opts.docs ?? ERROR_CODE_URL,
    ...(opts.http !== undefined ? { http: opts.http } : {}),
    ...(opts.confidence ? { confidence: opts.confidence } : {}),
  });

const customer = make(
  "customer_action_required",
  "Do not retry automatically. A new attempt needs the buyer to act first (corrected details, another payment method, or contacting the issuer).",
);
const noRetry = make("do_not_retry", "The same request will fail again.");
const review = make(
  "manual_review",
  "Someone needs to review the account or payment configuration before any new attempt.",
);
const conditional = make(
  "retry_conditionally",
  "A retry may succeed only after the condition described here is resolved.",
);
const safe = make(
  "safe_to_retry_technical_request",
  "The request can be retried as described by Square.",
);
const unknownRetry = make(
  "unknown",
  "Square's description does not allow PandaPayLens to assess whether a retry is safe.",
);

const P = CREATE_PAYMENT_URL;
const R = REFUND_PAYMENT_URL;
const H = HANDLING_ERRORS_URL;

const otherCard = "Ask the buyer to use another card or payment method.";
const callIssuer = "Ask the buyer to contact their card issuer or use another payment method.";
const reenter = "Ask the buyer to check and re-enter their card details.";
const fixRequest = "Fix the request (see the error's field and detail) before sending it again.";
const checkAccount = "Check the seller account and location settings in the Square Dashboard.";

const verifyFirst =
  "The original request may or may not have taken effect. Verify the payment or refund state first, then retry only with the same idempotency key.";

/** Payment-relevant ErrorCode values. */
export const ERROR_CODES: Record<string, CatalogEntry> = {
  // Card and payment-method declines
  GENERIC_DECLINE: customer(
    "card_declined",
    "The card was declined without further information. The buyer may ask their issuer for the reason.",
    callIssuer,
    { http: 400, docs: P },
  ),
  CARD_DECLINED: customer("card_declined", "The card was declined.", callIssuer),
  CVV_FAILURE: customer(
    "card_declined",
    "The issuer declined the card because the CVV is invalid.",
    reenter,
    {
      http: 400,
      docs: P,
    },
  ),
  ADDRESS_VERIFICATION_FAILURE: customer(
    "card_declined",
    "The issuer declined the card because the postal code is invalid.",
    reenter,
    { http: 400, docs: P },
  ),
  VERIFY_CVV_FAILURE: customer("card_declined", "The CVV could not be verified.", reenter),
  VERIFY_AVS_FAILURE: customer(
    "card_declined",
    "The address (AVS) could not be verified.",
    reenter,
  ),
  INVALID_ACCOUNT: customer(
    "card_declined",
    "The issuer could not find the account for this card.",
    otherCard,
    { http: 400, docs: P },
  ),
  CARD_EXPIRED: customer(
    "card_declined",
    "The issuer declined the card because it has expired.",
    otherCard,
    {
      http: 400,
      docs: P,
    },
  ),
  EXPIRATION_FAILURE: customer(
    "card_declined",
    "The expiration date is invalid or the card has expired.",
    reenter,
    { http: 400, docs: P },
  ),
  BAD_EXPIRATION: customer(
    "invalid_request",
    "The card expiration date is missing or malformed.",
    reenter,
    {
      http: 402,
      docs: P,
    },
  ),
  INVALID_EXPIRATION: customer(
    "invalid_request",
    "The card expiration date is invalid (for example, in the past).",
    reenter,
    { http: 400, docs: P },
  ),
  INVALID_EXPIRATION_YEAR: customer(
    "invalid_request",
    "The card expiration year is invalid.",
    reenter,
  ),
  INVALID_EXPIRATION_DATE: customer(
    "invalid_request",
    "The card expiration date contains invalid characters.",
    reenter,
  ),
  INSUFFICIENT_FUNDS: customer(
    "insufficient_funds",
    "The funding source does not have enough funds for the requested amount.",
    "Ask the buyer to use another payment method or try again once funds are available.",
    { http: 400, docs: PAYMENTS_ERROR_CODES_URL },
  ),
  GIFT_CARD_AVAILABLE_AMOUNT: customer(
    "insufficient_funds",
    "Companion to INSUFFICIENT_FUNDS for gift cards. The detail field carries the remaining gift card balance in the smallest currency unit.",
    "Charge at most the remaining balance to the gift card and the rest to another payment method.",
    { http: 400, docs: PAYMENTS_ERROR_CODES_URL },
  ),
  CARD_DECLINED_VERIFICATION_REQUIRED: customer(
    "authentication_required",
    "The card was declined with a request for additional verification.",
    "Ask the buyer to complete the additional verification and try again.",
    { http: 402, docs: P },
  ),
  APPLE_TTP_PIN_TOKEN: customer(
    "authentication_required",
    "Apple Tap to Pay decline asking for a PIN. It accompanies CARD_DECLINED_VERIFICATION_REQUIRED and carries an issuer token.",
    "Ask the buyer to enter their PIN and try again.",
    { http: 400, docs: P },
  ),
  CARD_DECLINED_CALL_ISSUER: customer(
    "card_declined",
    "The card was declined. The cardholder should call their issuer.",
    callIssuer,
  ),
  VOICE_FAILURE: customer(
    "card_declined",
    "The issuer requires voice authorization from the cardholder.",
    callIssuer,
    { http: 400, docs: P },
  ),
  TRANSACTION_LIMIT: customer(
    "card_declined",
    "The issuer says the amount is too high or too low for this card (for example, a credit limit).",
    callIssuer,
    { http: 400, docs: P },
  ),
  PAN_FAILURE: customer(
    "invalid_request",
    "The card number is invalid (length or format).",
    reenter,
    {
      http: 400,
      docs: P,
    },
  ),
  CARD_NOT_SUPPORTED: customer(
    "payment_method_unavailable",
    "The card is not supported in this region or for this merchant category.",
    otherCard,
    { http: 400, docs: P },
  ),
  UNSUPPORTED_CARD_BRAND: customer(
    "payment_method_unavailable",
    "The card issuer (brand) is not supported.",
    otherCard,
    { http: 400, docs: R },
  ),
  UNSUPPORTED_ENTRY_METHOD: customer(
    "payment_method_unavailable",
    "The swipe, dip or tap entry method used is not supported.",
    "Ask the buyer to use another entry method or payment method.",
  ),
  INVALID_PIN: customer(
    "authentication_failed",
    "The issuer declined the card because the PIN is invalid.",
    "Ask the buyer to re-enter their PIN.",
    {
      http: 400,
      docs: P,
    },
  ),
  MISSING_PIN: customer(
    "authentication_required",
    "A required PIN is missing.",
    "Ask the buyer to enter their PIN.",
  ),
  ALLOWABLE_PIN_TRIES_EXCEEDED: customer(
    "authentication_failed",
    "The PIN retry limit was reached. The cardholder must contact their issuer.",
    callIssuer,
    { http: 402, docs: P },
  ),
  CHIP_INSERTION_REQUIRED: customer(
    "payment_method_unavailable",
    "The issuer requires the card chip to be read.",
    "Ask the buyer to insert (dip) the card.",
    { http: 402, docs: P },
  ),
  MANUALLY_ENTERED_PAYMENT_NOT_SUPPORTED: customer(
    "payment_method_unavailable",
    "Keyed-in card numbers were declined. The card must be swiped, tapped or dipped.",
    "Ask the buyer to swipe, tap or dip the card.",
    { http: 400, docs: P },
  ),
  CARD_PRESENCE_REQUIRED: customer(
    "payment_method_unavailable",
    "The card must be present for this operation.",
    "Repeat the operation with the card present.",
    { http: 400, docs: R },
  ),
  READER_DECLINED: unknownRetry(
    "card_declined",
    "The Square card reader declined the card for an unknown reason.",
    "Check the reader and ask the buyer to try again or use another payment method.",
  ),
  CARDHOLDER_INSUFFICIENT_PERMISSIONS: customer(
    "card_declined",
    "The issuer restricts where this card can be used.",
    otherCard,
    { http: 400, docs: P },
  ),
  INVALID_CARD: customer(
    "invalid_request",
    "The card could not be validated from the details provided.",
    reenter,
    { http: 400, docs: P },
  ),
  INVALID_CARD_DATA: customer("invalid_request", "The card data is invalid.", reenter, {
    http: 400,
    docs: P,
  }),
  INVALID_ENCRYPTED_CARD: noRetry(
    "invalid_request",
    "The encrypted card data is invalid.",
    "Check how the card data is collected and encrypted before sending it.",
  ),
  INVALID_POSTAL_CODE: customer("invalid_request", "The postal code is malformed.", reenter, {
    http: 400,
    docs: P,
  }),
  INVALID_EMAIL_ADDRESS: noRetry(
    "invalid_request",
    "CreatePayment rejected the request with INVALID_EMAIL_ADDRESS.",
    fixRequest,
    { http: 400, docs: P },
  ),
  INVALID_PHONE_NUMBER: noRetry(
    "invalid_request",
    "CreatePayment rejected the request with INVALID_PHONE_NUMBER.",
    fixRequest,
    { http: 400, docs: P },
  ),
  CURRENCY_MISMATCH: noRetry(
    "invalid_request",
    "The payment currency is not valid for this funding source.",
    "Use a currency that the funding source and seller location support.",
  ),
  CARD_TOKEN_EXPIRED: customer(
    "invalid_request",
    "The card token (nonce) has expired.",
    "Tokenize the card again and send the new token.",
    {
      http: 400,
      docs: P,
      retryExplanation:
        "The expired token will be rejected again. Create a new token (the buyer may need to re-enter the card) before a new attempt.",
    },
  ),
  CARD_TOKEN_USED: noRetry(
    "duplicate_request",
    "The card token (nonce) was already used.",
    "Check whether the earlier request with this token created a payment before tokenizing again.",
    { http: 400, docs: P },
  ),
  SOURCE_USED: noRetry(
    "duplicate_request",
    "The source ID was already used to create a card.",
    "Check whether the earlier request already succeeded.",
  ),
  SOURCE_EXPIRED: customer(
    "invalid_request",
    "The source ID has expired.",
    "Create a new source (token) and try again.",
  ),
  CARD_MISMATCH: noRetry(
    "invalid_request",
    "The card does not match what was expected.",
    "Check that the refund uses the same card as the original payment.",
    { http: 400, docs: R },
  ),
  AMOUNT_TOO_HIGH: noRetry(
    "invalid_amount",
    "The amount is too high for this payment source.",
    "Check the amount.",
  ),
  AMOUNT_TOO_LOW: noRetry(
    "invalid_amount",
    "The amount is too low for this payment source.",
    "Check the amount.",
  ),
  PAYMENT_AMOUNT_MISMATCH: noRetry(
    "invalid_amount",
    "The amount differs from what Square expected.",
    "Check the amount against the order or the previous request.",
    { http: 400, docs: P },
  ),
  PAYMENT_LIMIT_EXCEEDED: review(
    "configuration",
    "The amount exceeds the seller's processing limit.",
    "Review the seller's processing limits with Square.",
    { http: 400, docs: P },
  ),
  INVALID_FEES: noRetry(
    "invalid_amount",
    "The app_fee_money amount is too high.",
    "Lower the application fee.",
    { http: 400, docs: P },
  ),
  ACCOUNT_UNUSABLE: customer(
    "payment_method_unavailable",
    "The bank account cannot be used for transactions.",
    "Ask the buyer to use another bank account or payment method.",
  ),
  BUYER_REFUSED_PAYMENT: customer(
    "card_declined",
    "The bank account rejected the payment or the buyer did not authorize it.",
    "Ask the buyer to authorize the payment or use another payment method.",
  ),
  UNSUPPORTED_INSTRUMENT_TYPE: noRetry(
    "payment_method_unavailable",
    "The payment instrument type is not supported.",
    "Use a supported payment instrument.",
    { http: 400, docs: R },
  ),
  UNSUPPORTED_SOURCE_TYPE: noRetry(
    "payment_method_unavailable",
    "The payment source type is not supported.",
    "Use a supported payment source type.",
    { http: 400, docs: R },
  ),
  CART_INELIGIBLE_FOR_EBT: customer(
    "payment_method_unavailable",
    "The cart is not eligible for EBT.",
    "Ask the buyer to pay for ineligible items with another payment method.",
  ),
  RESERVATION_DECLINED: unknownRetry(
    "card_declined",
    'Square describes this code as "The card issuer declined the refund.", which appears to be copied from REFUND_DECLINED. Its meaning is ambiguous.',
    "Check the payment in the Square Dashboard.",
    { confidence: "possible" },
  ),

  // Merchant and account configuration
  INSUFFICIENT_PERMISSIONS: review(
    "configuration",
    "The Square account is not allowed to accept this payment (for example, gift cards).",
    checkAccount,
    { http: 400, docs: P },
  ),
  INVALID_LOCATION: noRetry(
    "configuration",
    "The account cannot take payments in this region.",
    checkAccount,
    { http: 400, docs: P },
  ),
  CARD_PROCESSING_NOT_ENABLED: review(
    "configuration",
    "The location is not enabled for card processing.",
    checkAccount,
    { http: 403, docs: P },
  ),
  PAYMENT_SOURCE_NOT_ENABLED_FOR_TARGET: review(
    "configuration",
    "The merchant or location is not enabled for this payment source.",
    checkAccount,
    { http: 400, docs: P },
  ),
  UNSUPPORTED_COUNTRY: noRetry("configuration", "The country is not supported.", checkAccount, {
    http: 400,
    docs: R,
  }),
  UNSUPPORTED_CURRENCY: noRetry("configuration", "The currency is not supported.", checkAccount, {
    http: 400,
    docs: R,
  }),
  LOCATION_MISMATCH: noRetry(
    "invalid_request",
    "The location does not match what was expected.",
    "Use the location of the original object.",
  ),
  MERCHANT_SUBSCRIPTION_NOT_FOUND: review(
    "configuration",
    "A required merchant subscription was not found (beta).",
    "Check the seller's Square subscriptions.",
  ),
  SANDBOX_NOT_SUPPORTED: noRetry(
    "configuration",
    "This operation is not supported in the Square Sandbox.",
    "Test this operation in production or skip it in sandbox tests.",
  ),
  INVALID_SQUARE_VERSION_FORMAT: noRetry(
    "configuration",
    "The Square-Version header is malformed.",
    "Send the version in the YYYY-MM-DD format.",
    { docs: VERSIONING_URL },
  ),
  API_VERSION_INCOMPATIBLE: noRetry(
    "configuration",
    "The Square-Version is incompatible with this request.",
    "Use an API version that supports this request.",
    { docs: VERSIONING_URL },
  ),

  // API authentication and authorization (credentials, not cardholder authentication)
  UNAUTHORIZED: noRetry(
    "configuration",
    "The request could not be authorized. Most often the Authorization header is missing, malformed or invalid.",
    "Check the access token and the Authorization header.",
    { http: 401, docs: H },
  ),
  ACCESS_TOKEN_EXPIRED: conditional(
    "configuration",
    "The access token has expired.",
    "Refresh the access token.",
    {
      http: 401,
      docs: H,
      retryExplanation:
        "The request was not authorized, so it did not run. Retry only after refreshing the access token.",
    },
  ),
  ACCESS_TOKEN_REVOKED: noRetry(
    "configuration",
    "The access token was revoked.",
    "Obtain a new authorization from the seller.",
    { http: 401, docs: H },
  ),
  CLIENT_DISABLED: noRetry(
    "configuration",
    "The client is disabled.",
    "Check the application status in the Square Developer Console.",
    { http: 401, docs: H },
  ),
  FORBIDDEN: noRetry(
    "configuration",
    "General access error: the caller may not perform this request.",
    "Check the token's permissions and the account.",
    { http: 403, docs: H },
  ),
  INSUFFICIENT_SCOPES: noRetry(
    "configuration",
    "The access token lacks a required permission.",
    "Request the missing OAuth permission.",
    { http: 403, docs: H },
  ),
  APPLICATION_DISABLED: noRetry(
    "configuration",
    "The application is disabled.",
    "Check the application status in the Square Developer Console.",
  ),
  V1_APPLICATION: noRetry(
    "configuration",
    "The application was created before 2016-03-30 and cannot be used with v2 endpoints.",
    "Use an application that supports the v2 APIs.",
  ),
  V1_ACCESS_TOKEN: noRetry(
    "configuration",
    "The access token belongs to a pre-2016-03-30 application and cannot be used with v2 endpoints.",
    "Use an access token for an application that supports the v2 APIs.",
  ),

  // Idempotency, rate limiting and transport
  IDEMPOTENCY_KEY_REUSED: noRetry(
    "duplicate_request",
    "The idempotency key was already used with a different request. The same key with the same request returns the original response.",
    "Resend with the original parameters to get the original response, or use a new key for a genuinely new operation.",
    { docs: IDEMPOTENCY_URL },
  ),
  RATE_LIMITED: safe(
    "rate_limiting",
    "The application exceeded the Square API rate limit.",
    "Back off and retry later, with jitter.",
    {
      http: 429,
      docs: H,
      retryExplanation:
        "Square documents backing off with jitter and retrying. Keep the same idempotency key for payment requests.",
    },
  ),
  TEMPORARY_ERROR: safe(
    "provider_unavailable",
    "A temporary internal error occurred at Square.",
    "Retry the call with the same idempotency key.",
    {
      http: 503,
      docs: P,
      retryExplanation:
        "Square documents that the call can be safely retried using the same idempotency key. Do not use a new key: the original request may have taken effect.",
    },
  ),
  INTERNAL_SERVER_ERROR: conditional(
    "provider_unavailable",
    "A general server error occurred at Square. The outcome of the original request is not known from this error.",
    "Check the payment or refund state before trying again.",
    { retryExplanation: verifyFirst },
  ),
  SERVICE_UNAVAILABLE: conditional(
    "provider_unavailable",
    "The Square service is unavailable. The outcome of the original request is not known from this error.",
    "Check the payment or refund state before trying again.",
    { retryExplanation: verifyFirst },
  ),
  BAD_GATEWAY: conditional(
    "provider_unavailable",
    "Bad gateway. The outcome of the original request is not known from this error.",
    "Check the payment or refund state before trying again.",
    { retryExplanation: verifyFirst },
  ),
  GATEWAY_TIMEOUT: conditional(
    "network_or_timeout",
    "Gateway timeout. The outcome of the original request is not known from this error.",
    "Check the payment or refund state before trying again.",
    { retryExplanation: verifyFirst },
  ),
  REQUEST_TIMEOUT: conditional(
    "network_or_timeout",
    "Request timeout. The outcome of the original request is not known from this error.",
    "Check the payment or refund state before trying again.",
    { retryExplanation: verifyFirst },
  ),
  CONFLICT: review(
    "invalid_request",
    "The request conflicts with the current state of the resource.",
    "Retrieve the current state of the object and decide how to proceed.",
  ),
  NOT_FOUND: noRetry(
    "invalid_request",
    "The resource was not found.",
    "Check the identifier and the account or location it belongs to.",
  ),

  // Delayed capture and refunds
  DELAYED_TRANSACTION_EXPIRED: noRetry(
    "invalid_request",
    "An update was attempted on a delayed-capture payment that has expired.",
    "Create a new payment if the buyer should still be charged.",
    { docs: DELAYED_CAPTURE_URL },
  ),
  DELAYED_TRANSACTION_CANCELED: noRetry(
    "duplicate_request",
    "A cancel was attempted on a payment that is already canceled.",
    "No action needed for the cancellation.",
    { docs: DELAYED_CAPTURE_URL },
  ),
  DELAYED_TRANSACTION_CAPTURED: noRetry(
    "duplicate_request",
    "A capture was attempted on a payment that is already captured.",
    "No action needed for the capture.",
    { docs: DELAYED_CAPTURE_URL },
  ),
  DELAYED_TRANSACTION_FAILED: noRetry(
    "invalid_request",
    "An update was attempted on a delayed-capture payment that failed.",
    "Create a new payment if the buyer should still be charged.",
    { docs: DELAYED_CAPTURE_URL },
  ),
  PARTIAL_PAYMENT_DELAY_CAPTURE_NOT_SUPPORTED: noRetry(
    "invalid_request",
    "Delayed capture of a partial payment is not supported.",
    "Use immediate capture for partial payments.",
    { docs: DELAYED_CAPTURE_URL },
  ),
  REFUND_AMOUNT_INVALID: noRetry(
    "invalid_amount",
    "The refund amount exceeds the refundable amount.",
    "Check the amount already refunded and the remaining refundable amount.",
    { http: 400, docs: R },
  ),
  REFUND_ALREADY_PENDING: noRetry(
    "duplicate_request",
    "A refund is already pending for this payment.",
    "Wait for the pending refund to complete before requesting another.",
    { docs: REFUND_PAYMENTS_GUIDE_URL },
  ),
  PAYMENT_NOT_REFUNDABLE: noRetry(
    "invalid_request",
    "The payment cannot be refunded (for example, it is too old).",
    "Return the funds to the buyer another way if needed.",
    { http: 400, docs: R },
  ),
  PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE: review(
    "fraud_or_risk",
    "The payment is disputed and cannot be refunded.",
    "Handle the dispute instead of refunding.",
    { http: 400, docs: R },
  ),
  REFUND_ERROR_PAYMENT_NEEDS_COMPLETION: conditional(
    "invalid_request",
    "The payment is APPROVED and not yet completed, so it cannot be refunded.",
    "Complete the payment first, or cancel it instead of refunding.",
    {
      http: 400,
      docs: R,
      retryExplanation: "A refund can be requested again after the payment is completed.",
    },
  ),
  REFUND_DECLINED: review(
    "card_declined",
    "The card issuer declined the refund.",
    "Review the refund and return the funds to the buyer another way if needed.",
    { http: 400, docs: R },
  ),
  INSUFFICIENT_PERMISSIONS_FOR_REFUND: review(
    "configuration",
    "The account cannot process this refund.",
    checkAccount,
    { http: 400, docs: R },
  ),

  // Generic request validation
  MISSING_REQUIRED_PARAMETER: noRetry(
    "invalid_request",
    "A required request parameter is missing.",
    fixRequest,
  ),
  INVALID_VALUE: noRetry("invalid_request", "A request value is invalid.", fixRequest),
  VALUE_TOO_LONG: noRetry("invalid_request", "A request value is too long.", fixRequest),
  INVALID_ENUM_VALUE: noRetry(
    "invalid_request",
    "A request value is not one of the allowed enum values.",
    fixRequest,
  ),
};

export type CategoryEntry = Omit<CatalogEntry, "http" | "confidence">;

/**
 * Fallbacks by the payload's ErrorCategory, used when the code is unknown.
 * Decoded with `possible` confidence at most.
 */
export const ERROR_CATEGORIES: Record<string, CategoryEntry> = {
  API_ERROR: {
    category: "provider_unavailable",
    explanation:
      "Square reported an error in the Square API itself. The outcome of the original request is not known from this error.",
    nextAction: "Check the payment or refund state before trying again.",
    retry: "retry_conditionally",
    retryExplanation: verifyFirst,
    docs: ERROR_CATEGORY_URL,
  },
  AUTHENTICATION_ERROR: {
    category: "configuration",
    explanation:
      "An authentication problem, most often a missing, malformed or invalid Authorization header.",
    nextAction: "Check the access token and the Authorization header.",
    retry: "do_not_retry",
    retryExplanation: "Requests will fail until the credentials are fixed.",
    docs: ERROR_CATEGORY_URL,
  },
  INVALID_REQUEST_ERROR: {
    category: "invalid_request",
    explanation:
      "The request was invalid, for example a required parameter was missing or a value was invalid.",
    nextAction: fixRequest,
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again.",
    docs: ERROR_CATEGORY_URL,
  },
  RATE_LIMIT_ERROR: {
    category: "rate_limiting",
    explanation: "The application hit the Square API rate limit.",
    nextAction: "Back off and retry later, with jitter.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: "Square documents backing off with jitter and retrying.",
    docs: ERROR_CATEGORY_URL,
  },
  PAYMENT_METHOD_ERROR: {
    category: "card_declined",
    explanation:
      "A problem occurred processing the payment method, for example an invalid CVV or expiration date.",
    nextAction: otherCard,
    retry: "customer_action_required",
    retryExplanation: "Do not retry automatically without more specific guidance.",
    docs: ERROR_CATEGORY_URL,
  },
  REFUND_ERROR: {
    category: "unknown",
    explanation: "A problem occurred processing a refund. The specific code is needed to say more.",
    nextAction: "Check the refund in the Square Dashboard.",
    retry: "unknown",
    retryExplanation: "Retry safety depends on the specific refund error code.",
    docs: ERROR_CATEGORY_URL,
  },
  MERCHANT_SUBSCRIPTION_ERROR: {
    category: "configuration",
    explanation: "A problem occurred checking a merchant subscription status (beta).",
    nextAction: "Check the seller's Square subscriptions.",
    retry: "manual_review",
    retryExplanation: "The subscription status needs review before a new attempt.",
    docs: ERROR_CATEGORY_URL,
  },
  EXTERNAL_VENDOR_ERROR: {
    category: "unknown",
    explanation: "An external vendor's API (for example, Plaid) returned an error.",
    nextAction: "Check the specific code and the vendor integration.",
    retry: "unknown",
    retryExplanation: "Retry safety depends on the external vendor's error.",
    docs: ERROR_CATEGORY_URL,
  },
};

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome; explanation: string };

/** Payment.status values. Terminal: COMPLETED, CANCELED, FAILED. */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  APPROVED: {
    stage: "authorization",
    outcome: "pending",
    explanation:
      "Authorized and waiting to be completed or canceled (delayed capture). Not captured yet.",
  },
  PENDING: {
    stage: "payment",
    outcome: "pending",
    explanation:
      "Not final yet. For ACH bank payments, it moves to COMPLETED or FAILED when the transfer resolves.",
  },
  COMPLETED: {
    stage: "capture",
    outcome: "success",
    explanation:
      "Captured and credited to the seller. This is not a settlement confirmation, and the status stays COMPLETED after refunds.",
  },
  CANCELED: {
    stage: "void",
    outcome: "failure",
    explanation: "Voided. The card funds were released and the buyer was not charged.",
  },
  FAILED: {
    stage: "payment",
    outcome: "failure",
    explanation: "Declined by the bank or issuer. No funds were credited.",
  },
};

/** PaymentRefund.status values. A refund can skip PENDING. */
export const REFUND_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    stage: "refund",
    outcome: "pending",
    explanation:
      "Square is processing the refund. For card or bank refunds this can last up to 14 days.",
  },
  COMPLETED: {
    stage: "refund",
    outcome: "success",
    explanation: "Approved and the funds were sent. Bank posting may take several business days.",
  },
  REJECTED: {
    stage: "refund",
    outcome: "failure",
    explanation:
      "Rejected, for example because the seller's account lacked funds and Square could not pull from the linked bank.",
  },
  FAILED: {
    stage: "refund",
    outcome: "failure",
    explanation: "The refund failed and the cardholder does not receive it.",
  },
};

/**
 * CardPaymentDetails.status values. Square lists them without per-value
 * meanings, so they are shown as provider status only and never interpreted.
 */
export const CARD_DETAILS_STATUSES: readonly string[] = [
  "AUTHORIZED",
  "CAPTURED",
  "VOIDED",
  "FAILED",
];

export type WebhookTypeInfo = { objectType: "payment" | "refund"; description: string };

export const WEBHOOK_EVENT_TYPES: Record<string, WebhookTypeInfo> = {
  "payment.created": { objectType: "payment", description: "A payment was created." },
  "payment.updated": {
    objectType: "payment",
    description: "A payment changed, for example its status or card_details.status.",
  },
  "refund.created": { objectType: "refund", description: "A refund was created." },
  "refund.updated": {
    objectType: "refund",
    description: "A refund changed, typically its status.",
  },
};

/** Own-property lookup, so codes such as "constructor" never hit the prototype. */
export function lookup<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}
