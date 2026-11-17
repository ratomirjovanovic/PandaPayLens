/**
 * GoCardless knowledge, kept as data. Every value comes from the verified
 * research file (docs/providers/research/gocardless.md), which cites
 * the GoCardless developer documentation. Descriptions are paraphrased; follow the links for
 * GoCardless's own wording.
 *
 * Category, stage, outcome and retry values are PandaPayLens mappings, not
 * GoCardless statements.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const DOCS = "https://docs.gocardless.com/docs";
export const ERRORS_URL = `${DOCS}/api-reference/responses-and-errors`;
export const LIMITS_URL = `${DOCS}/api-reference/limits`;
export const WEBHOOKS_URL = `${DOCS}/api-reference/webhooks`;
export const EVENT_URL = `${DOCS}/api-reference/event`;
export const EVENT_TYPES_URL = `${DOCS}/api-reference/events`;
export const PAYMENT_EVENTS_URL = `${DOCS}/api-reference/events/payment`;
export const MANDATE_EVENTS_URL = `${DOCS}/api-reference/events/mandate`;
export const REFUND_EVENTS_URL = `${DOCS}/api-reference/events/refund`;
export const PAYOUT_EVENTS_URL = `${DOCS}/api-reference/events/payout`;
export const SUBSCRIPTION_EVENTS_URL = `${DOCS}/api-reference/events/subscription`;
export const PAYMENT_URL = `${DOCS}/api-reference/payment`;
export const REFUND_URL = `${DOCS}/api-reference/refund`;

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
  confidence: Confidence;
};

/** The four documented values of `error.type`. */
export const ERROR_TYPES: Record<string, CatalogEntry> = {
  gocardless: {
    category: "provider_unavailable",
    explanation: "An error happened inside GoCardless while it processed the request.",
    nextAction:
      "Check whether the request took effect before repeating it. If the error persists, report it to GoCardless support with the request_id.",
    retry: "retry_conditionally",
    retryExplanation:
      "The outcome of the original request is not known. Look up the resource first, and reuse the same Idempotency-Key if you send a creation request again.",
    confidence: "possible",
  },
  invalid_api_usage: {
    category: "invalid_request",
    explanation: "The request itself was built incorrectly (URL, headers, authentication or body).",
    nextAction: "Fix the request in the integration before sending it again.",
    retry: "do_not_retry",
    retryExplanation: "The same request will fail again until the integration is changed.",
    confidence: "possible",
  },
  invalid_state: {
    category: "invalid_request",
    explanation: "The action is not possible in the current state of the resource.",
    nextAction:
      "Inform the user. GoCardless advises not to let them retry the same action on this resource.",
    retry: "do_not_retry",
    retryExplanation: "GoCardless documents that invalid_state errors should not be retried.",
    confidence: "possible",
  },
  validation_failed: {
    category: "invalid_request",
    explanation: "One or more request parameters were invalid.",
    nextAction: "Ask the user to correct the fields named in the errors array.",
    retry: "customer_action_required",
    retryExplanation: "A new request only makes sense once the input has been corrected.",
    confidence: "possible",
  },
};

const fixRequest = (explanation: string, category: ErrorCategory = "invalid_request") =>
  ({
    category,
    explanation,
    nextAction: "Correct the request in the integration before sending it again.",
    retry: "do_not_retry",
    retryExplanation: "Sending the same request again will give the same error.",
    confidence: "strong",
  }) satisfies CatalogEntry;

const config = (explanation: string, nextAction: string) =>
  ({
    category: "configuration",
    explanation,
    nextAction,
    retry: "do_not_retry",
    retryExplanation: "The request will keep failing until the configuration is fixed.",
    confidence: "strong",
  }) satisfies CatalogEntry;

const state = (explanation: string, category: ErrorCategory = "invalid_request") =>
  ({
    category,
    explanation,
    nextAction:
      "Check the current state of the resource and tell the user the action is not possible.",
    retry: "do_not_retry",
    retryExplanation: "GoCardless documents that invalid_state errors should not be retried.",
    confidence: "strong",
  }) satisfies CatalogEntry;

const UNKNOWN_OUTCOME_RETRY =
  "The original request may or may not have taken effect. Look up the resource first, and reuse the same Idempotency-Key if you send a creation request again.";

/**
 * Documented `errors[].reason` values, keyed by reason. Explanations are
 * paraphrased from the GoCardless error reference.
 */
export const ERROR_REASONS: Record<string, CatalogEntry & { type: string }> = {
  internal_server_error: {
    type: "gocardless",
    category: "provider_unavailable",
    explanation: "GoCardless had an internal error while handling the request.",
    nextAction:
      "Check whether the request took effect. Report a persistent error to GoCardless support with the request_id.",
    retry: "retry_conditionally",
    retryExplanation: UNKNOWN_OUTCOME_RETRY,
    confidence: "strong",
  },
  request_timed_out: {
    type: "gocardless",
    category: "network_or_timeout",
    explanation: "The request did not finish within GoCardless's time limit.",
    nextAction:
      "Check whether the request took effect before repeating it. Report it to support if it keeps happening.",
    retry: "retry_conditionally",
    retryExplanation: UNKNOWN_OUTCOME_RETRY,
    confidence: "strong",
  },
  query_timed_out: {
    type: "gocardless",
    category: "network_or_timeout",
    explanation:
      "A database query behind the request took too long, possibly because the query was complex.",
    nextAction: "Repeat the request with narrower parameters.",
    retry: "retry_conditionally",
    retryExplanation:
      "GoCardless suggests retrying with different parameters. Only repeat requests that do not create resources without checking first.",
    confidence: "strong",
  },
  invalid_type: {
    type: "invalid_api_usage",
    ...fixRequest("A JSON value had the wrong type, or the body contained an unknown parameter."),
  },
  path_not_found: {
    type: "invalid_api_usage",
    ...fixRequest("The URL path is not a GoCardless endpoint."),
  },
  resource_not_found: {
    type: "invalid_api_usage",
    ...fixRequest("No resource with the ID given in the request was found."),
  },
  link_not_found: {
    type: "invalid_api_usage",
    ...fixRequest("An ID given in links[...] was not found."),
  },
  unauthorized: {
    type: "invalid_api_usage",
    ...config(
      "The credentials were not recognized.",
      "Check the access token and the environment (live or sandbox) it belongs to.",
    ),
    category: "authentication_failed",
  },
  forbidden: {
    type: "invalid_api_usage",
    ...config(
      "The credentials are valid but not allowed to access this resource.",
      "Check which account and permissions the access token has.",
    ),
  },
  feature_disabled: {
    type: "invalid_api_usage",
    ...config(
      "The feature is not enabled on the GoCardless account.",
      "Ask GoCardless support to enable the feature.",
    ),
  },
  not_acceptable: {
    type: "invalid_api_usage",
    ...fixRequest(
      "The endpoint does not support the content type in the Accept header.",
      "configuration",
    ),
  },
  request_entity_too_large: {
    type: "invalid_api_usage",
    ...fixRequest("The request body is too large."),
  },
  unsupported_media_type: {
    type: "invalid_api_usage",
    ...fixRequest(
      "The request did not use application/json for Content-Type and Accept.",
      "configuration",
    ),
  },
  rate_limit_exceeded: {
    type: "invalid_api_usage",
    category: "rate_limiting",
    explanation: "The account sent more requests than the rate limit allows.",
    nextAction:
      "Wait until the time in the ratelimit-reset response header, then send the request again.",
    retry: "safe_to_retry_technical_request",
    retryExplanation:
      "GoCardless documents that requests rejected by the rate limit are safe to retry.",
    confidence: "strong",
  },
  access_token_not_found: {
    type: "invalid_api_usage",
    ...config(
      "No access token with the given ID exists.",
      "Check the access token configured in the integration.",
    ),
    category: "authentication_failed",
  },
  access_token_not_active: {
    type: "invalid_api_usage",
    ...config("The access token has been disabled.", "Use an active access token."),
    category: "authentication_failed",
  },
  access_token_revoked: {
    type: "invalid_api_usage",
    ...config(
      "The user revoked the access token.",
      "Obtain a new access token from the account owner.",
    ),
    category: "authentication_failed",
  },
  missing_authorization_header: {
    type: "invalid_api_usage",
    ...config(
      "The request had no Authorization header.",
      "Send the access token as a bearer token in the Authorization header.",
    ),
    category: "authentication_failed",
  },
  invalid_authorization_header: {
    type: "invalid_api_usage",
    ...config(
      "The Authorization header was malformed.",
      "Send the header as Authorization: Bearer followed by the access token.",
    ),
    category: "authentication_failed",
  },
  insufficient_permissions: {
    type: "invalid_api_usage",
    ...config(
      "The access token does not have the scope needed for this action.",
      "Use a token with the required scope.",
    ),
  },
  insufficient_permissions_continue_on_dashboard: {
    type: "invalid_api_usage",
    ...config(
      "This action can only be done in the GoCardless dashboard.",
      "Complete the action in the dashboard.",
    ),
  },
  method_not_allowed: {
    type: "invalid_api_usage",
    ...fixRequest(
      "The HTTP method is not allowed. GoCardless does not support PATCH; updates use PUT.",
    ),
  },
  bad_request: { type: "invalid_api_usage", ...fixRequest("The request syntax was incorrect.") },
  idempotency_key_too_long: {
    type: "invalid_api_usage",
    ...fixRequest("The Idempotency-Key header is longer than 128 characters."),
  },
  invalid_document_structure: {
    type: "invalid_api_usage",
    ...fixRequest(
      "The JSON body was not structured correctly: parameters must be nested under the resource name.",
    ),
  },
  invalid_content_type: {
    type: "invalid_api_usage",
    ...fixRequest(
      "A POST or PUT request had a missing or unsupported Content-Type header.",
      "configuration",
    ),
  },
  tls_required: {
    type: "invalid_api_usage",
    ...fixRequest("The API was called over plain HTTP; it only accepts HTTPS.", "configuration"),
  },
  missing_version_header: {
    type: "invalid_api_usage",
    ...fixRequest("The request had no GoCardless-Version header.", "configuration"),
  },
  version_not_found: {
    type: "invalid_api_usage",
    ...fixRequest(
      "The GoCardless-Version header names a version that does not exist.",
      "configuration",
    ),
  },
  invalid_filters: {
    type: "invalid_api_usage",
    ...fixRequest("This endpoint does not allow the combination of filters used."),
  },
  request_body_not_allowed: {
    type: "invalid_api_usage",
    ...fixRequest("This HTTP method does not accept a request body; use query parameters."),
  },
  customer_data_removed: {
    type: "invalid_api_usage",
    ...fixRequest("The customer was removed and can no longer be returned."),
  },
  payout_items_data_archived: {
    type: "invalid_api_usage",
    ...fixRequest(
      "Payout items older than 6 months are archived and no longer returned by the API.",
    ),
    nextAction: "Contact GoCardless support for access to archived payout items.",
  },
  cancellation_failed: {
    type: "invalid_state",
    ...state(
      "The resource could not be cancelled: it was already cancelled or failed, or it is too far into submission.",
    ),
  },
  retry_failed: { type: "invalid_state", ...state("The payment could not be retried.") },
  disable_failed: { type: "invalid_state", ...state("The bank account is already disabled.") },
  mandate_is_inactive: {
    type: "invalid_state",
    ...state(
      "The payment could not be created because the mandate is cancelled, failed or expired.",
      "payment_method_unavailable",
    ),
  },
  mandate_replaced: {
    type: "invalid_state",
    ...state(
      "The mandate has been replaced by a new one, named in links[new_mandate].",
      "payment_method_unavailable",
    ),
  },
  bank_account_disabled: {
    type: "invalid_state",
    ...state(
      "The mandate could not be created because the customer's bank account is disabled.",
      "payment_method_unavailable",
    ),
  },
  mandate_not_inactive: {
    type: "invalid_state",
    ...state(
      "The mandate could not be reinstated because it is already active or being submitted.",
    ),
  },
  refund_is_unreachable: {
    type: "invalid_state",
    ...state("The refund could not be created because it would not reach the target bank account."),
  },
  refund_payment_invalid_state: {
    type: "invalid_state",
    ...state("A payment can only be refunded once it is confirmed or paid out."),
  },
  total_amount_confirmation_invalid: {
    type: "invalid_state",
    ...state(
      "The total refunded amount does not match the confirmation value sent with the refund.",
      "invalid_amount",
    ),
  },
  number_of_refunds_exceeded: {
    type: "invalid_state",
    ...state("The payment already has the maximum of 5 refunds."),
  },
  idempotent_creation_conflict: {
    type: "invalid_state",
    category: "duplicate_request",
    explanation:
      "A resource was already created with this Idempotency-Key. links.conflicting_resource_id names the existing resource.",
    nextAction: "Use the existing resource instead of creating a new one.",
    retry: "do_not_retry",
    retryExplanation:
      "The original request already succeeded; a new key would create a second resource.",
    confidence: "strong",
  },
  customer_bank_account_token_used: {
    type: "invalid_state",
    ...state("The bank account token has already been used."),
  },
  billing_request_must_be_ready_to_fulfil: {
    type: "invalid_state",
    ...state("The billing request still has required actions; see its actions array."),
  },
  bank_account_exists: {
    type: "validation_failed",
    category: "duplicate_request",
    explanation:
      "The bank account already exists; the existing account is named in the error's links.",
    nextAction: "Use the existing bank account.",
    retry: "do_not_retry",
    retryExplanation: "The account already exists, so creating it again will fail the same way.",
    confidence: "strong",
  },
  available_refund_amount_insufficient: {
    type: "validation_failed",
    category: "invalid_amount",
    explanation:
      "The creditor's GoCardless balance is too low to cover the refund. The available amount is in metadata.available_refund_amount.",
    nextAction: "Refund a smaller amount, or wait until the balance covers the refund.",
    retry: "do_not_retry",
    retryExplanation: "The same refund will fail until the balance is high enough.",
    confidence: "strong",
  },
};

export const FIELD_VALIDATION: CatalogEntry = {
  category: "invalid_request",
  explanation: "GoCardless rejected one or more fields of the request.",
  nextAction: "Ask the user to correct the fields named in the errors array, then submit again.",
  retry: "customer_action_required",
  retryExplanation: "A new request only makes sense once the input has been corrected.",
  confidence: "strong",
};

export type EventMapping = { stage: LifecycleStage; outcome: Outcome; meaning: string };

const ev = (stage: LifecycleStage, outcome: Outcome, meaning: string): EventMapping => ({
  stage,
  outcome,
  meaning,
});

/**
 * Actions per resource type, keyed by `<resource_type>.<action>`. Only the
 * five resource types in scope are listed; other GoCardless events are kept
 * but marked as unknown.
 */
export const EVENT_ACTIONS: Record<string, EventMapping> = {
  "payments.created": ev("payment", "pending", "The payment was created."),
  "payments.customer_approval_granted": ev(
    "payment",
    "pending",
    "The customer approved the payment.",
  ),
  "payments.customer_approval_denied": ev(
    "payment",
    "failure",
    "The customer refused to approve the payment.",
  ),
  "payments.submitted": ev(
    "payment",
    "pending",
    "The payment was submitted to the banks and can no longer be cancelled.",
  ),
  "payments.confirmed": ev(
    "payment",
    "success",
    "The payment was collected and is held by GoCardless; it is not paid out yet.",
  ),
  "payments.chargeback_cancelled": ev(
    "dispute",
    "unknown",
    "The customer's bank cancelled the chargeback.",
  ),
  "payments.paid_out": ev(
    "settlement",
    "success",
    "The payment was sent to the creditor's bank account in a payout.",
  ),
  "payments.late_failure_settled": ev(
    "settlement",
    "unknown",
    "A late failure of an already paid out payment was deducted from a payout.",
  ),
  "payments.chargeback_settled": ev(
    "settlement",
    "unknown",
    "A chargeback of an already paid out payment was deducted from a payout.",
  ),
  "payments.surcharge_fee_debited": ev(
    "other",
    "unknown",
    "A surcharge fee was charged because the payment failed or was charged back.",
  ),
  "payments.failed": ev(
    "payment",
    "failure",
    "The payment could not be collected. It can also fail after it was confirmed.",
  ),
  "payments.charged_back": ev(
    "dispute",
    "unknown",
    "The customer had the payment returned by their bank.",
  ),
  "payments.cancelled": ev(
    "cancellation",
    "failure",
    "The payment was cancelled before collection.",
  ),
  "payments.resubmission_requested": ev(
    "payment",
    "pending",
    "A new submission of the payment was requested, by the retry endpoint or automatically.",
  ),
  "payments.sds_settlement_delayed": ev(
    "settlement",
    "pending",
    "GoCardless is withholding the payment from same-day settlement.",
  ),

  "mandates.created": ev("other", "pending", "The mandate was created."),
  "mandates.customer_approval_granted": ev(
    "other",
    "pending",
    "The customer approved the mandate.",
  ),
  "mandates.customer_approval_skipped": ev(
    "other",
    "pending",
    "The customer skipped approval of the mandate.",
  ),
  "mandates.submitted": ev("other", "pending", "The mandate was submitted to the banks."),
  "mandates.active": ev(
    "other",
    "success",
    "The mandate is active and can be used to collect payments.",
  ),
  "mandates.reinstated": ev("other", "success", "A cancelled or failed mandate is active again."),
  "mandates.cancelled": ev(
    "other",
    "failure",
    "The mandate was cancelled; no further payments can be collected with it.",
  ),
  "mandates.failed": ev("other", "failure", "The mandate could not be set up."),
  "mandates.expired": ev("other", "failure", "The mandate expired."),
  "mandates.blocked": ev("other", "failure", "The mandate was blocked by a blocklist match."),
  "mandates.transferred": ev(
    "other",
    "unknown",
    "The mandate moved to a different customer bank account.",
  ),
  "mandates.resubmission_requested": ev(
    "other",
    "pending",
    "Reinstatement of the mandate was requested.",
  ),
  "mandates.replaced": ev("other", "unknown", "The mandate was replaced by a new mandate."),
  "mandates.consumed": ev(
    "other",
    "unknown",
    "The mandate was used for a payment and cannot be used again.",
  ),

  "refunds.created": ev(
    "refund",
    "pending",
    "The refund was created and will be submitted; it is not paid yet.",
  ),
  "refunds.paid": ev("refund", "success", "The refund was paid to the customer."),
  "refunds.failed": ev(
    "refund",
    "failure",
    "The refund did not reach the customer; the funds go back to the creditor.",
  ),
  "refunds.refund_settled": ev(
    "settlement",
    "unknown",
    "The refund was deducted from a payout. This does not mean the refund reached the customer.",
  ),
  "refunds.funds_returned": ev(
    "settlement",
    "unknown",
    "The funds of a failed refund were credited back in a payout.",
  ),

  "payouts.paid": ev(
    "settlement",
    "success",
    "The payout was transferred to the creditor's bank account.",
  ),
  "payouts.paid_again": ev("settlement", "success", "A bounced payout was transferred again."),
  "payouts.fx_rate_confirmed": ev(
    "settlement",
    "unknown",
    "The exchange rate of the payout is final.",
  ),
  "payouts.tax_exchange_rates_confirmed": ev(
    "settlement",
    "unknown",
    "The exchange rates for taxes on the payout's fees are final.",
  ),

  "subscriptions.created": ev("subscription", "success", "The subscription was created."),
  "subscriptions.customer_approval_granted": ev(
    "subscription",
    "success",
    "The customer approved the subscription.",
  ),
  "subscriptions.customer_approval_denied": ev(
    "subscription",
    "failure",
    "The customer refused to approve the subscription.",
  ),
  "subscriptions.amended": ev("subscription", "success", "The subscription amount was changed."),
  "subscriptions.payment_created": ev(
    "subscription",
    "success",
    "The subscription created a payment; the payment has its own events.",
  ),
  "subscriptions.cancelled": ev(
    "subscription",
    "success",
    "The subscription was cancelled and creates no more payments.",
  ),
  "subscriptions.finished": ev(
    "subscription",
    "success",
    "All payments of the subscription have been created.",
  ),
  "subscriptions.paused": ev("subscription", "success", "The subscription was paused."),
  "subscriptions.resumed": ev("subscription", "success", "The subscription was resumed."),
  "subscriptions.scheduled_pause": ev(
    "subscription",
    "success",
    "A pause was scheduled for a future date.",
  ),
  "subscriptions.scheduled_pause_cancelled": ev(
    "subscription",
    "success",
    "A scheduled pause was cancelled.",
  ),
  "subscriptions.scheduled_resume": ev(
    "subscription",
    "success",
    "A resume was scheduled for a future date.",
  ),
};

/** Resource types in scope, with the `links` key that names the resource. */
export const RESOURCE_LINK: Record<string, string> = {
  payments: "payment",
  mandates: "mandate",
  refunds: "refund",
  payouts: "payout",
  subscriptions: "subscription",
};

/** Documented `resource_type` values (event reference). */
export const RESOURCE_TYPES = new Set([
  "billing_requests",
  "creditors",
  "customers",
  "exports",
  "instalment_schedules",
  "mandates",
  "organisations",
  "outbound_payments",
  "payer_authorisations",
  "payments",
  "payment_account_transactions",
  "payouts",
  "refunds",
  "scheme_identifiers",
  "subscriptions",
]);

export const ORIGINS = new Set(["bank", "api", "gocardless", "customer", "payer"]);

type StatusInfo = { outcome: Outcome; meaning: string };
const st = (outcome: Outcome, meaning: string): StatusInfo => ({ outcome, meaning });

export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  pending_customer_approval: st("pending", "Waiting for the customer to approve the payment."),
  pending_submission: st("pending", "Created, not yet submitted to the banks."),
  submitted: st("pending", "Submitted to the banks."),
  confirmed: st("success", "Collected; not yet paid out."),
  paid_out: st("success", "Included in a payout to the creditor."),
  cancelled: st("failure", "Cancelled."),
  customer_approval_denied: st("failure", "The customer refused approval."),
  failed: st("failure", "Could not be collected. A payment can fail after it was confirmed."),
  charged_back: st("unknown", "Charged back by the customer's bank."),
};

export const REFUND_STATUSES: Record<string, StatusInfo> = {
  created: st("pending", "Created."),
  pending_submission: st("pending", "Created, not yet submitted to the banks."),
  submitted: st("pending", "Submitted to the banks."),
  paid: st("success", "Included in a payout."),
  cancelled: st("failure", "Cancelled."),
  bounced: st("failure", "Could not be paid to the customer."),
  funds_returned: st("failure", "The refund's funds were returned to the creditor."),
};

const NEW_MANDATE =
  "The mandate can no longer be used. Ask the customer to set up a new mandate, possibly with different bank details.";

const cause = (
  category: ErrorCategory,
  explanation: string,
  nextAction: string,
  retry: RetryGuidance,
  retryExplanation: string,
  confidence: Confidence = "strong",
): CatalogEntry => ({ category, explanation, nextAction, retry, retryExplanation, confidence });

const NO_RETRY_MANDATE = "A new collection needs a usable mandate first.";

/**
 * Documented `details.cause` values of payment failed/cancelled, mandate
 * failed/cancelled and refund failed events. GoCardless uses one cause for
 * several scheme-specific bank reports, so explanations stay general. Bank
 * reason codes are not decoded.
 */
export const CAUSES: Record<string, CatalogEntry> = {
  insufficient_funds: cause(
    "insufficient_funds",
    "The customer's account did not have enough funds.",
    "Check will_attempt_retry: when it is true GoCardless retries automatically. Otherwise contact the customer before retrying.",
    "retry_conditionally",
    "A failed payment can be retried with the retry endpoint while the mandate is active, up to 3 times. Do not retry manually when GoCardless will already retry it.",
  ),
  refer_to_payer: cause(
    "unknown",
    "The customer's bank did not pay and gave no specific reason. GoCardless uses this cause for insufficient funds, refusals and unspecified failures, depending on the scheme.",
    "Contact the customer to find out why the payment was not paid.",
    "customer_action_required",
    "Whether a retry can succeed depends on the customer. Check will_attempt_retry before retrying manually.",
    "possible",
  ),
  invalid_bank_details: cause(
    "payment_method_unavailable",
    "The bank account details are invalid or the account does not exist. The mandate is cancelled or fails as well.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  bank_account_closed: cause(
    "payment_method_unavailable",
    "The customer's bank account is closed. GoCardless uses this cause also when the account holder has died. The mandate is cancelled as well.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  closed_debtor_account_number: cause(
    "payment_method_unavailable",
    "The payer's account was closed.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  account_details_changed: cause(
    "payment_method_unavailable",
    "The payer's account was changed to a different account.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  bank_account_transferred: cause(
    "payment_method_unavailable",
    "The mandate was moved to a new bank account, or the bank did not send GoCardless the new details.",
    "Wait for a mandate transferred event; if the mandate was cancelled instead, set up a new one.",
    "retry_conditionally",
    "GoCardless suggests a payment may be retried once the mandate's transferred event has arrived.",
  ),
  authorisation_disputed: cause(
    "unknown",
    "The customer disputes having authorised the mandate or the debit, or says they were not notified.",
    "Review the mandate and the notifications sent to the customer before contacting them.",
    "manual_review",
    "Do not collect again before the dispute with the customer is resolved.",
  ),
  mandate_cancelled: cause(
    "payment_method_unavailable",
    "The mandate was cancelled, by the customer at their bank, by the bank, or at the merchant's request.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  mandate_expired: cause(
    "payment_method_unavailable",
    "The mandate expired before the payment was collected.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  mandate_suspended_by_payer: cause(
    "payment_method_unavailable",
    "The payer suspended the mandate.",
    "Contact the customer about the suspended mandate.",
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  direct_debit_not_enabled: cause(
    "payment_method_unavailable",
    "The customer's bank account does not support Direct Debit, or Direct Debits from it are restricted.",
    "Ask the customer for a bank account that accepts Direct Debit.",
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  account_blocked_for_any_financial_transaction: cause(
    "payment_method_unavailable",
    "The payer's account is blocked.",
    "Contact the customer about the blocked account.",
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  blocked_account: cause(
    "payment_method_unavailable",
    "The payer's account is blocked.",
    "Contact the customer about the blocked account.",
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  payment_stopped: cause(
    "unknown",
    "The payer or their bank stopped the payment.",
    "Contact the customer before collecting again.",
    "customer_action_required",
    "Collecting again without the customer's agreement is likely to fail the same way.",
  ),
  return_on_odfi_request: cause(
    "unknown",
    "The payment was returned at the request of the originating bank (ACH).",
    "Review the payment with GoCardless before collecting again.",
    "manual_review",
    "The reason behind the return is not given in the event.",
    "possible",
  ),
  initial_one_off_payment_failed: cause(
    "payment_method_unavailable",
    "The mandate was cancelled because its initial instant payment failed.",
    NEW_MANDATE,
    "customer_action_required",
    NO_RETRY_MANDATE,
  ),
  limit_exceeded: cause(
    "invalid_amount",
    "The payment is above the maximum the payer's bank allows for this payer.",
    "Agree a smaller amount or another way to pay with the customer.",
    "do_not_retry",
    "The same amount will be refused again.",
  ),
  daily_payment_limit_reached: cause(
    "invalid_amount",
    "The payment is above the payer's daily payment limit set by the bank.",
    "Agree with the customer when to collect again.",
    "retry_conditionally",
    "The limit is daily; a later attempt may be accepted.",
    "possible",
  ),
  maximum_dd_transaction_amount_exceeded: cause(
    "invalid_amount",
    "The payment broke the amount limits agreed in the mandate.",
    "Collect an amount within the mandate's limits, or agree new limits with the customer.",
    "do_not_retry",
    "The same amount breaks the mandate again.",
  ),
  maximum_number_of_dd_transactions_exceeded: cause(
    "invalid_request",
    "The payment broke the number of payments allowed by the mandate.",
    "Check the mandate's limits before collecting again.",
    "do_not_retry",
    "Another payment in the same period breaks the mandate again.",
  ),
  payment_violated_mandate_parameters: cause(
    "invalid_request",
    "The payment did not match the consent parameters of its mandate.",
    "Check the mandate's limits before collecting again.",
    "do_not_retry",
    "The same payment breaks the mandate again.",
  ),
  unsuccessful_direct_debit: cause(
    "unknown",
    "The transaction against the mandate was not successful.",
    "Contact the customer before collecting again.",
    "manual_review",
    "The event does not say why the debit was unsuccessful.",
    "possible",
  ),
  bank_system_processing_error: cause(
    "unknown",
    "The customer's bank refused the payment and refers to the customer.",
    "Contact the customer.",
    "customer_action_required",
    "Whether a retry can succeed depends on the customer and their bank.",
    "possible",
  ),
  bank_declined_payment: cause(
    "unknown",
    "The bank declined the payment.",
    "Contact the customer.",
    "customer_action_required",
    "The event does not say why the bank declined it.",
    "possible",
  ),
  insufficient_payment_permissions: cause(
    "unknown",
    "The bank refused the payment because approvals were missing.",
    "Ask the customer to complete the approvals their bank needs.",
    "customer_action_required",
    "A retry can only succeed after the approvals are in place.",
  ),
  no_status_update: cause(
    "unknown",
    "GoCardless marked the payment as failed because the bank sent no status update in time.",
    "Check the payment in the GoCardless dashboard before collecting again.",
    "manual_review",
    "The payment is reported as failed, but the bank never reported a reason.",
  ),
  test_failure: cause(
    "unknown",
    "A sandbox-only failure that GoCardless creates for testing failure webhooks.",
    "No action is needed in live data; this cause does not occur outside the sandbox.",
    "unknown",
    "This is test data.",
  ),
  refund_failed: cause(
    "unknown",
    "The refund did not reach the customer. GoCardless returns the funds to the creditor.",
    "Check the customer's bank details and agree how to refund them.",
    "manual_review",
    "A new refund needs working bank details; the event does not say why it failed.",
    "possible",
  ),
  other: cause(
    "unknown",
    "GoCardless reports another reason that it does not classify, such as an internal error or a bank refusal.",
    "Check the payment in the GoCardless dashboard and contact support if needed.",
    "manual_review",
    "The event does not say enough to judge whether a retry is safe.",
    "possible",
  ),
};

/** Values of `details.not_retried_reason` on a failed payment event. */
export const NOT_RETRIED_REASONS: Record<string, string> = {
  failure_filter_applied:
    "GoCardless will not retry the payment because a retry is very likely to fail.",
  other: "GoCardless will not retry the payment for another reason.",
};
