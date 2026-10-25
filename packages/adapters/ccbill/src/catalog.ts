/**
 * CCBill code and status knowledge, kept as data.
 *
 * Every code, status and event name below comes from
 * docs/providers/high-risk/research/ccbill.md, which cites the CCBill
 * documentation pages linked in the URL constants. Meanings are short
 * paraphrases; category and retry values are PandaPayLens interpretations of
 * the documented meanings, not CCBill statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const WEBHOOKS_GUIDE_URL = "https://ccbill.com/doc/webhooks-user-guide";
export const WEBHOOKS_OVERVIEW_URL = "https://ccbill.com/doc/webhooks-overview";
export const BACKGROUND_POST_URL = "https://ccbill.com/doc/background-post";
export const DECLINE_CODES_URL = "https://ccbill.com/doc/background-post#postback_decline_codes";
export const ERROR_CODES_URL = "https://ccbill.com/doc/error-codes";
export const REST_API_URL = "https://ccbill.com/doc/ccbill-restful-transaction-api";
export const REST_RESOURCES_URL = "https://ccbill.com/doc/ccbill-restful-api-resources";
export const REST_OPENAPI_URL =
  "https://github.com/CCBill/restful-api-guide/blob/main/transactions/post-payment-tokens-payment-token-id.yaml";
export const LEGACY_API_URL = "https://ccbill.com/doc/ccbill-api-guide";
export const LEGACY_ERROR_7_URL = "https://ccbill.com/doc/ccbill-api-7-error-explained";
export const BILLING_API_URL =
  "https://ccbill.com/doc/ccbill-api-charge-by-previous-transaction-id";
export const WEB_VERIFY_URL = "https://ccbill.com/doc/web-verify";
export const DYNAMIC_PRICING_URL = "https://ccbill.com/doc/dynamic-pricing-user-guide";

/** Which documented table an entry comes from. */
export type CodeFamily =
  "decline" | "rest_error" | "rest_example" | "threeds" | "legacy" | "webhook_failure";

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

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required: "Run 3-D Secure authentication and submit a new attempt.",
  authentication_failed:
    "Ask the customer to complete 3-D Secure authentication again or to use another payment method.",
  invalid_request: "Correct the request or the payment details named by the code.",
  invalid_amount: "Check the price, period and amount limits configured for the subaccount.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another card type or payment method.",
  fraud_or_risk:
    "Do not resubmit automatically. Review the attempt and contact CCBill Merchant Support for details.",
  rate_limiting:
    "Do not send more attempts now. Check the velocity or throttle settings with CCBill Merchant Support.",
  provider_unavailable:
    "Confirm the transaction's final state (webhook, Data Link or the Admin Portal) before any new attempt.",
  network_or_timeout:
    "Confirm the transaction's final state (webhook, Data Link or the Admin Portal) before any new attempt.",
  duplicate_request:
    "Check whether the subscription, refund or void already exists before sending anything again.",
  configuration:
    "Check the subaccount configuration, credentials and allowed IP ranges with CCBill Merchant Support.",
  unknown: "Check the transaction in the CCBill Admin Portal or contact CCBill Merchant Support.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Sending the same request again with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or method, or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary, or the original outcome may be unknown. Verify the transaction's final state first (webhook, Data Link or Admin Portal), then wait before any new attempt.",
  safe_to_retry_technical_request:
    "The failed request was a status lookup, not a payment; it can be sent again.",
  manual_review: "The code does not allow an automatic decision; review the case before acting.",
  unknown: "Retry safety cannot be assessed for this code.",
};

type Opts = { next?: string; why?: string; uncertain?: boolean; note?: string };

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
    explanation: opts.note ? `${meaning}. ${opts.note}` : `${meaning}.`,
    nextAction: opts.next ?? NEXT_ACTION[category],
    retryExplanation: opts.why ?? RETRY_EXPLANATION[retry],
    ...(opts.uncertain ? { outcomeUncertain: true } : {}),
  };
}

type Row = [
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

function table(rows: Row[]): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [code, meaning, category, retry, opts] of rows)
    out[code] = entry(meaning, category, retry, opts);
  return out;
}

// ---------------------------------------------------------------------------
// Payment decline codes (Background Post `reasonForDeclineCode`, webhook
// Appendix B for 1-45, and very likely REST / billing API `declineCode`).

/** Code 15: the code tables and the billing API examples disagree. */
export const DECLINE_CODE_15_ALTERNATIVE =
  'every CCBill billing API example shows declineCode 15 with declineText "declined by bank"';

export const DECLINE_CODES: Record<string, CatalogEntry> = table([
  ["1", "Website not available for signup", "configuration", "do_not_retry"],
  ["2", "Website signup requirements could not be determined", "configuration", "do_not_retry"],
  [
    "3",
    "Card type not accepted; use another card type",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["4", "Banking system error", "provider_unavailable", "retry_conditionally"],
  ["5", "Card number not valid", "invalid_request", "customer_action_required"],
  [
    "6",
    "Expiration date entered incorrectly",
    "invalid_request",
    "customer_action_required",
    {
      note: "The documented text for this code is garbled in both CCBill tables; this is the readable part.",
    },
  ],
  ["7", "Bank account number entered incorrectly", "invalid_request", "customer_action_required"],
  ["8", "Bank routing number entered incorrectly", "invalid_request", "customer_action_required"],
  ["9", "Banking system error, try again", "provider_unavailable", "retry_conditionally"],
  ["10", "Website pricing invalid", "configuration", "do_not_retry"],
  ["11", "Transaction declined (no reason given)", "card_declined", "customer_action_required"],
  ["12", "Consumer already has a subscription", "duplicate_request", "do_not_retry"],
  ["13", "Consumer already had a free trial", "duplicate_request", "customer_action_required"],
  ["14", "CVV2 missing", "invalid_request", "customer_action_required"],
  [
    "15",
    "Account still being processed; check access or contact support",
    "unknown",
    "manual_review",
    {
      note: `CCBill's documentation is inconsistent for this code: ${DECLINE_CODE_15_ALTERNATIVE}. Both meanings are possible; prefer the provider text when it is present.`,
    },
  ],
  ["16", "Subscription ID provided is invalid", "invalid_request", "do_not_retry"],
  ["17", "Subscription ID does not exist", "invalid_request", "do_not_retry"],
  [
    "18",
    "Previous transaction attempt in the request was declined",
    "card_declined",
    "do_not_retry",
  ],
  ["19", "Not authorized to sign up with these credentials", "fraud_or_risk", "do_not_retry"],
  [
    "20",
    "No decline",
    "unknown",
    "unknown",
    { why: "Code 20 is documented as no decline, so there is no failure to retry." },
  ],
  [
    "21",
    "Trial already used; choose a normal recurring option",
    "duplicate_request",
    "customer_action_required",
  ],
  ["22", "Error contacting bank; try later", "network_or_timeout", "retry_conditionally"],
  ["23", "Invalid credit card", "invalid_request", "customer_action_required"],
  ["24", "Denied by bank", "card_declined", "customer_action_required"],
  ["25", "Bank error", "provider_unavailable", "retry_conditionally"],
  ["26", "Merchant card processing setup incorrect", "configuration", "manual_review"],
  ["27", "System error; try again", "provider_unavailable", "retry_conditionally"],
  ["28", "Cannot process now; try later", "provider_unavailable", "retry_conditionally"],
  ["29", "Card expired", "card_declined", "customer_action_required"],
  [
    "30",
    "Telephone number cannot be billed; choose another method",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["31", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["32", "CVV2 required", "invalid_request", "customer_action_required"],
  ["33", "Transaction type could not be determined", "invalid_request", "manual_review"],
  [
    "34",
    "Error contacting bank; try later (same text as code 22)",
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "35",
    "Card declined at pre-authorization (Pre-Auth SC)",
    "fraud_or_risk",
    "manual_review",
    { note: 'CCBill does not explain the abbreviation "Pre-Auth SC".' },
  ],
  ["36", "Unable to contact bank", "network_or_timeout", "retry_conditionally"],
  ["37", "Card BIN not processed", "payment_method_unavailable", "customer_action_required"],
  ["38", "Refused by issuing bank", "card_declined", "customer_action_required"],
  ["39", "Too many submissions today", "rate_limiting", "retry_conditionally"],
  [
    "40",
    "Card not accepted by this merchant",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["41", "Merchant inactive", "configuration", "do_not_retry"],
  ["42", "Incorrect address", "invalid_request", "customer_action_required"],
  [
    "43",
    "Telephone billing limit: one charge per number per day",
    "rate_limiting",
    "customer_action_required",
  ],
  ["44", "Prepaid cards not allowed", "payment_method_unavailable", "customer_action_required"],
  [
    "45",
    "Needs additional approval; see the confirmation email (Web Verify soft decline)",
    "fraud_or_risk",
    "customer_action_required",
    {
      note: "CCBill support may approve the signup within 24 hours; an approval then carries reasonForDeclineCodeBeforeOverride. Rebill declines and new declines are not eligible.",
      next: "Ask the customer to follow the confirmation email from CCBill; do not resubmit the payment yourself.",
    },
  ],
  [
    "46",
    "Transaction declined (no reason given; same text as code 11)",
    "card_declined",
    "customer_action_required",
  ],
  ["47", "Transaction limit exceeded", "rate_limiting", "do_not_retry"],
  ["48", "Purchase limit reached", "rate_limiting", "do_not_retry"],
  [
    "49",
    "Payment method could not be authenticated (3DS); use another method",
    "authentication_failed",
    "customer_action_required",
  ],
  ["50", "Email exceeds ACH transaction throttle", "rate_limiting", "do_not_retry"],
  [
    "51",
    "Processor not supported by CDS (merchant-driven settlement)",
    "configuration",
    "do_not_retry",
  ],
  [
    "52",
    "TGS transaction already captured",
    "duplicate_request",
    "do_not_retry",
    { note: 'CCBill does not explain the abbreviation "TGS".' },
  ],
  ["53", "Exceeds refund limit", "invalid_amount", "do_not_retry"],
  ["54", "Already voided", "duplicate_request", "do_not_retry"],
  ["55", "Already refunded", "duplicate_request", "do_not_retry"],
  [
    "56",
    "Invalid credit card (nearly the same text as code 23)",
    "invalid_request",
    "customer_action_required",
  ],
  ["57", "Initial price above maximum", "invalid_amount", "do_not_retry"],
  ["58", "Initial price below minimum", "invalid_amount", "do_not_retry"],
  ["59", "Recurring price above maximum", "invalid_amount", "do_not_retry"],
  ["60", "Recurring price below minimum", "invalid_amount", "do_not_retry"],
  ["61", "System error creating stored card", "provider_unavailable", "retry_conditionally"],
  ["62", "Payment account over transaction-count throttle", "rate_limiting", "do_not_retry"],
  ["63", "Payment account over transaction-amount throttle", "rate_limiting", "do_not_retry"],
  ["64", "3DS authentication failed", "authentication_failed", "customer_action_required"],
]);

/** Highest code also listed in the webhooks guide Appendix B. */
export const WEBHOOK_APPENDIX_B_MAX = 45;

// ---------------------------------------------------------------------------
// RESTful API error codes (error envelope `errorCode`), decoded by the pair
// (HTTP status, errorCode) because several numbers are reused.

export type RestErrorRow = CatalogEntry & {
  status: number;
  code: string;
  /** `error_codes_page` = https://ccbill.com/doc/error-codes; `openapi_example` = OpenAPI examples only. */
  source: "error_codes_page" | "openapi_example";
};

type RestRowSpec = [
  status: number,
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

function restTable(
  source: RestErrorRow["source"],
  rows: RestRowSpec[],
): Record<string, RestErrorRow> {
  const out: Record<string, RestErrorRow> = {};
  for (const [status, code, meaning, category, retry, opts] of rows)
    out[`${status}:${code}`] = { ...entry(meaning, category, retry, opts), status, code, source };
  return out;
}

/**
 * Rows of the error codes page. The 400 / 200000 row stands for 26 documented
 * validation messages (REST_VALIDATION_MESSAGES); the 401 row has no numeric
 * code and no response body.
 */
export const REST_ERROR_CODES: Record<string, RestErrorRow> = restTable("error_codes_page", [
  [400, "100100", "Invalid client account", "configuration", "do_not_retry"],
  [
    400,
    "100102",
    "Payment token expired",
    "invalid_request",
    "customer_action_required",
    { next: "Create a new payment token with the customer before charging again." },
  ],
  [400, "100105", "Invalid payout type", "invalid_request", "do_not_retry"],
  [400, "100106", "Invalid privacy type", "invalid_request", "do_not_retry"],
  [400, "100107", "Invalid program category", "invalid_request", "do_not_retry"],
  [400, "100108", "Invalid payment type", "invalid_request", "do_not_retry"],
  [400, "100109", "Invalid program participation", "invalid_request", "do_not_retry"],
  [
    400,
    "200000",
    "Validation failed; field-level detail is in errors[]",
    "invalid_request",
    "do_not_retry",
  ],
  [
    401,
    "invalid_token",
    "Bearer token invalid or expired (no response body)",
    "configuration",
    "retry_conditionally",
    { why: "Obtain a new OAuth token first; the rejected request was not processed." },
  ],
  [403, "100020", "Forbidden", "configuration", "do_not_retry"],
  [404, "100101", "Invalid payment token", "invalid_request", "do_not_retry"],
  [404, "100104", "Lookup object not found", "invalid_request", "do_not_retry"],
  [500, "100103", "Transaction error", "unknown", "retry_conditionally", { uncertain: true }],
  [
    500,
    "100105",
    "Could not complete the transaction needed to create a payment token",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
  [
    500,
    "100106",
    "Internal or database error, or Data Link inactive for the user",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
  [500, "100107", "Caller IP not in the allowed range", "configuration", "do_not_retry"],
  [
    500,
    "100108",
    "Account deactivated for Data Link or action not permitted",
    "configuration",
    "do_not_retry",
  ],
  [
    500,
    "100109",
    "Three or more failed logins in the last hour; wait an hour",
    "rate_limiting",
    "retry_conditionally",
    { why: "Wait at least an hour and fix the credentials before trying again." },
  ],
  [500, "100110", "Throttled: transaction count limit reached", "rate_limiting", "do_not_retry"],
  [500, "100111", "Throttled: total amount limit reached", "rate_limiting", "do_not_retry"],
  [
    500,
    "100112",
    "Could not determine whether 3DS is required",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
  [
    500,
    "100113",
    "Could not retrieve authorized amount",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
]);

/** The 26 validation messages documented for HTTP 400 / errorCode 200000 (paraphrased topics). */
export const REST_VALIDATION_MESSAGES: readonly string[] = [
  "attribute size",
  "attribute required",
  "attribute values",
  "invalid card number",
  "invalid email",
  "invalid client account",
  "invalid client subaccount",
  "invalid subscription ID",
  "invalid target client account",
  "invalid target client subaccount",
  "invalid program participation ID",
  "too many programs between merchants",
  "program does not exist between merchants",
  "program inactive",
  "invalid token",
  "customer and payment information required for zero subscription ID",
  "invalid 3DS CAVV",
  "invalid 3DS CAVV algorithm",
  "invalid 3DS XID",
  "invalid 3DS DS trans ID",
  "invalid 3DS ACS trans ID",
  "3DS parameters must contain verification or error parameters",
  "attribute digit format",
  "data type",
  "invalid program ID",
  "invalid date range",
];

/** Codes that appear only in the official OpenAPI examples, not on the error codes page. */
export const REST_EXAMPLE_CODES: Record<string, RestErrorRow> = restTable("openapi_example", [
  [404, "130000", "Not Found", "invalid_request", "do_not_retry"],
  [405, "130000", "Method Not Allowed", "invalid_request", "do_not_retry"],
  [
    406,
    "100015",
    "Not Acceptable (unsupported Accept media type)",
    "invalid_request",
    "do_not_retry",
  ],
  [415, "100004", "Unsupported Media Type", "invalid_request", "do_not_retry"],
  [
    500,
    "100100",
    'Generic internal error ("An error occurred, please try again later.")',
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
]);

// ---------------------------------------------------------------------------
// 3DS authentication error codes (3DS / widget endpoints).

export const THREEDS_ERRORS: Record<string, RestErrorRow> = restTable("error_codes_page", [
  [
    500,
    "200000",
    "3DS authorization failed for an unknown reason",
    "unknown",
    "retry_conditionally",
    { uncertain: true },
  ],
  [
    500,
    "200001",
    "Unexpected response from the third-party SCA service",
    "provider_unavailable",
    "retry_conditionally",
    { uncertain: true },
  ],
  [
    500,
    "200400",
    "Bad request sent to the third-party SCA service",
    "invalid_request",
    "do_not_retry",
  ],
  [
    500,
    "200401",
    "Unauthorized request to the third-party SCA service",
    "configuration",
    "manual_review",
  ],
  [
    500,
    "200500",
    "Transaction could not be authenticated",
    "authentication_failed",
    "customer_action_required",
  ],
  [500, "200501", "JSON could not be parsed", "invalid_request", "do_not_retry"],
  [400, "200502", "Payment token does not exist", "invalid_request", "do_not_retry"],
  [400, "200503", "No card associated with the payment token", "invalid_request", "do_not_retry"],
  [
    500,
    "200600",
    "3DS status could not be retrieved",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ],
  [500, "200601", "JSON could not be parsed", "invalid_request", "do_not_retry"],
  [
    404,
    "200602",
    "Transaction ID not found (documented as 404 with the label Bad Request)",
    "invalid_request",
    "do_not_retry",
  ],
  [400, "200603", "Transaction ID is not a valid UUID", "invalid_request", "do_not_retry"],
  [400, "200604", "Correlation ID is not a valid UUID", "invalid_request", "do_not_retry"],
  [
    400,
    "200605",
    '"Transaction Updated" is not in YYYY-MM-DD HH:mm:ss zzz format',
    "invalid_request",
    "do_not_retry",
  ],
]);

// ---------------------------------------------------------------------------
// Legacy CCBill API (subscriptionManagement.cgi; billingApi.cgi errors reuse
// the negative numbers in `results`). CSV and XML responses cannot be parsed
// by PandaPayLens input formats, so these are available through
// decodeLegacyResult only.

export const LEGACY_RESULT_CODES: Record<string, CatalogEntry> = table([
  [
    "1",
    "Success",
    "unknown",
    "unknown",
    { why: "The action succeeded; there is nothing to retry." },
  ],
  ["0", "Action failed", "unknown", "manual_review"],
  ["-1", "Authentication arguments invalid or missing", "configuration", "do_not_retry"],
  [
    "-2",
    "Subscription ID invalid, or subscription type not supported for the action",
    "invalid_request",
    "do_not_retry",
  ],
  ["-3", "No record for the subscription", "invalid_request", "do_not_retry"],
  [
    "-4",
    "Subscription belongs to another account than the authenticated one",
    "configuration",
    "do_not_retry",
  ],
  ["-5", "Action arguments invalid or missing", "invalid_request", "do_not_retry"],
  ["-6", "Invalid action", "invalid_request", "do_not_retry"],
  [
    "-7",
    "Internal or database error",
    "unknown",
    "retry_conditionally",
    {
      note: "CCBill lists common causes: upgrade price outside the allowed range, non-numeric price or period, wrong Data Link credentials, consumer username or password too short for the target subaccount, a missing argument, or a temporary system error.",
      why: "Rule out the request causes first; only a temporary system error is worth retrying, after checking that the action did not take effect.",
      uncertain: true,
    },
  ],
  ["-8", "Caller IP not in the allowed range", "configuration", "do_not_retry"],
  [
    "-9",
    "Account deactivated for Data Link or action not permitted",
    "configuration",
    "do_not_retry",
  ],
  [
    "-10",
    "Data Link not set up, or set up at a different level (subaccount vs all)",
    "configuration",
    "do_not_retry",
  ],
  [
    "-11",
    "Not eligible for discount (recurring price under $5.00)",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "-12",
    "Three or more failed logins in the last hour; wait an hour",
    "rate_limiting",
    "retry_conditionally",
    { why: "Wait at least an hour and fix the credentials before trying again." },
  ],
  ["-15", "Merchant over refund threshold", "rate_limiting", "manual_review"],
  ["-16", "Merchant over void threshold", "rate_limiting", "manual_review"],
  ["-23", "Transaction limit reached (velocity)", "rate_limiting", "do_not_retry"],
  ["-24", "Purchase limit reached (velocity)", "rate_limiting", "do_not_retry"],
]);

/** `subscriptionStatus` from the legacy viewSubscriptionStatus action. */
export const SUBSCRIPTION_STATUSES: Record<string, { meaning: string }> = {
  "0": { meaning: "Inactive" },
  "1": {
    meaning:
      "Active but cancelled by the customer (recurring only); runs to the end of the paid period",
  },
  "2": { meaning: "Active and not cancelled, or non-recurring" },
};

// ---------------------------------------------------------------------------
// Webhook event types (the `eventType` query-string parameter).

export type EventInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  /** Rebill vs initial payment; undefined for non-payment events. */
  isRecurring?: boolean;
  description: string;
  docsUrl: string;
};

const ev = (
  slug: string,
  stage: LifecycleStage,
  outcome: Outcome,
  description: string,
  isRecurring?: boolean,
): EventInfo => ({
  stage,
  outcome,
  ...(isRecurring !== undefined ? { isRecurring } : {}),
  description,
  docsUrl: `https://ccbill.com/doc/${slug}`,
});

export const WEBHOOK_EVENT_TYPES = {
  NewSaleSuccess: ev("newsalesuccess", "payment", "success", "Initial sale approved.", false),
  NewSaleFailure: ev("newsalefailure", "payment", "failure", "Initial sale declined.", false),
  UpgradeSuccess: ev("upgradesuccess", "payment", "success", "Upgrade sale approved.", false),
  UpgradeFailure: ev("upgradefailure", "payment", "failure", "Upgrade sale declined.", false),
  UpSaleSuccess: ev("upsalesuccess", "payment", "success", "Upsale approved.", false),
  UpSaleFailure: ev("upsalefailure", "payment", "failure", "Upsale declined.", false),
  CrossSaleSuccess: ev("crosssalesuccess", "payment", "success", "Cross-sale approved.", false),
  CrossSaleFailure: ev("crosssalefailure", "payment", "failure", "Cross-sale declined.", false),
  Cancellation: ev(
    "cancellation",
    "subscription",
    "success",
    "Future rebilling of the subscription was cancelled; access continues to the end of the paid period.",
  ),
  Expiration: ev(
    "expiration",
    "subscription",
    "success",
    "The subscription expired; the user's access ends.",
  ),
  BillingDateChange: ev(
    "billingdatechange",
    "subscription",
    "success",
    "The next renewal date was changed.",
  ),
  CustomerDataUpdate: ev(
    "customerdataupdate",
    "subscription",
    "success",
    "The consumer changed billing data at support.ccbill.com.",
  ),
  UserReactivation: ev(
    "userreactivation",
    "subscription",
    "success",
    "A previously cancelled subscription was reactivated.",
  ),
  RenewalSuccess: ev(
    "renewalsuccess-rebill",
    "payment",
    "success",
    "Rebill (recurring charge) approved.",
    true,
  ),
  RenewalFailure: ev(
    "renewal-failure-declined-rebill",
    "payment",
    "failure",
    "Rebill (recurring charge) declined; nextRetryDate is the next billing attempt.",
    true,
  ),
  Chargeback: ev(
    "chargeback",
    "dispute",
    "unknown",
    "A chargeback was initiated for a transaction; later dispute stages are not documented.",
  ),
  Return: ev(
    "return",
    "refund",
    "success",
    "Funds were returned to the customer for an ACH or EU debit transaction.",
  ),
  Refund: ev(
    "refund",
    "refund",
    "success",
    "A fully processed transaction was refunded (fully or partially).",
  ),
  Void: ev("void", "void", "success", "A transaction was voided before settlement."),
  ManualAdd: ev(
    "manualadd",
    "subscription",
    "success",
    "Access was added manually (Admin, API or credential re-add).",
  ),
} as const satisfies Record<string, EventInfo>;

export type WebhookEventName = keyof typeof WEBHOOK_EVENT_TYPES;

// ---------------------------------------------------------------------------
// Enumerations documented in the webhook field tables.

/** Webhook Appendix A: ISO 4217 numeric currency codes. */
export const CURRENCY_CODES: Record<string, string> = {
  "036": "AUD",
  "124": "CAD",
  "392": "JPY",
  "826": "GBP",
  "840": "USD",
  "978": "EUR",
};

export const PAYMENT_TYPES = ["CREDIT", "CHECK", "TELEPHONE", "DPEU"] as const;
export const CARD_TYPES = ["VISA", "MASTERCARD", "DISCOVER", "JCB", "AMEX", "OTHER"] as const;
export const CARD_SUB_TYPES = ["CREDIT", "DEBIT", "OTHER"] as const;
export const THREE_D_SECURE_VALUES = [
  "NOT_APPLICABLE",
  "AUTH_SUCCESS",
  "AUTH_ATTEMPTED",
  "AUTH_FAILED",
  "AUTH_UNAVAILABLE",
] as const;
/** Values documented without meanings. */
export const SCA_RESPONSE_STATUSES = ["E", "Y", "N", "A", "U", "R"] as const;
export const SOURCES = ["FORM", "API", "PHONE"] as const;
export const AFFILIATE_SYSTEMS = ["LTS", "WMS", "Miscellaneous"] as const;

/** Background Post `affiliate_system`. */
export const BP_AFFILIATE_SYSTEMS: Record<string, string> = {
  "-1": "unavailable",
  "1": "CCBill",
  "2": "WMS Affiliate",
  "3": "Miscellaneous",
  "4": "WMS Tracker",
};

export const FAMILY_DOCS: Record<CodeFamily, { title: string; url: string }[]> = {
  decline: [{ title: "CCBill Background Post decline codes", url: DECLINE_CODES_URL }],
  webhook_failure: [
    { title: "CCBill Webhooks user guide (Appendix B decline codes)", url: WEBHOOKS_GUIDE_URL },
  ],
  rest_error: [{ title: "CCBill error codes", url: ERROR_CODES_URL }],
  rest_example: [
    { title: "CCBill RESTful API OpenAPI (official repository)", url: REST_OPENAPI_URL },
  ],
  threeds: [{ title: "CCBill 3DS authentication error codes", url: ERROR_CODES_URL }],
  legacy: [{ title: "CCBill API guide (success, failure and error codes)", url: LEGACY_API_URL }],
};
