/**
 * PayU India code, status and stage knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/payu_india.md, which cites
 * PayU India's public documentation (docs.payu.in), verified 2026-10-25:
 *
 * Error codes, Field7 stages, issuer mapping: https://docs.payu.in/reference/error-codes
 * Payment states (unmappedstatus):            https://docs.payu.in/reference/payment-state-explanations
 * Payment response (_payment):                https://docs.payu.in/reference/_payment_payu_hosted_checkout
 * Payment webhooks:                           https://docs.payu.in/docs/webhook-events-and-sample-payloads
 * Verify Payment API:                         https://docs.payu.in/reference/verify_payment_api
 * Refund API and refund initiation codes:     https://docs.payu.in/reference/refund_transaction_api
 *                                             https://docs.payu.in/reference/error-codes-for-refund-initiation
 * Refund status codes:                        https://docs.payu.in/docs/error-codes-for-refunds-status
 *
 * The Error Codes page renders several of its tables from JSON files in a
 * GitHub assets repository; the research checked every code against those
 * files. Meanings are short paraphrases. Category and retry values are
 * PandaPayLens suggestions; where PayU gives advice, it is reflected.
 *
 * The page also has a UPI error table that disagrees with the main payment
 * table for 67 of its 210 rows (every code in it is also in the main table).
 * It is not used: codes are decoded from the main table only.
 *
 * Numeric code spaces overlap: refund initiation codes (100-502) are not
 * issuer response codes (0-99), and the pre-authorization capture table
 * reuses refund numbers with other meanings. A number is only decoded as a
 * refund code when the response belongs to a refund request.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.payu.in/docs";
const REF = "https://docs.payu.in/reference";

export const ERROR_CODES_URL = `${REF}/error-codes`;
export const PAYMENT_STATES_URL = `${REF}/payment-state-explanations`;
export const HOSTED_CHECKOUT_URL = `${REF}/_payment_payu_hosted_checkout`;
export const PAYMENT_API_PARAMETERS_URL = `${REF}/addl_info-payment-apis`;
export const VERIFY_PAYMENT_URL = `${REF}/verify_payment_api`;
export const CHECK_PAYMENT_URL = `${REF}/check_payment_api`;
export const REFUND_API_URL = `${REF}/refund_transaction_api`;
export const REFUND_INITIATION_CODES_URL = `${REF}/error-codes-for-refund-initiation`;
export const REFUND_STATUS_CODES_URL = `${DOCS}/error-codes-for-refunds-status`;
export const REFUND_CALLBACK_URL = `${REF}/refund-status-callback`;
export const CAPTURE_URL = `${REF}/capture_a_payment`;
export const CAPTURE_CODES_URL = `${REF}/error-codes-pre-authorize-payment`;
export const SETTLEMENT_URL = `${REF}/settlement_transaction_details_api`;
export const WEBHOOK_EVENTS_URL = `${DOCS}/webhook-events-and-sample-payloads`;
export const CHARGEBACK_WEBHOOK_URL = `${DOCS}/webhooks-for-chargeback`;
export const S2S_URL = `${REF}/_payment_s2s_classic_integration`;
export const TRANSACTION_DETAILS_URL = `${REF}/get_transaction_details_api`;
export const HASHING_URL = `${DOCS}/hashing-request-and-response`;
export const ERROR_HANDLING_URL = `${DOCS}/error-handling`;
export const CHECKOUT_GUIDE_URL = `${DOCS}/prebuilt-checkout-page-integration`;
export const UPI_COLLECT_URL = `${DOCS}/upi-collect-integration`;
export const GENERAL_FAQS_URL = `${DOCS}/general-faqs`;
export const PAYMENT_MODE_CODES_URL = `${DOCS}/payment-mode-codes`;
export const INTRODUCTION_URL = `${DOCS}/introduction`;
export const SITE = "https://payu.in";

export type CodeEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Success or informational value (for example E000 "No error"). */
  informational?: true;
  /** The same code has two or more rows with different texts. */
  conflict?: true;
  /** Listed only in a mapping table, without any meaning. */
  undocumented?: true;
};

function e(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  flags: { informational?: true; conflict?: true; undocumented?: true } = {},
): CodeEntry {
  return { meaning, category, retry, ...flags };
}

export type IssuerMapping = { payuCode: string; title: string };

export type Field7Kind = "positive" | "negative" | "error" | "pending" | "interim" | "auto_refund";

export type Field7Stage = {
  /** Platform layer / API layer as documented. */
  layer: string;
  meaning: string;
  /** Derived from the documented value name (POSITIVE, NEGATIVE, ERROR, PENDING). */
  kind: Field7Kind;
  /** Suggested category for negative and error values; null for the others. */
  category: ErrorCategory | null;
};

function f(
  layer: string,
  meaning: string,
  kind: Field7Kind,
  category: ErrorCategory | null,
): Field7Stage {
  return { layer, meaning, kind, category };
}

/**
 * Field7 values that the AuthN mapping table uses without describing them
 * anywhere. They are recognized as Field7 values but not interpreted.
 */
export const UNDESCRIBED_FIELD7_VALUES: readonly string[] = [
  "EVPOSITIVE",
  "EVNEGATIVE",
  "EVERROR",
  "3DS_VERIFICATION_NEGATIVE",
  "3DS_VERIFICATION_ERROR",
  "Get_cryptogram_failure",
  "PG_NOT_ACTIVATED",
];

// ---------------------------------------------------------------------------
// Payment status and state

export type PaymentStatusInfo = { meaning: string; outcome: Outcome };

/**
 * `status` of the payment response, payment webhook and Verify Payment
 * entries. Only `success` is successful; PayU says `failure` and `pending`
 * must be treated as not paid until verified. One parameter table lists
 * `failed` instead of `failure`; all samples use `failure`.
 */
export const PAYMENT_STATUSES: Readonly<Record<string, PaymentStatusInfo>> = {
  success: { meaning: "Payment successful", outcome: "success" },
  failure: { meaning: "Payment failed", outcome: "failure" },
  failed: {
    meaning: "Payment failed (spelling used by one parameter table)",
    outcome: "failure",
  },
  pending: {
    meaning: "Payment not complete; resolve it with the Verify Payment API or a later webhook",
    outcome: "pending",
  },
};

export type PaymentStateInfo = {
  /** Documented `status` for this `unmappedstatus`. */
  status: "success" | "failure" | "pending";
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
};

const state = (
  status: PaymentStateInfo["status"],
  meaning: string,
  stage: LifecycleStage,
  outcome: Outcome,
): PaymentStateInfo => ({ status, meaning, stage, outcome });

/**
 * `unmappedstatus` values (Payment State Explanations), keyed in lower case:
 * the parameter tables spell `usercancelled`, the state table and samples
 * `userCancelled`.
 */
export const PAYMENT_STATES: Readonly<Record<string, PaymentStateInfo>> = {
  initiated: state("pending", "Customer landed on the PayU page", "payment", "pending"),
  "in progress": state(
    "pending",
    "Customer clicked Pay and was routed to the 3-D Secure page",
    "payment",
    "pending",
  ),
  pending: state(
    "pending",
    "Payment started but not complete; it later moves to captured, failed, bounced or dropped",
    "payment",
    "pending",
  ),
  auth: state(
    "success",
    "Authorized and debited at the bank but not yet captured at PayU (pre-authorization)",
    "authorization",
    "success",
  ),
  captured: state("success", "Payment successful", "payment", "success"),
  usercancelled: state("failure", "Customer cancelled the payment", "payment", "failure"),
  bounced: state(
    "failure",
    "Customer did not complete the payment (for example never clicked Pay)",
    "payment",
    "failure",
  ),
  dropped: state("failure", "PayU got no response from the payment gateway", "payment", "failure"),
  failed: state(
    "failure",
    "Failed at the gateway, PayU, the issuer or authentication",
    "payment",
    "failure",
  ),
  autorefund: state(
    "failure",
    "PayU refunded a payment that turned out successful during reconciliation",
    "payment",
    "failure",
  ),
};

/** Payment modes (`mode`) named in the research (D/payment-mode-codes and samples). */
export const PAYMENT_MODES: Readonly<Record<string, string>> = {
  CC: "Credit card",
  DC: "Debit card",
  NB: "Net banking",
  UPI: "UPI",
  CASH: "Wallet",
  EMI: "EMI",
  BNPL: "Buy now, pay later",
  SBQR: "QR",
};

/**
 * Outcome of a refund request derived from the status word that the refund
 * initiation table gives for the code. Codes not listed here are failures.
 */
export const REFUND_CODE_STATES: Readonly<Record<string, Outcome>> = {
  "100": "success",
  "101": "pending",
  "102": "pending",
  "112": "pending",
  "122": "pending",
  "123": "pending",
  "126": "pending",
  "127": "pending",
  "225": "pending",
  "226": "pending",
  "248": "pending",
  "258": "pending",
  "259": "pending",
  "104": "unknown",
  "107": "unknown",
  "249": "unknown",
  "424": "unknown",
  "501": "unknown",
};

/**
 * `msg` values of the command API that the documentation shows. They are
 * matched without regard to case; anything else is shown as supplied.
 */
export const COMMAND_MESSAGES: Readonly<
  Record<string, { operation: "refund" | "capture" | "cancel" | null; accepted: boolean }>
> = {
  "refund request queued": { operation: "refund", accepted: true },
  "capture request queued": { operation: "capture", accepted: true },
  "cancel request queued": { operation: "cancel", accepted: true },
  "token is empty": { operation: null, accepted: false },
  "parameter missing": { operation: null, accepted: false },
  "transaction not exists": { operation: null, accepted: false },
  "merchant key is empty": { operation: null, accepted: false },
};

// ---------------------------------------------------------------------------
// Guidance texts

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their bank. Field8 and field9 carry the bank's own reason when PayU passes it on.",
  authentication_required:
    "Ask the customer to complete authentication (OTP, PIN or 3-D Secure) in a new payment attempt.",
  authentication_failed:
    "Ask the customer to complete authentication again in a new attempt, or to use another payment method.",
  invalid_request:
    "Correct the request parameters named by the code before sending a new request with a new txnid.",
  invalid_amount: "Check the amount, discount, convenience fee and the applicable limits.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another payment method or another bank or card.",
  fraud_or_risk:
    "Do not retry. Review the transaction and contact PayU support if you need details.",
  rate_limiting: "Wait before trying again and avoid automated repeated attempts.",
  provider_unavailable:
    "Check the payment with the Verify Payment API (verify_payment) or a later webhook before asking the customer to pay again.",
  network_or_timeout:
    "Check the payment with the Verify Payment API (verify_payment) or a later webhook before starting a new attempt.",
  duplicate_request:
    "Check whether the earlier request with the same txnid or refund token already succeeded.",
  configuration:
    "Check the PayU merchant configuration (key and salt, enabled payment options, gateway setup) with PayU support.",
  unknown:
    "Check the transaction with the Verify Payment API and in the PayU Dashboard, or contact PayU support.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Repeating the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another payment method, or contacting their bank).",
  retry_conditionally:
    "The condition may be temporary, but the original outcome may not be final. Verify the payment first; a new attempt needs a new txnid.",
  safe_to_retry_technical_request:
    "The request was rejected before anything was executed; it can be prepared and sent again.",
  manual_review:
    "The code does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this code.",
};

// ---------------------------------------------------------------------------
// Code tables (transcribed from the research tables; counts are in the tests)

/** Payment error codes (`error` / `error_code`), first table of the Error Codes page: 658 codes. */
export const PAYMENT_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  DEFAULT: e(
    "Fallback row: the bank could not authenticate the payer",
    "authentication_failed",
    "retry_conditionally",
  ),
  E000: e("No error; the transaction succeeded", "unknown", "unknown", { informational: true }),
  E199: e(
    "The card network did not return the 3DS results request (RReq)",
    "authentication_failed",
    "retry_conditionally",
  ),
  E201: e(
    "Card number missing or invalid (E305 is also described as an invalid issuer)",
    "invalid_request",
    "customer_action_required",
  ),
  E305: e(
    "Card number missing or invalid (E305 is also described as an invalid issuer)",
    "invalid_request",
    "customer_action_required",
  ),
  E202: e("Card authentication failed", "authentication_failed", "customer_action_required"),
  E213: e("Card authentication failed", "authentication_failed", "customer_action_required"),
  E306: e("Card authentication failed", "authentication_failed", "customer_action_required"),
  E205: e("Error on the bank's server", "provider_unavailable", "retry_conditionally"),
  E219: e("Error on the bank's server", "provider_unavailable", "retry_conditionally"),
  E206: e(
    "Bank servers closed for end-of-day cut-off processing",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E207: e("The bank refused the card transaction", "card_declined", "customer_action_required"),
  E208: e(
    "Bank server error; the request timed out on the bank side",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E209: e(
    "No response from the bank (a bank service did not finish)",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E210: e(
    "Authentication failed or the bank was slow; described as a communication timeout",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E211: e(
    "Bank servers not reachable over the network",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E214: e(
    "Bank servers not reachable over the network",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E215: e("Unspecified error", "unknown", "manual_review"),
  E216: e(
    "Batch processing error; the message text describes file-based batch uploads, so the meaning for a single payment is unclear",
    "unknown",
    "manual_review",
  ),
  E217: e(
    "The bank changed the merchant's terminal or plug-in profile and must issue a new resource file",
    "configuration",
    "manual_review",
  ),
  E220: e("Amount or transaction does not match", "invalid_amount", "do_not_retry"),
  E221: e("Bank response did not include the bank reference number", "unknown", "manual_review"),
  E222: e("Bank response did not include the debit account number", "unknown", "manual_review"),
  E223: e(
    "Not approved; the description says a decision manager (risk screening) rejected the order",
    "fraud_or_risk",
    "do_not_retry",
  ),
  E224: e(
    "Virtual account number mismatch (issuer table: no credit account)",
    "invalid_request",
    "customer_action_required",
  ),
  E225: e(
    "Transaction still in progress (issuer table: destination could not be routed)",
    "unknown",
    "retry_conditionally",
  ),
  E226: e("Security signature missing or mismatched", "configuration", "manual_review"),
  E227: e("Transaction pending", "unknown", "retry_conditionally"),
  E228: e("Transaction deferred", "unknown", "retry_conditionally"),
  E229: e(
    "EMI declined because no earlier EMI transaction exists",
    "invalid_request",
    "do_not_retry",
  ),
  E231: e("Transaction marked as dropped", "network_or_timeout", "retry_conditionally"),
  E232: e("Payer could not be authenticated", "authentication_failed", "customer_action_required"),
  E303: e("Payer could not be authenticated", "authentication_failed", "customer_action_required"),
  E317: e("Payer could not be authenticated", "authentication_failed", "customer_action_required"),
  E300: e("3D Secure signature check failed", "authentication_failed", "retry_conditionally"),
  E304: e(
    "Billing address does not match the issuer's records",
    "card_declined",
    "customer_action_required",
  ),
  E314: e(
    "Billing address does not match the issuer's records",
    "card_declined",
    "customer_action_required",
  ),
  E307: e(
    "Do not honour; a second row with the same code says a risk service denied the transaction",
    "card_declined",
    "do_not_retry",
    { conflict: true },
  ),
  E308: e("Failed at the bank (no detail)", "unknown", "retry_conditionally"),
  E309: e(
    "The bank refused the card transaction; the description cites a general system failure",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E310: e("Card reported lost and blocked (pick up card)", "card_declined", "do_not_retry"),
  E311: e("Expiry details invalid or card expired", "card_declined", "customer_action_required"),
  E312: e(
    "General decline of the card with no further reason",
    "card_declined",
    "customer_action_required",
  ),
  E313: e("CVV/CVC check failed at the bank", "card_declined", "customer_action_required"),
  E316: e(
    "3D Secure authentication declined by the bank",
    "authentication_failed",
    "customer_action_required",
  ),
  E323: e(
    "Authentication failed because of an invalid expiry date",
    "invalid_request",
    "customer_action_required",
  ),
  E324: e("Issuer suspects fraud (retain card)", "fraud_or_risk", "do_not_retry"),
  E325: e(
    "Card restricted or not enabled for online transactions",
    "card_declined",
    "customer_action_required",
  ),
  E326: e(
    "Authentication failed: wrong password",
    "authentication_failed",
    "customer_action_required",
  ),
  E327: e(
    "Authentication failed: wrong login",
    "authentication_failed",
    "customer_action_required",
  ),
  E329: e(
    "Issuer declined and has questions about the request",
    "card_declined",
    "customer_action_required",
  ),
  E330: e("Validation failure at the payment gateway", "invalid_request", "do_not_retry"),
  E331: e(
    "Authentication failed: invalid email address",
    "invalid_request",
    "customer_action_required",
  ),
  E332: e(
    "Authentication failed: invalid fax number",
    "invalid_request",
    "customer_action_required",
  ),
  E333: e(
    "Authentication failed: invalid phone or contact details",
    "invalid_request",
    "customer_action_required",
  ),
  E334: e("Authentication service not available", "provider_unavailable", "retry_conditionally"),
  E335: e(
    "Cardholder is enrolled for authentication but did not complete it",
    "authentication_required",
    "customer_action_required",
  ),
  E336: e(
    "Wrong expiry date and/or insufficient funds",
    "card_declined",
    "customer_action_required",
  ),
  E337: e(
    "Issuer declined; the description calls it a soft decline (title: not captured)",
    "card_declined",
    "retry_conditionally",
  ),
  E338: e(
    "One or more risk rules failed (description: denied parties list match)",
    "fraud_or_risk",
    "do_not_retry",
  ),
  E339: e("Invalid mobile number", "invalid_request", "customer_action_required"),
  E340: e("Invalid OTP", "authentication_failed", "customer_action_required"),
  E341: e("Invalid merchant", "configuration", "manual_review"),
  E342: e("Transaction was not initiated", "unknown", "retry_conditionally"),
  E343: e("Transaction not approved", "card_declined", "customer_action_required"),
  E344: e("Transaction failed (no detail)", "unknown", "manual_review"),
  E345: e(
    "Declined after a technical failure (description: re-enter transaction)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E346: e("Merchant not eligible for this transaction", "configuration", "manual_review"),
  E347: e("Request came from a domain that is not whitelisted", "configuration", "do_not_retry"),
  E348: e("Issuer says refer to card issuer", "card_declined", "customer_action_required"),
  E408: e(
    "Payment page expired because the customer gave no input",
    "authentication_required",
    "customer_action_required",
  ),
  E1610: e(
    "Payment page expired because the customer gave no input",
    "authentication_required",
    "customer_action_required",
  ),
  E500: e(
    "The bank could not authenticate the customer",
    "authentication_failed",
    "customer_action_required",
  ),
  E501: e("The bank was unable to authenticate", "authentication_failed", "retry_conditionally"),
  E502: e("Customer cancelled the transaction", "unknown", "customer_action_required"),
  E504: e("Duplicate transaction detected", "duplicate_request", "do_not_retry"),
  E507: e("Transaction expired", "unknown", "customer_action_required"),
  E600: e(
    "The bank refused the card; the description says the issuer declined authentication",
    "authentication_failed",
    "customer_action_required",
  ),
  E601: e(
    "Challan (payment slip) generation failed",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E700: e("Secure hash validation failed", "configuration", "do_not_retry"),
  E704: e(
    "Bank declined authorization because of its own internal error",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E705: e(
    "Declined because of user permissions set on the card",
    "card_declined",
    "customer_action_required",
  ),
  E706: e(
    "Insufficient funds or over the credit limit",
    "insufficient_funds",
    "customer_action_required",
  ),
  E707: e("Invalid primary account number (PAN)", "invalid_request", "customer_action_required"),
  E708: e("Too many wrong PIN attempts", "authentication_failed", "customer_action_required"),
  E709: e("Invalid name on card", "invalid_request", "customer_action_required"),
  E710: e("Invalid PIN", "authentication_failed", "customer_action_required"),
  E712: e("Request incomplete; one or more fields missing", "invalid_request", "do_not_retry"),
  E713: e(
    "Insufficient funds, or authentication failed because of an invalid expiry date",
    "insufficient_funds",
    "customer_action_required",
  ),
  E714: e("Authentication failed: invalid ZIP code", "invalid_request", "customer_action_required"),
  E715: e("Invalid amount sent to the bank", "invalid_amount", "do_not_retry"),
  E717: e("Bank reports the account as closed", "card_declined", "customer_action_required"),
  E719: e(
    "Card authentication failure and/or insufficient funds",
    "card_declined",
    "customer_action_required",
  ),
  E800: e("Error on the merchant's side", "configuration", "manual_review"),
  E801: e(
    "Net banking option temporarily unavailable; transaction set to bounced",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E802: e(
    "Issuing bank temporarily unavailable; transaction set to bounced",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E803: e("Payment gateway appears to be down", "provider_unavailable", "retry_conditionally"),
  E804: e("Payment gateway appears to be down", "provider_unavailable", "retry_conditionally"),
  E805: e(
    "Customer's LazyPay account is blocked",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E806: e(
    "Customer opted out of LazyPay",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E807: e(
    "Customer not registered for LazyPay",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E902: e(
    "Invalid card number; description says the card type is not accepted by the processor",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E903: e(
    "International cards not accepted",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E908: e(
    "International cards not accepted",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E905: e("Declined (no detail)", "card_declined", "customer_action_required"),
  E907: e("Wrong payment method selected", "invalid_request", "customer_action_required"),
  E909: e(
    "Amount exceeds the account's withdrawal limit",
    "card_declined",
    "customer_action_required",
  ),
  E910: e(
    "EMI not supported on this card",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E914: e(
    "Acquirer rejected the request (invalid request or request data)",
    "invalid_request",
    "do_not_retry",
  ),
  E915: e(
    "Acquirer rejected the request (invalid request or request data)",
    "invalid_request",
    "do_not_retry",
  ),
  E916: e("Invalid merchant configuration at the acquirer", "configuration", "manual_review"),
  E917: e("Card authentication failure", "authentication_failed", "customer_action_required"),
  E1000: e("3D Secure authentication failed", "authentication_failed", "customer_action_required"),
  E1001: e("Bank network unavailable", "provider_unavailable", "retry_conditionally"),
  E1002: e(
    "Authentication was attempted but was not available at the bank",
    "authentication_failed",
    "retry_conditionally",
  ),
  E1003: e(
    "Card not enabled for e-commerce (newly issued or not used online for 12 months); description: authentication not attempted",
    "card_declined",
    "customer_action_required",
  ),
  E1020: e("The merchant-generated transaction ID is not valid", "invalid_request", "do_not_retry"),
  E1101: e("Merchant sent invalid parameters", "invalid_request", "do_not_retry"),
  E1201: e(
    "Customer not authorized for this transaction",
    "card_declined",
    "customer_action_required",
  ),
  E1202: e(
    "Third-party funds transfer and secure access not enabled on the account",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1203: e(
    "Third-party transfer limit exceeded (daily or per transaction)",
    "card_declined",
    "customer_action_required",
  ),
  E1204: e("Failed at the bank (no detail)", "unknown", "retry_conditionally"),
  E1206: e("Customer pressed the back button", "unknown", "customer_action_required"),
  E1208: e("Insufficient funds or wrong expiry date", "card_declined", "customer_action_required"),
  E1210: e(
    "Credit card used on a debit card gateway",
    "invalid_request",
    "customer_action_required",
  ),
  E1300: e("Customer pressed refresh during payment", "unknown", "customer_action_required"),
  E1301: e(
    "EMI not applicable to this transaction",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1302: e(
    "3D Secure enrolment declined by the bank",
    "authentication_failed",
    "customer_action_required",
  ),
  E1303: e(
    "Declined because of a technical failure",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E1400: e(
    "Invalid data from the bank; description says the card verification number did not match",
    "card_declined",
    "customer_action_required",
  ),
  E1500: e("Retry not allowed", "duplicate_request", "do_not_retry"),
  E1501: e("Amount below the issuer's EMI minimum", "invalid_amount", "customer_action_required"),
  E1502: e(
    "Incorrect standing-instruction request (credit card in drop category)",
    "invalid_request",
    "do_not_retry",
  ),
  E1505: e("Insufficient credit limit", "insufficient_funds", "customer_action_required"),
  E1601: e("Wrong OTP", "authentication_failed", "customer_action_required"),
  E1602: e(
    "ATM PIN page expired without customer input",
    "authentication_required",
    "customer_action_required",
  ),
  E1603: e(
    "Mobile number not registered for the card",
    "authentication_failed",
    "customer_action_required",
  ),
  E1604: e("Incorrect user action", "unknown", "customer_action_required"),
  E1605: e("Customer pressed cancel", "unknown", "customer_action_required"),
  E1606: e("Customer pressed refresh", "unknown", "customer_action_required"),
  E1607: e("Customer pressed back", "unknown", "customer_action_required"),
  E1608: e("Unable to process the request", "unknown", "retry_conditionally"),
  E1609: e(
    "Registered mobile number is international; a domestic number is needed",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1611: e(
    "Set to user-cancelled after being left orphaned during SurePay",
    "unknown",
    "customer_action_required",
  ),
  E1613: e("User cancelled during SurePay", "unknown", "customer_action_required"),
  E1615: e("S2S request without txn_s2s_flow", "invalid_request", "do_not_retry"),
  E1616: e("Non-seamless flow not allowed in S2S", "configuration", "do_not_retry"),
  E1617: e("Internal server error in the S2S flow", "provider_unavailable", "retry_conditionally"),
  E1618: e("No form post variables found (S2S)", "invalid_request", "do_not_retry"),
  E1619: e("Category or ibibo code not received", "invalid_request", "do_not_retry"),
  E1620: e(
    "Payment method enforced and a different method was selected",
    "invalid_request",
    "customer_action_required",
  ),
  E1621: e("Merchant has no access to the S2S flow", "configuration", "manual_review"),
  E1622: e("S2S not enabled on the selected gateway", "configuration", "manual_review"),
  E1623: e(
    "Wrong ATM PIN; description says a PINless debit frequency or amount limit was reached",
    "authentication_failed",
    "customer_action_required",
  ),
  E1624: e(
    "No eligible authentication option is active",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1625: e(
    "Card not enabled for e-commerce (issuer table: invalid or nonexistent account)",
    "card_declined",
    "customer_action_required",
  ),
  E1626: e("Restricted card", "card_declined", "customer_action_required"),
  E1627: e(
    "Daily limit of wrong ATM PIN attempts reached",
    "authentication_failed",
    "customer_action_required",
  ),
  E1628: e(
    "Daily limit exceeded (description: credit limit reached)",
    "card_declined",
    "customer_action_required",
  ),
  E1629: e(
    "Technical failure at the bank (contact issuer)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E1630: e(
    "Invalid bank ME code; description says a limit is exhausted",
    "configuration",
    "manual_review",
  ),
  E1631: e(
    "Merchant validation failed; description says the merchant limit is reached",
    "configuration",
    "manual_review",
  ),
  E1632: e(
    "Wrong CVV or expiry, or card validation failed",
    "card_declined",
    "customer_action_required",
  ),
  E1633: e("Separate authentication failed", "authentication_failed", "customer_action_required"),
  E1634: e(
    "Unique constraint failure reported by the bank",
    "provider_unavailable",
    "manual_review",
  ),
  E1635: e("Broker failure reported by the bank", "provider_unavailable", "retry_conditionally"),
  E1636: e("Transaction timed out", "network_or_timeout", "retry_conditionally"),
  E1637: e("Merchant type not supported", "configuration", "manual_review"),
  E1638: e("Already reversed or settled", "duplicate_request", "do_not_retry"),
  E1639: e("Host down", "provider_unavailable", "retry_conditionally"),
  E1640: e(
    "Off-us Mastercard transaction not approved",
    "card_declined",
    "customer_action_required",
  ),
  E1641: e("Cancellation not allowed for off-us Mastercard", "invalid_request", "do_not_retry"),
  E1642: e(
    "Transaction not permitted to the cardholder or issuer",
    "card_declined",
    "customer_action_required",
  ),
  E1643: e("ME code not permitted", "configuration", "manual_review"),
  E1644: e("Empty OTP received", "authentication_failed", "customer_action_required"),
  E1645: e("Failed during authentication", "authentication_failed", "customer_action_required"),
  E1646: e("Invalid PayU ID", "invalid_request", "do_not_retry"),
  E1647: e("Invalid merchant key", "configuration", "do_not_retry"),
  E1648: e("Partial amount approved", "unknown", "manual_review", { informational: true }),
  E1649: e("VIP approval", "unknown", "manual_review", { informational: true }),
  E1650: e("No action taken", "unknown", "manual_review"),
  E1651: e("Retrieval reference number mismatch", "unknown", "manual_review"),
  E1652: e("Card blocked", "card_declined", "customer_action_required"),
  E1653: e("Card issuer unavailable", "provider_unavailable", "retry_conditionally"),
  E1654: e("Route to merchant unavailable", "provider_unavailable", "retry_conditionally"),
  E1655: e(
    "Could not complete because of a legal or compliance violation",
    "fraud_or_risk",
    "do_not_retry",
  ),
  E1656: e("Reconcile error", "unknown", "manual_review"),
  E1657: e("Surcharge amount not permitted", "invalid_amount", "do_not_retry"),
  E1658: e("Service not available", "provider_unavailable", "retry_conditionally"),
  E1659: e(
    "Error connecting to an encryption utility (Blaze Net)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E1660: e(
    "MCP lookup call failed after the S2S response was sent",
    "provider_unavailable",
    "manual_review",
  ),
  E1661: e(
    "ATM PIN daily limit exceeded; use OTP or another method",
    "authentication_failed",
    "customer_action_required",
  ),
  E1662: e(
    "ATM PIN monthly limit exceeded; use OTP or another method",
    "authentication_failed",
    "customer_action_required",
  ),
  E1663: e("Send-OTP call failed", "provider_unavailable", "retry_conditionally"),
  E1664: e(
    "Card blocked by the issuer for online use",
    "card_declined",
    "customer_action_required",
  ),
  E1665: e("Incorrect one-click request", "invalid_request", "do_not_retry"),
  E1666: e(
    "One-click-only request failed in authentication",
    "authentication_failed",
    "customer_action_required",
  ),
  E1667: e("One-click-only request failed data validation", "invalid_request", "do_not_retry"),
  E1668: e("No gateway found for a one-click transaction", "configuration", "manual_review"),
  E1669: e("MCP lookup details were tampered with", "fraud_or_risk", "do_not_retry"),
  E1670: e(
    "CVV/CVC check failed; description says security violation",
    "card_declined",
    "customer_action_required",
  ),
  E1700: e("Term URL missing in the request", "invalid_request", "do_not_retry"),
  E1701: e("Invalid payment ID (request ID invalid)", "invalid_request", "do_not_retry"),
  E1702: e("Invalid action", "invalid_request", "do_not_retry"),
  E1703: e("Auth data mismatch", "invalid_request", "do_not_retry"),
  E1800: e(
    "Discount exceeds the allowed limit; any debited amount is refunded automatically",
    "invalid_amount",
    "do_not_retry",
  ),
  E1900: e(
    "UPI intent could not be opened; switched to collect",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1901: e("Customer chose UPI collect instead of intent", "unknown", "customer_action_required"),
  E1902: e(
    "VPA blank (validation failed or merchant did not send it)",
    "invalid_request",
    "customer_action_required",
  ),
  E1903: e("Authorization failed at the bank", "card_declined", "customer_action_required"),
  E1905: e("Internal processing error", "provider_unavailable", "retry_conditionally"),
  E1906: e("Error starting a PhonePe payment", "provider_unavailable", "retry_conditionally"),
  E1907: e(
    "Status cannot be fetched right now; customer told to check with the merchant",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E1908: e(
    "BIN not supported for pure S2S",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E1909: e(
    "Error while processing an enstage request",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E1910: e(
    "Authentication failed or invalid PaRes received",
    "authentication_failed",
    "customer_action_required",
  ),
  E1911: e(
    "Customer entered a wrong VPA too many times",
    "rate_limiting",
    "customer_action_required",
  ),
  E2081: e("Invalid device ID", "invalid_request", "do_not_retry"),
  E2100: e(
    "Invalid request; one or more fields contain invalid data",
    "invalid_request",
    "do_not_retry",
  ),
  E2101: e("Offer not applicable", "invalid_request", "customer_action_required"),
  E2102: e("Not approved; format error", "invalid_request", "do_not_retry"),
  E2110: e(
    "Unable to process; invalid response from an upstream server",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E2111: e(
    "Technical issue at the issuer or acquirer; general decline by the processor",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E2201: e(
    "Split request sent for a merchant that is not an aggregator",
    "configuration",
    "do_not_retry",
  ),
  E2202: e("Invalid split in the transaction request", "invalid_request", "do_not_retry"),
  E2401: e(
    "Customer not eligible for this transaction",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E2402: e(
    "Customer has no active credit line for a consumer loan",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E2403: e(
    "Customer KYC pending at the issuer",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E2404: e("OTP validation failed", "authentication_failed", "customer_action_required"),
  E2405: e(
    "Customer not eligible for the selected tenure",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E2406: e("Too many wrong OTP attempts", "authentication_failed", "customer_action_required"),
  E2407: e("User details missing", "invalid_request", "do_not_retry"),
  E2408: e(
    "Not eligible for Link and Pay",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E2409: e("Amount above the issuer's EMI maximum", "invalid_amount", "customer_action_required"),
  E2502: e(
    "Could not parse the bank's ACS page for native OTP",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E2503: e(
    "OTP submitted too late (headless flow)",
    "authentication_failed",
    "customer_action_required",
  ),
  E4001: e(
    "Issuer bank not live on UPI (description: low confidence)",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4002: e("No action taken (full reversal)", "unknown", "manual_review"),
  E4003: e("Partial reversal", "unknown", "manual_review"),
  E4004: e("Remitter declined on risk score or suspected fraud", "fraud_or_risk", "do_not_retry"),
  E4005: e("Customer has not set a UPI MPIN", "authentication_failed", "customer_action_required"),
  E4006: e("Payee missing", "invalid_request", "do_not_retry"),
  E4007: e("Payee missing", "invalid_request", "do_not_retry"),
  E4008: e(
    "Payee address must be a valid VPA (max 255 characters)",
    "invalid_request",
    "do_not_retry",
  ),
  E4009: e(
    "Mobile number linked to the account has changed",
    "authentication_failed",
    "customer_action_required",
  ),
  E4010: e(
    "Transaction not allowed on or from the account",
    "card_declined",
    "customer_action_required",
  ),
  E4011: e("Payment details mismatch", "invalid_request", "do_not_retry"),
  E4012: e(
    "Mobile number registered with several customer IDs",
    "card_declined",
    "customer_action_required",
  ),
  E4013: e("Beneficiary timeout", "network_or_timeout", "retry_conditionally"),
  E4014: e("Compliance error for the acquirer", "configuration", "manual_review"),
  E4015: e("Compliance error for the issuer", "card_declined", "manual_review"),
  E4016: e("Currency not supported", "invalid_request", "do_not_retry"),
  E4017: e(
    "Payer or payee device information or device tags missing",
    "invalid_request",
    "do_not_retry",
  ),
  E4018: e(
    "Payer or payee device information or device tags missing",
    "invalid_request",
    "do_not_retry",
  ),
  E4019: e("Duplicate RRN (beneficiary side / remitter side)", "duplicate_request", "do_not_retry"),
  E4020: e("Duplicate RRN (beneficiary side / remitter side)", "duplicate_request", "do_not_retry"),
  E4021: e(
    "First-transaction limit exceeded for a new customer",
    "card_declined",
    "customer_action_required",
  ),
  E4022: e(
    "Cooling (freeze) period for a first-time customer",
    "card_declined",
    "customer_action_required",
  ),
  E4023: e("Certificate not found", "configuration", "manual_review"),
  E4024: e("Signature error or mismatch", "configuration", "manual_review"),
  E4025: e("Signature error or mismatch", "configuration", "manual_review"),
  E4026: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4028: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4029: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4030: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4031: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4032: e(
    "Payer or payee info element (identity, type, verified name, rating) missing or malformed",
    "invalid_request",
    "do_not_retry",
  ),
  E4027: e("Remitter bank HSM down", "provider_unavailable", "retry_conditionally"),
  E4033: e("Duplicate block-fund request for a mandate", "duplicate_request", "do_not_retry"),
  E4034: e(
    "Revoke sent after the remitter already unblocked the amount",
    "invalid_request",
    "do_not_retry",
  ),
  E4035: e("Debit amount is not blocked for the customer", "invalid_request", "do_not_retry"),
  E4036: e("Debit amount greater than the blocked amount", "invalid_amount", "do_not_retry"),
  E4037: e(
    "Funds are blocked for a mandate, so not enough is available",
    "insufficient_funds",
    "customer_action_required",
  ),
  E4038: e(
    "PSP or bank does not support UPI version 2",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4039: e(
    "PSP or bank does not support UPI version 2",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4040: e(
    "International service not activated or disabled",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4041: e(
    "Internal exception at the customer's bank server or core banking system",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4042: e("Invalid verification token", "invalid_request", "do_not_retry"),
  E4044: e(
    "Credit processing problem in the acquiring bank's pool account",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4045: e(
    "Processing problem in a bank pool account (debit on the customer side; description says credit from pool account)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4046: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4047: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4048: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4049: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4050: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4051: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4052: e(
    "Payer or payee amount or currency inconsistent, invalid or missing",
    "invalid_amount",
    "do_not_retry",
  ),
  E4053: e("Mandate not present", "invalid_request", "do_not_retry"),
  E4054: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4055: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4056: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4057: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4058: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4059: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4060: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4061: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4062: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4063: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4064: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4065: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4066: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4067: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4068: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4069: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4070: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4071: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4072: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4073: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4074: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4075: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4076: e(
    "Mandate request field validation failed (name, UMN, transaction ID, timestamp, revocable flag, validity dates, amount rule, recurrence pattern or rule, purpose-code rules, global address, UMN generated by payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4077: e("Payee (merchant) declined the mandate request", "configuration", "manual_review"),
  E4078: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4079: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4080: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4081: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4082: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4083: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4084: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4085: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4086: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4087: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4098: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4099: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4100: e("A mandate field differs from the original request", "invalid_request", "do_not_retry"),
  E4088: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4089: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4090: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4091: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4092: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4093: e(
    "Purpose code 01 rules violated (block fund, amount update, recurrence, amount rule, share to payee)",
    "invalid_request",
    "do_not_retry",
  ),
  E4094: e(
    "PSP or bank does not support mandate version 2.1",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4095: e(
    "PSP or bank does not support mandate version 2.1",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4096: e(
    "PSP or bank does not support mandate version 2.1",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4097: e(
    "PSP or bank does not support mandate version 2.1",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4101: e(
    "Technical issue at the issuer or acquirer",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4102: e(
    "Customer was not notified of the transaction in advance",
    "configuration",
    "manual_review",
  ),
  E4103: e("Payment validity expired", "unknown", "customer_action_required"),
  E4104: e(
    "Maximum balance set by the beneficiary bank exceeded",
    "card_declined",
    "customer_action_required",
  ),
  E4105: e("Recurring sequence mismatch", "invalid_request", "do_not_retry"),
  E4106: e("Recurrence pattern, value and amount rule mismatch", "invalid_request", "do_not_retry"),
  E4107: e(
    "Blocking of funds not allowed for a recurring mandate",
    "invalid_request",
    "do_not_retry",
  ),
  E4108: e("Mandate paused by the user", "card_declined", "customer_action_required"),
  E4109: e("Mandate already honoured", "duplicate_request", "do_not_retry"),
  E4110: e("Mandate revoked by the user", "card_declined", "customer_action_required"),
  E4111: e("Mandate expired", "card_declined", "customer_action_required"),
  E4112: e("Mandate amount differs from the transaction amount", "invalid_amount", "do_not_retry"),
  E4113: e("Payee details in the mandate are wrong", "invalid_request", "do_not_retry"),
  E4114: e("UMN not found at the customer's side", "invalid_request", "do_not_retry"),
  E4115: e("Mandate request limit breached", "rate_limiting", "customer_action_required"),
  E4116: e(
    "Mandate amount higher than the customer's app allows",
    "invalid_amount",
    "customer_action_required",
  ),
  E4117: e("Payer details in the mandate are wrong", "invalid_request", "do_not_retry"),
  E4118: e("Duplicate mandate request", "duplicate_request", "do_not_retry"),
  E4119: e("Revoke not allowed for this mandate", "invalid_request", "do_not_retry"),
  E4120: e("Merchant may not modify a payer-initiated mandate", "invalid_request", "do_not_retry"),
  E4121: e("Mandate creation not allowed for this merchant", "configuration", "manual_review"),
  E4122: e("Execution day and execution rule mismatch", "invalid_request", "do_not_retry"),
  E4124: e("Customer declined the modification request", "unknown", "customer_action_required"),
  E4125: e("Customer account has changed", "card_declined", "customer_action_required"),
  E4127: e("Payee is not a merchant", "configuration", "manual_review"),
  E4128: e("UMN not found at the acquiring bank", "invalid_request", "manual_review"),
  E4130: e("Payer may not modify a merchant-initiated mandate", "invalid_request", "do_not_retry"),
  E4131: e("Merchant declined the modification request", "configuration", "manual_review"),
  E4132: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4133: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4134: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4135: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4136: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4137: e(
    "Payer element missing or malformed (address, name, sequence number, type, code)",
    "invalid_request",
    "do_not_retry",
  ),
  E4138: e("Payer and payee accounts are the same", "invalid_request", "do_not_retry"),
  E4140: e("Declined by the bank", "card_declined", "customer_action_required"),
  E4141: e(
    "Partial debit request timed out at the customer's bank",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4142: e("Debit timed out at the customer's bank", "network_or_timeout", "retry_conditionally"),
  E4143: e("Customer reported the merchant as spam", "fraud_or_risk", "do_not_retry"),
  E4146: e("Not allowed from an overdraft account", "card_declined", "customer_action_required"),
  E4147: e("Customer not active on UPI", "payment_method_unavailable", "customer_action_required"),
  E4148: e("Wrong ATM PIN", "authentication_failed", "customer_action_required"),
  E4149: e("Customer has blocked the merchant", "card_declined", "do_not_retry"),
  E4150: e("Duplicate request", "duplicate_request", "do_not_retry"),
  E4151: e("Merchant amount limit exceeded", "configuration", "manual_review"),
  E4152: e("Customer debit limit exceeded", "card_declined", "customer_action_required"),
  E4153: e("Request not found", "unknown", "manual_review"),
  E4154: e("Message not properly formed", "invalid_request", "do_not_retry"),
  E4155: e("Transaction ID mismatch (validation error)", "invalid_request", "do_not_retry"),
  E4156: e("Validation error", "invalid_request", "do_not_retry"),
  E4373: e("Validation error", "invalid_request", "do_not_retry"),
  E4157: e("System exception", "provider_unavailable", "retry_conditionally"),
  E4158: e(
    "Timeout at the acquirer (issuer unavailable or switch inoperative)",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4159: e("Illegal operation", "invalid_request", "do_not_retry"),
  E4160: e("Credentials not present", "invalid_request", "do_not_retry"),
  E4161: e("Amount or currency mismatch", "invalid_amount", "do_not_retry"),
  E4164: e("Checksum failed", "configuration", "manual_review"),
  E4166: e(
    "UPI handle not registered (PSP not registered)",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4167: e(
    "Authorization acknowledgement not received",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4168: e("Customer declined the transaction", "unknown", "customer_action_required"),
  E4170: e("Request authorization not found", "unknown", "manual_review"),
  E4171: e("Collect-money request declined", "unknown", "customer_action_required"),
  E4172: e(
    "Collect-money request timed out or not acknowledged",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4173: e(
    "Collect-money request timed out or not acknowledged",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4174: e("Collect-money URL not found", "configuration", "manual_review"),
  E4175: e(
    "PSP credit-pay acknowledgement not received",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4176: e(
    "No response from the merchant or customer",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4177: e(
    "Debit failed because of a technical issue at the customer's bank",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4178: e(
    "Technical error in the customer's app (description: encryption error)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4179: e("Debit from the customer's account failed", "card_declined", "customer_action_required"),
  E4180: e(
    "Credit failed because of a technical issue at the acquirer's bank",
    "provider_unavailable",
    "manual_review",
  ),
  E4181: e("Credit reversal failed at the acquirer", "provider_unavailable", "manual_review"),
  E4182: e(
    "Debit reversal failed in the customer's account",
    "provider_unavailable",
    "manual_review",
  ),
  E4183: e("Reverted", "unknown", "manual_review"),
  E4184: e(
    "Message-state duplicates: response or request already sent or received, reversal already sent, or transaction already failed",
    "duplicate_request",
    "do_not_retry",
  ),
  E4185: e(
    "Message-state duplicates: response or request already sent or received, reversal already sent, or transaction already failed",
    "duplicate_request",
    "do_not_retry",
  ),
  E4186: e(
    "Message-state duplicates: response or request already sent or received, reversal already sent, or transaction already failed",
    "duplicate_request",
    "do_not_retry",
  ),
  E4187: e(
    "Message-state duplicates: response or request already sent or received, reversal already sent, or transaction already failed",
    "duplicate_request",
    "do_not_retry",
  ),
  E4188: e(
    "Message-state duplicates: response or request already sent or received, reversal already sent, or transaction already failed",
    "duplicate_request",
    "do_not_retry",
  ),
  E4189: e(
    "IMPS leg failed, signed off, already processed or declined",
    "provider_unavailable",
    "manual_review",
  ),
  E4190: e(
    "IMPS leg failed, signed off, already processed or declined",
    "provider_unavailable",
    "manual_review",
  ),
  E4191: e(
    "IMPS leg failed, signed off, already processed or declined",
    "provider_unavailable",
    "manual_review",
  ),
  E4192: e(
    "IMPS leg failed, signed off, already processed or declined",
    "provider_unavailable",
    "manual_review",
  ),
  E4193: e(
    "Form signed off, or form processing failed in UPI",
    "provider_unavailable",
    "manual_review",
  ),
  E4194: e(
    "Form signed off, or form processing failed in UPI",
    "provider_unavailable",
    "manual_review",
  ),
  E4195: e("Credit, debit or refund request not found", "unknown", "manual_review"),
  E4196: e("Credit, debit or refund request not found", "unknown", "manual_review"),
  E4200: e("Credit, debit or refund request not found", "unknown", "manual_review"),
  E4197: e("Original transaction not found during status check", "unknown", "manual_review"),
  E4198: e("Request message ID missing", "invalid_request", "do_not_retry"),
  E4199: e("IFSC missing", "invalid_request", "do_not_retry"),
  E4201: e("PSP org ID not found", "configuration", "manual_review"),
  E4202: e(
    "PSP pay-debit acknowledgement not received",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4204: e(
    "Message integrity failed because of an org ID mismatch",
    "configuration",
    "manual_review",
  ),
  E4205: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4206: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4207: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4208: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4209: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4210: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4211: e(
    "Payee count, payee amount, payee address or payer info differs from the original request",
    "invalid_request",
    "do_not_retry",
  ),
  E4212: e(
    "UPI device registration failed or its data was malformed",
    "invalid_request",
    "customer_action_required",
  ),
  E4213: e(
    "UPI device registration failed or its data was malformed",
    "invalid_request",
    "customer_action_required",
  ),
  E4214: e(
    "UPI device registration failed or its data was malformed",
    "invalid_request",
    "customer_action_required",
  ),
  E4218: e("Collect request expired", "unknown", "customer_action_required"),
  E4219: e("Late response received", "network_or_timeout", "manual_review"),
  E4381: e("Late response received", "network_or_timeout", "manual_review"),
  E4220: e("Merchant credit not supported in IMPS", "payment_method_unavailable", "do_not_retry"),
  E4221: e("VAE step failed (the acronym is not expanded in the docs)", "unknown", "manual_review"),
  E4222: e("Payer account mismatch", "invalid_request", "do_not_retry"),
  E4223: e("Payee account mismatch", "invalid_request", "do_not_retry"),
  E4224: e(
    "Mobile banking registration format not supported by the issuer",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4225: e("Merchant is blocked", "configuration", "manual_review"),
  E4227: e("UIDAI (Aadhaar) failure", "provider_unavailable", "retry_conditionally"),
  E4232: e("Account type (overdraft) not supported", "card_declined", "customer_action_required"),
  E4242: e("Payee Aadhaar or IIN VPA disabled", "payment_method_unavailable", "do_not_retry"),
  E4244: e("Payee Aadhaar or IIN VPA disabled", "payment_method_unavailable", "do_not_retry"),
  E4247: e(
    "Null or negative acknowledgement received for a meta transaction",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4248: e(
    "Null or negative acknowledgement received for a meta transaction",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4249: e("PSP not supported by UPI", "payment_method_unavailable", "manual_review"),
  E4250: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4251: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4252: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4253: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4254: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4255: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4256: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4257: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4258: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4260: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4261: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4262: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4263: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4264: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4265: e(
    "UPI version mismatch or unsupported version/tags at a PSP, remitter bank or beneficiary bank",
    "configuration",
    "manual_review",
  ),
  E4259: e(
    "Internal exception at the acquirer bank's server or core banking system",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4267: e("Activation response timed out", "network_or_timeout", "retry_conditionally"),
  E4268: e("ValQR response timed out", "network_or_timeout", "retry_conditionally"),
  E4269: e("Forex error in ValQR", "provider_unavailable", "manual_review"),
  E4271: e("Customer declined the mandate request", "unknown", "customer_action_required"),
  E4272: e("Timeout at the issuer or acquirer", "network_or_timeout", "retry_conditionally"),
  E4273: e("Mandate request expired", "unknown", "customer_action_required"),
  E4274: e(
    "Negative acknowledgement in mandate messaging",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4275: e(
    "Negative acknowledgement in mandate messaging",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4280: e(
    "Negative acknowledgement in mandate messaging",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4281: e(
    "Negative acknowledgement in mandate messaging",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4276: e("Original mandate request not found", "unknown", "manual_review"),
  E4282: e("Original mandate request not found", "unknown", "manual_review"),
  E4277: e("Mandate acknowledgement not received", "network_or_timeout", "retry_conditionally"),
  E4283: e("Mandate acknowledgement not received", "network_or_timeout", "retry_conditionally"),
  E4284: e("Mandate acknowledgement not received", "network_or_timeout", "retry_conditionally"),
  E4278: e(
    "Mandate setup failed at the customer's bank",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4279: e("Timeout at the customer's bank or issuer", "network_or_timeout", "retry_conditionally"),
  E4292: e("Timeout at the customer's bank or issuer", "network_or_timeout", "retry_conditionally"),
  E4294: e("Timeout at the customer's bank or issuer", "network_or_timeout", "retry_conditionally"),
  E4285: e("Payer or payee PSP not available", "provider_unavailable", "retry_conditionally"),
  E4286: e("Payer or payee PSP not available", "provider_unavailable", "retry_conditionally"),
  E4288: e("Payer or payee PSP not registered", "configuration", "manual_review"),
  E4289: e("Payer or payee PSP not registered", "configuration", "manual_review"),
  E4290: e(
    "Mandate not supported by the customer's bank",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4291: e(
    "Mandate not supported by the acquirer's bank",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4293: e("Mandate amount limit exceeded", "invalid_amount", "customer_action_required"),
  E4295: e(
    "VPA invalid or expired (payer profile does not exist)",
    "invalid_request",
    "customer_action_required",
  ),
  E4298: e("PIN credential block missing", "invalid_request", "do_not_retry"),
  E4299: e("PIN credential block missing", "invalid_request", "do_not_retry"),
  E4301: e("A recurring mandate must be revocable", "invalid_request", "do_not_retry"),
  E4309: e("Mandate signature tampered with", "fraud_or_risk", "do_not_retry"),
  E4312: e(
    "Number of mandates allowed on the account exceeded",
    "rate_limiting",
    "customer_action_required",
  ),
  E4313: e(
    "Mandate registration not allowed for this account type (bank policy)",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4314: e("Debit not allowed", "card_declined", "customer_action_required"),
  E4315: e("Payment stopped by a court or attachment order", "card_declined", "do_not_retry"),
  E4326: e("Payment stopped by a court or attachment order", "card_declined", "do_not_retry"),
  E4316: e(
    "Withdrawals stopped on the account (holder deceased, insolvent or legally incapacitated)",
    "card_declined",
    "do_not_retry",
  ),
  E4317: e(
    "Withdrawals stopped on the account (holder deceased, insolvent or legally incapacitated)",
    "card_declined",
    "do_not_retry",
  ),
  E4318: e(
    "Withdrawals stopped on the account (holder deceased, insolvent or legally incapacitated)",
    "card_declined",
    "do_not_retry",
  ),
  E4319: e("Duplicate mandate request for the same item", "duplicate_request", "do_not_retry"),
  E4325: e("Merchant VPA is not correct", "configuration", "manual_review"),
  E4327: e(
    "Recurrence rule tag sent to a bank or PSP not certified for UPI version 2.7",
    "configuration",
    "manual_review",
  ),
  E4328: e(
    "Recurrence rule tag sent to a bank or PSP not certified for UPI version 2.7",
    "configuration",
    "manual_review",
  ),
  E4329: e(
    "Recurrence rule tag sent to a bank or PSP not certified for UPI version 2.7",
    "configuration",
    "manual_review",
  ),
  E4330: e(
    "Recurrence rule tag sent to a bank or PSP not certified for UPI version 2.7",
    "configuration",
    "manual_review",
  ),
  E4332: e("Invalid merchant (acquirer)", "configuration", "manual_review"),
  E4333: e("Merchant not reachable (acquirer)", "provider_unavailable", "retry_conditionally"),
  E4336: e("Invalid amount (remitter side / beneficiary side)", "invalid_amount", "do_not_retry"),
  E4337: e("Invalid amount (remitter side / beneficiary side)", "invalid_amount", "do_not_retry"),
  E4338: e("Format error (remitter side / beneficiary side)", "invalid_request", "do_not_retry"),
  E4339: e("Format error (remitter side / beneficiary side)", "invalid_request", "do_not_retry"),
  E4340: e(
    "Account details not found at the customer's bank",
    "card_declined",
    "customer_action_required",
  ),
  E4341: e("Account details not found at the acquirer's bank", "configuration", "manual_review"),
  E4342: e(
    "Requested function not supported (remitter side / beneficiary side)",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  E4343: e(
    "Requested function not supported (remitter side / beneficiary side)",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  E4346: e("No card details from the customer's bank", "card_declined", "customer_action_required"),
  E4347: e("No card details from the acquirer's bank", "provider_unavailable", "manual_review"),
  E4348: e(
    "Transaction not permitted to the cardholder (remitter)",
    "card_declined",
    "customer_action_required",
  ),
  E4352: e(
    "Core banking cut-off at the customer's bank",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4353: e("Core banking cut-off at the acquirer", "provider_unavailable", "retry_conditionally"),
  E4356: e("No financial address record found", "invalid_request", "customer_action_required"),
  E4357: e(
    "Customer's bank core banking system offline",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4358: e(
    "Acquirer bank's core banking system offline",
    "provider_unavailable",
    "retry_conditionally",
  ),
  E4359: e("Lost or stolen card reported by the customer's bank", "card_declined", "do_not_retry"),
  E4360: e("Lost or stolen card reported by the acquirer's bank", "card_declined", "do_not_retry"),
  E4363: e("Customer's account blocked or frozen", "card_declined", "customer_action_required"),
  E4364: e("Acquirer-side account blocked or frozen", "configuration", "manual_review"),
  E4365: e("Merchant error", "configuration", "manual_review"),
  E4367: e("Invalid response code", "provider_unavailable", "manual_review"),
  E4368: e("Invalid beneficiary credentials", "configuration", "manual_review"),
  E4369: e(
    "Transaction frequency limit set by the remitter bank exceeded",
    "rate_limiting",
    "customer_action_required",
  ),
  E4371: e("Invalid merchant details", "configuration", "manual_review"),
  E4374: e(
    "Customer's app does not allow transactions on this VPA",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4375: e(
    "Transaction not permitted on this device",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4378: e("Beneficiary bank declined on risk score", "fraud_or_risk", "do_not_retry"),
  E4382: e(
    "Function not yet available for the merchant through the acquiring bank",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4383: e(
    "Function not yet available for the customer through the payee PSP",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4384: e(
    "Bank as beneficiary not live for this transaction type",
    "payment_method_unavailable",
    "manual_review",
  ),
  E4385: e("Unable to process reversal", "provider_unavailable", "manual_review"),
  E4386: e("Invalid or incorrect OTP", "authentication_failed", "customer_action_required"),
  E4390: e("Invalid or incorrect OTP", "authentication_failed", "customer_action_required"),
  E4387: e("OTP expired", "authentication_failed", "customer_action_required"),
  E4388: e("OTP transaction limit exceeded", "rate_limiting", "customer_action_required"),
  E4389: e(
    "Limit exceeded for the remitting or issuing bank",
    "card_declined",
    "customer_action_required",
  ),
  E4391: e("Customer's account inactive or dormant", "card_declined", "customer_action_required"),
  E4392: e("Acquirer-side account inactive or dormant", "configuration", "manual_review"),
  E4511: e("Collect-by date is earlier than the current date", "invalid_request", "do_not_retry"),
  E4512: e("Transaction details not present at the bank", "unknown", "manual_review"),
  E4516: e(
    "Refund failed: original transaction details not valid (description: already processed, online duplicate)",
    "duplicate_request",
    "manual_review",
  ),
  E4517: e("Offline refund request already raised", "duplicate_request", "do_not_retry"),
  E4519: e(
    "Refund failed: insufficient amount (the issuer table maps response code 86, cannot verify PIN, to this code)",
    "invalid_amount",
    "manual_review",
  ),
  E4520: e("Online refund not enabled for the merchant", "configuration", "manual_review"),
  E4521: e("Invalid MCC details", "configuration", "manual_review"),
  E4522: e(
    "Refund failed: no response from the customer's bank",
    "network_or_timeout",
    "retry_conditionally",
  ),
  E4525: e("Multiple transactions found in status check", "unknown", "manual_review"),
  E4526: e("Transaction not found in status check", "unknown", "manual_review"),
  E4527: e("Refund failed: invalid amount", "invalid_amount", "do_not_retry"),
  E4530: e("Mandate start date earlier than today", "invalid_request", "do_not_retry"),
  E4531: e("Mandate end date earlier than start date", "invalid_request", "do_not_retry"),
  E4532: e("Mandate request not created", "unknown", "manual_review"),
  E4533: e("No active mandates found", "invalid_request", "do_not_retry"),
  E4535: e("Amount mismatch", "invalid_amount", "do_not_retry"),
  E4536: e("Execution amount higher than the mandate amount", "invalid_amount", "do_not_retry"),
  E4605: e("Request processed successfully", "unknown", "unknown", { informational: true }),
  E4607: e("Mandate request approved", "unknown", "unknown", { informational: true }),
  E4608: e("Request timed out", "network_or_timeout", "retry_conditionally"),
  E4649: e("Ref URL missing or badly formatted", "invalid_request", "do_not_retry"),
  E4658: e("PSP not found or not configured", "configuration", "manual_review"),
  E4666: e(
    "Merchant account details not found or not configured",
    "configuration",
    "manual_review",
  ),
  E4679: e("Modification request already initiated", "duplicate_request", "do_not_retry"),
  E4680: e("No mandate data found to modify", "invalid_request", "do_not_retry"),
  E4682: e("Recurring payment in progress", "unknown", "retry_conditionally"),
  E4683: e("Recurring payment already completed", "duplicate_request", "do_not_retry"),
  E4684: e(
    "VPA not available for transactions",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E4685: e("VPA available for transactions (positive result)", "unknown", "unknown", {
    informational: true,
  }),
  E4803: e("Failed at the bank (no detail)", "unknown", "retry_conditionally"),
  E4888: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4890: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4891: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4892: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4897: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4900: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4903: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4904: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4907: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4909: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4910: e("Generic failure; the table gives no further detail", "unknown", "manual_review"),
  E4930: e("Refund cannot be processed", "unknown", "manual_review"),
  E4931: e(
    "Transaction is in a state shown only as the template placeholder value",
    "unknown",
    "manual_review",
  ),
  E4933: e("NPCI general error", "provider_unavailable", "retry_conditionally"),
  E4934: e("Invalid BIN (BIN not found)", "invalid_request", "customer_action_required"),
  E4935: e("Card token cryptogram missing", "invalid_request", "do_not_retry"),
  E9202: e("Partial amount approved", "unknown", "manual_review", { informational: true }),
  E9203: e(
    "Approved VIP / approved with track 3 update (both marked as not used)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  E9204: e(
    "Approved VIP / approved with track 3 update (both marked as not used)",
    "unknown",
    "unknown",
    { informational: true },
  ),
  E9205: e("Customer cancellation", "unknown", "customer_action_required"),
  E9206: e("Customer dispute", "unknown", "manual_review"),
  E9207: e("No action taken", "unknown", "manual_review"),
  E9208: e("Suspected malfunction", "provider_unavailable", "retry_conditionally"),
  E9209: e("Unacceptable transaction fee", "invalid_amount", "do_not_retry"),
  E9210: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9211: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9212: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9213: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9214: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9215: e(
    "Network file-update responses (not supported, record not found, duplicate, field edit error, file locked out, not successful)",
    "unknown",
    "manual_review",
  ),
  E9216: e("Completed partially", "unknown", "manual_review"),
  E9217: e("Allowed PIN tries exceeded", "authentication_failed", "customer_action_required"),
  E9218: e("Requested function not supported", "payment_method_unavailable", "do_not_retry"),
  E9219: e(
    "Card acceptor must call the acquirer's security department",
    "fraud_or_risk",
    "manual_review",
  ),
  E9220: e("Response received too late", "network_or_timeout", "retry_conditionally"),
  E9221: e(
    "Mobile number record not found or mismatched",
    "authentication_failed",
    "customer_action_required",
  ),
  E9222: e("Approved (marked ANZ only)", "unknown", "unknown", { informational: true }),
  E9223: e("Cryptographic error", "provider_unavailable", "retry_conditionally"),
  E9224: e(
    "ATM-style responses: no envelope inserted, unable to dispense",
    "unknown",
    "manual_review",
  ),
  E9225: e(
    "ATM-style responses: no envelope inserted, unable to dispense",
    "unknown",
    "manual_review",
  ),
  E9226: e("Terminal ID not present on the host", "configuration", "manual_review"),
  E9227: e("Cut-off in progress", "provider_unavailable", "retry_conditionally"),
  E9229: e("Reconciliation totals reset", "unknown", "manual_review"),
  E9230: e("Exceeds cash limit", "card_declined", "customer_action_required"),
  E9231: e("Reserved for national use", "unknown", "manual_review"),
  E9232: e("Compliance error for the issuer", "card_declined", "manual_review"),
  E9233: e(
    "Issuer failed ARQC, TVR or CVR validation (chip data)",
    "card_declined",
    "manual_review",
  ),
  E9234: e(
    "Issuer failed ARQC, TVR or CVR validation (chip data)",
    "card_declined",
    "manual_review",
  ),
  E9235: e(
    "Issuer failed ARQC, TVR or CVR validation (chip data)",
    "card_declined",
    "manual_review",
  ),
  E9236: e("E-commerce decline", "card_declined", "customer_action_required"),
  E9237: e("Merchant daily limit exceeded", "configuration", "manual_review"),
  E9238: e("Card re-use limit exceeded", "rate_limiting", "customer_action_required"),
  E9239: e(
    "International acceptance not enabled",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  E9240: e("Unable to authorise", "card_declined", "customer_action_required"),
  E9241: e(
    "Refund limits reached (offline refunds, refund credit amount, number of refund credits)",
    "configuration",
    "manual_review",
  ),
  E9242: e(
    "Refund limits reached (offline refunds, refund credit amount, number of refund credits)",
    "configuration",
    "manual_review",
  ),
  E9243: e(
    "Refund limits reached (offline refunds, refund credit amount, number of refund credits)",
    "configuration",
    "manual_review",
  ),
  E9244: e("PIN required", "authentication_required", "customer_action_required"),
  E9245: e("Force post", "unknown", "manual_review"),
  E9246: e("Over daily limit", "card_declined", "customer_action_required"),
  E9247: e("Card not supported", "payment_method_unavailable", "customer_action_required"),
  E9248: e(
    "Declined by the issuing bank (description: CAF status 0 or 9)",
    "card_declined",
    "customer_action_required",
  ),
  E9249: e("Cash back exceeds daily limit", "card_declined", "customer_action_required"),
  E9250: e("Offline approved", "unknown", "manual_review", { informational: true }),
  E9251: e(
    "Two rows: bank settlement limit exceeded, or payer PSP throttle decline (address resolution failed)",
    "rate_limiting",
    "retry_conditionally",
    { conflict: true },
  ),
  E9252: e(
    "Two rows: account type not valid for this card (no universal account), or PSP meta acknowledgement not received",
    "card_declined",
    "manual_review",
    { conflict: true },
  ),
  E9253: e("Amount incorrect or mismatched", "invalid_amount", "do_not_retry"),
  E9254: e(
    "Two rows: issuer or switch inoperative or not supported, or acquirer/beneficiary unavailable (timeout)",
    "provider_unavailable",
    "retry_conditionally",
    { conflict: true },
  ),
  EA08: e(
    "Alt ID provisioning failed (incorrect card details)",
    "invalid_request",
    "customer_action_required",
  ),
  EA09: e(
    "Alt ID provisioning failed (merchant not onboarded; the Alt ID table says invalid merchant ID configuration)",
    "configuration",
    "manual_review",
  ),
  EX311: e("Transaction failed (no detail)", "unknown", "manual_review"),
};

/** "Other Error Codes from PayU" (`EX...`): 201 codes, mostly internal platform errors. */
export const OTHER_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  EX000: e(
    "Row with an empty message; the title is GRAND_TOTAL. Not a usable error",
    "unknown",
    "unknown",
  ),
  EX001: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX002: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX003: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX004: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX005: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX006: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX007: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX008: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX009: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX010: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX135: e(
    "Internal database layer errors (connection settings, table name, where clause, data types, row and column count)",
    "provider_unavailable",
    "manual_review",
  ),
  EX011: e("Cross-site request forgery detected", "fraud_or_risk", "do_not_retry"),
  EX012: e("Key is null", "invalid_request", "do_not_retry"),
  EX013: e("Insufficient input", "invalid_request", "do_not_retry"),
  EX014: e("Merchant key not supplied", "invalid_request", "do_not_retry"),
  EX015: e(
    "Merchant payment type or gateway configuration incomplete or invalid",
    "configuration",
    "manual_review",
  ),
  EX016: e(
    "Merchant payment type or gateway configuration incomplete or invalid",
    "configuration",
    "manual_review",
  ),
  EX017: e(
    "Merchant payment type or gateway configuration incomplete or invalid",
    "configuration",
    "manual_review",
  ),
  EX018: e(
    "Merchant payment type or gateway configuration incomplete or invalid",
    "configuration",
    "manual_review",
  ),
  EX019: e(
    "Transaction lock could not be obtained, or lock ID empty on unlock",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX024: e(
    "Transaction lock could not be obtained, or lock ID empty on unlock",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX020: e(
    "Inconsistent transaction status in the database",
    "provider_unavailable",
    "manual_review",
  ),
  EX021: e("Merchant risk category missing", "configuration", "manual_review"),
  EX022: e("PayU ID not attached to the transaction", "provider_unavailable", "manual_review"),
  EX023: e("Verifier hash mismatch", "configuration", "manual_review"),
  EX025: e("Merchant not found, or invalid merchant identifier", "configuration", "manual_review"),
  EX097: e("Merchant not found, or invalid merchant identifier", "configuration", "manual_review"),
  EX026: e(
    "Transaction could not be reinitiated (empty base transaction, invalid status or empty previous transaction ID)",
    "invalid_request",
    "do_not_retry",
  ),
  EX027: e(
    "Transaction could not be reinitiated (empty base transaction, invalid status or empty previous transaction ID)",
    "invalid_request",
    "do_not_retry",
  ),
  EX028: e("Invalid attempt", "invalid_request", "do_not_retry"),
  EX029: e("Invalid user identifier", "invalid_request", "do_not_retry"),
  EX030: e("Invalid vendor identifier", "invalid_request", "do_not_retry"),
  EX031: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX032: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX033: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX034: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX035: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX036: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX037: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX038: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX092: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX093: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX104: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX105: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX106: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX107: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX122: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX130: e(
    "Bulk file errors (cancel, refund, capture, reconciliation, upload, reporting, refund reference upload): invalid or empty file, or mandatory column missing",
    "invalid_request",
    "do_not_retry",
  ),
  EX039: e(
    "Reconciliation setup incomplete (transaction, ibibo codes, card BIN map or email template not set)",
    "configuration",
    "manual_review",
  ),
  EX134: e(
    "Reconciliation setup incomplete (transaction, ibibo codes, card BIN map or email template not set)",
    "configuration",
    "manual_review",
  ),
  EX137: e(
    "Reconciliation setup incomplete (transaction, ibibo codes, card BIN map or email template not set)",
    "configuration",
    "manual_review",
  ),
  EX139: e(
    "Reconciliation setup incomplete (transaction, ibibo codes, card BIN map or email template not set)",
    "configuration",
    "manual_review",
  ),
  EX040: e(
    "No privilege, or requested file missing or not accessible",
    "configuration",
    "manual_review",
  ),
  EX041: e(
    "No privilege, or requested file missing or not accessible",
    "configuration",
    "manual_review",
  ),
  EX042: e("Invalid invoice ID", "invalid_request", "do_not_retry"),
  EX043: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX044: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX045: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX046: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX047: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX048: e(
    "Could not read a data source or spreadsheet file",
    "provider_unavailable",
    "manual_review",
  ),
  EX049: e(
    "Dashboard edit-form errors (keys, values, form unavailable)",
    "invalid_request",
    "do_not_retry",
  ),
  EX050: e(
    "Dashboard edit-form errors (keys, values, form unavailable)",
    "invalid_request",
    "do_not_retry",
  ),
  EX051: e(
    "Dashboard edit-form errors (keys, values, form unavailable)",
    "invalid_request",
    "do_not_retry",
  ),
  EX121: e(
    "Dashboard edit-form errors (keys, values, form unavailable)",
    "invalid_request",
    "do_not_retry",
  ),
  EX052: e(
    "Transaction ID missing or invalid in the gateway response",
    "provider_unavailable",
    "manual_review",
  ),
  EX053: e(
    "Transaction ID missing or invalid in the gateway response",
    "provider_unavailable",
    "manual_review",
  ),
  EX054: e(
    "Errors in the 'paisa' request flow (base merchant or PayU ID not posted, invalid paisa merchant, add-payment call failed, wrong additional charge)",
    "provider_unavailable",
    "manual_review",
  ),
  EX055: e(
    "Errors in the 'paisa' request flow (base merchant or PayU ID not posted, invalid paisa merchant, add-payment call failed, wrong additional charge)",
    "provider_unavailable",
    "manual_review",
  ),
  EX056: e(
    "Errors in the 'paisa' request flow (base merchant or PayU ID not posted, invalid paisa merchant, add-payment call failed, wrong additional charge)",
    "provider_unavailable",
    "manual_review",
  ),
  EX062: e(
    "Errors in the 'paisa' request flow (base merchant or PayU ID not posted, invalid paisa merchant, add-payment call failed, wrong additional charge)",
    "provider_unavailable",
    "manual_review",
  ),
  EX111: e(
    "Errors in the 'paisa' request flow (base merchant or PayU ID not posted, invalid paisa merchant, add-payment call failed, wrong additional charge)",
    "provider_unavailable",
    "manual_review",
  ),
  EX057: e("Not implemented", "unknown", "manual_review"),
  EX058: e(
    "Object could not be saved (identifiers, table name or identifier value missing)",
    "provider_unavailable",
    "manual_review",
  ),
  EX059: e(
    "Object could not be saved (identifiers, table name or identifier value missing)",
    "provider_unavailable",
    "manual_review",
  ),
  EX060: e(
    "Object could not be saved (identifiers, table name or identifier value missing)",
    "provider_unavailable",
    "manual_review",
  ),
  EX061: e("Protocol mismatch", "invalid_request", "do_not_retry"),
  EX063: e(
    "Invalid state: transaction still in progress during cancel",
    "invalid_request",
    "retry_conditionally",
  ),
  EX064: e(
    "Internal routing errors (missing forward action, app unavailable, action class, reload failure, redirection loop)",
    "provider_unavailable",
    "manual_review",
  ),
  EX065: e(
    "Internal routing errors (missing forward action, app unavailable, action class, reload failure, redirection loop)",
    "provider_unavailable",
    "manual_review",
  ),
  EX066: e(
    "Internal routing errors (missing forward action, app unavailable, action class, reload failure, redirection loop)",
    "provider_unavailable",
    "manual_review",
  ),
  EX067: e(
    "Internal routing errors (missing forward action, app unavailable, action class, reload failure, redirection loop)",
    "provider_unavailable",
    "manual_review",
  ),
  EX145: e(
    "Internal routing errors (missing forward action, app unavailable, action class, reload failure, redirection loop)",
    "provider_unavailable",
    "manual_review",
  ),
  EX068: e("Admin viewer fields not specified", "provider_unavailable", "manual_review"),
  EX069: e("A required request parameter is not set", "invalid_request", "do_not_retry"),
  EX070: e("A required request parameter is not set", "invalid_request", "do_not_retry"),
  EX071: e("Device database (WURFL) errors", "provider_unavailable", "manual_review"),
  EX072: e("Device database (WURFL) errors", "provider_unavailable", "manual_review"),
  EX073: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX074: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX075: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX076: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX077: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX078: e("Spreadsheet write or save failures", "provider_unavailable", "manual_review"),
  EX079: e(
    "Database exceptions (master, replica, concurrency, other)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX142: e(
    "Database exceptions (master, replica, concurrency, other)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX143: e(
    "Database exceptions (master, replica, concurrency, other)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX144: e(
    "Database exceptions (master, replica, concurrency, other)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX080: e("Remote or local file transfer failures", "provider_unavailable", "manual_review"),
  EX081: e("Remote or local file transfer failures", "provider_unavailable", "manual_review"),
  EX082: e("Remote or local file transfer failures", "provider_unavailable", "manual_review"),
  EX083: e("A passed parameter is blank", "invalid_request", "do_not_retry"),
  EX084: e("Return URI not received", "invalid_request", "do_not_retry"),
  EX085: e("Verifier PayU ID not received", "invalid_request", "do_not_retry"),
  EX086: e("Card BIN not present", "invalid_request", "do_not_retry"),
  EX087: e("Hash (checksum) calculated incorrectly", "configuration", "do_not_retry"),
  EX088: e("Merchant registration limit per hour exceeded", "rate_limiting", "retry_conditionally"),
  EX089: e("Token mismatch", "invalid_request", "do_not_retry"),
  EX090: e("PayU ID or token missing", "invalid_request", "do_not_retry"),
  EX091: e("Invalid page request", "invalid_request", "do_not_retry"),
  EX094: e("Vendor details not saved", "provider_unavailable", "manual_review"),
  EX095: e("Value must be a non-zero integer number of days", "invalid_request", "do_not_retry"),
  EX096: e("Undefined reconciliation action requested", "invalid_request", "do_not_retry"),
  EX098: e(
    "Gateway key administration: parameters missing or invalid merchant ID",
    "configuration",
    "manual_review",
  ),
  EX099: e(
    "Gateway key administration: parameters missing or invalid merchant ID",
    "configuration",
    "manual_review",
  ),
  EX100: e(
    "Gateway key administration: parameters missing or invalid merchant ID",
    "configuration",
    "manual_review",
  ),
  EX101: e(
    "Gateway key administration: parameters missing or invalid merchant ID",
    "configuration",
    "manual_review",
  ),
  EX102: e(
    "Gateway key administration: parameters missing or invalid merchant ID",
    "configuration",
    "manual_review",
  ),
  EX103: e(
    "Mapped and unmapped status of a PayU ID do not match",
    "provider_unavailable",
    "manual_review",
  ),
  EX108: e(
    "Duplicate txnid (used before or already captured)",
    "duplicate_request",
    "do_not_retry",
  ),
  EX109: e("Wallet mode override (informational)", "unknown", "unknown"),
  EX110: e("File upload failed", "provider_unavailable", "manual_review"),
  EX112: e("Invalid request for a PayU ID", "invalid_request", "do_not_retry"),
  EX113: e("Invalid transaction (access token mismatch)", "invalid_request", "do_not_retry"),
  EX114: e("Merchant key missing in the request", "invalid_request", "do_not_retry"),
  EX115: e("Merchant key is inactive", "configuration", "manual_review"),
  EX116: e("Transaction expired", "unknown", "customer_action_required"),
  EX125: e("Transaction expired", "unknown", "customer_action_required"),
  EX117: e("Invalid amount", "invalid_amount", "do_not_retry"),
  EX118: e("Invalid transaction", "invalid_request", "do_not_retry"),
  EX119: e("Card details invalid", "invalid_request", "customer_action_required"),
  EX120: e("Invalid additional amount", "invalid_amount", "do_not_retry"),
  EX123: e("Mandatory parameter payuId missing", "invalid_request", "do_not_retry"),
  EX124: e(
    "One or more mandatory parameters missing (title names txnid)",
    "invalid_request",
    "do_not_retry",
  ),
  EX126: e("Invalid data", "invalid_request", "do_not_retry"),
  EX127: e("Invalid credit card check", "invalid_request", "do_not_retry"),
  EX128: e("Invoice expired", "unknown", "customer_action_required"),
  EX129: e("Invalid set-user request", "invalid_request", "do_not_retry"),
  EX131: e(
    "No active gateway configured for the transaction (switcher failure)",
    "configuration",
    "manual_review",
  ),
  EX132: e(
    "Success-ratio based switcher found no eligible gateway",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EX133: e("Invalid discount", "invalid_amount", "do_not_retry"),
  EX136: e("Message (SMS) sending failed", "provider_unavailable", "retry_conditionally"),
  EX138: e("Fatal error handler counter", "provider_unavailable", "manual_review"),
  EX140: e("Profiling error", "provider_unavailable", "manual_review"),
  EX141: e("Email service (Mandrill) error", "provider_unavailable", "manual_review"),
  EX146: e("Risk table details missing in configuration", "provider_unavailable", "manual_review"),
  EX147: e("Incorrect key or salt", "configuration", "do_not_retry"),
  EX148: e("URL could not be parsed", "invalid_request", "do_not_retry"),
  EX149: e("Maximum retry attempts for this txnid exceeded", "rate_limiting", "do_not_retry"),
  EX150: e("Invalid subvention amount", "invalid_amount", "do_not_retry"),
  EX151: e(
    "Two rows: SFTP connection failed (title only), or invalid subvention",
    "unknown",
    "manual_review",
    { conflict: true },
  ),
  EX152: e("No form post variables found (S2S)", "invalid_request", "do_not_retry"),
  EX153: e("Category or ibibo code not received (S2S)", "invalid_request", "do_not_retry"),
  EX154: e(
    "Payment method enforced and a different method selected",
    "invalid_request",
    "customer_action_required",
  ),
  EX155: e("Net banking option down", "payment_method_unavailable", "customer_action_required"),
  EX156: e("Issuing bank down", "payment_method_unavailable", "customer_action_required"),
  EX157: e(
    "Invalid allowed-banks check for debit card standing instructions (title only)",
    "invalid_request",
    "do_not_retry",
  ),
  EX158: e("Merchant integration exception", "configuration", "manual_review"),
  EX159: e(
    "Unable to decrypt the transaction (title only)",
    "provider_unavailable",
    "manual_review",
  ),
  EX160: e("Password-protected file generation failed", "provider_unavailable", "manual_review"),
  EX200: e("Something went wrong in a v2 API call", "provider_unavailable", "retry_conditionally"),
  EX201: e(
    "Merchant key used for HMAC authentication differs from the key in the data",
    "configuration",
    "do_not_retry",
  ),
  EX210: e("Link expired", "unknown", "customer_action_required"),
  EX211: e("Link already used", "duplicate_request", "do_not_retry"),
  EX212: e("Invoice GMV limit reached (title only)", "configuration", "manual_review"),
  EX213: e("Duplicate callback; try again later", "duplicate_request", "retry_conditionally"),
  EX214: e(
    "Link retry limit exhausted; a new link is needed",
    "rate_limiting",
    "customer_action_required",
  ),
  EX215: e("Invalid response from an HTTP call", "provider_unavailable", "retry_conditionally"),
  EX216: e("Request limit reached (title only)", "rate_limiting", "retry_conditionally"),
  EX217: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX218: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX219: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX220: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX221: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX222: e(
    "Invalid customer field (first name, last name, email, phone, ZIP code, product info)",
    "invalid_request",
    "customer_action_required",
  ),
  EX223: e("Onboarding incomplete", "configuration", "manual_review"),
  EX224: e(
    "Aggregator child merchants may not initiate transactions",
    "configuration",
    "do_not_retry",
  ),
  EX225: e("Invalid expiry time (title only)", "invalid_request", "do_not_retry"),
  EX226: e("PIH error (title only; not expanded)", "unknown", "manual_review"),
  EX227: e("Currency not supported on the account", "configuration", "manual_review"),
  EX300: e(
    "Cart and SKU details inconsistent (titles only: amount, quantity, per-SKU sum, duplicate SKU)",
    "invalid_request",
    "do_not_retry",
  ),
  EX301: e(
    "Cart and SKU details inconsistent (titles only: amount, quantity, per-SKU sum, duplicate SKU)",
    "invalid_request",
    "do_not_retry",
  ),
  EX302: e(
    "Cart and SKU details inconsistent (titles only: amount, quantity, per-SKU sum, duplicate SKU)",
    "invalid_request",
    "do_not_retry",
  ),
  EX303: e(
    "Cart and SKU details inconsistent (titles only: amount, quantity, per-SKU sum, duplicate SKU)",
    "invalid_request",
    "do_not_retry",
  ),
  EX304: e(
    "Cart and SKU details inconsistent (titles only: amount, quantity, per-SKU sum, duplicate SKU)",
    "invalid_request",
    "do_not_retry",
  ),
  EX305: e("Invalid additional percentage", "invalid_amount", "do_not_retry"),
  EX306: e(
    "Three rows: wrong convenience fee GST, invalid webhook URL, wrong API version for a split transaction",
    "invalid_request",
    "do_not_retry",
    { conflict: true },
  ),
  EX307: e(
    "Two rows: convenience fee too high, or mandatory split parameters missing",
    "invalid_request",
    "do_not_retry",
    { conflict: true },
  ),
  EX401: e(
    "Two rows: cache (Redis) configuration errors (titles only)",
    "provider_unavailable",
    "manual_review",
    { conflict: true },
  ),
  EX402: e("Invalid partner parameter", "invalid_request", "do_not_retry"),
  EX403: e("Invalid UDF parameter", "invalid_request", "do_not_retry"),
  EX404: e("Invalid buyer type business", "invalid_request", "do_not_retry"),
  EX405: e("Invalid more-info parameter", "invalid_request", "do_not_retry"),
  EX406: e("Invalid PAN or date of birth", "invalid_request", "customer_action_required"),
  EX407: e("Invalid TCS amount", "invalid_amount", "do_not_retry"),
  EX408: e("TCS amount too low for the LRS service type", "invalid_amount", "do_not_retry"),
  EX409: e("Invalid LRS individual declaration value", "invalid_request", "do_not_retry"),
  EX410: e("Invalid LRS service type", "invalid_request", "do_not_retry"),
  EX411: e("Invalid pricing response (title only)", "provider_unavailable", "manual_review"),
  EX412: e(
    "Ibibo codes in the request are wrong or not active for the merchant",
    "configuration",
    "manual_review",
  ),
};

/**
 * Codes that appear only in the card AuthN / AuthZ mapping tables: 22 codes.
 * The docs give them no row of their own, so they are decoded with possible
 * confidence at most; 13 of them have no meaning at all.
 */
export const AUTH_MAPPING_CODES: Readonly<Record<string, CodeEntry>> = {
  E204: e(
    "AuthN mapping only, Field7 3DS_METHOD_NEGATIVE; bank texts include invalid card scheme, missing currency and authentication not supported",
    "authentication_failed",
    "retry_conditionally",
  ),
  E503: e(
    "AuthN mapping only; appears with 3DS method, ACS redirect and invalid OTP texts. No message given",
    "authentication_failed",
    "unknown",
  ),
  E4510: e(
    "AuthN mapping only; texts say invalid card number, token, Alt ID or ibibo code, or Alt ID parameters missing",
    "invalid_request",
    "do_not_retry",
  ),
  E4932: e(
    "AuthN mapping only, Field7 Get_cryptogram_failure; texts say the card ibibo code is not active for the merchant",
    "configuration",
    "manual_review",
  ),
  E6009: e(
    "AuthN/AuthZ mapping only; appears with authentication failed and with issuer code 59 (suspected fraud)",
    "authentication_failed",
    "manual_review",
  ),
  E6010: e(
    "AuthN mapping only; texts say a card ibibo code (brand) is not active for the merchant",
    "configuration",
    "manual_review",
  ),
  E6016: e(
    "AuthN mapping only; text says the BIN is blocked on the platform",
    "fraud_or_risk",
    "do_not_retry",
  ),
  MOF001: e(
    "AuthN mapping only, Field7 ALT_ID_PROV_ERROR; text says the city name is invalid",
    "invalid_request",
    "customer_action_required",
  ),
  SSER001: e(
    "AuthN mapping only; appears with ACS redirect, negative authentication and invalid OTP. No message given",
    "authentication_failed",
    "unknown",
  ),
  E1205: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E4165: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E4506: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E328: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E720: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E702: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E6004: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E6005: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E6006: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E6007: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E6008: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  E7001: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
  EX312: e(
    "Listed in the AuthN/AuthZ mapping tables with no message of their own; meaning NOT DOCUMENTED",
    "unknown",
    "unknown",
    { undocumented: true },
  ),
};

/** Subscription error code ("Subscription Error Codes" accordion): 1 code. */
export const SUBSCRIPTION_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  E756: e(
    "Tokenization failed before the debit could start, or the card/token BIN is not supported for subscriptions; needs a flag on the merchant ID; PayU recommends retrying with a new card",
    "card_declined",
    "customer_action_required",
  ),
};

/** Alt ID provisioning codes (`field7=ALT_ID_PROV_ERROR`): 23 codes; EA09 is also in the payment table. */
export const ALT_ID_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  EA01: e("Alt ID provisioning succeeded", "unknown", "unknown", { informational: true }),
  EA021: e("Card number invalid", "invalid_request", "customer_action_required"),
  EA022: e("Expiry year invalid", "invalid_request", "customer_action_required"),
  EA023: e("CVV invalid", "invalid_request", "customer_action_required"),
  EA025: e("Expiry month invalid", "invalid_request", "customer_action_required"),
  EA03: e("Technical error; try again", "provider_unavailable", "retry_conditionally"),
  EA080: e("Technical error; try again", "provider_unavailable", "retry_conditionally"),
  EA04: e(
    "Invalid merchant ID configuration; contact PayU support",
    "configuration",
    "manual_review",
  ),
  EA09: e(
    "Invalid merchant ID configuration; contact PayU support",
    "configuration",
    "manual_review",
  ),
  EA05: e(
    "Card network appears to be down; retry later",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EA06: e("Invalid auth code configuration", "configuration", "manual_review"),
  EA07: e("Invalid acquirer ID configuration", "configuration", "manual_review"),
  EA081: e("Incorrect card details (CVV or expiry)", "invalid_request", "customer_action_required"),
  EA082: e(
    "Mastercard DPA creation in progress; retry after about 15 minutes",
    "configuration",
    "retry_conditionally",
  ),
  EA083: e("AMEX token requestor ID not valid", "configuration", "manual_review"),
  EA084: e(
    "Card not eligible; try another card",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  EA085: e(
    "Issuing bank server down; retry later or use another card",
    "provider_unavailable",
    "retry_conditionally",
  ),
  EA086: e(
    "Card cannot be used; try another card",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  EA088: e(
    "Card cannot be used; try another card",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  EA087: e("Invalid details; try another card", "invalid_request", "customer_action_required"),
  EA089: e("Card association error", "payment_method_unavailable", "manual_review"),
  EA10: e("Merchant ID is not active", "configuration", "manual_review"),
  EA11: e("Alt ID timeout at the StoreCard service", "network_or_timeout", "retry_conditionally"),
};

/**
 * Issuer response code to PayU code mapping ("Issuer Decline Error Codes"): 67
 * response codes in 68 rows (91 maps to two PayU codes). Kept as reference
 * data: no payload field is documented to carry the issuer response code.
 */
export const ISSUER_RESPONSE_CODES: Readonly<Record<string, readonly IssuerMapping[]>> = {
  "0": [{ payuCode: "E000", title: "NO_ERROR" }],
  "1": [{ payuCode: "E348", title: "ISSUER_DECLINED" }],
  "3": [{ payuCode: "E341", title: "INVALID_MERCHANT" }],
  "4": [{ payuCode: "E310", title: "LOST_CARD" }],
  "5": [{ payuCode: "E307", title: "DO_NOT_HONOUR" }],
  "6": [{ payuCode: "E1903", title: "AUTHORIZATION_FAILED_BY_BANK" }],
  "10": [{ payuCode: "E9202", title: "PARTIAL_AMOUNT_APPROVED" }],
  "11": [{ payuCode: "E9203", title: "APPROVED_VIP" }],
  "12": [{ payuCode: "E207", title: "INVALID_TRANSACTION" }],
  "13": [{ payuCode: "E715", title: "INVALID_AMOUNT" }],
  "14": [{ payuCode: "E1632", title: "CARD_VALIDATION_FAILED" }],
  "15": [{ payuCode: "E305", title: "CARD_NUMBER_INVALID" }],
  "16": [{ payuCode: "E9204", title: "APPROVED_TRACK" }],
  "17": [{ payuCode: "E9205", title: "CUSTOMER_CANCELLATION" }],
  "18": [{ payuCode: "E9206", title: "CUSTOMER_DISPUTE" }],
  "19": [{ payuCode: "E345", title: "TECHNICAL_FAILURE" }],
  "20": [{ payuCode: "E308", title: "TRANSACTION_FAILED" }],
  "21": [{ payuCode: "E9207", title: "NO_ACTION_TAKEN_" }],
  "22": [{ payuCode: "E9208", title: "SUSPECTED_MALFUNCTION" }],
  "23": [{ payuCode: "E9209", title: "UNACCEPTABLE_TRANSACTION_FEE" }],
  "24": [{ payuCode: "E9210", title: "FILE_UPDATE_NOT_SUPPORTED_BY_RECEIVER" }],
  "25": [{ payuCode: "E9211", title: "UNABLE_TO_LOCATE_RECORD_ON_FILE" }],
  "26": [{ payuCode: "E9212", title: "DUPLICATE_FILE_UPDATE_RECORD" }],
  "27": [{ payuCode: "E9213", title: "FILE_UPDATE_FIELD_EDIT_ERROR" }],
  "28": [{ payuCode: "E9214", title: "FILE_UPDATE_FILE_LOCKED_OUT" }],
  "29": [{ payuCode: "E9215", title: "FILE_UPDATE_NOT_SUCCESSFUL" }],
  "30": [{ payuCode: "E2102", title: "TXN_FAILURE" }],
  "32": [{ payuCode: "E9216", title: "COMPLETED_PARTIALLY" }],
  "34": [{ payuCode: "E324", title: "CARD_FRAUD_SUSPECTED" }],
  "36": [{ payuCode: "E325", title: "RESTRICTED_CARD" }],
  "38": [{ payuCode: "E9217", title: "ALLOWABLE_PIN_TRIES_EXCEEDED" }],
  "39": [{ payuCode: "E224", title: "VIRTUAL_ACCOUNT_NUMBER_MISMATCH" }],
  "40": [{ payuCode: "E9218", title: "REQUESTED_FUNCTION_NOT_SUPPORTED" }],
  "42": [{ payuCode: "E9252", title: "NO_UNIVERSAL_ACCOUNT" }],
  "46": [{ payuCode: "E717", title: "INVALID_ACCOUNT_NUMBER" }],
  "51": [{ payuCode: "E706", title: "INSUFFICIENT_FUNDS" }],
  "52": [{ payuCode: "E707", title: "INVALID_PAN" }],
  "54": [{ payuCode: "E311", title: "EXPIRED_CARD" }],
  "55": [{ payuCode: "E710", title: "INVALID_PIN" }],
  "56": [{ payuCode: "E4346", title: "NO_CARD_RECORD_REMITTER" }],
  "57": [{ payuCode: "E1642", title: "CARD_NOT_PERMITTED" }],
  "60": [{ payuCode: "E337", title: "NOT_CAPTURED" }],
  "61": [{ payuCode: "E909", title: "TRANSACTION_MAX_LIMIT_EXCEEDED" }],
  "62": [{ payuCode: "E1626", title: "RESTRICTED_CARD_TYPE" }],
  "63": [{ payuCode: "E312", title: "BANK_DENIED" }],
  "64": [{ payuCode: "E9253", title: "AMOUNT_INCORRECT_MISMATCH" }],
  "66": [{ payuCode: "E9219", title: "CARD_ACCEPTOR_CALL_ACQUIRER_SECURITY" }],
  "68": [{ payuCode: "E9220", title: "RESPONSE_RECEIVED_TOO_LATE" }],
  "69": [{ payuCode: "E9221", title: "MOBILE_NUMBER_RECORD_NOT_FOUND" }],
  "70": [{ payuCode: "E1629", title: "BANK_TECHNICAL_FAILURE" }],
  "75": [{ payuCode: "E708", title: "PIN_RETRIES_EXCEEDED" }],
  "77": [{ payuCode: "E9222", title: "APPROVED_ANZ_ONLY" }],
  "78": [{ payuCode: "E1625", title: "CARD_NOT_ENABLED_FOR_ECOMM_TXN" }],
  "81": [{ payuCode: "E9223", title: "CRYPTOGRAPHIC_ERROR" }],
  "82": [{ payuCode: "E313", title: "CVC_FAILURE" }],
  "86": [{ payuCode: "E4519", title: "Insufficient_Amount" }],
  "87": [{ payuCode: "E9224", title: "NO_ENVELOPE_INSERTED" }],
  "88": [{ payuCode: "E9225", title: "UNABLE_TO_DISPENSE" }],
  "89": [{ payuCode: "E9226", title: "TID_NOT_PRESENT_ON_HOST" }],
  "90": [{ payuCode: "E9227", title: "CUTOFF_IN_PROGRESS" }],
  "91": [
    { payuCode: "E9254", title: "BANK_NOT_SUPPORTED_BY_SWITCH" },
    { payuCode: "E4158", title: "REQAUTH_TIME_OUT_FOR_PAY" },
  ],
  "92": [{ payuCode: "E225", title: "TRANSACTION_IN_PROGRESS" }],
  "94": [{ payuCode: "E504", title: "DUPLICATE_TRANSACTION" }],
  "95": [{ payuCode: "E1656", title: "RECONCILE_ERROR" }],
  "97": [{ payuCode: "E9229", title: "RECONCILIATION_TOTALS_RESET" }],
  "98": [{ payuCode: "E9230", title: "EXCEEDS_CASH_LIMIT" }],
  "99": [{ payuCode: "E9231", title: "RESERVED_FOR_NATIONAL_USE" }],
};

/** Field7 execution-stage values (card, net banking and wallet tables): 30 values. */
export const FIELD7_STAGES: Readonly<Record<string, Field7Stage>> = {
  ALT_ID_PROV_ERROR: f(
    "Network / Alt ID generation",
    "Alternate ID (token) generation API failed technically",
    "error",
    "provider_unavailable",
  ),
  ALT_ID_PROV_NEGATIVE: f(
    "Network / Alt ID generation",
    "Alternate ID provisioning refused (card ineligible, issuer restriction)",
    "negative",
    "payment_method_unavailable",
  ),
  "3DS_METHOD_POSITIVE": f(
    "Authentication / transaction requested",
    "3DS2 method data received from the ACS",
    "positive",
    null,
  ),
  "3DS_METHOD_NEGATIVE": f(
    "Authentication / transaction requested",
    "3DS2 method data sent but no response in time",
    "negative",
    "network_or_timeout",
  ),
  "3DS_METHOD_ERROR": f(
    "Authentication / transaction requested",
    "Technical failure in the 3DS2 method step",
    "error",
    "provider_unavailable",
  ),
  REDIRECT: f(
    "Merchant or PayU / S2S response; bank or wallet / bank page",
    "Interim state: a redirect is needed (S2S) or the customer was sent to the bank or wallet page",
    "interim",
    null,
  ),
  AUCPOSITIVE: f(
    "Authentication / authentication attempted",
    "Cardholder authentication succeeded (status Y)",
    "positive",
    null,
  ),
  AUCNEGATIVE: f(
    "Authentication / authentication attempted",
    "Authentication failed (status N or U)",
    "negative",
    "authentication_failed",
  ),
  AUCINVALID: f(
    "Authentication / authentication attempted",
    "Authentication ended with an internal failure (parsing, service)",
    "error",
    "provider_unavailable",
  ),
  AUCERROR: f(
    "Authentication / authentication attempted",
    "Technical error in the authentication call (OTP submit, timeout)",
    "error",
    "network_or_timeout",
  ),
  ACS_REDIRECT: f(
    "Authentication / bank OTP page",
    "Customer sent to the ACS challenge",
    "interim",
    null,
  ),
  "3DS_CHALLENGE_POSITIVE": f(
    "Authentication / success",
    "Challenge completed successfully",
    "positive",
    null,
  ),
  "3DS_CHALLENGE_NEGATIVE": f(
    "Authentication / failed",
    "Challenge failed (wrong input or customer cancelled)",
    "negative",
    "authentication_failed",
  ),
  "3DS_CHALLENGE_ERROR": f(
    "Authentication / failed",
    "No response from the ACS after the challenge (timeout or drop-off)",
    "error",
    "network_or_timeout",
  ),
  AUTHPOSITIVE: f(
    "Authorization / success",
    "Authentication and authorization succeeded",
    "positive",
    null,
  ),
  AUTHNEGATIVE: f(
    "Authorization / failed",
    "Issuer declined the authorization (funds, limits)",
    "negative",
    "card_declined",
  ),
  AUTHERROR: f(
    "Authorization / failed",
    "Technical failure during authorization",
    "error",
    "network_or_timeout",
  ),
  INTERROR: f(
    "PayU / payment",
    "No response from the bank or processor in time",
    "error",
    "network_or_timeout",
  ),
  INTNEGATIVE: f(
    "PayU / payment",
    "Invalid IBIBO (payment option) code in the request",
    "negative",
    "invalid_request",
  ),
  TXNPOSITIVE: f(
    "Bank or wallet / banking response",
    "Bank or wallet confirmed the debit",
    "positive",
    null,
  ),
  TXNNEGATIVE: f(
    "Bank or wallet / banking response",
    "Bank or wallet reported failure",
    "negative",
    "card_declined",
  ),
  TXNERROR: f(
    "Bank or wallet / banking response",
    "No or invalid bank callback; outcome uncertain and needs verification",
    "error",
    "network_or_timeout",
  ),
  TXNPENDING: f(
    "Bank or wallet / banking response",
    "Corporate banking: maker initiated, checker approval pending",
    "pending",
    null,
  ),
  VERPOSITIVE: f(
    "Bank or wallet / verification",
    "Verification call confirmed success",
    "positive",
    null,
  ),
  VERNEGATIVE: f(
    "Bank or wallet / verification",
    "Verification call confirmed failure",
    "negative",
    "card_declined",
  ),
  VERERROR: f(
    "Bank or wallet / verification",
    "Verification call failed technically",
    "error",
    "network_or_timeout",
  ),
  VERPENDING: f(
    "Bank or wallet / verification",
    "Verification shows checker approval still pending",
    "pending",
    null,
  ),
  AUTOREFUND: f(
    "PayU / verification",
    "Automatic refund triggered (duplicate payment, timeout, missing confirmation)",
    "auto_refund",
    null,
  ),
  OTPSEND: f("PayU / PayU", "PayU generated and sent its own OTP", "interim", null),
  OTPERROR: f(
    "PayU / PayU",
    "PayU OTP generation or validation failed",
    "error",
    "provider_unavailable",
  ),
};

/**
 * Refund initiation status codes (`error_code` of `cancel_refund_transaction`):
 * 81 codes. The refund page says 102 (queued) counts as success.
 */
export const REFUND_INITIATION_CODES: Readonly<Record<string, CodeEntry>> = {
  "100": e("SUCCESS: refund successful", "unknown", "unknown", { informational: true }),
  "101": e("PENDING (message still says refund successful)", "unknown", "retry_conditionally"),
  "102": e(
    "QUEUED: refund queued. The Refund Transaction API page says to treat 102 as success",
    "unknown",
    "unknown",
    { informational: true },
  ),
  "103": e("REJECT: request rejected on reconfirmation", "unknown", "manual_review"),
  "104": e("RECONFIRM: confirmation required", "unknown", "manual_review"),
  "105": e("Invalid amount", "invalid_amount", "do_not_retry"),
  "106": e("Refund token already exists", "duplicate_request", "do_not_retry"),
  "107": e("Upgraded to refund", "unknown", "manual_review"),
  "108": e("Refund failure with no message", "unknown", "manual_review"),
  "109": e("Request already logged", "duplicate_request", "do_not_retry"),
  "110": e(
    "More than one partial refund of a Maestro transaction not allowed",
    "invalid_request",
    "do_not_retry",
  ),
  "111": e("Invalid transaction status for this action", "invalid_request", "do_not_retry"),
  "112": e("RISK_QUEUED (no message)", "fraud_or_risk", "manual_review"),
  "113": e(
    "Invalid amount because a chargeback amount is present",
    "invalid_amount",
    "manual_review",
  ),
  "115": e("Invalid status to be updated", "invalid_request", "do_not_retry"),
  "116": e("Transaction not found", "invalid_request", "do_not_retry"),
  "117": e("Amount does not match", "invalid_amount", "do_not_retry"),
  "119": e("No such request found", "invalid_request", "do_not_retry"),
  "120": e("Transaction lock could not be obtained", "provider_unavailable", "retry_conditionally"),
  "121": e("Incorrect or empty value passed in retry", "invalid_request", "do_not_retry"),
  "122": e("APPROVAL PENDING (no message)", "unknown", "manual_review"),
  "123": e("Request set as pending; needs manual follow-up", "unknown", "manual_review"),
  "124": e("Input data missing", "invalid_request", "do_not_retry"),
  "125": e("Merchant failed the pending refund", "unknown", "manual_review"),
  "126": e("IN_PROGRESS (no message)", "unknown", "retry_conditionally"),
  "127": e("REQUESTED (no message)", "unknown", "retry_conditionally"),
  "128": e("Partial refunds not allowed", "invalid_request", "do_not_retry"),
  "129": e("Remark is mandatory for retry 0", "invalid_request", "do_not_retry"),
  "130": e(
    "Refunds not allowed after a limit (the message is cut off after 'after')",
    "invalid_request",
    "do_not_retry",
  ),
  "214": e(
    "Two refunds of the same amount on the same transaction within 5 minutes not allowed",
    "duplicate_request",
    "retry_conditionally",
  ),
  "225": e(
    "PENDING: overdraft occurred; recheck status the next day",
    "unknown",
    "retry_conditionally",
  ),
  "226": e(
    "PENDING: capture initiated today; check refund status the next day",
    "unknown",
    "retry_conditionally",
  ),
  "227": e("Same amount with the same token not allowed", "duplicate_request", "do_not_retry"),
  "230": e("Purged transaction; refund needs manual follow-up", "unknown", "manual_review"),
  "231": e(
    "Refund could not be initiated because of an internal error (no status given)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "232": e(
    "Refund could not be initiated; refunds not supported or manual intervention needed",
    "unknown",
    "manual_review",
  ),
  "233": e(
    "BLOCKED: refund/cancel blocked from the merchant panel, from panel and API, or in general; contact the key account manager",
    "configuration",
    "manual_review",
  ),
  "234": e(
    "BLOCKED: refund/cancel blocked from the merchant panel, from panel and API, or in general; contact the key account manager",
    "configuration",
    "manual_review",
  ),
  "235": e(
    "BLOCKED: refund/cancel blocked from the merchant panel, from panel and API, or in general; contact the key account manager",
    "configuration",
    "manual_review",
  ),
  "236": e("Refund not possible on this transaction", "unknown", "do_not_retry"),
  "237": e(
    "Validation failure: special characters not allowed in a named field",
    "invalid_request",
    "do_not_retry",
  ),
  "238": e("Validation failure: a mandatory field is missing", "invalid_request", "do_not_retry"),
  "239": e("API-based alternate instant refunds not activated", "configuration", "manual_review"),
  "240": e("Store card failed", "provider_unavailable", "manual_review"),
  "241": e(
    "Bank does not support refunds because the payment is older than its day limit (text is in the status column)",
    "invalid_request",
    "do_not_retry",
  ),
  "242": e("Bank code not supported", "configuration", "manual_review"),
  "243": e(
    "Virtual account setup for instant refunds incomplete",
    "configuration",
    "manual_review",
  ),
  "244": e("Beneficiary code for the virtual account not set", "configuration", "manual_review"),
  "245": e("BBPS transaction not successful", "invalid_request", "do_not_retry"),
  "246": e("Value invalid for the merchant SKU", "invalid_request", "do_not_retry"),
  "247": e("No offers found for the SKU", "invalid_request", "do_not_retry"),
  "248": e("BAL_CHECK_INIT (no message)", "unknown", "retry_conditionally"),
  "249": e("RETRY: retry the transaction", "unknown", "retry_conditionally"),
  "250": e(
    "Refund failed because a successful chargeback was uploaded",
    "unknown",
    "manual_review",
  ),
  "251": e("Refunds blocked by the bank for this gateway MID", "configuration", "manual_review"),
  "252": e("Refunds from the panel not allowed for this MID", "configuration", "manual_review"),
  "253": e("Invalid mode for instant refunds", "invalid_request", "do_not_retry"),
  "254": e("Remarks contain special characters", "invalid_request", "do_not_retry"),
  "255": e("Refund token too long", "invalid_request", "do_not_retry"),
  "256": e(
    "Refund not supported on split child transactions; refund the order transaction",
    "invalid_request",
    "do_not_retry",
  ),
  "258": e("Initiated (no message)", "unknown", "retry_conditionally"),
  "259": e("REQUESTED_RETRY (no message)", "unknown", "retry_conditionally"),
  "261": e("Error while processing the request", "provider_unavailable", "retry_conditionally"),
  "262": e("Error while processing the request", "provider_unavailable", "retry_conditionally"),
  "264": e("Error while processing the request", "provider_unavailable", "retry_conditionally"),
  "265": e("Error while processing the request", "provider_unavailable", "retry_conditionally"),
  "263": e("Invalid requested amount", "invalid_amount", "do_not_retry"),
  "266": e("A chargeback is pending against this transaction", "unknown", "manual_review"),
  "267": e(
    "Lock already held on transaction metadata",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "270": e("Transaction not eligible for instant refund", "invalid_request", "do_not_retry"),
  "299": e("Refund initiation blocked for a Type A merchant", "configuration", "manual_review"),
  "301": e("Capture already successful for this transaction", "duplicate_request", "do_not_retry"),
  "302": e("Try again after some time", "provider_unavailable", "retry_conditionally"),
  "303": e("Amount greater than the maximum capturable amount", "invalid_amount", "do_not_retry"),
  "304": e("Amount less than allowed", "invalid_amount", "do_not_retry"),
  "305": e("Amount more than allowed", "invalid_amount", "do_not_retry"),
  "306": e("Invalid amount tolerance configuration", "configuration", "manual_review"),
  "424": e("Transaction upgraded to capture or refund", "unknown", "manual_review"),
  "500": e("An exception occurred", "provider_unavailable", "retry_conditionally"),
  "501": e("Successfully updated (no status given)", "unknown", "unknown", { informational: true }),
  "502": e("Failed to update (no status given)", "unknown", "manual_review"),
};

/**
 * Refund status codes (`R...`): 31 codes. The docs do not say which response
 * field carries them, so they are reference data and are not read from input.
 */
export const REFUND_STATUS_CODES: Readonly<Record<string, CodeEntry>> = {
  R000: e("Refund succeeded", "unknown", "unknown", { informational: true }),
  R0001: e("Technical error at the acquiring bank", "provider_unavailable", "retry_conditionally"),
  R0023: e("Technical error at the acquiring bank", "provider_unavailable", "retry_conditionally"),
  R0002: e("Technical error at the customer's bank", "provider_unavailable", "retry_conditionally"),
  R0024: e("Technical error at the customer's bank", "provider_unavailable", "retry_conditionally"),
  R0003: e("VPA invalid or expired", "invalid_request", "customer_action_required"),
  R0004: e("Credit to the customer's account failed", "unknown", "manual_review"),
  R0005: e("Refund not permitted to this account", "payment_method_unavailable", "manual_review"),
  R0006: e("Technical error", "provider_unavailable", "retry_conditionally"),
  R0025: e("Technical error", "provider_unavailable", "retry_conditionally"),
  R0007: e(
    "Technical error at the issuer or acquirer",
    "provider_unavailable",
    "retry_conditionally",
  ),
  R0008: e("Timeout at the acquirer", "network_or_timeout", "retry_conditionally"),
  R0009: e("Refund in a deemed state", "unknown", "manual_review"),
  R0010: e("Account details not found at the customer's bank", "invalid_request", "manual_review"),
  R0011: e("Compliance decline at the customer's bank", "card_declined", "manual_review"),
  R0012: e("Customer account blocked", "card_declined", "manual_review"),
  R0013: e("Refund not allowed on the VPA", "payment_method_unavailable", "manual_review"),
  R0014: e("Original refund details not found", "unknown", "manual_review"),
  R0015: e("Customer account inactive", "card_declined", "manual_review"),
  R0016: e(
    "Maximum balance limit at the customer's bank breached",
    "card_declined",
    "manual_review",
  ),
  R0017: e("Risk decline", "fraud_or_risk", "manual_review"),
  R0026: e("Risk decline", "fraud_or_risk", "manual_review"),
  R0018: e("Customer VPA blocked", "card_declined", "manual_review"),
  R0019: e(
    "Refund not allowed to an overdraft account",
    "payment_method_unavailable",
    "manual_review",
  ),
  R0020: e("Merchant blocked by the customer", "card_declined", "manual_review"),
  R0021: e("Timeout at the customer's side", "network_or_timeout", "retry_conditionally"),
  R0022: e("Customer's bank not honouring the refund", "card_declined", "manual_review"),
  R101: e("In progress", "unknown", "retry_conditionally"),
  R500: e("In progress", "unknown", "retry_conditionally"),
  R102: e(
    "Insufficient balance (whose balance is NOT DOCUMENTED)",
    "insufficient_funds",
    "manual_review",
  ),
  R501: e("Failed", "unknown", "manual_review"),
};
