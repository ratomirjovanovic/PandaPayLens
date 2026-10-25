/**
 * Rapyd code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/rapyd.md, which cites
 * Rapyd's public documentation (https://docs.rapyd.net/en), verified
 * 2026-10-25. The code tables were transcribed mechanically from the research
 * tables, so code values are exact; meanings are short paraphrases.
 *
 * Category and retry values are PandaPayLens suggestions; where Rapyd gives a
 * corrective action (for example "try again later"), it is reflected.
 *
 * Three code spaces are kept apart because they overlap: string error codes
 * (`status.error_code`, the payment `error_code`, the payout `error`), card
 * network codes (the suffix of `ERROR_PROCESSING_CARD - [NN]` and the payment
 * `failure_code`) and merchant advice codes (`merchant_advice_code`). Network
 * code `01` means "refer to card issuer", while advice code `01` means "do not
 * try again".
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const D = "https://docs.rapyd.net/en";
const page = (name: string) => `${D}/${name}.html`;

export const ERROR_MESSAGES_URL = page("error-messages");
export const ERROR_CODES_URL = page("rapyd-error-codes");
export const CARD_NETWORK_ERRORS_URL = page("card-network-errors");
export const MERCHANT_ADVICE_CODES_URL = page("merchant-advice-codes");
export const CREATE_PAYMENT_ERRORS_URL = page("create-payment-error-examples");
export const CREATE_PAYMENT_URL = page("create-payment");
export const RETRIEVE_PAYMENT_URL = page("retrieve-payment");
export const CREATE_REFUND_URL = page("create-refund");
export const REFUND_URL = page("refund");
export const RETRIEVE_DISPUTE_URL = page("retrieve-dispute");
export const CARD_DISPUTES_URL = page("card-disputes");
export const CREATE_PAYOUT_URL = page("create-payout");
export const PAYOUT_URL = page("payout");
export const TRANSFER_URL = page("transfer-funds-between-wallets");
export const WALLET_TRANSACTION_WEBHOOKS_URL = page("wallet-transaction-webhooks");
export const WEBHOOK_FORMAT_URL = page("webhook-format");
export const WEBHOOK_AUTHENTICATION_URL = page("webhook-authentication");
export const RETRIEVE_WEBHOOK_URL = page("retrieve-webhook");
export const PAYMENT_WEBHOOKS_URL = page("payment-webhooks");
export const REFUND_WEBHOOKS_URL = page("refund-webhooks");
export const DISPUTE_WEBHOOKS_URL = page("dispute-webhooks");
export const PAYOUT_WEBHOOKS_URL = page("payout-webhooks");
export const IDEMPOTENCY_URL = page("idempotency");
export const RATE_LIMITS_URL = page("request-rate-limits");
export const AUTH_ERRORS_URL = page("troubleshooting-authentication-and-authorization-errors");
export const SIMULATED_ERRORS_URL = page("simulated-errors");
export const ENVIRONMENTS_URL = page("environments");
export const DOCS_INDEX_URL = "https://docs.rapyd.net/llms.txt";

/** Table of the error catalog a code row comes from. */
export type CodeSection =
  | "general"
  | "authentication"
  | "payment_method"
  | "payment"
  | "card_transaction"
  | "bank_transfer"
  | "foreign_exchange"
  | "checkout"
  | "hosted_page"
  | "refund"
  | "dispute"
  | "payout"
  | "sender"
  | "beneficiary"
  | "wallet_transaction"
  | "wallet"
  | "simulated"
  | "example";

export const SECTIONS: Readonly<Record<CodeSection, { title: string; url: string }>> = {
  general: { title: "Rapyd general errors", url: page("general-errors") },
  authentication: { title: "Rapyd authentication and authorization errors", url: AUTH_ERRORS_URL },
  payment_method: { title: "Rapyd payment method errors", url: page("payment-method-errors") },
  payment: { title: "Rapyd payment errors", url: page("payment-errors") },
  card_transaction: {
    title: "Rapyd card transaction errors",
    url: page("card-transaction-errors"),
  },
  bank_transfer: {
    title: "Rapyd bank transfer error messages",
    url: page("bank-transfer-error-messages"),
  },
  foreign_exchange: {
    title: "Rapyd foreign exchange errors",
    url: page("foreign-exchange-errors"),
  },
  checkout: { title: "Rapyd checkout errors", url: page("checkout-errors") },
  hosted_page: { title: "Rapyd hosted page errors", url: page("hosted-page-errors") },
  refund: { title: "Rapyd refund errors", url: page("refund-errors") },
  dispute: { title: "Rapyd dispute errors", url: page("dispute-errors") },
  payout: { title: "Rapyd payout errors", url: page("payout-errors") },
  sender: { title: "Rapyd sender errors", url: page("sender-errors") },
  beneficiary: { title: "Rapyd beneficiary errors", url: page("beneficiary-errors") },
  wallet_transaction: {
    title: "Rapyd wallet transaction errors",
    url: page("wallet-transaction-errors"),
  },
  wallet: { title: "Rapyd wallet errors", url: page("wallet-errors") },
  simulated: { title: "Rapyd simulated errors (sandbox)", url: SIMULATED_ERRORS_URL },
  example: { title: "Rapyd error code catalog", url: ERROR_CODES_URL },
};

/** Documentation page of each code that appears only in a documented example. */
export const EXAMPLE_SOURCES: Readonly<Record<string, string>> = {
  ERROR_CAPTURE_PAYMENT_IS_EXIPRED: page("capture-payment"),
  ERROR_GET_SENDER: page("payout-creation-failed-webhook"),
  ERROR_INVALID_PARAMETER_VALUE: page("update-payment"),
  ERROR_PAYMENT_IS_NOT_UPDATABLE: page("update-payment"),
  IMMUTABLE_FIELD: page("update-payment"),
  INVALID_AMOUNT: CREATE_REFUND_URL,
  NOT_IMPLEMENTED: page("payout-created-webhook"),
  MISSING_PAYOUT_METHOD_REQUIRED_FIELD: page("payout-failed-webhook"),
  MISSING_INVALID_PARAMETERS: "https://github.com/Rapyd-Samples/RapydOpenAPI",
};

type ErrorRow = readonly [string, CodeSection, string, ErrorCategory, RetryGuidance];
/** Network tables: common errors, card eligibility for payouts, other errors. */
export type NetworkTable = "common" | "payout_eligibility" | "other";
type NetworkRow = readonly [string, NetworkTable, string, ErrorCategory, RetryGuidance];
type AdviceRow = readonly [string, string, ErrorCategory, RetryGuidance];

/*
 * Rows as printed in the research tables. Codes with a placeholder or a
 * field name at the end (`ERROR_PROCESSING_CARD - <code>`,
 * `..._FIELDS_[<FIELD>]`, `... [FIELD_NAMES]`, `... - [PHONE_NUMBER]`) are
 * looked up without it; two codes are printed with a space inside the name
 * and are also found without the space.
 */
const ERROR_ROWS: readonly ErrorRow[] = [
  [
    "EMAIL_IS_VERIFIED",
    "general",
    "Email of the user already verified",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERROR_AMOUNT_MUST_BE_POSITIVE",
    "general",
    "amount is zero or negative",
    "invalid_amount",
    "do_not_retry",
  ],
  ["ERROR_AMOUNT_NOT_VALID", "general", "amount not valid", "invalid_amount", "do_not_retry"],
  [
    "ERROR_BANK_IDENTIFIER_MISMATCH",
    "general",
    "Bank part of the account number does not match the bank identifier",
    "invalid_request",
    "customer_action_required",
  ],
  ["ERROR_CARD_EXPIRED", "general", "Card expired", "card_declined", "customer_action_required"],
  [
    "ERROR_CARD_NOT_AUTHENTICATED",
    "general",
    "Card ID used before the cardholder finished 3DS",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "ERROR_DAYS_UNTIL_DUE_NOT_VALID",
    "general",
    "days_until_due not a positive integer",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_DUPLICATE_TRANSACTION",
    "general",
    "Same action already performed and completed",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERROR_LIST_PAYMENTS_PAYOUTS_QUERY_MISMATCH",
    "general",
    "Incompatible list query parameters",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS",
    "general",
    "List query date range longer than 90 days",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_STATEMENT_DESCRIPTOR_TOO_LONG",
    "general",
    "statement_descriptor longer than 22 characters",
    "invalid_request",
    "do_not_retry",
  ],
  ["GENERAL_ERROR", "general", "No detail; contact Rapyd support", "unknown", "manual_review"],
  [
    "IDEMPOTENCY_ERROR",
    "general",
    "idempotency value reused from an earlier request",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "INVALID_FIELDS",
    "general",
    "A field value is not valid; field name appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_FIELDS",
    "general",
    "Required fields missing; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "UNAUTHORIZED_API_CALL",
    "authentication",
    "HTTP 401. Wrong path or HTTP method, object not in this environment or account, or feature not enabled. The sample has an empty message",
    "configuration",
    "do_not_retry",
  ],
  [
    "ROUTE_PERMISSION_ERROR",
    "authentication",
    "HTTP 400. Route permission problem: wrong keys or feature not configured",
    "configuration",
    "do_not_retry",
  ],
  [
    "MISSING_AUTHENTICATION_HEADERS",
    "authentication",
    "HTTP 400. access_key, salt, timestamp or signature missing, or timestamp not numeric",
    "configuration",
    "do_not_retry",
  ],
  [
    "UNAUTHENTICATED_API_CALL",
    "authentication",
    "HTTP 401. Access key wrong, changed or account deactivated; or signature mismatch (same code, different message)",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_GET_PAYMENT_METHOD_TYPE",
    "payment_method",
    "Payment method type unknown or not enabled for this merchant",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_METHOD_EXPIRED",
    "payment_method",
    "Stored payment method has expired; use another one or refresh it",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_UPDATE_CARD_CVV_NOT_UPDATABLE",
    "payment_method",
    "Request tried to change the CVV of a saved card, which is not allowed",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_PAYMENT_METHOD",
    "payment_method",
    "Payment method update had missing or wrong fields",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_CARD_EXPIRATION_DATE",
    "payment_method",
    "Card expiry month or year is not valid",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "INVALID_PAYMENT_METHOD",
    "payment_method",
    "Payment method ID or object not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_PAYMENT_METHOD_TYPE",
    "payment_method",
    "Payment method type not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_REQUIRED_PAYMENT_METHOD_FIELDS",
    "payment_method",
    "Required fields of the payment method are missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_PAYMENT_METHOD_REQUIRED_FIELD",
    "payment_method",
    "A required payment method field is missing or invalid; the field name is appended to the code",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "PAYMENT_METHOD_FIELD_NOT_UPDATABLE",
    "payment_method",
    "Tried to change a payment method field that does not exist or cannot change; field name appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "UNKNOWN_PAYMENT_METHOD_FIELD",
    "payment_method",
    "Unexpected extra field inside fields; field name appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "CREATE_PAYMENT_APPLE_PAY_MISSING_FIELDS",
    "payment",
    "Decrypted Apple Pay data lacks required fields (listed at the end of the code)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_3DS_AUTHENTICATION_FAILURE",
    "payment",
    "3DS authentication failed; Rapyd suggests a retry, then another card or the issuer",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "ERROR_3DS_VERIFICATION_IS_NOT_SUPPORTED",
    "payment",
    "3DS was requested for a payment method that has no 3DS",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_ACCOUNT_FUNDING_TRANSACTION",
    "payment",
    "Account funding transaction (AFT) not enabled for the organization",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_ADJUSTABLE_AMOUNT_NOT_SUPPORTED",
    "payment",
    "Payment method does not allow changing the amount",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_AUTH_ONLY_IS_NOT_SUPPORTED",
    "payment",
    "Authorization without capture is not available for this method type",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_AUTHENTICATION_PHONE_UNAVAILABLE",
    "payment",
    "SEPA mandate step could not reach the account holder's phone; payment reversed, new mandate needed",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "ERROR_CANCEL_PAYMENT",
    "payment",
    "Cancel failed: payment missing or already closed",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CAPTURE_PAYMENT",
    "payment",
    "Capture failed: payment not found, closed, or bad parameters",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CAPTURE_PAYMENT_3DS_INCOMPLETE",
    "payment",
    "Capture attempted before the customer finished 3DS",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "ERROR_CAPTURE_PAYMENT_AMOUNT_EXCEEDS_AUTHORIZATION_AMOUNT",
    "payment",
    "Capture amount is larger than the authorized amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CAPTURE_PAYMENT_FOR_CARD_METHODS_ONLY",
    "payment",
    "capture was set for a non-card method; it must be null there",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CAPTURE_PAYMENT_LOCKED",
    "payment",
    "Another capture of the same payment is still running; retry after it ends",
    "duplicate_request",
    "retry_conditionally",
  ],
  [
    "ERROR_CAPTURE_TRUE_FOR_REAUTHORIZING_CARD_PAYMENT",
    "payment",
    "Reauthorization sent with capture true; must be false",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_PAYMENT_REQUIRES_CUSTOMER_INPUT_AND_CUSTOMER_NOT_PRESENT",
    "payment",
    "Card data needs customer input but initiation_type is not customer_present",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_PAYMENT_WITHOUT_CAPTURE_NOT_SUPPORTED",
    "payment",
    "Authorization-only card payment not supported by this method",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_VALIDATION_CAPTURE_TRUE",
    "payment",
    "Zero-amount card validation also asked for capture",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_VALIDATION_IN_PAYMENT_WITH_ESCROW",
    "payment",
    "Card validation combined with escrow",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_VALIDATION_IN_PAYMENT_WITH_FX",
    "payment",
    "Card validation combined with currency exchange",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_VALIDATION_IN_SPLIT_PAYMENT",
    "payment",
    "Card validation combined with a split to several wallets",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_COMPLETE_PAYMENT_CARD_NOT_CAPTURED",
    "payment",
    "Sandbox Complete Payment used on an authorized card payment; Capture Payment is required",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT",
    "payment",
    "Payment method given for the new payment was not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_ADDRESS_VERIFICATION_FAILURE",
    "payment",
    "Issuer rejected the billing address (address verification)",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_AMOUNT_EXCEEDS_MAXIMUM",
    "payment",
    "Amount above the method's max_amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_AMOUNT_LESS_THAN_MINIMUM",
    "payment",
    "Amount below the method's min_amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CAPTURE_FOR_CARD_METHODS_ONLY",
    "payment",
    "capture set on a non-card method at creation",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CAPTURE_NOT_VALID",
    "payment",
    "capture is neither true nor false",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CARD_NOT_SUPPORTED",
    "payment",
    "Card acquirer does not support this card",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_CERTIFICATE_MISMATCH",
    "payment",
    "Apple Pay certificate of the merchant does not match",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_COMPLETE_PAYMENT_URL_NOT_VALID",
    "payment",
    "complete_payment_url missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CREDIT_AMOUNT_LESS_THAN_MINIMUM",
    "payment",
    "Credit payment below the configured minimum",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_INSTALLMENT_AMOUNT_LESS_THAN_MINIMUM",
    "payment",
    "An installment amount is below the configured minimum",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CURRENCY_MISMATCH",
    "payment",
    "Payment currency not supported by the payment method",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CURRENCY_NOT_SUPPORTED",
    "payment",
    "Currency unknown or not supported by the method",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_CUSTOMER_CANCEL",
    "payment",
    "Customer canceled or disputed the transaction",
    "unknown",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_CUSTOMER_NOT_PRESENT",
    "payment",
    "Recurring, installment or MOTO payment also asked for 3DS",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_DOMESTIC_CARDS_ONLY",
    "payment",
    "Foreign-issued card used with a method that accepts domestic cards only",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_ERROR_PAYMENT_URL_NOT_VALID",
    "payment",
    "error_payment_url missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION",
    "payment",
    "Reauthorization requested with capture true",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_INSUFFICIENT_FUNDS",
    "payment",
    "Not enough funds for the payment",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_ODFI_CANCEL",
    "payment",
    "Originating depository institution reversed the transaction",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_PAD_PROBLEM",
    "payment",
    "Problem with the pre-authorized debit agreement",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION",
    "payment",
    "Processing issue during a card reauthorization; rerun, then contact support",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_CREATE_PAYMENT_INVALID_PAYFAC_WALLET_TYPE",
    "payment",
    "ewallet is a company wallet and cannot act as a PayFac client wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_INVALID_PAYFAC_MERCHANT_WALLET_TYPE",
    "payment",
    "merchant_ewallet is not a company wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_PERCENTAGE_MUST_BE_BETWEEN_0_AND_100",
    "payment",
    "Split percentage outside 0-100",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_SPLIT_MISSING_AMOUNT_OR_PERCENTAGE",
    "payment",
    "Split allocation unclear: give amount for all wallets or percentage for all",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_SOURCE_UNAVAILABLE",
    "payment",
    "Source of funds not available",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CRYPTOCURRENCY_PURCHASE_TRANSACTION",
    "payment",
    "Cryptocurrency purchase transactions not enabled for the organization",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_DIGITAL_WALLET_NOT_SUPPORTED_FOR_GET_SESSION",
    "payment",
    "Digital wallet type does not support retrieving a payment session",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_FEATURE_NOT_ACTIVATED",
    "payment",
    "Feature not enabled for the organization",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_FEES_ONLY_ALLOWED_FOR_EWALLET_TRANSACTIONS",
    "payment",
    "payment_fees set on a payment that does not go to a wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_FIAT_FX_NOT_SUPPORTED",
    "payment",
    "FX on the received currency is not supported",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_FX_FEE_ONLY_ALLOWED_FOR_FX_TRANSACTIONS",
    "payment",
    "fx_fee set on a payment without FX",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_AMOUNT_AND_PERCENTAGE",
    "payment",
    "Split defined by both amount and percentage",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_PAYMENT",
    "payment",
    "Payment to retrieve was not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INCREASING_PAYMENT_AMOUNT",
    "payment",
    "Message says reducing an authorized amount is not supported (the name says increasing)",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_EWALLET_AMOUNT",
    "payment",
    "Split amount for a wallet is not a positive number",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_EWALLET_PERCENTAGE",
    "payment",
    "Split percentage for a wallet is not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_FX_FEE_CALC_TYPE",
    "payment",
    "fx_fee.calc_type missing or not gross/net",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_FX_FEE_VALUE",
    "payment",
    "FX fee value not acceptable (equal to or above the payment amount)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_MERCHANT_EWALLET_STATUS",
    "payment",
    "Sub-merchant wallet is not active (ACT)",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_NET_FEES",
    "payment",
    "Total net fees equal or exceed the payment amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_PAYMENT_INITIATION_TYPE",
    "payment",
    "initiation_type not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_TRANSACTION_FEE_CALC_TYPE",
    "payment",
    "transaction_fee.calc_type missing or not gross/net",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_TRANSACTION_FEE_FEE_TYPE",
    "payment",
    "transaction_fee.fee_type missing or not percentage/absolute",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_TRANSACTION_FEE_VALUE",
    "payment",
    "Transaction fee negative or not below the payment amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYMENT_TOKEN",
    "payment",
    "Payment ID required but not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MULTIPLE_CAPTURES_NOT_SUPPORTED",
    "payment",
    "Second capture on a gateway that allows only one",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_ORIGINAL_PAYMENT_EXCEEDED",
    "payment",
    "Amount larger than the referenced original payment",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_ORIGINAL_PAYMENT_NOT_FOUND",
    "payment",
    "original_payment missing or not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYER_UNKNOWN",
    "payment",
    "Payer could not be identified from the request data",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_PAYMENT_AMOUNT_HAS_TO_BE_POSITIVE",
    "payment",
    "A wallet amount in the split is not positive",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_AMOUNT_LESS_THAN_MINIMUM",
    "payment",
    "Amount below the minimum for the method type",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_AMOUNT_NOT_ADJUSTABLE",
    "payment",
    "Payment was not created as adjustable",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_CAN_NOT_BE_CANCELED",
    "payment",
    "Cancel attempted on a closed payment",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_EWALLET_NOT_AN_ARRAY_OR_STRING",
    "payment",
    "ewallet is neither a wallet ID string nor an array",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_FIELD_NAME_NOT_KNOWN",
    "payment",
    "Unknown field name in payment_fields",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_FX_INVALID_EXPIRATION",
    "payment",
    "FX payment needs a valid expiration",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_INVALID_AMOUNT",
    "payment",
    "Amount missing or not recognized",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_FX",
    "payment",
    "Payment method does not support currency exchange",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_PAYMENT_CANCELLATION",
    "payment",
    "Payment type cannot be canceled; a refund may be possible",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_METHODS_GET",
    "payment",
    "Payment method does not belong to the given customer",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_MORE_THAN_TWO_AMOUNT_OR_PERCENTAGE_ARE_MISSING",
    "payment",
    "Split allocation missing for wallets",
    "invalid_request",
    "do_not_retry",
  ],
  ["ERROR_PAYMENT_NOT_FOUND", "payment", "Payment ID not found", "invalid_request", "do_not_retry"],
  [
    "ERROR_PAYMENT_NUMBER_OF_EWALLETS_EXCEEDED",
    "payment",
    "Split across more than 10 wallets",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_PERCENT_MUST_BE_BETWEEN_0_TO_100",
    "payment",
    "Split percentage outside 0-100",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_PERCENTAGE_HAS_TO_BE_POSITIVE",
    "payment",
    "A wallet percentage is not positive",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_SPLIT_AMOUNT_EXCEEDS_PAYMENT_AMOUNT",
    "payment",
    "Sum of wallet amounts exceeds the payment amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_SPLIT_EXCEEDED_MAXIMUM_NUMBER_OF_EWALLETS",
    "payment",
    "More than 10 wallets in ewallets",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PROCESSING_CARD - <code>",
    "payment",
    "Card network refusal; the network code is appended",
    "card_declined",
    "unknown",
  ],
  [
    "ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS",
    "payment",
    "List query date range longer than 90 days",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_REAUTHORIZING_CANCELED_CARD_PAYMENT",
    "payment",
    "Reauthorization of a canceled payment",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_REAUTHORIZING_CLOSED_PAYMENT",
    "payment",
    "Reauthorization of a closed payment",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_REVERSE_PAYMENT_DISPUTE_IN_PROCESS",
    "payment",
    "Reversal blocked because the payment is under dispute",
    "invalid_request",
    "manual_review",
  ],
  [
    "ERROR_SCA_EXEMPTION_DECLINED",
    "payment",
    "SCA exemption declined; resubmit without the exemption",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "ERROR_SCA_EXEMPTION_LIMIT_NOT_VALID_OR_CURRENCY_NOT_SUPPORTED",
    "payment",
    "SCA exemption limit invalid or currency not eligible",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_SCA_EXEMPTION_NOT_ENABLED",
    "payment",
    "SCA exemptions not enabled for the merchant",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_SHVA_PAYMENT_OPERATION_NOT_PERMITTED",
    "payment",
    "Operation must be started through the Shva payment arena",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_SIMULATE_COMPLETE_PAYMENT_CARD_NOT_AUTHENTICATED",
    "payment",
    "Sandbox completion of a card payment that still needs simulated 3DS",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "ERROR_SPLIT_PAYMENT_DUPLICATE_EWALLET",
    "payment",
    "Same wallet listed twice in a split",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSACTION_FEE_INVALID_AMOUNT",
    "payment",
    "Transaction fee value not a positive number",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_PAYMENT",
    "payment",
    "Update attempted on a payment whose status is not ACT",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_PAYMENT_AMOUNT",
    "payment",
    "Amount increase allowed only for Visa/Mastercard and pre-approved merchants",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_USING_TOKEN",
    "payment",
    "Update failed: payment method not found or the payment failed",
    "invalid_request",
    "manual_review",
  ],
  [
    "INVALID_COMPLETE_PAYMENT_URL",
    "payment",
    "complete_payment_url not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_ERROR_PAYMENT_URL",
    "payment",
    "error_payment_url not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_EXPIRATION",
    "payment",
    "Date missing or invalid (Unix time, not past, at most 1 year ahead)",
    "invalid_request",
    "do_not_retry",
  ],
  ["INVALID_PAYMENT", "payment", "Payment ID not found", "invalid_request", "do_not_retry"],
  ["MISSING_PAYMENT", "payment", "Payment ID not found", "invalid_request", "do_not_retry"],
  [
    "PAYMENT_CAPTURED_BEFORE",
    "payment",
    "Capture attempted on an already closed payment",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "UNKNOWN_PAYMENT_METHOD_FIELDS",
    "payment",
    "Unrecognized field in payment_method.fields",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_AUTHENTICATION_FAILURE",
    "card_transaction",
    "3DS not completed in time; payment canceled, create a new one",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "ERROR_CARD_CVV_NOT_VALID",
    "card_transaction",
    "CVV well-formed but wrong",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_CARD_INFORMATION_NOT_VALID",
    "card_transaction",
    "Card data well-formed but not valid",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_CARD_NOT_SUPPORTED_FOR_ECOMMERCE",
    "card_transaction",
    "Card cannot be used for e-commerce",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CARD_NOT_VALID",
    "card_transaction",
    "Card ID not valid; a new card ID is needed",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CARD_TYPE_DISABLED",
    "card_transaction",
    "Card type disabled for the marketplace",
    "configuration",
    "do_not_retry",
  ],
  ["ERROR_PROCESSING_CARD", "card_transaction", "Card network error", "card_declined", "unknown"],
  [
    "ERROR_TRANSACTION_FAILED",
    "card_transaction",
    "Card transaction failed; customer should contact the issuer",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_TRANSACTION_REJECTED_BY_CARD_PROCESSOR",
    "card_transaction",
    "Processor rejected; includes a Visa/Mastercard numeric code; fix and resubmit",
    "card_declined",
    "retry_conditionally",
  ],
  [
    "ERROR_TRANSACTION_TYPE_NOT_ALLOWED_BY_SELLER",
    "card_transaction",
    "Transaction type not allowed by the seller",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSACTION_TYPE_NOT_SUPPORTED",
    "card_transaction",
    "Transaction type not supported by the card network",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "INVALID_CARD_CVV",
    "card_transaction",
    "CVV not recognized",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "INVALID_CARD_NUMBER",
    "card_transaction",
    "Card number not recognized",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_ACCOUNT_UNAVAILABLE",
    "bank_transfer",
    "Source account of the funds is closed",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_BANK _TRANSFER_MANDATE_INCOMPLETE",
    "bank_transfer",
    "Mandate data incomplete; create a new mandate (code printed with a space)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_CONTACT_BANK",
    "bank_transfer",
    "Problem with the source of funds; payer should contact the bank",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_CUSTOMER_DISPUTE",
    "bank_transfer",
    "Customer disputed the payment; it was reversed",
    "unknown",
    "manual_review",
  ],
  [
    "ERROR_CREATE_PAYMENT_INSUFFICIENT_FUNDS",
    "bank_transfer",
    "Insufficient funds",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_MANDATE_NOT_VALID",
    "bank_transfer",
    "SEPA mandate not valid",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYMENT_PAYER_DECEASED",
    "bank_transfer",
    "Institution reports the payer as deceased",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYMENT_TRANSACTION_NOT _ALLOWED_FOR_THIS_TYPE_OF_ACCOUNT",
    "bank_transfer",
    "Account type cannot be used for this transaction (code printed with a space)",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_CONVERT_CURRENCY_DAILY_LIMIT_REACHED",
    "foreign_exchange",
    "Daily wallet conversion limit reached; try the next day",
    "rate_limiting",
    "retry_conditionally",
  ],
  [
    "ERROR_CURRENCY_PAIR_NOT_VALID",
    "foreign_exchange",
    "Currency pair cannot be converted",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_DIFFERENT_CURRENCY_REQUIRED",
    "foreign_exchange",
    "Buy and sell currency are the same",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_FX_RATE",
    "foreign_exchange",
    "Rate for a currency not found; try later",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_GET_RATE",
    "foreign_exchange",
    "Rate for a currency not found; try later",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_HOSTED_PAGE_FX_FEE_ONLY_ALLOWED_FOR_FX_TRANSACTIONS",
    "foreign_exchange",
    "FX fee set on a hosted page payment without FX",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_INVALID_QUOTE_ID",
    "foreign_exchange",
    "FX quote not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PROCESSING_CONVERSION",
    "foreign_exchange",
    "FX quote already used; get a new one",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "INVALID_EXPIRATION",
    "foreign_exchange",
    "Forward date missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_SOURCE_CURRENCY",
    "foreign_exchange",
    "Sell currency not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_ACCOUNT_FUNDING_TRANSACTION",
    "checkout",
    "AFT not enabled for the organization",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_AFT_MISSING_FIELDS_[<FIELD>]",
    "checkout",
    "Customer-to-customer AFT checkout lacks fields (listed at the end)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_AFT_WITH_MULTIPLE_WALLETS",
    "checkout",
    "AFT checkout with more than one wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_AFT_WITHOUT_PURPOSE_CODE",
    "checkout",
    "AFT checkout without purpose_code",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_COUNTRY_CURRENCY_MISMATCH",
    "checkout",
    "No payment method for this country and currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_CURRENCY_COUNTRY_MISMATCH",
    "checkout",
    "Same meaning as the previous code under a different name",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_CUSTOMER_MISSING_FOR_RECURRING_OR_INSTALLMENT_RECURRENCE_TYPE",
    "checkout",
    "Recurring or installment checkout without customer",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAGE_DELAYED_CAPTURE_NO_REMAINING_SUPPORTING_CARDS",
    "checkout",
    "Method filters left no card method that supports delayed capture",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAGE_DELAYED_CAPTURE_NO_SUPPORTING_CARDS",
    "checkout",
    "No card method in the country supports delayed capture",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAGE_PAYMENT_METHOD_TYPE_CATEGORIES_VALUE_NOT_VALID",
    "checkout",
    "Bad value in payment_method_type_categories",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAGE_REQUIRED_CUSTOMER_FIELDS_NOT_VALID",
    "checkout",
    "Bad value in required_customer_fields",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAYMENT_METHOD_CATEGORY_CURRENCY_MISMATCH",
    "checkout",
    "A method category has no method for the country and currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CHECKOUT_PAYMENT_METHOD_CURRENCY_MISMATCH",
    "checkout",
    "Payment method not recognized for the country",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_CHECKOUT_AMOUNT_OUT_OF_RANGE",
    "checkout",
    "Amount out of range for all available methods",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_DIGITAL_WALLETS_ONLY_NOT_ENABLED",
    "checkout",
    "Digital-wallets-only mode not enabled",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_AMOUNT_MISMATCH",
    "checkout",
    "amount differs from the cart_items total",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_CONFLICTING_PAYMENT_METHOD_TYPES",
    "checkout",
    "Several ways of choosing payment methods given at once",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_FX_FEE_VALUE_NOT_VALID",
    "checkout",
    "FX fee value not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_GET_CUSTOMER",
    "checkout",
    "Customer not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_COUNTRY",
    "checkout",
    "Country not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_EXPORT_TYPE",
    "checkout",
    "Follow-up message type is not email or text",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_CUSTOM_ELEMENTS",
    "checkout",
    "Error in custom_elements",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE",
    "checkout",
    "Payment method not recognized for the country",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE_AND_PAYMENT_METHOD_TYPE_CATEGORIES",
    "checkout",
    "Both a method type and method categories given",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE_CATEGORIES",
    "checkout",
    "Bad value in payment_method_type_categories",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_STATUS",
    "checkout",
    "Checkout page already paid",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_CATEGORIES_NOT_ENABLED",
    "checkout",
    "A method category is not enabled",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_NOT_AVAILABLE",
    "checkout",
    "Method type not available to the organization or not existing",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_NOT_TOKENIZABLE",
    "checkout",
    "Method type does not support tokenization",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNREADABLE_PAYMENT_METHOD_TYPES_EXCLUDE_LIST",
    "checkout",
    "Exclude list not readable",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNREADABLE_PAYMENT_METHOD_TYPES_INCLUDE_LIST",
    "checkout",
    "Include list not readable",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNRECOGNIZED_PAYMENT_METHOD_TYPE",
    "checkout",
    "Method type unavailable or non-existent",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNRECOGNIZED_PAYMENT_METHOD_TYPES_TO_INCLUDE",
    "checkout",
    "Types in the include list not recognized (text refers to payout method types)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_NOT_AFT_METHOD",
    "checkout",
    "A listed method does not support AFT wallet funding",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_DISCOUNT_PERCENT_AND_AMOUNT_OFF",
    "checkout",
    "Discount type unclear: set percent off or amount off",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_HOSTED_PAGE_PAYMENT",
    "hosted_page",
    "Hosted page not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_COLLECT_CARD_CUSTOMER_NOT_FOUND",
    "hosted_page",
    "Customer for the hosted card page not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_COUNTRY_CURRENCY_MISMATCH",
    "hosted_page",
    "No payment method for the country and currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_CURRENCY_MISSING_WHEN_AMOUNT_IS_NOT_EDITABLE",
    "hosted_page",
    "Fixed-amount page without a currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_FIXED_AMOUNT_NOT_FOUND",
    "hosted_page",
    "Fixed-amount page without an amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_GET_PAYMENT_METHOD",
    "hosted_page",
    "Payment method not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_CURRENCY",
    "hosted_page",
    "Currency not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_CUSTOM_ELEMENTS",
    "hosted_page",
    "Error in custom_elements",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_INVALID_PAGE_EXPIRATION",
    "hosted_page",
    "page_expiration not between 1 minute and 30 days ahead",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_MISSING_CUSTOMER",
    "hosted_page",
    "Customer not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_NO_SUPPORTED_PAYOUT_METHOD_TYPES",
    "hosted_page",
    "No payout method type fits the given attributes",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNREADABLE_PAYOUT_METHOD_TYPES_INCLUDE_LIST",
    "hosted_page",
    "Payout method include list not readable",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_HOSTED_PAGE_UNRECOGNIZED_CARD",
    "hosted_page",
    "Card token or issued card ID not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_ADDING_REFUND",
    "refund",
    "Payment to refund not found (it must be closed)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PARTIAL_REFUND_NOT_READY",
    "refund",
    "Partial card refund temporarily unavailable; try after 24 hours",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_CREATE_REFUND",
    "refund",
    "Refund creation failed; check the payment and inputs",
    "invalid_request",
    "manual_review",
  ],
  [
    "ERROR_CREATE_REFUND_AMOUNT_REQUIRED_FOR_OPEN_INSTALLMENT_PAYMENT",
    "refund",
    "Full refund of an installment payment that is not fully collected",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_CURRENCY_NOT_VALID",
    "refund",
    "Refund currency not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_DUPLICATE_EWALLET",
    "refund",
    "Same wallet listed twice",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_EWALLET_ALREADY_FULLY_REFUNDED",
    "refund",
    "Payment already fully refunded",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_EWALLET_NOT_FOUND_IN_PAYMENT",
    "refund",
    "Wallet is not part of the payment",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_EWALLETS_INCONSISTENCY",
    "refund",
    "Split refund mixes amount and percent",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_INVALID_EWALLETS_AMOUNT",
    "refund",
    "A wallet refund amount is not positive",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_INVALID_EWALLETS_PERCENTAGE",
    "refund",
    "A wallet refund percentage is not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_MISSING_EWALLET_ID",
    "refund",
    "Wallet ID missing in the split refund",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_REFUND_PAYMENT_NOT_REFUNDABLE",
    "refund",
    "Payment method does not allow refunds",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_GET_EWALLET_NOT_ENOUGH_FUNDS",
    "refund",
    "A wallet lacks funds to cover the refund",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "ERROR_PREVIOUS_REFUND_WAS_NOT_PROPORTIONATE",
    "refund",
    "Earlier refund was non-proportional, so wallet amounts must be explicit",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS",
    "refund",
    "List query date range longer than 90 days",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_CANCEL_REFUND",
    "refund",
    "Method does not support canceling a refund",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_REFUND_AMOUNT_EXCEEDS_PAYMENT_AMOUNT",
    "refund",
    "Total refunds would exceed the payment",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_REFUND_REQUEST_FOR_PAYMENT_IN_DISPUTE",
    "refund",
    "Refund rejected because the payment is in dispute",
    "invalid_request",
    "manual_review",
  ],
  [
    "ERROR_UPDATE_REFUND",
    "refund",
    "Refund update failed or refund not found",
    "invalid_request",
    "do_not_retry",
  ],
  ["INVALID_REFUND", "refund", "Refund not found", "invalid_request", "do_not_retry"],
  [
    "INVALID_REFUND_STATUS",
    "refund",
    "Refund already completed and closed",
    "duplicate_request",
    "do_not_retry",
  ],
  ["INVALID_REFUND_TOKEN", "refund", "Refund not found", "invalid_request", "do_not_retry"],
  [
    "PAYMENT_NOT_COMPLETED",
    "refund",
    "Payment is not yet closed; refund after it closes",
    "invalid_request",
    "retry_conditionally",
  ],
  [
    "ERROR_CREATE_DISPUTE_AMOUNT_EXCESSIVE",
    "dispute",
    "Disputes would exceed the unreversed part of the payment",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_DISPUTE_AUTHORIZATION_NOT_COMPLETE",
    "dispute",
    "Authorization status does not allow a dispute",
    "invalid_request",
    "manual_review",
  ],
  [
    "ERROR_CREATE_DISPUTE_CURRENCY_MISMATCH",
    "dispute",
    "Dispute currency differs from the payment currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_DISPUTE_TOO_LATE",
    "dispute",
    "More than 110 days since capture",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CANCEL_PAYOUT",
    "payout",
    "Payout type not cancelable, or payout already confirmed or completed",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CONFIRM_PAYOUT",
    "payout",
    "FX confirmation on a completed payout or one without FX",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT",
    "payout",
    "Required field missing or wrong",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_ABA_CONTAINS_NON_NUMERIC_CHARACTERS",
    "payout",
    "ABA routing number has non-digits",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_ABA_LENGTH_NOT_VALID",
    "payout",
    "ABA routing number is not 9 digits",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_AMOUNT_UNKNOWN",
    "payout",
    "FX payout must give sender_amount or payout_amount, not both",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_BENEFICIARY_COUNTRY_AND_BANK_COUNTRY_MISMATCH",
    "payout",
    "Beneficiary country differs from the bank country",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_COUNTRY_NOT_SUPPORTED",
    "payout",
    "Sender or beneficiary country not supported by the method",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_CURRENCY_NOT_SUPPORTED",
    "payout",
    "Sender or payout currency not supported by the method",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_PURPOSE_CODE_NOT_VALID",
    "payout",
    "Sender purpose_code not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_PAYOUT_TO_CARD_BANK_NOT_SUPPORTED",
    "payout",
    "Card issuer has not enabled receiving funds through this bank",
    "payment_method_unavailable",
    "manual_review",
  ],
  [
    "ERROR_CREATE_PAYOUT_TO_CARD_CONTACT_ISSUER",
    "payout",
    "Problem with the payout card; cardholder should contact the issuer",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYOUT_TO_CARD_EXPIRED_CARD",
    "payout",
    "Payout card expired",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYOUT_TO_CARD_NUMBER_NOT_VALID",
    "payout",
    "Payout card number not valid",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_PAYOUT_TO_CARD_SERVICE_NOT_SUPPORTED",
    "payout",
    "Card not enabled to receive funds",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_EXPIRATION_SENT_FOR_NON_CASH_PAYOUT",
    "payout",
    "expiration set on a non-cash payout",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_FEE_CURRENCY_IS_INVALID_OR_NOT_SUPPORTED",
    "payout",
    "payout_fees.fee_currency invalid or unsupported",
    "invalid_request",
    "do_not_retry",
  ],
  ["ERROR_GET_PAYOUT", "payout", "Payout not found", "invalid_request", "do_not_retry"],
  [
    "ERROR_LOCATION_PROVIDED_FOR_PAYOUT_THAT_IS_NOT_LOCATION_SPECIFIC",
    "payout",
    "location given for a method that is not location-specific",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_FEE_CURRENCY",
    "payout",
    "Stablecoin payout without fee_currency",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_MERCHANT_EWALLET",
    "payout",
    "merchant_ewallet missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_OR_INVALID_PAYOUT_AMOUNT",
    "payout",
    "payout_amount not recognized",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_AMOUNT",
    "payout",
    "payout_amount not set",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_BENEFICIARY_COUNTRY",
    "payout",
    "Beneficiary country missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_BENEFICIARY_ENTITY_TYPE",
    "payout",
    "Beneficiary entity type missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_CURRENCY",
    "payout",
    "payout_currency missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_LOCATION",
    "payout",
    "location_id missing for a location payout",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_METHOD_TYPE",
    "payout",
    "payout_method_type missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_SENDER_COUNTRY",
    "payout",
    "sender_country missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_SENDER_CURRENCY",
    "payout",
    "sender_currency missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_SENDER_ENTITY_TYPE",
    "payout",
    "Sender entity type missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_MISSING_PAYOUT_UPDATE_FIELDS",
    "payout",
    "Update without description or metadata",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYER_DETAILS_IN_REQUEST_AND_SAVED_PAYER_DETAILS_MISMATCH",
    "payout",
    "Sender details differ from the request or saved sender",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_AMOUNT_EXCEEDED_ORIGINAL_AMOUNT",
    "payout",
    "Sandbox completion of a payout already fully paid",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_AMOUNT_EXCEEDS_BENEFICIARY_ACCOUNT_LIMIT",
    "payout",
    "Amount over the beneficiary account's transfer limit",
    "invalid_amount",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_AMOUNT_LESS_THAN_MINIMUM",
    "payout",
    "Amount below the method minimum",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_AMOUNT_MORE_THAN_MAXIMUM",
    "payout",
    "Amount above the method maximum",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_AMOUNT_NOT_WITHIN_RANGE_OF_PAYOUT_METHOD_TYPE",
    "payout",
    "Amount outside the method range",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_ACCOUNT_UNAVAILABLE",
    "payout",
    "Beneficiary account cannot accept funds",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_BANK_REJECT",
    "payout",
    "Beneficiary bank rejected the payout",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_BANK_REJECTION",
    "payout",
    "Beneficiary bank rejected the payout (same text as the previous code)",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_FIELDS_LENGTH_ABOVE_MAX [FIELD_NAMES]",
    "payout",
    "Card payout: beneficiary field too long; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_FIELDS_NOT_FOUND",
    "payout",
    "Beneficiary fields not found; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_FIELDS_NOT_VALID",
    "payout",
    "Beneficiary field values not valid; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_IDENTIFICATION_AND_ACCOUNT_MISMATCH",
    "payout",
    "Beneficiary ID does not match the account owner",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_IDENTIFICATION_AND_NAME_MISMATCH",
    "payout",
    "Beneficiary name does not match the identification",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_NAME_AND_ACCOUNT_MISMATCH",
    "payout",
    "Beneficiary name does not match the account owner",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_BENEFICIARY_NOT_REACHABLE_BY_METHOD",
    "payout",
    "Beneficiary account not reachable by this method",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_COUNTRY_NOT_VALID",
    "payout",
    "A country code is not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_CURRENCY_NOT_SUPPORTED",
    "payout",
    "Payout currency not supported for the beneficiary country",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_CURRENCY_NOT_VALID",
    "payout",
    "A currency code is not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_IBAN_NOT_SUPPORTED_FOR_LOCAL_GBP",
    "payout",
    "IBAN cannot receive a local GBP payout",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERROR_PAYOUT_NAME_NOT_VALID",
    "payout",
    "Beneficiary or sender name not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_NOT_CANCELABLE",
    "payout",
    "Payout method type does not allow cancellation",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYOUT_SENDER_FIELDS_LENGTH_ABOVE_MAX [FIELD_NAMES]",
    "payout",
    "Card payout: sender field too long; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UNSUPPORTED_PAYOUT_CURRENCY_OR_COUNTRY",
    "payout",
    "Country, currency or entity type combination not supported",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_NON_ACTIVE_PAYOUT",
    "payout",
    "Update on a payout whose status is not created",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_PAYOUT",
    "payout",
    "Payout to update not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_VOID_PAYOUT_INVOICE",
    "payout",
    "Tried to void an invoice of type payout",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_WALLET_FX_PAYOUT_NOT_SUPPORTED",
    "payout",
    "Payout to a wallet with different sender and payout currencies",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_BENEFICIARY_PAYOUT_ENTITY_TYPE",
    "payout",
    "Beneficiary entity_type not individual or company",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_DESTINATION_CURRENCY",
    "payout",
    "Payout currency code not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_PAYER_FIELDS",
    "payout",
    "A sender field is not valid; name appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_PAYER_PAYOUT_ENTITY_TYPE",
    "payout",
    "Sender entity type not individual or company",
    "invalid_request",
    "do_not_retry",
  ],
  ["INVALID_PAYOUT", "payout", "payout_type not found", "invalid_request", "do_not_retry"],
  [
    "INVALID_PAYOUT_CURRENCIES",
    "payout",
    "Sender or payout currency unsupported for the method type",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "INVALID_PAYOUT_ID",
    "payout",
    "Hosted payout tracker page with a bad payout_id",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_PAYOUT_METHOD_TYPE",
    "payout",
    "Payout method type not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  ["INVALID_PAYOUT_TYPE", "payout", "category not valid", "invalid_request", "do_not_retry"],
  [
    "INVALID_REQUIRED_FIELD",
    "payout",
    "A payout field fails its regex; name appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_PAYOUT_BENEFICIARY_COUNTRY",
    "payout",
    "beneficiary_country missing or not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_PAYOUT_METHOD_REQUIRED_FIELDS",
    "payout",
    "Required payout fields missing; names appended",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "PAYOUT_METHOD_TYPE_BENEFICIARY_COUNTRY_MISMATCH",
    "payout",
    "Payout method type not supported in the beneficiary country",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_SENDER_COUNTRY_NOT_VALID",
    "sender",
    "Sender country missing or not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_SENDER_CURRENCY_NOT_VALID",
    "sender",
    "Sender currency missing or not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  ["ERROR_GET_PAYER", "sender", "Payout sender not found", "invalid_request", "do_not_retry"],
  [
    "ERROR_INVALID_PAYOUT_SENDER_ENTITY_TYPE",
    "sender",
    "Sender entity type not company or individual",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_BENEFICIARY_DETAILS_IN_REQUEST_AND_SAVED_BENEFICIARY_DETAILS_MISMATCH",
    "beneficiary",
    "Request details differ from the saved beneficiary",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_BENEFICIARY",
    "beneficiary",
    "Beneficiary country not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_BENEFICIARY_COUNTRY_NOT_VALID",
    "beneficiary",
    "Beneficiary country not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_CREATE_BENEFICIARY_CURRENCY_NOT_VALID",
    "beneficiary",
    "Beneficiary currency missing or not recognized",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_DELETE_PAYOUT_BENEFICIARY",
    "beneficiary",
    "Beneficiary to delete not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_BENEFICIARY",
    "beneficiary",
    "Beneficiary not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_BENEFICIARY_WITH_NO_NEW_FIELDS",
    "beneficiary",
    "Update tried to change a beneficiary field that is already set",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_VALIDATE_PAYOUT_BENEFICIARY",
    "beneficiary",
    "Beneficiary validation found bad input fields",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "CANCEL_TRANSACTION_ERROR",
    "wallet_transaction",
    "Wallet transaction to cancel not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "COMPLETE_TRANSACTION_ERROR",
    "wallet_transaction",
    "Wallet transaction to complete not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_AMOUNT_EXCEEDS_DESTINATION_EWALLET_LIMIT",
    "wallet_transaction",
    "Amount would push the destination wallet over its currency limit",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_AMOUNT_EXCEEDS_DESTINATION_EWALLET_LIMIT_BY_MERCHANT_CONTROLLED_PARAMETERS",
    "wallet_transaction",
    "Amount would exceed the destination wallet's balance limit",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_BALANCE_TRANSFER",
    "wallet_transaction",
    "Converted funds could not go to a disabled destination wallet",
    "configuration",
    "manual_review",
  ],
  [
    "ERROR_CARD_AUTHENTICATION_FAILURE",
    "wallet_transaction",
    "3DS not completed in time; payment canceled",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "ERROR_CREATE_TRANSFER",
    "wallet_transaction",
    "Source or destination wallet not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_ACCOUNT_LIMIT_EXCEEDS_CURRENT_BALANCE",
    "wallet_transaction",
    "New account limit is below the current balance",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_LIMIT_NOT_VALID",
    "wallet_transaction",
    "Account limit not a positive number",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_TRANSFER_DESTINATION_EWALLET_DISABLED",
    "wallet_transaction",
    "Destination wallet disabled",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_TRANSFER_ID_NOT_FOUND",
    "wallet_transaction",
    "Transfer ID for the response not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_TRANSFER_SOURCE_EWALLET_DISABLED",
    "wallet_transaction",
    "Source wallet disabled",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERROR_EWALLET_TRANSFER_SOURCE_EWALLET_NOT_FOUND",
    "wallet_transaction",
    "Source wallet not found (text refers to a phone number)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_ACCOUNT_FUNDS_DETAILS",
    "wallet_transaction",
    "Transaction (UUID) not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_ISSUING_TRANSACTION",
    "wallet_transaction",
    "Transfer to a virtual account not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_GET_TRANSACTION",
    "wallet_transaction",
    "Transaction not found for this wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_REMOVE_ACCOUNT_LIMIT",
    "wallet_transaction",
    "Account limit to remove does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_RESPONSE_TRANSFER",
    "wallet_transaction",
    "Response to a transfer the transferee already declined",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSFER_FUNDS_DESTINATION_AND_SOURCE_CANNOT_BE_THE_SAME",
    "wallet_transaction",
    "Source and destination wallet are the same",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSFER_RESPONSE_INVALID_DETAILS",
    "wallet_transaction",
    "Transfer for the response not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSFER_RESPONSE_PREVIOUSLY_CANCELED",
    "wallet_transaction",
    "Response to a transfer the sender already canceled",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_TRANSFER_RESPONSE_PREVIOUSLY_DECLINED",
    "wallet_transaction",
    "Response to a transfer the transferee already declined",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_UPDATE_FUNDS",
    "wallet_transaction",
    "Wallet for add or remove funds not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_TRANSACTION_ID",
    "wallet_transaction",
    "Transaction not found or not linked to the wallet",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_TRANSFER_DETAILS",
    "wallet_transaction",
    "Transfer inputs (currency or wallet IDs) not valid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_TRANSFER_STATUS",
    "wallet_transaction",
    "Transfer response status not accept, decline or cancel",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "NOT_ENOUGH_FUNDS",
    "wallet_transaction",
    "Not enough funds in the required currency",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "TRANSFER_DESTINATION_USER_ID_IS_INVALID",
    "wallet_transaction",
    "Destination wallet not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "WALLET_TO_WALLET_TRANSFER_EXPIRED",
    "wallet_transaction",
    "Transfer already expired before the response",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "WALLET_TRANSFER_NOT_ALLOWED_FOR_COLLECT_WALLET",
    "wallet_transaction",
    "Transfers not allowed for a collect-type client wallet",
    "configuration",
    "do_not_retry",
  ],
  ["ERROR_GET_USER", "wallet", "Wallet not found or deleted", "invalid_request", "do_not_retry"],
  [
    "ERROR_INVALID_EWALLET",
    "wallet",
    "Wallet ID not recognized (used as the envelope example on the Error Messages page)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_WALLET_INSUFFICIENT_FUNDS",
    "wallet",
    "Source wallet lacks funds in the currency (400 sample of Transfer Funds Between Wallets)",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "ERROR_CREATE_PAYMENT_GATEWAY_NOT_RESPONDING",
    "simulated",
    "Sandbox: amount 4000-4009; the text calls the simulated error INTERNAL_ERROR",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_PROCESS_PAYMENT_EXPIRED",
    "simulated",
    "Sandbox: payment expired",
    "unknown",
    "customer_action_required",
  ],
  [
    "ERROR_PROCESS_PAYMENT_INSUFFICIENT_FUNDS",
    "simulated",
    "Sandbox: insufficient funds in the source",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "ERROR_PROCESS_PAYMENT_PROCESSOR_UNAVAILABLE",
    "simulated",
    "Sandbox: processor unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERROR_PROCESS_PAYMENT_SETTLEMENT_DECLINED",
    "simulated",
    "Sandbox: settlement declined",
    "unknown",
    "manual_review",
  ],
  [
    "ERROR_PROCESS_PAYMENT_SETTLEMENT_PENDING_ON_GATEWAY",
    "simulated",
    "Sandbox: settlement still pending on the gateway",
    "unknown",
    "manual_review",
  ],
  [
    "ERROR_CAPTURE_PAYMENT_IS_EXIPRED",
    "example",
    "Capture Payment 400 sample (spelling as printed); message only says to contact support. Meaning not documented",
    "unknown",
    "manual_review",
  ],
  [
    "ERROR_GET_SENDER",
    "example",
    "gc_error_code value in the PAYOUT_CREATION_FAILED example. Meaning not documented",
    "unknown",
    "manual_review",
  ],
  [
    "ERROR_INVALID_PARAMETER_VALUE",
    "example",
    "response_code in an Update Payment sample whose error_code is IMMUTABLE_FIELD; currency cannot change after creation",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERROR_PAYMENT_IS_NOT_UPDATABLE",
    "example",
    "Update Payment 400 sample; message only says to contact support. Meaning not documented",
    "unknown",
    "manual_review",
  ],
  [
    "IMMUTABLE_FIELD",
    "example",
    "error_code in the same Update Payment sample; a field cannot change after creation",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "INVALID_AMOUNT",
    "example",
    "Create Refund 400 sample: amount missing, not a number or out of bounds",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "NOT_IMPLEMENTED",
    "example",
    "gc_error_code value in the PAYOUT_CREATED example. Meaning not documented",
    "unknown",
    "manual_review",
  ],
  [
    "MISSING_PAYOUT_METHOD_REQUIRED_FIELD - [PHONE_NUMBER]",
    "example",
    "gc_error_code in the PAYOUT_FAILED example; singular form of MISSING_PAYOUT_METHOD_REQUIRED_FIELDS with the field name in brackets",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "MISSING_INVALID_PARAMETERS",
    "example",
    "OpenAPI 400 example: a parameter is missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
];

const NETWORK_ROWS: readonly NetworkRow[] = [
  [
    "01",
    "common",
    "Issuer refused; customer should contact the issuer or use another method",
    "card_declined",
    "customer_action_required",
  ],
  [
    "02",
    "common",
    "Issuer refused under a special condition",
    "card_declined",
    "customer_action_required",
  ],
  ["03", "common", "Problem with the merchant's status", "configuration", "manual_review"],
  [
    "04",
    "common",
    "Issuer asks to retain the card (no fraud stated)",
    "card_declined",
    "do_not_retry",
  ],
  ["05", "common", "Do not honor", "card_declined", "customer_action_required"],
  [
    "06",
    "common",
    "Failed for an unknown reason; retry, then another method",
    "unknown",
    "retry_conditionally",
  ],
  [
    "07",
    "common",
    "Issuer asks to retain the card; fraud suspected",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "12",
    "common",
    "Card not allowed for this transaction type",
    "card_declined",
    "customer_action_required",
  ],
  [
    "13",
    "common",
    "Card not enabled online or amount malformed",
    "invalid_amount",
    "customer_action_required",
  ],
  [
    "14",
    "common",
    "Issuer does not recognize the card number",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "15",
    "common",
    "Card number not valid (invalid issuer)",
    "invalid_request",
    "customer_action_required",
  ],
  ["17", "common", "Customer canceled", "unknown", "customer_action_required"],
  ["19", "common", "Unknown failure; re-enter and retry", "unknown", "retry_conditionally"],
  ["41", "common", "Card reported lost", "fraud_or_risk", "do_not_retry"],
  ["42", "common", "Card reported stolen", "fraud_or_risk", "do_not_retry"],
  ["43", "common", "Card reported stolen", "fraud_or_risk", "do_not_retry"],
  ["46", "common", "Account closed", "card_declined", "customer_action_required"],
  [
    "50",
    "common",
    "Timeout or invalid password; create a new payment",
    "unknown",
    "retry_conditionally",
  ],
  [
    "51",
    "common",
    "Insufficient funds or over the card limit",
    "insufficient_funds",
    "customer_action_required",
  ],
  ["54", "common", "Card expired", "card_declined", "customer_action_required"],
  ["56", "common", "No record of the card number", "invalid_request", "customer_action_required"],
  [
    "57",
    "common",
    "Transaction not permitted for this cardholder",
    "card_declined",
    "customer_action_required",
  ],
  [
    "58",
    "common",
    "Transaction not permitted for the acquirer or terminal",
    "configuration",
    "manual_review",
  ],
  ["59", "common", "Issuer suspects fraud", "fraud_or_risk", "do_not_retry"],
  [
    "61",
    "common",
    "Withdrawal amount limit exceeded",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "62",
    "common",
    "Card restricted in the merchant's country",
    "card_declined",
    "customer_action_required",
  ],
  [
    "63",
    "common",
    "Security feature problem; check the CVV",
    "card_declined",
    "customer_action_required",
  ],
  [
    "65",
    "common",
    "3DS not completed or activity limit exceeded; resubmit with 3DS",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "68",
    "common",
    "Issuer response came too late; create a new payment",
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "70",
    "common",
    "PIN required or customer must contact the issuer",
    "authentication_required",
    "customer_action_required",
  ],
  ["72", "common", "Account not activated", "card_declined", "customer_action_required"],
  ["75", "common", "Too many wrong PIN entries", "card_declined", "customer_action_required"],
  [
    "76",
    "common",
    "Visa: previous message not found; Mastercard: destination account not found",
    "invalid_request",
    "manual_review",
  ],
  [
    "77",
    "common",
    "Visa: message data inconsistent; Mastercard: source account not found",
    "invalid_request",
    "manual_review",
  ],
  [
    "78",
    "common",
    "New card still blocked until first-use unblocking",
    "card_declined",
    "customer_action_required",
  ],
  ["83", "common", "Security issue or suspected fraud", "fraud_or_risk", "do_not_retry"],
  [
    "91",
    "common",
    "Issuer or authorization platform unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "93",
    "common",
    "Violation; transaction cannot complete",
    "card_declined",
    "customer_action_required",
  ],
  [
    "94",
    "common",
    "Duplicate transmission detected; Rapyd says retry",
    "duplicate_request",
    "retry_conditionally",
  ],
  ["96", "common", "Issuer system malfunction", "provider_unavailable", "retry_conditionally"],
  [
    "OF",
    "payout_eligibility",
    "Card not eligible for domestic money transfer (payout)",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "OG",
    "payout_eligibility",
    "Card not eligible for cross-border money transfer (payout)",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "OH",
    "payout_eligibility",
    "Card not eligible for domestic gambling payouts",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "OI",
    "payout_eligibility",
    "Card not eligible for cross-border gambling payouts",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "OJ",
    "payout_eligibility",
    "Card not eligible for domestic funds disbursement",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "OK",
    "payout_eligibility",
    "Card not eligible for cross-border funds disbursement (not a success code)",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "TJ",
    "payout_eligibility",
    "Card blocked by the cardholder",
    "card_declined",
    "customer_action_required",
  ],
  [
    "TK",
    "payout_eligibility",
    "Card declined by Visa",
    "card_declined",
    "customer_action_required",
  ],
  [
    "5C",
    "payout_eligibility",
    "Payout type blocked or unsupported by the issuer",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "O1",
    "payout_eligibility",
    "Card type could not be determined from the number",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "O2",
    "payout_eligibility",
    "Push payouts to American Express are not supported",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "O5",
    "payout_eligibility",
    "Primary account number (PAN) not valid",
    "invalid_request",
    "customer_action_required",
  ],
  ["CV", "other", "Card verification error", "card_declined", "customer_action_required"],
  ["00", "other", "Short message says success, yet listed as an error", "unknown", "manual_review"],
  ["08", "other", "Short message says success, yet listed as an error", "unknown", "manual_review"],
  ["10", "other", "Partial approval", "unknown", "manual_review"],
  ["11", "other", "Short message says success, yet listed as an error", "unknown", "manual_review"],
  [
    "1A",
    "other",
    "Additional authentication required",
    "authentication_required",
    "customer_action_required",
  ],
  ["21", "other", "No action taken", "unknown", "manual_review"],
  ["25", "other", "Record not found in file", "invalid_request", "manual_review"],
  ["28", "other", "File temporarily unavailable", "provider_unavailable", "retry_conditionally"],
  ["30", "other", "Format error", "invalid_request", "manual_review"],
  ["39", "other", "No credit account", "card_declined", "customer_action_required"],
  [
    "3X",
    "other",
    "Additional authentication required",
    "authentication_required",
    "customer_action_required",
  ],
  ["52", "other", "Checking account not found", "card_declined", "customer_action_required"],
  ["53", "other", "Savings account not found", "card_declined", "customer_action_required"],
  ["55", "other", "PIN not valid", "authentication_failed", "customer_action_required"],
  ["64", "other", "AML requirements not met", "fraud_or_risk", "manual_review"],
  [
    "6P",
    "other",
    "Customer ID verification failed",
    "authentication_failed",
    "customer_action_required",
  ],
  ["71 (Mastercard)", "other", "PIN not changed", "card_declined", "manual_review"],
  ["74", "other", "Encryption error", "unknown", "manual_review"],
  ["76", "other", "Unsolicited reversal", "unknown", "manual_review"],
  ["79", "other", "Already reversed by the switch", "duplicate_request", "do_not_retry"],
  ["80", "other", "Credit issuer unavailable", "provider_unavailable", "retry_conditionally"],
  ["81", "other", "Cryptographic error in PIN", "authentication_failed", "manual_review"],
  [
    "81 (Mastercard)",
    "other",
    "Domestic debit transaction not allowed",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "82",
    "other",
    "Negative CAM, dCVV, iCVV or CVV result",
    "card_declined",
    "customer_action_required",
  ],
  ["82 (Mastercard)", "other", "Policy issue", "card_declined", "manual_review"],
  [
    "84 (Mastercard)",
    "other",
    "Invalid authorization life cycle",
    "invalid_request",
    "manual_review",
  ],
  [
    "85 (Visa)",
    "other",
    "No reason to decline an account, address or CVV2 verification",
    "unknown",
    "manual_review",
  ],
  ["86", "other", "PIN not validated", "authentication_failed", "customer_action_required"],
  [
    "87 (Mastercard)",
    "other",
    "Purchase amount only, no cash back",
    "invalid_request",
    "do_not_retry",
  ],
  ["88 (Mastercard)", "other", "Cryptographic failure", "unknown", "manual_review"],
  [
    "89",
    "other",
    "Not eligible to receive financial position information",
    "unknown",
    "manual_review",
  ],
  ["92", "other", "Transaction cannot be routed", "provider_unavailable", "retry_conditionally"],
  ["B1", "other", "Surcharge amount not permitted", "invalid_amount", "do_not_retry"],
  ["B2", "other", "Surcharge amount not supported", "invalid_amount", "do_not_retry"],
  ["N0", "other", "Force STIP (stand-in processing)", "unknown", "manual_review"],
  ["N3", "other", "Cash service not available", "payment_method_unavailable", "do_not_retry"],
  ["N4", "other", "Cash request exceeds limit", "invalid_amount", "customer_action_required"],
  ["N5", "other", "Ineligible for resubmission", "card_declined", "do_not_retry"],
  ["N7", "other", "CVV2 failure", "card_declined", "customer_action_required"],
  ["N8", "other", "Transaction exceeds the authorized amount", "invalid_amount", "do_not_retry"],
  ["P2 (Visa)", "other", "Invalid biller information", "invalid_request", "manual_review"],
  ["P5", "other", "PIN change declined", "card_declined", "manual_review"],
  ["P6", "other", "Requested PIN not safe", "card_declined", "manual_review"],
  [
    "Q1",
    "other",
    "Card authentication failed",
    "authentication_failed",
    "customer_action_required",
  ],
  ["R0", "other", "Customer requested stop payment", "card_declined", "do_not_retry"],
  ["R1", "other", "Customer revoked authorization", "card_declined", "do_not_retry"],
  ["R2", "other", "Transaction does not qualify for Visa PIN", "card_declined", "manual_review"],
  ["R3", "other", "All authorizations revoked", "card_declined", "do_not_retry"],
  [
    "W1, W2, W9",
    "other",
    "Error connecting to the bank",
    "network_or_timeout",
    "retry_conditionally",
  ],
  ["XA, XD (Visa)", "other", "Forward to issuer", "card_declined", "customer_action_required"],
  ["Z1", "other", "Offline declined", "card_declined", "customer_action_required"],
  ["Z3", "other", "Unable to go online", "network_or_timeout", "retry_conditionally"],
];

const ADVICE_ROWS: readonly AdviceRow[] = [
  ["01", "Do not try again", "card_declined", "do_not_retry"],
  ["02", "Try again later", "card_declined", "retry_conditionally"],
  ["03", "Update account information", "card_declined", "customer_action_required"],
  ["04", "Retry with authentication", "authentication_required", "customer_action_required"],
  ["05", "Suspected fraud; do not retry", "fraud_or_risk", "do_not_retry"],
  ["06", "Payment cancellation; do not retry", "card_declined", "do_not_retry"],
  ["07", "Merchant does not qualify for the product code", "configuration", "do_not_retry"],
  ["08", "Retry after 1 hour", "card_declined", "retry_conditionally"],
  ["09", "Retry after 24 hours", "card_declined", "retry_conditionally"],
  ["10", "Retry after 2 days", "card_declined", "retry_conditionally"],
  ["11", "Retry after 4 days", "card_declined", "retry_conditionally"],
  ["12", "Retry after 6 days", "card_declined", "retry_conditionally"],
  ["13", "Retry after 8 days", "card_declined", "retry_conditionally"],
  ["14", "Retry after 10 days", "card_declined", "retry_conditionally"],
  ["15", "Informational: consumer non-reloadable prepaid card", "unknown", "unknown"],
  ["16", "Informational: consumer single-use virtual card number", "unknown", "unknown"],
  ["17", "Token requirements not met for this token type", "invalid_request", "do_not_retry"],
  ["18", "Negotiated value not approved", "unknown", "manual_review"],
];

export type CodeEntry = {
  /** Code as printed in the documentation table. */
  printed: string;
  section: CodeSection;
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

export type NetworkEntry = {
  /** Row label as printed, for example `81 (Mastercard)` or `W1, W2, W9`. */
  printed: string;
  table: NetworkTable;
  /** Card scheme the row is limited to, when the documentation names one. */
  scheme?: "Visa" | "Mastercard";
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

export type AdviceEntry = { meaning: string; category: ErrorCategory; retry: RetryGuidance };

// Bounded input and no nested quantifiers, so matching stays linear.
const SUFFIX =
  /^([^[<]*?)(?:\s+-\s+\[([^\]]{0,120})\]|\s+-\s+<[^>]{0,40}>|_\[([^\]]{0,120})\]|\s+\[([^\]]{0,120})\])\s*$/;

/**
 * Splits a code into its base and the bracketed part Rapyd appends: a card
 * network code (`ERROR_PROCESSING_CARD - [51]`) or field names
 * (`MISSING_PAYOUT_METHOD_REQUIRED_FIELD - [PHONE_NUMBER]`,
 * `ERROR_CHECKOUT_AFT_MISSING_FIELDS_[<FIELD>]`).
 */
export function splitCode(raw: string): { base: string; suffix?: string } {
  const s = raw.trim().slice(0, 256);
  const m = SUFFIX.exec(s);
  if (!m) return { base: s };
  const suffix = (m[2] ?? m[3] ?? m[4])?.trim();
  return suffix ? { base: m[1]!.trim(), suffix } : { base: m[1]!.trim() };
}

/** Lookup key: appended part removed, no whitespace inside the name. */
export function codeKey(code: string): string {
  return splitCode(code).base.replace(/\s+/g, "");
}

function buildErrorCodes(): Record<string, CodeEntry[]> {
  const out: Record<string, CodeEntry[]> = {};
  for (const [printed, section, meaning, category, retry] of ERROR_ROWS) {
    const key = codeKey(printed);
    (out[key] ??= []).push({ printed, section, meaning, category, retry });
  }
  return out;
}

const SCHEME_ROW = /^(.*?)\s*\((Visa|Mastercard)\)$/;

function buildNetworkCodes(): Record<string, NetworkEntry[]> {
  const out: Record<string, NetworkEntry[]> = {};
  for (const [printed, table, meaning, category, retry] of NETWORK_ROWS) {
    const m = SCHEME_ROW.exec(printed);
    const scheme = m?.[2] as NetworkEntry["scheme"];
    for (const code of (m ? m[1]! : printed).split(/\s*,\s*/)) {
      const entry: NetworkEntry = scheme
        ? { printed, table, scheme, meaning, category, retry }
        : { printed, table, meaning, category, retry };
      (out[code] ??= []).push(entry);
    }
  }
  return out;
}

/**
 * String error codes keyed by `codeKey`. A code can have several rows: the
 * same code in several tables (usually with the same meaning) and, for
 * ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION, two different meanings.
 */
export const ERROR_CODES: Readonly<Record<string, readonly CodeEntry[]>> = buildErrorCodes();

/**
 * Card network codes. Code `76` has two different meanings in two tables;
 * `81` and `82` have a general row and a Mastercard row.
 */
export const NETWORK_CODES: Readonly<Record<string, readonly NetworkEntry[]>> = buildNetworkCodes();

export const MERCHANT_ADVICE_CODES: Readonly<Record<string, AdviceEntry>> = Object.fromEntries(
  ADVICE_ROWS.map(([code, meaning, category, retry]) => [code, { meaning, category, retry }]),
);

export const CATALOG_COUNTS = {
  errorRows: ERROR_ROWS.length,
  errorCodes: Object.keys(ERROR_CODES).length,
  networkRows: NETWORK_ROWS.length,
  networkCodes: Object.keys(NETWORK_CODES).length,
  adviceCodes: ADVICE_ROWS.length,
} as const;

/** Advice codes that ask for a waiting period before a new attempt. */
export const ADVICE_WAIT: Readonly<Record<string, string>> = {
  "08": "after 1 hour",
  "09": "after 24 hours",
  "10": "after 2 days",
  "11": "after 4 days",
  "12": "after 6 days",
  "13": "after 8 days",
  "14": "after 10 days",
};

export const RETRY_TEXT: Readonly<Record<RetryGuidance, string>> = {
  do_not_retry: "Do not send the same request again; Rapyd will reject it the same way.",
  customer_action_required:
    "A new attempt needs the customer to act first (another card or payment method, corrected details, or contact with the issuer or bank).",
  retry_conditionally:
    "A later attempt may succeed. First check the current state of the object (for example Retrieve Payment, GET /v1/payments/:payment) so that a new request does not repeat an operation that took effect. Rapyd's idempotency header applies to Create Payment by default.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry.",
  manual_review:
    "Review the case, or contact Rapyd support with the operation_id, before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Readonly<Record<ErrorCategory, string>> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact the issuer.",
  authentication_required: "Send a new payment with 3D Secure authentication.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another card or payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency against the payment method's limits.",
  insufficient_funds:
    "Ask the customer to use another payment method, or wait until funds are available.",
  payment_method_unavailable: "Offer another payment or payout method.",
  fraud_or_risk: "Review the transaction before any new attempt; do not retry the same card.",
  rate_limiting: "Reduce the request rate and try again later.",
  provider_unavailable:
    "Check the current state of the payment, refund or payout before sending a new request.",
  network_or_timeout:
    "Check the current state of the payment before sending a new request; create a new payment only if the original did not take effect.",
  duplicate_request: "Check whether the original operation already took effect.",
  configuration:
    "Check the account setup, API keys and enabled features in the Rapyd Client Portal, or ask Rapyd support.",
  unknown: "Contact Rapyd support with the operation_id if the cause is unclear.",
};

/** HTTP statuses documented for Rapyd REST errors (400, 401, 429). */
export const HTTP_STATUS: Readonly<
  Record<number, { meaning: string; category: ErrorCategory; retry: RetryGuidance }>
> = {
  400: { meaning: "Bad request", category: "invalid_request", retry: "do_not_retry" },
  401: {
    meaning: "Unauthorized request (authentication or permission problem)",
    category: "configuration",
    retry: "do_not_retry",
  },
  429: {
    meaning: "Too many requests (rate limit)",
    category: "rate_limiting",
    retry: "retry_conditionally",
  },
};

export type StateInfo = { meaning: string; stage: LifecycleStage; outcome: Outcome };

const st = (stage: LifecycleStage, outcome: Outcome, meaning: string): StateInfo => ({
  meaning,
  stage,
  outcome,
});

/** Payment `status`. */
export const PAYMENT_STATUSES: Readonly<Record<string, StateInfo>> = {
  ACT: st("payment", "pending", "Active: waiting for 3DS, capture or a third-party action"),
  CAN: st("cancellation", "success", "Canceled by the client or by the customer's bank"),
  CLO: st("payment", "success", "Closed: the payment is completed"),
  ERR: st("payment", "failure", "Creating or completing the payment failed"),
  EXP: st("payment", "failure", "Expired before it was completed"),
  REV: st("reversal", "success", "Reversed by Rapyd"),
};

/** Payment `next_action`, read only while the payment status is ACT. */
export const NEXT_ACTIONS: Readonly<Record<string, StateInfo>> = {
  "3d_verification": st("authentication", "pending", "Waiting for the cardholder to complete 3DS"),
  pending_capture: st("authorization", "success", "Authorized; waiting for capture"),
  pending_confirmation: st("payment", "pending", "Waiting for a third-party confirmation"),
  pending_offline_capture: st(
    "payment",
    "pending",
    "Waiting for offline capture through clearing (Shva Arena card payments)",
  ),
  not_applicable: st("payment", "pending", "No further action listed"),
};

/** Refund `status` (title case, unlike payment statuses). */
export const REFUND_STATUSES: Readonly<Record<string, StateInfo>> = {
  Pending: st("refund", "pending", "Pending, for example while a payment method needs action"),
  Completed: st("refund", "success", "Completed"),
  Rejected: st("refund", "failure", "Rejected by the payment processor"),
  Error: st("refund", "failure", "Failed because the payment is not in closed (CLO) status"),
  Canceled: st("cancellation", "success", "Canceled by the merchant"),
};

/** Refund `failure_reason` values. Category and retry are suggestions. */
export const REFUND_FAILURE_REASONS: Readonly<Record<string, AdviceEntry>> = {
  lost_or_stolen_card: {
    meaning: "The card was reported lost or stolen",
    category: "payment_method_unavailable",
    retry: "manual_review",
  },
  expired_or_canceled_card: {
    meaning: "The card expired or was canceled",
    category: "payment_method_unavailable",
    retry: "manual_review",
  },
  unknown: { meaning: "Reason not known", category: "unknown", retry: "manual_review" },
};

/** Dispute `status`, seen from the merchant's side. */
export const DISPUTE_STATUSES: Readonly<Record<string, StateInfo>> = {
  ACT: st("dispute", "pending", "Active; waiting for the merchant's action"),
  RVW: st("dispute", "pending", "Rapyd is reviewing the merchant's evidence"),
  PRA: st("dispute", "pending", "Pre-arbitration"),
  ARB: st("dispute", "pending", "Arbitration"),
  LOS: st("dispute", "failure", "Merchant lost; the funds were deducted"),
  WIN: st("dispute", "success", "Merchant won; the funds were credited"),
  REV: st("dispute", "success", "The issuer reversed the dispute; the funds were credited"),
};

/** Payout `status` (title case). */
export const PAYOUT_STATUSES: Readonly<Record<string, StateInfo>> = {
  Created: st("payout", "pending", "Created"),
  Confirmation: st("payout", "pending", "Waiting for confirmation of the FX rate"),
  Pending: st("payout", "pending", "Waiting for the beneficiary to accept the funds"),
  Hold: st("payout", "pending", "Under manual review by Rapyd Protect"),
  Completed: st("payout", "success", "The beneficiary received some or all of the funds"),
  Declined: st("payout", "failure", "Declined: failed inspection"),
  Error: st("payout", "failure", "Not created, or failed after creation"),
  Canceled: st("payout", "failure", "Canceled; no funds will be paid out"),
  Expired: st("payout", "failure", "Expired (cash payouts)"),
  Returned: st("payout", "failure", "The funds came back after completion"),
};

/** Webhook delivery `status` (not the object status). */
export const WEBHOOK_STATUSES: Readonly<Record<string, string>> = {
  NEW: "Not yet delivered successfully",
  CLO: "Delivered successfully",
  ERR: "The maximum number of retries was reached; the automatic retry process failed",
  RET: "Resent",
};

export type ObjectKind = "payment" | "refund" | "dispute" | "payout";

export type EventTypeInfo = {
  object: ObjectKind;
  meaning: string;
  /** Stage that the type itself states, when it is more specific than the object status. */
  stage?: LifecycleStage;
  /** Outcome used only when the object carries no documented status. */
  outcome: Outcome;
};

const ev = (
  object: ObjectKind,
  outcome: Outcome,
  meaning: string,
  stage?: LifecycleStage,
): EventTypeInfo => (stage ? { object, outcome, meaning, stage } : { object, outcome, meaning });

/** In-scope webhook types (payment, refund, dispute, payout). */
export const EVENT_TYPES: Readonly<Record<string, EventTypeInfo>> = {
  PAYMENT_SUCCEEDED: ev(
    "payment",
    "unknown",
    "Sent when the payment request is received; a 3DS card payment stays ACT until the result is known",
  ),
  PAYMENT_COMPLETED: ev(
    "payment",
    "success",
    "The last required third-party action of the payment is completed",
  ),
  PAYMENT_CAPTURED: ev("payment", "success", "The payment was captured", "capture"),
  PAYMENT_FAILED: ev("payment", "failure", "Creating or completing the payment failed"),
  PAYMENT_EXPIRED: ev("payment", "failure", "The payment expired"),
  PAYMENT_CANCELED: ev("payment", "success", "The payment was canceled", "cancellation"),
  PAYMENT_REVERSED: ev("payment", "success", "Rapyd reversed the payment", "reversal"),
  PAYMENT_UPDATED: ev("payment", "unknown", "The payment was updated"),
  REFUND_COMPLETED: ev("refund", "success", "The refund was completed"),
  PAYMENT_REFUND_FAILED: ev("refund", "failure", "The refund failed (status Error)"),
  PAYMENT_REFUND_REJECTED: ev("refund", "failure", "The refund was rejected (status Rejected)"),
  PAYMENT_REFUND_UPDATED: ev("refund", "unknown", "The refund was updated"),
  PAYMENT_DISPUTE_CREATED: ev("dispute", "pending", "A dispute was created for the payment"),
  PAYMENT_DISPUTE_UPDATED: ev("dispute", "unknown", "The dispute was updated"),
  PAYOUT_CREATED: ev("payout", "pending", "The payout was created"),
  PAYOUT_UPDATED: ev("payout", "unknown", "The payout was updated"),
  PAYOUT_COMPLETED: ev("payout", "success", "The beneficiary received the payout funds"),
  PAYOUT_FAILED: ev("payout", "failure", "The payout failed"),
  PAYOUT_CANCELED: ev("payout", "failure", "The payout was canceled"),
  PAYOUT_EXPIRED: ev("payout", "failure", "The payout expired"),
  PAYOUT_RETURNED: ev(
    "payout",
    "failure",
    "The funds came back after completion (beneficiary rejected them, or the bank could not credit the account)",
  ),
  PAYOUT_CREATION_FAILED: ev("payout", "failure", "One item of a mass payout failed"),
};

/** Wallet transaction webhook types: recognized, not analyzed. */
export const WALLET_EVENT_TYPES: ReadonlySet<string> = new Set([
  "TRANSFER_FUNDS_BETWEEN_EWALLETS_CREATED",
  "TRANSFER_FUNDS_BETWEEN_EWALLETS_RESPONSE",
  "TRANSFER_FUNDS_BETWEEN_EWALLETS_EXPIRED",
  "TRANSFER_REQUEST_UPDATED",
  "TRANSFER_FUNDS",
  "EWALLET_ADDED_FUNDS",
  "EWALLET_REMOVED_FUNDS",
  "EWALLET_TRANSFER_CREDITED",
  "EWALLET_TRANSFER_DEBITED",
  "TransferRequest",
  "TransferCompleted",
]);

/** Wallet transfer `status`, used only to recognize transfer responses. */
export const TRANSFER_STATUSES: ReadonlySet<string> = new Set([
  "PEN",
  "CLO",
  "DEC",
  "CAN",
  "EXP",
  "HLD",
  "REJ",
]);
