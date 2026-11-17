/**
 * Mercado Pago status and rejection knowledge, kept as data so it can be
 * reviewed and versioned. Source: docs/providers/research/mercadopago.md.
 *
 * Mercado Pago documents `status` and `status_detail` values and payer-facing
 * messages, but no retry guidance per value. The category and retry class of
 * each rejection are PandaPayLens judgments based on the documented meaning.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const D = "https://www.mercadopago.com.br/developers/en";

export const GET_PAYMENT_URL = `${D}/reference/online-payments/checkout-api-payments/get-payment/get`;
export const CREATE_PAYMENT_URL = `${D}/reference/online-payments/checkout-api-payments/create-payment/post`;
export const CANCELLATION_URL = `${D}/reference/online-payments/checkout-api-payments/create-cancellation/put`;
export const CREATE_REFUND_URL = `${D}/reference/online-payments/checkout-api-payments/create-refund/post`;
export const GET_REFUND_URL = `${D}/reference/online-payments/checkout-api-payments/get-refund/get`;
export const COLLECTION_RESULTS_URL = `${D}/docs/checkout-api-payments/response-handling/collection-results`;
export const QUERY_RESULTS_URL = `${D}/docs/checkout-api-payments/response-handling/query-results`;
export const REJECTION_REASONS_URL = `${D}/docs/checkout-api-payments/how-tos/improve-payment-approval/reasons-for-rejection`;
export const NOTIFICATIONS_URL = `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/introduction`;
export const WEBHOOKS_URL = `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks`;
export const IPN_URL = `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/ipn`;
export const NOTIFICATIONS_INFO_URL = `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/additional-info`;
export const PAYMENT_NOTIFICATIONS_URL = `${D}/docs/checkout-pro-preferences/payment-notifications`;
export const REFUNDS_URL = `${D}/docs/checkout-api-payments/payment-management/cancellations-and-refunds/introduction`;
export const CAPTURE_URL = `${D}/docs/checkout-api-payments/payment-management/capture-authorized-payment`;
export const SDK_ERRORS_URL =
  "https://github.com/mercadopago/sdk-nodejs/blob/master/docs/error-handling.md";

export type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  explanation: string;
};

/** Payment `status` values from the Get payment reference. */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  pending: {
    stage: "payment",
    outcome: "pending",
    explanation: "The payer has not finished paying yet, for example an unpaid cash voucher.",
  },
  approved: {
    stage: "payment",
    outcome: "success",
    explanation:
      "Approved and credited. This is not settlement: money_release_date shows when funds become available.",
  },
  authorized: {
    stage: "authorization",
    outcome: "success",
    explanation:
      "Authorized but not captured. Mercado Pago documents a 5 day limit to capture an authorized payment.",
  },
  in_process: {
    stage: "payment",
    outcome: "pending",
    explanation: "Under review. The final result arrives later.",
  },
  in_mediation: {
    stage: "dispute",
    outcome: "pending",
    explanation: "The payer opened a dispute.",
  },
  rejected: {
    stage: "payment",
    outcome: "failure",
    explanation: "Rejected. The payer may try again; status_detail gives the reason.",
  },
  cancelled: {
    stage: "cancellation",
    outcome: "failure",
    explanation:
      "Cancelled by one of the parties, or expired. The payer was not charged for this payment.",
  },
  refunded: {
    stage: "refund",
    outcome: "success",
    explanation: "Refunded to the payer.",
  },
  charged_back: {
    stage: "dispute",
    outcome: "unknown",
    explanation: "A chargeback was issued on the payer's card.",
  },
};

export type DetailInfo = {
  explanation: string;
  /** Overrides the status stage, when the pair says more than the status. */
  stage?: LifecycleStage;
  /** Overrides the status outcome, when the pair says more than the status. */
  outcome?: Outcome;
};

/**
 * Non-rejection `status_detail` values, keyed by `status`. Several values
 * (`pending`, `in_process`, `refunded`, `by_admin`) only make sense with their
 * status, so they are never looked up alone.
 */
export const STATUS_DETAILS: Record<string, Record<string, DetailInfo>> = {
  approved: {
    accredited: { explanation: "The payment was credited." },
    partially_refunded: {
      explanation:
        "The payment has at least one partial refund. transaction_amount_refunded shows how much.",
    },
    partially_bpp_refunded: {
      explanation:
        "A mediation went in the payer's favor and part of the payment was refunded to them.",
    },
    partially_bpp_covered: {
      explanation: "A mediation went in favor of both parties and part of the payment was covered.",
    },
  },
  authorized: {
    pending_capture: { explanation: "Authorized and waiting for capture." },
  },
  in_process: {
    offline_process: { explanation: "Being processed offline because online processing failed." },
    pending_contingency: {
      explanation: "Temporary failure; the payment will be processed later.",
    },
    pending_review_manual: { explanation: "Under manual review before approval or rejection." },
    deferred_retry: { explanation: "Scheduled to be retried later by Mercado Pago." },
    pending_provider_response: { explanation: "Waiting for the processor's response." },
  },
  pending: {
    pending_waiting_transfer: {
      explanation: "Waiting for the payer to finish the bank transfer in their bank.",
    },
    pending_waiting_payment: {
      explanation: "Offline payment method; waiting for the payer to pay.",
    },
    pending_waiting_for_remedy: {
      explanation: "Offline payment method; waiting for the payer to resolve the situation.",
    },
    pending_challenge: {
      stage: "authentication",
      explanation: "Waiting for the payer to complete a card challenge (3DS).",
    },
  },
  cancelled: {
    expired: { explanation: "Cancelled automatically after 30 days in pending status." },
    by_collector: { explanation: "Cancelled by the seller (collector)." },
    by_payer: { explanation: "Cancelled by the payer." },
    by_admin: { explanation: "Cancelled by the administrator." },
  },
  refunded: {
    refunded: { explanation: "Refunded by the seller (collector)." },
    by_admin: { explanation: "Refunded by the administrator." },
    bpp_refunded: {
      explanation: "A mediation went in the payer's favor and Mercado Pago covered the refund.",
    },
  },
  charged_back: {
    in_process: {
      outcome: "pending",
      explanation: "The payer disowned the payment and the chargeback is in progress.",
    },
    settled: {
      explanation:
        "The money was retained after the chargeback. Mercado Pago does not say in whose favor.",
    },
    reimbursed: {
      explanation:
        "The money was reimbursed after the chargeback. Mercado Pago does not say to whom.",
    },
  },
  in_mediation: {
    pending: { explanation: "A mediation or dispute is in progress." },
  },
};

export type RejectionEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  confidence: Confidence;
};

type Opts = { confidence?: Confidence };

const make =
  (retry: RetryGuidance, retryExplanation: string) =>
  (category: ErrorCategory, explanation: string, nextAction: string, opts: Opts = {}) =>
    ({
      category,
      explanation,
      nextAction,
      retry,
      retryExplanation,
      confidence: opts.confidence ?? "strong",
    }) satisfies RejectionEntry;

const customer = make(
  "customer_action_required",
  "Retrying the same payment data is likely to fail again; the payer has to correct the data or use another card or payment method.",
);
const noRetry = make(
  "do_not_retry",
  "Do not retry with the same payment data. This rejection is final for this attempt.",
);
const conditional = make(
  "retry_conditionally",
  "The payment status is rejected. A new attempt makes sense only after the cause is addressed.",
);
const unknownRetry = make(
  "unknown",
  "Mercado Pago does not describe this rejection in enough detail to judge a retry.",
);

/** `status_detail` values of rejected payments. */
export const REJECTION_DETAILS: Record<string, RejectionEntry> = {
  cc_rejected_bad_filled_card_number: customer(
    "invalid_request",
    "The card number was entered incorrectly.",
    "Ask the payer to check the card number.",
  ),
  cc_rejected_bad_filled_date: customer(
    "invalid_request",
    "The expiration date was entered incorrectly.",
    "Ask the payer to check the expiration date.",
  ),
  cc_rejected_bad_filled_security_code: customer(
    "invalid_request",
    "The security code (CVV) was entered incorrectly.",
    "Ask the payer to check the security code.",
  ),
  cc_rejected_bad_filled_other: customer(
    "invalid_request",
    "Some card details were entered incorrectly.",
    "Ask the payer to review the card details.",
  ),
  cc_rejected_call_for_authorize: customer(
    "card_declined",
    "The issuer requires the payer to authorize this amount before it can be charged.",
    "Ask the payer to contact the card issuer to authorize the payment, or to use another method.",
  ),
  cc_rejected_card_disabled: customer(
    "card_declined",
    "The card is inactive.",
    "Ask the payer to activate the card with the issuer or use another payment method.",
  ),
  cc_rejected_insufficient_amount: customer(
    "insufficient_funds",
    "The card limit or funds are not enough for this amount.",
    "Ask the payer to use another card or payment method.",
  ),
  cc_rejected_invalid_installments: customer(
    "invalid_request",
    "The card does not accept the selected number of installments.",
    "Offer a different number of installments or another payment method.",
  ),
  cc_rejected_max_attempts: customer(
    "card_declined",
    "The allowed number of attempts for this card was reached.",
    "Ask the payer to use another card or payment method.",
  ),
  cc_rejected_duplicated_payment: noRetry(
    "duplicate_request",
    "Rejected as a duplicate of a payment of the same value on the issuer side.",
    "Check whether an earlier payment for the same order succeeded before asking the payer to pay again with another card or method.",
  ),
  cc_rejected_card_type_not_allowed: customer(
    "payment_method_unavailable",
    "The payer's combined debit and credit card does not have the credit function enabled.",
    "Ask the payer to enable the credit function or use another payment method.",
  ),
  cc_rejected_card_error: unknownRetry(
    "card_declined",
    "The card payment could not be processed. Mercado Pago gives no further detail.",
    "Ask the payer to try another card or payment method.",
    { confidence: "possible" },
  ),
  cc_rejected_other_reason: customer(
    "card_declined",
    "Generic rejection given by the bank without a reason. Mercado Pago lists it under fraud prevention as a risk estimate, but says other reasons are possible.",
    "Ask the payer to use another payment method or to contact the issuing bank.",
    { confidence: "possible" },
  ),
  cc_rejected_3ds_challenge: customer(
    "authentication_failed",
    "The payer did not pass the 3DS challenge.",
    "Let the payer retry the challenge or use another card.",
  ),
  cc_rejected_3ds_mandatory: conditional(
    "authentication_required",
    "3DS authentication was mandatory for this payment but was not performed.",
    "Create a new payment with 3DS authentication enabled.",
  ),
  cc_rejected_blacklist: noRetry(
    "fraud_or_risk",
    "The card is on a denial list related to theft, complaints or fraud.",
    "Do not retry with this card.",
  ),
  cc_rejected_high_risk: noRetry(
    "fraud_or_risk",
    "Rejected by Mercado Pago fraud prevention.",
    "Do not retry immediately with the same payment data; Mercado Pago recommends controls against that. Offer another payment method.",
  ),
  rejected_high_risk: noRetry(
    "fraud_or_risk",
    "Rejected after risk assessment, credit scoring or suspected fraud.",
    "Do not retry immediately with the same data; offer another payment method.",
  ),
  cc_rejected_time_out: conditional(
    "network_or_timeout",
    "Mercado Pago did not receive a response in time and rejected the payment.",
    "The payment status is rejected. Check the payment in Mercado Pago before starting a new one.",
  ),
  cc_amount_rate_limit_exceeded: customer(
    "payment_method_unavailable",
    "The payment method's maximum allowed capacity (CAP) was exceeded.",
    "Offer another payment method or a lower amount.",
  ),
  rejected_insufficient_data: noRetry(
    "invalid_request",
    "Required payment information was missing.",
    "Add the missing mandatory data to the payment request before trying again.",
  ),
  rejected_by_regulations: noRetry(
    "unknown",
    "Rejected by regulations. Mercado Pago gives no further detail.",
    "Review the payment against the applicable rules before trying again.",
    { confidence: "possible" },
  ),
  rejected_by_biz_rule: noRetry(
    "unknown",
    "Rejected by business rules. Mercado Pago gives no further detail.",
    "Review the payment against the account's business rules before trying again.",
    { confidence: "possible" },
  ),
  insufficient_amount: unknownRetry(
    "unknown",
    "Rejected for insufficient amount. Mercado Pago does not say whether this means the payer's funds or a minimum amount.",
    "Check the amount and the payer's balance.",
    { confidence: "possible" },
  ),
  bank_error: conditional(
    "provider_unavailable",
    "Bank transfer payment rejected because of an error with the bank.",
    "The payment status is rejected. Offer another payment method or check with the bank before a new attempt.",
  ),
  bank_rejected: customer(
    "unknown",
    "Bank transfer payment rejected by the bank.",
    "Ask the payer to contact their bank or use another payment method.",
    { confidence: "possible" },
  ),
  rejected_by_bank: customer(
    "card_declined",
    "The operation was rejected by the bank.",
    "Ask the payer to contact their bank or use another payment method.",
    { confidence: "possible" },
  ),
  payer_unavailable: customer(
    "unknown",
    "The payer is restricted and cannot operate.",
    "The payer has to resolve the restriction with Mercado Pago or use another account.",
    { confidence: "possible" },
  ),
  rejected_other_reason: unknownRetry(
    "unknown",
    "Rejected for an unclassified reason.",
    "Check the payment in Mercado Pago before trying again.",
    { confidence: "possible" },
  ),
};

/** Refund `status` values. Mercado Pago reuses the payment descriptions for them. */
export const REFUND_STATUSES: Record<string, { outcome: Outcome; explanation: string }> = {
  approved: { outcome: "success", explanation: "The refund was approved." },
  in_process: { outcome: "pending", explanation: "The refund is being processed." },
  rejected: { outcome: "failure", explanation: "The refund was rejected." },
  cancelled: { outcome: "failure", explanation: "The refund was cancelled." },
  authorized: {
    outcome: "unknown",
    explanation: "Listed for refunds without a refund-specific meaning.",
  },
};

export type HttpErrorEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

/**
 * Error classes by HTTP status, from Mercado Pago's official Node.js SDK
 * (error classes and its error handling guide). The Payments API reference
 * lists error numbers, but not the body field that carries them.
 */
export const HTTP_ERRORS: Record<number, HttpErrorEntry> = {
  400: {
    category: "invalid_request",
    explanation: "Bad request: the request failed validation.",
    nextAction: "Correct the request using the message and the API reference error list.",
    retry: "do_not_retry",
    retryExplanation: "An identical retry fails again.",
  },
  401: {
    category: "configuration",
    explanation: "Authentication failed: the access token is missing, invalid or lacks scope.",
    nextAction: "Check the access token and its permissions.",
    retry: "do_not_retry",
    retryExplanation: "Retrying with the same credentials fails again.",
  },
  402: {
    category: "unknown",
    explanation:
      "Payment processing error. Mercado Pago's SDK describes this status for the Orders and advanced payments APIs.",
    nextAction: "Check the payment's state with GET /v1/payments/{id} if a payment id is known.",
    retry: "unknown",
    retryExplanation: "Retry safety cannot be assessed from the status alone.",
  },
  403: {
    category: "configuration",
    explanation: "Forbidden: the caller is not authorized for this resource or action.",
    nextAction: "Check the application's permissions and the access token used.",
    retry: "do_not_retry",
    retryExplanation: "Retrying without a permission change fails again.",
  },
  404: {
    category: "invalid_request",
    explanation: "Not found: the payment, refund or other resource does not exist.",
    nextAction: "Check the id in the request and the environment (test or production).",
    retry: "do_not_retry",
    retryExplanation: "An identical retry fails again.",
  },
  409: {
    category: "duplicate_request",
    explanation: "Conflict with an idempotency key or with the resource's current state.",
    nextAction: "Keep the original idempotency key and reconcile the operation it belongs to.",
    retry: "manual_review",
    retryExplanation: "Reconcile the original operation before sending anything new.",
  },
  422: {
    category: "invalid_request",
    explanation: "A business rule rejected the request.",
    nextAction: "Read the message and correct the request.",
    retry: "do_not_retry",
    retryExplanation: "An identical retry fails again.",
  },
  423: {
    category: "duplicate_request",
    explanation: "The idempotency key is temporarily locked by a request in progress.",
    nextAction: "Wait, then check the result of the original request.",
    retry: "retry_conditionally",
    retryExplanation:
      "Retry with the same idempotency key only within a bounded policy, after checking the original request.",
  },
  424: {
    category: "provider_unavailable",
    explanation: "An internal dependency of Mercado Pago failed.",
    nextAction: "Check whether the operation took effect before repeating it.",
    retry: "retry_conditionally",
    retryExplanation:
      "Retry only within a bounded policy and with the same idempotency key; the original outcome may be unknown.",
  },
  429: {
    category: "rate_limiting",
    explanation: "Too many requests.",
    nextAction: "Respect Retry-After when present and reduce concurrency.",
    retry: "retry_conditionally",
    retryExplanation: "Retry after the indicated delay.",
  },
};

export const SERVER_ERROR: HttpErrorEntry = {
  category: "provider_unavailable",
  explanation: "Mercado Pago server error.",
  nextAction: "Check whether the operation took effect, for example with GET /v1/payments/{id}.",
  retry: "retry_conditionally",
  retryExplanation:
    "The original outcome is unknown. Reconcile before repeating a write, and reuse the same idempotency key.",
};

/** Webhook `type` values (topics) documented for Webhooks notifications. */
export const WEBHOOK_TOPICS = new Set([
  "payment",
  "order",
  "orders",
  "subscription_authorized_payment",
  "subscription_preapproval",
  "subscription_preapproval_plan",
  "mp-connect",
  "wallet_connect",
  "stop_delivery_op_wh",
  "delivery_cancellation",
  "topic_claims_integration_wh",
  "claim",
  "topic_card_id_wh",
  "automatic-payments",
  "topic_merchant_order_wh",
  "merchant_order",
  "topic_chargebacks_wh",
  "chargebacks",
  "point_integration_wh",
]);

/** Documented `action` values of `payment` Webhooks notifications. */
export const PAYMENT_ACTIONS = new Set(["payment.created", "payment.updated"]);

/** Documented IPN `topic` values. */
export const IPN_TOPICS = new Set([
  "payment",
  "chargebacks",
  "merchant_order",
  "point_integration_ipn",
]);

export function lookup<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}
