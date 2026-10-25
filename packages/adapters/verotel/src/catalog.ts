/**
 * Verotel knowledge, kept as data. Every value comes from the verified research
 * file (docs/providers/high-risk/research/verotel.md), which cites Verotel's
 * public FlexPay v4 documentation, the Control Center API documentation, the
 * VerotelRUM description and the official FlexPay client libraries.
 *
 * Category and retry values are PandaPayLens mappings, not Verotel statements.
 * Verotel publishes no card decline code table and no FlexPay error code list.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

export const FLEXPAY_DOC_URL = "https://controlcenter.verotel.com/flexpay-doc/";
export const FLEXPAY_PURCHASE_URL = "https://controlcenter.verotel.com/flexpay-doc/purchase.html";
export const FLEXPAY_SUBSCRIPTION_URL =
  "https://controlcenter.verotel.com/flexpay-doc/subscription.html";
export const API_DOC_URL = "https://controlcenter.verotel.com/api-doc/index.html";
export const RUM_PDF_URL = "https://www.verotel.com/verotel_rumdescription_v0800_rev097.pdf";
export const FLEXPAY_V3_PDF_URL =
  "https://www.verotel.com/verotel_flexpay_apidescription_v0300_rev100.pdf";
export const UPGRADE_PDF_URL =
  "https://www.verotel.com/veroteldoc_FlexPayAPIv3.4SubscriptionUpgrade.pdf";
export const INTEGRATION_URL = "https://www.verotel.com/en/integration.html";
export const PRICECHART_URL = "https://www.verotel.com/en/pricechart.html";
export const PAYMENT_PROCESSING_URL = "https://www.verotel.com/en/paymentprocessing.html";
export const MERCHANT_AGREEMENT_URL = "https://www.verotel.com/en/merchantagreement.html";
export const HOME_URL = "https://www.verotel.com/";

// ---------------------------------------------------------------------------
// FlexPay postbacks (v4 docs, section 6.2 of the research)

/** Which amount fields a postback kind carries, and what they mean. */
export type AmountBasis =
  /** priceAmount / priceCurrency: the charged or reversed amount. */
  | "price"
  /** amount / currency on rebill: the rebilled amount. */
  | "rebill"
  /** initial: trialAmount when a trial is present, else priceAmount. */
  | "initial"
  /** downgrade: amount / currency is the new rebill price, not a charge. */
  | "new_price"
  | "none";

export type PostbackKind = {
  type: "purchase" | "subscription";
  /** `event` value; null for the purchase success postback, which has none. */
  event: string | null;
  stage: LifecycleStage;
  outcome: Outcome;
  isRecurring?: boolean;
  amount: AmountBasis;
  description: string;
  docs: string;
};

/**
 * Keyed by `type` for the purchase success postback (no `event`), otherwise
 * `type.event`. Outcomes describe the postback itself: Verotel sends postbacks
 * only for things that happened ("The postback is sent only for successfully
 * approved transactions"); declines produce no postback.
 */
export const POSTBACK_KINDS: Readonly<Record<string, PostbackKind>> = {
  purchase: {
    type: "purchase",
    event: null,
    stage: "payment",
    outcome: "success",
    isRecurring: false,
    amount: "price",
    description: "One-off purchase approved (success postback, sent without an event field).",
    docs: FLEXPAY_PURCHASE_URL,
  },
  "purchase.credit": {
    type: "purchase",
    event: "credit",
    stage: "refund",
    outcome: "success",
    amount: "price",
    description:
      "A purchase transaction was credited (refund by merchant, support or system, including automated refunds).",
    docs: FLEXPAY_PURCHASE_URL,
  },
  "purchase.chargeback": {
    type: "purchase",
    event: "chargeback",
    stage: "dispute",
    outcome: "unknown",
    amount: "price",
    description:
      "A purchase transaction was charged back. Verotel states this also blacklists the buyer.",
    docs: FLEXPAY_PURCHASE_URL,
  },
  "subscription.initial": {
    type: "subscription",
    event: "initial",
    stage: "payment",
    outcome: "success",
    isRecurring: false,
    amount: "initial",
    description: "First approved charge of a subscription (trial or full price).",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.rebill": {
    type: "subscription",
    event: "rebill",
    stage: "payment",
    outcome: "success",
    isRecurring: true,
    amount: "rebill",
    description: "Successful automatic rebill of a recurring subscription.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.extend": {
    type: "subscription",
    event: "extend",
    stage: "subscription",
    outcome: "success",
    amount: "none",
    description:
      "The subscription was extended: either the merchant or support added days, or the first rebill was declined with Rebill-retry enabled and the system extended it while retries run. The postback does not say which.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.downgrade": {
    type: "subscription",
    event: "downgrade",
    stage: "subscription",
    outcome: "success",
    amount: "new_price",
    description: "The merchant or support changed the price of the next rebill.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.cancel": {
    type: "subscription",
    event: "cancel",
    stage: "subscription",
    outcome: "success",
    amount: "none",
    description:
      "Future rebills were stopped by the buyer, merchant, support or system. The subscription stays active until expiresOn.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.uncancel": {
    type: "subscription",
    event: "uncancel",
    stage: "subscription",
    outcome: "success",
    amount: "none",
    description: "Support reverted a cancellation; rebills resume at nextChargeOn.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.expiry": {
    type: "subscription",
    event: "expiry",
    stage: "subscription",
    outcome: "success",
    amount: "none",
    description:
      "The subscription was terminated. The postback carries no reason: it can follow the end of a cancelled or one-time period, a declined rebill, or termination by support or the merchant.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.credit": {
    type: "subscription",
    event: "credit",
    stage: "refund",
    outcome: "success",
    amount: "price",
    description:
      "A transaction of the subscription was credited. Verotel states the refund also terminates the subscription, except for a partial credit without termination (subscriptionPhase=normal).",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.chargeback": {
    type: "subscription",
    event: "chargeback",
    stage: "dispute",
    outcome: "unknown",
    amount: "price",
    description:
      "A transaction of the subscription was charged back; the subscription is terminated and the buyer blacklisted.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
  "subscription.upgrade": {
    type: "subscription",
    event: "upgrade",
    stage: "subscription",
    outcome: "success",
    amount: "price",
    description:
      "The buyer switched plans. A new sale was created and the previous sale (precededBySaleID) was terminated without an expiry postback.",
    docs: FLEXPAY_SUBSCRIPTION_URL,
  },
};

/** The 10 documented `event` values. */
export const POSTBACK_EVENTS = [
  "initial",
  "rebill",
  "extend",
  "downgrade",
  "cancel",
  "uncancel",
  "expiry",
  "credit",
  "chargeback",
  "upgrade",
] as const;

export const POSTBACK_TYPES = ["purchase", "subscription"] as const;

// ---------------------------------------------------------------------------
// VerotelRUM (Remote User Manager) postbacks

export type RumCommand = {
  stage: LifecycleStage;
  outcome: Outcome;
  isRecurring?: boolean;
  /** Commands that stand for one Verotel transaction. */
  transactional: boolean;
  description: string;
};

export const RUM_COMMANDS: Readonly<Record<string, RumCommand>> = {
  add: {
    stage: "payment",
    outcome: "success",
    isRecurring: false,
    transactional: true,
    description:
      "New one-time or initial recurring transaction; the merchant script is asked to grant access.",
  },
  rebill: {
    stage: "payment",
    outcome: "success",
    isRecurring: true,
    transactional: true,
    description: "Recurring rebill of a membership.",
  },
  cancel: {
    stage: "subscription",
    outcome: "success",
    transactional: false,
    description: "Rebills were stopped for the membership.",
  },
  modify: {
    stage: "subscription",
    outcome: "success",
    transactional: false,
    description: "The member's passcode was changed.",
  },
  delete: {
    stage: "subscription",
    outcome: "success",
    transactional: false,
    description: "The member's access is to be removed.",
  },
};

/** Merchant answers to a RUM postback, as documented. */
export const RUM_RESPONSES: Readonly<Record<string, string>> = {
  APPROVED: "The merchant script completed the command.",
  DECLINED:
    "The merchant script could not complete the command. Verotel retries the postback two more times within 20 minutes, then marks it failed and refunds the debit.",
  ERROR:
    "The merchant script had a technical failure. Verotel retries the postback two more times within 20 minutes, then marks it failed and refunds the debit.",
};

// ---------------------------------------------------------------------------
// Control Center API errors (version 2.0.0; match on HTTP status + title)

export type CatalogEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  confidence: Confidence;
};

export type ApiErrorEntry = CatalogEntry & {
  id: string;
  status: number;
  /** Title exactly as published, including typos. */
  title: string;
  /** Lenient match: trailing period optional, placeholders as wildcards. */
  match: RegExp;
};

const CLIENT_SIDE =
  "Verotel rejected the request before acting on it. Sending the same request again will fail the same way.";

export const API_ERRORS: readonly ApiErrorEntry[] = [
  {
    id: "unauthorized",
    status: 401,
    title: "Unauthorized",
    match: /^Unauthorized\.?$/i,
    meaning: "Basic auth credentials missing or wrong",
    category: "configuration",
    retry: "do_not_retry",
    explanation:
      "The Control Center API did not accept the Basic authentication credentials (API user name and password).",
    nextAction:
      "Check the API user and password configured for the Control Center API. Do not paste the Authorization header anywhere: Basic credentials are only Base64-encoded.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "version_missing",
    status: 406,
    title: "Version must be specified in Accept header",
    match: /^Version must be specified in Accept header\.?$/i,
    meaning: "Accept header lacks version=MAJOR.MINOR.PATCH",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "The Accept header did not name an API version. The Control Center API requires a header such as Accept: application/json; version=2.0.0.",
    nextAction: "Send Accept: application/json; version=2.0.0 (or another documented version).",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "accept_unsupported",
    status: 406,
    title: "Cannot process request for accept header: <value>",
    match: /^Cannot process request for accept header:/i,
    meaning: "Unsupported media type or version",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "The Accept header names a media type or version the Control Center API does not support. Only JSON is supported.",
    nextAction: "Send Accept: application/json with a documented version (1.1.0 to 2.0.0).",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "sale_not_approved",
    status: 412,
    title: 'Invalid parameter "sale_id": Sale is not approved',
    match: /^Invalid parameter "?sale_id"?: Sale is not approved\.?$/i,
    meaning: "Cancel attempted on a sale that was never approved",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "The action was attempted on a sale that was never approved, so there is nothing to cancel.",
    nextAction: "Check the sale with GET /sale/:id; a declined sale needs no cancellation.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "rebill_retry_period",
    status: 412,
    title: "Cancel rebilling is disabled during rebill retry period.",
    match: /^Cancel rebilling is disabled during rebill retry period\.?$/i,
    meaning: "Sale is in rebill-retry; cancel is blocked for now",
    category: "invalid_request",
    retry: "retry_conditionally",
    explanation:
      "The subscription is in its rebill-retry period (a rebill was declined and Verotel is retrying it), and cancelling rebills is blocked during that period.",
    nextAction:
      "Wait until the rebill-retry period has ended, then check the sale with GET /sale/:id before cancelling again.",
    retryExplanation:
      "The cancel may succeed after the retry period. Check the sale state first: the subscription may already have been rebilled or terminated by then.",
    confidence: "strong",
  },
  {
    id: "not_cancellable",
    status: 412,
    title: "This sale is not a subscription / is not recurring / is already cancelled.",
    match:
      /^(?:This sale (?:is not a subscription|is not recurring|is already cancelled)|Sale already cancelled)/i,
    meaning: "Cancel not applicable (may mean the goal is already reached)",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "Cancelling is not applicable to this sale: it is not a subscription, not recurring, or already cancelled. In the last case the intended result is already in place.",
    nextAction:
      "Check the sale with GET /sale/:id; if it is already cancelled, nothing more is needed.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "parameter_required",
    status: 412,
    title: "Paramter xxx is required",
    // Published with the typo "Paramter"; also accept the corrected spelling.
    match: /^Parame?ter\s+\S.*\s+is required\.?$/i,
    meaning: "Missing query parameter",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "A required parameter is missing from the request.",
    nextAction: "Add the parameter named in the title and send a corrected request.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "invalid_parameters",
    status: 412,
    title: "Invalid parameters: xxx, yyy",
    match: /^Invalid parameters:/i,
    meaning: "Unknown or malformed query parameters",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "The request contains unknown or malformed parameters.",
    nextAction: "Remove or correct the parameters named in the title.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "invalid_date_range",
    status: 412,
    title: "Invalid date range",
    match: /^Invalid date range\.?$/i,
    meaning: "Date filters invalid",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "The date filters of the request form an invalid range.",
    nextAction: "Correct the date filters.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  {
    id: "refund_failed",
    status: 412,
    title: "Failed to refund the transaction.",
    match: /^Failed to refund the transaction\.?$/i,
    meaning: "Refund refused",
    category: "invalid_request",
    retry: "manual_review",
    explanation:
      'Verotel refused the refund. The documentation gives example causes such as "Transaction has linker / too large partial refund amount etc."; the response does not say which applies.',
    nextAction:
      "Check the transaction with GET /transaction/:id (reversal_extent, reversals and the amount already refunded) before deciding on another refund.",
    retryExplanation:
      "Do not repeat the refund automatically. Review the transaction first so the buyer is not refunded twice.",
    confidence: "strong",
  },
  {
    id: "rate_limited",
    status: 429,
    title: "Rate limit exceeded",
    match: /^Rate limit exceeded\.?$/i,
    meaning: "Over 500 requests per hour",
    category: "rate_limiting",
    retry: "safe_to_retry_technical_request",
    explanation:
      "The Control Center API rate limit was exceeded: 500 requests per hour per customer, shared by all API users of the account.",
    nextAction:
      "Wait for the time given in the Retry-After header and reduce the request rate; X-RateLimit-Remaining shows what is left.",
    retryExplanation:
      "The request was rejected by the rate limiter and not executed, so it can be sent again after Retry-After.",
    confidence: "strong",
  },
];

/**
 * HTTP status meanings from the API overview, used when the title is not one
 * of the published titles (404 and the 5000-record cap have no published
 * title at all).
 */
export const API_STATUS_FALLBACK: Readonly<Record<string, CatalogEntry>> = {
  "401": {
    meaning: "Authorization error",
    category: "configuration",
    retry: "do_not_retry",
    explanation: "The Control Center API reports an authorization error (HTTP 401).",
    nextAction: "Check the API user and password configured for the Control Center API.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  "404": {
    meaning: "Object does not exist",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "The requested sale, transaction or website does not exist (HTTP 404), or is not visible to this API user.",
    nextAction: "Check the id in the request path and that it belongs to this account.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  "406": {
    meaning: "Content negotiation error",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation:
      "The Control Center API reports a content negotiation error (HTTP 406), for example a missing or unsupported version in the Accept header.",
    nextAction: "Send Accept: application/json; version=2.0.0.",
    retryExplanation: CLIENT_SIDE,
    confidence: "strong",
  },
  "412": {
    meaning: "Missing parameters or application error",
    category: "invalid_request",
    retry: "manual_review",
    explanation:
      "The Control Center API reports missing parameters or an application error (HTTP 412). The title is not one of the published titles; HTTP 412 is also returned, without a published title, when a list query exceeds the 5000-record cap.",
    nextAction:
      "Read the title. For list endpoints, narrow the date filters so that fewer than 5000 records match.",
    retryExplanation:
      "Whether a changed request can succeed depends on the cause, which the published documentation does not identify for this title.",
    confidence: "possible",
  },
  "429": {
    meaning: "Rate limit",
    category: "rate_limiting",
    retry: "safe_to_retry_technical_request",
    explanation:
      "The Control Center API rate limit was exceeded (500 requests per hour per customer, shared by all API users).",
    nextAction: "Wait for the time given in the Retry-After header and reduce the request rate.",
    retryExplanation:
      "The request was rejected by the rate limiter and not executed, so it can be sent again after Retry-After.",
    confidence: "strong",
  },
};

// ---------------------------------------------------------------------------
// Messages inside HTTP 200 action responses

export type InBodyMessage = CatalogEntry & { id: string; message: string; match: RegExp };

export const IN_BODY_MESSAGES: readonly InBodyMessage[] = [
  {
    id: "terminate_rum_setup",
    message: "Action cannot be performed. Please review Verotel Remote user management setup.",
    match: /^Action cannot be performed\. Please review .{0,40}Remote user management setup\.?$/i,
    meaning: "Termination failed because the merchant's RUM/postback setup does not accept it",
    category: "configuration",
    retry: "manual_review",
    explanation:
      "The termination was not performed (is_success=false): the merchant's Remote User Management or postback setup did not accept it.",
    nextAction:
      "Review the Remote User Management and postback settings of the website in the Control Center, then check the sale with GET /sale/:id.",
    retryExplanation:
      "Fix the setup first; repeating the request unchanged will fail the same way.",
    confidence: "strong",
  },
  {
    id: "refund_access_postback_failed",
    message: "Postback terminating website access failed.",
    match: /^Postback terminating website access failed\.?$/i,
    meaning: "Refund done, but the access-removal postback to the merchant failed",
    category: "configuration",
    retry: "manual_review",
    explanation:
      "The refund succeeded (is_success=true), but the postback that should have removed the buyer's website access failed.",
    nextAction:
      "Remove the buyer's access manually and check that the postback URL answers HTTP 200 with body OK.",
    retryExplanation:
      "Do not repeat the refund: it already succeeded. Only the access removal needs attention.",
    confidence: "strong",
  },
];

// ---------------------------------------------------------------------------
// Decline reasons (`decline_reason` on a Control Center API transaction)

export const DECLINE_REASONS: Readonly<Record<string, CatalogEntry>> = {
  NO_FUNDS: {
    meaning: "Insufficient funds",
    category: "insufficient_funds",
    retry: "customer_action_required",
    explanation: "The transaction was declined for insufficient funds.",
    nextAction: "Ask the buyer to use another payment method or to make sure funds are available.",
    retryExplanation:
      "Retrying the same payment method without a change by the buyer is unlikely to succeed.",
    confidence: "strong",
  },
};

// ---------------------------------------------------------------------------
// Enumerations used to validate values before they are shown

export const TRANSACTION_TYPES: Readonly<Record<string, { stage: LifecycleStage }>> = {
  DEBIT: { stage: "payment" },
  CREDIT: { stage: "refund" },
  CHARGEBACK: { stage: "dispute" },
};

/** Values documented; their meanings are NOT documented. */
export const TRANSACTION_SUBTYPES = [
  "ONETIME",
  "WALLET",
  "PURCHASE",
  "INITREC",
  "RECURRED",
  "CREDIT",
  "CHBACK",
] as const;

export const REVERSAL_EXTENTS = ["NONE", "PARTIAL", "FULL"] as const;
export const REVERSAL_TYPES = ["REFUND", "CHARGEBACK"] as const;
export const API_PAYMENT_METHODS = [
  "CC",
  "DDUS",
  "DDEU",
  "PHEU",
  "BTC",
  "PHUS",
  "PMB",
  "AT",
  "SMS",
  "SOFORT",
] as const;
export const INSTRUMENT_TYPES = [
  "BANK_ACCOUNT",
  "CREDIT_CARD",
  "BITCOIN_WALLET",
  "PHONE_NUMBER",
  "CHECK",
] as const;
export const SALE_TYPES = ["PURCHASE", "SUBSCRIPTION"] as const;
export const FLEXPAY_PAYMENT_METHODS = ["CC", "DDEU", "YOURSAFE_DIRECT", "IDEAL", "BTC"] as const;
export const CANCELLED_BY = ["user", "support", "merchant", "system"] as const;
export const UNCANCELLED_BY = ["support"] as const;
export const SUBSCRIPTION_PHASES = ["trial", "normal", "discounted", "terminated"] as const;
export const SUBSCRIPTION_TYPES = ["one-time", "recurring"] as const;

/** FlexPay protocol versions used in requests (postbacks carry no version). */
export const FLEXPAY_VERSIONS = ["3", "3.2", "3.3", "3.4", "4"] as const;

/** Request paths documented for FlexPay brand hosts. */
export const FLEXPAY_REQUEST_PATHS = [
  "/startorder",
  "/cancel-subscription",
  "/status/order",
  "/salestatus",
] as const;
