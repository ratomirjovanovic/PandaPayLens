/**
 * payabl. code and status knowledge, kept as data.
 *
 * Every code below comes from docs/providers/research/payabl.md, which cites
 * the payabl. documentation pages linked in the URL constants. Category and
 * retry values are PandaPayLens interpretations of the documented meanings.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const RESPONSE_CODES_URL = "https://docs.payabl.com/docs/response-codes-detailed";
export const CFT_CODES_URL = "https://docs.payabl.com/docs/cft-response-code";
export const ISSUER_CODES_URL = "https://docs.payabl.com/docs/error-codes-for-credit-cards-2";
export const MAC_CODES_URL = "https://docs.payabl.com/docs/mastercard-merchant-advice-codes";
export const MASTERCARD_CODES_URL = "https://docs.payabl.com/docs/error-codes-mastercard";
export const VISA_CODES_URL = "https://docs.payabl.com/docs/error-codes-visa";
export const APM_CODES_URL = "https://docs.payabl.com/docs/error-codes-apm";
export const THREEDS_REASON_URL =
  "https://docs.payabl.com/docs/3ds-transaction-status-reason-codes";
export const WEBSDK_ERRORS_URL = "https://docs.payabl.com/docs/error-handling";
export const SOFT_DECLINES_URL = "https://docs.payabl.com/docs/soft-declines";
export const SEPA_DD_URL = "https://docs.payabl.com/docs/sepa-direct-debit";
export const AUTHORIZATION_URL = "https://docs.payabl.com/docs/authorization";
export const PRE_AUTHORIZATION_URL = "https://docs.payabl.com/docs/pre-authorization";
export const REFUND_URL = "https://docs.payabl.com/docs/refund";
export const THREEDS_SERVICES_URL = "https://docs.payabl.com/docs/payabl-3dsecure-services";
export const NOTIFICATION_RETRY_URL = "https://docs.payabl.com/docs/retry-notificationcallback";
export const SIGNATURE_URL = "https://docs.payabl.com/docs/signature-calculation2";
export const HPP_INIT_URL = "https://docs.payabl.com/docs/initiate-a-transaction-1";
export const WEBSDK_PARAMETERS_URL = "https://docs.payabl.com/docs/parameters";
export const INSTANT_BANK_TRANSFER_URL = "https://docs.payabl.com/docs/instant-bank-transfer";
export const HELP_URL = "https://docs.payabl.com/docs/help";

/** Which documented code table an entry comes from. */
export type CodeFamily =
  | "gateway"
  | "risk"
  | "cft"
  | "oct"
  | "issuer"
  | "scheme"
  | "mac"
  | "threeds_reason"
  | "apm_eps"
  | "apm_sofort"
  | "apm_trustly"
  | "websdk"
  | "observed";

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
  invalid_request: "Correct the request fields named by the code before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another payment method.",
  fraud_or_risk:
    "Do not retry. Review the transaction and contact payabl. support or your account manager for details.",
  rate_limiting: "Wait before trying again and avoid automated repeated attempts.",
  provider_unavailable:
    "Check the transaction's final status (notification or diagnose interface) before trying again.",
  network_or_timeout:
    "Confirm the final status through the notification or the diagnose interface before sending a new request.",
  duplicate_request:
    "Check whether an earlier identical request is still active or already succeeded.",
  configuration:
    "Check the merchant account configuration, credentials and environment (sandbox or live) with payabl. support.",
  unknown: "Check the transaction in the payabl. merchant portal or contact payabl. support.",
};

const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or method, or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary or the original outcome may be unknown. Verify the transaction's final status (notification or diagnose) before any new attempt, and avoid immediate repeated retries.",
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
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

function table(rows: readonly Row[]): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [code, meaning, category, retry, opts] of rows)
    out[code] = entry(meaning, category, retry, opts);
  return out;
}

const VERIFY_FIRST =
  "The original request may have been processed. Confirm the final status (notification, Resend Notification or diagnose) before sending a new request.";
const ANTI_BOT =
  "payabl. blocks the card for about one minute; a later attempt by the cardholder can succeed. Do not retry automatically.";
const THREEDS_ONCE =
  "payabl. suggests one more attempt with 3-D Secure, then another payment method.";

/** Status values that are not errors (source: response-codes-detailed, help FAQ). */
export const STATUS_CODES: Record<string, { outcome: Outcome; description: string }> = {
  "0": { outcome: "success", description: "No error: the operation was completed." },
  "2000": {
    outcome: "pending",
    description:
      "Pending: received and sent to processing; the final status is not yet known. Also used when a 3-D Secure or APM redirect is needed.",
  },
};

/** payabl. gateway codes in `status` / `errorcode` (response-codes-detailed): 90 error codes. */
export const GATEWAY_CODES: Record<string, CatalogEntry> = table([
  [
    "-999",
    "Unknown error; payabl. advises checking credentials, the live or sandbox environment and the signature",
    "configuration",
    "do_not_retry",
  ],
  [
    "-6000",
    "Wrong or missing fields, for example a currency not enabled for the account or a bad signature",
    "invalid_request",
    "do_not_retry",
  ],
  ["-1", "Unknown configuration setting", "configuration", "do_not_retry"],
  [
    "-104",
    "Illegal command: the action is not enabled for this account or login",
    "configuration",
    "do_not_retry",
  ],
  [
    "-119",
    "No permission: the action is not enabled for this account or login",
    "configuration",
    "do_not_retry",
  ],
  ["-1311", "Account name wrong or missing", "invalid_request", "customer_action_required"],
  ["-1313", "Bank number wrong or missing", "invalid_request", "customer_action_required"],
  ["-1314", "Bank country wrong or missing", "invalid_request", "customer_action_required"],
  [
    "-1315",
    "Response failed: timeout, lost connection or the customer aborted",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  ["-1316", "Merchant payment method wrong or missing", "invalid_request", "do_not_retry"],
  ["-1318", "IBAN wrong or missing", "invalid_request", "customer_action_required"],
  ["-1319", "BIC wrong or missing", "invalid_request", "customer_action_required"],
  [
    "-2400",
    "Too many retries; the card credentials are blocked for about one minute",
    "rate_limiting",
    "retry_conditionally",
    { why: ANTI_BOT },
  ],
  [
    "-2402",
    "Card briefly blocked (about one minute) after a successful payment, as anti-bot protection",
    "rate_limiting",
    "retry_conditionally",
    { why: ANTI_BOT },
  ],
  [
    "-2404",
    "Card briefly blocked (about one minute) after a failed payment, as anti-bot protection",
    "rate_limiting",
    "retry_conditionally",
    { why: ANTI_BOT },
  ],
  ["-2405", "Card blocked because of a prior fraud report", "fraud_or_risk", "do_not_retry"],
  ["-2406", "Card blocked because of a prior chargeback", "fraud_or_risk", "do_not_retry"],
  [
    "-2407",
    "Blocked because an active transaction exists; too many attempts within one minute, duplicates are blocked",
    "duplicate_request",
    "retry_conditionally",
    {
      why: "An earlier transaction for the same card is still active and may succeed. Check it before any later attempt.",
    },
  ],
  [
    "-2454",
    "Reattempt with the same card is not permitted",
    "card_declined",
    "customer_action_required",
    { next: "payabl. advises asking the customer for another card or payment method." },
  ],
  [
    "-2455",
    "Card scheme reattempt limit for this card and merchant exceeded",
    "card_declined",
    "customer_action_required",
    { next: "Ask the customer for another card or payment method." },
  ],
  [
    "-5000",
    "Internal error",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  ["-5002", "Payment failed, without further detail", "unknown", "manual_review"],
  [
    "-5003",
    "Payment aborted by the customer or by timeout",
    "unknown",
    "customer_action_required",
    { next: "Let the customer start a new payment if they still want to pay." },
  ],
  [
    "-5004",
    "Cancelled by payabl. risk-management checks (no specific rule cluster)",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "-5008",
    "Credit Fund Transfer aborted (the CFT page lists -5007 for the same message)",
    "unknown",
    "manual_review",
  ],
  [
    "-5010",
    "3-D Secure downgraded or not verified",
    "authentication_failed",
    "retry_conditionally",
    { why: THREEDS_ONCE },
  ],
  [
    "-5011",
    "3-D Secure downgraded or invalid attempt; the issuer did not return all values",
    "authentication_failed",
    "retry_conditionally",
    { why: THREEDS_ONCE },
  ],
  [
    "-5012",
    "Incorrect ECI data",
    "authentication_failed",
    "retry_conditionally",
    { why: THREEDS_ONCE },
  ],
  [
    "-6001",
    "No valid fields found; check the merchant id and field values",
    "invalid_request",
    "do_not_retry",
  ],
  ["-6005", "Pre-authorization is disabled for the account", "configuration", "do_not_retry"],
  ["-6102", "Wrong price", "invalid_amount", "do_not_retry"],
  ["-6103", "Wrong currency", "invalid_request", "do_not_retry"],
  ["-6105", "Wrong last name", "invalid_request", "do_not_retry"],
  ["-6106", "Wrong street", "invalid_request", "do_not_retry"],
  ["-6107", "Wrong zip", "invalid_request", "do_not_retry"],
  ["-6108", "Wrong city", "invalid_request", "do_not_retry"],
  ["-6109", "Wrong language", "invalid_request", "do_not_retry"],
  ["-6110", "Wrong salutation", "invalid_request", "do_not_retry"],
  ["-6111", "Wrong title", "invalid_request", "do_not_retry"],
  ["-6112", "Wrong gender", "invalid_request", "do_not_retry"],
  ["-6113", "Wrong first name", "invalid_request", "do_not_retry"],
  ["-6114", "Wrong company", "invalid_request", "do_not_retry"],
  ["-6115", "Wrong birthday", "invalid_request", "do_not_retry"],
  ["-6116", "Wrong house", "invalid_request", "do_not_retry"],
  ["-6117", "Wrong postbox", "invalid_request", "do_not_retry"],
  ["-6118", "Wrong state", "invalid_request", "do_not_retry"],
  ["-6119", "Wrong email", "invalid_request", "do_not_retry"],
  ["-6120", "Wrong phone", "invalid_request", "do_not_retry"],
  ["-6121", "Wrong fax", "invalid_request", "do_not_retry"],
  ["-6122", "Wrong mobile", "invalid_request", "do_not_retry"],
  ["-6123", "Wrong customer id", "invalid_request", "do_not_retry"],
  [
    "-6124",
    "Wrong custom1",
    "invalid_request",
    "do_not_retry",
    { next: "Correct custom1. The payabl. FAQ notes that test accounts need custom1=123456." },
  ],
  ["-6125", "Wrong custom2", "invalid_request", "do_not_retry"],
  ["-6126", "Wrong custom3", "invalid_request", "do_not_retry"],
  ["-6127", "Wrong customer IP", "invalid_request", "do_not_retry"],
  ["-6132", "Wrong order id", "invalid_request", "do_not_retry"],
  ["-6136", "Routing error", "configuration", "manual_review"],
  ["-6140", "Wrong language", "invalid_request", "do_not_retry"],
  ["-6141", "Wrong currency", "invalid_request", "do_not_retry"],
  ["-6142", "Wrong country", "invalid_request", "do_not_retry"],
  ["-6150", "Currency not supported", "configuration", "do_not_retry"],
  ["-6157", "Wrong payment method", "invalid_request", "do_not_retry"],
  ["-6158", "Wrong merchant payment system", "configuration", "do_not_retry"],
  ["-6159", "Wrong payment system", "configuration", "do_not_retry"],
  ["-6163", "Wrong user id", "invalid_request", "do_not_retry"],
  ["-6169", "Wrong day", "invalid_request", "do_not_retry"],
  ["-6170", "Wrong month", "invalid_request", "do_not_retry"],
  ["-6171", "Wrong year", "invalid_request", "do_not_retry"],
  ["-6174", "Wrong country code", "invalid_request", "do_not_retry"],
  [
    "-6209",
    "Merchant account (MID) close to a negative balance",
    "configuration",
    "manual_review",
    {
      next: "Capture more transactions or top up the merchant account balance, as the CFT page advises.",
    },
  ],
  [
    "-6211",
    "No bank confirmation: still pending and not credited after 10 days",
    "unknown",
    "manual_review",
    { uncertain: true },
  ],
  // Documented as temporary ("retry later"), but an internal error does not
  // prove the request was not processed, so a blind retry is not presented as safe.
  [
    "-6212",
    "Merchant account balance service internal error; payabl. says it is temporary and to retry later",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  ["-6310", "Card number must be valid", "invalid_request", "customer_action_required"],
  [
    "-6311",
    "Expiry date invalid or does not match the card",
    "invalid_request",
    "customer_action_required",
  ],
  ["-6312", "Card number failed the Luhn check", "invalid_request", "customer_action_required"],
  ["-6313", "Expiry month invalid", "invalid_request", "customer_action_required"],
  ["-6314", "Expiry year invalid", "invalid_request", "customer_action_required"],
  ["-6315", "CVC missing or invalid", "invalid_request", "customer_action_required"],
  [
    "-6316",
    "Cardholder name empty or contains invalid characters",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "-6317",
    "Card type missing or invalid (wrong customer details, card type or bank information)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "-6318",
    "BIN is hostile: the card's BIN country is blocked",
    "fraud_or_risk",
    "customer_action_required",
  ],
  [
    "-6319",
    "Wrong recurring id (bad initial transaction id for a credential-on-file transaction)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "-6327",
    "Card type does not support recurring payments",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "-10001",
    "3-D Secure verification failed or incomplete",
    "authentication_failed",
    "customer_action_required",
  ],
  ["-10002", "ECI wrong or missing", "authentication_failed", "retry_conditionally"],
  [
    "-10005",
    "Communication problem",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "-13000",
    "Timeout while sending the request",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "-13001",
    "Communication problem while sending the request",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "-13002",
    "Communication problem",
    "network_or_timeout",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
  [
    "-111005",
    "3-D Secure is not enrolled for this BIN",
    "authentication_failed",
    "customer_action_required",
  ],
]);

/** Codes listed only on the Credit Fund Transfer (payout) page (cft-response-code). */
export const CFT_CODES: Record<string, CatalogEntry> = table([
  [
    "-5007",
    "Credit Fund Transfer aborted (the main code page lists -5008 for the same message)",
    "unknown",
    "manual_review",
  ],
  ["-41017", "Merchant account has incorrect fields", "configuration", "do_not_retry"],
  ["-41018", "Mastercard service error: invalid request field", "invalid_request", "do_not_retry"],
]);

/** Mastercard OCT codes returned for Credit Fund Transfers (cft-response-code). */
export const OCT_CODES: Record<string, CatalogEntry> = table([
  [
    "062000",
    "Mastercard OCT: a value has an invalid character; strip special symbols from customer data",
    "invalid_request",
    "do_not_retry",
  ],
  ["072000", "Mastercard OCT: invalid length", "invalid_request", "do_not_retry"],
  [
    "110503",
    "Mastercard OCT: the account is not eligible to receive an OCT",
    "payment_method_unavailable",
    "customer_action_required",
    { next: "Ask the recipient for another card." },
  ],
  [
    "110516",
    "Mastercard OCT: country not supported for the merchant",
    "configuration",
    "do_not_retry",
  ],
  ["130001", "Mastercard OCT: card declined", "card_declined", "customer_action_required"],
  ["130002", "Mastercard OCT: fraud detected", "fraud_or_risk", "do_not_retry"],
  ["130003", "Mastercard OCT: card expired", "card_declined", "customer_action_required"],
  [
    "130004",
    "Mastercard OCT: per-transaction maximum amount reached",
    "invalid_amount",
    "do_not_retry",
  ],
]);

/** Risk-management sub-codes of -5004 (response-codes-detailed, second table). */
export const RISK_SUBCODES: Record<string, CatalogEntry> = table(
  (
    [
      ["-5004.01", "OFAC (sanctions) block"],
      ["-5004.02", "Velocity block"],
      ["-5004.03a", "BIN block"],
      ["-5004.03b", "Email block"],
      ["-5004.03c", "IBAN block"],
      ["-5004.03d", "Card number block"],
      ["-5004.03e", "URL block"],
      ["-5004.03f", "Country block"],
      ["-5004.04a", "Card type block"],
      ["-5004.04b", "Card scheme block"],
      ["-5004.05", "3-D Secure related risk block"],
      ["-5004.06", "Model (scoring) block"],
    ] as const
  ).map(([code, what]): Row => [
    code,
    `Cancelled by payabl. risk management: ${what}`,
    "fraud_or_risk",
    "manual_review",
    { next: "Contact your payabl. account manager or support for details of the risk rule." },
  ]),
);

const ISSUER_NEXT =
  "payabl. does not control issuer declines: ask the customer to contact their bank or to use another card or payment method.";

/** Issuer / scheme decline codes as returned in `errorcode` (error-codes-for-credit-cards-2): 87 codes. */
export const ISSUER_CODES: Record<string, CatalogEntry> = table(
  (
    [
      ["02", "Refer to card issuer", "card_declined", "customer_action_required"],
      [
        "03",
        "Invalid merchant: card or product restricted for this merchant category",
        "card_declined",
        "do_not_retry",
      ],
      ["04", "Do not honour (unspecified)", "card_declined", "customer_action_required"],
      ["05", "Do not honour (unspecified)", "card_declined", "customer_action_required"],
      [
        "06",
        "Invalid transaction for this terminal; the issuer will never approve it",
        "card_declined",
        "do_not_retry",
      ],
      [
        "6P",
        "Verification data failed (no correct 3-D Secure data)",
        "authentication_failed",
        "customer_action_required",
      ],
      // Documented as an approval that some banks send instead of 00.
      [
        "07",
        "Honour with identification: documented as a success that some banks send instead of 00",
        "unknown",
        "retry_conditionally",
        {
          uncertain: true,
          why: "The issuer may actually have approved the payment. Verify the final status before any new attempt; a retry could charge twice.",
          next: "Check the transaction's final status in the payabl. portal or via the diagnose interface.",
        },
      ],
      [
        "08",
        "Time-out",
        "network_or_timeout",
        "retry_conditionally",
        { uncertain: true, why: VERIFY_FIRST },
      ],
      ["09", "No original transaction", "invalid_request", "do_not_retry"],
      ["10", "Unable to reverse", "unknown", "manual_review"],
      ["11", "Suspected fraud (issuer)", "fraud_or_risk", "do_not_retry"],
      ["12", "Invalid transaction (card, issuer or acquirer)", "card_declined", "do_not_retry"],
      ["13", "Invalid amount (bad characters)", "invalid_amount", "do_not_retry"],
      ["14", "Invalid card number", "card_declined", "customer_action_required"],
      ["17", "Invalid capture date", "invalid_request", "do_not_retry"],
      [
        "19",
        "System error; re-enter the transaction (issuer temporarily unable, format or AVS issue, or Visa fraud threshold)",
        "provider_unavailable",
        "retry_conditionally",
      ],
      ["20", "No 'from' account", "card_declined", "customer_action_required"],
      ["21", "No 'to' account", "card_declined", "customer_action_required"],
      ["22", "No checking account", "card_declined", "customer_action_required"],
      ["23", "No saving account", "card_declined", "customer_action_required"],
      [
        "24",
        "No credit account",
        "card_declined",
        "customer_action_required",
        { next: "Ask the customer to try another card." },
      ],
      ["25", "Lifecycle decline", "card_declined", "customer_action_required"],
      [
        "25.01",
        "Lifecycle decline: updated card information is available in ABU",
        "card_declined",
        "customer_action_required",
        { next: "Check for updated card details before any new attempt." },
      ],
      ["25.02", "Lifecycle decline: retry later", "card_declined", "retry_conditionally"],
      [
        "25.03",
        "Lifecycle decline: suspected fraud, do not retry",
        "fraud_or_risk",
        "do_not_retry",
      ],
      ["26", "Policy decline", "card_declined", "customer_action_required"],
      [
        "26.01",
        "Policy decline: updated card information is available in ABU",
        "card_declined",
        "customer_action_required",
        { next: "Check the card data before any new attempt." },
      ],
      ["26.02", "Policy decline: retry later", "card_declined", "retry_conditionally"],
      [
        "26.03",
        "Policy decline: no updated credentials, do not retry",
        "card_declined",
        "do_not_retry",
      ],
      ["30", "Format error", "invalid_request", "do_not_retry"],
      [
        "31",
        "Blocked, first used (Brazil domestic; account temporarily blocked)",
        "card_declined",
        "customer_action_required",
      ],
      ["34", "Implausible card data", "card_declined", "customer_action_required"],
      ["39", "Transaction type not allowed by the issuer", "card_declined", "do_not_retry"],
      ["41", "Lost card, pick up", "fraud_or_risk", "do_not_retry"],
      ["42", "Special pickup (lost or stolen)", "fraud_or_risk", "do_not_retry"],
      ["43", "Hot (stolen) card, pick up", "fraud_or_risk", "do_not_retry"],
      ["44", "Pick up card (reported stolen)", "fraud_or_risk", "do_not_retry"],
      ["45", "Fallback not allowed (UnionPay)", "payment_method_unavailable", "do_not_retry"],
      ["46", "Closed account; the issuer will never approve", "card_declined", "do_not_retry"],
      ["51", "Insufficient funds", "insufficient_funds", "customer_action_required"],
      ["54", "Expired card", "card_declined", "customer_action_required"],
      ["55", "Incorrect PIN", "authentication_failed", "customer_action_required"],
      ["57", "Not permitted on this card; do not retry", "card_declined", "do_not_retry"],
      ["58", "Not permitted on this terminal", "card_declined", "do_not_retry"],
      ["59", "Suspected fraud (issuer or Visa risk rules)", "fraud_or_risk", "do_not_retry"],
      [
        "59.01",
        "Authentication decline: authenticating the customer may help",
        "authentication_required",
        "customer_action_required",
        { next: "Submit a new attempt with 3-D Secure authentication." },
      ],
      [
        "59.02",
        "Authentication decline: retry later",
        "authentication_required",
        "retry_conditionally",
      ],
      [
        "59.03",
        "Authentication decline: suspected fraud, do not retry",
        "fraud_or_risk",
        "do_not_retry",
      ],
      [
        "61",
        "Exceeds amount limit (also settlement cap or CFT velocity)",
        "card_declined",
        "customer_action_required",
      ],
      [
        "62",
        "Restricted card (restricted or embargoed country, including OFAC)",
        "card_declined",
        "do_not_retry",
      ],
      ["63", "MAC key error", "configuration", "manual_review"],
      [
        "65",
        "Additional SCA required or frequency limit exceeded (soft decline)",
        "authentication_required",
        "customer_action_required",
        {
          next: "Submit a new attempt with 3-D Secure; payabl. usually answers soft declines with status 2000 and url_3ds.",
        },
      ],
      ["66", "Exceeds acquirer limit", "configuration", "manual_review"],
      ["67", "Retain card (suspected counterfeit)", "fraud_or_risk", "do_not_retry"],
      [
        "68",
        "Response received too late",
        "network_or_timeout",
        "retry_conditionally",
        { uncertain: true, why: VERIFY_FIRST },
      ],
      [
        "69",
        "Reversal reason indicator: the authorization response was not returned in time",
        "network_or_timeout",
        "retry_conditionally",
        { uncertain: true, why: VERIFY_FIRST },
      ],
      ["70", "PIN data required", "authentication_required", "customer_action_required"],
      ["75", "PIN retries exceeded", "authentication_failed", "do_not_retry"],
      ["76", "Invalid account (no longer exists)", "card_declined", "do_not_retry"],
      [
        "77",
        "Issuer does not take part in the service (for example CFT)",
        "payment_method_unavailable",
        "customer_action_required",
      ],
      ["78", "Function not available", "payment_method_unavailable", "do_not_retry"],
      ["79", "Key validation error", "configuration", "manual_review"],
      [
        "80",
        "Approval for the purchase amount only",
        "unknown",
        "manual_review",
        { uncertain: true },
      ],
      ["81", "Unable to verify PIN", "authentication_failed", "customer_action_required"],
      ["82", "Invalid CVV", "card_declined", "customer_action_required"],
      ["83", "Fraud or security flag", "fraud_or_risk", "do_not_retry"],
      ["84", "Invalid transaction life cycle", "invalid_request", "do_not_retry"],
      ["85", "No keys to use", "configuration", "manual_review"],
      ["86", "KME sync error", "configuration", "manual_review"],
      ["87", "PIN key error", "configuration", "manual_review"],
      ["88", "MAC sync error", "configuration", "manual_review"],
      [
        "89",
        "Security violation; the issuer does not permit this on the card",
        "card_declined",
        "do_not_retry",
      ],
      ["91", "Issuer not available", "provider_unavailable", "retry_conditionally"],
      [
        "92",
        "Invalid issuer or cannot route (often a test card used in live)",
        "card_declined",
        "do_not_retry",
      ],
      [
        "93",
        "Cannot complete: regulatory restriction (may be a cardholder opt-out)",
        "card_declined",
        "customer_action_required",
      ],
      ["94", "Invalid originator", "invalid_request", "do_not_retry"],
      ["95", "Contact acquirer", "configuration", "manual_review"],
      ["96", "Issuer system malfunction", "provider_unavailable", "retry_conditionally"],
      ["97", "No funds transfer", "card_declined", "do_not_retry"],
      ["98", "Duplicate reversal", "duplicate_request", "do_not_retry"],
      ["99", "Duplicate transaction", "duplicate_request", "do_not_retry"],
      ["N3", "Cash service not available", "payment_method_unavailable", "do_not_retry"],
      ["N4", "Cashback exceeds the issuer limit", "invalid_amount", "do_not_retry"],
      ["N7", "CVV2 failure", "card_declined", "customer_action_required"],
      [
        "R0",
        "Stop payment order (the cardholder stopped a recurring payment)",
        "card_declined",
        "do_not_retry",
      ],
      [
        "R1",
        "Revocation of authorization order (stop recurring for this order)",
        "card_declined",
        "do_not_retry",
      ],
      [
        "R3",
        "Revocation of all authorizations (stop all recurring)",
        "card_declined",
        "do_not_retry",
      ],
    ] as Row[]
  ).map(([code, meaning, category, retry, opts]): Row => [
    code,
    meaning,
    category,
    retry,
    // payabl.'s general advice for this table fits customer-facing declines only.
    { ...(category === "card_declined" ? { next: ISSUER_NEXT } : {}), ...opts },
  ]),
);

export type SchemeEntry = CatalogEntry & {
  mastercard?: string;
  visa?: string;
  /** The research marks the Visa and Mastercard meanings as conflicting. */
  conflict?: boolean;
};

type SchemeRow = [
  codes: string,
  mastercard: string | null,
  visa: string | null,
  category: ErrorCategory,
  retry: RetryGuidance,
  flags?: { conflict?: boolean; uncertain?: boolean },
];

const SAME = "same";

/**
 * Raw Visa / Mastercard network codes (error-codes-visa, error-codes-mastercard).
 * These pages use un-padded codes and are linked from the Web SDK error page,
 * not from the docs index; the research treats them as legacy scheme tables.
 */
const SCHEME_ROWS: readonly SchemeRow[] = [
  [
    "1",
    "Refer to issuer",
    "Card authentication failed / refer to issuer",
    "card_declined",
    "customer_action_required",
  ],
  ["2", "Refer to issuer, special conditions", SAME, "card_declined", "customer_action_required"],
  ["3", "Invalid merchant", SAME, "card_declined", "do_not_retry"],
  ["4", "Do not honor, fraud", "Pick up card (no fraud)", "card_declined", "do_not_retry"],
  ["5", "Do not honor", SAME, "card_declined", "customer_action_required"],
  ["6", "Invalid card number", "Invalid card", "card_declined", "customer_action_required"],
  [
    "7",
    "Pick-up, special conditions",
    "Pick-up, special condition (fraud account)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "8",
    "Timeout",
    "No card record",
    "unknown",
    "manual_review",
    { conflict: true, uncertain: true },
  ],
  ["9", null, "Security failure", "fraud_or_risk", "do_not_retry"],
  ["10", null, "Partial approval", "unknown", "manual_review", { uncertain: true }],
  ["11", null, "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["12", "Invalid transaction", SAME, "card_declined", "do_not_retry"],
  [
    "13",
    "Invalid amount",
    "Invalid amount / currency conversion overflow",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "14",
    "Invalid card number",
    "Invalid account number",
    "card_declined",
    "customer_action_required",
  ],
  ["15", "No such issuer", SAME, "card_declined", "customer_action_required"],
  [
    "19",
    "Exceeds ACS maximum challenges",
    "Re-enter transaction",
    "unknown",
    "retry_conditionally",
    { conflict: true },
  ],
  ["20", "Invalid response", null, "provider_unavailable", "retry_conditionally"],
  ["21", "No To Account", "No action taken", "card_declined", "manual_review"],
  [
    "22",
    "Suspected malfunction",
    "ACS technical issue",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["24", null, "No credit account", "card_declined", "customer_action_required"],
  ["25", "Unable to locate record", SAME, "card_declined", "do_not_retry"],
  ["28", null, "File temporarily unavailable", "provider_unavailable", "retry_conditionally"],
  [
    "31",
    "Bank not supported by switch",
    "Blocked, first used (Brazil)",
    "card_declined",
    "customer_action_required",
    { conflict: true },
  ],
  ["34", "Suspected fraud, pick-up", null, "fraud_or_risk", "do_not_retry"],
  ["36", "Restricted card, pick-up", null, "card_declined", "do_not_retry"],
  ["38", "PIN tries exceeded, pick-up", null, "authentication_failed", "do_not_retry"],
  ["39", "No credit account", SAME, "card_declined", "customer_action_required"],
  ["40", "Function not supported", null, "payment_method_unavailable", "do_not_retry"],
  [
    "41",
    "Lost card, pick-up",
    "Lost card, pick-up (fraud account)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "42",
    "No universal account",
    "Special pickup",
    "card_declined",
    "do_not_retry",
    { conflict: true },
  ],
  ["43", "Stolen card, pick-up", SAME, "fraud_or_risk", "do_not_retry"],
  ["44", null, "Pickup card", "fraud_or_risk", "do_not_retry"],
  ["46", null, "Closed account", "card_declined", "do_not_retry"],
  ["51", "Insufficient funds", SAME, "insufficient_funds", "customer_action_required"],
  ["52", "No checking account", SAME, "card_declined", "customer_action_required"],
  ["53", "No savings account", SAME, "card_declined", "customer_action_required"],
  [
    "54",
    "Expired card",
    "Expired card or missing expiry",
    "card_declined",
    "customer_action_required",
  ],
  [
    "55",
    "Incorrect PIN",
    "Incorrect or missing PIN",
    "authentication_failed",
    "customer_action_required",
  ],
  ["56", "No card record", null, "card_declined", "do_not_retry"],
  ["57", "Not permitted to cardholder", SAME, "card_declined", "do_not_retry"],
  [
    "58",
    "Not permitted to terminal (may be a chargeback)",
    "Not allowed at terminal",
    "card_declined",
    "do_not_retry",
  ],
  ["59", "Suspected fraud", SAME, "fraud_or_risk", "do_not_retry"],
  [
    "61",
    "Exceeds withdrawal amount limit",
    "Exceeds approval amount limit",
    "card_declined",
    "customer_action_required",
  ],
  ["62", "Restricted card", "Restricted card (region or country)", "card_declined", "do_not_retry"],
  ["63", null, "Security violation", "fraud_or_risk", "do_not_retry"],
  ["64", null, "Fails AML requirement", "fraud_or_risk", "manual_review"],
  [
    "65",
    "Exceeds withdrawal frequency limit",
    SAME,
    "authentication_required",
    "customer_action_required",
  ],
  ["67", "Hard capture, pick-up", null, "fraud_or_risk", "do_not_retry"],
  ["70", null, "PIN data required", "authentication_required", "customer_action_required"],
  ["74", null, "PIN encryption value mismatch", "configuration", "manual_review"],
  ["75", "PIN tries exceeded", SAME, "authentication_failed", "do_not_retry"],
  ["76", "Invalid account", "Unsolicited reversal", "unknown", "manual_review", { conflict: true }],
  ["77", null, "Issuer not in service", "payment_method_unavailable", "customer_action_required"],
  [
    "78",
    "Customer not eligible for POS (Star)",
    "Blocked, first used",
    "card_declined",
    "customer_action_required",
    { conflict: true },
  ],
  ["79", null, "Already reversed by switch", "duplicate_request", "do_not_retry"],
  ["80", null, "No financial impact", "unknown", "unknown", { uncertain: true }],
  ["81", null, "PIN cryptographic error", "configuration", "manual_review"],
  ["82", null, "Invalid CVV", "card_declined", "customer_action_required"],
  [
    "85",
    null,
    "No reason to decline (verification-only request)",
    "unknown",
    "retry_conditionally",
    { uncertain: true },
  ],
  ["86", null, "Cannot verify PIN", "authentication_failed", "customer_action_required"],
  ["87", "PIN key error", null, "configuration", "manual_review"],
  ["88", "Information not on file", null, "card_declined", "do_not_retry"],
  [
    "89",
    "CVV verification failed",
    "Ineligible for financial position information (GIV)",
    "card_declined",
    "customer_action_required",
    { conflict: true },
  ],
  ["90", "Cutoff in progress", null, "provider_unavailable", "retry_conditionally"],
  [
    "91",
    "Issuer or switch inoperative",
    "Issuer not available",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["92", "Unknown institution for routing", "Invalid issuer", "card_declined", "do_not_retry"],
  ["93", null, "Violation of law", "card_declined", "do_not_retry"],
  [
    "96",
    "System malfunction",
    "Issuer system malfunction",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["98", "Duplicate reversal", null, "duplicate_request", "do_not_retry"],
  ["99", "Duplicate transaction", SAME, "duplicate_request", "do_not_retry"],
  [
    "1A",
    null,
    "Additional customer authentication required",
    "authentication_required",
    "customer_action_required",
  ],
  ["B1", null, "Surcharge not permitted (US)", "invalid_amount", "do_not_retry"],
  ["B2", null, "Surcharge not supported by the debit network", "invalid_amount", "do_not_retry"],
  ["N0", null, "Force STIP", "unknown", "unknown", { uncertain: true }],
  ["N3", null, "Cash service not available", "payment_method_unavailable", "do_not_retry"],
  ["N4", null, "Cash request over limit", "invalid_amount", "do_not_retry"],
  ["N5", null, "Ineligible for resubmission", "card_declined", "do_not_retry"],
  ["N7", null, "CVV2 failure", "card_declined", "customer_action_required"],
  ["N8", null, "Amount exceeds the pre-authorized amount", "invalid_amount", "do_not_retry"],
  ["P5", null, "PIN unblock denied", "authentication_failed", "do_not_retry"],
  ["P6", null, "PIN change denied (unsafe PIN)", "authentication_failed", "do_not_retry"],
  ["Q1", null, "Card authentication failed", "authentication_failed", "customer_action_required"],
  ["R0", null, "Stop payment order", "card_declined", "do_not_retry"],
  ["R1", null, "Revocation of authorisation order", "card_declined", "do_not_retry"],
  ["R2", null, "Not eligible for Visa PIN", "payment_method_unavailable", "do_not_retry"],
  ["R3", null, "Revocation of all authorizations", "card_declined", "do_not_retry"],
  ["Z3", null, "Unable to go online; offline-declined", "card_declined", "retry_conditionally"],
  ["S9", "Expiration date mismatch", null, "card_declined", "customer_action_required"],
  ["SA", "Inactive card", null, "card_declined", "customer_action_required"],
  ["SE", "Ineligible account", null, "card_declined", "do_not_retry"],
  ["T3", "Lost card (no pickup)", null, "fraud_or_risk", "do_not_retry"],
  ["T4", "Closed account", null, "card_declined", "do_not_retry"],
  ["T5", "Dormant account", null, "card_declined", "customer_action_required"],
  [
    "1101,1102,1276",
    "3-D Secure: the directory server returned an error for ARes",
    null,
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "1201,1303,1403,1404",
    "3-D Secure: the ACS returned an error for AReq",
    null,
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "1203,1301,1305",
    "3-D Secure: the ACS returned an error for AReq",
    SAME,
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "1151",
    "3-D Secure: error sending to the directory server",
    null,
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "2700",
    "3-D Secure: ID validation cannot be provided",
    null,
    "authentication_failed",
    "unknown",
  ],
  ["4837", "No cardholder authorization (dispute reason)", null, "fraud_or_risk", "manual_review"],
  ["4853", "Cardholder dispute", null, "unknown", "manual_review"],
];

function schemeMeaning(mc: string | undefined, visa: string | undefined): string {
  if (mc && visa && mc !== visa) return `Mastercard: ${mc}; Visa: ${visa}`;
  if (mc && visa) return mc;
  return mc ? `Mastercard: ${mc}` : `Visa: ${visa}`;
}

export const SCHEME_CODES: Record<string, SchemeEntry> = (() => {
  const out: Record<string, SchemeEntry> = {};
  for (const [codes, mcRaw, visaRaw, category, retry, flags] of SCHEME_ROWS) {
    const mastercard = mcRaw ?? undefined;
    const visa = visaRaw === SAME ? mastercard : (visaRaw ?? undefined);
    const base = entry(schemeMeaning(mastercard, visa), category, retry, {
      ...(flags?.uncertain ? { uncertain: true, why: VERIFY_FIRST } : {}),
    });
    for (const code of codes.split(",")) {
      out[code] = {
        ...base,
        ...(mastercard ? { mastercard } : {}),
        ...(visa ? { visa } : {}),
        ...(flags?.conflict ? { conflict: true } : {}),
      };
    }
  }
  return out;
})();

/** Mastercard Merchant Advice Codes, appended after a dot (mastercard-merchant-advice-codes). */
export const MAC_CODES: Record<string, { meaning: string; retry: RetryGuidance }> = {
  "01": { meaning: "New account information available", retry: "customer_action_required" },
  "02": { meaning: "Cannot approve at this time, try again later", retry: "retry_conditionally" },
  "03": { meaning: "Do not try again", retry: "do_not_retry" },
  "04": { meaning: "Token requirements not met for this token type", retry: "do_not_retry" },
  "05": { meaning: "Negotiated value not approved", retry: "do_not_retry" },
  "21": { meaning: "Payment cancellation (by the cardholder)", retry: "do_not_retry" },
  "22": { meaning: "Merchant does not qualify for the product code", retry: "do_not_retry" },
  "24": { meaning: "Retry after 1 hour", retry: "retry_conditionally" },
  "25": { meaning: "Retry after 24 hours", retry: "retry_conditionally" },
  "26": { meaning: "Retry after 2 days", retry: "retry_conditionally" },
  "27": { meaning: "Retry after 4 days", retry: "retry_conditionally" },
  "28": { meaning: "Retry after 6 days", retry: "retry_conditionally" },
  "29": { meaning: "Retry after 8 days", retry: "retry_conditionally" },
  "30": { meaning: "Retry after 10 days", retry: "retry_conditionally" },
  "40": { meaning: "Consumer non-reloadable prepaid card", retry: "do_not_retry" },
  "41": { meaning: "Consumer single-use virtual card", retry: "do_not_retry" },
  "42": { meaning: "Sanctions scoring service", retry: "manual_review" },
};

/** Values of the `3dtransactionStatusReason` callback field (3ds-transaction-status-reason-codes). */
export const THREEDS_STATUS_REASONS: Record<string, CatalogEntry> = table([
  [
    "01",
    "3-D Secure: card authentication failed",
    "authentication_failed",
    "customer_action_required",
  ],
  ["02", "3-D Secure: unknown device", "authentication_failed", "customer_action_required"],
  ["03", "3-D Secure: unsupported device", "authentication_failed", "customer_action_required"],
  [
    "04",
    "3-D Secure: authentication frequency limit exceeded",
    "authentication_failed",
    "retry_conditionally",
  ],
  ["05", "3-D Secure: expired card", "card_declined", "customer_action_required"],
  ["06", "3-D Secure: invalid card number", "card_declined", "customer_action_required"],
  ["07", "3-D Secure: invalid transaction", "authentication_failed", "do_not_retry"],
  ["08", "3-D Secure: no card record", "card_declined", "customer_action_required"],
  ["09", "3-D Secure: security failure", "fraud_or_risk", "do_not_retry"],
  ["10", "3-D Secure: stolen card", "fraud_or_risk", "do_not_retry"],
  ["11", "3-D Secure: suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["12", "3-D Secure: not permitted to cardholder", "card_declined", "do_not_retry"],
  [
    "13",
    "3-D Secure: cardholder not enrolled",
    "authentication_failed",
    "customer_action_required",
  ],
  ["14", "3-D Secure: timed out at the ACS", "network_or_timeout", "retry_conditionally"],
  ["15", "3-D Secure: low confidence", "fraud_or_risk", "customer_action_required"],
  ["16", "3-D Secure: medium confidence", "fraud_or_risk", "customer_action_required"],
]);

/** EPS codes (error-codes-apm). Only meaningful for EPS payments; `-1315` is shared with the gateway table. */
export const EPS_CODES: Record<string, CatalogEntry> = table([
  [
    "021",
    "EPS: payment not completed; the customer did not finish or closed the window",
    "unknown",
    "customer_action_required",
  ],
  ["009", "EPS: internal failure on the EPS side", "provider_unavailable", "retry_conditionally"],
  ["005", "EPS: amount must be positive", "invalid_amount", "do_not_retry"],
  ["010", "EPS: IBAN problem, no account found", "invalid_request", "customer_action_required"],
]);

/** Sofort codes (error-codes-apm). */
export const SOFORT_CODES: Record<string, CatalogEntry> = table([
  ["S-8023", "Sofort: invalid BIC", "invalid_request", "customer_action_required"],
  [
    "S-8058",
    "Sofort: payment not possible with this service",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["S-8013", "Sofort: unsupported currency", "configuration", "do_not_retry"],
  [
    "S-8054",
    "Sofort: all products deactivated; initiation aborted",
    "configuration",
    "manual_review",
  ],
  ["S-1001", "Sofort: technical error", "provider_unavailable", "retry_conditionally"],
  ["S-8001", "Sofort: unknown project", "configuration", "do_not_retry"],
  ["S-8015", "Sofort: amount out of range", "invalid_amount", "do_not_retry"],
  ["S-8003", "Sofort: request could not be processed", "unknown", "manual_review"],
]);

/** Trustly codes (error-codes-apm). */
export const TRUSTLY_CODES: Record<string, CatalogEntry> = table([
  ["141602", "Trustly: function access denied", "configuration", "do_not_retry"],
  ["141603", "Trustly: insufficient funds", "insufficient_funds", "customer_action_required"],
  ["141615", "Trustly: invalid amount", "invalid_amount", "do_not_retry"],
  ["141616", "Trustly: invalid credentials", "configuration", "do_not_retry"],
  ["141620", "Trustly: unknown error", "unknown", "unknown"],
  ["141624", "Trustly: invalid bank account number", "invalid_request", "customer_action_required"],
  ["141638", "Trustly: end user is blocked", "fraud_or_risk", "do_not_retry"],
]);

/** Web SDK codes (error-handling). */
export const WEBSDK_CODES: Record<string, CatalogEntry> = table([
  ["PC216001", "Web SDK: transaction already submitted", "duplicate_request", "do_not_retry"],
  [
    "PC216003",
    "Web SDK: session expired (sessions last 15 minutes)",
    "invalid_request",
    "safe_to_retry_technical_request",
    {
      next: "Create a new Web SDK session.",
      why: "No payment was made in an expired session; a new session can be created.",
    },
  ],
  ["PC216004", "Web SDK: session status unknown", "unknown", "manual_review", { uncertain: true }],
  ["PC216005", "Web SDK: missing required fields", "invalid_request", "do_not_retry"],
  ["PC216006", "Web SDK: payment window closed", "unknown", "customer_action_required"],
  [
    "PC215000",
    "Web SDK: internal SDK error",
    "provider_unavailable",
    "retry_conditionally",
    { why: VERIFY_FIRST, uncertain: true },
  ],
]);

/** Seen in a documentation example but in no code table (sepa-direct-debit). */
export const OBSERVED_CODES: Record<string, CatalogEntry> = table([
  [
    "-5016",
    "Bank rejected the payment (seen only in the SEPA Direct Debit failed-capture example, not in a code table)",
    "card_declined",
    "do_not_retry",
  ],
]);

/** Documented notification `type` values (authorization, pre-authorization, refund, 3DS services pages). */
export const NOTIFICATION_TYPES: Record<
  string,
  { stage: LifecycleStage; description: string; docsUrl: string }
> = {
  order: {
    stage: "authorization",
    description:
      "Authorization step. With errorcode 0 the funds are reserved (authorized, not captured).",
    docsUrl: PRE_AUTHORIZATION_URL,
  },
  capture: {
    stage: "capture",
    description:
      "Funds charged. For an Authorization (auth and capture in one call) success is errorcode 0 with type capture.",
    docsUrl: AUTHORIZATION_URL,
  },
  refund: {
    stage: "refund",
    description: "Refund callback (opt-in; sent to the original deposit's notification URL).",
    docsUrl: REFUND_URL,
  },
};

/** `payment_state` values of APM / bank-transfer notifications (instant-bank-transfer, sepa-direct-debit). */
export const PAYMENT_STATES: Record<string, { outcome: Outcome; description: string }> = {
  not_credited_yet: {
    outcome: "pending",
    description: "Capture accepted, funds not yet received.",
  },
  credited: { outcome: "success", description: "Capture successful, funds received." },
  not_credited: { outcome: "failure", description: "Capture failed." },
};

/** Web SDK browser callback `status` values (parameters page). */
export const WEBSDK_CALLBACK_STATUSES = ["APPROVED", "DECLINED", "ERROR", "CANCELLED"] as const;

export const FAMILY_DOCS: Record<CodeFamily, { title: string; url: string }[]> = {
  gateway: [{ title: "payabl. response codes", url: RESPONSE_CODES_URL }],
  risk: [{ title: "payabl. response codes (risk sub-codes)", url: RESPONSE_CODES_URL }],
  cft: [{ title: "payabl. CFT response codes", url: CFT_CODES_URL }],
  oct: [{ title: "payabl. CFT response codes (Mastercard OCT)", url: CFT_CODES_URL }],
  issuer: [{ title: "payabl. error codes for credit cards", url: ISSUER_CODES_URL }],
  scheme: [
    { title: "payabl. Visa error codes", url: VISA_CODES_URL },
    { title: "payabl. Mastercard error codes", url: MASTERCARD_CODES_URL },
  ],
  mac: [{ title: "payabl. Mastercard merchant advice codes", url: MAC_CODES_URL }],
  threeds_reason: [
    { title: "payabl. 3DS transaction status reason codes", url: THREEDS_REASON_URL },
  ],
  apm_eps: [{ title: "payabl. APM error codes", url: APM_CODES_URL }],
  apm_sofort: [{ title: "payabl. APM error codes", url: APM_CODES_URL }],
  apm_trustly: [{ title: "payabl. APM error codes", url: APM_CODES_URL }],
  websdk: [{ title: "payabl. Web SDK error handling", url: WEBSDK_ERRORS_URL }],
  observed: [{ title: "payabl. SEPA Direct Debit", url: SEPA_DD_URL }],
};

export { NEXT_ACTION, RETRY_EXPLANATION };
