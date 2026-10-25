/**
 * DECTA code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/decta.md, which
 * cites DECTA's public documentation portal and the Decta Gate API OpenAPI
 * file (v0.6), verified 2026-10-25:
 *
 * Raw acquirer response codes: https://docs.decta.com/Useful-Information/response-codes/
 * Webhook event types:         https://docs.decta.com/Integration/webhooks/
 * Order statuses:              https://docs.decta.com/Payments/general-payment-flow/
 * Merchant Advice Codes, AVS:  https://docs.decta.com/Payments/after-the-payment/
 * 3-D Secure step responses:   https://docs.decta.com/Integration/3ds-authentication/
 * OpenAPI (schemas, errors):   https://gate.decta.com/api-docs/api_documentation.yaml
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file. DECTA's own guidance is that the
 * cardholder contacts the issuer for 1xx and 2xx refusals and that the
 * merchant contacts DECTA technical support for 9xx codes.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.decta.com";
export const RESPONSE_CODES_URL = `${DOCS}/Useful-Information/response-codes/`;
export const WEBHOOKS_URL = `${DOCS}/Integration/webhooks/`;
export const PAYMENT_FLOW_URL = `${DOCS}/Payments/general-payment-flow/`;
export const AFTER_PAYMENT_URL = `${DOCS}/Payments/after-the-payment/`;
export const THREE_DS_URL = `${DOCS}/Integration/3ds-authentication/`;
export const INTEGRATION_OPTIONS_URL = `${DOCS}/Integration/integration-options/`;
export const TESTING_URL = `${DOCS}/Integration/testing-and-going-live/`;
export const SIMPLE_SCENARIOS_URL = `${DOCS}/Payments/simple-payment-scenarios/`;
export const RECURRING_URL = `${DOCS}/Payments/recurring-payment-scenarios/`;
export const PAYOUT_URL = `${DOCS}/Payments/payout-scenarios/`;
export const PAYMENT_METHODS_URL = `${DOCS}/Payments/payment-methods/`;
export const BEST_PRACTICES_URL = `${DOCS}/Useful-Information/api-best-practices-and-performance/`;
export const SECURITY_URL = `${DOCS}/Useful-Information/security/`;
export const API_DOCS_URL = "https://gate.decta.com/api-docs/";
export const OPENAPI_URL = "https://gate.decta.com/api-docs/api_documentation.yaml";
export const DOCS_INDEX_URL = `${DOCS}/`;

/** How a raw acquirer code relates to the outcome of the operation that carries it. */
export type CodeKind = "success" | "partial" | "pending" | "decline";

/** DECTA's own status group column of the response code table. */
export type CodeGroup =
  | "Approved"
  | "Decline"
  | "Decline no funds"
  | "Pick-up"
  | "Accepted"
  | "Call acquirer"
  | "Not accepted"
  | "Special";

export type CodeEntry = {
  meaning: string;
  group: CodeGroup;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** The documentation gives several possible meanings; decoded with possible confidence. */
  ambiguous?: true;
  note?: string;
};

const approved = (meaning: string): CodeEntry => ({
  meaning,
  group: "Approved",
  kind: "success",
  category: "unknown",
  retry: "unknown",
});
const partial = (meaning: string): CodeEntry => ({
  meaning,
  group: "Approved",
  kind: "partial",
  category: "unknown",
  retry: "manual_review",
});
const decline = (
  group: CodeGroup,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<Pick<CodeEntry, "ambiguous" | "note">> = {},
): CodeEntry => ({ meaning, group, kind: "decline", category, retry, ...extra });
const d = (meaning: string, category: ErrorCategory, retry: RetryGuidance) =>
  decline("Decline", meaning, category, retry);
const pickUp = (meaning: string, category: ErrorCategory) =>
  decline("Pick-up", meaning, category, "do_not_retry");
const call = (meaning: string, category: ErrorCategory, retry: RetryGuidance) =>
  decline("Call acquirer", meaning, category, retry);

/** Raw Acquirer Response Codes (83), found in transaction_details.processing_status.code. */
export const RAW_ACQUIRER_CODES: Record<string, CodeEntry> = {
  "000": approved("Approved"),
  "001": approved("Approved with identification"),
  "002": partial("Approved for a partial amount"),
  "003": approved("Approved (VIP)"),
  "004": approved("Approved, update track 3"),
  "005": approved("Approved, issuer specified account type"),
  "006": partial("Partial amount approved, issuer specified account type"),
  "007": approved("Approved, update ICC"),
  "100": d("Generic decline", "card_declined", "customer_action_required"),
  "101": d("Expired card", "card_declined", "customer_action_required"),
  "102": d("Suspected fraud", "fraud_or_risk", "do_not_retry"),
  "103": d("Merchant should contact the acquirer", "configuration", "manual_review"),
  "104": d("Restricted card", "card_declined", "do_not_retry"),
  "105": d("Merchant should call acquirer security", "fraud_or_risk", "manual_review"),
  "106": d("PIN tries exceeded", "authentication_failed", "do_not_retry"),
  "107": d("Refer to issuer", "card_declined", "customer_action_required"),
  "108": d("Refer to issuer, special conditions", "card_declined", "customer_action_required"),
  "109": d("Invalid merchant", "configuration", "do_not_retry"),
  "110": d("Invalid amount", "invalid_amount", "do_not_retry"),
  "111": d("Invalid card number", "card_declined", "customer_action_required"),
  "112": d("PIN required", "authentication_required", "customer_action_required"),
  "113": d("Fee not acceptable", "invalid_amount", "do_not_retry"),
  "114": d("No account of the requested type", "card_declined", "customer_action_required"),
  "115": d("Function not supported", "payment_method_unavailable", "do_not_retry"),
  "116": decline(
    "Decline no funds",
    "Insufficient funds",
    "insufficient_funds",
    "customer_action_required",
  ),
  "117": d("Wrong PIN", "authentication_failed", "customer_action_required"),
  "118": d("No card record", "card_declined", "do_not_retry"),
  "119": d("Not permitted for this cardholder", "card_declined", "do_not_retry"),
  "120": d("Not permitted for this terminal", "card_declined", "do_not_retry"),
  "121": d("Over the withdrawal amount limit", "card_declined", "customer_action_required"),
  "122": d("Security violation", "fraud_or_risk", "do_not_retry"),
  "123": d("Over the withdrawal frequency limit", "card_declined", "customer_action_required"),
  "124": d("Violation of law", "card_declined", "do_not_retry"),
  "125": d("Card not yet effective", "card_declined", "customer_action_required"),
  "126": d("Invalid PIN block", "configuration", "manual_review"),
  "127": d("PIN length error", "authentication_failed", "customer_action_required"),
  "128": d("PIN key synchronization error", "configuration", "manual_review"),
  "129": d("Suspected counterfeit card", "fraud_or_risk", "do_not_retry"),
  "160": d(
    "Additional customer authentication required (soft decline)",
    "authentication_required",
    "customer_action_required",
  ),
  "162": d("Lifecycle violation", "card_declined", "customer_action_required"),
  "163": d("Policy violation", "card_declined", "customer_action_required"),
  "164": d("Fraud or security violation", "fraud_or_risk", "do_not_retry"),
  "165": d("Not supported or blocked by the issuer", "card_declined", "do_not_retry"),
  "169": d("Blocked by the cardholder", "card_declined", "customer_action_required"),
  "180": d("Declined at the cardholder's request", "card_declined", "do_not_retry"),
  "197": d("Call AmEx", "card_declined", "manual_review"),
  "198": decline("Decline", "Call the card processing centre", "unknown", "manual_review", {
    ambiguous: true,
  }),
  "200": pickUp("Pick-up, no reason given", "card_declined"),
  "201": pickUp("Pick-up, expired card", "card_declined"),
  "202": pickUp("Pick-up, suspected fraud", "fraud_or_risk"),
  "203": pickUp("Pick-up, contact the acquirer", "card_declined"),
  "204": pickUp("Pick-up, restricted card", "card_declined"),
  "205": pickUp("Pick-up, call acquirer security", "fraud_or_risk"),
  "206": pickUp("Pick-up, PIN tries exceeded", "authentication_failed"),
  "207": pickUp("Pick-up, special conditions", "fraud_or_risk"),
  "208": pickUp("Pick-up, lost card", "fraud_or_risk"),
  "209": pickUp("Pick-up, stolen card", "fraud_or_risk"),
  "210": pickUp("Pick-up, suspected counterfeit card", "fraud_or_risk"),
  "400": {
    meaning: "Accepted (reversal)",
    group: "Accepted",
    kind: "success",
    category: "unknown",
    retry: "unknown",
  },
  "902": call("Invalid transaction", "invalid_request", "do_not_retry"),
  "903": call("Re-enter transaction", "provider_unavailable", "retry_conditionally"),
  "904": call("Format error", "invalid_request", "manual_review"),
  "905": call("Acquirer not supported by the switch", "configuration", "manual_review"),
  "906": call("Cutover in progress", "provider_unavailable", "retry_conditionally"),
  "907": call("Issuer or switch inoperative", "provider_unavailable", "retry_conditionally"),
  "908": call("No routing destination", "configuration", "manual_review"),
  "909": call("System malfunction", "provider_unavailable", "retry_conditionally"),
  "910": call("Issuer signed off", "provider_unavailable", "retry_conditionally"),
  "911": call("Issuer timed out", "network_or_timeout", "retry_conditionally"),
  "912": call("Issuer unavailable", "provider_unavailable", "retry_conditionally"),
  "913": call("Duplicate transmission", "duplicate_request", "do_not_retry"),
  "914": call("Original transaction not traceable", "invalid_request", "manual_review"),
  "915": call(
    "Reconciliation cutover or checkpoint error",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "916": call("MAC incorrect", "configuration", "manual_review"),
  "917": call("MAC key synchronization error", "configuration", "manual_review"),
  "918": call("No communication keys available", "configuration", "manual_review"),
  "919": call("Encryption key synchronization error", "configuration", "manual_review"),
  "920": call(
    "Security hardware or software error, retry allowed",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "921": call(
    "Security hardware or software error, no action",
    "provider_unavailable",
    "manual_review",
  ),
  "922": call("Message out of sequence", "network_or_timeout", "retry_conditionally"),
  "923": {
    meaning: "Request in progress",
    group: "Call acquirer",
    kind: "pending",
    category: "unknown",
    retry: "do_not_retry",
  },
  "950": decline(
    "Not accepted",
    "Violation of business arrangement",
    "configuration",
    "manual_review",
  ),
  "951": decline("Not accepted", "Limit exceeded", "unknown", "manual_review", {
    ambiguous: true,
    note: "DECTA does not say whether the merchant's or the card's limit was exceeded.",
  }),
};

/**
 * Special gateway code. DECTA lists several causes (most likely an expired
 * card) and does not document the field that carries it.
 */
export const SPECIAL_CODES: Record<string, CodeEntry> = {
  "-1": decline(
    "Special",
    "Several possible causes, most likely an expired card",
    "card_declined",
    "manual_review",
    {
      ambiguous: true,
      note: "DECTA lists several causes for this code and advises contacting support if the card is valid.",
    },
  ),
};

/** Guidance DECTA gives per status group. */
export const GROUP_GUIDANCE: Record<CodeGroup, string | undefined> = {
  Approved: undefined,
  Accepted: undefined,
  Decline: "DECTA's guidance for refusals: the cardholder should contact the card issuer.",
  "Decline no funds":
    "DECTA's guidance for refusals: the cardholder should contact the card issuer.",
  "Pick-up": "DECTA's guidance for refusals: the cardholder should contact the card issuer.",
  "Call acquirer":
    "DECTA's guidance for 9xx codes: the merchant should contact DECTA technical support.",
  "Not accepted":
    "DECTA's guidance for 9xx codes: the merchant should contact DECTA technical support.",
  Special: undefined,
};

export type AdviceEntry = { meaning: string; retry: RetryGuidance };

/** Mastercard Merchant Advice Codes in transaction_details.merchant_advice_code (5). */
export const MERCHANT_ADVICE_CODES: Record<string, AdviceEntry> = {
  "01": { meaning: "New account information available", retry: "customer_action_required" },
  "02": { meaning: "Cannot approve at this time, try again later", retry: "retry_conditionally" },
  "03": {
    meaning: "Do not try again (DECTA: the account is closed or fraudulent)",
    retry: "do_not_retry",
  },
  "04": {
    meaning: "Token requirements not met for this token type (a configuration issue)",
    retry: "do_not_retry",
  },
  "21": {
    meaning: "Payment cancelled via Mastercard PCS (the cardholder cancelled the agreement)",
    retry: "do_not_retry",
  },
};

/** AVS result letters in avs_status.avs_status (18). DECTA makes no automatic decision on them. */
export const AVS_CODES: ReadonlySet<string> = new Set([
  "A",
  "B",
  "C",
  "D",
  "F",
  "G",
  "I",
  "M",
  "N",
  "P",
  "R",
  "S",
  "T",
  "U",
  "W",
  "X",
  "Y",
  "Z",
]);

/** card_name_validation result values. */
export const NAME_VALIDATION_VALUES: ReadonlySet<string> = new Set([
  "full_match",
  "partial_match",
  "no_match",
]);

/** payment_system values on an order. */
export const PAYMENT_SYSTEMS: ReadonlySet<string> = new Set(["SMS", "DMS", "AUTH"]);

export type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  description: string;
  /** DECTA documents the value but not what it means. */
  meaningUndocumented?: true;
  /** DECTA states whether the status is final. */
  final?: boolean;
};

const st = (
  stage: LifecycleStage,
  outcome: Outcome,
  description: string,
  extra: Partial<Pick<StatusInfo, "meaningUndocumented" | "final">> = {},
): StatusInfo => ({ stage, outcome, description, ...extra });

/**
 * Order.status values (15 in the OpenAPI enum) plus the two values that only
 * StatusChange.new_status adds (created, reversed). The documentation's
 * status table has further labels (Refund initiated, Representation, ...)
 * whose wire values are not documented, so they are not listed here.
 */
export const ORDER_STATUSES: Record<string, StatusInfo> = {
  draft: st("other", "pending", "Order draft, not issued yet"),
  issued: st("payment", "pending", "Order issued and awaiting payment"),
  viewed: st("payment", "pending", "Payment page viewed by the customer"),
  in_progress: st("payment", "pending", "Payment in progress"),
  overdue: st("payment", "pending", "Order overdue but still payable"),
  hold: st("authorization", "success", "Amount held (two-step payment awaiting capture or cancel)"),
  paid: st("payment", "success", "Order paid"),
  received: st("payment", "success", "Payment received outside the gateway"),
  failed: st("payment", "failure", "Payment attempt failed; further attempts are allowed", {
    final: false,
  }),
  rejected: st("payment", "failure", "Order rejected", { final: true }),
  expired: st("payment", "failure", "Order expired and is no longer payable"),
  cancelled: st("cancellation", "success", "Order cancelled", { final: true }),
  refunded: st("refund", "success", "Order refunded"),
  chargeback: st("dispute", "unknown", "Chargeback received"),
  withdrawn: st("other", "unknown", "Withdrawn", { meaningUndocumented: true }),
  created: st("other", "pending", "Order created"),
  reversed: st("reversal", "success", "Payment reversed"),
};

/** Values of Order.status itself (without the StatusChange-only additions). */
export const ORDER_STATUS_ENUM: ReadonlySet<string> = new Set(
  Object.keys(ORDER_STATUSES).filter((s) => s !== "created" && s !== "reversed"),
);

export type WebhookEventInfo = {
  object: "order" | "oct" | "card";
  stage: LifecycleStage;
  outcome: Outcome;
  description: string;
};

const ev = (
  object: WebhookEventInfo["object"],
  stage: LifecycleStage,
  outcome: Outcome,
  description: string,
): WebhookEventInfo => ({ object, stage, outcome, description });

/**
 * v0.6 webhook event types (31), sent in the X-Webhook-Event header. Two
 * names are printed with a space in the documentation and are kept exactly
 * as documented.
 */
export const WEBHOOK_EVENTS: Record<string, WebhookEventInfo> = {
  "order.issued": ev("order", "payment", "pending", "Order issued"),
  "order.payment_success": ev("order", "payment", "success", "Payment succeeded"),
  "order.payment_failure": ev("order", "payment", "failure", "Payment failed"),
  "order.hold": ev("order", "authorization", "success", "Amount held (two-step payment)"),
  "order.canceled": ev("order", "cancellation", "success", "Order cancelled"),
  "order.in_progress": ev("order", "payment", "pending", "Payment in progress"),
  "order.invoice_viewed": ev("order", "payment", "pending", "Payment page viewed"),
  "order.invoice_refunded": ev("order", "refund", "success", "Order refunded"),
  "order.invoice_reversal": ev("order", "reversal", "success", "Payment reversed"),
  "order.refund_failure": ev("order", "refund", "failure", "Refund failed"),
  "order.invoice_refund_reversed": ev(
    "order",
    "reversal",
    "unknown",
    "Refund reversed (the financial effect is not described)",
  ),
  "order.refund_init_failure": ev("order", "refund", "failure", "Refund initiation failed"),
  "order.reversal_init_failure": ev("order", "reversal", "failure", "Reversal initiation failed"),
  "order.reversal_failure": ev("order", "reversal", "failure", "Reversal failed"),
  "order.refund_in _progress": ev("order", "refund", "pending", "Refund in progress"),
  "order.reversal_in _progress": ev("order", "reversal", "pending", "Reversal in progress"),
  "order.received": ev("order", "payment", "success", "Payment received outside the gateway"),
  "order.rejected": ev("order", "payment", "failure", "Order rejected"),
  "order.expired": ev("order", "payment", "failure", "Order expired"),
  "order.chargeback": ev("order", "dispute", "unknown", "Chargeback received"),
  "order.representation": ev("order", "dispute", "unknown", "Chargeback representation"),
  "order.retrieval": ev("order", "dispute", "unknown", "Retrieval request"),
  "order.pre-arbitration": ev("order", "dispute", "unknown", "Pre-arbitration"),
  "order.good_faith": ev("order", "dispute", "unknown", "Good faith case"),
  "order.fraud_advice": ev("order", "dispute", "unknown", "Fraud advice"),
  "oct.issued": ev("oct", "payout", "pending", "Payout (OCT) issued"),
  "oct.success": ev("oct", "payout", "success", "Payout (OCT) succeeded"),
  "oct.failure": ev("oct", "payout", "failure", "Payout (OCT) failed"),
  "card.created": ev("card", "other", "unknown", "Saved card created"),
  "card.deleted": ev("card", "other", "unknown", "Saved card deleted"),
  "card.updated": ev("card", "other", "unknown", "Saved card updated"),
};

/** Deprecated v0.5 webhook events; their body is not documented. */
export const LEGACY_WEBHOOK_EVENTS: ReadonlySet<string> = new Set([
  "transfer.withdrawn",
  "payment.created",
  "payment.paid",
  "payment.failed",
  "payment.hold",
  "payment.canceled",
  "invoice.viewed",
  "invoice.canceled",
]);

/** Host2Host manual 3-D Secure step statuses. */
export const TDS_STATUSES: Record<string, { description: string }> = {
  tds_initiated: { description: "3-D Secure started" },
  tds_pending: { description: "3-D Secure waiting for the customer or the issuer" },
  tds_completed: { description: "3-D Secure step completed" },
};

/** next_step values of the manual 3-D Secure flow (null means no further step). */
export const TDS_NEXT_STEPS: ReadonlySet<string> = new Set(["enrollment_request", "tds_validate"]);

/** mdstatus values with a documented meaning. Others (for example 1 and 9) are not defined. */
export const MDSTATUS_MEANINGS: Record<string, string> = {
  "50": "Perform the 3DS method",
  "51": "3DS method not needed",
};

export type MessageEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** True when the operation's outcome is reported as definite. */
  outcomeKnown: boolean;
  url: string;
};

/**
 * Error texts that DECTA documents, matched exactly (ignoring case and
 * surrounding whitespace). The field that carries them is not documented, so
 * matches are decoded with possible confidence.
 */
export const DOCUMENTED_MESSAGES: Record<string, MessageEntry> = {
  "operation timed out": {
    meaning:
      "3-D Secure was abandoned; DECTA fails the order 15 minutes after an unfinished authentication",
    category: "authentication_failed",
    retry: "customer_action_required",
    outcomeKnown: true,
    url: THREE_DS_URL,
  },
  "refund initiation is declined because of rdr value": {
    meaning: "Refund refused because a chargeback (RDR) was already received for the payment",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: DOCS_INDEX_URL,
  },
  "invalid order status": {
    meaning: "The order's status does not allow this operation",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "invalid order status or refund timeout": {
    meaning:
      "The order's status does not allow a refund, or the refund window (two years) has passed",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "invalid order status or reverse timeout": {
    meaning:
      "The order's status does not allow a reversal, or the reversal window (same day) has passed",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "invalid input or order status": {
    meaning: "The request data or the order's status does not allow this operation",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "invalid order": {
    meaning: "The order is not valid for this operation",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "account disabled!": {
    meaning: "The merchant account is disabled",
    category: "configuration",
    retry: "manual_review",
    outcomeKnown: true,
    url: OPENAPI_URL,
  },
  "error during payment processing": {
    meaning: "An error occurred while the payment was processed",
    category: "unknown",
    retry: "manual_review",
    outcomeKnown: false,
    url: OPENAPI_URL,
  },
};

/** HTTP statuses documented for the Gate API. */
export const HTTP_STATUSES: Record<number, string> = {
  200: "success (for payments this does not mean the payment succeeded)",
  201: "order created",
  204: "deleted",
  400: "missing mandatory parameters or an invalid request",
  403: "wrong token",
  404: "not found",
};

/** Error code that appears in DECTA's validation error examples. */
export const VALIDATION_CODES: Record<string, string> = {
  invalid: "The field value is invalid",
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer, complete authentication, or use another card or payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first confirm the final order status with the webhook or GET order, because the original operation may already have been processed. DECTA states that the webhook is the only way to receive the correct payment status.",
  safe_to_retry_technical_request:
    "The request can be sent again. If you are not sure the earlier request was rejected, check the order status first.",
  manual_review:
    "Review the order manually, or ask DECTA support, before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Send the payment again with strong customer authentication (3-D Secure).",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another payment method.",
  invalid_request: "Correct the request data or check the order's status before a new request.",
  invalid_amount: "Check the amount, currency and the limits that apply to this operation.",
  insufficient_funds:
    "Ask the customer to use another payment method, or to contact their card issuer.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the payment and the risk outcome before any new attempt.",
  rate_limiting: "Wait before a new attempt.",
  provider_unavailable:
    "Confirm the order status with the webhook or GET order before sending a new request, and contact DECTA technical support if the code persists.",
  network_or_timeout:
    "Confirm the order status with the webhook or GET order before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the terminal, merchant and key configuration, or contact DECTA technical support with the order id.",
  unknown: "Check the order in the DECTA dashboard or ask DECTA support.",
};
