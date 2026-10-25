/**
 * NMI status, code and event knowledge, kept as data.
 *
 * Every value below comes from docs/providers/high-risk/research/nmi.md,
 * which cites the NMI documentation pages linked in the URL constants.
 * Category and retry values are PandaPayLens interpretations of the documented
 * meanings (the research marks them as suggestions), not NMI statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const TRANSACTIONS_URL = "https://docs.nmi.com/reference/transactions-processing";
export const RESPONSE_CODES_URL = "https://docs.nmi.com/reference/response-codes";
export const RATE_LIMIT_URL = "https://docs.nmi.com/reference/rate-limiting";
export const QUERY_URL = "https://docs.nmi.com/reference/query";
export const WEBHOOKS_URL = "https://docs.nmi.com/reference/overview";
export const WEBHOOK_RETRY_URL = "https://docs.nmi.com/reference/retry-logic";
export const TRANSACTION_EVENTS_URL = "https://docs.nmi.com/reference/transaction-events";
export const CHECK_STATUS_URL = "https://docs.nmi.com/reference/check-status";
export const RECURRING_EVENTS_URL = "https://docs.nmi.com/reference/recurring-events";
export const SETTLEMENT_EVENTS_URL = "https://docs.nmi.com/reference/settlement-events";
export const CHARGEBACK_EVENTS_URL = "https://docs.nmi.com/reference/chargeback-events";
export const ACU_EVENTS_URL = "https://docs.nmi.com/reference/acu-events";
export const REST_SALE_URL = "https://docs.nmi.com/reference/create-sale-v5";
export const MIGRATION_URL = "https://docs.nmi.com/docs/payment-migration-playbook";
export const GETTING_STARTED_URL = "https://docs.nmi.com/reference/getting-started";
export const EMULATOR_URL = "https://docs.nmi.com/reference/gateway-emulator";
export const INTEGRATION_PORTAL_URL =
  "https://secure.nmi.com/merchants/resources/integration/integration_portal.php";
export const INDUSTRIES_URL = "https://www.nmi.com/who-we-serve/other-industries/";
export const WHITE_LABEL_URL =
  "https://www.nmi.com/resources/payments-101/why-nmi/customizable-white-label-payment-gateway/";

export type CatalogEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required: "Complete the required cardholder authentication first.",
  authentication_failed: "Ask the customer to re-enter their details or to use another card.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount before sending a new request.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another card type or payment method.",
  fraud_or_risk:
    "Do not retry. Review the transaction; the card may be lost, stolen or used fraudulently.",
  rate_limiting: "Wait before sending further requests to the Payment API.",
  provider_unavailable:
    "Look up the transaction with the Query API or in the gateway control panel before any new attempt.",
  network_or_timeout:
    "Look up the transaction with the Query API or in the gateway control panel before any new attempt.",
  duplicate_request:
    "Look up the original transaction before doing anything else; do not resubmit the same request.",
  configuration:
    "Check the merchant account and processor configuration with the gateway provider (NMI or the reseller that issued the account).",
  unknown:
    "Look up the transaction with the Query API or in the gateway control panel, and contact the gateway provider if the state is unclear.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary. Confirm the state of the original transaction first (Query API), then make at most a single new attempt later; avoid automatic repeated retries.",
  safe_to_retry_technical_request:
    "The request was rejected for a technical reason before a payment was made; it can be sent again.",
  manual_review:
    "The response does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this value.",
};

function entry(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  retryExplanation?: string,
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: `${meaning}.`,
    nextAction: NEXT_ACTION[category],
    retryExplanation: retryExplanation ?? RETRY_EXPLANATION[retry],
  };
}

// ---------------------------------------------------------------------------
// Classic Payment API `response` (also `result` in Three-Step): 3 values

export type ResponseValueInfo = { meaning: string; outcome: Outcome };

export const RESPONSE_VALUES: Readonly<Record<string, ResponseValueInfo>> = {
  "1": { meaning: "Transaction approved", outcome: "success" },
  "2": { meaning: "Transaction declined", outcome: "failure" },
  // The outcome of a response=3 record depends on response_code (see the index).
  "3": { meaning: "Error in transaction data or system error", outcome: "unknown" },
};

// ---------------------------------------------------------------------------
// response_code: 34 values from the Result Code Table plus 301 (rate-limiting page)

export type CodeClass = "approved" | "decline" | "error";

export type ResponseCodeInfo = {
  meaning: string;
  /** 100 approved, 2xx processor declines, 3xx gateway errors, 4xx processor errors. */
  codeClass: CodeClass;
  /** Error interpretation; absent only for 100 (approved). */
  error?: CatalogEntry & {
    /** Whether the original operation's outcome is known when this code is returned. */
    outcome: Outcome;
  };
  source: string;
};

function decline(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  retryExplanation?: string,
): ResponseCodeInfo {
  return {
    meaning,
    codeClass: "decline",
    error: { ...entry(meaning, category, retry, retryExplanation), outcome: "failure" },
    source: RESPONSE_CODES_URL,
  };
}

function gatewayError(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  outcome: Outcome,
  retryExplanation?: string,
  source = RESPONSE_CODES_URL,
): ResponseCodeInfo {
  return {
    meaning,
    codeClass: "error",
    error: { ...entry(meaning, category, retry, retryExplanation), outcome },
    source,
  };
}

const VERIFY_FIRST =
  "The response does not say whether the transaction reached the issuer. Look up the transaction with the Query API first; only if it does not exist, make at most a single new attempt later, never an automatic loop.";

export const RESPONSE_CODES: Readonly<Record<string, ResponseCodeInfo>> = {
  "100": { meaning: "Transaction was approved", codeClass: "approved", source: RESPONSE_CODES_URL },
  "200": decline(
    "Transaction was declined by the processor (generic decline)",
    "card_declined",
    "customer_action_required",
  ),
  "201": decline("Do not honor", "card_declined", "customer_action_required"),
  "202": decline("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "203": decline("Over limit", "insufficient_funds", "customer_action_required"),
  "204": decline("Transaction type not permitted", "payment_method_unavailable", "do_not_retry"),
  "220": decline("Incorrect payment information", "invalid_request", "customer_action_required"),
  "221": decline("No such card issuer", "invalid_request", "customer_action_required"),
  "222": decline(
    "No card number on file with the issuer",
    "card_declined",
    "customer_action_required",
  ),
  "223": decline("Expired card", "card_declined", "customer_action_required"),
  "224": decline("Invalid expiration date", "invalid_request", "customer_action_required"),
  "225": decline("Invalid card security code", "card_declined", "customer_action_required"),
  "226": decline("Invalid PIN", "authentication_failed", "customer_action_required"),
  "240": decline(
    "Call the issuer for further information",
    "card_declined",
    "customer_action_required",
  ),
  "250": decline("Pick up card", "fraud_or_risk", "do_not_retry"),
  "251": decline("Lost card", "fraud_or_risk", "do_not_retry"),
  "252": decline("Stolen card", "fraud_or_risk", "do_not_retry"),
  "253": decline("Fraudulent card", "fraud_or_risk", "do_not_retry"),
  "260": decline(
    "Declined with further instructions available (see responsetext)",
    "card_declined",
    "manual_review",
    "NMI says the response text carries further instructions; read them before deciding on any new attempt.",
  ),
  "261": decline(
    "Declined: stop all recurring payments",
    "card_declined",
    "do_not_retry",
    "The issuer asks to stop all recurring payments for this card. Do not retry, and stop scheduled charges on it.",
  ),
  "262": decline(
    "Declined: stop this recurring program",
    "card_declined",
    "do_not_retry",
    "The issuer asks to stop this recurring program. Do not retry, and stop scheduled charges for this program on the card.",
  ),
  "263": decline(
    "Declined: updated cardholder data available",
    "card_declined",
    "customer_action_required",
    "The issuer has updated cardholder data. Obtain the updated card details before a new attempt.",
  ),
  "264": decline(
    "Declined: retry in a few days",
    "card_declined",
    "retry_conditionally",
    "The issuer asks to retry in a few days. Do not retry immediately; make at most a single new attempt after a few days.",
  ),
  "300": gatewayError(
    "Transaction was rejected by the gateway (reason in responsetext)",
    "invalid_request",
    "do_not_retry",
    "failure",
    "The gateway rejected the request before processing; sending it again unchanged will be rejected again. Fix the problem named in responsetext first.",
  ),
  "301": gatewayError(
    "Payment API rate limit exceeded",
    "rate_limiting",
    "retry_conditionally",
    "failure",
    "NMI asks to wait before retrying; do not retry immediately. The rate-limited request was not processed.",
    RATE_LIMIT_URL,
  ),
  "400": gatewayError(
    "Transaction error returned by the processor",
    "provider_unavailable",
    "retry_conditionally",
    "unknown",
    VERIFY_FIRST,
  ),
  "410": gatewayError("Invalid merchant configuration", "configuration", "do_not_retry", "failure"),
  "411": gatewayError("Merchant account is inactive", "configuration", "do_not_retry", "failure"),
  "420": gatewayError(
    "Communication error",
    "network_or_timeout",
    "retry_conditionally",
    "unknown",
    VERIFY_FIRST,
  ),
  "421": gatewayError(
    "Communication error with the issuer",
    "network_or_timeout",
    "retry_conditionally",
    "unknown",
    VERIFY_FIRST,
  ),
  "430": gatewayError(
    "Duplicate transaction at the processor",
    "duplicate_request",
    "do_not_retry",
    "failure",
    "The processor treated this request as a duplicate. Check the original transaction instead of resubmitting.",
  ),
  "440": gatewayError(
    "Processor format error",
    "invalid_request",
    "manual_review",
    "failure",
    "A processor format error does not say which field is wrong; review the request and the processor setup before a new attempt.",
  ),
  "441": gatewayError(
    "Invalid transaction information",
    "invalid_request",
    "do_not_retry",
    "failure",
  ),
  "460": gatewayError(
    "Processor feature not available",
    "configuration",
    "do_not_retry",
    "failure",
  ),
  "461": gatewayError(
    "Unsupported card type",
    "payment_method_unavailable",
    "customer_action_required",
    "failure",
  ),
};

// ---------------------------------------------------------------------------
// AVS (avsresponse, card.avs_response): 29 documented rows, 28 distinct values

export const AVS_CODES: Readonly<Record<string, string>> = {
  X: "Address and 9-digit ZIP match",
  Y: "Address and 5-digit ZIP match",
  D: "Address and 5-digit ZIP match",
  M: "Address and 5-digit ZIP match",
  "2": "Address, 5-digit ZIP and name match",
  "6": "Address, 5-digit ZIP and name match",
  A: "Address only matches",
  // NMI lists B twice with two different meanings.
  B: "Ambiguous: NMI lists B both as address only matches and as AVS not available",
  "3": "Address and name match only",
  "7": "Address and name match only",
  W: "9-digit ZIP only matches",
  Z: "5-digit ZIP only matches",
  P: "5-digit ZIP only matches",
  L: "5-digit ZIP only matches",
  "1": "5-digit ZIP and name match only",
  "5": "5-digit ZIP and name match only",
  N: "Neither address nor ZIP matches",
  C: "Neither address nor ZIP matches",
  "4": "No address, ZIP or name match",
  "8": "No address, ZIP or name match",
  U: "Address information unavailable",
  G: "Non-US issuer not participating",
  I: "Non-US issuer not participating",
  R: "Issuer system unavailable",
  E: "Not a mail or phone order",
  S: "Service not supported",
  "0": "AVS not available",
  O: "AVS not available",
};

/** AVS values that report no address and no ZIP match. */
export const AVS_NO_MATCH: ReadonlySet<string> = new Set(["N", "C", "4", "8"]);

// ---------------------------------------------------------------------------
// CVV (cvvresponse, card.csc_response): 5 values

export const CVV_CODES: Readonly<Record<string, string>> = {
  M: "Match",
  N: "No match",
  P: "Not processed",
  S: "Merchant says the code is not on the card",
  U: "Issuer not certified or has not provided keys",
};

// ---------------------------------------------------------------------------
// Query API and webhook `condition`: 8 values

export const CONDITIONS: Readonly<Record<string, string>> = {
  pending: "Authorized, awaiting capture",
  pendingsettlement: "Awaiting settlement",
  in_progress: "Three-Step Redirect not finished yet; becomes abandoned after 24 hours",
  abandoned: "Three-Step Redirect timed out",
  failed: "Transaction failed",
  canceled: "Transaction voided",
  complete: "Transaction settled",
  unknown: "Unknown processing error",
};

// ---------------------------------------------------------------------------
// Classic Payment API response `type` enum: 16 values plus empty

export type TransactionTypeInfo = { meaning: string; stage: LifecycleStage };

export const TRANSACTION_TYPES: Readonly<Record<string, TransactionTypeInfo>> = {
  sale: { meaning: "Authorization flagged for settlement at once", stage: "payment" },
  auth: { meaning: "Authorization only; needs a capture", stage: "authorization" },
  validate: { meaning: "Account verification", stage: "other" },
  credit: { meaning: "Standalone credit", stage: "refund" },
  // Listed in the type enum; its semantics are not described.
  offline: { meaning: "Offline transaction (semantics not documented)", stage: "other" },
  capture: { meaning: "Capture of an earlier authorization", stage: "capture" },
  void: { meaning: "Cancels an unsettled sale or capture, or an uncaptured auth", stage: "void" },
  refund: {
    meaning: "Reverses a settled or pending-settlement transaction",
    stage: "refund",
  },
  complete_partial_payment: {
    meaning: "Complete partial payment (semantics not documented)",
    stage: "other",
  },
  add_invoice: { meaning: "Invoice added", stage: "other" },
  update_invoice: { meaning: "Invoice updated", stage: "other" },
  send_invoice: { meaning: "Invoice sent", stage: "other" },
  close_invoice: { meaning: "Invoice closed", stage: "other" },
  add_plan: { meaning: "Recurring plan added", stage: "subscription" },
  edit_plan: { meaning: "Recurring plan edited", stage: "subscription" },
  add_subscription: { meaning: "Recurring subscription added", stage: "subscription" },
};

// ---------------------------------------------------------------------------
// Merchant webhook event types: 36

export type EventFamily =
  "transaction" | "check" | "recurring" | "settlement" | "chargeback" | "acu";

export type EventTypeInfo = {
  family: EventFamily;
  stage: LifecycleStage;
  outcome: Outcome;
  source: string;
};

const TX_OPERATIONS: Readonly<Record<string, LifecycleStage>> = {
  sale: "payment",
  auth: "authorization",
  capture: "capture",
  void: "void",
  refund: "refund",
  credit: "refund",
  validate: "other",
};

const TX_RESULTS: Readonly<Record<string, Outcome>> = {
  success: "success",
  failure: "failure",
  unknown: "unknown",
};

function transactionEvents(): Record<string, EventTypeInfo> {
  const out: Record<string, EventTypeInfo> = {};
  for (const [op, stage] of Object.entries(TX_OPERATIONS)) {
    for (const [result, outcome] of Object.entries(TX_RESULTS)) {
      out[`transaction.${op}.${result}`] = {
        family: "transaction",
        stage,
        outcome,
        source: TRANSACTION_EVENTS_URL,
      };
    }
  }
  return out;
}

export const WEBHOOK_EVENT_TYPES: Readonly<Record<string, EventTypeInfo>> = {
  ...transactionEvents(),
  "transaction.check.status.settle": {
    family: "check",
    stage: "settlement",
    outcome: "success",
    source: CHECK_STATUS_URL,
  },
  "transaction.check.status.return": {
    family: "check",
    stage: "reversal",
    outcome: "failure",
    source: CHECK_STATUS_URL,
  },
  "transaction.check.status.latereturn": {
    family: "check",
    stage: "reversal",
    outcome: "failure",
    source: CHECK_STATUS_URL,
  },
  "recurring.plan.add": {
    family: "recurring",
    stage: "subscription",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "recurring.plan.update": {
    family: "recurring",
    stage: "subscription",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "recurring.plan.delete": {
    family: "recurring",
    stage: "subscription",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "recurring.subscription.add": {
    family: "recurring",
    stage: "subscription",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "recurring.subscription.update": {
    family: "recurring",
    stage: "subscription",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "recurring.subscription.delete": {
    family: "recurring",
    stage: "cancellation",
    outcome: "success",
    source: RECURRING_EVENTS_URL,
  },
  "settlement.batch.complete": {
    family: "settlement",
    stage: "settlement",
    outcome: "success",
    source: SETTLEMENT_EVENTS_URL,
  },
  "settlement.batch.failure": {
    family: "settlement",
    stage: "settlement",
    outcome: "failure",
    source: SETTLEMENT_EVENTS_URL,
  },
  "chargeback.batch.complete": {
    family: "chargeback",
    stage: "dispute",
    outcome: "unknown",
    source: CHARGEBACK_EVENTS_URL,
  },
  "acu.summary.automaticallyupdated": {
    family: "acu",
    stage: "other",
    outcome: "success",
    source: ACU_EVENTS_URL,
  },
  "acu.summary.contactcustomer": {
    family: "acu",
    stage: "other",
    outcome: "success",
    source: ACU_EVENTS_URL,
  },
  "acu.summary.closedaccount": {
    family: "acu",
    stage: "other",
    outcome: "success",
    source: ACU_EVENTS_URL,
  },
};

// ---------------------------------------------------------------------------
// REST API v5 errors (recognized, not analyzed)

/** Documented REST v5 error `type` values. */
export const REST_ERROR_TYPES: ReadonlySet<string> = new Set([
  "validationError",
  "authenticationError",
  "internalError",
]);
