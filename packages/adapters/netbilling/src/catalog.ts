/**
 * NETbilling status and message knowledge, kept as data.
 *
 * Every value below comes from docs/providers/high-risk/research/netbilling.md,
 * which cites the NETbilling documentation pages linked in the URL constants.
 * Category and retry values are PandaPayLens interpretations of the documented
 * meanings, not NETbilling statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const DOCS_INDEX_URL = "https://www.netbilling.com/docs/";
export const AUTH_MESSAGES_URL = "https://www.netbilling.com/transactional-information-lists/";
export const TEST_MODE_URL =
  "https://secure.netbilling.com/public/docs/merchant/popup/popup-testmode.html";
export const DIRECT3_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3protocol.html";
export const DIRECT21_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode21.html";
export const DIRECT_BATCH_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/directmode/directmode3batchprotocol.html";
export const PAYMENT_FORM_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/nativespecs/ezicPaymentForm22.html";
export const MEMBERSHIP_SETUP_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/membershipsetup/membership-setup.html";
export const MEMBER_UPDATE_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/directmode/mupdate1.1.html";
export const DATA_RETRIEVAL_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/directmode/repinterface1.5.html";
export const ACH_GUIDE_URL =
  "https://secure.netbilling.com/public/docs/merchant/public/achdoc/achguide.html";

export type CatalogEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Complete the 3-D Secure challenge before treating the payment as authorized.",
  authentication_failed: "Ask the customer to re-enter their details or to use another card.",
  invalid_request: "Correct the card, account or request data before sending a new request.",
  invalid_amount: "Check the amount against the card and the account's configured limits.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another card type or payment method.",
  fraud_or_risk:
    "Do not retry automatically. Review the transaction and the account's fraud and traffic settings in the NETbilling administration system.",
  rate_limiting: "Wait before sending further requests.",
  provider_unavailable:
    "Check the transaction in the NETbilling administration system or the reporting interface before any new attempt.",
  network_or_timeout:
    "Check the transaction in the NETbilling administration system or the reporting interface before any new attempt.",
  duplicate_request:
    "Look up the original transaction before doing anything else; do not resubmit the same request.",
  configuration:
    "Check the merchant account, processor and site configuration with NETbilling support.",
  unknown:
    "Check the transaction details screen in the NETbilling administration system or contact NETbilling support.",
};

export const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary. Confirm the state of the original transaction first, then make at most a single new attempt later; avoid automatic repeated retries.",
  safe_to_retry_technical_request:
    "The request was rejected for a technical reason before a payment was made; it can be sent again.",
  manual_review:
    "The message does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this value.",
};

function entry(meaning: string, category: ErrorCategory, retry: RetryGuidance): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: `${meaning}.`,
    nextAction: NEXT_ACTION[category],
    retryExplanation: RETRY_EXPLANATION[retry],
  };
}

// ---------------------------------------------------------------------------
// Direct Mode 3.2 status_code (Table 3.1.1): 6 values

export type StatusInfo = {
  meaning: string;
  /** PandaPayLens event type name; not a NETbilling event. */
  eventType: string;
  stage: LifecycleStage;
  outcome: Outcome;
};

export const DIRECT3_STATUS_CODES: Readonly<Record<string, StatusInfo>> = {
  "1": {
    meaning: "Monetary transaction succeeded",
    eventType: "direct3.approved",
    stage: "payment",
    outcome: "success",
  },
  I: {
    meaning: "Pending, for example an unfunded check",
    eventType: "direct3.pending",
    stage: "payment",
    outcome: "pending",
  },
  T: {
    meaning: "Authorization only succeeded",
    eventType: "direct3.auth_only_approved",
    stage: "authorization",
    outcome: "success",
  },
  "0": {
    meaning: "Transaction failed; auth_msg and reason_code2 carry the reason",
    eventType: "direct3.failed",
    stage: "payment",
    outcome: "failure",
  },
  F: {
    meaning: "Settlement failure or returned NBCheck; not used at authorization time",
    eventType: "direct3.settlement_failure_or_return",
    stage: "settlement",
    outcome: "failure",
  },
  D: {
    meaning: "Duplicate transaction; the original transaction's trans_id is returned",
    eventType: "direct3.duplicate",
    // Direct Mode 3.2 does not say whether the original was approved.
    stage: "payment",
    outcome: "unknown",
  },
};

// ---------------------------------------------------------------------------
// Payment Form 2.2 Ecom_Ezic_Response_StatusCode (Appendix B)

export const PAYMENT_FORM_STATUS_CODES: Readonly<Record<string, StatusInfo>> = {
  "1": {
    meaning: "Approved, money moved",
    eventType: "payment.approved",
    stage: "payment",
    outcome: "success",
  },
  // The form's response table says "I = Ticket"; the research treats it as a
  // typo, because every other interface and the form's own text use T.
  I: {
    meaning: "Incomplete or pending (ACH, or card approved but batch not closed)",
    eventType: "payment.pending",
    stage: "payment",
    outcome: "pending",
  },
  T: {
    meaning: "Ticket: authorization or AVS-only check succeeded",
    eventType: "authorization.approved",
    stage: "authorization",
    outcome: "success",
  },
  "0": { meaning: "Failure", eventType: "payment.failed", stage: "payment", outcome: "failure" },
  F: { meaning: "Failure", eventType: "payment.failed", stage: "payment", outcome: "failure" },
  R: {
    meaning: "Refunded (rare in this context)",
    eventType: "payment.refunded",
    stage: "refund",
    outcome: "success",
  },
  D: {
    meaning: "Duplicate, already approved",
    eventType: "payment.duplicate",
    stage: "payment",
    outcome: "success",
  },
};

// ---------------------------------------------------------------------------
// Authorization messages (transactional-information-lists): 77 entries

export type AuthMessageGroup =
  "generic" | "avs_cvv2_filter" | "fraud_defense" | "traffic_limit" | "bank" | "other_documented";

export type AuthMessageEntry = CatalogEntry & {
  group: AuthMessageGroup;
  /** Success or lifecycle text, not a failure reason. */
  informational?: boolean;
  source: string;
};

type Row = [message: string, meaning: string, category: ErrorCategory, retry: RetryGuidance];

function table(
  group: AuthMessageGroup,
  rows: Row[],
  source = AUTH_MESSAGES_URL,
): Record<string, AuthMessageEntry> {
  return Object.fromEntries(
    rows.map(([message, meaning, category, retry]) => [
      message,
      { ...entry(meaning, category, retry), group, source },
    ]),
  );
}

function info(
  group: AuthMessageGroup,
  message: string,
  meaning: string,
  source = AUTH_MESSAGES_URL,
): Record<string, AuthMessageEntry> {
  return {
    [message]: {
      ...entry(meaning, "unknown", "unknown"),
      group,
      informational: true,
      source,
    },
  };
}

const GENERIC_MESSAGES = table("generic", [
  [
    "DECLINED",
    "Issuer decline with no further detail",
    "card_declined",
    "customer_action_required",
  ],
]);

const FILTER_MESSAGES = table("avs_cvv2_filter", [
  [
    "BAD ADDRESS",
    "The gateway aborted the transaction because the AVS result is not in the merchant's accepted list",
    "fraud_or_risk",
    "customer_action_required",
  ],
  [
    "CVV2 MISMATCH",
    "The gateway aborted the transaction because the CVV2 result is not in the merchant's accepted list",
    "fraud_or_risk",
    "customer_action_required",
  ],
]);

const FRAUD_DEFENSE_MESSAGES = table("fraud_defense", [
  ["A/DECLINED", "Fraud Defense: traffic limits exceeded", "fraud_or_risk", "manual_review"],
  [
    "B/DECLINED",
    "Fraud Defense: matched the blacklist or high-risk country list",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "C/DECLINED",
    "Fraud Defense: country of origin is on the high-risk list",
    "fraud_or_risk",
    "do_not_retry",
  ],
  [
    "E/DECLINED",
    "Fraud Defense: email address not valid",
    "invalid_request",
    "customer_action_required",
  ],
  [
    "I/DECLINED",
    "Fraud Defense: country mismatch between IP address, card and address",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "J/DECLINED",
    "Fraud Defense: profane or suspicious content (this check is disabled in the Virtual Terminal)",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "L/DECLINED",
    "Fraud Defense: failed US location verification",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "R/DECLINED",
    "Fraud Defense: high-risk country or anonymous domain",
    "fraud_or_risk",
    "do_not_retry",
  ],
]);

const TRAFFIC_LIMIT_MESSAGES = table("traffic_limit", [
  [
    "A/QUOTA EXCEEDED",
    "Traffic limit: per-card dollar volume limit exceeded",
    "fraud_or_risk",
    "manual_review",
  ],
  [
    "C/QUOTA EXCEEDED",
    "Traffic limit: count of credits or refunds in the period exceeded",
    "configuration",
    "manual_review",
  ],
  [
    "M/QUOTA EXCEEDED",
    "Traffic limit: per-transaction amount limit exceeded",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "R/QUOTA EXCEEDED",
    "Traffic limit: dollar volume of credits or refunds in the period exceeded",
    "configuration",
    "manual_review",
  ],
  [
    "S/QUOTA EXCEEDED",
    "Traffic limit: count of sales in the period exceeded",
    "configuration",
    "manual_review",
  ],
]);

const BANK_MESSAGES: Record<string, AuthMessageEntry> = {
  ...table("bank", [
    ["ACCT FROZEN", "Account frozen", "card_declined", "customer_action_required"],
  ]),
  ...info("bank", "APPROVED", "Authorized"),
  ...table("bank", [
    ["CALL 01", "Refer to issuer", "card_declined", "customer_action_required"],
    ["CALL 02", "Refer to issuer, special condition", "card_declined", "customer_action_required"],
    ["NO REPLY 28", "File temporarily unavailable", "provider_unavailable", "retry_conditionally"],
    ["NO REPLY 91", "Issuer or switch unavailable", "provider_unavailable", "retry_conditionally"],
    ["HOLD-CALL 04", "Pick up card", "fraud_or_risk", "do_not_retry"],
    ["HOLD-CALL 07", "Pick up card, special condition", "fraud_or_risk", "do_not_retry"],
    ["HOLD-CALL 41", "Pick up card, lost card", "fraud_or_risk", "do_not_retry"],
    ["HOLD-CALL 43", "Pick up card, stolen card", "fraud_or_risk", "do_not_retry"],
    [
      "ACCT LENGTH ERR",
      "Verification error EA (account length)",
      "invalid_request",
      "customer_action_required",
    ],
    ["ALREADY REVERSED 79", "Already reversed at the switch", "duplicate_request", "do_not_retry"],
    ["AMOUNT ERROR 13", "Invalid amount", "invalid_amount", "do_not_retry"],
    [
      "CANT VERIFY PIN 83",
      "PIN cannot be verified",
      "authentication_failed",
      "customer_action_required",
    ],
    [
      "CANT VERIFY PIN 86",
      "PIN cannot be verified",
      "authentication_failed",
      "customer_action_required",
    ],
    ["CARD NO. ERROR 14", "Invalid card number", "invalid_request", "customer_action_required"],
    ["CASHBACK NOT APP 82", "Cashback limit exceeded", "invalid_amount", "do_not_retry"],
    ["CASHBACK NOT AVL N3", "Cashback not available", "payment_method_unavailable", "do_not_retry"],
    [
      "CHECK DIGIT ERR",
      "Verification error EB (check digit)",
      "invalid_request",
      "customer_action_required",
    ],
    [
      "CID FORMAT ERROR",
      "Verification error EC (CID format)",
      "invalid_request",
      "customer_action_required",
    ],
    [
      "CVV2 MISMATCH N7",
      "The issuer reports that the CVV2 does not match",
      "card_declined",
      "customer_action_required",
    ],
    ["DATE ERROR 80", "Invalid date", "invalid_request", "customer_action_required"],
    ["DECLINE 02", "Needs a force with voice authorization", "card_declined", "manual_review"],
    ["DECLINE 05", "Do not honor", "card_declined", "customer_action_required"],
    ["DECLINE 51", "Insufficient funds", "insufficient_funds", "retry_conditionally"],
    ["DECLINE N4", "Over the issuer withdrawal limit", "insufficient_funds", "retry_conditionally"],
    ["DECLINE 61", "Over the withdrawal limit", "insufficient_funds", "retry_conditionally"],
    [
      "DECLINE 62",
      "Invalid or restricted service code",
      "payment_method_unavailable",
      "do_not_retry",
    ],
    ["DECLINE 65", "Activity limit exceeded", "card_declined", "retry_conditionally"],
    ["DECLINE 93", "Violation, transaction cannot be completed", "card_declined", "do_not_retry"],
    ["DECLINE AVS 06", "Declined for AVS", "card_declined", "customer_action_required"],
    ["ENCRYPTION ERROR 81", "Cryptographic error", "configuration", "manual_review"],
    ["ERROR CODE 98", "Unknown error", "unknown", "unknown"],
    ["EXPIRED CARD 54", "Expired card", "card_declined", "customer_action_required"],
    [
      "FAILURE CV",
      "Card type not accepted",
      "payment_method_unavailable",
      "customer_action_required",
    ],
    ["Failure HV", "Account set up incorrectly at creation", "configuration", "manual_review"],
    [
      "GENERAL ERROR 98",
      "General error, probably an empty value (seen when CVV2 is blank)",
      "invalid_request",
      "customer_action_required",
    ],
    ["INV MERCH NUM 19", "Invalid merchant ID", "configuration", "manual_review"],
    [
      "Invalid Account Number",
      "Bad account number length or format",
      "invalid_request",
      "customer_action_required",
    ],
    ["INVALID BANK ACT", "Invalid bank account", "invalid_request", "customer_action_required"],
    ["INVALID ROUTING 92", "Destination not found", "invalid_request", "customer_action_required"],
    [
      "INVALID TRANS 12",
      "Invalid transaction (possibly a bad account number)",
      "invalid_request",
      "do_not_retry",
    ],
    ["NO ACCOUNT 78", "No account", "card_declined", "customer_action_required"],
    ["No Acct/Cannot Locate", "No account exists", "invalid_request", "customer_action_required"],
    ["NO ACTION TAKEN 21", "Could not back out the transaction", "unknown", "manual_review"],
    ["NO ACTION TAKEN 76", "Could not locate, no match", "unknown", "manual_review"],
    [
      "NO ACTION TAKEN 77",
      "Inconsistent data, reversal or repeat",
      "duplicate_request",
      "manual_review",
    ],
    ["NO CHECK ACCOUNT 52", "No checking account", "card_declined", "customer_action_required"],
    ["NO CREDIT ACCT 39", "No credit account", "card_declined", "customer_action_required"],
    ["NO SAVE ACCOUNT 53", "No savings account", "card_declined", "customer_action_required"],
    ["NO SUCH ISSUER 15", "No such issuer", "invalid_request", "customer_action_required"],
  ]),
  ...info("bank", "OFFLINE RETURN", "Refund of a check or credit transaction (informational)"),
  ...table("bank", [
    ["PIN EXCEEDED 75", "PIN tries exceeded", "authentication_failed", "do_not_retry"],
    ["RE ENTER 19", "Re-enter the transaction", "network_or_timeout", "retry_conditionally"],
    ["SEC VIOLATION 63", "Security violation", "fraud_or_risk", "do_not_retry"],
    [
      "SERV NOT ALLOWED 57",
      "Service not permitted for this card",
      "payment_method_unavailable",
      "do_not_retry",
    ],
    [
      "SERV NOT ALLOWED 58",
      "Service not permitted for this terminal",
      "configuration",
      "manual_review",
    ],
    ["SYSTEM ERROR 96", "System malfunction", "provider_unavailable", "retry_conditionally"],
    ["TERM ID ERROR 03", "Invalid merchant ID", "configuration", "manual_review"],
    ["WRONG PIN 55", "Incorrect PIN", "authentication_failed", "customer_action_required"],
    ["XXXXXXXXXXXXXXXX XX", "Undefined response (placeholder pattern)", "unknown", "unknown"],
  ]),
};

/** The 77 messages listed on NETbilling's Transaction Authorization Message Definitions page. */
export const AUTH_MESSAGES: Readonly<Record<string, AuthMessageEntry>> = {
  ...GENERIC_MESSAGES,
  ...FILTER_MESSAGES,
  ...FRAUD_DEFENSE_MESSAGES,
  ...TRAFFIC_LIMIT_MESSAGES,
  ...BANK_MESSAGES,
};

/** Messages seen only in examples or on other NETbilling pages (4). */
export const EXTRA_AUTH_MESSAGES: Readonly<Record<string, AuthMessageEntry>> = {
  ...info("other_documented", "TEST APPROVED", "Approved in test mode", DIRECT3_URL),
  ...info(
    "other_documented",
    "OFFLINE RECORD",
    "Stored record without authorization; returned when a 3-D Secure 2 challenge is pending",
    DIRECT3_URL,
  ),
  ...table(
    "other_documented",
    [
      [
        "CRYPTOGRAPHIC DIGEST ERROR",
        "The hosted payment form crypto-hash did not match",
        "configuration",
        "do_not_retry",
      ],
    ],
    MEMBERSHIP_SETUP_URL,
  ),
  ...table(
    "other_documented",
    [
      [
        "ACH/FAIL",
        "NBCheck failure: the check failed fraud screening or was invalid and was never submitted (NBCheck guide spelling of ACH/FAILED)",
        "unknown",
        "manual_review",
      ],
    ],
    ACH_GUIDE_URL,
  ),
};

/** Spellings that appear on NETbilling pages for a documented message. */
export const AUTH_MESSAGE_ALIASES: Readonly<Record<string, string>> = {
  // The membership setup page spells it "CRYTPGRAPHIC".
  "CRYTPGRAPHIC DIGEST ERROR": "CRYPTOGRAPHIC DIGEST ERROR",
};

/**
 * The NBCheck guide shows `?/DECLINED` and `?/QUOTA EXCEEDED`, so the letter
 * prefix is a single variable character. Letters outside the documented
 * lists are decoded only as a gateway rejection of unknown kind.
 */
export const PREFIXED_REJECTION: CatalogEntry = {
  ...entry(
    "Gateway rejection in the Fraud Defense or traffic limit format, with a letter that is not in the documented lists",
    "unknown",
    "manual_review",
  ),
};

// ---------------------------------------------------------------------------
// Direct Mode 3.2 HTTP exceptions (section 4)

export type ExceptionInfo = CatalogEntry & { range: string; outcome: Outcome };

export function directExceptionInfo(status: number): ExceptionInfo | undefined {
  if (status === 604) {
    return {
      ...entry(
        "Missing parameter (documented example: Missing Parameter (account_id))",
        "invalid_request",
        "do_not_retry",
      ),
      range: "600-698",
      outcome: "failure",
    };
  }
  if (status === 699 || status === 799) {
    return {
      ...entry(
        `General exception ${status}; NETbilling puts a 5-digit machine-readable sub-code at the start of the HTTP reason phrase`,
        "unknown",
        status === 699 ? "manual_review" : "retry_conditionally",
      ),
      range: String(status),
      outcome: status === 699 ? "failure" : "unknown",
    };
  }
  if (status >= 600 && status <= 698) {
    return {
      ...entry("Exception, most likely invalid input", "invalid_request", "do_not_retry"),
      range: "600-698",
      outcome: "failure",
    };
  }
  if (status >= 700 && status <= 798) {
    return {
      ...entry("Exception, most likely a processing error", "unknown", "retry_conditionally"),
      range: "700-798",
      outcome: "unknown",
    };
  }
  return undefined;
}

/** Documented 699 sub-codes (only one is published). */
export const EXCEPTION_SUBCODES: Readonly<Record<string, CatalogEntry>> = {
  "20112": entry("Invalid card expiration date", "invalid_request", "customer_action_required"),
};

// ---------------------------------------------------------------------------
// Member statuses (Data Retrieval 1.5 and Member Update 1.1): 6

export type MemberStatusInfo = { meaning: string; outcome: Outcome };

export const MEMBER_STATUSES: Readonly<Record<string, MemberStatusInfo>> = {
  PENDING: { meaning: "Created, not activated (no payment yet)", outcome: "pending" },
  ACTIVE: { meaning: "Active membership", outcome: "success" },
  "ACTIVE/R": {
    meaning: "Self-cancelled; becomes RESIGNED at the next rebill date and rebillings stop",
    outcome: "pending",
  },
  RESIGNED: { meaning: "Resigned (self-cancellation took effect)", outcome: "success" },
  DISABLED: { meaning: "Manually disabled", outcome: "success" },
  EXPIRED: { meaning: "Finished all rebillings", outcome: "success" },
};

// ---------------------------------------------------------------------------
// Test mode (popup-testmode.html)

/** AVS result by the hundreds digit of the whole-dollar amount. */
export const TEST_MODE_AVS: readonly string[] = ["X", "Y", "W", "Z", "A", "N", "G", "U", "R", "?"];
/** CVV2 result by the thousands digit of the whole-dollar amount. */
export const TEST_MODE_CVV2: readonly string[] = ["M", "N", "P", "S", "U", "M", "M", "M", "M", "?"];
