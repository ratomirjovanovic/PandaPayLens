/**
 * Paysafe Payments API code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/paysafe.md, which cites
 * Paysafe's public developer documentation, verified 2026-10-25:
 *
 * Error Summary and processor tables: the Payments API OpenAPI file
 *   https://developer.paysafe.com/fileadmin/openapi-spec/payments-api/apis/paysafe-ph-payments-api.yaml
 *   (rendered at https://developer.paysafe.com/en/payments-api/)
 * Card errors, merchant advice and ISO response codes:
 *   https://developer.paysafe.com/en/api-docs/payments-api/add-payment-methods/cards/card-errors/
 * Webhook events:
 *   https://developer.paysafe.com/en/api-docs/paysafe-checkout/webhook-events/
 *   and the per-method webhook pages named in the research file
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file, except where the meaning repeats
 * Paysafe's own retry advice (code 1100, the ADVICE-nn merchant advice codes
 * and the VSPS rows of the processor tables).
 *
 * Documented but not decoded, because the documentation does not say which
 * payload field carries them: the Interchecks issuer reasons of
 * ERR_OCT_DECLINE, the SafetyPay and PayPal downstream codes, the ACH, BACS,
 * EFT and SEPA return codes (Merchant Back Office reports only) and the
 * client-side Paysafe JS codes (browser callbacks, not server payloads).
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const D = "https://developer.paysafe.com/en";
export const OPENAPI_URL =
  "https://developer.paysafe.com/fileadmin/openapi-spec/payments-api/apis/paysafe-ph-payments-api.yaml";
export const API_REFERENCE_URL = `${D}/payments-api/`;
export const CARD_ERRORS_URL = `${D}/api-docs/payments-api/add-payment-methods/cards/card-errors/`;
export const CARD_PAYMENTS_URL = `${D}/api-docs/payments-api/add-payment-methods/cards/about-card-payments/`;
export const THREE_DS_URL = `${D}/api-docs/payments-api/add-payment-methods/cards/3ds/`;
export const SIMULATOR_URL = `${D}/api-docs/payments-api/add-payment-methods/cards/simulating-card-payments/`;
export const GET_STARTED_URL = `${D}/api-docs/payments-api/get-started/`;
export const OVERVIEW_URL = `${D}/api-docs/payments-api/overview/`;
export const CONFIGURE_WEBHOOKS_URL = `${D}/api-docs/payments-api/configure-webhooks/`;
export const WEBHOOK_EVENTS_URL = `${D}/api-docs/paysafe-checkout/webhook-events/`;
export const EPS_WEBHOOKS_URL = `${D}/api-docs/payments-api/add-payment-methods/eps/webhooks/`;
export const PAY_BY_BANK_WEBHOOKS_URL = `${D}/api-docs/payments-api/add-payment-methods/pay-by-bank-us/webhooks/`;
export const RAPID_TRANSFER_WEBHOOKS_URL = `${D}/api-docs/payments-api/add-payment-methods/rapid-transfer/webhooks/`;
export const SETTLEMENT_FLOW_URL = `${D}/api-docs/payments-api/settlement-flow-diagrams/`;
export const TROUBLESHOOTING_URL = `${D}/api-docs/payments-api/test-and-go-live/troubleshooting-api-requests/`;
export const CHARGEBACKS_URL = `${D}/support/reference-information/transactions-and-chargebacks/`;
export const JAVA_SDK_URL = `${D}/api-docs/server-side-sdks-payments-api/java/`;
export const ONBOARDING_CRITERIA_URL = `${D}/support/reference-information/onboarding-criteria/`;

type ErrorRow = readonly [
  code: string,
  http: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
];
type CodeRow = readonly [
  code: string,
  meaning: string,
  category: ErrorCategory | null,
  retry: RetryGuidance | null,
];
type ProcessorRow = readonly [
  code: string,
  meaning: string,
  category: ErrorCategory | null,
  retry: RetryGuidance | null,
  vsps?: boolean,
];
type InterchecksRow = readonly [
  code: string,
  existingTable: string,
  newTable: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
];

const COMMON_ROWS: readonly ErrorRow[] = [
  ["1000", "500", "Internal Paysafe error", "provider_unavailable", "retry_conditionally"],
  [
    "1001",
    "502",
    "The external processing gateway returned an error",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1002",
    "500",
    "Internal error (card page: database error)",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["1003", "500", "Internal error", "provider_unavailable", "retry_conditionally"],
  [
    "1007",
    "500",
    "Internal error (card page: gateway error; simulator: clearing house timeout)",
    "network_or_timeout",
    "retry_conditionally",
  ],
  ["1008", "500", "Internal error", "provider_unavailable", "retry_conditionally"],
  [
    "1100",
    "502",
    "Service overloaded; Paysafe says to retry later",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ],
  ["1200", "429", "Call rate limit exceeded", "rate_limiting", "safe_to_retry_technical_request"],
  [
    "5000",
    "401",
    "Merchant authentication failed: bad key or IP address not allowed",
    "configuration",
    "do_not_retry",
  ],
  [
    "5001",
    "400",
    "Currency code invalid or not enabled on the account",
    "invalid_request",
    "do_not_retry",
  ],
  ["5003", "400", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["5004", "400", "Invalid account type", "invalid_request", "do_not_retry"],
  ["5005", "400", "Invalid operation type", "invalid_request", "do_not_retry"],
  ["5010", "400", "Invalid country code", "invalid_request", "do_not_retry"],
  ["5016", "400", "Merchant account not found", "configuration", "do_not_retry"],
  ["5017", "400", "Merchant account disabled", "configuration", "do_not_retry"],
  ["5021", "402", "Transaction declined (generic)", "card_declined", "customer_action_required"],
  ["5023", "400", "Request body cannot be parsed", "invalid_request", "do_not_retry"],
  [
    "5031",
    "409",
    "Transaction already processed (card page: duplicate merchant reference)",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "5040",
    "401",
    "Account not configured for the attempted transaction",
    "configuration",
    "do_not_retry",
  ],
  [
    "5042",
    "400",
    "Merchant reference number missing, invalid or too long",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5068",
    "400",
    "Mandatory field missing or field format wrong (see fieldErrors)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5077",
    "400",
    "dynamicMerchantUrl not allowed for the account",
    "configuration",
    "do_not_retry",
  ],
  ["5269", "404", "ID in the URL does not match any record", "invalid_request", "do_not_retry"],
  [
    "5270",
    "403",
    "Credentials do not allow access to the requested data",
    "configuration",
    "do_not_retry",
  ],
  [
    "5271",
    "406",
    "Accept header asks for an unsupported format",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5272",
    "406",
    "Unsupported Content-Type (card page lists HTTP 415)",
    "invalid_request",
    "do_not_retry",
  ],
  ["5273", "404", "Invalid URL", "invalid_request", "do_not_retry"],
  ["5275", "401", "Credentials expired", "configuration", "do_not_retry"],
  ["5276", "401", "Credentials disabled", "configuration", "do_not_retry"],
  [
    "5277",
    "401",
    "Credentials locked after repeated authentication failures",
    "configuration",
    "manual_review",
  ],
  ["5278", "401", "Credentials rejected for an unknown reason", "configuration", "manual_review"],
  ["5279", "401", "Invalid credentials", "configuration", "do_not_retry"],
  ["5280", "401", "Credentials missing", "configuration", "do_not_retry"],
  ["5281", "405", "HTTP method not supported by the resource", "invalid_request", "do_not_retry"],
  [
    "5283",
    "400",
    "Operation needs a payment handle in status PAYABLE",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5500",
    "400",
    "Payment token invalid, or profile or card not active (card page only)",
    "invalid_request",
    "do_not_retry",
  ],
  ["5501", "400", "Profile has no active card", "invalid_request", "do_not_retry"],
  [
    "5502",
    "400",
    "Payment token invalid, or profile or bank account not active",
    "invalid_request",
    "do_not_retry",
  ],
];

const PAYMENT_ROWS: readonly ErrorRow[] = [
  [
    "PAYMENTHUB-1",
    "400",
    "Payment type and currency combination not supported for the account",
    "configuration",
    "do_not_retry",
  ],
  ["1020", "504", "Gateway timeout (card page only)", "network_or_timeout", "retry_conditionally"],
  [
    "3002",
    "400",
    "Invalid card number or brand, or the two do not match",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "3004",
    "400",
    "Zip or postal code required for the AVS check",
    "invalid_request",
    "customer_action_required",
  ],
  ["3005", "400", "Incorrect CVV submitted", "invalid_request", "customer_action_required"],
  ["3006", "400", "Card expired", "card_declined", "customer_action_required"],
  [
    "3007",
    "402",
    "AVS check failed; the amount stays reserved for 3 to 5 business days (sub-values in 4.3)",
    "fraud_or_risk",
    "customer_action_required",
  ],
  [
    "3008",
    "400",
    "Card type not configured on the merchant account",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["3009", "402", "Declined by the issuer", "card_declined", "customer_action_required"],
  [
    "3010",
    "402",
    "Insufficient funds (appears only as a mapping target in the Interchecks issuer table)",
    "insufficient_funds",
    "customer_action_required",
  ],
  ["3011", "402", "Restricted card", "card_declined", "customer_action_required"],
  [
    "3012",
    "402",
    "Issuer says the expiry date is invalid",
    "card_declined",
    "customer_action_required",
  ],
  ["3013", "402", "Problem with the card account", "card_declined", "customer_action_required"],
  ["3014", "402", "Issuer returned an unknown response", "card_declined", "manual_review"],
  [
    "3015",
    "402",
    "Issuer asks for a voice authorization (call the issuer)",
    "card_declined",
    "customer_action_required",
  ],
  ["3016", "402", "Pick up card, possibly lost or stolen", "fraud_or_risk", "do_not_retry"],
  ["3017", "402", "Invalid card number", "invalid_request", "customer_action_required"],
  ["3018", "402", "Bank asks to retry", "card_declined", "retry_conditionally"],
  [
    "3019",
    "402",
    "CVV check failed; the amount may stay reserved for 3 to 5 business days",
    "card_declined",
    "customer_action_required",
  ],
  ["3020", "402", "Bank asks to retry", "card_declined", "retry_conditionally"],
  ["3021", "404", "Confirmation number not found", "invalid_request", "do_not_retry"],
  ["3022", "402", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  [
    "3023",
    "402",
    "Declined under the issuer's own card activity rules",
    "card_declined",
    "customer_action_required",
  ],
  [
    "3024",
    "402",
    "Issuer does not allow this transaction on the card",
    "card_declined",
    "customer_action_required",
  ],
  ["3025", "400", "Gateway reports invalid data", "invalid_request", "do_not_retry"],
  ["3026", "400", "Gateway reports an invalid account type", "invalid_request", "do_not_retry"],
  ["3027", "402", "Gateway reports a limit exceeded", "card_declined", "retry_conditionally"],
  ["3028", "502", "Gateway system error", "provider_unavailable", "retry_conditionally"],
  ["3029", "402", "Gateway rejected the transaction", "card_declined", "manual_review"],
  [
    "3030",
    "402",
    "Gateway reports the transaction as unauthorized",
    "card_declined",
    "manual_review",
  ],
  [
    "3031",
    "400",
    "Confirmation number refers to a transaction that is not on hold",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "3032",
    "402",
    "Card found in an issuer or gateway negative database",
    "fraud_or_risk",
    "do_not_retry",
  ],
  ["3035", "402", "PIN attempts exceeded", "card_declined", "customer_action_required"],
  ["3036", "402", "Invalid issuer", "invalid_request", "customer_action_required"],
  ["3037", "402", "Invalid transaction", "card_declined", "do_not_retry"],
  ["3038", "402", "Customer cancellation", "card_declined", "customer_action_required"],
  [
    "3039",
    "402",
    "Invalid authentication value",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "3040",
    "402",
    "Request type not permitted on the card",
    "card_declined",
    "customer_action_required",
  ],
  ["3041", "402", "Declined because of a timeout", "network_or_timeout", "retry_conditionally"],
  ["3042", "402", "Cryptographic error", "provider_unavailable", "retry_conditionally"],
  ["3044", "402", "Duplicate request", "duplicate_request", "do_not_retry"],
  ["3045", "402", "Invalid date format", "invalid_request", "do_not_retry"],
  ["3046", "402", "Amount is zero", "invalid_amount", "do_not_retry"],
  ["3047", "402", "Amount above the floor limit", "invalid_amount", "do_not_retry"],
  ["3048", "402", "Amount below the floor limit", "invalid_amount", "do_not_retry"],
  ["3049", "402", "Pick up card: card expired", "card_declined", "do_not_retry"],
  ["3050", "402", "Pick up card: fraud suspected", "fraud_or_risk", "do_not_retry"],
  ["3051", "402", "Pick up card: contact the acquirer", "card_declined", "manual_review"],
  ["3052", "402", "Pick up card: restricted card", "card_declined", "do_not_retry"],
  ["3053", "402", "Pick up card: call the acquirer", "card_declined", "manual_review"],
  ["3054", "402", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["3055", "402", "Transaction type not supported", "configuration", "do_not_retry"],
  ["3056", "402", "Original transaction type does not match", "invalid_request", "do_not_retry"],
  ["3057", "402", "Cardholder must call the issuer; do not retry", "card_declined", "do_not_retry"],
  [
    "3060",
    "402",
    "Strong Customer Authentication required (card page); the Interchecks table uses 3060 for an unsolicited reversal",
    "authentication_required",
    "customer_action_required",
  ],
  [
    "3061",
    "400",
    "Invalid initial transaction reference (card page only)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "3073",
    "400",
    "Customer account closed (card page only)",
    "card_declined",
    "customer_action_required",
  ],
  ["3091", "402", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  [
    "3092",
    "402",
    "No financial impact: the original was already declined",
    "card_declined",
    "do_not_retry",
  ],
  [
    "3103",
    "400",
    "Stored-credential installments not allowed for this merchant category code",
    "configuration",
    "do_not_retry",
  ],
  [
    "3104",
    "400",
    "Stored-credential installments not allowed for the configured processor",
    "configuration",
    "do_not_retry",
  ],
  [
    "3105",
    "400",
    "Stored-credential installments not allowed for this card brand",
    "configuration",
    "do_not_retry",
  ],
  [
    "3703",
    "400",
    "External gateway reports an invalid amount (card page only; Interchecks: invalid format)",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "4001",
    "402",
    "Card number or email is in Paysafe's negative database (card page only)",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "4002",
    "402",
    "Declined by Paysafe risk management (card page and Direct Debit table)",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "5034",
    "400",
    "Invalid email address (card page only)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "5037",
    "400",
    "Invalid zip or postal code (card page only)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "5050",
    "500",
    "Merchant account configuration error (card page only)",
    "configuration",
    "manual_review",
  ],
  [
    "5284",
    "409",
    "An entity with this identifier already exists",
    "duplicate_request",
    "do_not_retry",
  ],
  ["5286", "400", "Card with this identifier does not exist", "invalid_request", "do_not_retry"],
  ["5288", "404", "Card does not belong to this consumer", "invalid_request", "do_not_retry"],
  ["5303", "400", "Payment instrument already exists", "duplicate_request", "do_not_retry"],
  ["5304", "400", "Expired card", "card_declined", "customer_action_required"],
  ["5309", "403", "Maximum amount for the operation exceeded", "invalid_amount", "do_not_retry"],
  [
    "9000",
    "500",
    "No child accounts available for load balancing (card page only)",
    "configuration",
    "manual_review",
  ],
];

const VOID_ROWS: readonly ErrorRow[] = [
  ["3500", "400", "Confirmation number not found", "invalid_request", "do_not_retry"],
  [
    "3501",
    "402",
    "Void amount exceeds the remaining authorized amount",
    "invalid_amount",
    "do_not_retry",
  ],
  ["3502", "402", "Authorization already settled; cannot void", "invalid_request", "do_not_retry"],
  ["3503", "402", "Void not supported for the card type", "configuration", "do_not_retry"],
  ["3504", "402", "Gateway does not support partial voids", "configuration", "do_not_retry"],
  ["3505", "500", "Void could not be completed", "provider_unavailable", "retry_conditionally"],
  [
    "3506",
    "402",
    "Void amount exceeds the remaining authorized amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "3507",
    "402",
    "Authorization does not support a partial void (card page only)",
    "configuration",
    "do_not_retry",
  ],
];

const SETTLEMENT_ROWS: readonly ErrorRow[] = [
  ["3200", "400", "Authorization ID badly formatted", "invalid_request", "do_not_retry"],
  ["3201", "404", "Authorization ID not found", "invalid_request", "do_not_retry"],
  ["3202", "402", "Maximum number of settlements reached", "invalid_request", "do_not_retry"],
  ["3203", "402", "Authorization fully settled or cancelled", "invalid_request", "do_not_retry"],
  [
    "3204",
    "402",
    "Settlement amount exceeds the remaining authorized amount",
    "invalid_amount",
    "do_not_retry",
  ],
  ["3205", "402", "Authorization expired", "invalid_request", "do_not_retry"],
  ["3206", "402", "Gateway rejected the settlement", "card_declined", "manual_review"],
  [
    "3207",
    "402",
    "Issuer policy does not allow this transaction type",
    "card_declined",
    "do_not_retry",
  ],
];

const REFUND_ROWS: readonly ErrorRow[] = [
  [
    "3402",
    "402",
    "Refund amount exceeds the remaining settled amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "3403",
    "402",
    "Maximum number of refunds for the settlement reached",
    "invalid_request",
    "do_not_retry",
  ],
  ["3404", "402", "Settlement already fully refunded", "invalid_request", "do_not_retry"],
  ["3405", "402", "Settlement too old to refund", "invalid_request", "do_not_retry"],
  [
    "3406",
    "402",
    "Settlement not batched yet, so no settled funds to refund",
    "invalid_request",
    "retry_conditionally",
  ],
  ["3407", "400", "Settlement for the given ID not found", "invalid_request", "do_not_retry"],
  ["3408", "400", "Purchase or settlement ID badly formatted", "invalid_request", "do_not_retry"],
  [
    "3412",
    "402",
    "Refund refused: merchant account in overdraft",
    "configuration",
    "manual_review",
  ],
  [
    "3413",
    "402",
    "Refund exceeds the permitted Visa credit ratio",
    "configuration",
    "manual_review",
  ],
  ["3414", "400", "Refund for the given ID not found", "invalid_request", "do_not_retry"],
  ["3415", "402", "Cannot cancel: no longer pending", "invalid_request", "do_not_retry"],
  ["3416", "402", "Gateway does not support partial settlements", "configuration", "do_not_retry"],
  [
    "3417",
    "402",
    "Another request on the same transaction is in progress",
    "duplicate_request",
    "retry_conditionally",
  ],
  ["3418", "402", "Gateway does not support partial credits", "configuration", "do_not_retry"],
  ["3419", "402", "Transaction type cannot be refunded", "invalid_request", "do_not_retry"],
  [
    "3420",
    "500",
    "Error while processing the purchase return authorization",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "3421",
    "402",
    "Purchase return authorization declined by the issuer",
    "card_declined",
    "manual_review",
  ],
  ["3422", "402", "Purchase return authorization failed", "card_declined", "manual_review"],
  [
    "3423",
    "500",
    "Error while reversing the purchase return authorization",
    "provider_unavailable",
    "manual_review",
  ],
  [
    "3424",
    "500",
    "Purchase return authorization failed; Paysafe says to retry",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "3425",
    "402",
    "Refund blocked because a chargeback exists (OpenAPI only)",
    "invalid_request",
    "do_not_retry",
  ],
];

const VAULT_ROWS: readonly ErrorRow[] = [
  ["7503", "409", "Card already stored on this profile", "duplicate_request", "do_not_retry"],
  [
    "7504",
    "409",
    "Card already used on the maximum number of profiles",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "7505",
    "409",
    "merchantCustomerId already used for another profile",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "7506",
    "409",
    "Bank account already in use on the profile",
    "duplicate_request",
    "do_not_retry",
  ],
  ["7507", "409", "Mandate reference already in use", "duplicate_request", "do_not_retry"],
  [
    "7508",
    "400",
    "Invalid card number or brand, or the two do not match",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "7509",
    "409",
    "Bank account has mandates, so its details cannot change",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "7510",
    "400",
    "Bank account details invalid for the banking scheme",
    "invalid_request",
    "customer_action_required",
  ],
  ["7511", "404", "Address ID not found", "invalid_request", "do_not_retry"],
  ["7512", "400", "Merchant Apple Pay configuration not found", "configuration", "do_not_retry"],
  ["7513", "400", "Apple Pay token invalid", "invalid_request", "customer_action_required"],
  ["7514", "404", "Payment token expired", "invalid_request", "customer_action_required"],
  [
    "7515",
    "409",
    "Profile already holds the maximum number of cards",
    "invalid_request",
    "do_not_retry",
  ],
  ["7516", "400", "At least one search parameter required", "invalid_request", "do_not_retry"],
  [
    "7517",
    "400",
    "Dates must use the format YYYY-MM-DDTHH24:MI:SSZ",
    "invalid_request",
    "do_not_retry",
  ],
  ["7518", "400", "Date range too long", "invalid_request", "do_not_retry"],
  ["7519", "400", "Pagination limit too high", "invalid_request", "do_not_retry"],
  [
    "7520",
    "409",
    "Profile already holds the maximum number of bank accounts",
    "invalid_request",
    "do_not_retry",
  ],
];

const APM_ROWS: readonly ErrorRow[] = [
  [
    "ALTERNATE-PAYMENTS-GATEWAY-1",
    "402",
    "Cancelled at the gateway",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-4",
    "402",
    "Declined by the gateway (also the target for many PayPal errors, 4.16)",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-5",
    "402",
    "Operation needs a completed transaction",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-6",
    "402",
    "Over refund: total refunds above the payment",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-7",
    "402",
    "Payment expired",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-8",
    "402",
    "Over settlement: total settled above the authorized amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-9",
    "402",
    "Gateway reported a risk issue",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-10",
    "502",
    "Payment type temporarily unavailable (maintenance)",
    "payment_method_unavailable",
    "retry_conditionally",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-11",
    "402",
    "Void exceeds the amount still to settle",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-12",
    "402",
    "Payment already partly or fully settled",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-13",
    "402",
    "Transaction not refundable yet",
    "invalid_request",
    "retry_conditionally",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-14",
    "402",
    "Partial settlement not possible for the payment method",
    "configuration",
    "do_not_retry",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-16",
    "402",
    "Amount above the maximum for the payment type",
    "invalid_amount",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-17",
    "504",
    "Request timed out",
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-19",
    "402",
    "Insufficient funds on the payment instrument",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-20",
    "402",
    "Third-party account not activated",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-21",
    "402",
    "Amount below the minimum for the payment type",
    "invalid_amount",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-22",
    "402",
    "Identity details differ from those already on file",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-23",
    "402",
    "KYC documents could not be verified",
    "fraud_or_risk",
    "customer_action_required",
  ],
  [
    "ALTERNATE-PAYMENTS-GATEWAY-24",
    "402",
    "A third-party account with these details already exists",
    "duplicate_request",
    "do_not_retry",
  ],
];

const DIRECT_DEBIT_ROWS: readonly ErrorRow[] = [
  ["2004", "400", "Direct Debit transaction not found", "invalid_request", "do_not_retry"],
  [
    "2008",
    "400",
    "Invalid routing or transit number",
    "invalid_request",
    "customer_action_required",
  ],
  ["2011", "400", "Mandate reference does not exist", "invalid_request", "do_not_retry"],
  ["2012", "400", "Mandate reference not active yet", "invalid_request", "retry_conditionally"],
  ["2013", "400", "Mandate reference status not valid", "invalid_request", "do_not_retry"],
  [
    "2014",
    "400",
    "Mandate reference already used for this bank account",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "2017",
    "400",
    "Token bank scheme differs from the merchant account bank scheme",
    "configuration",
    "do_not_retry",
  ],
  [
    "2019",
    "400",
    "Bank account information is in INVALID state",
    "invalid_request",
    "customer_action_required",
  ],
  ["4002", "402", "Declined by Paysafe risk management", "fraud_or_risk", "manual_review"],
];

const HANDLE_3DS_ROWS: readonly ErrorRow[] = [
  [
    "5100",
    "-",
    "3DS enrollment check failed: enrollment status N",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "5101",
    "-",
    "3DS enrollment check failed: enrollment status U",
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "5102",
    "-",
    "Wallet returned WALLET_FAILED (Embedded Finance flow only)",
    "provider_unavailable",
    "manual_review",
  ],
  ["5103", "-", "3DS service returned FAILED", "provider_unavailable", "retry_conditionally"],
  [
    "5104",
    "-",
    "3DS API reported enrollment N",
    "authentication_failed",
    "customer_action_required",
  ],
  ["5105", "-", "3DS API reported enrollment U", "authentication_failed", "retry_conditionally"],
  ["5106", "-", "Risk rule: 3DS result N", "authentication_failed", "customer_action_required"],
  ["5107", "-", "Risk rule: 3DS result R (rejected)", "authentication_failed", "do_not_retry"],
  ["5108", "-", "Risk rule: 3DS result U", "authentication_failed", "retry_conditionally"],
  ["5109", "-", "deviceFingerprintingId is null", "invalid_request", "do_not_retry"],
  [
    "5110",
    "-",
    "deviceFingerprintingId is null (same text as 5109)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5111",
    "-",
    "Risk rule: signature status Y but 3DS result N",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "5112",
    "-",
    "Risk rule: 3DS result U in the authentication response",
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "5113",
    "-",
    "Risk rule: 3DS result E in the authentication response",
    "authentication_failed",
    "retry_conditionally",
  ],
  [
    "5114",
    "-",
    "Risk rule: signature status N",
    "authentication_failed",
    "customer_action_required",
  ],
  ["5115", "-", "Risk rule: 3DS result N", "authentication_failed", "customer_action_required"],
  ["5116", "-", "Risk rule: 3DS result U", "authentication_failed", "retry_conditionally"],
  ["5117", "-", "Risk rule: 3DS result R", "authentication_failed", "do_not_retry"],
  ["5118", "-", "state missing", "invalid_request", "customer_action_required"],
  ["5119", "-", "holderName missing", "invalid_request", "customer_action_required"],
  [
    "5120",
    "-",
    "Risk rule: third-party 3DS service error",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["5121", "-", "Risk rule: 3DS API failed", "provider_unavailable", "retry_conditionally"],
  [
    "5122",
    "-",
    "3DS API error: invalid merchantRefNum (OpenAPI only)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "5123",
    "-",
    "3DS library returned a null id (OpenAPI only)",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "5124",
    "-",
    "3DS result N after the challenge or OTP step",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "5125",
    "-",
    "3DS result U after the challenge or OTP step",
    "authentication_failed",
    "retry_conditionally",
  ],
  ["6000", "-", "3DS API field error (OpenAPI only)", "invalid_request", "do_not_retry"],
];

const ADVICE_ROWS: readonly ErrorRow[] = [
  ["ADVICE-01", "402", "Issuer will never approve; do not retry", "card_declined", "do_not_retry"],
  [
    "ADVICE-02",
    "402",
    "Issuer cannot approve now; at most 10 retries in 30 days",
    "card_declined",
    "retry_conditionally",
  ],
  [
    "ADVICE-03",
    "402",
    "Revalidate payment details; at most 10 retries in 30 days",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ADVICE-04",
    "402",
    "Cardholder must contact the issuer; at most 10 retries in 30 days",
    "card_declined",
    "customer_action_required",
  ],
  [
    "ADVICE-05",
    "402",
    "Token requirements not met; get a new token; at most 10 retries in 30 days",
    "invalid_request",
    "customer_action_required",
  ],
  ["ADVICE-06", "402", "Undefined response", "unknown", "unknown"],
  [
    "ADVICE-07",
    "402",
    "Merchant does not qualify for the product code; change parameters or stop",
    "configuration",
    "do_not_retry",
  ],
  ["ADVICE-08", "402", "Retry after 1 hour", "card_declined", "retry_conditionally"],
  ["ADVICE-09", "402", "Retry after 24 hours", "card_declined", "retry_conditionally"],
  ["ADVICE-10", "402", "Retry after 48 hours", "card_declined", "retry_conditionally"],
  ["ADVICE-11", "402", "Retry after 4 days", "card_declined", "retry_conditionally"],
  ["ADVICE-12", "402", "Retry after 6 days", "card_declined", "retry_conditionally"],
  ["ADVICE-13", "402", "Retry after 8 days", "card_declined", "retry_conditionally"],
  ["ADVICE-14", "402", "Retry after 10 days", "card_declined", "retry_conditionally"],
  [
    "ADVICE-42",
    "402",
    "Sanctions screening score above the threshold",
    "fraud_or_risk",
    "manual_review",
  ],
];

export const AVS_CODES: Readonly<Record<string, string>> = {
  A: "Street address matches, ZIP does not (same text as Y)",
  B: "Street matches; postal code in the wrong format (international)",
  C: "Street address and postal code in the wrong formats",
  D: "Street address and postal code match (international issuer; same text as I)",
  E: "AVS error",
  F: "Address and five-digit ZIP compare (UK only)",
  G: "Service not supported by a non-US issuer",
  H: "Address not verified by an international issuer",
  I: "Street address and postal code match (international issuer)",
  M: "Neither street nor ZIP match",
  N: "No response sent",
  O: "Postal code matches; street not verified because of incompatible formats",
  P: "Retry: system unavailable or timed out",
  R: "Service not supported by the issuer",
  S: "Address information unavailable",
  U: "Nine-digit ZIP matches, street does not",
  W: "Exact AVS match",
  X: "Street and five-digit ZIP match",
  Y: "Street address matches, ZIP does not",
  Z: "Five-digit ZIP matches, street does not (listed with HTTP 403)",
};

const ISO_ROWS: readonly CodeRow[] = [
  ["00", "Approved", null, null],
  ["01", "Refer to the issuer", "card_declined", "customer_action_required"],
  ["03", "Invalid merchant", "configuration", "manual_review"],
  ["04", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["05", "Do not honour", "card_declined", "customer_action_required"],
  ["08", "Honour with identification", null, null],
  ["10", "Partial approval", null, null],
  ["12", "Invalid transaction", "card_declined", "do_not_retry"],
  ["13", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["14", "Invalid card number", "invalid_request", "customer_action_required"],
  ["15", "Invalid issuer", "invalid_request", "customer_action_required"],
  ["30", "Format error", "invalid_request", "do_not_retry"],
  ["41", "Lost card", "fraud_or_risk", "do_not_retry"],
  ["43", "Stolen card", "fraud_or_risk", "do_not_retry"],
  ["51", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["54", "Expired card", "card_declined", "customer_action_required"],
  ["55", "Wrong PIN", "authentication_failed", "customer_action_required"],
  ["57", "Transaction not allowed for the card", "card_declined", "customer_action_required"],
  ["58", "Transaction not permitted for the terminal", "configuration", "do_not_retry"],
  ["61", "Withdrawal limit exceeded", "card_declined", "customer_action_required"],
  ["62", "Restricted card", "card_declined", "customer_action_required"],
  ["65", "Frequency limit exceeded", "card_declined", "retry_conditionally"],
  ["70", "Contact the card issuer", "card_declined", "customer_action_required"],
  ["71", "PIN not changed", "authentication_failed", "customer_action_required"],
  ["75", "PIN tries exceeded", "authentication_failed", "customer_action_required"],
  ["76", 'Invalid "to" account', "invalid_request", "do_not_retry"],
  ["77", 'Invalid "from" account', "invalid_request", "do_not_retry"],
  ["79", "Life cycle decline", "card_declined", "retry_conditionally"],
  ["82", "Policy decline", "card_declined", "do_not_retry"],
  ["83", "Fraud or security decline", "fraud_or_risk", "do_not_retry"],
  ["84", "Invalid authorization life cycle", "invalid_request", "do_not_retry"],
  ["85", "No reason to decline", null, null],
  ["86", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["87", "Purchase amount only, no cash back", "invalid_request", "do_not_retry"],
  ["88", "Cryptographic error", "provider_unavailable", "retry_conditionally"],
  ["89", "PIN not acceptable", "authentication_failed", "customer_action_required"],
  ["91", "Request destination unreachable", "provider_unavailable", "retry_conditionally"],
  ["92", "Response destination unreachable", "provider_unavailable", "retry_conditionally"],
  ["94", "Already reversed", "duplicate_request", "do_not_retry"],
  ["96", "Internal error", "provider_unavailable", "retry_conditionally"],
];

const INTERCHECKS_ROWS: readonly InterchecksRow[] = [
  [
    "ERR_CARD_INELIGIBLE",
    "500/1001",
    "402/3017",
    "Card not eligible for Interchecks",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERR_CREDIT_CARD_NOT_SUPPORTED",
    "500/1001",
    "402/5021",
    "Credit cards not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_EMAIL",
    "400/5068",
    "400/3025",
    "Invalid email",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_EMAIL_IN_USE",
    "500/1001",
    "502/1001",
    "Recipient email already tied to another profile",
    "duplicate_request",
    "manual_review",
  ],
  [
    "ERR_INTERNAL_SERVER_ERROR",
    "500/1001",
    "502/1001",
    "Interchecks internal error",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_INVALID_CARD_DETAILS",
    "400/5068",
    "402/3017",
    "Invalid card details",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_PAYER_ID",
    "400/5068",
    "400/3025",
    'Invalid payer ID (existing table text says "Card ineligible")',
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_INVALID_RECIPIENT_EMAIL",
    "400/5068",
    "400/3025",
    "Invalid recipient email",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_RECIPIENT_ID",
    "400/5068",
    "400/3025",
    "Invalid recipient ID (row listed twice in the new table)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_MISSING_RECIPIENT",
    "400/5068",
    "400/3025",
    "Recipient ID or email missing",
    "invalid_request",
    "do_not_retry",
  ],
  ["403 FORBIDDEN", "-", "403/5270", "Access forbidden", "configuration", "do_not_retry"],
  [
    "ERR_ACCOUNT_PROVIDER_MISMATCH",
    "-",
    "400/5004",
    "Account not valid for the provider",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_ACCOUNT_PROVIDER_NOT_ENABLED",
    "-",
    "400/5017",
    "Payer not enabled for the account provider",
    "configuration",
    "do_not_retry",
  ],
  [
    "ERR_INVALID_ACCOUNT_ID",
    "-",
    "400/5004",
    "Invalid account ID",
    "invalid_request",
    "do_not_retry",
  ],
  ["NOT_AUTHORIZED", "-", "401/5000", "Unauthorized", "configuration", "do_not_retry"],
  [
    "ERR_RETRIEVING_CARD_DETAILS",
    "-",
    "502/1001",
    "Card eligibility could not be determined",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["ERR_INVALID_DATE_FORMAT", "-", "400/3025", "Invalid date", "invalid_request", "do_not_retry"],
  [
    "ERR_INVALID_EXP_DATE",
    "-",
    "400/3025",
    "Invalid expiry date",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_CURRENCY_CODE",
    "-",
    "400/3025",
    "Invalid currency code",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_INVALID_NAME",
    "-",
    "400/3025",
    "Name fields invalid or missing",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_TRANSACTION_FAILURE",
    "-",
    "502/1001",
    "Transaction failed (free-text reason)",
    "provider_unavailable",
    "manual_review",
  ],
  [
    "ERR_RECIPIENT_NOT_FOUND",
    "-",
    "404/5269",
    "Recipient email not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_INVALID_PARAMETER",
    "-",
    "400/3025",
    "Request parameters missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_INVALID_TRANSACTION_ID",
    "-",
    "400/3025",
    "Invalid transaction ID",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_INSUFFICIENT_FUNDS",
    "-",
    "402/5021",
    "Insufficient funds",
    "insufficient_funds",
    "customer_action_required",
  ],
  [
    "ERR_VELOCITY_LIMIT",
    "-",
    "402/3027",
    "Velocity controls triggered",
    "fraud_or_risk",
    "retry_conditionally",
  ],
  [
    "ERR_ACCOUNT_SHARING_LIMIT_EXCEEDED",
    "-",
    "402/3027",
    "Account sharing limit exceeded",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "ERR_ACCOUNT_LIMIT_EXCEEDED",
    "-",
    "402/3027",
    "Activity limit exceeded",
    "card_declined",
    "retry_conditionally",
  ],
  [
    "ERR_BANK_ACCOUNT_VALIDATION",
    "-",
    "502/1001",
    "Bank account validation error",
    "provider_unavailable",
    "manual_review",
  ],
  [
    "ERR_ACCOUNT_ALREADY_REGISTERED",
    "-",
    "502/1001",
    "Account already registered",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "ERR_ACCOUNT_NOT_ADDED",
    "-",
    "502/1001",
    "Account could not be added now",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_CLIENT_ACCESS_PAYER",
    "-",
    "403/5270",
    'Client has no access to the payer (text misspelled "lient")',
    "configuration",
    "do_not_retry",
  ],
  [
    "ERR_INELIGIBLE_RECIPIENT_ACCOUNT",
    "-",
    "502/1001",
    "Account not eligible for the transaction method",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_PAYOUT_METHOD_FOR_ACCOUNT",
    "-",
    "400/3025",
    "Transaction method not valid for the account",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "ERR_INVALID_RECIPIENT_REFERENCE_ID",
    "-",
    "400/3025",
    "Recipient reference ID not found",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_OFAC_LIST_MATCH",
    "-",
    "402/5021",
    "Cancelled after an OFAC list match",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "ERR_TOKENIZING_CARD",
    "-",
    "502/1001",
    "Card details could not be validated",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_TRANSACTION_METHOD_NOT_AVAILABLE",
    "-",
    "502/1001",
    "Transaction method not available",
    "payment_method_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_TRANSACTION_METHOD_NOT_UNIQUE",
    "-",
    "502/1001",
    "Several configurations found for the method",
    "configuration",
    "manual_review",
  ],
  [
    "ERR_UNSUPPORTED_CURRENCY_CODE",
    "-",
    "400/5001",
    "Unsupported currency code",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "ERR_VERIFICATION_NOT_ENABLED",
    "-",
    "402/5021",
    "Payer not enabled for TIN verification",
    "configuration",
    "manual_review",
  ],
  [
    "ERR_ACCOUNT_BALANCE_THRESHOLD",
    "-",
    "402/5021",
    "Account balance insufficient",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "ERR_ACCOUNT_BALANCE_UNAVAILABLE",
    "-",
    "402/5021",
    "Account balance unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_ACCOUNT_RISK_METRICS_UNAVAILABLE",
    "-",
    "502/1001",
    "Account risk details unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "ERR_ACCOUNT_RISK_LEVEL_NOT_CONFIGURED",
    "-",
    "502/1001",
    "Account risk level not configured",
    "configuration",
    "manual_review",
  ],
  [
    "ERR_ACCOUNT_RISK_THRESHOLD",
    "-",
    "402/3027",
    "Account risk threshold exceeded",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "ERR_INVALID_ADDRESS_PARAMETERS",
    "-",
    "400/3025",
    "Invalid address details",
    "invalid_request",
    "customer_action_required",
  ],
  ["ERR_INVALID_COUNTRY", "-", "400/3025", "Invalid country", "invalid_request", "do_not_retry"],
  [
    "ERR_OCT_DECLINE",
    "-",
    "see 4.14",
    "Issuer declined the card payout (OCT); reason prefix in 4.14",
    "card_declined",
    "customer_action_required",
  ],
];

const OPN_NAG_ROWS: readonly ProcessorRow[] = [
  ["00", "Approved", null, null],
  ["01", "Refer to the issuer", "card_declined", "customer_action_required"],
  ["03", "Invalid merchant", "configuration", "manual_review"],
  ["04", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["05", "Do not honour", "card_declined", "customer_action_required"],
  ["06", "Error (reversals only)", "provider_unavailable", "manual_review"],
  ["09", "Transaction in progress", "unknown", "retry_conditionally"],
  ["10", "Partial approval", null, null],
  ["12", "Invalid transaction", "card_declined", "do_not_retry"],
  ["13", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["14", "Invalid card number", "invalid_request", "customer_action_required"],
  [
    "15",
    "Invalid issuer: BIN does not map to an issuer",
    "invalid_request",
    "customer_action_required",
  ],
  ["17", "Customer cancellation", "card_declined", "customer_action_required"],
  ["19", "Re-enter transaction", "card_declined", "retry_conditionally"],
  ["30", "Message format error", "invalid_request", "do_not_retry"],
  ["41", "Lost card, pick up", "fraud_or_risk", "do_not_retry"],
  ["43", "Stolen card, pick up", "fraud_or_risk", "do_not_retry"],
  ["46", "Account closed", "card_declined", "do_not_retry"],
  ["51", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["52", "No checking account", "invalid_request", "customer_action_required"],
  ["53", "No savings account", "invalid_request", "customer_action_required"],
  ["54", "Expired card", "card_declined", "customer_action_required"],
  ["55", "Wrong PIN", "authentication_failed", "customer_action_required"],
  ["57", "Transaction not permitted", "card_declined", "customer_action_required"],
  ["58", "Transaction not allowed at the terminal", "configuration", "do_not_retry"],
  ["59", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["61", "Usage limit exceeded", "card_declined", "customer_action_required"],
  ["62", "Restricted card", "card_declined", "customer_action_required"],
  ["64", "AML requirements not met", "fraud_or_risk", "manual_review"],
  ["65", "Frequency limit exceeded", "card_declined", "retry_conditionally"],
  ["68", "Late response (timeout)", "network_or_timeout", "retry_conditionally"],
  ["6P", "Verification data failed", "authentication_failed", "customer_action_required"],
  ["71", "PIN not changed", "authentication_failed", "customer_action_required"],
  ["75", "PIN tries exceeded", "authentication_failed", "customer_action_required"],
  [
    "76",
    "Additional customer authentication required (contact mode or SCA)",
    "authentication_required",
    "customer_action_required",
  ],
  ["77", "PIN data requested", "authentication_required", "customer_action_required"],
  ["78", "Blocked: first use or special condition", "card_declined", "customer_action_required"],
  ["79", "Life cycle decline", "card_declined", "retry_conditionally"],
  ["81", "Cryptographic error", "provider_unavailable", "retry_conditionally"],
  ["82", "Invalid CVV2", "card_declined", "customer_action_required"],
  ["84", "Re-enter transaction", "card_declined", "retry_conditionally"],
  ["85", "Invalid CVV1 or CVV3", "card_declined", "customer_action_required"],
  ["86", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["87", "To or from account does not exist", "invalid_request", "do_not_retry"],
  [
    "91",
    "Authorization or issuer system inoperative",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "92",
    "Cannot route: institution or network not found",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["93", "Violation of law", "fraud_or_risk", "do_not_retry"],
  ["94", "Duplicate transmission", "duplicate_request", "do_not_retry"],
  ["95", "Already reversed or reconciliation mismatch", "duplicate_request", "manual_review"],
  ["96", "System malfunction", "provider_unavailable", "retry_conditionally"],
  ["B1", "Surcharge not permitted on Visa or EBT food stamps", "configuration", "do_not_retry"],
  ["B2", "Surcharge not supported by the debit network issuer", "configuration", "do_not_retry"],
  ["C1", "Invalid country code", "invalid_request", "do_not_retry"],
  ["C2", "Invalid region code", "invalid_request", "do_not_retry"],
  ["N3", "Cash service not available (POS)", "payment_method_unavailable", "do_not_retry"],
  [
    "N4",
    "Cash request exceeds issuer or approved limit",
    "card_declined",
    "customer_action_required",
  ],
  ["R2", "Not eligible for Visa PIN", "authentication_failed", "customer_action_required"],
  [
    "P5",
    "PIN unblock or change declined (ATM)",
    "authentication_failed",
    "customer_action_required",
  ],
  ["N8", "Amount exceeds preauthorized approval amount", "invalid_amount", "do_not_retry"],
  ["P6", "Requested PIN change unsafe (ATM)", "authentication_failed", "customer_action_required"],
  [
    "80",
    "Cancellation in or of a recurring series; do not retry",
    "card_declined",
    "do_not_retry",
    true,
  ],
];

const MON_ROWS: readonly ProcessorRow[] = [
  ["01", "Approved", null, null],
  ["03", "Invalid service code or merchant", "configuration", "manual_review"],
  ["04", "Decline, pick up card", "fraud_or_risk", "do_not_retry"],
  ["05", "Do not honor", "card_declined", "customer_action_required"],
  ["07", "Pick up card, special condition", "fraud_or_risk", "do_not_retry"],
  ["12", "Invalid transaction code", "invalid_request", "do_not_retry"],
  ["15", "No such issuer", "invalid_request", "customer_action_required"],
  ["19", "Retry transaction", "card_declined", "retry_conditionally"],
  ["30", "Bad message or format error", "invalid_request", "do_not_retry"],
  ["39", "No checking account; invalid account", "invalid_request", "customer_action_required"],
  ["40", "Invalid transaction; inquiry not allowed", "invalid_request", "do_not_retry"],
  ["41", "Lost or stolen card", "fraud_or_risk", "do_not_retry"],
  ["43", "Stolen card, pick up", "fraud_or_risk", "do_not_retry"],
  ["46", "Account closed", "card_declined", "do_not_retry"],
  [
    "50",
    "Not allowed for cardholder or merchant; invalid transaction",
    "card_declined",
    "do_not_retry",
  ],
  ["51", "Low or insufficient funds", "insufficient_funds", "customer_action_required"],
  ["52", "No checking account; invalid account", "invalid_request", "customer_action_required"],
  ["53", "No savings account; invalid account", "invalid_request", "customer_action_required"],
  ["54", "Expired card", "card_declined", "customer_action_required"],
  ["55", "Invalid or wrong PIN", "authentication_failed", "customer_action_required"],
  [
    "57",
    "Not permitted to cardholder; card not supported",
    "card_declined",
    "customer_action_required",
  ],
  ["58", "Not permitted to acquirer", "configuration", "do_not_retry"],
  ["59", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["62", "Invalid status, restricted or limited card", "card_declined", "customer_action_required"],
  ["63", "No security module; security violation", "fraud_or_risk", "do_not_retry"],
  ["68", "Timeout", "network_or_timeout", "retry_conditionally"],
  ["77", "Invalid transaction date", "invalid_request", "do_not_retry"],
  ["78", "Card not authorized", "card_declined", "customer_action_required"],
  ["79", "Life cycle decline; do not retry", "card_declined", "do_not_retry"],
  ["80", "Invalid transaction", "card_declined", "do_not_retry"],
  ["82", "Invalid CVV; policy decline", "card_declined", "customer_action_required"],
  ["83", "Security-related decline", "fraud_or_risk", "do_not_retry"],
  ["86", "Unable to authorize; security violation", "fraud_or_risk", "do_not_retry"],
  ["88", "Unable to authorize; security violation", "fraud_or_risk", "do_not_retry"],
  ["89", "External system problem", "provider_unavailable", "retry_conditionally"],
  [
    "91",
    "Cannot complete; network processing problem",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["92", "Invalid route service (destination)", "provider_unavailable", "retry_conditionally"],
  ["93", "Invalid route service (destination)", "provider_unavailable", "retry_conditionally"],
  ["94", "Duplicate transaction or request in progress", "duplicate_request", "do_not_retry"],
  ["96", "System error", "provider_unavailable", "retry_conditionally"],
  ["6P", "Verification data failed", "authentication_failed", "customer_action_required"],
  ["N4", "Decline (no further text)", "card_declined", "customer_action_required"],
  ["N7", "Decline (no further text)", "card_declined", "customer_action_required"],
  [
    "R0",
    "Stop payment order: skip this rebill, try the next one",
    "card_declined",
    "retry_conditionally",
    true,
  ],
  [
    "R1",
    "Authorization revoked: stop all further transactions",
    "card_declined",
    "do_not_retry",
    true,
  ],
  [
    "R3",
    "All authorizations revoked: stop all; account may be closed",
    "card_declined",
    "do_not_retry",
    true,
  ],
];

const TAS_VPS_ROWS: readonly ProcessorRow[] = [
  ["00", "Approved and completed", null, null],
  ["01", "Refer to issuer", "card_declined", "customer_action_required"],
  ["02", "Refer to issuer, special condition", "card_declined", "customer_action_required"],
  ["03", "Invalid merchant ID", "configuration", "manual_review"],
  ["04", "Pick up card (no fraud)", "card_declined", "do_not_retry"],
  ["05", "Do not honor", "card_declined", "customer_action_required"],
  ["06", "General error", "provider_unavailable", "retry_conditionally"],
  ["07", "Pick up card, special condition (fraud account)", "fraud_or_risk", "do_not_retry"],
  ["08", "Honor Mastercard with ID", null, null],
  ["10", "Partial approval for the returned amount", null, null],
  ["11", "VIP approval", null, null],
  ["12", "Invalid transaction", "card_declined", "do_not_retry"],
  ["13", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["14", "Invalid card number", "invalid_request", "customer_action_required"],
  ["15", "No such issuer", "invalid_request", "customer_action_required"],
  ["19", "Re-enter transaction", "card_declined", "retry_conditionally"],
  ["21", "Cannot back out transaction", "unknown", "manual_review"],
  ["25", "Account number not found", "invalid_request", "customer_action_required"],
  ["28", "File temporarily unavailable", "provider_unavailable", "retry_conditionally"],
  ["30", "Transaction badly formatted", "invalid_request", "do_not_retry"],
  ["39", "No credit account", "invalid_request", "customer_action_required"],
  ["41", "Lost card, pick up (fraud account)", "fraud_or_risk", "do_not_retry"],
  ["43", "Stolen card, pick up (fraud account)", "fraud_or_risk", "do_not_retry"],
  ["46", "Account closed", "card_declined", "do_not_retry"],
  ["51", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["52", "No checking account", "invalid_request", "customer_action_required"],
  ["53", "No savings account", "invalid_request", "customer_action_required"],
  ["54", "Expired card", "card_declined", "customer_action_required"],
  ["55", "Wrong PIN", "authentication_failed", "customer_action_required"],
  ["57", "Not permitted for the card", "card_declined", "customer_action_required"],
  ["58", "Not permitted for the terminal", "configuration", "do_not_retry"],
  ["59", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["61", "Exceeds approval amount limit", "card_declined", "customer_action_required"],
  ["62", "Invalid service code, restricted", "card_declined", "customer_action_required"],
  ["63", "Security violation", "fraud_or_risk", "do_not_retry"],
  ["65", "Withdrawal frequency limit exceeded", "card_declined", "retry_conditionally"],
  ["6P", "Verification data failed", "authentication_failed", "customer_action_required"],
  ["75", "PIN tries exceeded", "authentication_failed", "customer_action_required"],
  ["76", "Cannot locate, no match", "invalid_request", "manual_review"],
  ["77", "Inconsistent, reversed or repeated data", "invalid_request", "manual_review"],
  [
    "78",
    "Blocked: first use by a new cardholder, card not unblocked",
    "card_declined",
    "customer_action_required",
  ],
  ["79", "Already reversed at the switch", "duplicate_request", "do_not_retry"],
  ["80", "No financial impact (reversal response)", "unknown", "manual_review"],
  ["81", "Cryptographic error", "provider_unavailable", "retry_conditionally"],
  [
    "82",
    "CVV data incorrect, or offline PIN check interrupted",
    "card_declined",
    "customer_action_required",
  ],
  ["83", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["85", "No reason to decline", null, null],
  ["86", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["91", "Issuer or switch unavailable", "provider_unavailable", "retry_conditionally"],
  ["92", "Destination not found", "provider_unavailable", "retry_conditionally"],
  ["93", "Violation, cannot complete", "fraud_or_risk", "do_not_retry"],
  ["94", "Cannot locate, no match", "invalid_request", "manual_review"],
  ["96", "System malfunction", "provider_unavailable", "retry_conditionally"],
  ["A1", "POS device authentication succeeded", null, null],
  ["A2", "POS device authentication failed", "configuration", "manual_review"],
  ["A3", "POS device deactivated", null, null],
  ["A8", "Invalid region code", "invalid_request", "do_not_retry"],
  ["A9", "Invalid country code", "invalid_request", "do_not_retry"],
  [
    "B1",
    "Surcharge not permitted on debit cards or EBT food stamps",
    "configuration",
    "do_not_retry",
  ],
  ["B2", "Surcharge not supported by the debit network issuer", "configuration", "do_not_retry"],
  ["CV", "Card type verification error", "invalid_request", "customer_action_required"],
  [
    "D3",
    "3-D Secure cryptogram missing or invalid",
    "authentication_failed",
    "customer_action_required",
  ],
  ["E1", "Encryption not configured", "configuration", "manual_review"],
  ["E2", "Terminal not authenticated", "configuration", "manual_review"],
  ["E3", "Data could not be decrypted", "configuration", "manual_review"],
  ["EA", "Verification error", "unknown", "manual_review"],
  ["EB", "Verification error", "unknown", "manual_review"],
  ["EC", "Verification error", "unknown", "manual_review"],
  ["H1-H9", "Contact merchant services or technical support", "configuration", "manual_review"],
  ["HV", "Hierarchy verification error", "configuration", "manual_review"],
  ["K0", "Token request processed", null, null],
  ["K1", "Tokenization not configured", "configuration", "manual_review"],
  ["K2", "Terminal not authenticated", "configuration", "manual_review"],
  ["K3", "Data could not be de-tokenized", "configuration", "manual_review"],
  [
    "M0",
    "Canada-issued Mastercard domestic debit not allowed",
    "payment_method_unavailable",
    "customer_action_required",
  ],
  ["N3", "Cash back not available", "payment_method_unavailable", "do_not_retry"],
  ["N4", "Exceeds issuer withdrawal limit", "card_declined", "customer_action_required"],
  ["N7", "Invalid CVV2", "card_declined", "customer_action_required"],
  ["P0-P6", "Contact merchant services or technical support", "configuration", "manual_review"],
  [
    "P7",
    "Terminal boarding not complete (serial number not set up)",
    "configuration",
    "manual_review",
  ],
  ["Q1", "Card authentication failed", "authentication_failed", "customer_action_required"],
  ["S0", "PAN inactive", "card_declined", "customer_action_required"],
  ["S1", "Mod-10 check failed", "invalid_request", "customer_action_required"],
  ["S5", "No preauthorization found", "invalid_request", "do_not_retry"],
  ["S9", "Maximum working balance exceeded", "card_declined", "do_not_retry"],
  ["SA", "Authorization server shut down", "provider_unavailable", "retry_conditionally"],
  ["SB", "Card status is not active", "card_declined", "customer_action_required"],
  ["SC", "Unknown dealer or store code", "configuration", "manual_review"],
  ["SD", "Maximum number of recharges exceeded", "card_declined", "do_not_retry"],
  ["SE", "Card already used", "card_declined", "do_not_retry"],
  ["SF", "Manual transactions not allowed", "configuration", "do_not_retry"],
  ["SH", "Unknown transaction type", "invalid_request", "do_not_retry"],
  ["SJ", "Invalid tender type", "invalid_request", "do_not_retry"],
  ["SK", "Invalid customer type", "invalid_request", "do_not_retry"],
  ["SL", "PIN locked", "authentication_failed", "customer_action_required"],
  ["SM", "Maximum number of redemptions exceeded", "card_declined", "do_not_retry"],
  ["SP", "Maximum number of PAN tries exceeded", "fraud_or_risk", "do_not_retry"],
  ["SR", "Card already issued", "invalid_request", "do_not_retry"],
  ["SS", "Card not issued", "invalid_request", "do_not_retry"],
  ["T0", "First check accepted and converted", null, null],
  [
    "T1",
    "Check accepted but not convertible (declined)",
    "card_declined",
    "customer_action_required",
  ],
  [
    "T2",
    "Invalid ABA number, not an ACH participant",
    "invalid_request",
    "customer_action_required",
  ],
  ["T3", "Amount above the limit", "invalid_amount", "do_not_retry"],
  ["V1", "Daily threshold exceeded", "card_declined", "retry_conditionally"],
  ["Z6", "Invalid use of MCC; correct and resubmit", "configuration", "do_not_retry"],
  [
    "R0",
    "Customer stopped one recurring payment: skip this rebill, try the next one",
    "card_declined",
    "retry_conditionally",
    true,
  ],
  [
    "R1",
    "Customer stopped all recurring payments to the merchant: stop all",
    "card_declined",
    "do_not_retry",
    true,
  ],
  [
    "R3",
    "All recurring payments cancelled for the card: stop all; account may be closed",
    "card_declined",
    "do_not_retry",
    true,
  ],
];

const FRD_ROWS: readonly ProcessorRow[] = [
  ["100", "Approved", null, null],
  ["109", "Transaction processed earlier", "duplicate_request", "do_not_retry"],
  ["200", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["201", "Invalid card number", "invalid_request", "customer_action_required"],
  ["202", "Non-numeric amount", "invalid_amount", "do_not_retry"],
  ["203", "Zero amount", "invalid_amount", "do_not_retry"],
  ["204", "Other error", "unknown", "manual_review"],
  ["205", "Bad total authorization amount", "invalid_amount", "do_not_retry"],
  ["206", "Bad anticipated amount", "invalid_amount", "do_not_retry"],
  ["225", "Invalid field data", "invalid_request", "do_not_retry"],
  ["227", "Companion data missing", "invalid_request", "do_not_retry"],
  ["231", "Invalid division number", "configuration", "manual_review"],
  ["236", "Invalid region code", "invalid_request", "do_not_retry"],
  ["237", "Invalid country code", "invalid_request", "do_not_retry"],
  ["238", "Invalid currency", "invalid_request", "do_not_retry"],
  ["239", "Payment method invalid for the division", "configuration", "manual_review"],
  ["241", "Illegal action", "invalid_request", "do_not_retry"],
  ["242", "Invalid temporary services data", "invalid_request", "do_not_retry"],
  ["243", "Invalid level 3 purchase data", "invalid_request", "do_not_retry"],
  ["244", "Invalid encryption format", "configuration", "manual_review"],
  [
    "245",
    "Secure payment data missing or invalid",
    "authentication_failed",
    "customer_action_required",
  ],
  ["246", "Merchant not enabled for Mastercard SecureCode", "configuration", "manual_review"],
  ["248", "Reserved field not blank", "invalid_request", "do_not_retry"],
  ["249", "Invalid MCC", "configuration", "manual_review"],
  ["253", "Invalid transaction type", "invalid_request", "do_not_retry"],
  ["257", "Customer service phone missing", "invalid_request", "do_not_retry"],
  ["258", "Not authorized to send the record", "configuration", "manual_review"],
  ["262", "Invalid authorization code response date", "invalid_request", "do_not_retry"],
  [
    "263",
    "Partial authorization not allowed or request not valid",
    "configuration",
    "do_not_retry",
  ],
  ["264", "Duplicate deposit", "duplicate_request", "do_not_retry"],
  ["272", "Invalid level 2 purchase data", "invalid_request", "do_not_retry"],
  ["274", "Transaction not supported", "configuration", "do_not_retry"],
  ["275", "Invalid time", "invalid_request", "do_not_retry"],
  ["276", "Invalid date", "invalid_request", "do_not_retry"],
  ["277", "Split shipment not allowed for eCom debit", "configuration", "do_not_retry"],
  ["288", "Merchant daily velocity block", "fraud_or_risk", "manual_review"],
  ["289", "Merchant 7-day velocity block", "fraud_or_risk", "manual_review"],
  ["290", "Merchant 30-day velocity block", "fraud_or_risk", "manual_review"],
  ["291", "Daily disbursement block on the card (funding)", "fraud_or_risk", "manual_review"],
  ["292", "7-day disbursement block on the card (funding)", "fraud_or_risk", "manual_review"],
  ["293", "30-day disbursement block on the card (funding)", "fraud_or_risk", "manual_review"],
  ["294", "Daily disbursement block on the card (payment)", "fraud_or_risk", "manual_review"],
  ["295", "7-day disbursement block on the card (payment)", "fraud_or_risk", "manual_review"],
  ["296", "30-day disbursement block on the card (payment)", "fraud_or_risk", "manual_review"],
  ["297", "Per-transaction disbursement limit exceeded", "invalid_amount", "do_not_retry"],
  ["298", "Disbursement manually blocked (daily, 7 or 30 days)", "fraud_or_risk", "manual_review"],
  ["299", "Duplicate transaction", "duplicate_request", "do_not_retry"],
  ["301", "Issuer unavailable", "provider_unavailable", "retry_conditionally"],
  ["302", "Credit floor", "card_declined", "customer_action_required"],
  ["303", "Processor decline", "card_declined", "customer_action_required"],
  ["304", "Not on file", "invalid_request", "customer_action_required"],
  ["305", "Already reversed", "duplicate_request", "do_not_retry"],
  ["306", "Amount mismatch", "invalid_amount", "do_not_retry"],
  ["307", "Authorization not found", "invalid_request", "do_not_retry"],
  [
    "350",
    "Additional customer authentication required",
    "authentication_required",
    "customer_action_required",
  ],
  ["351", "TransArmor service unavailable", "provider_unavailable", "retry_conditionally"],
  ["352", "Lock expired", "unknown", "manual_review"],
  ["353", "TransArmor token or PAN invalid", "invalid_request", "customer_action_required"],
  ["354", "TransArmor invalid result", "provider_unavailable", "manual_review"],
  ["370", "Deferred authorization not cancelled", "unknown", "manual_review"],
  ["401", "Call the issuer", "card_declined", "customer_action_required"],
  ["402", "Default call", "card_declined", "customer_action_required"],
  ["420", "Unsupported currency", "invalid_request", "do_not_retry"],
  [
    "430",
    "Prepaid card amount above the EU AMLD limit",
    "invalid_amount",
    "customer_action_required",
  ],
  ["501", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["502", "Lost or stolen card", "fraud_or_risk", "do_not_retry"],
  ["503", "Fraud or security violation", "fraud_or_risk", "do_not_retry"],
  ["506", "Invalid institution", "invalid_request", "customer_action_required"],
  ["508", "Too many PIN tries", "authentication_failed", "customer_action_required"],
  ["509", "Over limit", "card_declined", "customer_action_required"],
  ["510", "Over frequency limit", "card_declined", "retry_conditionally"],
  ["519", "On negative file", "fraud_or_risk", "do_not_retry"],
  ["521", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["522", "Card expired", "card_declined", "customer_action_required"],
  ["523", "Encrypted data bad", "configuration", "manual_review"],
  ["530", "Do not honor", "card_declined", "customer_action_required"],
  ["531", "CVV2 or VAK failure", "card_declined", "customer_action_required"],
  ["546", "Account blocked", "card_declined", "do_not_retry"],
  ["551", "Duplicate transaction", "duplicate_request", "do_not_retry"],
  ["580", "Account already activated", "duplicate_request", "do_not_retry"],
  ["581", "Cannot void", "invalid_request", "do_not_retry"],
  ["584", "Issuance below minimum amount", "invalid_amount", "do_not_retry"],
  ["585", "No original authorization found", "invalid_request", "do_not_retry"],
  ["586", "Outstanding authorization, funds on hold", "card_declined", "retry_conditionally"],
  ["587", "Activation amount incorrect", "invalid_amount", "do_not_retry"],
  ["588", "Block activation failed", "provider_unavailable", "manual_review"],
  ["589", "CVD value failure", "card_declined", "customer_action_required"],
  ["590", "Maximum redemption limit reached", "card_declined", "do_not_retry"],
  ["591", "Invalid card number", "invalid_request", "customer_action_required"],
  ["592", "Bad amount", "invalid_amount", "do_not_retry"],
  ["594", "Edit error", "invalid_request", "do_not_retry"],
  ["595", "New card issued; deny", "card_declined", "customer_action_required"],
  ["596", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["602", "Invalid institution code", "invalid_request", "customer_action_required"],
  ["603", "Invalid institution", "invalid_request", "customer_action_required"],
  ["606", "Invalid transaction type", "invalid_request", "do_not_retry"],
  ["607", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["610", "BIN blocked", "fraud_or_risk", "do_not_retry"],
  ["611", "Refer: new account", "card_declined", "customer_action_required"],
  ["612", "Retry with 3DS", "authentication_required", "customer_action_required"],
  ["613", "Retry later", "card_declined", "retry_conditionally"],
  ["614", "Do not retry", "card_declined", "do_not_retry"],
  ["740", "Match failed", "invalid_request", "customer_action_required"],
  ["741", "Validation failed", "invalid_request", "customer_action_required"],
  ["752", "Name missing", "invalid_request", "customer_action_required"],
  ["753", "Invalid account type", "invalid_request", "customer_action_required"],
  ["754", "Account closed", "card_declined", "do_not_retry"],
  ["755", "No account or cannot locate", "invalid_request", "customer_action_required"],
  ["758", "Account frozen", "card_declined", "do_not_retry"],
  ["760", "Not an ACH participant", "payment_method_unavailable", "customer_action_required"],
  ["763", "Invalid account number", "invalid_request", "customer_action_required"],
  ["768", "Bad account number data", "invalid_request", "customer_action_required"],
  ["776", "Duplicate check", "duplicate_request", "do_not_retry"],
  ["777", "Original transaction not approved", "invalid_request", "do_not_retry"],
  ["787", "High-risk decline", "fraud_or_risk", "do_not_retry"],
  ["788", "Refund larger than the original", "invalid_amount", "do_not_retry"],
  ["802", "Positive ID", "unknown", "manual_review"],
  ["806", "Restraint", "card_declined", "manual_review"],
  ["811", "Invalid security code", "card_declined", "customer_action_required"],
  ["813", "Invalid PIN", "authentication_failed", "customer_action_required"],
  ["818", "No savings account", "invalid_request", "customer_action_required"],
  ["825", "No account", "invalid_request", "customer_action_required"],
  ["833", "Invalid merchant", "configuration", "manual_review"],
  ["834", "Unauthorized user", "configuration", "manual_review"],
  ["842", "Bad EAN, SCV or CSV", "invalid_request", "customer_action_required"],
  ["902", "Process unavailable", "provider_unavailable", "retry_conditionally"],
  ["903", "Invalid expiry date", "invalid_request", "customer_action_required"],
  ["904", "Invalid effective date", "invalid_request", "customer_action_required"],
  ["997", "Acquirer error", "provider_unavailable", "retry_conditionally"],
  [
    "570",
    "Stop payment for one recurring or installment payment: skip this rebill",
    "card_declined",
    "retry_conditionally",
    true,
  ],
  [
    "571",
    "Authorization revoked for all recurring or installments: stop all",
    "card_declined",
    "do_not_retry",
    true,
  ],
  [
    "572",
    "All authorizations revoked, account closed: stop all",
    "card_declined",
    "do_not_retry",
    true,
  ],
];

const VAN_ROWS: readonly ProcessorRow[] = [
  ["00", "Approved", null, null],
  ["01", "Refer to card issuer", "card_declined", "customer_action_required"],
  ["02", "Refer to card issuer, special conditions", "card_declined", "customer_action_required"],
  ["03", "Invalid merchant ID", "configuration", "manual_review"],
  ["04", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["05", "Generic authorization decline", "card_declined", "customer_action_required"],
  ["06", "Error", "provider_unavailable", "retry_conditionally"],
  ["07", "Pick up card, special conditions", "fraud_or_risk", "do_not_retry"],
  ["08", "Honor with identification", null, null],
  ["09", "Approved, special conditions", null, null],
  ["10", "Approved for a partial amount", null, null],
  ["11", "VIP approval", null, null],
  ["12", "Invalid transaction", "card_declined", "do_not_retry"],
  ["13", "Invalid amount", "invalid_amount", "do_not_retry"],
  ["14", "Invalid account number", "invalid_request", "customer_action_required"],
  ["15", "No such issuer", "invalid_request", "customer_action_required"],
  ["17 - Debit", "Manual PAN tries exceeded (debit)", "fraud_or_risk", "do_not_retry"],
  ["17 - Credit", "Customer cancellation (credit)", "card_declined", "customer_action_required"],
  ["19", "Retry transaction", "card_declined", "retry_conditionally"],
  ["20", "Approved with overdraft", null, null],
  ["21", "Reversal unsuccessful", "provider_unavailable", "manual_review"],
  ["25", "Record not found on file", "invalid_request", "customer_action_required"],
  ["27", "File update field edit error", "invalid_request", "do_not_retry"],
  ["28", "Update file temporarily unavailable", "provider_unavailable", "retry_conditionally"],
  ["30", "Message format error", "invalid_request", "do_not_retry"],
  ["32", "Partial reversal", null, null],
  ["33", "Pick up card: expired", "card_declined", "do_not_retry"],
  ["38", "PIN tries exceeded", "authentication_failed", "customer_action_required"],
  ["39", "No credit account", "invalid_request", "customer_action_required"],
  ["40", "Requested function not supported", "configuration", "do_not_retry"],
  ["41", "Pick up card: lost", "fraud_or_risk", "do_not_retry"],
  ["43", "Pick up card: stolen", "fraud_or_risk", "do_not_retry"],
  ["46", "Account closed", "card_declined", "do_not_retry"],
  ["47", "Remote function unknown", "invalid_request", "do_not_retry"],
  ["51", "Insufficient funds", "insufficient_funds", "customer_action_required"],
  ["52", "No checking account", "invalid_request", "customer_action_required"],
  ["53", "No savings account", "invalid_request", "customer_action_required"],
  ["54", "Expired card", "card_declined", "customer_action_required"],
  ["55", "Wrong PIN", "authentication_failed", "customer_action_required"],
  ["56", "Cannot process", "provider_unavailable", "retry_conditionally"],
  ["57", "Not permitted to cardholder", "card_declined", "customer_action_required"],
  ["58", "Not permitted to acquirer", "configuration", "do_not_retry"],
  ["59", "Suspected fraud", "fraud_or_risk", "do_not_retry"],
  ["61", "Exceeds withdrawal limit", "card_declined", "customer_action_required"],
  ["62", "Restricted card", "card_declined", "customer_action_required"],
  ["63", "Security violation or invalid Amex CID", "card_declined", "customer_action_required"],
  [
    "65 - Debit",
    "Daily card ticket limit exceeded (debit)",
    "card_declined",
    "retry_conditionally",
  ],
  [
    "65 - Credit",
    "Withdrawal frequency limit exceeded (credit)",
    "card_declined",
    "retry_conditionally",
  ],
  ["67", "Pick up card", "fraud_or_risk", "do_not_retry"],
  ["68", "Response received late", "network_or_timeout", "retry_conditionally"],
  ["69", "Bad close (gift card)", "invalid_request", "do_not_retry"],
  ["70", "Invalid transaction; card already active (gift card)", "invalid_request", "do_not_retry"],
  ["71", "Card not active (gift card)", "card_declined", "customer_action_required"],
  ["72", "Card already closed (gift card)", "card_declined", "do_not_retry"],
  ["73", "Over maximum balance (gift card)", "invalid_amount", "do_not_retry"],
  ["74", "Invalid activation (gift card)", "invalid_request", "do_not_retry"],
  ["75", "PIN tries exceeded", "authentication_failed", "customer_action_required"],
  ["76", "Late reversal", "unknown", "manual_review"],
  ["77", "Reversal does not match the original", "invalid_request", "manual_review"],
  ["78", 'No "to" account specified', "invalid_request", "do_not_retry"],
  ["79", 'No "from" account specified', "invalid_request", "do_not_retry"],
  ["80", "Processor link down; stand-in processing used", "provider_unavailable", "manual_review"],
  ["81", "PIN key synchronization error", "provider_unavailable", "manual_review"],
  ["82", "Invalid CVV", "card_declined", "customer_action_required"],
  ["83", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["85", "No reason to decline (verification)", null, null],
  ["86", "PIN cannot be verified", "authentication_failed", "customer_action_required"],
  ["87", "Purchase approved, cash not", null, null],
  ["88", "Card record not available", "invalid_request", "customer_action_required"],
  ["89", "Invalid authorization code", "invalid_request", "do_not_retry"],
  [
    "91",
    "Issuer or switch inoperative (Mastercard)",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["92", "Cannot route transaction", "provider_unavailable", "retry_conditionally"],
  ["93", "Illegal transaction", "fraud_or_risk", "do_not_retry"],
  ["94", "Duplicate transaction", "duplicate_request", "do_not_retry"],
  ["95", "Reconciliation error", "provider_unavailable", "manual_review"],
  ["96", "System error", "provider_unavailable", "retry_conditionally"],
  ["97", "American Express rewards approval", null, null],
  ["98", "Duplicate transaction", "duplicate_request", "do_not_retry"],
  [
    "99",
    "Preferred debit routing denied; credit may run as debit",
    "configuration",
    "manual_review",
  ],
  ["D1", "Currency conversion done, no authorization performed", "unknown", "manual_review"],
  ["E1", "P2PE decryption request invalid", "configuration", "manual_review"],
  ["E2", "P2PE decryption services unavailable", "provider_unavailable", "retry_conditionally"],
  ["E3", "P2PE decryption failure", "configuration", "manual_review"],
  ["E4", "P2PE decryption message malformed", "configuration", "manual_review"],
  ["E6", "Possible P2PE decryption failure", "configuration", "manual_review"],
  ["E9", "P2PE encryption required", "configuration", "manual_review"],
  ["FS", "Declined by FraudSight", "fraud_or_risk", "do_not_retry"],
  ["N7", "CVV2 mismatch", "card_declined", "customer_action_required"],
  ["M1", "Multi-currency DCC failure", "provider_unavailable", "manual_review"],
  ["M2", "Multi-currency invert failure", "provider_unavailable", "manual_review"],
  ["N0", "Issuer or switch inoperative (Visa)", "provider_unavailable", "retry_conditionally"],
  ["RG", "P2PE registration succeeded", null, null],
  ["V1", "Velocity: too many transactions", "fraud_or_risk", "retry_conditionally"],
  ["V2", "Velocity: amount too high", "fraud_or_risk", "retry_conditionally"],
  ["V3", "Velocity: count or amount too high", "fraud_or_risk", "retry_conditionally"],
  ["V4", "Velocity: negative file exception", "fraud_or_risk", "do_not_retry"],
  ["V5", "Velocity: fraud exception", "fraud_or_risk", "do_not_retry"],
  ["V6", "Velocity: ZIP match failure", "fraud_or_risk", "customer_action_required"],
  ["W1", "More prompts required", "invalid_request", "do_not_retry"],
  ["XE", "Card escheated (gift card)", "card_declined", "do_not_retry"],
  ["XD", "Merchant depleted (gift card)", "configuration", "manual_review"],
  ["XB", "Deconverted BIN (gift card)", "configuration", "manual_review"],
  ["Q1", "Chip failure", "card_declined", "customer_action_required"],
  ["T1", "Invalid 3-D Secure password", "authentication_failed", "customer_action_required"],
  ["T2", "Invalid social security number", "invalid_request", "customer_action_required"],
  ["T3", "Invalid mother's maiden name", "invalid_request", "customer_action_required"],
  ["T4", "Enrollment inquiry declined", "authentication_failed", "customer_action_required"],
  ["T5", "Social security number not available", "invalid_request", "customer_action_required"],
  ["T6", "Mother's maiden name not available", "invalid_request", "customer_action_required"],
  ["T7", "PIN already on the database", "invalid_request", "do_not_retry"],
  [
    "R0",
    "Stop payment order: skip this rebill, try the next one",
    "card_declined",
    "retry_conditionally",
    true,
  ],
  [
    "R1",
    "Authorization revoked: stop all further transactions",
    "card_declined",
    "do_not_retry",
    true,
  ],
  [
    "R3",
    "All authorizations revoked: stop all; account may be closed",
    "card_declined",
    "do_not_retry",
    true,
  ],
];

/** The Paysafe error tables that share the `error.code` field. */
export type ErrorTableId =
  | "common"
  | "payment"
  | "void"
  | "settlement"
  | "refund"
  | "customer_vault"
  | "alternate_payments"
  | "direct_debit"
  | "payment_handle_3ds";

export type ErrorEntry = {
  meaning: string;
  /** Documented HTTP status ("-" when the table gives none). */
  http: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  tables: ErrorTableId[];
};

export const ERROR_TABLE_TITLES: Readonly<Record<ErrorTableId, string>> = {
  common: "Common errors",
  payment: "Payment and authorization errors",
  void: "Void authorization errors",
  settlement: "Settlement errors",
  refund: "Refund errors",
  customer_vault: "Customer Vault errors",
  alternate_payments: "Alternate payments errors",
  direct_debit: "Direct Debit errors",
  payment_handle_3ds: "Payment handle 3DS failure codes",
};

function errorTable(id: ErrorTableId, rows: readonly ErrorRow[]): Record<string, ErrorEntry> {
  const out: Record<string, ErrorEntry> = {};
  for (const [code, http, meaning, category, retry] of rows) {
    if (Object.prototype.hasOwnProperty.call(out, code))
      throw new Error(`duplicate code ${code} in ${id}`);
    out[code] = { meaning, http, category, retry, tables: [id] };
  }
  return out;
}

/** Each documented error table as published (counts per table). */
export const ERROR_TABLES: Readonly<Record<ErrorTableId, Readonly<Record<string, ErrorEntry>>>> = {
  common: errorTable("common", COMMON_ROWS),
  payment: errorTable("payment", PAYMENT_ROWS),
  void: errorTable("void", VOID_ROWS),
  settlement: errorTable("settlement", SETTLEMENT_ROWS),
  refund: errorTable("refund", REFUND_ROWS),
  customer_vault: errorTable("customer_vault", VAULT_ROWS),
  alternate_payments: errorTable("alternate_payments", APM_ROWS),
  direct_debit: errorTable("direct_debit", DIRECT_DEBIT_ROWS),
  payment_handle_3ds: errorTable("payment_handle_3ds", HANDLE_3DS_ROWS),
};

/**
 * All `error.code` values. A code listed in several tables (4002 is in the
 * payment and Direct Debit tables with the same meaning) keeps the first
 * row and records every table it appears in.
 */
export const ERROR_CODES: Readonly<Record<string, ErrorEntry>> = (() => {
  const out: Record<string, ErrorEntry> = {};
  for (const table of Object.values(ERROR_TABLES)) {
    for (const [code, entry] of Object.entries(table)) {
      const prev = out[code];
      if (prev) prev.tables = [...prev.tables, ...entry.tables];
      else out[code] = { ...entry, tables: [...entry.tables] };
    }
  }
  return out;
})();

/**
 * Notes for codes whose meaning differs between Paysafe pages. They are
 * shown with the decoded error so that the reader can judge which applies.
 */
export const ERROR_CODE_NOTES: Readonly<Record<string, string>> = {
  "3060":
    "The card errors page uses 3060 for Strong Customer Authentication required (UK/EU acquiring); the Interchecks payout mapping uses the same code for an unsolicited reversal.",
  "3703":
    "The card errors page uses 3703 for an invalid amount; the Interchecks payout mapping uses it for an invalid format.",
  "3010": "Code 3010 appears only as a mapping target in the Interchecks issuer table.",
  "5272": "The OpenAPI file lists 5272 with HTTP 406; the card errors page lists it with HTTP 415.",
  "5107":
    "The card errors page and a webhook example word this risk rule differently (threeDResult R).",
};

export type AdviceEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

/** Merchant advice codes (`error.additionalDetails[]` with `type` ADVICE). */
export const ADVICE_CODES: Readonly<Record<string, AdviceEntry>> = Object.fromEntries(
  ADVICE_ROWS.map(([code, , meaning, category, retry]) => [code, { meaning, category, retry }]),
);

export type ResponseCodeEntry = {
  meaning: string;
  /** The table lists the code as an approval, not a decline. */
  approval: boolean;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Visa Stop Payment Service code with Paysafe's own rebill advice. */
  vsps?: boolean;
};

function codeTable(rows: readonly (CodeRow | ProcessorRow)[]): Record<string, ResponseCodeEntry> {
  const out: Record<string, ResponseCodeEntry> = {};
  for (const [code, meaning, category, retry, vsps] of rows) {
    if (Object.prototype.hasOwnProperty.call(out, code)) throw new Error(`duplicate code ${code}`);
    out[code] = {
      meaning,
      approval: category === null,
      category: category ?? "unknown",
      retry: retry ?? "unknown",
      ...(vsps ? { vsps: true } : {}),
    };
  }
  return out;
}

/** ISO response codes (`error.additionalDetails[]` with `type` ISO_RESPONSE). */
export const ISO_RESPONSE_CODES: Readonly<Record<string, ResponseCodeEntry>> = codeTable(ISO_ROWS);

export type ProcessorTableId = "OPN/NAG" | "MON" | "TAS/VPS" | "FRD" | "VAN";

/**
 * Raw processor response tables, by the processor names the OpenAPI file
 * uses. The file does not say which payload field carries them; reading them
 * from `gatewayResponse.responseCode` is an inference (section 4 of the
 * research file), so decodes based on them are never stronger than possible.
 * Rows "H1-H9" and "P0-P6" are ranges listed as one row each.
 */
export const PROCESSOR_TABLES: Readonly<
  Record<ProcessorTableId, Readonly<Record<string, ResponseCodeEntry>>>
> = {
  "OPN/NAG": codeTable(OPN_NAG_ROWS),
  MON: codeTable(MON_ROWS),
  "TAS/VPS": codeTable(TAS_VPS_ROWS),
  FRD: codeTable(FRD_ROWS),
  VAN: codeTable(VAN_ROWS),
};

/**
 * `gatewayResponse.code` (the "acquirer identification code") to processor
 * table. Only the processor names that head a table are mapped; the one
 * documented example (`VPS` with responseCode 00 "Approved and completed")
 * matches the TAS/VPS table. GPS and other values have no table.
 */
export const PROCESSOR_TABLE_BY_GATEWAY_CODE: Readonly<Record<string, ProcessorTableId>> = {
  OPN: "OPN/NAG",
  NAG: "OPN/NAG",
  MON: "MON",
  TAS: "TAS/VPS",
  VPS: "TAS/VPS",
  FRD: "FRD",
  VAN: "VAN",
};

/** Looks a code up in a processor table, including the "H1-H9" style range rows. */
export function processorEntry(
  table: ProcessorTableId,
  code: string,
): ResponseCodeEntry | undefined {
  const rows = PROCESSOR_TABLES[table];
  if (Object.prototype.hasOwnProperty.call(rows, code)) return rows[code];
  const m = /^([A-Z])(\d)$/.exec(code);
  if (!m) return undefined;
  for (const [key, entry] of Object.entries(rows)) {
    const r = /^([A-Z])(\d)-([A-Z])(\d)$/.exec(key);
    if (
      r &&
      r[1] === m[1] &&
      r[3] === m[1] &&
      Number(m[2]) >= Number(r[2]) &&
      Number(m[2]) <= Number(r[4])
    )
      return entry;
  }
  return undefined;
}

export type InterchecksEntry = {
  meaning: string;
  /** Paysafe HTTP status and code in the "existing" and "new" mapping tables. */
  existingMapping: string;
  newMapping: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

/**
 * Interchecks (instant card payout) error names. The OpenAPI "Add Card"
 * table shows three of them (ERR_CARD_INELIGIBLE, ERR_RETRIEVING_CARD_DETAILS,
 * ERR_CREDIT_CARD_NOT_SUPPORTED) returned as error codes with HTTP 400; for
 * the others the payload field is not documented.
 */
export const INTERCHECKS_CODES: Readonly<Record<string, InterchecksEntry>> = Object.fromEntries(
  INTERCHECKS_ROWS.map(([code, existingMapping, newMapping, meaning, category, retry]) => [
    code,
    { meaning, existingMapping, newMapping, category, retry },
  ]),
);

/** The Interchecks names that the OpenAPI "Add Card" table returns as error codes. */
export const INTERCHECKS_ADD_CARD_CODES: ReadonlySet<string> = new Set([
  "ERR_CARD_INELIGIBLE",
  "ERR_RETRIEVING_CARD_DETAILS",
  "ERR_CREDIT_CARD_NOT_SUPPORTED",
]);

// ---------------------------------------------------------------------------
// Resources, statuses and webhook events
// ---------------------------------------------------------------------------

export type ResourceKind =
  | "payment_handle"
  | "payment"
  | "settlement"
  | "refund"
  | "void_auth"
  | "standalone_credit"
  | "original_credit"
  | "verification";

export type StatusInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  /** Where the value comes from when it is not in the OpenAPI enum. */
  source?: string;
};

const s = (
  stage: LifecycleStage,
  outcome: Outcome,
  meaning: string,
  source?: string,
): StatusInfo => (source ? { stage, outcome, meaning, source } : { stage, outcome, meaning });

/**
 * Documented `status` values per resource. Authorization is not settlement:
 * a payment authorized with settleWithAuth false is shown as an
 * authorization, and a settlement COMPLETED means Paysafe completed the
 * settlement batch, not that funds reached the merchant (not documented).
 * A CANCELLED payment, settlement, refund or void did not take effect.
 */
export const RESOURCE_STATUSES: Readonly<
  Record<ResourceKind, Readonly<Record<string, StatusInfo>>>
> = {
  payment_handle: {
    INITIATED: s("authentication", "pending", "Handle created; customer redirect pending"),
    PAYABLE: s(
      "authentication",
      "pending",
      "Handle ready for a payment (after authentication or redirect); no payment yet",
    ),
    PROCESSING: s("authentication", "pending", "Customer authorized; waiting for the PSP"),
    COMPLETED: s(
      "authentication",
      "unknown",
      "Handle used in a payment; Paysafe sets COMPLETED whatever the payment outcome",
    ),
    FAILED: s(
      "authentication",
      "failure",
      "Handle failed (for example the customer did not authorize)",
    ),
    EXPIRED: s("authentication", "failure", "Handle not used within its time to live"),
    CANCELLED: s("authentication", "failure", "Handle cancelled", "get-started page"),
    ERROR: s(
      "authentication",
      "failure",
      "Handle could not be created",
      "get-started and webhook pages",
    ),
  },
  payment: {
    RECEIVED: s("payment", "pending", "Payment request received"),
    PROCESSING: s("payment", "pending", "Payment in progress"),
    PENDING: s("payment", "pending", "Payment pending"),
    HELD: s("payment", "pending", "Payment held (risk hold)"),
    COMPLETED: s("payment", "success", "Payment completed"),
    FAILED: s("payment", "failure", "Payment failed"),
    CANCELLED: s("cancellation", "failure", "Payment cancelled (fully voided)"),
  },
  settlement: {
    RECEIVED: s("capture", "pending", "Settlement request received"),
    INITIATED: s("capture", "pending", "Settlement initiated"),
    PENDING: s("capture", "pending", "Settlement received but not batched yet"),
    PROCESSING: s("capture", "pending", "Settlement batch started", "card payments page"),
    COMPLETED: s("capture", "success", "Settlement completed"),
    FAILED: s("capture", "failure", "Settlement failed"),
    EXPIRED: s("capture", "failure", "Settlement expired"),
    ERROR: s("capture", "failure", "Settlement error", "SETTLEMENT_ERRORED event"),
    CANCELLED: s("cancellation", "failure", "Settlement cancelled before the batch"),
  },
  refund: {
    RECEIVED: s("refund", "pending", "Refund request received"),
    INITIATED: s("refund", "pending", "Refund initiated"),
    PENDING: s("refund", "pending", "Refund pending"),
    PROCESSING: s("refund", "pending", "Refund in progress", "REFUND_PROCESSING event"),
    COMPLETED: s("refund", "success", "Refund completed"),
    FAILED: s("refund", "failure", "Refund failed"),
    EXPIRED: s("refund", "failure", "Refund expired"),
    ERROR: s("refund", "failure", "Refund error", "webhook examples"),
    CANCELLED: s("cancellation", "failure", "Refund cancelled while pending"),
  },
  void_auth: {
    RECEIVED: s("void", "pending", "Void request received"),
    PENDING: s("void", "pending", "Void pending"),
    HELD: s("void", "pending", "Void held"),
    COMPLETED: s("void", "success", "Authorization voided"),
    FAILED: s("void", "failure", "Void failed"),
    CANCELLED: s("cancellation", "failure", "Void cancelled"),
  },
  standalone_credit: {
    INITIATED: s("payout", "pending", "Payout initiated"),
    RECEIVED: s("payout", "pending", "Payout request received"),
    PENDING: s("payout", "pending", "Payout pending"),
    PROCESSING: s("payout", "pending", "Payout in progress", "SA_CREDIT_PROCESSING event"),
    HELD: s("payout", "pending", "Payout held", "SA_CREDIT_HELD event"),
    COMPLETED: s(
      "payout",
      "success",
      "Payout completed; a later failure, cancellation or return is still possible",
    ),
    FAILED: s("payout", "failure", "Payout failed"),
    EXPIRED: s("payout", "failure", "Payout expired"),
    ERROR: s("payout", "failure", "Payout error", "webhook examples"),
    CANCELLED: s("cancellation", "failure", "Payout cancelled"),
  },
  original_credit: {
    INITIATED: s("payout", "pending", "Credit initiated"),
    RECEIVED: s("payout", "pending", "Credit request received"),
    PENDING: s("payout", "pending", "Credit pending"),
    PROCESSING: s("payout", "pending", "Credit in progress", "ORIGINAL_CREDIT_PROCESSING event"),
    COMPLETED: s("payout", "success", "Credit completed"),
    FAILED: s("payout", "failure", "Credit failed"),
    EXPIRED: s("payout", "failure", "Credit expired"),
    ERROR: s("payout", "failure", "Credit error", "webhook examples"),
    CANCELLED: s("cancellation", "failure", "Credit cancelled"),
  },
  verification: {
    RECEIVED: s("authorization", "pending", "Verification received"),
    COMPLETED: s("authorization", "success", "Card verification completed"),
    FAILED: s("authorization", "failure", "Verification declined (business decline, HTTP 402)"),
    ERROR: s("authorization", "failure", "Verification error (non-business failure)"),
  },
};

export const RESOURCE_TITLES: Readonly<Record<ResourceKind, string>> = {
  payment_handle: "Payment handle",
  payment: "Payment",
  settlement: "Settlement",
  refund: "Refund",
  void_auth: "Void authorization",
  standalone_credit: "Standalone credit",
  original_credit: "Original credit",
  verification: "Verification",
};

export type EventInfo =
  | { resource: ResourceKind; status: string; source?: string }
  | {
      resource: "registration" | "payment_scheduler";
      stage: LifecycleStage;
      outcome: Outcome;
      recurring?: boolean;
    };

const ev = (resource: ResourceKind, statuses: readonly string[], source?: string) =>
  Object.fromEntries(
    statuses.map((st) => [
      st,
      source ? { resource, status: st, source } : { resource, status: st },
    ]),
  ) as Record<string, EventInfo>;

const prefixed = (
  prefix: string,
  table: Record<string, EventInfo>,
  rename: Record<string, string> = {},
) =>
  Object.fromEntries(
    Object.entries(table).map(([st, info]) => [`${prefix}${rename[st] ?? st}`, info]),
  );

/**
 * Webhook `eventName` values: the union of the Paysafe Checkout "Webhook
 * Events" list and the per-method webhook pages. `*_ERRORED` events report
 * status ERROR.
 */
export const EVENT_NAMES: Readonly<Record<string, EventInfo>> = {
  ...prefixed(
    "PAYMENT_HANDLE_",
    {
      ...ev("payment_handle", ["INITIATED", "PROCESSING", "PAYABLE", "COMPLETED", "FAILED"]),
      ...ev("payment_handle", ["EXPIRED"], "APM and card webhook pages"),
      ...ev("payment_handle", ["ERROR"], "EPS and SafetyPay webhook pages"),
    },
    { ERROR: "ERRORED" },
  ),
  ...prefixed("PAYMENT_", {
    ...ev("payment", ["RECEIVED", "PROCESSING", "COMPLETED", "HELD", "FAILED", "CANCELLED"]),
    ...ev("payment", ["PENDING"], "APM webhook pages"),
  }),
  ...prefixed(
    "SETTLEMENT_",
    {
      ...ev("settlement", [
        "RECEIVED",
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ]),
      ...ev("settlement", ["ERROR"], "PaysafeCard page"),
    },
    { ERROR: "ERRORED" },
  ),
  ...prefixed(
    "VOIDAUTH_",
    ev("void_auth", ["RECEIVED", "PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
  ),
  ...prefixed(
    "REFUND_",
    {
      ...ev("refund", ["RECEIVED", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]),
      ...ev("refund", ["ERROR"], "EPS webhook page"),
    },
    { ERROR: "ERRORED" },
  ),
  ...prefixed(
    "ORIGINAL_CREDIT_",
    ev("original_credit", ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]),
  ),
  ...prefixed(
    "SA_CREDIT_",
    {
      ...ev("standalone_credit", [
        "RECEIVED",
        "PENDING",
        "PROCESSING",
        "HELD",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ]),
      ...ev("standalone_credit", ["ERROR"], "APM webhook pages"),
    },
    { ERROR: "ERRORED" },
  ),
  REGISTRATION_COMPLETED: { resource: "registration", stage: "other", outcome: "success" },
  REGISTRATION_FAILED: { resource: "registration", stage: "other", outcome: "failure" },
  REGISTRATION_DECLINED: { resource: "registration", stage: "other", outcome: "failure" },
  SCHEDULED_PAYMENT_COMPLETED: {
    resource: "payment_scheduler",
    stage: "payment",
    outcome: "success",
    recurring: true,
  },
  SCHEDULED_PAYMENT_FAILED: {
    resource: "payment_scheduler",
    stage: "payment",
    outcome: "failure",
    recurring: true,
  },
  RETRY_COMPLETED: {
    resource: "payment_scheduler",
    stage: "payment",
    outcome: "success",
    recurring: true,
  },
  RETRY_FAILED: {
    resource: "payment_scheduler",
    stage: "payment",
    outcome: "failure",
    recurring: true,
  },
  SUBSCRIPTION_SUSPENDED: {
    resource: "payment_scheduler",
    stage: "subscription",
    outcome: "unknown",
  },
  SUBSCRIPTION_CANCELLED: {
    resource: "payment_scheduler",
    stage: "cancellation",
    outcome: "success",
  },
  TRIAL_PAYMENT_COMPLETED: { resource: "payment_scheduler", stage: "payment", outcome: "success" },
  TRIAL_PAYMENT_FAILED: { resource: "payment_scheduler", stage: "payment", outcome: "failure" },
};

/**
 * Pay by Bank (US): the payout "initially completed, but a payout return
 * notification was later received from the bank". Shown as a reversal of a
 * completed payout.
 */
export const SA_CREDIT_RETURN_COMPLETED = "SA_CREDIT_RETURN_COMPLETED";

/** Webhook `type` values seen in the documented envelopes, and `links[].rel` values. */
export const WEBHOOK_TYPES: Readonly<Record<string, ResourceKind>> = {
  PAYMENT_HANDLE: "payment_handle",
  PAYMENT: "payment",
  REFUND: "refund",
};
export const LINK_RELS: Readonly<Record<string, ResourceKind>> = {
  payment_handle: "payment_handle",
  payment: "payment",
  refund: "refund",
  standalone_credit: "standalone_credit",
};

/** Documented `statusReason` values (the full list is not documented). */
export const STATUS_REASONS: Readonly<Record<string, string>> = {
  PSP_REJECTED: "The PSP rejected the transaction",
  AUTH_EXPIRED: "The authorization expired",
  AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE:
    "The handle expired before the merchant called /payments; Paysafe makes the /payments call itself",
};

export const AVS_RESPONSES: ReadonlySet<string> = new Set([
  "MATCH",
  "MATCH_ADDRESS_ONLY",
  "MATCH_ZIP_ONLY",
  "NO_MATCH",
  "NOT_PROCESSED",
  "UNKNOWN",
]);
export const CVV_VERIFICATIONS: ReadonlySet<string> = new Set([
  "MATCH",
  "NO_MATCH",
  "NOT_PROCESSED",
  "UNKNOWN",
]);
/** OpenAPI enum Y, A, N, U, E; R on the 3DS page; C in a webhook example. */
export const THREE_D_RESULTS: ReadonlySet<string> = new Set(["Y", "A", "N", "U", "E", "R", "C"]);
export const CARD_TYPES: ReadonlySet<string> = new Set([
  "AM",
  "DI",
  "JC",
  "MC",
  "MD",
  "SO",
  "VI",
  "VD",
  "VE",
]);

// ---------------------------------------------------------------------------
// Guidance texts
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Readonly<Record<RetryGuidance, string>> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer, authenticate, correct their details, or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed. First look up the resource (GET by id, or by merchantRefNum) so that a new request does not duplicate an operation that took effect; Paysafe documents no idempotency header.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry with backoff.",
  manual_review: "Review the transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Readonly<Record<ErrorCategory, string>> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their issuer.",
  authentication_required: "Send the payment again with 3D Secure authentication.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another card.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount and currency against the original transaction and the limits.",
  insufficient_funds:
    "Ask the customer to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the transaction and the risk decision before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable:
    "Look up the transaction (GET by id or merchantRefNum) before sending a new request.",
  network_or_timeout:
    "Look up the transaction (GET by id or merchantRefNum) before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the API key, the merchant account and its configuration, or contact Paysafe support.",
  unknown:
    "Contact Paysafe support with the resource id and the X-INTERNAL-CORRELATION-ID response header.",
};
