/**
 * BlueSnap code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/bluesnap.md, which cites
 * BlueSnap's public developer hub and support guides, verified 2026-10-25:
 *
 * Payment API error tables:  https://developers.bluesnap.com/v8976-JSON/reference/card-transaction-errors
 *                            (and the alt, refund, fraud, idempotency, subscription, surcharge,
 *                            batch, marketplace and vaulted shopper error pages)
 * Tools error tables:        https://developers.bluesnap.com/v8976-Tools/reference/wallet-errors,
 *                            hosted-payment-field-errors, 3-d-secure-for-api
 * ACH return codes:          https://support.bluesnap.com/docs/ecp
 * Webhook names:             https://support.bluesnap.com/docs/ipns-name-reference
 * Webhook parameters:        https://support.bluesnap.com/docs/ipn-parameter-reference
 *
 * Error names and codes are exact; meanings are short paraphrases. The
 * "advice" text summarizes BlueSnap's own recommended action (card errors
 * page only). Category and retry values are PandaPayLens suggestions from the
 * research file. One numeric code covers many reasons (37 card error names
 * share 14002), so errors are looked up by errorName first.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const JSON_REF = "https://developers.bluesnap.com/v8976-JSON/reference";
export const TOOLS_REF = "https://developers.bluesnap.com/v8976-Tools/reference";
export const BASICS_REF = "https://developers.bluesnap.com/reference";
export const SUPPORT = "https://support.bluesnap.com/docs";

export const ERROR_HANDLING_URL = `${JSON_REF}/error-handling-overview`;
export const MESSAGES_URL = `${JSON_REF}/messages`;
export const CARD_TRANSACTION_URL = `${JSON_REF}/card-transaction`;
export const PROCESSING_INFO_URL = `${JSON_REF}/processing-info`;
export const RETRIEVE_URL = `${JSON_REF}/retrieve`;
export const REFUND_URL = `${JSON_REF}/refund`;
export const REFUND_OBJECT_URL = `${JSON_REF}/refund-1`;
export const CHARGEBACK_URL = `${JSON_REF}/chargeback`;
export const ALT_TRANSACTION_URL = `${JSON_REF}/alt-transaction`;
export const FRAUD_EVENT_URL = `${JSON_REF}/fraud-event`;
export const IDEMPOTENCY_URL = `${BASICS_REF}/idempotency`;
export const CVV_CODES_URL = `${BASICS_REF}/cvv-response-codes`;
export const AVS_CODES_URL = `${BASICS_REF}/avs-response-codes`;
export const WEBHOOKS_URL = `${BASICS_REF}/webhooks-ipns`;
export const WEBHOOK_NAMES_URL = `${SUPPORT}/ipns-name-reference`;
export const WEBHOOK_PARAMETERS_URL = `${SUPPORT}/ipn-parameter-reference`;
export const WEBHOOK_FAQ_URL = `${SUPPORT}/ipn-faqs`;
export const WEBHOOK_SETUP_URL = `${SUPPORT}/ipn-setup`;
export const DECLINES_GUIDE_URL = `${SUPPORT}/understanding-your-declined-authorizations`;
export const ACH_URL = `${SUPPORT}/ecp`;
export const CHARGEBACKS_URL = `${SUPPORT}/about-chargebacks`;

// ---------------------------------------------------------------------------
// Error tables
// ---------------------------------------------------------------------------

export type ErrorRow = {
  /** Documented code; null where the table gives none (MISSING_ARGUMENTS). */
  code: string | null;
  /** Documented errorName; null for the 3-D Secure browser codes. */
  name: string | null;
  meaning: string;
  /** BlueSnap's own recommended action, summarized (card errors page only). */
  advice?: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Listed on the JSON page only, not on the XML page. */
  jsonOnly?: boolean;
  /** HTTP status documented for this row when it is not 400. */
  http?: number;
  /** The original operation may or may not have taken effect. */
  uncertain?: boolean;
};

export type ErrorTable = {
  id: string;
  title: string;
  url: string;
  rows: readonly ErrorRow[];
};

type RowOpts = Pick<ErrorRow, "advice" | "jsonOnly" | "http" | "uncertain">;

const row = (
  code: string | null,
  name: string | null,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts: RowOpts = {},
): ErrorRow => ({ code, name, meaning, category, retry, ...opts });

/** Card transaction errors (J/card-transaction-errors): 74 rows. */
export const CARD_TRANSACTION_ERRORS: ErrorTable = {
  id: "card",
  title: "BlueSnap card transaction errors",
  url: `${JSON_REF}/card-transaction-errors`,
  rows: [
    row(
      "7",
      "INVALID_TRANSACTION_TYPE",
      "The transaction type is not valid",
      "invalid_request",
      "do_not_retry",
      { advice: "Validate the request; then contact BlueSnap support", http: 403 },
    ),
    row(
      "30",
      "MISSING_SHOPPER_OR_CARD_HOLDER",
      "Neither cardholder data nor a vaulted shopper ID was sent",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with one of them" },
    ),
    row(
      "85",
      "INVALID_HTTP_METHOD",
      "The capture was not sent with HTTP PUT",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with PUT" },
    ),
    row(
      "90",
      "MISSING_CARD_TYPE",
      "The card type element is missing",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the card type" },
    ),
    row(
      "10000",
      "BLS_NO_SUCH_SHOPPER_PAYMENT_METHOD",
      "The vaulted shopper has no saved payment method of the requested kind",
      "invalid_request",
      "do_not_retry",
      { advice: "Add the payment method or send it in the request", jsonOnly: true },
    ),
    row(
      "10000",
      "INVALID_API_VERSION",
      "The API version in the request is not valid",
      "configuration",
      "do_not_retry",
      { advice: "Resend with a valid version" },
    ),
    row(
      "10000",
      "PAYMENT_GENERAL_FAILURE",
      "General payment failure",
      "unknown",
      "retry_conditionally",
      { advice: "Retry; if the problem persists, contact BlueSnap support", uncertain: true },
    ),
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "The request broke a validation rule; the detail is in the description",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend the corrected request" },
    ),
    row(
      "10001",
      "INVALID_MERCHANT_TRANSACTION_ID",
      "The merchant transaction ID is longer than 50 characters",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend the corrected request" },
    ),
    row(
      "10001",
      "INVALID_RECURRING_TRANSACTION",
      "The recurring transaction element is missing or not valid",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the recurring transaction element" },
    ),
    row(
      "10001",
      "MERCHANT_CONFIGURATION_ERROR",
      "There is a problem with the merchant account configuration",
      "configuration",
      "manual_review",
      { advice: "Contact BlueSnap support" },
    ),
    row(
      "10001",
      "MISSING_CARD_TYPE",
      "The card type element is missing (second listing under 10001)",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the card type" },
    ),
    row(
      "11001",
      "XSS_EXCEPTION",
      "The input is suspected to be malicious",
      "invalid_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "THREE_D_SECURITY_AUTHENTICATION_REQUIRED",
      "Soft decline: 3-D Secure authentication is required",
      "authentication_required",
      "customer_action_required",
      { advice: "Retry with 3-D Secure" },
    ),
    row("14002", "ACCOUNT_CLOSED", "The card account is closed", "card_declined", "do_not_retry", {
      advice: "Do not retry",
    }),
    row(
      "14002",
      "AUTHORIZATION_AMOUNT_ALREADY_REVERSED",
      "The authorization was already reversed",
      "invalid_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "AUTHORIZATION_AMOUNT_NOT_VALID",
      "The amount is not valid for this authorization",
      "invalid_amount",
      "do_not_retry",
      { advice: "Correct the amount, otherwise decline the order" },
    ),
    row(
      "14002",
      "AUTHORIZATION_EXPIRED",
      "The authorization has expired",
      "invalid_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "AUTHORIZATION_REVOKED",
      "The authorization for a recurring transaction was revoked",
      "card_declined",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "AUTHORIZATION_NOT_FOUND",
      "The authorization was not found",
      "invalid_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "BLS_CONNECTION_PROBLEM",
      "The request could not be completed",
      "provider_unavailable",
      "do_not_retry",
      { advice: "Do not retry", uncertain: true },
    ),
    row(
      "14002",
      "CALL_ISSUER",
      "Unspecified issuer error; the shopper should contact the issuer",
      "card_declined",
      "customer_action_required",
      { advice: "Do not retry with this card" },
    ),
    row(
      "14002",
      "CARD_LOST_OR_STOLEN",
      "The card was reported lost or stolen",
      "fraud_or_risk",
      "do_not_retry",
      { advice: "Ask for a different card or decline; do not retry with this card" },
    ),
    row(
      "14002",
      "CVV_ERROR",
      "There is a problem with the security code",
      "card_declined",
      "customer_action_required",
      { advice: "Retry with the correct security code" },
    ),
    row(
      "14002",
      "DO_NOT_HONOR",
      "The issuer declined the transaction",
      "card_declined",
      "customer_action_required",
      { advice: "Use another payment method, or retry after 24 hours" },
    ),
    row(
      "14002",
      "EXPIRED_CARD",
      "The card has expired",
      "card_declined",
      "customer_action_required",
      {
        advice:
          "Correct the expiry date, otherwise use another payment method; do not retry with this card",
      },
    ),
    row(
      "14002",
      "GENERAL_PAYMENT_PROCESSING_ERROR",
      "Unspecified processing failure; the description may hold the processor's code and message",
      "unknown",
      "retry_conditionally",
      { advice: "Retry; if the problem persists, contact BlueSnap support", uncertain: true },
    ),
    row(
      "14002",
      "HIGH_RISK_ERROR",
      "Declined as high risk",
      "fraud_or_risk",
      "customer_action_required",
      { advice: "Use another payment method, or retry after 24 hours" },
    ),
    row(
      "14002",
      "INCORRECT_INFORMATION",
      "Incorrect information; the detail is in the description",
      "invalid_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row("14002", "INCORRECT_SETUP", "Incorrect setup", "configuration", "manual_review", {
      advice: "Contact BlueSnap support",
    }),
    row(
      "14002",
      "INSUFFICIENT_FUNDS",
      "Insufficient funds",
      "insufficient_funds",
      "customer_action_required",
      { advice: "Use another payment method, try later, or decline" },
    ),
    row(
      "14002",
      "INVALID_AMOUNT",
      "The amount is not valid for this transaction",
      "invalid_amount",
      "do_not_retry",
      { advice: "Correct the amount, otherwise decline the order" },
    ),
    row(
      "14002",
      "INVALID_CARD_NUMBER",
      "The card number is not valid",
      "card_declined",
      "customer_action_required",
      {
        advice:
          "Correct the card number, otherwise use another payment method; do not retry with this card",
      },
    ),
    row(
      "14002",
      "INVALID_CARD_TYPE",
      "The card type is not valid",
      "payment_method_unavailable",
      "customer_action_required",
      { advice: "Correct the card number or use another payment method" },
    ),
    row(
      "14002",
      "INVALID_PIN_OR_PW_OR_ID_ERROR",
      "The PIN, password or ID is wrong",
      "authentication_failed",
      "customer_action_required",
      { advice: "Retry with the correct value; then contact BlueSnap support" },
    ),
    row(
      "14002",
      "INVALID_TRANSACTION",
      "The issuer does not allow this transaction",
      "card_declined",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "LIMIT_EXCEEDED",
      "The card limit was exceeded",
      "insufficient_funds",
      "customer_action_required",
      { advice: "Use another payment method, try later, or decline" },
    ),
    row(
      "14002",
      "NEW_ACCOUNT_INFORMATION_AVAILABLE",
      "The account is no longer active",
      "card_declined",
      "customer_action_required",
      { advice: "Retry with a different card", jsonOnly: true },
    ),
    row(
      "14002",
      "PICKUP_CARD",
      "The card was reported lost or stolen and should be removed from use",
      "fraud_or_risk",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "PROCESSING_AMOUNT_ERROR",
      "The amount is not valid for this transaction",
      "invalid_amount",
      "do_not_retry",
      { advice: "Correct the amount, otherwise decline the order" },
    ),
    row(
      "14002",
      "PROCESSING_DUPLICATE",
      "Duplicate of a previous transaction",
      "duplicate_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14002",
      "PROCESSING_GENERAL_DECLINE",
      "Unspecified decline",
      "card_declined",
      "retry_conditionally",
      { advice: "Retry; then ask the shopper to contact the issuer, or decline" },
    ),
    row(
      "14002",
      "PROCESSING_TIMEOUT",
      "Processing timed out",
      "network_or_timeout",
      "retry_conditionally",
      { advice: "Retry; if the problem persists, contact BlueSnap support", uncertain: true },
    ),
    row(
      "14002",
      "PROCESSING_TRANSACTION_NOT_AUTHORIZED",
      "The transaction is unauthorized",
      "card_declined",
      "do_not_retry",
      { advice: "Do not retry", jsonOnly: true },
    ),
    row("14002", "REFUND_FAILED", "General failure on a refund", "unknown", "retry_conditionally", {
      advice: "Retry; if the problem persists, contact BlueSnap support",
      uncertain: true,
    }),
    row("14002", "RESTRICTED_CARD", "The card is restricted", "card_declined", "do_not_retry", {
      advice: "Do not retry",
    }),
    row(
      "14002",
      "STRONG_CUSTOMER_AUTHENTICATION_REQUIRED",
      "Soft decline: strong customer authentication is missing",
      "authentication_required",
      "customer_action_required",
      { advice: "Retry with 3-D Secure and a challenge" },
    ),
    row(
      "14002",
      "SYSTEM_TECHNICAL_ERROR",
      "Problematic transaction or technical error",
      "provider_unavailable",
      "do_not_retry",
      { advice: "Do not retry (the Extended Payment API page says to retry)", uncertain: true },
    ),
    row(
      "14002",
      "THE_ISSUER_IS_UNAVAILABLE_OR_OFFLINE",
      "The issuer is unavailable or offline",
      "provider_unavailable",
      "retry_conditionally",
      { advice: "Retry" },
    ),
    row(
      "14002",
      "THREE_D_SECURE_FAILURE",
      "3-D Secure failed",
      "authentication_failed",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14011",
      "PAYMENT_METHOD_NOT_SUPPORTED",
      "The operation is not supported for this payment method",
      "payment_method_unavailable",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "14016",
      "NO_AVAILABLE_PROCESSORS",
      "No processor is available for this request",
      "configuration",
      "manual_review",
      { advice: "Contact BlueSnap support" },
    ),
    row(
      "15008",
      "SHOPPER_NOT_FOUND",
      "The vaulted shopper ID was not found",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the correct ID" },
    ),
    row(
      "15012",
      "SHOPPER_COUNTRY_OFAC_SANCTIONED",
      "One of the shopper's countries is OFAC sanctioned",
      "fraud_or_risk",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "16003",
      "MULTIPLE_PAYMENT_METHODS_NON_SELECTED",
      "The shopper has several payment methods and none was selected",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend selecting one" },
    ),
    row(
      "16006",
      "PAYMENT_METHOD_LIMIT_REACHED",
      "The shopper reached the limit of stored payment methods",
      "invalid_request",
      "do_not_retry",
      { jsonOnly: true },
    ),
    row(
      "20002",
      "MULTIPLE_TRANSACTIONS_FOUND",
      "Several transactions share the merchant transaction ID",
      "invalid_request",
      "do_not_retry",
      { advice: "Use a unique ID; then contact BlueSnap support" },
    ),
    row("20003", "TRANSACTION_LOCKED", "The transaction is locked", "unknown", "manual_review", {
      advice: "Contact BlueSnap support",
    }),
    row(
      "20004",
      "TRANSACTION_PAYMENT_METHOD_NOT_SUPPORTED",
      "The payment method is not supported",
      "payment_method_unavailable",
      "customer_action_required",
      { advice: "Use another payment method or decline" },
    ),
    row(
      "20005",
      "TRANSACTION_NOT_AUTHORIZED",
      "The transaction is not authorized (for example a capture without a valid authorization)",
      "invalid_request",
      "do_not_retry",
      { advice: "Repeat the authorization correctly" },
    ),
    row(
      "20006",
      "TRANSACTION_ALREADY_EXISTS",
      "An authorization reversal already exists",
      "duplicate_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "20007",
      "TRANSACTION_EXPIRED",
      "The transaction has expired",
      "invalid_request",
      "do_not_retry",
      { advice: "Create a new transaction" },
    ),
    row(
      "20008",
      "TRANSACTION_ID_REQUIRED",
      "The transaction ID is missing",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the transaction ID" },
    ),
    row(
      "20009",
      "INVALID_TRANSACTION_ID",
      "The transaction ID is not valid",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend the corrected request" },
    ),
    row(
      "20010",
      "TRANSACTION_ALREADY_CAPTURED",
      "The transaction was already captured",
      "duplicate_request",
      "do_not_retry",
      { advice: "Do not retry" },
    ),
    row(
      "20017",
      "TRANSACTION_CARD_NOT_VALID",
      "The capture failed because the card is no longer valid",
      "card_declined",
      "customer_action_required",
      { advice: "Use other card details" },
    ),
    row(
      "20031",
      "MISSING_RELEVANT_METHOD_FOR_SHOPPER",
      "The shopper has no suitable payment method (for example no card)",
      "invalid_request",
      "do_not_retry",
      { advice: "Add the payment method or send it in the request" },
    ),
    row(
      "20036",
      "CREDIT_CARD_DETAILS_PLAIN_AND_ENCRYPTED",
      "Card details were sent both plain and encrypted",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend the corrected request" },
    ),
    row(
      "20036",
      "CREDIT_CARD_ENCRYPTED_NUMBER_REQUIRED",
      "The encrypted card number is missing",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the encrypted card number" },
    ),
    row(
      "20036",
      "CREDIT_CARD_ENCRYPTED_SECURITY_CODE_REQUIRED",
      "The encrypted security code is missing",
      "invalid_request",
      "do_not_retry",
      { advice: "Resend with the encrypted security code" },
    ),
    row(
      "24012",
      "USER_NOT_AUTHORIZED",
      "The API user is not authorized for this action",
      "configuration",
      "do_not_retry",
    ),
    row(
      "43008",
      "EXTERNAL_TAX_SERVICE_MISMATCH_CURRENCY",
      "The currency differs from the tax quote currency",
      "invalid_request",
      "do_not_retry",
      { advice: "Use the same currency or request a new tax quote" },
    ),
    row(
      "43009",
      "EXTERNAL_TAX_SERVICE_UNEXPECTED_TOTAL_PAYMENT",
      "The total differs from the tax quote total",
      "invalid_amount",
      "do_not_retry",
      { advice: "Correct the amount" },
    ),
    row(
      "43010",
      "EXTERNAL_TAX_SERVICE_TAX_REFERENCE_ALREADY_USED",
      "The tax quote reference was already used, belongs to another merchant, expired or is unknown",
      "invalid_request",
      "do_not_retry",
      { advice: "Request a new tax quote" },
    ),
  ],
};

/** Alt transaction errors (J/alt-transaction-errors): 27 rows. */
export const ALT_TRANSACTION_ERRORS: ErrorTable = {
  id: "alt",
  title: "BlueSnap alt transaction errors",
  url: `${JSON_REF}/alt-transaction-errors`,
  rows: [
    row(
      "10000",
      "INVALID_API_VERSION",
      "The API version is not valid",
      "configuration",
      "do_not_retry",
    ),
    row(
      "10000",
      "SERVER_GENERAL_FAILURE",
      "The documented text says the price is negative",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "A validation rule was broken (for ACH also an invalid bank account or one not in good standing); the detail is in the description",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "11001",
      "XSS_EXCEPTION",
      "The input is suspected to be malicious",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14002",
      "GENERAL_PAYMENT_PROCESSING_ERROR",
      "Unspecified failure; the description may include the processor's code and message",
      "unknown",
      "retry_conditionally",
      { uncertain: true },
    ),
    row(
      "14010",
      "FAILED_CREATING_PAYPAL_TOKEN",
      "Could not connect to PayPal; try again shortly or use another payment method",
      "provider_unavailable",
      "retry_conditionally",
    ),
    row(
      "14011",
      "PAYMENT_METHOD_NOT_SUPPORTED",
      "The selected payment method is not valid",
      "payment_method_unavailable",
      "do_not_retry",
    ),
    row(
      "14016",
      "NO_AVAILABLE_PROCESSORS",
      "No processor is available",
      "configuration",
      "manual_review",
    ),
    row(
      "14034",
      "INVALID_PAYMENT_DETAILS",
      "The payment details are not valid",
      "invalid_request",
      "customer_action_required",
    ),
    row(
      "15008",
      "SHOPPER_NOT_FOUND",
      "The shopper ID was not found",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "15012",
      "SHOPPER_COUNTRY_OFAC_SANCTIONED",
      "A shopper country is OFAC sanctioned",
      "fraud_or_risk",
      "do_not_retry",
    ),
    row(
      "16003",
      "MULTIPLE_PAYMENT_METHODS_NON_SELECTED",
      "Several payment methods, none selected",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "17005",
      "INVALID_STEP_FIELD",
      "The PLACED step was already performed for this shopping context",
      "duplicate_request",
      "do_not_retry",
    ),
    row(
      "20002",
      "MULTIPLE_TRANSACTIONS_FOUND",
      "Several transactions share the merchant transaction ID",
      "invalid_request",
      "do_not_retry",
    ),
    row("20003", "TRANSACTION_LOCKED", "The transaction is locked", "unknown", "manual_review"),
    row(
      "20020",
      "INVALID_ALT_TRANSACTION_TYPE",
      "The alt transaction type is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20021",
      "MULTI_SHOPPER_INFORMATION",
      "Both payer info and a vaulted shopper ID were sent",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20022",
      "MISSING_SHOPPER_INFORMATION",
      "Neither payer info nor a vaulted shopper ID was sent",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20023",
      "MISSING_PAYER_INFO_FIELDS",
      "A required payer info field is missing",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20024",
      "EXPECT_NO_ECP_DETAILS",
      "An ECP transaction with a vaulted shopper must send an empty ECP element",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20025",
      "INVALID_ECP_ACCOUNT_TYPE",
      "The ECP account type is not valid",
      "invalid_request",
      "customer_action_required",
    ),
    row(
      "20025",
      "INVALID_PAYER_INFO_FIELDS",
      "A payer info value is not valid",
      "invalid_request",
      "customer_action_required",
    ),
    row(
      "20026",
      "MISMATCH_SUBSCRIPTION_CURRENCY",
      "The currency differs from the subscription currency",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20027",
      "PAYPAL_UNSUPPORTED_CURRENCY",
      "The currency is not supported with PayPal",
      "payment_method_unavailable",
      "do_not_retry",
    ),
    row(
      "24011",
      "CURRENCY_CODE_NOT_FOUND",
      "The currency code is missing",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90009",
      "SUBSCRIPTION_NOT_FOUND",
      "The subscription ID was not found",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      null,
      "MISSING_ARGUMENTS",
      "The PayPal cancel URL or return URL is missing",
      "invalid_request",
      "do_not_retry",
    ),
  ],
};

/** Refund errors (J/refund-errors): 16 rows. */
export const REFUND_ERRORS: ErrorTable = {
  id: "refund",
  title: "BlueSnap refund errors",
  url: `${JSON_REF}/refund-errors`,
  rows: [
    row(
      "14004",
      "REFUND_GENERAL_FAILURE",
      "General refund failure, or the original transaction has not cleared yet (BlueSnap says to wait 3 to 7 days)",
      "unknown",
      "retry_conditionally",
      { uncertain: true },
    ),
    row(
      "14005",
      "REFUND_MIN_AMOUNT_FAILURE",
      "The refund amount is below the minimum",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14006",
      "REFUND_MAX_AMOUNT_FAILURE",
      "The refund amount is above the maximum",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14007",
      "REFUND_PERIOD_EXPIRED",
      "The refund window has ended (transactions older than 2 years)",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14008",
      "INSUFFICIENT_FUNDS_FOR_REFUND",
      "The merchant's BlueSnap balance does not cover the refund",
      "insufficient_funds",
      "manual_review",
    ),
    row(
      "14009",
      "INVOICE_ALREADY_REFUNDED",
      "The payment was already refunded",
      "duplicate_request",
      "do_not_retry",
    ),
    row(
      "14022",
      "INVOICE_ALREADY_FULLY_REFUNDED",
      "The invoice was already fully refunded",
      "duplicate_request",
      "do_not_retry",
    ),
    row(
      "14023",
      "REFUND_IN_PROCESS",
      "Another refund for this invoice is in progress",
      "duplicate_request",
      "retry_conditionally",
    ),
    row(
      "14024",
      "PARTIAL_REFUND_NOT_SUPPORTED",
      "The invoice cannot be partially refunded",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14048",
      "PAYMENT_METHOD_NOT_REFUNDABLE",
      "The refund must be issued through merchant support",
      "payment_method_unavailable",
      "manual_review",
    ),
    row(
      "14049",
      "VENDOR_INSUFFICIENT_FUNDS_FOR_REFUND",
      "The vendor account does not hold enough funds for the refund",
      "insufficient_funds",
      "manual_review",
    ),
    row(
      "14051",
      "REFUND_TAX_AMOUNT_REQUIRED",
      "The tax amount is required, even if zero",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14052",
      "REFUND_NEGATIVE_TAX_AMOUNT",
      "The tax refund amount is negative",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14053",
      "REFUND_TAX_AMOUNT_EXCEEDS_ALLOWED_REFUNDABLE",
      "The tax refund is above the refundable tax",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14054",
      "REFUND_TAX_AMOUNT_EXCEEDS_REFUND_AMOUNT",
      "The tax refund is above the total refund",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14055",
      "REFUND_TAX_FREE_AMOUNT_EXCEEDS_ALLOWED_REFUNDABLE",
      "The tax-free part of the refund is above the refundable amount",
      "invalid_amount",
      "do_not_retry",
    ),
  ],
};

/** Fraud errors (J/fraud-errors): 2 rows. */
export const FRAUD_ERRORS: ErrorTable = {
  id: "fraud",
  title: "BlueSnap fraud errors",
  url: `${JSON_REF}/fraud-errors`,
  rows: [
    row(
      "15011",
      "FRAUD_DETECTED",
      "Fraud rules or thresholds were triggered; fraudEvents says which, and whether the order was declined (D) or held for review (R)",
      "fraud_or_risk",
      "manual_review",
    ),
    row(
      "15011",
      "FRAUD_ERROR",
      "The fraud service reported an invalid card or an invalid site; fraudEvents carries the fraud event ID",
      "fraud_or_risk",
      "manual_review",
    ),
  ],
};

/** Idempotency errors (J/idempotency-errors): 5 rows. */
export const IDEMPOTENCY_ERRORS: ErrorTable = {
  id: "idempotency",
  title: "BlueSnap idempotency errors",
  url: `${JSON_REF}/idempotency-errors`,
  rows: [
    row(
      "60101",
      "SAME_IDEMPOTENCY_KEY_WAS_ALREADY_IN_USE_WITH_PREVIOUS_DIFFERENT_REQUEST",
      "The idempotency key was reused with a different request",
      "invalid_request",
      "do_not_retry",
      { http: 422 },
    ),
    row(
      "60102",
      "REQUEST_WITH_SAME_IDEMPOTENCY_KEY_ALREADY_IN_PROGRESS",
      "The same idempotency key was sent again while the first request is still running",
      "duplicate_request",
      "retry_conditionally",
      { http: 409, uncertain: true },
    ),
    row(
      "60103",
      "IDEMPOTENCY_KEY_MAX_LENGTH_LIMIT_EXCEEDED",
      "The idempotency key is longer than 64 characters",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "60104",
      "INVALID_IDEMPOTENCY_KEY",
      "The idempotency key has characters other than letters, digits and hyphens",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "60106",
      "IDEMPOTENCY_SERVICE_TIMEOUT",
      "The idempotency service is unavailable; try later",
      "provider_unavailable",
      "safe_to_retry_technical_request",
      { uncertain: true },
    ),
  ],
};

/** Subscription and billing plan errors (J/subscription-billing-plan-errors): 40 rows. */
export const SUBSCRIPTION_ERRORS: ErrorTable = {
  id: "subscription",
  title: "BlueSnap subscription and billing plan errors",
  url: `${JSON_REF}/subscription-billing-plan-errors`,
  rows: [
    row(
      "20026",
      "MISMATCH_SUBSCRIPTION_CURRENCY",
      "The currency differs from the subscription currency",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24001",
      "INVALID_CHARGE_FREQUENCY",
      "The charge frequency is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24002",
      "MISSING_REQUIRED_FIELD",
      "A required field is missing",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24003",
      "INVALID_BILLING_PLAN_CONFIGURATION",
      "Two plan parameters cannot be combined",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24004",
      "API_CONFIGURATION_ISSUE",
      "The request failed; contact BlueSnap",
      "configuration",
      "manual_review",
    ),
    row(
      "24005",
      "RECURRING_PRICE_MINIMUM_LIMIT_NOT_REACHED",
      "The recurring price must exceed 1 USD or the equivalent",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "24006",
      "PRICE_MUST_BE_POSITIVE",
      "Prices must be positive",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "24007",
      "INVALID_GRACE_PERIOD",
      "The grace period is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24008",
      "INVALID_TRIAL_DAYS",
      "The trial days value is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24009",
      "INVALID_MAX_NUMBER_OF_CHARGES",
      "The maximum number of charges is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24010",
      "INVALID_BILLING_PLAN_NAME_LENGTH",
      "The plan name must be 1 to 199 characters",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24011",
      "CURRENCY_NOT_FOUND",
      "The currency was not found",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24013",
      "ERROR_IN_REQUEST",
      "Unexpected processing error; contact support",
      "unknown",
      "manual_review",
    ),
    row(
      "24014",
      "NON_UPDATABLE_FIELD",
      "The field cannot be updated; create a new plan",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24015",
      "CANNOT_ADD_ELEMENT",
      "The element cannot be added to an existing plan",
      "invalid_request",
      "do_not_retry",
    ),
    row("24016", "INVALID_STATUS", "The status is not valid", "invalid_request", "do_not_retry"),
    row(
      "24017",
      "CANNOT_CREATE_INACTIVE_PLAN",
      "A plan cannot be created as inactive",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24018",
      "CANNOT_DELETE_ELEMENT",
      "The element cannot be removed from an existing plan",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24023",
      "MAX_NUMBER_PLANS_EXCEEDED",
      "The maximum number of plans was reached",
      "configuration",
      "manual_review",
      { jsonOnly: true },
    ),
    row(
      "26001",
      "NEGATIVE_PAGE_SIZE",
      "The page size is negative",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "26002",
      "MAX_PAGE_SIZE_EXCEEDED",
      "The page size is above the maximum",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "26003",
      "INVALID_PAGINATION_PARAMETERS",
      "before and after were used together",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90009",
      "SUBSCRIPTION_NOT_FOUND",
      "The subscription was not found",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90010",
      "NON_OVERRIDABLE_PLAN_TYPE",
      "The plan type does not support an initial charge",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90011",
      "NON_OVERRIDABLE_TRIAL_DAYS",
      "The trial days cannot be overridden",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90012",
      "NON_OVERRIDABLE_INITIAL_CHARGE",
      "The initial charge amount cannot be overridden",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90013",
      "NO_VAULTED_SHOPPER_FOUND",
      "There is no vaulted shopper with that ID",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90014",
      "NEGATIVE_QUANTITY",
      "The subscription quantity must be above zero",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90015",
      "INVALID_CURRENCY",
      "The currency is not ISO 4217",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90016",
      "INVALID_OVERRIDE_TRIAL_DAYS",
      "The override trial days must be a number",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90017",
      "INVALID_RECURRING_CHARGE_AMOUNT",
      "The recurring charge amount must be above zero",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "90018",
      "INVALID_INITIAL_CHARGE_AMOUNT",
      "The initial charge amount must be above zero",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "90019",
      "INCORRECT_PAYMENT_DETAILS",
      "The recurring charge failed: the payment details are wrong or insufficient",
      "card_declined",
      "customer_action_required",
    ),
    row(
      "90020",
      "MULTIPLE_CARDS_FOUND_NONE_SELECTED",
      "The recurring charge failed: several cards, none selected",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90021",
      "SWITCH_PLAN_ERROR",
      "The plan (contract) switch failed",
      "unknown",
      "manual_review",
    ),
    row(
      "90022",
      "INVALID_DATE_FORMAT",
      "The date must be YYYY-MM-DD",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90023",
      "CANNOT_UPDATE_CANCELED_SUBSCRIPTION",
      "The subscription must be reactivated before it can be changed",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "90032",
      "EXISTING_CHARGE_PENDING_APPROVAL",
      "The subscription already has a payment pending approval",
      "duplicate_request",
      "retry_conditionally",
    ),
    row(
      "90033",
      "SUBSCRIPTION_INVALID_BILLING_DETAILS",
      "The billing address is missing or incomplete",
      "invalid_request",
      "customer_action_required",
    ),
    row(
      "90034",
      "SUBSCRIPTION_PAYMENT_METHOD_NOT_USABLE",
      "The payment method cannot be used now",
      "payment_method_unavailable",
      "customer_action_required",
    ),
  ],
};

/** Surcharge errors (J/surcharge-errors): 8 rows. */
export const SURCHARGE_ERRORS: ErrorTable = {
  id: "surcharge",
  title: "BlueSnap surcharge errors",
  url: `${JSON_REF}/surcharge-errors`,
  rows: [
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "A field is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14016",
      "NO_AVAILABLE_PROCESSORS",
      "The processor does not support surcharges in this currency",
      "configuration",
      "do_not_retry",
    ),
    row(
      "14040",
      "EXPIRED_TOKEN",
      "The surcharge token expired",
      "invalid_request",
      "retry_conditionally",
    ),
    row(
      "16003",
      "MULTIPLE_PAYMENT_METHODS_NON_SELECTED",
      "Several payment methods on the shopper, none selected",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "16101",
      "SURCHARGE_NOT_ENABLED",
      "Surcharging is not enabled for the account",
      "configuration",
      "manual_review",
    ),
    row(
      "16103",
      "INVALID_CARD_NUMBER",
      "Surcharge validation failed on the card number",
      "card_declined",
      "customer_action_required",
    ),
    row(
      "16104",
      "INVALID_TRANSACTION_TYPE",
      "The transaction type is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "24002",
      "MISSING_REQUIRED_FIELD",
      "A required field is missing",
      "invalid_request",
      "do_not_retry",
    ),
  ],
};

/** Batch transaction errors (J/batch-errors): 11 rows. */
export const BATCH_ERRORS: ErrorTable = {
  id: "batch",
  title: "BlueSnap batch transaction errors",
  url: `${JSON_REF}/batch-errors`,
  rows: [
    row("0", "UNEXPECTED_ERROR", "Unexpected error", "unknown", "manual_review", {
      uncertain: true,
    }),
    row(
      "2",
      "MISSING_CALLBACK_URL",
      "The callback URL is missing",
      "invalid_request",
      "do_not_retry",
    ),
    row("3", "MISSING_BATCH_ID", "The batch ID is missing", "invalid_request", "do_not_retry"),
    row(
      "4",
      "DUPLICATE_BATCH_ID",
      "The batch ID already exists",
      "duplicate_request",
      "do_not_retry",
    ),
    row(
      "6",
      "MISSING_MERCHANT_TRANSACTION_ID",
      "The merchant transaction ID is missing on a card transaction",
      "invalid_request",
      "do_not_retry",
    ),
    row("101", "INVALID_BATCH_ID", "The batch ID is not valid", "invalid_request", "do_not_retry"),
    row(
      "10000",
      "INVALID_API_VERSION",
      "The API version is not valid",
      "configuration",
      "do_not_retry",
    ),
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "A validation rule was broken",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "11001",
      "XSS_EXCEPTION",
      "The input is suspected to be malicious",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20011",
      "TRANSACTION_TYPE_NOT_ALLOWED",
      "Only AUTH_CAPTURE or CAPTURE card transactions, ECP or recurring PayPal are allowed in a batch",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "80002",
      "BATCH_PROCESSING_IN_PROGRESS",
      "The batch is still processing; ask again later",
      "unknown",
      "safe_to_retry_technical_request",
    ),
  ],
};

/** Marketplace errors (J/marketplace-errors): 16 rows. */
export const MARKETPLACE_ERRORS: ErrorTable = {
  id: "marketplace",
  title: "BlueSnap marketplace errors",
  url: `${JSON_REF}/marketplace-errors`,
  rows: [
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "The vendor (seller) request is not valid, for example against the payout configuration rules",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14030",
      "REFUND_VENDOR_AMOUNT_NOT_SUPPORTED",
      "A vendor refund amount was sent for a transaction without a vendor",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14031",
      "REFUND_NEGATIVE_VENDOR_AMOUNT",
      "The vendor refund amount must be above zero",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14034",
      "VENDOR_PAYOUT_VALUES_EXCEEDS_MERCHANT",
      "The vendor payout frequency or delay is faster than the master merchant's",
      "configuration",
      "do_not_retry",
    ),
    row(
      "14035",
      "DUPLICATE_VENDOR",
      "The same vendor is listed twice on one transaction",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14036",
      "VENDOR_LIMIT_MAX",
      "More than 10 vendors on one transaction",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14037",
      "VENDOR_COMMISSION_EXCEEDED",
      "The total commission is above 100 percent or above the sale amount",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14038",
      "VENDOR_RESERVE_NONE_DEFAULT_METHOD",
      "A reserve is allowed only on the default payout method",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14043",
      "REFUND_INVALID_VENDOR_REFUND_AMOUNT",
      "The vendor refund amount is not valid",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "14044",
      "REFUND_VENDOR_ERROR",
      "Vendor refund parameters are needed when the transaction has several vendors",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14045",
      "REFUND_INVALID_VENDOR",
      "The vendor does not belong to the transaction",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14047",
      "REFUND_NEGATIVE_MERCHANT_AMOUNT",
      "The merchant refund amount is negative",
      "invalid_amount",
      "do_not_retry",
    ),
    row(
      "20050",
      "UNAUTHORIZED_USE_OF_VENDOR",
      "The API user may not act on this vendor",
      "configuration",
      "do_not_retry",
    ),
    row(
      "20051",
      "VALIDATION_GENERAL_FAILURE",
      "The vendor agreement has both a percent and an amount commission",
      "invalid_request",
      "do_not_retry",
    ),
    row("20052", "INACTIVE_VENDOR", "The vendor is inactive", "configuration", "manual_review"),
    row(
      "20053",
      "DECLINED_VENDOR",
      "The vendor is not approved for processing",
      "configuration",
      "manual_review",
    ),
  ],
};

/** Vaulted shopper errors (J/vaulted-shopper-errors): 4 rows. */
export const VAULTED_SHOPPER_ERRORS: ErrorTable = {
  id: "vaulted_shopper",
  title: "BlueSnap vaulted shopper errors",
  url: `${JSON_REF}/vaulted-shopper-errors`,
  rows: [
    row(
      "10001",
      "VALIDATION_GENERAL_FAILURE",
      "The payment method to delete is tied to an active subscription or a payment pending approval",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14110",
      "DELETE_SHOPPER_VALIDATION_FAILURE",
      "The shopper cannot be deleted: purchases in the last 12 months, a pending SEPA or ECP payment, or active subscriptions",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20030",
      "MISSING_VAULTED_SHOPPER_FIELDS",
      "An ECP shopper needs a zip code or phone",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "20031",
      "MISSING_RELEVANT_METHOD_FOR_SHOPPER",
      "The shopper has no payment method, or the requested one does not exist",
      "invalid_request",
      "do_not_retry",
    ),
  ],
};

/** Wallet errors (T/wallet-errors): 14 rows. */
export const WALLET_ERRORS: ErrorTable = {
  id: "wallet",
  title: "BlueSnap wallet errors",
  url: `${TOOLS_REF}/wallet-errors`,
  rows: [
    row(
      "23001",
      "MISSING_WALLET_FIELDS",
      "A required wallet element is missing",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "23002",
      "INVALID_WALLET_FIELDS",
      "The wallet type value is not valid",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "23003",
      "WALLET_PROCESSING_FAILURE",
      "The wallet processor is unavailable; try later",
      "provider_unavailable",
      "retry_conditionally",
      { uncertain: true },
    ),
    row(
      "23005",
      "WALLET_EXPIRED",
      "The wallet ID has expired",
      "invalid_request",
      "customer_action_required",
    ),
    row(
      "23006",
      "WALLET_DUPLICATE_PAYMENT_METHODS",
      "The wallet was received with duplicate payment methods",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "23007",
      "WALLET_PAYMENT_NOT_ENABLED",
      "The wallet type is not enabled for the account",
      "configuration",
      "manual_review",
    ),
    row(
      "23008",
      "DUPLICATE_WALLET_RESOURCE",
      "Duplicate resource for the same call ID",
      "duplicate_request",
      "do_not_retry",
    ),
    row(
      "23009",
      "WALLET_CLIENT_KEY_FAILURE",
      "The API key could not be created",
      "provider_unavailable",
      "retry_conditionally",
    ),
    row(
      "23010",
      "INVALID_WALLET_PAYMENT_DATA",
      "The payment data could not be read from Apple Pay",
      "payment_method_unavailable",
      "customer_action_required",
    ),
    row(
      "23011",
      "WALLET_ONBOARDING_ERROR",
      "Unexpected error while registering with Apple Pay",
      "configuration",
      "manual_review",
    ),
    row("23012", "WALLET_MISSING_DOMAIN", "The domain is missing", "configuration", "do_not_retry"),
    row(
      "23013",
      "WALLET_UNREGISTERED_DOMAIN",
      "The domain is not registered with Apple",
      "configuration",
      "do_not_retry",
    ),
    row(
      "23014",
      "WALLET_CHECKOUT_CANCELED",
      "The shopper cancelled the wallet checkout",
      "unknown",
      "customer_action_required",
    ),
    row(
      "24012",
      "USER_NOT_AUTHORIZED",
      "The wallet onboarding details are missing or not accessible to the user",
      "configuration",
      "do_not_retry",
    ),
  ],
};

/** Hosted Payment Fields token errors (T/hosted-payment-field-errors): 4 rows. */
export const HOSTED_PAYMENT_FIELDS_ERRORS: ErrorTable = {
  id: "hosted_payment_fields",
  title: "BlueSnap Hosted Payment Fields errors",
  url: `${TOOLS_REF}/hosted-payment-field-errors`,
  rows: [
    row(
      "14040",
      "EXPIRED_TOKEN",
      "The Hosted Payment Fields token (pfToken) has expired",
      "invalid_request",
      "retry_conditionally",
    ),
    row(
      "14002",
      "INVALID_CC_NUMBER",
      "The card number is not valid",
      "card_declined",
      "customer_action_required",
    ),
    row(
      "14041",
      "TOKEN_NOT_FOUND",
      "The Hosted Payment Fields token (pfToken) was not found",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14042",
      "NO_PAYMENT_DETAILS_LINKED_TO_TOKEN",
      "The token has no payment method; check the client integration",
      "configuration",
      "do_not_retry",
    ),
  ],
};

/**
 * 3-D Secure error codes (T/3-d-secure-for-api): 4 rows. BlueSnap delivers
 * them to the browser onError callback and documents no errorName for them.
 */
export const THREE_DS_ERRORS: ErrorTable = {
  id: "three_ds",
  title: "BlueSnap 3-D Secure error codes",
  url: `${TOOLS_REF}/3-d-secure-for-api`,
  rows: [
    row("14100", null, "3-D Secure is not enabled", "configuration", "manual_review"),
    row(
      "14101",
      null,
      "3-D Secure authentication failed; the shopper should use another payment method",
      "authentication_failed",
      "customer_action_required",
    ),
    row(
      "14102/10",
      null,
      "The 3-D Secure object lacks the amount or currency",
      "invalid_request",
      "do_not_retry",
    ),
    row(
      "14103",
      null,
      "3-D Secure client error; BlueSnap says to continue without 3-D Secure",
      "unknown",
      "retry_conditionally",
    ),
  ],
};

export const ERROR_TABLES: readonly ErrorTable[] = [
  CARD_TRANSACTION_ERRORS,
  ALT_TRANSACTION_ERRORS,
  REFUND_ERRORS,
  FRAUD_ERRORS,
  IDEMPOTENCY_ERRORS,
  SUBSCRIPTION_ERRORS,
  SURCHARGE_ERRORS,
  BATCH_ERRORS,
  MARKETPLACE_ERRORS,
  VAULTED_SHOPPER_ERRORS,
  WALLET_ERRORS,
  HOSTED_PAYMENT_FIELDS_ERRORS,
  THREE_DS_ERRORS,
];

export type IndexedRow = { table: ErrorTable; row: ErrorRow };

function index(key: (r: ErrorRow) => string | null): ReadonlyMap<string, readonly IndexedRow[]> {
  const out = new Map<string, IndexedRow[]>();
  for (const table of ERROR_TABLES) {
    for (const r of table.rows) {
      const k = key(r);
      if (k === null) continue;
      const list = out.get(k) ?? [];
      list.push({ table, row: r });
      out.set(k, list);
    }
  }
  return out;
}

/** Every documented row for an errorName, across all tables. */
export const ERRORS_BY_NAME = index((r) => r.name);
/** Every documented row for a numeric code, across all tables. */
export const ERRORS_BY_CODE = index((r) => r.code);

/**
 * Kount RIS response keys mapped by BlueSnap (J/fraud-event). Where these
 * keys appear in a payload is not documented, so they are not decoded.
 */
export const KOUNT_RESPONSE_KEYS: Readonly<
  Record<
    string,
    {
      kount: string;
      bluesnap: string;
      meaning: string;
      category: ErrorCategory;
      retry: RetryGuidance;
    }
  >
> = {
  "323": {
    kount: "Bad Site",
    bluesnap: "Invalid Site",
    meaning: "The site ID does not match a Kount website ID",
    category: "configuration",
    retry: "manual_review",
  },
  "332": {
    kount: "Bad Card",
    bluesnap: "Invalid Card",
    meaning: "The fraud service reported the card as invalid",
    category: "card_declined",
    retry: "customer_action_required",
  },
};

export type AchReturnCode = {
  meaning: string;
  advice: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** BlueSnap deactivates the ACH account and cancels its subscriptions (since 21 June 2026). */
  deactivates?: boolean;
};

const ach = (
  meaning: string,
  advice: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  deactivates = false,
): AchReturnCode => ({ meaning, advice, category, retry, ...(deactivates ? { deactivates } : {}) });

/** ACH return codes (S/ecp): 21 codes. */
export const ACH_RETURN_CODES: Readonly<Record<string, AchReturnCode>> = {
  R01: ach(
    "Insufficient funds",
    "At most two new attempts within 30 days",
    "insufficient_funds",
    "retry_conditionally",
  ),
  R02: ach(
    "Account closed",
    "Do not retry; the account is deactivated",
    "payment_method_unavailable",
    "do_not_retry",
    true,
  ),
  R03: ach(
    "No account, or the account cannot be located",
    "Do not retry; the account is deactivated",
    "invalid_request",
    "do_not_retry",
    true,
  ),
  R04: ach(
    "Invalid account number",
    "Do not retry; the account is deactivated",
    "invalid_request",
    "do_not_retry",
    true,
  ),
  R05: ach(
    "Unauthorized debit entry",
    "Do not retry; the account is deactivated",
    "fraud_or_risk",
    "do_not_retry",
    true,
  ),
  R06: ach("Returned at the originating bank's request", "Do not retry", "unknown", "do_not_retry"),
  R07: ach(
    "The customer revoked the authorization",
    "Do not retry; the account is deactivated",
    "card_declined",
    "do_not_retry",
    true,
  ),
  R08: ach(
    "Payment stopped",
    "A retry needs the customer's authorization",
    "card_declined",
    "customer_action_required",
  ),
  R09: ach(
    "Uncollected funds",
    "At most two new attempts within 30 days",
    "insufficient_funds",
    "retry_conditionally",
  ),
  R10: ach(
    "Originator unknown to or not authorized by the receiver",
    "The account is deactivated",
    "fraud_or_risk",
    "do_not_retry",
    true,
  ),
  R11: ach(
    "Entry not in line with the authorization terms",
    "Correct and resubmit without a new authorization",
    "invalid_request",
    "customer_action_required",
  ),
  R12: ach(
    "Branch sold",
    "Do not retry; ask for other account details",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  R13: ach(
    "Invalid routing number",
    "Do not retry; confirm the routing number",
    "invalid_request",
    "customer_action_required",
  ),
  R14: ach(
    "Representative payee deceased or unable to act",
    "Do not retry",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  R15: ach(
    "Beneficiary or account holder deceased",
    "Do not retry",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  R16: ach(
    "Account frozen",
    "Retry only after the account is unfrozen",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  R20: ach(
    "Non-transaction account",
    "Do not retry; ask for other account details",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  R28: ach(
    "Routing number check digit error",
    "Do not retry; confirm the routing number",
    "invalid_request",
    "customer_action_required",
  ),
  R29: ach(
    "The corporate customer says the entry is not authorized",
    "Do not retry; the account is deactivated",
    "fraud_or_risk",
    "do_not_retry",
    true,
  ),
  R31: ach(
    "Permissible return entry",
    "Do not retry; ask for other account details",
    "unknown",
    "customer_action_required",
  ),
  R34: ach(
    "Limited participation bank",
    "Do not retry; ask for other account details",
    "payment_method_unavailable",
    "customer_action_required",
  ),
};

// ---------------------------------------------------------------------------
// Payment API value sets
// ---------------------------------------------------------------------------

export type StageInfo = { stage: LifecycleStage; meaning: string };

/** cardTransactionType values (J/card-transaction). */
export const CARD_TRANSACTION_TYPES: Readonly<Record<string, StageInfo>> = {
  AUTH_ONLY: {
    stage: "authorization",
    meaning: "Authorization only; funds are held, not captured",
  },
  AUTH_CAPTURE: { stage: "payment", meaning: "Authorization and capture in one call" },
  CAPTURE: { stage: "capture", meaning: "Capture of an earlier Auth Only" },
  AUTH_REVERSAL: { stage: "void", meaning: "Full reversal of an uncaptured authorization" },
  REFUND: { stage: "refund", meaning: "Refund transaction (retrieved by its refund ID)" },
};

/**
 * processingStatus values (J/processing-info), compared case-insensitively
 * because examples use both SUCCESS and success. Cards document SUCCESS and
 * PENDING_MERCHANT_REVIEW; the others belong to alt and batch transactions.
 */
export const PROCESSING_STATUSES: Readonly<Record<string, { outcome: Outcome; meaning: string }>> =
  {
    SUCCESS: { outcome: "success", meaning: "Processed successfully" },
    PENDING: { outcome: "pending", meaning: "Pending" },
    FAIL: { outcome: "failure", meaning: "Failed" },
    REFUNDED: { outcome: "unknown", meaning: "Refunded after processing" },
    CHARGEBACKED: { outcome: "unknown", meaning: "Charged back (PayPal)" },
    IN_PROGRESS: { outcome: "pending", meaning: "In progress (batch)" },
    IN_QUEUE: { outcome: "pending", meaning: "In queue (batch)" },
    PENDING_MERCHANT_REVIEW: {
      outcome: "pending",
      meaning: "Held for the merchant's fraud review; the merchant approves or declines it",
    },
  };

/** refundStatus values (J/refund, J/refund-1). */
export const REFUND_STATUSES: Readonly<Record<string, { outcome: Outcome; meaning: string }>> = {
  SUCCESS: { outcome: "success", meaning: "Refund issued" },
  PENDING: {
    outcome: "pending",
    meaning:
      "Pending refund: the merchant balance does not cover it yet; BlueSnap deletes it after 3 months of failed attempts",
  },
};

/** cvvResponseCode values (B/cvv-response-codes). */
export const CVV_CODES: Readonly<Record<string, string>> = {
  MA: "Match",
  NC: "Issuer not certified",
  ND: "Check not done",
  NM: "No match",
  NP: "The code should be on the card but is not present",
  NR: "Check not requested",
};

/** AVS values for avsResponseCodeZip, avsResponseCodeAddress and avsResponseCodeName (B/avs-response-codes). */
export const AVS_CODES: Readonly<Record<string, string>> = {
  M: "Match",
  N: "No match",
  U: "Not verified",
};

/** threeDSecure.authenticationResult and webhook 3dStatus (T/3-d-secure-for-api). */
export const THREE_DS_RESULTS: ReadonlySet<string> = new Set([
  "AUTHENTICATION_BYPASSED",
  "AUTHENTICATION_SUCCEEDED",
  "AUTHENTICATION_UNAVAILABLE",
  "AUTHENTICATION_FAILED",
  "AUTHENTICATION_INCOMPLETE",
]);

/** transactionRegion legal entity values. */
export const TRANSACTION_REGIONS: ReadonlySet<string> = new Set([
  "AU",
  "CA",
  "EU",
  "IL",
  "IN",
  "UK",
  "US",
]);

/** cardType values (B/credit-card-codes). */
export const CARD_BRANDS: ReadonlySet<string> = new Set([
  "AMEX",
  "CHINA_UNION_PAY",
  "DINERS",
  "DISCOVER",
  "JCB",
  "MASTERCARD",
  "VISA",
  "ELO",
  "HIPERCARD",
  "NARANJA",
  "CENCOSUD",
  "TARJETASHOPPING",
  "ARGENCARD",
  "CABAL",
]);

/** fraudEventCode values (J/fraud-event): 18, matched case-insensitively. */
export const FRAUD_EVENT_CODES: readonly string[] = [
  "AVS_ADDR_MISMATCH",
  "AVS_ADDR_NOT_VERIFIED",
  "AVS_NAME_MISMATCH",
  "AVS_ZIP_MISMATCH",
  "AVS_ZIP_NOT_VERIFIED",
  "CVV_MISMATCH",
  "CVV_NOT_VERIFIED",
  "blacklistIpCountryDecline",
  "blacklistNetworkTypeDecline",
  "blacklistPaymentCountryDecline",
  "blacklistShippingCountryDecline",
  "cardPtokVelocityDecline",
  "deviceFingerprintVelocityDecline",
  "deviceIpVelocityDecline",
  "deviceToBillingAddressDecline",
  "emailVelocityDecline",
  "highRiskDecline",
  "orderTotalDecline",
];

export const FRAUD_DECISIONS: Readonly<Record<string, string>> = {
  D: "declined",
  R: "held for review",
};

/**
 * Messages BlueSnap documents for HTTP 429 and 503 (J/error-handling-overview).
 * The field that carries them is not documented.
 */
export const THROTTLING_MESSAGES: Readonly<
  Record<string, { category: ErrorCategory; meaning: string }>
> = {
  "client request rate is too high": {
    category: "rate_limiting",
    meaning: "The merchant exceeded the request rate threshold",
  },
  "client request concurrency is too high": {
    category: "rate_limiting",
    meaning: "The merchant exceeded the concurrent request threshold",
  },
  "request rate for service is too high": {
    category: "rate_limiting",
    meaning: "The request rate for this service exceeded its threshold",
  },
  "request concurrency to specific service is too high": {
    category: "rate_limiting",
    meaning: "Concurrent requests to this service exceeded the threshold",
  },
  "service is temporarily unavailable": {
    category: "provider_unavailable",
    meaning: "The service is temporarily unavailable",
  },
};

// ---------------------------------------------------------------------------
// Webhooks (IPNs)
// ---------------------------------------------------------------------------

export type WebhookGroup =
  "payments" | "refunds_disputes" | "subscriptions" | "payment_methods" | "payouts_onboarding";

export type WebhookInfo = {
  group: WebhookGroup;
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  recurring?: boolean;
};

const wh = (
  group: WebhookGroup,
  stage: LifecycleStage,
  outcome: Outcome,
  meaning: string,
  recurring?: boolean,
): WebhookInfo => ({ group, stage, outcome, meaning, ...(recurring ? { recurring } : {}) });

/**
 * The 34 webhook names (S/ipns-name-reference), sent in `transactionType`.
 * Stage and outcome are PandaPayLens readings of BlueSnap's descriptions;
 * names whose description does not state a result keep an unknown outcome.
 */
export const WEBHOOK_TYPES: Readonly<Record<string, WebhookInfo>> = {
  CHARGE: wh(
    "payments",
    "payment",
    "success",
    "A charge was processed (for ACH and SEPA: the pending invoice was approved)",
  ),
  CHARGE_PENDING: wh(
    "payments",
    "payment",
    "pending",
    "A charge is pending (ACH/ECP and other delayed methods)",
  ),
  AUTH_ONLY: wh(
    "payments",
    "authorization",
    "success",
    "Authorization only, described for zero-amount trial subscriptions",
  ),
  AUTH_ONLY_SINGLE_CHARGE: wh(
    "payments",
    "authorization",
    "success",
    "An Auth Only transaction succeeded",
  ),
  DECLINE: wh(
    "payments",
    "payment",
    "failure",
    "The transaction was rejected by payment processing or the review process",
  ),
  CC_CHARGE_FAILED: wh("payments", "payment", "failure", "The initial charge failed"),
  FRAUD_DECLINE: wh("payments", "payment", "failure", "The order was declined by fraud screening"),
  UNDER_VENDOR_REVIEW: wh(
    "payments",
    "payment",
    "pending",
    "The order is under review (sent when the merchant reviews all orders)",
  ),
  OFFLINE_ORDER: wh(
    "payments",
    "payment",
    "unknown",
    "Offline order; the result is not described in the reviewed sources",
  ),
  REFUND: wh(
    "refunds_disputes",
    "refund",
    "success",
    "A refund was issued (for ACH also when the shopper disputed and BlueSnap removed the funds)",
  ),
  PENDING_REFUND: wh(
    "refunds_disputes",
    "refund",
    "pending",
    "A pending refund was initiated; the same name is sent when a pending refund is deleted after 3 months of failed attempts",
  ),
  CANCELLATION_REFUND: wh(
    "refunds_disputes",
    "refund",
    "success",
    "A refund that also cancelled the subscription",
  ),
  CHARGEBACK: wh(
    "refunds_disputes",
    "dispute",
    "unknown",
    "A new chargeback was opened; BlueSnap debits the merchant",
  ),
  CHARGEBACK_STATUS_CHANGED: wh(
    "refunds_disputes",
    "dispute",
    "unknown",
    "An event from Chargebacks911 that does not open a new chargeback",
  ),
  CHARGEBACK_FILE_UPLOADED: wh(
    "refunds_disputes",
    "dispute",
    "unknown",
    "Representment documents were uploaded through the Chargeback Representment Upload API",
  ),
  RECURRING: wh(
    "subscriptions",
    "payment",
    "success",
    "A recurring charge (second and later) succeeded",
    true,
  ),
  SUBSCRIPTION_CHARGE_FAILURE: wh(
    "subscriptions",
    "payment",
    "failure",
    "A recurring subscription charge failed",
    true,
  ),
  CANCELLATION: wh("subscriptions", "cancellation", "success", "The subscription was cancelled"),
  CANCEL_ON_RENEWAL: wh(
    "subscriptions",
    "subscription",
    "unknown",
    "Cancel on renewal; the effect is not described in the reviewed sources",
  ),
  CONTRACT_CHANGE: wh(
    "subscriptions",
    "subscription",
    "success",
    "The subscription moved to another contract (plan)",
  ),
  SUBSCRIPTION_REMINDER: wh(
    "subscriptions",
    "subscription",
    "unknown",
    "Reminder of an upcoming subscription payment",
  ),
  ACCOUNT_UPDATER: wh(
    "payment_methods",
    "other",
    "unknown",
    "Account Updater result for a stored card",
  ),
  ACH_NOTIFICATION_OF_CHANGE: wh(
    "payment_methods",
    "other",
    "unknown",
    "The bank reported changed ACH account details",
  ),
  CC_STATUS_CHANGED: wh(
    "payment_methods",
    "other",
    "unknown",
    "The status of a stored card changed",
  ),
  PAYMENT_METHOD_UPDATED: wh(
    "payment_methods",
    "other",
    "success",
    "A stored payment method was updated",
  ),
  PAYMENT_METHOD_UPDATE_FAILURE: wh(
    "payment_methods",
    "other",
    "failure",
    "Updating a stored payment method failed",
  ),
  VAULTED_SHOPPER: wh(
    "payment_methods",
    "other",
    "unknown",
    "A vaulted shopper was created or changed",
  ),
  PAYOUT: wh("payouts_onboarding", "payout", "success", "BlueSnap issued a payout to the merchant"),
  FAILED_PAYOUT_TRANSFER: wh("payouts_onboarding", "payout", "failure", "A payout transfer failed"),
  VENDOR_STATUS_CHANGED: wh(
    "payouts_onboarding",
    "other",
    "unknown",
    "A marketplace vendor's status changed",
  ),
  VENDOR_REPORT_AVAILABLE: wh(
    "payouts_onboarding",
    "other",
    "unknown",
    "A marketplace vendor report is available",
  ),
  MERCHANT_PARTNER_ONBOARDED: wh(
    "payouts_onboarding",
    "other",
    "unknown",
    "A partner merchant was onboarded",
  ),
  MERCHANT_PARTNER_STATUS: wh(
    "payouts_onboarding",
    "other",
    "unknown",
    "A partner merchant's status changed",
  ),
  APPLICATION_DOCUMENT_REQUEST: wh(
    "payouts_onboarding",
    "other",
    "unknown",
    "BlueSnap requests a document for a merchant application",
  ),
};

/**
 * Listed as a transactionType value and as a webhook in the parameter
 * reference, but without a section in the name reference: its meaning is
 * not documented.
 */
export const UNDESCRIBED_WEBHOOK_TYPES: ReadonlySet<string> = new Set(["RDR"]);

/** Chargeback cbStatus values (S/ipn-parameter-reference). */
export const CHARGEBACK_STATUSES: Readonly<Record<string, string>> = {
  New: "New chargeback",
  Working: "The dispute is being worked on",
  Completed_Won: "Completed: won by the merchant",
  Completed_Lost: "Completed: lost by the merchant",
  Completed_Pending: "Completed, result pending",
};

/** Chargeback `cycle` values. */
export const CHARGEBACK_CYCLES: Readonly<Record<string, string>> = {
  "1": "first chargeback",
  "2": "second chargeback",
  "9": "retrieval request",
};

/** bluesnapNode / plimusNode data center values. */
export const DATA_CENTER_NODES: Readonly<Record<string, string>> = {
  "1": "US",
  "2": "UK",
  "99": "sandbox",
};

// ---------------------------------------------------------------------------
// Guidance texts
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry:
    "Do not resend the same request; the result will not change until the cause is fixed.",
  customer_action_required:
    "A new attempt needs the shopper to act first (authenticate, correct their details, contact the issuer or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed. First retrieve the transaction (GET /services/2/transactions/{transactionId}, or by merchantTransactionId) so that a new request does not repeat an operation that took effect; reuse the same idempotency-key when resending a POST.",
  safe_to_retry_technical_request:
    "The request can be repeated as a technical retry with backoff, reusing the same idempotency-key.",
  manual_review: "Review the case manually, or contact BlueSnap support, before a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the shopper to use another card or to contact the card issuer.",
  authentication_required: "Send the payment again with 3-D Secure authentication.",
  authentication_failed: "Ask the shopper to authenticate again, or to use another payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency of the request.",
  insufficient_funds:
    "Ask the shopper to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the order and the fraud result before any new attempt.",
  rate_limiting: "Reduce the request rate or concurrency and retry later with backoff.",
  provider_unavailable:
    "Retrieve the transaction from BlueSnap to confirm its state before sending a new request.",
  network_or_timeout:
    "Retrieve the transaction from BlueSnap to confirm its state before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the merchant account configuration, API user roles and settings with BlueSnap support.",
  unknown: "Contact BlueSnap support with the transaction details.",
};
