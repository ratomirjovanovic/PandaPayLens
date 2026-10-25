/**
 * EBANX code, status and notification knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/ebanx.md, which cites
 * EBANX's public documentation and OpenAPI files, verified 2026-10-25:
 *
 * Pay-in API error codes:      https://docs.ebanx.com/docs/pay-in/dev-tools/response-codes/api-error-codes
 * Card and APM codes:          https://docs.ebanx.com/docs/pay-in/dev-tools/response-codes/card-error-codes
 *                              https://docs.ebanx.com/docs/pay-in/dev-tools/response-codes/apm-error-codes
 * ISO 8583 and MAC codes:      https://docs.ebanx.com/docs/pay-in/dev-tools/response-codes/iso8583-codes
 * Pay-in OpenAPI enumerations: https://docs.ebanx.com/api-reference/pay-in/openapi.json
 * Payment notifications:       https://docs.ebanx.com/docs/pay-in/management/status-and-retrieval/payment-notifications
 * Chargebacks:                 https://docs.ebanx.com/docs/pay-in/management/post-payment/chargeback-dispute
 * Payout codes and statuses:   https://docs.ebanx.com/docs/payout/create-payout/errors/payout-error-codes
 *                              https://docs.ebanx.com/docs/payout/general/notification
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions; where EBANX gives advice ("retry at any time", "do not retry")
 * it is reflected. EBANX does not say these lists are complete.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.ebanx.com/docs";
const CODES = `${DOCS}/pay-in/dev-tools/response-codes`;
export const API_ERRORS_URL = `${CODES}/api-error-codes`;
export const CARD_ERRORS_URL = `${CODES}/card-error-codes`;
export const APM_ERRORS_URL = `${CODES}/apm-error-codes`;
export const ISO8583_URL = `${CODES}/iso8583-codes`;
export const ECI_URL = `${CODES}/eci-responses`;
export const SYSTEM_FAILURES_URL = `${DOCS}/pay-in/dev-tools/sandbox-simulation/system-failures`;
export const PAYIN_OPENAPI_URL = "https://docs.ebanx.com/api-reference/pay-in/openapi.json";
export const PAYOUT_OPENAPI_URL = "https://docs.ebanx.com/api-reference/payout/openapi.json";
export const NOTIFICATIONS_URL = `${DOCS}/pay-in/management/status-and-retrieval/payment-notifications`;
export const ENROLLMENT_NOTIFICATION_URL = `${DOCS}/pay-in/management/status-and-retrieval/enrollment-notification`;
export const RETRIEVE_PAYMENT_URL = `${DOCS}/pay-in/management/status-and-retrieval/retrieve-payment`;
export const REFUND_URL = `${DOCS}/pay-in/management/post-payment/refund-payment`;
export const CANCEL_URL = `${DOCS}/pay-in/management/post-payment/cancel-payment`;
export const CHARGEBACK_URL = `${DOCS}/pay-in/management/post-payment/chargeback-dispute`;
export const MED_URL = `${DOCS}/pay-in/management/post-payment/med-pix-overview`;
export const CREDIT_CARDS_URL = `${DOCS}/pay-in/processing/payment-methods/multi-country/cards/credit-cards`;
export const PIX_AUTOMATICO_ERRORS_URL = `${DOCS}/pay-in/processing/payment-methods/country-specific/brazil/pix-automatico/canceling-and-errors/error-scenarios`;
export const DIRECT_API_URL = `${DOCS}/pay-in/solution/integration-methods/direct-api`;
export const PAYOUT_ERRORS_URL = `${DOCS}/payout/create-payout/errors/payout-error-codes`;
export const PAYOUT_NOTIFICATION_URL = `${DOCS}/payout/general/notification`;
export const PAYOUT_CONSULT_URL = `${DOCS}/payout/general/consult-payout`;
export const PAYOUT_BALANCE_URL = `${DOCS}/payout/balance/consult-balance`;
export const PARTNERS_URL = `${DOCS}/pay-in/processing/partners-and-connections/channels-and-partners`;
export const BRAINTREE_URL = `${DOCS}/pay-in/processing/partners-and-connections/braintree`;
export const WORLDPAY_URL = `${DOCS}/pay-in/processing/partners-and-connections/worldpay`;
export const API_ENDPOINTS_URL = `${DOCS}/get-started/api-endpoints`;
export const API_OPERABILITY_URL = `${DOCS}/get-started/api-operability`;

/**
 * Where a pay-in code is documented: P the API error page, O the pay-in
 * OpenAPI enumerations, S the sandbox system-failures page, X the Pix
 * Automatico error page, C the chargeback page.
 */
export type CodeSource = "P" | "O" | "S" | "X" | "C";

export type CodeEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  sources?: readonly CodeSource[];
  note?: string;
};

const IR: ErrorCategory = "invalid_request";
const IA: ErrorCategory = "invalid_amount";
const CFG: ErrorCategory = "configuration";
const DUP: ErrorCategory = "duplicate_request";
const FR: ErrorCategory = "fraud_or_risk";
const PMU: ErrorCategory = "payment_method_unavailable";
const PU: ErrorCategory = "provider_unavailable";
const NT: ErrorCategory = "network_or_timeout";
const CD: ErrorCategory = "card_declined";
const UNK: ErrorCategory = "unknown";
const AF: ErrorCategory = "authentication_failed";
const AR: ErrorCategory = "authentication_required";
const NSF: ErrorCategory = "insufficient_funds";
const RL: ErrorCategory = "rate_limiting";

const DNR: RetryGuidance = "do_not_retry";
const CAR: RetryGuidance = "customer_action_required";
const RC: RetryGuidance = "retry_conditionally";
const SAFE: RetryGuidance = "safe_to_retry_technical_request";
const MR: RetryGuidance = "manual_review";

function e(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  src?: string,
  note?: string,
): CodeEntry {
  const sources = src ? (src.split(",").map((s) => s.trim()) as CodeSource[]) : undefined;
  return {
    meaning,
    category,
    retry,
    ...(sources ? { sources } : {}),
    ...(note ? { note } : {}),
  };
}

// ---------------------------------------------------------------------------
// Pay-in API error codes (`status_code` with `status: "ERROR"`)
// ---------------------------------------------------------------------------

/** 4.1 Authentication, parser and request-level codes (31). */
const REQUEST_LEVEL: Record<string, CodeEntry> = {
  "BP-SA-1": e("integration_key is missing", CFG, DNR, "P,O"),
  "BP-SA-2": e("integration_key is invalid or unknown", CFG, DNR, "P,O"),
  "BP-SA-3": e("The merchant account is inactive", CFG, MR, "P,O"),
  "BP-SA-4": e("A test account was used against production", CFG, DNR, "P,O"),
  "BP-SA-5": e("A production account was used against the sandbox", CFG, DNR, "P,O"),
  "BP-DPAR-1": e("The request body is empty", IR, DNR, "P,O"),
  "BP-DPAR-2": e("The request body is not valid JSON", IR, DNR, "P,O"),
  "BP-DPAR-3": e("integration_key is missing (parser stage)", CFG, DNR, "P,O"),
  "BP-DPAR-4": e("integration_key was rejected (parser stage)", CFG, DNR, "P,O"),
  "BP-DPAR-5": e("The merchant account is inactive (parser stage)", CFG, MR, "P,O"),
  "BP-DPAR-6": e("An account limited to testing was used in production", CFG, DNR, "P,O"),
  "BP-DPAR-7": e("A production account was used for testing", CFG, DNR, "P,O"),
  "DA-0": e("Unknown error; EBANX asks merchants to contact its integration team", UNK, MR, "P,O"),
  "DA-1": e("operation is empty (the OpenAPI adds: or the JSON is invalid)", IR, DNR, "P,O"),
  "DA-3": e("Too many requests; try later", RL, RC, "O"),
  "RP-1": e("The payment page request body is empty", IR, DNR, "P"),
  "RP-2": e("The JSON is nested too deeply", IR, DNR, "P"),
  "RP-3": e("The JSON is malformed", IR, DNR, "P"),
  "RP-4": e("The JSON has an unexpected control character (encoding problem)", IR, DNR, "P"),
  "RP-5": e("JSON syntax error", IR, DNR, "P"),
  "RP-6": e("The JSON has invalid UTF-8", IR, DNR, "P"),
  "RP-7": e("JSON error of unknown kind", IR, DNR, "P"),
  "RP-8": e("integration_key is missing (payment page)", CFG, DNR, "P"),
  "RF-1": e("The payment already exists (payment page; same merchant payment code)", DUP, DNR, "P"),
  "BP-CH-1": e("The payment type group is not active for the merchant", CFG, DNR, "P"),
  "BP-MF-1": e(
    "No merchant fee spread is configured for this country, entity type and method",
    CFG,
    MR,
    "P",
  ),
  "BP-ENC-02": e("JWE-encrypted card data is invalid or cannot be decrypted", IR, DNR, "O"),
  "BP-GP-2": e("The Google Pay payload is invalid", IR, DNR, "O"),
  "BP-3DSR-10": e("redirect_url is required for 3DS authentication (token endpoint)", IR, DNR, "O"),
  "BP-DMO-1": e("The payment to modify was not found", IR, DNR, "P"),
  "BP-DMO-2": e("Only OP payments can be modified", IR, DNR, "P"),
};

/** 4.2 `BP-DR-*` payment creation codes (197). */
const DIRECT: Record<string, CodeEntry> = {
  "BP-DR-0": e(
    "A payment with this merchant_payment_code already exists (the message gives its date and status)",
    DUP,
    DNR,
    "P,O",
  ),
  "BP-DR-1": e("mode must be full or iframe", IR, DNR, "P"),
  "BP-DR-2": e("The payment object is missing", IR, DNR, "P,O"),
  "BP-DR-3": e("payment.currency_code is missing", IR, DNR, "P,O"),
  "BP-DR-4": e(
    "The currency is not active (the OpenAPI adds: or conversion is not available)",
    CFG,
    DNR,
    "P,O",
  ),
  "BP-DR-5": e("payment.amount_total is missing", IR, DNR, "P,O"),
  "BP-DR-6": e(
    "The amount is below the minimum (the OpenAPI adds: or breaks a currency rule)",
    IA,
    DNR,
    "P,O",
  ),
  "BP-DR-7": e("The amount is above the maximum", IA, DNR, "P,O"),
  "BP-DR-8": e("Items plus shipping amount differ from amount_total", IA, DNR, "P,O"),
  "BP-DR-9": e("merchant_payment_code is missing", IR, DNR, "P"),
  "BP-DR-10": e("merchant_payment_code is longer than 40 characters", IR, DNR, "P,O"),
  "BP-DR-11": e("order_number is longer than 40 characters", IR, DNR, "P,O"),
  "BP-DR-12": e("A parameter is longer than allowed (the page says 20 characters)", IR, DNR, "P,O"),
  "BP-DR-13": e("The customer name is missing", IR, CAR, "P,O"),
  "BP-DR-14": e("The customer name is longer than 100 characters", IR, CAR, "P,O"),
  "BP-DR-15": e("The customer email is missing", IR, CAR, "P,O"),
  "BP-DR-16": e("The customer email is longer than 100 characters", IR, CAR, "P,O"),
  "BP-DR-17": e("The customer email is not valid", IR, CAR, "P,O"),
  "BP-DR-18": e(
    "The customer is suspended at EBANX; contact support if this is unexpected",
    FR,
    MR,
    "P,O",
  ),
  "BP-DR-19": e("birth_date is missing", IR, CAR, "P"),
  "BP-DR-20": e("birth_date is not a valid dd/MM/yyyy date", IR, CAR, "P,O"),
  "BP-DR-21": e("The customer is younger than 16", IR, DNR, "P,O"),
  "BP-DR-22": e("The customer document (tax id) is missing", IR, CAR, "P,O"),
  "BP-DR-23": e("The customer document is not valid for the country", IR, CAR, "P,O"),
  "BP-DR-24": e("zipcode is missing", IR, CAR, "P,O"),
  "BP-DR-25": e("address is missing (the OpenAPI adds: or invalid)", IR, CAR, "P,O"),
  "BP-DR-26": e("street_number is missing", IR, CAR, "P,O"),
  "BP-DR-27": e("city is missing", IR, CAR, "P,O"),
  "BP-DR-28": e("state is missing", IR, CAR, "P,O"),
  "BP-DR-29": e("state is not a valid state code", IR, CAR, "P,O"),
  "BP-DR-30": e("amount_total is not a number", IA, DNR, "O"),
  "BP-DR-31": e("phone_number is missing", IR, CAR, "P,O"),
  "BP-DR-32": e("phone_number is not valid", IR, CAR, "P,O"),
  "BP-DR-33": e("The instalment value is invalid (single value)", IR, DNR, "P,O"),
  "BP-DR-34": e("The instalment value is invalid (range)", IR, DNR, "P,O"),
  "BP-DR-35": e(
    "payment_type_code is invalid (token endpoint: card BIN not found)",
    IR,
    DNR,
    "P,O",
  ),
  "BP-DR-36": e("The payment type is not active for the merchant", CFG, DNR, "P,O"),
  "BP-DR-37": e(
    "The amount differs from the enrollment's fixed amount (Pix Automatico)",
    IA,
    DNR,
    "O",
  ),
  "BP-DR-38": e("The payment type is not allowed in Direct API full mode", CFG, DNR, "P,O"),
  "BP-DR-39": e("The CPF does not match the customer's name and birth date", IR, CAR, "P,O"),
  "BP-DR-40": e(
    "The customer's monthly (the OpenAPI adds: or per-payment) amount limit is exceeded",
    IA,
    CAR,
    "P,O",
  ),
  "BP-DR-41": e("person_type is invalid", IR, DNR, "P,O"),
  "BP-DR-42": e("The responsible object is missing (company payer)", IR, CAR, "P,O"),
  "BP-DR-43": e("responsible.name is missing", IR, CAR, "P,O"),
  "BP-DR-44": e("responsible.document is missing", IR, CAR, "P,O"),
  "BP-DR-45": e("responsible.birth_date is missing", IR, CAR, "P,O"),
  "BP-DR-46": e(
    "The company representative's CPF, name and birth date do not match",
    IR,
    CAR,
    "P,O",
  ),
  "BP-DR-47": e("directdebit.bank_account is longer than 10 characters", IR, CAR, "P,O"),
  "BP-DR-48": e("The card object is missing", IR, DNR, "P,O"),
  "BP-DR-49": e("The card number is missing", IR, CAR, "P,O"),
  "BP-DR-50": e(
    "merchant_payment_code or order_number has non-printable or non-ASCII characters",
    IR,
    DNR,
    "P,O",
  ),
  "BP-DR-51": e("The cardholder name is missing", IR, CAR, "P,O"),
  "BP-DR-53": e("card_cvv_mode must be recurrent or provided", IR, DNR, "O"),
  "BP-DR-54": e("The CVV is missing", IR, CAR, "P,O"),
  "BP-DR-55": e("The CVV is too long or invalid", IR, CAR, "P,O"),
  "BP-DR-56": e("The card expiry date is missing", IR, CAR, "P,O"),
  "BP-DR-57": e("due_date is not in dd/MM/yyyy format", IR, DNR, "P,O,X"),
  "BP-DR-58": e(
    "due_date is further away than allowed (Pix Automatico: more than 10 days)",
    IR,
    DNR,
    "P,O,X",
  ),
  "BP-DR-59": e(
    "due_date is sooner than allowed (Pix Automatico: less than 2 days)",
    IR,
    DNR,
    "P,O,X",
  ),
  "BP-DR-60": e(
    "The Pix Automatico merchant_enrollment_code is invalid or not active",
    IR,
    DNR,
    "O,S,X",
  ),
  "BP-DR-61": e("The card token could not be created", UNK, MR, "P,O"),
  "BP-DR-62": e("Recurring payments are not enabled for the merchant", CFG, DNR, "P"),
  "BP-DR-63": e("The token was not found for this acquirer", IR, DNR, "P"),
  "BP-DR-64": e("The card token was not found", IR, DNR, "P,O"),
  "BP-DR-65": e("The custom token value is already used by another card", DUP, DNR, "P,O"),
  "BP-DR-66": e("The custom token length is outside 32 to 128 characters", IR, DNR, "P,O"),
  "BP-DR-67": e(
    "The card expiry is invalid (the OpenAPI adds: token expired or card invalid)",
    IR,
    CAR,
    "P,O",
  ),
  "BP-DR-68": e("directdebit.bank_account is missing", IR, CAR, "P,O"),
  "BP-DR-69": e("directdebit.bank_agency is longer than 10 characters", IR, CAR, "P,O"),
  "BP-DR-70": e("directdebit.bank_agency is missing", IR, CAR, "P,O"),
  "BP-DR-71": e("directdebit.bank_code is longer than 5 characters", IR, CAR, "P,O"),
  "BP-DR-72": e("directdebit.bank_code is missing", IR, CAR, "P,O"),
  "BP-DR-73": e("The directdebit object is required for this method", IR, DNR, "P,O"),
  "BP-DR-75": e(
    "The card number is invalid (token endpoint: fails Luhn or format)",
    IR,
    CAR,
    "P,O",
  ),
  "BP-DR-76": e("bank_details or bank_details.bank_code is required for this method", IR, CAR, "O"),
  "BP-DR-77": e(
    "The country is not enabled (bank list: or no banks for this country and method)",
    CFG,
    DNR,
    "P,O",
  ),
  "BP-DR-78": e(
    "The country (the OpenAPI adds: or payment type) is not enabled for the merchant",
    CFG,
    DNR,
    "P,O",
  ),
  "BP-DR-79": e("More instalments than the merchant maximum", IR, DNR, "P,O"),
  "BP-DR-80": e(
    "The PagoEfectivo payment code (CIP) could not be generated; the page says try again",
    PU,
    RC,
    "P,O",
  ),
  "BP-DR-81": e("The currency is not allowed for this payment type", CFG, DNR, "P,O"),
  "BP-DR-82": e("note is longer than 200 characters", IR, DNR, "P,O"),
  "BP-DR-83": e(
    "A card issued outside the acquirer's country cannot be processed",
    PMU,
    CAR,
    "P,O",
  ),
  "BP-DR-84": e(
    "Same customer and amount charged within the configured minutes; blocked as a duplicate",
    DUP,
    DNR,
    "P,O",
  ),
  "BP-DR-85": e("sub_account is missing", IR, DNR, "P,O"),
  "BP-DR-86": e("sub_account is invalid", IR, DNR, "P,O"),
  "BP-DR-87": e("sub_account.name is missing", IR, DNR, "P,O"),
  "BP-DR-88": e("sub_account.image_url is missing", IR, DNR, "P,O"),
  "BP-DR-89": e("The instalment count is on the merchant's blocked list", IR, DNR, "P,O"),
  "BP-DR-90": e(
    "The customer (the OpenAPI adds: or card) is on the EBANX blocklist",
    FR,
    DNR,
    "P,O",
  ),
  "BP-DR-91": e(
    "institution_code or bank_code is missing or invalid (PSE, DuitNow)",
    IR,
    CAR,
    "P,O",
  ),
  "BP-DR-92": e("institution_code is not a valid bank code", IR, CAR, "P,O"),
  "BP-DR-93": e(
    "PSE ACH could not create the payment (the message carries a provider code)",
    PU,
    RC,
    "P,O",
  ),
  "BP-DR-94": e("The tokenized card has expired", CD, CAR, "P"),
  "BP-DR-95": e("The cardholder name contains digits", IR, CAR, "P,O"),
  "BP-DR-96": e("The card token has expired", IR, CAR, "P,O"),
  "BP-DR-97": e("Instalments are not allowed on prepaid cards", PMU, CAR, "P,O"),
  "BP-DR-98": e(
    "The customer email is already tied to payments in another country",
    IR,
    CAR,
    "P,O",
  ),
  "BP-DR-99": e("sub_account.image_url must use https", IR, DNR, "P,O"),
  "BP-DR-100": e("Instalments are not allowed on debit cards", PMU, CAR, "P,O"),
  "BP-DR-101": e("The card cannot be used online", CD, CAR, "P,O"),
  "BP-DR-102": e("Too many attempts for the same transaction in a short time", RL, RC, "P,O"),
  "BP-DR-103": e("The customer is temporarily inactivated (too many cards used)", FR, MR, "P,O"),
  "BP-DR-104": e("notification_url is invalid", CFG, DNR, "P,O"),
  "BP-DR-105": e("flow_payment_method is required (Flow)", IR, DNR, "P,O"),
  "BP-DR-106": e(
    "The processing trial limit is reached; the merchant must send documents",
    CFG,
    MR,
    "P",
  ),
  "BP-DR-107": e("Timeout talking to an external API", NT, RC, "O"),
  "BP-DR-108": e("The FX token is invalid", IR, DNR, "P,O"),
  "BP-DR-109": e("The FX token feature is not enabled", CFG, DNR, "P,O"),
  "BP-DR-110": e("The FX token currency is not enabled or not found", CFG, DNR, "P,O"),
  "BP-DR-111": e(
    "The customer document could not be validated; the page says try again",
    PU,
    RC,
    "P,O",
  ),
  "BP-DR-112": e(
    "The card hit the limit of insufficient-funds attempts (the page says 2 attempts)",
    NSF,
    CAR,
    "P,O",
  ),
  "BP-DR-113": e(
    "The customer document is blocked by compliance (the OpenAPI adds: or card pre-validation failure)",
    FR,
    DNR,
    "P,O",
  ),
  "BP-DR-114": e("The customer CPF is blocked for fraud (Pix)", FR, DNR, "O"),
  "BP-DR-116": e("The merchant is not enabled for manual review", CFG, DNR, "O"),
  "BP-DR-117": e("The instalment value is below BRL 5.00", IA, CAR, "P,O"),
  "BP-DR-118": e("The sub-account data is invalid", IR, DNR, "P,O"),
  "BP-DR-119": e(
    "Timeout with the acquirer or provider during processing; the final state is unknown and must be reconciled with /ws/query",
    NT,
    RC,
    "O,S",
  ),
  "BP-DR-120": e("An external service is not available", PU, RC, "P,O,S"),
  "BP-DR-121": e("An external service was unavailable during creation or FX", PU, RC, "O"),
  "BP-DR-128": e("Boleto BEXS is not available", PMU, DNR, "O"),
  "BP-DR-129": e("Instalment payments need auto-capture", IR, DNR, "P,O"),
  "BP-DR-130": e("The 3DS cryptogram is missing", IR, DNR, "P,O"),
  "BP-DR-131": e("The 3DS ECI is missing", IR, DNR, "P,O"),
  "BP-DR-132": e("The 3DS cryptogram and ECI are both missing", IR, DNR, "P"),
  "BP-DR-133": e("The 3DS cryptogram and ECI must be sent together", IR, DNR, "O"),
  "BP-DR-135": e("The network token PAN is invalid", IR, DNR, "O"),
  "BP-DR-136": e("The network token expiry is invalid", IR, DNR, "O"),
  "BP-DR-137": e("The network token cryptogram is invalid", IR, DNR, "O"),
  "BP-DR-138": e(
    "The 3DS directory server transaction id is required for 3DS data-only",
    IR,
    DNR,
    "P,O",
  ),
  "BP-DR-139": e("threeds_version must be 1 or 2", IR, DNR, "P,O"),
  "BP-DR-140": e("An affiliation id is required for this method", CFG, DNR, "O"),
  "BP-DR-141": e("document_country is invalid", IR, CAR, "O"),
  "BP-DR-142": e("The merchant is not allowed to charge foreign customers", CFG, DNR, "O"),
  "BP-DR-143": e("Hard decline from the e-wallet provider after retries", PMU, DNR, "O,S"),
  "BP-DR-144": e("The payment could not be processed; try later", PU, RC, "O"),
  "BP-DR-145": e("The card BIN is not supported for 3DS", PMU, CAR, "O"),
  "BP-DR-146": e("3DS cannot be forced on a notified enrollment charge", IR, DNR, "O"),
  "BP-DR-147": e("The network token original BIN is invalid", IR, DNR, "O"),
  "BP-DR-148": e("The network token original last four digits are invalid", IR, DNR, "O"),
  "BP-DR-150": e("Pix expiration time error", IR, DNR, "O"),
  "BP-DR-151": e("The payment is not eligible for this flow", IR, DNR, "O"),
  "BP-DR-152": e("The card-on-file cof_type is missing", IR, DNR, "O"),
  "BP-DR-153": e("The cof_type value is not allowed", IR, DNR, "O"),
  "BP-DR-154": e("The card-on-file initiator is missing", IR, DNR, "O"),
  "BP-DR-155": e("The initiator value is not allowed", IR, DNR, "O"),
  "BP-DR-156": e("The card-on-file trans_type is missing", IR, DNR, "O"),
  "BP-DR-157": e("The trans_type value is not allowed", IR, DNR, "O"),
  "BP-DR-158": e(
    "A merchant-initiated charge cannot open a new card-on-file agreement",
    IR,
    DNR,
    "O",
  ),
  "BP-DR-164": e("JWE integration key error", CFG, DNR, "O"),
  "BP-DR-166": e("An Indian postal code must have exactly 6 digits", IR, CAR, "O"),
  "BP-DR-167": e("A customer-initiated charge cannot open a MERCHANT_COF agreement", IR, DNR, "O"),
  "BP-DR-168": e("A merchant-initiated charge cannot use CUSTOMER_COF", IR, DNR, "O"),
  "BP-DR-169": e(
    "A customer-initiated stored-credential charge must use CUSTOMER_COF",
    IR,
    DNR,
    "O",
  ),
  "BP-DR-170": e("A split payment is required for this merchant and method", CFG, DNR, "O"),
  "BP-DR-171": e("Local amount override error", IR, DNR, "O"),
  "BP-DR-172": e("bank_details.account_number is required", IR, CAR, "O"),
  "BP-DR-173": e("amount_total contains a comma; use a dot", IA, DNR, "P,O"),
  "BP-DR-174": e("metadata.upi_vpa is required for UPI", IR, CAR, "O"),
  "BP-DR-175": e("sub_account.code is required", IR, DNR, "O"),
  "BP-DR-176": e("Card verification is not enabled for the merchant", CFG, DNR, "O"),
  "BP-DR-177": e("The network_token_wallet_type value is not allowed", IR, DNR, "O"),
  "BP-DR-178": e("network_token_wallet_type is missing", IR, DNR, "O"),
  "BP-DR-180": e("merchant_enrollment_code was not found", IR, DNR, "O"),
  "BP-DR-181": e("The enrollment event was not found", IR, DNR, "O"),
  "BP-DR-182": e("The enrollment is not accepted, so it cannot be charged", PMU, CAR, "O,S,X"),
  "BP-DR-183": e("currency_rate_usd is not allowed for this merchant", CFG, DNR, "O"),
  "BP-DR-184": e("currency_rate_usd contains a comma", IR, DNR, "O"),
  "BP-DR-185": e("currency_rate_usd is invalid", IR, DNR, "O"),
  "BP-DR-186": e("The trusted-transaction flag must be boolean", IR, DNR, "O"),
  "BP-DR-187": e("Payment creation error", UNK, MR, "O"),
  "BP-DR-188": e("iof_paid_by_merchant is invalid", IR, DNR, "O"),
  "BP-DR-189": e("iof_paid_by_merchant must be boolean", IR, DNR, "O"),
  "BP-DR-190": e("network_token_eci is invalid", IR, DNR, "O"),
  "BP-DR-191": e("HSN product code validation failed (India)", IR, DNR, "O"),
  "BP-DR-200": e("The sub-account legal name failed validation (FlyWire)", IR, DNR, "O"),
  "BP-DR-203": e("The sub-account country failed validation (FlyWire)", IR, DNR, "O"),
  "BP-DR-204": e("The sub-account is missing (FlyWire)", IR, DNR, "O"),
  "BP-DR-205": e("merchant_associated_invoices is longer than 2550 characters", IR, DNR, "O"),
  "BP-DR-206": e("info_to_payer is longer than 140 characters", IR, DNR, "O"),
  "BP-DR-207": e("The customer was not notified before the enrollment charge", IR, DNR, "O"),
  "BP-DR-208": e("The integration key is missing or invalid (token delete)", CFG, DNR, "O"),
  "BP-DR-209": e("The token to delete was not found", IR, DNR, "O"),
  "BP-DR-210": e("merchant_enrollment_code is required", IR, DNR, "O"),
  "BP-DR-211": e("customer_device_info.source is invalid", IR, DNR, "O"),
  "BP-DR-213": e("metadata.lrs_type is required (India travel)", IR, DNR, "O"),
  "BP-DR-214": e("metadata.lrs_type must be flight, hotel or tour", IR, DNR, "O"),
  "BP-DR-215": e("The currency is not allowed for this country for the merchant", CFG, DNR, "O"),
  "BP-DR-216": e("The payment country differs from the enrollment country", IR, DNR, "O"),
  "BP-DR-219": e("This payment type does not support enrollment", IR, DNR, "P,O"),
  "BP-DR-220": e("A one-time enrollment was already used; create a new one", IR, CAR, "P,O"),
  "BP-DR-221": e("device_os is required for this payment type (bank list)", IR, DNR, "O"),
  "BP-DR-222": e("device_os must be android or ios", IR, DNR, "O"),
  "BP-DR-600": e(
    "The customer document is blocked after too many attempts for this payment type",
    FR,
    MR,
    "O",
  ),
  "BP-DR-601": e(
    "The customer email is blocked after too many attempts for this payment type",
    FR,
    MR,
    "O",
  ),
  "BP-DR-602": e("Declined because the amount is above a limit", IA, DNR, "O"),
  "BP-DR-603": e("The customer phone number is on a blocklist", FR, DNR, "O"),
  "BP-DR-999": e("Hard decline passed on from cross-border processing", UNK, DNR, "O"),
};

/** 4.3 Refund, cancel, capture, query and status-update codes (97). */
const MODIFICATIONS: Record<string, CodeEntry> = {
  "BP-REF-1": e("The payment hash is missing", IR, DNR, "P"),
  "BP-REF-2": e("The payment was not found for this merchant", IR, DNR, "P"),
  "BP-REF-3": e("operation is missing (must be request or cancel)", IR, DNR, "P"),
  "BP-REF-4": e("The refund amount is missing", IR, DNR, "P"),
  "BP-REF-5": e("The refund amount is not positive", IA, DNR, "P"),
  "BP-REF-6": e("The refund amount is larger than the payment", IA, DNR, "P"),
  "BP-REF-7": e("The payment is not CO, so it cannot be refunded", IR, DNR, "P"),
  "BP-REF-8": e("The payment has a chargeback, so it cannot be refunded", IR, DNR, "P"),
  "BP-REF-9": e("Pending refunds plus this one would exceed the payment amount", IA, DNR, "P"),
  "BP-REF-10": e("The refund description is missing", IR, DNR, "P"),
  "BP-REF-11": e("refund_id or merchant_refund_code is missing", IR, DNR, "P"),
  "BP-REF-12": e("No refund was found for that refund_id or merchant_refund_code", IR, DNR, "P"),
  "BP-REF-13": e("The refund is already cancelled", DUP, DNR, "P"),
  "BP-REF-14": e("The refund is already confirmed", DUP, DNR, "P"),
  "BP-REF-15": e(
    "The operation is invalid (the OpenAPI adds: for this payment type or environment)",
    IR,
    DNR,
    "P,O",
  ),
  "BP-REF-16": e("merchant_refund_code is longer than 20 characters", IR, DNR, "P"),
  "BP-REF-17": e("A refund with this merchant_refund_code already exists", DUP, DNR, "P"),
  "BP-REF-18": e(
    "The merchant balance is too low for a new refund; contact EBANX finance",
    CFG,
    MR,
    "P",
  ),
  "BP-REF-19": e("The card payment was opened more than 85 days ago", IR, DNR, "P"),
  "BP-REF-20": e("The request has both payment.card and payment.creditcard", IR, DNR, "P"),
  "BP-REF-21": e("The customer document is blocked by compliance", FR, DNR, "P"),
  "BP-REF-22": e("Partial refunds are not supported for this payment type", PMU, DNR, "P"),
  "BP-REF-23": e("Refund bank info: the bank name is invalid", IR, CAR, "P"),
  "BP-REF-24": e("Refund bank info is not allowed for this country", IR, DNR, "P"),
  "BP-REF-25": e("Bank details are empty for a bank that needs them", IR, CAR, "P"),
  "BP-REF-26": e("The bank detail operation code is invalid", IR, CAR, "P"),
  "BP-REF-27": e("The bank name does not exist", IR, CAR, "P"),
  "BP-REF-28": e("The account type is invalid", IR, CAR, "P"),
  "BP-REF-29": e("Refunds to savings accounts are not available at this bank", PMU, CAR, "P"),
  "BP-REF-30": e("The bank branch is invalid", IR, CAR, "P"),
  "BP-REF-31": e("The bank account is invalid", IR, CAR, "P"),
  "BP-REF-33": e("bank_info is missing", IR, DNR, "P"),
  "BP-REF-34": e(
    "The refund was not created with bank info, so bank info cannot be updated",
    IR,
    DNR,
    "P",
  ),
  "BP-REF-35": e(
    "The refund is not waiting for bank info (status and substatus must be CO-AW)",
    IR,
    DNR,
    "P",
  ),
  "BP-REF-36": e("The payment hash does not match the refund id or code", IR, DNR, "P"),
  "BP-REF-37": e("The CLABE is invalid", IR, CAR, "P"),
  "BP-REF-38": e("The bank cannot be derived from the CLABE", IR, CAR, "P"),
  "BP-REF-39": e("A refund with Single Transaction cannot be cancelled", IR, DNR, "P"),
  "BP-REF-40": e("Chile refunds must be at least 50.00 CLP", IA, DNR, "P"),
  "BP-REF-41": e("The payment is already fully refunded", DUP, DNR, "P"),
  "BP-REF-42": e("The Pix key type cannot be identified", IR, CAR, "P"),
  "BP-REF-43": e(
    "The refund is already being processed; it cannot be requested again or cancelled",
    DUP,
    DNR,
    "P",
  ),
  "BP-REF-45": e("The refund simulator was used outside the sandbox", CFG, DNR, "P"),
  "BP-REF-46": e("Refund simulator: integration_key is empty", CFG, DNR, "P"),
  "BP-REF-47": e("Refund simulator: integration_key is invalid", CFG, DNR, "P"),
  "BP-REF-48": e("Refund simulator: the refund was not found", IR, DNR, "P"),
  "BP-REF-49": e("Refund simulator: the form is only for refunds in PE or CO", IR, DNR, "P"),
  "BP-REF-50": e("Refund simulator: the form is only for substatus AW", IR, DNR, "P"),
  "BP-REF-51": e(
    "Refund simulator: the substatus change is not allowed from the current status",
    IR,
    DNR,
    "P",
  ),
  "BP-REF-53": e("The refund window for this payment (UPI, India) has passed", IR, DNR, "P"),
  "BP-REF-54": e("The refund simulator does not support this country", CFG, DNR, "P"),
  "BP-REF-55": e("Pix info_to_recipient is longer than 140 characters", IR, DNR, "P"),
  "BP-REF-56": e(
    "The payment was captured too long ago (180 days when the age limit is enabled)",
    IR,
    DNR,
    "P",
  ),
  "BP-REF-57": e(
    "Refunds are blocked until the merchant's outstanding balances are settled",
    CFG,
    MR,
    "P",
  ),
  "BP-REF-58": e("Refund simulator: the refund is already paid", DUP, DNR, "P"),
  "BP-REF-59": e("The customer is not eligible for a refund", UNK, MR, "P"),
  "BP-REF-60": e(
    "The payment failed AML verification (India travel) and cannot be refunded",
    FR,
    DNR,
    "P",
  ),
  "BP-REF-CAN-1": e("The payment is CA: neither cancel nor refund is possible", IR, DNR, "P"),
  "BP-CAN-1": e("hash is missing (the OpenAPI: hash or merchant_payment_code)", IR, DNR, "P,O"),
  "BP-CAN-2": e("The payment was not found for this merchant", IR, DNR, "P,O"),
  "BP-CAN-3": e("The payment is already cancelled", DUP, DNR, "P,O"),
  "BP-CAN-4": e(
    "The payment cannot be cancelled (the OpenAPI: its status is not OP or PE)",
    IR,
    DNR,
    "P,O",
  ),
  "BP-CAN-5": e(
    "The payment cannot be cancelled (for example the method does not allow it)",
    PMU,
    DNR,
    "O",
  ),
  "BP-CAN-6": e("The payment cannot be cancelled on its due date", IR, DNR, "O"),
  "BP-CAN-7": e("The gateway was unavailable while cancelling", PU, RC, "O"),
  "BP-CAP-1": e("hash or merchant_payment_code is missing", IR, DNR, "P,O"),
  "BP-CAP-2": e("The payment was not found for this merchant", IR, DNR, "P,O"),
  "BP-CAP-3": e("The payment is CA, so it cannot be captured", IR, DNR, "P,O"),
  "BP-CAP-4": e("The payment is already captured (CO)", DUP, DNR, "P,O"),
  "BP-CAP-5": e("The payment is OP, so it cannot be captured", IR, DNR, "P,O"),
  "BP-CAP-6": e("The payment type does not support capture", IR, DNR, "P,O"),
  "BP-CAP-7": e("The payment was created with auto-capture", IR, DNR, "P,O"),
  "BP-CAP-8": e("capture_available is false", IR, DNR, "P,O"),
  "BP-CAP-9": e("pre_approved is false (not authorized)", IR, DNR, "P,O"),
  "BP-CAP-10": e("The capture amount is invalid", IA, DNR, "P,O"),
  "BP-CAP-11": e("Partial capture is not available for this payment", PMU, DNR, "P,O"),
  "BP-CAP-12": e("The capture amount is above the authorized maximum", IA, DNR, "P,O"),
  "BP-CAP-13": e("The split is missing on a partial capture of a split payment", IR, DNR, "O"),
  "BP-CAP-14": e("The split amounts do not add up to the captured amount", IA, DNR, "O"),
  "BP-CAP-15": e("A split amount is not positive", IA, DNR, "O"),
  "BP-CAP-16": e("The same split recipient is listed twice", IR, DNR, "O"),
  "BP-CAP-17": e("A split recipient is not part of the original payment", IR, DNR, "O"),
  "BP-CAP-18": e("Liability or fee responsibility cannot change at capture", IR, DNR, "O"),
  "BP-CAP-19": e("Split percentages are not positive or do not total 100%", IR, DNR, "O"),
  "BP-CAP-20": e("The split mixes amounts and percentages, or a rule has neither", IR, DNR, "O"),
  "BP-Q-1": e("hash or merchant_payment_code is missing", IR, DNR, "P,O"),
  "BP-Q-2": e("The payment was not found for this merchant", IR, DNR, "P,O"),
  "BP-US-1": e("Status update (sandbox): hash is missing", IR, DNR, "P"),
  "BP-US-2": e("Status update (sandbox): the payment was not found", IR, DNR, "P"),
  "BP-US-3": e("Status update (sandbox): status is missing", IR, DNR, "P"),
  "BP-US-4": e("Status update (sandbox): status must be CO or CA", IR, DNR, "P"),
  "BP-US-5": e(
    "Status update attempted in production; only EBANX changes statuses there",
    CFG,
    DNR,
    "P",
  ),
  "BP-US-01": e("The subscription update failed", UNK, MR, "O"),
  "BP-US-03": e("Subscription update: the external provider was not found", CFG, DNR, "O"),
  "BP-US-04": e("Subscription update: the external provider is invalid", CFG, DNR, "O"),
  "BP-US-05": e("The subscription update failed at the provider", PU, RC, "O"),
  "BP-US-06": e(
    "No subscription or enrollment was found for the merchant_enrollment_code",
    IR,
    DNR,
    "O",
  ),
};

/** 4.4 3DS, enrollment, payment page, retry, utility and evidence codes (159). */
const OTHER_FAMILIES: Record<string, CodeEntry> = {
  "BP-3DS-1": e("public_integration_key is missing for 3DS 2.0", CFG, DNR, "P,O"),
  "BP-3DS-2": e("public_integration_key is invalid for 3DS 2.0", CFG, DNR, "P,O"),
  "BP-3DS-19": e("threeds_mode and threeds_force were sent together", IR, DNR, "O"),
  "BP-3DS-20": e("The threeds_mode value is invalid", IR, DNR, "O"),
  "BP-3DS-33": e("browser_info.color_depth must be a string", IR, DNR, "O"),
  "BP-3DS-34": e("browser_info.screen_height is missing (data-only)", IR, DNR, "O"),
  "BP-3DS-35": e("browser_info.screen_height is not a string", IR, DNR, "O"),
  "BP-3DS-36": e("browser_info.screen_width is missing (data-only)", IR, DNR, "O"),
  "BP-3DS-37": e("browser_info.screen_width is not a string", IR, DNR, "O"),
  "BP-3DS-38": e("browser_info.timezone_offset is missing (data-only)", IR, DNR, "O"),
  "BP-3DS-39": e("browser_info.timezone_offset is not a string", IR, DNR, "O"),
  "BP-3DS-40": e("browser_info.javascript_enabled is missing (data-only)", IR, DNR, "O"),
  "BP-3DS-41": e("browser_info.javascript_enabled is not boolean", IR, DNR, "O"),
  "BP-3DS-42": e("browser_info.java_enabled is missing (data-only)", IR, DNR, "O"),
  "BP-3DS-43": e("browser_info.java_enabled is not boolean", IR, DNR, "O"),
  "BP-3DS-44": e("browser_info is required for data_only or data_only_preferred", IR, DNR, "O"),
  "BP-3DS-45": e(
    "The 3DS authentication value (UCAF) is already used by another payment",
    AF,
    DNR,
    "O",
  ),
  "BP-3DS-46": e(
    "The 3DS data (ECI/XID) does not match what EBANX stored, or the 3DS reference cannot be resolved",
    AF,
    DNR,
    "P,O",
  ),
  "BP-UE-01": e("Enrollment operation is missing", IR, DNR, "O"),
  "BP-UE-02": e("Enrollment operation is invalid", IR, DNR, "O"),
  "BP-UE-03": e(
    "A required enrollment field is missing (on /ws/direct: the enrollment code)",
    IR,
    DNR,
    "O",
  ),
  "BP-UE-04": e("A required enrollment field is empty", IR, DNR, "O"),
  "BP-UE-05": e("A back_urls URL is invalid", IR, DNR, "O"),
  "BP-UE-06": e("enrollment.country is invalid", IR, DNR, "O"),
  "BP-UE-07": e("Enrollment payment_type_code is missing", IR, DNR, "O"),
  "BP-UE-08": e("Enrollment payment_type_code is invalid", IR, DNR, "O"),
  "BP-UE-09": e("The payment type is not enabled for this country", CFG, DNR, "O"),
  "BP-UE-10": e("The payment type is not enabled in full mode for the merchant", CFG, DNR, "O"),
  "BP-UE-11": e("No provider is enabled for this operation", CFG, DNR, "O"),
  "BP-UE-12": e("Unexpected enrollment error", UNK, MR, "O"),
  "BP-UE-13": e(
    "The payment type profile was not found or is unsupported for this operation",
    CFG,
    DNR,
    "O",
  ),
  "BP-UE-14": e("The enrollment was not found", IR, DNR, "O"),
  "BP-UE-15": e("Provider-specific cancellation error", PU, MR, "O"),
  "BP-UE-16": e("The enrollment code is already used", DUP, DNR, "O"),
  "BP-UE-17": e("Authentication failed or the subscription amount is invalid", AF, CAR, "O"),
  "BP-UE-18": e("subscription.expiration_date is invalid", IR, DNR, "O"),
  "BP-UE-19": e("upi.vpa is missing or malformed", IR, CAR, "O"),
  "BP-UE-20": e("The update has no updatable field", IR, DNR, "O"),
  "BP-UE-21": e("The update names a field that cannot be updated", IR, DNR, "O"),
  "BP-UE-22": e("The enrollment object is missing", IR, DNR, "O"),
  "BP-UE-23": e("subscription.frequency is missing", IR, DNR, "O"),
  "BP-UE-24": e(
    "subscription.start_date is invalid (Pix Automatico: must be in the future)",
    IR,
    DNR,
    "O,X",
  ),
  "BP-UE-25": e("subscription.recurrence_value must be an integer", IR, DNR, "O"),
  "BP-UE-26": e("subscription.retry is invalid", IR, DNR, "O"),
  "BP-UE-27": e("subscription.subscription_name is missing", IR, DNR, "O"),
  "BP-UE-28": e("subscription.max_amount_floor is invalid", IR, DNR, "O"),
  "BP-UE-29": e("subscription.fixed_amount is missing", IR, DNR, "O"),
  "BP-UE-30": e(
    "enrollment.name (Pix Automatico: any field) has an invalid size or format",
    IR,
    DNR,
    "O,X",
  ),
  "BP-UE-31": e("yape.type and yape.source are required", IR, DNR, "O"),
  "BP-UE-32": e("Provider internal error", PU, RC, "O"),
  "BP-UE-33": e("Provider timeout", NT, RC, "O"),
  "BP-UE-34": e("The provider rejected the parameters", IR, DNR, "O"),
  "BP-UE-35": e(
    "Document status validation failed (Pix Automatico: CPF/CNPJ invalid or not regular)",
    IR,
    CAR,
    "O,X",
  ),
  "BP-UE-36": e("The subscription amount conflicts with the payment amount", IA, DNR, "O"),
  "BP-UE-37": e(
    "Document name validation failed (Pix Automatico: external validator unavailable)",
    PU,
    RC,
    "O,X",
  ),
  "BP-UE-38": e("Authentication data is missing", IR, DNR, "O"),
  "BP-UE-39": e("The authentication type is not allowed", IR, DNR, "O"),
  "BP-UE-40": e("contract is missing", IR, DNR, "O"),
  "BP-UE-41": e("contract is invalid", IR, DNR, "O"),
  "BP-UE-42": e("The provider rejected the enrollment", PMU, CAR, "O"),
  "BP-UE-44": e("The Origin header is missing", CFG, DNR, "O"),
  "BP-UE-45": e("The origin host is invalid", CFG, DNR, "O"),
  "BP-UE-46": e("The provider reports incorrect customer data", IR, CAR, "O"),
  "BP-UE-48": e("enrollment.identification must be a valid CPF", IR, CAR, "O"),
  "BP-UE-49": e("account_details.bank_id is not a supported bank", IR, CAR, "O"),
  "BP-UE-50": e("start_date cannot change once payments exist", IR, DNR, "O"),
  "BP-UE-51": e("The provider transaction limit is exceeded", IA, CAR, "O"),
  "BP-UE-52": e("The provider says the payment is not valid", IR, DNR, "O"),
  "BP-UE-53": e("The provider says the amount is invalid", IA, DNR, "O"),
  "BP-UE-54": e("enrollment.note is longer than 200 bytes", IR, DNR, "O"),
  "BP-R-1": e("currency_code is missing (payment page)", IR, DNR, "P"),
  "BP-R-2": e("amount is missing (payment page)", IR, DNR, "P"),
  "BP-R-3": e("merchant_payment_code is missing (payment page)", IR, DNR, "P"),
  "BP-R-4": e("The customer name is missing (payment page)", IR, CAR, "P"),
  "BP-R-5": e("The customer email is missing (payment page)", IR, CAR, "P"),
  "BP-R-6": e("payment_type_code is missing (payment page)", IR, DNR, "P"),
  "BP-R-7": e("The payment type is not active", CFG, DNR, "P"),
  "BP-R-8": e("payment_type_code is invalid", IR, DNR, "P"),
  "BP-R-9": e("The amount is not positive", IA, DNR, "P"),
  "BP-R-10": e("The amount is below the minimum", IA, DNR, "P"),
  "BP-R-11": e("The payment type does not support instalments (for example Boleto)", IR, DNR, "P"),
  "BP-R-12": e("The instalment count is above the limit", IR, DNR, "P"),
  "BP-R-13": e("The instalment value is below the configured minimum", IA, DNR, "P"),
  "BP-R-14": e("merchant_payment_code is longer than 20 characters", IR, DNR, "P"),
  "BP-R-15": e("order_number is longer than 40 characters", IR, DNR, "P"),
  "BP-R-16": e(
    "One of user_value_1 (60) or user_value_2 to user_value_5 (20) is too long",
    IR,
    DNR,
    "P",
  ),
  "BP-R-17": e("The payment is not OP", IR, DNR, "P"),
  "BP-R-18": e("person_type is invalid", IR, DNR, "P"),
  "BP-R-19": e("Checkout by CNPJ is not enabled", CFG, DNR, "P"),
  "BP-R-20": e("due_date is not dd/MM/yyyy", IR, DNR, "P"),
  "BP-R-21": e("due_date is too far away", IR, DNR, "P"),
  "BP-R-22": e("due_date is too soon", IR, DNR, "P"),
  "BP-R-23": e("The currency is not active", CFG, DNR, "P"),
  "BP-R-24": e("country is missing", IR, DNR, "P"),
  "BP-R-25": e("The country is not enabled", CFG, DNR, "P"),
  "BP-R-26": e("The country is not enabled for the merchant", CFG, DNR, "P"),
  "BP-R-27": e("The payment type is not enabled for the merchant", CFG, DNR, "P"),
  "BP-R-28": e("The instalment count is above the merchant maximum", IR, DNR, "P"),
  "BP-R-29": e("The instalment value is invalid", IR, DNR, "P"),
  "BP-R-30": e("The instalment count is on the blocked list", IR, DNR, "P"),
  "BP-R-31": e("notification_url is invalid", CFG, DNR, "P"),
  "BP-R-32": e("The amount is above the maximum", IA, DNR, "P"),
  "BP-R-34": e("The processing trial limit is reached", CFG, MR, "P"),
  "BP-IP-001": e("The instalment plan token is missing", IR, DNR, "O"),
  "BP-IP-002": e("The instalment plan token is invalid or not the merchant's", IR, DNR, "O"),
  "BP-IP-003": e("The instalment plan token has expired", IR, DNR, "O"),
  "BP-IP-004": e("The country differs from the instalment plan", IR, DNR, "O"),
  "BP-IP-005": e("The currency differs from the instalment plan", IR, DNR, "O"),
  "BP-IP-006": e("The amount differs from the instalment plan", IR, DNR, "O"),
  "BP-IP-007": e("The payment type differs from the instalment plan", IR, DNR, "O"),
  "BP-IP-008": e("The chosen instalment count is not in the plan", IR, DNR, "O"),
  "BP-IP-009": e("The country or payment type group is not valid for the plan", IR, DNR, "O"),
  "IPBP-001": e("/ws/instalmentsPlan: country is missing", IR, DNR, "O"),
  "IPBP-002": e("/ws/instalmentsPlan: amount is missing", IR, DNR, "O"),
  "IPBP-003": e("/ws/instalmentsPlan: currency is missing", IR, DNR, "O"),
  "IPBP-004": e("/ws/instalmentsPlan: country is invalid", IR, DNR, "O"),
  "IPBP-005": e("The currency is invalid or the rate is unavailable", CFG, DNR, "O"),
  "IPBP-006": e("Unexpected error", UNK, RC, "O"),
  "IPBP-007": e("The amount must be greater than zero", IA, DNR, "O"),
  "IPBP-008": e("The external service for instalment calculation is unavailable", PU, RC, "O"),
  "IPBP-SA-1": e("Neither key was sent", CFG, DNR, "O"),
  "IPBP-SA-2": e("The public key is invalid", CFG, DNR, "O"),
  "BP-ST-00": e("Single Transaction is not enabled", CFG, DNR, "O"),
  "BP-ST-01": e("Single Transaction is only for the local tenant", CFG, DNR, "O"),
  "BP-ST-02": e("single_transaction is missing", IR, DNR, "O"),
  "BP-ST-03": e("amount_local is missing", IR, DNR, "O"),
  "BP-ST-04": e("amount_crossborder is missing", IR, DNR, "O"),
  "BP-ST-05": e("Local plus cross-border amounts are above the total", IA, DNR, "O"),
  "BP-ST-06": e("Local plus cross-border amounts are below the total", IA, DNR, "O"),
  "BP-ST-13": e("Single Transaction amounts are negative", IA, DNR, "O"),
  "BP-TX-01": e("taxes are missing for a local amount", IR, DNR, "O"),
  "BP-TX-02": e("iva_co is missing", IR, DNR, "O"),
  "BP-TX-03": e("iva_co is not a number", IR, DNR, "O"),
  "BP-DOC-01": e("The document is invalid", IR, CAR, "P,O"),
  "BP-DOC-02": e("The currency is not supported for document balance", IR, DNR, "P,O"),
  "BP-DOC-03": e("The country is not supported", IR, DNR, "O"),
  "BP-DOC-04": e("Conversion to the currency is unavailable", IR, DNR, "O"),
  "BP-EX-1": e("The currency is missing", IR, DNR, "P,O"),
  "BP-EX-2": e("The currency is not active", IR, DNR, "P,O"),
  "BP-ZIP-1": e("The zip code is missing", IR, CAR, "P,O"),
  "BP-ZIP-2": e("The zip code does not have 8 digits", IR, CAR, "P,O"),
  "BP-ZIP-3": e("No address was found for the zip code", IR, CAR, "P,O"),
  "BP-OTP-000": e("OTP: fields are missing", IR, DNR, "P"),
  "BP-OTP-001": e("OTP: the payment was not found", IR, DNR, "P"),
  "BP-OTP-002": e("OTP validation failed", AF, CAR, "P"),
  "BP-OTP-003": e("OTP: the payment is still pending", UNK, RC, "P"),
  "BP-OTP-004": e("OTP: the charge could not be processed", UNK, MR, "P"),
  "BP-OTP-005": e("OTP: the token is invalid or expired", AF, CAR, "P"),
  "BP-OTP-006": e("OTP: resolver processor problem", PU, RC, "P"),
  "BP-CH-00": e("Chargeback evidence: internal or unknown error (HTTP 500)", PU, RC, "C"),
  "BP-CH-01": e("Chargeback evidence: payment not found in this tenant (HTTP 404)", IR, DNR, "C"),
  "BP-CH-02": e(
    "Chargeback evidence: unauthorized (missing request_body, wrong kid or host; HTTP 401)",
    CFG,
    DNR,
    "C",
  ),
  "BP-CH-03": e(
    "Chargeback evidence: the chargeback is not ready for evidence (HTTP 422)",
    IR,
    MR,
    "C",
  ),
  "BP-CH-04": e(
    "Chargeback evidence: parameters missing or invalid, often the file field (HTTP 400)",
    IR,
    DNR,
    "C",
  ),
  "BP-CH-05": e(
    "Chargeback evidence: file invalid, corrupt, wrong format or above 15 MB (HTTP 400)",
    IR,
    DNR,
    "C",
  ),
  "BP-CH-06": e(
    "Chargeback evidence was already submitted; submission is final (HTTP 422)",
    DUP,
    DNR,
    "C",
  ),
  "BP-CH-07": e("Chargeback evidence: the dispute is already finished (HTTP 422)", IR, DNR, "C"),
  "BP-CH-08": e(
    "Chargeback evidence: the SHA-256 in request_body does not match the file (HTTP 401)",
    IR,
    DNR,
    "C",
  ),
  "BP-CH-09": e(
    "Chargeback evidence: the chargeback is not disputable, possibly acquirer configuration (HTTP 422)",
    CFG,
    MR,
    "C",
  ),
};

/** Every documented pay-in `status_code` (484 distinct values). */
export const PAYIN_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  ...REQUEST_LEVEL,
  ...DIRECT,
  ...MODIFICATIONS,
  ...OTHER_FAMILIES,
};

/** Documented HTTP statuses of the chargeback evidence endpoint. */
export const EVIDENCE_HTTP_STATUS: Readonly<Record<string, number>> = {
  "BP-CH-00": 500,
  "BP-CH-01": 404,
  "BP-CH-02": 401,
  "BP-CH-03": 422,
  "BP-CH-04": 400,
  "BP-CH-05": 400,
  "BP-CH-06": 422,
  "BP-CH-07": 422,
  "BP-CH-08": 401,
  "BP-CH-09": 422,
};

/** A second documented meaning of a code, with a hint for matching the message. */
export type AlternativeMeaning = CodeEntry & { context: string; messageHint?: RegExp };

const alt = (
  context: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  src: string,
  messageHint?: RegExp,
): AlternativeMeaning => ({
  ...e(meaning, category, retry, src),
  context,
  ...(messageHint ? { messageHint } : {}),
});

/**
 * Codes that EBANX documents with more than one meaning. The main table holds
 * the API error page meaning; these are the others. Which one applies depends
 * on the endpoint, which a pasted response does not show.
 */
export const CONFLICTING_CODES: Readonly<
  Record<string, { primaryHint?: RegExp; alternatives: readonly AlternativeMeaning[] }>
> = {
  "BP-R-3": {
    primaryHint: /merchant_payment_code/i,
    alternatives: [
      alt(
        "/ws/retry (Pix Automatico)",
        "The payment is not pending, so it cannot be retried",
        IR,
        DNR,
        "X",
        /pending|retr/i,
      ),
    ],
  },
  "BP-R-4": {
    primaryHint: /name/i,
    alternatives: [
      alt(
        "/ws/retry (Pix Automatico)",
        "The payment is not eligible for retry (policy disallows it or the 7-day window passed)",
        PMU,
        DNR,
        "X",
        /eligib|retr/i,
      ),
    ],
  },
  "BP-R-5": {
    primaryHint: /email/i,
    alternatives: [
      alt(
        "/ws/retry (Pix Automatico page)",
        "The payment was already retried today (one retry per day)",
        DUP,
        RC,
        "X",
        /today|per day/i,
      ),
      alt(
        "/ws/retry (OpenAPI and sandbox page)",
        "Another attempt is in progress",
        DUP,
        RC,
        "O,S",
        /progress|being processed/i,
      ),
    ],
  },
  "BP-R-6": {
    primaryHint: /payment_type_code/i,
    alternatives: [
      alt(
        "/ws/retry (Pix Automatico)",
        "No retries are left (maximum three)",
        PMU,
        DNR,
        "X,O,S",
        /retr|maximum|left/i,
      ),
    ],
  },
  "BP-DR-9": {
    primaryHint: /merchant_payment_code/i,
    alternatives: [
      alt("OpenAPI", "payment_type_code is invalid", IR, DNR, "O", /payment_type_code/i),
      alt(
        "Pix Automatico",
        "The Pix Automatico due_date is missing or invalid",
        IR,
        DNR,
        "X",
        /due.?date/i,
      ),
    ],
  },
  "BP-DR-17": {
    primaryHint: /e-?mail/i,
    alternatives: [
      alt(
        "NuPay recurring example (scenario file)",
        "Invalid enrollment code",
        IR,
        DNR,
        "O",
        /enrol/i,
      ),
    ],
  },
  "BP-DR-18": {
    primaryHint: /customer|suspend|disabled/i,
    alternatives: [
      alt(
        "NuPay recurring example (scenario file)",
        "The enrollment has expired",
        PMU,
        CAR,
        "O",
        /expired|enrol/i,
      ),
    ],
  },
  "BP-DR-20": {
    primaryHint: /birth/i,
    alternatives: [
      alt(
        "NuPay recurring example (scenario file)",
        "Insufficient funds",
        NSF,
        CAR,
        "O",
        /insufficient|funds/i,
      ),
    ],
  },
  "BP-DR-62": {
    primaryHint: /recurr/i,
    alternatives: [
      alt(
        "OpenAPI and Pix Automatico",
        "This Pix Automatico billing cycle already has a pending or confirmed payment",
        DUP,
        DNR,
        "O,X",
        /cycle|already|pending|confirmed/i,
      ),
    ],
  },
  "BP-DR-63": {
    primaryHint: /token|acquirer/i,
    alternatives: [
      alt(
        "OpenAPI and Pix Automatico",
        "The payment due_date is before the subscription start date",
        IR,
        DNR,
        "O,X",
        /due.?date|start/i,
      ),
    ],
  },
  "BP-DR-132": {
    primaryHint: /cryptogram|eci/i,
    alternatives: [
      alt("/ws/ewallet-availableEWallets", "country is missing", IR, DNR, "O", /country/i),
    ],
  },
  "BP-REF-41": {
    primaryHint: /refunded/i,
    alternatives: [
      alt(
        "refund bank info",
        "The Pix key in the refund bank info is invalid",
        IR,
        CAR,
        "P",
        /pix|key/i,
      ),
    ],
  },
};

// ---------------------------------------------------------------------------
// Payment outcome inside a successful response
// ---------------------------------------------------------------------------

export type StatusInfo = {
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
};

/** `payment.status` (4). */
export const PAYMENT_STATUSES: Readonly<Record<string, StatusInfo>> = {
  OP: {
    meaning: "Open: created; the customer has not completed the payment details yet",
    stage: "payment",
    outcome: "pending",
  },
  PE: {
    meaning:
      "Pending confirmation (voucher issued, transfer awaited, or card authorized but not captured)",
    stage: "payment",
    outcome: "pending",
  },
  CO: { meaning: "Confirmed (paid)", stage: "payment", outcome: "success" },
  CA: { meaning: "Cancelled, expired or failed", stage: "payment", outcome: "failure" },
};

/** Top-level `status` of a pay-in response. */
export const ENVELOPE_STATUSES: ReadonlySet<string> = new Set(["SUCCESS", "ERROR"]);

export type TransactionCodeEntry = {
  meaning: string;
  category?: ErrorCategory;
  retry?: RetryGuidance;
};

/** `payment.transaction_status.code` (6). */
export const TRANSACTION_STATUS_CODES: Readonly<Record<string, TransactionCodeEntry>> = {
  OK: { meaning: "Accepted" },
  NOK: { meaning: "Not accepted; see description_code" },
  NO_RETRY: { meaning: "Not accepted; EBANX advises not to retry", category: CD, retry: DNR },
  RETRY: { meaning: "Not accepted; EBANX says it can be retried", category: UNK, retry: RC },
  PENDING_AUTHENTICATION: {
    meaning: "Waiting for customer authentication such as 3DS",
    category: AR,
    retry: CAR,
  },
  PENDING_CARD_PIN: { meaning: "Waiting for card PIN entry", category: AR, retry: CAR },
};

/** `description_code` values that are not errors. */
export type DescriptionEntry = CodeEntry & { kind?: "success" | "cancellation" | "pending" };

const ok = (meaning: string): DescriptionEntry => ({
  meaning,
  category: UNK,
  retry: "unknown",
  kind: "success",
});

/** Card `transaction_status.description_code` (47 plus 34 refund declines). */
const CARD_MAIN: Record<string, DescriptionEntry> = {
  ACCEPTED: ok("Accepted"),
  "3DSECURE_REQUIRED": e("The card requires 3DS", AR, CAR),
  ALREADY_FULLY_REFUNDED: e("The transaction is already fully refunded", DUP, DNR),
  AWAITING_DONT_RETRY: e("Still being processed; EBANX says do not retry", UNK, DNR),
  BLOCKED_BY_BRAND_MANDATE: e(
    "Blocked by a card brand mandate after all acquirer routes; wait until brand_mandate.retry_after",
    CD,
    RC,
  ),
  BROKEN_COMMUNICATION: e("The connection broke; EBANX says retry at any time", NT, SAFE),
  CANNOT_CANCEL_TRANSACTION: e("The transaction could not be cancelled; do not retry", UNK, DNR),
  CANNOT_TRANSACTION: e("The acquirer cannot process now; EBANX says retry at any time", PU, SAFE),
  CARD_NOT_ENABLED_FOR_ECOMMERCE: e("The card is not enabled for online use", CD, CAR),
  CARD_NUMBER: e("The card number is invalid", IR, CAR),
  CLOSED_ACCOUNT: e("The card account is closed", CD, DNR),
  COMMUNICATION_MISMATCH: e(
    "Bad communication with the acquirer; EBANX says retry at any time",
    NT,
    SAFE,
  ),
  DECLINED_DUE_INVALID_PARAMETERS: e("Declined because of invalid parameters", IR, DNR),
  DECLINED_DUE_SCHEME_RULES: e("Declined by card scheme rules", CD, DNR),
  DECLINED_DUE_TIMEOUT: e("Declined after a timeout", NT, RC),
  DEFAULT_ERROR: e("Generic processing error", UNK, MR),
  DUPLICATED_REFUND_REQUEST: e("A refund request already exists", DUP, DNR),
  EXCEEDS_WITHDRAWAL_LIMIT: e("The card withdrawal limit is exceeded", CD, CAR),
  EXPIRED_CARD: e("The card has expired", CD, CAR),
  FAILED_TO_PROCESS: e("Failed to process", UNK, MR),
  HIGH_RISK_TRANSACTION: e("Declined as likely fraud", FR, DNR),
  INACTIVE_CARD: e("The card is not active (EBANX says retry at any time)", CD, CAR),
  INCORRECT_CUSTOMER_DATA: e("The customer data is incorrect", IR, CAR),
  INSTALLMENTS_NOT_AVAILABLE: e("Instalments are not available for this transaction", PMU, CAR),
  INSTALLMENTS_UNSUPPORTED: e("The issuer does not support this instalment count", PMU, CAR),
  INSUFFICIENT_FUNDS: e("Insufficient funds", NSF, CAR),
  INVALID_CARD_OR_TYPE: e("The card is invalid, nonexistent or blocked", CD, CAR),
  INVALID_DUE_DATE: e("The card expiry date is invalid", IR, CAR),
  ISSUER_DECLINE: e("Declined by the issuer", CD, CAR),
  ISSUER_DECLINE_SUSPECT_FRAUD: e("The issuer declined for suspected fraud", FR, DNR),
  NO_ACCEPTED: e("Not approved; the customer should contact the issuer", CD, CAR),
  NO_ACCEPTED_RETRYABLE: e("Not approved, but may be retried", CD, RC),
  NO_FULFILL: e("Could not be fulfilled or already executed; do not retry", DUP, DNR),
  NO_RESPONSE: e("The acquirer did not answer; EBANX says retry at any time", NT, SAFE),
  PAYMENT_TOO_OLD_TO_REFUND: e("The payment is too old to refund", IR, DNR),
  PENDING_AUTHENTICATION: { ...e("Waiting for authentication", AR, CAR), kind: "pending" },
  PENDING_CARD_PIN: { ...e("Waiting for the PIN", AR, CAR), kind: "pending" },
  PICKUP_CARD: e("The issuer flagged the card for pickup; do not retry", FR, DNR),
  PIN_TRIES_EXCEEDED: e("Too many PIN attempts", AF, DNR),
  REFUND_AMOUNT_EXCEEDED: e("The refund is above the original amount", IA, DNR),
  REFUNDED: e("The card was already refunded; do not retry", DUP, DNR),
  RESPONSE_ERROR: e("The acquirer answer had an error; EBANX says retry at any time", PU, SAFE),
  SECURITY_CODE_MISMATCH: e("The CVV is wrong", CD, CAR),
  TIMEOUT: e("The connection timed out; EBANX says retry at any time", NT, SAFE),
  TRANSACTION_NOT_FOUND: e("The referenced transaction was not found", IR, DNR),
  UNDER_REVIEW: e("The transaction is under review", FR, MR),
  UNKNOWN_ERROR: e("Unknown acquirer error; EBANX says retry at any time", UNK, RC),
};

const REFUND_DECLINE_MAP: Record<string, [ErrorCategory, RetryGuidance]> = {
  ACCOUNT_WITH_ISSUE: [CD, DNR],
  AWAITING: [PU, RC],
  BLOCKED_CARD: [CD, DNR],
  CANNOT_TRANSACTION_NOW: [PU, RC],
  CARD_WITH_ISSUE: [CD, DNR],
  CHARGEBACK_IN_ACQUIRER: [UNK, MR],
  CHARGEBACK_IN_ANALYSIS: [UNK, MR],
  CLOSED_ACCOUNT: [CD, DNR],
  COMMUNICATION_ERROR: [PU, RC],
  DUPLICATE_RECORDS: [DUP, DNR],
  ERROR_UNKNOWN: [UNK, MR],
  EXCEEDED_ATTEMPTS: [CD, DNR],
  EXPIRED_CARD: [CD, DNR],
  FOR_FINANCE_MANUAL_HANDLING: [UNK, MR],
  FOR_FINANCE_REMITTANCE: [UNK, MR],
  INSUFFICIENT_FUNDS: [CD, DNR],
  INVALID_AMOUNT: [IA, DNR],
  INVALID_CARD: [CD, DNR],
  INVALID_CURRENCY: [IA, DNR],
  INVALID_FIELD: [IR, DNR],
  INVALID_SETTING_IN_ACQUIRER: [IR, DNR],
  INVALID_TRANSACTION: [IR, DNR],
  INVALID_TRANSACTION_RETRYABLE: [PU, RC],
  LOCK_ON_ACQUIRER: [UNK, MR],
  MISSING_REQUIRED_FIELD: [IR, DNR],
  NON_REFUNDABLE_TRANSACTION_TYPE: [IR, DNR],
  OLDER_TOO_OLD: [IR, DNR],
  PICKUP_CARD: [CD, DNR],
  REFUND_ALREADY_EXISTS: [DUP, DNR],
  RISK_RULES: [FR, MR],
  SCHEME_RULES: [CD, DNR],
  TRANSACTION_NOT_FOUND: [IR, DNR],
  UNAVAILABLE_OR_ERROR: [PU, RC],
  UNSUPPORTED_PAYMENT_TYPE: [IR, DNR],
};

export const REFUND_DECLINE_PREFIX = "REFUND_DECLINED_DUE_";

/** The 34 refund decline codes; EBANX gives no meaning beyond the suffix. */
export const REFUND_DECLINE_CODES: Readonly<Record<string, DescriptionEntry>> = Object.fromEntries(
  Object.entries(REFUND_DECLINE_MAP).map(([suffix, [category, retry]]) => [
    `${REFUND_DECLINE_PREFIX}${suffix}`,
    e(
      `Refund declined: ${suffix.toLowerCase().replace(/_/g, " ")} (EBANX gives no longer meaning than the code name)`,
      category,
      retry,
    ),
  ]),
);

/** Card `description_code` (81). */
export const CARD_DESCRIPTION_CODES: Readonly<Record<string, DescriptionEntry>> = {
  ...CARD_MAIN,
  ...REFUND_DECLINE_CODES,
};

/** APM `transaction_status.description_code` (66). */
export const APM_DESCRIPTION_CODES: Readonly<Record<string, DescriptionEntry>> = {
  ACCEPTED: ok("Paid"),
  ATTEMPTS_EXCEEDED_MPIN_OR_OTP: e(
    "The payer entered the PIN or OTP wrongly too many times",
    AF,
    CAR,
  ),
  BIN_MISMATCH: e("BIN mismatch for UPI on a credit card", IR, CAR),
  BROKEN_COMMUNICATION: e("Communication broke", NT, RC),
  CANCELED_BY_MERCHANT: {
    ...e("The merchant cancelled", UNK, DNR),
    kind: "cancellation",
  },
  CANCELED_BY_PAYER: { ...e("The payer cancelled", UNK, CAR), kind: "cancellation" },
  CANNOT_TRANSACTION: e("Cannot process now", PU, RC),
  COMMUNICATION_MISMATCH: e("Communication mismatch", NT, RC),
  CUSTOMER_NOT_FOUND: e("The customer is unknown at the provider", IR, CAR),
  CUSTOMER_NUMBER_OR_ACCOUNT_CHANGE: e("The payer's account details changed", PMU, CAR),
  DECLINED_BY_CC_ISSUING_BANK: e("The card issuer declined (card-funded APM)", CD, CAR),
  DECLINED_DUE_TIMEOUT: e("Declined after a timeout", NT, RC),
  DEFAULT_ERROR: e("Unknown acquirer error", UNK, MR),
  DEFAULT_REASON: e("Unknown decline reason", UNK, MR),
  DO_NOT_HONOUR: e("The bank rejected after internal checks", CD, CAR),
  DUPLICATE_TRANSACTION: e("Duplicate mandate or transaction", DUP, DNR),
  ENROLLMENT_CANCELLED: e("The enrollment is no longer active", PMU, CAR),
  ENROLLMENT_CONFIRMATION_FAILURE: e("The payer's bank failed to confirm the enrollment", PMU, CAR),
  ENROLLMENT_NOT_ACTIVE: e("The enrollment is not active", PMU, CAR),
  ENROLLMENT_PAUSED: e("The payer paused the enrollment", PMU, CAR),
  EWALLET_INSTANT_RETRY_ERROR: e("The wallet attempt failed; try again", PU, RC),
  EXPIRED_AFTER_3RETRIES: e("Cancelled after three retries", NSF, DNR),
  EXPIRED_AFTER_7DAYS: e("Expired at the 7-day cap", UNK, DNR),
  EXPIRED_BY_USER_INACTION: e("The payer did not act in time", UNK, CAR),
  FRAUD_RISK: e("Suspected fraud", FR, DNR),
  HIGH_RISK_TRANSACTION: e("The payer's bank declined on risk grounds", FR, DNR),
  INCORRECT_CUSTOMER_DATA: e("The customer data is incorrect", IR, CAR),
  INCORRECT_ITEMS_DATA: e("The HSN product code is wrong or restricted (India)", IR, DNR),
  INSUFFICIENT_FUNDS: e("Insufficient funds", NSF, CAR),
  INSUFFICIENT_FUNDS_OR_DAILY_LIMIT: e(
    "No funds or the payer's limit was reached (Pix Automatico cannot say which)",
    NSF,
    CAR,
  ),
  INTERNAL_SERVER_ERROR: e("Internal server error", PU, RC),
  INVALID_AMOUNT: e("The amount is incorrect", IA, DNR),
  INVALID_CARD: e("The card is expired, blocked or not allowed for this purchase", CD, CAR),
  INVALID_CARD_DATA: e("The payer entered wrong card data", IR, CAR),
  INVALID_DUE_DATE: e("The due date is invalid", IR, DNR),
  INVALID_MPIN_OR_OTP: e("The payer entered a wrong PIN or OTP", AF, CAR),
  INVALID_PARAMETERS: e("Invalid parameters", IR, DNR),
  INVALID_VPA: e("The UPI address is invalid or inactive", IR, CAR),
  LIMIT_EXCEEDED: e("The amount is above the payer's own maximum", IA, CAR),
  MANDATE_EXPIRED: e("The enrollment expired", PMU, CAR),
  MANDATE_NOT_FOUND: e("The enrollment is unknown at the network or issuer", PMU, CAR),
  MANDATE_PAUSED: e("The payer paused the enrollment", PMU, CAR),
  MANDATE_REVOKED: e("The payer revoked the enrollment", PMU, DNR),
  MAX_AMOUNT_EXCEEDED: e(
    "The amount is above the payer's maximum (Pix Automatico: scheduling rejected)",
    IA,
    CAR,
  ),
  NO_ACCEPTED: e("Not accepted", PMU, CAR),
  NO_ACCEPTED_RETRYABLE: e("Not accepted; should be retried", UNK, RC),
  NO_ACTION_BY_PAYER: e("The payer did not complete authentication", AR, CAR),
  NOT_ALLOW_RETRY: e(
    "Settlement failed and a retry is impossible (Pix Automatico: the payer cancelled the enrollment)",
    PMU,
    DNR,
  ),
  NOTIFICATION_DELIVERY_FAILED: e(
    "The pre-debit notice was sent but not delivered to the payer",
    UNK,
    RC,
  ),
  NOTIFICATION_NOT_FOUND: e("The pre-debit notice was not sent", IR, DNR),
  PAYEE_BLOCKED_AT_REMITTER: e("The merchant is blocked at the payer's bank", CFG, MR),
  PAYMENT_NOT_VALID: e("Invalid payment scheduling", IR, DNR),
  PROVIDER_RESPONSE_ERROR: e("The provider returned an error", PU, RC),
  REJECTED_BY_USER: e("The payer rejected the enrollment", PMU, CAR),
  REMITTER_BANK_NOT_AVAILABLE: e("The payer's bank does not support the method", PMU, CAR),
  SUSPECTED_FRAUD_REMITTER_BANK: e("The payer's bank declined on risk score", FR, DNR),
  TECHNICAL_ERROR: e("Technical or gateway failure", PU, RC),
  TIMEOUT: e("An external service is unavailable; try again", NT, RC),
  TIMEOUT_ACQUIRING_BANK_UNAVAILABLE: e("The acquiring bank is unavailable; try again", PU, RC),
  TIMEOUT_BENEFICIARY_BANK_UNAVAILABLE: e("The beneficiary bank is unavailable; try again", PU, RC),
  TIMEOUT_NPCI_UNAVAILABLE: e("NPCI (India) is unavailable; try again", PU, RC),
  TIMEOUT_REMITTER_BANK_UNAVAILABLE: e("The payer's bank is unavailable; try again", PU, RC),
  TRANSACTION_NOT_FOUND: e("The transaction was not found", IR, DNR),
  USER_ACCOUNT_CLOSED: e("The payer account is closed or blocked", PMU, DNR),
  USER_BANK_VALIDATION_ISSUE: e("The payer's bank data validation failed", IR, CAR),
  WRONG_AMOUNT_UNDERPAID: e("The payer paid less than due", IA, MR),
};

/**
 * Card response descriptions (`transaction_status.description`), the only card
 * outcome a merchant sees when `description_code` is absent (23). Keys are
 * lower case.
 */
export const CARD_RESPONSE_DESCRIPTIONS: Readonly<Record<string, DescriptionEntry>> = {
  accepted: ok("Accepted"),
  "not accepted": e("Not approved; the customer should contact the issuer", CD, CAR),
  "insufficient funds": e("No funds; use another card", NSF, CAR),
  "incorrect customer data": e("The customer should review the data", IR, CAR),
  "expired card": e("Use another card", CD, CAR),
  "security code mismatch": e("The CVV is wrong", CD, CAR),
  "invalid card or card type": e("Invalid, nonexistent or blocked card", CD, CAR),
  "invalid card number": e("Review the card number", IR, CAR),
  "3-d secure required": e("The card needs 3DS; the page advises another card", AR, CAR),
  timeout: e("Timed out; EBANX says retry at any time", NT, SAFE),
  "no response from acquirer": e("EBANX says retry at any time", NT, SAFE),
  "acquirer response error": e("EBANX says retry at any time", PU, SAFE),
  "broken communication": e("EBANX says retry at any time", NT, SAFE),
  "communication mismatch": e("EBANX says retry at any time", NT, SAFE),
  "cannot fulfill transaction": e("Not fulfilled or already executed; do not retry", DUP, DNR),
  "cannot cancel transaction": e("Could not cancel; do not retry", UNK, DNR),
  "invalid due date": e("The card expiry is invalid", IR, CAR),
  "inactive card": e("The card is inactive; the page says retry at any time", CD, CAR),
  refunded: e("Already refunded; do not retry", DUP, DNR),
  "unknown acquirer error": e("EBANX says retry at any time", UNK, RC),
  "high risk transaction": e("Likely fraud", FR, DNR),
  "issuer does not support installments": e(
    "The instalment count is not available on this card",
    PMU,
    CAR,
  ),
  "cannot process transaction at this moment": e("EBANX says retry at any time", PU, SAFE),
};

export type IsoEntry = CodeEntry & { group: string; approved?: boolean };

const iso = (
  meaning: string,
  group: string,
  category: ErrorCategory,
  retry: RetryGuidance,
): IsoEntry => ({ meaning, group, category, retry });

/** ISO 8583 `transaction_status.iso_code` (64). */
export const ISO8583_CODES: Readonly<Record<string, IsoEntry>> = {
  "00": { ...iso("Approved", "Approved", UNK, "unknown"), approved: true },
  "03": iso("Invalid merchant", "Soft (Visa, Mastercard)", CFG, RC),
  "04": iso("Pick up card", "Hard (Visa, Mastercard); soft (Elo)", FR, DNR),
  "05": iso("Do not honor", "Soft (Visa, Mastercard)", CD, RC),
  "06": iso("Error", "Soft (all three)", UNK, RC),
  "07": iso("Pick up, special condition (fraud suspected)", "Hard (Visa, Mastercard)", FR, DNR),
  "12": iso("Invalid transaction", "Hard", CD, DNR),
  "13": iso(
    "Invalid amount",
    "Hard (Elo); soft, retry with a corrected amount (Visa, Mastercard)",
    IA,
    DNR,
  ),
  "14": iso("Invalid card number", "Hard", CD, CAR),
  "15": iso("No such issuer", "Hard (Visa, Mastercard)", CD, DNR),
  "19": iso("Re-enter transaction", "Hard (Elo); soft (Visa, Mastercard)", UNK, RC),
  "23": iso("Unacceptable fee", "Hard (Elo)", CD, DNR),
  "30": iso("Format error", "Hard (Elo)", IR, DNR),
  "38": iso("PIN tries exceeded", "Soft (Elo)", AF, CAR),
  "39": iso("No credit account", "Soft (Visa, Mastercard)", CD, CAR),
  "41": iso("Lost card", "Hard", FR, DNR),
  "43": iso("Stolen card", "Hard", FR, DNR),
  "46": iso("Closed account", "Hard", CD, DNR),
  "51": iso("Insufficient funds", "Soft", NSF, CAR),
  "52": iso("No checking account", "Soft (Visa, Mastercard)", CD, CAR),
  "53": iso("No savings account", "Soft (Visa, Mastercard)", CD, CAR),
  "54": iso("Expired card", "Data quality", CD, CAR),
  "55": iso("Incorrect PIN", "Data quality", AF, CAR),
  "56": iso("No card record", "Hard (Elo)", CD, DNR),
  "57": iso("Not permitted to cardholder", "Hard", CD, DNR),
  "58": iso("Not permitted to terminal", "Hard (Elo); soft (Visa, Mastercard)", CD, RC),
  "59": iso("Suspected fraud", "Soft; review and retry if legitimate", FR, MR),
  "61": iso("Exceeds withdrawal amount limit", "Soft", CD, CAR),
  "62": iso("Restricted card", "Soft", CD, RC),
  "63": iso("Security violation", "Data quality (Elo)", FR, CAR),
  "64": iso("Original amount incorrect", "Hard (Elo); soft (Visa, Mastercard)", IA, DNR),
  "65": iso("Exceeds withdrawal frequency", "Soft", CD, CAR),
  "70": iso("PIN data required", "Data quality (Visa, Mastercard)", AR, CAR),
  "74": iso("PIN error", "Soft (Visa, Mastercard)", AF, CAR),
  "75": iso("PIN tries exceeded", "Soft", AF, CAR),
  "76": iso("Invalid account", "Hard (Elo); soft (Visa, Mastercard)", CD, CAR),
  "77": iso("Invalid account", "Hard (Elo)", CD, DNR),
  "78": iso("Card not activated", "Soft", CD, CAR),
  "81": iso("Cryptographic error", "Soft (Visa, Mastercard)", PU, RC),
  "82": iso("CVV mismatch", "Data quality", CD, CAR),
  "83": iso("Security decline", "Hard (Elo)", FR, DNR),
  "86": iso("Cannot verify PIN", "Soft (Visa, Mastercard)", AF, RC),
  "91": iso("Issuer or switch inoperative", "Soft", PU, RC),
  "92": iso("Routing error", "Soft (Visa, Mastercard)", PU, RC),
  "93": iso("Violation of law", "Soft; review and retry if compliant", CD, MR),
  "94": iso("Duplicate transmission", "Soft; verify status first", DUP, RC),
  "96": iso("System malfunction", "Soft (Visa, Mastercard)", PU, RC),
  "1A": iso("Additional customer authentication required", "Data quality (Visa)", AR, CAR),
  "5C": iso("Card not on file", "Soft (Visa)", CD, CAR),
  "6P": iso("PIN required", "Data quality (Visa)", AR, CAR),
  "9G": iso("Contact card issuer", "Soft (Visa)", CD, CAR),
  B1: iso("Surcharge not permitted", "Generic (Visa)", IA, DNR),
  B2: iso("Surcharge not supported", "Generic (Visa)", IA, DNR),
  FM: iso("Fraud monitoring block (Elo, Brazil)", "Hard", FR, DNR),
  N0: iso("Force STIP", "Soft (Visa)", UNK, RC),
  N3: iso("Cash service not available", "Soft (Visa)", PMU, RC),
  N4: iso("Cash request above issuer limit", "Soft (Visa)", IA, RC),
  N7: iso("CVV mismatch", "Data quality (Visa)", CD, CAR),
  N8: iso("Cryptographic failure", "Generic (Visa)", PU, RC),
  R0: iso("Stop payment order", "Hard (Visa)", CD, DNR),
  R1: iso("Authorization revoked", "Hard (Visa)", CD, DNR),
  R2: iso("Issuer system unavailable", "Generic (Visa)", PU, RC),
  R3: iso("All authorizations revoked", "Hard (Visa)", CD, DNR),
  Z5: iso("Fallback not allowed (use chip or contactless)", "Generic (Visa)", PMU, DNR),
};

export type MacEntry = { meaning: string; group: string; retry?: RetryGuidance };

/** Mastercard Merchant Advice Codes (`transaction_status.mac_code`, 14). */
export const MAC_CODES: Readonly<Record<string, MacEntry>> = {
  "01": { meaning: "Updated card information needed", group: "Soft", retry: CAR },
  "02": { meaning: "Try again later", group: "Soft", retry: RC },
  "03": { meaning: "Account closed or fraudulent", group: "Hard", retry: DNR },
  "04": { meaning: "Issuer cannot approve now", group: "Soft", retry: RC },
  "21": { meaning: "Cardholder cancelled the agreement", group: "Hard", retry: DNR },
  "24": { meaning: "Retry after 1 hour", group: "Timed retry", retry: RC },
  "25": { meaning: "Retry after 24 hours", group: "Timed retry", retry: RC },
  "26": { meaning: "Retry after 2 days", group: "Timed retry", retry: RC },
  "27": { meaning: "Retry after 4 days", group: "Timed retry", retry: RC },
  "28": { meaning: "Retry after 6 days", group: "Timed retry", retry: RC },
  "29": { meaning: "Retry after 8 days", group: "Timed retry", retry: RC },
  "30": { meaning: "Retry after 10 days", group: "Timed retry", retry: RC },
  "40": { meaning: "Consumer non-reloadable prepaid card", group: "Informational" },
  "41": { meaning: "Consumer single-use virtual card", group: "Informational" },
};

/** ECI values (`threedsecure.threeds_result.eci`, 7). */
export const ECI_VALUES: Readonly<Record<string, string>> = {
  "00": "Mastercard: authentication failed; merchant liable",
  "01": "Mastercard: scheme authentication; issuer liable",
  "02": "Mastercard: issuer authentication; issuer liable",
  "04": "Mastercard: data-only; merchant liable",
  "05": "Other schemes: issuer authentication; issuer liable",
  "06": "Other schemes: scheme authentication; issuer liable",
  "07": "Other schemes: Visa data-only or failed authentication; merchant liable",
};

export type ThreeDsStatusInfo = {
  meaning: string;
  outcome: Outcome;
  category?: ErrorCategory;
  retry?: RetryGuidance;
};

/** `threedsecure.status` (5). */
export const THREE_DS_STATUSES: Readonly<Record<string, ThreeDsStatusInfo>> = {
  PENDING_AUTHENTICATION: { meaning: "The challenge is not finished", outcome: "pending" },
  AUTHENTICATION_DONE: { meaning: "The cardholder was verified", outcome: "success" },
  UNABLE_TO_AUTHENTICATE: {
    meaning: "The issuer or directory was unreachable or unsupported",
    outcome: "failure",
    category: AF,
    retry: RC,
  },
  ERROR_CHECKING_AUTHENTICATION: {
    meaning: "Checking the result failed after the challenge",
    outcome: "failure",
    category: AF,
    retry: RC,
  },
  TIMEOUT_AUTHENTICATION: {
    meaning: "No issuer answer in time",
    outcome: "failure",
    category: AF,
    retry: RC,
  },
};

/** `threeds_result.liability` (3). */
export const THREE_DS_LIABILITY: ReadonlySet<string> = new Set([
  "ISSUER_BANK",
  "MERCHANT",
  "NOT_IDENTIFIED",
]);

/** `brand_mandate.blocking_category` (4). */
export const BRAND_MANDATE_CATEGORIES: ReadonlySet<string> = new Set([
  "CANNOT_APPROVE_NOW",
  "DATA_ERROR",
  "GENERIC_ERROR",
  "WILL_NEVER_APPROVE",
]);

// ---------------------------------------------------------------------------
// Refunds, chargebacks and claims nested in the payment
// ---------------------------------------------------------------------------

export type RefundStatusInfo = StatusInfo & { dateField: string };

/** `payment.refunds[].status` (4). */
export const REFUND_STATUSES: Readonly<Record<string, RefundStatusInfo>> = {
  RE: {
    meaning: "Requested: queued at EBANX",
    stage: "refund",
    outcome: "pending",
    dateField: "request_date",
  },
  PE: {
    meaning: "Pending: acknowledged; for bank refunds the customer may be emailed for bank data",
    stage: "refund",
    outcome: "pending",
    dateField: "pending_date",
  },
  CO: {
    meaning: "Confirmed: the money reached the customer",
    stage: "refund",
    outcome: "success",
    dateField: "confirm_date",
  },
  CA: {
    meaning: "Cancelled by the merchant; the customer is not told",
    stage: "refund",
    outcome: "failure",
    dateField: "cancel_date",
  },
};

/** `chargeback.dispute_status` (6), with whether the dispute is finished. */
export const DISPUTE_STATUSES: Readonly<Record<string, { meaning: string; final: boolean }>> = {
  Processing: { meaning: "EBANX handles it internally (for example friendly fraud)", final: false },
  "Evidence Required": {
    meaning: "The merchant must upload evidence before the deadline (5 business days)",
    final: false,
  },
  "Under Analysis": { meaning: "The issuer is reviewing evidence, up to 120 days", final: false },
  "Dispute Won": { meaning: "The amount is credited back to settlement", final: true },
  "Dispute Lost": { meaning: "The chargeback stands", final: true },
  "Not disputed": { meaning: "No evidence by the deadline, or accepted", final: true },
};

export type ChargebackReason = {
  meaning: string;
  ebanxCategory: string;
  group: string;
  disputable: boolean;
};

const cb = (
  meaning: string,
  ebanxCategory: string,
  group: string,
  disputable: boolean,
): ChargebackReason => ({ meaning, ebanxCategory, group, disputable });

const NR = "No reason code available";
const CNP = "Card-not-present fraud; no cardholder authorization";
const NAD = "Goods not as described, defective or counterfeit";
const NRCV = "Service not provided or goods not received";
const RECUR = "Cancelled or unauthorized recurring transaction";
const CUR = "Wrong currency or transaction code";
const ACC = "Account number mismatch; authorization-related";
const PBOM = "Paid by other means, or amount/account differs";
const RISK = "Questionable merchant activity / risk identification";
const INST = "Instalment dispute or several fraudulent transactions";

/** `chargeback.reason_code` (69). */
export const CHARGEBACK_REASONS: Readonly<Record<string, ChargebackReason>> = {
  "4863/75": cb("Cardholder does not recognize the transaction", "UNRECOGNIZED", "Fraud", true),
  "4837/83": cb(CNP, "FRAUDULENT", "Fraud", true),
  "4850/57": cb(INST, "GENERAL", "Fraud", true),
  "4853/53": cb(NAD, "PRODUCT_UNACCEPTABLE", "Commercial Disagreement", true),
  "4855/30": cb(NRCV, "PRODUCT_NOT_RECEIVED", "Commercial Disagreement", true),
  "4841/41": cb(RECUR, "CREDIT_NOT_PROCESSED", "Commercial Disagreement", true),
  "4860/85": cb(
    "Credit (refund) not processed",
    "CREDIT_NOT_PROCESSED",
    "Commercial Disagreement",
    true,
  ),
  "4846/76": cb(CUR, "OVERCHARGED", "Processing Error", false),
  "4808/77": cb(ACC, "PROCESSING_ERROR", "Processing Error", false),
  "4842/74": cb("Late presentment", "PROCESSING_ERROR", "Processing Error", false),
  "0000/73": cb("Expired card", "GENERAL", "Processing Error", false),
  "4834/82": cb("Duplicate processing", "OVERCHARGED", "Processing Error", false),
  "4831/86": cb(PBOM, "PAID_BY_OTHER_MEANS", "Processing Error", false),
  "4849/93": cb(RISK, "GENERAL", "Other", false),
  "0000/79": cb(
    "Retrieval request not received or illegible (Mexico only)",
    "GENERAL",
    "CATB (MX only)",
    false,
  ),
  "0000/78": cb(
    "Transaction split to avoid a limit (Mexico only)",
    "GENERAL",
    "CATB (MX only)",
    false,
  ),
  "0000/00": cb(NR, "GENERAL", "Other", false),
  "2000/01": cb(NR, "GENERAL", "Other", false),
  "2000/02": cb(NR, "GENERAL", "Other", false),
  "4837/104": cb(CNP, "GENERAL", "Fraud", true),
  "4853/135": cb(NAD, "GENERAL", "Commercial Disagreement", true),
  "4853/134": cb(NAD, "GENERAL", "Commercial Disagreement", true),
  "4853/133": cb(NAD, "GENERAL", "Commercial Disagreement", true),
  "4855/131": cb(NRCV, "GENERAL", "Commercial Disagreement", true),
  "4855/137": cb(NRCV, "GENERAL", "Commercial Disagreement", true),
  "4841/136": cb(RECUR, "GENERAL", "Commercial Disagreement", true),
  "4841/132": cb(RECUR, "GENERAL", "Commercial Disagreement", true),
  "4860/138": cb("Credit not processed", "GENERAL", "Processing Error", false),
  "4846/123": cb(CUR, "GENERAL", "Processing Error", false),
  "4846/122": cb(CUR, "OVERCHARGED", "Processing Error", false),
  "4808/127": cb(ACC, "GENERAL", "Processing Error", false),
  "4842/121": cb("Late presentment", "PROCESSING_ERROR", "Processing Error", false),
  "0000/113": cb("Expired card", "GENERAL", "Processing Error", false),
  "4834/126": cb("Duplicate processing", "GENERAL", "Processing Error", false),
  "4831/124": cb(PBOM, "GENERAL", "Processing Error", false),
  "4831/125": cb(PBOM, "PAID_BY_OTHER_MEANS", "Processing Error", false),
  "4849/105": cb(RISK, "GENERAL", "Other", false),
  "0000/102": cb("Liability shift, non-counterfeit fraud", "GENERAL", "Card Present Only", false),
  "0000/112": cb("Declined authorization", "GENERAL", "Card Present Only", false),
  "0000/127": cb("Invalid data", "PROCESSING_ERROR", "Processing Error", false),
  "0000/138": cb(
    "Original credit transaction not accepted (Europe only)",
    "CREDIT_NOT_PROCESSED",
    "Commercial Disagreement",
    true,
  ),
  "0000/139": cb("ATM withdrawal", "PRODUCT_NOT_RECEIVED", "Card Present Only", false),
  "0000/72": cb("Signature belongs to another person", "GENERAL", "Card Present Only", false),
  "4515/80": cb(PBOM, "GENERAL", "Processing Error", false),
  "4527/103": cb("Card-present environment or condition", "GENERAL", "Card Present Only", false),
  "4750/00": cb(
    "Car rental charge not qualified or not substantiated",
    "GENERAL",
    "Commercial Disagreement",
    true,
  ),
  "4801/00": cb("Cardholder dispute", "GENERAL", "Cardholder Dispute", false),
  "4807/111": cb("Cancelled card report", "GENERAL", "Authorization", false),
  "4808/113": cb("Declined authorization", "GENERAL", "Authorization", false),
  "4808/57": cb(INST, "GENERAL", "Fraud", true),
  "4835/73": cb("Expired card or account", "GENERAL", "Authorization", false),
  "4840/00": cb("Fraudulent processing of transactions", "GENERAL", "Card Present Only", false),
  "4850/00": cb("Wrong number of instalments billed", "GENERAL", "Processing Error", false),
  "4859/00": cb("ATM dispute", "GENERAL", "Card Present Only", false),
  "4870/101": cb("Liability shift, counterfeit chip fraud", "GENERAL", "Card Present Only", false),
  "4901/000": cb("Document for second presentment not received", "GENERAL", "Other", false),
  "4902/000": cb("Document received was illegible", "GENERAL", "Other", false),
  "4903/000": cb("Scanning error: unrelated documents or partial scan", "GENERAL", "Other", false),
  "5002/000": cb("Required document not received (domestic)", "GENERAL", "Other", false),
  "5003/000": cb(
    "Required document not received or not recognized (domestic)",
    "GENERAL",
    "Other",
    false,
  ),
  "0100/10": cb("EBANX found earlier chargebacks for this customer", "GENERAL", "Fraud", true),
  "0100/11": cb("EBANX found a suspicious email pattern", "GENERAL", "Fraud", true),
  "0100/12": cb("EBANX found suspicious purchase attempts", "GENERAL", "Fraud", true),
  "0100/13": cb("EBANX found suspicious purchase history", "GENERAL", "Fraud", true),
  "0200/14": cb(
    "Earlier purchase found using an alternative payment method",
    "GENERAL",
    "Commercial Disagreement",
    true,
  ),
  "0200/15": cb(
    "Earlier undisputed purchase found with any card at the same merchant",
    "GENERAL",
    "Commercial Disagreement",
    true,
  ),
  "0200/16": cb(
    "Earlier undisputed purchase found with the same card at any merchant",
    "GENERAL",
    "Commercial Disagreement",
    true,
  ),
  "0300/17": cb("Sent to manual fraud-prevention review", "GENERAL", "Review", false),
  "0900/10": cb("E-wallet commercial disagreement", "GENERAL", "Commercial Disagreement", true),
};

/** Pix MED claim `reason` (6). */
export const MED_CLAIM_REASONS: ReadonlySet<string> = new Set([
  "fraud",
  "operation_flaw",
  "refund_cancelled",
  "money_laundering",
  "authorization_issue",
  "lrs_limit_exceeded",
]);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const PAYMENT_NOTIFICATION_OPERATION = "payment_status_change";
export const ENROLLMENT_NOTIFICATION_OPERATION = "enrollment_status_change";

export type NotificationTypeInfo = { meaning: string; stage: LifecycleStage };

/** Payment notification `notification_type` (4). */
export const NOTIFICATION_TYPES: Readonly<Record<string, NotificationTypeInfo>> = {
  update: { meaning: "The payment status changed (PE to CO or CA)", stage: "other" },
  chargeback: { meaning: "A chargeback was received for the payment", stage: "dispute" },
  refund: { meaning: "A refund of the payment changed", stage: "refund" },
  chargeback_credit: {
    meaning: "A reversed chargeback was credited back (Chargeback Credit)",
    stage: "reversal",
  },
};

export type PayoutStatusInfo = StatusInfo & { notificationOnly: boolean };

/** `payout.status` (8). CM, AD, AW and RE appear only on the notification page. */
export const PAYOUT_STATUSES: Readonly<Record<string, PayoutStatusInfo>> = {
  OP: {
    meaning: "Open; waiting to start; can be cancelled",
    stage: "payout",
    outcome: "pending",
    notificationOnly: false,
  },
  CM: {
    meaning: "Committed (/ws/payout/commit, or automatically after 6 hours)",
    stage: "payout",
    outcome: "pending",
    notificationOnly: true,
  },
  PE: {
    meaning: "In payment process",
    stage: "payout",
    outcome: "pending",
    notificationOnly: false,
  },
  AD: {
    meaning: "Awaiting documents",
    stage: "payout",
    outcome: "pending",
    notificationOnly: true,
  },
  AW: {
    meaning: "Awaiting payment",
    stage: "payout",
    outcome: "pending",
    notificationOnly: true,
  },
  PA: { meaning: "Paid", stage: "payout", outcome: "success", notificationOnly: false },
  CA: { meaning: "Cancelled", stage: "payout", outcome: "failure", notificationOnly: false },
  RE: {
    meaning: "Reverted after being paid",
    stage: "payout",
    outcome: "failure",
    notificationOnly: true,
  },
};

/** Payout notification `operation` values and the status each stands for (8). */
export const PAYOUT_NOTIFICATION_OPERATIONS: Readonly<Record<string, string>> = {
  payout_status_open: "OP",
  payout_status_committed: "CM",
  payout_status_processing: "PE",
  payout_status_awaiting_documents: "AD",
  payout_status_awaiting_payment: "AW",
  payout_status_paid: "PA",
  payout_status_canceled: "CA",
  payout_status_reverted: "RE",
};

/** Payout response `type` (5). */
export const PAYOUT_RESPONSE_TYPES: Readonly<Record<string, ErrorCategory | null>> = {
  success: null,
  api_error: UNK,
  authentication_error: CFG,
  invalid_request_error: IR,
  request_error: IR,
};

// ---------------------------------------------------------------------------
// Payout API codes
// ---------------------------------------------------------------------------

const many = (
  codes: string[],
  meaning: (code: string, i: number) => string,
  category: ErrorCategory,
  retry: RetryGuidance,
): Record<string, CodeEntry> =>
  Object.fromEntries(codes.map((c, i) => [c, e(meaning(c, i), category, retry)]));

const pick =
  (...meanings: string[]) =>
  (_: string, i: number) =>
    meanings[i]!;

/** Payout API `status_code` / `code` with `type` (154), plus balance codes (2). */
export const PAYOUT_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  "HP-AR-01": e("custom_exchange_rate is not allowed (Argentina)", IR, DNR),
  "HP-BI-01": e("An encrypted request field could not be decrypted", IR, DNR),
  "HP-BR-01": e("The merchant is not allowed to pay out via Pix (Brazil)", CFG, DNR),
  ...many(
    ["HP-BR-02", "HP-BR-03"],
    pick("The Pix key is empty (Brazil)", "The Pix key is invalid (Brazil)"),
    IR,
    CAR,
  ),
  ...many(
    ["HP-BR-05", "HP-BR-06"],
    pick("The Mercado Pago account is empty", "The Mercado Pago account is not an email"),
    IR,
    CAR,
  ),
  "HP-BR-07": e("No Pix key normalizer for the target account type (Brazil)", IR, DNR),
  "HP-BR-08": e("bank_ispb is invalid (Brazil)", IR, CAR),
  "HP-CF-01": e("The payee tax id is blocked", FR, DNR),
  ...many(
    ["HP-CM-01", "HP-CM-02"],
    pick("external_reference is empty", "external_reference is not 6 to 40 characters"),
    IR,
    DNR,
  ),
  "HP-CM-03": e("A payout with this external_reference already exists", DUP, DNR),
  ...many(
    ["HP-CM-04", "HP-CM-05"],
    pick("The country is empty", "The country was not found"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-CM-06", "HP-CM-07"],
    pick("The country is not enabled", "The country is not enabled for the account"),
    CFG,
    DNR,
  ),
  "HP-CM-08": e("The currency code is empty", IR, DNR),
  ...many(
    ["HP-CM-09", "HP-CM-10", "HP-CM-11"],
    pick("The amount is empty", "The amount is invalid", "The amount is not above zero"),
    IA,
    DNR,
  ),
  "HP-CM-12": e("use_payee_hub is invalid", IR, DNR),
  ...many(
    ["HP-CM-13", "HP-CM-14"],
    pick("The bank name is empty", "The bank name is invalid"),
    IR,
    CAR,
  ),
  ...many(
    ["HP-CM-15", "HP-CM-16"],
    pick("The account type is empty", "The account type is invalid"),
    IR,
    CAR,
  ),
  ...many(
    ["HP-CM-18", "HP-CM-19", "HP-CM-20"],
    pick("The bank account is empty", "The bank branch is empty", "The bank details are empty"),
    IR,
    CAR,
  ),
  "HP-CM-21": e("The bank detail operation code is invalid", IR, CAR),
  "HP-CM-23": e("The bank account is invalid", IR, CAR),
  "HP-CM-24": e("Payouts to savings accounts are not available at this bank", PMU, CAR),
  "HP-CM-25": e("The CCI must be 20 digits (Peru)", IR, CAR),
  "HP-CM-26": e("The bank account must be 11 digits (Mexico)", IR, CAR),
  "HP-CM-27": e(
    "The CLABE must be 18 digits (Mexico) or the CBU must be 22 digits (Argentina)",
    IR,
    CAR,
  ),
  "HP-CM-28": e("The payee is not authorized for compliance reasons", FR, DNR),
  "HP-CM-29": e("The payee is invalid or was not found", IR, DNR),
  "HP-CM-30": e("The payout is larger than the merchant's balance", NSF, MR),
  "HP-CM-31": e("The monthly limit for this payee document is exceeded", IA, DNR),
  "HP-CM-32": e("The balance could not be changed", UNK, MR),
  "HP-CM-33": e("The merchant is not enabled", CFG, DNR),
  ...many(
    ["HP-CM-34", "HP-CM-35"],
    pick("The payee name is empty", "The payee name is not 3 to 100 characters"),
    IR,
    CAR,
  ),
  ...many(
    ["HP-CM-36", "HP-CM-37", "HP-CM-38"],
    pick(
      "The payee email is empty",
      "The payee email is invalid",
      "The payee email is not 5 to 100 characters",
    ),
    IR,
    CAR,
  ),
  "HP-CM-39": e("The payee is under age", IR, DNR),
  "HP-CM-40": e("The payee document is invalid; the document cannot be changed", IR, DNR),
  "HP-CM-41": e("The document type is invalid", IR, CAR),
  "HP-CM-43": e("The bank document is invalid", IR, CAR),
  "HP-CM-44": e("Neither uid nor external_reference was sent", IR, DNR),
  ...many(
    ["HP-CM-45", "HP-CM-46"],
    pick("The payout was not found", "The payout was not found for this account"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-CM-47", "HP-CM-48", "HP-CM-49", "HP-CM-50", "HP-CM-51"],
    pick(
      "The search date range is empty",
      "Search date_from is invalid",
      "Search date_to is invalid",
      "The search date range is reversed",
      "The search date range is over 31 days",
    ),
    IR,
    DNR,
  ),
  ...many(
    ["HP-CM-52", "HP-CM-53", "HP-CM-54"],
    pick("Search page is invalid", "Search status is invalid", "Search per_page is invalid"),
    IR,
    DNR,
  ),
  "HP-CM-55": e("The payout is not OP, so it cannot be cancelled", IR, DNR),
  "HP-CM-56": e("The cancellation window after the request has passed", IR, DNR),
  "HP-CM-57": e("The payee id or customer id is empty", IR, DNR),
  "HP-CM-58": e("The payee was not found", IR, DNR),
  "HP-CM-59": e("No transfer identifier was sent", IR, DNR),
  ...many(
    ["HP-CM-60", "HP-CM-61"],
    pick("The transfer was not found", "The transfer was not found for this account"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-CM-62", "HP-CM-63"],
    pick("The transfer is not OP", "The transfer cancellation window has passed"),
    IR,
    DNR,
  ),
  "HP-CM-64": e("The transfer source is invalid", IR, DNR),
  "HP-CM-68": e("The payment method is invalid or was not found", IR, DNR),
  "HP-CM-69": e("The payee document is blocked (Brazil)", FR, DNR),
  ...many(
    ["HP-CM-70", "HP-CM-73", "HP-CM-74", "HP-CM-75", "HP-CM-76"],
    pick(
      "Source bank info: the bank name is empty",
      "Source bank info: the whole object is empty",
      "Source bank info: the holder name is empty",
      "Source bank info: the account is empty",
      "Source bank info: the country is empty",
    ),
    IR,
    DNR,
  ),
  ...many(["HP-CM-78", "HP-CM-81"], pick("payee_uuid is invalid", "payee_uuid is empty"), IR, DNR),
  "HP-CM-79": e("external_reference is invalid", IR, DNR),
  ...many(
    ["HP-CM-82", "HP-CM-83"],
    pick("A transaction type is required for this country", "The transaction type is invalid"),
    IR,
    DNR,
  ),
  "HP-CM-84": e("payee.birthdate is invalid", IR, CAR),
  "HP-CM-85": e("The bank details are longer than 30 characters", IR, CAR),
  "HP-CM-86": e("The bank details must be a phone number (Colombia)", IR, CAR),
  "HP-CM-87": e("Blocked by ARCA (tax authority) verification (Argentina)", FR, MR),
  "HP-CM-88": e("The Bre-B minimum is 1,000 COP (Colombia)", IA, DNR),
  "HP-CM-89": e("The minimum is 1.00 PEN (Peru)", IA, DNR),
  ...many(
    ["HP-CM-90", "HP-CM-91"],
    pick("bank_branch is invalid", "bank_account is invalid"),
    IR,
    CAR,
  ),
  "HP-CR-01": e("The exchange rate is unavailable", PU, RC),
  ...many(
    ["HP-DF-01", "HP-DF-02"],
    pick("The request is empty", "The expression is invalid"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-DF-03", "HP-DF-04", "HP-DF-08"],
    pick("integration_key is empty", "integration_key is invalid", "integration_key is invalid"),
    CFG,
    DNR,
  ),
  "HP-DF-05": e("The account is not enabled", CFG, DNR),
  "HP-DF-06": e("The request type is invalid", IR, DNR),
  "HP-DF-07": e("JSON syntax error", IR, DNR),
  "HP-FR-01": e("Declined; the account is blocked (Brazil)", FR, DNR),
  "HP-GN-04": e("The caller is not a merchant", CFG, DNR),
  ...many(
    ["HP-GN-05", "HP-GN-06"],
    pick("The payer account was not found", "The payer account is not active"),
    CFG,
    DNR,
  ),
  "HP-GN-07": e("The origin IP is not allowed", CFG, DNR),
  ...many(
    ["HP-LL-01", "HP-LL-02"],
    pick(
      "The country and currency are invalid for a local payout",
      "The currency is invalid for a local payout",
    ),
    IR,
    DNR,
  ),
  ...many(
    ["HP-TC-01", "HP-TC-02"],
    pick("The target is not enabled for this country", "The target was not found"),
    CFG,
    DNR,
  ),
  "HP-TC-03": e("Send either payee.bank_info or target_account, not both", IR, DNR),
  "HP-TC-04": e("target_account is required for this target", IR, DNR),
  "HP-XB-01": e("The currency is invalid for this country", IR, DNR),
  "HP-XB-02": e("Zero or negative fee or amount", IA, DNR),
  "HP-XB-03": e("Above the per-transaction limit", IA, DNR),
  "HP-XB-04": e("No fee is configured; contact business development", CFG, MR),
  "HP-XB-07": e("The payee document does not match the name or birth date (Brazil)", IR, CAR),
  "HP-XB-08": e(
    "The payee document is not valid with the Brazilian Federal Revenue (Brazil)",
    IR,
    CAR,
  ),
  "HP-XB-16": e("The shareholders are invalid", IR, DNR),
  "HP-XB-19": e("A shareholder is under age", IR, DNR),
  ...many(
    ["HP-XB-20", "HP-XB-21", "HP-XB-30"],
    pick(
      "The company contact name is missing",
      "The company contact document is missing",
      "The company contact document type is missing",
    ),
    IR,
    DNR,
  ),
  ...many(
    ["HP-XB-22", "HP-XB-27"],
    pick("A shareholder document is invalid", "A shareholder document type is invalid"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-XB-23", "HP-XB-24"],
    pick(
      "A shareholder document does not match the name or birthday (Brazil)",
      "A shareholder document is not valid with the Federal Revenue (Brazil)",
    ),
    IR,
    DNR,
  ),
  "HP-XB-25": e("A shareholder email is invalid", IR, DNR),
  "HP-XB-26": e("The currency was not found for this country", IR, DNR),
  ...many(
    ["HP-XB-28", "HP-XB-29"],
    pick(
      "A shareholder document equals the payee document",
      "A shareholder document is duplicated",
    ),
    IR,
    DNR,
  ),
  "BP-HI-0001": e("A transfer with this external_reference already exists", DUP, DNR),
  "BP-HI-0002": e("The transfer is below the USD minimum", IA, DNR),
  ...many(
    ["BP-HI-0003", "BP-HI-0004"],
    pick("The daily transfer limit is reached", "The transfer limit is reached"),
    RL,
    RC,
  ),
  "BP-HI-0005": e("The transfer source is invalid", IR, DNR),
  ...many(
    ["BP-HI-0006", "BP-HI-0007"],
    pick("Insufficient balance (USD)", "Insufficient balance (other currency)"),
    NSF,
    MR,
  ),
  ...many(
    ["HP-DV-01", "HP-DV-02"],
    pick("The document and country are unknown", "The document is empty"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-VT-01", "HP-VT-02"],
    pick("Verify account: the JSON is invalid", "Verify account: the JSON is empty"),
    IR,
    DNR,
  ),
  ...many(
    ["HP-VT-03", "HP-VT-04"],
    pick("Verify account: integration_key is empty", "Verify account: integration_key is invalid"),
    CFG,
    DNR,
  ),
  "HP-VT-05": e("Verify account: the account is not enabled", CFG, DNR),
  ...many(
    ["HP-VT-06", "HP-VT-07"],
    pick("Verify account: the target was not found", "Verify account: the target account is empty"),
    IR,
    DNR,
  ),
  "HP-VT-08": e(
    "The country and currency are invalid for a local payout (verify page: Invalid country)",
    IR,
    DNR,
  ),
  ...many(
    ["HP-VT-09", "HP-VT-10"],
    pick("The target is not enabled for the country", "The target is not available for query"),
    CFG,
    DNR,
  ),
  ...many(
    ["HP-VT-11", "HP-VT-12"],
    pick(
      "The Mercado Pago configuration is missing for the merchant",
      "The Mercado Pago configuration is incomplete for the merchant",
    ),
    CFG,
    DNR,
  ),
  "HP-IN-01": e("Payouts to individuals are not allowed for this merchant", CFG, DNR),
  ...many(
    ["HP-ON-01", "HP-ON-02"],
    pick("order_number is not 6 to 32 characters", "order_number is invalid"),
    IR,
    DNR,
  ),
};

/** Payout balance codes (D/payout/balance/consult-balance). */
export const PAYOUT_BALANCE_CODES: Readonly<Record<string, CodeEntry>> = {
  "HP-BA-01": e("Balance: the currency is invalid", IR, DNR),
  "HP-BA-02": e("Balance: the date is invalid", IR, DNR),
};

// ---------------------------------------------------------------------------
// Guidance text
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Readonly<Record<RetryGuidance, string>> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (correct their data, contact their bank or issuer, or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first confirm the payment's state with /ws/query, because the original operation may already have taken effect. A new payment needs a new merchant_payment_code.",
  safe_to_retry_technical_request:
    "EBANX says this can be retried at any time. Check the payment with /ws/query first if you are not sure the earlier attempt was rejected.",
  manual_review:
    "Review the payment manually, or ask EBANX support, before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Readonly<Record<ErrorCategory, string>> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Complete the customer authentication (3DS or PIN) before a new attempt.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, the currency and the limits that apply to this operation.",
  insufficient_funds:
    "Ask the customer to use another payment method, or to contact their bank or issuer.",
  payment_method_unavailable: "Offer another payment method.",
  fraud_or_risk: "Review the payment and the risk outcome before any new attempt.",
  rate_limiting: "Slow down and send the request again later.",
  provider_unavailable: "Confirm the payment's state with /ws/query before sending a new request.",
  network_or_timeout: "Confirm the payment's state with /ws/query before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the EBANX account, integration key, tenant host and enabled countries and methods, or ask EBANX support.",
  unknown: "Check the payment in the EBANX Merchant Area, or ask EBANX support.",
};
