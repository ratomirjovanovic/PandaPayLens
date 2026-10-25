/**
 * Cybersource status, reason, code and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/cybersource.md, which cites
 * Cybersource's public developer documentation, the machine-readable response
 * code file and the official merged OpenAPI 2.0 specification, verified
 * 2026-10-25:
 *
 * REST status and reason values: response-codes page, responsecode.json, OpenAPI enums
 * Numeric reason codes:          Simple Order reason code page (also returned by Transaction Details)
 * AVS and CVN results:           AVS code reference, Secure Acceptance CVN table
 * Merchant advice codes:         OpenAPI field description of processorInformation.merchantAdvice.code
 * Payment insights categories:   Payments Developer Guide, "Declined Authorization"
 * Webhook event types:           Webhooks Implementation Guide (notification version 3)
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file; where Cybersource gives a recommended
 * action it is reflected. Cybersource warns that reason codes can be added at
 * any time, so every lookup has an unknown fallback.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const DEV = "https://developer.cybersource.com";
export const RESPONSE_CODES_URL = `${DEV}/api/reference/response-codes.md`;
export const RESPONSE_CODE_FILE_URL = `${DEV}/content/dam/cybsdeveloper2021/responsecode.json`;
export const PAYMENTS_GUIDE_URL = `${DEV}/docs/cybs/en-us/payments/developer/ctv/rest/payments.md`;
export const WEBHOOKS_URL = `${DEV}/docs/cybs/en-us/webhooks/implementation/all/rest/webhooks.md`;
export const REST_GETTING_STARTED_URL = `${DEV}/docs/cybs/en-us/platform/developer/all/rest/rest-getting-started.md`;
export const TXN_SEARCH_URL = `${DEV}/docs/cybs/en-us/txn-search/developer/all/rest/txn-search.md`;
export const REASON_CODES_URL = `${DEV}/docs/cybs/en-us/reason-codes-so/reference/all/so/reason-codes-so/reason-codes-so.md`;
export const AVS_CODES_URL = `${DEV}/docs/cybs/en-us/avs-codes/reference/all/na/avs-codes.md`;
export const CVN_CODES_URL = `${DEV}/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance/sa-cvn-codes.md`;
export const API_FIELDS_URL = `${DEV}/docs/cybs/en-us/api-fields/reference/all/rest/api-fields.md`;
export const RECURRING_URL = `${DEV}/docs/cybs/en-us/recurring-billing/developer/all/rest/recurring-billing-dev/recur-bill-addl-feat.md`;
export const PAY_BY_BANK_WEBHOOK_URL = `${DEV}/docs/cybs/en-us/pay-by-bank/developer/all/rest/pay-by-bank/paybybank-intro-services/paybybank-webhook-intro.md`;
export const PAY_BY_LINK_WEBHOOK_URL = `${DEV}/docs/cybs/en-us/paybylink/developer/all/rest/paybylink/paybylink-webhooks-intro.md`;
export const OPENAPI_URL =
  "https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-java/master/generator/cybersource-rest-spec.json";
export const MERCHANT_PAGE_URL =
  "https://www.cybersource.com/en-us/why-cybersource/merchant-payment-processing.html";
export const ORCHESTRATION_URL =
  "https://www.cybersource.com/en-us/why-cybersource/payments-orchestration.html";
export const HOME_URL = "https://www.cybersource.com/en-us.html";

// ---------------------------------------------------------------------------
// REST `status` values (20)
// ---------------------------------------------------------------------------

export type StatusEntry = {
  meaning: string;
  /** Outcome of the operation that returned this status. */
  outcome: Outcome;
  /** Where the value appears. */
  where: string;
  /** Only an enum value; Cybersource gives no description. */
  enumOnly?: true;
  /** Not a payment result; used by other services that share the vocabulary. */
  otherService?: true;
};

export const STATUSES: Record<string, StatusEntry> = {
  AUTHORIZED: {
    meaning:
      "Approved: an authorization, or a sale when the capture was requested in the same call",
    outcome: "success",
    where: "payment and credit HTTP 201",
  },
  PARTIAL_AUTHORIZED: {
    meaning: "Only part of the requested amount was approved",
    outcome: "success",
    where: "payment HTTP 201",
  },
  AUTHORIZED_PENDING_REVIEW: {
    meaning:
      "The issuer approved, but Cybersource or Decision Manager flagged the transaction for review (AVS, CVN, contact processor or review)",
    outcome: "pending",
    where: "payment HTTP 201",
  },
  AUTHORIZED_RISK_DECLINED: {
    meaning: "The issuer approved, but risk rules declined the transaction",
    outcome: "failure",
    where: "payment HTTP 201",
  },
  PENDING_AUTHENTICATION: {
    meaning: "Payer authentication (3-D Secure) is needed before authorization",
    outcome: "pending",
    where: "payment HTTP 201",
  },
  PENDING_REVIEW: {
    meaning: "The order is under review",
    outcome: "pending",
    where: "payment HTTP 201 (enum only)",
    enumOnly: true,
  },
  DECLINED: {
    meaning: "Declined; the reason is in errorInformation.reason",
    outcome: "failure",
    where: "payment, refund, credit and payout HTTP 201",
  },
  INVALID_REQUEST: {
    meaning: "Something is wrong or missing in the request, or the merchant configuration",
    outcome: "failure",
    where: "HTTP 400, and HTTP 201 with INVALID_MERCHANT_CONFIGURATION",
  },
  SERVER_ERROR: {
    meaning: "System error or timeout; the outcome of the operation may be unknown",
    outcome: "unknown",
    where: "HTTP 502, and HTTP 201 with PROCESSOR_TIMEOUT",
  },
  PENDING: {
    meaning: "Accepted and waiting for batch submission to the processor",
    outcome: "pending",
    where: "capture, refund and credit HTTP 201",
  },
  REVERSED: {
    meaning: "The authorization was reversed",
    outcome: "success",
    where: "reversal HTTP 201",
  },
  VOIDED: {
    meaning: "The capture, credit, refund or sale was voided",
    outcome: "success",
    where: "void HTTP 201",
  },
  CANCELLED: {
    meaning: "Void response status without a documented meaning",
    outcome: "unknown",
    where: "void HTTP 201 (enum only)",
    enumOnly: true,
  },
  FAILED: {
    meaning: "Void response status without a documented meaning beyond its name",
    outcome: "failure",
    where: "void HTTP 201 (enum only)",
    enumOnly: true,
  },
  ACCEPTED: {
    meaning: "Accepted (payouts, Decision Manager case management)",
    outcome: "success",
    where: "payout and Decision Manager HTTP 201",
  },
  REJECTED: {
    meaning: "Rejected by Decision Manager",
    outcome: "failure",
    where: "Decision Manager",
    otherService: true,
  },
  CHALLENGE: {
    meaning: "Decision Manager asks for a challenge",
    outcome: "pending",
    where: "Decision Manager",
    otherService: true,
  },
  AUTHENTICATION_SUCCESSFUL: {
    meaning: "Payer authentication succeeded",
    outcome: "success",
    where: "payer authentication enrollment and validation",
    otherService: true,
  },
  AUTHENTICATION_FAILED: {
    meaning: "Payer authentication failed",
    outcome: "failure",
    where: "payer authentication enrollment and validation",
    otherService: true,
  },
  COMPLETED: {
    meaning: "Completed (list management, fraud marking, address verification, export compliance)",
    outcome: "success",
    where: "other services",
    otherService: true,
  },
};

// ---------------------------------------------------------------------------
// REST `reason` values (77)
// ---------------------------------------------------------------------------

export type ReasonEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** j = responsecode.json, s = OpenAPI enum. */
  source: "j" | "s" | "js";
  /** HTTP status and status the response code file pairs the reason with. */
  documentedWith?: string;
  /** Confidence of the decoding; strong unless the documentation is thin or inconsistent. */
  confidence: Confidence;
  /** The operation may have taken effect; the final state has to be checked first. */
  outcomeUnknown?: true;
  /** Recommended action given by Cybersource itself. */
  action?: string;
  note?: string;
};

type ReasonExtra = Partial<Pick<ReasonEntry, "outcomeUnknown" | "action" | "note" | "confidence">>;

const r = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  source: ReasonEntry["source"],
  documentedWith: string | undefined,
  extra: ReasonExtra = {},
): ReasonEntry => ({
  meaning,
  category,
  retry,
  source,
  ...(documentedWith ? { documentedWith } : {}),
  confidence: source === "s" ? "possible" : "strong",
  ...extra,
});

/** Payment and follow-on service reasons (63). */
export const PAYMENT_REASONS: Record<string, ReasonEntry> = {
  AVS_FAILED: r(
    "The issuer approved, but Cybersource flagged the address verification (AVS) result",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 AUTHORIZED_PENDING_REVIEW",
    { action: "Capture is possible after a fraud review." },
  ),
  CONTACT_PROCESSOR: r(
    "The issuer has questions about the request",
    "card_declined",
    "manual_review",
    "js",
    "201 AUTHORIZED_PENDING_REVIEW",
    { action: "A voice authorization may be obtained by calling the processor." },
  ),
  EXPIRED_CARD: r(
    "The card is expired, or the expiration date does not match the issuer's records",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  PROCESSOR_DECLINED: r(
    "General decline by the issuer, with no further detail",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  PROCESSOR_ERROR: r(
    "Declined: the response code file describes it as unauthorized or pick up card and asks for a manual review",
    "card_declined",
    "manual_review",
    "js",
    "201 DECLINED",
    {
      confidence: "possible",
      note: "The meaning is inconsistent in the documentation: the response code file says pick up card, while the payments guide's decline example pairs it with the message Invalid account.",
    },
  ),
  INSUFFICIENT_FUND: r(
    "The account does not have enough funds",
    "insufficient_funds",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  STOLEN_LOST_CARD: r(
    "The card was reported lost or stolen",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 DECLINED",
    { action: "Cybersource asks for a manual review." },
  ),
  ISSUER_UNAVAILABLE: r(
    "The issuer could not be reached",
    "provider_unavailable",
    "retry_conditionally",
    "js",
    "201 DECLINED",
    { action: "Cybersource advises waiting a few minutes and resending the request." },
  ),
  UNAUTHORIZED_CARD: r(
    "The card is inactive or not allowed for card-not-present transactions",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  CVN_NOT_MATCH: r(
    "The card security code did not match",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  EXCEEDS_CREDIT_LIMIT: r(
    "The credit limit for the card has been reached",
    "insufficient_funds",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  INVALID_CVN: r(
    "The card security code is invalid",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  BLOCKED_BY_CARDHOLDER: r(
    "Enum value only; the reading as a cardholder block is based on the name",
    "card_declined",
    "do_not_retry",
    "s",
    undefined,
  ),
  DECLINED_CHECK: r(
    "Generic decline of an electronic check payment",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  BLACKLISTED_CUSTOMER: r(
    "The electronic check customer matched the processor's negative file",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 DECLINED",
  ),
  SUSPENDED_ACCOUNT: r(
    "The electronic check account is frozen",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  PAYMENT_REFUSED: r(
    "Refused for one of several causes: account not set up, insufficient funds, action not permitted (for example already captured), or seller fraud settings",
    "unknown",
    "customer_action_required",
    "js",
    "201 DECLINED",
    { confidence: "possible" },
  ),
  CV_FAILED: r(
    "The issuer approved, but Cybersource flagged the card verification (CVN) result",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 AUTHORIZED_PENDING_REVIEW",
    { action: "Capture is possible after a review." },
  ),
  INVALID_ACCOUNT: r(
    "The account number is invalid",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  GENERAL_DECLINE: r(
    "General decline by the processor",
    "card_declined",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  INVALID_MERCHANT_CONFIGURATION: r(
    "There is a problem with the merchant configuration",
    "configuration",
    "do_not_retry",
    "js",
    "201 INVALID_REQUEST",
    { action: "Do not resend the request; contact Cybersource support." },
  ),
  BOLETO_DECLINED: r(
    "The processor declined the boleto request",
    "card_declined",
    "customer_action_required",
    "j",
    "201 DECLINED",
  ),
  PROCESSOR_TIMEOUT: r(
    "The request timed out at the processor",
    "network_or_timeout",
    "retry_conditionally",
    "j",
    "201 SERVER_ERROR (also 400 for credits and 502 for voids)",
    {
      outcomeUnknown: true,
      action: "Do not resend the request until the transaction status has been checked.",
    },
  ),
  DEBIT_CARD_USAGE_LIMIT_EXCEEDED: r(
    "The PINless debit card's use frequency or per-use amount limit was exceeded",
    "card_declined",
    "customer_action_required",
    "j",
    "201 DECLINED",
  ),
  SCORE_EXCEEDS_THRESHOLD: r(
    "The fraud score is above the merchant's threshold (soft decline)",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 AUTHORIZED_RISK_DECLINED",
  ),
  CONSUMER_AUTHENTICATION_REQUIRED: r(
    "The cardholder is enrolled in payer authentication and must authenticate first",
    "authentication_required",
    "customer_action_required",
    "js",
    "201 PENDING_AUTHENTICATION",
  ),
  CONSUMER_AUTHENTICATION_FAILED: r(
    "Payer authentication failed",
    "authentication_failed",
    "customer_action_required",
    "js",
    "201 DECLINED",
  ),
  DECISION_PROFILE_REVIEW: r(
    "Decision Manager marked the order for review",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 AUTHORIZED_PENDING_REVIEW",
  ),
  DECISION_PROFILE_REJECT: r(
    "Decision Manager rejected the order",
    "fraud_or_risk",
    "manual_review",
    "js",
    "201 AUTHORIZED_RISK_DECLINED",
  ),
  PENDING_AUTHENTICATION: r(
    "Enum value only (the same word as a status); payer authentication is pending",
    "authentication_required",
    "customer_action_required",
    "s",
    undefined,
  ),
  ACH_VERIFICATION_FAILED: r(
    "Enum value only; read as a failed bank account verification",
    "card_declined",
    "customer_action_required",
    "s",
    undefined,
  ),
  ALLOWABLE_PIN_RETRIES_EXCEEDED: r(
    "Enum value only; read as the PIN retry limit being reached",
    "authentication_failed",
    "do_not_retry",
    "s",
    undefined,
  ),
  CUSTOMER_WATCHLIST_MATCH: r(
    "The customer is on a government restricted-party list",
    "fraud_or_risk",
    "do_not_retry",
    "js",
    "201 DECLINED (export compliance)",
    { action: "Reject the order." },
  ),
  ADDRESS_COUNTRY_WATCHLIST_MATCH: r(
    "The billing or shipping country is embargoed or not in the merchant's export list",
    "fraud_or_risk",
    "do_not_retry",
    "js",
    "201 DECLINED (export compliance)",
  ),
  EMAIL_COUNTRY_WATCHLIST_MATCH: r(
    "The country associated with the email address is embargoed",
    "fraud_or_risk",
    "do_not_retry",
    "js",
    "201 DECLINED (export compliance)",
  ),
  IP_COUNTRY_WATCHLIST_MATCH: r(
    "The country associated with the IP address is embargoed",
    "fraud_or_risk",
    "do_not_retry",
    "js",
    "201 DECLINED (export compliance)",
  ),
  DAGGREJECTED: r(
    "Enum value only; meaning not documented",
    "unknown",
    "manual_review",
    "s",
    undefined,
    {
      confidence: "insufficient",
    },
  ),
  DAGGDENIED: r(
    "Enum value only; meaning not documented",
    "unknown",
    "manual_review",
    "s",
    undefined,
    {
      confidence: "insufficient",
    },
  ),
  DSYSREJECTED: r(
    "Enum value only; meaning not documented",
    "unknown",
    "manual_review",
    "s",
    undefined,
    { confidence: "insufficient" },
  ),
  RISK_CONTROL_DECLINE: r(
    "Payout enum value; read as a decline by risk controls",
    "fraud_or_risk",
    "manual_review",
    "s",
    "payout 201 (enum)",
  ),
  PROCESSOR_RISK_CONTROL_DECLINE: r(
    "Payout enum value; read as a decline by the processor's risk controls",
    "fraud_or_risk",
    "manual_review",
    "s",
    "payout 201 (enum)",
  ),
  MISSING_FIELD: r(
    "A required field is missing; the fields are listed in details[]",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
  ),
  INVALID_DATA: r(
    "A field value is invalid; the fields are listed in details[]",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
  ),
  DUPLICATE_REQUEST: r(
    "The merchant reference code was used by another authorization in the last 15 minutes, or the merchant transaction identifier was already used",
    "duplicate_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
    { action: "Check the status of the original request before any new attempt." },
  ),
  INVALID_CARD: r(
    "The account number is invalid",
    "invalid_request",
    "customer_action_required",
    "js",
    "400 INVALID_REQUEST (refund, credit)",
  ),
  CARD_TYPE_NOT_ACCEPTED: r(
    "The processor does not accept this card type for the merchant",
    "payment_method_unavailable",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
  ),
  PROCESSOR_UNAVAILABLE: r(
    "Processor failure",
    "provider_unavailable",
    "retry_conditionally",
    "js",
    "400 INVALID_REQUEST",
    { action: "Cybersource advises waiting a few minutes and resending the request." },
  ),
  INVALID_AMOUNT: r(
    "The amount must match the previous transaction amount",
    "invalid_amount",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
  ),
  INVALID_CARD_TYPE: r(
    "The card type is invalid or does not match the card number",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST",
  ),
  INVALID_PAYMENT_ID: r(
    "The referenced request ID is not valid for follow-on transactions",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture, reversal)",
  ),
  NOT_SUPPORTED: r(
    "Enum value only; read as an operation the account or processor does not support",
    "configuration",
    "do_not_retry",
    "s",
    "400 (enum)",
  ),
  EXCEEDS_AUTH_AMOUNT: r(
    "The capture amount is above the authorized amount",
    "invalid_amount",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture)",
  ),
  AUTH_ALREADY_REVERSED: r(
    "The authorization was already reversed",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture, reversal)",
    { note: "On a retried reversal this means the first reversal succeeded." },
  ),
  TRANSACTION_ALREADY_SETTLED: r(
    "The transaction was already settled",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture, reversal)",
  ),
  MISSING_AUTH: r(
    "There is no unused authorization to capture or reverse",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture, reversal)",
  ),
  TRANSACTION_ALREADY_REVERSED_OR_SETTLED: r(
    "The transaction was already settled or reversed",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (capture, reversal)",
  ),
  CAPTURE_ALREADY_VOIDED: r(
    "A credit was requested for a capture that was voided",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (refund, credit)",
  ),
  ACCOUNT_NOT_ALLOWED_CREDIT: r(
    "Stand-alone credits are not allowed for the account; use a follow-on credit",
    "configuration",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (refund, credit)",
  ),
  NOT_VOIDABLE: r(
    "The transaction was already sent to the processor, or this transaction type cannot be voided",
    "invalid_request",
    "do_not_retry",
    "js",
    "400 INVALID_REQUEST (void)",
  ),
  SYSTEM_ERROR: r(
    "General system failure",
    "provider_unavailable",
    "retry_conditionally",
    "js",
    "502 SERVER_ERROR",
    { outcomeUnknown: true },
  ),
  SERVER_TIMEOUT: r(
    "The request timed out on the server side; the processor may have approved it",
    "network_or_timeout",
    "retry_conditionally",
    "js",
    "502 SERVER_ERROR",
    {
      outcomeUnknown: true,
      action:
        "Check the transaction status before resending. Cybersource may send an automatic reversal after a processor timeout.",
    },
  ),
  SERVICE_TIMEOUT: r(
    "An internal service (Decision Manager, Token Management or payer authentication) timed out",
    "network_or_timeout",
    "retry_conditionally",
    "js",
    "502 SERVER_ERROR",
    {
      outcomeUnknown: true,
      action:
        "The payments guide rates the duplicate risk as low and suggests a retry after about 30 seconds; check the status first.",
    },
  ),
  INVALID_OR_MISSING_CONFIG: r(
    "The merchant configuration is invalid or missing",
    "configuration",
    "do_not_retry",
    "j",
    "502 SERVER_ERROR",
    { action: "Do not resend the request." },
  ),
};

/** Address verification, payer authentication and Decision Manager reasons (14). */
export const OTHER_SERVICE_REASONS: Record<string, ReasonEntry> = Object.fromEntries([
  ...(
    [
      ["APARTMENT_NUMBER_NOT_FOUND", "The apartment number is missing or not found"],
      ["INSUFFICIENT_ADDRESS_INFORMATION", "The address information is insufficient"],
      ["HOUSE_OR_BOX_NUMBER_NOT_FOUND", "The house or box number was not found on the street"],
      ["MULTIPLE_ADDRESS_MATCHES", "Several addresses match"],
      ["BOX_NUMBER_NOT_FOUND", "The box number was not found"],
      ["ROUTE_SERVICE_NOT_FOUND", "The route service identifier was not found"],
      ["STREET_NAME_NOT_FOUND", "The street name was not found in the postal code"],
      ["POSTAL_CODE_NOT_FOUND", "The postal code was not found"],
      ["UNVERIFIABLE_ADDRESS", "The address cannot be verified or corrected"],
      ["MULTIPLE_ADDRESS_MATCHES_INTERNATIONAL", "Several international addresses match"],
      ["ADDRESS_MATCH_NOT_FOUND", "No address match was found"],
      ["UNSUPPORTED_CHARACTER_SET", "The address uses an unsupported character set"],
    ] as const
  ).map(
    ([code, meaning]) =>
      [
        code,
        r(meaning, "invalid_request", "customer_action_required", "j", "address verification", {
          action: "Ask the customer to verify the address.",
        }),
      ] as const,
  ),
  [
    "AUTHENTICATION_FAILED",
    r(
      "Payer authentication failed, or a Decision Manager case reports a failed authentication",
      "authentication_failed",
      "customer_action_required",
      "j",
      "payer authentication, Decision Manager",
    ),
  ],
  [
    "DECISION_PROFILE_CHALLENGE",
    r(
      "Decision Manager or Account Takeover Protection asks for a challenge",
      "fraud_or_risk",
      "manual_review",
      "j",
      "Decision Manager",
    ),
  ],
]);

export const REASONS: Record<string, ReasonEntry> = {
  ...PAYMENT_REASONS,
  ...OTHER_SERVICE_REASONS,
};

/** `errorInformation.details[].reason` and `details[].reason` values. */
export const DETAIL_REASONS: ReadonlySet<string> = new Set(["MISSING_FIELD", "INVALID_DATA"]);

// ---------------------------------------------------------------------------
// Numeric reason codes (89), returned by Transaction Details
// ---------------------------------------------------------------------------

export type NumericCodeEntry = {
  meaning: string;
  kind: "success" | "partial" | "error";
  category: ErrorCategory;
  retry: RetryGuidance;
  /** The operation may have taken effect; the final state has to be checked first. */
  outcomeUnknown?: true;
};

const ok = (meaning: string, kind: "success" | "partial" = "success"): NumericCodeEntry => ({
  meaning,
  kind,
  category: "unknown",
  retry: "unknown",
});
const n = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  outcomeUnknown?: true,
): NumericCodeEntry => ({
  meaning,
  kind: "error",
  category,
  retry,
  ...(outcomeUnknown ? { outcomeUnknown } : {}),
});
const addr = (meaning: string, retry: RetryGuidance = "customer_action_required") =>
  n(meaning, "invalid_request", retry);

export const NUMERIC_REASON_CODES: Record<string, NumericCodeEntry> = {
  "100": ok("Success"),
  "101": n("Required fields are missing", "invalid_request", "do_not_retry"),
  "102": n("Invalid field data", "invalid_request", "do_not_retry"),
  "104": n(
    "Duplicate merchant reference code within 15 minutes",
    "duplicate_request",
    "do_not_retry",
  ),
  "105": n(
    "The merchant transaction identifier was already used in the past 60 days",
    "duplicate_request",
    "do_not_retry",
  ),
  "110": ok("Partial amount approved", "partial"),
  "150": n(
    "System error; may also be a processor rejection of invalid data",
    "provider_unavailable",
    "retry_conditionally",
    true,
  ),
  "151": n(
    "Server timeout; check the status before resending",
    "network_or_timeout",
    "retry_conditionally",
    true,
  ),
  "152": n(
    "A service did not finish in time; check the status before resending",
    "network_or_timeout",
    "retry_conditionally",
    true,
  ),
  "153": n(
    "The account is not enabled for original credit transactions (payouts)",
    "configuration",
    "do_not_retry",
  ),
  "154": n(
    "The payout failed MAC validation and was not sent; Cybersource says it is safe to retry",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ),
  "200": n(
    "The issuer approved, but the transaction was declined for AVS; capture is possible after review",
    "fraud_or_risk",
    "manual_review",
  ),
  "201": n(
    "The issuer has questions; a voice authorization is possible",
    "card_declined",
    "manual_review",
  ),
  "202": n("Expired card or expiration date mismatch", "card_declined", "customer_action_required"),
  "203": n("General decline with no detail", "card_declined", "customer_action_required"),
  "204": n("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "205": n("Lost or stolen card", "fraud_or_risk", "manual_review"),
  "207": n(
    "The issuer is unavailable; resend after a few minutes",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "208": n(
    "The card is inactive or not allowed for card-not-present use; for card-present, the PIN is missing or wrong",
    "card_declined",
    "customer_action_required",
  ),
  "209": n("The card security code did not match", "card_declined", "customer_action_required"),
  "210": n(
    "The credit limit is reached or the amount is above the approved limit",
    "insufficient_funds",
    "customer_action_required",
  ),
  "211": n("Invalid card security code", "card_declined", "customer_action_required"),
  "212": n(
    "EMV transaction rejected; resubmit with chip and PIN",
    "card_declined",
    "customer_action_required",
  ),
  "213": n("The account is in fraud watch status", "fraud_or_risk", "do_not_retry"),
  "216": n(
    "Some card data is invalid (security code, expiration, number or name)",
    "card_declined",
    "customer_action_required",
  ),
  "220": n("Generic decline", "card_declined", "customer_action_required"),
  "221": n("The customer account is frozen", "card_declined", "customer_action_required"),
  "222": n("The customer matched the processor's negative file", "fraud_or_risk", "manual_review"),
  "230": n(
    "The issuer approved, but the transaction was declined for the CVN result; capture is possible after review",
    "fraud_or_risk",
    "manual_review",
  ),
  "231": n("Invalid account number", "card_declined", "customer_action_required"),
  "232": n(
    "The processor does not accept the card type",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "233": n("The processor declined the card", "card_declined", "customer_action_required"),
  "234": n("The merchant account information is incorrect", "configuration", "do_not_retry"),
  "235": n(
    "The capture is above the authorized amount (PIN debit: above the approved limit)",
    "invalid_amount",
    "do_not_retry",
  ),
  "236": n(
    "Processor failure; resend after a few minutes",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "237": n("Already captured", "invalid_request", "do_not_retry"),
  "238": n("Already reversed", "invalid_request", "do_not_retry"),
  "239": n("The amount does not match the previous transaction", "invalid_amount", "do_not_retry"),
  "240": n(
    "The card type is invalid or does not match the number",
    "invalid_request",
    "do_not_retry",
  ),
  "241": n(
    "PIN debit: the processor declined; other methods: invalid request ID",
    "invalid_request",
    "do_not_retry",
  ),
  "242": n(
    "No unused authorization for the capture or reversal",
    "invalid_request",
    "do_not_retry",
  ),
  "243": n("Already settled or reversed", "invalid_request", "do_not_retry"),
  "244": n(
    "The account number failed a verification check",
    "card_declined",
    "customer_action_required",
  ),
  "246": n(
    "Not voidable (already sent to the processor, or the type cannot be voided)",
    "invalid_request",
    "do_not_retry",
  ),
  "247": n("A credit was requested for a voided capture", "invalid_request", "do_not_retry"),
  "248": n("The processor declined the boleto", "card_declined", "customer_action_required"),
  "250": n(
    "Timeout at the processor; check the status before resending",
    "network_or_timeout",
    "retry_conditionally",
    true,
  ),
  "251": n(
    "The debit card's frequency, PIN tries or daily amount limit was exceeded",
    "card_declined",
    "customer_action_required",
  ),
  "254": n("Stand-alone credits are not allowed", "configuration", "do_not_retry"),
  "256": n("The credit amount is above the account maximum", "invalid_amount", "do_not_retry"),
  "257": n("The gift or prepaid card is already active", "invalid_request", "do_not_retry"),
  "259": n("The gift or prepaid card reload limit was exceeded", "invalid_amount", "do_not_retry"),
  "260": n(
    "The amount is outside the gift or prepaid card limits",
    "invalid_amount",
    "do_not_retry",
  ),
  "261": n(
    "The merchant set-up is invalid or missing at the acquirer gateway",
    "configuration",
    "do_not_retry",
  ),
  "262": n(
    "The request is still in progress; wait for a response",
    "network_or_timeout",
    "retry_conditionally",
    true,
  ),
  "263": n(
    "Mass transit transaction declined; a capture may still be allowed under transit rules",
    "card_declined",
    "manual_review",
  ),
  "264": n("The processor is missing a field", "invalid_request", "do_not_retry"),
  "268": n(
    "Barclays: unable to confirm; do not reprocess, contact Barclays",
    "unknown",
    "manual_review",
  ),
  "400": n("The fraud score is above the threshold", "fraud_or_risk", "manual_review"),
  "403": n(
    "Communication error (HTTP errors or wrong or outdated API keys)",
    "configuration",
    "do_not_retry",
  ),
  "428": n(
    "The SCA exemption was declined; strong customer authentication is required",
    "authentication_required",
    "customer_action_required",
  ),
  "450": addr("The apartment number is missing or not found"),
  "451": addr("Insufficient address information"),
  "452": addr("The house or box number was not found on the street"),
  "453": addr("Several addresses match"),
  "454": addr("The P.O. box was not found or is out of range"),
  "455": addr("The route service identifier was not found or is out of range"),
  "456": addr("The street name was not found in the postal code"),
  "457": addr("The postal code was not found"),
  "458": addr("The address cannot be verified or corrected"),
  "459": addr("Several international addresses match"),
  "460": addr("No address match, no reason given"),
  "461": addr("Unsupported character set", "do_not_retry"),
  "465": n(
    "Payer authentication problem; the payer was not authenticated",
    "authentication_failed",
    "customer_action_required",
  ),
  "474": n("PIN data is required", "authentication_required", "customer_action_required"),
  "475": n(
    "The cardholder is enrolled in payer authentication and must authenticate first",
    "authentication_required",
    "customer_action_required",
  ),
  "476": n(
    "Payer authentication problem; the payer was not authenticated",
    "authentication_failed",
    "customer_action_required",
  ),
  "478": n(
    "Strong customer authentication is required",
    "authentication_required",
    "customer_action_required",
  ),
  "480": n(
    "Decision Manager review; rejected automatically after 30 days without action",
    "fraud_or_risk",
    "manual_review",
  ),
  "481": n("Decision Manager rejected the order", "fraud_or_risk", "manual_review"),
  "490": n(
    "The aggregator or acquirer is not accepting transactions or the requested service",
    "configuration",
    "manual_review",
  ),
  "491": n(
    "The aggregator or acquirer refused on limits or rules (velocity, card, BIN, cross-border and similar)",
    "fraud_or_risk",
    "manual_review",
  ),
  "493": n("Acquirer or aggregator rejection: safeguards", "fraud_or_risk", "manual_review"),
  "494": n("Internal safeguards prevent processing", "fraud_or_risk", "manual_review"),
  "520": n(
    "The issuer approved, but Smart Authorization settings declined the transaction",
    "fraud_or_risk",
    "manual_review",
  ),
  "700": n("The customer matched the Denied Parties List", "fraud_or_risk", "do_not_retry"),
  "701": n("Export billing or shipping country match", "fraud_or_risk", "do_not_retry"),
  "702": n("Export email country match", "fraud_or_risk", "do_not_retry"),
  "703": n("Export hostname or IP country match", "fraud_or_risk", "do_not_retry"),
};

/**
 * Codes cited by the REST timeout guidance but missing from the reason code
 * table. Decoded with possible confidence only.
 */
export const CITED_NUMERIC_CODES: Record<string, NumericCodeEntry> = {
  "267": n(
    "Cited in the timeout guidance as a deferred or pending timeout; not in the reason code table",
    "network_or_timeout",
    "retry_conditionally",
    true,
  ),
};

/** Transaction Details `rCode` values (3). */
export const R_CODES: Record<string, { meaning: string; outcome: Outcome }> = {
  "-1": { meaning: "Error", outcome: "unknown" },
  "0": { meaning: "Declined", outcome: "failure" },
  "1": { meaning: "Success", outcome: "success" },
};

/**
 * Transaction Details service names. The reviewed pages list them without
 * describing them; only names that match a REST service of the same name get
 * a lifecycle stage.
 */
export const APPLICATION_NAMES: Record<string, { stage?: LifecycleStage; operation: string }> = {
  ics_auth: { stage: "authorization", operation: "authorization" },
  ics_auth_reversal: { stage: "reversal", operation: "authorization reversal" },
  ics_credit: { stage: "refund", operation: "credit" },
  ics_void: { stage: "void", operation: "void" },
  ics_bill: { operation: "listed service, not described in the reviewed pages" },
  ics_decision: { operation: "listed service, not described in the reviewed pages" },
};

// ---------------------------------------------------------------------------
// AVS (29), CVN (11), merchant advice (22), payment insights (7)
// ---------------------------------------------------------------------------

/** General AVS table ("Other Processors"). Cielo and Latin American Processing differ. */
export const AVS_CODES: Record<string, string> = {
  A: "Street address matches, postal code does not",
  B: "Street address matches, postal code not verified (non-US Visa)",
  C: "Street address and postal code do not match (non-US Visa)",
  D: "Street address and postal code match (non-US Visa)",
  E: "AVS data invalid or not allowed for the card type",
  F: "Card holder name does not match, postal code matches (American Express)",
  G: "Non-US issuer does not support AVS",
  H: "Card holder name does not match, street address and postal code match (American Express)",
  I: "Address not verified (non-US Visa)",
  K: "Card holder name matches only (American Express)",
  L: "Card holder name and postal code match (American Express)",
  M: "Street address and postal code match (non-US Visa)",
  N: "No match",
  O: "Card holder name and street address match (American Express)",
  P: "Postal code matches, street address not verified (non-US Visa)",
  R: "System unavailable",
  S: "US issuer does not support AVS",
  T: "Card holder name does not match, street address matches (American Express)",
  U: "Address information unavailable",
  V: "Card holder name, street address and postal code match (American Express)",
  W: "Nine-digit postal code matches, street address does not",
  X: "Street address and nine-digit postal code match",
  Y: "Street address and five-digit postal code match",
  Z: "Five-digit postal code matches, street address does not",
  "1": "AVS not supported or disabled",
  "2": "Unrecognized value from the processor",
  "3": "Address confirmed (PayPal Express Checkout)",
  "4": "Address not confirmed (PayPal Express Checkout)",
  "5": "No AVS code returned",
};

export const CVN_CODES: Record<string, string> = {
  D: "The issuer considered the transaction suspicious",
  I: "Failed processor data validation",
  M: "Matched",
  N: "Did not match",
  P: "Not processed, unspecified reason",
  S: "On the card but not sent",
  U: "The issuer does not support card verification",
  X: "The card association does not support card verification",
  "1": "Not supported for this processor or card type",
  "2": "Unrecognized value from the processor",
  "3": "No result code returned",
};

export type AdviceEntry = { network: string; meaning: string; retry: RetryGuidance };

/**
 * `processorInformation.merchantAdvice.code`. Visa uses one digit and
 * Mastercard two, so the code format tells them apart. Barclays uses 00 to
 * 05; its 01, 02 and 03 have the same meaning as Mastercard's.
 */
export const MERCHANT_ADVICE_CODES: Record<string, AdviceEntry> = {
  "1": { network: "Visa", meaning: "The issuer never approves", retry: "do_not_retry" },
  "2": {
    network: "Visa",
    meaning: "The issuer cannot approve at this time",
    retry: "retry_conditionally",
  },
  "3": {
    network: "Visa",
    meaning: "Data quality; revalidate the payment details",
    retry: "customer_action_required",
  },
  "00": { network: "Barclays", meaning: "No information", retry: "unknown" },
  "01": {
    network: "Mastercard or Barclays",
    meaning: "New account information available",
    retry: "customer_action_required",
  },
  "02": {
    network: "Mastercard or Barclays",
    meaning: "Try again later",
    retry: "retry_conditionally",
  },
  "03": { network: "Mastercard or Barclays", meaning: "Do not try again", retry: "do_not_retry" },
  "04": { network: "Mastercard", meaning: "Token not supported", retry: "do_not_retry" },
  "05": { network: "Barclays", meaning: "Blocked by the card company", retry: "do_not_retry" },
  "21": { network: "Mastercard", meaning: "Do not honor", retry: "do_not_retry" },
  "22": {
    network: "Mastercard",
    meaning: "The merchant does not qualify for the product code",
    retry: "do_not_retry",
  },
  "24": { network: "Mastercard", meaning: "Retry after 1 hour", retry: "retry_conditionally" },
  "25": { network: "Mastercard", meaning: "Retry after 24 hours", retry: "retry_conditionally" },
  "26": { network: "Mastercard", meaning: "Retry after 2 days", retry: "retry_conditionally" },
  "27": { network: "Mastercard", meaning: "Retry after 4 days", retry: "retry_conditionally" },
  "28": { network: "Mastercard", meaning: "Retry after 6 days", retry: "retry_conditionally" },
  "29": { network: "Mastercard", meaning: "Retry after 8 days", retry: "retry_conditionally" },
  "30": { network: "Mastercard", meaning: "Retry after 10 days", retry: "retry_conditionally" },
  "40": {
    network: "Mastercard",
    meaning: "Consumer non-reloadable prepaid card",
    retry: "do_not_retry",
  },
  "41": {
    network: "Mastercard",
    meaning: "Consumer single-use virtual card number",
    retry: "do_not_retry",
  },
  "42": {
    network: "Mastercard",
    meaning: "Sanctions score exceeds the threshold",
    retry: "manual_review",
  },
  "99": { network: "Mastercard", meaning: "Do not try again", retry: "do_not_retry" },
};

/** `paymentInsightsInformation.responseInsights` categories; Cybersource's own retry advice. */
export const PAYMENT_INSIGHTS: Record<string, { category: string; retry: RetryGuidance }> = {
  "01": { category: "ISSUER_WILL_NEVER_APPROVE", retry: "do_not_retry" },
  "02": { category: "ISSUER_CANNOT_APPROVE_AT_THIS_TIME", retry: "retry_conditionally" },
  "03": { category: "ISSUER_CANNOT_APPROVE_WITH_THESE_DETAILS", retry: "retry_conditionally" },
  "04": { category: "GENERIC_ERROR", retry: "retry_conditionally" },
  "97": { category: "PAYMENT_INSIGHTS_INTERNAL_ERROR", retry: "retry_conditionally" },
  "98": { category: "OTHERS", retry: "retry_conditionally" },
  "99": {
    category: "PAYMENT_INSIGHTS_RESPONSE_CATEGORY_MATCH_NOT_FOUND",
    retry: "retry_conditionally",
  },
};

export const PAYMENT_INSIGHTS_RETRY_TEXT =
  "Cybersource's payment insights allow at most 15 retries over 30 days for this category; revalidate the payment data first for category 03.";

// ---------------------------------------------------------------------------
// Webhook notifications (version 3): 42 distinct event types
// ---------------------------------------------------------------------------

export type WebhookEventEntry = {
  products: readonly string[];
  stage: LifecycleStage;
  outcome: Outcome;
  /** Statuses the event table names for this event, where it names any. */
  statuses?: readonly string[];
  recurring?: true;
  note?: string;
};

const ev = (
  products: readonly string[],
  stage: LifecycleStage,
  outcome: Outcome,
  extra: Partial<Pick<WebhookEventEntry, "statuses" | "recurring" | "note">> = {},
): WebhookEventEntry => ({ products, stage, outcome, ...extra });

const PAY = ["payments"] as const;
const ECHECK = ["eCheck"] as const;
const RISK_BOTH = ["decisionManager", "fraudManagementEssentials"] as const;
const FME = ["fraudManagementEssentials"] as const;
const INVOICE = ["customerInvoicing"] as const;
const TMS = ["tokenManagement"] as const;
const RBS = ["recurringBilling"] as const;

export const WEBHOOK_EVENT_TYPES: Record<string, WebhookEventEntry> = {
  "payments.authorization.status.accepted": ev(PAY, "authorization", "success", {
    statuses: ["AUTHORIZED"],
  }),
  "payments.authorization.status.reviewed": ev(PAY, "authorization", "pending", {
    statuses: ["AUTHORIZED_PENDING_REVIEW"],
  }),
  "payments.authorization.status.rejected": ev(PAY, "authorization", "failure", {
    statuses: ["INVALID_REQUEST", "SERVER_ERROR", "DECLINED", "SERVER_TIMEOUT", "SERVICE_TIMEOUT"],
    note: "The rejected event also covers timeouts, whose real outcome is unknown.",
  }),
  "payments.authorization.status.partiallyApproved": ev(PAY, "authorization", "success", {
    statuses: ["PARTIAL_AUTHORIZED"],
  }),
  "payments.capture.status.accepted": ev(PAY, "capture", "pending", { statuses: ["PENDING"] }),
  "payments.capture.status.updated": ev(PAY, "capture", "success", {
    statuses: ["BATCHED"],
    note: "The capture moved from PENDING to BATCHED (sent to the processor); this is not settlement.",
  }),
  "payments.refund.status.accepted": ev(PAY, "refund", "pending", { statuses: ["PENDING"] }),
  "payments.refund.status.updated": ev(PAY, "refund", "success", {
    statuses: ["BATCHED"],
    note: "The refund moved from PENDING to BATCHED (sent to the processor); the funds transfer is not confirmed.",
  }),
  "payments.credit.status.accepted": ev(PAY, "refund", "pending", { statuses: ["PENDING"] }),
  "payments.credit.status.updated": ev(PAY, "refund", "unknown", {
    note: "The event table repeats the description of payments.credit.status.accepted for this event.",
  }),
  "payments.void.status.accepted": ev(PAY, "void", "success", { statuses: ["VOIDED"] }),
  "payments.void.status.rejected": ev(PAY, "void", "failure", { statuses: ["NOT VOIDABLE"] }),
  "payments.reversal.status.accepted": ev(PAY, "reversal", "success", { statuses: ["REVERSED"] }),
  "payments.reversal.status.rejected": ev(PAY, "reversal", "failure", {
    note: "The event table lists REVERSED among the rejection statuses.",
  }),
  "payments.payments.updated": ev(["alternativePaymentMethods"], "payment", "unknown"),
  "payments.credits.accepted": ev(ECHECK, "refund", "pending"),
  "payments.credits.failed": ev(ECHECK, "refund", "failure"),
  "payments.payments.accepted": ev(ECHECK, "payment", "pending"),
  "payments.payments.failed": ev(ECHECK, "payment", "failure"),
  "payments.voids.accepted": ev(ECHECK, "void", "success"),
  "payments.voids.failed": ev(ECHECK, "void", "failure"),
  "risk.casemanagement.decision.accept": ev(RISK_BOTH, "other", "success"),
  "risk.casemanagement.decision.reject": ev(RISK_BOTH, "other", "failure"),
  "risk.profile.decision.reject": ev(RISK_BOTH, "other", "failure"),
  "risk.casemanagement.addnote": ev(FME, "other", "success"),
  "risk.profile.decision.monitor": ev(FME, "other", "unknown"),
  "risk.profile.decision.review": ev(FME, "other", "pending"),
  "invoicing.customer.invoice.send": ev(INVOICE, "other", "success"),
  "invoicing.customer.invoice.cancel": ev(INVOICE, "cancellation", "success"),
  "invoicing.customer.invoice.paid": ev(INVOICE, "payment", "success"),
  "invoicing.customer.invoice.partial-payment": ev(INVOICE, "payment", "success"),
  "invoicing.customer.invoice.reminder": ev(INVOICE, "other", "success"),
  "invoicing.customer.invoice.overdue-reminder": ev(INVOICE, "other", "success"),
  "payByLink.customer.payment": ev(["payByLink"], "payment", "unknown"),
  "payByLink.merchant.payment": ev(["payByLink"], "payment", "unknown"),
  "rbs.subscriptions.charge.failed": ev(RBS, "payment", "failure", { recurring: true }),
  "rbs.subscriptions.charge.pre-notified": ev(RBS, "subscription", "success"),
  "rbs.subscriptions.charge.created": ev(RBS, "payment", "unknown", { recurring: true }),
  "tms.networktoken.updated": ev(TMS, "other", "success"),
  "tms.networktoken.provisioned": ev(TMS, "other", "success"),
  "tms.networktoken.binding": ev(TMS, "other", "success"),
  "uc.orders.transactionresults": ev(["unifiedCheckout"], "payment", "unknown"),
};

/** Webhook `productId` values from the event type table (10). */
export const WEBHOOK_PRODUCTS: ReadonlySet<string> = new Set([
  "payments",
  "alternativePaymentMethods",
  "eCheck",
  "decisionManager",
  "fraudManagementEssentials",
  "customerInvoicing",
  "payByLink",
  "recurringBilling",
  "tokenManagement",
  "unifiedCheckout",
]);

/** Products whose notifications require message-level encryption. */
export const ENCRYPTED_PRODUCTS: ReadonlySet<string> = new Set(["payments", "unifiedCheckout"]);

// ---------------------------------------------------------------------------
// Pay by Bank notification statuses (7)
// ---------------------------------------------------------------------------

/**
 * Pay by Bank notification statuses. Only the names are documented; the
 * stage and outcome follow the names. The decrypted example uses lowercase.
 */
export const PAY_BY_BANK_STATUSES: Record<string, { stage: LifecycleStage; outcome: Outcome }> = {
  ABANDONED: { stage: "payment", outcome: "failure" },
  CANCELLED: { stage: "cancellation", outcome: "success" },
  COMPLETED: { stage: "payment", outcome: "success" },
  FAILED: { stage: "payment", outcome: "failure" },
  PENDING: { stage: "payment", outcome: "pending" },
  REFUNDED: { stage: "refund", outcome: "success" },
  SETTLED: { stage: "settlement", outcome: "success" },
};

// ---------------------------------------------------------------------------
// Guidance text
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not send the same request again; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact the issuer, complete authentication, or use another card or payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first confirm the final state of the original request with Transaction Search or Transaction Details (by request id or merchant reference) or in the Business Center, because it may already have been processed.",
  safe_to_retry_technical_request:
    "Cybersource states that the request was not sent and can be sent again.",
  manual_review: "Review the transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Authenticate the cardholder (payer authentication or 3-D Secure) and send the authorization again.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another payment method.",
  invalid_request: "Correct the fields named in the response before sending a new request.",
  invalid_amount: "Check the amount against the original transaction and the limits that apply.",
  insufficient_funds:
    "Ask the customer to use another payment method, or to contact their card issuer.",
  payment_method_unavailable: "Offer another card type or payment method.",
  fraud_or_risk:
    "Review the transaction and the risk result (Decision Manager, AVS, CVN or watch list) before any new attempt.",
  rate_limiting: "Wait before a new attempt.",
  provider_unavailable:
    "Check the transaction status before sending a new request; if the problem persists, contact Cybersource support.",
  network_or_timeout:
    "Check the transaction status with Transaction Search or Transaction Details before sending a new request; reverse a duplicate rather than the original.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the merchant and processor configuration with Cybersource support; do not resend the request unchanged.",
  unknown: "Check the transaction in the Business Center or ask Cybersource support.",
};
