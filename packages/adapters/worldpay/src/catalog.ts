/**
 * Worldpay (Access Worldpay) code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/worldpay.md, which cites
 * Worldpay's public documentation and OpenAPI files, verified 2026-10-25:
 *
 * Refusal codes and advice codes: https://docs.worldpay.com/access/products/reference/refusal-response
 * Raw scheme response codes:      https://docs.worldpay.com/access/products/reference/refusal-response/scheme-codes
 * errorName values:               https://docs.worldpay.com/access/products/reference/worldpay-error-responses
 *                                 (plus the Payments, Card Payments v7, APMs, Payment Queries and Tokens references)
 * Webhook event types:            https://docs.worldpay.com/access/products/events/openapi
 * Payment Queries event names:    https://docs.worldpay.com/access/products/payment-queries/openapi
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file, except the refusal advice codes, whose
 * retry guidance is Worldpay's own. Worldpay warns that the refusal list
 * "might not be exhaustive" and that the error-name list is "not
 * comprehensive", so unknown codes are always possible.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const ACCESS = "https://docs.worldpay.com/access/products";
export const REFUSAL_CODES_URL = `${ACCESS}/reference/refusal-response`;
export const SCHEME_CODES_URL = `${ACCESS}/reference/refusal-response/scheme-codes`;
export const ERROR_RESPONSES_URL = `${ACCESS}/reference/worldpay-error-responses`;
export const API_PRINCIPLES_URL = `${ACCESS}/reference/api-principles`;
export const PAYMENTS_URL = `${ACCESS}/payments`;
export const PAYMENTS_OPENAPI_URL = `${ACCESS}/payments/openapi`;
export const PAYMENTS_TESTING_URL = `${ACCESS}/payments/testing`;
export const AUTO_SETTLEMENT_URL = `${ACCESS}/payments/enable-features/auto-settlement`;
export const CARD_PAYMENTS_OPENAPI_URL = `${ACCESS}/card-payments/openapi`;
export const V7_MIGRATION_URL = `${ACCESS}/card-payments/v7-migration-guide`;
export const MANAGE_PAYMENTS_URL = `${ACCESS}/card-payments/manage-payments`;
export const QUERY_PAYMENT_URL = `${ACCESS}/card-payments/query-a-payment`;
export const ONLINE_REFUNDS_URL = `${ACCESS}/card-payments/features/online-refunds`;
export const APMS_MANAGE_URL = `${ACCESS}/apms/manage`;
export const PAYMENT_QUERIES_URL = `${ACCESS}/payment-queries/openapi`;
export const EVENTS_URL = `${ACCESS}/events`;
export const EVENTS_OVERVIEW_URL = `${ACCESS}/events/overview`;
export const EVENTS_OPENAPI_URL = `${ACCESS}/events/openapi`;
export const SIGNATURE_URL = `${ACCESS}/events/signature`;
export const HPP_WEBHOOKS_URL = `${ACCESS}/hosted-payment-pages/webhooks`;
export const WPG_URL = "https://docs.worldpay.com/apis/wpg";
export const CNPAPI_URL = "https://docs.worldpay.com/apis/cnpapi";

/** How a code relates to the outcome of the operation that carries it. */
export type CodeKind = "decline" | "approval" | "partial" | "reserved";

export type RefusalEntry = {
  meaning: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  note?: string;
};

const r = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  note?: string,
): RefusalEntry => ({ meaning, kind: "decline", category, retry, ...(note ? { note } : {}) });
const approvalLike = (meaning: string, note: string): RefusalEntry => ({
  meaning,
  kind: "approval",
  category: "unknown",
  retry: "unknown",
  note,
});

const CAFIS_RETRY = "The documentation says to try again.";
const GEAR_UNCLEAR =
  "The documentation says the result is unclear; confirm the payment state before any retry.";

function series(
  codes: readonly number[],
  names: readonly string[],
  make: (name: string) => RefusalEntry,
): Record<string, RefusalEntry> {
  if (codes.length !== names.length) throw new Error("catalog series length mismatch");
  return Object.fromEntries(codes.map((c, i) => [String(c), make(names[i]!)]));
}

const sameForAll = (codes: readonly number[], entry: RefusalEntry) =>
  Object.fromEntries(codes.map((c) => [String(c), entry]));

/**
 * Worldpay refusal codes (212), the default content of `refusalCode` (and of
 * `gatewayRefusalCode` in Card Payments v7). The documentation page renders
 * footnote markers glued to two codes ("131", "652"); they are codes 13 and 65.
 */
export const REFUSAL_CODES: Record<string, RefusalEntry> = {
  "1": r(
    "Refer to card issuer / call authorization centre",
    "card_declined",
    "customer_action_required",
  ),
  "2": r(
    "Referred / refer to issuer, special condition",
    "card_declined",
    "customer_action_required",
  ),
  "3": r("Invalid acceptor, merchant or service provider", "configuration", "do_not_retry"),
  "4": r("Hold / capture / retain card", "fraud_or_risk", "do_not_retry"),
  "5": r(
    "Refused / do not honour / declined (generic)",
    "card_declined",
    "customer_action_required",
  ),
  "6": r("Try another card", "card_declined", "customer_action_required"),
  "7": r("Pick up card, special condition (not lost or stolen)", "fraud_or_risk", "do_not_retry"),
  "8": approvalLike("Honour with ID / approved with ID", "This is an approval-like code."),
  "10": {
    meaning: "Partial approval",
    kind: "partial",
    category: "unknown",
    retry: "manual_review",
    note: "The payment was approved for a lower amount than requested.",
  },
  "12": r("Invalid transaction", "card_declined", "do_not_retry"),
  "13": r(
    "Invalid amount, currency conversion overflow, or above card programme maximum",
    "invalid_amount",
    "do_not_retry",
    "Worldpay also uses this code for the monthly gambling limit (Europe EUR 50,000; Azerbaijan, Moldova and Ukraine EUR 10,000).",
  ),
  "14": r("Invalid card or account number", "card_declined", "customer_action_required"),
  "15": r("Invalid issuer", "card_declined", "do_not_retry"),
  "19": r("Re-enter transaction", "provider_unavailable", "retry_conditionally"),
  "20": r("Acquirer error / error / no action taken", "provider_unavailable", "manual_review"),
  "25": r("Record not found in file or account", "invalid_request", "do_not_retry"),
  "28": r("File temporarily unavailable", "provider_unavailable", "retry_conditionally"),
  "30": r("Format error / error", "invalid_request", "do_not_retry"),
  "33": r("Card expired", "card_declined", "customer_action_required"),
  "34": r(
    "Fraud suspicion",
    "fraud_or_risk",
    "do_not_retry",
    "In WPG this code is raised by a Worldpay fraud detection service.",
  ),
  "39": r("No credit account", "card_declined", "customer_action_required"),
  "41": r("Lost card / pick up", "fraud_or_risk", "do_not_retry"),
  "43": r("Stolen card, pick up", "fraud_or_risk", "do_not_retry"),
  "46": r("Closed account", "card_declined", "do_not_retry"),
  "51": r(
    "Limit exceeded / insufficient funds / over credit limit",
    "insufficient_funds",
    "customer_action_required",
  ),
  "52": r("No checking account", "card_declined", "customer_action_required"),
  "53": r("No savings account", "card_declined", "customer_action_required"),
  "54": r("Expired card", "card_declined", "customer_action_required"),
  "55": r(
    "Invalid security code, or invalid PIN, or error",
    "card_declined",
    "customer_action_required",
  ),
  "56": r("Unknown card", "card_declined", "customer_action_required"),
  "57": r(
    "Not permitted to issuer/cardholder / illegal transaction",
    "card_declined",
    "do_not_retry",
  ),
  "58": r("Not permitted to acquirer/terminal", "configuration", "do_not_retry"),
  "59": r("Suspected fraud (Visa)", "fraud_or_risk", "do_not_retry"),
  "61": r("Exceeds withdrawal amount limit", "card_declined", "customer_action_required"),
  "62": r("Restricted card (for example country exclusion)", "card_declined", "do_not_retry"),
  "63": r("Unable to authorise / error", "unknown", "manual_review"),
  "64": r("Unable to authorise", "unknown", "manual_review"),
  "65": r(
    "Exceeds withdrawal count limit / authentication requested",
    "authentication_required",
    "customer_action_required",
    "Worldpay marks this as a soft decline: the customer must be authenticated. A new attempt with valid 3DS data is possible.",
  ),
  "68": r("Time out", "network_or_timeout", "retry_conditionally"),
  "70": r("Contact card issuer", "card_declined", "customer_action_required"),
  "71": r("PIN not changed", "authentication_failed", "do_not_retry"),
  "74": r("Allowable PIN tries exceeded", "authentication_failed", "do_not_retry"),
  "75": r("Allowable PIN tries exceeded", "authentication_failed", "do_not_retry"),
  "76": r('Card blocked, or invalid/nonexistent "to" account', "card_declined", "do_not_retry"),
  "77": r('Invalid/nonexistent "from" account', "card_declined", "do_not_retry"),
  "78": r("Invalid/nonexistent account (general)", "card_declined", "do_not_retry"),
  "79": r(
    "Already reversed (Visa) / lifecycle reasons (Mastercard)",
    "unknown",
    "manual_review",
    "The meaning depends on the card scheme.",
  ),
  "80": r(
    "Visa: credit issuer unavailable; private label and cheque: invalid date",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "82": r(
    "Negative CAM/dCVV/iCVV/CVV result (Visa) / policy reasons (Mastercard)",
    "card_declined",
    "customer_action_required",
  ),
  "83": r(
    "STIP cannot approve (Visa) / fraud or security reasons (Mastercard)",
    "fraud_or_risk",
    "manual_review",
  ),
  "84": r("Invalid authorization life cycle", "invalid_request", "do_not_retry"),
  "85": r(
    "Rejected by issuer, or not declined (AVS/balance only), or no reason to decline",
    "unknown",
    "manual_review",
    "The documented texts for this code contradict each other.",
  ),
  "86": r(
    "Cannot verify PIN / PIN validation not possible",
    "authentication_failed",
    "customer_action_required",
  ),
  "88": r("Unable to authorise", "unknown", "manual_review"),
  "89": r(
    "Unacceptable PIN, retry / ineligible to receive",
    "authentication_failed",
    "customer_action_required",
  ),
  "91": r(
    "Issuer or switch unavailable / authorization system inoperative",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "92": r("Unable to route transaction", "configuration", "do_not_retry"),
  "93": r("Cannot complete, violation of law", "card_declined", "do_not_retry"),
  "94": r("Duplicate transaction / duplicate transmission", "duplicate_request", "do_not_retry"),
  "96": r("Unable to authorise / system error", "provider_unavailable", "retry_conditionally"),
  "98": r("Error", "unknown", "manual_review"),
  "99": r("Error", "unknown", "manual_review"),
  "102": r("Invalid card issuer", "card_declined", "do_not_retry"),
  "104": r("Unknown card", "card_declined", "customer_action_required"),
  "106": r("Invalid account", "card_declined", "do_not_retry"),
  "107": r("Security breach", "fraud_or_risk", "do_not_retry"),
  "241": r("Verification data failed", "authentication_failed", "customer_action_required"),
  "397": r("Surcharge amount not permitted on Visa", "invalid_amount", "do_not_retry"),
  "398": r("Surcharge not supported", "invalid_amount", "do_not_retry"),
  "442": r("Acquirer institution code not registered at CAFIS", "configuration", "manual_review"),
  ...sameForAll(
    [443, 447, 449, 450, 453, 454, 455, 456, 457, 459, 460],
    r("CAFIS system error", "provider_unavailable", "retry_conditionally", CAFIS_RETRY),
  ),
  "444": r("Acquirer system busy", "provider_unavailable", "retry_conditionally", CAFIS_RETRY),
  "445": r("Acquirer system error", "provider_unavailable", "retry_conditionally", CAFIS_RETRY),
  "446": r("Acquirer system closed", "provider_unavailable", "retry_conditionally", CAFIS_RETRY),
  "448": r("Illegal encoding format", "invalid_request", "retry_conditionally", CAFIS_RETRY),
  "451": r("Advice message already received", "duplicate_request", "do_not_retry"),
  "452": r(
    "CAFIS timed out sending to the acquirer",
    "network_or_timeout",
    "retry_conditionally",
    CAFIS_RETRY,
  ),
  "458": r("Acquirer does not support the service", "payment_method_unavailable", "do_not_retry"),
  "577": r("Card unusable; contact issuer", "card_declined", "customer_action_required"),
  "578": r("Transaction pending; contact issuer", "unknown", "manual_review"),
  "579": r("PIN incorrect", "authentication_failed", "customer_action_required"),
  "580": r("Security code incorrect", "card_declined", "customer_action_required"),
  "581": r("Security code not set", "card_declined", "customer_action_required"),
  "582": r("JIS2 stripe information invalid", "card_declined", "do_not_retry"),
  "583": r(
    "Card maxed out for the day (insufficient funds)",
    "insufficient_funds",
    "customer_action_required",
  ),
  "584": r(
    "Amount exceeds the daily limit (insufficient funds)",
    "insufficient_funds",
    "customer_action_required",
  ),
  "586": r(
    "Card invalid (MOD 10 check failed); keep card, contact issuer",
    "card_declined",
    "do_not_retry",
  ),
  "587": r(
    "Card invalid (lost/stolen); keep card, contact issuer",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "588": r(
    "Card invalid (MOD 10 check failed); keep card, contact issuer",
    "card_declined",
    "do_not_retry",
  ),
  "589": r(
    "Primary Account Number element invalid (MOD 10 check failed)",
    "invalid_request",
    "customer_action_required",
  ),
  "590": r("Merchant Type element invalid", "invalid_request", "do_not_retry"),
  "591": r("Transaction Amount element invalid", "invalid_amount", "do_not_retry"),
  ...series(
    [592, 593, 594, 595, 596, 597, 598, 599],
    [
      "Tax and Postage",
      "Bonus Count",
      "Bonus Month",
      "Bonus Amount",
      "First Payment Month",
      "Installment Count",
      "Installment Amount",
      "First Payment Amount",
    ],
    (n) => r(`Element value invalid: ${n}`, "invalid_request", "do_not_retry"),
  ),
  "600": r(
    "Service Code / Business Code / Message Code value invalid",
    "invalid_request",
    "do_not_retry",
  ),
  ...series(
    [601, 602, 603, 604],
    ["Payment Division", "Inquiry Division", "Cancel Division", "Original Payment Division"],
    (n) => r(`Element value invalid: ${n}`, "invalid_request", "do_not_retry"),
  ),
  "605": r(
    "Unknown response code / card expired",
    "unknown",
    "manual_review",
    "The documented texts for this code contradict each other.",
  ),
  "606": r(
    "Card not applicable to the service",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "607": r("Acquirer service completed", "unknown", "manual_review"),
  "608": r("Invalid (lost/stolen) card error", "fraud_or_risk", "do_not_retry"),
  "609": r(
    "Request cannot be processed; contact issuer",
    "card_declined",
    "customer_action_required",
  ),
  "610": r("Request for an unsupported transaction received", "invalid_request", "do_not_retry"),
  "611": r(
    "Unknown response code / message from a centre that has not made contact",
    "unknown",
    "manual_review",
  ),
  ...series(
    [
      622, 623, 624, 627, 628, 629, 636, 637, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 658,
      659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669,
    ],
    [
      "Service Code",
      "Business Code",
      "Message Code",
      "Transaction Identifier",
      "Processor Transaction Date-Time",
      "Card Acceptor Terminal Identification",
      "Primary Account Number",
      "Expiration Date",
      "Track-2 Data",
      "PIN Data",
      "Merchant Type",
      "Transaction Amount",
      "Tax and Postage",
      "Point of Service Data Code",
      "Payment Division",
      "Cancel Division",
      "Original Terminal Processing Serial Number",
      "Original Payment Division",
      "Original Processor Transaction Date-Time",
      "Original Transaction Identifier",
      "Free Field",
      "Terminal Processing Serial Number",
      "Security Code",
      "Electronic Commerce Indicator",
      "XID",
      "Accountholder Authentication Value",
      "Transaction Status",
      "Message Version Number",
      "CAVV Algorithm",
      "Recurring Flag",
    ],
    (n) => r(`Message element setting error: ${n}`, "invalid_request", "do_not_retry"),
  ),
  ...series(
    [625, 626, 630, 631, 632, 633, 634, 635],
    [
      "Processor Code",
      "Merchant Code",
      "Encryption Method Code",
      "Key Encryption Key Index in Use",
      "Processor Authentication Key Index",
      "Message Encryption Key",
      "Message Authentication Code",
      "Acquirer Institution Identification Code",
    ],
    (n) => r(`Message element setting error (set-up data): ${n}`, "configuration", "manual_review"),
  ),
  "670": r("Element block setting error", "invalid_request", "do_not_retry"),
  "671": r(
    "Service Code and Message Code combination incorrect",
    "invalid_request",
    "do_not_retry",
  ),
  "672": r("Processor Authentication Key Index setting error", "configuration", "manual_review"),
  "673": r(
    "More than one original transaction; unable to reverse",
    "invalid_request",
    "manual_review",
  ),
  "674": r(
    "Processor Code and Merchant Code combination incorrect",
    "configuration",
    "do_not_retry",
  ),
  ...sameForAll(
    [675, 678, 681, 703, 705],
    r("Global GEAR system error", "provider_unavailable", "retry_conditionally", CAFIS_RETRY),
  ),
  ...sameForAll(
    [676, 677, 679, 680, 682, 683, 694, 695, 696, 697, 698, 699, 700, 701, 702, 704],
    r(
      "Global GEAR system error; result unclear",
      "provider_unavailable",
      "manual_review",
      GEAR_UNCLEAR,
    ),
  ),
  "828": r("Unable to authorize", "unknown", "manual_review"),
  "831": r("Cash service not available", "payment_method_unavailable", "do_not_retry"),
  "832": r("Cash back exceeds issuer limit", "invalid_amount", "do_not_retry"),
  "833": r("Resubmission past the maximum days limit", "invalid_request", "do_not_retry"),
  "835": r("Declined for CVV2 failure", "card_declined", "customer_action_required"),
  "836": r("Amount greater than pre-authorised", "invalid_amount", "do_not_retry"),
  "902": r("Invalid biller information", "invalid_request", "do_not_retry"),
  "905": r("Unable to authorise", "unknown", "manual_review"),
  "906": r("Unable to authorise", "unknown", "manual_review"),
  "911": r("Unknown response code", "unknown", "unknown"),
  "937": r("Card authentication failed", "authentication_failed", "customer_action_required"),
  "972": r("Stop payment order", "card_declined", "do_not_retry"),
  "973": r(
    "Revocation of authorization order",
    "card_declined",
    "do_not_retry",
    "WPG advice: stop further attempts on the card and notify the cardholder.",
  ),
  "975": r(
    "Refused / revocation of all authorizations order",
    "card_declined",
    "do_not_retry",
    "WPG advice: stop further attempts on the card and notify the cardholder.",
  ),
  "1044": approvalLike("Approval, keep first check", "This is a cheque approval code."),
  "1045": approvalLike("Check OK, no conversion", "This is a cheque approval code."),
  "1046": r("Invalid RTTN (routing number)", "invalid_request", "customer_action_required"),
  "1047": r("Amount greater than limit", "invalid_amount", "do_not_retry"),
  "1048": r("Unpaid items, failed negative file check", "fraud_or_risk", "do_not_retry"),
  "1049": r("Duplicate check number", "duplicate_request", "do_not_retry"),
  "1050": r("MICR error", "invalid_request", "customer_action_required"),
  "1051": r("Too many checks", "fraud_or_risk", "do_not_retry"),
  "1198": r("Forward to issuer", "unknown", "manual_review"),
  "1201": r("Forward to issuer", "unknown", "manual_review"),
  "1263": r("Unable to authorise", "unknown", "manual_review"),
  "1295": r("Unknown", "unknown", "unknown"),
};

/**
 * Codes that appear only on Worldpay's testing pages (magic values) and not in
 * the refusal reference table. Decoded with possible confidence.
 */
export const TEST_ONLY_REFUSAL_CODES: Record<string, RefusalEntry> = {
  "17": r("ANNULATION BY CLIENT (test value)", "unknown", "manual_review"),
  "29": r("IMPOSSIBLE REFERENCE NUMBER (test value)", "invalid_request", "do_not_retry"),
  "38": r("SECURITY CODE EXPIRED (test value)", "card_declined", "customer_action_required"),
};

export type AdviceEntry = { scenario: string; advice: string; retry: RetryGuidance };

/**
 * Refusal advice codes (`advice.code`; v6 `refusalAdvice.code`), returned
 * "only for Mastercard/Maestro transactions at present". The retry advice is
 * Worldpay's own.
 */
export const ADVICE_CODES: Record<string, AdviceEntry> = {
  "01": {
    scenario: "Updated account information available (for example card expired)",
    advice: "Retry with updated details or authentication.",
    retry: "customer_action_required",
  },
  "02": {
    scenario: "Insufficient funds now",
    advice: "Retry after 72 hours.",
    retry: "retry_conditionally",
  },
  "03": {
    scenario: "Invalid account number, or lost/stolen card",
    advice: "Do not retry; scheme fees may apply.",
    retry: "do_not_retry",
  },
  "04": {
    scenario: "Network token authentication value problem",
    advice: "Review the network token authentication value.",
    retry: "customer_action_required",
  },
  "21": {
    scenario: "Cardholder stopped the recurring or instalment payment",
    advice: "Do not retry; scheme fees may apply.",
    retry: "do_not_retry",
  },
  "22": {
    scenario: "Merchant not enrolled in the Mastercard instalment programme",
    advice: "Do not retry.",
    retry: "do_not_retry",
  },
  "24": {
    scenario: "Insufficient funds now",
    advice: "Retry after 1 hour.",
    retry: "retry_conditionally",
  },
  "25": {
    scenario: "Insufficient funds now",
    advice: "Retry after 24 hours.",
    retry: "retry_conditionally",
  },
  "26": {
    scenario: "Insufficient funds now",
    advice: "Retry after 2 days.",
    retry: "retry_conditionally",
  },
  "27": {
    scenario: "Insufficient funds now",
    advice: "Retry after 4 days.",
    retry: "retry_conditionally",
  },
  "28": {
    scenario: "Insufficient funds now",
    advice: "Retry after 6 days.",
    retry: "retry_conditionally",
  },
  "29": {
    scenario: "Insufficient funds now",
    advice: "Retry after 8 days.",
    retry: "retry_conditionally",
  },
  "30": {
    scenario: "Insufficient funds now",
    advice: "Retry after 10 days.",
    retry: "retry_conditionally",
  },
};

/** Visa's own retry categories for raw codes, as documented by Worldpay. */
export const VISA_CATEGORIES: Record<string, string> = {
  "1": "Visa category 1: the issuer never approves; a reattempt is not permitted.",
  "2": "Visa category 2: the issuer cannot approve now; up to 15 reattempts over 30 days are allowed.",
  "3": "Visa category 3: revalidate the payment data first, then up to 15 reattempts over 30 days.",
  "4": "Visa category 4: generic response; up to 15 reattempts over 30 days are allowed.",
};

export type RawCodeEntry = {
  /** Scheme texts; absent when the code is not in that scheme's table. */
  visa?: string;
  /** Visa category: "1" to "4", "1,3", "approval" or "n/a". */
  visaCategory?: string;
  mastercard?: string;
  discover?: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** The suggested category or retry differs by scheme; `schemeNote` says how. */
  schemeNote?: string;
};

type Schemes = { v?: string; vc?: string; m?: string; d?: string };
const raw = (
  s: Schemes,
  category: ErrorCategory,
  retry: RetryGuidance,
  schemeNote?: string,
): RawCodeEntry => ({
  ...(s.v ? { visa: s.v, visaCategory: s.vc ?? "n/a" } : {}),
  ...(s.m ? { mastercard: s.m } : {}),
  ...(s.d ? { discover: s.d } : {}),
  kind: "decline",
  category,
  retry,
  ...(schemeNote ? { schemeNote } : {}),
});
const rawKind = (s: Schemes, kind: CodeKind): RawCodeEntry => ({
  ...raw(s, "unknown", kind === "partial" ? "manual_review" : "unknown"),
  kind,
});

/**
 * Raw scheme response codes for Visa (69), Mastercard (46) and Discover (63),
 * carried in `refusalCode` when the merchant is configured for raw codes.
 * Worldpay notes that raw codes can come from third-party acquirers and may
 * not be listed. Cartes Bancaires and EFTPOS return no raw codes.
 */
export const RAW_SCHEME_CODES: Record<string, RawCodeEntry> = {
  "00": rawKind({ v: "Approved", vc: "approval", m: "Approved", d: "Approved" }, "approval"),
  "01": raw(
    { v: "Refer to issuer", vc: "4", m: "Refer to issuer", d: "Reserved" },
    "card_declined",
    "customer_action_required",
  ),
  "02": raw(
    { v: "Refer to issuer", vc: "4", d: "Reserved" },
    "card_declined",
    "customer_action_required",
  ),
  "03": raw(
    { v: "Invalid merchant", vc: "2", m: "Invalid merchant", d: "Invalid merchant" },
    "configuration",
    "do_not_retry",
  ),
  "04": raw(
    { v: "Pick up card, no fraud", vc: "1", m: "Capture card", d: "Capture card" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "05": raw(
    { v: "Do not honor", vc: "4", m: "Do not honor", d: "Do not honor" },
    "card_declined",
    "customer_action_required",
  ),
  "06": raw({ v: "Error", vc: "4" }, "unknown", "retry_conditionally"),
  "07": raw(
    { v: "Pick up, special condition, fraud account", vc: "1", d: "Pick up, special condition" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "08": rawKind({ m: "Honor with ID", d: "Reserved" }, "approval"),
  "10": rawKind(
    {
      v: "Partial approval",
      vc: "approval",
      m: "Partial approval",
      d: "Approved for partial amount",
    },
    "partial",
  ),
  "11": rawKind({ v: "Approved, VIP", vc: "approval", d: "Approved" }, "approval"),
  "12": raw(
    { v: "Invalid transaction", vc: "1", m: "Invalid transaction", d: "Invalid transaction" },
    "card_declined",
    "do_not_retry",
  ),
  "13": raw(
    {
      v: "Invalid amount or conversion overflow",
      vc: "4",
      m: "Invalid amount",
      d: "Invalid amount",
    },
    "invalid_amount",
    "do_not_retry",
  ),
  "14": raw(
    {
      v: "Invalid account number",
      vc: "1,3",
      m: "Invalid card number",
      d: "Invalid card number",
    },
    "card_declined",
    "customer_action_required",
  ),
  "15": raw(
    { v: "No such issuer", vc: "1", m: "Invalid issuer", d: "Reserved" },
    "card_declined",
    "do_not_retry",
  ),
  "19": raw(
    { v: "Re-enter transaction", vc: "2", d: "Re-enter transaction" },
    "provider_unavailable",
    "retry_conditionally",
  ),
  "21": raw({ v: "No action taken" }, "unknown", "manual_review"),
  "25": raw({ v: "Record not found" }, "invalid_request", "do_not_retry"),
  "28": raw({ v: "File temporarily unavailable" }, "provider_unavailable", "retry_conditionally"),
  "30": raw({ m: "Format error", d: "Format error" }, "invalid_request", "do_not_retry"),
  "31": raw({ d: "Bank not supported by switch" }, "card_declined", "do_not_retry"),
  ...Object.fromEntries(
    ["33", "34", "35", "36", "37"].map((c) => [
      c,
      rawKind({ d: "Reserved for future use" }, "reserved"),
    ]),
  ),
  "38": raw({ d: "PIN tries exceeded" }, "authentication_failed", "do_not_retry"),
  "39": raw(
    { v: "No credit account", vc: "4", d: "No credit account" },
    "card_declined",
    "customer_action_required",
  ),
  "40": raw({ d: "Function not supported" }, "payment_method_unavailable", "do_not_retry"),
  "41": raw(
    { v: "Lost card, pick up", vc: "1", m: "Lost card", d: "Lost card" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "43": raw(
    { v: "Stolen card, pick up", vc: "1", m: "Stolen card", d: "Stolen card" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "46": raw({ v: "Closed account", vc: "1" }, "card_declined", "do_not_retry"),
  "51": raw(
    { v: "Not sufficient funds", vc: "2", m: "Insufficient funds / over limit", d: "Decline" },
    "insufficient_funds",
    "retry_conditionally",
    "For Discover this code is a generic decline (card_declined).",
  ),
  "52": raw({ v: "No checking account", vc: "4" }, "card_declined", "customer_action_required"),
  "53": raw(
    { v: "No savings account", vc: "4", d: "No savings account" },
    "card_declined",
    "customer_action_required",
  ),
  "54": raw(
    { v: "Expired or missing expiry", vc: "3", m: "Expired card", d: "Expired card" },
    "card_declined",
    "customer_action_required",
  ),
  "55": raw(
    { v: "PIN incorrect or missing", vc: "3", m: "Invalid PIN", d: "Invalid PIN" },
    "authentication_failed",
    "customer_action_required",
  ),
  "56": raw({ d: "No card record" }, "card_declined", "do_not_retry"),
  "57": raw(
    {
      v: "Not permitted to cardholder",
      vc: "1",
      m: "Not permitted to issuer/cardholder",
      d: "Not permitted to issuer/cardholder",
    },
    "card_declined",
    "do_not_retry",
  ),
  "58": raw(
    {
      v: "Not allowed at terminal",
      vc: "4",
      m: "Not permitted to acquirer/terminal",
      d: "Not permitted to acquirer/terminal",
    },
    "configuration",
    "do_not_retry",
  ),
  "59": raw(
    { v: "Suspected fraud", vc: "2", d: "Suspected fraud" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "60": raw({ d: "Card acceptor contact acquirer" }, "configuration", "manual_review"),
  "61": raw(
    {
      v: "Exceeds approval amount limit",
      vc: "2",
      m: "Exceeds withdrawal amount limit",
      d: "Exceeds withdrawal amount limit",
    },
    "card_declined",
    "retry_conditionally",
  ),
  "62": raw(
    {
      v: "Restricted card, region or country",
      vc: "2",
      m: "Restricted card",
      d: "Restricted card",
    },
    "card_declined",
    "do_not_retry",
  ),
  "63": raw(
    { v: "Security violation", m: "Security violation", d: "Security violation" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "64": raw(
    { v: "Fails AML requirement", vc: "4", d: "Original amount incorrect" },
    "fraud_or_risk",
    "manual_review",
    "For Discover this code means the original amount is incorrect (invalid_amount, do not retry).",
  ),
  "65": raw(
    {
      v: "Exceeds withdrawal frequency limit",
      vc: "2",
      m: "Exceeds withdrawal count limit",
      d: "Exceeds withdrawal count limit",
    },
    "authentication_required",
    "customer_action_required",
  ),
  "66": raw({ d: "Call acquirer's security department" }, "fraud_or_risk", "manual_review"),
  "67": raw({ d: "Hard capture (ATM pick-up)" }, "fraud_or_risk", "do_not_retry"),
  "68": raw({ d: "Response received too late" }, "network_or_timeout", "retry_conditionally"),
  "70": raw(
    { v: "PIN data required", vc: "3", m: "Contact card issuer" },
    "authentication_required",
    "customer_action_required",
    "For Mastercard this code means contact the card issuer (card_declined).",
  ),
  "71": raw({ m: "PIN not changed" }, "authentication_failed", "do_not_retry"),
  "74": raw(
    { v: "Different value used for PIN encryption", vc: "4" },
    "configuration",
    "manual_review",
  ),
  "75": raw(
    { v: "PIN tries exceeded", vc: "2", m: "PIN tries exceeded", d: "PIN tries exceeded" },
    "authentication_failed",
    "do_not_retry",
  ),
  "76": raw(
    {
      v: "Unsolicited reversal, no original",
      m: 'Invalid "to" account',
      d: 'Invalid "to" account',
    },
    "card_declined",
    "do_not_retry",
    "For Visa this code is an unsolicited reversal without an original (invalid_request).",
  ),
  "77": raw(
    { m: 'Invalid "from" account', d: 'Invalid "from" account' },
    "card_declined",
    "do_not_retry",
  ),
  "78": raw(
    {
      v: "Blocked, first used or special condition",
      vc: "2",
      m: "Invalid account (general)",
      d: "Invalid account (general)",
    },
    "card_declined",
    "customer_action_required",
  ),
  "79": raw({ v: "Reversed by switch", vc: "4", m: "Life cycle" }, "unknown", "manual_review"),
  "80": raw(
    {
      v: "No financial impact, reversal of declined original",
      vc: "4",
      m: "System not available",
    },
    "provider_unavailable",
    "retry_conditionally",
    "For Visa this code reports a reversal of a declined original with no financial impact.",
  ),
  "81": raw(
    { v: "PIN cryptographic error", vc: "4", m: "Domestic debit not allowed" },
    "configuration",
    "manual_review",
  ),
  "82": raw(
    { v: "Negative CAM/dCVV/iCVV/CVV/CAVV/TAVV results", vc: "3", m: "Policy" },
    "card_declined",
    "customer_action_required",
  ),
  "83": raw(
    { m: "Fraud/security", d: "Domain restriction controls failure" },
    "fraud_or_risk",
    "do_not_retry",
  ),
  "84": raw({ m: "Invalid authorization life cycle" }, "invalid_request", "do_not_retry"),
  "85": rawKind(
    {
      v: "No reason to decline (AVS/CVV2/credit verification)",
      vc: "4",
      m: "Not declined, zero-amount",
      d: "No reason to decline",
    },
    "approval",
  ),
  "86": raw(
    { v: "Cannot verify PIN", vc: "2", m: "PIN validation not possible" },
    "authentication_failed",
    "customer_action_required",
  ),
  "87": raw(
    { m: "Purchase amount only, no cash back", d: "Network unavailable" },
    "invalid_amount",
    "do_not_retry",
    "For Discover this code means the network is unavailable (provider_unavailable, retry conditionally).",
  ),
  "88": raw({ m: "Cryptographic failure" }, "configuration", "manual_review"),
  "89": raw({ m: "Unacceptable PIN, retry" }, "authentication_failed", "customer_action_required"),
  "90": raw({ m: "Cutoff in progress" }, "provider_unavailable", "retry_conditionally"),
  "91": raw(
    {
      v: "Issuer unavailable or switch inoperative",
      vc: "2",
      m: "Issuer system inoperative",
      d: "Issuer system inoperative",
    },
    "provider_unavailable",
    "retry_conditionally",
  ),
  "92": raw(
    { v: "Cannot route", m: "Unable to route", d: "Unable to route" },
    "configuration",
    "do_not_retry",
  ),
  "93": raw(
    { v: "Violation of law", vc: "2", d: "Violation of law" },
    "card_declined",
    "do_not_retry",
  ),
  "94": raw(
    {
      v: "Duplicate transmission",
      m: "Duplicate transmission",
      d: "Duplicate transmission",
    },
    "duplicate_request",
    "do_not_retry",
  ),
  "96": raw(
    { v: "System malfunction", vc: "2", m: "System error", d: "System malfunction" },
    "provider_unavailable",
    "retry_conditionally",
  ),
  "1A": raw(
    {
      v: "Additional customer authentication required",
      vc: "3",
      d: "Customer authentication required",
    },
    "authentication_required",
    "customer_action_required",
  ),
  "1Z": raw({ m: "Issuer system inoperative" }, "provider_unavailable", "retry_conditionally"),
  "5C": raw({ v: "Not supported or blocked by issuer", vc: "2" }, "card_declined", "do_not_retry"),
  "6P": raw(
    { v: "Verification data failed", vc: "3" },
    "authentication_failed",
    "customer_action_required",
  ),
  "9G": raw(
    { v: "Blocked by cardholder, contact cardholder", vc: "2" },
    "card_declined",
    "customer_action_required",
  ),
  B1: raw({ v: "Surcharge not permitted (US acquirers)" }, "invalid_amount", "do_not_retry"),
  N0: raw({ v: "Force STIP", vc: "4" }, "unknown", "unknown"),
  N1: raw({ d: "System up" }, "unknown", "unknown"),
  N2: raw({ d: "Soft down" }, "provider_unavailable", "retry_conditionally"),
  N3: raw(
    { v: "Cash service not available", vc: "2", d: "System down" },
    "payment_method_unavailable",
    "do_not_retry",
    "For Discover this code means the system is down (provider_unavailable, retry conditionally).",
  ),
  N4: raw({ v: "Cash request over limit", vc: "2" }, "invalid_amount", "do_not_retry"),
  N7: raw(
    { v: "Declined for CVV2 failure", vc: "3", d: "Declined for AVS or CID mismatch" },
    "card_declined",
    "customer_action_required",
  ),
  N8: raw({ v: "Amount over pre-authorized amount" }, "invalid_amount", "do_not_retry"),
  P5: raw(
    { v: "PIN unblock/change declined", d: "PIN change/unblock failed" },
    "authentication_failed",
    "do_not_retry",
  ),
  P6: raw(
    { v: "Requested PIN unsafe", d: "New PIN not accepted" },
    "authentication_failed",
    "do_not_retry",
  ),
  Q1: raw({ v: "Card authentication failed" }, "authentication_failed", "customer_action_required"),
  R0: raw({ v: "Stop payment order", vc: "1" }, "card_declined", "do_not_retry"),
  R1: raw({ v: "Revocation of authorization order", vc: "1" }, "card_declined", "do_not_retry"),
  R2: raw({ v: "Does not qualify for Visa PIN" }, "payment_method_unavailable", "do_not_retry"),
  R3: raw({ v: "Revocation of all authorizations", vc: "1" }, "card_declined", "do_not_retry"),
  Z3: raw(
    { v: "Unable to go online, offline-declined", vc: "4" },
    "card_declined",
    "retry_conditionally",
  ),
};

export type AmexCodeEntry = {
  meaning: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
};

const amex = (meaning: string, category: ErrorCategory, retry: RetryGuidance): AmexCodeEntry => ({
  meaning,
  kind: "decline",
  category,
  retry,
});

/**
 * American Express raw codes (28). Categories follow the mapping of the
 * matching Visa/Mastercard/Discover rows and are decoded with possible
 * confidence. Amex 106 collides with Worldpay code 106.
 */
export const AMEX_RAW_CODES: Record<string, AmexCodeEntry> = {
  "00": { meaning: "Approved", kind: "approval", category: "unknown", retry: "unknown" },
  "01": { meaning: "Approve with ID", kind: "approval", category: "unknown", retry: "unknown" },
  "02": {
    meaning: "Partial approval (prepaid only)",
    kind: "partial",
    category: "unknown",
    retry: "manual_review",
  },
  "100": amex("Deny", "card_declined", "customer_action_required"),
  "101": amex("Expired card or invalid expiry", "card_declined", "customer_action_required"),
  "106": amex("PIN attempts exceeded", "authentication_failed", "do_not_retry"),
  "109": amex("Invalid merchant", "configuration", "do_not_retry"),
  "110": amex("Invalid amount", "invalid_amount", "do_not_retry"),
  "111": amex("Invalid account", "card_declined", "customer_action_required"),
  "115": amex("Function not supported", "payment_method_unavailable", "do_not_retry"),
  "116": amex("Not sufficient funds", "insufficient_funds", "retry_conditionally"),
  "117": amex("Invalid PIN", "authentication_failed", "customer_action_required"),
  "119": amex("Cardmember not enrolled / not permitted", "card_declined", "do_not_retry"),
  "121": amex("Limit exceeded", "card_declined", "retry_conditionally"),
  "122": amex("Invalid card security code", "card_declined", "customer_action_required"),
  "125": amex("Invalid effective date", "card_declined", "customer_action_required"),
  "130": amex(
    "Additional customer identification required",
    "authentication_required",
    "customer_action_required",
  ),
  "181": amex("Format error", "invalid_request", "do_not_retry"),
  "183": amex("Invalid currency code", "invalid_request", "do_not_retry"),
  "187": amex("Deny, new card issued", "card_declined", "customer_action_required"),
  "189": amex("Deny, cancelled or closed merchant", "configuration", "do_not_retry"),
  "190": amex("National ID mismatch", "card_declined", "customer_action_required"),
  "200": amex("Deny, pick up card", "fraud_or_risk", "do_not_retry"),
  "900": {
    meaning: "Accepted, ATC synchronization",
    kind: "approval",
    category: "unknown",
    retry: "unknown",
  },
  "909": amex(
    "System malfunction (cryptographic error)",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "912": amex("Issuer not available", "provider_unavailable", "retry_conditionally"),
  "977": amex("Invalid payment plan", "invalid_request", "do_not_retry"),
  "978": amex("Invalid payment times", "invalid_request", "do_not_retry"),
};

export type ErrorNameEntry = {
  /** HTTP status(es) the documentation pairs with this name. */
  http: string;
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Where the name is documented. */
  source: "error_responses" | "validation" | "api_reference";
  note?: string;
};

const en = (
  http: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  source: ErrorNameEntry["source"],
  note?: string,
): ErrorNameEntry => ({ http, meaning, category, retry, source, ...(note ? { note } : {}) });

const v = (meaning: string, retry: RetryGuidance = "do_not_retry") =>
  en("400", `Field validation: ${meaning}`, "invalid_request", retry, "validation");

/**
 * errorName values (49): 13 top-level names from the error responses page, 20
 * field validation names used inside `validationErrors`, and 16 names found
 * only in API references and examples.
 */
export const ERROR_NAMES: Record<string, ErrorNameEntry> = {
  headerIsMissing: en(
    "400 (406 in the Payments API example)",
    "A mandatory header is missing; its name is in headerName",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  headerHasInvalidValue: en(
    "400, 406, 415",
    "A header has an unexpected value",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  bodyIsEmpty: en(
    "400",
    "The request body is empty",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  bodyIsNotJson: en(
    "400",
    "The request body is not valid JSON",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  bodyDoesNotMatchSchema: en(
    "400",
    "Field validation errors; see validationErrors",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  urlContainsInvalidValue: en(
    "400",
    "Invalid path or query parameter",
    "invalid_request",
    "do_not_retry",
    "error_responses",
  ),
  entityIsNotConfigured: en(
    "400",
    "The merchant entity is not configured for use",
    "configuration",
    "do_not_retry",
    "error_responses",
  ),
  paymentInstrumentIsNotSupported: en(
    "400",
    "The payment instrument is not configured for the entity",
    "configuration",
    "do_not_retry",
    "error_responses",
  ),
  underlyingPaymentInstrumentHasExpired: en(
    "400",
    "The stored payment instrument has expired",
    "card_declined",
    "customer_action_required",
    "error_responses",
  ),
  currencyIsNotSupported: en(
    "400",
    "The currency is not configured for the entity",
    "configuration",
    "do_not_retry",
    "error_responses",
  ),
  merchantIsNotConfigured: en(
    "400",
    "The merchant is not configured for an attribute in the request",
    "configuration",
    "do_not_retry",
    "error_responses",
  ),
  internalErrorOccurred: en(
    "500",
    "Internal or downstream error",
    "provider_unavailable",
    "retry_conditionally",
    "error_responses",
  ),
  // The research suggests a technical retry here. Worldpay describes 5xx
  // errors as server-side and most commonly timeouts, so the outcome of the
  // original request is treated as unknown.
  serviceUnavailable: en(
    "503",
    "The service cannot fulfil the request now",
    "provider_unavailable",
    "retry_conditionally",
    "error_responses",
  ),

  fieldIsMissing: v("a required field is missing"),
  fieldMustBeString: v("the field must be a string"),
  fieldMustBeNumber: v("the field must be a number"),
  fieldMustBeInteger: v("the field must be an integer"),
  fieldMustBeBoolean: v("the field must be a boolean"),
  fieldMustBeObject: v("the field must be an object"),
  fieldMustBeArray: v("the field must be an array"),
  fieldIsNull: v("the field is null"),
  fieldIsEmpty: v("the field is empty"),
  fieldHasInvalidValue: v("the field has an invalid value"),
  fieldIsNotAllowed: v("the field is not allowed"),
  numberIsTooSmall: v("the number is too small"),
  numberIsTooLarge: v("the number is too large"),
  integerIsTooSmall: v("the integer is too small"),
  integerIsTooLarge: v("the integer is too large"),
  stringIsTooShort: v("the string is too short"),
  stringIsTooLong: v("the string is too long"),
  stringFailedRegexCheck: v("the string does not match the expected pattern"),
  panFailedLuhnCheck: v("the card number failed the Luhn check", "customer_action_required"),
  dateHasInvalidFormat: v("the date has an invalid format"),

  accessDenied: en(
    "401 (403 in Tokens)",
    "Access to the resource was denied",
    "configuration",
    "do_not_retry",
    "api_reference",
  ),
  unauthorized: en(
    "401",
    "Invalid authentication (APMs)",
    "configuration",
    "do_not_retry",
    "api_reference",
  ),
  endpointNotFound: en(
    "404",
    "Endpoint not found",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  resourceNotFound: en(
    "404",
    "Resource not found (Tokens)",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  internalServerError: en(
    "500",
    "Server error (Card Payments v7)",
    "provider_unavailable",
    "retry_conditionally",
    "api_reference",
  ),
  paymentNotFound: en(
    "404 (400 in APMs)",
    "The payment does not exist",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  transactionReferenceIsADuplicate: en(
    "400",
    "The transaction reference was already used",
    "duplicate_request",
    "do_not_retry",
    "api_reference",
  ),
  transactionHasAlreadyBeenProcessed: en(
    "n/a",
    "The transaction was already processed (Payment Queries failed event)",
    "duplicate_request",
    "do_not_retry",
    "api_reference",
  ),
  orderNotReady: en(
    "400",
    "The transaction is not ready (APMs)",
    "invalid_request",
    "retry_conditionally",
    "api_reference",
  ),
  tokenDoesNotExist: en(
    "400",
    "The token was not found (APMs)",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  invalidTransactionReference: en(
    "400",
    "The transaction reference format is invalid (APMs, Bizum: [a-zA-Z0-9]{4,12})",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  channelIsNotSupported: en(
    "n/a",
    "The channel is not supported (Payment Queries failed event)",
    "configuration",
    "do_not_retry",
    "api_reference",
  ),
  cardNumberIsNotRecognized: en(
    "n/a",
    "The card number is not recognized (Payment Queries failed event)",
    "card_declined",
    "customer_action_required",
    "api_reference",
  ),
  invalidPageSize: en(
    "400",
    "The page size is not valid (Payment Queries)",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  startDateTooOld: en(
    "400",
    "The start date is older than 1 year (Payment Queries)",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
  invalidLast4Digits: en(
    "400",
    "The last four digits are not valid (Payment Queries)",
    "invalid_request",
    "do_not_retry",
    "api_reference",
  ),
};

export type EventInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  note?: string;
};

const ev = (
  stage: LifecycleStage,
  outcome: Outcome,
  meaning: string,
  note?: string,
): EventInfo => ({
  stage,
  outcome,
  meaning,
  ...(note ? { note } : {}),
});

/**
 * Events webhook `eventDetails.type` values (26), by `eventDetails.classification`.
 * Worldpay's "settle" request is the capture: `sentForSettlement` and
 * `settlementFailed` are capture steps, `settled` says Worldpay received the funds.
 */
export const WEBHOOK_EVENT_TYPES: Record<
  "payment" | "payout" | "chargeback",
  Record<string, EventInfo>
> = {
  payment: {
    sentForAuthorization: ev("authorization", "pending", "Authorization requested from the issuer"),
    authorized: ev("authorization", "success", "Approved; funds reserved"),
    refused: ev(
      "authorization",
      "failure",
      "Declined by a third party",
      "The refused event carries no refusal code; the reason is in the synchronous response or in Payment Queries.",
    ),
    error: ev("payment", "failure", "Payment not completed; the customer may retry"),
    sentForSettlement: ev(
      "capture",
      "pending",
      "Capture requested (by the merchant or automatically)",
    ),
    settled: ev(
      "settlement",
      "success",
      "Worldpay received the funds",
      "Sent only in certain use cases.",
    ),
    settlementFailed: ev(
      "capture",
      "failure",
      "Settlement not processed",
      "Sent only in certain use cases.",
    ),
    cancelled: ev("void", "success", "Stopped before settlement"),
    expired: ev(
      "cancellation",
      "failure",
      "The authorization period ended without a settle or cancel",
    ),
    sentForRefund: ev(
      "refund",
      "pending",
      "Refund requested",
      "Also used for basic disbursement payouts. Online refunds carry an authorization.",
    ),
    refunded: ev(
      "refund",
      "success",
      "The issuer received the refund",
      "Sent only in certain use cases.",
    ),
    refundFailed: ev("refund", "failure", "Refund not processed; funds returned to the merchant"),
    tokenCreated: ev("other", "success", "Token created"),
    settlementInstructed: ev("settlement", "pending", "Settlement instructed (Pix only)"),
    settlementRejected: ev("settlement", "failure", "Settlement rejected (Pix only)"),
    topUpAccepted: ev("other", "success", "Top-up accepted (Pix only)"),
    topUpRejected: ev("other", "failure", "Top-up rejected (Pix only)"),
    chargedBack: ev("dispute", "failure", "Charged back (Klarna only)"),
    cancelledByCustomer: ev("cancellation", "failure", "Cancelled by the customer (Klarna only)"),
    requestExpired: ev(
      "cancellation",
      "failure",
      "The APM payment request expired because the customer was inactive",
    ),
  },
  payout: {
    requested: ev("payout", "pending", "Card payout requested"),
    pending: ev(
      "payout",
      "pending",
      "Sent to Visa Direct; usually resolves within 45 minutes, error after 48 hours",
    ),
    approved: ev(
      "payout",
      "pending",
      "Payout approved",
      "Funds arrive within 30 minutes with Fast Access, otherwise in 3 to 5 working days; disbursed confirms the payout.",
    ),
    refused: ev("payout", "failure", "Payout refused"),
    disbursed: ev("payout", "success", "Payout disbursed"),
  },
  chargeback: {
    informationRequested: ev(
      "dispute",
      "pending",
      "The issuer requested information; disputed funds are held",
      "Sent only in certain use cases.",
    ),
  },
};

/** Synchronous `outcome` values of the Payments API, Card Payments v7 and APMs. */
export const OUTCOMES: Record<string, EventInfo & { apis: string }> = {
  authorized: {
    ...ev("authorization", "success", "Authorized"),
    apis: "payments, card_payments, apms",
  },
  refused: { ...ev("authorization", "failure", "Refused"), apis: "payments, card_payments" },
  sentForSettlement: {
    ...ev(
      "capture",
      "pending",
      "Sent for settlement",
      "Returned by a settle request, or by an authorization request when automatic settlement is on.",
    ),
    apis: "payments, apms",
  },
  "Sent for Settlement": {
    ...ev(
      "capture",
      "pending",
      "Sent for settlement",
      "Card Payments v7 spelling; returned only when automatic settlement was requested.",
    ),
    apis: "card_payments",
  },
  sentForCancellation: {
    ...ev(
      "void",
      "pending",
      "Sent for cancellation",
      "With automatic settlement, an AVS or CVC notMatched result leads to an automatic cancellation unless disabled.",
    ),
    apis: "payments",
  },
  sentForRefund: { ...ev("refund", "pending", "Sent for refund"), apis: "payments, apms" },
  sentForPartialRefund: { ...ev("refund", "pending", "Sent for partial refund"), apis: "payments" },
  sentForReversal: { ...ev("reversal", "pending", "Sent for reversal"), apis: "payments" },
  "3dsDeviceDataRequired": {
    ...ev("authentication", "pending", "3DS device data collection required"),
    apis: "payments",
  },
  "3dsChallenged": {
    ...ev("authentication", "pending", "3DS challenge required"),
    apis: "payments",
  },
  "3dsAuthenticationFailed": {
    ...ev("authentication", "failure", "3DS authentication failed"),
    apis: "payments",
  },
  "3dsUnavailable": {
    ...ev(
      "authentication",
      "unknown",
      "3DS authentication unavailable",
      "Authentication could not be performed; this outcome does not say whether the payment will proceed.",
    ),
    apis: "payments",
  },
  fraudHighRisk: {
    ...ev(
      "payment",
      "failure",
      "FraudSight assessed the payment as high risk",
      "Worldpay advises to stop the transaction before payment.",
    ),
    apis: "payments",
  },
  pending: { ...ev("payment", "pending", "Pending (most APMs)"), apis: "apms" },
  sentForAuthorization: {
    ...ev("authorization", "pending", "Sent for authorization"),
    apis: "apms",
  },
};

const q = (stage: LifecycleStage, prefix: string, label: string): Record<string, EventInfo> => ({
  [`${prefix}Requested`]: ev(stage, "pending", `${label} requested`),
  [`${prefix}Succeeded`]: ev(stage, "success", `${label} succeeded`),
  [`${prefix}Refused`]: ev(stage, "failure", `${label} refused`),
  [`${prefix}Failed`]: ev(stage, "failure", `${label} failed with an error`),
  [`${prefix}TimedOut`]: ev(stage, "unknown", `${label} timed out; the outcome is unknown`),
});
const sub = (stage: LifecycleStage, prefix: string, label: string): Record<string, EventInfo> => ({
  [`${prefix}Requested`]: ev(stage, "pending", `${label} requested`),
  [`${prefix}RequestSubmitted`]: ev(stage, "pending", `${label} request submitted`),
  [`${prefix}RequestSubmissionFailed`]: ev(stage, "failure", `${label} request submission failed`),
  [`${prefix}RequestSubmissionTimedOut`]: ev(
    stage,
    "unknown",
    `${label} request submission timed out; the outcome is unknown`,
  ),
});

/** Payment Queries v1 `lastEvent` and `events[].eventName` values (31). */
export const QUERY_EVENT_NAMES: Record<string, EventInfo> = {
  ...q("authorization", "authorization", "Authorization"),
  ...q("authorization", "incrementalAuthorization", "Incremental authorization"),
  ...q("payment", "sale", "Sale"),
  ...sub("capture", "settlement", "Settlement"),
  ...sub("refund", "refund", "Refund"),
  ...sub("void", "cancellation", "Cancellation"),
  ...sub("reversal", "reversal", "Reversal"),
};

/**
 * Card Payments v7 `lastEvent` values of the deprecated events query. One enum
 * in the OpenAPI file spells `Send for Cancellation`; both spellings are kept.
 */
export const CARD_PAYMENTS_LAST_EVENTS: Record<string, EventInfo> = {
  Authorized: ev("authorization", "success", "Authorized"),
  Refused: ev("authorization", "failure", "Refused"),
  "Sent for Settlement": ev("capture", "pending", "Sent for settlement"),
  "Sent for Refund": ev("refund", "pending", "Sent for refund"),
  "Sent for Cancellation": ev("void", "pending", "Sent for cancellation"),
  "Send for Cancellation": ev("void", "pending", "Sent for cancellation (alternative spelling)"),
  "Refund failed": ev("refund", "failure", "Refund failed"),
  "Settlement failed": ev("capture", "failure", "Settlement failed"),
  Settled: ev("settlement", "success", "Settled"),
  Refunded: ev("refund", "success", "Refunded"),
  Error: ev("payment", "failure", "Error"),
  Expired: ev("cancellation", "failure", "Expired"),
};

/** Documented enum values of the response sub-objects that are copied as attributes. */
export const RISK_FACTOR_TYPES = new Set(["cvc", "avs", "nameInquiry", "riskProfile"]);
export const RISK_FACTOR_RISKS = new Set([
  "notChecked",
  "notMatched",
  "notSupplied",
  "partialMatched",
  "notSupported",
  "verificationFailed",
]);
export const RISK_FACTOR_DETAILS = new Set([
  "address",
  "postcode",
  "firstName",
  "middleName",
  "lastName",
]);
export const EXEMPTION_RESULTS = new Set(["honored", "outOfScope", "rejected"]);
export const EXEMPTION_REASONS = new Set([
  "highRisk",
  "invalid",
  "issuerHonored",
  "issuerRejected",
  "notSubscribed",
  "oneLegOut",
  "unsupportedAcquirer",
]);
export const FRAUD_OUTCOME = /^(?:lowRisk|highRisk|review)(?:\(silentMode\))?$/;

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer, authenticate, correct their details, or use another card).",
  retry_conditionally:
    "A later attempt may succeed. Check the payment's current state first (Payment Queries, GET /paymentQueries/payments/{paymentId}) so that a new request does not duplicate an operation that took effect.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry with backoff.",
  manual_review: "Review the payment manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the customer to use another card or contact their card issuer.",
  authentication_required: "Send the payment again with 3DS authentication.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another card.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds:
    "Ask the customer to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the payment and the risk outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Check the payment's current state with Payment Queries before sending a new request.",
  network_or_timeout:
    "Check the payment's current state with Payment Queries before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the merchant entity, credentials and account configuration, or ask your Worldpay Implementation Manager.",
  unknown: "Contact Worldpay support with the payment id and the WP-CorrelationId response header.",
};
