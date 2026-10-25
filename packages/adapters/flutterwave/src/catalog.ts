/**
 * Flutterwave code, message and status knowledge, kept as data.
 *
 * v3 (the documentation's stable default) publishes no readable numeric error
 * table: its "Payment Errors" list is an embedded view outside the page source.
 * v3 errors and declines are therefore matched only against the free-text
 * messages that appear in the v3 pages (error `message`, transaction
 * `processor_response`, transfer `complete_message`) and the eight card
 * velocity trigger errors. v4 publishes code tables, which are decoded by the
 * pair `error.code` + `error.type`, because v4 reuses numbers across tables.
 *
 * Category and retry values are PandaPayLens suggestions derived from the
 * documented meaning; where Flutterwave gives advice it is reflected.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const D = "https://developer.flutterwave.com";
const D4 = `${D}/v4.0.0`;

export const V3_COMMON_ERRORS_URL = `${D}/docs/common-errors`;
export const V3_TIMEOUTS_URL = `${D}/docs/handling-error-timeouts`;
export const V3_RATE_LIMIT_URL = `${D}/docs/rate-limit`;
export const V3_WEBHOOKS_URL = `${D}/docs/webhooks`;
export const V3_VERIFY_URL = `${D}/docs/transaction-verification`;
export const V3_REFUNDS_URL = `${D}/docs/refunds`;
export const V3_CHARGEBACKS_URL = `${D}/docs/chargebacks`;
export const V3_TESTING_URL = `${D}/docs/testing`;
export const V3_TRANSFERS_URL = `${D}/docs/introduction-6`;
export const V3_CARD_URL = `${D}/docs/direct-card-charge`;
export const V3_PREAUTH_URL = `${D}/docs/preauthorization`;
export const V3_MOBILE_MONEY_URL = `${D}/docs/mobile-money-1`;
export const V3_BANK_TRANSFER_URL = `${D}/docs/ngn-bank-transfer`;
export const V3_CREATE_TRANSFER_URL = `${D}/reference/create-a-transfer`;
export const V3_GET_TRANSFER_URL = `${D}/reference/get-a-transfer`;
export const V3_VALIDATE_CHARGE_URL = `${D}/reference/validate-a-charge`;
export const V3_RESEND_HOOK_URL = `${D}/reference/resend-transaction-webhook`;
export const V3_REFUND_LOOKUP_URL = `${D}/reference/get-transaction-refunds`;
export const V3_OTP_URL = `${D}/reference/create-otp`;
export const V3_MPESA_URL = `${D}/reference/charge-via-mpesa`;
export const V3_CAPITEC_URL = `${D}/reference/capitec`;
export const V3_NG_ACCOUNT_URL = `${D}/reference/charge-nigerian-bank-accounts`;
export const V3_TOKEN_CHARGE_URL = `${D}/reference/charge-with-token-1`;
export const V3_GHANA_MOMO_URL = `${D}/reference/charge-via-ghana-mobile-money`;
export const V3_ACH_URL = `${D}/docs/ach-payment`;
export const V3_SA_ACCOUNT_URL = `${D}/docs/south-africa-account-charge`;
export const V4_ERRORS_URL = `${D4}/docs/common-errors`;
export const V4_WEBHOOKS_URL = `${D4}/docs/webhooks`;
export const V4_TESTING_URL = `${D4}/docs/testing`;
export const V4_CHARGE_URL = `${D4}/reference/charges_get`;
export const V4_TRANSFER_URL = `${D4}/reference/transfer_get`;
export const V4_TRANSFER_FLOW_URL = `${D4}/docs/general-transfer-flow`;
export const V4_REFUNDS_URL = `${D4}/docs/refunds`;
export const V4_CHARGEBACKS_URL = `${D4}/docs/chargebacks-1`;
export const V4_PAYMENT_FLOW_URL = `${D4}/docs/main-payment-flow`;

export type StatusEntry = { stage: LifecycleStage; outcome: Outcome; meaning: string };

export type ErrorEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /**
   * True when the provider gave a definitive answer for the operation (a
   * decline or a failed payout), so the outcome is known.
   */
  definitive?: boolean;
};

// ---------------------------------------------------------------------------
// v3 statuses
// ---------------------------------------------------------------------------

/**
 * v3 transaction `data.status` values seen in the pages read. Flutterwave does
 * not publish a complete list; other values are shown as unknown.
 */
export const V3_TRANSACTION_STATUSES: Record<string, StatusEntry> = {
  successful: { stage: "payment", outcome: "success", meaning: "The transaction succeeded" },
  failed: { stage: "payment", outcome: "failure", meaning: "The transaction failed" },
  pending: {
    stage: "payment",
    outcome: "pending",
    meaning: "Waiting for the customer, the bank or the mobile money operator",
  },
  "success-pending-validation": {
    stage: "payment",
    outcome: "pending",
    meaning: "Initiated and waiting for validation (seen on ACH initiation)",
  },
  "pending-capture": {
    stage: "authorization",
    outcome: "success",
    meaning: "Preauthorization held and waiting for capture",
  },
};

/** v3 transfer (payout) `status` values, upper case. */
export const V3_TRANSFER_STATUSES: Record<string, StatusEntry> = {
  NEW: { stage: "payout", outcome: "pending", meaning: "Created, not yet processed" },
  PENDING: { stage: "payout", outcome: "pending", meaning: "Being processed" },
  SUCCESSFUL: { stage: "payout", outcome: "success", meaning: "The transfer succeeded" },
  FAILED: {
    stage: "payout",
    outcome: "failure",
    meaning: "The transfer failed; the reason is in complete_message",
  },
};

/**
 * v3 refund statuses (refunds page). `completed` means initiated and waiting
 * for disbursement, not finished; the suffixed `completed-*` values are final.
 */
export const V3_REFUND_STATUSES: Record<string, StatusEntry> = {
  completed: {
    stage: "refund",
    outcome: "pending",
    meaning: "Initiated and waiting for disbursement (not final, despite the name)",
  },
  "completed-bank-transfer": {
    stage: "refund",
    outcome: "success",
    meaning: "Refund to a bank account succeeded",
  },
  "completed-momo": {
    stage: "refund",
    outcome: "success",
    meaning: "Refund to mobile money succeeded",
  },
  "completed-mpgs": { stage: "refund", outcome: "success", meaning: "Card refund succeeded" },
  "completed-offline": {
    stage: "refund",
    outcome: "success",
    meaning: "Processed offline or manually",
  },
  "completed-preauth": {
    stage: "refund",
    outcome: "success",
    meaning: "Refund of a preauthorized card transaction succeeded",
  },
  "pending-momo": { stage: "refund", outcome: "pending", meaning: "Mobile money refund pending" },
  "pending-bank-transfer": {
    stage: "refund",
    outcome: "pending",
    meaning: "Bank account refund pending",
  },
  "pending-mpgs": { stage: "refund", outcome: "pending", meaning: "Card refund pending" },
  processing: { stage: "refund", outcome: "pending", meaning: "Being processed" },
};

/**
 * Chargeback statuses (v3 and v4). A dispute's result for the merchant is
 * kept in the status; the normalized outcome stays unknown, like for other
 * providers.
 */
export const CHARGEBACK_STATUSES: Record<string, string> = {
  initiated: "Initiated; the amount is withheld and the merchant notified",
  pending: "Merchant notified, no action taken yet",
  accepted: "Accepted by the merchant",
  declined: "Declined by the merchant with proof",
  won: "Dispute won",
  lost: "Dispute lost, or no response before the due date",
  reversed: "The withheld amount was restored",
  new: "New (v4 schema)",
};

/** Chargeback stages: `new`, `second`, `pre-arbitration` (v3); v4 adds two. */
export const CHARGEBACK_STAGES: Record<string, string> = {
  new: "First chargeback",
  second: "Second chargeback",
  "pre-arbitration": "Pre-arbitration",
  arbitration: "Arbitration (v4)",
  invalid: "Invalid (v4)",
};

/** v3 `meta.authorization.mode` values (next step of a charge). */
export const V3_AUTH_MODES: Record<string, { stage: LifecycleStage; meaning: string }> = {
  pin: { stage: "authentication", meaning: "The card PIN is required" },
  avs_noauth: { stage: "authentication", meaning: "The billing address is required" },
  otp: { stage: "authentication", meaning: "An OTP must be validated" },
  redirect: { stage: "authentication", meaning: "Redirect the customer (3-D Secure)" },
  banktransfer: { stage: "payment", meaning: "The customer must make a bank transfer" },
  ussd: { stage: "payment", meaning: "The customer must dial a USSD code" },
  qr: { stage: "payment", meaning: "The customer must scan a QR code" },
  fawry_pay: { stage: "payment", meaning: "The customer must pay through Fawry" },
  redirecturl: { stage: "payment", meaning: "Redirect the customer to complete the payment" },
};

/** v3 `auth_model` values seen in examples. */
export const V3_AUTH_MODELS = new Set([
  "PIN",
  "VBVSECURECODE",
  "NOAUTH",
  "noauth",
  "AUTH",
  "LIPA_MPESA",
  "USSD",
  "MOBILEMONEY",
  "INTERNET_BANKING",
  "CAPITEC",
  "NIBSS-QR",
]);

/** v3 `payment_type` values seen in examples. */
export const V3_PAYMENT_TYPES = new Set([
  "card",
  "account",
  "bank_transfer",
  "mpesa",
  "ussd",
  "mobilemoneysn",
  "mobilemoneytz",
  "1voucher",
  "fawry_pay",
  "capitec",
  "nibss-qr",
  "account-ach-us",
]);

// ---------------------------------------------------------------------------
// v3 webhook events
// ---------------------------------------------------------------------------

export type V3EventEntry = {
  object: "transaction" | "transfer" | "chargeback" | null;
  /** Fixed stage for event names that decide it; otherwise from the status. */
  stage?: LifecycleStage;
  meaning: string;
};

/** v3 `event` values that PandaPayLens analyzes. */
export const V3_EVENTS: Record<string, V3EventEntry> = {
  "charge.completed": {
    object: "transaction",
    meaning:
      "A charge reached a final state (any payment method, success or failure, preauth capture)",
  },
  "preauth-card": {
    object: "transaction",
    meaning: "A card preauthorization is held and waiting for capture",
  },
  "transfer.completed": {
    object: "transfer",
    meaning: "A transfer reached a final state (payouts, wallet funding, sub-account inflows)",
  },
  "chargeback.initiated": { object: "chargeback", stage: "dispute", meaning: "Chargeback opened" },
  "chargeback.accepted": {
    object: "chargeback",
    stage: "dispute",
    meaning: "Chargeback accepted by the merchant",
  },
  "chargeback.declined": {
    object: "chargeback",
    stage: "dispute",
    meaning: "Chargeback declined by the merchant",
  },
  "chargeback.lost": { object: "chargeback", stage: "dispute", meaning: "Chargeback lost" },
};

/**
 * v3 events outside payments acceptance. They are recognized but not
 * analyzed (their payloads can carry identity or bill data).
 */
export const V3_OTHER_EVENTS = new Set([
  "subscription.cancelled",
  "bvn.completed",
  "singlebillpayment.status",
  "account.tokenize",
  "quote.completed",
]);

/** v3 `event.type` values seen in the webhook examples. */
export const V3_EVENT_TYPE_VALUES = new Set([
  "CARD_TRANSACTION",
  "BANK_TRANSFER_TRANSACTION",
  "ACCOUNT_TRANSACTION",
  "ACCOUNT-ACH-UK_TRANSACTION",
  "MOBILEMONEYZM_TRANSACTION",
  "OPAY_TRANSACTION",
  "ENAIRA_TRANSACTION",
  "FAWRY_PAY_TRANSACTION",
  "CAPITEC_TRANSACTION",
  "1VOUCHER_TRANSACTION",
  "Transfer",
  "BVN",
  "QUOTE",
  "SingleBillPayment",
]);

// ---------------------------------------------------------------------------
// v3 messages
// ---------------------------------------------------------------------------

export type TextEntry = ErrorEntry & {
  /** The message as documented; `<...>` marks a variable part. */
  text: string;
  /** How the text is matched: whole text, prefix, or a template with variable parts. */
  match: "exact" | "prefix" | "template";
  /** For `prefix`, the documented part that must start the message. */
  prefix?: string;
  confidence: "strong" | "possible";
  docs: string;
};

const msg = (
  text: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  docs: string,
  extra: Partial<Pick<TextEntry, "match" | "prefix" | "definitive" | "confidence">> = {},
): TextEntry => ({
  text,
  meaning,
  category,
  retry,
  docs,
  match: extra.match ?? "exact",
  confidence: extra.confidence ?? "strong",
  ...(extra.prefix ? { prefix: extra.prefix } : {}),
  ...(extra.definitive ? { definitive: true } : {}),
});

/** v3 error envelope `message` values (status "error"): 27 documented messages. */
export const V3_ERROR_MESSAGES: readonly TextEntry[] = [
  msg(
    "merchant secret key required",
    "The request carried no secret key",
    "configuration",
    "do_not_retry",
    V3_COMMON_ERRORS_URL,
  ),
  msg(
    "Authorization required",
    "Missing or invalid authorization (HTTP 401)",
    "configuration",
    "do_not_retry",
    V3_COMMON_ERRORS_URL,
  ),
  msg(
    "Cardno is required",
    "The card number is missing (HTTP 400)",
    "invalid_request",
    "do_not_retry",
    V3_COMMON_ERRORS_URL,
  ),
  msg(
    "<field> is required",
    "A required parameter is missing",
    "invalid_request",
    "do_not_retry",
    V3_VALIDATE_CHARGE_URL,
    { match: "template" },
  ),
  msg(
    "Please specify the following parameters in body: <fields>",
    "Required body parameters are missing",
    "invalid_request",
    "do_not_retry",
    V3_GHANA_MOMO_URL,
    { match: "prefix", prefix: "Please specify the following parameters in body:" },
  ),
  msg(
    "Application error. Please contact support",
    "Flutterwave server error (HTTP 500, code app_error)",
    "provider_unavailable",
    "retry_conditionally",
    V3_COMMON_ERRORS_URL,
  ),
  msg(
    "An error occurred. Please contact support",
    "Flutterwave stopped waiting after about 28 seconds (HTTP 503); the operation may still complete",
    "network_or_timeout",
    "retry_conditionally",
    V3_TIMEOUTS_URL,
  ),
  msg(
    "No transaction was found for this id",
    "The transaction id passed to verify does not exist",
    "invalid_request",
    "do_not_retry",
    V3_VERIFY_URL,
  ),
  msg(
    "invalid currency",
    "The currency is not valid for this charge",
    "invalid_request",
    "do_not_retry",
    V3_NG_ACCOUNT_URL,
  ),
  msg(
    "Bad Request - Invalid PhoneNumber",
    "The phone number is not valid for M-PESA",
    "invalid_request",
    "customer_action_required",
    V3_MPESA_URL,
  ),
  msg(
    "Merchant is not enabled for Capitec Collections",
    "Capitec collections are not enabled for the merchant",
    "configuration",
    "do_not_retry",
    V3_CAPITEC_URL,
  ),
  msg(
    "Merchant does not accept <cardType> card type",
    "The merchant does not accept this card type",
    "payment_method_unavailable",
    "customer_action_required",
    V3_CARD_URL,
    { match: "template", definitive: true },
  ),
  msg(
    "Wrong token or email passed",
    "The card token or the e-mail address does not match",
    "invalid_request",
    "do_not_retry",
    V3_TOKEN_CHARGE_URL,
  ),
  msg(
    "Card expired. You've exceeded the failed attempt limit on this card. ... Ref: <hex>",
    "Card velocity limit after an expired card error; an immediate retry is blocked",
    "card_declined",
    "customer_action_required",
    V3_CARD_URL,
    {
      match: "prefix",
      prefix: "Card expired. You've exceeded the failed attempt limit on this card.",
      definitive: true,
    },
  ),
  msg(
    "Your card has been temporarily restricted due to multiple incorrect PIN attempts. ... Ref: <hex>",
    "Card velocity limit after repeated wrong PIN attempts",
    "authentication_failed",
    "customer_action_required",
    V3_CARD_URL,
    {
      match: "prefix",
      prefix: "Your card has been temporarily restricted due to multiple incorrect PIN attempts.",
      definitive: true,
    },
  ),
  msg(
    "Declined: Restricted card. You've exceeded the failed attempt limit on this card. ... Ref: <hex>",
    "Card velocity limit after a restricted card error",
    "card_declined",
    "customer_action_required",
    V3_CARD_URL,
    {
      match: "prefix",
      prefix: "Declined: Restricted card. You've exceeded the failed attempt limit on this card.",
      definitive: true,
    },
  ),
  msg(
    "Transaction with ref <flw_ref> either does not exist or is not a valid preauth transaction",
    "Capture, void or refund was sent for an unknown or non-preauth transaction",
    "invalid_request",
    "do_not_retry",
    V3_PREAUTH_URL,
    { match: "template" },
  ),
  msg(
    "Total amount for multiple captures must not exceed preauth charged amount.",
    "The captures together exceed the preauthorized amount",
    "invalid_amount",
    "do_not_retry",
    V3_PREAUTH_URL,
  ),
  msg(
    "Amount should be above NGN100",
    "Below the refund minimum",
    "invalid_amount",
    "do_not_retry",
    V3_REFUNDS_URL,
  ),
  msg(
    "Error: Refund Id Not Found",
    "The refund id does not exist",
    "invalid_request",
    "do_not_retry",
    V3_REFUND_LOOKUP_URL,
  ),
  msg(
    "no hook data found",
    "No webhook exists to resend for this transaction",
    "invalid_request",
    "do_not_retry",
    V3_RESEND_HOOK_URL,
  ),
  msg(
    "Transfer creation failed",
    "The transfer was created and failed; the reason is in data.complete_message",
    "unknown",
    "manual_review",
    V3_CREATE_TRANSFER_URL,
    { definitive: true },
  ),
  msg(
    "No account number or recipient identifier passed",
    "The transfer request has no destination",
    "invalid_request",
    "do_not_retry",
    V3_CREATE_TRANSFER_URL,
  ),
  msg(
    "Payout with this ref already exists",
    "The transfer reference was already used",
    "duplicate_request",
    "do_not_retry",
    V3_CREATE_TRANSFER_URL,
  ),
  msg(
    "Payout was made to a blacklisted account number",
    "The destination account is blocked",
    "fraud_or_risk",
    "do_not_retry",
    V3_TESTING_URL,
    { definitive: true },
  ),
  msg(
    "Transfer not found",
    "The transfer id does not exist (HTTP 404)",
    "invalid_request",
    "do_not_retry",
    V3_GET_TRANSFER_URL,
  ),
  msg(
    "Insufficient funds in merchant's NGN wallet",
    "The merchant's NGN balance cannot cover the operation",
    "insufficient_funds",
    "retry_conditionally",
    V3_OTP_URL,
  ),
];

/**
 * v3 card velocity trigger errors (direct card charge page). Flutterwave names
 * these errors but does not show them as literal response strings, so they
 * are matched exactly and decoded with possible confidence. Flutterwave
 * advises against automatic retries for failed card charges.
 */
export const V3_VELOCITY_TRIGGERS: readonly TextEntry[] = [
  ["Expired card", "Card expired (retry limit: 1 attempt per month)", "card_declined"],
  [
    "Expired card capture",
    "Card expired at capture (retry limit: 1 attempt per month)",
    "card_declined",
  ],
  [
    "Invalid card number",
    "Card number not valid (retry limit: 2 attempts per 24 hours)",
    "invalid_request",
  ],
  [
    "PIN tries exceeded",
    "Too many wrong PIN attempts (retry limit: 2 attempts per 24 hours)",
    "authentication_failed",
  ],
  ["Restricted card", "Restricted card (retry limit: 1 attempt per 24 hours)", "card_declined"],
  [
    "Security violation",
    "Security violation (retry limit: 2 attempts per 24 hours)",
    "fraud_or_risk",
  ],
  ["Stolen card", "Card reported stolen (retry limit: 1 attempt per month)", "fraud_or_risk"],
  ["Suspected fraud", "Suspected fraud (retry limit: 1 attempt per 24 hours)", "fraud_or_risk"],
].map(([text, meaning, category]) =>
  msg(text!, meaning!, category as ErrorCategory, "do_not_retry", V3_CARD_URL, {
    confidence: "possible",
    definitive: true,
  }),
);

/** v3 `processor_response` values documented on failed transactions. */
export const V3_PROCESSOR_FAILURES: readonly TextEntry[] = [
  msg(
    "invalid token supplied",
    "The card token is not valid",
    "invalid_request",
    "do_not_retry",
    V3_WEBHOOKS_URL,
    { definitive: true },
  ),
  msg(
    "Transaction cancelled by user",
    "The customer cancelled the payment",
    "unknown",
    "customer_action_required",
    V3_ACH_URL,
    { definitive: true },
  ),
  msg(
    "Your payment has been declined. It looks like the consent request was not approved. ...",
    "The customer did not approve the Capitec consent request",
    "authentication_failed",
    "customer_action_required",
    V3_SA_ACCOUNT_URL,
    {
      match: "prefix",
      prefix: "Your payment has been declined. It looks like the consent request was not approved.",
      definitive: true,
    },
  ),
];

/** v3 `processor_response` values documented as success or acceptance texts. */
export const V3_PROCESSOR_SUCCESS_TEXTS = new Set(
  [
    "Approved",
    "Approved by Financial Institution",
    "Approved Or Completed Successfully",
    "Approved. Successful",
    "successful",
    "success",
    "Transaction successful",
    "received successfully",
    "request successful",
  ].map((t) => t.toLowerCase()),
);

/** v3 `processor_response` values documented on pending transactions. */
export const V3_PROCESSOR_PENDING_TEXTS = new Set(
  [
    "Transaction in progress",
    "Pending validation",
    "Request is pending",
    "transaction is pending",
    "Pending user action",
    "Request Accepted",
    "QR GENERATED. PENDING VALIDATION",
    "You have 10 minutes to complete this payment. Thank You",
  ].map((t) => t.toLowerCase()),
);

/** Pending `processor_response` values that ask the customer to authenticate. */
export const V3_PROCESSOR_AUTH_PROMPTS: readonly { prefix: string; shown: string }[] = [
  {
    prefix: "Pending redirect to issuer's 3DS authentication page",
    shown: "Pending redirect to issuer's 3DS authentication page",
  },
  // The documented text ends with a masked phone number, which is not shown.
  { prefix: "Kindly enter the OTP sent to", shown: "Kindly enter the OTP sent to [redacted]" },
];

/** The v3 void response reports status `successful` with this text. */
export const V3_VOID_TEXT = "charge voided";

/** v3 transfer `complete_message` values on failed transfers. */
export const V3_TRANSFER_FAILURES: readonly TextEntry[] = [
  msg(
    "DISBURSE FAILED: You can only spend NGN 1000000.00 at once",
    "The amount is above the single transfer limit",
    "invalid_amount",
    "do_not_retry",
    V3_WEBHOOKS_URL,
    { match: "prefix", prefix: "DISBURSE FAILED: You can only spend", definitive: true },
  ),
  msg(
    "DISBURSE FAILED: Insufficient funds in customer wallet",
    "The merchant balance cannot cover the transfer",
    "insufficient_funds",
    "retry_conditionally",
    V3_TRANSFERS_URL,
    { definitive: true },
  ),
  msg(
    "DISBURSE FAILED: Invalid admin user passed",
    "The transfer was rejected for an invalid admin user",
    "unknown",
    "manual_review",
    V3_TRANSFERS_URL,
    { definitive: true },
  ),
  msg(
    "Beneficiary not found",
    "The beneficiary could not be found",
    "invalid_request",
    "customer_action_required",
    V3_TRANSFERS_URL,
    { definitive: true },
  ),
  msg(
    "Account resolve failed",
    "The destination account could not be resolved",
    "invalid_request",
    "customer_action_required",
    V3_TRANSFERS_URL,
    { definitive: true },
  ),
  msg(
    "beneficiary_name is required",
    "The beneficiary name is missing",
    "invalid_request",
    "do_not_retry",
    V3_CREATE_TRANSFER_URL,
    { definitive: true },
  ),
];

/** Documented prefix of failed disbursement messages (v3 and v4). */
export const DISBURSE_FAILED_PREFIX = "DISBURSE FAILED:";

/** v3 transfer `complete_message` values that are not failures. */
export const V3_TRANSFER_PROGRESS_TEXTS = new Set(
  ["Transaction is currently being processed", "Transaction was successful", "Successful"].map(
    (t) => t.toLowerCase(),
  ),
);

/** HTTP statuses documented for v3 errors, used when the message is not recognized. */
export const V3_HTTP_FALLBACK: Record<number, ErrorEntry & { docs: string }> = {
  400: {
    meaning: "Validation error (HTTP 400)",
    category: "invalid_request",
    retry: "do_not_retry",
    docs: V3_COMMON_ERRORS_URL,
  },
  401: {
    meaning: "Authorization error (HTTP 401)",
    category: "configuration",
    retry: "do_not_retry",
    docs: V3_COMMON_ERRORS_URL,
  },
  429: {
    meaning: "Rate limit reached (HTTP 429); Flutterwave advises backing off",
    category: "rate_limiting",
    retry: "retry_conditionally",
    docs: V3_RATE_LIMIT_URL,
  },
  500: {
    meaning: "Flutterwave server error (HTTP 500)",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    docs: V3_COMMON_ERRORS_URL,
  },
  503: {
    meaning:
      "Flutterwave stopped waiting after about 28 seconds (HTTP 503); the operation may still complete",
    category: "network_or_timeout",
    retry: "retry_conditionally",
    docs: V3_TIMEOUTS_URL,
  },
};

// ---------------------------------------------------------------------------
// v4 statuses
// ---------------------------------------------------------------------------

/** v4 charge `status` (schema `charge_status`). */
export const V4_CHARGE_STATUSES: Record<string, StatusEntry> = {
  succeeded: { stage: "payment", outcome: "success", meaning: "The charge succeeded" },
  pending: { stage: "payment", outcome: "pending", meaning: "The charge is pending" },
  failed: { stage: "payment", outcome: "failure", meaning: "The charge failed" },
  voided: { stage: "void", outcome: "success", meaning: "The charge was voided" },
};

/** v4 transfer `status` (schema `transfer_get`). */
export const V4_TRANSFER_STATUSES: Record<string, StatusEntry> = {
  NEW: { stage: "payout", outcome: "pending", meaning: "Created" },
  INITIATED: { stage: "payout", outcome: "pending", meaning: "Initiated" },
  PENDING: { stage: "payout", outcome: "pending", meaning: "Being processed" },
  SUCCESSFUL: { stage: "payout", outcome: "success", meaning: "The transfer succeeded" },
  FAILED: { stage: "payout", outcome: "failure", meaning: "The transfer failed" },
  CANCELLED: { stage: "payout", outcome: "failure", meaning: "The transfer was cancelled" },
};

/**
 * v4 refund `status` (schema `refund`). The prose describes new, pending,
 * succeeded and failed; `completed` is listed in the schema without a meaning
 * and is shown as unknown.
 */
export const V4_REFUND_STATUSES: Record<string, StatusEntry> = {
  new: { stage: "refund", outcome: "pending", meaning: "Refund created" },
  pending: { stage: "refund", outcome: "pending", meaning: "Refund pending" },
  requires_action: { stage: "refund", outcome: "pending", meaning: "Refund requires action" },
  succeeded: { stage: "refund", outcome: "success", meaning: "Refund succeeded" },
  failed: { stage: "refund", outcome: "failure", meaning: "Refund failed" },
  cancelled: { stage: "refund", outcome: "failure", meaning: "Refund cancelled" },
  completed: {
    stage: "refund",
    outcome: "unknown",
    meaning: "Listed in the schema without a documented meaning",
  },
};

/** v4 `next_action.type` values (schema discriminator). */
export const V4_NEXT_ACTIONS: Record<string, { stage: LifecycleStage; meaning: string }> = {
  redirect_url: { stage: "authentication", meaning: "Redirect the customer" },
  requires_additional_fields: {
    stage: "authentication",
    meaning: "More customer fields are required",
  },
  requires_pin: { stage: "authentication", meaning: "The card PIN is required" },
  requires_otp: { stage: "authentication", meaning: "An OTP is required" },
  requires_requery: {
    stage: "payment",
    meaning: "Timed out; retrieve the charge instead of sending a new one",
  },
  requires_capture: { stage: "authorization", meaning: "Authorized; waiting for capture" },
  payment_instruction: { stage: "payment", meaning: "The customer must follow instructions" },
  requires_bank_transfer: { stage: "payment", meaning: "The customer must make a bank transfer" },
  qr_code: { stage: "payment", meaning: "The customer must scan a QR code" },
};

/** v4 webhook `type` values: the `base_webhook_payload` enum plus `refund.completed`. */
export const V4_WEBHOOK_TYPES: Record<
  string,
  { object: "charge" | "transfer" | "refund" | null; meaning: string }
> = {
  "charge.completed": { object: "charge", meaning: "A charge reached a final state" },
  "transfer.disburse": { object: "transfer", meaning: "A transfer was disbursed or failed" },
  "transfer.reversal": { object: "transfer", meaning: "A transfer was reversed" },
  "refund.completed": { object: "refund", meaning: "A refund completed" },
  // The payload of this event is not documented beyond the enum value.
  "order.authorization": { object: null, meaning: "An order authorization update" },
};

// ---------------------------------------------------------------------------
// v4 codes
// ---------------------------------------------------------------------------

export type V4CodeEntry = ErrorEntry & { code: string; type: string; table: string };

type Row = [
  code: string,
  type: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
];

const rows = (table: string, list: Row[]): V4CodeEntry[] =>
  list.map(([code, type, meaning, category, retry]) => ({
    code,
    type,
    meaning,
    category,
    retry,
    table,
  }));

/** v4 collections (inflow) error codes: 77 rows, 67 distinct codes. */
export const V4_COLLECTION_ERRORS: readonly V4CodeEntry[] = rows("collections", [
  [
    "10400",
    "REQUEST_NOT_VALID",
    "Body malformed or required parameters missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "10401",
    "UNAUTHORIZED",
    "Missing, expired or wrong credentials",
    "configuration",
    "do_not_retry",
  ],
  [
    "10403",
    "FORBIDDEN",
    "Credentials lack permission for the resource",
    "configuration",
    "do_not_retry",
  ],
  [
    "10404",
    "RESOURCE_NOT_FOUND",
    "Endpoint or object does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  ["10405", "METHOD_NOT_ALLOWED", "Wrong HTTP method", "invalid_request", "do_not_retry"],
  [
    "10409",
    "RESOURCE_CONFLICT",
    "Duplicate or conflicting data",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "10422",
    "UNPROCESSABLE",
    "Well-formed request with invalid field values",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "10500",
    "INTERNAL_SERVER_ERROR",
    "Unexpected Flutterwave error",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "701500",
    "INVALID_PAGINATION_TYPE",
    "Page or limit parameters badly formatted",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1100409",
    "CHARGE_ALREADY_EXISTS",
    "Charge reference already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1101422",
    "CUSTOMER_NOT_FOUND_FOR_CHARGE",
    "customer_id does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1102422",
    "PAYMENT_METHOD_NOT_FOUND_FOR_CHARGE",
    "payment_method_id invalid or belongs to another customer",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1104400",
    "CARD_NOT_TOKENIZED",
    "Raw card data sent where a token was expected",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1105500",
    "CHARGE_FAILED",
    "General processing failure upstream",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1106400",
    "PAYMENT_METHOD_TYPE_MISSING",
    "Payment method type missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1107500",
    "CHARGE_CREATION_FAILED",
    "System error while creating the charge; Flutterwave says to retry",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ],
  [
    "1108400",
    "CARD_RETOKENIZATION_REQUIRED",
    "Encryption or token invalid or expired; the card must be tokenized again",
    "invalid_request",
    "customer_action_required",
  ],
  ["1110404", "CHARGE_NOT_FOUND", "Charge id does not exist", "invalid_request", "do_not_retry"],
  [
    "1111400",
    "CHARGE_FINALIZED",
    "Charge already has a final status",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1112400",
    "CHARGE_UPDATE_NOT_ALLOWED",
    "Charge state does not allow the update",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1113500",
    "CHARGE_UPDATE_FAILED",
    "System error while updating the charge",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1114400",
    "ACCOUNT_ID_NOT_FOUND",
    "Internal merchant account configuration problem",
    "configuration",
    "manual_review",
  ],
  [
    "1118400",
    "INVALID_CARD_NUMBER",
    "Wrong card number length or Luhn check failure",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "1119500",
    "FAILED_TO_INITIATE_CHARGE",
    "Payment provider rejected the initialization",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1121400",
    "INVALID_AUTHORIZATION",
    "Wrong PIN or OTP",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "1122400",
    "FAILED_TO_VALIDATE_EXISTING_CHARGE",
    "Error while checking a previous transaction",
    "unknown",
    "retry_conditionally",
  ],
  [
    "1125400",
    "CURRENCY_NOT_SUPPORTED",
    "Currency not supported for this payment type",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "1126400",
    "MOBILE_MONEY_COUNTRY_CODE_NOT_SUPPORTED",
    "Country code not valid for mobile money",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "1127400",
    "MOBILE_MONEY_NETWORK_NOT_SUPPORTED",
    "Mobile network not supported in the region",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "1128500",
    "PAYMENT_CARD_TOKENIZATION_FAILED",
    "Card encryption failed; check keys and logic",
    "configuration",
    "do_not_retry",
  ],
  [
    "1130400",
    "AMOUNT_BELOW_MINIMUM",
    "Amount below the minimum for the payment type",
    "invalid_amount",
    "do_not_retry",
  ],
  ["1134422", "CARD_EXPIRED", "Card has expired", "card_declined", "customer_action_required"],
  [
    "1135422",
    "CARD_EXPIRY_YEAR_OUT_OF_RANGE",
    "Expiry year invalid",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "1136422",
    "CARD_EXPIRY_MONTH_OUT_OF_RANGE",
    "Expiry month not between 01 and 12",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "1137400",
    "CLIENT_ENCRYPTION_ERROR",
    "Encrypted fields could not be decrypted (wrong key or logic)",
    "configuration",
    "do_not_retry",
  ],
  [
    "1138422",
    "UNPROCESSABLE_F4B_RESPONSE",
    "Error received from the banking partner system",
    "provider_unavailable",
    "manual_review",
  ],
  [
    "1139422",
    "UNPROCESSABLE_CC_RESPONSE",
    "Error received from the card network or scheme",
    "provider_unavailable",
    "manual_review",
  ],
  [
    "1140400",
    "CHARGE_NOT_SUCCESSFUL",
    "Declined by the bank or by fraud checks",
    "card_declined",
    "customer_action_required",
  ],
  [
    "1141400",
    "REDIRECT_URL_INVALID",
    "Redirect URL format incorrect",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1142400",
    "USSD_BANK_CODE_INVALID",
    "USSD bank code incorrect",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1150400",
    "INVALID_CHARGE",
    "Bank transfer charges must use the virtual accounts resource",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1100409",
    "ORDER_ALREADY_EXISTS",
    "Order reference already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1101422",
    "CUSTOMER_NOT_FOUND_FOR_ORDER",
    "Order customer_id invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1102422",
    "PAYMENT_METHOD_NOT_FOUND_FOR_ORDER",
    "Order payment_method_id invalid",
    "invalid_request",
    "do_not_retry",
  ],
  ["1110404", "ORDER_NOT_FOUND", "Order id does not exist", "invalid_request", "do_not_retry"],
  [
    "1111400",
    "ORDER_FINALIZED",
    "Order already has a final status",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1112400",
    "ORDER_UPDATE_NOT_ALLOWED",
    "Order state does not allow updates",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1143400",
    "CAPTURE_AMOUNT_INVALID",
    "Capture amount larger than the authorized order amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "1144400",
    "PAYMENT_METHOD_MISMATCH",
    "Charge payment method differs from the order's",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1144400",
    "CUSTOMER_MISMATCH",
    "Charge customer differs from the order's",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1144400",
    "CURRENCY_MISMATCH",
    "Charge currency differs from the order's",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1145400",
    "CAPTURE_VOID_NOT_ALLOWED",
    "Order not in a state that allows capture or void",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1145400",
    "PAYMENT_METHOD_INVALID",
    "Payment method not valid for this order type",
    "invalid_request",
    "do_not_retry",
  ],
  ["1401404", "REFUND_NOT_FOUND", "Refund id does not exist", "invalid_request", "do_not_retry"],
  [
    "1402400",
    "REFUND_AMOUNT_INVALID",
    "Refund larger than the charge amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "1403400",
    "REFUND_CREATION_FAILED",
    "Refund attempted on a pending transaction",
    "invalid_request",
    "retry_conditionally",
  ],
  [
    "1404400",
    "REFUND_ALREADY_COMPLETED",
    "Charge already fully refunded",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1500404",
    "SETTLEMENT_NOT_FOUND",
    "Settlement id does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1600400",
    "WEBHOOK_URL_INVALID",
    "Webhook URL not a valid HTTP or HTTPS URL",
    "configuration",
    "do_not_retry",
  ],
  [
    "1601404",
    "WEBHOOK_ENDPOINT_NOT_FOUND",
    "No webhook configuration for the account",
    "configuration",
    "do_not_retry",
  ],
  [
    "1602422",
    "UNPROCESSABLE_SVIX_RESPONSE",
    "Error from the webhook delivery provider (Svix)",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1603500",
    "INTERNAL_SERVER_ERROR_SVIX",
    "System failure at the webhook delivery provider",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1700404",
    "CHARGEBACK_NOT_FOUND",
    "Chargeback id does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1703400",
    "CHARGEBACK_DECLINE_INVALID",
    "Declining a chargeback needs a comment and proof",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1704400",
    "CHARGEBACK_PROOF_INVALID",
    "Uploaded proof corrupted or in an unsupported format",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1705500",
    "CHARGEBACK_PROOF_UPLOAD_FAILED",
    "System error while uploading proof",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1706400",
    "CHARGEBACK_DUE_DATE_INVALID",
    "Response deadline has passed",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1707400",
    "CHARGEBACK_AMOUNT_INVALID",
    "Amount does not match the dispute amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "1708400",
    "CHARGEBACK_HAS_EXISTING_CHARGE",
    "A dispute already exists for this charge",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1800404",
    "CHECKOUT_SESSION_NOT_FOUND",
    "Checkout session missing or expired",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1801409",
    "CHECKOUT_SESSION_ALREADY_EXISTS",
    "Checkout session reference already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1900404",
    "VIRTUAL_ACCOUNT_NOT_FOUND",
    "Virtual account reference does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "1900409",
    "VIRTUAL_ACCOUNT_REFERENCE_ALREADY_EXISTS",
    "Virtual account reference already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "1900500",
    "VIRTUAL_ACCOUNT_UPDATE_FAILED",
    "System error while updating the virtual account",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "1900500",
    "FAILED_TO_CREATE_VIRTUAL_ACCOUNT",
    "System error while creating the virtual account",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "10503",
    "VIRTUAL_ACCOUNT_CREATE_TIMEOUT",
    "Provider too slow to generate the account; Flutterwave says to retry",
    "network_or_timeout",
    "safe_to_retry_technical_request",
  ],
  [
    "19400",
    "VIRTUAL_ACCOUNT_IS_ALREADY_INACTIVE",
    "Virtual account already deactivated",
    "invalid_request",
    "do_not_retry",
  ],
]);

/** v4 payout error codes: 70 rows, 68 distinct codes. */
export const V4_PAYOUT_ERRORS: readonly V4CodeEntry[] = rows("payouts", [
  [
    "0301",
    "TRANSFER_AMOUNT_EXCEEDS_LIMIT",
    "Above the maximum for a single transfer",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "0302",
    "TRANSFER_AMOUNT_BELOW_LIMIT",
    "Below the minimum transfer amount",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "0303",
    "MONTHLY_TRANSFER_LIMIT_EXCEEDED",
    "Account's monthly cumulative limit reached",
    "configuration",
    "retry_conditionally",
  ],
  [
    "0304",
    "DAILY_TRANSFER_LIMIT_EXCEEDED",
    "Account's daily cumulative limit reached",
    "configuration",
    "retry_conditionally",
  ],
  [
    "0305",
    "TRANSFER_LIMIT_NOT_SET_FOR_CURRENCY",
    "No limit configured for the currency; contact support",
    "configuration",
    "manual_review",
  ],
  [
    "0306",
    "PAYOUT_CREATION_FAILED",
    "Temporary service timeout; Flutterwave says to retry",
    "network_or_timeout",
    "retry_conditionally",
  ],
  [
    "0307",
    "INSUFFICIENT_BALANCE",
    "Merchant wallet cannot cover amount plus fee",
    "insufficient_funds",
    "retry_conditionally",
  ],
  [
    "0308",
    "SERVICE_UNAVAILABLE",
    "Bank maintenance or network downtime",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "0309",
    "TRANSFER_FAILED",
    "Destination closed or dormant, or network failure",
    "unknown",
    "manual_review",
  ],
  [
    "0310",
    "PRICING_NOT_SET",
    "Transfer fee could not be determined; contact support",
    "configuration",
    "manual_review",
  ],
  [
    "0311",
    "CURRENCY_CONVERSION_NOT_SET",
    "Exchange rate not configured for a cross-currency transfer",
    "configuration",
    "manual_review",
  ],
  [
    "0312",
    "REJECTED_RECIPIENT_MERCHANT",
    "Compliance or risk restriction on the destination",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "0313",
    "INVALID_BANK_CODE",
    "Bank code incorrect or outdated",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "0314",
    "UNABLE_TO_DETERMINE_COUNTRY",
    "Country not derivable from the bank code, or bank code and currency mismatch",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "270400",
    "RECIPIENT_NOT_FOUND",
    "recipient_id does not exist",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "270409",
    "RECIPIENT_ALREADY_EXISTS",
    "Recipient already created",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "280409",
    "SENDER_ALREADY_EXISTS",
    "Sender already created",
    "duplicate_request",
    "do_not_retry",
  ],
  ["280400", "SENDER_NOT_FOUND", "sender_id does not exist", "invalid_request", "do_not_retry"],
  ["281400", "UNKNOWN_SENDER_TYPE", "Sender type not supported", "invalid_request", "do_not_retry"],
  [
    "262400",
    "ACCOUNT_DETAILS_CHANGED",
    "The bank updated or migrated the account details",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "260400",
    "BENEFICIARY_ACCOUNT_NOT_SUPPORTED",
    "Receiving account type not supported",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  ["252400", "UNKNOWN_BANK_CODE", "Bank code not recognized", "invalid_request", "do_not_retry"],
  [
    "251400",
    "INVALID_ACCOUNT",
    "Account number invalid or nonexistent",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "250400",
    "ACCOUNT_VERIFICATION_FAILED",
    "Account details could not be verified with the bank",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "501422",
    "RATE_UNAVAILABLE_ERROR",
    "Exchange rate for the pair currently unavailable",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["301404", "RATE_NOT_FOUND", "Rate id does not exist", "invalid_request", "do_not_retry"],
  [
    "404400",
    "REQUIRES_FAILED_STATUS",
    "Only failed transfers can be retried",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "201409",
    "REFERENCE_ALREADY_EXISTS",
    "Transfer reference already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "403400",
    "SCHEDULED_DEFERRED_NOT_ALLOWED",
    "Scheduled or deferred transfers cannot be retried or duplicated",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "401400",
    "REQUIRES_SUCCESSFUL_STATUS",
    "Only successful transfers can be duplicated",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "204400",
    "REQUIRES_DISBURSE_OPTION",
    "Scheduled payout without disburse_option",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "205400",
    "REQUIRES_TIMEZONE",
    "disburse_option.timezone missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "206400",
    "REQUIRES_DATETIME",
    "disburse_option.date_time missing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "231400",
    "INVALID_DISBURSE_DATETIME",
    "date_time not in YYYY-MM-DD HH:MM:SS 24-hour format",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "207400",
    "DISBURSETIME_RESTRICTION",
    "Scheduled time must be more than 30 minutes ahead",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "215400",
    "COMPLIANCE_APPROVAL_REQUIRED",
    "Merchant KYC not completed",
    "configuration",
    "manual_review",
  ],
  [
    "214400",
    "TRANSFER_SERVICE_UNAVAILABLE",
    "Transfer service temporarily unavailable or disabled",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "216400",
    "TRANSFER_SOURCE_REQUIRED",
    "No transfer preference selected in the dashboard settings",
    "configuration",
    "do_not_retry",
  ],
  [
    "217400",
    "TRANSFER_SOURCE_DISABLED",
    "Transfers disabled for the account",
    "configuration",
    "do_not_retry",
  ],
  [
    "218400",
    "API_TRANSFER_DISABLED",
    "Transfers via API not enabled",
    "configuration",
    "do_not_retry",
  ],
  [
    "219400",
    "NG_DOM_TRANSFER_UNAVAILABLE",
    "This transfer option is temporarily unavailable",
    "payment_method_unavailable",
    "retry_conditionally",
  ],
  [
    "220400",
    "IP_WHITELISTING_REQUIRED",
    "No IP addresses whitelisted",
    "configuration",
    "do_not_retry",
  ],
  [
    "221400",
    "NON_WHITELISTED_IP",
    "Request from an IP that is not whitelisted",
    "configuration",
    "do_not_retry",
  ],
  ["222400", "BLACKLISTED_IP", "Request from a blocked IP", "fraud_or_risk", "manual_review"],
  [
    "223400",
    "BLACKLISTED_ACCOUNT_NUMBER",
    "Destination account blocked",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "226400",
    "XAF_TRANSFER_ONLY",
    "Only XAF-to-XAF transfers allowed without approval",
    "configuration",
    "do_not_retry",
  ],
  [
    "405400",
    "POSSIBLE_DUPLICATE_RETRIES",
    "A previous retry is pending or succeeded",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    "227400",
    "TRANSFER_OPTION_UNAVAILABLE",
    "Requested transfer type temporarily unavailable",
    "payment_method_unavailable",
    "retry_conditionally",
  ],
  [
    "228400",
    "TRANSFER_AMOUNT_LIMIT",
    "Amount outside the allowed minimum or maximum",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "229400",
    "ZAMBIA_TRANSFER_UNAVAILABLE",
    "Zambia payouts only for merchants registered and approved in Zambia",
    "configuration",
    "do_not_retry",
  ],
  [
    "230400",
    "UNSUPPORTED_MOBILE_MONEY_COUNTRY",
    "XOF mobile money destination country not supported",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "230401",
    "INVALID_MOBILE_NUMBER",
    "MSISDN format invalid for the destination (Republic of the Congo XAF rule)",
    "invalid_request",
    "customer_action_required",
  ],
  ["301404", "TRANSFER_NOT_FOUND", "Transfer id does not exist", "invalid_request", "do_not_retry"],
  [
    "210400",
    "INVALID_CURSOR",
    "Pagination cursor (next) invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "212400",
    "MERCHANT_WALLET_NOT_FOUND",
    "No wallet for the destination currency",
    "configuration",
    "do_not_retry",
  ],
  [
    "213400",
    "UNSUPPORTED_CURRENCY_PAIRS",
    "Source and destination currencies cannot be combined",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "302400",
    "INVALID_TRANSFER_STATUS",
    "Only transfers in NEW status can be updated",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "208400",
    "INVALID_DISBURSE_ACTION",
    "Disburse action not one of the supported values",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "304400",
    "TIME_LIMIT_EXCEEDED",
    "Scheduled or deferred time passed before processing",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "303400",
    "TRANSFER_NOT_DEFERRED_SCHEDULED",
    "Only deferred or scheduled transfers can be updated",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "211400",
    "INVALID_TRANSFER_TYPE",
    "Transfer type not supported",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "261400",
    "UNABLE_TO_CONFIRM_BANK_NOT_COP_PARTICIPANT",
    "Beneficiary bank not in the Confirmation of Payee service",
    "payment_method_unavailable",
    "manual_review",
  ],
  [
    "209400",
    "UNSUPPORTED_CASHPICKUP_INSTRUCTION",
    "Cash pickup payload invalid (syntax error)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "232400",
    "UNSUPPORTED_CRYPTO_INSTRUCTION",
    "Crypto payload invalid (syntax error)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "209400",
    "UNSUPPORTED_MOMO_INSTRUCTION",
    "Mobile money payload invalid (syntax error)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "203400",
    "UNSUPPORTED_BANK_INSTRUCTION",
    "Bank transfer payload invalid (syntax error)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "202400",
    "UNSUPPORTED_WALLET_INSTRUCTION",
    "Wallet transfer payload invalid (syntax error)",
    "invalid_request",
    "do_not_retry",
  ],
  [
    "202500",
    "TRANSFER_HANDLER_NOT_SET",
    "Internal error; retry later",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "10500",
    "INTERNAL_SERVER_ERROR",
    "Unexpected error; contact support",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [
    "253400",
    "MERCHANT_DOES_NOT_EXIST",
    "Merchant id (wallet transfer destination) does not exist",
    "invalid_request",
    "do_not_retry",
  ],
]);

/**
 * Type spellings that differ between the v4 tables: the general table spells
 * the 401 type `UNAUTHORIZATION`, the collections table `UNAUTHORIZED`.
 */
export const V4_TYPE_ALIASES: Record<string, string> = { UNAUTHORIZATION: "UNAUTHORIZED" };

/** v4 error entries by `code|type`. Both tables agree where a pair repeats. */
export const V4_ERRORS_BY_PAIR: ReadonlyMap<string, V4CodeEntry> = new Map(
  [...V4_COLLECTION_ERRORS, ...V4_PAYOUT_ERRORS].map((e) => [`${e.code}|${e.type}`, e]),
);

/** v4 error entries by code alone; a code with several meanings has several entries. */
export const V4_ERRORS_BY_CODE: ReadonlyMap<string, readonly V4CodeEntry[]> = (() => {
  const m = new Map<string, V4CodeEntry[]>();
  for (const e of [...V4_COLLECTION_ERRORS, ...V4_PAYOUT_ERRORS]) {
    const list = m.get(e.code);
    if (!list) m.set(e.code, [e]);
    else if (!list.some((x) => x.type === e.type)) list.push(e);
  }
  return m;
})();

export type ProcessorEntry = ErrorEntry & { code: string; type: string };

type PRow = [
  code: string,
  type: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
];

/**
 * v4 card `processor_response` (charge schema enum, also the `issuer:` values
 * on the v4 testing page): 45 codes. `00` approved is not an error.
 */
export const V4_PROCESSOR_RESPONSES: readonly ProcessorEntry[] = (
  [
    ["00", "approved", "Approved", "unknown", "unknown"],
    [
      "01",
      "refer_to_issuer",
      "The issuer asks the cardholder to contact it",
      "card_declined",
      "customer_action_required",
    ],
    [
      "02",
      "refer_to_issuer_special_condition",
      "Refer to issuer, special condition",
      "card_declined",
      "customer_action_required",
    ],
    [
      "03",
      "invalid_merchant",
      "Merchant not valid for this transaction",
      "configuration",
      "manual_review",
    ],
    [
      "04",
      "pick_up_card_no_fraud",
      "Card to be retained, no fraud indicated",
      "card_declined",
      "do_not_retry",
    ],
    ["05", "do_not_honor", "Generic issuer decline", "card_declined", "customer_action_required"],
    ["06", "error", "Processing error", "unknown", "retry_conditionally"],
    [
      "07",
      "pick_up_card_fraud",
      "Card to be retained, fraud indicated",
      "fraud_or_risk",
      "do_not_retry",
    ],
    ["10", "partial_approval", "Only part of the amount approved", "unknown", "manual_review"],
    ["12", "invalid_transaction", "Transaction not valid", "invalid_request", "do_not_retry"],
    ["13", "invalid_amount", "Amount not valid", "invalid_amount", "do_not_retry"],
    [
      "14",
      "invalid_account_number",
      "Card or account number not valid",
      "card_declined",
      "customer_action_required",
    ],
    ["15", "no_such_issuer", "Issuer unknown", "card_declined", "customer_action_required"],
    [
      "19",
      "reenter_transaction",
      "Submit the transaction again",
      "network_or_timeout",
      "retry_conditionally",
    ],
    ["21", "no_action_taken", "The issuer took no action", "unknown", "manual_review"],
    [
      "25",
      "unable_to_locate_record_in_file",
      "Record not found at the issuer",
      "unknown",
      "manual_review",
    ],
    [
      "28",
      "file_temporarily_not_available",
      "Issuer file temporarily unavailable",
      "provider_unavailable",
      "retry_conditionally",
    ],
    ["41", "lost_card_pick_up", "Card reported lost", "fraud_or_risk", "do_not_retry"],
    ["43", "stolen_card_pick_up", "Card reported stolen", "fraud_or_risk", "do_not_retry"],
    [
      "51",
      "insufficient_funds",
      "Not enough funds",
      "insufficient_funds",
      "customer_action_required",
    ],
    [
      "52",
      "no_checking_account",
      "No checking account",
      "card_declined",
      "customer_action_required",
    ],
    ["53", "no_savings_account", "No savings account", "card_declined", "customer_action_required"],
    ["54", "expired_card", "Card expired", "card_declined", "customer_action_required"],
    ["55", "incorrect_pin", "Wrong PIN", "authentication_failed", "customer_action_required"],
    [
      "57",
      "transaction_not_permitted_card",
      "Transaction not allowed for this card",
      "card_declined",
      "customer_action_required",
    ],
    [
      "58",
      "transaction_not_permitted_terminal",
      "Transaction not allowed for this terminal or merchant",
      "configuration",
      "manual_review",
    ],
    ["59", "suspected_fraud", "The issuer suspects fraud", "fraud_or_risk", "do_not_retry"],
    [
      "61",
      "exceeds_approval_amount_limit",
      "Above the card's amount limit",
      "card_declined",
      "customer_action_required",
    ],
    [
      "62",
      "invalid_restricted_service_code",
      "Restricted card",
      "card_declined",
      "customer_action_required",
    ],
    ["63", "security_violation", "Security violation", "fraud_or_risk", "do_not_retry"],
    [
      "64",
      "transaction_does_not_fulfill_aml_req",
      "Anti-money-laundering requirement not met",
      "fraud_or_risk",
      "manual_review",
    ],
    [
      "65",
      "exceeds_withdrawal_limit",
      "Above the card's frequency or withdrawal limit",
      "card_declined",
      "customer_action_required",
    ],
    [
      "70",
      "pin_data_required",
      "PIN needed",
      "authentication_required",
      "customer_action_required",
    ],
    [
      "75",
      "pin_entry_tries_exceeded",
      "Too many wrong PIN attempts",
      "authentication_failed",
      "customer_action_required",
    ],
    [
      "76",
      "unsolicited_reversal",
      "Reversal without a matching request",
      "unknown",
      "manual_review",
    ],
    [
      "78",
      "blocked_first_use",
      "Card blocked until first use activation",
      "card_declined",
      "customer_action_required",
    ],
    ["79", "already_reversed", "Transaction already reversed", "duplicate_request", "do_not_retry"],
    [
      "82",
      "negative_cvv_result",
      "CVV check failed",
      "authentication_failed",
      "customer_action_required",
    ],
    [
      "85",
      "no_reason_to_decline",
      "No reason to decline (verification-type answer)",
      "unknown",
      "manual_review",
    ],
    [
      "86",
      "cannot_verify_pin",
      "PIN could not be verified",
      "authentication_failed",
      "customer_action_required",
    ],
    [
      "91",
      "issuer_unavailable",
      "Issuer or switch not reachable",
      "provider_unavailable",
      "retry_conditionally",
    ],
    [
      "92",
      "unable_to_route_transaction",
      "Transaction could not be routed",
      "provider_unavailable",
      "retry_conditionally",
    ],
    [
      "93",
      "cannot_complete_violation_of_law",
      "Cannot complete, legal violation",
      "fraud_or_risk",
      "do_not_retry",
    ],
    ["96", "system_error", "System malfunction", "provider_unavailable", "retry_conditionally"],
    ["97", "invalid_cvv", "CVV invalid", "invalid_request", "customer_action_required"],
  ] as PRow[]
).map(([code, type, meaning, category, retry]) => ({ code, type, meaning, category, retry }));

export const V4_PROCESSOR_BY_TYPE: ReadonlyMap<string, ProcessorEntry> = new Map(
  V4_PROCESSOR_RESPONSES.map((e) => [e.type, e]),
);

/**
 * v4 payout `provider_response.type` values (transfer schema): the lower-case
 * forms of payout codes 0301-0314, plus `invalid_wallet_currency`, which has
 * no documented code or meaning.
 */
export const V4_PROVIDER_RESPONSE_TYPES: readonly string[] = [
  ...V4_PAYOUT_ERRORS.slice(0, 14).map((e) => e.type.toLowerCase()),
  "invalid_wallet_currency",
];

/** Generic next steps by category. */
export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or contact their bank. Do not retry the same card automatically.",
  authentication_required: "Complete the requested authentication step with the customer.",
  authentication_failed:
    "Ask the customer to authenticate again or use another payment method. Do not retry automatically.",
  invalid_request: "Correct the request data before sending it again.",
  invalid_amount: "Correct the amount so it is within the documented limits.",
  insufficient_funds:
    "Ask the customer to use another payment method, or fund the merchant balance for payouts.",
  payment_method_unavailable: "Offer another payment method or destination.",
  fraud_or_risk: "Do not retry. Review the transaction for risk before taking further action.",
  rate_limiting: "Slow down and retry later with backoff.",
  provider_unavailable:
    "Check the operation's status with Flutterwave before sending a new request.",
  network_or_timeout:
    "Query the transaction or transfer status first. Flutterwave advises waiting for the webhook when the status is pending, and retrying only when no record exists.",
  duplicate_request:
    "Look up the existing operation with this reference instead of creating a new one.",
  configuration: "Check the account settings, keys and permissions in the Flutterwave dashboard.",
  unknown: "Check the transaction in the Flutterwave dashboard.",
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry the same request; it will not succeed until the cause is fixed.",
  customer_action_required: "A retry only makes sense after the customer has acted.",
  retry_conditionally:
    "Verify the original operation's status first (verify by transaction id, or get the transfer by reference). Retry only when no record exists, and never as a blind repeat.",
  safe_to_retry_technical_request:
    "Flutterwave says this request can be retried; reuse the same idempotency key so a retry cannot create a second charge.",
  manual_review: "Review the case manually before taking further action.",
  unknown: "No retry guidance is documented for this case.",
};
