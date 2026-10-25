/**
 * Razorpay knowledge, kept as data. Every value comes from the verified research
 * file (docs/providers/research/razorpay.md), which cites razorpay.com/docs.
 *
 * Meanings are short paraphrases of Razorpay's tables. Category and retry
 * values are PandaPayLens mappings, not Razorpay statements; where Razorpay
 * gives its own next step (for example "retry after 30 min"), it is quoted in
 * the meaning.
 *
 * Razorpay calls its payment reason tables "top" errors, so they are not
 * exhaustive. The same reason string can mean different things for a payment
 * and for a RazorpayX payout, so each table is looked up only for its own
 * entity and field.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://razorpay.com/docs";

export const ERRORS_URL = `${DOCS}/errors/`;
export const COMMON_ERRORS_URL = `${DOCS}/errors/common/`;
export const PAYMENT_ERRORS_URL = `${DOCS}/errors/payments/list/`;
export const CARD_ERRORS_URL = `${DOCS}/errors/payments/cards/`;
export const UPI_ERRORS_URL = `${DOCS}/errors/payments/upi/`;
export const ERROR_PARAMETERS_URL = `${DOCS}/errors/payments/payment-methods-error-parameters/`;
export const ERROR_REASONS_URL = `${DOCS}/payments/payment-gateway/rainy-day/errors/error-reasons/`;
export const API_CONVENTIONS_URL = `${DOCS}/api/understand/`;
export const PAYMENT_ENTITY_URL = `${DOCS}/api/payments/entity/`;
export const PAYMENT_LIFECYCLE_URL = `${DOCS}/payments/payments/`;
export const LATE_AUTHORISATION_URL = `${DOCS}/payments/payments/late-authorisation/`;
export const CAPTURE_URL = `${DOCS}/api/payments/capture/`;
export const ORDER_ENTITY_URL = `${DOCS}/api/orders/entity/`;
export const REFUND_ENTITY_URL = `${DOCS}/api/refunds/entity/`;
export const REFUNDS_URL = `${DOCS}/payments/refunds/`;
export const DISPUTE_ENTITY_URL = `${DOCS}/api/disputes/entity/`;
export const DISPUTES_URL = `${DOCS}/payments/disputes/`;
export const SETTLEMENT_ENTITY_URL = `${DOCS}/api/settlements/entity/`;
export const SETTLEMENTS_URL = `${DOCS}/payments/settlements/`;
export const WEBHOOKS_URL = `${DOCS}/webhooks/`;
export const WEBHOOK_EVENTS_URL = `${DOCS}/webhooks/all/`;
export const WEBHOOK_PAYMENTS_URL = `${DOCS}/webhooks/payments/`;
export const WEBHOOK_BEST_PRACTICES_URL = `${DOCS}/webhooks/best-practices/`;
export const WEBHOOK_VALIDATE_URL = `${DOCS}/webhooks/validate-test/`;
export const CHECKOUT_INTEGRATION_URL = `${DOCS}/payments/payment-gateway/web-integration/standard/integration-steps/`;
export const S2S_JSON_URL = `${DOCS}/payments/payment-gateway/s2s-integration/json/v2/build-integration/upi/intent/`;
export const X_ERRORS_URL = `${DOCS}/errors/x/`;
export const X_API_ERRORS_URL = `${DOCS}/api/x/error-codes/`;
export const PAYOUT_STATUS_DETAILS_URL = `${DOCS}/errors/x/payout-status-details/`;
export const PAYOUT_STATES_URL = `${DOCS}/x/payouts/states-life-cycle/`;
export const PAYOUT_ENTITY_URL = `${DOCS}/api/x/payouts/entity/`;

/** Pages that list payment error reasons (section 4.3 of the research file). */
export const REASON_PAGES = {
  B: { title: "Razorpay payment errors (Bad Request Errors)", url: PAYMENT_ERRORS_URL },
  G: { title: "Razorpay payment errors (Gateway Errors)", url: PAYMENT_ERRORS_URL },
  R: { title: "Razorpay error reasons", url: ERROR_REASONS_URL },
  C: { title: "Razorpay card errors", url: CARD_ERRORS_URL },
  U: { title: "Razorpay UPI errors", url: UPI_ERRORS_URL },
} as const;

export type ReasonPage = keyof typeof REASON_PAGES;

export type ReasonEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Pages that list the reason, in the research file's order. */
  pages: readonly ReasonPage[];
  /** The documented pages disagree about the meaning or the next step. */
  conflict?: string;
};

type Row = [pages: string, category: ErrorCategory, retry: RetryGuidance, meaning: string];

const CUSTOMER: RetryGuidance = "customer_action_required";

/** Payment error reasons (`error.reason`, `error_reason`): 111 values. */
// prettier-ignore
const PAYMENT_ROWS: Record<string, Row> = {
  amount_less_than_minimum_amount: ["BR", "invalid_amount", "do_not_retry", "The amount is below the minimum allowed, for example below a bank's fixed fee."],
  authentication_failed: ["BGRC", "authentication_failed", CUSTOMER, "3-D Secure or OTP authentication did not complete: wrong details, or the customer left the authentication page."],
  authorisation_declined_by_psp: ["GR", "payment_method_unavailable", CUSTOMER, "The customer's UPI app (PSP) refused the authorisation, because of a PSP problem or a problem with the customer's VPA."],
  bank_account_invalid: ["BR", "invalid_request", CUSTOMER, "The customer's bank account is not valid, for example closed."],
  bank_account_validation_failed: ["BR", "invalid_request", CUSTOMER, "Third-party validation (TPV) could not confirm the customer's bank account details."],
  bank_cutoff_in_progress: ["GR", "provider_unavailable", "retry_conditionally", "The bank's periodic core banking cutoff is running."],
  bank_not_available: ["GR", "provider_unavailable", "retry_conditionally", "The bank is down or has a technical issue."],
  bank_not_enabled: ["BR", "configuration", "do_not_retry", "The selected bank is not enabled for the merchant account."],
  bank_technical_error: ["BGRCU", "provider_unavailable", CUSTOMER, "The issuing bank's core banking system failed during the payment (also used for UPI provider downtime)."],
  beneficiary_account_does_not_exist: ["GR", "configuration", "manual_review", "The beneficiary account does not exist."],
  beneficiary_account_dormant: ["GR", "configuration", "manual_review", "The beneficiary account is dormant."],
  capture_failed: ["BR", "unknown", "manual_review", "Capture of an authorised payment failed."],
  card_declined: ["GRC", "card_declined", CUSTOMER, "The issuer declined the card without telling Razorpay why."],
  card_disabled_for_online_payments: ["C", "card_declined", CUSTOMER, "The cardholder has not enabled the card for online use."],
  card_expired: ["BRC", "card_declined", CUSTOMER, "The card has expired."],
  card_network_not_enabled: ["BR", "configuration", "do_not_retry", "The card network (for example Amex) is not enabled for the merchant."],
  card_not_enrolled: ["BRC", "payment_method_unavailable", CUSTOMER, "The card is not enrolled for 3-D Secure or for this payment method."],
  card_number_invalid: ["BR", "invalid_request", CUSTOMER, "The card number does not belong to any known BIN or IIN."],
  card_type_invalid: ["BR", "payment_method_unavailable", CUSTOMER, "This card type is not allowed for the payment, for example a credit card for a mutual fund purchase."],
  collect_on_mcc_blocked: ["GR", "configuration", "do_not_retry", "NPCI blocks UPI collect requests for the merchant category; Razorpay suggests the intent flow."],
  collect_request_pending: ["GR", "authentication_required", CUSTOMER, "A UPI collect request is still waiting for the customer or for the acquirer callback."],
  compliance_violation: ["BR", "fraud_or_risk", "manual_review", "A compliance rule failed at customer or merchant level; the source field tells which."],
  credit_failed: ["GRU", "unknown", CUSTOMER, "The credit into the merchant account was refused (TPV account mismatch or beneficiary bank issue)."],
  credit_limit_exceeded: ["GR", "insufficient_funds", CUSTOMER, "Cardless EMI: the customer's credit limit is used up."],
  credit_limit_expired: ["GR", "payment_method_unavailable", CUSTOMER, "Cardless EMI: the customer's credit limit has expired."],
  credit_limit_inactive: ["GR", "payment_method_unavailable", CUSTOMER, "Cardless EMI: the credit limit is inactive, possibly pending customer action."],
  credit_limit_not_approved: ["GR", "payment_method_unavailable", CUSTOMER, "Cardless EMI: the credit limit was not approved."],
  credit_not_permitted: ["GR", "unknown", CUSTOMER, "The beneficiary bank did not allow the credit (TPV mismatch or bank issue)."],
  debit_declined: ["GR", "card_declined", CUSTOMER, "The customer's bank refused the debit, for example because the account is blocked."],
  debit_instrument_blocked: ["BGRC", "card_declined", CUSTOMER, "The card is blocked by the issuer or the cardholder."],
  debit_instrument_inactive: ["GRC", "card_declined", CUSTOMER, "The card is inactive, frozen or not enabled for online use."],
  deemed_transaction: ["GR", "unknown", "manual_review", "Deemed transaction: the acquirer does not know the outcome yet; it becomes known the next day."],
  duplicate_refund_id: ["BR", "duplicate_request", "do_not_retry", "Two refunds were started with the same refund ID."],
  duplicate_request: ["BR", "duplicate_request", "do_not_retry", "An identical payment request was already sent to the gateway."],
  duplicate_rrn_found: ["GR", "duplicate_request", "retry_conditionally", "Another payment already has the same RRN; described as rare and temporary."],
  emi_greater_than_max_amount: ["BR", "invalid_amount", CUSTOMER, "Cardless EMI: the amount is above the customer's maximum."],
  emi_plan_unavailable: ["BR", "payment_method_unavailable", CUSTOMER, "Cardless EMI: the chosen plan is no longer offered."],
  funds_blocked_by_mandate: ["GR", "insufficient_funds", CUSTOMER, "UPI one-time mandate: the funds are blocked by an existing mandate."],
  gateway_technical_error: ["GRCU", "provider_unavailable", "retry_conditionally", "Technical error or downtime at the gateway or at Razorpay's partner bank."],
  incorrect_atm_pin: ["BR", "authentication_failed", CUSTOMER, "Wrong ATM PIN, mainly during UPI registration."],
  incorrect_card_details: ["BR", "invalid_request", CUSTOMER, "Some card detail entered by the customer was wrong."],
  incorrect_card_expiry_date: ["BR", "invalid_request", CUSTOMER, "Wrong card expiry date."],
  incorrect_cardholder_name: ["BR", "invalid_request", CUSTOMER, "Wrong cardholder name."],
  incorrect_cvv: ["BRC", "card_declined", CUSTOMER, "Wrong CVV."],
  incorrect_otp: ["BR", "authentication_failed", CUSTOMER, "Wrong OTP."],
  incorrect_pin: ["BR", "authentication_failed", CUSTOMER, "Wrong PIN."],
  input_validation_failed: ["BR", "invalid_request", "do_not_retry", "The request had a wrong or missing input; the description and field say which."],
  insufficient_funds: ["BRCU", "insufficient_funds", CUSTOMER, "Not enough balance in the customer's account."],
  international_transaction_not_allowed: ["BR", "configuration", "do_not_retry", "International transactions are not enabled for the account or product."],
  invalid_amount: ["BR", "invalid_amount", "do_not_retry", "The amount is invalid or of the wrong type."],
  invalid_currency: ["BR", "configuration", "do_not_retry", "The currency is unsupported or not enabled for the merchant."],
  invalid_device: ["BR", "authentication_required", CUSTOMER, "UPI: the device is not bound to the customer's account."],
  invalid_email: ["BR", "invalid_request", CUSTOMER, "The email address is not valid."],
  invalid_mobile_number: ["BR", "invalid_request", CUSTOMER, "Wallet: the mobile number is not registered with the wallet or is invalid."],
  invalid_order_id: ["BR", "invalid_request", "do_not_retry", "The order ID is missing or invalid."],
  invalid_request: ["BR", "invalid_request", "do_not_retry", "The request is invalid because of data the merchant sent."],
  invalid_response_from_gateway: ["GR", "provider_unavailable", "retry_conditionally", "The gateway's response could not be used."],
  invalid_user_details: ["BR", "invalid_request", CUSTOMER, "The customer does not exist or the user details are invalid."],
  invalid_vpa: ["BGRU", "invalid_request", CUSTOMER, "The VPA (UPI ID) is wrong or not registered."],
  issuer_technical_error: ["GR", "provider_unavailable", "retry_conditionally", "Technical error at the issuer."],
  live_mode_not_enabled: ["BR", "configuration", "do_not_retry", "Live mode is not enabled, typically test keys used for a live payment."],
  mandate_creation_declined: ["GR", "card_declined", CUSTOMER, "UPI Autopay or one-time mandate creation was declined."],
  mandate_creation_expired: ["GR", "network_or_timeout", CUSTOMER, "Mandate creation expired."],
  mandate_creation_failed: ["GR", "unknown", CUSTOMER, "Mandate creation failed or was declined by some party."],
  mandate_creation_timeout: ["GR", "network_or_timeout", CUSTOMER, "Mandate creation timed out."],
  mcc_amount_limit_exceeded: ["G", "invalid_amount", "manual_review", "The amount limit for the merchant category code was exceeded."],
  merchant_not_activated: ["BR", "configuration", "manual_review", "The merchant account or terminal is not active with the gateway."],
  mismatch_in_transaction_details: ["BR", "invalid_request", "do_not_retry", "The merchant passed transaction details that do not match."],
  mobile_number_invalid: ["BR", "invalid_request", CUSTOMER, "UPI: the mobile number is not mapped to the bank account."],
  order_already_paid: ["BR", "duplicate_request", "do_not_retry", "The order already has a successful payment."],
  order_amount_mismatch: ["BR", "invalid_amount", "do_not_retry", "The payment amount differs from the order amount."],
  order_payment_method_mismatch: ["BR", "invalid_request", "do_not_retry", "The payment method differs from the method set on the order."],
  otp_attempts_exceeded: ["BR", "authentication_failed", CUSTOMER, "Too many wrong OTP attempts."],
  otp_expired: ["BR", "authentication_failed", CUSTOMER, "The OTP had expired."],
  payment_amount_tampered: ["GR", "invalid_amount", "manual_review", "The payment amount was altered."],
  payment_cancelled: ["BGRCU", "authentication_failed", CUSTOMER, "The customer cancelled, closed the window or pressed back during the payment."],
  payment_collect_request_expired: ["GRU", "network_or_timeout", CUSTOMER, "The UPI collect request expired before the customer approved it."],
  payment_declined: ["GRU", "card_declined", CUSTOMER, "The issuer bank or the gateway declined without a reason."],
  payment_declined_due_to_high_traffic: ["GR", "provider_unavailable", "retry_conditionally", "The bank could not serve the request during very high traffic."],
  payment_failed: ["BGRC", "unknown", CUSTOMER, "Bank or wallet gateway failure with no specific code."],
  payment_method_not_enabled: ["BR", "configuration", "do_not_retry", "The payment method is not enabled for the merchant."],
  payment_pending: ["GR", "unknown", "manual_review", "The bank or gateway marked the payment pending; it may be authorised later (late authorisation)."],
  payment_pending_approval: ["BR", "unknown", "manual_review", "Waiting for maker-checker approval inside the merchant's organisation."],
  payment_risk_check_failed: ["BGRC", "fraud_or_risk", CUSTOMER, "Declined by a risk check at Razorpay, the gateway or the issuer; the source field tells which."],
  payment_session_expired: ["GR", "network_or_timeout", CUSTOMER, "The payment session expired before the customer finished."],
  payment_timed_out: ["BGRCU", "network_or_timeout", CUSTOMER, "The customer did not finish in time (typically 10 minutes), or the gateway did not answer."],
  pin_attempts_exceeded: ["BR", "authentication_failed", CUSTOMER, "Too many wrong PIN attempts."],
  pin_not_set: ["BR", "authentication_required", CUSTOMER, "No UPI PIN is set on the account."],
  psp_app_not_available: ["GR", "provider_unavailable", CUSTOMER, "The UPI app is unavailable, for example during downtime."],
  psp_app_not_supported: ["GR", "payment_method_unavailable", CUSTOMER, "The UPI app is not supported (blocked)."],
  psp_not_available: ["GR", "provider_unavailable", CUSTOMER, "The PSP is down."],
  psp_not_registered: ["GR", "payment_method_unavailable", CUSTOMER, "The PSP is not registered on the customer's device."],
  record_not_found: ["BR", "unknown", "retry_conditionally", "The bank has no record of the payment, typically on a status check."],
  recurring_payment_not_enabled: ["BR", "configuration", "do_not_retry", "Recurring payments are not enabled for the merchant."],
  refund_limit_crossed: ["BR", "invalid_amount", "manual_review", "The refund amount limit was crossed."],
  reqauth_mandate_not_acknowledged: ["GR", "provider_unavailable", "retry_conditionally", "The PSP did not answer the mandate authorisation request."],
  request_timed_out: ["GR", "network_or_timeout", "retry_conditionally", "The request timed out."],
  server_error: ["BGR", "provider_unavailable", "retry_conditionally", "Technical error on Razorpay's side."],
  transaction_daily_count_exceeded: ["GR", "card_declined", CUSTOMER, "The payer exceeded the number of transactions allowed per day."],
  transaction_daily_limit_exceeded: ["BGR", "card_declined", CUSTOMER, "The payer exceeded the daily amount limit."],
  transaction_frequency_limit_exceeded: ["BGR", "card_declined", CUSTOMER, "The payer hit NPCI's per-day UPI frequency or amount limit."],
  transaction_limit_exceeded: ["BRC", "card_declined", CUSTOMER, "The payer exceeded the card's credit or debit limit."],
  transaction_on_vpa_restricted: ["BR", "payment_method_unavailable", CUSTOMER, "The PSP has blocked transactions on this VPA."],
  upi_app_technical_error: ["BR", "provider_unavailable", CUSTOMER, "Technical error in the customer's UPI app (PSP)."],
  upi_autopay_not_supported_on_psp: ["BR", "payment_method_unavailable", CUSTOMER, "The customer's UPI app does not support UPI Autopay."],
  upi_collect_not_enabled: ["BR", "configuration", "do_not_retry", "The merchant called the UPI collect flow but it is not enabled."],
  upi_intent_not_enabled: ["BR", "configuration", "do_not_retry", "The merchant called the UPI intent flow but it is not enabled."],
  user_not_eligible: ["BGR", "payment_method_unavailable", CUSTOMER, "Cardless EMI or credit: the customer failed the eligibility check."],
  user_not_registered_for_netbanking: ["BR", "payment_method_unavailable", CUSTOMER, "The customer's account is not registered for netbanking."],
  verification_failed: ["BR", "network_or_timeout", "retry_conditionally", "Verifying the payment with the status check API failed; described as temporary."],
  vpa_resolution_failed: ["GRU", "provider_unavailable", CUSTOMER, "The UPI network could not resolve the VPA."],
};

/** Reasons whose documented pages disagree (research file, section 10, item 4). */
const CONFLICTS: Record<string, string> = {
  capture_failed:
    "The two pages that list it give different next steps: contact Razorpay, or let the customer retry.",
  credit_not_permitted:
    "The list page words it as a credit not allowed for this customer instead of a bank refusal.",
  international_transaction_not_allowed:
    "The list page puts the action on the customer instead of the merchant's account settings.",
  invalid_amount: "One page says the amount or the currency can be invalid.",
  authentication_failed:
    "The failure analysis page describes it as incorrect card details instead of an authentication failure.",
  payment_cancelled:
    "The Cards page also files bank downtime under this reason, so it does not always mean the customer cancelled.",
  credit_failed: "The UPI page also maps partner bank downtime to this reason.",
};

/** Reasons that stay strong although a page disagrees: the core meaning is shared. */
const MINOR_CONFLICTS = new Set([
  "invalid_amount",
  "authentication_failed",
  "payment_cancelled",
  "credit_failed",
]);

function buildReasons(rows: Record<string, Row>): Record<string, ReasonEntry> {
  const out: Record<string, ReasonEntry> = {};
  for (const [reason, [pages, category, retry, meaning]] of Object.entries(rows)) {
    const conflict = Object.prototype.hasOwnProperty.call(CONFLICTS, reason)
      ? CONFLICTS[reason]
      : undefined;
    out[reason] = {
      meaning,
      category,
      retry,
      pages: pages.split("") as ReasonPage[],
      ...(conflict ? { conflict } : {}),
    };
  }
  return out;
}

export const PAYMENT_REASONS: Readonly<Record<string, ReasonEntry>> = buildReasons(PAYMENT_ROWS);

/** True when a page conflict is serious enough to lower confidence to possible. */
export function lowersConfidence(reason: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONFLICTS, reason) && !MINOR_CONFLICTS.has(reason);
}

/**
 * Seen in Razorpay's main sample error but in no reason table. Read like
 * incorrect_otp, with possible confidence.
 */
export const UNDOCUMENTED_REASON_ALIASES: Readonly<Record<string, string>> = {
  invalid_otp: "incorrect_otp",
};

/** Error `code` (error type): 3 values. */
export const ERROR_CODES: Readonly<
  Record<string, { meaning: string; category: ErrorCategory; retry: RetryGuidance; url: string }>
> = {
  BAD_REQUEST_ERROR: {
    meaning: "The request or the payment was rejected; the reason field gives the detail.",
    category: "unknown",
    retry: "unknown",
    url: ERRORS_URL,
  },
  SERVER_ERROR: {
    meaning: "An error on Razorpay's side.",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    url: COMMON_ERRORS_URL,
  },
  GATEWAY_ERROR: {
    meaning: "An error at the payment gateway or the downstream bank (documented for RazorpayX).",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    url: X_ERRORS_URL,
  },
};

/**
 * Common API errors that carry no reason (D/errors/common.md). Matched on the
 * exact documented description, case-insensitive and without a final period.
 */
export const COMMON_DESCRIPTIONS: Readonly<
  Record<string, { meaning: string; category: ErrorCategory; retry: RetryGuidance }>
> = {
  "too many requests": {
    meaning: "Razorpay throttled the request (rate limit).",
    category: "rate_limiting",
    retry: "safe_to_retry_technical_request",
  },
  "the api key provided is invalid": {
    meaning: "The API key is invalid.",
    category: "configuration",
    retry: "do_not_retry",
  },
  "access denied": {
    meaning: "Access was denied, for example because the server's IP is not allowlisted.",
    category: "configuration",
    retry: "do_not_retry",
  },
  "the requested url was not found on the server": {
    meaning: "The endpoint URL does not exist.",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  "the id provided does not exist or access is unauthorised": {
    meaning: "The id does not exist, or the key has no access to it.",
    category: "invalid_request",
    retry: "do_not_retry",
  },
};

export type XApiReason = {
  meaning: string;
  /** HTTP status and error code as documented; undefined when not documented. */
  http?: number;
  code?: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

/** RazorpayX API error reasons (`error.reason` on payout, contact and fund account APIs): 7 values. */
export const X_API_REASONS: Readonly<Record<string, XApiReason>> = {
  input_validation_failed: {
    meaning: "Wrong or missing input; the description and field say which.",
    http: 400,
    code: "BAD_REQUEST_ERROR",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  insufficient_funds: {
    meaning: "The merchant's own RazorpayX account lacks funds for the transaction.",
    category: "insufficient_funds",
    retry: "manual_review",
  },
  server_error: {
    meaning: "A Razorpay server problem.",
    http: 500,
    code: "SERVER_ERROR",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  payout_approval_not_allowed: {
    meaning: "The payout is no longer pending, so it cannot be approved or rejected.",
    http: 400,
    code: "BAD_REQUEST_ERROR",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  authentication_failed: {
    meaning: "The OAuth token is invalid, expired or has no permission.",
    http: 401,
    code: "BAD_REQUEST_ERROR",
    category: "configuration",
    retry: "do_not_retry",
  },
  gateway_error: {
    meaning: "An error at the payment gateway or the downstream bank.",
    http: 502,
    code: "GATEWAY_ERROR",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  service_unavailable: {
    meaning: "The service is temporarily unavailable.",
    http: 503,
    code: "SERVER_ERROR",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

export const X_RETRY_RULE =
  "Razorpay's rule for RazorpayX 5XX errors: retry at most three times, after 1, 2 and 5 minutes, with the same X-Payout-Idempotency key and the same body, within 7 calendar days; then wait at least an hour and check the payout by reference_id before treating it as failed.";

export type PayoutReasonGroup = "failure" | "processing" | "processed" | "pending" | "queued";

export type PayoutReason = {
  group: PayoutReasonGroup;
  source: string;
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

type PayoutRow = [
  group: PayoutReasonGroup,
  source: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  meaning: string,
];

const RETRY_30 = "Razorpay says to retry after 30 minutes.";

/** RazorpayX payout `status_details.reason`: 35 values. Only the failure group is an error. */
// prettier-ignore
const PAYOUT_ROWS: Record<string, PayoutRow> = {
  bank_account_closed: ["failure", "beneficiary_bank", "invalid_request", "do_not_retry", "The beneficiary account is closed."],
  bank_account_frozen: ["failure", "beneficiary_bank", "payment_method_unavailable", "do_not_retry", "The beneficiary account is frozen."],
  bank_account_invalid: ["failure", "beneficiary_bank", "invalid_request", "do_not_retry", "The beneficiary account details are invalid."],
  beneficiary_account_dormant: ["failure", "beneficiary_bank", "payment_method_unavailable", "do_not_retry", "The beneficiary account is dormant."],
  beneficiary_bank_failure: ["failure", "beneficiary_bank", "provider_unavailable", "retry_conditionally", `Technical failure at the beneficiary bank. ${RETRY_30}`],
  beneficiary_bank_offline: ["failure", "beneficiary_bank", "provider_unavailable", "retry_conditionally", `The beneficiary bank is offline. ${RETRY_30}`],
  beneficiary_bank_rejected: ["failure", "beneficiary_bank", "unknown", "manual_review", "Rejected by the beneficiary bank."],
  beneficiary_bank_technical_error: ["failure", "beneficiary_bank", "provider_unavailable", "retry_conditionally", `Technical issue at the beneficiary bank. ${RETRY_30}`],
  beneficiary_psp_offline: ["failure", "beneficiary_bank", "provider_unavailable", "retry_conditionally", `The beneficiary's UPI PSP is offline. ${RETRY_30}`],
  imps_not_allowed: ["failure", "beneficiary_bank", "payment_method_unavailable", "retry_conditionally", "IMPS is not enabled on the beneficiary account; Razorpay says to use another mode."],
  invalid_ifsc_code: ["failure", "beneficiary_bank", "invalid_request", "do_not_retry", "The IFSC code is invalid."],
  npci_beneficiary_timeout: ["failure", "beneficiary_bank", "network_or_timeout", "retry_conditionally", `Temporary issue between NPCI and the beneficiary bank. ${RETRY_30}`],
  transaction_limit_exceeded: ["failure", "beneficiary_bank", "invalid_amount", "do_not_retry", "The amount is above what the beneficiary account accepts."],
  amount_limit_exhausted_neft: ["failure", "business", "configuration", "retry_conditionally", "The account's NEFT 24x7 limit is used up; Razorpay says to retry later."],
  beneficiary_account_invalid: ["failure", "business", "invalid_request", "do_not_retry", "The beneficiary account number is invalid."],
  beneficiary_vpa_invalid: ["failure", "business", "invalid_request", "retry_conditionally", "UPI validation of the beneficiary VPA failed."],
  insufficient_funds: ["failure", "business", "insufficient_funds", "manual_review", "The merchant's RazorpayX account lacks funds."],
  invalid_beneficiary: ["failure", "business", "invalid_request", "do_not_retry", "No wallet account exists for the given phone number."],
  gateway_down: ["failure", "gateway", "provider_unavailable", "retry_conditionally", "Razorpay's partner bank has technical issues."],
  gateway_technical_error: ["failure", "gateway", "provider_unavailable", "retry_conditionally", `Temporary issue at the partner bank. ${RETRY_30}`],
  gateway_timeout: ["failure", "gateway", "network_or_timeout", "retry_conditionally", `The payout timed out at the partner bank. ${RETRY_30}`],
  server_error: ["failure", "internal", "provider_unavailable", "manual_review", "The payout failed; Razorpay says to contact support."],
  server_error_temporary: ["failure", "internal", "provider_unavailable", "retry_conditionally", "A temporary technical issue; Razorpay says to retry."],
  beneficiary_bank_confirmation_pending: ["processing", "beneficiary_bank", "unknown", "do_not_retry", "Credit confirmation is pending from the beneficiary bank."],
  bank_window_closed: ["processing", "gateway", "unknown", "do_not_retry", "The window for the payout mode is closed for the day."],
  payout_bank_processing: ["processing", "gateway", "unknown", "do_not_retry", "The partner bank is processing the payout."],
  amount_limit_exhausted: ["processing", "business", "unknown", "do_not_retry", "The mode's 24x7 limit for the account is used up."],
  partner_bank_pending: ["processing", "internal", "unknown", "do_not_retry", "The partner bank is processing the payout."],
  payout_processed: ["processed", "beneficiary_bank", "unknown", "do_not_retry", "Money was credited to the beneficiary."],
  pending_approval: ["pending", "business", "unknown", "manual_review", "Waiting for approval in the approval workflow."],
  gateway_degraded: ["queued", "gateway", "unknown", "do_not_retry", "Queued because the partner bank's systems are down."],
  beneficiary_bank_down: ["queued", "gateway", "unknown", "do_not_retry", "Queued because the beneficiary bank is down; it fails after a time limit."],
  low_balance: ["queued", "business", "unknown", "manual_review", "Queued because the merchant balance is too low."],
  syncing_balance: ["queued", "gateway", "unknown", "do_not_retry", "Queued while the balance syncs with the bank."],
  fee_recovery_pending: ["queued", "business", "unknown", "do_not_retry", "Queued behind a pending fee recovery payout."],
};

export const PAYOUT_REASONS: Readonly<Record<string, PayoutReason>> = Object.fromEntries(
  Object.entries(PAYOUT_ROWS).map(([reason, [group, source, category, retry, meaning]]) => [
    reason,
    { group, source, category, retry, meaning },
  ]),
);

/** `source` values (who failed), union of the documented sets: 12 including NA. */
export const SOURCES: Readonly<Record<string, string>> = {
  customer: "the customer (for example a wrong OTP, a cancellation or insufficient funds)",
  business: "the merchant's integration or configuration",
  internal: "Razorpay (internal error)",
  razorpay: "Razorpay (internal error)",
  gateway: "the gateway or bank (for payouts, Razorpay's partner bank)",
  issuer_bank: "the customer's bank",
  issuer: "the wallet or credit issuer",
  bank: "the bank",
  customer_psp: "the customer's UPI app",
  network: "the UPI network (NPCI) or the credit network",
  beneficiary_bank: "the receiving bank",
  NA: "not applicable",
};

/** `step` values (where it failed): 21, with the methods that document each. */
export const STEPS: Readonly<Record<string, string>> = {
  payment_initiation: "cards, UPI, netbanking, emandate, wallet, cardless EMI",
  card_enrollment_check: "cards",
  payment_authentication: "cards, UPI, netbanking, emandate, wallet, cardless EMI",
  payment_authorization: "cards, netbanking, emandate, wallet, cardless EMI",
  payment_capture: "cards",
  mandate_creation: "UPI",
  payment_creation: "UPI",
  payment_request: "UPI",
  payment_debit_request: "UPI",
  payment_debit_response: "UPI",
  payment_credit_request: "UPI",
  payment_credit_response: "UPI",
  payment_status_request: "UPI",
  payment_status_response: "UPI",
  payment_response: "UPI",
  refund_request: "UPI",
  payment_request_beneficiary_details: "UPI intent",
  payment_response_beneficiary_details: "UPI intent",
  payment_authentication_request: "UPI collect",
  payment_authentication_response: "UPI collect",
  payment_eligibility_check: "wallet, cardless EMI",
};

/**
 * Stage of a failed payment by documented step. Other steps, including the
 * authentication steps, keep the payment stage: the attempt as a whole failed,
 * and the step stays visible as an attribute.
 */
export const STEP_STAGES: Readonly<Record<string, LifecycleStage>> = {
  payment_authorization: "authorization",
  payment_capture: "capture",
};

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome; meaning: string };

export const PAYMENT_STATUSES: Readonly<Record<string, StatusInfo>> = {
  created: {
    stage: "payment",
    outcome: "pending",
    meaning:
      "Sent to Razorpay, not processed yet; becomes failed after 10 minutes without a bank response.",
  },
  authorized: {
    stage: "authorization",
    outcome: "success",
    meaning:
      "Authorised by the bank; must be captured or it is refunded automatically after 3 days by default.",
  },
  captured: {
    stage: "capture",
    outcome: "success",
    meaning: "Captured; settled later according to the settlement schedule.",
  },
  refunded: { stage: "refund", outcome: "success", meaning: "Refunded." },
  failed: {
    stage: "payment",
    outcome: "failure",
    meaning: "The attempt failed. Razorpay can still authorise it late for up to 3 days.",
  },
};

export const ORDER_STATUSES: Readonly<Record<string, StatusInfo>> = {
  created: {
    stage: "payment",
    outcome: "pending",
    meaning: "Order created, no payment attempt yet.",
  },
  attempted: {
    stage: "payment",
    outcome: "pending",
    meaning: "At least one payment attempt was made; none captured yet.",
  },
  paid: { stage: "payment", outcome: "success", meaning: "A payment on the order was captured." },
};

export const REFUND_STATUSES: Readonly<Record<string, StatusInfo>> = {
  pending: { stage: "refund", outcome: "pending", meaning: "Razorpay is processing the refund." },
  processed: {
    stage: "refund",
    outcome: "success",
    meaning:
      "Processed. Razorpay usually marks a refund processed before the bank reference (ARN or RRN) arrives.",
  },
  failed: { stage: "refund", outcome: "failure", meaning: "The refund failed." },
};

export const DISPUTE_STATUSES: Readonly<Record<string, StatusInfo>> = {
  open: { stage: "dispute", outcome: "pending", meaning: "Open; respond before respond_by." },
  under_review: { stage: "dispute", outcome: "pending", meaning: "Under review." },
  won: { stage: "dispute", outcome: "success", meaning: "Won by the merchant." },
  lost: { stage: "dispute", outcome: "failure", meaning: "Lost by the merchant." },
  closed: {
    stage: "dispute",
    outcome: "unknown",
    meaning:
      "Closed (used for fraud-phase disputes after the merchant provides details or refunds).",
  },
};

export const DISPUTE_PHASES = new Set([
  "fraud",
  "retrieval",
  "chargeback",
  "pre_arbitration",
  "arbitration",
]);

export const SETTLEMENT_STATUSES: Readonly<Record<string, StatusInfo>> = {
  created: { stage: "settlement", outcome: "pending", meaning: "Settlement created." },
  processed: {
    stage: "settlement",
    outcome: "success",
    meaning: "Processed: the transfer was initiated; the credit can take up to 3 hours.",
  },
  failed: { stage: "settlement", outcome: "failure", meaning: "The settlement failed." },
};

export const PAYOUT_STATUSES: Readonly<Record<string, StatusInfo>> = {
  pending: { stage: "payout", outcome: "pending", meaning: "Waiting for approval." },
  queued: { stage: "payout", outcome: "pending", meaning: "Queued, for example for low balance." },
  scheduled: { stage: "payout", outcome: "pending", meaning: "Scheduled for a later time." },
  processing: { stage: "payout", outcome: "pending", meaning: "Sent to the bank." },
  processed: {
    stage: "payout",
    outcome: "success",
    meaning: "Credited by the beneficiary bank; can still become reversed later.",
  },
  reversed: {
    stage: "payout",
    outcome: "failure",
    meaning: "Failed after the debit; amount, fees and tax are credited back.",
  },
  failed: { stage: "payout", outcome: "failure", meaning: "Failed." },
  cancelled: { stage: "payout", outcome: "failure", meaning: "Cancelled by the merchant." },
  rejected: {
    stage: "payout",
    outcome: "failure",
    meaning: "Rejected by an approver or not approved in time.",
  },
};

export type EventEntity =
  "payment" | "order" | "refund" | "dispute" | "settlement" | "payout" | "downtime";

export type EventMapping = {
  /** Entity whose snapshot the event is about. */
  entity: EventEntity;
  stage: LifecycleStage | "from_step";
  outcome: Outcome | "from_status";
};

/** Webhook events with known semantics (D/webhooks/all.md and the family pages). */
export const WEBHOOK_EVENTS: Readonly<Record<string, EventMapping>> = {
  "payment.authorized": { entity: "payment", stage: "authorization", outcome: "success" },
  "payment.captured": { entity: "payment", stage: "capture", outcome: "success" },
  "payment.failed": { entity: "payment", stage: "from_step", outcome: "failure" },
  "order.paid": { entity: "order", stage: "payment", outcome: "success" },
  "refund.created": { entity: "refund", stage: "refund", outcome: "from_status" },
  "refund.processed": { entity: "refund", stage: "refund", outcome: "success" },
  "refund.failed": { entity: "refund", stage: "refund", outcome: "failure" },
  "refund.speed_changed": { entity: "refund", stage: "refund", outcome: "from_status" },
  "payment.dispute.created": { entity: "dispute", stage: "dispute", outcome: "pending" },
  "payment.dispute.under_review": { entity: "dispute", stage: "dispute", outcome: "pending" },
  "payment.dispute.action_required": { entity: "dispute", stage: "dispute", outcome: "pending" },
  "payment.dispute.won": { entity: "dispute", stage: "dispute", outcome: "success" },
  "payment.dispute.lost": { entity: "dispute", stage: "dispute", outcome: "failure" },
  "payment.dispute.closed": { entity: "dispute", stage: "dispute", outcome: "unknown" },
  "settlement.processed": { entity: "settlement", stage: "settlement", outcome: "success" },
  "payout.pending": { entity: "payout", stage: "payout", outcome: "pending" },
  "payout.queued": { entity: "payout", stage: "payout", outcome: "pending" },
  "payout.initiated": { entity: "payout", stage: "payout", outcome: "pending" },
  "payout.processed": { entity: "payout", stage: "payout", outcome: "success" },
  "payout.reversed": { entity: "payout", stage: "payout", outcome: "failure" },
  "payout.failed": { entity: "payout", stage: "payout", outcome: "failure" },
  "payout.rejected": { entity: "payout", stage: "payout", outcome: "failure" },
  "payout.updated": { entity: "payout", stage: "payout", outcome: "from_status" },
  "payment.downtime.started": { entity: "downtime", stage: "other", outcome: "unknown" },
  "payment.downtime.updated": { entity: "downtime", stage: "other", outcome: "unknown" },
  "payment.downtime.resolved": { entity: "downtime", stage: "other", outcome: "unknown" },
  "payout.downtime.started": { entity: "downtime", stage: "other", outcome: "unknown" },
  "payout.downtime.resolved": { entity: "downtime", stage: "other", outcome: "unknown" },
};

/** Documented id prefixes of the entities this adapter reads. */
export const ID_PREFIXES = {
  payment: "pay_",
  order: "order_",
  refund: "rfnd_",
  dispute: "disp_",
  settlement: "setl_",
  payout: "pout_",
  account: "acc_",
  fundAccount: "fa_",
} as const;
