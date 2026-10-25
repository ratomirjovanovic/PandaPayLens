/**
 * Authorize.net code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/authorize_net.md, which cites
 * Authorize.net's public developer documentation, verified 2026-10-25:
 *
 * Response codes (I/E and reason codes): https://developer.authorize.net/api/reference/dist/json/responseCodes.json
 *   (also https://developer.authorize.net/api/reference/features/errorandresponsecodes.html)
 * API reference (createTransactionResponse, AVS/CVV/CAVV): https://developer.authorize.net/api/reference/index.html
 * Webhooks (event types, envelope, signature):  https://developer.authorize.net/api/reference/features/webhooks.html
 * Transaction types:                            https://developer.authorize.net/api/reference/features/payment-transactions.html
 *
 * Authorize.net has two separate result layers that both use small numbers:
 * `transactionResponse.responseCode` (1-4) and the transaction response reason
 * codes (`errors[].errorCode`, `messages[].code`), where 1-4 also exist with a
 * different meaning. They are kept in separate tables and are never looked up
 * in each other's table. The API layer (`messages.message[].code`) uses I and
 * E codes.
 *
 * Meanings are short paraphrases, often of the separate integration
 * suggestions because many codes share one customer-facing text. Category and
 * retry values are PandaPayLens suggestions, not Authorize.net statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DEV = "https://developer.authorize.net";
export const RESPONSE_CODES_URL = `${DEV}/api/reference/features/errorandresponsecodes.html`;
export const RESPONSE_CODES_JSON_URL = `${DEV}/api/reference/dist/json/responseCodes.json`;
export const RESPONSE_CODE_TOOL_URL = `${DEV}/api/reference/responseCodes.html`;
export const API_REFERENCE_URL = `${DEV}/api/reference/index.html`;
export const WEBHOOKS_URL = `${DEV}/api/reference/features/webhooks.html`;
export const PAYMENT_TRANSACTIONS_URL = `${DEV}/api/reference/features/payment-transactions.html`;
export const TRANSACTION_REPORTING_URL = `${DEV}/api/reference/features/transaction-reporting.html`;
export const RECURRING_BILLING_URL = `${DEV}/api/reference/features/recurring-billing.html`;
export const TESTING_GUIDE_URL = `${DEV}/hello_world/testing_guide.html`;
export const HASH_UPGRADE_URL = `${DEV}/support/hash_upgrade.html`;
export const UPGRADE_GUIDE_URL = `${DEV}/api/upgrade_guide.html`;
export const CARD_ON_FILE_URL = `${DEV}/api/reference/features/card-on-file.html`;
export const ACCEPT_HOSTED_URL = `${DEV}/api/reference/features/accept-hosted.html`;
export const API_SCHEMA_URL = "https://api.authorize.net/xml/v1/schema/AnetApiSchema.xsd";

// ---------------------------------------------------------------------------
// Guidance texts

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required: "Complete the required payer authorization first.",
  authentication_failed:
    "Check the authentication data that was sent (3-D Secure values or the login step) before a new attempt.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount before sending a new request.",
  insufficient_funds: "Ask the customer to pay the remaining balance with another payment method.",
  payment_method_unavailable: "Offer the customer another card type or payment method.",
  fraud_or_risk:
    "Review the transaction and the fraud filter or AVS/card code settings in the Merchant Interface before acting.",
  rate_limiting: "Wait for the limit to reset before sending further requests.",
  provider_unavailable:
    "Look up the transaction with getTransactionDetails or in the Merchant Interface before any new attempt.",
  network_or_timeout:
    "Look up the transaction with getTransactionDetails or in the Merchant Interface before any new attempt.",
  duplicate_request:
    "Look up the original transaction before doing anything else; do not resubmit the same request.",
  configuration:
    "Check the API credentials, the environment (sandbox or production) and the account or processor setup with Authorize.net or the reseller that issued the account.",
  unknown:
    "Look up the transaction with getTransactionDetails or in the Merchant Interface, and contact Authorize.net support if the state is unclear.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary, but the original transaction may still have been processed. Confirm its state first (getTransactionDetails or the Merchant Interface), then make at most a single new attempt.",
  safe_to_retry_technical_request:
    "Authorize.net documents this as a temporary condition (maintenance, server busy or a failed encryption step) before processing; the request can be sent again later.",
  manual_review:
    "The response does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this value.",
};

// ---------------------------------------------------------------------------
// Code tables

/**
 * How a code relates to the result: `success`, `info` (informational),
 * `empty` (a query matched nothing), `see_reason` (E00027: the transaction
 * layer carries the reason) or `error`.
 */
export type CodeKind = "success" | "info" | "empty" | "see_reason" | "error";

export type CodeEntry = {
  meaning: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Documented conflict or caveat; such codes are decoded with possible confidence. */
  caveat?: string;
};

const success = (meaning: string): CodeEntry => ({
  meaning,
  kind: "success",
  category: "unknown",
  retry: "unknown",
});
const info = (meaning: string, retry: RetryGuidance = "unknown"): CodeEntry => ({
  meaning,
  kind: "info",
  category: "unknown",
  retry,
});
const empty = (meaning: string): CodeEntry => ({
  meaning,
  kind: "empty",
  category: "unknown",
  retry: "unknown",
});
const seeReason = (meaning: string): CodeEntry => ({
  meaning,
  kind: "see_reason",
  category: "unknown",
  retry: "unknown",
});
const error = (meaning: string, category: ErrorCategory, retry: RetryGuidance): CodeEntry => ({
  meaning,
  kind: "error",
  category,
  retry,
});

function withCaveats(
  table: Record<string, CodeEntry>,
  caveats: Record<string, string>,
): Readonly<Record<string, CodeEntry>> {
  for (const [code, caveat] of Object.entries(caveats)) {
    const e = table[code];
    if (e) table[code] = { ...e, caveat };
  }
  return Object.freeze(table);
}

/**
 * API message codes (`messages.message[].code`): 12 informational (I) and
 * 161 error (E) codes. E00161 and E00162 are not in the reference.
 * E00152-E00163 concern merchant user and mobile device login, not
 * cardholder authentication.
 */
export const API_MESSAGE_CODES: Readonly<Record<string, CodeEntry>> = withCaveats(
  {
    I00001: success("Request processed successfully"),
    I00002: info("Subscription was already canceled"),
    I00003: info("Record was already deleted"),
    I00004: info("No records match the query"),
    I00005: info("Mobile device submitted for administrator approval"),
    I00006: info("Mobile device approved"),
    I00007: info("Payment Gateway Account service already accepted"),
    I00008: info("Payment Gateway Account service already declined"),
    I00009: info("API user already exists"),
    I00010: info("Merchant activated"),
    I00011: info("Merchant not activated"),
    I99999: info("Development placeholder; documented as never released to production"),
    E00001: error("Unexpected system error", "provider_unavailable", "retry_conditionally"),
    E00002: error(
      "Content type not supported (description names only XML types)",
      "invalid_request",
      "do_not_retry",
    ),
    E00003: error("XML parse error", "invalid_request", "do_not_retry"),
    E00004: error("Method name (root node) invalid", "invalid_request", "do_not_retry"),
    E00005: error("Transaction key or API key missing or invalid", "configuration", "do_not_retry"),
    E00006: error("API user name (login ID) missing or invalid", "configuration", "do_not_retry"),
    E00007: error(
      "Authentication failed; wrong credentials or wrong environment (sandbox vs production)",
      "configuration",
      "do_not_retry",
    ),
    E00008: error("Gateway, reseller or user account inactive", "configuration", "do_not_retry"),
    E00009: error("Account in Test Mode; method cannot run", "configuration", "do_not_retry"),
    E00010: error("User not permitted to call the API", "configuration", "do_not_retry"),
    E00011: error("User not permitted to call this method", "configuration", "do_not_retry"),
    E00012: error("Duplicate subscription", "duplicate_request", "do_not_retry"),
    E00013: error(
      "A field value is invalid (text names the field)",
      "invalid_request",
      "do_not_retry",
    ),
    E00014: error("Required field missing", "invalid_request", "do_not_retry"),
    E00015: error("Field length invalid", "invalid_request", "do_not_retry"),
    E00016: error("Field type invalid", "invalid_request", "do_not_retry"),
    E00017: error("Subscription start date in the past", "invalid_request", "do_not_retry"),
    E00018: error(
      "Card expires before subscription start",
      "invalid_request",
      "customer_action_required",
    ),
    E00019: error(
      "Tax ID or driver's license data required for the subscription",
      "invalid_request",
      "do_not_retry",
    ),
    E00020: error("Account not enabled for eCheck subscriptions", "configuration", "do_not_retry"),
    E00021: error("Account not enabled for card subscriptions", "configuration", "do_not_retry"),
    E00022: error(
      "Interval out of range (7-365 days or 1-12 months)",
      "invalid_request",
      "do_not_retry",
    ),
    E00023: error(
      "Subscription would run longer than three years",
      "invalid_request",
      "do_not_retry",
    ),
    E00024: error(
      "Trial occurrences required when a trial amount is given",
      "invalid_request",
      "do_not_retry",
    ),
    E00025: error("Automated Recurring Billing not enabled", "configuration", "do_not_retry"),
    E00026: error(
      "Trial amount and trial occurrences must both be given",
      "invalid_request",
      "do_not_retry",
    ),
    E00027: seeReason("Transaction not approved; details in transactionResponse.errors"),
    E00028: error(
      "Trial occurrences must be fewer than total occurrences",
      "invalid_request",
      "do_not_retry",
    ),
    E00029: error("Payment information required", "invalid_request", "do_not_retry"),
    E00030: error("Payment schedule required", "invalid_request", "do_not_retry"),
    E00031: error("Subscription amount required", "invalid_amount", "do_not_retry"),
    E00032: error("Subscription start date required", "invalid_request", "do_not_retry"),
    E00033: error("Start date cannot be changed", "invalid_request", "do_not_retry"),
    E00034: error("Interval cannot be changed", "invalid_request", "do_not_retry"),
    E00035: error("Subscription not found for this merchant", "invalid_request", "do_not_retry"),
    E00036: error(
      "Payment type (card vs eCheck) cannot be changed",
      "invalid_request",
      "do_not_retry",
    ),
    E00037: error(
      "Expired, canceled or terminated subscription cannot be updated",
      "invalid_request",
      "do_not_retry",
    ),
    E00038: error(
      "Expired or terminated subscription cannot be canceled",
      "invalid_request",
      "do_not_retry",
    ),
    E00039: error(
      "Duplicate customer profile, payment profile or address",
      "duplicate_request",
      "do_not_retry",
    ),
    E00040: error(
      "Profile, payment profile, address or transaction ID not found for this merchant",
      "invalid_request",
      "do_not_retry",
    ),
    E00041: error("All fields empty", "invalid_request", "do_not_retry"),
    E00042: error("Maximum number of payment profiles reached", "invalid_request", "do_not_retry"),
    E00043: error(
      "Maximum number of shipping addresses reached",
      "invalid_request",
      "do_not_retry",
    ),
    E00044: error("Customer Information Manager not enabled", "configuration", "do_not_retry"),
    E00045: error("Root node has no valid XML namespace", "invalid_request", "do_not_retry"),
    E00046: error("Generic merchant boarding insert failure", "unknown", "manual_review"),
    E00047: error(
      "Merchant Boarding API not enabled for the reseller",
      "configuration",
      "do_not_retry",
    ),
    E00048: error(
      "Boarding: at least one payment method must be set",
      "invalid_request",
      "do_not_retry",
    ),
    E00049: error("Database operation timed out", "network_or_timeout", "retry_conditionally"),
    E00050: error("Boarding: sell rates below buy rates", "invalid_request", "do_not_retry"),
    E00051: error(
      "Original transaction was not made with this payment profile",
      "invalid_request",
      "do_not_retry",
    ),
    E00052: error("Too many array elements", "invalid_request", "do_not_retry"),
    E00053: error(
      "Server too busy; try later",
      "provider_unavailable",
      "safe_to_retry_technical_request",
    ),
    E00054: error("Mobile device not registered with the account", "configuration", "do_not_retry"),
    E00055: error("Mobile device pending approval", "configuration", "do_not_retry"),
    E00056: error("Mobile device disabled", "configuration", "do_not_retry"),
    E00057: error("User may not submit from a mobile device", "configuration", "do_not_retry"),
    E00058: error("Too many pending mobile devices", "configuration", "do_not_retry"),
    E00059: error(
      "Authentication type not allowed for this method",
      "configuration",
      "do_not_retry",
    ),
    E00060: error("Transaction type invalid", "invalid_request", "do_not_retry"),
    E00061: error(
      "Could not decrypt DUKPT data (text is a placeholder)",
      "invalid_request",
      "do_not_retry",
    ),
    E00062: error(
      "Fatal error calling an internal web service",
      "provider_unavailable",
      "retry_conditionally",
    ),
    E00063: error(
      "Internal web service returned an error",
      "provider_unavailable",
      "retry_conditionally",
    ),
    E00064: error("Client authorization denied", "configuration", "do_not_retry"),
    E00065: error("Prerequisite failed (no detail)", "unknown", "manual_review"),
    E00066: error("Invalid value", "invalid_request", "do_not_retry"),
    E00067: error("XML parse: too many nodes of a kind", "invalid_request", "do_not_retry"),
    E00068: error("XML parse: node invalid", "invalid_request", "do_not_retry"),
    E00069: error(
      "Boarding service already accepted; decline not allowed",
      "invalid_request",
      "do_not_retry",
    ),
    E00070: error(
      "Boarding service already declined; agree not allowed",
      "invalid_request",
      "do_not_retry",
    ),
    E00071: error("A named field must contain data", "invalid_request", "do_not_retry"),
    E00072: error("A named node is required", "invalid_request", "do_not_retry"),
    E00073: error("A named value is invalid", "invalid_request", "do_not_retry"),
    E00074: error("Merchant not associated with this reseller", "configuration", "do_not_retry"),
    E00075: error("XML parse: missing fields", "invalid_request", "do_not_retry"),
    E00076: error("A named field has an invalid value", "invalid_request", "do_not_retry"),
    E00077: error("A named value is too long", "invalid_request", "do_not_retry"),
    E00078: error("Pending status, not completed", "unknown", "manual_review"),
    E00079: error(
      "Impersonation (partner) login ID invalid or missing",
      "configuration",
      "do_not_retry",
    ),
    E00080: error("Impersonation API key invalid or missing", "configuration", "do_not_retry"),
    E00081: error(
      "Partner not authorized to impersonate this account",
      "configuration",
      "do_not_retry",
    ),
    E00082: error("Country invalid", "invalid_request", "do_not_retry"),
    E00083: error(
      "Bank payments not accepted for the business country",
      "configuration",
      "do_not_retry",
    ),
    E00084: error(
      "Card payments not accepted for the business country",
      "configuration",
      "do_not_retry",
    ),
    E00085: error("State invalid", "invalid_request", "do_not_retry"),
    E00086: error(
      "Merchant declined authorization to the resource",
      "configuration",
      "do_not_retry",
    ),
    E00087: empty("No subscriptions found"),
    E00088: error(
      "Profile IDs and CreateProfile cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00089: error("CreateProfile requires payment data", "invalid_request", "do_not_retry"),
    E00090: error(
      "Payment profile and payment data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00091: error(
      "Payment profile ID and payment data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00092: error(
      "Shipping profile ID and shipTo data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00093: error(
      "Payment profile and billing data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00094: error("Paging offset too large", "invalid_request", "do_not_retry"),
    E00095: error(
      "Shipping profile ID missing in customer profile",
      "invalid_request",
      "do_not_retry",
    ),
    E00096: error("Fingerprint value invalid", "configuration", "do_not_retry"),
    E00097: error("Fingerprint cannot be generated", "configuration", "do_not_retry"),
    E00098: error("Customer or shipping profile not found", "invalid_request", "do_not_retry"),
    E00099: error(
      "Profile from transaction failed: transaction ID invalid (older than 30 days not allowed)",
      "invalid_request",
      "do_not_retry",
    ),
    E00100: error(
      "Profile from transaction failed: transaction type not supported",
      "invalid_request",
      "do_not_retry",
    ),
    E00101: error(
      "Profile from transaction failed (payment profile step)",
      "unknown",
      "manual_review",
    ),
    E00102: error("Customer information missing", "invalid_request", "do_not_retry"),
    E00103: error(
      "Payment method does not support profile creation",
      "payment_method_unavailable",
      "do_not_retry",
    ),
    E00104: error(
      "Server in maintenance; try later",
      "provider_unavailable",
      "safe_to_retry_technical_request",
    ),
    E00105: error(
      "Payment profile tied to an active/suspended subscription; cannot delete",
      "invalid_request",
      "do_not_retry",
    ),
    E00106: error(
      "Customer profile tied to an active/suspended subscription; cannot delete",
      "invalid_request",
      "do_not_retry",
    ),
    E00107: error(
      "Shipping profile tied to an active/suspended subscription; cannot delete",
      "invalid_request",
      "do_not_retry",
    ),
    E00108: error(
      "Customer profile ID and customer data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00109: error(
      "Customer address ID and shipTo data cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    E00110: error("Customer payment profile ID missing", "invalid_request", "do_not_retry"),
    E00111: error(
      "Subscription was not created with this customer profile",
      "invalid_request",
      "do_not_retry",
    ),
    E00112: error("Report month in the future", "invalid_request", "do_not_retry"),
    E00113: error("OTS token data invalid", "invalid_request", "do_not_retry"),
    E00114: error("OTS token invalid", "invalid_request", "do_not_retry"),
    E00115: error("OTS token expired", "invalid_request", "customer_action_required"),
    E00116: error("Merchant has no access to this OTS token", "configuration", "do_not_retry"),
    E00117: error("OTS service validation or configuration error", "configuration", "do_not_retry"),
    E00118: error("Blocked IP address", "fraud_or_risk", "do_not_retry"),
    E00119: error(
      "Payment data must not be sent with a hosted payment page request",
      "invalid_request",
      "do_not_retry",
    ),
    E00120: error(
      "Payment/shipping profile IDs not allowed when creating profiles",
      "invalid_request",
      "do_not_retry",
    ),
    E00121: error("No default payment or shipping profile", "invalid_request", "do_not_retry"),
    E00122: error(
      "Signature Key missing; generate one in the Merchant Interface",
      "configuration",
      "do_not_retry",
    ),
    E00123: error(
      "OAuth access token expired (tokens last 10 minutes)",
      "configuration",
      "retry_conditionally",
    ),
    E00124: error("OAuth access token invalid or insufficient", "configuration", "do_not_retry"),
    E00125: error("Hash does not match", "configuration", "do_not_retry"),
    E00126: error("Shared key validation failed", "configuration", "do_not_retry"),
    E00127: error("Invoice not found", "invalid_request", "do_not_retry"),
    E00128: error(
      "Action not allowed in the object's current status",
      "invalid_request",
      "do_not_retry",
    ),
    E00129: error("Failed to send email", "provider_unavailable", "retry_conditionally"),
    E00130: error("Valid customer profile ID or email required", "invalid_request", "do_not_retry"),
    E00131: error("Invoice created but email/status update failed", "unknown", "manual_review"),
    E00132: error("Invoicing or CIM not enabled", "configuration", "do_not_retry"),
    E00133: error("Server error", "provider_unavailable", "retry_conditionally"),
    E00134: error("Invoice due date missing or in the past", "invalid_request", "do_not_retry"),
    E00135: error(
      "Processor information missing; cannot leave test mode",
      "configuration",
      "do_not_retry",
    ),
    E00136: error(
      "Processor account setup still in progress",
      "configuration",
      "retry_conditionally",
    ),
    E00137: error(
      "Only one payment type (card or bank) allowed",
      "invalid_request",
      "do_not_retry",
    ),
    E00138: error(
      "Profile IDs not allowed for a hosted payment page request",
      "invalid_request",
      "do_not_retry",
    ),
    E00139: error("Access token lacks permission for this method", "configuration", "do_not_retry"),
    E00140: error("Reference ID not found", "invalid_request", "do_not_retry"),
    E00141: error(
      "Profile from this opaque data requires liveMode",
      "invalid_request",
      "do_not_retry",
    ),
    E00142: error(
      "recurringBilling required for recurring tokenized payments",
      "invalid_request",
      "do_not_retry",
    ),
    E00143: error("Merchant ID not parseable as integer", "invalid_request", "do_not_retry"),
    E00144: error(
      "Last subscription transaction is held for review; review before reactivating",
      "fraud_or_risk",
      "manual_review",
    ),
    E00145: error("Invoice canceled by its sender", "invalid_request", "do_not_retry"),
    E00146: error("Request payload could not be decrypted", "invalid_request", "do_not_retry"),
    E00147: empty("No invoices found"),
    E00148: error("Logo upload rejected as malicious", "invalid_request", "do_not_retry"),
    E00149: error(
      "Invoice locked after too many payment attempts",
      "rate_limiting",
      "do_not_retry",
    ),
    E00150: error(
      "Invoice create/edit limit reached until a transaction succeeds",
      "rate_limiting",
      "retry_conditionally",
    ),
    E00151: error(
      "Daily invoice create/edit limit reached",
      "rate_limiting",
      "retry_conditionally",
    ),
    E00152: error(
      "Failed to send PIN (merchant user login)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    E00153: error(
      "Failed to verify PIN (merchant user login)",
      "authentication_failed",
      "customer_action_required",
    ),
    E00154: error(
      "Biometric login failed: public key expired",
      "authentication_failed",
      "customer_action_required",
    ),
    E00155: error(
      "Could not retrieve public key for login",
      "authentication_failed",
      "retry_conditionally",
    ),
    E00156: error("Login signature verification failed", "authentication_failed", "do_not_retry"),
    E00157: error("Error authenticating the user", "authentication_failed", "retry_conditionally"),
    E00158: error("User password expired", "authentication_failed", "customer_action_required"),
    E00159: error("Activation code expired", "authentication_failed", "customer_action_required"),
    E00160: error("One-time password invalid", "authentication_failed", "customer_action_required"),
    E00163: error("Activation code invalid", "authentication_failed", "customer_action_required"),
  },
  {
    E00002:
      "The description names only text/xml and application/xml as supported content types, although the same reference documents application/json.",
    E00027:
      "The text varies: one documented example returns E00027 with a split tender text instead of the reference text.",
  },
);

/**
 * Transaction response reason codes (`transactionResponse.errors[].errorCode`,
 * `transactionResponse.messages[].code`): 306 codes from the response code
 * reference, plus 2201, which appears only in the second response code file.
 * Many are tied to one processor (FDC Omaha 200-224, Concord EFS 170-175,
 * Wells Fargo SecureSource, TSYS, WePay) or to a legacy method (SIM, AIM x_
 * fields); the meaning says so.
 */
export const REASON_CODES: Readonly<Record<string, CodeEntry>> = withCaveats(
  {
    "0": error("Unknown error", "unknown", "manual_review"),
    "1": success("Approved"),
    "2": error("Declined (general, no reason given)", "card_declined", "customer_action_required"),
    "3": error(
      "Declined: issuer referral, voice authorization needed (docs list brand phone numbers)",
      "card_declined",
      "manual_review",
    ),
    "4": error("Declined: processor says pick up the card", "fraud_or_risk", "do_not_retry"),
    "5": error("Amount missing or not a valid number", "invalid_amount", "do_not_retry"),
    "6": error("Card number invalid", "invalid_request", "customer_action_required"),
    "7": error("Expiration date format invalid", "invalid_request", "customer_action_required"),
    "8": error("Card expired", "card_declined", "customer_action_required"),
    "9": error("Routing (ABA) number invalid", "invalid_request", "customer_action_required"),
    "10": error("Bank account number invalid", "invalid_request", "customer_action_required"),
    "11": error(
      "Duplicate: same amount and card within the duplicate window (two minutes by default)",
      "duplicate_request",
      "do_not_retry",
    ),
    "12": error("Authorization code required but missing", "invalid_request", "do_not_retry"),
    "13": error(
      "API login ID invalid, account inactive, or wrong environment",
      "configuration",
      "do_not_retry",
    ),
    "14": error("Relay/receipt/referrer URL invalid (SIM only)", "configuration", "do_not_retry"),
    "15": error(
      "Transaction ID missing or non-numeric for void, capture or credit",
      "invalid_request",
      "do_not_retry",
    ),
    "16": error(
      "Referenced transaction not found (for example made under another account)",
      "invalid_request",
      "do_not_retry",
    ),
    "17": error(
      "Gateway account not set up for this card type",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    "18": error(
      "Merchant does not accept eChecks",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    "19": error(
      "Processing error: no reply from the processor (connectivity)",
      "network_or_timeout",
      "retry_conditionally",
    ),
    "20": error(
      "Processing error: no reply from the processor (connectivity)",
      "network_or_timeout",
      "retry_conditionally",
    ),
    "21": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "22": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "23": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "24": error("Elavon bank number or terminal ID wrong", "configuration", "do_not_retry"),
    "25": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "26": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "27": error(
      "Declined by the merchant's AVS filter (address mismatch)",
      "fraud_or_risk",
      "customer_action_required",
    ),
    "28": error(
      "Processor not set up for this card type",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    "29": error(
      "Paymentech client, merchant or terminal number wrong",
      "configuration",
      "do_not_retry",
    ),
    "30": error("Processor configuration invalid", "configuration", "do_not_retry"),
    "31": error("FDC merchant ID or terminal ID wrong", "configuration", "do_not_retry"),
    "32": error("Merchant password invalid or missing", "configuration", "do_not_retry"),
    "33": error(
      "A field the merchant marked as required was not sent (text has a field placeholder)",
      "invalid_request",
      "do_not_retry",
    ),
    "34": error("VITAL identification numbers wrong", "configuration", "do_not_retry"),
    "35": error(
      "Processing error; merchant set up incorrectly at the processor",
      "configuration",
      "manual_review",
    ),
    "36": error("Authorized, but settlement failed", "unknown", "manual_review"),
    "37": error("Card number invalid", "invalid_request", "customer_action_required"),
    "38": error(
      "Global Payment System identification numbers wrong",
      "configuration",
      "do_not_retry",
    ),
    "39": error(
      "Currency invalid, unsupported, not allowed, or no exchange rate",
      "configuration",
      "do_not_retry",
    ),
    "40": error("Transaction must be encrypted", "configuration", "do_not_retry"),
    "41": error(
      "Declined: FraudScreen.Net score above the merchant threshold",
      "fraud_or_risk",
      "do_not_retry",
    ),
    "42": error(
      "Required field missing or invalid (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "43": error("Merchant terminal ID invalid at the processor", "configuration", "do_not_retry"),
    "44": error(
      "Declined: card code did not match at the issuer",
      "card_declined",
      "customer_action_required",
    ),
    "45": error(
      "Declined: both AVS and card code filters matched rejection rules",
      "fraud_or_risk",
      "customer_action_required",
    ),
    "46": error("Session expired or missing; log in again", "configuration", "do_not_retry"),
    "47": error(
      "Capture amount greater than the authorized amount",
      "invalid_amount",
      "do_not_retry",
    ),
    "48": error(
      "Processor does not allow settling less than authorized (partial reversal)",
      "invalid_amount",
      "do_not_retry",
    ),
    "49": error("Amount above the allowed maximum", "invalid_amount", "do_not_retry"),
    "50": error(
      "Transaction not yet settled; cannot be refunded",
      "invalid_request",
      "retry_conditionally",
    ),
    "51": error("Credits would exceed the original amount", "invalid_amount", "do_not_retry"),
    "52": error(
      "Authorized, but the merchant system was not notified; will not be settled",
      "network_or_timeout",
      "manual_review",
    ),
    "53": error(
      "Transaction type not valid for ACH (for example capture only)",
      "invalid_request",
      "do_not_retry",
    ),
    "54": error(
      "Referenced transaction not eligible for credit (unsettled, wrong type or currency, bad ID, or settled over 180 days ago)",
      "invalid_request",
      "do_not_retry",
    ),
    "55": error("Credits would exceed the original debit", "invalid_amount", "do_not_retry"),
    "56": error(
      "Merchant accepts eCheck only",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    "57": error(
      "Processing error: processor could not interpret the data",
      "invalid_request",
      "do_not_retry",
    ),
    "58": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "59": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "60": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "61": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "62": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "63": error(
      "Processing error; if repeated, check business country (TSYS)",
      "configuration",
      "retry_conditionally",
    ),
    "64": error(
      "Referenced transaction was not approved (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "65": error(
      "Declined by the merchant's card code filter",
      "fraud_or_risk",
      "customer_action_required",
    ),
    "66": error(
      "Not accepted: sent with HTTP GET, or SIM security fields missing",
      "configuration",
      "do_not_retry",
    ),
    "67": error(
      "Transaction type not supported for this merchant (Wells Fargo SecureSource, capture only)",
      "configuration",
      "do_not_retry",
    ),
    "68": error("Legacy x_version invalid", "invalid_request", "do_not_retry"),
    "69": error("transactionType invalid", "invalid_request", "do_not_retry"),
    "70": error("Legacy x_method invalid", "invalid_request", "do_not_retry"),
    "71": error("Bank accountType invalid", "invalid_request", "do_not_retry"),
    "72": error("authCode longer than six characters", "invalid_request", "do_not_retry"),
    "73": error("Driver's license date of birth invalid", "invalid_request", "do_not_retry"),
    "74": error("Duty amount invalid", "invalid_amount", "do_not_retry"),
    "75": error("Freight amount invalid", "invalid_amount", "do_not_retry"),
    "76": error("Tax amount invalid", "invalid_amount", "do_not_retry"),
    "77": error("SSN or tax ID invalid", "invalid_request", "do_not_retry"),
    "78": error("Card code format invalid", "invalid_request", "customer_action_required"),
    "79": error("Driver's license number invalid", "invalid_request", "do_not_retry"),
    "80": error("Driver's license state invalid", "invalid_request", "do_not_retry"),
    "81": error(
      "Requested form type invalid; integration not compatible with AIM",
      "configuration",
      "do_not_retry",
    ),
    "82": error(
      "Scripts only supported in version 2.5 (no longer supported)",
      "configuration",
      "do_not_retry",
    ),
    "83": error("Requested script invalid or no longer supported", "configuration", "do_not_retry"),
    "84": error("deviceType missing or invalid (retail)", "invalid_request", "do_not_retry"),
    "85": error("marketType missing or invalid", "invalid_request", "do_not_retry"),
    "86": error("Legacy response format invalid", "invalid_request", "do_not_retry"),
    "87": error(
      "Market type not allowed for this account (for example swipe on an e-commerce account)",
      "configuration",
      "do_not_retry",
    ),
    "88": error("Track 1 data invalid", "invalid_request", "customer_action_required"),
    "89": error("Track 2 data invalid", "invalid_request", "customer_action_required"),
    "90": error("ACH not allowed on a card-present account", "configuration", "do_not_retry"),
    "91": error("Version 2.5 no longer supported", "configuration", "do_not_retry"),
    "92": error(
      "Integration method no longer supported (often mixed methods)",
      "configuration",
      "do_not_retry",
    ),
    "93": error(
      "Valid country required (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "94": error(
      "Shipping state or country invalid (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "95": error(
      "Valid state required (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "96": error(
      "Buyer country not authorized (Wells Fargo SecureSource)",
      "fraud_or_risk",
      "do_not_retry",
    ),
    "97": error("SIM fingerprint expired", "configuration", "retry_conditionally"),
    "98": error("SIM fingerprint already used", "duplicate_request", "do_not_retry"),
    "99": error("SIM fingerprint does not match", "configuration", "do_not_retry"),
    "100": error("eCheck type invalid", "invalid_request", "do_not_retry"),
    "101": error(
      "Account name or type does not match the bank's change notice (NOC) record",
      "invalid_request",
      "customer_action_required",
    ),
    "102": error(
      "Not accepted: transaction key sent with a WebLink request (sunset method)",
      "configuration",
      "do_not_retry",
    ),
    "103": error("Not accepted; documented as no longer in use", "unknown", "unknown"),
    "104": error(
      "Under review: eCheck country value failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "105": error(
      "Under review: eCheck city and country failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "106": error(
      "Under review: eCheck company failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "107": error(
      "Under review: bank account name failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "108": error(
      "Under review: eCheck first and last name failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "109": error(
      "Under review: eCheck first and last name failed validation",
      "fraud_or_risk",
      "manual_review",
    ),
    "110": error(
      "Under review: account name has invalid characters",
      "fraud_or_risk",
      "manual_review",
    ),
    "111": error(
      "Valid billing country required (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "112": error(
      "Valid billing state/province required (Wells Fargo SecureSource)",
      "invalid_request",
      "do_not_retry",
    ),
    "113": error("Commercial card type invalid", "invalid_request", "do_not_retry"),
    "114": error(
      "Account in test mode; automated (recurring) payment skipped",
      "configuration",
      "do_not_retry",
    ),
    "115": error("Account inactive; automated payment skipped", "configuration", "do_not_retry"),
    "116": error(
      "Authentication indicator (ECI/UCAF) invalid",
      "authentication_failed",
      "do_not_retry",
    ),
    "117": error(
      "Cardholder authentication value (CAVV/AAV) invalid",
      "authentication_failed",
      "do_not_retry",
    ),
    "118": error(
      "Invalid combination of card type, indicator and authentication value",
      "authentication_failed",
      "do_not_retry",
    ),
    "119": error(
      "Transactions with authentication values cannot be flagged recurring",
      "invalid_request",
      "do_not_retry",
    ),
    "120": error(
      "Original timed out at the authorizer and the system void also failed",
      "network_or_timeout",
      "manual_review",
    ),
    "121": error(
      "Original hit a database error and the system void also failed",
      "provider_unavailable",
      "manual_review",
    ),
    "122": error(
      "Original hit a processing error and the system void also failed",
      "provider_unavailable",
      "manual_review",
    ),
    "123": error(
      "Personal user login used instead of the API login; permission missing",
      "configuration",
      "do_not_retry",
    ),
    "124": error(
      "Processor does not accept recurring transactions",
      "configuration",
      "do_not_retry",
    ),
    "125": error("Surcharge amount invalid", "invalid_amount", "do_not_retry"),
    "126": error("Tip amount invalid", "invalid_amount", "do_not_retry"),
    "127": error(
      "AVS mismatch; the system void failed, so the authorization may stay on the card",
      "fraud_or_risk",
      "manual_review",
    ),
    "128": error(
      "Customer's bank does not allow transactions for this account",
      "card_declined",
      "customer_action_required",
    ),
    "130": error("Gateway account closed (blacklisted)", "configuration", "do_not_retry"),
    "131": error("Gateway account suspended", "configuration", "do_not_retry"),
    "132": error("Gateway account suspended (blacklist)", "configuration", "do_not_retry"),
    "141": error("FraudScreen rejection; the system void failed", "fraud_or_risk", "manual_review"),
    "145": error(
      "Card code and AVS rejection; the system void failed",
      "fraud_or_risk",
      "manual_review",
    ),
    "152": error(
      "Authorized but merchant not notified; the system void failed",
      "network_or_timeout",
      "manual_review",
    ),
    "153": error(
      "Error processing wallet/opaque payment data (check market type, transaction type, opaque fields)",
      "invalid_request",
      "do_not_retry",
    ),
    "154": error("Apple Pay not enabled for the account", "configuration", "do_not_retry"),
    "155": error(
      "Processor does not support this way of sending payment data",
      "configuration",
      "do_not_retry",
    ),
    "156": error(
      "Cryptogram invalid or not combinable with other parameters",
      "invalid_request",
      "do_not_retry",
    ),
    "165": error(
      "Card code mismatch per merchant settings; the system void failed",
      "fraud_or_risk",
      "manual_review",
    ),
    "170": error("Concord EFS: provisioning not complete", "configuration", "do_not_retry"),
    "171": error("Concord EFS: request invalid", "invalid_request", "do_not_retry"),
    "172": error("Concord EFS: store ID invalid", "configuration", "do_not_retry"),
    "173": error("Concord EFS: store key invalid", "configuration", "do_not_retry"),
    "174": error("Concord EFS: transaction type not accepted", "configuration", "do_not_retry"),
    "175": error("Concord EFS: credits cannot be voided", "invalid_request", "do_not_retry"),
    "180": error(
      "Processor response format invalid (causes listed include voiding a refund, unenrolled AMEX CID, test cards in live)",
      "unknown",
      "manual_review",
    ),
    "181": error(
      "Invalid processor response and the system void failed",
      "provider_unavailable",
      "manual_review",
    ),
    "182": error("Sub-merchant values invalid", "invalid_request", "do_not_retry"),
    "183": error("Required sub-merchant values missing", "invalid_request", "do_not_retry"),
    "184": error("Token requestor name invalid", "invalid_request", "do_not_retry"),
    "185": error("Merchant not configured for VPOS", "configuration", "do_not_retry"),
    "186": error("Token requestor ID length invalid", "invalid_request", "do_not_retry"),
    "187": error("Token requestor ECI length invalid", "invalid_request", "do_not_retry"),
    "191": error("Declined (no detail)", "card_declined", "customer_action_required"),
    "192": error(
      "Processing error, try again (no detail)",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "193": error("Under review (no detail)", "fraud_or_risk", "manual_review"),
    "195": error("HTML-type configuration fields look unsafe", "invalid_request", "do_not_retry"),
    "200": error("FDC Omaha: card number invalid", "invalid_request", "customer_action_required"),
    "201": error(
      "FDC Omaha: expiration date invalid",
      "invalid_request",
      "customer_action_required",
    ),
    "202": error("FDC Omaha: transaction type invalid", "invalid_request", "do_not_retry"),
    "203": error("FDC Omaha: amount invalid", "invalid_amount", "do_not_retry"),
    "204": error("FDC Omaha: department code invalid", "configuration", "do_not_retry"),
    "205": error("FDC Omaha: merchant number invalid", "configuration", "do_not_retry"),
    "206": error("FDC Omaha: merchant not on file", "configuration", "do_not_retry"),
    "207": error("FDC Omaha: merchant account closed", "configuration", "do_not_retry"),
    "208": error("FDC Omaha: merchant not on file", "configuration", "do_not_retry"),
    "209": error(
      "FDC Omaha: could not reach the processor",
      "network_or_timeout",
      "retry_conditionally",
    ),
    "210": error("FDC Omaha: merchant type incorrect", "configuration", "do_not_retry"),
    "211": error("FDC Omaha: cardholder not on file", "card_declined", "customer_action_required"),
    "212": error("FDC Omaha: bank configuration not on file", "configuration", "do_not_retry"),
    "213": error("FDC Omaha: merchant assessment code incorrect", "configuration", "do_not_retry"),
    "214": error(
      "FDC Omaha: function currently unavailable",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "215": error(
      "FDC Omaha: encrypted PIN field format invalid",
      "invalid_request",
      "do_not_retry",
    ),
    "216": error("FDC Omaha: ATM terminal ID invalid", "configuration", "do_not_retry"),
    "217": error("FDC Omaha: general message format problem", "invalid_request", "do_not_retry"),
    "218": error(
      "FDC Omaha: PIN block format or PIN availability invalid",
      "invalid_request",
      "do_not_retry",
    ),
    "219": error("FDC Omaha: ETC void unmatched", "invalid_request", "manual_review"),
    "220": error(
      "FDC Omaha: primary CPU not available",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "221": error("FDC Omaha: SE number invalid", "configuration", "do_not_retry"),
    "222": error("FDC Omaha: duplicate authorization request", "duplicate_request", "do_not_retry"),
    "223": error("FDC Omaha: unspecified error", "unknown", "manual_review"),
    "224": error(
      "FDC Omaha: re-enter the transaction",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "225": error("DCC action invalid", "invalid_request", "do_not_retry"),
    "226": error("DCC parameters incomplete", "invalid_request", "do_not_retry"),
    "227": error("Merchant not configured for DCC", "configuration", "do_not_retry"),
    "228": error("DCC not allowed for this transaction type", "invalid_request", "do_not_retry"),
    "229": info("A conversion rate is available for this card (informational)"),
    "230": error("Transaction could not be found (DCC context)", "invalid_request", "do_not_retry"),
    "231": error(
      "Data differs from the referenced DCC transaction",
      "invalid_request",
      "do_not_retry",
    ),
    "232": error("Merchant not configured for DCC", "configuration", "do_not_retry"),
    "233": error("DCC action not possible on this transaction", "invalid_request", "do_not_retry"),
    "234": error("Transaction already voided", "duplicate_request", "do_not_retry"),
    "235": error("Transaction already captured", "duplicate_request", "do_not_retry"),
    "236": error(
      "DCC data for the referenced transaction unavailable",
      "invalid_request",
      "do_not_retry",
    ),
    "237": error("Referenced transaction has expired", "invalid_request", "do_not_retry"),
    "238": error("Transaction version does not support DCC", "configuration", "do_not_retry"),
    "239": error("Response format does not support DCC", "configuration", "do_not_retry"),
    "240": error("DCC currency must be US dollars", "invalid_request", "do_not_retry"),
    "241": error(
      "Invalid response from the card processor",
      "provider_unavailable",
      "retry_conditionally",
    ),
    "242": error("Recurring flag not allowed with DCC", "invalid_request", "do_not_retry"),
    "243": error(
      "Recurring billing not allowed for this eCheck type",
      "invalid_request",
      "do_not_retry",
    ),
    "244": error(
      "eCheck type not allowed for this bank account type",
      "invalid_request",
      "do_not_retry",
    ),
    "245": error(
      "eCheck type not allowed on the hosted payment form",
      "invalid_request",
      "do_not_retry",
    ),
    "246": error(
      "eCheck type not enabled for the account (or check number sent for a type that does not use one)",
      "configuration",
      "do_not_retry",
    ),
    "247": error(
      "Transaction type and eCheck type combination not allowed",
      "invalid_request",
      "do_not_retry",
    ),
    "248": error(
      "Check number invalid (letters and digits, up to 15)",
      "invalid_request",
      "do_not_retry",
    ),
    "250": error("Declined: submitted from a blocked IP address", "fraud_or_risk", "do_not_retry"),
    "251": error("Declined by a Fraud Detection Suite filter", "fraud_or_risk", "do_not_retry"),
    "252": error(
      "Accepted but held for merchant review (not yet authorized)",
      "fraud_or_risk",
      "manual_review",
    ),
    "253": error(
      "Accepted, authorized, and held for merchant review",
      "fraud_or_risk",
      "manual_review",
    ),
    "254": error("Declined after manual review", "fraud_or_risk", "do_not_retry"),
    "260": error(
      "Reversal not supported for this transaction type (only authorizations and credits)",
      "invalid_request",
      "do_not_retry",
    ),
    "261": error(
      "Encryption error; not processed; try again",
      "provider_unavailable",
      "safe_to_retry_technical_request",
    ),
    "262": error("PayformMask invalid", "invalid_request", "do_not_retry"),
    "265": error("Solution ID invalid", "configuration", "do_not_retry"),
    "270": error("A line item is invalid", "invalid_request", "do_not_retry"),
    "271": error("Too many line items (maximum 30)", "invalid_request", "do_not_retry"),
    "280": error("Auction platform name invalid", "invalid_request", "do_not_retry"),
    "281": error("Auction platform ID invalid", "invalid_request", "do_not_retry"),
    "282": error("Auction listing type invalid", "invalid_request", "do_not_retry"),
    "283": error("Auction listing ID invalid", "invalid_request", "do_not_retry"),
    "284": error("Auction seller ID invalid", "invalid_request", "do_not_retry"),
    "285": error("Auction buyer ID invalid", "invalid_request", "do_not_retry"),
    "286": error("Required auction values missing", "invalid_request", "do_not_retry"),
    "287": error("Auction platform ID and name do not match", "invalid_request", "do_not_retry"),
    "288": error("Not accepted (no detail)", "unknown", "manual_review"),
    "289": error(
      "Processor does not accept zero-amount authorization for this card type",
      "configuration",
      "do_not_retry",
    ),
    "290": error("Required fields missing or invalid", "invalid_request", "do_not_retry"),
    "295": error(
      "Partially approved on a prepaid card; another payment needed for the balance",
      "insufficient_funds",
      "customer_action_required",
    ),
    "296": error("Split tender ID invalid", "invalid_request", "do_not_retry"),
    "297": error(
      "Transaction ID and split tender ID sent together",
      "invalid_request",
      "do_not_retry",
    ),
    "298": error(
      "Order already released or voided; no new associations",
      "invalid_request",
      "do_not_retry",
    ),
    "300": error("Device ID invalid", "invalid_request", "do_not_retry"),
    "301": error("Device batch ID invalid", "invalid_request", "do_not_retry"),
    "302": error("Reversal flag invalid", "invalid_request", "do_not_retry"),
    "303": error("Device batch full; close it on the device", "configuration", "manual_review"),
    "304": error(
      "Original is in a closed (settled) batch; cannot reverse",
      "invalid_request",
      "do_not_retry",
    ),
    "305": error(
      "Merchant on auto-close; batches cannot be closed manually",
      "configuration",
      "do_not_retry",
    ),
    "306": error("Batch already closed", "duplicate_request", "do_not_retry"),
    "307": success("Reversal processed successfully"),
    "308": error("Original transaction for reversal not found", "invalid_request", "do_not_retry"),
    "309": error("Device disabled", "configuration", "do_not_retry"),
    "310": error("Transaction already voided", "duplicate_request", "do_not_retry"),
    "311": error("Transaction already captured", "duplicate_request", "do_not_retry"),
    "312": error(
      "Security code (CAPTCHA) on the SIM form invalid",
      "invalid_request",
      "customer_action_required",
    ),
    "313": info("New security code requested on the SIM form", "customer_action_required"),
    "314": error("Cannot be processed (no detail)", "unknown", "manual_review"),
    "315": error(
      "Card number invalid (processor-issued decline)",
      "card_declined",
      "customer_action_required",
    ),
    "316": error(
      "Expiration date invalid (processor-issued decline)",
      "card_declined",
      "customer_action_required",
    ),
    "317": error(
      "Card expired (processor-issued decline)",
      "card_declined",
      "customer_action_required",
    ),
    "318": error(
      "Duplicate transaction (processor-issued decline)",
      "duplicate_request",
      "do_not_retry",
    ),
    "319": error(
      "Transaction not found (processor-issued decline)",
      "invalid_request",
      "do_not_retry",
    ),
    "320": error("Device not registered or not enabled", "configuration", "do_not_retry"),
    "325": error(
      "Required-field check failed (named processors need billing name and address)",
      "invalid_request",
      "do_not_retry",
    ),
    "326": error("Request fields invalid or missing", "invalid_request", "do_not_retry"),
    "327": error(
      "Void failed: type not voidable, or settlement in progress",
      "invalid_request",
      "retry_conditionally",
    ),
    "328": error("Validation error at the processor", "invalid_request", "do_not_retry"),
    "330": error(
      "V.me not accepted by the merchant",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    "331": error("x_call_id missing", "invalid_request", "do_not_retry"),
    "332": error("x_call_id not found or invalid", "invalid_request", "do_not_retry"),
    "333": error("V.me returned a validation error", "invalid_request", "do_not_retry"),
    "334": error("V.me transaction in an invalid state", "invalid_request", "do_not_retry"),
    "339": error(
      "Send x_method, or only x_call_id, or only card/account data",
      "invalid_request",
      "do_not_retry",
    ),
    "340": error(
      "V.me cannot void captured or credit transactions; refund after settlement",
      "invalid_request",
      "retry_conditionally",
    ),
    "341": error("x_discount invalid", "invalid_amount", "do_not_retry"),
    "342": error("x_giftwrap invalid", "invalid_amount", "do_not_retry"),
    "343": error("x_subtotal invalid", "invalid_amount", "do_not_retry"),
    "344": error("x_misc invalid", "invalid_amount", "do_not_retry"),
    "350": error(
      "Country must be a two- or three-character value",
      "invalid_request",
      "do_not_retry",
    ),
    "351": error("Employee ID length out of range", "invalid_request", "do_not_retry"),
    "355": error("EMV data could not be parsed", "invalid_request", "do_not_retry"),
    "356": error(
      "EMV not supported for this processor and card type",
      "payment_method_unavailable",
      "do_not_retry",
    ),
    "357": error("Opaque descriptor required", "invalid_request", "do_not_retry"),
    "358": error("EMV not supported with this transaction type", "invalid_request", "do_not_retry"),
    "359": error("EMV not supported with this market type", "invalid_request", "do_not_retry"),
    "360": error("EMV data could not be decrypted", "invalid_request", "manual_review"),
    "361": error("EMV version invalid", "invalid_request", "do_not_retry"),
    "362": error("EMV version required", "invalid_request", "do_not_retry"),
    "363": error("POS entry mode invalid", "invalid_request", "do_not_retry"),
    "370": error("Signature data too large", "invalid_request", "do_not_retry"),
    "371": error("Signature must be PNG data", "invalid_request", "do_not_retry"),
    "375": error("Terminal/lane number must be numeric", "invalid_request", "do_not_retry"),
    "380": error("KSN duplicated", "duplicate_request", "do_not_retry"),
    "901": error(
      "System maintenance; try later",
      "provider_unavailable",
      "safe_to_retry_technical_request",
    ),
    "2000": error(
      "PayPal: payer consent needed (redirect via secure acceptance URL)",
      "authentication_required",
      "customer_action_required",
    ),
    "2001": error(
      "PayPal not accepted by the merchant",
      "payment_method_unavailable",
      "do_not_retry",
    ),
    "2002": error("PayPal requires x_version 3.1 or later", "configuration", "do_not_retry"),
    "2003": success("Request completed successfully (PayPal)"),
    "2004": error("Success URL required", "invalid_request", "do_not_retry"),
    "2005": error("Cancel URL required", "invalid_request", "do_not_retry"),
    "2006": error("Payer ID required", "invalid_request", "do_not_retry"),
    "2007": error(
      "Processor does not accept zero-amount authorizations",
      "configuration",
      "do_not_retry",
    ),
    "2008": error(
      "Reference not eligible for a continued authorization",
      "invalid_request",
      "do_not_retry",
    ),
    "2009": error(
      "Reference not eligible for a continued authorization with auto capture",
      "invalid_request",
      "do_not_retry",
    ),
    "2100": error("PayPal success URL invalid", "invalid_request", "do_not_retry"),
    "2101": error("PayPal cancel URL invalid", "invalid_request", "do_not_retry"),
    "2102": error(
      "PayPal payment not authorized by the buyer",
      "authentication_required",
      "customer_action_required",
    ),
    "2103": error("Already authorized", "duplicate_request", "do_not_retry"),
    "2104": error(
      "Cart item totals do not match the order amount",
      "invalid_amount",
      "do_not_retry",
    ),
    "2105": error("PayPal rejected: Payer ID invalid", "invalid_request", "do_not_retry"),
    "2106": error("PayPal already captured this transaction", "duplicate_request", "do_not_retry"),
    "2107": error(
      "PayPal rejected: Payer ID belongs to another customer",
      "invalid_request",
      "do_not_retry",
    ),
    "2108": error(
      "PayPal rejected: header image value too long",
      "invalid_request",
      "do_not_retry",
    ),
    "2109": error(
      "PayPal rejected: color must be six hex characters",
      "invalid_request",
      "do_not_retry",
    ),
    "2200": error(
      "WePay merchants: capture amount must equal the authorized amount; void if needed",
      "invalid_amount",
      "do_not_retry",
    ),
    "2201": info("Record already deleted (same wording as I00003)"),
  },
  {
    "38": "The two response code files disagree: the reference list says Global Payment System identification numbers are incorrect, while the second file gives the currency text of code 39.",
    "103": "Documented as no longer in use.",
    "104":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "105":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "106":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "107":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "108":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "109":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "110":
      "The customer text says the transaction is under review, but the integration suggestions describe an eCheck field validation failure.",
    "2201":
      "Listed only in the second response code file used by the Response Code Tool, not in the reference list.",
  },
);

/**
 * Reason codes whose description says the automatic void after a rejection
 * also failed, so an authorization hold may remain on the card.
 */
export const FAILED_VOID_REASON_CODES: ReadonlySet<string> = new Set([
  "120",
  "121",
  "122",
  "127",
  "141",
  "145",
  "152",
  "165",
  "181",
]);

// ---------------------------------------------------------------------------
// transactionResponse.responseCode: 4 values

export type ResponseCodeInfo = {
  meaning: string;
  /** Outcome before the reason code is considered (3 depends on it). */
  outcome: Outcome;
  /** Used only when no reason code is present. */
  fallback?: CodeEntry;
};

export const RESPONSE_CODES: Readonly<Record<string, ResponseCodeInfo>> = {
  "1": { meaning: "Approved", outcome: "success" },
  "2": {
    meaning: "Declined",
    outcome: "failure",
    fallback: error("Declined", "card_declined", "customer_action_required"),
  },
  "3": {
    meaning: "Error",
    outcome: "unknown",
    fallback: error("Error", "unknown", "retry_conditionally"),
  },
  "4": {
    meaning: "Held for review",
    outcome: "pending",
    fallback: error("Held for review by a fraud filter", "fraud_or_risk", "manual_review"),
  },
};

/** API-level `messages.resultCode`. */
export const RESULT_CODES: Readonly<Record<string, string>> = {
  Ok: "The request was processed",
  Error: "The request failed or the transaction was not approved",
};

// ---------------------------------------------------------------------------
// AVS, card code and CAVV results

/** `avsResultCode` (API), `avsResponse` (webhooks): 13 values. Not errors by themselves. */
export const AVS_CODES: Readonly<Record<string, string>> = {
  A: "Street matched, postal code did not",
  B: "No address information provided",
  E: "AVS error",
  G: "Non-U.S. issuer, AVS not supported",
  N: "Neither street nor postal code matched",
  P: "AVS not applicable",
  R: "AVS unavailable or timed out; retry",
  S: "Issuer does not support AVS",
  U: "Address information unavailable",
  W: "ZIP+4 matched, street did not",
  X: "Street and ZIP+4 matched",
  Y: "Street and postal code matched",
  Z: "Postal code matched, street did not",
};

/** AVS results where the address or postal code did not match. */
export const AVS_NO_MATCH: ReadonlySet<string> = new Set(["A", "N", "W", "Z"]);

/** `cvvResultCode`: 5 values. */
export const CVV_CODES: Readonly<Record<string, string>> = {
  M: "Card code matched",
  N: "Card code did not match",
  P: "Card code not processed",
  S: "Card code should be on the card but was not indicated",
  U: "Issuer could not process the card code check",
};

/**
 * `cavvResultCode`: 12 values plus blank or absent (not validated). The
 * reference says Mastercard transactions always return a null CAVV result.
 */
export const CAVV_CODES: Readonly<Record<string, string>> = {
  "0": "CAVV not validated because of erroneous data",
  "1": "CAVV failed validation",
  "2": "CAVV passed validation",
  "3": "CAVV validation could not be performed; issuer attempt incomplete",
  "4": "CAVV validation could not be performed; issuer system error",
  "5": "Reserved for future use",
  "6": "Reserved for future use",
  "7": "CAVV failed validation, issuer available (U.S. card, non-U.S. acquirer)",
  "8": "CAVV passed validation, issuer available (U.S. card, non-U.S. acquirer)",
  "9": "CAVV failed validation, issuer unavailable (U.S. card, non-U.S. acquirer)",
  A: "CAVV passed validation, issuer unavailable (U.S. card, non-U.S. acquirer)",
  B: "CAVV passed validation, information only, no liability shift",
};

/** `accountType` values from the field table, plus PayPal from the examples. */
export const ACCOUNT_TYPES: ReadonlySet<string> = new Set([
  "Visa",
  "Mastercard",
  "MasterCard",
  "Discover",
  "AmericanExpress",
  "DinersClub",
  "JCB",
  "UnionChinaPay",
  "ChinaUnionPay",
  "eCheck",
  "PayPal",
]);

/** AFDS filter actions (`fraudList[].fraudAction`, `FDSFilterAction`). */
export const FRAUD_ACTIONS: Readonly<Record<string, string>> = {
  reject: "Rejected by the filter",
  decline: "Declined by the filter",
  hold: "Held for review without authorization",
  authAndHold: "Authorized and held for review",
  report: "Reported only",
};

// ---------------------------------------------------------------------------
// Transaction types and reporting statuses

/** `transactionType` (request side; createTransactionResponse does not echo it). */
export const TRANSACTION_TYPES: Readonly<Record<string, string>> = {
  authCaptureTransaction: "Authorize and queue for settlement in one step",
  authOnlyTransaction: "Authorize only; expires if not captured within 30 days",
  priorAuthCaptureTransaction: "Capture an earlier authorization",
  captureOnlyTransaction: "Capture with an authorization code obtained outside the gateway",
  voidTransaction: "Cancel an unsettled transaction",
  refundTransaction: "Credit a settled transaction",
  authOnlyContinueTransaction: "PayPal Express Checkout follow-up step",
  authCaptureContinueTransaction: "PayPal Express Checkout follow-up step",
  getDetailsTransaction: "PayPal Express Checkout follow-up step",
};

/**
 * `transactionStatus` of the reporting API: 18 values from the API reference
 * plus 6 that only the XSD lists (their meaning is not documented). Used only
 * to recognize transaction details records, which are not analyzed.
 */
export const TRANSACTION_STATUSES: ReadonlySet<string> = new Set([
  "authorizedPendingCapture",
  "capturedPendingSettlement",
  "communicationError",
  "refundSettledSuccessfully",
  "refundPendingSettlement",
  "approvedReview",
  "declined",
  "couldNotVoid",
  "expired",
  "generalError",
  "failedReview",
  "settledSuccessfully",
  "settlementError",
  "underReview",
  "voided",
  "FDSPendingReview",
  "FDSAuthorizedPendingReview",
  "returnedItem",
  "pendingFinalSettlement",
  "pendingSettlement",
  "updatingSettlement",
  "chargeback",
  "chargebackReversal",
  "authorizedPendingRelease",
]);

// ---------------------------------------------------------------------------
// Webhook event types: 23 from GET /rest/v1/eventtypes plus 6 partner boarding events

export type EventFamily = "payment" | "fraud" | "customer" | "paymentProfile" | "subscription";

export type EventInfo = {
  meaning: string;
  family: EventFamily;
  stage: LifecycleStage;
  /**
   * Outcome the event itself reports. For payment events `undefined` means
   * the payload's responseCode decides.
   */
  outcome?: Outcome;
};

const payment = (meaning: string, stage: LifecycleStage): EventInfo => ({
  meaning,
  family: "payment",
  stage,
});

export const WEBHOOK_EVENT_TYPES: Readonly<Record<string, EventInfo>> = {
  "net.authorize.payment.authorization.created": payment(
    "An authorization (authOnly) was created",
    "authorization",
  ),
  "net.authorize.payment.authcapture.created": payment(
    "An authorization and capture was created",
    "payment",
  ),
  "net.authorize.payment.capture.created": payment("A capture was created", "capture"),
  "net.authorize.payment.priorAuthCapture.created": payment(
    "An earlier authorization was captured",
    "capture",
  ),
  "net.authorize.payment.refund.created": payment("A settled transaction was refunded", "refund"),
  "net.authorize.payment.void.created": payment("An unsettled transaction was voided", "void"),
  "net.authorize.payment.fraud.held": {
    meaning: "Transaction held as suspicious",
    family: "fraud",
    stage: "payment",
    outcome: "pending",
  },
  "net.authorize.payment.fraud.approved": {
    meaning: "Held transaction approved",
    family: "fraud",
    stage: "payment",
    outcome: "success",
  },
  "net.authorize.payment.fraud.declined": {
    meaning: "Held transaction declined",
    family: "fraud",
    stage: "payment",
    outcome: "failure",
  },
  "net.authorize.customer.created": {
    meaning: "Customer profile created",
    family: "customer",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.updated": {
    meaning: "Customer profile updated",
    family: "customer",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.deleted": {
    meaning:
      "Customer profile deleted (deleting a profile does not send events for its sub-profiles)",
    family: "customer",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.paymentProfile.created": {
    meaning: "Payment profile created",
    family: "paymentProfile",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.paymentProfile.updated": {
    meaning: "Payment profile updated",
    family: "paymentProfile",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.paymentProfile.deleted": {
    meaning: "Payment profile deleted",
    family: "paymentProfile",
    stage: "other",
    outcome: "success",
  },
  "net.authorize.customer.subscription.created": {
    meaning: "Subscription created",
    family: "subscription",
    stage: "subscription",
    outcome: "success",
  },
  "net.authorize.customer.subscription.updated": {
    meaning: "Subscription updated",
    family: "subscription",
    stage: "subscription",
    outcome: "success",
  },
  "net.authorize.customer.subscription.suspended": {
    meaning:
      "Subscription suspended (documented causes: the first payment, or the first after an edit, failed, or the card expired)",
    family: "subscription",
    stage: "subscription",
    outcome: "failure",
  },
  "net.authorize.customer.subscription.terminated": {
    meaning:
      "Subscription terminated (a suspended subscription not fixed before its next run date; cannot be reactivated)",
    family: "subscription",
    stage: "subscription",
    outcome: "failure",
  },
  "net.authorize.customer.subscription.cancelled": {
    meaning: "Subscription cancelled (cannot be reactivated)",
    family: "subscription",
    stage: "cancellation",
    outcome: "success",
  },
  "net.authorize.customer.subscription.expiring": {
    meaning: "Subscription expiring (one charge left)",
    family: "subscription",
    stage: "subscription",
    outcome: "success",
  },
  "net.authorize.customer.subscription.expired": {
    meaning: "Subscription expired",
    family: "subscription",
    stage: "subscription",
    outcome: "success",
  },
  "net.authorize.customer.subscription.failed": {
    meaning: "Subscription failed (the documentation gives no further description)",
    family: "subscription",
    stage: "subscription",
    outcome: "failure",
  },
};

/**
 * Partner boarding events (gateway and merchant account boarding progress):
 * documented, out of scope, recognized by their prefix but not analyzed.
 */
export const BOARDING_EVENT_PREFIX = "net.authorize.partner.boarding.";

/** `payload.entityName` values shown in the webhook examples. */
export const ENTITY_NAMES: ReadonlySet<string> = new Set([
  "transaction",
  "customerProfile",
  "customerPaymentProfile",
  "subscription",
  "boardingApplication",
]);
