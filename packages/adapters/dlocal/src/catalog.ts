/**
 * dLocal status, code and error knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/dlocal.md, which cites
 * dLocal's public documentation (docs.dlocal.com, verified 2026-10-25).
 *
 * dLocal reuses the same numbers with different meanings per object and per
 * API family: `status_code` 700 is a verified payment, a won chargeback and a
 * compliance hold on a payout; rejection codes 301-319 differ between payments
 * and payouts; HTTP error codes 3001, 4001 and 5007-5015 differ between the
 * Payins API and Payouts v3. Every table below belongs to one object type or
 * API family and is never used for another one.
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file; where dLocal gives advice (for example
 * "retry later" for 5052 or the Mastercard merchant advice codes), it is kept.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const D = "https://docs.dlocal.com/docs";
const R = "https://docs.dlocal.com/reference";

export const PAYMENT_STATUS_URL = `${R}/payment-status-codes`;
export const CREATE_PAYMENT_URL = `${R}/create-payment`;
export const RETRIEVE_PAYMENT_URL = `${R}/retrieve-a-payment`;
export const HTTP_ERRORS_PAYMENTS_URL = `${R}/http-errors-payments`;
export const HTTP_ERRORS_REFUNDS_URL = `${R}/http-errors-refunds`;
export const HTTP_ERRORS_CARDS_URL = `${R}/http-errors-cards`;
export const PAYINS_SECURITY_URL = `${R}/payins-security`;
export const REFUND_STATUS_URL = `${R}/refund-status-codes`;
export const REFUND_OBJECT_URL = `${R}/the-refund-object`;
export const REFUNDS_GUIDE_URL = `${D}/refunds`;
export const CHARGEBACK_STATUS_URL = `${R}/chargeback-status`;
export const CHARGEBACK_NOTIFICATION_URL = `${R}/chargeback-asynchronous-notification`;
export const CHARGEBACKS_GUIDE_URL = `${D}/chargebacks`;
export const CHARGEBACK_CATEGORIES_URL = `${D}/chargeback-categories`;
export const NOTIFICATIONS_URL = `${D}/receive-notifications`;
export const CALLBACK_URL_DOCS = `${D}/configure-callback-url`;
export const NETWORK_RESPONSE_URL = `${D}/network-response-data`;
export const THREE_DS_URL = `${D}/3d-secure`;
export const AUTH_CAPTURE_URL = `${D}/authorization-and-capture`;
export const CASH_PAYMENTS_URL = `${D}/cash-payments`;
export const BANK_TRANSFER_URL = `${D}/bank-transfer-payment`;
export const ARN_URL = `${D}/acquirer-reference-number`;
export const PAYOUT_STATUS_V3_URL = `${R}/payout-status-v3`;
export const PAYOUT_ERRORS_V3_URL = `${R}/error-codes-payouts-v3`;
export const PAYOUT_NOTIFICATION_V3_URL = `${R}/notification-parameters-payouts-v3`;
export const PAYOUT_FLOW_V3_URL = `${D}/flow-payouts-v3`;
export const PAYOUT_V2_NOTIFICATION_URL = `${R}/notification-parameters-payouts`;
export const PLATFORMS_NOTIFICATIONS_URL = `${R}/notifications-v2-platforms`;
export const COUNTRY_REFERENCE_URL = `${R}/country-reference`;

export type StatusInfo = {
  /** The `status_code` dLocal documents for this status. */
  code: string;
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
  final?: boolean;
  note?: string;
};

export type CodeEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** dLocal's own advice, when the documentation gives one. */
  providerAdvice?: string;
};

const c = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  providerAdvice?: string,
): CodeEntry =>
  providerAdvice ? { meaning, category, retry, providerAdvice } : { meaning, category, retry };

// ---------------------------------------------------------------------------
// Payins payment object (R/payment-status-codes)
// ---------------------------------------------------------------------------

/** Payment `status` values (6). */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    code: "100",
    meaning: "Payment created; the outcome is not known yet",
    stage: "payment",
    outcome: "pending",
  },
  PAID: {
    code: "200",
    meaning: "Payment completed and paid",
    stage: "payment",
    outcome: "success",
    final: true,
  },
  REJECTED: {
    code: "300",
    meaning: "Payment rejected; status_code carries the rejection reason",
    stage: "payment",
    outcome: "failure",
    final: true,
  },
  CANCELLED: {
    code: "400",
    meaning:
      "Payment cancelled (a pending local payment method or an authorization); no funds were collected",
    stage: "cancellation",
    outcome: "failure",
    final: true,
  },
  AUTHORIZED: {
    code: "600",
    meaning: "Card amount authorized and waiting for capture; not captured and not settled",
    stage: "authorization",
    outcome: "success",
  },
  VERIFIED: {
    code: "700",
    meaning: "Card verified with a zero-amount authorization; no money moved",
    stage: "authorization",
    outcome: "success",
    final: true,
  },
};

/** Payment pending sub-codes (`status` PENDING), 3 values. */
export const PAYMENT_PENDING_CODES: Record<string, CodeEntry & { stage: LifecycleStage }> = {
  "100": {
    ...c(
      "Pending without further detail (for example a voucher not paid yet or a transfer not received yet)",
      "unknown",
      "retry_conditionally",
    ),
    stage: "payment",
  },
  "101": {
    ...c(
      "Pending 3D Secure authentication; the payer must be sent to three_dsecure.redirect_url",
      "authentication_required",
      "customer_action_required",
    ),
    stage: "authentication",
  },
  "102": {
    ...c(
      "Pending and can be retried (retry.remaining_attempts and retry.last_attemptable_date, for example Pix Automatico)",
      "unknown",
      "retry_conditionally",
    ),
    stage: "payment",
  },
};

/** Payment rejection codes (`status` REJECTED), 39 values. */
export const PAYMENT_REJECTION_CODES: Record<string, CodeEntry> = {
  "300": c("Rejected without a specific reason", "card_declined", "retry_conditionally"),
  "301": c("Declined by the issuing bank", "card_declined", "retry_conditionally"),
  "302": c("Not enough funds", "insufficient_funds", "customer_action_required"),
  "303": c("Card is on a block list", "fraud_or_risk", "do_not_retry"),
  "304": c("Failed the risk score validation", "fraud_or_risk", "manual_review"),
  "305": c("Maximum number of attempts reached", "rate_limiting", "do_not_retry"),
  "306": c(
    "The issuer asks the payer to call the bank to authorize the payment",
    "card_declined",
    "customer_action_required",
  ),
  "307": c("Duplicate payment", "duplicate_request", "do_not_retry"),
  "308": c("Card disabled", "card_declined", "customer_action_required"),
  "309": c("Card expired", "card_declined", "customer_action_required"),
  "310": c("Card reported lost", "fraud_or_risk", "do_not_retry"),
  "311": c("The bank asks for the card to be retained", "fraud_or_risk", "do_not_retry"),
  "312": c("Card restricted by the bank", "card_declined", "customer_action_required"),
  "313": c("Card reported stolen", "fraud_or_risk", "do_not_retry"),
  "314": c("Card number invalid", "invalid_request", "customer_action_required"),
  "315": c("Security code (CVV) invalid", "invalid_request", "customer_action_required"),
  "316": c("Operation not supported", "payment_method_unavailable", "do_not_retry"),
  "317": c("Rejected as high risk", "fraud_or_risk", "do_not_retry"),
  "318": c("Transaction invalid", "invalid_request", "do_not_retry"),
  "319": c("Amount above an allowed limit", "invalid_amount", "customer_action_required"),
  "320": c(
    "3D Secure authentication is required",
    "authentication_required",
    "customer_action_required",
  ),
  "321": c("Error at the acquirer", "provider_unavailable", "retry_conditionally"),
  "322": c("Wallet disabled", "payment_method_unavailable", "customer_action_required"),
  "323": c("The payer's user account is invalid", "invalid_request", "customer_action_required"),
  "324": c("PIN invalid", "authentication_failed", "customer_action_required"),
  "325": c("Too many transactions in a period", "rate_limiting", "retry_conditionally"),
  "326": c(
    "The payer's user account is disabled or expired",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "327": c("Error in an external network", "network_or_timeout", "retry_conditionally"),
  "328": c("Payer token invalid", "invalid_request", "do_not_retry"),
  "329": c("Authorization expired", "invalid_request", "do_not_retry"),
  "330": c("Card not enrolled for 3D Secure", "authentication_failed", "customer_action_required"),
  "331": c("The payer cancelled the payment", "unknown", "customer_action_required"),
  "332": c("Wallet on hold", "payment_method_unavailable", "customer_action_required"),
  "340": c(
    "Payment expired (for example a voucher that was not paid in time)",
    "unknown",
    "customer_action_required",
  ),
  "341": c(
    "The payer did not complete the 3D Secure challenge",
    "authentication_failed",
    "customer_action_required",
  ),
  "342": c("Document (tax ID) invalid", "invalid_request", "customer_action_required"),
  "343": c(
    "payer.name does not match the bank's records",
    "invalid_request",
    "customer_action_required",
  ),
  "344": c("Payer limit exceeded", "invalid_amount", "customer_action_required"),
  "800": c("Payment creation failed", "provider_unavailable", "retry_conditionally"),
};

/** Payment method types (R/payment-method-object; guides also use WALLET). */
export const PAYMENT_METHOD_TYPES = new Set([
  "CARD",
  "BANK_TRANSFER",
  "DIRECT_DEBIT",
  "TICKET",
  "WALLET",
]);

export const PAYMENT_METHOD_FLOWS = new Set(["DIRECT", "REDIRECT"]);

/**
 * Pending reasons for local payment methods that settle later (D/cash-payments,
 * D/bank-transfer-payment, D/pix-payments). Pix is typed TICKET.
 */
export const SETTLES_LATER: Record<string, string> = {
  TICKET:
    "Cash voucher or Pix: the payment stays PENDING until the payer pays and dLocal is notified; an unpaid voucher expires (rejection 340)",
  BANK_TRANSFER:
    "Bank transfer: the payment stays PENDING until the payer completes the transfer and dLocal is notified; transfers can be instant or take a few days",
};

/** ARN notification `type` values (D/acquirer-reference-number). */
export const ARN_NOTIFICATION_TYPES = new Set(["PAYMENT", "REFUND", "CHARGEBACK"]);

/** Mastercard merchant advice codes (`acquirer.merchant_advice_code`, D/network-response-data), 11 values. */
export const MERCHANT_ADVICE_CODES: Record<string, CodeEntry & { type: string }> = {
  "01": {
    ...c(
      "Card details must be updated before retrying",
      "card_declined",
      "customer_action_required",
    ),
    type: "Soft",
  },
  "02": { ...c("Retry after a short delay", "card_declined", "retry_conditionally"), type: "Soft" },
  "03": { ...c("Do not retry", "card_declined", "do_not_retry"), type: "Hard" },
  "21": {
    ...c("The cardholder revoked the recurring authorization", "card_declined", "do_not_retry"),
    type: "Hard",
  },
  "24": {
    ...c("Retry after at least 1 hour", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "25": {
    ...c("Retry after at least 24 hours", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "26": {
    ...c("Retry after at least 2 days", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "27": {
    ...c("Retry after at least 4 days", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "28": {
    ...c("Retry after at least 6 days", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "29": {
    ...c("Retry after at least 8 days", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
  "30": {
    ...c("Retry after at least 10 days", "card_declined", "retry_conditionally"),
    type: "Timed",
  },
};

// ---------------------------------------------------------------------------
// Payins HTTP error envelope (R/http-errors-payments, -refunds, -cards)
// ---------------------------------------------------------------------------

export type PayinsPage = "payments" | "refunds" | "cards";

export type ApiErrorRow = CodeEntry & {
  code: string;
  /** Documented HTTP status (some Payouts v3 rows are documented with two). */
  http: readonly number[];
  family: "payins" | "payouts_v3";
  /** Payins pages that list this row. */
  pages?: readonly PayinsPage[];
  docsUrl: string;
};

const PAGE_URL: Record<PayinsPage, string> = {
  payments: HTTP_ERRORS_PAYMENTS_URL,
  refunds: HTTP_ERRORS_REFUNDS_URL,
  cards: HTTP_ERRORS_CARDS_URL,
};

function payins(code: string, http: number, pages: PayinsPage[], entry: CodeEntry): ApiErrorRow {
  return { code, http: [http], family: "payins", pages, docsUrl: PAGE_URL[pages[0]!], ...entry };
}

const P: PayinsPage[] = ["payments"];
const PR: PayinsPage[] = ["payments", "refunds"];
const PC: PayinsPage[] = ["payments", "cards"];
const PRC: PayinsPage[] = ["payments", "refunds", "cards"];
const RF: PayinsPage[] = ["refunds"];
const CA: PayinsPage[] = ["cards"];

/**
 * Payins HTTP error rows. A code whose meaning differs between pages (5011,
 * 5023, 5050) or between HTTP statuses (5010) has one row per meaning.
 */
export const PAYINS_ERROR_ROWS: readonly ApiErrorRow[] = [
  payins("3001", 403, PRC, c("Credentials invalid", "configuration", "do_not_retry")),
  payins("3002", 403, PRC, c("Calling IP address not registered", "configuration", "do_not_retry")),
  payins(
    "3003",
    403,
    PRC,
    c("Merchant not authorized to use this API", "configuration", "do_not_retry"),
  ),
  payins(
    "4000",
    404,
    PR,
    c(
      "Payment not found (refunds page: wrong payment_id or outside the retrievable range)",
      "invalid_request",
      "do_not_retry",
    ),
  ),
  payins("4001", 404, RF, c("Refund not found", "invalid_request", "do_not_retry")),
  payins("5000", 400, PRC, c("Request invalid", "invalid_request", "do_not_retry")),
  payins(
    "5001",
    400,
    PRC,
    c(
      "Parameter missing (payments) or invalid (refunds, saved cards); the parameter name is in the message",
      "invalid_request",
      "do_not_retry",
    ),
  ),
  payins(
    "5002",
    400,
    PR,
    c("Transaction status does not allow the operation", "invalid_request", "do_not_retry"),
  ),
  payins("5003", 400, PRC, c("Country not supported", "invalid_request", "do_not_retry")),
  payins(
    "5004",
    400,
    P,
    c("Currency not allowed for the country", "invalid_request", "do_not_retry"),
  ),
  payins(
    "5005",
    400,
    PC,
    c(
      "Payer not authorized because of the registration status of their document (tax ID)",
      "invalid_request",
      "customer_action_required",
    ),
  ),
  payins("5006", 400, P, c("Payer limit exceeded", "invalid_amount", "customer_action_required")),
  payins("5007", 400, PR, c("Amount exceeded", "invalid_amount", "do_not_retry")),
  payins("5008", 400, PC, c("Token not found or inactive", "invalid_request", "do_not_retry")),
  payins("5009", 400, P, c("order_id already used", "duplicate_request", "do_not_retry")),
  payins(
    "5010",
    400,
    P,
    c("Payment method not available", "payment_method_unavailable", "do_not_retry"),
  ),
  payins(
    "5010",
    504,
    PR,
    c(
      "Request timed out; the outcome of the original request is not known",
      "network_or_timeout",
      "retry_conditionally",
    ),
  ),
  payins("5011", 400, P, c("Enrollment not found", "invalid_request", "do_not_retry")),
  payins("5011", 400, RF, c("order_refund_id already used", "duplicate_request", "do_not_retry")),
  payins(
    "5012",
    400,
    RF,
    c("Insufficient funds for the refund", "insufficient_funds", "manual_review"),
  ),
  payins("5013", 400, PR, c("Operation not supported", "invalid_request", "do_not_retry")),
  payins("5014", 400, P, c("Payer on a block list", "fraud_or_risk", "do_not_retry")),
  payins(
    "5015",
    400,
    CA,
    c("Card rejected by the bank when saving it", "card_declined", "customer_action_required"),
  ),
  payins("5016", 400, PR, c("Amount too low", "invalid_amount", "do_not_retry")),
  payins("5017", 400, P, c("API version invalid", "configuration", "do_not_retry")),
  payins(
    "5018",
    400,
    PR,
    c("A chargeback exists for this transaction", "invalid_request", "manual_review"),
  ),
  payins("5020", 400, RF, c("The refund window has passed", "invalid_request", "do_not_retry")),
  payins(
    "5021",
    400,
    PR,
    c("The acquirer could not process the request", "provider_unavailable", "retry_conditionally"),
  ),
  payins(
    "5022",
    400,
    RF,
    c("order_refund_id longer than 100 characters", "invalid_request", "do_not_retry"),
  ),
  payins("5023", 400, P, c("Account invalid or not approved", "configuration", "do_not_retry")),
  payins("5023", 400, RF, c("Email in the order not supported", "invalid_request", "do_not_retry")),
  payins("5043", 400, P, c("Number of installments invalid", "invalid_request", "do_not_retry")),
  payins("5044", 400, P, c("Payment cancellation failed", "unknown", "manual_review")),
  payins("5045", 400, P, c("Enrollment not active", "invalid_request", "customer_action_required")),
  payins("5046", 400, P, c("External ID already used", "duplicate_request", "do_not_retry")),
  payins("5049", 400, P, c("Seller configuration invalid", "configuration", "do_not_retry")),
  payins("5050", 400, P, c("Cancellation period exceeded", "invalid_request", "do_not_retry")),
  payins("5050", 400, RF, c("A field is longer than allowed", "invalid_request", "do_not_retry")),
  payins(
    "5051",
    400,
    P,
    c("Account restrictions prevent processing", "configuration", "manual_review"),
  ),
  payins(
    "5052",
    400,
    P,
    c(
      "Another operation on this payment is in progress",
      "duplicate_request",
      "safe_to_retry_technical_request",
      "retry later",
    ),
  ),
  payins(
    "6000",
    429,
    PR,
    c("Too many requests", "rate_limiting", "safe_to_retry_technical_request"),
  ),
  payins(
    "7000",
    500,
    PR,
    c("The request could not be processed", "provider_unavailable", "retry_conditionally"),
  ),
];

// ---------------------------------------------------------------------------
// Payouts v3 (R/payout-status-v3, R/error-codes-payouts-v3)
// ---------------------------------------------------------------------------

function payout(code: string, http: number[], entry: CodeEntry): ApiErrorRow {
  return { code, http, family: "payouts_v3", docsUrl: PAYOUT_ERRORS_V3_URL, ...entry };
}

/** Payouts v3 HTTP error codes, 17 values. */
export const PAYOUT_V3_ERROR_ROWS: readonly ApiErrorRow[] = [
  payout(
    "3000",
    [400],
    c("Parameter invalid; name and reason in the message", "invalid_request", "do_not_retry"),
  ),
  payout(
    "3001",
    [400],
    c("Parameter empty; name in the message", "invalid_request", "do_not_retry"),
  ),
  payout("3003", [400], c("Bank code invalid", "invalid_request", "customer_action_required")),
  payout(
    "4001",
    [403],
    c("Credentials invalid (also for an expired bearer token)", "configuration", "do_not_retry"),
  ),
  payout("4002", [403], c("Calling IP address not registered", "configuration", "do_not_retry")),
  payout("5007", [400], c("Country not available for payouts", "configuration", "do_not_retry")),
  payout(
    "5008",
    [400],
    c("A limit was exceeded; the limit name is in the message", "invalid_amount", "manual_review"),
  ),
  payout("5009", [404], c("Payout not found", "invalid_request", "do_not_retry")),
  payout(
    "5010",
    [400],
    c(
      "The payout status does not allow the action (not pending or not on hold)",
      "invalid_request",
      "do_not_retry",
    ),
  ),
  payout("5011", [400], c("external_id already used", "duplicate_request", "do_not_retry")),
  payout("5012", [400], c("Rejected by compliance limits", "fraud_or_risk", "manual_review")),
  payout("5013", [400], c("Beneficiary on a block list", "fraud_or_risk", "do_not_retry")),
  // The table says 400; the example for this code sits under HTTP 403.
  payout("5014", [400, 403], c("Merchant balance too low", "insufficient_funds", "manual_review")),
  payout("5015", [400], c("Rejected for compliance reasons", "fraud_or_risk", "manual_review")),
  payout("7002", [400], c("The payout could not be cancelled", "unknown", "manual_review")),
  payout(
    "7003",
    [500],
    c("The request could not be processed", "provider_unavailable", "retry_conditionally"),
  ),
  payout(
    "7004",
    [400],
    c("The payout could not be released because of compliance", "fraud_or_risk", "manual_review"),
  ),
];

/** Payouts v3 `status` values (7). */
export const PAYOUT_V3_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    code: "100",
    meaning: "Payout received and waiting to be processed",
    stage: "payout",
    outcome: "pending",
  },
  PAID: {
    code: "200",
    meaning: "Payout paid",
    stage: "payout",
    outcome: "success",
    note: "dLocal documents that a payout can still be rejected after approval (rejection code 317), so a later REJECTED is possible",
  },
  REJECTED: {
    code: "300",
    meaning: "Payout rejected; after creation, status_code carries the rejection code",
    stage: "payout",
    outcome: "failure",
    final: true,
  },
  CANCELLED: {
    code: "400",
    meaning: "Payout cancelled by the merchant; nothing was paid",
    stage: "payout",
    outcome: "failure",
    final: true,
  },
  DELIVERED: {
    code: "500",
    meaning: "Payout sent on and being processed; not paid yet",
    stage: "payout",
    outcome: "pending",
  },
  ON_HOLD: {
    code: "600",
    meaning: "Payout held by the merchant; it can be released or cancelled",
    stage: "payout",
    outcome: "pending",
  },
  ON_HOLD_BY_COMPLIANCE: {
    code: "700",
    meaning: "Payout waiting for compliance checks; the merchant cannot release it",
    stage: "payout",
    outcome: "pending",
  },
};

/** Payouts v3 rejection codes (`status_code` after REJECTED), 21 values. */
export const PAYOUT_V3_REJECTION_CODES: Record<string, CodeEntry> = {
  "301": c("Beneficiary account closed", "invalid_request", "customer_action_required"),
  "302": c(
    "Amount wrong or not valid for the account",
    "invalid_amount",
    "customer_action_required",
  ),
  "303": c("Bank code invalid or not supported", "invalid_request", "customer_action_required"),
  "304": c("Bank branch wrong", "invalid_request", "customer_action_required"),
  "305": c("Beneficiary document invalid", "invalid_request", "customer_action_required"),
  "306": c("Beneficiary name wrong or mismatched", "invalid_request", "customer_action_required"),
  "307": c("Rejected by the beneficiary's bank", "payment_method_unavailable", "manual_review"),
  "308": c("Other or unspecified reason", "unknown", "manual_review"),
  "309": c("Account type wrong for the transaction", "invalid_request", "customer_action_required"),
  "310": c(
    "Account does not match the beneficiary document",
    "invalid_request",
    "customer_action_required",
  ),
  "311": c(
    "Account does not match the beneficiary name",
    "invalid_request",
    "customer_action_required",
  ),
  "312": c(
    "Account cannot receive transfers",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "313": c(
    "Beneficiary document does not match the name",
    "invalid_request",
    "customer_action_required",
  ),
  "314": c("Account is in another currency", "invalid_request", "customer_action_required"),
  "315": c("Rejected for compliance reasons", "fraud_or_risk", "manual_review"),
  "316": c(
    "Beneficiary not allowed to receive payouts (compliance)",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "317": c("Rejected after approval", "unknown", "manual_review"),
  "318": c("Wallet key missing", "invalid_request", "customer_action_required"),
  "319": c("Wallet key wrong", "invalid_request", "customer_action_required"),
  "320": c("Account number wrong", "invalid_request", "customer_action_required"),
  "332": c(
    "External payment network temporarily unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ),
};

// ---------------------------------------------------------------------------
// Refunds and chargebacks
// ---------------------------------------------------------------------------

/** Refund `status` values (R/refund-status-codes), 4 values. No rejection sub-codes are documented. */
export const REFUND_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    code: "100",
    meaning:
      "Refund not confirmed yet. Cash and bank transfer refunds are always PENDING on the synchronous response because they need a payout to the customer",
    stage: "refund",
    outcome: "pending",
  },
  SUCCESS: {
    code: "200",
    meaning: "Refund paid",
    stage: "refund",
    outcome: "success",
    final: true,
  },
  REJECTED: {
    code: "300",
    meaning: "Refund rejected; dLocal documents no rejection sub-codes for refunds",
    stage: "refund",
    outcome: "failure",
    final: true,
  },
  CANCELLED: {
    code: "400",
    meaning: "Refund cancelled; no refund was paid",
    stage: "refund",
    outcome: "failure",
    final: true,
  },
};

/**
 * Chargeback `status` values (R/chargeback-status), 7 values. Outcomes are
 * from the merchant's side: COMPLETED and DISPUTE_LOST debit the funds for
 * good, REVERSAL credits them back.
 */
export const CHARGEBACK_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    code: "100",
    meaning: "Chargeback received and not disputed yet",
    stage: "dispute",
    outcome: "pending",
  },
  DISPUTE_RECEIVED: {
    code: "101",
    meaning: "The merchant's dispute documents were received by dLocal",
    stage: "dispute",
    outcome: "pending",
  },
  COMPLETED: {
    code: "200",
    meaning: "Chargeback executed without a dispute; the funds are debited for good",
    stage: "dispute",
    outcome: "failure",
    final: true,
  },
  IN_DISPUTE: {
    code: "201",
    meaning: "Dispute documents sent on to the acquirer; funds debited temporarily",
    stage: "dispute",
    outcome: "pending",
  },
  DISPUTE_LOST: {
    code: "202",
    meaning: "Dispute decided for the cardholder",
    stage: "dispute",
    outcome: "failure",
    final: true,
  },
  REVERSAL: {
    code: "700",
    meaning: "Dispute decided for the merchant; the funds are credited back",
    stage: "dispute",
    outcome: "success",
    final: true,
  },
  INQUIRY: {
    code: "800",
    meaning: "The issuer asked for information; no funds moved yet",
    stage: "dispute",
    outcome: "pending",
  },
};

export type ReasonEntry = {
  network: string;
  /** dLocal's informational category; it is not returned in dispute responses. */
  group: string;
  code: string;
  meaning: string;
  fraudGroup: boolean;
};

function reasons(
  network: string,
  group: string,
  fraudGroup: boolean,
  rows: [string, string][],
): ReasonEntry[] {
  return rows.map(([code, meaning]) => ({ network, group, code, meaning, fraudGroup }));
}

const MX = "Mexico (domestic)";
const ELO = "Elo";

/**
 * Chargeback `reason_code` values (D/chargeback-categories), 107 distinct
 * codes per network. Several numbers repeat across networks (Mexico and Elo),
 * and the chargeback carries no card brand, so a code can have several readings.
 */
export const CHARGEBACK_REASON_CODES: readonly ReasonEntry[] = [
  ...reasons(MX, "Authorization issues", false, [
    ["71", "Declined authorization"],
    ["72", "Above the authorized amount"],
    ["75", "Authorization missing"],
  ]),
  ...reasons(MX, "Documentation and process errors", false, [
    ["60", "Wrong or unreadable document"],
    ["74", "Late submission"],
    ["79", "Promissory note missing"],
    ["84", "Signature missing"],
    ["92", "Irregular activity"],
    ["RT", "Promissory note requested"],
  ]),
  ...reasons(MX, "Fraud and unauthorized", true, [
    ["57", "Several unauthorized charges"],
    ["68", "Remote fraud"],
    ["70", "Card reported"],
  ]),
  ...reasons(MX, "Miscellaneous", false, [
    ["63", "Chip transaction"],
    ["76", "Toll charges"],
  ]),
  ...reasons(MX, "Refunds and cancellations", false, [
    ["41", "Cancelled recurring charge"],
    ["85", "Refund not processed"],
    ["94", "Reservation cancelled"],
  ]),
  ...reasons(MX, "Transaction and processing errors", false, [
    ["64", "Manual transaction"],
    ["80", "Processing error"],
    ["82", "Duplicate processing"],
    ["86", "Amount altered"],
  ]),
  ...reasons("Visa", "Fraud", true, [
    ["10.1", "EMV counterfeit liability shift"],
    ["10.2", "EMV non-counterfeit liability shift"],
    ["10.3", "Other fraud, card present"],
    ["10.4", "Other fraud, card absent"],
    ["10.5", "Visa fraud monitoring program"],
  ]),
  ...reasons("Visa", "Authorization", false, [
    ["11.1", "Card recovery bulletin"],
    ["11.2", "Declined authorization"],
    ["11.3", "No authorization"],
  ]),
  ...reasons("Visa", "Processing errors", false, [
    ["12.1", "Late presentment"],
    ["12.2", "Wrong transaction code"],
    ["12.3", "Wrong currency"],
    ["12.4", "Wrong account number"],
    ["12.5", "Wrong amount"],
    ["12.6.1", "Duplicate processing"],
    ["12.6.2", "Paid by other means"],
    ["12.7", "Invalid data"],
  ]),
  ...reasons("Visa", "Customer disputes", false, [
    ["13.1", "Merchandise or services not received"],
    ["13.2", "Cancelled recurring transaction"],
    ["13.3", "Not as described or defective"],
    ["13.4", "Counterfeit goods"],
    ["13.5", "Misrepresentation"],
    ["13.6", "Credit not processed"],
    ["13.7", "Cancelled goods or services"],
    ["13.8", "Original credit not accepted"],
    ["13.9", "Cash or load value not received"],
  ]),
  ...reasons("Mastercard", "Authorization-related", false, [
    [
      "4808",
      "Authorization-related (six listed variants, for example warning bulletin, required authorization missing, multiple authorization requests)",
    ],
  ]),
  // 4834 is listed under two dLocal categories.
  ...reasons("Mastercard", "Authorization-related; point of interaction error", false, [
    [
      "4834",
      "Cardholder-activated terminal or late presentment; or amount differs, currency conversion, duplicate or paid by other means, ATM",
    ],
  ]),
  ...reasons("Mastercard", "Loss, theft or damages", true, [
    ["4837", "No cardholder authorization (fraud)"],
    ["4849", "No cardholder authorization"],
    ["4870", "Questionable merchant activity"],
    ["4871", "Chip or chip and PIN liability shift"],
  ]),
  ...reasons("Mastercard", "Cardholder disputes", false, [
    [
      "4853",
      "Cardholder dispute (ten listed variants, for example recurring, not provided, not as described, credit not processed, digital goods of 25 USD or less)",
    ],
    ["4850", "Installment billing"],
    ["4854", "Not classified elsewhere (US)"],
  ]),
  ...reasons("Mastercard", "Legacy codes", false, [
    ["4807", "Warning bulletin"],
    ["4812", "Account number not on file"],
    ["4859", "No-show, addendum or ATM"],
    ["4860", "Credit not processed"],
  ]),
  ...reasons(ELO, "Not recognized", false, [["75", "Transaction not recognized"]]),
  ...reasons(ELO, "Card-absent fraud", true, [["83", "Card-absent fraud"]]),
  ...reasons(ELO, "Not received", false, [["30", "Merchandise or services not received"]]),
  ...reasons(ELO, "Recurring after cancellation", false, [["41", "Recurring after cancellation"]]),
  ...reasons(ELO, "Not as described", false, [["53", "Not as described"]]),
  ...reasons(ELO, "Late submission", false, [["74", "Late submission"]]),
  ...reasons(ELO, "Invalid account number", false, [["77", "Invalid account number"]]),
  ...reasons(ELO, "Terminal processing error", false, [["80", "Terminal processing error"]]),
  ...reasons(ELO, "Duplicate", false, [["82", "Duplicate processing"]]),
  ...reasons(ELO, "Credit not processed", false, [["85", "Credit not processed"]]),
  ...reasons("Verve", "Chargeback", false, [
    ["AA", "Transaction not recognized"],
    ["AP", "Recurring after cancellation"],
    ["AT", "Declined or missing authorization or expired card"],
    ["AW", "Altered amount or wrong cash dispensed"],
    ["DCC", "Pre-arbitration disputes"],
    ["IN", "Invalid card number"],
    ["LP", "Late submission"],
    ["NF", "ATM did not dispense"],
    ["PM", "Paid by other means"],
    ["RG", "Merchandise or services not received"],
    ["TM", "Automatic dispute for missing confirmation"],
  ]),
  ...reasons("Verve", "Chargeback", true, [
    ["UA01", "Card-present fraud"],
    ["UA02", "Card-not-present fraud"],
    ["UA05", "Counterfeit chip fraud"],
    ["UA06", "Stolen card chip fraud"],
  ]),
  ...reasons("American Express", "Authorization", false, [
    ["4521", "Invalid authorization"],
    ["4755", "No valid authorization"],
  ]),
  ...reasons("American Express", "Consumer disputes", false, [
    ["4513", "Credit not presented"],
    ["4515", "Paid by other means"],
    ["4544", "Cancelled recurring"],
    ["4553", "Not as described or defective"],
    ["4554", "Merchandise or services not received"],
    ["4750", "Car rental charge not qualified"],
  ]),
  ...reasons("American Express", "Fraud", true, [
    ["4527", "Missing imprint"],
    ["4534", "Multiple records of charge"],
    ["4540", "Card not present"],
    ["4763", "Full recourse"],
    ["4798", "Counterfeit liability shift"],
    ["4799", "Lost, stolen or non-received liability shift"],
  ]),
  ...reasons("American Express", "Processing errors", false, [
    ["4507", "Wrong amount or account number"],
    ["4512", "Multiple processing"],
    ["4523", "Unassigned account number"],
    ["4530", "Currency discrepancy"],
    ["4536", "Late presentment"],
    ["4752", "Credit or debit presentment error"],
  ]),
  ...reasons("American Express", "Inquiry or miscellaneous", false, [
    ["4516", "Support request not fulfilled"],
    ["4517", "Support request illegible or incomplete"],
    ["4754", "Local regulatory or legal dispute"],
  ]),
];

/** All readings of a reason code, one per network that lists it. */
export function reasonReadings(code: string): ReasonEntry[] {
  return CHARGEBACK_REASON_CODES.filter((r) => r.code === code);
}

// ---------------------------------------------------------------------------
// Families that are recognized but not analyzed
// ---------------------------------------------------------------------------

/** Browser callback POST `status` values (D/configure-callback-url), 4 values. Not final per dLocal. */
export const CALLBACK_STATUSES = new Set(["COMPLETED", "APPROVED", "REJECTED", "PENDING"]);

// ---------------------------------------------------------------------------
// Guidance text
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the payer or beneficiary to act first (for example use another card, complete authentication, pay a new voucher or correct their data).",
  retry_conditionally:
    "A later attempt may succeed, but first check the current state of the original operation (GET /payments/{payment_id} or GET /payouts/v3), so that a new request does not create a second payment or payout. Reuse the X-Idempotency-Key for Payins requests.",
  safe_to_retry_technical_request:
    "The request can be repeated as a technical retry, with the same X-Idempotency-Key.",
  manual_review:
    "Review the case manually (configuration, balance, dispute or compliance) before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the payer to contact their bank or use another payment method.",
  authentication_required: "Send the payer through 3D Secure authentication.",
  authentication_failed: "Ask the payer to authenticate again or use another payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, the currency and the payer's or merchant's limits.",
  insufficient_funds: "Ask the payer to use another payment method, or check the balance used.",
  payment_method_unavailable: "Offer another payment or payout method.",
  fraud_or_risk: "Review the risk or compliance outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable: "Check the current state of the operation before sending a new request.",
  network_or_timeout: "Check the current state of the operation before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the credentials, the allow-listed IP addresses and the account setup in the dLocal Merchant Dashboard.",
  unknown: "Contact dLocal support with the identifiers of the operation if the cause is unclear.",
};

/** Fallback by HTTP status when no documented code matched (generic HTTP semantics). */
export const HTTP_FALLBACK: Record<
  string,
  { meaning: string; category: ErrorCategory; retry: RetryGuidance }
> = {
  "400": { meaning: "Bad request", category: "invalid_request", retry: "do_not_retry" },
  "401": { meaning: "Unauthorized", category: "configuration", retry: "do_not_retry" },
  "403": { meaning: "Forbidden", category: "configuration", retry: "do_not_retry" },
  "404": { meaning: "Not found", category: "invalid_request", retry: "do_not_retry" },
  "429": {
    meaning: "Too many requests",
    category: "rate_limiting",
    retry: "safe_to_retry_technical_request",
  },
  "500": {
    meaning: "Server error",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "502": { meaning: "Bad gateway", category: "provider_unavailable", retry: "retry_conditionally" },
  "503": {
    meaning: "Service unavailable",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  "504": {
    meaning: "Gateway timeout",
    category: "network_or_timeout",
    retry: "retry_conditionally",
  },
};
