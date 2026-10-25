/**
 * Braintree error and status knowledge, kept as data.
 *
 * Every code, text and status below comes from docs/providers/research/braintree.md,
 * which cites the official Braintree developer documentation. Category and retry
 * mappings are PandaPayLens proposals derived from the documented descriptions and
 * the documented Hard/Soft decline type; Braintree does not publish them.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export type CatalogEntry = {
  category: ErrorCategory;
  explanation: string;
  nextAction: string;
  retry: RetryGuidance;
  retryExplanation: string;
};

export const AUTHORIZATION_RESPONSES_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/processor-responses/authorization-responses";
export const SETTLEMENT_RESPONSES_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/processor-responses/settlement-responses";
export const GATEWAY_REJECTIONS_URL =
  "https://developer.paypal.com/braintree/articles/control-panel/transactions/gateway-rejections";
export const STATUSES_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/statuses";
export const TRANSACTION_RESPONSE_URL =
  "https://developer.paypal.com/braintree/docs/reference/response/transaction";
export const RESULT_OBJECTS_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/result-objects";
export const VALIDATION_ERRORS_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/validation-errors/all";
export const VALIDATION_OVERVIEW_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/validation-errors/overview";
export const GRAPHQL_API_CALLS_URL =
  "https://developer.paypal.com/braintree/graphql/guides/making_api_calls/";
export const GRAPHQL_TRANSACTIONS_URL =
  "https://developer.paypal.com/braintree/graphql/guides/transactions/";
export const GRAPHQL_MIGRATING_URL =
  "https://developer.paypal.com/braintree/graphql/guides/migrating/";
export const WEBHOOKS_OVERVIEW_URL =
  "https://developer.paypal.com/braintree/docs/guides/webhooks/overview";
export const WEBHOOKS_PARSE_URL =
  "https://developer.paypal.com/braintree/docs/guides/webhooks/parse";
export const WEBHOOK_KINDS_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/overview";
export const WEBHOOK_TRANSACTION_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/transaction";
export const WEBHOOK_DISPUTE_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/dispute";
export const WEBHOOK_DISBURSEMENT_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/disbursement";
export const WEBHOOK_FRAUD_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/fraud-protection";
export const WEBHOOK_SUBSCRIPTION_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/subscription";
export const WEBHOOK_LOCAL_PAYMENT_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/local-payment-methods";
export const WEBHOOK_PAYMENT_METHOD_URL =
  "https://developer.paypal.com/braintree/docs/reference/general/webhooks/payment-method";

// ---------------------------------------------------------------------------
// Shared wording
// ---------------------------------------------------------------------------

const NEXT_ACTION: Record<RetryGuidance, string> = {
  customer_action_required:
    "Show the customer a generic message and ask them to correct the details, use another payment method, or contact their bank.",
  do_not_retry:
    "Do not retry with the same payment method. Show a generic decline message and log the code.",
  retry_conditionally:
    "Show the customer a generic message and log the code. A later attempt may succeed; avoid immediate or repeated retries.",
  safe_to_retry_technical_request: "The request can be repeated.",
  manual_review:
    "Review this transaction before taking further action, for example with the issuer or in the PayPal account settings.",
  unknown: "Check the Braintree documentation for this code.",
};

const CONFIG_ACTION =
  "Check the merchant account and processor setup in the Braintree Control Panel, or contact Braintree support. Retrying will not help until the setup is fixed.";

function nextActionFor(category: ErrorCategory, retry: RetryGuidance): string {
  if (category === "configuration" && retry === "manual_review") return CONFIG_ACTION;
  return NEXT_ACTION[retry];
}

// ---------------------------------------------------------------------------
// Processor authorization responses (1000 / 2000 / 3000 classes)
// ---------------------------------------------------------------------------

export type DeclineType = "Hard" | "Soft";

export type ProcessorResponse = CatalogEntry & {
  code: string;
  /** processor_response_text as printed in the documentation. */
  text: string;
  declineType: DeclineType;
};

export type ApprovalResponse = { code: string; text: string; meaning: string };

/** 1000-class codes: approved. They are not errors. */
export const APPROVAL_RESPONSES: Record<string, ApprovalResponse> = Object.fromEntries(
  (
    [
      ["1000", "Approved.", "Approved"],
      ["1001", "Approved. Check customer ID.", "Approved; verify the customer ID"],
      [
        "1002",
        "Processed.",
        "Not authorized but sent straight to settlement (some refunds, credits, voice authorizations)",
      ],
      [
        "1003",
        "Approved with Risk.",
        "Bank account usable, but some data mismatch or risk was noted",
      ],
      ["1004", "Approved for Partial Amount.", "Approved for less than the requested amount"],
      [
        "1005",
        "Auth Declined but Settlement Captured.",
        "Refund authorization declined but submitted for settlement",
      ],
    ] as const
  ).map(([code, text, meaning]) => [code, { code, text, meaning }]),
);

type C = ErrorCategory;
type R = RetryGuidance;
type Row = readonly [
  code: string,
  text: string,
  type: DeclineType,
  category: C,
  retry: R,
  meaning: string,
];

const MASTERCARD_NO_RETRY = new Set(["2009", "2012", "2019", "2022", "2047", "2053"]);

/** Codes with extra rules for transactions sent with a recurring ECI flag. */
const RECURRING_NOTES: Record<string, string> = {
  "2004": "For transactions with a recurring ECI flag, Braintree says not to retry this code.",
  "2005":
    "For transactions with a recurring ECI flag, Braintree says not to retry with the same payment information.",
  "2015": "For transactions with a recurring ECI flag, Braintree says not to retry this code.",
};

// prettier-ignore
const PROCESSOR_ROWS: readonly Row[] = [
  ["2000", "Do Not Honor", "Soft", "card_declined", "retry_conditionally", "The issuer is unwilling to accept the transaction; the customer should contact their bank"],
  ["2001", "Insufficient Funds", "Soft", "insufficient_funds", "retry_conditionally", "The account did not have sufficient funds at the time of authorization"],
  ["2002", "Limit Exceeded", "Soft", "insufficient_funds", "retry_conditionally", "The withdrawal or credit limit was exceeded"],
  ["2003", "Cardholder's Activity Limit Exceeded", "Soft", "card_declined", "retry_conditionally", "The cardholder's activity limit was exceeded"],
  ["2004", "Expired Card", "Hard", "card_declined", "customer_action_required", "The card has expired"],
  ["2005", "Invalid Credit Card Number", "Hard", "invalid_request", "customer_action_required", "The card number is invalid"],
  ["2006", "Invalid Expiration Date", "Hard", "invalid_request", "customer_action_required", "The expiration date is invalid"],
  ["2007", "No Account", "Hard", "card_declined", "customer_action_required", "The account is not on file with the issuer"],
  ["2008", "Card Account Length Error", "Hard", "invalid_request", "customer_action_required", "The card number has the wrong length"],
  ["2009", "No Such Issuer", "Hard", "card_declined", "do_not_retry", "The issuer was not found, or there was an issuer connectivity error"],
  ["2010", "Card Issuer Declined CVV", "Hard", "card_declined", "customer_action_required", "The issuer declined the CVV"],
  ["2011", "Voice Authorization Required", "Hard", "card_declined", "manual_review", "The issuer requires a voice authorization"],
  ["2012", "Processor Declined - Possible Lost Card", "Hard", "fraud_or_risk", "do_not_retry", "The card may have been reported lost"],
  ["2013", "Processor Declined - Possible Stolen Card", "Hard", "fraud_or_risk", "do_not_retry", "The card may have been reported stolen"],
  ["2014", "Processor Declined - Fraud Suspected", "Hard", "fraud_or_risk", "do_not_retry", "The issuer suspects fraud"],
  ["2015", "Transaction Not Allowed", "Hard", "card_declined", "do_not_retry", "The transaction is not allowed; the reason is unspecified"],
  ["2016", "Duplicate Transaction", "Soft", "duplicate_request", "retry_conditionally", "The transaction looks like a duplicate of a recent transaction"],
  ["2017", "Cardholder Stopped Billing", "Hard", "card_declined", "do_not_retry", "The cardholder stopped this billing"],
  ["2018", "Cardholder Stopped All Billing", "Hard", "card_declined", "do_not_retry", "The cardholder stopped all recurring billing"],
  ["2019", "Invalid Transaction", "Hard", "card_declined", "do_not_retry", "The card does not support this transaction type"],
  ["2020", "Violation", "Hard", "card_declined", "customer_action_required", "Violation; the cardholder must contact their bank"],
  ["2021", "Security Violation", "Hard", "fraud_or_risk", "do_not_retry", "Security violation"],
  ["2022", "Declined - Updated Cardholder Available", "Hard", "card_declined", "customer_action_required", "An updated card was issued; the old card is no longer valid"],
  ["2023", "Processor Does Not Support This Feature", "Hard", "configuration", "manual_review", "The processor does not support the requested feature (for example 3D Secure or Level 2/3 data)"],
  ["2024", "Card Type Not Enabled", "Hard", "configuration", "manual_review", "This card brand is not enabled on the merchant account"],
  ["2025", "Set Up Error - Merchant", "Soft", "configuration", "manual_review", "Merchant setup or connectivity error at the processor"],
  ["2026", "Invalid Merchant ID", "Soft", "configuration", "manual_review", "Invalid merchant ID at the processor"],
  ["2027", "Set Up Error - Amount", "Hard", "configuration", "manual_review", "Amount-related setup error"],
  ["2028", "Set Up Error - Hierarchy", "Hard", "configuration", "manual_review", "Account hierarchy setup error"],
  ["2029", "Set Up Error - Card", "Hard", "configuration", "manual_review", "Card setup error"],
  ["2030", "Set Up Error - Terminal", "Hard", "configuration", "manual_review", "Terminal setup error"],
  ["2031", "Encryption Error", "Hard", "configuration", "manual_review", "Encryption error, or the issuer does not support $0 verifications"],
  ["2032", "Surcharge Not Permitted", "Hard", "configuration", "do_not_retry", "A surcharge is not permitted on this card"],
  ["2033", "Inconsistent Data", "Hard", "invalid_request", "manual_review", "The data is inconsistent with the processor's records"],
  ["2034", "No Action Taken", "Soft", "unknown", "retry_conditionally", "An error occurred and the intended transaction was not completed"],
  ["2035", "Partial Approval For Amount In Group III Version", "Soft", "invalid_amount", "manual_review", "Partial approval (Group III)"],
  ["2036", "Authorization could not be found", "Hard", "invalid_request", "do_not_retry", "The authorization to act on was not found"],
  ["2037", "Already Reversed", "Hard", "invalid_request", "do_not_retry", "The authorization was already reversed"],
  ["2038", "Processor Declined", "Soft", "card_declined", "retry_conditionally", "The processor declined the transaction; reasons vary and the customer should contact their bank"],
  ["2039", "Invalid Authorization Code", "Hard", "invalid_request", "do_not_retry", "The authorization code is invalid or missing"],
  ["2040", "Invalid Store", "Soft", "configuration", "manual_review", "Invalid store or account configuration issue"],
  ["2041", "Declined - Call For Approval", "Hard", "card_declined", "customer_action_required", "The issuer requires the cardholder to call for approval"],
  ["2042", "Invalid Client ID", "Soft", "configuration", "manual_review", "Invalid client ID (configuration)"],
  ["2043", "Error - Do Not Retry, Call Issuer", "Hard", "card_declined", "do_not_retry", "The issuer forbids a retry; the cardholder must call the issuer"],
  ["2044", "Declined - Call Issuer", "Hard", "card_declined", "customer_action_required", "The issuer declined; the cardholder should call the issuer"],
  ["2045", "Invalid Merchant Number", "Hard", "configuration", "manual_review", "Invalid merchant number"],
  ["2046", "Declined", "Soft", "card_declined", "retry_conditionally", "Generic decline (card or PayPal)"],
  ["2047", "Call Issuer. Pick Up Card", "Hard", "fraud_or_risk", "do_not_retry", "The card was reported lost or stolen and should be picked up"],
  ["2048", "Invalid Amount", "Soft", "invalid_amount", "retry_conditionally", "The amount is invalid (zero, unreadable, or too large)"],
  ["2049", "Invalid SKU Number", "Hard", "invalid_request", "do_not_retry", "Non-numeric SKU"],
  ["2050", "Invalid Credit Plan", "Hard", "invalid_request", "do_not_retry", "Invalid credit plan"],
  ["2051", "Credit Card Number does not match method of payment", "Hard", "invalid_request", "customer_action_required", "The card number does not match the payment method"],
  ["2052", "Invalid level III Purchase", "Hard", "invalid_request", "do_not_retry", "Level III data is inaccurate or missing"],
  ["2053", "Card reported as lost or stolen", "Hard", "fraud_or_risk", "do_not_retry", "The card was reported lost or stolen"],
  ["2054", "Reversal amount does not match authorization amount", "Hard", "invalid_amount", "do_not_retry", "The refund or reversal exceeds the original amount, or a partial reversal is not allowed"],
  ["2055", "Invalid Transaction Division Number", "Hard", "configuration", "manual_review", "Invalid transaction division number"],
  ["2056", "Transaction amount exceeds the transaction division limit", "Hard", "invalid_amount", "manual_review", "The amount exceeds the transaction division limit"],
  ["2057", "Issuer or Cardholder has put a restriction on the card", "Soft", "card_declined", "retry_conditionally", "The issuer or cardholder restricted the card"],
  ["2058", "Merchant not Mastercard SecureCode enabled", "Hard", "configuration", "manual_review", "The merchant is not enabled for Mastercard SecureCode"],
  ["2059", "Address Verification Failed", "Hard", "fraud_or_risk", "customer_action_required", "PayPal address verification failed (seller protection)"],
  ["2060", "Address Verification and Card Security Code Failed", "Hard", "fraud_or_risk", "customer_action_required", "PayPal address verification and CVV both failed"],
  ["2061", "Invalid Transaction Data", "Hard", "invalid_request", "do_not_retry", "Invalid transaction data"],
  ["2062", "Invalid Tax Amount", "Soft", "invalid_amount", "retry_conditionally", "Invalid tax amount"],
  ["2063", "PayPal Business Account preference resulted in the transaction failing", "Hard", "configuration", "manual_review", "A PayPal business account preference blocked the payment"],
  ["2064", "Invalid Currency Code", "Hard", "configuration", "do_not_retry", "The currency code is invalid for the account"],
  ["2065", "Refund Time Limit Exceeded", "Hard", "invalid_request", "do_not_retry", "The PayPal refund is past its time limit"],
  ["2066", "PayPal Business Account Restricted", "Hard", "configuration", "manual_review", "The PayPal business account is restricted"],
  ["2067", "Authorization Expired", "Hard", "invalid_request", "do_not_retry", "The PayPal authorization expired"],
  ["2068", "PayPal Business Account Locked or Closed", "Hard", "configuration", "manual_review", "The PayPal business account is locked or closed"],
  ["2069", "PayPal Blocking Duplicate Order IDs", "Hard", "duplicate_request", "do_not_retry", "PayPal blocked a duplicate order ID"],
  ["2070", "PayPal Buyer Revoked Pre-Approved Payment Authorization", "Hard", "payment_method_unavailable", "customer_action_required", "The buyer revoked the pre-approved PayPal payment"],
  ["2071", "PayPal Payee Account Invalid Or Does Not Have a Confirmed Email", "Hard", "configuration", "manual_review", "The PayPal payee account is invalid or its email is unconfirmed"],
  ["2072", "PayPal Payee Email Incorrectly Formatted", "Hard", "configuration", "manual_review", "The PayPal payee email is badly formatted"],
  ["2073", "PayPal Validation Error", "Hard", "invalid_request", "do_not_retry", "PayPal could not validate the transaction"],
  ["2074", "Funding Instrument In The PayPal Account Was Declined By The Processor Or Bank, Or It Can't", "Hard", "payment_method_unavailable", "customer_action_required", "The funding source in the PayPal account was declined or cannot be used"],
  ["2075", "Payer Account Is Locked Or Closed", "Hard", "payment_method_unavailable", "customer_action_required", "The payer's PayPal account is locked or closed"],
  ["2076", "Payer Cannot Pay For This Transaction With PayPal", "Hard", "payment_method_unavailable", "customer_action_required", "The payer cannot use PayPal for this transaction"],
  ["2077", "Transaction Refused Due To PayPal Risk Model", "Hard", "fraud_or_risk", "do_not_retry", "Refused by the PayPal risk model"],
  ["2078", "Invalid Secure Payment Data", "Soft", "invalid_request", "retry_conditionally", "Invalid secure payment data (for example PIN decryption)"],
  ["2079", "PayPal Merchant Account Configuration Error", "Hard", "configuration", "manual_review", "PayPal merchant account configuration error"],
  ["2080", "Invalid user credentials", "Soft", "configuration", "manual_review", "Invalid user credentials"],
  ["2081", "PayPal pending payments are not supported", "Hard", "configuration", "manual_review", "PayPal pending payments are not supported"],
  ["2082", "PayPal Domestic Transaction Required", "Hard", "configuration", "do_not_retry", "PayPal requires a domestic transaction"],
  ["2083", "PayPal Phone Number Required", "Hard", "invalid_request", "customer_action_required", "PayPal requires the payer's phone number"],
  ["2084", "PayPal Tax Info Required", "Hard", "invalid_request", "customer_action_required", "PayPal requires the payer's tax information"],
  ["2085", "PayPal Payee Blocked Transaction", "Hard", "fraud_or_risk", "manual_review", "The payee's fraud settings blocked the payment"],
  ["2086", "PayPal Transaction Limit Exceeded", "Hard", "payment_method_unavailable", "customer_action_required", "The PayPal transaction limit was exceeded"],
  ["2087", "PayPal reference transactions not enabled for your account", "Hard", "configuration", "manual_review", "PayPal reference transactions are not enabled"],
  ["2088", "Currency not enabled for your PayPal seller account", "Hard", "configuration", "manual_review", "The currency is not enabled on the PayPal seller account"],
  ["2089", "PayPal payee email permission denied for this request", "Hard", "configuration", "manual_review", "PayPal payee email permission denied"],
  ["2090", "PayPal or Venmo account not configured to refund more than settled amount", "Hard", "configuration", "manual_review", "The PayPal or Venmo account is not configured to refund more than the settled amount"],
  ["2091", "Currency of this transaction must match currency of your PayPal account", "Hard", "configuration", "do_not_retry", "The currency must match the PayPal account currency"],
  ["2092", "No Data Found - Try Another Verification Method", "Soft", "payment_method_unavailable", "customer_action_required", "No data found; use another verification method"],
  ["2093", "PayPal payment method is invalid", "Hard", "payment_method_unavailable", "customer_action_required", "The PayPal payment method is invalid, expired or canceled"],
  ["2094", "PayPal payment has already been completed", "Hard", "duplicate_request", "do_not_retry", "The PayPal payment was already completed (out-of-sequence call)"],
  ["2095", "PayPal refund is not allowed after partial refund", "Hard", "invalid_request", "do_not_retry", "A full PayPal refund is not allowed after a partial refund"],
  ["2096", "PayPal buyer account can't be the same as the seller account", "Hard", "invalid_request", "do_not_retry", "The PayPal buyer and seller are the same account"],
  ["2097", "PayPal authorization amount limit exceeded", "Hard", "invalid_amount", "do_not_retry", "The PayPal authorization amount limit was exceeded"],
  ["2098", "PayPal authorization count limit exceeded", "Hard", "invalid_request", "do_not_retry", "The PayPal authorization count limit was exceeded"],
  ["2099", "Cardholder Authentication Required", "Soft", "authentication_required", "customer_action_required", "Cardholder authentication (3D Secure) is required"],
  ["2100", "PayPal channel initiated billing not enabled for your account", "Hard", "configuration", "manual_review", "PayPal channel-initiated billing is not enabled"],
  ["2101", "Additional authorization required", "Soft", "authentication_required", "customer_action_required", "Additional authorization is required (for example inserting the chip)"],
  ["2102", "Incorrect PIN", "Soft", "authentication_failed", "customer_action_required", "Incorrect PIN"],
  ["2103", "PIN try exceeded", "Soft", "authentication_failed", "customer_action_required", "PIN attempts exceeded"],
  ["2104", "Offline Issuer Declined", "Soft", "card_declined", "retry_conditionally", "Declined offline by the issuer"],
  ["2105", "Cannot Authorize at this time (Life cycle)", "Soft", "card_declined", "retry_conditionally", "Cannot authorize now (card life cycle)"],
  ["2106", "Cannot Authorize at this time (Policy)", "Soft", "card_declined", "retry_conditionally", "Cannot authorize now (policy)"],
  ["2107", "Card Not Activated", "Hard", "card_declined", "customer_action_required", "The card is not activated"],
  ["2108", "Closed Card", "Hard", "payment_method_unavailable", "customer_action_required", "The card or account is closed"],
  ["3000", "Processor Network Unavailable - Try Again", "Soft", "provider_unavailable", "retry_conditionally", "A back-end processing network problem occurred"],
];

function retryExplanationFor(code: string, type: DeclineType, retry: R, category: C): string {
  const parts: string[] = [];
  if (code === "3000") {
    parts.push(
      "Braintree reports a back-end network problem and documents this code as a soft decline.",
      "A retry creates a new transaction because the charge request has no documented idempotency key, so first check whether the original transaction exists and what its status is.",
    );
    return parts.join(" ");
  }
  parts.push(
    type === "Hard"
      ? "Braintree documents this as a hard decline: it is not temporary, so retries on the same payment method will likely fail."
      : "Braintree documents this as a soft decline: it is temporary, so a later retry may succeed.",
  );
  if (MASTERCARD_NO_RETRY.has(code)) parts.push("Mastercard prohibits retries for this code.");
  const recurring = RECURRING_NOTES[code];
  if (recurring) parts.push(recurring);
  if (category === "duplicate_request")
    parts.push("Check whether the earlier transaction succeeded before sending another one.");
  if (retry === "retry_conditionally" && type === "Soft")
    parts.push(
      "For transactions with a recurring ECI flag, soft declines may be retried at most 15 times in 30 days.",
    );
  return parts.join(" ");
}

function processorEntry(row: Row): ProcessorResponse {
  const [code, text, declineType, category, retry, meaning] = row;
  return {
    code,
    text,
    declineType,
    category,
    retry,
    explanation: `${meaning}. Processor response ${code} ("${text}").`,
    nextAction: nextActionFor(category, retry),
    retryExplanation: retryExplanationFor(code, declineType, retry, category),
  };
}

/** 2000-2108 and 3000, keyed by code. */
export const PROCESSOR_RESPONSES: Record<string, ProcessorResponse> = Object.fromEntries(
  PROCESSOR_ROWS.map((r) => [r[0], processorEntry(r)]),
);

/** The documented generic row for every code from 2109 to 2999. */
export const PROCESSOR_DECLINED_RANGE: ProcessorResponse = {
  code: "2109-2999",
  text: "Processor Declined",
  declineType: "Soft",
  category: "card_declined",
  retry: "retry_conditionally",
  explanation:
    'Generic processor decline. Braintree documents every code from 2109 to 2999 as "Processor Declined" without an individual meaning.',
  nextAction: NEXT_ACTION.retry_conditionally,
  retryExplanation: retryExplanationFor("2109", "Soft", "retry_conditionally", "card_declined"),
};

// ---------------------------------------------------------------------------
// Settlement responses (4000 class)
// ---------------------------------------------------------------------------

export type SettlementResponse = CatalogEntry & {
  code: string;
  text: string;
  group: "Approval" | "Pending" | "Decline";
};

type SettlementRow = readonly [
  code: string,
  text: string,
  group: SettlementResponse["group"],
  meaning: string,
  category: C,
  retry: R,
];

// prettier-ignore
const SETTLEMENT_ROWS: readonly SettlementRow[] = [
  ["4000", "Settled", "Approval", "The capture succeeded", "unknown", "unknown"],
  ["4002", "Settlement Pending", "Pending", "The capture is still in progress", "unknown", "retry_conditionally"],
  ["4001", "Settlement Declined", "Decline", "The processor refused to settle the sale or refund", "card_declined", "manual_review"],
  ["4003", "Already Captured", "Decline", "The transaction was already fully captured", "duplicate_request", "do_not_retry"],
  ["4004", "Already Refunded", "Decline", "The transaction was already fully refunded", "duplicate_request", "do_not_retry"],
  ["4005", "PayPal Risk Rejected", "Decline", "PayPal risk rejected the sale", "fraud_or_risk", "do_not_retry"],
  ["4006", "Capture Amount Exceeded Allowable Limit", "Decline", "The capture amount is above the processor limit", "invalid_amount", "do_not_retry"],
  ["4018", "PayPal Pending Payments Not Supported", "Decline", "PayPal returned a pending payment, which Braintree does not allow; the account is likely misconfigured", "configuration", "manual_review"],
  ["4019", "PayPal Refund Transaction with an Open Case Not Allowed", "Decline", "The refund is blocked by an open dispute or case", "invalid_request", "manual_review"],
  ["4020", "PayPal Refund Attempt Limit Reached", "Decline", "The maximum number of refund attempts was exceeded", "rate_limiting", "do_not_retry"],
  ["4021", "PayPal Refund Transaction Not Allowed", "Decline", "A refund is not allowed for this transaction type", "invalid_request", "do_not_retry"],
  ["4022", "PayPal Refund Invalid Partial Amount", "Decline", "The partial refund amount is invalid", "invalid_amount", "do_not_retry"],
  ["4023", "PayPal Refund Merchant Account Missing ACH", "Decline", "The PayPal account has no verified bank account", "configuration", "manual_review"],
  ["4024", "Refund Time Limit Exceeded", "Decline", "The refund is outside the 180-day window", "invalid_request", "do_not_retry"],
  ["4025", "Payer Account Is Locked Or Closed", "Decline", "The customer's PayPal account cannot be used", "payment_method_unavailable", "customer_action_required"],
  ["4026", "PayPal or Venmo account not configured to refund more than settled amount", "Decline", "Refunding more than the settled amount is not enabled (contact PayPal)", "configuration", "manual_review"],
];

function settlementRetryExplanation(code: string, retry: R): string {
  if (code === "4002")
    return "The settlement is still pending. Wait for it to resolve instead of resubmitting, which could capture twice.";
  switch (retry) {
    case "do_not_retry":
      return "Resubmitting the same settlement or refund will not change the result.";
    case "customer_action_required":
      return "A new attempt needs the customer to act first.";
    case "manual_review":
      return "The cause has to be investigated before any new settlement or refund attempt.";
    default:
      return "No retry guidance applies to this code.";
  }
}

export const SETTLEMENT_RESPONSES: Record<string, SettlementResponse> = Object.fromEntries(
  SETTLEMENT_ROWS.map(([code, text, group, meaning, category, retry]) => [
    code,
    {
      code,
      text,
      group,
      category,
      retry,
      explanation: `${meaning}. Settlement response ${code} ("${text}").`,
      nextAction:
        code === "4002"
          ? "Wait for the settlement to complete; ACH Direct Debit settlements typically update within a few business days."
          : nextActionFor(category, retry),
      retryExplanation: settlementRetryExplanation(code, retry),
    },
  ]),
);

// ---------------------------------------------------------------------------
// Gateway rejection reasons
// ---------------------------------------------------------------------------

export type GatewayRejection = CatalogEntry & {
  /** GraphQL enum value; the SDK value is the lowercase form. */
  graphqlValue: string;
  /** Whether the SDK Transaction reference lists the lowercase value. */
  sdkDocumented: boolean;
  /** Whether Braintree documents what the reason means beyond its name. */
  described: boolean;
};

const GATEWAY_NOTE =
  "A gateway rejection comes from the merchant's own gateway settings, not from the issuer. If the transaction was already authorized, Braintree voids it automatically, although the bank may be slow to release the hold.";

type GatewayRow = readonly [
  value: string,
  sdk: boolean,
  described: boolean,
  meaning: string,
  category: C,
  retry: R,
];

// prettier-ignore
const GATEWAY_ROWS: readonly GatewayRow[] = [
  ["application_incomplete", true, true, "The provisional merchant account reached its processing limit before full approval", "configuration", "manual_review"],
  ["avs", true, true, "Blocked by the merchant's AVS rules", "fraud_or_risk", "customer_action_required"],
  ["avs_and_cvv", true, true, "Blocked by the merchant's AVS and CVV rules", "fraud_or_risk", "customer_action_required"],
  ["cvv", true, true, "Blocked by the merchant's CVV rules", "fraud_or_risk", "customer_action_required"],
  ["duplicate", true, true, "Blocked by duplicate transaction checking", "duplicate_request", "do_not_retry"],
  ["fraud", true, true, "Blocked by fraud tools (premium fraud tools or Fraud Protection)", "fraud_or_risk", "manual_review"],
  ["risk_threshold", true, true, "Blocked by basic risk threshold rules", "fraud_or_risk", "manual_review"],
  ["three_d_secure", true, true, "Blocked by 3D Secure rules", "authentication_failed", "customer_action_required"],
  ["token_issuance", true, true, "Rejected during token issuance", "payment_method_unavailable", "customer_action_required"],
  ["payment_method_blocked", false, true, "The payment method is blocked", "payment_method_unavailable", "customer_action_required"],
  ["excessive_retry", false, false, "Excessive retry", "rate_limiting", "do_not_retry"],
  ["manual_transactions_disabled", false, false, "Manual transactions disabled", "configuration", "manual_review"],
  ["too_many_confirmation_attempts", false, false, "Too many confirmation attempts", "rate_limiting", "do_not_retry"],
  ["union_pay_enrollment_required", false, false, "UnionPay enrollment required", "authentication_required", "customer_action_required"],
];

function gatewayRetryExplanation(value: string, retry: R): string {
  if (value === "duplicate")
    return "The gateway treated this as a duplicate of an earlier transaction. Check the earlier transaction (GraphQL duplicateOf) instead of sending another one.";
  switch (retry) {
    case "customer_action_required":
      return "Retrying with the same details will be rejected by the same rule; the customer has to correct or change the payment details first.";
    case "manual_review":
      return "The same gateway rules will reject an identical retry. Review the rule or the account setup first.";
    default:
      return "Retrying will be rejected again by the same gateway setting.";
  }
}

export const GATEWAY_REJECTION_REASONS: Record<string, GatewayRejection> = Object.fromEntries(
  GATEWAY_ROWS.map(([value, sdk, described, meaning, category, retry]) => [
    value,
    {
      graphqlValue: value.toUpperCase(),
      sdkDocumented: sdk,
      described,
      category,
      retry,
      explanation: `${meaning}${described ? "" : " (Braintree documents the name only, without a description)"}. ${GATEWAY_NOTE}`,
      nextAction:
        retry === "manual_review" && category === "configuration"
          ? CONFIG_ACTION
          : retry === "manual_review"
            ? "Review the transaction and your fraud or risk settings in the Braintree Control Panel."
            : retry === "do_not_retry"
              ? "Do not resend the same transaction. Check the earlier attempts for this order first."
              : NEXT_ACTION.customer_action_required,
      retryExplanation: gatewayRetryExplanation(value, retry),
    },
  ]),
);

// ---------------------------------------------------------------------------
// Validation errors (SDK `code`, GraphQL `extensions.legacyCode`)
// ---------------------------------------------------------------------------

export type ValidationError = CatalogEntry & { code: string; text: string };

type ValidationRow = readonly [code: string, text: string, category: C, retry: R];

/**
 * Only the Transaction validation codes transcribed in the research file. The
 * full list has 99 Transaction codes; the others fall back to the GraphQL
 * errorClass or a generic validation entry.
 */
// prettier-ignore
const VALIDATION_ROWS: readonly ValidationRow[] = [
  ["81501", "Amount cannot be negative", "invalid_amount", "do_not_retry"],
  ["81502", "Amount is required", "invalid_amount", "do_not_retry"],
  ["81503", "Amount is an invalid format", "invalid_amount", "do_not_retry"],
  ["81528", "Amount is too large", "invalid_amount", "do_not_retry"],
  ["81531", "Amount must be greater than zero", "invalid_amount", "do_not_retry"],
  ["91504", "Transaction can only be voided if status is authorized or submitted_for_settlement", "invalid_request", "manual_review"],
  ["91506", "Cannot refund a transaction unless it is settled", "invalid_request", "manual_review"],
  ["91507", "Cannot submit for settlement unless status is authorized", "invalid_request", "manual_review"],
  ["91512", "Transaction has already been completely refunded", "duplicate_request", "do_not_retry"],
  ["91521", "Refund amount is too large", "invalid_amount", "do_not_retry"],
  ["91522", "Settlement amount is too large", "invalid_amount", "do_not_retry"],
  ["91565", "Unknown or expired payment_method_nonce", "invalid_request", "do_not_retry"],
];

const VALIDATION_ACTIONS: Record<string, string> = {
  "91565":
    "Obtain a new payment method nonce from the client and send a new request. Nonces are single-use.",
  "91512": "Do not send another refund. The transaction has nothing left to refund.",
  "91504":
    "Check the transaction status first. After settling or settled, refund instead of voiding.",
  "91506": "Wait until the transaction is settled, or void it while it can still be voided.",
  "91507":
    "Check the transaction status; only an authorized transaction can be submitted for settlement.",
};

export const VALIDATION_ERRORS: Record<string, ValidationError> = Object.fromEntries(
  VALIDATION_ROWS.map(([code, text, category, retry]) => [
    code,
    {
      code,
      text,
      category,
      retry,
      explanation: `Validation error ${code}: ${text}. Braintree rejected the request before processing it.`,
      nextAction:
        VALIDATION_ACTIONS[code] ??
        "Correct the request input named in the error and send a new request.",
      retryExplanation:
        retry === "manual_review"
          ? "The request is invalid for the transaction's current status. Repeating it unchanged fails again; check the status first."
          : "Repeating the same request returns the same validation error.",
    },
  ]),
);

/** Fallback for validation codes not transcribed above. */
export const GENERIC_VALIDATION_ERROR: CatalogEntry = {
  category: "invalid_request",
  explanation: "Braintree rejected the request input before processing it.",
  nextAction:
    "Look up the code in the Braintree validation error reference and correct the input named in the error.",
  retry: "do_not_retry",
  retryExplanation: "Repeating the same request returns the same validation error.",
};

// ---------------------------------------------------------------------------
// GraphQL errorClass (no per-value descriptions are published)
// ---------------------------------------------------------------------------

export const GRAPHQL_ERROR_CLASSES: Record<string, CatalogEntry> = {
  VALIDATION: { ...GENERIC_VALIDATION_ERROR },
  AUTHENTICATION: {
    category: "configuration",
    explanation:
      "The GraphQL request failed authentication (errorClass AUTHENTICATION), typically because of invalid API credentials. Braintree publishes no description for this class.",
    nextAction:
      "Check the API keys or the authorization header used for the request and the environment (sandbox or production).",
    retry: "do_not_retry",
    retryExplanation: "The same credentials will fail again. Nothing was processed.",
  },
  AUTHORIZATION: {
    category: "configuration",
    explanation:
      "The credentials are not allowed to perform this operation (errorClass AUTHORIZATION). Braintree publishes no description for this class.",
    nextAction: "Check the permissions of the API user or the merchant account used.",
    retry: "manual_review",
    retryExplanation: "Repeating the request fails until the permissions are changed.",
  },
  NOT_FOUND: {
    category: "invalid_request",
    explanation: "A resource referenced by the request was not found (errorClass NOT_FOUND).",
    nextAction: "Check the ids in the request, and whether they are GraphQL ids or legacy ids.",
    retry: "do_not_retry",
    retryExplanation: "Repeating the same request returns the same error.",
  },
  UNSUPPORTED_CLIENT: {
    category: "configuration",
    explanation: "The client is not supported (errorClass UNSUPPORTED_CLIENT).",
    nextAction: "Check the Braintree-Version header and the client library version.",
    retry: "do_not_retry",
    retryExplanation: "Repeating the same request returns the same error.",
  },
  NOT_IMPLEMENTED: {
    category: "configuration",
    explanation: "The requested operation is not implemented (errorClass NOT_IMPLEMENTED).",
    nextAction: "Use another API operation or contact Braintree support.",
    retry: "do_not_retry",
    retryExplanation: "Repeating the same request returns the same error.",
  },
  RESOURCE_LIMIT: {
    category: "rate_limiting",
    explanation: "A resource limit was reached (errorClass RESOURCE_LIMIT).",
    nextAction: "Reduce the request rate or size and try again later.",
    retry: "retry_conditionally",
    retryExplanation:
      "Braintree does not document whether the operation took effect. For a mutation, check the transaction state before retrying; then retry later with backoff.",
  },
  SERVICE_AVAILABILITY: {
    category: "provider_unavailable",
    explanation: "The service was not available (errorClass SERVICE_AVAILABILITY).",
    nextAction:
      "For a read-only query, repeat it later. For a mutation such as a charge, search for the transaction before sending a new request.",
    retry: "retry_conditionally",
    retryExplanation:
      "A read-only query can be repeated safely. For a mutation the outcome is unknown: the transaction may still have been created, so verify first, because a new charge request creates a new transaction.",
  },
  INTERNAL: {
    category: "provider_unavailable",
    explanation: "Braintree reported an internal error (errorClass INTERNAL).",
    nextAction:
      "Search for the transaction before sending a new request, then retry later if nothing was created.",
    retry: "retry_conditionally",
    retryExplanation:
      "The outcome of the original operation is unknown. Verify that no transaction was created before retrying, because a new charge request creates a new transaction.",
  },
};

// ---------------------------------------------------------------------------
// Transaction statuses
// ---------------------------------------------------------------------------

export type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  /** Stage when the transaction is a refund (type credit). */
  refundStage: LifecycleStage;
  /** Outcome when the transaction is a refund. */
  refundOutcome: Outcome;
  terminal: boolean;
  meaning: string;
};

const st = (
  stage: LifecycleStage,
  outcome: Outcome,
  terminal: boolean,
  meaning: string,
  refund: [LifecycleStage, Outcome] = ["refund", outcome],
): StatusInfo => ({
  stage,
  outcome,
  refundStage: refund[0],
  refundOutcome: refund[1],
  terminal,
  meaning,
});

/**
 * Keyed by the SDK spelling. GraphQL `PaymentStatus` uses the same names in
 * upper case. Submitted for settlement is a capture request, not settlement.
 */
// prettier-ignore
export const TRANSACTION_STATUSES: Record<string, StatusInfo> = {
  authorization_expired: st("cancellation", "failure", true, "The authorization expired before it was submitted for settlement"),
  authorized: st("authorization", "success", false, "The processor approved the transaction; funds are on hold until it is submitted for settlement or voided"),
  authorizing: st("authorization", "pending", false, "The authorization is in progress"),
  submitted_for_settlement: st("capture", "pending", false, "Captured and queued for the next settlement batch; not yet settled"),
  settling: st("settlement", "pending", false, "Settlement is in progress; the transaction can no longer be voided, only refunded"),
  settled: st("settlement", "success", true, "Settlement is complete"),
  settlement_pending: st("settlement", "pending", false, "Not yet fully settled (normal for ACH Direct Debit and multiple partial settlements)"),
  settlement_declined: st("settlement", "failure", true, "The processor declined the transaction at settlement"),
  settlement_confirmed: st("settlement", "unknown", true, "Parent of a partial capture; the parent does not settle, its child transactions do", ["refund", "unknown"]),
  processor_declined: st("authorization", "failure", true, "The processor declined the transaction at authorization"),
  gateway_rejected: st("authorization", "failure", true, "Rejected by the merchant's gateway rules or a provisional account limit"),
  failed: st("authorization", "failure", true, "An error occurred while sending the transaction to the processor"),
  voided: st("void", "failure", true, "Cancelled before settlement", ["void", "failure"]),
};

/** GraphQL PaymentStatus enum values. */
export const PAYMENT_STATUS_ENUM = new Set(
  Object.keys(TRANSACTION_STATUSES).map((s) => s.toUpperCase()),
);

export const DISPUTE_STATUSES = new Set([
  "open",
  "disputed",
  "under_review",
  "accepted",
  "auto_accepted",
  "expired",
  "won",
  "lost",
]);

// ---------------------------------------------------------------------------
// Webhook notification kinds
// ---------------------------------------------------------------------------

export type WebhookKind = {
  /** Attribute of the notification that holds the subject. */
  subject:
    | "transaction"
    | "dispute"
    | "disbursement"
    | "transaction_review"
    | "subscription"
    | "local_payment"
    | "payment_method";
  stage: LifecycleStage;
  outcome: Outcome;
  description: string;
  url: string;
};

const kind = (
  subject: WebhookKind["subject"],
  stage: LifecycleStage,
  outcome: Outcome,
  description: string,
  url: string,
): WebhookKind => ({ subject, stage, outcome, description, url });

// prettier-ignore
export const WEBHOOK_KINDS: Record<string, WebhookKind> = {
  transaction_settled: kind("transaction", "settlement", "success", "Transaction settled (ACH Direct Debit and SEPA Direct Debit only)", WEBHOOK_TRANSACTION_URL),
  transaction_settlement_declined: kind("transaction", "settlement", "failure", "Settlement was rejected, possibly after transaction_settled (bank return; ACH and SEPA Direct Debit only)", WEBHOOK_TRANSACTION_URL),
  transaction_disbursed: kind("transaction", "other", "unknown", "Deprecated. The transaction was marked for disbursement", WEBHOOK_DISBURSEMENT_URL),
  disbursement: kind("disbursement", "other", "unknown", "Daily, per merchant account: funds were sent", WEBHOOK_DISBURSEMENT_URL),
  transaction_reviewed: kind("transaction_review", "other", "unknown", "A Fraud Protection review was accepted or rejected; if rejected, a void or refund was requested", WEBHOOK_FRAUD_URL),
  dispute_opened: kind("dispute", "dispute", "unknown", "A new dispute was opened", WEBHOOK_DISPUTE_URL),
  dispute_under_review: kind("dispute", "dispute", "unknown", "The dispute is under internal PayPal review", WEBHOOK_DISPUTE_URL),
  dispute_disputed: kind("dispute", "dispute", "unknown", "The merchant contested the dispute", WEBHOOK_DISPUTE_URL),
  dispute_accepted: kind("dispute", "dispute", "unknown", "The merchant accepted the dispute", WEBHOOK_DISPUTE_URL),
  dispute_auto_accepted: kind("dispute", "dispute", "unknown", "The dispute was accepted automatically", WEBHOOK_DISPUTE_URL),
  dispute_won: kind("dispute", "dispute", "unknown", "The dispute was resolved in the merchant's favor", WEBHOOK_DISPUTE_URL),
  dispute_lost: kind("dispute", "dispute", "unknown", "The dispute was resolved against the merchant", WEBHOOK_DISPUTE_URL),
  dispute_expired: kind("dispute", "dispute", "unknown", "The response window lapsed", WEBHOOK_DISPUTE_URL),
  subscription_charged_successfully: kind("subscription", "payment", "success", "A subscription billing charge succeeded", WEBHOOK_SUBSCRIPTION_URL),
  subscription_charged_unsuccessfully: kind("subscription", "payment", "failure", "A subscription billing charge failed (not sent for manual retries or failed subscription creation)", WEBHOOK_SUBSCRIPTION_URL),
  subscription_went_past_due: kind("subscription", "other", "unknown", "The subscription went past due (once per billing cycle)", WEBHOOK_SUBSCRIPTION_URL),
  subscription_went_active: kind("subscription", "other", "unknown", "The subscription went active", WEBHOOK_SUBSCRIPTION_URL),
  subscription_canceled: kind("subscription", "other", "unknown", "The subscription was canceled", WEBHOOK_SUBSCRIPTION_URL),
  subscription_expired: kind("subscription", "other", "unknown", "The subscription expired", WEBHOOK_SUBSCRIPTION_URL),
  subscription_trial_ended: kind("subscription", "other", "unknown", "The subscription trial ended", WEBHOOK_SUBSCRIPTION_URL),
  subscription_billing_skipped: kind("subscription", "other", "unknown", "A subscription billing was skipped", WEBHOOK_SUBSCRIPTION_URL),
  local_payment_completed: kind("local_payment", "other", "unknown", "Local payment method lifecycle notification", WEBHOOK_LOCAL_PAYMENT_URL),
  local_payment_reversed: kind("local_payment", "other", "unknown", "Local payment method lifecycle notification", WEBHOOK_LOCAL_PAYMENT_URL),
  local_payment_funded: kind("local_payment", "other", "unknown", "Local payment method lifecycle notification", WEBHOOK_LOCAL_PAYMENT_URL),
  local_payment_expired: kind("local_payment", "other", "unknown", "Local payment method lifecycle notification", WEBHOOK_LOCAL_PAYMENT_URL),
  payment_method_revoked_by_customer: kind("payment_method", "other", "unknown", "A vaulted payment method was revoked by the customer", WEBHOOK_PAYMENT_METHOD_URL),
  payment_method_customer_data_updated: kind("payment_method", "other", "unknown", "A vaulted payment method's customer data was updated", WEBHOOK_PAYMENT_METHOD_URL),
};

/** Number of individually documented catalog entries, for reporting. */
export const CATALOG_SIZE = {
  approvals: Object.keys(APPROVAL_RESPONSES).length,
  processorResponses: Object.keys(PROCESSOR_RESPONSES).length + 1,
  settlementResponses: Object.keys(SETTLEMENT_RESPONSES).length,
  gatewayRejectionReasons: Object.keys(GATEWAY_REJECTION_REASONS).length,
  validationErrors: Object.keys(VALIDATION_ERRORS).length,
  graphqlErrorClasses: Object.keys(GRAPHQL_ERROR_CLASSES).length,
  transactionStatuses: Object.keys(TRANSACTION_STATUSES).length,
  webhookKinds: Object.keys(WEBHOOK_KINDS).length,
} as const;
