/**
 * Trustly code and status knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/trustly.md, which
 * cites Trustly's public API reference (docs.trustly.com) and the North
 * America developer site (amer.developers.trustly.com), verified 2026-10-25.
 *
 * Trustly runs two separate API families with their own envelopes, status
 * vocabularies and identifiers: the EU JSON-RPC 1.1 API (with its
 * notifications) and the North America (AMER) REST API v1 (with its event
 * notifications). Every table below belongs to one family and is never used
 * for the other one.
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions from the research file, not Trustly statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const EU = "https://docs.trustly.com/api";
const AMER = "https://amer.developers.trustly.com";

export const EU_PROTOCOL_URL = `${EU}/api-protocol`;
export const EU_ERROR_HANDLING_URL = `${EU}/error-handling`;
export const EU_AUTHENTICATION_URL = `${EU}/authentication`;
export const EU_NOTIFICATIONS_URL = `${EU}/notifications-overview`;
export const EU_CREDIT_URL = `${EU}/credit-notification`;
export const EU_DEBIT_URL = `${EU}/debit-notification`;
export const EU_PENDING_URL = `${EU}/pending-notification`;
export const EU_CANCEL_URL = `${EU}/cancel-notification`;
export const EU_ACCOUNT_URL = `${EU}/account-notification`;
export const EU_KYC_URL = `${EU}/kyc-notification`;
export const EU_PAYOUT_CONFIRMATION_URL = `${EU}/payout-confirmation`;
export const EU_PAYOUT_FAILED_URL = `${EU}/payoutfailed-notification`;
export const EU_PAYOUT_DOWNGRADED_URL = `${EU}/payout-downgraded-notification`;
export const EU_VERIFY_ACCOUNT_URL = `${EU}/verifyaccount-notification`;
export const EU_ASSESS_ACCOUNT_URL = `${EU}/accountassessment-notification`;
export const EU_MDD_NOTIFICATIONS_URL = `${EU}/mdd-notifications-for-directdebit`;
export const EU_DEPOSIT_URL = `${EU}/deposit`;
export const EU_REFUND_URL = `${EU}/refund`;
export const EU_ACCOUNT_PAYOUT_URL = `${EU}/accountpayout`;
export const EU_APPROVE_WITHDRAWAL_URL = `${EU}/approvewithdrawal`;
export const EU_GET_WITHDRAWALS_URL = `${EU}/getwithdrawals`;
export const EU_MERCHANT_SETTLEMENT_URL = `${EU}/merchantsettlement`;
export const EU_SWISH_URL = `${EU}/swish`;
export const EU_SWISH_PAYOUT_URL = `${EU}/swish-payout`;
export const EU_SWISH_REFUND_URL = `${EU}/swish-refund`;
export const EU_IDEAL_URL = `${EU}/ideal`;
export const EU_BANCONTACT_WIP_URL = `${EU}/bancontact-wip`;
export const EU_MBWAY_URL = `${EU}/mbway`;
export const EU_CHECKOUT_CORE_URL = `${EU}/checkout-core`;
export const EU_TDD_CHARGE_URL = `${EU}/tdd-charge`;
export const EU_CONFIRMATION_OF_PAYEE_URL = `${EU}/confirmationofpayee`;
export const EU_VERIFICATION_OF_PAYEE_URL = `${EU}/verificationofpayee`;
export const EU_GAMING_DEPOSIT_URL = "https://docs.trustly.com/deposit/integration-gaming";
export const EU_GAMING_PAYOUT_URL = "https://docs.trustly.com/payout/integration-gaming";
export const EU_FAQ_URL = "https://docs.trustly.com/get-started/faq";

export const AMER_API_URL = `${AMER}/api-reference/api.md`;
export const AMER_OPENAPI_URL = `${AMER}/openapi.json`;
export const AMER_STATUS_CODES_URL = `${AMER}/integrate/api-fundamentals/status-codes-and-type-definitions.md`;
export const AMER_WEBHOOKS_URL = `${AMER}/integrate/core-concepts/webhooks-and-events.md`;
export const AMER_SIGNATURE_URL = `${AMER}/integrate/api-fundamentals/secure-requests-and-signature-validation/validate-the-notification-signature.md`;
export const AMER_TRANSACTIONS_URL = `${AMER}/integrate/core-concepts/transactions-and-transaction-ids.md`;
export const AMER_IDEMPOTENCY_URL = `${AMER}/integrate/api-fundamentals/idempotency.md`;

export type ErrorMapping = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
};

// ---------------------------------------------------------------------------
// EU JSON-RPC API
// ---------------------------------------------------------------------------

export type EuErrorEntry = ErrorMapping & {
  name: string;
  /** Pages (other than error handling) where Trustly lists the code. */
  docs: readonly string[];
  /** False when the code leaves the outcome of the request open. */
  outcomeKnown: boolean;
};

type EuRow = [
  code: number,
  name: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  docs?: readonly string[],
];

const EU_ROWS: readonly EuRow[] = [
  [
    102,
    "ERROR_RATE_LIMIT",
    "A third-party limit was reached; the request was denied and can be retried later (Confirmation and Verification of Payee)",
    "rate_limiting",
    "retry_conditionally",
    [EU_CONFIRMATION_OF_PAYEE_URL, EU_VERIFICATION_OF_PAYEE_URL],
  ],
  [
    602,
    "ERROR_FUNCTION_ACCESS_DENIED",
    "The merchant has no access to this method",
    "configuration",
    "do_not_retry",
  ],
  [
    603,
    "ERROR_INSUFFICIENT_FUNDS",
    "The merchant balance at Trustly is too low (refund, settlement)",
    "insufficient_funds",
    "manual_review",
    [EU_REFUND_URL, EU_MERCHANT_SETTLEMENT_URL],
  ],
  [
    607,
    "ERROR_HOST_ACCESS_DENIED",
    "The caller IP address is not whitelisted",
    "configuration",
    "do_not_retry",
  ],
  [
    615,
    "ERROR_INVALID_AMOUNT",
    "The amount must be above 0 with 2 decimals (for a refund: not above the original amount)",
    "invalid_amount",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    616,
    "ERROR_INVALID_CREDENTIALS",
    "Wrong API username or password",
    "configuration",
    "do_not_retry",
  ],
  [
    619,
    "ERROR_NETWORK",
    "Temporary connectivity issue with the payment system provider (iDEAL)",
    "network_or_timeout",
    "retry_conditionally",
    [EU_IDEAL_URL],
  ],
  [
    620,
    "ERROR_UNKNOWN",
    "Unspecified error; some pages say a retry might succeed",
    "unknown",
    "retry_conditionally",
  ],
  [
    621,
    "ERROR_NO_SUITABLE_BANK_ACCOUNT_FOUND",
    "No earlier settlement in this currency (MerchantSettlement)",
    "configuration",
    "manual_review",
    [EU_MERCHANT_SETTLEMENT_URL],
  ],
  [622, "ERROR_INVALID_CURRENCY_CODE", "Invalid currency code", "invalid_request", "do_not_retry"],
  [
    623,
    "ERROR_INVALID_PARAMETERS",
    "A value does not match the expected format",
    "invalid_request",
    "do_not_retry",
  ],
  [
    624,
    "ERROR_INVALID_BANK_ACCOUNT_NUMBER",
    "The bank account number, IBAN or AccountID is invalid (the text varies by page)",
    "invalid_request",
    "customer_action_required",
  ],
  [
    625,
    "ERROR_INVALID_SORT_CODE",
    "Invalid sort code (Confirmation of Payee)",
    "invalid_request",
    "customer_action_required",
    [EU_CONFIRMATION_OF_PAYEE_URL],
  ],
  [
    627,
    "ERROR_NOT_FOUND",
    "Settlements for the date could not be executed because the requirements were not met",
    "configuration",
    "manual_review",
    [EU_MERCHANT_SETTLEMENT_URL],
  ],
  [
    636,
    "ERROR_UNABLE_TO_VERIFY_RSA_SIGNATURE",
    "The request signature failed verification (wrong key or serialisation)",
    "configuration",
    "do_not_retry",
    [EU_AUTHENTICATION_URL],
  ],
  [
    637,
    "ERROR_DUPLICATE_MESSAGE_ID",
    "The MessageID was already used",
    "duplicate_request",
    "do_not_retry",
  ],
  [
    638,
    "ERROR_ENDUSER_IS_BLOCKED",
    "The end user is on a blocking list",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    639,
    "ERROR_NO_PUBLIC_KEY",
    "No merchant public key is configured at Trustly",
    "configuration",
    "do_not_retry",
    [EU_AUTHENTICATION_URL],
  ],
  [
    642,
    "ERROR_INVALID_EMAIL",
    "The email is missing or invalid",
    "invalid_request",
    "do_not_retry",
  ],
  [645, "ERROR_INVALID_LOCALE", "The locale value is invalid", "invalid_request", "do_not_retry"],
  [
    655,
    "ERROR_INVALID_ORDER_ID",
    "The OrderID in the refund does not exist",
    "invalid_request",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    670,
    "ERROR_REFUND_EXCEED_DEPOSIT_VOLUME",
    "The refund is larger than the remaining deposit amount",
    "invalid_amount",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    671,
    "ERROR_DEPOSIT_NOT_CAPTURED_OR_SETTLED",
    "The deposit failed and was never settled",
    "invalid_request",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    672,
    "ERROR_MULTIPLE_REFUND_ATTEMPT",
    "Only one refund is allowed (Finnish Bank Buttons deposits)",
    "invalid_request",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    676,
    "ERROR_SETTLEMENTS_NOT_PROCESSED",
    "Settlements for that date are not processed yet",
    "provider_unavailable",
    "retry_conditionally",
    [EU_MERCHANT_SETTLEMENT_URL],
  ],
  [
    688,
    "ERROR_DUPLICATE_UUID",
    "The UUID was already used",
    "duplicate_request",
    "do_not_retry",
    [EU_PROTOCOL_URL],
  ],
  [696, "ERROR_ENDUSERID_IS_NULL", "EndUserID is null", "invalid_request", "do_not_retry"],
  [697, "ERROR_MESSAGEID_IS_NULL", "MessageID is null", "invalid_request", "do_not_retry"],
  [
    698,
    "ERROR_INVALID_IP",
    "The IP attribute is invalid (only one address is allowed)",
    "invalid_request",
    "do_not_retry",
  ],
  [700, "ERROR_MALFORMED_SUCCESSURL", "SuccessURL is malformed", "invalid_request", "do_not_retry"],
  [701, "ERROR_MALFORMED_FAILURL", "FailURL is malformed", "invalid_request", "do_not_retry"],
  [
    702,
    "ERROR_MALFORMED_TEMPLATEURL",
    "TemplateURL is malformed",
    "invalid_request",
    "do_not_retry",
  ],
  [703, "ERROR_MALFORMED_URLTARGET", "URLTarget is malformed", "invalid_request", "do_not_retry"],
  [704, "ERROR_MALFORMED_MESSAGEID", "MessageID is malformed", "invalid_request", "do_not_retry"],
  [
    705,
    "ERROR_MALFORMED_NOTIFICATIONURL",
    "NotificationURL is malformed",
    "invalid_request",
    "do_not_retry",
  ],
  [706, "ERROR_MALFORMED_ENDUSERID", "EndUserID is malformed", "invalid_request", "do_not_retry"],
  [
    712,
    "ERROR_DIRECT_DEBIT_NOT_ALLOWED",
    "Trustly Direct Debit is not enabled for the merchant",
    "configuration",
    "do_not_retry",
    [EU_TDD_CHARGE_URL],
  ],
  [
    716,
    "ERROR_REFUND_PENDING",
    "A refund is already queued for this OrderID",
    "duplicate_request",
    "do_not_retry",
    [EU_REFUND_URL],
  ],
  [
    717,
    "ERROR_INVALID_ORDER_ATTRIBUTE",
    "One or more attributes have wrong values",
    "invalid_request",
    "do_not_retry",
  ],
  [718, "ERROR_DISABLED_USER", "The merchant user is disabled", "configuration", "do_not_retry"],
  [
    732,
    "ERROR_PAY_AND_PLAY_NOT_ALLOWED",
    "Pay N Play is not enabled",
    "configuration",
    "do_not_retry",
    [EU_DEPOSIT_URL],
  ],
  [
    734,
    "ERROR_NOT_SECURE_NOTIFICATIONURL",
    "NotificationURL must use HTTPS",
    "configuration",
    "do_not_retry",
  ],
  [737, "ERROR_INVALID_COUNTRY", "The country code is invalid", "invalid_request", "do_not_retry"],
  [
    739,
    "ERROR_INVALID_MERCHANT_SWISH_NUMBER",
    "Invalid merchant Swish number",
    "configuration",
    "do_not_retry",
    [EU_SWISH_URL],
  ],
  [
    740,
    "ERROR_INVALID_SWISH_PAYER",
    "The Swish payer is not enrolled",
    "payment_method_unavailable",
    "customer_action_required",
    [EU_SWISH_URL],
  ],
  [
    741,
    "ERROR_INVALID_SWISH_MESSAGE",
    "Badly formatted Swish message",
    "invalid_request",
    "do_not_retry",
    [EU_SWISH_URL],
  ],
  [
    742,
    "ERROR_AGE_LIMITED_SWISH_PAYER",
    "The payer is below the age limit",
    "payment_method_unavailable",
    "do_not_retry",
    [EU_SWISH_URL],
  ],
  [
    743,
    "ERROR_SSN_UNMATCHED_SWISH_PAYER",
    "The payer alias and SSN or organisation number do not match",
    "invalid_request",
    "customer_action_required",
    [EU_SWISH_URL],
  ],
  [
    744,
    "ERROR_ONGOING_PAYMENT_FOR_SWISH_PAYER",
    "A payment request already exists for the payer",
    "duplicate_request",
    "retry_conditionally",
    [EU_SWISH_URL],
  ],
  [
    745,
    "ERROR_SWISH_COUNTERPART_NOT_ACTIVATED",
    "The Swish counterpart is not activated",
    "payment_method_unavailable",
    "customer_action_required",
    [EU_SWISH_URL],
  ],
  [
    746,
    "ERROR_SWISH_PAYER_NOT_ENROLLED",
    "The payer is not enrolled",
    "payment_method_unavailable",
    "customer_action_required",
    [EU_SWISH_URL],
  ],
  [
    747,
    "ERROR_MERCHANT_SWISH_NUMBER_NOT_ENROLLED",
    "The merchant Swish number is not enrolled",
    "configuration",
    "do_not_retry",
    [EU_SWISH_URL],
  ],
  [
    748,
    "ERROR_INSUFFICIENT_FUNDS_IN_ACCOUNT",
    "Insufficient funds for the Swish refund",
    "insufficient_funds",
    "manual_review",
    [EU_SWISH_REFUND_URL],
  ],
  [
    749,
    "ERROR_SWISH_PAYEE_NOT_ENROLLED",
    "The payee is not enrolled for payouts",
    "payment_method_unavailable",
    "customer_action_required",
    [EU_SWISH_PAYOUT_URL],
  ],
  [
    750,
    "ERROR_SSN_UNMATCHED_SWISH_PAYEE",
    "The payee SSN differs from the original payer (the number moved)",
    "fraud_or_risk",
    "manual_review",
    [EU_SWISH_PAYOUT_URL],
  ],
  [
    751,
    "ERROR_RECIPIENT_EXCEEDED_AMOUNT_LIMIT",
    "The amount is too large or above the refundable remainder",
    "invalid_amount",
    "do_not_retry",
    [EU_SWISH_PAYOUT_URL, EU_SWISH_REFUND_URL],
  ],
  [
    755,
    "ERROR_INVALID_ACCOUNT_ID",
    "The AccountID is invalid (Checkout Core)",
    "invalid_request",
    "do_not_retry",
    [EU_CHECKOUT_CORE_URL],
  ],
  [
    759,
    "ERROR_AZURA_SESSION_EXPIRED",
    "The AzuraSessionID expired (30 minute lifetime)",
    "authentication_required",
    "customer_action_required",
    [EU_CHECKOUT_CORE_URL],
  ],
  [
    760,
    "ERROR_AZURA_ACCOUNT_NOT_FOUND",
    "The AccountID was not found",
    "invalid_request",
    "do_not_retry",
    [EU_CHECKOUT_CORE_URL],
  ],
  [
    761,
    "ERROR_MALFORMED_SHOPPERSTATEMENT",
    "ShopperStatement is malformed",
    "invalid_request",
    "do_not_retry",
  ],
  [767, "ERROR_MALFORMED_FIRSTNAME", "Firstname is malformed", "invalid_request", "do_not_retry"],
  [769, "ERROR_MALFORMED_LASTNAME", "Lastname is malformed", "invalid_request", "do_not_retry"],
  [
    772,
    "ERROR_MALFORMED_MERCHANT_USERNAME",
    "Username is malformed",
    "configuration",
    "do_not_retry",
  ],
  [
    783,
    "ERROR_BANCONTACTWIP_AGREEMENT_FAILED",
    "Agreement creation failed; Trustly says to try again",
    "payment_method_unavailable",
    "retry_conditionally",
    [EU_BANCONTACT_WIP_URL],
  ],
  [
    784,
    "ERROR_BANCONTACTWIP_AGRREMENT_REVOKED_BY_CONSUMER",
    "The consumer revoked the agreement",
    "payment_method_unavailable",
    "do_not_retry",
    [EU_BANCONTACT_WIP_URL],
  ],
  [
    785,
    "ERROR_BANCONTACTWIP_AGRREMENT_REVOKED_BY_MERCHANT",
    "The merchant revoked the agreement",
    "payment_method_unavailable",
    "do_not_retry",
    [EU_BANCONTACT_WIP_URL],
  ],
  [
    786,
    "ERROR_BANCONTACTWIP_AGRREMENT_REVOKE_FAILED",
    "Revoking the agreement failed",
    "provider_unavailable",
    "retry_conditionally",
    [EU_BANCONTACT_WIP_URL],
  ],
  [
    787,
    "ERROR_BANCONTACTWIP_AGREEMENT_ID",
    "Problem with the agreement ID",
    "invalid_request",
    "do_not_retry",
    [EU_BANCONTACT_WIP_URL],
  ],
  [
    788,
    "ERROR_PAYER_PHONE_NUMBER",
    "The phone number is invalid or not registered with MB Way",
    "invalid_request",
    "customer_action_required",
    [EU_MBWAY_URL],
  ],
  [
    790,
    "ERROR_AGREEMENT_FAILED",
    "Agreement creation failed; Trustly says to try again (MB Way)",
    "payment_method_unavailable",
    "retry_conditionally",
    [EU_MBWAY_URL],
  ],
  [
    791,
    "ERROR_AGRREMENT_REVOKED",
    "The agreement was revoked",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    792,
    "ERROR_AGRREMENT_REVOKE_FAILED",
    "Revoking the agreement failed",
    "provider_unavailable",
    "retry_conditionally",
  ],
  [793, "ERROR_AGREEMENT_ID", "Problem with the agreement ID", "invalid_request", "do_not_retry"],
  [
    794,
    "ERROR_MALFORMED_ACCOUNT_HOLDER_NAME",
    "The account holder name has invalid characters or length",
    "invalid_request",
    "customer_action_required",
  ],
];

// ERROR_NETWORK and ERROR_UNKNOWN do not say whether the call took effect.
const EU_OUTCOME_OPEN = new Set([619, 620]);

/** EU JSON-RPC error codes (74), keyed by the numeric code. */
export const EU_ERROR_CODES: Record<string, EuErrorEntry> = Object.fromEntries(
  EU_ROWS.map(([code, name, meaning, category, retry, docs]) => [
    String(code),
    { name, meaning, category, retry, docs: docs ?? [], outcomeKnown: !EU_OUTCOME_OPEN.has(code) },
  ]),
);

/** Error name to code, for errors that carry only the name. */
export const EU_ERROR_NAMES: Record<string, string> = Object.fromEntries(
  EU_ROWS.map(([code, name]) => [name, String(code)]),
);

/**
 * EU error names that appear outside the numbered tables. Their meaning
 * beyond the name is not documented.
 */
export const EU_OTHER_ERROR_NAMES: Record<string, { where: string; docs: readonly string[] }> = {
  ERROR_CHARGE_NOT_APPROVED: {
    where: "cancel notification attributes.reason in Merchant and Trustly Direct Debit examples",
    docs: [EU_MDD_NOTIFICATIONS_URL, EU_TDD_CHARGE_URL],
  },
  ERROR_ACCOUNT_NOT_FOUND: {
    where: 'data.rejected in a RemoveAzuraAccount result with "result": "0"',
    docs: [EU_CHECKOUT_CORE_URL],
  },
};

export type NotificationInfo = {
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  docs: readonly string[];
  /** The notification is opt-in per merchant, so its absence means nothing. */
  optIn?: true;
};

/** EU notification methods (12). Method names are case-sensitive. */
export const EU_NOTIFICATIONS: Record<string, NotificationInfo> = {
  pending: {
    stage: "payment",
    outcome: "pending",
    meaning:
      "The end user finished the Trustly flow, but the money has not been received yet. This is not a credited payment.",
    docs: [EU_PENDING_URL],
  },
  credit: {
    stage: "payment",
    outcome: "success",
    meaning:
      "Increase the end user's balance by this amount. For a Deposit this is when the funds are received and the item should be shipped. After an AccountPayout, Withdraw or Refund on the same order it means that payout or refund failed and the amount was returned.",
    docs: [EU_CREDIT_URL],
  },
  debit: {
    stage: "other",
    outcome: "unknown",
    meaning:
      "Decrease the end user's balance by this amount. After a credit on a Deposit it means the funds never settled and the credit is taken back; in the Withdraw flow it means the end user completed a withdrawal. Its effect depends on the merchant's reply (OK or FAILED), which the notification does not contain.",
    docs: [EU_DEBIT_URL],
  },
  cancel: {
    stage: "cancellation",
    outcome: "failure",
    meaning:
      "The order was cancelled: abandoned, closed, crashed, or never settled without an earlier credit. For a payout it means the payout failed.",
    docs: [EU_CANCEL_URL],
  },
  account: {
    stage: "other",
    outcome: "unknown",
    meaning:
      "Information about the end user's bank account (opt-in). It does not report a payment result.",
    docs: [EU_ACCOUNT_URL],
    optIn: true,
  },
  kyc: {
    stage: "other",
    outcome: "pending",
    meaning:
      "KYC check after the bank login and before the transfer; the merchant replies CONTINUE or FINISH. Abort variants end the flow.",
    docs: [EU_KYC_URL],
  },
  payoutconfirmation: {
    stage: "payout",
    outcome: "success",
    meaning:
      "The bank confirmed that the payout funds were sent (opt-in). A later credit notification can still report the payout as returned.",
    docs: [EU_PAYOUT_CONFIRMATION_URL],
    optIn: true,
  },
  payoutfailed: {
    stage: "payout",
    outcome: "failure",
    meaning: "The payout failed (opt-in, production only).",
    docs: [EU_PAYOUT_FAILED_URL],
    optIn: true,
  },
  payoutdowngraded: {
    stage: "payout",
    outcome: "pending",
    meaning:
      "SEPA Instant was not available and the payout fell back to SEPA Credit Transfer; the payout still reaches CONFIRMED (opt-in).",
    docs: [EU_PAYOUT_DOWNGRADED_URL],
    optIn: true,
  },
  verifyAccount: {
    stage: "other",
    outcome: "unknown",
    meaning: "Account verification notification (opt-in). It does not report a payment result.",
    docs: [EU_VERIFY_ACCOUNT_URL],
    optIn: true,
  },
  assessAccount: {
    stage: "other",
    outcome: "unknown",
    meaning: "Account Assessment notification (opt-in). It does not report a payment result.",
    docs: [EU_ASSESS_ACCOUNT_URL],
    optIn: true,
  },
  advice: {
    stage: "other",
    outcome: "unknown",
    meaning:
      "Merchant Direct Debit advice notification for BACS indemnity claims. Scheme details are not decoded.",
    docs: [EU_MDD_NOTIFICATIONS_URL],
  },
};

/** Documented merchant replies to a notification (`data.status`). */
export const EU_NOTIFICATION_REPLIES = new Set(["OK", "FAILED", "CONTINUE", "FINISH"]);

export type MethodInfo = {
  stage: LifecycleStage;
  meaning: string;
  docs: readonly string[];
  /** Outcome per documented `data.result` value; absent when the result has none. */
  results?: Readonly<Record<string, { outcome: Outcome; meaning: string }>>;
  /** Outcome when the result carries no `data.result`. */
  outcome?: Outcome;
};

/** EU JSON-RPC methods whose results have documented semantics (5). */
export const EU_METHODS: Record<string, MethodInfo> = {
  Deposit: {
    stage: "payment",
    outcome: "pending",
    meaning:
      "Deposit order created; the end user has not paid yet. The checkout URL carries a session and is not copied.",
    docs: [EU_DEPOSIT_URL],
  },
  Refund: {
    stage: "refund",
    meaning:
      "Refund request result. The orderid is the OrderID of the initial deposit. A failure is reported later by a credit notification to the deposit's NotificationURL.",
    docs: [EU_REFUND_URL],
    results: {
      "1": {
        outcome: "pending",
        meaning:
          "Refund accepted (queued if the deposit has not settled yet); its completion is not confirmed by this result",
      },
    },
  },
  AccountPayout: {
    stage: "payout",
    meaning: "AccountPayout request result.",
    docs: [EU_ACCOUNT_PAYOUT_URL],
    results: {
      "1": {
        outcome: "pending",
        meaning: "The payout was accepted; the bank has not confirmed it yet",
      },
      "0": { outcome: "failure", meaning: "The payout could not be accepted" },
    },
  },
  ApproveWithdrawal: {
    stage: "payout",
    meaning: "ApproveWithdrawal request result.",
    docs: [EU_APPROVE_WITHDRAWAL_URL],
    results: {
      "1": {
        outcome: "pending",
        meaning: "The withdrawal was approved; the bank has not confirmed it yet",
      },
      "0": { outcome: "failure", meaning: "The withdrawal could not be approved" },
    },
  },
  GetWithdrawals: {
    stage: "payout",
    meaning: "Withdrawal status lookup; each entry carries a transferstate.",
    docs: [EU_GET_WITHDRAWALS_URL],
  },
};

/** GetWithdrawals `transferstate` (11). Trustly may add, change or remove states. */
export const EU_TRANSFER_STATES: Record<string, { outcome: Outcome; meaning: string }> = {
  CONFIRMED: { outcome: "success", meaning: "Confirmed" },
  EXECUTING: { outcome: "pending", meaning: "Processed, not confirmed" },
  EXECUTED: { outcome: "pending", meaning: "Processed, not confirmed" },
  PENDING: { outcome: "pending", meaning: "Not processed yet" },
  QUEUED: { outcome: "pending", meaning: "Not processed yet" },
  PREPARING: { outcome: "pending", meaning: "Not processed yet" },
  PREPARED: { outcome: "pending", meaning: "Not processed yet" },
  BOUNCED: { outcome: "failure", meaning: "Failed" },
  ERROR: { outcome: "failure", meaning: "Failed" },
  FAILED: { outcome: "failure", meaning: "Failed" },
  RETURNED: { outcome: "failure", meaning: "Failed" },
};

/** Optional detailed cancel `orderstatuses` values (4). Trustly advises not to automate on them. */
export const EU_CANCEL_ORDER_STATUSES = new Set(["TIMEOUT", "ABORTED", "CRASHED", "LIMIT"]);

/** KYC abort messages (2). */
export const EU_KYC_ABORT_MESSAGES: Record<string, string> = {
  unverified: "The end user could not be verified",
  underage: "The end user is under age",
};

export type PayoutErrorEntry = ErrorMapping & { notification: string; informational?: true };

/**
 * `errorcode` values of payoutfailed and payoutdowngraded (2). Only these
 * example values are documented; the full list is not.
 */
export const EU_PAYOUT_ERROR_CODES: Record<string, PayoutErrorEntry> = {
  incorrect_account_number: {
    notification: "payoutfailed",
    meaning: "The format of the account number specified is not correct",
    category: "invalid_request",
    retry: "customer_action_required",
  },
  sepa_instant_downgrade: {
    notification: "payoutdowngraded",
    meaning: "SEPA Instant fell back to SEPA Credit Transfer; the payout still reaches CONFIRMED",
    category: "unknown",
    retry: "unknown",
    informational: true,
  },
};

// ---------------------------------------------------------------------------
// North America (AMER) REST API v1
// ---------------------------------------------------------------------------

export type AmerStatusInfo = {
  name: string;
  outcome: Outcome;
  /** Set when the status itself fixes the stage (refunds, reversals, cancellations). */
  stage?: LifecycleStage;
};

/** AMER Transaction `status` (14; 9 is not used). */
export const AMER_TRANSACTION_STATUSES: Record<string, AmerStatusInfo> = {
  "0": { name: "New", outcome: "pending" },
  "1": { name: "Pending", outcome: "pending" },
  "2": { name: "Authorized", outcome: "success" },
  "3": { name: "Processed", outcome: "pending" },
  "4": { name: "Completed", outcome: "success" },
  "5": { name: "Failed", outcome: "failure" },
  "6": { name: "Expired", outcome: "failure", stage: "cancellation" },
  "7": { name: "Canceled", outcome: "failure", stage: "cancellation" },
  "8": { name: "Denied", outcome: "failure" },
  "10": { name: "Reversed", outcome: "failure", stage: "reversal" },
  "11": { name: "Partially Refunded", outcome: "success", stage: "refund" },
  "12": { name: "Refunded", outcome: "success", stage: "refund" },
  "13": { name: "Voided", outcome: "failure", stage: "void" },
  "14": { name: "OnHold", outcome: "pending" },
};

/** AMER `transactionType` (12). */
export const AMER_TRANSACTION_TYPES: Record<string, { name: string; stage: LifecycleStage }> = {
  "0": { name: "External", stage: "other" },
  "1": { name: "Authorize", stage: "authorization" },
  "2": { name: "Pay", stage: "payment" },
  "3": { name: "Capture", stage: "capture" },
  "4": { name: "Refund", stage: "refund" },
  "5": { name: "Reverse", stage: "reversal" },
  "6": { name: "Deposit (payout to the consumer)", stage: "payout" },
  "7": { name: "Reclaim", stage: "other" },
  "8": { name: "Representment", stage: "other" },
  "9": { name: "Tokenization", stage: "other" },
  "10": { name: "Preauthorization", stage: "authorization" },
  "11": { name: "Guarantee", stage: "other" },
};

/** AMER `paymentType` (5). The number for Instant is not documented. */
export const AMER_PAYMENT_TYPES: Record<string, string> = {
  "2": "Deferred",
  "3": "Recurring",
  "4": "Disbursement",
  "5": "Verification",
  "6": "Retrieval",
};

export type AmerEventInfo = {
  /** Stage implied by the event type; otherwise the transaction type decides. */
  stage?: LifecycleStage;
  /** Outcome when the event carries no documented transaction status. */
  outcome: Outcome;
  meaning: string;
};

/** AMER event types (17). Only the names are documented; meanings are kept literal. */
export const AMER_EVENT_TYPES: Record<string, AmerEventInfo> = {
  Establish: { outcome: "pending", meaning: "Bank authorization flow established" },
  Authorize: { stage: "authorization", outcome: "unknown", meaning: "Authorization event" },
  DataReady: { stage: "other", outcome: "unknown", meaning: "Data is ready" },
  Update: { outcome: "unknown", meaning: "Transaction update" },
  Process: { outcome: "pending", meaning: "Transaction processed, not completed" },
  Complete: { outcome: "success", meaning: "Transaction completed" },
  Cancel: { stage: "cancellation", outcome: "failure", meaning: "Transaction cancelled" },
  Cancelled: { stage: "cancellation", outcome: "failure", meaning: "Transaction cancelled" },
  Expire: { stage: "cancellation", outcome: "failure", meaning: "Transaction expired" },
  Failed: { outcome: "failure", meaning: "Transaction failed" },
  Deny: { outcome: "failure", meaning: "Transaction denied" },
  Dispute: { stage: "dispute", outcome: "unknown", meaning: "Dispute reported" },
  Reconcile: { stage: "other", outcome: "unknown", meaning: "Reconciliation event" },
  Refund: { stage: "refund", outcome: "unknown", meaning: "Refund event" },
  Reverse: { stage: "reversal", outcome: "failure", meaning: "Transaction reversed" },
  Refresh: { stage: "other", outcome: "unknown", meaning: "Refresh event" },
  CONSENT_REVOKED: { stage: "other", outcome: "unknown", meaning: "The consumer revoked consent" },
};

export type AmerCodeEntry = ErrorMapping & {
  family: "SW" | "UC" | "AC" | "SE" | "EFT" | "UK_DD";
  /** Lifecycle state, not an error: shown as an attribute, not decoded. */
  notAnError?: true;
  /** The mapping is a weak suggestion (meaning not transcribed or generic). */
  weak?: true;
};

const sw = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  notAnError?: true,
): AmerCodeEntry => ({
  family: "SW",
  meaning,
  category,
  retry,
  ...(notAnError ? { notAnError } : {}),
});

/** SW codes (13): validation before submission to the ODFI. */
export const AMER_SW_CODES: Record<string, AmerCodeEntry> = {
  SW010: sw("Established (not an error)", "unknown", "unknown", true),
  SW013: sw("Cancelled by the user, browser or device", "unknown", "customer_action_required"),
  SW020: sw("Authorization received (not an error)", "unknown", "unknown", true),
  SW021: sw(
    "Authorization denied, for example insufficient funds",
    "insufficient_funds",
    "customer_action_required",
  ),
  SW051: sw("Merchant error (integration, invalid request)", "invalid_request", "do_not_retry"),
  SW052: sw("Financial institution error", "provider_unavailable", "retry_conditionally"),
  SW053: sw("Internal network error", "network_or_timeout", "retry_conditionally"),
  SW054: sw(
    "Suspicious activity (risk); Trustly says to try again later or use a different bank account",
    "fraud_or_risk",
    "retry_conditionally",
  ),
  SW055: sw("Negative data", "fraud_or_risk", "manual_review"),
  SW056: sw("Unsupported account type", "payment_method_unavailable", "customer_action_required"),
  SW057: sw("Expired split token", "authentication_required", "customer_action_required"),
  SW059: sw("Instant transaction rejected for risk", "fraud_or_risk", "do_not_retry"),
  SW060: sw("Bank or network processor down", "provider_unavailable", "retry_conditionally"),
};

const UC_PAGES: readonly string[] = [
  "bank selection",
  "login",
  "invalid login",
  "challenge question",
  "invalid challenge answers",
  "MFA",
  "invalid MFA",
  "account selection",
  "error page",
  "partial account number",
  "select account location",
  "bank not listed",
  "login with captcha",
  "captcha validation",
  "manual account input",
  "manual account confirmation",
  "MCD confirmation",
  "MCD validation",
  "account profile input",
  "no dynamic balance",
  "partial account not supported",
  "security script",
  "account not supported",
  "authorize page with exception",
  "bad account",
  "bank reset password",
  "bank unavailable",
  "external screen",
  "timeout",
  "invalid routing or account number on manual entry",
  "SWIFT or address not found",
  "maintenance page",
  "non-eligible currency",
  'OAuth "Connect to your bank"',
  '"Waiting for your approval"',
  "VAN info",
  "widget within Lightbox",
];

const UC_CATEGORY: Record<number, ErrorCategory> = {
  27: "provider_unavailable",
  29: "network_or_timeout",
  32: "provider_unavailable",
};

/** UC codes (37): the user left the flow on the named page. */
export const AMER_UC_CODES: Record<string, AmerCodeEntry> = Object.fromEntries(
  UC_PAGES.map((page, i) => [
    `UC${String(i + 1).padStart(2, "0")}`,
    {
      family: "UC",
      meaning: `User cancelled on: ${page}`,
      category: UC_CATEGORY[i + 1] ?? "unknown",
      retry: "customer_action_required",
    } satisfies AmerCodeEntry,
  ]),
);

const ac = (meaning: string, error?: ErrorMapping["category"], weak?: true): AmerCodeEntry =>
  error
    ? {
        family: "AC",
        meaning,
        category: error,
        retry: error === "unknown" ? "manual_review" : "customer_action_required",
        ...(weak ? { weak } : {}),
      }
    : { family: "AC", meaning, category: "unknown", retry: "unknown", notAnError: true };

/** AC codes (19): ACH and RTP acknowledged communication; mostly lifecycle states. */
export const AMER_AC_CODES: Record<string, AmerCodeEntry> = {
  AC100: ac("Pending"),
  AC101: ac("Declined", "unknown", true),
  AC102: ac("Approved"),
  AC103: ac("Error", "unknown", true),
  AC104: ac("Voided"),
  AC105: ac("Processed"),
  AC106: ac("Collected"),
  AC107: ac("Awaiting Capture"),
  AC108: ac("Awaiting Approval"),
  AC109: ac("Suspended"),
  AC110: ac("In Collection"),
  AC111: ac("In Research"),
  AC112: ac("Disputed"),
  AC113: ac("Uncollected Insufficient Funds", "insufficient_funds"),
  AC114: ac("Invalid or Closed Account", "payment_method_unavailable"),
  AC115: ac("Other Returns", "unknown", true),
  AC116: ac("None"),
  AC117: ac("Expired"),
  AC118: ac("Settled"),
};

/** SE codes (3): system errors. */
export const AMER_SE_CODES: Record<string, AmerCodeEntry> = {
  SE01: {
    family: "SE",
    meaning: "Maintenance mode",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  SE02: {
    family: "SE",
    meaning: "Error connecting to API services",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
  SE03: {
    family: "SE",
    meaning: "Error connecting to the financial services gateway",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

const eft = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  weak?: true,
): AmerCodeEntry => ({ family: "EFT", meaning, category, retry, ...(weak ? { weak } : {}) });

/** EFT Canada return codes (23). */
export const AMER_EFT_RETURN_CODES: Record<string, AmerCodeEntry> = {
  "900": eft("Account information wrong", "payment_method_unavailable", "customer_action_required"),
  "901": eft("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "902": eft("Account not found", "payment_method_unavailable", "customer_action_required"),
  "903": eft("Payment stopped or recalled", "unknown", "manual_review", true),
  "904": eft("Post-dated or stale-dated", "unknown", "manual_review", true),
  "905": eft("Account closed", "payment_method_unavailable", "customer_action_required"),
  "907": eft("No debit allowed", "payment_method_unavailable", "customer_action_required"),
  "908": eft("Funds not cleared", "insufficient_funds", "customer_action_required"),
  "909": eft(
    "Currency and account mismatch",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "910": eft("Payor or payee deceased", "payment_method_unavailable", "manual_review"),
  "911": eft("Account frozen", "payment_method_unavailable", "customer_action_required"),
  "912": eft("Invalid account number", "payment_method_unavailable", "customer_action_required"),
  "914": eft("Incorrect name", "payment_method_unavailable", "customer_action_required"),
  "915": eft("No agreement", "unknown", "manual_review", true),
  "916": eft("Not per agreement (personal)", "unknown", "manual_review", true),
  "917": eft("Agreement revoked (personal)", "unknown", "manual_review", true),
  "918": eft("No pre-notification (personal)", "unknown", "manual_review", true),
  "919": eft("Not per agreement (business)", "unknown", "manual_review", true),
  "920": eft("Agreement revoked (business)", "unknown", "manual_review", true),
  "921": eft("No pre-notification (business)", "unknown", "manual_review", true),
  "922": eft("Customer-initiated return (credit only)", "unknown", "manual_review", true),
  "990": eft("Institution in default", "provider_unavailable", "manual_review", true),
  "996": eft("Chargeback", "unknown", "manual_review", true),
};

const UK_DD_GROUPS: Record<string, readonly string[]> = {
  ARUCS: ["0", "2", "3", "5", "B", "C"],
  AWACS: ["0", "3"],
  ARUDD: ["0", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B"],
  ADDACS: ["0", "1", "2", "3", "B", "C", "D", "E", "R"],
  AUDDIS: ["1", "2", "3", "5", "6", "C", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "Q"],
  DDICA: ["1", "2", "3", "4", "5", "6", "7", "8"],
};

const UK_DD_KNOWN: Record<string, Pick<AmerCodeEntry, "meaning" | "category" | "retry">> = {
  ARUDD_0: {
    meaning: "Refer to payer",
    category: "insufficient_funds",
    retry: "customer_action_required",
  },
  DDICA_6: { meaning: "Signature fraudulent", category: "unknown", retry: "manual_review" },
};

/**
 * UK Trustly Direct Debit (BACS) reason codes (53), listed on the AMER status
 * code page. Only ARUDD_0 and DDICA_6 have a transcribed meaning.
 */
export const AMER_UK_DD_CODES: Record<string, AmerCodeEntry> = Object.fromEntries(
  Object.entries(UK_DD_GROUPS).flatMap(([group, suffixes]) =>
    suffixes.map((s) => {
      const code = `${group}_${s}`;
      const known = UK_DD_KNOWN[code];
      const entry: AmerCodeEntry = known
        ? { family: "UK_DD", ...known }
        : {
            family: "UK_DD",
            meaning: `BACS ${group} reason code (meaning not transcribed)`,
            category: "unknown",
            retry: "manual_review",
            weak: true,
          };
      return [code, entry];
    }),
  ),
);

/** AMER REST internal error codes (12) in `errors[].code`. */
export const AMER_INTERNAL_ERRORS: Record<string, ErrorMapping & { outcomeKnown: boolean }> = {
  "100": {
    meaning: "Internal database exception",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    outcomeKnown: false,
  },
  "150": {
    meaning: "Remote error, for example the bank interface is down",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    outcomeKnown: false,
  },
  "200": {
    meaning: "Invalid parameter",
    category: "invalid_request",
    retry: "do_not_retry",
    outcomeKnown: true,
  },
  "210": {
    meaning: "Duplicate request ignored (idempotency on merchantReference)",
    category: "duplicate_request",
    retry: "do_not_retry",
    outcomeKnown: true,
  },
  "300": {
    meaning: "Generic security error",
    category: "configuration",
    retry: "manual_review",
    outcomeKnown: true,
  },
  "326": {
    meaning: "Expired split token",
    category: "authentication_required",
    retry: "customer_action_required",
    outcomeKnown: true,
  },
  "330": {
    meaning: "Invalid account",
    category: "payment_method_unavailable",
    retry: "customer_action_required",
    outcomeKnown: true,
  },
  "331": {
    meaning: "Not enough balance",
    category: "insufficient_funds",
    retry: "customer_action_required",
    outcomeKnown: true,
  },
  "375": {
    meaning: "Access control error (accessId, accessKey or requestSignature)",
    category: "configuration",
    retry: "do_not_retry",
    outcomeKnown: true,
  },
  "380": {
    meaning: "Invalid split token",
    category: "authentication_required",
    retry: "customer_action_required",
    outcomeKnown: true,
  },
  "390": {
    meaning: "Fraud analysis: suspicious or negative data",
    category: "fraud_or_risk",
    retry: "manual_review",
    outcomeKnown: true,
  },
  "397": {
    meaning: "splitToken is not valid",
    category: "authentication_required",
    retry: "customer_action_required",
    outcomeKnown: true,
  },
};

/** Decline reason numbers (`paymentProviderTransaction.reasonCode`), with their SW status (14). */
export const AMER_REASON_CODES: Record<string, { status: string; meaning: string }> = {
  "1": { status: "SW054", meaning: "Exceeded thresholds" },
  "2": { status: "SW054", meaning: "Data mismatch" },
  "3": { status: "SW054", meaning: "Suspicious history" },
  "4": { status: "SW054", meaning: "Third-party history" },
  "5": { status: "SW055", meaning: "Negative database" },
  "6": { status: "SW055", meaning: "Sanctions list" },
  "7": { status: "SW055", meaning: "IP sanctions list" },
  "8": { status: "SW055", meaning: "Blocklisted by a third party" },
  "9": { status: "SW056", meaning: "Business account unsupported" },
  "10": { status: "SW056", meaning: "Non-checking account unsupported" },
  "11": { status: "SW057", meaning: "Split token expired or new authentication required" },
  "12": { status: "SW021", meaning: "Insufficient funds" },
  "15": { status: "SW054", meaning: "Beneficiary country prohibited" },
  "16": { status: "SW055", meaning: "Reason cannot be communicated" },
};

export type ExtendedReason = {
  status: string;
  reason: string;
  meaning: string;
  /** Overrides the SW code's retry guidance where the research gives one. */
  retry?: RetryGuidance;
  category?: ErrorCategory;
};

/**
 * Extended decline reason codes (33). The four velocity entries are
 * patterns: XXX is 001 to 999 (hours or counts).
 */
export const AMER_EXTENDED_REASONS: Record<string, ExtendedReason> = {
  "120000": { status: "SW021", reason: "12", meaning: "Insufficient funds" },
  "10000": { status: "SW054", reason: "1", meaning: "Exceeded thresholds: transaction amount" },
  "10001": { status: "SW054", reason: "1", meaning: "Exceeded thresholds: transaction amount" },
  "11XXX": {
    status: "SW054",
    reason: "1",
    meaning: "Consumer amount velocity exceeded over XXX hours",
  },
  "12XXX": { status: "SW054", reason: "1", meaning: "Consumer count velocity exceeded" },
  "13XXX": { status: "SW054", reason: "1", meaning: "Merchant amount velocity exceeded" },
  "14XXX": { status: "SW054", reason: "1", meaning: "Merchant count velocity exceeded" },
  "20000": { status: "SW054", reason: "2", meaning: "Data mismatch: name" },
  "20001": { status: "SW054", reason: "2", meaning: "Data mismatch: email" },
  "20002": { status: "SW054", reason: "2", meaning: "Data mismatch: address" },
  "30000": { status: "SW054", reason: "3", meaning: "Suspicious history" },
  "30101": { status: "SW054", reason: "3", meaning: "Suspicious history: NSF model score" },
  "30201": { status: "SW054", reason: "3", meaning: "Suspicious history: NSF rules hard block" },
  "30301": { status: "SW054", reason: "3", meaning: "Suspicious history: fraud model score" },
  "30401": { status: "SW054", reason: "3", meaning: "Suspicious history: fraud rules hard block" },
  "40000": { status: "SW054", reason: "4", meaning: "Third-party history" },
  "50000": { status: "SW055", reason: "5", meaning: "Negative database" },
  "50001": { status: "SW055", reason: "5", meaning: "Consumer blocklisted" },
  "50002": { status: "SW055", reason: "5", meaning: "Device on the negative database" },
  "50003": { status: "SW055", reason: "5", meaning: "Bank account on the negative database" },
  "50004": { status: "SW055", reason: "5", meaning: "IP address on the negative database" },
  "50005": { status: "SW055", reason: "5", meaning: "Geolocation on the negative database" },
  "50006": {
    status: "SW055",
    reason: "5",
    meaning: "Uncollected debt (NSF); the consumer must pay Trustly",
    retry: "customer_action_required",
  },
  "50007": {
    status: "SW055",
    reason: "5",
    meaning: "Uncollected debt (administrative); the consumer must pay Trustly",
    retry: "customer_action_required",
  },
  "50008": {
    status: "SW055",
    reason: "5",
    meaning: "Uncollected debt (SUF); the consumer must pay Trustly",
    retry: "customer_action_required",
  },
  "60000": { status: "SW055", reason: "6", meaning: "Sanctions list" },
  "70000": { status: "SW055", reason: "7", meaning: "IP sanctions list" },
  "80000": { status: "SW055", reason: "8", meaning: "Blocklisted by a third party" },
  "160000": {
    status: "SW055",
    reason: "16",
    meaning: "Reason cannot be communicated",
    category: "unknown",
  },
  "90000": { status: "SW056", reason: "9", meaning: "Business account unsupported" },
  "100000": { status: "SW056", reason: "10", meaning: "Non-checking account unsupported" },
  "110000": { status: "SW057", reason: "11", meaning: "Split token expired or revoked" },
  "110001": {
    status: "SW057",
    reason: "11",
    meaning: "New authentication required after suspicious activity",
  },
};

/** Looks up an extended reason code, resolving the 11XXX to 14XXX velocity patterns. */
export function extendedReason(
  code: string,
): (ExtendedReason & { key: string; window?: string }) | undefined {
  if (Object.prototype.hasOwnProperty.call(AMER_EXTENDED_REASONS, code))
    return { ...AMER_EXTENDED_REASONS[code]!, key: code };
  const m = /^(1[1-4])(\d{3})$/.exec(code);
  if (!m || m[2] === "000") return undefined;
  const key = `${m[1]}XXX`;
  return { ...AMER_EXTENDED_REASONS[key]!, key, window: m[2]! };
}

// ---------------------------------------------------------------------------
// Shared guidance text
// ---------------------------------------------------------------------------

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not send the same request again; the result will not change.",
  customer_action_required:
    "A new attempt needs the end user to act first, for example complete the bank flow again or choose another bank account.",
  retry_conditionally:
    "A later attempt may succeed, but first check the current state of the order or transaction (EU: later notifications for the orderid; North America: the transaction by transactionId). On the EU API Trustly replays an identical request with the same UUID instead of processing it again; on the North America API a repeated merchantReference is ignored as a duplicate (code 210).",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry.",
  manual_review: "Review the order or transaction manually before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the end user to use another payment method.",
  authentication_required:
    "Ask the end user to authenticate with their bank again in a new session.",
  authentication_failed: "Check the API credentials, keys and IP allowlist.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, its decimals and the remaining refundable amount.",
  insufficient_funds:
    "Check the balance that funds the operation (the end user's bank account, or the merchant balance at Trustly for refunds and settlements).",
  payment_method_unavailable: "Ask the end user to choose another bank account or payment method.",
  fraud_or_risk: "Review the transaction and the risk outcome before any new attempt.",
  rate_limiting: "Reduce the request rate and try again later.",
  provider_unavailable:
    "Check the order or transaction state before sending a new request; the bank or Trustly service may be unavailable.",
  network_or_timeout:
    "Check the order or transaction state before sending a new request; the original request may have taken effect.",
  duplicate_request: "Check the result of the first request instead of sending it again.",
  configuration:
    "Check the merchant account configuration, credentials, keys and enabled methods with Trustly.",
  unknown: "Contact Trustly support with the orderid or transactionId if the cause is unclear.",
};
