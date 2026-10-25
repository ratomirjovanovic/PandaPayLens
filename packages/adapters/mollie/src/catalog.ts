/**
 * Mollie knowledge, kept as data. Every value comes from the verified research
 * file (docs/providers/research/mollie.md), which cites docs.mollie.com.
 *
 * Error handling:     https://docs.mollie.com/reference/handling-errors
 * failureReason enum: https://docs.mollie.com/reference/extra-payment-parameters
 * Payment statuses:   https://docs.mollie.com/docs/handling-payment-status
 * Webhooks:           https://docs.mollie.com/reference/webhooks
 * Next-gen webhooks:  https://docs.mollie.com/reference/webhooks-new
 *
 * Category and retry values are PandaPayLens mappings, not Mollie statements.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

export const HANDLING_ERRORS_URL = "https://docs.mollie.com/reference/handling-errors";
export const EXTRA_PAYMENT_PARAMETERS_URL =
  "https://docs.mollie.com/reference/extra-payment-parameters";
export const PAYMENT_STATUS_URL = "https://docs.mollie.com/docs/handling-payment-status";
export const GET_PAYMENT_URL = "https://docs.mollie.com/reference/get-payment";
export const GET_REFUND_URL = "https://docs.mollie.com/reference/get-refund";
export const GET_CHARGEBACK_URL = "https://docs.mollie.com/reference/get-chargeback";
export const GET_CAPTURE_URL = "https://docs.mollie.com/reference/get-capture";
export const REFUNDS_GUIDE_URL = "https://docs.mollie.com/docs/refunds";
export const WEBHOOKS_URL = "https://docs.mollie.com/reference/webhooks";
export const WEBHOOKS_NEXT_GEN_URL = "https://docs.mollie.com/reference/webhooks-new";
export const IDEMPOTENCY_URL = "https://docs.mollie.com/reference/api-idempotency";
export const RATE_LIMITING_URL = "https://docs.mollie.com/reference/rate-limiting";
export const STATUS_REASONS_URL = "https://docs.mollie.com/reference/status-reasons";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  confidence: Confidence;
};

const CLIENT_SIDE =
  "Mollie states that a 4xx error for a specific request usually will not go away by itself. Change the request before sending it again.";

/**
 * HTTP statuses of Payments API v2 error responses (S1, with S25/S26
 * additions). Mollie has no machine-readable error code beyond the HTTP status
 * and the optional `field`, so these are the error codes.
 */
export const HTTP_STATUS: Record<number, { title: string } & CatalogEntry> = {
  400: {
    title: "Bad Request",
    category: "invalid_request",
    explanation:
      "Mollie could not understand the request, possibly because of a syntax error. Mollie also returns 400 when the same Idempotency-Key is reused for a different endpoint or with different parameters.",
    nextAction:
      "Check the request syntax. If you send an Idempotency-Key, make sure it is not reused for a different request.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    // Two documented meanings that the body cannot tell apart.
    confidence: "possible",
  },
  401: {
    title: "Unauthorized",
    category: "configuration",
    explanation: "Authentication failed. Mollie asks you to check your API key.",
    nextAction:
      "Check that the request sends a valid API key or access token for the right mode (test or live).",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  403: {
    title: "Forbidden",
    category: "configuration",
    explanation: "The credentials used have no access to the requested resource.",
    nextAction: "Check the permissions of the API key or access token and the resource's owner.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  404: {
    title: "Not Found",
    category: "invalid_request",
    explanation: "The object referenced by the URL does not exist.",
    nextAction:
      "Check the identifier in the URL and that it belongs to the same mode (test or live) and account.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  405: {
    title: "Method Not Allowed",
    category: "invalid_request",
    explanation:
      "The HTTP method is not allowed for this endpoint. Mollie lists the allowed methods in the Allow header.",
    nextAction: "Use one of the methods named in the Allow response header.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  409: {
    title: "Conflict",
    category: "duplicate_request",
    explanation:
      "Mollie detected a duplicate API call that was probably a mistake. It is also returned when a second request with the same Idempotency-Key arrives while the first one is still being processed.",
    nextAction:
      "Wait for the first request to complete and check its result before sending anything else.",
    retry: "retry_conditionally",
    retryExplanation:
      "Verify the first request's result first. Only retry after it has completed, with the same Idempotency-Key.",
    confidence: "strong",
  },
  410: {
    title: "Gone",
    category: "invalid_request",
    explanation: "The object was previously deleted.",
    nextAction: "Stop referencing this object; it no longer exists.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  415: {
    title: "Unsupported Media Type",
    category: "invalid_request",
    explanation:
      "The request body's media type is not supported. Mollie recommends always sending JSON.",
    nextAction: "Send the request body as JSON with a matching Content-Type header.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  422: {
    title: "Unprocessable Entity",
    category: "invalid_request",
    explanation:
      "Mollie could not process the request for another reason, usually a value in the field named by `field`. A 422 can also mean the account's payment services are suspended.",
    nextAction:
      "Fix the value named in `field` and read `detail`. If no field is named, check the Mollie Dashboard for account suspension.",
    retry: "do_not_retry",
    retryExplanation: CLIENT_SIDE,
    // "Any other reason": only the field (when present) makes it specific.
    confidence: "possible",
  },
  429: {
    title: "Too Many Requests",
    category: "rate_limiting",
    explanation: "The rate limit was hit. Mollie asks you to try again after a short period.",
    nextAction:
      "Slow down and honour the Retry-After response header before sending the request again.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "The request was rejected by the rate limiter. Retry after the Retry-After period, and reuse the same Idempotency-Key for POST requests.",
    confidence: "strong",
  },
  500: {
    title: "Internal Server Error",
    category: "provider_unavailable",
    explanation:
      "An error occurred on Mollie's side. Mollie's developers are notified automatically.",
    nextAction:
      "Check the state of the resource (for example GET the payment or refund) before sending the request again.",
    retry: "retry_conditionally",
    retryExplanation:
      "The outcome of the original request is unknown. Verify the resource's state first; for refunds Mollie advises not to retry automatically on uncertainty. If you retry, reuse the same Idempotency-Key.",
    confidence: "strong",
  },
  502: {
    title: "Bad Gateway",
    category: "provider_unavailable",
    explanation:
      "The service is temporarily unavailable, for example because of a calamity or maintenance. Mollie asks you to retry later.",
    nextAction: "Retry later, with the same Idempotency-Key for POST requests.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "Mollie documents this status as temporary and asks for a later retry. Reuse the same Idempotency-Key so a retry cannot create a second resource.",
    confidence: "strong",
  },
  503: {
    title: "Service Unavailable",
    category: "provider_unavailable",
    explanation:
      "The service is temporarily unavailable. Mollie asks you to retry later. For parallel refunds Mollie states that a 503 means the refund was not performed.",
    nextAction: "Retry later, with the same Idempotency-Key for POST requests.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "Mollie documents this status as temporary and asks for a later retry. Reuse the same Idempotency-Key so a retry cannot create a second resource.",
    confidence: "strong",
  },
  504: {
    title: "Gateway Timeout",
    category: "network_or_timeout",
    explanation: "The request caused an unusually long processing time and timed out.",
    nextAction:
      "Check whether the original request took effect (for example GET the payment) before sending it again.",
    retry: "retry_conditionally",
    retryExplanation:
      "The outcome of the original request is unknown. Verify the resource's state first, or retry with the same Idempotency-Key so Mollie can return the original result.",
    confidence: "strong",
  },
};

/** 422 with this documented field gets a more specific category. */
export const FIELD_CATEGORIES: Record<string, ErrorCategory> = {
  amount: "invalid_amount",
};

const NAME_DERIVED =
  "Mollie documents this value but gives no description for it; this explanation is derived from the code name.";

const customer = (
  explanation: string,
  nextAction: string,
  category: ErrorCategory,
): CatalogEntry => ({
  category,
  explanation: `${explanation} ${NAME_DERIVED}`,
  nextAction,
  retry: "customer_action_required",
  retryExplanation:
    "A new attempt needs the customer to act first (complete authentication, use other card details, or another payment method).",
  confidence: "possible",
});

/**
 * `details.failureReason` (card payments, S3). Exactly 15 documented values;
 * per-value descriptions are not documented, so confidence is `possible`.
 */
export const FAILURE_REASONS: Record<string, CatalogEntry> = {
  authentication_abandoned: customer(
    "The customer did not complete authentication (3-D Secure).",
    "Ask the customer to try again and complete the authentication step.",
    "authentication_failed",
  ),
  authentication_failed: customer(
    "Authentication was attempted and failed.",
    "Ask the customer to try again or use another payment method.",
    "authentication_failed",
  ),
  authentication_required: customer(
    "The issuer requires authentication that was not performed.",
    "Start a new payment with authentication, for example through Mollie's hosted checkout.",
    "authentication_required",
  ),
  authentication_unavailable_acs: {
    category: "authentication_failed",
    explanation: `The issuer's authentication server (ACS) was unavailable. ${NAME_DERIVED}`,
    nextAction: "Let the customer try again later, or offer another payment method.",
    retry: "retry_conditionally",
    retryExplanation:
      "This is a technical problem on the issuer's side; a later attempt may succeed. Avoid immediate repeated retries.",
    confidence: "possible",
  },
  card_declined: customer(
    "The card was declined without a specific reason.",
    "Ask the customer to use another card or contact their issuer.",
    "card_declined",
  ),
  card_expired: customer(
    "The card has expired.",
    "Ask the customer to use a valid card.",
    "card_declined",
  ),
  inactive_card: customer(
    "The card is not active.",
    "Ask the customer to activate the card with their issuer or use another card.",
    "card_declined",
  ),
  insufficient_funds: customer(
    "There were not enough funds available on the card.",
    "Ask the customer to use another card or payment method.",
    "insufficient_funds",
  ),
  invalid_cvv: customer(
    "The card security code (CVV/CVC) was incorrect.",
    "Ask the customer to re-enter the card details.",
    "card_declined",
  ),
  invalid_card_holder_name: customer(
    "The card holder name was invalid.",
    "Ask the customer to re-enter the name as shown on the card.",
    "invalid_request",
  ),
  invalid_card_number: customer(
    "The card number was invalid.",
    "Ask the customer to re-enter the card number or use another card.",
    "card_declined",
  ),
  invalid_card_type: {
    category: "payment_method_unavailable",
    explanation: `The card type is not accepted or not supported. ${NAME_DERIVED}`,
    nextAction: "Ask the customer to use another card type or payment method.",
    retry: "do_not_retry",
    retryExplanation: "Retrying with the same card will not change the result.",
    confidence: "possible",
  },
  possible_fraud: {
    category: "fraud_or_risk",
    explanation: `The payment was flagged as possible fraud. ${NAME_DERIVED}`,
    nextAction: "Do not retry automatically. Review the order before accepting another attempt.",
    retry: "do_not_retry",
    retryExplanation: "Retrying a payment flagged as possible fraud is not advisable.",
    confidence: "possible",
  },
  refused_by_issuer: customer(
    "The card issuer refused the payment.",
    "Ask the customer to contact their issuer or use another card.",
    "card_declined",
  ),
  unknown_reason: {
    category: "unknown",
    explanation: "Mollie reports that the failure reason was not specified.",
    nextAction:
      "Check the payment in the Mollie Dashboard and show the customer the failureMessage, if any.",
    retry: "unknown",
    retryExplanation: "Without a reason, retry safety cannot be assessed.",
    confidence: "insufficient",
  },
};

export type StatusEntry = {
  stage: LifecycleStage;
  outcome: Outcome;
  final: boolean;
  description: string;
};

/** Payment statuses (S2, S4). */
export const PAYMENT_STATUSES: Record<string, StatusEntry> = {
  open: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description:
      "Created; the customer can still complete it. A failed attempt in hosted checkout without a fixed method also leaves the payment open.",
  },
  pending: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "The payment process has started but is not complete yet.",
  },
  authorized: {
    stage: "authorization",
    outcome: "success",
    final: false,
    description:
      "Authorized for a capture-capable method. Not captured yet: it moves to paid once captured, or to canceled/expired when the authorization is released or lapses.",
  },
  paid: {
    stage: "payment",
    outcome: "success",
    final: true,
    description:
      "The customer completed the payment. Refunds and chargebacks can still follow; they change amountRefunded and amountChargedBack, not the status.",
  },
  canceled: {
    stage: "cancellation",
    outcome: "failure",
    final: true,
    description: "The payment was canceled.",
  },
  expired: {
    stage: "cancellation",
    outcome: "failure",
    final: true,
    description: "The payment expired, for example because it was abandoned.",
  },
  failed: {
    stage: "payment",
    outcome: "failure",
    final: true,
    description: "The payment failed.",
  },
};

/** Refund statuses (S12, S17). Refunds have their own status, independent of the payment. */
export const REFUND_STATUSES: Record<string, StatusEntry> = {
  queued: {
    stage: "refund",
    outcome: "pending",
    final: false,
    description: "Queued because of insufficient balance; can still be canceled.",
  },
  pending: {
    stage: "refund",
    outcome: "pending",
    final: false,
    description: "Ready to be picked up for processing; can still be canceled.",
  },
  processing: {
    stage: "refund",
    outcome: "pending",
    final: false,
    description: "Being processed; cancellation is no longer possible.",
  },
  refunded: {
    stage: "refund",
    outcome: "success",
    final: true,
    description: "Completed; the funds have been received by the customer or are on their way.",
  },
  failed: {
    stage: "refund",
    outcome: "failure",
    final: true,
    description:
      "Failed after processing (for example a closed account); funds return to the merchant.",
  },
  canceled: {
    stage: "refund",
    outcome: "failure",
    final: true,
    description: "Canceled; the refund will not be processed.",
  },
};

/** Capture statuses (S14, S22). */
export const CAPTURE_STATUSES: Record<string, StatusEntry> = {
  pending: {
    stage: "capture",
    outcome: "pending",
    final: false,
    description: "Created, not processed yet.",
  },
  succeeded: {
    stage: "capture",
    outcome: "success",
    final: true,
    description:
      "The capture succeeded. The payment moves to paid if no authorized amount remains. A capture is not a settlement.",
  },
  failed: {
    stage: "capture",
    outcome: "failure",
    final: true,
    description: "The capture failed, for example because the authorization had expired.",
  },
};

export type EventTypeEntry = {
  stage: LifecycleStage;
  outcome: Outcome;
  entity: "payment" | "refund" | "chargeback" | "capture" | "payment-link";
  beta: boolean;
};

/** Next-gen webhook event types with known semantics (S6, S8-S11, S16). */
export const EVENT_TYPES: Record<string, EventTypeEntry> = {
  "payment.authorized": {
    stage: "authorization",
    outcome: "success",
    entity: "payment",
    beta: false,
  },
  "payment.canceled": { stage: "cancellation", outcome: "failure", entity: "payment", beta: false },
  "payment.expired": { stage: "cancellation", outcome: "failure", entity: "payment", beta: false },
  "payment.failed": { stage: "payment", outcome: "failure", entity: "payment", beta: false },
  "payment.paid": { stage: "payment", outcome: "success", entity: "payment", beta: false },
  "payment.pending": { stage: "payment", outcome: "pending", entity: "payment", beta: false },
  "refund.queued": { stage: "refund", outcome: "pending", entity: "refund", beta: true },
  "refund.pending": { stage: "refund", outcome: "pending", entity: "refund", beta: true },
  "refund.processing": { stage: "refund", outcome: "pending", entity: "refund", beta: true },
  "refund.refunded": { stage: "refund", outcome: "success", entity: "refund", beta: true },
  "refund.failed": { stage: "refund", outcome: "failure", entity: "refund", beta: true },
  "refund.canceled": { stage: "refund", outcome: "failure", entity: "refund", beta: true },
  // Dispute outcomes are not judged from the event alone.
  "chargeback.received": { stage: "dispute", outcome: "unknown", entity: "chargeback", beta: true },
  "chargeback.reversed": { stage: "dispute", outcome: "unknown", entity: "chargeback", beta: true },
  "capture.succeeded": { stage: "capture", outcome: "success", entity: "capture", beta: true },
  "capture.failed": { stage: "capture", outcome: "failure", entity: "capture", beta: true },
  "payment-link.paid": {
    stage: "payment",
    outcome: "success",
    entity: "payment-link",
    beta: false,
  },
};

/**
 * Documented identifier prefixes (S23 and OpenAPI patterns). Used for
 * structural detection and to tell entity types apart.
 */
export const ID_PREFIXES = {
  payment: "tr_",
  refund: "re_",
  chargeback: "chb_",
  capture: "cpt_",
  order: "ord_",
  subscription: "sub_",
  paymentLink: "pl_",
  event: "event_",
} as const;
