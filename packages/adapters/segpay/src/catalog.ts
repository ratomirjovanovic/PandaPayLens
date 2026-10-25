/**
 * Segpay code and status knowledge, kept as data.
 *
 * Every code below comes from docs/providers/high-risk/research/segpay.md,
 * which cites the Segpay documentation pages linked in the URL constants.
 * Category and retry values are PandaPayLens interpretations of the
 * documented meanings; where Segpay gives retry advice it is reflected.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://gethelp.segpay.com/docs/Content/";

export const POSTBACKS_URL = `${DOCS}DeveloperDocs/ProcessingAPI/06-Postbacks.htm`;
export const POSTBACK_PARAMETERS_URL = `${DOCS}DeveloperDocs/ProcessingAPI/07-PostbackParameters.htm`;
export const TRANSACTION_MATRIX_URL = `${DOCS}DeveloperDocs/ProcessingAPI/Postbacks-TransactionMatrix.htm`;
export const ERROR_CODES_URL = `${DOCS}DeveloperDocs/ProcessingAPI/11-Error%20Codes.htm`;
export const MANAGE_POSTBACKS_URL = `${DOCS}MPDocs/MyWebsites/ManagePostbacks.htm`;
export const PAYPAL_DISPUTE_URL = `${DOCS}MPDocs/PayPal-DisputeConfiguration.htm`;
export const PAYPAL_GLOSSARY_URL = `${DOCS}MPDocs/PayPal-DisputesGlossary.htm`;
export const STAND_IN_URL = `${DOCS}MPFeatures/Stand-In.htm`;
export const CRYPTO_URL = `${DOCS}PaymentMethods/Crypto.htm`;
export const GATEWAY_GUIDE_URL = `${DOCS}GatewayDocs/GatewayIntegrationGuide.htm`;
export const SIGNED_REQUESTS_URL = `${DOCS}GatewayDocs/HostedPP-SignedRequests.htm`;
export const THREEDS_V4_URL = `${DOCS}GatewayDocs/3DSecureV4.htm`;
export const MERCHANT_ADVICE_URL = `${DOCS}GatewayDocs/Merchant%20Advice%20%26%20Response%20Codes.htm`;
export const TESTING_URL = `${DOCS}DeveloperDocs/ProcessingAPI/10-TestingPayments.htm`;

export type CatalogEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  /** The code does not establish whether the operation took effect. */
  outcomeUncertain?: boolean;
};

const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Run 3-D Secure / strong customer authentication and submit a new attempt.",
  authentication_failed:
    "Ask the customer to complete authentication again or to use another card.",
  invalid_request: "Correct the request data named by the code before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another payment method or card type.",
  fraud_or_risk:
    "Do not retry automatically. Review the transaction and contact Segpay support for details of the risk rule.",
  rate_limiting: "Wait before trying again and avoid automated repeated attempts.",
  provider_unavailable:
    "Check the transaction's final status (postback, notification or Segpay reporting) before trying again.",
  network_or_timeout:
    "Confirm the final status through the postback, Event Notification or Segpay reporting before sending a new request.",
  duplicate_request:
    "Check whether an earlier identical purchase or request is still active or already succeeded.",
  configuration:
    "Check the merchant account, price point, processor and feature configuration with Segpay support.",
  unknown: "Check the transaction in the Segpay Merchant Portal or contact Segpay support.",
};

const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or method, or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary or the original outcome may be unknown. Verify the final status before any new attempt, and avoid immediate repeated retries.",
  safe_to_retry_technical_request:
    "The request was rejected for a technical reason before a payment was made; it can be sent again.",
  manual_review:
    "The code does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this code.",
};

type Opts = { next?: string; why?: string; uncertain?: boolean };

function entry(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts: Opts = {},
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: `${meaning}.`,
    nextAction: opts.next ?? NEXT_ACTION[category],
    retryExplanation: opts.why ?? RETRY_EXPLANATION[retry],
    ...(opts.uncertain ? { outcomeUncertain: true } : {}),
  };
}

type Row = [
  codes: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

/** Rows list several comma-separated codes that share one documented treatment. */
function table(rows: readonly Row[]): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [codes, meaning, category, retry, opts] of rows) {
    const e = entry(meaning, category, retry, opts);
    for (const code of codes.split(",")) out[code.trim()] = e;
  }
  return out;
}

const VERIFY_FIRST =
  "The original request may have been processed. Confirm the final state (Event Notification or Segpay reporting) before sending a new request.";
const VISA_CAT2 =
  "Segpay places insufficient funds and similar declines in Visa category 2, where attempts can be made to reauthorize later. Respect the scheme limit Segpay documents (no more than 15 reattempts in 30 days).";
const STRONG_AUTH =
  "Segpay MPI V4: on 3009 call forceAuthentication() and resubmit the transaction with the authentication result.";
const VELOCITY =
  "A velocity rule blocked the attempt. Repeating it right away will hit the same rule; review the activity before acting.";

// ---------------------------------------------------------------------------
// Processing (hosted pay page) codes

/** Fraud failure codes F4xx and V30xx (11-Error Codes.htm): 32 codes. */
export const FRAUD_CODES: Record<string, CatalogEntry> = table([
  [
    "F440",
    "SPVelocity: too many Instant Conversion validation errors",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  ["F451", "SPNegDB: card is on the Segpay negative list", "fraud_or_risk", "do_not_retry"],
  ["F452,F453", "SPNegDB: email is on the Segpay negative list", "fraud_or_risk", "do_not_retry"],
  ["F455", "SPNegDB: customer country or IP country is blocked", "fraud_or_risk", "do_not_retry"],
  [
    "F456,F493",
    "SPNegDB: customer or IP country is blocked at merchant level",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "F457",
    "Dupe: duplicate subscription",
    "duplicate_request",
    "do_not_retry",
    { next: "Check whether the customer already has an active subscription for this offer." },
  ],
  [
    "F458",
    "SPNegDB: customer or IP country is blocked at website (URL) level",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "F460",
    "SPVelocity: global velocity limit",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "F461",
    "SPVelocity: merchant velocity limit by card number",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "F462",
    "SPVelocity: merchant velocity limit by email",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "F463",
    "SPVelocity: website velocity limit by card number",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "F464",
    "SPVelocity: website velocity limit by email",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "F465",
    "SPVelocity: merchant velocity limit by IP address",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  ["F470", "SPNegDB: BIN is on the negative list", "fraud_or_risk", "do_not_retry"],
  ["F471", "SPNegDB: BIN country is blocked", "fraud_or_risk", "do_not_retry"],
  ["F481", "SPNegDB: affiliate (merchantpartnerid) is blocked", "fraud_or_risk", "manual_review"],
  [
    "F492",
    "MerchNegDB: email is on the merchant's own negative list",
    "fraud_or_risk",
    "do_not_retry",
  ],
  ["F494", "SPNegDB: device is on the negative list", "fraud_or_risk", "do_not_retry"],
  [
    "V3001",
    "SPVelocity: website velocity limit by card",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3002",
    "SPVelocity: website velocity limit by email",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3003",
    "SPVelocity: website velocity limit by username",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3004",
    "SPVelocity: website velocity limit by IP address",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3009",
    "SPVelocity: website velocity limit by device ID",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3011",
    "SPVelocity: website velocity limit by TrueIP",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3005",
    "SPVelocity: merchant velocity limit by card",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3006",
    "SPVelocity: merchant velocity limit by email",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3007",
    "SPVelocity: merchant velocity limit by username",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3008",
    "SPVelocity: merchant velocity limit by IP address",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3010",
    "SPVelocity: merchant velocity limit by device ID",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    "V3012",
    "SPVelocity: merchant velocity limit by TrueIP",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
]);

/** Instant Conversion / One-Click errors ERR301-ERR310 (11-Error Codes.htm): 10 codes. */
export const CONVERSION_ERRORS: Record<string, CatalogEntry> = table([
  [
    "ERR301",
    "Instant Conversion / One-Click: token unknown to Segpay (Invalid One-Click Token)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR302",
    "Instant Conversion: the price point of the asset is not an Instant Conversion price point",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERR303",
    "Instant Conversion: the original signup was not authorized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR304",
    "Instant Conversion: the purchase is already converted",
    "duplicate_request",
    "do_not_retry",
  ],
  ["ERR305", "Instant Conversion: the purchase has no next bill date", "unknown", "manual_review"],
  [
    "ERR306",
    "Instant Conversion: the next bill date is inside the conversion cut-off",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR307",
    "Instant Conversion: invalid PackageID/BillConfigID on the conversion",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERR308",
    "Instant Conversion: the card type on the stored asset is not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERR309",
    "Instant Conversion: the card type is no longer supported by the processor pool",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERR310",
    "Instant Conversion: the purchase is no longer active",
    "invalid_request",
    "do_not_retry",
  ],
]);

/** Visa decline categories with Segpay's retry strategy (Merchant Advice & Response Codes). */
export type VisaCategory = 1 | 2 | 3;

export const VISA_CATEGORIES: Record<
  VisaCategory,
  { codes: readonly string[]; meaning: string; strategy: string; retry: RetryGuidance }
> = {
  1: {
    codes: ["03", "04", "07", "12", "15", "41", "43", "57", "62", "78", "93", "R0", "R1", "R3"],
    meaning: "Visa decline category 1: the issuer will never approve",
    strategy: "Segpay: do not attempt to reauthorize.",
    retry: "do_not_retry",
  },
  2: {
    codes: ["19", "51", "59", "61", "65", "75", "86", "91", "96", "N3", "N4"],
    meaning: "Visa decline category 2: the issuer cannot approve at this time",
    strategy:
      "Segpay: attempts can be made to reauthorize. Respect the documented limit of no more than 15 reattempts in 30 days.",
    retry: "retry_conditionally",
  },
  3: {
    codes: ["14", "54", "55", "82", "N7"],
    meaning: "Visa decline category 3: the issuer cannot approve with the details provided",
    strategy: "Segpay: retry only after obtaining updated details from the cardholder.",
    retry: "customer_action_required",
  },
};

/** Mastercard response code buckets (Merchant Advice & Response Codes). */
export const MASTERCARD_BUCKETS: Record<
  "79" | "82" | "83",
  { codes: readonly string[]; meaning: string; category: ErrorCategory; retry: RetryGuidance }
> = {
  "79": {
    codes: ["14", "54"],
    meaning: "Mastercard 79 bucket: lifecycle related decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "82": {
    codes: ["03", "13", "57", "61", "62", "65"],
    meaning: "Mastercard 82 bucket: policy related decline",
    category: "card_declined",
    retry: "customer_action_required",
  },
  "83": {
    codes: ["41", "43", "55", "63"],
    meaning: "Mastercard 83 bucket: security related decline",
    category: "fraud_or_risk",
    retry: "do_not_retry",
  },
};

/**
 * Mastercard Merchant Advice Codes and Visa recurring cancellation codes
 * (Merchant Advice & Response Codes). No Segpay payload field that carries
 * them is documented, so they are reference data only.
 */
export const MERCHANT_ADVICE_CODES: Record<string, { meaning: string; retry: RetryGuidance }> = {
  "01": {
    meaning: "Updated information needed (Account Updater; for the 83 bucket retry with EMV 3DS)",
    retry: "customer_action_required",
  },
  "02": { meaning: "Try again later", retry: "retry_conditionally" },
  "03": { meaning: "Do not try again", retry: "do_not_retry" },
  "04": { meaning: "Token requirements not met", retry: "do_not_retry" },
  "21": { meaning: "Payment cancelled", retry: "do_not_retry" },
  "22": { meaning: "Merchant does not qualify for the product code", retry: "do_not_retry" },
};

export const VISA_RECURRING_CANCELLATION_CODES: Record<string, string> = {
  "02": "Stop one payment",
  "03": "Stop all recurring payments for this merchant",
  "21": "All recurring payments cancelled for the card",
};

/** MPI V4 (3DS2) named errors (3DSecureV4.htm): 10. Not carried by a supported payload. */
export const MPI_ERRORS: Record<string, CatalogEntry> = table([
  ["InvalidKey", "MPI V4: invalid MPI key", "configuration", "do_not_retry"],
  ["InvalidOrderJWT", "MPI V4: invalid order JWT", "configuration", "do_not_retry"],
  ["InvalidJWT", "MPI V4: invalid JWT", "configuration", "do_not_retry"],
  ["CardDataTampered", "MPI V4: card data was tampered with", "fraud_or_risk", "manual_review"],
  ["VelocityExceeded", "MPI V4: velocity exceeded", "rate_limiting", "retry_conditionally"],
  ["InvalidCard", "MPI V4: invalid card", "invalid_request", "customer_action_required"],
  [
    "ChallengeIncomplete",
    "MPI V4: the 3DS challenge was not completed",
    "authentication_failed",
    "customer_action_required",
  ],
  ["DataMismatch", "MPI V4: data mismatch", "unknown", "manual_review"],
  [
    "InternalError",
    "MPI V4: internal error",
    "network_or_timeout",
    "retry_conditionally",
    { uncertain: true, why: VERIFY_FIRST },
  ],
  [
    "UpstreamError",
    "MPI V4: upstream error",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true, why: VERIFY_FIRST },
  ],
]);

// ---------------------------------------------------------------------------
// Processing postback vocabularies

/** Canonical `trantype` values; keys are lowercase without spaces. */
export const TRANTYPES: Record<string, string> = {
  sale: "Sale",
  credit: "Credit",
  charge: "Charge",
  cbreversal: "CBReversal",
  rdrreversal: "RDRreversal",
  revoke: "Revoke",
};

/** Canonical `stage` values; keys are lowercase without spaces. */
export const STAGES: Record<string, string> = {
  initial: "Initial",
  conversion: "Conversion",
  rebill: "Rebill",
  instantconversion: "Instantconversion",
};

/** Transaction postback `action` values (Manage Postbacks). */
export const TRANSACTION_ACTIONS: Record<string, string> = { auth: "Auth", void: "Void" };

export type MatrixEntry = {
  result: string;
  stage: LifecycleStage;
  outcome: Outcome;
  isRecurring?: boolean;
};

/**
 * Transaction Postback Matrix (Postbacks-TransactionMatrix.htm): 14
 * combinations of trantype / action / stage / approved. Keys use the
 * canonical spellings above.
 */
export const TRANSACTION_MATRIX: Record<string, MatrixEntry> = {
  "Sale|Auth|Initial|Yes": { result: "Approved signup", stage: "payment", outcome: "success" },
  "Sale|Auth|Initial|No": { result: "Declined signup", stage: "payment", outcome: "failure" },
  "Sale|Auth|Conversion|Yes": {
    result: "Approved conversion (first rebill)",
    stage: "payment",
    outcome: "success",
    isRecurring: true,
  },
  "Sale|Auth|Conversion|No": {
    result: "Declined conversion (first rebill)",
    stage: "payment",
    outcome: "failure",
    isRecurring: true,
  },
  "Sale|Auth|Rebill|Yes": {
    result: "Approved rebill",
    stage: "payment",
    outcome: "success",
    isRecurring: true,
  },
  "Sale|Auth|Rebill|No": {
    result: "Declined rebill",
    stage: "payment",
    outcome: "failure",
    isRecurring: true,
  },
  // Instant Conversion is started by the consumer, not a scheduled rebill.
  "Sale|Auth|Instantconversion|Yes": {
    result: "Approved Instant Conversion",
    stage: "payment",
    outcome: "success",
    isRecurring: false,
  },
  "Sale|Auth|Instantconversion|No": {
    result: "Declined Instant Conversion",
    stage: "payment",
    outcome: "failure",
    isRecurring: false,
  },
  "Sale|Void|Initial|Yes": {
    result: "Void (of a transaction of any stage)",
    stage: "void",
    outcome: "success",
  },
  "CBReversal|Auth|Initial|Yes": {
    result: "Chargeback reversed, funds returned to the merchant",
    stage: "dispute",
    outcome: "unknown",
  },
  "Credit|Auth|Initial|Yes": { result: "Refund", stage: "refund", outcome: "success" },
  "Charge|Auth|Initial|Yes": { result: "Chargeback", stage: "dispute", outcome: "unknown" },
  "RDRreversal|Auth|Initial|Yes": {
    result: "RDR refund (Visa Rapid Dispute Resolution)",
    stage: "refund",
    outcome: "success",
  },
  "Revoke|Auth|Initial|Yes": {
    result: "Previously approved transaction reversed (for example a SEPA revoke)",
    stage: "reversal",
    outcome: "success",
  },
};

/** Stage used for a trantype when the combination is not in the matrix. */
export const TRANTYPE_STAGE: Record<string, LifecycleStage> = {
  Sale: "payment",
  Credit: "refund",
  Charge: "dispute",
  CBReversal: "dispute",
  RDRreversal: "refund",
  Revoke: "reversal",
};

/** Member management postback actions (06-Postbacks.htm, ManagePostbacks.htm). */
export const MEMBER_ACTIONS: Record<
  string,
  { name: string; postback: string; outcome: Outcome; description: string }
> = {
  probe: {
    name: "Probe",
    postback: "Inquiry",
    outcome: "pending",
    description: "Username availability check before a signup; the signup result is not known yet.",
  },
  enable: {
    name: "Enable",
    postback: "Access Enable",
    outcome: "success",
    description: "Access enabled after an approved purchase that collected a username.",
  },
  disable: {
    name: "Disable",
    postback: "Access Disable",
    outcome: "success",
    description:
      "Access disabled at expiry, or after a chargeback, refund or cancellation request.",
  },
  cancel: {
    name: "Cancel",
    postback: "Cancellation",
    outcome: "success",
    description:
      "Subscription cancelled by the consumer, the merchant or Segpay; access continues to the next bill date.",
  },
  reactivation: {
    name: "Reactivation",
    postback: "Reactivation",
    outcome: "success",
    description: "A cancelled or expired subscription was reactivated.",
  },
};

/** PayPal Dispute postback enumerations (PayPal-DisputeConfiguration.htm). */
export const PAYPAL_DISPUTE = {
  actions: ["DisputeCreated", "DisputeUpdated", "DisputeNeedsResponse", "DisputeResolved"],
  stages: ["Inquiry", "Chargeback", "Pre-Arbitration", "Arbitration"],
  channels: ["Alert", "Internal", "External"],
  statuses: ["Resolved", "UnderReview", "WaitingForSellerResponse", "WaitingForBuyerResponse"],
  outcomes: [
    "ResolvedBuyerFavor",
    "ResolvedSellerFavor",
    "ResolvedWithPayout",
    "CanceledByBuyer",
    "Open",
  ],
  reasons: [
    "MerchandiseOrServiceNotReceived",
    "MerchandiseOrServiceNotAsDescribed",
    "Unauthorized",
    "CreditNotProcessed",
    "DuplicateTransaction",
    "IncorrectAmount",
    "PaymentByOthermeans",
    "CanceledRecurringBilling",
    "Other",
  ],
} as const;

// ---------------------------------------------------------------------------
// Gateway codes

export type GatewayEvent = {
  name: string;
  meaning: string;
  stage: LifecycleStage;
  /** "response_code": derived from ResponseCode (100 = approved). */
  outcome: Outcome | "response_code";
  isRecurring?: boolean;
};

/** Gateway Event Codes (GatewayIntegrationGuide.htm, Appendix A): 21. */
export const GATEWAY_EVENT_CODES: Record<string, GatewayEvent> = {
  A: {
    name: "Authorization",
    meaning: "Authorization awaiting settlement",
    stage: "authorization",
    outcome: "success",
  },
  S: {
    name: "Single Sale or Settlement",
    meaning: "One-time sale, or settlement of an earlier authorization",
    stage: "payment",
    outcome: "success",
  },
  I: {
    name: "Initial",
    meaning: "Initial sale on a recurring product",
    stage: "payment",
    outcome: "success",
    isRecurring: false,
  },
  R: {
    name: "Rebill",
    meaning: "Rebill on a recurring product",
    stage: "payment",
    outcome: "response_code",
    isRecurring: true,
  },
  C: { name: "Credit", meaning: "Refund", stage: "refund", outcome: "success" },
  V: { name: "Void", meaning: "Void", stage: "void", outcome: "success" },
  H: {
    name: "Pending Batch Credit",
    meaning: "Refund scheduled for a batch",
    stage: "refund",
    outcome: "pending",
  },
  "~": {
    name: "Pending Batch Settlement",
    meaning: "Settlement scheduled for a batch",
    stage: "settlement",
    outcome: "pending",
  },
  "!": {
    name: "Declined",
    meaning: "Transaction declined",
    stage: "payment",
    outcome: "failure",
  },
  M: {
    name: "Cancellation",
    meaning: "Future rebills stopped (also emitted after chargeback or fraud events)",
    stage: "subscription",
    outcome: "success",
  },
  D: {
    name: "Terminated",
    meaning: "Recurring subscription expired",
    stage: "subscription",
    outcome: "success",
  },
  X: {
    name: "Chargeback",
    meaning: "Transaction charged back",
    stage: "dispute",
    outcome: "unknown",
  },
  Z: {
    name: "TC40",
    meaning: "Issuer fraud report (TC40/SAFE); no money movement is implied",
    stage: "other",
    outcome: "unknown",
  },
  "1": {
    name: "Retrieval",
    meaning: "Issuer or cardholder inquiry (soft chargeback)",
    stage: "dispute",
    outcome: "unknown",
  },
  T: { name: "Test", meaning: "Test card transaction", stage: "other", outcome: "unknown" },
  F: { name: "Failed", meaning: "Refund request failed", stage: "refund", outcome: "failure" },
  U: {
    name: "Alert",
    meaning: "Card association alert received",
    stage: "dispute",
    outcome: "unknown",
  },
  K: {
    name: "Converted",
    meaning: "Subscriber moved to a new product code",
    stage: "subscription",
    outcome: "success",
  },
  "?": {
    name: "Incomplete Transaction",
    meaning: "Failed for various reasons; Segpay says to contact support",
    stage: "other",
    outcome: "unknown",
  },
  E: {
    name: "Expired Billing",
    meaning: "MaxRebill limit reached",
    stage: "subscription",
    outcome: "success",
  },
  "@": {
    name: "Pending Authorization",
    meaning: "Debit awaiting cardholder confirmation (bank app)",
    stage: "authorization",
    outcome: "pending",
  },
};

export type SubEventType = {
  meaning: string;
  /** Documented class code. */
  productClass: "UNKN" | "SNGL" | "NTRI" | "TRIA" | "QCVT";
  batching: boolean;
  subscriptionState:
    "initial" | "rebilled" | "converted" | "credited" | "voided" | "pending credit";
};

function sub(
  meaning: string,
  productClass: SubEventType["productClass"],
  batching: boolean,
  subscriptionState: SubEventType["subscriptionState"],
): SubEventType {
  return { meaning, productClass, batching, subscriptionState };
}

/** Gateway SubEventTypeID (Appendix B): 34. */
export const SUB_EVENT_TYPES: Record<string, SubEventType> = {
  "0": sub("Unspecified", "UNKN", false, "initial"),
  "100": sub("Single sale", "SNGL", false, "initial"),
  "101": sub("Free membership (no sale)", "SNGL", false, "initial"),
  "403": sub("Single sale (batching)", "SNGL", true, "initial"),
  "105": sub("Single credit", "SNGL", false, "credited"),
  "405": sub("Single credit (batching)", "SNGL", true, "credited"),
  "106": sub("Single void", "SNGL", false, "voided"),
  "406": sub("Single void (batching)", "SNGL", true, "voided"),
  "404": sub("Single pending credit (batching)", "SNGL", true, "pending credit"),
  "200": sub("Non-trial initial", "NTRI", false, "initial"),
  "400": sub("Non-trial initial (batching)", "NTRI", true, "initial"),
  "300": sub("Trial initial", "TRIA", false, "initial"),
  "500": sub("Trial initial (batching)", "TRIA", true, "initial"),
  "201": sub("Non-trial recurring", "NTRI", false, "rebilled"),
  "401": sub("Non-trial recurring (batching)", "NTRI", true, "rebilled"),
  "301": sub("Trial recurring", "TRIA", false, "rebilled"),
  "501": sub("Trial recurring (batching)", "TRIA", true, "rebilled"),
  "202": sub("Non-trial converted", "NTRI", false, "converted"),
  "402": sub("Non-trial converted (batching)", "NTRI", true, "converted"),
  "302": sub("Trial converted", "TRIA", false, "converted"),
  "502": sub("Trial converted (batching)", "TRIA", true, "converted"),
  "210": sub("Non-trial credit", "NTRI", false, "credited"),
  "410": sub("Non-trial credit (batching)", "NTRI", true, "credited"),
  "310": sub("Trial credit", "TRIA", false, "credited"),
  "510": sub("Trial credit (batching)", "TRIA", true, "credited"),
  "211": sub("Non-trial void", "NTRI", false, "voided"),
  "411": sub("Non-trial void (batching)", "NTRI", true, "voided"),
  "311": sub("Trial void", "TRIA", false, "voided"),
  "511": sub("Trial void (batching)", "TRIA", true, "voided"),
  "409": sub("Non-trial pending credit (batching)", "NTRI", true, "pending credit"),
  "509": sub("Trial pending credit (batching)", "TRIA", true, "pending credit"),
  "1000": sub("QuickConvert instant conversion: initial", "QCVT", false, "initial"),
  "1001": sub("QuickConvert instant conversion: rebill", "QCVT", false, "rebilled"),
  "1002": sub("QuickConvert instant conversion: converted", "QCVT", false, "converted"),
};

/** Gateway ResponseCode values that are approvals, not errors (Appendix C). */
export const GATEWAY_APPROVALS: Record<string, string> = {
  "100": "Approved",
  "307": "Approved: honor with identification",
  "308": "Approved: VIP",
  "353": "Approved although the PVID is missing",
  "360": "Approved: rewards program",
  "342": "No reason to decline (verification only)",
  "366": "Reversal accepted",
};

function range(from: number, to: number): string {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(String(n));
  return out.join(",");
}

/** Gateway ResponseCode values that are errors or declines (Appendix C). */
export const GATEWAY_RESPONSE_CODES: Record<string, CatalogEntry> = table([
  ["200,213", "Generic decline", "card_declined", "customer_action_required"],
  ["201,323,500", "Card expired", "card_declined", "customer_action_required"],
  [
    "204,214",
    "Card cannot be used for this method or transaction type",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "207,300,301",
    "Contact or refer to the card issuer",
    "card_declined",
    "customer_action_required",
  ],
  ["209,434", "Terminal ID invalid or not found", "configuration", "manual_review"],
  ["210,310,416", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["212", "PIN required", "authentication_required", "customer_action_required"],
  ["217,324", "PIN incorrect", "authentication_failed", "customer_action_required"],
  [
    "218,225,224",
    "Card not registered, not active, or a PIN change is needed",
    "card_declined",
    "customer_action_required",
  ],
  [
    "223",
    "Wrong CAUV (the term is not explained in the documentation)",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "226,332,504",
    "Card blocked or locked after PIN failures",
    "authentication_failed",
    "do_not_retry",
  ],
  [
    "229,339,352",
    "CVV error, incorrect CVV or CVV2 failure",
    "card_declined",
    "customer_action_required",
  ],
  [
    "230",
    "Currency denomination not supported by the issuer",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "261,280",
    "Card brand or card type not accepted by the issuer",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["281,503", "Debit or credit restrictions on the card", "card_declined", "do_not_retry"],
  [
    "283,284,356",
    "Authentication error or card authentication failed",
    "authentication_failed",
    "customer_action_required",
  ],
  ["289", "Processor security block", "fraud_or_risk", "manual_review"],
  ["290", "Issuer decline without a reason", "card_declined", "customer_action_required"],
  ["291,299", "CVV missing or CVV2 too long", "invalid_request", "customer_action_required"],
  ["292", "The gateway does not allow a retry", "card_declined", "do_not_retry"],
  ["302", "Invalid merchant or service provider", "card_declined", "do_not_retry"],
  [
    "303,306,318,319,702",
    "Pick up card (including lost, stolen or withheld card)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  ["304", "Do not honor", "card_declined", "customer_action_required"],
  ["305", "Error (unspecified)", "unknown", "manual_review"],
  [
    "309,325,326",
    "Invalid transaction, or not permitted to the cardholder or terminal",
    "card_declined",
    "do_not_retry",
  ],
  [
    "311,317,321,322",
    "Invalid account, or no credit, checking or savings account",
    "card_declined",
    "customer_action_required",
  ],
  [
    "312,344",
    "No such issuer, or the transaction cannot be routed",
    "card_declined",
    "do_not_retry",
  ],
  [
    "313,363",
    "Re-enter the transaction, or please wait",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST },
  ],
  ["314,357,358", "No action taken, or forward to the issuer", "unknown", "manual_review"],
  [
    "315,333,334,419",
    "Record or original message not found, or inconsistent",
    "invalid_request",
    "manual_review",
  ],
  [
    "316,343,346,359,433,807",
    "Issuer, switch or file unavailable; system malfunction; cannot go online",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "320,501,502,601,609",
    "Insufficient funds, credit limit reached, or uncollected funds",
    "insufficient_funds",
    "retry_conditionally",
    { why: VISA_CAT2 },
  ],
  ["327,330", "Amount or count activity limit exceeded", "card_declined", "retry_conditionally"],
  ["328", "Restricted card", "card_declined", "do_not_retry"],
  [
    "329,383",
    "Security violation, or security related decline (Mastercard 83 bucket)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "331,802,803,804,805,2100,2101,2102",
    "Late response, communication failure, timeout, or connection failed or refused",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "335,602,603,614,616,620",
    "Account does not exist, is closed, not located, holder deceased, frozen, or a non-transaction account",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["336,338", "Key exchange or PIN cryptography error", "configuration", "manual_review"],
  ["337,362", "Invalid date or effective date", "invalid_request", "customer_action_required"],
  ["340", "Cannot verify PIN", "authentication_failed", "customer_action_required"],
  ["341", "Invalid authorization life cycle", "invalid_request", "do_not_retry"],
  ["345", "Violation of law", "card_declined", "do_not_retry"],
  ["347,407,624,2501", "Duplicate add, ID, entry or batch", "duplicate_request", "do_not_retry"],
  [
    "348,901,902,903",
    "AVS invalid or mismatch (address, zip or both)",
    "fraud_or_risk",
    "customer_action_required",
  ],
  [
    "349",
    "Force STP (stand-in processing)",
    "unknown",
    "unknown",
    { uncertain: true, why: VERIFY_FIRST },
  ],
  [
    "350,361,403,404",
    "Cash, service, debit or private label not supported",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["351", "Cash request over limit", "invalid_amount", "do_not_retry"],
  ["354,355", "PVID problem, or invalid biller information", "configuration", "manual_review"],
  [
    "364,400,417,436",
    "Format, message type or message not supported",
    "invalid_request",
    "do_not_retry",
  ],
  ["365", "Invalid currency code", "invalid_request", "do_not_retry"],
  [
    "367",
    "Refund impossible: the transaction was already charged back",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "368,2002,2004,2005,2006",
    "Missing or unparseable request data",
    "invalid_request",
    "do_not_retry",
  ],
  ["369", "Invalid email address", "invalid_request", "customer_action_required"],
  [
    "370,371,607,608",
    "Cardholder revoked the authorization or rebills; customer revoke; payment stopped",
    "card_declined",
    "do_not_retry",
  ],
  [
    "379,382",
    "Lifecycle or policy related decline (Mastercard 79 and 82 buckets)",
    "card_declined",
    "customer_action_required",
  ],
  [
    "401,402,406,411,420",
    "Merchant ID, processing code, unit or master merchant problem",
    "configuration",
    "manual_review",
  ],
  [
    "405,410,412",
    "Card type invalid, unsupported or badly formatted",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "408,409,413,414,415",
    "Card-present fields invalid (manual entry, track, transaction type, entry mode)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "418,604,612,613,622,651,652,653,654,655,656",
    "Bank account details wrong (ABA, account, branch, routing, DFI, name, transaction code or individual ID)",
    "invalid_request",
    "customer_action_required",
  ],
  ["421", "Refund not allowed", "invalid_request", "do_not_retry"],
  ["422", "Refund denied", "unknown", "manual_review"],
  [
    "423,424,425,426,427,428,429,430",
    "Reporting or receipt request problem at the processor",
    "invalid_request",
    "manual_review",
  ],
  [
    "431,432,2500",
    "Bad status, batch totals mismatch, or bad transaction in a batch",
    "unknown",
    "manual_review",
  ],
  [
    "435,2200,2201,2202,2203,2204",
    "Processor response invalid, missing or unhandled",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  ["437", "Invalid IP", "configuration", "do_not_retry"],
  [
    "438,2003,2008,2010,2011",
    "Feature or product not enabled; MID is refunds-only; merchant pool or code missing",
    "configuration",
    "do_not_retry",
  ],
  [
    "505,506,507,508,509",
    "Card length, month, year, number or other card data invalid",
    "invalid_request",
    "customer_action_required",
  ],
  ["605,617", "Invalid debit entry or bad file record", "invalid_request", "manual_review"],
  [
    "606,611,631,633",
    "ACH return (ODFI return, failed safekeep, permissible return, XCK return)",
    "unknown",
    "manual_review",
  ],
  ["610,629", "Unauthorized account, or corporate not authorized", "fraud_or_risk", "do_not_retry"],
  ["621", "Invalid company ID", "configuration", "manual_review"],
  ["623", "Credit refused", "card_declined", "manual_review"],
  [
    "700,943,942,944",
    "Suspected fraud; general fraud decline; ThreatMetrix rejected; risk score over threshold",
    "fraud_or_risk",
    "do_not_retry",
  ],
  ["701", "Contact the issuer: suspected fraud", "fraud_or_risk", "customer_action_required"],
  ["703", "Final decline: do not re-attempt", "card_declined", "do_not_retry"],
  ["704", "Updated information needed", "card_declined", "customer_action_required"],
  ["705", "Additional information needed", "authentication_required", "customer_action_required"],
  ["706", "Try again later", "card_declined", "retry_conditionally"],
  ["800", "Swap down (the term is not explained in the documentation)", "unknown", "unknown"],
  [
    "801,806,2000,2998",
    "Database error, processing temporarily impossible, gateway offline, or crash or timeout",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  ["900,966,967,968", "Scrub (risk screening) related decline", "fraud_or_risk", "manual_review"],
  [
    range(904, 919),
    "Velocity limit per period (attempts, approvals, declines or refunds for a card, ACH account, email or IP)",
    "fraud_or_risk",
    "manual_review",
    { why: VELOCITY },
  ],
  [
    range(920, 937),
    "Negative database hit (BIN, country, account number, ACH, email or IP; by admin, chargeback, rule or bank response)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "938",
    "Junk or abusive text in name or address fields",
    "fraud_or_risk",
    "customer_action_required",
  ],
  ["939", "Address validation failure", "invalid_request", "customer_action_required"],
  [
    "940,941",
    "Country does not match the IP country or the BIN country",
    "fraud_or_risk",
    "manual_review",
  ],
  ["2001", "The external processor response code could not be mapped", "unknown", "manual_review"],
  ["2007", "Invalid transaction state", "invalid_request", "do_not_retry"],
  ["2012", "Merchant limits exceeded", "configuration", "manual_review"],
  [
    "2013",
    "Card type not accepted by the merchant",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "2103,2155,2156",
    "Remote server error (HTTP 500 or 503)",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "2150,2151,2152,2153,2154",
    "Remote HTTP 301, 302, 401, 403 or 404",
    "configuration",
    "manual_review",
  ],
  ["2502", "Batch rejected, no action needed", "unknown", "do_not_retry"],
  [
    "2600,2601,2602,2603",
    "Card blocked (generally, or after a prior RDR, Verifi or Ethoca case)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  ["2605", "Customer already has an active rebill", "duplicate_request", "do_not_retry"],
  ["2999", "Cannot execute", "unknown", "manual_review"],
  [
    "3001,3006,3007",
    "3DS data malformed, 3DS version error, or invalid SCA exemption",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "3002,3003,3004,3010",
    "3DS not supported (by the gateway, the processor or generally), or exemption not allowed on the product",
    "configuration",
    "do_not_retry",
  ],
  [
    "3005,3008",
    "3DS authentication required, or SCA exemption declined",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "3009",
    "Strong customer authentication required",
    "authentication_required",
    "customer_action_required",
    { why: STRONG_AUTH },
  ],
]);

/** Documentation for each decoded code family. */
export type CodeFamily =
  | "gateway_response"
  | "fraud"
  | "conversion"
  | "visa_category"
  | "mastercard_bucket"
  | "crypto"
  | "mpi";

export const FAMILY_DOCS: Record<CodeFamily, { title: string; url: string }[]> = {
  gateway_response: [
    {
      title: "Segpay Gateway Integration Guide, Appendix C (Response Codes)",
      url: GATEWAY_GUIDE_URL,
    },
  ],
  fraud: [{ title: "Segpay Processing API error codes (fraud codes)", url: ERROR_CODES_URL }],
  conversion: [
    {
      title: "Segpay Processing API error codes (Instant Conversion / One-Click)",
      url: ERROR_CODES_URL,
    },
  ],
  visa_category: [{ title: "Segpay Merchant Advice & Response Codes", url: MERCHANT_ADVICE_URL }],
  mastercard_bucket: [
    { title: "Segpay Merchant Advice & Response Codes", url: MERCHANT_ADVICE_URL },
  ],
  crypto: [{ title: "Segpay Crypto payments", url: CRYPTO_URL }],
  mpi: [{ title: "Segpay 3D Secure MPI V4", url: THREEDS_V4_URL }],
};

export { NEXT_ACTION, RETRY_EXPLANATION };
