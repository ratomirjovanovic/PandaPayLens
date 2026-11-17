/**
 * Paddle Billing knowledge, kept as data. Every value comes from the research
 * file (docs/providers/research/paddle.md), which cites developer.paddle.com.
 *
 * Errors:            https://developer.paddle.com/api-reference/about/errors
 * Error reference:   https://developer.paddle.com/errors
 * Webhooks:          https://developer.paddle.com/webhooks/about/how-webhooks-work
 * Transaction enums: https://developer.paddle.com/webhooks/transactions/transaction-payment-failed
 *
 * Explanations paraphrase Paddle's documentation. Category and retry values
 * are PandaPayLens mappings, not Paddle statements.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const DOCS = "https://developer.paddle.com";
export const ERRORS_URL = `${DOCS}/api-reference/about/errors`;
export const ERROR_REFERENCE_URL = `${DOCS}/errors`;
export const SUCCESS_RESPONSES_URL = `${DOCS}/api-reference/about/success-responses`;
export const HOW_WEBHOOKS_WORK_URL = `${DOCS}/webhooks/about/how-webhooks-work`;
export const RESPOND_TO_WEBHOOKS_URL = `${DOCS}/webhooks/about/respond-to-webhooks`;
export const SIGNATURE_VERIFICATION_URL = `${DOCS}/webhooks/about/signature-verification`;
export const PAYMENT_FAILED_URL = `${DOCS}/webhooks/transactions/transaction-payment-failed`;
export const GET_TRANSACTION_URL = `${DOCS}/api-reference/transactions/get-transaction`;
export const ADJUSTMENT_CREATED_URL = `${DOCS}/webhooks/adjustments/adjustment-created`;
export const LIST_ADJUSTMENTS_URL = `${DOCS}/api-reference/adjustments/list-adjustments`;
export const GET_SUBSCRIPTION_URL = `${DOCS}/api-reference/subscriptions/get-subscription`;
export const SUBSCRIPTION_PAST_DUE_URL = `${DOCS}/webhooks/subscriptions/subscription-past-due`;

/** Documented id prefixes (OpenAPI patterns; only the prefix is checked). */
export const ID_PREFIXES = {
  transaction: "txn_",
  adjustment: "adj_",
  subscription: "sub_",
  event: "evt_",
  notification: "ntf_",
} as const;

/** Documented `error.type` values. */
export const ERROR_TYPES: Record<string, string> = {
  request_error: "Typically a problem with the request that was made.",
  api_error: "Typically a problem with the Paddle API.",
};

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  confidence: Confidence;
};

export type ErrorGroup = "shared" | "adjustments" | "transactions" | "subscriptions";

export type ApiErrorEntry = CatalogEntry & { httpStatus: number; group: ErrorGroup };

export const errorDocUrl = (group: ErrorGroup, code: string): string =>
  `${DOCS}/errors/${group}/${code}`;

const REQUEST_SIDE =
  "The request was rejected because of what it asked for. Sending it again unchanged gives the same error.";

function rejected(
  group: ErrorGroup,
  httpStatus: number,
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
): ApiErrorEntry {
  return {
    group,
    httpStatus,
    category,
    explanation,
    nextAction,
    retry: "do_not_retry",
    retryExplanation: REQUEST_SIDE,
    confidence: "strong",
  };
}

function later(
  group: ErrorGroup,
  httpStatus: number,
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retryExplanation: string,
): ApiErrorEntry {
  return {
    group,
    httpStatus,
    category,
    explanation,
    nextAction,
    retry: "retry_conditionally",
    retryExplanation,
    confidence: "strong",
  };
}

const NOT_PROCESSED =
  "Paddle states that the request was not processed, so sending the same request again later does not repeat an operation.";

/**
 * API error codes (error reference, https://developer.paddle.com/errors).
 * All generic and adjustment codes; the payment-relevant subset of the
 * transaction and subscription codes. Other codes stay unknown.
 */
export const API_ERRORS: Record<string, ApiErrorEntry> = {
  // Generic
  authentication_malformed: rejected(
    "shared",
    403,
    "configuration",
    "An Authorization header was sent but it is not in a valid format.",
    "Check the format of the Authorization header and that no proxy changes it.",
  ),
  authentication_missing: rejected(
    "shared",
    403,
    "configuration",
    "The request had no Authorization header.",
    "Add the Authorization header with the API key.",
  ),
  bad_gateway: {
    group: "shared",
    httpStatus: 502,
    category: "provider_unavailable",
    explanation:
      "The endpoint could not handle the request for the moment. Paddle says the request was not processed and the problem is on its side.",
    nextAction: "Wait, then send the request again. Check the Paddle status page if it persists.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: NOT_PROCESSED,
    confidence: "strong",
  },
  bad_request: {
    group: "shared",
    httpStatus: 400,
    category: "invalid_request",
    explanation: "Something in the request is not right; Paddle gives no more specific code.",
    nextAction: "Read the detail text and compare the request with the API reference.",
    retry: "do_not_retry",
    retryExplanation: REQUEST_SIDE,
    confidence: "possible",
  },
  concurrent_modification: later(
    "shared",
    409,
    "duplicate_request",
    "Several requests tried to change the same entity at the same time; only one can change it at a time.",
    "Let the first request finish and check its result before sending another change.",
    "Retry only after the first request has completed and its result has been checked.",
  ),
  conflict: later(
    "shared",
    409,
    "invalid_request",
    "The request conflicts with a change that was already made to the entity, possibly by another integration.",
    "Fetch the latest version of the entity and apply the change to it.",
    "Fetch the entity first; send the change again only if it still applies.",
  ),
  entity_archived: rejected(
    "shared",
    400,
    "invalid_request",
    "The entity is archived and cannot be changed.",
    "Set the entity's status back to active, or create a new entity.",
  ),
  forbidden: rejected(
    "shared",
    403,
    "configuration",
    "The credentials used are not allowed to perform this request.",
    "Check the permissions of the API key or token.",
  ),
  internal_error: {
    group: "shared",
    httpStatus: 500,
    category: "provider_unavailable",
    explanation:
      "Paddle failed while processing the request. Paddle says the request was not processed and the problem is on its side.",
    nextAction:
      "Wait, then send the request again. If it persists, contact Paddle support with meta.request_id.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: NOT_PROCESSED,
    confidence: "strong",
  },
  invalid_access_token: rejected(
    "shared",
    401,
    "configuration",
    "The OAuth access token has expired or could not be verified.",
    "Obtain a new access token.",
  ),
  invalid_client_token: rejected(
    "shared",
    403,
    "configuration",
    "The client-side token is not valid.",
    "Check the client-side token configured for Paddle.js.",
  ),
  invalid_field: rejected(
    "shared",
    400,
    "invalid_request",
    "One or more fields failed validation. The errors list names each field.",
    "Fix the fields named in error.errors and send the corrected request.",
  ),
  invalid_json: rejected(
    "shared",
    400,
    "invalid_request",
    "The request body is not valid JSON.",
    "Send a valid JSON body.",
  ),
  invalid_time_query_parameter: rejected(
    "shared",
    400,
    "invalid_request",
    "A query parameter holds a timestamp that could not be parsed.",
    "Send timestamps in RFC 3339 format.",
  ),
  invalid_token: rejected(
    "shared",
    403,
    "configuration",
    "The API key is not valid.",
    "Check the API key and that it belongs to the right environment (sandbox or live).",
  ),
  invalid_url: rejected(
    "shared",
    404,
    "invalid_request",
    "The URL called does not exist.",
    "Check the endpoint path against the API reference.",
  ),
  method_not_allowed: rejected(
    "shared",
    405,
    "invalid_request",
    "The endpoint does not accept this HTTP method.",
    "Use the method documented for the endpoint.",
  ),
  not_available_in_sandbox: rejected(
    "shared",
    404,
    "configuration",
    "The endpoint exists only in the live environment, not in sandbox.",
    "Check that the request uses the URL of the right environment; the API reference marks endpoints that sandbox does not offer.",
  ),
  not_found: rejected(
    "shared",
    404,
    "invalid_request",
    "The entity in the request does not exist.",
    "Check the id and that it belongs to the same environment and account.",
  ),
  not_implemented: rejected(
    "shared",
    501,
    "invalid_request",
    "The method used for the request is not recognized.",
    "Use a documented method for this endpoint.",
  ),
  paddle_billing_not_enabled: rejected(
    "shared",
    403,
    "configuration",
    "Authentication worked, but Paddle Billing is not activated for this account.",
    "Check the account's Paddle Billing setup with Paddle.",
  ),
  receipt_data_not_enabled: rejected(
    "shared",
    400,
    "configuration",
    "receipt_data is not enabled for this account.",
    "Leave out receipt_data, or ask Paddle to enable it.",
  ),
  request_body_too_large: rejected(
    "shared",
    413,
    "invalid_request",
    "The request body is too large.",
    "Send a smaller body.",
  ),
  request_headers_too_large: rejected(
    "shared",
    431,
    "invalid_request",
    "The request URI or headers are larger than allowed.",
    "Shorten the URI and headers.",
  ),
  service_unavailable: {
    group: "shared",
    httpStatus: 503,
    category: "provider_unavailable",
    explanation:
      "The endpoint is down for maintenance or cannot handle the request for the moment. Paddle says the request was not processed.",
    nextAction: "Wait, then send the request again. Check the Paddle status page.",
    retry: "safe_to_retry_technical_request",
    retryExplanation: NOT_PROCESSED,
    confidence: "strong",
  },
  temporarily_unavailable: {
    group: "shared",
    httpStatus: 540,
    category: "rate_limiting",
    explanation:
      "The endpoint is temporarily disabled for this account. Paddle lists rate limiting, inefficient or abusive use and endpoint problems as causes.",
    nextAction:
      "Reduce request frequency and contact Paddle support with meta.request_id. Check the Paddle status page.",
    retry: "manual_review",
    retryExplanation:
      "Paddle asks to contact support; the cause can be on the account's side or Paddle's.",
    confidence: "possible",
  },
  too_many_requests: {
    group: "shared",
    httpStatus: 429,
    category: "rate_limiting",
    explanation:
      "Too many requests came from this IP address, so it is rate limited for a while. The Retry-After header gives the wait in seconds.",
    nextAction: "Wait for the number of seconds in Retry-After, then send the request again.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "A rate-limited request is rejected before processing. Retry after the Retry-After interval.",
    confidence: "strong",
  },
  unexpected_request_body: rejected(
    "shared",
    400,
    "invalid_request",
    "The request has a body, but this endpoint does not take one.",
    "Send the request without a body.",
  ),
  unsupported_media_type: rejected(
    "shared",
    415,
    "invalid_request",
    "The Content-Type header is not valid.",
    "Send application/json.",
  ),

  // Adjustments
  adjustment_amount_above_remaining_allowed: rejected(
    "adjustments",
    400,
    "invalid_amount",
    "The amount for a transaction item is more than what is left to adjust on that item.",
    "Lower the item amount to what remains.",
  ),
  adjustment_amount_cannot_be_zero: rejected(
    "adjustments",
    400,
    "invalid_amount",
    "An item adjustment amount is zero.",
    "Send a non-zero amount, or leave the item out.",
  ),
  adjustment_invalid_combination_of_types: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The adjustment mixes item types that cannot be combined.",
    "Use compatible item types in one adjustment.",
  ),
  adjustment_invalid_credit_action: rejected(
    "adjustments",
    400,
    "invalid_request",
    "Credits cannot be created for automatically-collected transactions.",
    "Use a refund for automatically-collected transactions.",
  ),
  adjustment_no_tax_available_to_adjust: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The transaction item has no tax that can be adjusted.",
    "Do not request a tax adjustment for this item.",
  ),
  adjustment_payout_earnings_cannot_be_zero: rejected(
    "adjustments",
    400,
    "invalid_amount",
    "The refund amount rounds to zero in the payout currency.",
    "Refund a larger amount.",
  ),
  adjustment_pending_refund_request: {
    group: "adjustments",
    httpStatus: 400,
    category: "duplicate_request",
    explanation:
      "A refund for this transaction is still waiting for approval, so no other adjustment can be made yet.",
    nextAction:
      "Wait until the pending refund is approved or rejected (adjustment.updated), then decide.",
    retry: "retry_conditionally",
    retryExplanation:
      "A refund is already pending. Check its outcome before creating another adjustment, or the customer may be refunded twice.",
    confidence: "strong",
  },
  adjustment_tax_mode_not_allowed: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The external tax mode is only allowed for partial refunds.",
    "Use the external tax mode only with a partial refund.",
  ),
  adjustment_total_amount_above_remaining_allowed: rejected(
    "adjustments",
    400,
    "invalid_amount",
    "The total adjustment is more than what is left to adjust on the transaction.",
    "Lower the total to what remains; earlier adjustments count against it.",
  ),
  adjustment_transaction_customer_mismatch: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The adjustment's customer is not the transaction's customer.",
    "Use the transaction's customer.",
  ),
  adjustment_transaction_invalid_status_for_credit: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The transaction's status does not allow a credit.",
    "Check the transaction status before creating a credit.",
  ),
  adjustment_transaction_invalid_status_for_refund: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The transaction's status does not allow a refund.",
    "Check the transaction status before creating a refund.",
  ),
  adjustment_transaction_item_has_already_been_fully_adjusted: rejected(
    "adjustments",
    400,
    "duplicate_request",
    "The transaction item is already fully adjusted.",
    "Check earlier adjustments for this transaction; nothing is left to adjust on this item.",
  ),
  adjustment_transaction_item_invalid: rejected(
    "adjustments",
    400,
    "invalid_request",
    "One or more adjustment items cannot be processed. The error details name them.",
    "Fix the items named in the error details.",
  ),
  adjustment_transaction_item_over_adjustment: rejected(
    "adjustments",
    400,
    "invalid_amount",
    "One or more items would be adjusted beyond what is available.",
    "Lower the item amounts to what remains.",
  ),
  adjustment_transaction_missing_customer_id: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The transaction has no customer, so it cannot be adjusted.",
    "Check the transaction; adjustments need a customer on it.",
  ),
  adjustment_transaction_subscription_mismatch: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The adjustment's subscription is not the transaction's subscription.",
    "Use the transaction's subscription.",
  ),
  adjustment_transaction_without_captured_payment: rejected(
    "adjustments",
    400,
    "invalid_request",
    "The transaction has no captured payment, so it cannot be adjusted.",
    "Check that the transaction was paid before refunding it.",
  ),

  // Transactions (payment-relevant subset)
  transaction_adjusted_unable_to_revise: rejected(
    "transactions",
    400,
    "invalid_request",
    "The transaction has adjustments, so it can no longer be revised.",
    "Do not revise adjusted transactions.",
  ),
  transaction_balance_less_than_charge_limit: rejected(
    "transactions",
    400,
    "invalid_amount",
    "The balance is above zero but below the minimum Paddle can charge in this currency.",
    "Raise the amount above the minimum charge, or make it zero.",
  ),
  transaction_checkout_not_enabled: rejected(
    "transactions",
    400,
    "configuration",
    "Checkout is not enabled for the account, usually because onboarding is not complete.",
    "Complete Paddle onboarding.",
  ),
  transaction_checkout_url_domain_is_not_approved: rejected(
    "transactions",
    400,
    "configuration",
    "The domain in checkout.url is not an approved domain of the account.",
    "Use an approved checkout domain.",
  ),
  transaction_creation_blocked: rejected(
    "transactions",
    400,
    "configuration",
    "Legal or compliance restrictions on the account prevent creating this transaction.",
    "Contact Paddle about the account restriction.",
  ),
  transaction_currency_code_not_valid_for_manual: rejected(
    "transactions",
    400,
    "configuration",
    "The currency is not enabled for manually-collected transactions on the account.",
    "Use a currency enabled for invoicing.",
  ),
  transaction_default_checkout_url_not_set: rejected(
    "transactions",
    400,
    "configuration",
    "No default payment link is set, so a transaction or checkout cannot be created.",
    "Set a default payment link in the account settings.",
  ),
  transaction_discount_not_found: rejected(
    "transactions",
    400,
    "invalid_request",
    "The discount code or id on the transaction does not exist.",
    "Check the discount.",
  ),
  transaction_immutable: rejected(
    "transactions",
    400,
    "invalid_request",
    "The transaction is no longer draft or ready, so it cannot be changed.",
    "Check the transaction status. To correct a billed or completed transaction, create an adjustment.",
  ),
  transaction_immutable_while_processing_payment: later(
    "transactions",
    409,
    "duplicate_request",
    "A payment attempt is in progress for this transaction, so it cannot be updated right now.",
    "Wait for the payment attempt to finish and check the transaction before changing it.",
    "A payment is in progress. Fetch the transaction and check its status and payments before sending the change again.",
  ),
  transaction_invalid_status_change: rejected(
    "transactions",
    400,
    "invalid_request",
    "The requested status change is not allowed from the current status.",
    "Check the transaction status before changing it.",
  ),
  transaction_invalid_status_to_revise: rejected(
    "transactions",
    400,
    "invalid_request",
    "Only billed, past_due or completed transactions can be revised.",
    "Check the transaction status before revising.",
  ),
  transaction_not_ready_cannot_process_payment: rejected(
    "transactions",
    422,
    "invalid_request",
    "The transaction is not ready, so no payment can be taken for it.",
    "Add the missing items, customer or address so the transaction becomes ready.",
  ),
  transaction_payout_account_required: rejected(
    "transactions",
    400,
    "configuration",
    "No payout account is set, so transactions cannot be processed.",
    "Set up a payout account.",
  ),
  transaction_price_not_found: rejected(
    "transactions",
    400,
    "invalid_request",
    "One or more price ids on the transaction do not exist.",
    "Check the price ids and the environment.",
  ),
  transaction_product_not_found: rejected(
    "transactions",
    400,
    "invalid_request",
    "One or more product ids referenced by the items do not exist.",
    "Check the product ids and the environment.",
  ),
  transaction_recurring_balance_less_than_charge_limit: rejected(
    "transactions",
    400,
    "invalid_amount",
    "The recurring amount is below the minimum Paddle can charge in this currency.",
    "Raise the recurring amount above the minimum charge.",
  ),
  transaction_revised_limit_reached: rejected(
    "transactions",
    400,
    "duplicate_request",
    "The transaction was already revised; a transaction can be revised only once.",
    "Do not revise it again.",
  ),
  transaction_status_must_be_ready: rejected(
    "transactions",
    400,
    "invalid_request",
    "This action needs the transaction to be ready first.",
    "Complete the transaction's required fields so it becomes ready.",
  ),

  // Subscriptions (payment-relevant subset)
  subscription_cannot_activate: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "Only a trialing subscription can be activated.",
    "Check the subscription status.",
  ),
  subscription_credit_creation_against_processing_transaction: later(
    "subscriptions",
    400,
    "invalid_request",
    "The change would credit a transaction that is still being processed.",
    "Wait for the transaction to finish processing.",
    "Retry only after the related transaction has finished processing.",
  ),
  subscription_credit_creation_against_uncompleted_transaction_not_allowed: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "The change would credit a transaction that has not been paid.",
    "Check the transaction is paid before making this change.",
  ),
  subscription_immediate_charge_24_hour_limit_exceeded: {
    group: "subscriptions",
    httpStatus: 429,
    category: "rate_limiting",
    explanation: "The daily limit of immediate charges for this subscription is reached.",
    nextAction: "Check the charges made in the last 24 hours before charging again.",
    retry: "retry_conditionally",
    retryExplanation:
      "The limit counts immediate charges already made. Check them before charging again; Paddle suggests waiting, or deferring or skipping the charge with proration_billing_mode.",
    confidence: "strong",
  },
  subscription_immediate_charge_hour_limit_exceeded: {
    group: "subscriptions",
    httpStatus: 429,
    category: "rate_limiting",
    explanation: "The hourly limit of immediate charges for this subscription is reached.",
    nextAction: "Check the charges already made in the last hour before charging again.",
    retry: "retry_conditionally",
    retryExplanation:
      "The limit counts immediate charges already made. Check them before charging again; Paddle suggests waiting, or deferring or skipping the charge with proration_billing_mode.",
    confidence: "strong",
  },
  subscription_is_canceled_action_invalid: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "The action is not possible on a canceled subscription.",
    "Canceled is final; create a new subscription instead.",
  ),
  subscription_locked_pending_changes: later(
    "subscriptions",
    400,
    "invalid_request",
    "The subscription already has a scheduled change, so it cannot take another one until that is resolved.",
    "Remove or wait for the scheduled change.",
    "Retry after the scheduled change is removed or applied.",
  ),
  subscription_locked_processing: later(
    "subscriptions",
    409,
    "invalid_request",
    "A change is due within 30 minutes, so the subscription is locked while Paddle processes it.",
    "Wait until processing is done and check the subscription.",
    "Fetch the subscription after the lock window and check whether the change is still needed.",
  ),
  subscription_locked_renewal: later(
    "subscriptions",
    409,
    "invalid_request",
    "The subscription renews within 30 minutes and is locked while Paddle prepares the renewal.",
    "Wait for the renewal and check its transaction before changing the subscription.",
    "Fetch the subscription after the renewal and check whether the change is still needed.",
  ),
  subscription_missing_payment_method_cannot_activate: rejected(
    "subscriptions",
    400,
    "payment_method_unavailable",
    "An automatically-collected subscription has no payment method, so it cannot be activated.",
    "Ask the customer to add a payment method.",
  ),
  subscription_missing_payment_method_cannot_resume: rejected(
    "subscriptions",
    400,
    "payment_method_unavailable",
    "An automatically-collected subscription has no payment method, so it cannot be resumed immediately.",
    "Ask the customer to add a payment method.",
  ),
  subscription_missing_payment_method_cannot_retry_payment: rejected(
    "subscriptions",
    400,
    "payment_method_unavailable",
    "An automatically-collected subscription has no payment method, so the payment cannot be retried.",
    "Ask the customer to add a payment method.",
  ),
  subscription_missing_payment_method_cannot_update: rejected(
    "subscriptions",
    400,
    "payment_method_unavailable",
    "The change would cause a charge, but the automatically-collected subscription has no payment method.",
    "Ask the customer to add a payment method.",
  ),
  subscription_not_active: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "The action needs an active subscription.",
    "Check the subscription status.",
  ),
  subscription_outstanding_pending_refund: later(
    "subscriptions",
    400,
    "duplicate_request",
    "The subscription has a refund waiting for approval, so changes that create adjustments are blocked.",
    "Wait until the pending refund is approved or rejected.",
    "Check the pending refund's outcome before trying again.",
  ),
  subscription_outstanding_transaction: later(
    "subscriptions",
    409,
    "invalid_request",
    "The subscription has an outstanding transaction, so the change cannot be made.",
    "Resolve the outstanding transaction first.",
    "Check the outstanding transaction before sending the change again.",
  ),
  subscription_payment_declined: {
    group: "subscriptions",
    httpStatus: 400,
    category: "card_declined",
    explanation:
      "The payment method declined the subscription charge, for example for insufficient funds, an expired card or an issuer block.",
    nextAction: "Ask the customer to update the payment method.",
    retry: "customer_action_required",
    retryExplanation:
      "Paddle notes declines are sometimes temporary, but a retry with the same method can be declined again. Prefer an updated payment method.",
    confidence: "strong",
  },
  subscription_payment_provider_unavailable: {
    group: "subscriptions",
    httpStatus: 500,
    category: "provider_unavailable",
    explanation:
      "The payment could not be completed because the payment provider did not respond in time. Paddle calls this usually transient.",
    nextAction:
      "Check the subscription's transactions for a charge before retrying after a short wait.",
    retry: "retry_conditionally",
    retryExplanation:
      "Paddle does not say that no charge was made. Verify the subscription's latest transaction first, then retry.",
    confidence: "strong",
  },
  subscription_update_transaction_balance_less_than_charge_limit: rejected(
    "subscriptions",
    400,
    "invalid_amount",
    "The update would charge more than zero but less than Paddle's minimum charge.",
    "Change the update so it charges nothing or at least the minimum.",
  ),
  subscription_update_when_canceled: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "The subscription is canceled, which is final, so it cannot be changed.",
    "Create a new subscription instead.",
  ),
  subscription_update_when_past_due: rejected(
    "subscriptions",
    400,
    "invalid_request",
    "The subscription is past due because a payment has not been collected, so it cannot be updated, charged once or scheduled for changes.",
    "Collect the overdue payment first (payment recovery or the customer updating the payment method).",
  ),
};

export type StatusEntry = {
  stage: LifecycleStage;
  outcome: Outcome;
  final: boolean;
  description: string;
};

/** `TransactionStatus`. */
export const TRANSACTION_STATUSES: Record<string, StatusEntry> = {
  draft: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "Required fields are missing; typically the start of a checkout.",
  },
  ready: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "All required fields are present; the transaction can be billed or completed.",
  },
  billed: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "Issued as an invoice, a legal record. Not paid yet.",
  },
  paid: {
    stage: "payment",
    outcome: "success",
    final: false,
    description:
      "Payment is captured, but Paddle has not finished processing the transaction internally.",
  },
  completed: {
    stage: "payment",
    outcome: "success",
    final: true,
    description: "Fully paid and processed.",
  },
  canceled: {
    stage: "cancellation",
    outcome: "failure",
    final: true,
    description: "Canceled; if it was an invoice, it is no longer due.",
  },
  // Overdue, not failed: an invoice becomes past due without any failed
  // attempt, and renewals stay collectable during payment recovery. The
  // failed attempt itself is transaction.payment_failed.
  past_due: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description:
      "Payment is overdue: a renewal payment failed (dunning), or an invoice is unpaid 24 hours after its due date.",
  },
};

/** `PaymentAttemptStatus` (payments[].status). */
export const PAYMENT_ATTEMPT_STATUSES: Record<string, StatusEntry> = {
  authorized: {
    stage: "authorization",
    outcome: "success",
    final: false,
    description: "Authorized but not captured.",
  },
  authorized_flagged: {
    stage: "authorization",
    outcome: "pending",
    final: false,
    description: "Authorized but held because it was flagged as possibly fraudulent.",
  },
  canceled: {
    stage: "void",
    outcome: "failure",
    final: true,
    description: "A previously authorized attempt was canceled, typically a rejected flagged one.",
  },
  captured: {
    stage: "capture",
    outcome: "success",
    final: true,
    description: "Captured; the attempt is complete.",
  },
  error: {
    stage: "payment",
    outcome: "failure",
    final: true,
    description: "The attempt was unsuccessful; error_code says why.",
  },
  action_required: {
    stage: "authentication",
    outcome: "pending",
    final: false,
    description: "The customer must act, typically to complete 3DS.",
  },
  pending_no_action_required: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "Waiting for a response from the bank or payment provider.",
  },
  created: {
    stage: "payment",
    outcome: "pending",
    final: false,
    description: "A new attempt was created.",
  },
  unknown: {
    stage: "payment",
    outcome: "unknown",
    final: false,
    description: "Paddle does not know the attempt's status.",
  },
  dropped: {
    stage: "payment",
    outcome: "failure",
    final: true,
    description: "Paddle dropped the attempt.",
  },
};

const UPDATE_METHOD = "Ask the customer to use or update another payment method.";
const DUNNING =
  "For automatically-collected subscription renewals, Paddle's payment recovery retries on its own; do not start a parallel charge.";

function attempt(
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation: string,
  nextAction: string,
  retryExplanation: string,
  confidence: Confidence = "strong",
): CatalogEntry {
  return { category, retry, explanation, nextAction, retryExplanation, confidence };
}

/** `ErrorCode` on a payment attempt (payments[].error_code). */
export const PAYMENT_ERROR_CODES: Record<string, CatalogEntry> = {
  already_canceled: attempt(
    "invalid_request",
    "do_not_retry",
    "The amount was already canceled. Paddle notes this is not typical for payments.",
    "Check the transaction's earlier attempts.",
    "Nothing is left to cancel.",
  ),
  already_refunded: attempt(
    "invalid_request",
    "do_not_retry",
    "The amount was already refunded. Paddle notes this is not typical for payments.",
    "Check the transaction's adjustments.",
    "Nothing is left to refund.",
  ),
  authentication_failed: attempt(
    "authentication_failed",
    "customer_action_required",
    "The customer completed an authentication challenge (3DS2 for cards, a redirect for other methods) without success.",
    "Ask the customer to try again and complete authentication, or use another method.",
    `A new attempt needs the customer to authenticate successfully. ${DUNNING}`,
  ),
  blocked_by_policy: attempt(
    "fraud_or_risk",
    "manual_review",
    "A policy check configured by the seller blocked the payment.",
    "Review the seller's payment policy settings for this case.",
    "The block comes from the seller's own rules; review them before any new attempt.",
  ),
  blocked_card: attempt(
    "card_declined",
    "do_not_retry",
    "The issuer says the card cannot be used: it is frozen, lost, damaged or stolen.",
    UPDATE_METHOD,
    "Do not charge this card again.",
  ),
  canceled: attempt(
    "payment_method_unavailable",
    "customer_action_required",
    "The customer asked for the mandate for recurring payments to be canceled.",
    "Ask the customer to authorize a payment method again.",
    "The mandate is canceled; a new authorization from the customer is needed.",
  ),
  declined: attempt(
    "card_declined",
    "customer_action_required",
    "The payment method was declined with no further information.",
    UPDATE_METHOD,
    `A decline without a reason may or may not be temporary. ${DUNNING}`,
  ),
  declined_not_retryable: attempt(
    "card_declined",
    "do_not_retry",
    "Declined, and the issuer says not to retry, for example because the account is closed or the customer revoked permission.",
    UPDATE_METHOD,
    "The issuer said not to retry this payment method.",
  ),
  expired_card: attempt(
    "card_declined",
    "customer_action_required",
    "The issuer says the card has expired.",
    "Ask the customer to update the card.",
    "The same card will be declined again.",
  ),
  fraud: attempt(
    "fraud_or_risk",
    "do_not_retry",
    "The issuer or payment provider flagged the payment as possibly fraudulent.",
    "Review the order before accepting another payment from this customer.",
    "Retrying a payment flagged as fraud is not advised.",
  ),
  invalid_amount: attempt(
    "invalid_amount",
    "do_not_retry",
    "The issuer or payment provider cannot process a payment this high or this low.",
    "Check the amount; the customer may need another payment method.",
    "The same amount will be rejected again.",
  ),
  invalid_payment_details: attempt(
    "card_declined",
    "customer_action_required",
    "The payment provider says the payment method is not valid, typically because it has expired.",
    "Ask the customer to update the payment method.",
    "The same details will be rejected again.",
  ),
  issuer_unavailable: attempt(
    "provider_unavailable",
    "retry_conditionally",
    "The payment provider could not reach the issuer.",
    "Check the transaction for later attempts before charging again.",
    `The attempt failed for a technical reason and may succeed later. Check the transaction's payments first. ${DUNNING}`,
  ),
  not_enough_balance: attempt(
    "insufficient_funds",
    "customer_action_required",
    "Declined for insufficient funds or because a funds limit was reached.",
    UPDATE_METHOD,
    `A retry can succeed once funds are available. ${DUNNING}`,
  ),
  preferred_network_not_supported: attempt(
    "payment_method_unavailable",
    "customer_action_required",
    "The card network the customer chose is not supported by the payment provider.",
    "Ask the customer to pay with another network or method.",
    "The same network choice will be declined again.",
  ),
  prepaid_card_not_supported: attempt(
    "payment_method_unavailable",
    "customer_action_required",
    "The card is a prepaid card, and prepaid cards are blocked on this Paddle account.",
    "Ask the customer to use a card that is not prepaid, or review the account setting.",
    "The same card will be declined again.",
  ),
  psp_error: attempt(
    "provider_unavailable",
    "retry_conditionally",
    "Something went wrong at the payment provider, with no further information.",
    "Check the transaction for later attempts before charging again.",
    `Check the transaction's payments before a new attempt. ${DUNNING}`,
  ),
  redacted_payment_method: attempt(
    "payment_method_unavailable",
    "customer_action_required",
    "The payment provider did not receive the payment method details because they were redacted.",
    "Ask the customer to enter the payment method again.",
    "The stored details cannot be used; the customer has to provide them again.",
  ),
  system_error: attempt(
    "provider_unavailable",
    "retry_conditionally",
    "Something went wrong on the Paddle platform. Paddle suggests trying again later and checking its status page.",
    "Check the Paddle status page and the transaction's payments before trying again.",
    `Check the transaction's payments before a new attempt. ${DUNNING}`,
  ),
  transaction_not_permitted: attempt(
    "card_declined",
    "do_not_retry",
    "The issuer does not allow this kind of payment, because of account limits or for legal or compliance reasons.",
    UPDATE_METHOD,
    "The issuer will refuse this kind of payment again.",
  ),
  unknown: attempt(
    "unknown",
    "unknown",
    "The attempt was unsuccessful and Paddle returned no other information.",
    "Check the transaction in the Paddle dashboard.",
    "Without a reason, retry safety cannot be assessed.",
    "possible",
  ),
};

export type AdjustmentActionEntry = {
  stage: LifecycleStage;
  /** Whether outcome follows the adjustment status (refund and credit families). */
  statusDriven: boolean;
  description: string;
};

/** `AdjustmentAction`. */
export const ADJUSTMENT_ACTIONS: Record<string, AdjustmentActionEntry> = {
  refund: {
    stage: "refund",
    statusDriven: true,
    description: "Refunds some or all of the transaction. Most live refunds need Paddle approval.",
  },
  // A credit reduces what is owed or goes to the customer's credit balance;
  // it is not money returned to the customer.
  credit: {
    stage: "other",
    statusDriven: true,
    description: "Credits some or all of the transaction. Not a refund.",
  },
  credit_reverse: {
    stage: "reversal",
    statusDriven: true,
    description: "Reversal of a credit, created by Paddle.",
  },
  chargeback: {
    stage: "dispute",
    statusDriven: false,
    description: "Created by Paddle when a customer disputed a charge successfully.",
  },
  chargeback_warning: {
    stage: "dispute",
    statusDriven: false,
    description: "Created by Paddle to warn of an upcoming chargeback.",
  },
  chargeback_reverse: {
    stage: "dispute",
    statusDriven: false,
    description: "Created by Paddle when it contested a chargeback successfully.",
  },
  chargeback_warning_reverse: {
    stage: "dispute",
    statusDriven: false,
    description: "Reversal of a chargeback warning, created by Paddle.",
  },
};

/** `AdjustmentStatus`, as outcome of refund and credit adjustments. */
export const ADJUSTMENT_STATUSES: Record<string, { outcome: Outcome; description: string }> = {
  pending_approval: {
    outcome: "pending",
    description: "Waiting for Paddle's review; most live refunds start here.",
  },
  approved: {
    outcome: "success",
    description: "Approved. Credits start here; refunds move here when Paddle approves them.",
  },
  rejected: { outcome: "failure", description: "Paddle rejected the refund." },
  reversed: {
    outcome: "unknown",
    description: "A reversal adjustment was created for this adjustment.",
  },
};

/** `StatusSubscription`. Statuses describe the subscription, not a payment. */
export const SUBSCRIPTION_STATUSES: Record<string, { stage: LifecycleStage; outcome: Outcome }> = {
  active: { stage: "subscription", outcome: "success" },
  trialing: { stage: "subscription", outcome: "pending" },
  past_due: { stage: "subscription", outcome: "pending" },
  paused: { stage: "subscription", outcome: "unknown" },
  canceled: { stage: "cancellation", outcome: "success" },
};

export type EventEntity = "transaction" | "adjustment" | "subscription";

export type EventTypeEntry = {
  entity: EventEntity;
  /** Fixed semantics; when absent, stage and outcome follow the entity's status. */
  stage?: LifecycleStage;
  outcome?: Outcome;
};

/** Event types in scope (EventTypeName and the per-event webhook pages). */
export const EVENT_TYPES: Record<string, EventTypeEntry> = {
  "transaction.created": { entity: "transaction" },
  "transaction.ready": { entity: "transaction" },
  "transaction.billed": { entity: "transaction" },
  "transaction.updated": { entity: "transaction" },
  "transaction.revised": { entity: "transaction" },
  "transaction.paid": { entity: "transaction", stage: "payment", outcome: "success" },
  "transaction.completed": { entity: "transaction", stage: "payment", outcome: "success" },
  "transaction.payment_failed": { entity: "transaction", stage: "payment", outcome: "failure" },
  "transaction.past_due": { entity: "transaction", stage: "payment", outcome: "pending" },
  "transaction.canceled": { entity: "transaction", stage: "cancellation", outcome: "failure" },
  "adjustment.created": { entity: "adjustment" },
  "adjustment.updated": { entity: "adjustment" },
  "subscription.created": { entity: "subscription" },
  "subscription.imported": { entity: "subscription" },
  "subscription.trialing": { entity: "subscription" },
  "subscription.activated": { entity: "subscription" },
  "subscription.updated": { entity: "subscription" },
  "subscription.past_due": { entity: "subscription" },
  "subscription.paused": { entity: "subscription" },
  "subscription.resumed": { entity: "subscription" },
  "subscription.canceled": { entity: "subscription", stage: "cancellation", outcome: "success" },
};

/**
 * Other documented event types. Recognized by name, outside the payment flow,
 * and not analyzed.
 */
export const OTHER_EVENT_TYPES: readonly string[] = [
  "address.created",
  "address.imported",
  "address.updated",
  "api_key.created",
  "api_key.expired",
  "api_key.expiring",
  "api_key.revoked",
  "api_key.updated",
  "api_key_exposure.created",
  "api_key_rotation.created",
  "api_key_rotation.updated",
  "business.created",
  "business.imported",
  "business.updated",
  "client_token.created",
  "client_token.revoked",
  "client_token.updated",
  "customer.created",
  "customer.imported",
  "customer.updated",
  "discount.created",
  "discount.imported",
  "discount.updated",
  "discount_group.created",
  "discount_group.updated",
  "meter.created",
  "meter.updated",
  "payment_method.saved",
  "payment_method.deleted",
  "payout.created",
  "payout.paid",
  "price.created",
  "price.imported",
  "price.updated",
  "product.created",
  "product.imported",
  "product.updated",
  "report.created",
  "report.updated",
  "usage_balance.depleted",
];
