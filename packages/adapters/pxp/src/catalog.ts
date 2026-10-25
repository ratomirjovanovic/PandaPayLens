/**
 * PXP Financial code, state and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/pxp.md, which cites
 * PXP's public developer portal (verified 2026-10-25):
 *
 * Card codes, APM error codes, states: https://developer.pxp.io/guides/transactions/how-it-works.md
 * State enums, stateDataCode enum:      https://developer.pxp.io/_bundle/apis/transaction.yaml
 * Webhook envelope and event table:     https://developer.pxp.io/guides/get-started/about-webhooks.md
 * Webhook schema and examples:          https://developer.pxp.io/_bundle/apis/merchant-webhook.yaml
 * HTTP statuses, idempotency:           https://developer.pxp.io/guides/get-started/api-overview.md
 * 3DS states and reasons:               https://developer.pxp.io/guides/3ds/states.md
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions derived from the documented meaning; PXP gives no per-code retry
 * advice. Pay-by-bank APM state codes and API errorCode values are only seen in
 * PXP examples (no published definition table) and are marked `exampleDerived`.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const HOW_IT_WORKS_URL = "https://developer.pxp.io/guides/transactions/how-it-works.md";
export const TRANSACTION_API_URL = "https://developer.pxp.io/_bundle/apis/transaction.yaml";
export const WEBHOOK_API_URL = "https://developer.pxp.io/_bundle/apis/merchant-webhook.yaml";
export const ABOUT_WEBHOOKS_URL = "https://developer.pxp.io/guides/get-started/about-webhooks.md";
export const MANAGE_WEBHOOKS_URL = "https://developer.pxp.io/guides/get-started/manage-webhooks.md";
export const API_OVERVIEW_URL = "https://developer.pxp.io/guides/get-started/api-overview.md";
export const MODIFY_URL = "https://developer.pxp.io/guides/transactions/modify-transactions.md";
export const LOOKUP_URL = "https://developer.pxp.io/guides/transactions/get-transaction-details.md";
export const THREEDS_STATES_URL = "https://developer.pxp.io/guides/3ds/states.md";
export const THREEDS_ERRORS_URL = "https://developer.pxp.io/guides/3ds/error-handling.md";
export const SESSION_API_URL = "https://developer.pxp.io/_bundle/apis/session.yaml";
export const LINKS_API_URL = "https://developer.pxp.io/_bundle/apis/links.yaml";

/** How a normalized code relates to the transaction outcome. */
export type CodeKind = "success" | "partial" | "decline";

export type CodeEntry = {
  /** Short paraphrase of the documented meaning or paired message. */
  meaning: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Seen only in PXP examples; no published definition table. */
  exampleDerived?: true;
};

const ok = (meaning: string): CodeEntry => ({
  meaning,
  kind: "success",
  category: "unknown",
  retry: "unknown",
});
const partial = (meaning: string): CodeEntry => ({
  meaning,
  kind: "partial",
  category: "unknown",
  retry: "manual_review",
});
const decline = (meaning: string, category: ErrorCategory, retry: RetryGuidance): CodeEntry => ({
  meaning,
  kind: "decline",
  category,
  retry,
});

/**
 * Normalized card codes in `stateData.code` (44 CRD codes) plus VAN0001.
 * The same code can arrive with `state: Refused` or `state: Error`.
 */
export const CARD_CODES: Record<string, CodeEntry> = {
  CRD000: ok("Approved"),
  CRD001: ok("Approved subject to identification"),
  CRD002: partial("Approved for a partial amount"),
  CRD003: ok("Approved (VIP)"),
  CRD004: ok("Approved, track 3 to be updated"),
  CRD005: ok("Approved, issuer specified account type"),
  CRD006: partial("Partial approval, issuer specified account type"),
  CRD007: ok("Approved, chip data to be updated"),
  CRD100: decline(
    "Issuer declined without a reason (do not honour)",
    "card_declined",
    "customer_action_required",
  ),
  CRD101: decline("Card expired", "card_declined", "customer_action_required"),
  CRD102: decline("Issuer or risk suspects fraud", "fraud_or_risk", "do_not_retry"),
  CRD103: decline("Merchant should contact the acquirer", "configuration", "manual_review"),
  CRD104: decline("Card is restricted", "card_declined", "do_not_retry"),
  CRD105: decline(
    "Merchant should call the acquirer's security team",
    "fraud_or_risk",
    "manual_review",
  ),
  CRD106: decline("Too many PIN attempts", "authentication_failed", "do_not_retry"),
  CRD107: decline("Refer to the issuer", "card_declined", "customer_action_required"),
  CRD108: decline(
    "Refer to the issuer, special conditions",
    "card_declined",
    "customer_action_required",
  ),
  CRD109: decline("Merchant not valid for this transaction", "configuration", "do_not_retry"),
  CRD110: decline("Amount not valid", "invalid_amount", "do_not_retry"),
  CRD111: decline("Card number not valid", "invalid_request", "customer_action_required"),
  CRD112: decline("PIN required", "authentication_required", "customer_action_required"),
  CRD113: decline("Fee not acceptable", "invalid_amount", "do_not_retry"),
  CRD114: decline(
    "Requested account type does not exist on the card",
    "card_declined",
    "customer_action_required",
  ),
  CRD115: decline("Function not supported", "payment_method_unavailable", "do_not_retry"),
  CRD116: decline("Insufficient funds", "insufficient_funds", "customer_action_required"),
  CRD117: decline("Wrong PIN", "authentication_failed", "customer_action_required"),
  CRD118: decline("Card record not found", "card_declined", "do_not_retry"),
  CRD119: decline("Not allowed for this cardholder", "card_declined", "do_not_retry"),
  CRD120: decline("Not allowed for this terminal or merchant", "configuration", "do_not_retry"),
  CRD121: decline("Amount limit exceeded", "card_declined", "customer_action_required"),
  CRD122: decline("Security violation", "fraud_or_risk", "do_not_retry"),
  CRD123: decline("Frequency limit exceeded", "card_declined", "retry_conditionally"),
  CRD124: decline("Legal or regulatory violation", "card_declined", "do_not_retry"),
  CRD125: decline("Card not yet effective", "card_declined", "customer_action_required"),
  CRD126: decline("PIN block not valid", "configuration", "manual_review"),
  CRD127: decline("PIN length wrong", "authentication_failed", "customer_action_required"),
  CRD128: decline("PIN key synchronization error", "configuration", "manual_review"),
  CRD129: decline("Card suspected counterfeit", "fraud_or_risk", "do_not_retry"),
  CRD180: decline(
    "Retry with chip/contact, or strong customer authentication is needed for e-commerce (soft decline)",
    "authentication_required",
    "customer_action_required",
  ),
  CRD181: decline("Card to be picked up (lost or stolen)", "fraud_or_risk", "do_not_retry"),
  CRD182: decline("Message format error", "invalid_request", "do_not_retry"),
  CRD183: decline("Timeout or malfunction downstream", "network_or_timeout", "retry_conditionally"),
  CRD184: decline("Card restricted", "card_declined", "do_not_retry"),
  CRD185: decline("Refused by fraud or scoring rules", "fraud_or_risk", "manual_review"),
  VAN0001: decline(
    "General execution error (only in the webhook OpenAPI enum and one in-store example)",
    "unknown",
    "manual_review",
  ),
};

/**
 * Pay-by-bank APM state codes in `stateData.code`. PXP publishes no table for
 * them: the meaning comes from the paired message in PXP examples.
 */
export const APM_STATE_CODES: Record<string, CodeEntry> = {
  APM001: { ...ok("Payment executed"), exampleDerived: true },
  APM002: {
    ...decline("Invalid request", "invalid_request", "do_not_retry"),
    exampleDerived: true,
  },
  APM003: { ...ok("Payment authorised"), exampleDerived: true },
  APM004: {
    // No bank-transfer specific category exists; this is a generic decline.
    ...decline("Payment declined or refused", "card_declined", "manual_review"),
    exampleDerived: true,
  },
  APM007: { ...ok("Payment refunded"), exampleDerived: true },
  APM011: {
    ...decline("Payment expired", "unknown", "customer_action_required"),
    exampleDerived: true,
  },
  APM012: { ...decline("Payment failed", "unknown", "manual_review"), exampleDerived: true },
  APM013: { ...decline("Payment rejected", "unknown", "manual_review"), exampleDerived: true },
};

/** APM error codes (PayPal and similar) as documented in the how-it-works guide. */
export const APM_ERROR_CODES: Record<string, CodeEntry> = {
  APM4100: decline("Internal server error", "provider_unavailable", "retry_conditionally"),
  APM4101: decline("Conflict detected", "duplicate_request", "do_not_retry"),
  APM4102: decline(
    "Authentication with the provider failed (header or credentials)",
    "configuration",
    "do_not_retry",
  ),
  APM4103: decline("Malformed or schema-invalid request", "invalid_request", "do_not_retry"),
  APM4104: decline("Not permitted", "configuration", "do_not_retry"),
  APM4105: decline("Business validation failed", "invalid_request", "manual_review"),
  APM4106: decline("Resource not found", "invalid_request", "do_not_retry"),
};

export type ApiErrorEntry = {
  meaning: string;
  /** HTTP status the code is shown with in the PXP example. */
  httpStatus: number;
  category: ErrorCategory;
  retry: RetryGuidance;
  docsUrl: string;
};

/**
 * API `errorCode` values. PXP does not publish a list; these are all values
 * seen in the OpenAPI examples, so every entry is example-derived.
 */
export const API_ERROR_CODES: Record<string, ApiErrorEntry> = {
  CAR0003: {
    meaning: "Card details invalid",
    httpStatus: 400,
    category: "invalid_request",
    retry: "customer_action_required",
    docsUrl: TRANSACTION_API_URL,
  },
  CAR0004: {
    meaning: "Authentication failed for a card transaction",
    httpStatus: 401,
    category: "configuration",
    retry: "do_not_retry",
    docsUrl: TRANSACTION_API_URL,
  },
  CAR0005: {
    meaning: "Transaction not permitted",
    httpStatus: 403,
    category: "configuration",
    retry: "do_not_retry",
    docsUrl: TRANSACTION_API_URL,
  },
  CAR0006: {
    meaning: "Card transaction details not found",
    httpStatus: 404,
    category: "invalid_request",
    retry: "do_not_retry",
    docsUrl: TRANSACTION_API_URL,
  },
  CAR0010: {
    meaning: "Transaction data format invalid",
    httpStatus: 422,
    category: "invalid_request",
    retry: "do_not_retry",
    docsUrl: TRANSACTION_API_URL,
  },
  TOK0004: {
    meaning: "Token request payload too large",
    httpStatus: 413,
    category: "invalid_request",
    retry: "do_not_retry",
    docsUrl: TRANSACTION_API_URL,
  },
  GEN0008: {
    meaning: "Unexpected internal error",
    httpStatus: 500,
    category: "provider_unavailable",
    retry: "retry_conditionally",
    docsUrl: TRANSACTION_API_URL,
  },
  SES4001: {
    meaning: "Session not found (Sessions API)",
    httpStatus: 404,
    category: "invalid_request",
    retry: "do_not_retry",
    docsUrl: SESSION_API_URL,
  },
  SES4006: {
    meaning: "Session cannot be changed because the transaction is already authorised",
    httpStatus: 404,
    category: "duplicate_request",
    retry: "do_not_retry",
    docsUrl: SESSION_API_URL,
  },
  INVALID_REQUEST: {
    meaning: "Validation errors; see details (Links API)",
    httpStatus: 400,
    category: "invalid_request",
    retry: "do_not_retry",
    docsUrl: LINKS_API_URL,
  },
  NOT_AUTHENTICATED: {
    meaning: "Authorization data missing (Links API)",
    httpStatus: 401,
    category: "configuration",
    retry: "do_not_retry",
    docsUrl: LINKS_API_URL,
  },
  OBJECT_NOT_FOUND: {
    meaning: "Site or other object not found (Links API)",
    httpStatus: 404,
    category: "configuration",
    retry: "do_not_retry",
    docsUrl: LINKS_API_URL,
  },
};

export type HttpStatusEntry = {
  label: string;
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

/** HTTP statuses from the API overview. Declines are HTTP 200 with a state. */
export const HTTP_STATUSES: Record<number, HttpStatusEntry> = {
  200: {
    label: "Successfully Processed",
    meaning: "Processed; the outcome is in state",
    category: "unknown",
    retry: "unknown",
  },
  400: {
    label: "Request Interpretation Error",
    meaning: "Bad request syntax; fix the request before retrying",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  401: {
    label: "Authentication Needed",
    meaning: "Missing or invalid credentials",
    category: "configuration",
    retry: "do_not_retry",
  },
  403: {
    label: "Access Denied",
    meaning: "Insufficient permissions; PXP says not to repeat the request",
    category: "configuration",
    retry: "do_not_retry",
  },
  404: {
    label: "Resource Unavailable",
    meaning: "Not found, often a wrong URL; PXP says it may be retried",
    category: "invalid_request",
    retry: "retry_conditionally",
  },
  413: {
    label: "Excessive Request Size",
    meaning: "Request body over 10 MB",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  422: {
    label: "Semantic Request Error",
    meaning: "Readable but semantically invalid request",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  500: {
    label: "Processing Failure",
    meaning:
      "Unexpected server issue; PXP notes it can also come from bad formatting such as missing mandatory fields",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

export type StateInfo = {
  outcome: Outcome;
  /** Stage implied by the state itself; otherwise the intent decides. */
  stage?: LifecycleStage;
  description: string;
};

/**
 * Transaction states from the how-it-works guide, the webhook and transaction
 * OpenAPI enums, and the FlashFlow guide. `Confirmed`, `Updated` and
 * `Approved` are in the transaction enum without an explanation, so they are
 * deliberately absent and stay unknown.
 */
export const TRANSACTION_STATES: Record<string, StateInfo> = {
  Authorised: { outcome: "success", description: "Authorised (or executed, for pay by bank)" },
  Captured: { outcome: "success", stage: "capture", description: "Captured" },
  Cancelled: { outcome: "success", description: "Cancelled (voided before capture)" },
  Error: { outcome: "failure", description: "Processing error" },
  Refused: { outcome: "failure", description: "Refused" },
  Executed: { outcome: "pending", description: "Buyer approval executed; not yet authorised" },
  Pending: { outcome: "pending", description: "Pending" },
  PendingOnProvider: {
    outcome: "pending",
    description: "Pending at the downstream provider (FlashFlow)",
  },
  Refunded: { outcome: "success", stage: "refund", description: "Refunded" },
  Aborted: { outcome: "failure", description: "Aborted (SPEI declined)" },
  Expired: { outcome: "failure", description: "Expired" },
  Rejected: { outcome: "failure", description: "Rejected" },
};

/** `transactionMethod.intent` values and the stage they imply. */
export const INTENTS: Record<string, LifecycleStage> = {
  Authorisation: "authorization",
  EstimatedAuthorisation: "authorization",
  Verification: "authorization",
  Purchase: "payment",
  Create: "payment",
  Capture: "capture",
  Void: "void",
  Refund: "refund",
  Payout: "payout",
};

/** `transactionMethod.fundingType` values (PayByBanks is FlashFlow's documented plural). */
export const FUNDING_TYPES: Record<string, string> = {
  Card: "card",
  Paypal: "paypal",
  PayByBank: "pay_by_bank",
  PayByBanks: "pay_by_bank",
  Cage: "cage",
};

export type EventCodeInfo = {
  /** Payment method family the code belongs to. */
  apm: "spei" | "cvu" | "breb" | "flashflow" | "aeropay" | "card";
  /** Outcome when the state is missing; the state wins when present. */
  outcome: Outcome;
  /** Stage implied by the event itself; otherwise the intent decides. */
  stage?: LifecycleStage;
  description: string;
};

const PAY_BY_BANK_SUFFIX: Record<string, Pick<EventCodeInfo, "outcome" | "stage">> = {
  executed: { outcome: "success" },
  declined: { outcome: "failure" },
  expired: { outcome: "failure" },
  failed: { outcome: "failure" },
  refunded: { outcome: "success", stage: "refund" },
  rejected: { outcome: "failure" },
  "cross-entry": { outcome: "failure" },
  refused: { outcome: "failure" },
};

function payByBankCodes(
  apm: EventCodeInfo["apm"],
  prefix: string,
  suffixes: string[],
): Record<string, EventCodeInfo> {
  const out: Record<string, EventCodeInfo> = {};
  for (const s of suffixes) {
    out[`${prefix}${s}`] = {
      apm,
      ...PAY_BY_BANK_SUFFIX[s]!,
      description: `${prefix}${s} (deposit or payout; transactionMethod.intent tells them apart)`,
    };
  }
  return out;
}

const ORDER_SUFFIXES = ["executed", "declined", "expired", "failed", "refunded", "rejected"];

/** `eventData.eventCode` values of payment-related webhook events. */
export const WEBHOOK_EVENT_CODES: Record<string, EventCodeInfo> = {
  ...payByBankCodes("spei", "spei-transaction-order-", ORDER_SUFFIXES),
  ...payByBankCodes("cvu", "cvu-transaction-order-", ORDER_SUFFIXES),
  ...payByBankCodes("breb", "breb-transaction-order-", [...ORDER_SUFFIXES, "cross-entry"]),
  ...payByBankCodes("flashflow", "flashflow-transaction-", ["executed", "expired", "refused"]),
  TXN_RFU: { apm: "card", outcome: "failure", description: "Card transaction refused" },
  TXN_ERR: { apm: "card", outcome: "failure", description: "Card transaction error" },
  TXNAP_AUTH: { apm: "aeropay", outcome: "success", description: "Aeropay transaction authorised" },
  TXNAP_CPT: {
    apm: "aeropay",
    outcome: "success",
    stage: "capture",
    description: "Aeropay transaction captured",
  },
  TXNAP_CNC: {
    apm: "aeropay",
    outcome: "success",
    stage: "cancellation",
    description: "Aeropay transaction cancelled",
  },
  TXNAP_RFD: {
    apm: "aeropay",
    outcome: "success",
    stage: "refund",
    description: "Aeropay transaction refunded (the provider status may still be pending)",
  },
};

/** Event codes of documented events that carry no payment lifecycle. */
export const NON_PAYMENT_EVENT_CODES: Record<string, string> = {
  TXNPP_UIC: "user-info-created",
  TXNAP_USP: "user-suspended",
  TXNAP_UAC: "user-activated",
  TS_TC: "test connection",
};

/** `eventCategory` values (compared case-insensitively). */
export const EVENT_CATEGORIES = ["transaction", "authentication", "token", "reporting"] as const;
export const TEST_EVENT_CATEGORY = "test-connection";
/** Categories that are recognized but carry no payment lifecycle. */
export const NON_PAYMENT_CATEGORIES = new Set(["token", "reporting", TEST_EVENT_CATEGORY]);

/**
 * Documented event names for transaction events that carry no eventCode. The
 * name never appears in the body; it is inferred from the state (and, for
 * payouts and PayPal creation, the intent or funding type).
 */
export const INFERRED_EVENT_NAMES: Record<string, string> = {
  Authorised: "transaction-authorised",
  Cancelled: "transaction-cancelled",
  Captured: "transaction-captured",
  Pending: "transaction-created",
  Executed: "transaction-executed",
  Refunded: "transaction-refunded",
};
export const PAYOUT_AUTHORISED_EVENT = "payout-authorised";
export const CHALLENGE_COMPLETED_EVENT = "challenge-completed";

export type AuthStateInfo = {
  outcome: Outcome;
  description: string;
  category?: ErrorCategory;
  retry?: RetryGuidance;
};

/** 3DS `authenticationState` values. */
export const THREEDS_AUTH_STATES: Record<string, AuthStateInfo> = {
  PendingClientData: { outcome: "pending", description: "Waiting for client data" },
  PendingCustomerChallenge: {
    outcome: "pending",
    description: "Waiting for the customer challenge",
  },
  AuthenticationSuccessful: { outcome: "success", description: "Authentication successful" },
  AuthenticationFailed: {
    outcome: "failure",
    description:
      "Authentication failed; PXP says a retry is possible, but do not authorise with this 3DS data",
    category: "authentication_failed",
    retry: "customer_action_required",
  },
  AuthenticationRejected: {
    outcome: "failure",
    description: "Authentication rejected; PXP says not to retry, the payment cannot proceed",
    category: "authentication_failed",
    retry: "do_not_retry",
  },
  AuthenticationError: {
    outcome: "failure",
    description: "Authentication error; PXP says to retry once",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

/** EMV 3DS `transStatus` values as listed by PXP. */
export const THREEDS_TRANS_STATUS: Record<string, string> = {
  Y: "Authentication successful",
  N: "Not authenticated",
  U: "Authentication could not be performed",
  A: "Authentication attempted",
  C: "Challenge required",
  D: "Decoupled authentication",
  R: "Authentication rejected",
  I: "Informational only",
};

/**
 * `transactionStatusReason` values (01 to 30). Only the meanings quoted in
 * the research file are listed; other values are shown without a meaning.
 */
export const THREEDS_REASONS: Record<string, string> = {
  "01": "Card authentication failed",
  "11": "Suspected fraud",
  "14": "Transaction timed out at the ACS",
  "19": "Exceeded the maximum number of ACS challenges",
  "22": "ACS technical issue",
};

/** PXP-normalized verification results in fundingData. */
export const VERIFICATION_RESULTS = new Set([
  "NoInformationAvailable",
  "CardSecurityCodeMatched",
  "CardSecurityCodeNotMatched",
  "CardSecurityCodeNotChecked",
]);

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer or bank, correct their details, or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first verify the current state of the transaction (transaction lookup, GET /api/v1/transactions/{merchant}/{site}) so that a new request does not duplicate an operation that already took effect. PXP recognizes a repeated merchantTransactionId and processes only one of the requests, so resend with the same merchantTransactionId rather than a new one.",
  safe_to_retry_technical_request:
    "The request can be repeated as a technical retry with the same merchantTransactionId.",
  manual_review: "Review the transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their issuer.",
  authentication_required: "Send the payment again with strong customer authentication (3DS).",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another card.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds:
    "Ask the customer to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the transaction and the risk outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Look up the transaction state before sending a new request, and check the PXP status page.",
  network_or_timeout: "Look up the transaction state before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the merchant, site and API credential configuration, or contact PXP support with the correlationId or systemTransactionId.",
  unknown:
    "Contact PXP support with the systemTransactionId or correlationId if the cause is unclear.",
};
