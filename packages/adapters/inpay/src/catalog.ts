/**
 * Inpay code and status knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/inpay.md, which
 * cites Inpay's public developer portal (verified 2026-10-25). The portal is a
 * client-rendered app; the research read its public static files:
 *
 * Payout states and terms:      https://app.inpay.com/docs/api/payouts-introduction.md
 * Payout reason code table:     https://app.inpay.com/docs/assets/reason-codes-payouts-CcF-BJLu.js
 * Payout resource (OpenAPI):    https://app.inpay.com/docs/swagger/shared/payouts.json
 * Payout webhooks:              https://app.inpay.com/docs/api/webhooks-description.md
 * Order lifecycle (pay-ins):    https://app.inpay.com/docs/api/collections/order-lifecycle.md
 * Payment attempt statuses:     https://app.inpay.com/docs/api/collections/*-status.md
 * Pay-in reason table:          https://app.inpay.com/docs/data/reason-codes-collection.json
 * Error model and HTTP codes:   https://app.inpay.com/docs/api/api-errors.md, response-codes.md
 * JWT authentication errors:    https://app.inpay.com/docs/api/getting-started/sign-and-encrypt-jwt-errors.md
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions derived from the documented meaning; Inpay gives no per-code
 * retry advice.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const DOCS = "https://app.inpay.com/docs";
export const PAYOUTS_INTRO_URL = `${DOCS}/api/payouts-introduction.md`;
export const PAYOUTS_TERMINOLOGY_URL = `${DOCS}/api/payouts-terminology.md`;
export const PAYOUT_REASON_CODES_URL = `${DOCS}/assets/reason-codes-payouts-CcF-BJLu.js`;
export const PAYOUTS_OPENAPI_URL = `${DOCS}/swagger/shared/payouts.json`;
export const PAYOUT_WEBHOOKS_URL = `${DOCS}/api/webhooks-description.md`;
export const PAYOUT_WEBHOOKS_JWT_URL = `${DOCS}/api/webhooks-description-jwt.md`;
export const VIRTUAL_ACCOUNT_URL = `${DOCS}/api/payouts_virtual_bank_account.md`;
export const ORDER_LIFECYCLE_URL = `${DOCS}/api/collections/order-lifecycle.md`;
export const ORDER_STATUS_REASONS_URL = `${DOCS}/api/collections/order-status-reasons.md`;
export const COLLECTIONS_TERMINOLOGY_URL = `${DOCS}/api/collections/terminology.md`;
export const BANK_TRANSFER_STATUS_URL = `${DOCS}/api/collections/bank-transfer-payment-status.md`;
export const INSTANT_BANK_TRANSFER_STATUS_URL = `${DOCS}/api/collections/instant-bank-transfer-payment-status.md`;
export const WALLET_TRANSFER_STATUS_URL = `${DOCS}/api/collections/wallet-transfer-status.md`;
export const COLLECTION_WEBHOOKS_URL = `${DOCS}/api/collections/webhooks.md`;
export const COLLECTION_WEBHOOK_EXAMPLES_URL = `${DOCS}/data/collection-webhooks.json`;
export const COLLECTION_REASON_CODES_URL = `${DOCS}/data/reason-codes-collection.json`;
export const COLLECTION_OPENAPI_URL = `${DOCS}/swagger/shared/collection.json`;
export const FX_OPENAPI_URL = `${DOCS}/swagger/shared/fx.json`;
export const API_ERRORS_URL = `${DOCS}/api/api-errors.md`;
export const RESPONSE_CODES_URL = `${DOCS}/api/response-codes.md`;
export const JWT_ERRORS_URL = `${DOCS}/api/getting-started/sign-and-encrypt-jwt-errors.md`;
export const SECURITY_MODEL_URL = `${DOCS}/api/getting-started/security-model.md`;
export const X_REQUEST_ID_URL = `${DOCS}/api/getting-started/http-headers/x-request-id.md`;
export const ISO_STATUS_URL = `${DOCS}/api/iso-2022-status-codes.md`;
export const BUSINESS_VALUE_URL = `${DOCS}/docs-overview/business-value.md`;

export type ErrorMapping = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

// Payout (payment_request) states

export type StateEntry = {
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  /** Whether the state can still change. */
  final: boolean;
  note?: string;
};

/** The seven documented payout `state` values. */
export const PAYOUT_STATES: Record<string, StateEntry> = {
  received: {
    stage: "payout",
    outcome: "pending",
    meaning: "Payout request received; validation and processing follow",
    final: false,
  },
  processing: {
    stage: "payout",
    outcome: "pending",
    meaning: "Payout is being processed",
    final: false,
  },
  pending: {
    stage: "payout",
    outcome: "pending",
    meaning: "Payout waits for its requested execution date, then moves to processing",
    final: false,
  },
  action_required: {
    stage: "payout",
    outcome: "pending",
    meaning:
      "Payout is on hold until the merchant acts (for example insufficient funds or KYC documents); it then returns to processing or is rejected",
    final: false,
  },
  rejected: {
    stage: "payout",
    outcome: "failure",
    meaning:
      "Payout rejected (validation, compliance, or cancellation at the merchant's request); no funds were sent",
    final: true,
  },
  completed: {
    stage: "payout",
    outcome: "success",
    meaning:
      "Payout accepted by the banking layer or processing partner. This is not confirmed credit to the beneficiary; the payout can still be returned",
    final: false,
    note: "A completed payout can still move to returned.",
  },
  returned: {
    stage: "payout",
    outcome: "failure",
    meaning:
      "Payout returned after processing or completion; the funds did not stay with the beneficiary",
    final: true,
  },
};

// Payout reason codes (`reasons[].category` / `reasons[].code`)

export type PayoutReasonEntry = ErrorMapping & {
  reasonCategory: string;
  code: string;
  /**
   * Numeric keys from the portal table. Where two are listed the first is the
   * "Cancelled" row (payout ends rejected) and the second the "Returned" row
   * (payout ends returned).
   */
  keys: readonly number[];
  /** Not an error: informational codes (Verification of Payee results, scheduling). */
  informational?: boolean;
  retryNote?: string;
};

function reason(
  category: string,
  code: string,
  keys: readonly number[],
  meaning: string,
  errorCategory: ErrorCategory,
  retry: RetryGuidance,
  extra: { informational?: boolean; retryNote?: string } = {},
): [string, PayoutReasonEntry] {
  return [
    `${category}:${code}`,
    { reasonCategory: category, code, keys, meaning, category: errorCategory, retry, ...extra },
  ];
}

const INVALID = "invalid_request" as const;
const UNAVAILABLE_METHOD = "payment_method_unavailable" as const;
const RISK = "fraud_or_risk" as const;

/** The 61 documented category and code pairs of the payout reason table (89 rows). */
export const PAYOUT_REASONS: Record<string, PayoutReasonEntry> = Object.fromEntries([
  reason(
    "contract_issue",
    "not_supported_by_your_contract",
    [1],
    "The product is not part of the merchant's contract",
    "configuration",
    "do_not_retry",
  ),
  reason(
    "contract_issue",
    "service_unavailable",
    [2],
    "The service is unavailable",
    "provider_unavailable",
    "retry_conditionally",
    {
      retryNote:
        "The payout itself ended in a final state; a new payout needs a new end_to_end_id once the service is available again.",
    },
  ),
  reason(
    "contract_issue",
    "missing_capability",
    [67],
    "The account lacks the capability for this payout",
    "configuration",
    "do_not_retry",
  ),
  reason(
    "internal_policy",
    "rejected_due_to_internal_policy",
    [3],
    "Rejected under Inpay's internal policy",
    RISK,
    "manual_review",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_account_number",
    [4, 25],
    "The account number or IBAN is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_swift_bic",
    [5, 38],
    "The SWIFT/BIC is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_branch_code",
    [6, 26],
    "The bank or branch code is wrong",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_country_mismatch",
    [7],
    "Country mismatch",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_currency_mismatch",
    [40],
    "Currency mismatch",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_beneficiary_bank_details",
    [9, 41],
    "The beneficiary bank details are wrong",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_beneficiary_details",
    [10, 27],
    "The beneficiary details are wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_mismatch_account_and_bic",
    [11, 42],
    "The account and the BIC do not match",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_mismatch_country_and_bic",
    [12, 43],
    "The country and the BIC do not match",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_beneficiary_name",
    [51, 235],
    "The beneficiary name is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "not_suitable_for_faster_payment_service",
    [54],
    "The account is not eligible for UK Faster Payments",
    UNAVAILABLE_METHOD,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_or_missing_sender_details",
    [55, 61],
    "The sender details are wrong or missing",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "invalid_data",
    "the_account_is_not_suitable_for_EFT_transaction",
    [58],
    "The account cannot receive EFT transactions",
    UNAVAILABLE_METHOD,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "the_BIC_is_not_SEPA_reachable",
    [60, 59],
    "The BIC is not reachable via SEPA",
    UNAVAILABLE_METHOD,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_kanji_character_is_not_supported",
    [96],
    "Kanji characters are not accepted",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_beneficiary_address",
    [130, 180],
    "The beneficiary address, city or postcode is wrong",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_beneficiary_date_of_birth",
    [131],
    "The beneficiary date of birth is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_or_missing_bank_name",
    [140, 162],
    "The bank name is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_or_missing_BSB_number",
    [143, 165],
    "The Australian BSB number is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_or_missing_sender_address",
    [146, 168],
    "The sender state, city or postcode is wrong",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "invalid_data",
    "invalid_data_v2_tstm",
    [185],
    "Incorrect or missing data (rejected)",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "invalid_data",
    "invalid_data_incorrect_or_missing_account_type",
    [205, 277],
    "The account type is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "kyc",
    "kyc_documentation_not_provided_within_reasonable_time",
    [15, 63],
    "KYC documents were not supplied in time",
    RISK,
    "manual_review",
  ),
  reason(
    "kyc",
    "unable_to_approve_kyc_documentation",
    [16],
    "The KYC documents could not be approved",
    RISK,
    "manual_review",
  ),
  reason("kyc", "compliance_check", [36], "Rejected by Inpay compliance", RISK, "do_not_retry"),
  reason(
    "suspicious",
    "suspicious_name_mismatch",
    [18, 45],
    "Name mismatch",
    RISK,
    "manual_review",
  ),
  reason(
    "suspicious",
    "beneficiary_bank_account_closed",
    [19, 30],
    "The beneficiary account is closed or blocked",
    UNAVAILABLE_METHOD,
    "customer_action_required",
  ),
  reason(
    "suspicious",
    "rejected_by_bank_beneficiary_flagged",
    [20, 46],
    "Rejected by the bank: the beneficiary is flagged",
    RISK,
    "do_not_retry",
  ),
  reason(
    "suspicious",
    "suspicious_account_not_recognized",
    [29],
    "The account is not recognised",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "suspicious",
    "beneficiary_bank_account_name_mismatch",
    [49, 31],
    "The account and the name do not match",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "suspicious",
    "beneficiary_bank_account_blocked",
    [56],
    "The beneficiary account is blocked",
    UNAVAILABLE_METHOD,
    "customer_action_required",
  ),
  reason("test", "test_payment", [21, 48], "Test payment", "configuration", "do_not_retry"),
  reason(
    "technical_issue",
    "technical_issue_unknown",
    [22, 47],
    "Technical issue",
    "provider_unavailable",
    "manual_review",
  ),
  reason(
    "beneficiary_request",
    "beneficiary_request_returned_payment_as_per_beneficiary_request",
    [23],
    "Returned at the beneficiary's request (an intentional return)",
    "unknown",
    "manual_review",
  ),
  reason(
    "merchant_request",
    "requested_by_customer",
    [28],
    "Returned at the customer's request (intentional)",
    "unknown",
    "do_not_retry",
  ),
  reason(
    "merchant_request",
    "requested_by_merchant",
    [35, 44],
    "Cancelled or returned at the merchant's request (intentional)",
    "unknown",
    "do_not_retry",
  ),
  reason(
    "beneficiary_bank_request",
    "beneficiary_bank_is_unable_to_apply_funds",
    [50, 32],
    "The beneficiary bank cannot apply the funds",
    UNAVAILABLE_METHOD,
    "manual_review",
  ),
  reason(
    "beneficiary_bank_request",
    "reason_not_specified_by_beneficiary_bank",
    [53, 52],
    "The beneficiary bank gave no reason",
    "unknown",
    "manual_review",
  ),
  reason(
    "processing_bank_request",
    "processing_bank_is_unable_to_apply_funds",
    [62, 238],
    "The processing bank cannot apply the funds",
    "provider_unavailable",
    "manual_review",
  ),
  reason(
    "processing_bank_request",
    "rejected_due_to_processing_bank_policy",
    [149, 174],
    "Rejected under the processing bank's policy",
    RISK,
    "manual_review",
  ),
  reason(
    "processing_bank_request",
    "rejected_by_processing_bank_missing_routing_capability",
    [151, 177],
    "The processing bank cannot route the payout",
    UNAVAILABLE_METHOD,
    "do_not_retry",
  ),
  reason(
    "processing_bank_request",
    "rejected_by_processing_bank_is_unable_to_apply_funds",
    [181],
    "The processing bank cannot apply the funds (returned)",
    "provider_unavailable",
    "manual_review",
  ),
  reason(
    "schema_validation_error",
    "invalid_creditor_account",
    [73],
    "The creditor account is invalid",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "schema_validation_error",
    "invalid_creditor",
    [76],
    "The creditor is invalid",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "schema_validation_error",
    "invalid_ultimate_debtor",
    [79],
    "The ultimate debtor is invalid",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "schema_validation_error",
    "invalid_general_data",
    [82],
    "The general request data is invalid",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "schema_validation_error",
    "invalid_debtor",
    [85],
    "The debtor is invalid",
    INVALID,
    "do_not_retry",
  ),
  reason(
    "pending",
    "waiting_future_execution",
    [91],
    "Waiting for the requested execution date (not an error)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  reason(
    "action_required",
    "insufficient_funds",
    [220],
    "The merchant's virtual account lacks funds",
    "insufficient_funds",
    "manual_review",
    {
      retryNote:
        "Fund the virtual account; Inpay documents that the payout then resumes, so no new payout is needed.",
    },
  ),
  reason(
    "action_required",
    "awaiting_kyc_documents",
    [221],
    "Inpay needs extra KYC information",
    RISK,
    "manual_review",
  ),
  reason(
    "vop_info",
    "match",
    [289],
    "Verification of Payee result: match (informational)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  reason(
    "vop_info",
    "close_match",
    [286],
    "Verification of Payee result: close match (informational)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  reason(
    "vop_info",
    "no_match",
    [283],
    "Verification of Payee result: no match (informational)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  reason(
    "vop_info",
    "not_applicable",
    [292],
    "Verification of Payee result: not applicable (informational)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  reason(
    "vop_rejection",
    "no_match",
    [295],
    "Cancelled: Verification of Payee returned no match",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "vop_rejection",
    "close_match",
    [298],
    "Cancelled: Verification of Payee returned a close match",
    INVALID,
    "customer_action_required",
  ),
  reason(
    "vop_rejection",
    "not_applicable",
    [304],
    "Cancelled: Verification of Payee not applicable",
    "unknown",
    "manual_review",
  ),
]);

/**
 * Codes that appear in Inpay examples but not in the reason table. Their
 * meaning is not documented, so they are decoded with possible confidence and
 * an unknown category.
 */
export const EXAMPLE_ONLY_REASONS: Record<string, { seenIn: string; category?: string }> = {
  "beneficiary-account-not-existing": {
    seenIn: "a returned payout webhook example (category returned)",
    category: "returned",
  },
  validation_schema_failed: { seenIn: "a payout report filter example" },
  awaiting_extended_kyc: { seenIn: "a payout report filter example" },
};

// Pay-in orders (Collections API)

/**
 * The twelve documented Order `status` values. Docs tables write them in
 * capitals with spaces (ACTION REQUIRED); JSON uses lower snake case.
 * Inpay lists the statuses without describing each one, so meanings stay close
 * to the names and the reason table.
 */
export const ORDER_STATUSES: Record<string, StateEntry> = {
  received: { stage: "payment", outcome: "pending", meaning: "Order received", final: false },
  pending: { stage: "payment", outcome: "pending", meaning: "Order pending", final: false },
  cancelled: {
    stage: "payment",
    outcome: "failure",
    meaning:
      "Order cancelled (the reason table lists user cancellation or abandonment, merchant or operator cancellation, expiry and a failed payment)",
    final: true,
  },
  authorised: {
    stage: "payment",
    outcome: "pending",
    meaning: "Order authorised (an optional step before processing); not a received payment",
    final: false,
  },
  processing: { stage: "payment", outcome: "pending", meaning: "Order processing", final: false },
  action_required: {
    stage: "payment",
    outcome: "pending",
    meaning:
      "Order on hold until the merchant or Inpay acts (the reason table lists compliance review and overfunding)",
    final: false,
  },
  completed: { stage: "payment", outcome: "success", meaning: "Order completed", final: false },
  processing_refund: {
    stage: "refund",
    outcome: "pending",
    meaning: "A refund of the order is being processed",
    final: false,
  },
  action_required_for_refund: {
    stage: "refund",
    outcome: "pending",
    meaning: "The refund is blocked until the merchant acts",
    final: false,
  },
  refunded: { stage: "refund", outcome: "success", meaning: "Order refunded", final: true },
  partially_refunded: {
    stage: "refund",
    outcome: "success",
    meaning: "Order partially refunded",
    final: false,
  },
  returned: {
    stage: "payment",
    outcome: "unknown",
    meaning:
      "Order returned (Inpay does not describe what this status means for the received funds)",
    final: true,
  },
};

/** Payment attempt types (`payments[].type`) named in the Collections documentation. */
export const PAYMENT_TYPES: Record<string, { operation: string; statusesDocumented: boolean }> = {
  instant_bank_transfer: {
    operation: "open banking payment initiation (bank transfer, not a card payment)",
    statusesDocumented: true,
  },
  bank_transfer: {
    operation: "bank transfer by payment instructions (not a card payment)",
    statusesDocumented: true,
  },
  wallet_transfer: {
    operation: "wallet transfer (EntirePay wallet account), not a bank or card payment",
    statusesDocumented: true,
  },
  swish_transfer: {
    operation: "Swish transfer (statuses not documented)",
    statusesDocumented: false,
  },
  blik_transfer: {
    operation: "BLIK transfer (statuses not documented)",
    statusesDocumented: false,
  },
};

export type AttemptStatusEntry = { outcome: Outcome; label: string };

const attempt = (outcome: Outcome, label: string): AttemptStatusEntry => ({ outcome, label });

/**
 * Payment attempt statuses per type, keyed by the documented label in lower
 * snake case. Attempt changes do not trigger webhooks; they are visible only
 * inside `payments[]`.
 */
export const ATTEMPT_STATUSES: Record<string, Record<string, AttemptStatusEntry>> = {
  bank_transfer: {
    created: attempt("pending", "CREATED"),
    instructions_provided: attempt("pending", "INSTRUCTIONS PROVIDED"),
    completed: attempt("success", "COMPLETED"),
  },
  instant_bank_transfer: {
    created: attempt("pending", "CREATED"),
    extra_bank_info_required: attempt("pending", "EXTRA BANK INFO REQUIRED"),
    bank_info_collected: attempt("pending", "BANK INFO COLLECTED"),
    consent_given: attempt("pending", "CONSENT GIVEN"),
    external_request_created: attempt("pending", "EXTERNAL REQUEST CREATED"),
    external_transfer_required: attempt("pending", "EXTERNAL TRANSFER REQUIRED"),
    redirect_to_bank: attempt("pending", "REDIRECT TO BANK"),
    // Documented with a template placeholder: REDIRECTED TO {{tenantCompany}}.
    redirected_to: attempt("pending", "REDIRECTED TO {{tenantCompany}}"),
    bank_processing: attempt("pending", "BANK PROCESSING"),
    user_cancelled: attempt("failure", "USER CANCELLED"),
    bank_authorised: attempt("pending", "BANK AUTHORISED"),
    bank_rejected: attempt("failure", "BANK REJECTED"),
    completed: attempt("success", "COMPLETED"),
  },
  wallet_transfer: {
    created: attempt("pending", "CREATED"),
    consent_required: attempt("pending", "CONSENT REQUIRED"),
    kyc_required: attempt("pending", "KYC REQUIRED"),
    processing: attempt("pending", "PROCESSING"),
    user_authorised: attempt("pending", "USER_AUTHORISED"),
    completed: attempt("success", "COMPLETED"),
    rejected: attempt("failure", "REJECTED"),
    user_cancelled: attempt("failure", "USER CANCELLED"),
    failed: attempt("failure", "FAILED"),
  },
};

/** Attempt status values that Inpay's JSON examples show literally. */
export const ATTEMPT_STATUSES_IN_JSON_EXAMPLES: ReadonlySet<string> = new Set([
  "created",
  "bank_authorised",
  "completed",
  "consent_required",
]);

/** Nested `refund.status` values seen in examples; the full list is not documented. */
export const REFUND_STATUSES: Record<string, { outcome: Outcome; meaning: string }> = {
  created: { outcome: "pending", meaning: "Refund created" },
  processing: { outcome: "pending", meaning: "Refund processing" },
  completed: { outcome: "success", meaning: "Refund completed" },
};

export type OrderReasonEntry = ErrorMapping & {
  kind: string;
  group: string;
  /** Not an error (a refund request is a merchant action). */
  informational?: boolean;
};

const orderReason = (
  kind: string,
  group: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  informational?: boolean,
): OrderReasonEntry => ({
  kind,
  group,
  meaning,
  category,
  retry,
  ...(informational ? { informational } : {}),
});

/**
 * The 18 rows of the pay-in reason table, by key. Webhooks carry only a human
 * message in `status_reasons[]`, never the key, and the example messages do not
 * match the table text.
 */
export const ORDER_REASONS: Record<string, OrderReasonEntry> = {
  "98": orderReason(
    "collection",
    "order_cancelled",
    "The user cancelled or abandoned the payment",
    "unknown",
    "customer_action_required",
  ),
  "101": orderReason(
    "collection",
    "order_cancelled",
    "Cancelled by the merchant",
    "unknown",
    "do_not_retry",
  ),
  "102": orderReason(
    "collection",
    "order_cancelled",
    "Cancelled by an Inpay operator",
    "unknown",
    "manual_review",
  ),
  "103": orderReason(
    "collection",
    "order_cancelled",
    "The order expired",
    "unknown",
    "customer_action_required",
  ),
  "232": orderReason(
    "collection",
    "order_cancelled",
    "The payment failed",
    "unknown",
    "customer_action_required",
  ),
  "211": orderReason(
    "collection",
    "action_required",
    "Held for Inpay compliance review",
    RISK,
    "manual_review",
  ),
  "200": orderReason(
    "collection",
    "action_required",
    "Overfunded: the merchant must keep or refund the difference",
    "invalid_amount",
    "manual_review",
  ),
  "191": orderReason(
    "collection",
    "action_required_for_refund",
    "The refund is blocked because the virtual account lacks funds",
    "insufficient_funds",
    "manual_review",
  ),
  "229": orderReason("collection", "kyc", "Rejected by Inpay compliance", RISK, "do_not_retry"),
  "194": orderReason(
    "collection",
    "refund_requested",
    "Refund requested by the merchant",
    "unknown",
    "unknown",
    true,
  ),
  "170": orderReason(
    "collection",
    "refund_requested",
    "Refund by an Inpay admin for merchant or operational reasons",
    "unknown",
    "manual_review",
    true,
  ),
  "36": orderReason(
    "refund_cancelled",
    "kyc",
    "Refund rejected by compliance",
    RISK,
    "manual_review",
  ),
  "188": orderReason(
    "refund_cancelled",
    "kyc",
    "The transfer entity was not approved",
    RISK,
    "manual_review",
  ),
  "32": orderReason(
    "refund_cancelled",
    "beneficiary_bank_request",
    "The beneficiary bank cannot apply the funds",
    UNAVAILABLE_METHOD,
    "manual_review",
  ),
  "130": orderReason(
    "refund_cancelled",
    "invalid_data",
    "The beneficiary address is wrong or missing",
    INVALID,
    "customer_action_required",
  ),
  "35": orderReason(
    "refund_cancelled",
    "merchant_request",
    "Refund cancelled by the merchant",
    "unknown",
    "unknown",
    true,
  ),
  "21": orderReason("refund_cancelled", "test", "Test payment", "configuration", "do_not_retry"),
  validation_schema_failed_generic_key: orderReason(
    "refund_cancelled",
    "invalid_data",
    "Validation schema failed",
    INVALID,
    "do_not_retry",
  ),
};

/**
 * Literal `status_reasons` texts from Inpay's examples whose wording clearly
 * names one row of the reason table. Other documented texts ("TSTM Screening
 * failure", "Not enough funds", "Order processing halted, payment will be
 * refunded to the debtor", "Refund requested by customer") are shown as text
 * only, because no row matches them unambiguously.
 */
export const ORDER_REASON_HINTS: readonly { text: string; key: string }[] = [
  { text: "order cancelled by user", key: "98" },
  { text: "too much funds have been received", key: "200" },
];

// Errors

export type HttpRule = ErrorMapping & { docs: string };

/** The seven documented HTTP statuses (response-codes.md plus OpenAPI). */
export const HTTP_STATUSES: Record<string, HttpRule> = {
  "400": {
    meaning: "Invalid parameters",
    category: INVALID,
    retry: "do_not_retry",
    docs: RESPONSE_CODES_URL,
  },
  "401": {
    meaning:
      "The credentials were not accepted; without an error code the Authorization header was not a parsable JWT",
    category: "configuration",
    retry: "do_not_retry",
    docs: RESPONSE_CODES_URL,
  },
  "404": {
    meaning: "Resource not found",
    category: INVALID,
    retry: "do_not_retry",
    docs: PAYOUTS_OPENAPI_URL,
  },
  "412": {
    meaning: "A duplicate X-Request-ID, or missing X-Auth-Uuid / X-Request-ID headers",
    category: "duplicate_request",
    retry: "do_not_retry",
    docs: X_REQUEST_ID_URL,
  },
  "422": {
    meaning: "Business-logic error",
    category: INVALID,
    retry: "do_not_retry",
    docs: RESPONSE_CODES_URL,
  },
  "500": {
    meaning: "Execution stopped unexpectedly",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    docs: RESPONSE_CODES_URL,
  },
  "503": {
    meaning: "Infrastructure unavailable",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    docs: RESPONSE_CODES_URL,
  },
};

/** The five numeric API error codes found in the OpenAPI enums and examples. */
export const NUMERIC_ERRORS: Record<string, ErrorMapping & { title: string; docs: string }> = {
  "1001": {
    title: "Validation Error",
    meaning: "Validation error (payout reports)",
    category: INVALID,
    retry: "do_not_retry",
    docs: PAYOUTS_OPENAPI_URL,
  },
  "1002": {
    title: "Resource not found",
    meaning: "Resource not found (payout reports)",
    category: INVALID,
    retry: "do_not_retry",
    docs: PAYOUTS_OPENAPI_URL,
  },
  "2001": {
    title: "Resource not found",
    meaning: "Resource not found, for example an unknown country (wallet top-up methods)",
    category: INVALID,
    retry: "do_not_retry",
    docs: COLLECTION_OPENAPI_URL,
  },
  "2002": {
    title: "Validation Error",
    meaning: "Validation error, for example a missing country",
    category: INVALID,
    retry: "do_not_retry",
    docs: COLLECTION_OPENAPI_URL,
  },
  "15002": {
    title: "Validation Error",
    meaning: "Validation error on an FX parameter length",
    category: INVALID,
    retry: "do_not_retry",
    docs: FX_OPENAPI_URL,
  },
};

/**
 * The seven JWT authentication error codes. Inpay does not document which
 * response field carries them.
 */
export const JWT_ERRORS: Record<string, ErrorMapping & { retryNote?: string }> = {
  jwt_verification_error: {
    meaning: "The JWT signature does not verify against the stored public key",
    category: "configuration",
    retry: "do_not_retry",
  },
  jwt_claim_iat_missing: {
    meaning: "The JWT has no iat claim",
    category: "configuration",
    retry: "do_not_retry",
  },
  jwt_iat_not_a_timestamp: {
    meaning: "The iat claim is not numeric",
    category: "configuration",
    retry: "do_not_retry",
  },
  jwt_iat_too_old: {
    meaning: "The iat claim is older than 5 minutes",
    category: "authentication_failed",
    retry: "safe_to_retry_technical_request",
    retryNote:
      "The request was rejected before processing; send it again with a freshly signed token.",
  },
  jwt_iat_in_the_future: {
    meaning: "The iat claim is in the future (the client clock is ahead of the server)",
    category: "configuration",
    retry: "retry_conditionally",
    retryNote: "Synchronize the client clock before sending the request again.",
  },
  jwt_checksum_missing: {
    meaning: "The request has a body but the JWT has no checksum claim",
    category: "configuration",
    retry: "do_not_retry",
  },
  jwt_checksum_mismatch: {
    meaning: "The checksum claim differs from the SHA-256 of the body",
    category: "configuration",
    retry: "do_not_retry",
  },
};

/** Error titles used in Inpay's documented error bodies. */
export const ERROR_TITLES: Record<string, ErrorMapping> = {
  "validation error": { meaning: "Validation error", category: INVALID, retry: "do_not_retry" },
  "resource not found": { meaning: "Resource not found", category: INVALID, retry: "do_not_retry" },
  "not authorized": { meaning: "Not authorized", category: "configuration", retry: "do_not_retry" },
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs corrected details from the beneficiary, the payer or the merchant first.",
  retry_conditionally:
    "A later attempt may succeed, but first verify the current state: look the payout up by inpay_unique_reference or search it by end_to_end_id, or get the order by its uuid. Send a new request only when the first one is confirmed not to have taken effect.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry.",
  manual_review: "Review the transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Inpay processes no card payments; check which record this is.",
  authentication_required: "Check the request authentication with Inpay before sending it again.",
  authentication_failed: "Sign the request again with a fresh token and check the client clock.",
  invalid_request: "Correct the request or beneficiary data before sending a new request.",
  invalid_amount:
    "Check the amount received against the order and decide whether to keep or refund the difference.",
  insufficient_funds: "Fund the merchant's virtual account with Inpay.",
  payment_method_unavailable: "Use another bank account or payout product for the beneficiary.",
  fraud_or_risk: "Review the transaction and provide any information Inpay compliance requests.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Look the payout or order up before sending a new request, so a request that already took effect is not repeated.",
  network_or_timeout:
    "Look the payout or order up before sending a new request, so a request that already took effect is not repeated.",
  duplicate_request: "Check the status of the first request instead of sending it again.",
  configuration:
    "Check the integration settings (credentials, keys, headers, contracted products) with Inpay.",
  unknown:
    "Contact Inpay support with the inpay_unique_reference or order uuid if the cause is unclear.",
};
