/**
 * Klarna error and status knowledge, kept as data so it can be reviewed and versioned.
 *
 * Klarna documents error codes per API (Klarna Payments and Order Management)
 * with an HTTP status, a sample message and handling notes, but no category or
 * retry classification. The PandaPayLens category and retry class of every
 * entry is derived from the documented description. Several codes (NOT_FOUND,
 * BAD_VALUE, BAD_REQUEST, INTERNAL_SERVER_ERROR) appear in both APIs; the
 * error body does not say which API produced it.
 *
 * Research note: docs/providers/research/klarna.md
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const ACQ = "https://docs.klarna.com/acquirer/klarna";

export const OM_API_URL = "https://docs.klarna.com/acquirer/klarna/api/ordermanagement/";
export const PAYMENTS_API_URL = "https://docs.klarna.com/acquirer/klarna/api/payments/";
export const OM_ERRORS_URL = `${ACQ}/resources/developer-tools/error-handling/error-codes-and-messages-for-order-management/`;
export const KP_ERRORS_URL = `${ACQ}/resources/developer-tools/error-handling/error-codes-and-messages-for-klarna-payments/`;
export const ERRORS_OVERVIEW_URL = `${ACQ}/resources/developer-tools/error-handling/error-codes-and-messages/`;
export const ERROR_OBJECT_URL = `${ACQ}/get-started/integration-resilience/errors/`;
export const RETRY_POLICY_URL = `${ACQ}/get-started/integration-resilience/escalation-and-retry-policy/`;
export const CREATE_ORDER_URL = `${ACQ}/web-payments/integrate-with-klarna-payments/integrate-via-sdk/step-3-create-an-order/`;
export const VIEW_ORDERS_URL = `${ACQ}/after-payments/order-management/manage-orders-with-the-api/view-and-change-orders/`;
export const CAPTURE_URL = `${ACQ}/after-payments/order-management/manage-orders-with-the-api/capture-and-track-orders/`;
export const REFUND_URL = `${ACQ}/after-payments/order-management/manage-orders-with-the-api/refund-orders-and-manage-authorizations/`;
export const HPP_CALLBACKS_URL = `${ACQ}/web-payments/integrate-with-klarna-payments/integrate-via-hpp/api-documentation/status-callbacks/`;
export const HPP_STATUS_URL = `${ACQ}/web-payments/integrate-with-klarna-payments/integrate-via-hpp/before-you-start/tracking-session-status/`;
export const AUTH_CALLBACK_URL = `${ACQ}/web-payments/integrate-with-klarna-payments/other-actions/authorization-callback/`;
export const CALLBACKS_URL = `${ACQ}/get-started/integration-resilience/callbacks/`;

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  /** Most specific documentation page for this code. */
  docs: string;
  /** Which Klarna API documents the code. */
  api: "payments" | "order_management" | "both";
  /** HTTP statuses Klarna documents for this code, when stated. */
  http?: readonly number[];
  /** Lower than the default `strong` when the documented meaning is thin. */
  confidence?: Confidence;
  /** The provider gave a definitive answer about the operation. */
  outcomeKnown?: boolean;
};

const verifyFirst =
  "The original request may or may not have taken effect. Check the order with a GET call first. Klarna's Order Management policy allows a retry (after 5 seconds, 5 minutes, then 5 hours) only for reads and for POST/PATCH calls sent with a Klarna-Idempotency-Key; without the key, escalate instead of retrying.";
const escalate =
  "Klarna's escalation policy says 4xx answers are escalated rather than retried. A new attempt makes sense only after the cause is fixed.";
const fixRequest = "Fix the request (the error message names the field) before sending it again.";
const sameAgain = "The same request will fail again.";

/**
 * Codes keyed by `error_code`. Entries with `byStatus` have a different
 * documented meaning per HTTP status; `default` is used when no status is known.
 */
export type CodeEntry = CatalogEntry & { byStatus?: Readonly<Record<string, CatalogEntry>> };

const notFoundOm404: CatalogEntry = {
  api: "order_management",
  http: [404],
  category: "invalid_request",
  explanation: "The order, capture or refund could not be found.",
  nextAction: "Check that the order, capture and refund ids in the request are correct.",
  retry: "do_not_retry",
  retryExplanation: sameAgain,
  docs: OM_ERRORS_URL,
  confidence: "possible",
};
const notFoundOm400: CatalogEntry = {
  api: "order_management",
  http: [400],
  category: "invalid_request",
  explanation:
    "Order Management lists NOT_FOUND under HTTP 400 as an invalid request (its sample message says a refund cannot be found for the order).",
  nextAction: "Check the request against the Order Management API reference and the ids it uses.",
  retry: "do_not_retry",
  retryExplanation: sameAgain,
  docs: OM_ERRORS_URL,
};
const badValue400: CatalogEntry = {
  api: "payments",
  http: [400],
  category: "invalid_request",
  explanation:
    "A property in the request failed validation. The error message names it, for example tax amounts or rates, order lines, purchase currency, an address field, the attachment or the locale.",
  nextAction: `${fixRequest} For amount or order line errors, compare the last accepted session data with the create order request.`,
  retry: "do_not_retry",
  retryExplanation: sameAgain,
  docs: KP_ERRORS_URL,
};
const badValue409: CatalogEntry = {
  api: "payments",
  http: [409],
  category: "invalid_request",
  explanation:
    "Data sent in an earlier step (session, load or authorize) was changed, so the fields no longer match, or the order was already completed with a different request body.",
  nextAction: "Send the same data that was authorized, or authorize again with the changed data.",
  retry: "do_not_retry",
  retryExplanation: sameAgain,
  docs: KP_ERRORS_URL,
};
const serverError: CatalogEntry = {
  api: "both",
  http: [500],
  category: "provider_unavailable",
  explanation: "Something went wrong inside Klarna.",
  nextAction:
    "Check the order state before acting, then follow Klarna's escalation and retry policy.",
  retry: "retry_conditionally",
  retryExplanation: verifyFirst,
  docs: OM_ERRORS_URL,
};

export const ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  // Order Management
  CAPTURE_NOT_ALLOWED: {
    api: "order_management",
    http: [403],
    category: "invalid_request",
    explanation:
      "Klarna refused the capture. The order may be cancelled or expired, or the amount may exceed the remaining authorized amount. The customer may not receive the goods and the merchant may not be settled.",
    nextAction:
      "Check the order status, expires_at and remaining_authorized_amount. The customer may need to place the order again.",
    retry: "manual_review",
    retryExplanation: escalate,
    docs: OM_ERRORS_URL,
    outcomeKnown: true,
  },
  CANCEL_NOT_ALLOWED: {
    api: "order_management",
    http: [403],
    category: "invalid_request",
    explanation:
      "Klarna refused the cancel. An order that has captures, or is closed, cannot be cancelled.",
    nextAction: "Refund the captured amount instead, or release the remaining authorization.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
    outcomeKnown: true,
  },
  NOT_ALLOWED: {
    api: "order_management",
    http: [403],
    category: "invalid_request",
    explanation:
      "The operation is not allowed in the order's current state, for example updating the authorization below the captured amount, releasing the authorization of a fully captured order, or extending an expired or cancelled order.",
    nextAction:
      "Read the error message and the order's status and amounts before changing the request.",
    retry: "manual_review",
    retryExplanation: escalate,
    docs: OM_ERRORS_URL,
    outcomeKnown: true,
  },
  REFUND_NOT_ALLOWED: {
    api: "order_management",
    http: [403],
    category: "invalid_amount",
    explanation:
      "Klarna refused the refund. Only captured amounts can be refunded, and a refund larger than the captured amount fails as a whole.",
    nextAction:
      "Check captured_amount and refunded_amount on the order. If the refund still has to happen, make sure the customer's money is returned.",
    retry: "manual_review",
    retryExplanation: escalate,
    docs: OM_ERRORS_URL,
    outcomeKnown: true,
  },
  NO_SUCH_ORDER: {
    api: "order_management",
    http: [404],
    category: "invalid_request",
    explanation: "The order (or the capture or refund in the path) could not be found.",
    nextAction: "Check that the order id is correct and belongs to the credentials used.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
  },
  NO_SUCH_CAPTURE: {
    api: "order_management",
    http: [404],
    category: "invalid_request",
    explanation: "The capture could not be found.",
    nextAction: "Check the order id and capture id in the request.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
  },
  NOT_FOUND: {
    ...notFoundOm404,
    api: "both",
    http: [400, 404],
    explanation:
      "Klarna could not find the resource. Order Management uses it for an order, capture or refund that does not exist; Klarna Payments for an invalid session id or an expired or replaced authorization token.",
    nextAction:
      "Check the ids in the request. For Klarna Payments, request a new authorization token (orders must be placed within 60 minutes of authorization).",
    byStatus: { "400": notFoundOm400 },
  },
  INVALID_ORDER_ID: {
    api: "order_management",
    category: "invalid_request",
    explanation: "The order id is not a valid UUID.",
    nextAction: "Send the order_id returned when the order was created.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: VIEW_ORDERS_URL,
  },
  CONFLICT: {
    api: "order_management",
    http: [409],
    category: "invalid_request",
    explanation: "The request conflicts with the current state of the order.",
    nextAction: "Read the order's current state before deciding on a new request.",
    retry: "manual_review",
    retryExplanation: escalate,
    docs: OM_ERRORS_URL,
    confidence: "possible",
  },
  REQUEST_TOO_LARGE: {
    api: "order_management",
    http: [413],
    category: "invalid_request",
    explanation: "The request is too large.",
    nextAction:
      "Reduce the request, for example the number of order lines, and check it against the API reference.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
  },
  INVALID_ADDRESS: {
    api: "order_management",
    http: [422],
    category: "invalid_request",
    explanation: "The shipping or billing address is invalid.",
    nextAction: fixRequest,
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
  },
  UNPROCESSABLE_ENTITY: {
    api: "order_management",
    http: [422],
    category: "invalid_request",
    explanation:
      "Klarna cannot process the request, for example a field exceeds its allowed length.",
    nextAction: fixRequest,
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: OM_ERRORS_URL,
  },
  TOO_MANY_REQUESTS: {
    api: "order_management",
    http: [429],
    category: "rate_limiting",
    explanation: "Too many requests were sent in a short time.",
    nextAction: "Slow down and spread requests out, following Klarna's rate limit guide.",
    retry: "retry_conditionally",
    retryExplanation:
      "Retry later at a lower rate. Klarna does not say whether a rate-limited write was processed; check the order first and resend writes only with the same idempotency key.",
    docs: OM_ERRORS_URL,
  },
  INTERNAL_SERVER_ERROR: serverError,
  UNEXPECTED_ERROR: { ...serverError, api: "order_management" },
  TEMPORARILY_UNAVAILABLE: {
    ...serverError,
    api: "order_management",
    http: [502, 503, 504],
    explanation: "The Klarna service is temporarily unavailable.",
  },
  // Klarna Payments
  BAD_REQUEST: {
    api: "both",
    http: [400],
    category: "invalid_request",
    explanation: "Klarna treats the request as a client error and will not process it.",
    nextAction: "Check the request against the API reference.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: KP_ERRORS_URL,
    confidence: "possible",
  },
  BAD_VALUE: {
    ...badValue400,
    http: [400, 409],
    explanation:
      "A property in the request failed validation (HTTP 400; the message names it), or data authorized in an earlier step was changed (HTTP 409).",
    nextAction: `${fixRequest} If fields no longer match the authorization, send the authorized data or authorize again.`,
    byStatus: { "400": badValue400, "409": badValue409 },
  },
  UNAUTHORIZED: {
    api: "payments",
    http: [401],
    category: "configuration",
    explanation: "The API credentials are invalid.",
    nextAction: "Check the credentials; if several were created, use the latest one.",
    retry: "do_not_retry",
    retryExplanation: "The request will fail until the credentials are fixed.",
    docs: KP_ERRORS_URL,
  },
  INVALID_OPERATION: {
    api: "payments",
    http: [403],
    category: "configuration",
    explanation:
      "The operation is not allowed or not configured for this merchant id, for example an authorization token that was already used, or a customer token for a purchase intent that does not allow one.",
    nextAction: "Check the error message and the merchant id's configuration with Klarna.",
    retry: "manual_review",
    retryExplanation: "A new attempt needs the configuration or the flow to change first.",
    docs: KP_ERRORS_URL,
  },
  MERCHANT_INACTIVE: {
    api: "payments",
    http: [403],
    category: "configuration",
    explanation: "The merchant id has not been activated.",
    nextAction: "Contact Klarna merchant support or the delivery manager to activate it.",
    retry: "manual_review",
    retryExplanation: "Requests fail until Klarna activates the merchant id.",
    docs: KP_ERRORS_URL,
  },
  REJECTED: {
    api: "payments",
    http: [403],
    category: "payment_method_unavailable",
    explanation:
      "Klarna did not approve the authorization. Klarna does not give a reason in the response.",
    nextAction: "Offer the customer another payment method.",
    retry: "customer_action_required",
    retryExplanation:
      "Do not resend the same request. A new purchase attempt needs the customer to act.",
    docs: KP_ERRORS_URL,
    outcomeKnown: true,
  },
  SESSION_COMPLETED: {
    api: "payments",
    http: [404],
    category: "duplicate_request",
    explanation:
      "The session already has an order, so pre-purchase operations (update session, authorize, create order) are not allowed. This is common when the authorization callback already placed the order.",
    nextAction:
      "Look up the order that was already created for this session instead of creating another.",
    retry: "do_not_retry",
    retryExplanation: "An order already exists for this session.",
    docs: KP_ERRORS_URL,
    outcomeKnown: true,
  },
  // Klarna Payments, orders placed with a customer token
  TOKEN_NOT_FOUND: {
    api: "payments",
    http: [404],
    category: "invalid_request",
    explanation: "The customer token was not found.",
    nextAction: "Check that the token in the path is the customer's token.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: CREATE_ORDER_URL,
  },
  TOKEN_SUSPENDED: {
    api: "payments",
    http: [403],
    category: "payment_method_unavailable",
    explanation: "Klarna has suspended the customer token.",
    nextAction: "Ask the customer to pay again in a new session.",
    retry: "do_not_retry",
    retryExplanation: "The suspended token cannot be charged.",
    docs: CREATE_ORDER_URL,
    outcomeKnown: true,
  },
  TOKEN_CANCELED: {
    api: "payments",
    http: [403],
    category: "configuration",
    explanation: "The customer token exists but is not linked to this merchant id.",
    nextAction: "Use a customer token created for this merchant id.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: CREATE_ORDER_URL,
  },
  UNAVAILABLE_PAYMENT_METHOD: {
    api: "payments",
    http: [403],
    category: "payment_method_unavailable",
    explanation: "The payment method cannot be used for orders in this currency.",
    nextAction: "Check the purchase currency against the token's payment method.",
    retry: "do_not_retry",
    retryExplanation: sameAgain,
    docs: CREATE_ORDER_URL,
    outcomeKnown: true,
  },
  PAYMENT_METHOD_FAILED: {
    api: "payments",
    http: [403],
    category: "payment_method_unavailable",
    explanation:
      "The purchase failed for the payment method. For a credit payment method Klarna says the customer was most likely rejected.",
    nextAction:
      "Check the purchase before trying again; offer another payment method if it keeps failing.",
    retry: "retry_conditionally",
    retryExplanation:
      "Klarna suggests resending the request. Use the same idempotency key so a purchase is not created twice.",
    docs: CREATE_ORDER_URL,
    confidence: "possible",
    outcomeKnown: true,
  },
  SERVICE_UNAVAILABLE: {
    ...serverError,
    api: "payments",
    http: [503],
    explanation: "A temporary internal Klarna error occurred.",
    docs: CREATE_ORDER_URL,
  },
};

/** Resolves the documented meaning of a code, using the HTTP status when it disambiguates. */
export function errorEntry(
  code: string | undefined,
  httpStatus?: number,
): CatalogEntry | undefined {
  const entry = lookup(ERROR_CODES, code);
  if (!entry) return undefined;
  if (httpStatus !== undefined && entry.byStatus) {
    const specific = lookup(entry.byStatus, String(httpStatus));
    if (specific) return specific;
  }
  return entry;
}

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome; explanation: string };

/**
 * Order Management order.status. Klarna lists the values without describing
 * them; the stage and outcome are PandaPayLens readings of the names and of
 * the documented operations.
 */
export const ORDER_STATUSES: Readonly<Record<string, StatusInfo>> = {
  AUTHORIZED: {
    stage: "authorization",
    outcome: "success",
    explanation: "Authorized and not captured yet. Not a capture and not a settlement.",
  },
  PART_CAPTURED: {
    stage: "capture",
    outcome: "success",
    explanation: "Part of the order amount was captured.",
  },
  CAPTURED: {
    stage: "capture",
    outcome: "success",
    explanation: "The order amount was captured. Capture is not a settlement confirmation.",
  },
  CANCELLED: {
    stage: "cancellation",
    outcome: "success",
    explanation: "The order was cancelled and the authorized amount released.",
  },
  EXPIRED: {
    stage: "authorization",
    outcome: "failure",
    explanation: "The authorization expired; the order can no longer be captured.",
  },
  CLOSED: {
    stage: "other",
    outcome: "unknown",
    explanation: "Klarna does not describe the CLOSED status.",
  },
};

/** fraud_status values: Order Management lists all three, Klarna Payments ACCEPTED and PENDING. */
export const FRAUD_STATUSES: readonly string[] = ["ACCEPTED", "PENDING", "REJECTED"];

/** Klarna Payments authorized_payment_method.type values (Payments API reference). */
export const AUTHORIZED_PAYMENT_METHOD_TYPES: readonly string[] = [
  "invoice",
  "fixed_amount",
  "base_account",
  "direct_debit",
  "direct_bank_transfer",
  "b2b_invoice",
  "card",
  "slice_it_by_card",
  "pay_later_by_card",
  "pay_by_card",
  "fixed_sum_credit",
  "alternative_payment_method",
];

/** Hosted Payment Page session statuses (TIMEOUT is named on the status callbacks page). */
export const HPP_STATUSES: Readonly<Record<string, StatusInfo>> = {
  WAITING: {
    stage: "payment",
    outcome: "pending",
    explanation: "The session exists but the customer has not opened the payment page yet.",
  },
  IN_PROGRESS: {
    stage: "payment",
    outcome: "pending",
    explanation: "The customer opened the payment page.",
  },
  COMPLETED: {
    stage: "authorization",
    outcome: "success",
    explanation:
      "The customer got an authorization. The order still has to be placed unless the session's place_order_mode placed it.",
  },
  FAILED: {
    stage: "authorization",
    outcome: "failure",
    explanation: "The customer was declined. The session stays open for another try.",
  },
  CANCELLED: {
    stage: "cancellation",
    outcome: "success",
    explanation: "The customer cancelled the session. This is definitive.",
  },
  BACK: {
    stage: "payment",
    outcome: "pending",
    explanation: "The customer pressed back. The session stays open.",
  },
  ERROR: {
    stage: "payment",
    outcome: "pending",
    explanation: "The customer hit an error while paying. The session stays open.",
  },
  DISABLED: {
    stage: "cancellation",
    outcome: "success",
    explanation: "The merchant disabled the session through the API.",
  },
  TIMEOUT: {
    stage: "payment",
    outcome: "failure",
    explanation: "The session timer expired before the customer finished.",
  },
};

/** Own-property lookup, so codes such as "constructor" never hit the prototype. */
export function lookup<T>(
  table: Readonly<Record<string, T>>,
  key: string | undefined,
): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}
