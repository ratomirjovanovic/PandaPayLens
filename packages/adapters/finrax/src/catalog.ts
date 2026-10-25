/**
 * Finrax status, reason and error knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/finrax.md, which
 * cites Finrax's public developer documentation (verified 2026-10-25).
 *
 * Finrax documents no provider error or decline codes. Errors are HTTP status
 * codes with a free-text message. Lifecycle enums are documented as exact
 * values but without per-value definitions: meanings come from the sandbox
 * table where it shows the value (`basis: "sandbox"`), from an example
 * (`basis: "example"`), or from the value's name (`basis: "inferred"`).
 * Values whose meaning is not documented at all have `basis: "not_documented"`.
 *
 * This is a crypto payment provider. A received or confirmed deposit is not a
 * settlement, a DEPOSITED payment can be underpaid, and a payout approval is
 * not a completed payout.
 *
 * Category and retry values are PandaPayLens suggestions from the research file.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

const DOCS = "https://docs.finrax.com";

export const INTRODUCTION_URL = `${DOCS}/`;
export const ERRORS_URL = `${DOCS}/errors`;
export const AUTHORIZATION_URL = `${DOCS}/authorization`;
export const KEY_MANAGEMENT_URL = `${DOCS}/authorization/management`;
export const SIGNATURE_URL = `${DOCS}/authorization/signature`;
export const SANDBOX_URL = `${DOCS}/environments/sandbox-environment`;
export const PRODUCTION_URL = `${DOCS}/environments/production-environment`;
export const REQUEST_PAYMENT_URL = `${DOCS}/api/request-crypto-payment`;
export const SUBMIT_PAYMENT_URL = `${DOCS}/api/submit-crypto-payment`;
export const FETCH_PAYMENT_URL = `${DOCS}/api/fetch-payment`;
export const FETCH_PAYMENTS_URL = `${DOCS}/api/fetch-payments`;
export const REQUEST_WITHDRAWAL_URL = `${DOCS}/api/request-crypto-withdrawal`;
export const FETCH_WITHDRAWALS_URL = `${DOCS}/api/fetch-withdrawals`;
export const FETCH_APPROVAL_URL = `${DOCS}/api/fetch-crypto-withdrawal-approval`;
export const CALLBACKS_URL = `${DOCS}/references/callbacks`;
export const DEPOSIT_CALLBACK_URL = `${DOCS}/references/callbacks/deposit-received`;
export const WITHDRAWAL_CALLBACK_URL = `${DOCS}/references/callbacks/withdrawal-completed`;
export const APPROVAL_CALLBACK_URL = `${DOCS}/references/callbacks/withdrawal-completed-1`;

/** How the meaning of a value is known. */
export type MeaningBasis = "sandbox" | "example" | "inferred" | "not_documented" | "documented";

export type ErrorAdvice = {
  category: ErrorCategory;
  retry: RetryGuidance;
  confidence: Confidence;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
};

export type StatusInfo = {
  outcome: Outcome;
  stage: LifecycleStage;
  meaning: string;
  basis: MeaningBasis;
  /**
   * Success only when the record shows that the received amount reaches the
   * expected amount; otherwise the outcome is unknown (a DEPOSITED payment
   * can be underpaid).
   */
  requiresAmountCheck?: true;
  /** Diagnostic advice when the value describes a problem. */
  error?: ErrorAdvice;
  documentation: string;
};

const MANUAL_REVIEW =
  "Finrax holds or stops funds for this reason; a new automatic attempt does not change it. Review the case in the Finrax dashboard or with Finrax support.";

const blocked = (what: string): ErrorAdvice => ({
  category: "fraud_or_risk",
  retry: "manual_review",
  confidence: "strong",
  explanation: `Finrax blocked the ${what}. The sandbox describes a blocked deposit as fully refunded to the sender. The record does not say which screening result caused it.`,
  nextAction:
    "Do not credit the customer. Check the refund state in the deposit's refund object and review the case with Finrax.",
  retryExplanation: MANUAL_REVIEW,
});

const unprocessable = (what: string): ErrorAdvice => ({
  category: "invalid_amount",
  retry: "customer_action_required",
  confidence: "strong",
  explanation: `The ${what} is UNPROCESSABLE. The sandbox shows this status for a deposit below the minimum deposit amount.`,
  nextAction:
    "Do not credit the customer. Tell the customer the minimum deposit amount for the coin and network, and check the deposit's refund state.",
  retryExplanation:
    "Only a new deposit of at least the minimum amount can succeed; that is the customer's decision.",
});

const failedUndocumented = (what: string): ErrorAdvice => ({
  category: "unknown",
  retry: "manual_review",
  confidence: "insufficient",
  explanation: `The ${what} is FAILED. Finrax documents FAILED as a value but does not define it, so the cause is not known.`,
  nextAction: "Look up the record in the Finrax dashboard or ask Finrax support for the reason.",
  retryExplanation:
    "The reason and whether funds moved are not known. Do not start a new operation until the state is confirmed.",
});

/** Payment `status` (9 documented values). */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  NEW: {
    outcome: "pending",
    stage: "payment",
    meaning: "Payment created; no deposit yet (seen in the create example)",
    basis: "example",
    documentation: REQUEST_PAYMENT_URL,
  },
  PENDING: {
    outcome: "pending",
    stage: "payment",
    meaning: "Not final (the difference to AWAITING is not documented)",
    basis: "not_documented",
    documentation: FETCH_PAYMENT_URL,
  },
  AWAITING: {
    outcome: "pending",
    stage: "payment",
    meaning: "Not final (the difference to PENDING is not documented)",
    basis: "not_documented",
    documentation: FETCH_PAYMENT_URL,
  },
  DEPOSITED: {
    outcome: "success",
    stage: "payment",
    meaning:
      "Deposit received. The sandbox shows DEPOSITED for exact and for underpaid deposits, so the amounts decide whether the payment is complete",
    basis: "sandbox",
    requiresAmountCheck: true,
    documentation: SANDBOX_URL,
  },
  OVERPAID: {
    outcome: "success",
    stage: "payment",
    meaning:
      "Deposit above the expected amount, or a follow-up deposit; the excess may be refunded (sandbox)",
    basis: "sandbox",
    documentation: SANDBOX_URL,
  },
  EXPIRED: {
    outcome: "failure",
    stage: "payment",
    meaning:
      "Inferred from the name: the payment window passed (expirationMinutes, default 30; 0 means 7 days)",
    basis: "inferred",
    error: {
      category: "unknown",
      retry: "customer_action_required",
      confidence: "possible",
      explanation:
        "The payment is EXPIRED. Finrax does not define the value; the name and the documented expirationMinutes suggest the payment window passed before a deposit arrived.",
      nextAction:
        "Check whether a late deposit still arrived for this payment. If not, create a new payment if the customer still wants to pay.",
      retryExplanation:
        "A new payment needs the customer to send funds again; first make sure no deposit arrived for the expired one.",
    },
    documentation: REQUEST_PAYMENT_URL,
  },
  BLOCKED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Deposit blocked; full refund (sandbox)",
    basis: "sandbox",
    error: blocked("payment's deposit"),
    documentation: SANDBOX_URL,
  },
  UNPROCESSABLE: {
    outcome: "failure",
    stage: "payment",
    meaning: "Deposit below the minimum deposit amount (sandbox)",
    basis: "sandbox",
    error: unprocessable("payment"),
    documentation: SANDBOX_URL,
  },
  FAILED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Meaning not documented",
    basis: "not_documented",
    error: failedUndocumented("payment"),
    documentation: FETCH_PAYMENT_URL,
  },
};

/** `deposits[].status` and the deposit callback `status` (6 documented values). */
export const DEPOSIT_STATUSES: Record<string, StatusInfo> = {
  UNCONFIRMED: {
    outcome: "pending",
    stage: "payment",
    meaning: "Inferred from the name: seen on chain, not yet confirmed",
    basis: "inferred",
    documentation: FETCH_PAYMENT_URL,
  },
  CONFIRMED: {
    outcome: "success",
    stage: "payment",
    meaning:
      "Deposit confirmed on chain (the deposit callback is sent at one blockchain confirmation). A confirmation is not a settlement, and the amounts decide whether the payment is complete",
    basis: "documented",
    requiresAmountCheck: true,
    documentation: DEPOSIT_CALLBACK_URL,
  },
  COMPLIANCE_REVIEW: {
    outcome: "pending",
    stage: "payment",
    meaning: "Inferred from the name: deposit held for AML review",
    basis: "inferred",
    error: {
      category: "fraud_or_risk",
      retry: "manual_review",
      confidence: "possible",
      explanation:
        "The deposit is in COMPLIANCE_REVIEW. Finrax does not define the value; the name suggests an AML review of the deposit. The outcome is not final.",
      nextAction:
        "Do not credit the customer yet. Wait for the review result or ask Finrax support about the deposit.",
      retryExplanation:
        "The deposit is under review; asking the customer to pay again could lead to a double payment.",
    },
    documentation: FETCH_PAYMENT_URL,
  },
  BLOCKED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Deposit blocked; full refund (sandbox)",
    basis: "sandbox",
    error: blocked("deposit"),
    documentation: SANDBOX_URL,
  },
  UNPROCESSABLE: {
    outcome: "failure",
    stage: "payment",
    meaning: "Deposit below the minimum deposit amount (sandbox)",
    basis: "sandbox",
    error: unprocessable("deposit"),
    documentation: SANDBOX_URL,
  },
  FAILED: {
    outcome: "failure",
    stage: "payment",
    meaning: "Meaning not documented",
    basis: "not_documented",
    error: failedUndocumented("deposit"),
    documentation: FETCH_PAYMENT_URL,
  },
};

/** `deposits[].refund.status` (5 documented values). */
export const REFUND_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "refund",
    meaning: "Refund not completed yet",
    basis: "inferred",
    documentation: FETCH_PAYMENT_URL,
  },
  AWAITING_ADDRESS_INPUT: {
    outcome: "pending",
    stage: "refund",
    meaning: "Refund waits for a destination address (destinationAddress is empty)",
    basis: "documented",
    documentation: FETCH_PAYMENT_URL,
  },
  COMPLIANCE_REVIEW: {
    outcome: "pending",
    stage: "refund",
    meaning: "Inferred from the name: refund held for compliance review",
    basis: "inferred",
    documentation: FETCH_PAYMENT_URL,
  },
  CONFIRMED: {
    outcome: "success",
    stage: "refund",
    meaning: "Inferred from the name: refund transaction confirmed",
    basis: "inferred",
    documentation: FETCH_PAYMENT_URL,
  },
  NON_REFUNDABLE: {
    outcome: "failure",
    stage: "refund",
    meaning: "The deposit will not be refunded (destinationAddress is empty)",
    basis: "documented",
    error: {
      category: "unknown",
      retry: "manual_review",
      confidence: "possible",
      explanation:
        "Finrax marks the deposit's refund as NON_REFUNDABLE. The documentation does not say why a deposit cannot be refunded.",
      nextAction:
        "Review the deposit with Finrax support before telling the customer whether the funds can be returned.",
      retryExplanation: MANUAL_REVIEW,
    },
    documentation: FETCH_PAYMENT_URL,
  },
};

export type ReasonInfo = {
  meaning: string;
  basis: MeaningBasis;
  error?: ErrorAdvice;
};

/** `deposits[].refund.reason` (5 documented values). */
export const REFUND_REASONS: Record<string, ReasonInfo> = {
  OVERPAYMENT: {
    meaning: "The amount above the expected amount is returned (sandbox)",
    basis: "sandbox",
  },
  FOLLOW_UP_DEPOSIT: {
    meaning: "An extra deposit to an already paid payment is returned (sandbox)",
    basis: "sandbox",
  },
  CURRENCY_MISMATCH: {
    meaning: "Inferred from the name: the customer sent a different coin or network",
    basis: "inferred",
    error: {
      category: "invalid_request",
      retry: "customer_action_required",
      confidence: "possible",
      explanation:
        "The deposit is refunded with reason CURRENCY_MISMATCH. Finrax does not define the value; the name suggests the customer sent a coin or network other than the one the payment expects.",
      nextAction:
        "Tell the customer which coin and network the payment expects, and follow the refund state.",
      retryExplanation:
        "A new deposit only works in the expected coin and network; the customer must send it.",
    },
  },
  RESTRICTED_CURRENCY: {
    meaning: "Inferred from the name: the coin is not accepted",
    basis: "inferred",
    error: {
      category: "payment_method_unavailable",
      retry: "customer_action_required",
      confidence: "possible",
      explanation:
        "The deposit is refunded with reason RESTRICTED_CURRENCY. Finrax does not define the value; the name suggests the coin sent is not accepted.",
      nextAction: "Ask the customer to pay with a coin the payment accepts.",
      retryExplanation: "Sending the same coin again would be refunded again.",
    },
  },
  ILLICIT_DEPOSIT: {
    meaning: "Inferred from the name: AML screening flagged the source of funds",
    basis: "inferred",
    error: {
      category: "fraud_or_risk",
      retry: "manual_review",
      confidence: "possible",
      explanation:
        "The deposit is refunded with reason ILLICIT_DEPOSIT. Finrax does not define the value; the name suggests AML screening flagged the source of the funds. The screening result itself is not copied.",
      nextAction:
        "Do not credit the customer. Review the case in the Finrax dashboard and follow your compliance process.",
      retryExplanation: MANUAL_REVIEW,
    },
  },
};

/** `deposits[].refund.type` (2 documented values). */
export const REFUND_TYPES: Record<string, string> = {
  PARTIAL: "Part of the deposit is refunded",
  FULL: "The whole deposit is refunded",
};

/** Withdrawal `status` in API responses and the broadcast callback (4 documented values). */
export const WITHDRAWAL_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "payout",
    meaning: "Withdrawal in progress",
    basis: "documented",
    documentation: REQUEST_WITHDRAWAL_URL,
  },
  COMPLETED: {
    outcome: "success",
    stage: "payout",
    meaning:
      "Withdrawal broadcast to the blockchain (the callback does not report later confirmations)",
    basis: "documented",
    documentation: WITHDRAWAL_CALLBACK_URL,
  },
  FAILED: {
    outcome: "failure",
    stage: "payout",
    meaning: "Meaning not documented",
    basis: "not_documented",
    error: failedUndocumented("withdrawal"),
    documentation: WITHDRAWAL_CALLBACK_URL,
  },
  BLOCKED: {
    outcome: "failure",
    stage: "payout",
    meaning: "Inferred from the name: withdrawal blocked by screening",
    basis: "inferred",
    error: {
      category: "fraud_or_risk",
      retry: "manual_review",
      confidence: "possible",
      explanation:
        "The withdrawal is BLOCKED. Finrax does not define the value; the name suggests screening stopped it. The address screening result is not copied.",
      nextAction:
        "Do not send the payout again to the same address. Review the case in the Finrax dashboard.",
      retryExplanation: MANUAL_REVIEW,
    },
    documentation: WITHDRAWAL_CALLBACK_URL,
  },
};

/** Withdrawal approval `status` (4 documented values). */
export const APPROVAL_STATUSES: Record<string, StatusInfo> = {
  PENDING: {
    outcome: "pending",
    stage: "payout",
    meaning: "Waiting for a dashboard approver's decision",
    basis: "documented",
    documentation: APPROVAL_CALLBACK_URL,
  },
  APPROVED: {
    outcome: "pending",
    stage: "payout",
    meaning:
      "A dashboard approver approved the withdrawal. Approval is not a completed payout; the broadcast callback follows",
    basis: "documented",
    documentation: APPROVAL_CALLBACK_URL,
  },
  REJECTED: {
    outcome: "failure",
    stage: "payout",
    meaning: "A dashboard approver rejected the withdrawal",
    basis: "documented",
    error: {
      category: "unknown",
      retry: "manual_review",
      confidence: "strong",
      explanation:
        "A dashboard approver rejected the withdrawal, so it will not be sent. The callback does not carry the approver's reason.",
      nextAction:
        "Ask the approvers in your Finrax organisation why it was rejected before creating a new withdrawal.",
      retryExplanation:
        "The rejection is a decision inside your own organisation; a new request would need a new approval.",
    },
    documentation: APPROVAL_CALLBACK_URL,
  },
  SKIPPED: {
    outcome: "unknown",
    stage: "payout",
    meaning: "Meaning not documented",
    basis: "not_documented",
    documentation: APPROVAL_CALLBACK_URL,
  },
};

export type HttpErrorEntry = {
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** The original request may have taken effect. */
  outcomeUnknown?: true;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  documentation: string;
};

const DO_NOT_RETRY = "Sending the same request again returns the same error.";

/** HTTP status codes from the errors page (9 documented codes). */
export const HTTP_ERRORS: Record<string, HttpErrorEntry> = {
  "400": {
    meaning: "Invalid body or parameters",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "Finrax rejected the request body or parameters as invalid.",
    nextAction: "Check the request against the endpoint reference and the error message.",
    retryExplanation: DO_NOT_RETRY,
    documentation: ERRORS_URL,
  },
  "401": {
    meaning: "Invalid authorization token or API credentials",
    category: "configuration",
    retry: "do_not_retry",
    explanation:
      "Finrax did not accept the Authorization header: the API key, the request signature or its timestamp is invalid.",
    nextAction:
      "Check the API key for the environment, how the signature is built and that the header timestamp is the current time in milliseconds.",
    retryExplanation: "The same credentials and signature are rejected again.",
    documentation: SIGNATURE_URL,
  },
  "403": {
    meaning: "Insufficient permissions, or the source IP is not whitelisted for the key",
    category: "configuration",
    retry: "do_not_retry",
    explanation:
      "Finrax refused the request: the API key lacks the permission, or the calling IP address is not on the key's whitelist.",
    nextAction: "Check the key's permissions and IP whitelist in the Finrax dashboard.",
    retryExplanation: "Nothing changes until the key or whitelist is updated.",
    documentation: KEY_MANAGEMENT_URL,
  },
  "404": {
    meaning: "Resource does not exist",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "The requested resource does not exist.",
    nextAction: "Check the identifier, and that the request goes to the right environment.",
    retryExplanation: DO_NOT_RETRY,
    documentation: ERRORS_URL,
  },
  "405": {
    meaning: "HTTP method not supported by the endpoint",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "The endpoint does not support this HTTP method.",
    nextAction: "Use the method shown in the endpoint reference.",
    retryExplanation: DO_NOT_RETRY,
    documentation: ERRORS_URL,
  },
  "409": {
    meaning: "Resource already exists",
    category: "duplicate_request",
    retry: "do_not_retry",
    explanation:
      "Finrax reports that the resource already exists. Which field triggers it (for example a reused clientPaymentId) is not documented.",
    nextAction:
      "Fetch the existing resource and continue with it instead of creating a new one, or use a new client reference if a new resource is intended.",
    retryExplanation: "The same request conflicts with the existing resource again.",
    documentation: ERRORS_URL,
  },
  "415": {
    meaning: "Payload is not in the supported JSON format",
    category: "invalid_request",
    retry: "do_not_retry",
    explanation: "Finrax could not read the request body as JSON.",
    nextAction: "Send a JSON body with Content-Type application/json.",
    retryExplanation: DO_NOT_RETRY,
    documentation: ERRORS_URL,
  },
  "500": {
    meaning: "Internal error while handling the request",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    outcomeUnknown: true,
    explanation:
      "Finrax had an internal error. For a request that creates something (a payment or a withdrawal) it is not known whether it took effect.",
    nextAction:
      "Look up the payment or withdrawal by your client reference first. Repeat the request only if it does not exist.",
    retryExplanation:
      "A POST may have succeeded before the error. Verify first, then retry with the same client reference.",
    documentation: ERRORS_URL,
  },
  "503": {
    meaning: "System down",
    category: "provider_unavailable",
    retry: "retry_conditionally",
    outcomeUnknown: true,
    explanation: "Finrax reports that the system is down.",
    nextAction:
      "Retry a read (GET) later. For a POST or PATCH, check by your client reference whether it took effect before repeating it.",
    retryExplanation:
      "A GET can be repeated safely; the error body does not show the HTTP method, so a creating request must be verified first.",
    documentation: ERRORS_URL,
  },
};

export const NEXT_ACTION_UNKNOWN =
  "Check the Finrax dashboard for this request, or contact Finrax support with the request path and time.";

/** Coins named on Finrax's documentation pages. Amounts in these are never converted to minor units. */
export const DOCUMENTED_COINS = ["BTC", "ETH", "USDT", "USDC", "LTC", "XRP"] as const;
