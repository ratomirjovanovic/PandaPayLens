/**
 * Nuvei code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/nuvei.md, which cites
 * Nuvei's public documentation, verified 2026-10-25:
 *
 * errCode, gateway, filter and decline reason tables: https://docs.nuvei.com/documentation/integration/response-handling/
 * REST API 1.0 outputs:            https://docs.nuvei.com/documentation/additional-links/api-reference/
 * 3-D Secure reason ids:           https://docs.nuvei.com/documentation/features/3d-secure/3ds-implementations/3ds-responses/
 * Payment DMNs, Merchant Advice:   https://docs.nuvei.com/documentation/integration/webhooks/payment-dmns/
 * Withdrawal DMNs:                 https://docs.nuvei.com/documentation/integration/webhooks/withdrawal-dmns/
 * Control Panel event DMNs:        https://docs.nuvei.com/documentation/integration/webhooks/control-panel/
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions; where Nuvei gives advice (for example "may succeed later"),
 * it is reflected.
 *
 * The numeric code spaces overlap: errCode 1001 is an invalid request
 * checksum, while gwExtendedErrorCode 1001 is an invalid expiry date. Each
 * table belongs to one field and is never searched with a bare number.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.nuvei.com/documentation";
export const RESPONSE_HANDLING_URL = `${DOCS}/integration/response-handling/`;
export const API_REFERENCE_URL = `${DOCS}/additional-links/api-reference/`;
export const REST_FLOW_URL = `${DOCS}/accept-payment/server-to-server/rest-1-0/`;
export const WEBHOOKS_URL = `${DOCS}/integration/webhooks/`;
export const PAYMENT_DMNS_URL = `${DOCS}/integration/webhooks/payment-dmns/`;
export const WITHDRAWAL_DMNS_URL = `${DOCS}/integration/webhooks/withdrawal-dmns/`;
export const CONTROL_PANEL_DMNS_URL = `${DOCS}/integration/webhooks/control-panel/`;
export const THREE_DS_RESPONSES_URL = `${DOCS}/features/3d-secure/3ds-implementations/3ds-responses/`;
export const AUTH_SETTLE_URL = `${DOCS}/features/financial-operations/auth-and-settle/`;
export const VOID_URL = `${DOCS}/features/financial-operations/void/`;
export const REFUND_URL = `${DOCS}/features/financial-operations/refund/`;
export const PAYOUT_URL = `${DOCS}/features/financial-operations/payout/`;
export const PAYMENT_PAGE_OUTPUT_URL = `${DOCS}/accept-payment/payment-page/output-parameters/`;
export const WITHDRAWAL_GUIDE_URL = `${DOCS}/accept-payment/payment-page/cashier/withdrawal-guide/`;
export const SUBSCRIPTION_URL = `${DOCS}/features/subscription-rebilling/`;
export const FAQ_URL = `${DOCS}/additional-links/faqs/`;
export const APM_INTRO_URL = `${DOCS}/apms-overview/introduction-to-apms/`;
export const SKRILL_GUIDE_URL = `${DOCS}/global-guides/skrill/`;
export const REST_V2_RESPONSE_HANDLING_URL = `${DOCS}/additional-links/rest-2-0/integration/response-handling/`;
export const JAVA_SDK_URL = "https://github.com/Nuvei/nuvei-server-java";

export type CodeEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  note?: string;
};

const e = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  note?: string,
): CodeEntry => (note ? { meaning, category, retry, note } : { meaning, category, retry });

const WALLET_NOTE = "Nuvei marks this code as relevant for Apple Pay and Google Pay.";

/**
 * `errCode` / `reason` request-side errors (175), returned with
 * `status=ERROR`. `errCode=0` means no request error.
 */
export const REQUEST_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  "1000": e("Unspecified general error on the request side", "unknown", "manual_review"),
  "1001": e("Request checksum did not validate", "configuration", "do_not_retry"),
  "1004": e("Card data block missing or invalid", "invalid_request", "customer_action_required"),
  "1007": e("Name on card is invalid", "invalid_request", "customer_action_required"),
  "1010": e("User token is invalid", "invalid_request", "do_not_retry"),
  "1011": e(
    "Stored payment option (UPO) data missing or invalid",
    "invalid_request",
    "do_not_retry",
  ),
  "1013": e("Merchant ID is invalid", "configuration", "do_not_retry"),
  "1014": e(
    "Country code is invalid (message may carry a prefix placeholder)",
    "invalid_request",
    "do_not_retry",
  ),
  "1019": e("Generic validation failure", "invalid_request", "do_not_retry"),
  "1021": e("Timestamp is invalid", "invalid_request", "do_not_retry"),
  "1022": e("Merchant site ID is invalid", "configuration", "do_not_retry"),
  "1023": e(
    "Stored payment option is not enabled",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1024": e("Per-user limit of stored payment options reached", "invalid_request", "do_not_retry"),
  "1028": e("Card issuer is invalid", "invalid_request", "customer_action_required"),
  "1029": e("Expiry date is invalid", "invalid_request", "customer_action_required"),
  "1038": e("Communication error", "network_or_timeout", "retry_conditionally"),
  "1040": e("Amount missing or invalid", "invalid_amount", "do_not_retry"),
  "1041": e("Amount currency missing or invalid", "invalid_request", "do_not_retry"),
  "1055": e(
    "Validation of a single stored payment option failed",
    "invalid_request",
    "do_not_retry",
  ),
  "1056": e("User management is switched off for the account", "configuration", "do_not_retry"),
  "1057": e("Order ID is invalid", "invalid_request", "do_not_retry"),
  "1058": e("The operation is not allowed on this order", "invalid_request", "do_not_retry"),
  "1059": e("Payment data is ambiguous", "invalid_request", "do_not_retry"),
  "1060": e("Payment data missing or invalid", "invalid_request", "do_not_retry"),
  "1061": e("Card token is invalid", "invalid_request", "do_not_retry"),
  "1062": e("CVV is invalid", "invalid_request", "customer_action_required"),
  "1063": e("Total amount differs from the sum of item amounts", "invalid_amount", "do_not_retry"),
  "1064": e(
    "Session token invalid; one order per session token",
    "invalid_request",
    "safe_to_retry_technical_request",
  ),
  "1065": e("Token is invalid", "invalid_request", "do_not_retry"),
  "1066": e("Request is invalid", "invalid_request", "do_not_retry"),
  "1067": e("Transaction type missing or invalid", "invalid_request", "do_not_retry"),
  "1068": e("Payment method not enabled for the merchant", "configuration", "do_not_retry"),
  "1069": e("Session has expired", "invalid_request", "safe_to_retry_technical_request"),
  "1070": e(
    "Currency not supported by the merchant payment option settings",
    "configuration",
    "do_not_retry",
  ),
  "1071": e(
    "3DS payment amount differs from the Auth3D order amount",
    "invalid_amount",
    "do_not_retry",
  ),
  "1072": e("PA (3DS) response missing or invalid", "authentication_failed", "retry_conditionally"),
  "1073": e(
    "3DS payment currency differs from the Auth3D order currency",
    "invalid_request",
    "do_not_retry",
  ),
  "1074": e(
    "Stored payment option has expired",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1075": e("Language code is invalid", "invalid_request", "do_not_retry"),
  "1076": e("Payment method not supported", "payment_method_unavailable", "do_not_retry"),
  "1077": e("API rebilling disabled for the account", "configuration", "do_not_retry"),
  "1078": e(
    "Configuration for the stored payment option is missing",
    "configuration",
    "do_not_retry",
  ),
  "1079": e("Rebilling requires a stored payment option", "invalid_request", "do_not_retry"),
  "1080": e("Calling this method is forbidden", "configuration", "do_not_retry"),
  "1081": e("Source IP address is blocked", "configuration", "do_not_retry"),
  "1082": e("relatedTransactionId value is invalid", "invalid_request", "do_not_retry"),
  "1083": e("Date of birth in ekycUserDetails is invalid", "invalid_request", "do_not_retry"),
  "1084": e("Date of birth in UserDetails is invalid", "invalid_request", "do_not_retry"),
  "1085": e("isPartialApproval must be empty, 0 or 1", "invalid_request", "do_not_retry"),
  "1086": e("Sending a cardData block is not permitted", "configuration", "do_not_retry"),
  "1087": e("Request rejected as containing XSS content", "invalid_request", "do_not_retry"),
  "1088": e(
    "clientRequestId missing or invalid where uniqueness checking is on",
    "invalid_request",
    "do_not_retry",
  ),
  "1089": e(
    "Another transaction already used this clientRequestId",
    "duplicate_request",
    "do_not_retry",
  ),
  "1090": e(
    "Stored payment option status is not ENABLED, SUSPENDED or FROZEN",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1091": e(
    "Transaction belongs to another merchant or merchant site",
    "invalid_request",
    "do_not_retry",
  ),
  "1092": e(
    "Transaction does not support the requested operation",
    "invalid_request",
    "do_not_retry",
  ),
  "1093": e("Message text missing", "invalid_request", "do_not_retry"),
  "1094": e("Message locale invalid", "invalid_request", "do_not_retry"),
  "1095": e("Results range invalid", "invalid_request", "do_not_retry"),
  "1096": e("Status unknown", "unknown", "manual_review"),
  "1097": e(
    "An account info field has an invalid value (field name in placeholder)",
    "invalid_request",
    "do_not_retry",
  ),
  "1098": e(
    "An account info field is missing (field name in placeholder)",
    "invalid_request",
    "do_not_retry",
  ),
  "1099": e("Payment method is already registered", "duplicate_request", "do_not_retry"),
  "1101": e(
    "State is invalid (message may carry a prefix placeholder)",
    "invalid_request",
    "do_not_retry",
  ),
  "1102": e("Product descriptor does not exist", "configuration", "do_not_retry"),
  "1103": e("Subscription plan ID is invalid", "invalid_request", "do_not_retry"),
  "1104": e("Temporary card token not allowed for this method", "invalid_request", "do_not_retry"),
  "1105": e(
    "UserDetails requires first name, last name, email, address, zip and country",
    "invalid_request",
    "do_not_retry",
  ),
  "1107": e("methodCode is invalid", "invalid_request", "do_not_retry"),
  "1108": e("Casino value is invalid", "invalid_request", "do_not_retry"),
  "1109": e("Email is invalid", "invalid_request", "customer_action_required"),
  "1110": e("Locale code is invalid", "invalid_request", "do_not_retry"),
  "1111": e(
    "External error returned by IMS (IMS message in placeholder)",
    "provider_unavailable",
    "manual_review",
  ),
  "1112": e("Registration failed", "unknown", "manual_review"),
  "1113": e(
    "State does not belong to the country (prefix placeholder)",
    "invalid_request",
    "do_not_retry",
  ),
  "1114": e("Verification status invalid", "invalid_request", "do_not_retry"),
  "1115": e("Verification method invalid", "invalid_request", "do_not_retry"),
  "1116": e("IMS could not find payment account details", "invalid_request", "manual_review"),
  "1117": e("dynamic3DMode must be off or on", "invalid_request", "do_not_retry"),
  "1118": e("isDynamic3D must be 0 or 1", "invalid_request", "do_not_retry"),
  "1120": e("identificationType in ekycUserDetails invalid", "invalid_request", "do_not_retry"),
  "1121": e("Merchant is not verified", "configuration", "do_not_retry"),
  "1122": e("Merchant site is disabled", "configuration", "do_not_retry"),
  "1123": e("Item count invalid for an open-amount order", "invalid_request", "do_not_retry"),
  "1124": e("Merchant site not configured for Managed3D", "configuration", "do_not_retry"),
  "1125": e(
    "Stored payment method not supported by this method",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1126": e(
    "Rebilling requires isDynamic3D=1 and dynamic3DMode OFF",
    "invalid_request",
    "do_not_retry",
  ),
  "1127": e(
    "External MPI requires isDynamic3D=1 and dynamic3DMode OFF",
    "invalid_request",
    "do_not_retry",
  ),
  "1128": e("Type value invalid (placeholder)", "invalid_request", "do_not_retry"),
  "1129": e("KYC document upload is disabled", "configuration", "do_not_retry"),
  "1130": e("Country could not be derived from the request", "invalid_request", "do_not_retry"),
  "1131": e("originUrl is not valid (placeholder)", "invalid_request", "do_not_retry"),
  "1132": e("Transaction was already settled automatically", "duplicate_request", "do_not_retry"),
  "1140": e("No payment was made in this session", "invalid_request", "do_not_retry"),
  "2006": e("Currency conversion not supported", "configuration", "do_not_retry"),
  "9064": e("3D authentication failed", "authentication_failed", "customer_action_required"),
  "9065": e(
    "Currency not supported by the payment method",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "9066": e("Exchange rate unavailable", "provider_unavailable", "retry_conditionally"),
  "9067": e("Wrong payment method", "invalid_request", "do_not_retry"),
  "9068": e("Wrong DCC currency", "invalid_request", "do_not_retry"),
  "9069": e("Wrong converted amount", "invalid_amount", "do_not_retry"),
  "9070": e("Wrong original currency", "invalid_request", "do_not_retry"),
  "9071": e("Wrong original amount", "invalid_amount", "do_not_retry"),
  "9072": e("Payment still in progress", "unknown", "retry_conditionally"),
  "9073": e("Country and currency missing or invalid", "invalid_request", "do_not_retry"),
  "9074": e(
    "Card company in externalSchemeDetails invalid or unsupported",
    "invalid_request",
    "do_not_retry",
  ),
  "9075": e(
    "3DS authentication failed and payment is not allowed",
    "authentication_failed",
    "do_not_retry",
  ),
  "9076": e("3DS authentication failed", "authentication_failed", "customer_action_required"),
  "9077": e("Card registration failed", "unknown", "manual_review"),
  "9078": e(
    "Account verification not enabled for the merchant site",
    "configuration",
    "do_not_retry",
  ),
  "9079": e(
    "Account verification not configured for this payment option and country",
    "configuration",
    "do_not_retry",
  ),
  "9080": e(
    "Stored payment option status not ENABLED, SUSPENDED or DISABLED",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "9081": e("Currency conversion type invalid", "invalid_request", "do_not_retry"),
  "9082": e("Payment option accepts one passenger record only", "invalid_request", "do_not_retry"),
  "9083": e("clientRequestId missing or invalid", "invalid_request", "do_not_retry"),
  "9084": e("clientRequestId does not belong to a payout", "invalid_request", "do_not_retry"),
  "9085": e("Payment option is not a card", "invalid_request", "do_not_retry"),
  "9086": e("Open amount feature not enabled", "configuration", "do_not_retry"),
  "9087": e("Open amount and MCP conversion cannot be combined", "invalid_request", "do_not_retry"),
  "9088": e(
    "Order amount outside the allowed range (placeholders)",
    "invalid_amount",
    "do_not_retry",
  ),
  "9089": e("Open amount not supported for this order", "invalid_request", "do_not_retry"),
  "9090": e(
    "Open amount cannot be combined with amount details or items",
    "invalid_request",
    "do_not_retry",
  ),
  "9091": e("Balance could not be retrieved", "provider_unavailable", "retry_conditionally"),
  "9092": e("User account operation failed", "unknown", "manual_review"),
  "9093": e("Account not found", "invalid_request", "do_not_retry"),
  "9094": e("Account already registered", "duplicate_request", "do_not_retry"),
  "9095": e("Adding the bank account failed", "unknown", "manual_review"),
  "9096": e("User account cannot be funded now", "provider_unavailable", "retry_conditionally"),
  "9097": e("Document type not supported", "invalid_request", "do_not_retry"),
  "9098": e("enrollmentAction type not supported", "invalid_request", "do_not_retry"),
  "9099": e("Enrollment type not supported", "invalid_request", "do_not_retry"),
  "9100": e("Payout still in progress", "unknown", "retry_conditionally"),
  "9101": e(
    "Apple Pay transactions require 3D authentication",
    "authentication_required",
    "customer_action_required",
  ),
  "9102": e("totalSettleCount invalid", "invalid_request", "do_not_retry"),
  "9105": e("paymentFlow not supported", "invalid_request", "do_not_retry"),
  "9106": e(
    "Payment method not supported in the chosen payment flow",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "9107": e("redirectFlowUITheme invalid", "invalid_request", "do_not_retry"),
  "9118": e(
    "A transaction cannot be both MOTO and card present",
    "invalid_request",
    "do_not_retry",
  ),
  "9123": e(
    "Recipient's stored payment option not enabled",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "9124": e(
    "Problem with the supplied debit card number",
    "invalid_request",
    "customer_action_required",
  ),
  "9125": e("Stored payment option not found or invalid", "invalid_request", "do_not_retry"),
  "9126": e("Beneficiary type cannot be changed", "invalid_request", "do_not_retry"),
  "9127": e(
    "This stored payment option cannot be edited; add a new one",
    "invalid_request",
    "customer_action_required",
  ),
  "9128": e("3DS v2 data must be supplied", "authentication_required", "do_not_retry"),
  "9129": e(
    "Transaction aborted for technical reasons",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "9130": e(
    "Too many declines or errors; a new session is needed",
    "rate_limiting",
    "customer_action_required",
  ),
  "9131": e(
    "Last four digits missing or invalid (Apple Pay / Google Pay)",
    "invalid_request",
    "do_not_retry",
    WALLET_NOTE,
  ),
  "9132": e("MCP rates not configured for the account", "configuration", "do_not_retry"),
  "9133": e(
    "Card brand missing or invalid (Apple Pay / Google Pay)",
    "invalid_request",
    "do_not_retry",
    WALLET_NOTE,
  ),
  "9134": e(
    "Conversion rates temporarily unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "9135": e("Dispute site unavailable", "provider_unavailable", "retry_conditionally"),
  "9136": e("correlationId missing", "invalid_request", "do_not_retry"),
  "9137": e("alertReceivedDate missing", "invalid_request", "do_not_retry"),
  "9138": e("decisionDescription missing", "invalid_request", "do_not_retry"),
  "9139": e("refundIndicator missing", "invalid_request", "do_not_retry"),
  "9140": e(
    "relatedClientUniqueId invalid or its transaction not found",
    "invalid_request",
    "do_not_retry",
  ),
  "9141": e("relatedClientUniqueId is not unique", "invalid_request", "do_not_retry"),
  "9142": e(
    "Both relatedClientUniqueId and a payment option were sent",
    "invalid_request",
    "do_not_retry",
  ),
  "9143": e(
    "relatedTransactionId and relatedClientUniqueId do not match",
    "invalid_request",
    "do_not_retry",
  ),
  "9144": e(
    "Withdrawal configuration not defined for the merchant site",
    "configuration",
    "do_not_retry",
  ),
  "9145": e("transactionId and clientUniqueId do not match", "invalid_request", "do_not_retry"),
  "9146": e("No transaction details found for the ID", "invalid_request", "do_not_retry"),
  "9147": e("transactionId or clientUniqueId is required", "invalid_request", "do_not_retry"),
  "9148": e("Google Pay terms and conditions not accepted", "configuration", "do_not_retry"),
  "9149": e("domainNames missing or invalid", "invalid_request", "do_not_retry"),
  "9150": e("Domain name longer than 255 characters", "invalid_request", "do_not_retry"),
  "9151": e("Disabled domains cannot be changed", "invalid_request", "do_not_retry"),
  "9152": e("Domain not enabled", "configuration", "do_not_retry"),
  "9155": e("Request not found", "invalid_request", "do_not_retry"),
  "9156": e("Transaction request failed", "unknown", "manual_review"),
  "9158": e(
    "Card registration refused: card issued outside the EU/EEA",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "9193": e("Mandatory attribute missing in Initial3DSData", "invalid_request", "do_not_retry"),
  "9194": e("Initial3DSData rebilling condition not met", "invalid_request", "do_not_retry"),
  "9195": e("threeDSReqPriorAuthTimestamp must be YYYYMMDDHHMM", "invalid_request", "do_not_retry"),
  "9197": e("rebillExpiry must be YYYYMMDD", "invalid_request", "do_not_retry"),
};

/** Marketplace `errCode` values (12), from the same Response Handling page. */
export const MARKETPLACE_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  "9108": e("Seller information missing", "invalid_request", "do_not_retry"),
  "9109": e("Seller not active (seller number in placeholder)", "configuration", "do_not_retry"),
  "9110": e("Settlement amount above the allowed amount", "invalid_amount", "do_not_retry"),
  "9111": e("Refund amount above the allowed amount", "invalid_amount", "do_not_retry"),
  "9112": e(
    "Retailer amounts do not add up to the transaction total",
    "invalid_amount",
    "do_not_retry",
  ),
  "9113": e("Valid split-cart information is required", "invalid_request", "do_not_retry"),
  "9114": e(
    "Split-cart data sent but seller is not a marketplace",
    "configuration",
    "do_not_retry",
  ),
  "9115": e(
    "Split-cart parts reuse transaction identifiers; contact support",
    "invalid_request",
    "manual_review",
  ),
  "9116": e("Seller belongs to a different merchantSiteId", "configuration", "do_not_retry"),
  "9117": e(
    "Split-cart transaction amount is zero; contact support",
    "invalid_amount",
    "manual_review",
  ),
  "9121": e("Marketplace sellerInfo block missing or invalid", "invalid_request", "do_not_retry"),
  "9122": e("Marketplace clientInfo block missing or invalid", "invalid_request", "do_not_retry"),
};

/**
 * `errCode` values that only the official Java SDK names (constant names in
 * `Constants.java`, without documented messages). They are hints and are
 * decoded with possible confidence at most.
 */
export const SDK_ERROR_CODE_NAMES: Readonly<Record<string, CodeEntry>> = {
  "1002": e("Merchant does not exist", "configuration", "do_not_retry"),
  "1003": e("Merchant site does not exist", "configuration", "do_not_retry"),
  "1005": e("Invalid expiry month", "invalid_request", "customer_action_required"),
  "1006": e("Invalid expiry year", "invalid_request", "customer_action_required"),
  "1008": e("Expired card", "card_declined", "customer_action_required"),
  "1009": e(
    "Stored payment option (UPO) suspended",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1012": e("Invalid client request ID", "invalid_request", "do_not_retry"),
  "1015": e("Invalid locale", "invalid_request", "do_not_retry"),
  "1016": e("Invalid phone", "invalid_request", "customer_action_required"),
  "1017": e("Invalid merchant or merchant site", "configuration", "do_not_retry"),
  "1018": e("Invalid card BIN", "invalid_request", "customer_action_required"),
  "1020": e("Invalid payment method", "invalid_request", "do_not_retry"),
  "1025": e("Invalid last 4 digits", "invalid_request", "do_not_retry"),
  "1026": e("Invalid unique CC", "invalid_request", "do_not_retry"),
  "1027": e("Invalid issuer name", "invalid_request", "do_not_retry"),
  "1030": e("Error suspending a stored payment option", "unknown", "manual_review"),
  "1031": e("Error enabling a stored payment option", "unknown", "manual_review"),
  "1032": e("Invalid start index", "invalid_request", "do_not_retry"),
  "1033": e("Invalid end index", "invalid_request", "do_not_retry"),
  "1034": e("Invalid configuration", "configuration", "do_not_retry"),
  "1035": e("Pending withdrawal orders or a net deposit exist", "unknown", "manual_review"),
  "1036": e("Pending withdrawal orders or a net deposit exist", "unknown", "manual_review"),
  "1037": e("Pending withdrawal orders or a net deposit exist", "unknown", "manual_review"),
  "1039": e("Invalid subscription ID", "invalid_request", "do_not_retry"),
  "1042": e("Invalid rebilling payment type", "invalid_request", "do_not_retry"),
  "1043": e("Invalid rebilling sequence", "invalid_request", "do_not_retry"),
  "1044": e("Invalid subscription status", "invalid_request", "do_not_retry"),
  "1045": e("Invalid active transaction ID", "invalid_request", "do_not_retry"),
  "1046": e("Error creating a stored payment option in risk-only mode", "unknown", "manual_review"),
};

/** One row of the gateway response table (`gwErrorCode` / `gwExtendedErrorCode`). */
export type GatewayRow = CodeEntry & {
  gwErrorCode: string;
  gwExtendedErrorCode: string;
  /** `transactionStatus` (REST) or `result` (Web SDK) the row maps to. */
  status: "APPROVED" | "DECLINED" | "PENDING" | "ERROR";
};

const row = (
  gwErrorCode: string,
  gwExtendedErrorCode: string,
  status: GatewayRow["status"],
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
): GatewayRow => ({ gwErrorCode, gwExtendedErrorCode, status, meaning, category, retry });

/**
 * Gateway response codes (9 rows). APPROVED and PENDING share the pair 0/0,
 * so only the status field can tell them apart.
 */
export const GATEWAY_RESPONSE_ROWS: readonly GatewayRow[] = [
  row("0", "0", "APPROVED", "Approved", "unknown", "unknown"),
  row(
    "-1",
    "0",
    "DECLINED",
    "Declined; the reason is in gwErrorReason",
    "card_declined",
    "customer_action_required",
  ),
  row("0", "0", "PENDING", "Pending (same code pair as approved)", "unknown", "unknown"),
  row(
    "-1100",
    "greater than 0",
    "ERROR",
    "Filter error; the specific code is in gwExtendedErrorCode",
    "unknown",
    "manual_review",
  ),
  row("less than 0", "not 0", "ERROR", "Gateway or bank error", "unknown", "manual_review"),
  row(
    "-1001",
    "0",
    "ERROR",
    "Invalid login (Nuvei FAQ: the account is not active)",
    "configuration",
    "do_not_retry",
  ),
  row(
    "-1005",
    "0",
    "ERROR",
    "IP address out of the allowed range",
    "configuration",
    "do_not_retry",
  ),
  row("-1203", "0", "ERROR", "Timeout; retry", "network_or_timeout", "retry_conditionally"),
  row(
    "-1",
    "-1",
    "ERROR",
    "Unexpected system error; retry later",
    "provider_unavailable",
    "retry_conditionally",
  ),
];

/**
 * Gateway filter error codes (`gwExtendedErrorCode` with `gwErrorCode=-1100`).
 * 230 codes with one meaning; the four codes listed twice are in
 * DUPLICATED_FILTER_CODES.
 */
export const FILTER_ERROR_CODES: Readonly<Record<string, CodeEntry>> = {
  "1001": e("Expiry date invalid", "invalid_request", "customer_action_required"),
  "1002": e("Expiry date too far in the past", "card_declined", "customer_action_required"),
  "1101": e("Card number contains non-digits", "invalid_request", "customer_action_required"),
  "1102": e(
    "Card number has the wrong number of digits",
    "invalid_request",
    "customer_action_required",
  ),
  "1103": e(
    "Card number fails the Luhn (MOD 10) check",
    "invalid_request",
    "customer_action_required",
  ),
  "1104": e("CVV2 invalid", "invalid_request", "customer_action_required"),
  "1105": e(
    "Auth code, transaction ID and card number do not match",
    "invalid_request",
    "do_not_retry",
  ),
  "1106": e(
    "Credit amount exceeds total charges (FAQ: refund/payout above 7-day deposit limit)",
    "invalid_amount",
    "manual_review",
  ),
  "1107": e(
    "Credits not allowed for this card company",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1108": e("Interval between auth and force not allowed", "invalid_request", "do_not_retry"),
  "1109": e(
    "Processing not allowed for this card company",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1110": e(
    "Card company not recognized",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1111": e("Transaction was charged back", "invalid_request", "do_not_retry"),
  "1112": e("Sale or settle already credited", "duplicate_request", "do_not_retry"),
  "1113": e("Terminal not ready for this card company", "configuration", "manual_review"),
  "1114": e("Card number is blacklisted", "fraud_or_risk", "do_not_retry"),
  "1115": e("BIN not allowed", "fraud_or_risk", "customer_action_required"),
  "1116": e("Merchant custom fraud screen filter triggered", "fraud_or_risk", "manual_review"),
  "1118": e("CVV2 reply N cannot count as positive", "card_declined", "customer_action_required"),
  "1119": e(
    "AVS reply B or N cannot count as positive",
    "card_declined",
    "customer_action_required",
  ),
  "1120": e("AVS invalid", "card_declined", "customer_action_required"),
  "1121": e("CVV2 check not allowed on credit, settle or void", "invalid_request", "do_not_retry"),
  "1122": e("AVS check not allowed on credit, settle or void", "invalid_request", "do_not_retry"),
  "1124": e("Total credits exceed a restriction", "invalid_amount", "manual_review"),
  "1125": e("Format error", "invalid_request", "do_not_retry"),
  "1126": e("Credit amount above ceiling", "invalid_amount", "do_not_retry"),
  "1127": e("Amount above limit", "invalid_amount", "do_not_retry"),
  "1128": e("Transaction type code invalid", "invalid_request", "do_not_retry"),
  "1129": e("General filter error", "unknown", "manual_review"),
  "1130": e("Bank-required fields missing or incorrect", "invalid_request", "do_not_retry"),
  "1131": e("Transaction type not allowed for this bank", "configuration", "do_not_retry"),
  "1132": e("Amount above bank limit", "invalid_amount", "do_not_retry"),
  "1133": e("Gateway-required fields missing", "invalid_request", "do_not_retry"),
  "1134": e("AVS processor error", "provider_unavailable", "retry_conditionally"),
  "1135": e("Only one credit per sale allowed", "duplicate_request", "do_not_retry"),
  "1136": e(
    "Mandatory fields missing (FAQ: risk requires country, email, IP, cardholder name)",
    "invalid_request",
    "do_not_retry",
  ),
  "1137": e("Credit count exceeds a restriction", "rate_limiting", "manual_review"),
  "1138": e("Credit type invalid", "invalid_request", "do_not_retry"),
  "1139": e(
    "Card not supported in the CFT program",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1140": e("Card must be processed in the gateway system", "configuration", "do_not_retry"),
  "1141": e("Transaction type not allowed", "configuration", "do_not_retry"),
  "1142": e("AVS fields missing or incorrect", "invalid_request", "customer_action_required"),
  "1143": e("Country does not match ISO code", "invalid_request", "do_not_retry"),
  "1144": e("UserID required in a rebill transaction", "invalid_request", "do_not_retry"),
  "1145": e(
    "Rebill profile does not support this transaction type",
    "configuration",
    "do_not_retry",
  ),
  "1146": e("Void not allowed by restriction", "invalid_request", "do_not_retry"),
  "1147": e("Account number invalid", "invalid_request", "customer_action_required"),
  "1148": e("Cheque number invalid", "invalid_request", "customer_action_required"),
  "1149": e("Account number and transaction ID do not match", "invalid_request", "do_not_retry"),
  "1150": e(
    "UserID, transaction type and transaction ID do not match",
    "invalid_request",
    "do_not_retry",
  ),
  "1151": e("Transaction not found in the rebill system", "invalid_request", "do_not_retry"),
  "1152": e("Transaction already cancelled", "duplicate_request", "do_not_retry"),
  "1153": e(
    "Bank code has the wrong number of digits",
    "invalid_request",
    "customer_action_required",
  ),
  "1154": e(
    "Bank code contains non-alphanumeric data",
    "invalid_request",
    "customer_action_required",
  ),
  "1155": e("Related 3D transaction missing or incorrect", "invalid_request", "do_not_retry"),
  "1156": e(
    "Debit card fields missing or incorrect",
    "invalid_request",
    "customer_action_required",
  ),
  "1157": e("No update parameters supplied", "invalid_request", "do_not_retry"),
  "1161": e("Bank accepts only 3-digit CVV2", "invalid_request", "customer_action_required"),
  "1162": e("Age verification failed", "fraud_or_risk", "do_not_retry"),
  "1163": e("Card, token or account is required", "invalid_request", "do_not_retry"),
  "1164": e("Token invalid", "invalid_request", "do_not_retry"),
  "1165": e("Token mismatch", "invalid_request", "do_not_retry"),
  "1166": e("Email address invalid", "invalid_request", "customer_action_required"),
  "1168": e("Transaction already voided", "duplicate_request", "do_not_retry"),
  "1169": e("sg_ResponseFormat invalid", "invalid_request", "do_not_retry"),
  "1170": e("Version field missing or incorrect", "invalid_request", "do_not_retry"),
  "1171": e("Issuing country invalid", "invalid_request", "do_not_retry"),
  "1172": e("Phone missing or badly formatted", "invalid_request", "customer_action_required"),
  "1173": e("Check number missing or incorrect", "invalid_request", "customer_action_required"),
  "1174": e("Birth date badly formatted", "invalid_request", "customer_action_required"),
  "1175": e("Zip code badly formatted", "invalid_request", "customer_action_required"),
  "1176": e("An auth transaction cannot be voided", "invalid_request", "do_not_retry"),
  "1177": e("A credit transaction cannot be voided", "invalid_request", "do_not_retry"),
  "1178": e("A void cannot be voided", "invalid_request", "do_not_retry"),
  "1179": e("This void cannot be performed", "invalid_request", "do_not_retry"),
  "1180": e("Start date invalid", "invalid_request", "do_not_retry"),
  "1181": e("Merchant name longer than 25 characters", "configuration", "do_not_retry"),
  "1182": e(
    "Transaction must be sent as 3D Secure",
    "authentication_required",
    "customer_action_required",
  ),
  "1183": e("Account not enabled for 3D", "configuration", "do_not_retry"),
  "1184": e("Transaction 3D status incorrect", "authentication_failed", "do_not_retry"),
  "1185": e(
    "Related transaction must be an approved Auth3D of the same 3DS version and merchant",
    "invalid_request",
    "do_not_retry",
  ),
  "1186": e(
    "Related transaction must be 3D authenticated",
    "authentication_required",
    "do_not_retry",
  ),
  "1187": e(
    "Country not supported in the CFT program",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1188": e("Token ID invalid", "invalid_request", "do_not_retry"),
  "1190": e("Risk processor error", "provider_unavailable", "retry_conditionally"),
  "1191": e("RiskOnly requires version 4.0.0 or later", "invalid_request", "do_not_retry"),
  "1192": e("AGV processor error", "provider_unavailable", "retry_conditionally"),
  "1193": e("AGVOnly requires version 4.0.1 or later", "invalid_request", "do_not_retry"),
  "1194": e("Age verification mismatch", "fraud_or_risk", "do_not_retry"),
  "1195": e("Requested acquirer not recognized", "configuration", "do_not_retry"),
  "1196": e("Sale not yet processed on the acquirer side", "unknown", "retry_conditionally"),
  "1197": e("Input data insufficient", "invalid_request", "do_not_retry"),
  "1198": e("Card details not allowed for this payment method", "invalid_request", "do_not_retry"),
  "1199": e("Envoy payout requires a type 1 credit transaction", "invalid_request", "do_not_retry"),
  "1200": e("Issuing bank country code invalid", "invalid_request", "do_not_retry"),
  "1201": e("Amount invalid", "invalid_amount", "do_not_retry"),
  "1202": e("Currency invalid", "invalid_request", "do_not_retry"),
  "1203": e("IBAN does not match country code", "invalid_request", "customer_action_required"),
  "1204": e("Payment method not supported", "payment_method_unavailable", "do_not_retry"),
  "1205": e("APM risk processor error", "provider_unavailable", "retry_conditionally"),
  "1206": e("Settle amount exceeds total charges", "invalid_amount", "do_not_retry"),
  "1207": e("This credit cannot be performed", "invalid_request", "do_not_retry"),
  "1208": e("Converted transaction must use other interfaces", "invalid_request", "do_not_retry"),
  "1209": e("Partial approval not allowed for the client", "configuration", "do_not_retry"),
  "1210": e("NameOnCard missing", "invalid_request", "customer_action_required"),
  "1211": e("Reserved", "unknown", "unknown"),
  "1212": e("Reserved", "unknown", "unknown"),
  "1213": e("Reserved", "unknown", "unknown"),
  "1214": e("FinalizationURL invalid", "invalid_request", "do_not_retry"),
  "1215": e("Reserved", "unknown", "unknown"),
  "1216": e("Reserved", "unknown", "unknown"),
  "1220": e("Token expired", "payment_method_unavailable", "customer_action_required"),
  "1230": e("PFSubMerchantId missing or invalid", "invalid_request", "do_not_retry"),
  "1231": e("MerchantName missing or invalid", "invalid_request", "do_not_retry"),
  "1232": e("PFSubMerchantCountry missing or invalid", "invalid_request", "do_not_retry"),
  "1233": e("PFSubMerchantCity missing or invalid", "invalid_request", "do_not_retry"),
  "1265": e(
    "Payout declined: over a year since the last sale",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1266": e("Submethod not supported", "payment_method_unavailable", "do_not_retry"),
  "1267": e(
    "Card not supported in the Visa Direct OCT program",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "1268": e("Token inactive", "payment_method_unavailable", "customer_action_required"),
  "1269": e("Cryptogram could not be obtained", "provider_unavailable", "retry_conditionally"),
  "1270": e("Client not configured for account updater", "configuration", "do_not_retry"),
  "1271": e(
    "Related transaction must be an approved InitAuth3D of the same merchant",
    "invalid_request",
    "do_not_retry",
  ),
  "1272": e(
    "Card number must be the same throughout a 3DS flow",
    "invalid_request",
    "do_not_retry",
  ),
  "1273": e(
    "Card number, currency and amount must be the same throughout a 3DS flow",
    "invalid_request",
    "do_not_retry",
  ),
  "1274": e(
    "Auth3D 2.0 requested but card does not support 3DS 2.0",
    "authentication_failed",
    "do_not_retry",
  ),
  "1275": e("InitAuth3D already used in another 3D flow", "duplicate_request", "do_not_retry"),
  "1276": e(
    "Authentication request timed out; try later",
    "network_or_timeout",
    "retry_conditionally",
  ),
  "1277": e("Directory server returned an error", "authentication_failed", "retry_conditionally"),
  "1278": e(
    "Authentication expired; new InitAuth3d needed",
    "authentication_failed",
    "safe_to_retry_technical_request",
  ),
  "1279": e(
    "3D related transaction already used for a sale or auth",
    "duplicate_request",
    "do_not_retry",
  ),
  "1280": e("sg_threeDSMethodNotificationURL missing", "invalid_request", "do_not_retry"),
  "1281": e("Authentication not completed", "authentication_failed", "customer_action_required"),
  "1282": e("Authentication failed", "authentication_failed", "customer_action_required"),
  "1283": e("sg_ThreeDSPlatformType missing or invalid", "invalid_request", "do_not_retry"),
  "1284": e("External MPI parameters badly formatted", "invalid_request", "do_not_retry"),
  "1285": e("Refund time frame exceeded", "invalid_request", "do_not_retry"),
  "1288": e(
    "Void not supported for this related transaction type on this processor",
    "invalid_request",
    "do_not_retry",
  ),
  "1289": e("Issuer data unavailable; try later", "provider_unavailable", "retry_conditionally"),
  "1290": e(
    "NextAction is DoChallenge but the challenge result does not allow sale or auth",
    "authentication_failed",
    "do_not_retry",
  ),
  "1292": e(
    "NextAction is Stop; send no further transaction",
    "authentication_failed",
    "do_not_retry",
  ),
  "1293": e(
    "Temporary 3DS 2.0 malfunction; retry",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ),
  "1295": e(
    "Cross-border OCT above 10,000 EUR not allowed in Azerbaijan, Moldova, Ukraine",
    "invalid_amount",
    "do_not_retry",
  ),
  "1296": e(
    "Non-domestic OCT not allowed for this issuer or merchant country",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "1297": e(
    "Acquirer reference number and auth code duplicated",
    "duplicate_request",
    "do_not_retry",
  ),
  "1300": e(
    "Retry limit exceeded; issuer will not approve the same amount",
    "card_declined",
    "do_not_retry",
  ),
  "1500": e("Client not allowed to use this channel", "configuration", "do_not_retry"),
  "1501": e("Client not allowed to use Suppress Auth", "configuration", "do_not_retry"),
  "1550": e("Auto reversal parameters incomplete", "invalid_request", "do_not_retry"),
  "1551": e("Client not permitted to use auto reversal", "configuration", "do_not_retry"),
  "1552": e("Input parameter data type incorrect", "invalid_request", "do_not_retry"),
  "1553": e(
    "Auto reversal currency differs from the settle currency",
    "invalid_request",
    "do_not_retry",
  ),
  "1554": e(
    "Auto reversal amount does not match settle and auth amounts",
    "invalid_amount",
    "do_not_retry",
  ),
  "1555": e("Auto reversal not allowed with multiple settles", "invalid_request", "do_not_retry"),
  "1556": e(
    "Settle amount plus auto reversal amount must equal the original auth",
    "invalid_amount",
    "do_not_retry",
  ),
  "1557": e(
    "Original currency differs from auto reversal currency",
    "invalid_request",
    "do_not_retry",
  ),
  "1558": e("Auto reversal input parameters incorrect", "invalid_request", "do_not_retry"),
  "1559": e("Auth cannot be voided: already settled", "invalid_request", "do_not_retry"),
  "1560": e("Auth type not allowed", "configuration", "do_not_retry"),
  "2001": e(
    "Requested acquirer bank temporarily unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "2002": e("ApmRisk disabled", "configuration", "do_not_retry"),
  "2025": e("External MPI not supported for this acquirer", "configuration", "do_not_retry"),
  "2030": e("External token provider invalid", "invalid_request", "do_not_retry"),
  "3001": e("Sale reversal interval invalid", "invalid_request", "do_not_retry"),
  "3002": e("Refund reversal interval invalid", "invalid_request", "do_not_retry"),
  "3003": e("OCT reversal interval invalid", "invalid_request", "do_not_retry"),
  "3004": e("Transaction already reversed", "duplicate_request", "do_not_retry"),
  "3005": e("Transaction not approved", "invalid_request", "do_not_retry"),
  "3006": e("Transaction type does not match reversal type", "invalid_request", "do_not_retry"),
  "3007": e("Transaction not yet transmitted", "invalid_request", "retry_conditionally"),
  "3008": e("Transaction already has a chargeback record", "invalid_request", "do_not_retry"),
  "3500": e("POS parameter invalid", "invalid_request", "do_not_retry"),
  "3501": e("Mandatory POS parameter missing", "invalid_request", "do_not_retry"),
  "3502": e("KYC parameters error", "invalid_request", "do_not_retry"),
  "3503": e("ClientUniqueID required by configuration", "invalid_request", "do_not_retry"),
  "3504": e("Transaction already settled", "duplicate_request", "do_not_retry"),
  "3505": e("A sale already exists for this Auth3d", "duplicate_request", "do_not_retry"),
  "3506": e("TransactionID wrong or does not exist", "invalid_request", "do_not_retry"),
  "3507": e("Installments not allowed", "configuration", "do_not_retry"),
  "3508": e("Number of installments must be 0 or more", "invalid_request", "do_not_retry"),
  "3509": e(
    "firstInstallment, periodicalInstallment or numberOfInstallments missing",
    "invalid_request",
    "do_not_retry",
  ),
  "10012": e(
    "Saved payment option no longer valid",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "10013": e(
    "Payment option cannot be registered at the APM",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "10014": e("APM authentication error", "authentication_failed", "customer_action_required"),
  "10025": e("MoneySend parameter missing or invalid", "invalid_request", "do_not_retry"),
  "10026": e(
    "Two-phase auth-settle not supported in Visa Direct AFT",
    "invalid_request",
    "do_not_retry",
  ),
  "10027": e(
    "Non-domestic AFT not allowed for this issuer or merchant country",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "10028": e("Card-present not supported in Visa Direct AFT", "invalid_request", "do_not_retry"),
  "10029": e("Installments program missing or invalid", "invalid_request", "do_not_retry"),
  "10030": e("Number of installments must be valid and above 0", "invalid_request", "do_not_retry"),
  "10031": e("SenderName required for cross-border", "invalid_request", "do_not_retry"),
  "10034": e("AFT credit adjustment interval invalid", "invalid_request", "do_not_retry"),
  "10035": e("RecipientCardNumber or RecipientToken missing", "invalid_request", "do_not_retry"),
  "10036": e(
    "Transaction batch marked closed within the last 60 days",
    "invalid_request",
    "do_not_retry",
  ),
  "10037": e("Client not configured for external authorization", "configuration", "do_not_retry"),
  "10038": e("sg_CascadeToCredit invalid", "invalid_request", "do_not_retry"),
  "10040": e("Amount above the unreferenced refund limit", "invalid_amount", "do_not_retry"),
  "10041": e("sg_TaxAmountBase missing", "invalid_request", "do_not_retry"),
  "10042": e("sg_personalID missing", "invalid_request", "do_not_retry"),
  "10043": e("Installments above the maximum of 99", "invalid_request", "do_not_retry"),
  "10044": e("Settle amount above authorization thresholds", "invalid_amount", "do_not_retry"),
  "10046": e("sg_BatchStartGMT is in the past", "invalid_request", "do_not_retry"),
  "10047": e(
    "Transaction batch marked closed within the last 60 days (repeat of 10036)",
    "invalid_request",
    "do_not_retry",
  ),
  "10048": e(
    "Debit or prepaid cards cannot be used for installments",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "10049": e(
    "Visa Colombian domestic transactions must be in COP",
    "invalid_request",
    "do_not_retry",
  ),
  "10050": e("sg_FirstName missing", "invalid_request", "do_not_retry"),
  "10051": e("sg_LastName missing", "invalid_request", "do_not_retry"),
  "10052": e("Address required for cross-border", "invalid_request", "do_not_retry"),
  "10053": e("City required for cross-border", "invalid_request", "do_not_retry"),
  "10054": e(
    "AFT auth: South African first name identification missing",
    "invalid_request",
    "do_not_retry",
  ),
  "10055": e("Void not allowed on fast funds payouts", "invalid_request", "do_not_retry"),
  "10056": e(
    "Address required for cross-border (repeat of 10052)",
    "invalid_request",
    "do_not_retry",
  ),
  "10057": e("City required for cross-border (repeat of 10053)", "invalid_request", "do_not_retry"),
  "10058": e("Name required for South African cross-border", "invalid_request", "do_not_retry"),
  "10059": e(
    "AFT auth: Brazilian phone or email identification missing",
    "invalid_request",
    "do_not_retry",
  ),
  "10060": e(
    "Card brand blocked by merchant restriction configuration",
    "configuration",
    "do_not_retry",
  ),
  "10061": e("Country required for cross-border", "invalid_request", "do_not_retry"),
  "10062": e("BAI value invalid", "invalid_request", "do_not_retry"),
  "10065": e("Merchant not approved for cross-border AFT", "configuration", "do_not_retry"),
  "10066": e("sg_Address missing", "invalid_request", "do_not_retry"),
  "10067": e("sg_City missing", "invalid_request", "do_not_retry"),
  "10068": e("sg_state missing", "invalid_request", "do_not_retry"),
  "10069": e("sg_zip missing", "invalid_request", "do_not_retry"),
  "10070": e("sg_BatchNumber missing", "invalid_request", "do_not_retry"),
  "10071": e("sg_BatchStartGMT missing", "invalid_request", "do_not_retry"),
  "10072": e(
    "Colombian domestic transaction not allowed",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "10073": e("State does not match ISO code", "invalid_request", "do_not_retry"),
  "10074": e(
    "AMEX does not support 3D together with an external token provider (Apple Pay)",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "10075": e(
    "Paymentez does not support 3D together with an external token provider",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "101778": e("Card reissued after loss or theft", "card_declined", "customer_action_required"),
};

/**
 * Filter codes that Nuvei's table lists twice with unrelated meanings. The
 * payload cannot say which one applies, so both are shown.
 */
export const DUPLICATED_FILTER_CODES: Readonly<Record<string, readonly CodeEntry[]>> = {
  "1158": [
    e("3D PaRes value incorrect", "authentication_failed", "retry_conditionally"),
    e(
      "PayPal account already registered to another user",
      "duplicate_request",
      "customer_action_required",
    ),
  ],
  "1159": [
    e("State does not match ISO code", "invalid_request", "do_not_retry"),
    e(
      "User already registered with a different payer email",
      "invalid_request",
      "customer_action_required",
    ),
  ],
  "1160": [
    e("Bank code checksum digit invalid", "invalid_request", "customer_action_required"),
    e("Single account validation failed", "invalid_request", "customer_action_required"),
  ],
  "1167": [
    e("Transaction already settled", "duplicate_request", "do_not_retry"),
    e("External MPI parameters missing", "invalid_request", "do_not_retry"),
  ],
};

/**
 * Gateway decline reasons (`gwErrorReason`, DMN `Reason`), returned when the
 * transaction status is DECLINED: 170 listed values and 10 that appear only
 * in the decline reason descriptions. Nuvei calls the list "some possible"
 * values, so it is not exhaustive. Matching ignores case, a trailing period
 * and the dash style.
 */
export const DECLINE_REASONS: Readonly<Record<string, CodeEntry>> = {
  "Account Closed": e("Account is closed", "card_declined", "do_not_retry"),
  "Account Not Yet Activated": e(
    "Account not activated yet",
    "card_declined",
    "customer_action_required",
  ),
  "Acquirer validation": e("Acquirer-side validation decline", "card_declined", "manual_review"),
  "Activity limit exceeded": e(
    "Activity limit reached",
    "card_declined",
    "customer_action_required",
  ),
  "Admin Card Not Found": e("Admin card not found", "card_declined", "do_not_retry"),
  "Already reversed": e("Transaction was already reversed", "duplicate_request", "do_not_retry"),
  "Amount mismatch": e("Amount does not match", "invalid_amount", "do_not_retry"),
  "APM authentication error": e(
    "APM authentication failed",
    "authentication_failed",
    "customer_action_required",
  ),
  "Authentication Error": e(
    "Authentication error",
    "authentication_failed",
    "customer_action_required",
  ),
  "Authorization error": e("Authorization error", "card_declined", "manual_review"),
  "AVS Failed": e("Address verification failed", "card_declined", "customer_action_required"),
  "Bank is not supported": e(
    "Bank not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "Black listed by APM": e("Blacklisted by the APM", "fraud_or_risk", "do_not_retry"),
  "Blocked by cardholder/contact cardholder": e(
    "Cardholder blocked the card",
    "card_declined",
    "customer_action_required",
  ),
  "Blocked, first used-transaction from new cardholder, and card not properly unblocked": e(
    "Blocked on first use: new card not properly unblocked",
    "card_declined",
    "customer_action_required",
  ),
  "Call issuer": e(
    "Refer to issuer; voice authorization may be possible",
    "card_declined",
    "customer_action_required",
  ),
  "Cannot verify PIN": e(
    "PIN could not be verified (PIN-related decline)",
    "authentication_failed",
    "customer_action_required",
  ),
  "Card declined": e("Card declined", "card_declined", "customer_action_required"),
  "Card Not Eligible": e("Card not eligible", "card_declined", "customer_action_required"),
  "Card not found - non-participating BIN/issuer": e(
    "Card not found; BIN or issuer not participating",
    "card_declined",
    "customer_action_required",
  ),
  "Card not found - participating BIN/issuer": e(
    "Card not found; BIN or issuer participating",
    "card_declined",
    "customer_action_required",
  ),
  "Card Type Verification Error": e(
    "Card type verification error",
    "card_declined",
    "customer_action_required",
  ),
  "Closed account": e("Account is closed", "card_declined", "do_not_retry"),
  "Closed account by issuer. Issuer will not approve same amount in next 30 days": e(
    "Issuer closed the account; same amount will not be approved for 30 days (do not retry with this card)",
    "card_declined",
    "do_not_retry",
  ),
  "Closed account.": e("Account is closed", "card_declined", "do_not_retry"),
  "Consumer Cannot Pay": e("Consumer cannot pay", "card_declined", "customer_action_required"),
  "Cryptographic error found in PIN": e(
    "PIN cryptographic error (PIN-related, possible security block)",
    "authentication_failed",
    "do_not_retry",
  ),
  "Cupon Already Used.": e("Coupon already used", "invalid_request", "customer_action_required"),
  "Customer has not given consent for PSD2 payment": e(
    "Customer did not consent to the PSD2 payment",
    "authentication_required",
    "customer_action_required",
  ),
  "CVV data is not correct": e("CVV data not correct", "card_declined", "customer_action_required"),
  "CVV2 Value supplied is invalid": e(
    "CVV2 value invalid",
    "card_declined",
    "customer_action_required",
  ),
  "Daily threshold exceeded": e(
    "Daily threshold reached",
    "card_declined",
    "customer_action_required",
  ),
  Decline: e("Declined", "card_declined", "customer_action_required"),
  Declined: e("Declined", "card_declined", "customer_action_required"),
  Default: e("Default decline", "card_declined", "customer_action_required"),
  "Denied, do not repeat before 72 hours.": e(
    "Denied; do not repeat for 72 hours",
    "card_declined",
    "retry_conditionally",
  ),
  "Different funding option required": e(
    "A different funding option is required",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "Do not honor": e(
    "Do not honor: most common generic issuer decline",
    "card_declined",
    "customer_action_required",
  ),
  "Duplicate transaction": e(
    "Duplicate transaction (sent twice)",
    "duplicate_request",
    "do_not_retry",
  ),
  "Duplicated transaction. Try later": e(
    "Duplicate transaction; try later",
    "duplicate_request",
    "retry_conditionally",
  ),
  "E002-System error": e("System error (E002)", "provider_unavailable", "retry_conditionally"),
  "E010-Invalid size of first name": e(
    "First name length invalid (E010)",
    "invalid_request",
    "customer_action_required",
  ),
  "E026-Invalid customer’s bank routing/ABA number": e(
    "Bank routing/ABA number invalid (E026)",
    "invalid_request",
    "customer_action_required",
  ),
  "E040-The credit transaction is declined as daily credit limit is exceeded.": e(
    "Credit declined: daily credit limit exceeded (E040)",
    "invalid_amount",
    "retry_conditionally",
  ),
  "E201-Fraudulent or suspicious bank account": e(
    "Bank account flagged as fraudulent or suspicious (E201)",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "E202-Fraudulent or suspicious identity": e(
    "Identity flagged as fraudulent or suspicious (E202)",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "E203-Fraudulent or suspicious transaction pattern": e(
    "Transaction pattern flagged as fraudulent or suspicious (E203)",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "End user did not complete": e(
    "End user did not complete the flow",
    "unknown",
    "customer_action_required",
  ),
  "Error in decryption of PIN block": e(
    "PIN block decryption error (security violation, card may be restricted)",
    "authentication_failed",
    "do_not_retry",
  ),
  "Exceeded retry limit, issuer cannot approve at this time": e(
    "Retry limit exceeded; issuer cannot approve now",
    "card_declined",
    "retry_conditionally",
  ),
  "Exceeded retry limit, issuer will never approve": e(
    "Retry limit exceeded; issuer will never approve",
    "card_declined",
    "do_not_retry",
  ),
  "Exceeds daily limits": e("Daily limits exceeded", "card_declined", "customer_action_required"),
  "Exceeds transaction limits": e(
    "Transaction limits exceeded",
    "card_declined",
    "customer_action_required",
  ),
  "Exceeds withdrawal frequency": e(
    "Withdrawal frequency exceeded",
    "card_declined",
    "customer_action_required",
  ),
  "Exceeds withdrawal limit": e(
    "Withdrawal amount limit exceeded",
    "card_declined",
    "customer_action_required",
  ),
  "Expired card": e("Card expired or expiry mismatch", "card_declined", "customer_action_required"),
  "External Error In Processing": e(
    "External processing error; may succeed later",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "Failed 3DSecure Authentication": e(
    "3D Secure authentication failed",
    "authentication_failed",
    "customer_action_required",
  ),
  "Format error": e(
    "Format error; for Mastercard/Maestro may mean CVV or 3DS issue",
    "invalid_request",
    "manual_review",
  ),
  "GENERAL DECLINE": e("General decline", "card_declined", "customer_action_required"),
  "General Error": e("General error", "unknown", "manual_review"),
  "Generic Decline": e("Generic decline", "card_declined", "customer_action_required"),
  "Global General Error": e("Global general error", "unknown", "manual_review"),
  "IM - Invalid Member Number": e("Invalid member number", "card_declined", "do_not_retry"),
  "Incorrect PIN": e("Incorrect PIN", "authentication_failed", "customer_action_required"),
  "Incorrect request parameter": e(
    "Incorrect request parameter",
    "invalid_request",
    "do_not_retry",
  ),
  "Insufficient funds": e("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "Insufficient funds.": e("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "Invalid Account": e("Account invalid", "card_declined", "customer_action_required"),
  "Invalid Account Number": e(
    "Account number invalid",
    "invalid_request",
    "customer_action_required",
  ),
  "Invalid account specified": e(
    "Account invalid or not linked",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid amount": e(
    "Invalid amount; may also reflect currency or funds",
    "invalid_amount",
    "customer_action_required",
  ),
  "Invalid argument": e("Invalid argument", "invalid_request", "do_not_retry"),
  "Invalid argument. Unknown alias": e(
    "Invalid argument: unknown alias",
    "invalid_request",
    "do_not_retry",
  ),
  "Invalid Card Number": e(
    "Card number invalid or does not exist",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid Credit Type": e("Credit type invalid", "invalid_request", "do_not_retry"),
  "Invalid Cupon.": e("Coupon invalid", "invalid_request", "customer_action_required"),
  "Invalid CVV": e("CVV invalid", "card_declined", "customer_action_required"),
  "Invalid CVV2": e(
    "CVV2 does not match the card; Visa only",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid 'From' account specified": e(
    "From account invalid",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid Issue Number": e("Issue number invalid", "invalid_request", "customer_action_required"),
  "Invalid merchant": e(
    "Invalid merchant: generic decline, usually not a merchant problem",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid Merchant ID": e("Merchant ID invalid", "configuration", "do_not_retry"),
  "Invalid phone number.": e("Phone number invalid", "invalid_request", "customer_action_required"),
  "Invalid request parameter.": e("Request parameter invalid", "invalid_request", "do_not_retry"),
  "Invalid service code, restricted": e(
    "Service code invalid; restricted",
    "card_declined",
    "do_not_retry",
  ),
  "Invalid 'To' account specified": e(
    "To account invalid; also known as unsolicited reversal",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid transaction": e(
    "Invalid transaction: generic issuer decline",
    "card_declined",
    "customer_action_required",
  ),
  "Invalid transaction; contact card issuer": e(
    "Invalid transaction; contact the card issuer",
    "card_declined",
    "customer_action_required",
  ),
  "Issuer or switch inoperative": e(
    "Issuer or switch inoperative, for example timeout",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "Life Cycle": e("Lifecycle decline", "card_declined", "customer_action_required"),
  "Lost card, pick up (fraud account)": e(
    "Lost card, pick up; fraud account",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "Lost card, pick-up": e("Lost card, pick up", "fraud_or_risk", "do_not_retry"),
  "Lost/Stolen": e("Lost or stolen", "fraud_or_risk", "do_not_retry"),
  "Missing mandatory field": e("Mandatory field missing", "invalid_request", "do_not_retry"),
  "Negative CAM, dCVV, iCVV, or CVV results": e(
    "Negative CAM, dCVV, iCVV or CVV result",
    "card_declined",
    "customer_action_required",
  ),
  "No account": e("No account", "card_declined", "customer_action_required"),
  "No action taken": e("No action taken", "card_declined", "manual_review"),
  "No credit account": e("No credit account", "card_declined", "customer_action_required"),
  "No current account": e("No current account", "card_declined", "customer_action_required"),
  "No savings account": e("No savings account", "card_declined", "customer_action_required"),
  "No such issuer": e(
    "No such issuer; BIN not in acquirer list",
    "card_declined",
    "customer_action_required",
  ),
  "No update, but the account is valid": e("No update; account is valid", "unknown", "unknown"),
  "Payee First Name / Last Name is missing or invalid": e(
    "Payee first or last name missing or invalid",
    "invalid_request",
    "customer_action_required",
  ),
  "Payment Denied": e("Payment denied", "card_declined", "customer_action_required"),
  "Payment method Technical Error": e(
    "Payment method technical error",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "Payment not authorized by user": e(
    "Payment not authorized by the user",
    "unknown",
    "customer_action_required",
  ),
  "Payment not authorized by user.": e(
    "Payment not authorized by the user",
    "unknown",
    "customer_action_required",
  ),
  "PayPal account was not verified, please contact PayPal support": e(
    "PayPal account not verified",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "PayPal Business account is not allowed": e(
    "PayPal Business accounts not allowed",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "Pick up card (no fraud)": e("Pick up card, no fraud", "card_declined", "do_not_retry"),
  "Pick up card, special condition (fraud account)": e(
    "Pick up card, special condition, fraud account",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "Pick-up card": e("Pick up card", "fraud_or_risk", "do_not_retry"),
  "PIN Code is required": e("PIN required", "authentication_required", "customer_action_required"),
  "PIN tried exceeded": e("PIN tries exceeded", "authentication_failed", "do_not_retry"),
  "PIN tries exceeded": e(
    "PIN tries exceeded (card blocked by issuer)",
    "authentication_failed",
    "do_not_retry",
  ),
  "Process canceled": e("Process cancelled", "unknown", "customer_action_required"),
  "Process cancelled.": e("Process cancelled", "unknown", "customer_action_required"),
  "Process failed": e("Process failed", "unknown", "manual_review"),
  "Receiving Limit exceeded": e(
    "Receiving limit exceeded",
    "card_declined",
    "customer_action_required",
  ),
  "Re-enter transaction": e(
    "Re-enter the transaction",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "Refer to issuer": e("Refer to issuer", "card_declined", "customer_action_required"),
  Referral: e("Referral", "card_declined", "customer_action_required"),
  "Rejected by carrier.": e(
    "Rejected by carrier",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "Restricted card": e("Restricted card", "card_declined", "do_not_retry"),
  "Restricted card/bank account": e(
    "Restricted card or bank account",
    "card_declined",
    "do_not_retry",
  ),
  "Retry the transaction later": e("Retry later", "provider_unavailable", "retry_conditionally"),
  "Revocation of all authorizations order": e(
    "Cardholder revoked all authorizations; stop recurring",
    "card_declined",
    "do_not_retry",
  ),
  "Revocation of authorization order": e(
    "Cardholder revoked this authorization; stop recurring",
    "card_declined",
    "do_not_retry",
  ),
  "Routing error": e(
    "Cannot reach the authorizing destination",
    "provider_unavailable",
    "manual_review",
  ),
  SC_MISSING_MANDATORY_FIELD: e("Mandatory field missing", "invalid_request", "do_not_retry"),
  "Security violation": e("Security violation", "fraud_or_risk", "do_not_retry"),
  "Security violations": e("Security violations", "fraud_or_risk", "do_not_retry"),
  "Soft Decline - Authentication is Advised": e(
    "Soft decline; retry with 3DS may help",
    "authentication_required",
    "customer_action_required",
  ),
  "Stolen card, pick up": e("Stolen card, pick up", "fraud_or_risk", "do_not_retry"),
  "Stolen card, pick up (fraud account)": e(
    "Stolen card, pick up; fraud account",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "Stolen card, pick-up": e("Stolen card, pick up", "fraud_or_risk", "do_not_retry"),
  "Suspected fraud": e("Suspected fraud", "fraud_or_risk", "do_not_retry"),
  "Suspected fraud by issuer. Issuer will not approve same amount in the next 30 days.": e(
    "Issuer suspects fraud; same amount not approved for 30 days",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "System Error": e("System error", "provider_unavailable", "retry_conditionally"),
  "System not available": e("System not available", "provider_unavailable", "retry_conditionally"),
  "The Email field is mandatory": e(
    "Email field required",
    "invalid_request",
    "customer_action_required",
  ),
  "The message returned by the financial network is inconsistent.": e(
    "Financial network message inconsistent",
    "provider_unavailable",
    "manual_review",
  ),
  "The security code or expiration date was invalid.": e(
    "Security code or expiry date invalid",
    "card_declined",
    "customer_action_required",
  ),
  "Timeout/Retry": e("Acquirer-issuer timeout", "network_or_timeout", "retry_conditionally"),
  "Transaction cannot be completed": e(
    "Issuer could not complete; cardholder should contact issuer if repeated",
    "card_declined",
    "customer_action_required",
  ),
  "Transaction cannot be completed; violation of law": e(
    "Cannot complete: violation of law",
    "card_declined",
    "do_not_retry",
  ),
  "Transaction declined, please contact support!": e(
    "Declined; contact support",
    "unknown",
    "manual_review",
  ),
  "Transaction does not fulfil AML requirement": e(
    "Does not meet AML requirement",
    "fraud_or_risk",
    "manual_review",
  ),
  "Transaction expired": e("Transaction expired", "unknown", "customer_action_required"),
  "Transaction is aborted.": e("Transaction aborted", "unknown", "manual_review"),
  "Transaction Not Found": e("Transaction not found", "invalid_request", "do_not_retry"),
  "Transaction not permitted on terminal": e(
    "Not permitted on this terminal; issuer may reject merchant or industry",
    "card_declined",
    "do_not_retry",
  ),
  "Transaction not permitted to cardholder": e(
    "Not permitted to cardholder, for example restricted industry or country",
    "card_declined",
    "do_not_retry",
  ),
  "Transaction not permitted to cardholder.": e(
    "Not permitted to cardholder",
    "card_declined",
    "do_not_retry",
  ),
  "Transaction not permitted-Card": e("Not permitted on card", "card_declined", "do_not_retry"),
  "Transaction not permitted-Terminal": e(
    "Not permitted on terminal",
    "card_declined",
    "do_not_retry",
  ),
  "Transaction not supported/blocked by issuer": e(
    "Issuer blocked or does not support the transaction",
    "card_declined",
    "do_not_retry",
  ),
  "Tsys Filter - An error occured": e("TSYS filter error", "provider_unavailable", "manual_review"),
  "Unable to locate, no match": e("Unable to locate; no match", "invalid_request", "manual_review"),
  "Unable to refund": e("Unable to refund", "unknown", "manual_review"),
  "UNEXPECTED SYSTEM ERROR - PLEASE RETRY LATER": e(
    "Unexpected system error; retry later",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ),
  "Unknown Error": e("Unknown error", "unknown", "unknown"),
  "User aborted the transaction": e("User aborted", "unknown", "customer_action_required"),
  "User account problem": e(
    "User account problem",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "User account problem.": e(
    "User account problem",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "Verification data failed": e(
    "Verification data failed",
    "authentication_failed",
    "customer_action_required",
  ),
  "Violation of Gaming Regulation": e(
    "Gaming regulation violation",
    "configuration",
    "do_not_retry",
  ),
  "Violation, cannot complete": e("Violation; cannot complete", "card_declined", "do_not_retry"),
  "You must repeat the transaction.": e(
    "Transaction must be repeated",
    "provider_unavailable",
    "retry_conditionally",
  ),
  // Values explained only in the decline reason descriptions.
  "Pick up card": e(
    "Issuer asks to retain the card; may be lost or stolen",
    "fraud_or_risk",
    "do_not_retry",
  ),
  "Unable to locate record in file": e(
    "Technical failure; may succeed later",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "File temporarily not available": e(
    "Technical failure; may succeed later",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "Lost card": e("Card listed as lost by the issuer", "fraud_or_risk", "do_not_retry"),
  "Stolen card": e("Card listed as stolen by the issuer", "fraud_or_risk", "do_not_retry"),
  "No checking account": e(
    "Problem with the account behind the card",
    "card_declined",
    "customer_action_required",
  ),
  "PIN not changed": e(
    "Declined because of the PIN",
    "authentication_failed",
    "customer_action_required",
  ),
  "PIN unacceptable. Retry.": e(
    "PIN not acceptable",
    "authentication_failed",
    "customer_action_required",
  ),
  "3DS authentication failed, payment not allowed.": e(
    "Do not request again, not even without 3DS",
    "authentication_failed",
    "do_not_retry",
  ),
  "Deactivated Tokens": e(
    "Cardholder deactivated the token; stop retries",
    "payment_method_unavailable",
    "do_not_retry",
  ),
};

/** Failed 3-D Secure authorization reasons (`threeDReasonId`, DMN `3DReasonId`): 34 values. */
export const THREE_DS_REASONS: Readonly<Record<string, CodeEntry>> = {
  "01": e("Card authentication failed", "authentication_failed", "customer_action_required"),
  "02": e("Unknown device", "authentication_failed", "customer_action_required"),
  "03": e("Unsupported device", "authentication_failed", "customer_action_required"),
  "04": e(
    "Authentication frequency limit exceeded",
    "authentication_failed",
    "retry_conditionally",
  ),
  "05": e("Expired card", "card_declined", "customer_action_required"),
  "06": e("Invalid card number", "card_declined", "customer_action_required"),
  "07": e("Invalid transaction", "authentication_failed", "do_not_retry"),
  "08": e("No card record", "card_declined", "customer_action_required"),
  "09": e("Security failure", "fraud_or_risk", "do_not_retry"),
  "10": e("Stolen card", "fraud_or_risk", "do_not_retry"),
  "11": e("Suspected fraud", "fraud_or_risk", "do_not_retry"),
  "12": e("Not permitted to cardholder", "card_declined", "do_not_retry"),
  "13": e(
    "Cardholder not enrolled in the service",
    "authentication_failed",
    "customer_action_required",
  ),
  "14": e("Timed out at the ACS", "network_or_timeout", "retry_conditionally"),
  "15": e("Low confidence", "fraud_or_risk", "customer_action_required"),
  "16": e("Medium confidence", "fraud_or_risk", "customer_action_required"),
  "17": e("High confidence", "fraud_or_risk", "customer_action_required"),
  "18": e("Very high confidence", "fraud_or_risk", "customer_action_required"),
  "19": e("ACS maximum challenges reached", "authentication_failed", "retry_conditionally"),
  "20": e("Non-payment transactions not supported", "invalid_request", "do_not_retry"),
  "21": e(
    "3RI transaction not supported (code no longer allowed since 1 September 2019)",
    "invalid_request",
    "do_not_retry",
  ),
  "22": e("ACS technical issue", "provider_unavailable", "retry_conditionally"),
  "23": e(
    "ACS requires decoupled authentication the requestor did not ask for",
    "authentication_failed",
    "do_not_retry",
  ),
  "24": e(
    "Decoupled authentication maximum expiry time exceeded",
    "authentication_failed",
    "retry_conditionally",
  ),
  "25": e(
    "Too little time for decoupled authentication",
    "authentication_failed",
    "retry_conditionally",
  ),
  "26": e(
    "Authentication attempted but not performed by the cardholder",
    "authentication_failed",
    "customer_action_required",
  ),
  "81": e(
    "Mastercard: exemption request accepted; Visa: ACS timed out (same code, two meanings)",
    "unknown",
    "unknown",
  ),
  "82": e("Visa: invalid response from ACS", "provider_unavailable", "retry_conditionally"),
  "83": e("Visa: system error response from ACS", "provider_unavailable", "retry_conditionally"),
  "84": e(
    "Visa: internal error while generating CAVV",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "85": e("Visa: VMID not eligible for the requested program", "configuration", "do_not_retry"),
  "86": e("Visa: protocol version not supported by ACS", "authentication_failed", "do_not_retry"),
  "87": e(
    "Visa: excluded from attempts processing (includes non-reloadable prepaid)",
    "authentication_failed",
    "do_not_retry",
  ),
  "88": e("Visa: requested program not supported by ACS", "authentication_failed", "do_not_retry"),
};

/** 3-D Secure codes whose meaning differs per card scheme. */
export const AMBIGUOUS_THREE_DS_REASONS: ReadonlySet<string> = new Set(["81"]);

export type AdviceEntry = { meaning: string; retry: RetryGuidance };
const mac = (meaning: string, retry: RetryGuidance): AdviceEntry => ({ meaning, retry });

/**
 * Mastercard Merchant Advice Codes (`merchantAdviceCode`): 16 values. Nuvei's
 * own successful examples carry "02", so a code is only read next to a
 * decline or an error.
 */
export const MERCHANT_ADVICE_CODES: Readonly<Record<string, AdviceEntry>> = {
  "01": mac("New account information available", "customer_action_required"),
  "02": mac("Cannot approve now; try again later", "retry_conditionally"),
  "03": mac("Do not try again", "do_not_retry"),
  "04": mac("Token requirements not met for this token type", "do_not_retry"),
  "21": mac("Payment cancelled; do not try again", "do_not_retry"),
  "24": mac("Retry after 1 hour", "retry_conditionally"),
  "25": mac("Retry after 24 hours", "retry_conditionally"),
  "26": mac("Retry after 2 days", "retry_conditionally"),
  "27": mac("Retry after 4 days", "retry_conditionally"),
  "28": mac("Retry after 6 days", "retry_conditionally"),
  "29": mac("Retry after 8 days", "retry_conditionally"),
  "30": mac("Retry after 10 days", "retry_conditionally"),
  "40": mac("Consumer non-reloadable prepaid card", "do_not_retry"),
  "41": mac("Consumer single-use virtual card number", "do_not_retry"),
  "42": mac(
    "Above the issuer's risk threshold; retry with another account",
    "customer_action_required",
  ),
  "43": mac("Consumer multi-use virtual card number", "unknown"),
};

/** `cvv2Reply` / `Cvv2Reply` values (5). */
export const CVV2_REPLIES: Readonly<Record<string, string>> = {
  M: "match",
  N: "no match",
  P: "not processed",
  U: "issuer not certified or has no keys",
  S: "CVV2 processor unavailable",
};

/** `avsCode` / `AvsCode` values (10). */
export const AVS_CODES: Readonly<Record<string, string>> = {
  A: "street matches, ZIP does not",
  W: "9-digit ZIP matches, street does not",
  Y: "5-digit ZIP and street match",
  X: "9-digit ZIP and street match",
  Z: "5-digit ZIP matches, street does not",
  U: "issuer unavailable",
  S: "not supported",
  R: "retry",
  B: "not authorized (declined)",
  N: "neither matches",
};

/** `threeD.result` values from the /getTransactionDetails output table (7). */
export const THREE_DS_RESULTS: Readonly<Record<string, string>> = {
  Y: "authenticated",
  N: "not authenticated or denied",
  U: "authentication could not be performed",
  A: "attempt with proof",
  C: "challenge required",
  D: "decoupled challenge confirmed",
  R: "rejected by the issuer",
};

export type StatusInfo = { outcome: Outcome; meaning: string; meaningUndocumented?: true };

const s = (outcome: Outcome, meaning: string, undocumented = false): StatusInfo =>
  undocumented ? { outcome, meaning, meaningUndocumented: true } : { outcome, meaning };

/** REST API 1.0 `status`: the request itself (stage 1). */
export const API_STATUSES: Readonly<Record<string, StatusInfo>> = {
  SUCCESS: s("success", "The request was processed"),
  ERROR: s("failure", "The request failed; the reason is in errCode and reason"),
  PENDING: s(
    "pending",
    "Asynchronous APM refund; the result arrives by DMN (no transactionStatus is returned)",
  ),
};

/**
 * REST API 1.0 `transactionStatus` (stage 2). Matched without regard to case
 * because the /getTransactionDetails example prints "Approved".
 */
export const TRANSACTION_STATUSES: Readonly<Record<string, StatusInfo>> = {
  APPROVED: s("success", "Approved"),
  DECLINED: s("failure", "Declined by the issuer or the gateway"),
  ERROR: s("failure", "Error, including a failed 3-D Secure authentication"),
  REDIRECT: s("pending", "The customer must complete a 3-D Secure challenge or an APM redirect"),
  PENDING: s("pending", "Pending"),
};

/** Payment DMN `Status` values (6). */
export const DMN_STATUSES: Readonly<Record<string, StatusInfo>> = {
  APPROVED: s("success", "Approved"),
  SUCCESS: s("unknown", "Listed by Nuvei for DMNs without a meaning", true),
  DECLINED: s(
    "failure",
    "Declined; also sent with ppp_status=FAIL when no financial transaction happened",
  ),
  ERROR: s("failure", "Error"),
  PENDING: s("pending", "Pending; an additional DMN with the final status follows (APM)"),
  UPDATE: s(
    "unknown",
    "Status update, only for certain North American bank transfer APMs; its effect on the outcome is not documented",
  ),
};

/** Payment DMN `ppp_status` values (3). */
export const PPP_STATUSES: Readonly<Record<string, StatusInfo>> = {
  OK: s("success", "Approved"),
  FAIL: s("failure", "Declined or error"),
  PENDING: s("pending", "Pending (APM only)"),
};

/** Payment DMN `type` values (4). */
export const DMN_TYPES: Readonly<Record<string, string>> = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  KYC: "KYC (KYC merchants only)",
  DOCUP: "document upload (KYC merchants only)",
};

export type TransactionTypeInfo = {
  stage: LifecycleStage;
  meaning: string;
  meaningUndocumented?: true;
};

const tt = (stage: LifecycleStage, meaning: string, undocumented = false): TransactionTypeInfo =>
  undocumented ? { stage, meaning, meaningUndocumented: true } : { stage, meaning };

/**
 * `transactionType` values of every documented vocabulary (REST responses,
 * /getTransactionDetails, payment DMNs, the FAQ and the Java SDK enum),
 * keyed in lower case because the vocabularies differ in case.
 */
export const TRANSACTION_TYPES: Readonly<Record<string, TransactionTypeInfo>> = {
  sale: tt("payment", "One-step payment (authorization and settle)"),
  sale3d: tt("payment", "One-step payment after 3-D Secure"),
  auth: tt("authorization", "Authorization (hold); settled later"),
  preauth: tt("authorization", "Pre-authorization (larger or longer hold)"),
  auth3d: tt("authentication", "3-D Secure authentication step (non-financial)"),
  initauth3d: tt("authentication", "3-D Secure initialization step (non-financial)"),
  settle: tt("capture", "Settle (capture) of an authorization"),
  credit: tt("refund", "Credit (refund)"),
  refund: tt("refund", "Refund"),
  void: tt("void", "Void"),
  voidcredit: tt("void", "Void (response type of /voidTransaction)"),
  payout: tt("payout", "Payout"),
  chargeback: tt("dispute", "Chargeback"),
  modification: tt("other", "Modification; its meaning is not documented", true),
  riskonly: tt("other", "Risk check only (Java SDK enum)"),
};

/** Withdrawal request state (`wdRequestState`). */
export const WD_REQUEST_STATES: ReadonlySet<string> = new Set(["Open", "In Progress", "Closed"]);

/** Withdrawal request status (`wdRequestStatus`); "Partial" is the scenario table spelling. */
export const WD_REQUEST_STATUSES: Readonly<Record<string, StatusInfo>> = {
  Pending: s("pending", "Waiting for the merchant's decision"),
  Approved: s("pending", "Approved by the merchant; the orders are not settled yet"),
  Declined: s("failure", "Declined"),
  Canceled: s("failure", "Cancelled; no payout will be made for this request"),
  "Partially Approved": s("pending", "Partially approved; the orders are not settled yet"),
  Partial: s("pending", "Partially approved; the orders are not settled yet"),
  Error: s("failure", "Error"),
  "In Progress": s("pending", "In progress"),
};

/** Withdrawal order status (`wdOrderStatus`), including the scenario table's external values. */
export const WD_ORDER_STATUSES: Readonly<Record<string, StatusInfo>> = {
  Pending: s("pending", "Order created, waiting for approval"),
  Approved: s("pending", "Order approved; not settled yet"),
  Settling: s("pending", "Settling"),
  SettlingPending: s("pending", "Settling, waiting for the payment method"),
  "Settling externally": s("pending", "Settling outside Nuvei"),
  Settled: s("success", "Settled: the payout was sent"),
  "Settled externally": s("success", "Settled outside Nuvei"),
  Deleted: s("failure", "Order deleted; no payout will be made for it"),
  Error: s("failure", "Error"),
};

/** Withdrawal `settlementType` values. */
export const SETTLEMENT_TYPES: ReadonlySet<string> = new Set(["Withdrawal", "Refund"]);

/** The only documented withdrawal DMN `notificationType`. */
export const WITHDRAWAL_NOTIFICATION_TYPE = "WITHDRAW_REQUEST_NOTIFICATION";

/** Control Panel event DMN `EventType` values (18). */
export const EVENT_TYPES: ReadonlySet<string> = new Set([
  "Pre-Chargeback Alert",
  "Chargeback",
  "PayFac Submerchant Creation",
  "Manual Correction",
  "Control Panel Generated Transaction",
  "Manual Inserted",
  "Fraud reported Transaction",
  "Ethoca External Alert",
  "RDR External Alert",
  "Dispute API Callback",
  "Dispute API Image Callback",
  "Instant Settlement",
  "Terminal Created or Updated",
  "PayFac Sub-merchant Created or Updated",
  "Error on Creating Terminal",
  "Error on Creating PayFac Sub-Merchant",
  "Error on Updating Terminal",
  "Error on Updating PayFac Sub-Merchant",
]);

/** `ProcessingEntityType` values of the event DMN envelope. */
export const PROCESSING_ENTITY_TYPES: ReadonlySet<string> = new Set(["client", "multiClient"]);

/** `Chargeback.Type` values. */
export const CHARGEBACK_TYPES: Readonly<Record<string, string>> = {
  Chargeback: "Chargeback",
  Retrieval: "Retrieval request",
};

/** `ChargebackStatusCategory` (also printed as `StatusCategory`) values. */
export const CHARGEBACK_STATUS_CATEGORIES: ReadonlySet<string> = new Set([
  "Regular",
  "cancelled",
  "Duplicate",
  "RDR-Refund",
  "Soft_CB",
]);

/** Subscription DMN `dmnType` values (recognized, not analyzed). */
export const SUBSCRIPTION_DMN_TYPES: ReadonlySet<string> = new Set([
  "subscription",
  "subscriptionPayment",
]);

/** `finalFraudDecision` / `fraudDetails.finalDecision` and `systemDecision` values. */
export const FRAUD_DECISIONS: ReadonlySet<string> = new Set([
  "None",
  "Accept",
  "Reject",
  "Review",
  "Error",
]);

/** DMN `autoSettleMode` values. */
export const AUTO_SETTLE_MODES: ReadonlySet<string> = new Set(["TIME", "RISK", "RISK-TIME"]);

/** DMN `partialApprovalStatus` values. */
export const PARTIAL_APPROVAL_STATUSES: ReadonlySet<string> = new Set([
  "PENDING",
  "APPROVED",
  "CANCELLED",
  "AUTO_VOID",
]);

/** `payment_method` values named in the documentation; `apmgw_*` covers the APMs. */
export const CARD_PAYMENT_METHODS: ReadonlySet<string> = new Set([
  "cc_card",
  "ppp_ApplePay",
  "ppp_GooglePay",
]);

export const RETRY_TEXT: Readonly<Record<RetryGuidance, string>> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (contact their issuer, complete authentication, or use another card or payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first confirm the final state with /getPaymentStatus, /getTransactionDetails or the DMN, because the original operation may already have been processed.",
  safe_to_retry_technical_request:
    "The request can be sent again (for example with a new session token). If you are not sure the earlier request was rejected, check its status first.",
  manual_review:
    "Review the transaction manually, or ask Nuvei support, before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Readonly<Record<ErrorCategory, string>> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required: "Send the payment again with 3-D Secure authentication.",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, the currency and the limits that apply to this operation.",
  insufficient_funds:
    "Ask the customer to use another payment method, or to contact their card issuer.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the transaction and the risk outcome before any new attempt.",
  rate_limiting: "Wait, and start a new session before a new attempt.",
  provider_unavailable:
    "Confirm the transaction status with /getPaymentStatus, /getTransactionDetails or the DMN before sending a new request.",
  network_or_timeout:
    "Confirm the transaction status with /getPaymentStatus, /getTransactionDetails or the DMN before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the Nuvei account, merchant site and integration settings, or ask Nuvei support.",
  unknown: "Check the transaction in the Nuvei Control Panel, or ask Nuvei support.",
};

/** Lower case, no trailing period, plain hyphens: how decline reasons are compared. */
export function normalizeReason(text: string): string {
  return text.trim().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
}

const REASON_INDEX: ReadonlyMap<string, string> = (() => {
  const index = new Map<string, string>();
  for (const key of Object.keys(DECLINE_REASONS)) {
    const n = normalizeReason(key);
    if (!index.has(n)) index.set(n, key);
  }
  return index;
})();

/** The documented decline reason that matches a `gwErrorReason` / `Reason` text, if any. */
export function findDeclineReason(
  text: string | undefined,
): { reason: string; entry: CodeEntry } | undefined {
  if (!text || text.length > 300) return undefined;
  const key = REASON_INDEX.get(normalizeReason(text));
  if (key === undefined) return undefined;
  const entry = DECLINE_REASONS[key];
  return entry ? { reason: key, entry } : undefined;
}
