/**
 * Trust Payments code and status knowledge, kept as data.
 *
 * Every code, status and field value below comes from
 * docs/providers/high-risk/research/trust_payments.md, which cites the Trust
 * Payments Help Centre, the legacy reference pages on webapp.securetrading.net
 * and the official client library. Meanings are paraphrased. Category and
 * retry values are PandaPayLens interpretations unless an entry carries
 * Trust Payments' own advice.
 */

import type { Confidence, ErrorCategory, LifecycleStage, RetryGuidance } from "@pandapaylens/core";

const HELP = "https://help.trustpayments.com/hc/en-us/articles";

export const ERROR_CODES_URL = "https://webapp.securetrading.net/errorcodes.html";
export const ERROR_CODES_HELP_URL = `${HELP}/4402897300625-Error-codes`;
export const CHECKS_URL = `${HELP}/4402723592977-Checks-to-perform-following-payment`;
export const BUILD_URL = `${HELP}/4403254389521--Build-your-own-solution`;
export const REQUEST_TYPES_URL = `${HELP}/4403193116945-Request-types`;
export const ACCOUNT_TYPES_URL = `${HELP}/4403193095441-Account-types`;
export const AUTH_URL = `${HELP}/4402755159569-AUTH`;
export const REFUND_URL = `${HELP}/4402765448209-REFUND-with-Webservices-API`;
export const ACCOUNTCHECK_URL = `${HELP}/4402763301009-ACCOUNTCHECK-Zero-Auth`;
export const TRANSACTIONQUERY_URL = `${HELP}/4402764105617-TRANSACTIONQUERY`;
export const TRANSACTIONUPDATE_URL = `${HELP}/4402769840529-TRANSACTIONUPDATE`;
export const PAYOUTS_URL = `${HELP}/4402771924497-Payouts-with-Webservices-API`;
export const SETTLEMENT_URL = `${HELP}/4402724045073-Settlement-for-card-transactions`;
export const NOT_SETTLED_URL = `${HELP}/4405599563025-Why-hasn-t-this-transaction-settled`;
export const URL_NOTIFICATIONS_URL = `${HELP}/360021197998-URL-notifications-following-payments`;
export const URL_NOTIFICATION_ACTION_URL = `${HELP}/8640643750417-URL-notification`;
export const RESPONSE_SITE_SECURITY_URL = `${HELP}/4402734345361-Response-site-security`;
export const REDIRECT_URL = `${HELP}/360021198058-Redirecting-the-customer-s-browser-following-payment`;
export const JWT_URL = `${HELP}/4402982320273-JSON-Web-Token`;
export const THREEDS_JS_WS_URL = `${HELP}/4408229858449-Perform-3D-Secure-authentication-using-JavaScript-Library-and-Authorisation-using-Webservices-API`;
export const THREEDS_HANDLING_URL = `${HELP}/6740980467345-Handling-3DS-API-responses`;
export const THREEDS_FIELDS_URL = `${HELP}/6743917116945-3DS-API-Field-Specification`;
export const SOFT_DECLINE_URL = `${HELP}/4403193781265-Why-has-my-payment-been-returned-a-71000-Soft-decline-response`;
export const DECLINES_URL = `${HELP}/39603445704721-How-do-I-handle-declined-transactions`;
export const ADVICE_CODES_URL = `${HELP}/22541881833617-Acquirer-advice-code-mapping`;
export const RECURRING_URL = `${HELP}/4402772396817-Recurring-payments`;
export const SUBSCRIPTION_ENGINE_URL = `${HELP}/4403180713489-What-is-the-Subscription-Engine`;
export const SUBSCRIPTION_ACTIVE_URL = `${HELP}/4403181370385-What-does-the-subscription-active-field-mean`;
export const SCHEMEUPDATE_URL = `${HELP}/4402888536849-SCHEMEUPDATE`;
export const DUPLICATE_CHECKS_URL = `${HELP}/4403189566737-Duplicate-checks`;
export const SUSPENDED_URL = `${HELP}/4403193303313-Why-has-a-transaction-been-suspended`;
export const PROTECT_PLUS_URL = `${HELP}/4402881189905-Protect-Plus-for-Webservices-API`;
export const CHARGEBACKS_URL = `${HELP}/8640277410961-Chargebacks`;
export const CLIENT_LIBRARY_URL = "https://github.com/SecureTrading/st-python-api";

/** Which documented part of the single errorcode list an entry belongs to. */
export type CodeFamily = "client_library" | "gateway" | "invalid_process" | "portal";

/**
 * How a code affects the operation it was returned for:
 * - `failure`: a definitive rejection or decline (the outcome is known).
 * - `uncertain`: the final status is not known from this response.
 * - `pending`: Trust Payments says the request is still being processed.
 * - `informational`: the flow may continue (3-D Secure bypass cases).
 */
export type CodeEffect = "failure" | "uncertain" | "pending" | "informational";

export type CodeEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  effect: CodeEffect;
  family: CodeFamily;
  /** At most `strong`: codes are documented, the mapping is an interpretation. */
  confidence: Confidence;
  /** Trust Payments' own advice for this code, when documented. */
  advice?: string;
  /** Documentation caveat shown as missing information. */
  note?: string;
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Show the customer an error and offer another card or payment method. Use acquirerresponsecode and acquirerresponsemessage to investigate with Trust Payments.",
  authentication_required:
    "Authenticate the customer with 3-D Secure and submit a new request that references the declined transaction.",
  authentication_failed:
    "Do not proceed with this authentication result. Ask the customer to authenticate again or to use another card.",
  invalid_request:
    "Correct the request (errordata usually names the field) before sending a new request.",
  invalid_amount: "Check the amount and currency against the parent transaction.",
  insufficient_funds: "Ask the customer to use another payment method.",
  payment_method_unavailable:
    "Offer another payment method or check the payment type configuration.",
  fraud_or_risk:
    "Review the transaction in Portal and contact Trust Payments Support before acting on it.",
  rate_limiting: "Wait before trying again.",
  provider_unavailable:
    "Query the transaction (TRANSACTIONQUERY or Portal) to find its final status before any new request.",
  network_or_timeout:
    "Query the transaction (TRANSACTIONQUERY by transactionreference, orderreference or time window) before any new request.",
  duplicate_request: "Check the original transaction's status before sending anything else.",
  configuration:
    "Check the site reference, account type, Web Services user and acquirer configuration with Trust Payments Support.",
  unknown:
    "Contact Trust Payments Support with the request and the response, and check the transaction in Portal.",
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Sending the same request again will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (another card or method, new details, or authentication).",
  retry_conditionally:
    "Verify the transaction's final status first (TRANSACTIONQUERY or Portal). Trust Payments does not recommend retrying a request when the connection terminated after data had started to be transferred.",
  safe_to_retry_technical_request:
    "The request was not processed for a technical reason and can be sent again.",
  manual_review:
    "The final status cannot be decided from this response. Trust Payments asks merchants to contact Support with the request and the response.",
  unknown: "Retry safety cannot be assessed for this code.",
};

type Opts = {
  effect?: CodeEffect;
  confidence?: Confidence;
  advice?: string;
  note?: string;
};

type Row = [
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

/** Unknown outcomes are the default for availability and unknown categories. */
function defaultEffect(category: ErrorCategory, retry: RetryGuidance): CodeEffect {
  if (retry === "safe_to_retry_technical_request") return "failure";
  return category === "unknown" ||
    category === "network_or_timeout" ||
    category === "provider_unavailable"
    ? "uncertain"
    : "failure";
}

function table(family: CodeFamily, rows: Row[]): Record<string, CodeEntry> {
  const out: Record<string, CodeEntry> = {};
  for (const [code, meaning, category, retry, opts = {}] of rows) {
    out[code] = {
      meaning,
      category,
      retry,
      effect: opts.effect ?? defaultEffect(category, retry),
      family,
      confidence: opts.confidence ?? "strong",
      ...(opts.advice ? { advice: opts.advice } : {}),
      ...(opts.note ? { note: opts.note } : {}),
    };
  }
  return out;
}

const UNKNOWN_FINAL_STATUS =
  "Trust Payments: the final status of the transaction is unknown; contact Support with the request and the response.";

/** Codes 1-10 come from Trust Payments' own client libraries, not from the gateway. */
export const CLIENT_LIBRARY_CODES = table("client_library", [
  ["1", "Generic client library error", "unknown", "unknown"],
  ["2", "Python client library dependency missing", "configuration", "do_not_retry"],
  ["4", "Client library send error", "network_or_timeout", "retry_conditionally"],
  [
    "5",
    "Client library receive error (also returned when the response could not be parsed as JSON)",
    "network_or_timeout",
    "retry_conditionally",
  ],
  ["6", "Invalid credentials", "configuration", "do_not_retry"],
  [
    "7",
    "Could not connect to Trust Payments",
    "network_or_timeout",
    "safe_to_retry_technical_request",
  ],
  ["8", "Unexpected connection error", "network_or_timeout", "retry_conditionally"],
  [
    "9",
    "Unknown client library error (the official client also uses it when the response does not echo the request reference)",
    "unknown",
    "manual_review",
  ],
  ["10", "Incorrect use of the client library API", "invalid_request", "do_not_retry"],
]);

/** Gateway codes 10000-99999 (excluding the Portal range and 60100-60120). */
export const GATEWAY_CODES = table("gateway", [
  ["10003", "Card details invalid", "invalid_request", "customer_action_required"],
  ["10100", "Date invalid", "invalid_request", "do_not_retry"],
  ["10101", "Date/time invalid", "invalid_request", "do_not_retry"],
  [
    "10102",
    'Details invalid (on Payment Pages, "Invalid details" is also what customers see on a request hash mismatch)',
    "configuration",
    "do_not_retry",
  ],
  [
    "10103",
    "Card number does not fit the card type",
    "invalid_request",
    "customer_action_required",
  ],
  ["10200", "XML malformed", "invalid_request", "do_not_retry"],
  ["10201", "XML fails the schema", "invalid_request", "do_not_retry"],
  ["10202", "File format invalid", "invalid_request", "do_not_retry"],
  ["10203", "File empty", "invalid_request", "do_not_retry"],
  ["10204", "File contents invalid", "invalid_request", "do_not_retry"],
  ["10205", "JSON malformed", "invalid_request", "do_not_retry"],
  ["10300", "JWT could not be decoded", "invalid_request", "do_not_retry"],
  ["10301", "JWT could not be encoded", "unknown", "manual_review"],
  [
    "10302",
    "JWT algorithm unsupported (the documentation shows HS256; signing with a private key is not supported)",
    "configuration",
    "do_not_retry",
  ],
  ["10500", "StApi error", "unknown", "manual_review"],
  ["10600", "Request contains invalid fields", "invalid_request", "do_not_retry"],
  [
    "20004",
    "Parent transaction missing",
    "invalid_request",
    "retry_conditionally",
    {
      advice:
        "Trust Payments: if the request was sent right after its parent, wait a few seconds and send it again.",
    },
  ],
  [
    "20005",
    "Refund needs a settled parent (or one settling today)",
    "invalid_request",
    "retry_conditionally",
  ],
  ["20006", "Refund needs an AUTH parent", "invalid_request", "do_not_retry"],
  ["20007", "Refund amount above what can be refunded", "invalid_amount", "do_not_retry"],
  ["20008", "No acquirer configured", "configuration", "do_not_retry"],
  ["20009", "Repeat amount too high", "invalid_amount", "do_not_retry"],
  ["20010", "Split shipment amount too high", "invalid_amount", "do_not_retry"],
  ["20011", "A declined transaction cannot be refunded", "invalid_request", "do_not_retry"],
  ["20012", "Refund needs a settled parent", "invalid_request", "retry_conditionally"],
  ["20013", "Reversal needs a cancelled AUTH parent", "invalid_request", "do_not_retry"],
  ["20014", "Child request cannot change the amount", "invalid_request", "do_not_retry"],
  ["20015", "Child request cannot change the currency", "invalid_request", "do_not_retry"],
  ["20018", "Subscription needs a RECUR account", "configuration", "do_not_retry"],
  ["20019", "Subscription needs a successful parent", "invalid_request", "do_not_retry"],
  ["20020", "Risk decision needs an AUTH parent", "invalid_request", "do_not_retry"],
  ["20021", "Chargeback needs an AUTH or REFUND parent", "invalid_request", "manual_review"],
  ["20022", "Refund below the minimum", "invalid_amount", "do_not_retry"],
  ["20023", "PayPal refund needs the PayPal transaction id", "invalid_request", "do_not_retry"],
  [
    "20024",
    "Split transaction invalid (check authmethod and splitfinalnumber)",
    "invalid_request",
    "do_not_retry",
  ],
  ["20025", "AUTH older than 48 hours cannot be reversed", "invalid_request", "do_not_retry"],
  ["20026", "Reversal needs acquirer reference data", "invalid_request", "do_not_retry"],
  [
    "20027",
    "AUTH was processed by another acquirer and cannot be reversed",
    "configuration",
    "do_not_retry",
  ],
  [
    "20028",
    "Payment type does not support repeat payments",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["20029", "Reversal is missing data", "invalid_request", "do_not_retry"],
  ["20030", "Token missing", "invalid_request", "do_not_retry"],
  [
    "20031",
    "Subscription on an ACCOUNTCHECK parent is not supported by this acquirer",
    "configuration",
    "do_not_retry",
  ],
  ["20032", "A subscription cannot be a parent", "invalid_request", "do_not_retry"],
  ["20033", "Parent invalid", "invalid_request", "do_not_retry"],
  ["20034", "Payment type does not support refunds", "payment_method_unavailable", "do_not_retry"],
  ["20035", "Incremental authorisation invalid", "invalid_request", "do_not_retry"],
  ["20036", "Partial reversal not supported", "payment_method_unavailable", "do_not_retry"],
  ["20037", "THREEDQUERY parent and child payment types differ", "invalid_request", "do_not_retry"],
  [
    "20038",
    "Payment type does not support scheme updates",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "20039",
    "AUTH cannot be reversed right now; try again",
    "provider_unavailable",
    "retry_conditionally",
    // The reversal was refused, so its outcome is known even though the cause is temporary.
    { effect: "failure" },
  ],
  ["20040", "Token cannot be determined", "invalid_request", "do_not_retry"],
  [
    "22000",
    "Bypass: the payment type is not supported for 3-D Secure",
    "payment_method_unavailable",
    "do_not_retry",
    {
      effect: "informational",
      advice:
        "Trust Payments: you may proceed to the payment without 3-D Secure, but without liability shift.",
    },
  ],
  ["25000", "Access privileges insufficient", "configuration", "do_not_retry"],
  ["25001", "Internal coding error", "unknown", "manual_review"],
  ["25002", "Privileges insufficient", "configuration", "do_not_retry"],
  ["25003", "Request invalid", "invalid_request", "do_not_retry"],
  [
    "30000",
    "Invalid field; errordata names the field",
    "invalid_request",
    "do_not_retry",
    { advice: "Trust Payments: correct the field named in errordata and resubmit." },
  ],
  ["30001", "Site reference unknown", "configuration", "do_not_retry"],
  ["30002", "Card is banned", "fraud_or_risk", "do_not_retry"],
  ["30003", "XML element could not be parsed", "invalid_request", "do_not_retry"],
  [
    "30004",
    "Maestro requires 3-D Secure (SecureCode)",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "30005",
    "Multiple email addresses must be separated by , or ;",
    "invalid_request",
    "do_not_retry",
  ],
  ["30006", "Site reference not valid for this alias (user)", "configuration", "do_not_retry"],
  ["30007", "Version number invalid", "invalid_request", "do_not_retry"],
  ["30008", "User unknown", "configuration", "do_not_retry"],
  [
    "30009",
    "Account cannot be determined (for example the account type is not enabled)",
    "configuration",
    "do_not_retry",
  ],
  ["30010", "JSON element could not be parsed", "invalid_request", "do_not_retry"],
  ["30011", "Wallet configuration error", "configuration", "do_not_retry"],
  [
    "30012",
    "Wallet type not supported for this request",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["30014", "Token does not support scheme updates", "payment_method_unavailable", "do_not_retry"],
  ["30015", "Nothing to update", "invalid_request", "do_not_retry"],
  [
    "31000",
    "Card number incorrect (customer-facing message)",
    "invalid_request",
    "customer_action_required",
  ],
  ["31001", "Security code incorrect", "invalid_request", "customer_action_required"],
  ["31002", "Expiry date incorrect", "invalid_request", "customer_action_required"],
  ["31003", "Expiry month incorrect", "invalid_request", "customer_action_required"],
  ["31004", "Expiry year incorrect", "invalid_request", "customer_action_required"],
  ["31005", "Connection error: request id mismatch", "network_or_timeout", "retry_conditionally"],
  ["31006", "Issue number incorrect", "invalid_request", "customer_action_required"],
  ["31007", "Payment type incorrect", "invalid_request", "customer_action_required"],
  [
    "31009",
    "Payment cannot be processed; the customer is told to contact the website",
    "configuration",
    "manual_review",
  ],
  [
    "31010",
    "Errors in the listed fields (message with a placeholder)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "40000",
    "No account found",
    "configuration",
    "do_not_retry",
    { advice: "Trust Payments: no payment method is enabled for the posted currency." },
  ],
  ["40001", "Refund cannot be processed", "invalid_request", "manual_review"],
  ["40002", "Transaction de-activated", "unknown", "manual_review"],
  [
    "50000",
    'Socket receive error (the official error list); the JSON Web Token article shows 50000 with the message "Timeout"',
    "network_or_timeout",
    "retry_conditionally",
    {
      confidence: "possible",
      note: 'Trust Payments documents two descriptions for 50000: the error code list says "Socket receive error", while the JSON Web Token article shows errorcode 50000 with errormessage "Timeout" (the list gives 50005 for Timeout). Both describe a communication problem, so the final status is unknown either way.',
    },
  ],
  ["50001", "Socket connection error", "network_or_timeout", "retry_conditionally"],
  ["50002", "Socket closed", "network_or_timeout", "retry_conditionally"],
  ["50003", "Invalid data received", "network_or_timeout", "retry_conditionally"],
  ["50004", "Invalid SQL (internal)", "provider_unavailable", "manual_review"],
  ["50005", "Timeout", "network_or_timeout", "retry_conditionally"],
  ["50006", "Acquirer invalid", "configuration", "do_not_retry"],
  ["50007", "Cannot connect to the acquirer", "provider_unavailable", "retry_conditionally"],
  ["50008", "Acquirer response invalid", "provider_unavailable", "retry_conditionally"],
  ["50009", "No transport available", "provider_unavailable", "retry_conditionally"],
  ["50010", "File too large", "invalid_request", "do_not_retry"],
  ["50011", "Socket send error", "network_or_timeout", "retry_conditionally"],
  ["50012", "Communication error", "network_or_timeout", "retry_conditionally"],
  ["50014", "Proxy error", "network_or_timeout", "retry_conditionally"],
  ["50015", "Card data lookup service error", "provider_unavailable", "retry_conditionally"],
  ["50016", "Card data lookup returned nothing", "unknown", "unknown"],
  [
    "51000",
    "Connection errors (customer-facing message with a detail placeholder)",
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "51001",
    "Connection errors with an HTTP status (customer-facing message)",
    "network_or_timeout",
    "retry_conditionally",
  ],
  ["60003", "Wrong number of email addresses", "invalid_request", "do_not_retry"],
  [
    "60010",
    "Bank system error; the final status is unknown",
    "provider_unavailable",
    "manual_review",
    { advice: UNKNOWN_FINAL_STATUS },
  ],
  ["60011", "Wrong number of transactions", "invalid_request", "do_not_retry"],
  ["60012", "Transport configuration invalid", "configuration", "do_not_retry"],
  ["60013", "No valid updates in TRANSACTIONUPDATE", "invalid_request", "do_not_retry"],
  ["60014", "Transaction reference not found", "invalid_request", "do_not_retry"],
  ["60016", "settlebaseamount too large", "invalid_amount", "do_not_retry"],
  [
    "60017",
    "Transaction cannot be updated (for example settled or cancelled)",
    "invalid_request",
    "do_not_retry",
  ],
  ["60018", "Request type invalid", "invalid_request", "do_not_retry"],
  ["60019", "No searchable filter given", "invalid_request", "do_not_retry"],
  ["60020", "Timeout", "network_or_timeout", "retry_conditionally"],
  ["60021", "3-D Secure transport error", "provider_unavailable", "retry_conditionally"],
  [
    "60022",
    "Unauthenticated: the 3-D Secure status was N (the cardholder failed authentication)",
    "authentication_failed",
    "customer_action_required",
  ],
  ["60023", "Site suspended", "configuration", "do_not_retry"],
  ["60024", "No updates were made", "invalid_request", "do_not_retry"],
  [
    "60025",
    "Invalid request (for example MCC 6012 recipient fields missing, or an attempt to set settle status 10)",
    "invalid_request",
    "do_not_retry",
  ],
  ["60026", "Response invalid", "provider_unavailable", "retry_conditionally"],
  ["60027", "Acquirer invalid", "configuration", "do_not_retry"],
  ["60028", "Account data invalid", "configuration", "do_not_retry"],
  ["60029", "Missing (unspecified)", "invalid_request", "do_not_retry"],
  ["60030", "Payment error (unspecified)", "unknown", "manual_review"],
  [
    "60031",
    "The card issuer's bank is not supported for 3-D Secure",
    "payment_method_unavailable",
    "do_not_retry",
    {
      effect: "informational",
      advice: "Trust Payments: you may proceed to the payment, but without liability shift.",
    },
  ],
  [
    "60032",
    "Payment type not supported for 3-D Secure",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["60033", "Updates specified are invalid", "invalid_request", "do_not_retry"],
  [
    "60034",
    "Manual investigation required; the final status is unknown",
    "unknown",
    "manual_review",
    { advice: UNKNOWN_FINAL_STATUS },
  ],
  ["60035", "Headers invalid", "invalid_request", "do_not_retry"],
  ["60036", "Fraud score above the maximum", "fraud_or_risk", "manual_review"],
  ["60037", "Filters invalid", "invalid_request", "do_not_retry"],
  ["60038", "Merchant system error", "unknown", "manual_review"],
  [
    "60039",
    "Payment still being processed, please wait (session locked)",
    "unknown",
    "do_not_retry",
    {
      effect: "pending",
      advice: "Wait, then query the transaction instead of sending the request again.",
    },
  ],
  [
    "60040",
    "Both requesttypedescription and requesttypedescriptions were sent",
    "invalid_request",
    "do_not_retry",
  ],
  ["60041", "Acquirer lacks the original transaction data", "unknown", "manual_review"],
  ["60042", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["60043", "Blocked by scheme restrictions", "card_declined", "do_not_retry"],
  ["60044", "Failed screening", "fraud_or_risk", "manual_review"],
  ["60045", "Blocked by restrictions (unspecified)", "card_declined", "do_not_retry"],
  ["60500", "Risk referral", "fraud_or_risk", "manual_review"],
  [
    "61000",
    "Name pick required",
    "invalid_request",
    "customer_action_required",
    {
      confidence: "possible",
      note: "The meaning of 61000 is not documented beyond its label.",
    },
  ],
  [
    "61001",
    "Address pick required",
    "invalid_request",
    "customer_action_required",
    {
      confidence: "possible",
      note: "The meaning of 61001 is not documented beyond its label.",
    },
  ],
  ["61002", "IP address not in the allowed range", "configuration", "do_not_retry"],
  ["61003", "Button configuration invalid", "configuration", "do_not_retry"],
  ["62000", "Acquirer response not recognised", "provider_unavailable", "manual_review"],
  [
    "70000",
    "Declined by the card issuer or bank",
    "card_declined",
    "customer_action_required",
    {
      // The decline itself is documented; its reason is not.
      confidence: "possible",
      advice:
        "Trust Payments: show the customer an error and offer another payment method. Use acquirerresponsecode and acquirerresponsemessage to investigate the decline.",
      note: "Trust Payments publishes no table for acquirerresponsecode or schemeresponsecode (they vary by acquiring bank), so the reason for a 70000 decline cannot be decoded.",
    },
  ],
  ["70001", "Result uncertain", "unknown", "manual_review"],
  [
    "71000",
    "Soft decline: the issuer requires strong customer authentication",
    "authentication_required",
    "customer_action_required",
    {
      advice:
        "Trust Payments: resubmit with 3-D Secure, scaexemptionindicator=14 and parenttransactionreference set to the soft-declined AUTH.",
    },
  ],
  ["72000", "Refer to issuer", "card_declined", "customer_action_required"],
  [
    "79000",
    "Request queued; check the transaction later",
    "unknown",
    "do_not_retry",
    {
      effect: "pending",
      advice: "Query the transaction later instead of sending the request again.",
    },
  ],
  [
    "79001",
    "Record temporarily locked; try later",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ],
  ["88000", "Generic retry", "provider_unavailable", "retry_conditionally"],
  [
    "88888",
    "Soft decline retry",
    "authentication_required",
    "customer_action_required",
    {
      confidence: "possible",
      note: "The meaning of 88888 is not documented beyond its label.",
    },
  ],
  ["90001", "Site name already used", "configuration", "do_not_retry"],
  ["90002", "Payment routes duplicated", "configuration", "do_not_retry"],
  ["90003", "Namespace invalid", "configuration", "do_not_retry"],
  ["90004", "Account does not exist", "configuration", "do_not_retry"],
  ["90005", "Rule already exists", "configuration", "do_not_retry"],
  ["90006", "User may not use this rule action type", "configuration", "do_not_retry"],
  ["90007", "Database deadlock; retry", "provider_unavailable", "safe_to_retry_technical_request"],
  ["90008", "MobilePay merchant update failed", "provider_unavailable", "manual_review"],
  ["90009", "No account changes to apply", "invalid_request", "do_not_retry"],
  ["90010", "Acquirer configuration file incomplete", "configuration", "manual_review"],
  ["90011", "Database operational error", "provider_unavailable", "retry_conditionally"],
  [
    "99998",
    "Problem with the payment; verify the details (customer-facing message)",
    "unknown",
    "customer_action_required",
  ],
  [
    "99999",
    "Unknown error; the final status is unknown",
    "unknown",
    "manual_review",
    { advice: UNKNOWN_FINAL_STATUS },
  ],
]);

/** 60100-60120 share the message "Invalid process"; their distinction is not documented. */
export const INVALID_PROCESS_CODES: Record<string, CodeEntry> = (() => {
  const rows: Row[] = [];
  for (let c = 60100; c <= 60120; c++) {
    rows.push([
      String(c),
      "Invalid process",
      "unknown",
      "manual_review",
      {
        confidence: "possible",
        note: 'Codes 60100 to 60120 all carry the message "Invalid process"; what distinguishes them is not documented.',
      },
    ]);
  }
  return table("invalid_process", rows);
})();

const PORTAL_NOTE =
  "Portal (MyST) codes relate to the merchant portal and administration, not to payment requests. The category is a suggested default.";

function portal(code: string, meaning: string, category: ErrorCategory, retry: RetryGuidance): Row {
  return [code, meaning, category, retry, { confidence: "possible", note: PORTAL_NOTE }];
}

const P_CFG = (code: string, meaning: string) =>
  portal(code, meaning, "configuration", "do_not_retry");
const P_INPUT = (code: string, meaning: string) =>
  portal(code, meaning, "invalid_request", "do_not_retry");

/** Portal / MyST codes 21000-21060 (59 codes). */
export const PORTAL_CODES = table("portal", [
  portal("21000", "Service temporarily disabled", "provider_unavailable", "retry_conditionally"),
  P_CFG("21001", "First-login request"),
  P_CFG("21002", "Wrong username or password"),
  P_CFG("21003", "Invalid session"),
  P_CFG("21004", "Session expired"),
  P_CFG("21005", "Password expired"),
  P_INPUT("21006", "Password reused"),
  P_CFG("21007", "MyST user locked"),
  P_INPUT("21009", "New password confirmation does not match"),
  P_INPUT("21010", "Current password wrong"),
  P_INPUT("21012", "Invalid selection"),
  P_INPUT("21013", "User exists"),
  P_INPUT("21014", "No transaction found"),
  P_INPUT("21015", "Selected transactions invalid"),
  P_CFG("21016", "Data not saved"),
  P_INPUT("21017", "Request type invalid"),
  P_INPUT("21018", "Request type missing"),
  P_INPUT("21019", "Payment type invalid"),
  P_INPUT("21020", "Payment type missing"),
  P_INPUT("21021", "Error code invalid"),
  P_INPUT("21022", "Error code missing"),
  P_INPUT("21023", "Filter description invalid"),
  P_INPUT("21024", "Destination description invalid"),
  P_INPUT("21025", "Notification type invalid"),
  P_INPUT("21026", "Destination invalid"),
  P_INPUT("21027", "Field selection invalid"),
  P_INPUT("21028", "Sender email invalid"),
  P_INPUT("21029", "Email subject invalid"),
  P_INPUT("21030", "Email type invalid"),
  portal("21031", "Cannot process request", "unknown", "manual_review"),
  P_INPUT("21032", "No upload file"),
  P_INPUT("21033", "File size invalid"),
  P_INPUT("21034", "Filename invalid"),
  P_INPUT("21035", "Extension invalid"),
  P_CFG("21036", "User needs a site reference"),
  P_CFG("21037", "Only internal users may have * access"),
  portal("21038", "Request failed", "unknown", "manual_review"),
  P_INPUT("21039", "File contents invalid"),
  P_INPUT("21040", "Upload count limit reached"),
  P_CFG("21041", "Gateway access privileges insufficient"),
  P_INPUT("21042", "File size limit reached"),
  P_INPUT("21043", "Usernames must be valid"),
  P_INPUT("21044", "Site references must be valid"),
  P_CFG("21045", "Email could not be sent"),
  P_INPUT("21046", "Negative (block-list entry) already exists"),
  P_CFG("21047", "Cannot delete another user's search"),
  P_INPUT("21048", "Search invalid"),
  P_INPUT("21049", "Search name not found"),
  P_INPUT("21050", "Search term too short"),
  P_INPUT("21051", "Duplicate custom fields"),
  P_CFG("21052", "Cannot allocate users (privileges)"),
  P_CFG("21053", "Allocated users have access to more sites"),
  P_CFG("21054", "Allocated users have access to more users"),
  P_CFG("21055", "Role cannot have allocated users"),
  P_CFG("21056", "Cookies must be accepted to sign in"),
  P_CFG("21057", "User needs a site reference or site group"),
  P_CFG("21058", "Allocated users have access to more site groups"),
  P_INPUT("21059", "Statement not found"),
  portal("21060", "MobilePay third-party update failed", "provider_unavailable", "manual_review"),
]);

/** `errorcode` 0: success. Not an error, but part of the documented list. */
export const SUCCESS_CODE = "0";

/** Number of codes on the official list, including 0. */
export const DOCUMENTED_CODE_COUNT = 255;

export type AdviceEntry = {
  meaning: string;
  /** Absent for informational values (0, 90, 99). */
  category?: ErrorCategory;
  retry?: RetryGuidance;
  mastercard?: boolean;
};

const adv = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  mastercard = true,
): AdviceEntry => ({ meaning, category, retry, mastercard });

/** `acquireradvicecode` values (Acquirer advice code mapping, plus 0 from the field tables). */
export const ADVICE_CODES: Record<string, AdviceEntry> = {
  "0": { meaning: "No action required" },
  "1": adv(
    "New account information available; obtain new card details or send a SCHEMEUPDATE",
    "card_declined",
    "customer_action_required",
  ),
  "2": adv("Cannot approve at this time; try again later", "card_declined", "retry_conditionally"),
  "4": adv(
    "Do not try again; further attempts may incur card scheme fees",
    "card_declined",
    "do_not_retry",
    false,
  ),
  "6": adv(
    "Duplicate payout; the original payout was approved",
    "duplicate_request",
    "do_not_retry",
  ),
  "7": adv(
    "Duplicate payout; the original payout was declined",
    "duplicate_request",
    "do_not_retry",
  ),
  "8": adv(
    "Payment blocked by the card scheme; do not retry",
    "card_declined",
    "do_not_retry",
    false,
  ),
  "22": adv("Merchant does not qualify for the product code", "configuration", "manual_review"),
  "24": adv("Retry after 1 hour", "card_declined", "retry_conditionally"),
  "25": adv("Retry after 24 hours", "card_declined", "retry_conditionally"),
  "26": adv("Retry after 2 days", "card_declined", "retry_conditionally"),
  "27": adv("Retry after 4 days", "card_declined", "retry_conditionally"),
  "28": adv("Retry after 6 days", "card_declined", "retry_conditionally"),
  "29": adv("Retry after 8 days", "card_declined", "retry_conditionally"),
  "30": adv("Retry after 10 days", "card_declined", "retry_conditionally"),
  "39": adv(
    "Non-reloadable prepaid card; refunds and payouts are not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "40": adv("Token requirements not met for this token type", "configuration", "manual_review"),
  "41": adv("Single-use virtual card", "payment_method_unavailable", "manual_review"),
  "42": adv("Sanctions scoring service", "fraud_or_risk", "manual_review"),
  "43": adv("Multi-use virtual card", "payment_method_unavailable", "manual_review"),
  "45": adv("Retry with PIN", "authentication_required", "manual_review"),
  "80": adv(
    "Duplicate payout; the approval status of the original payout is unknown",
    "duplicate_request",
    "manual_review",
  ),
  "90": { meaning: "Decision made by the issuer; see the acquirer response fields" },
  "99": { meaning: "Decision made by Mastercard; see the acquirer response fields" },
};

export type SettleStatusEntry = { label: string; meaning: string };

/** `settlestatus` values (Settlement for card transactions). */
export const SETTLE_STATUSES: Record<string, SettleStatusEntry> = {
  "0": {
    label: "Pending",
    meaning:
      "Authorised and will settle automatically; may still be suspended by fraud or duplicate checks",
  },
  "1": {
    label: "Manual",
    meaning: "Authorised and will settle; bypasses the internal fraud and duplicate checks",
  },
  "2": {
    label: "Suspended",
    meaning:
      "Will not settle without merchant action; cancelled automatically 7 days after authorisation (31 days for pre-authorisations)",
  },
  "3": { label: "Cancelled", meaning: "Declined, cancelled or in error; will not settle" },
  "10": {
    label: "Settling",
    meaning: "Sent to the acquirer for settlement (typical for alternative payment methods)",
  },
  "100": {
    label: "Settled",
    meaning:
      "Batched and sent to the acquirer; this does not guarantee that funds have reached the merchant",
  },
};

export type RequestTypeEntry = { stage: LifecycleStage; description: string };

/** Request types seen in the documentation, plus ERROR (response only). */
export const REQUEST_TYPES: Record<string, RequestTypeEntry> = {
  AUTH: { stage: "authorization", description: "Authorisation" },
  REFUND: { stage: "refund", description: "Refund (a payout when accounttypedescription is CFT)" },
  ACCOUNTCHECK: { stage: "authorization", description: "Account check (zero authorisation)" },
  THREEDQUERY: { stage: "authentication", description: "3-D Secure authentication" },
  THREEDLOOKUP: { stage: "authentication", description: "3-D Secure API card lookup" },
  THREEDRESULT: { stage: "authentication", description: "3-D Secure API authentication result" },
  SUBSCRIPTION: { stage: "subscription", description: "Subscription Engine schedule" },
  TRANSACTIONQUERY: { stage: "other", description: "Transaction query" },
  TRANSACTIONUPDATE: { stage: "other", description: "Transaction update" },
  SCHEMEUPDATE: { stage: "other", description: "Card scheme account updater request" },
  RISKDEC: { stage: "other", description: "Protect Plus risk decision" },
  CURRENCYRATE: { stage: "other", description: "Currency rate request" },
  ORDER: { stage: "other", description: "Order request" },
  ORDERDETAILS: { stage: "other", description: "Order details request" },
  ERROR: { stage: "error", description: "The request may not have been processed" },
};

/** `accounttypedescription` values (Account types). */
export const ACCOUNT_TYPES: Record<string, string> = {
  ECOM: "E-commerce",
  MOTO: "Mail order / telephone order",
  RECUR: "Recurring",
  CFT: "Credit funds transfer (payouts)",
  FRAUDCONTROL: "Fraud control",
  CURRENCYRATE: "Currency rate",
};

/** `securityresponseaddress`, `securityresponsepostcode`, `securityresponsesecuritycode`. */
export const SECURITY_RESPONSES: Record<string, string> = {
  "0": "not given",
  "1": "not checked",
  "2": "matched",
  "4": "not matched",
};

/** 3-D Secure `enrolled` values. */
export const THREEDS_ENROLLED: Record<string, string> = {
  Y: "enrolled",
  N: "not enrolled",
  U: "unknown",
  B: "bypass rule applied",
};

export type ThreeDsStatusEntry = {
  meaning: string;
  outcome: "success" | "failure" | "pending" | "unknown";
};

/** 3-D Secure `status` values (3DS API field specification). */
export const THREEDS_STATUSES: Record<string, ThreeDsStatusEntry> = {
  Y: { meaning: "authenticated", outcome: "success" },
  A: { meaning: "authentication attempted", outcome: "success" },
  U: { meaning: "unable to authenticate", outcome: "unknown" },
  N: { meaning: "authentication failed; do not proceed", outcome: "failure" },
  C: { meaning: "challenge required", outcome: "pending" },
  R: { meaning: "authentication rejected", outcome: "failure" },
};

/** Subscription `active` / `transactionactive` values. */
export const SUBSCRIPTION_STATES: Record<string, string> = {
  "0": "inactive (re-enabling catches up missed payments)",
  "1": "active",
  "2": "pending until the first payment settles",
  "3": "stopped (permanent)",
};

/** Protect Plus `fraudcontrolshieldstatuscode` values. */
export const SHIELD_STATUSES: readonly string[] = ["ACCEPT", "CHALLENGE", "DENY", "NOSCORE"];

/** Payout verticals that the Payouts article ties to a merchant category code. */
export const PAYOUT_MCC: Record<string, string> = {
  "7995": "Gaming payouts (gambling winnings)",
  "6051": "Crypto, forex and securities payouts",
  "6211": "Crypto, forex and securities payouts",
  "4829": "Person-to-person money transfer payouts",
};

/** Offline refunds return these authcode values (REFUND with Webservices API). */
export const OFFLINE_REFUND_AUTHCODES: readonly string[] = [
  "REFUND ACCEPTED",
  "TEST REFUND ACCEPTED",
];
