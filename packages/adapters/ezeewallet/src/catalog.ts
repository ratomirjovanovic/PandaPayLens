/**
 * eZeeWallet code and status knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/ezeewallet.md, which
 * cites the public eZeeWallet API reference (API version 2.0.2, verified
 * 2026-10-25): https://emerchantpay.github.io/ewallet-api-docs/
 *
 * Error meanings are short paraphrases of the "Errors" table. Category and
 * retry values are PandaPayLens suggestions derived from the documented
 * meaning; eZeeWallet gives no per-code retry advice.
 *
 * Status words differ per endpoint and between the data types, the examples
 * and the narrative text of the reference. They are kept per endpoint and are
 * never merged into one state machine. Each status records where it is
 * documented.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const API_DOCS_URL = "https://emerchantpay.github.io/ewallet-api-docs/";
export const API_DOCS_REPO_URL = "https://github.com/eMerchantPay/ewallet-api-docs";
export const SITE_URL = "https://ezeewallet.com/en";
export const BUSINESS_URL = "https://ezeewallet.com/en/business";
export const GENESIS_DOCS_URL = "https://emerchantpay.github.io/gateway-api-docs/";

export type ErrorCodeEntry = {
  /** Short paraphrase of the documented message. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** HTTP status the reference documents for this code. */
  httpStatus: 400 | 500;
  /** More precise next step than the generic category text, where useful. */
  nextAction?: string;
  /** Retry explanation specific to this code. */
  retryNote?: string;
};

const err = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  extra: Partial<Pick<ErrorCodeEntry, "nextAction" | "retryNote" | "httpStatus">> = {},
): ErrorCodeEntry => ({ meaning, category, retry, httpStatus: 400, ...extra });

/**
 * The 27 codes of the "Errors" table (`error.code`). Code 411 is not in the
 * table. The codes look like HTTP status numbers but are application codes:
 * all of them come with HTTP 400, except 500 which comes with HTTP 500.
 */
export const ERROR_CODES: Record<string, ErrorCodeEntry> = {
  "401": err(
    "Parameters are missing or invalid; the same code is also used to say that the password parameter has been deprecated",
    "invalid_request",
    "do_not_retry",
  ),
  "402": err(
    "The source wallet credentials are invalid",
    "authentication_failed",
    "customer_action_required",
    {
      nextAction:
        "Ask the consumer to check the wallet credentials they entered before a new attempt.",
    },
  ),
  "403": err(
    "The transaction is not allowed for the source (consumer) wallet",
    "payment_method_unavailable",
    "manual_review",
  ),
  "404": err("The merchant wallet is disabled", "configuration", "manual_review", {
    nextAction: "Check the merchant wallet status with eZeeWallet before sending further requests.",
  }),
  "405": err(
    "The target wallet account was not found",
    "invalid_request",
    "customer_action_required",
  ),
  "406": err(
    "The transaction is not allowed for the target wallet",
    "payment_method_unavailable",
    "manual_review",
  ),
  "407": err("Currency mismatch", "invalid_request", "do_not_retry"),
  "408": err("The transaction ID has already been processed", "duplicate_request", "do_not_retry", {
    nextAction:
      "Look up the outcome of the original transaction instead of sending it again; a new attempt needs a new transaction ID.",
  }),
  "409": err(
    "The top-up the consumer would need exceeds the maximum deposit amount",
    "invalid_amount",
    "customer_action_required",
  ),
  "410": err("The wallets belong to different industry types", "configuration", "do_not_retry"),
  "412": err("Payouts are suspended for this account", "configuration", "manual_review", {
    nextAction: "Contact eZeeWallet about the payout suspension before sending further payouts.",
  }),
  "413": err(
    "An amount in the batch payout has an invalid format",
    "invalid_amount",
    "do_not_retry",
  ),
  "414": err(
    "The source (merchant) wallet balance is too low for the payout",
    "insufficient_funds",
    "retry_conditionally",
    {
      nextAction: "Fund the merchant wallet before sending the payout again.",
      retryNote:
        "eZeeWallet rejected the payout because the merchant wallet balance is too low; this is a merchant-side balance, not the consumer's. Send the payout again only after the merchant wallet has been funded, and first check that no earlier payout with the same merchant reference succeeded.",
    },
  ),
  "415": err("The payout threshold limit was exceeded", "invalid_amount", "manual_review"),
  "416": err("Record not found", "invalid_request", "do_not_retry"),
  "417": err(
    "A timed-out credit payout request cannot be approved",
    "invalid_request",
    "do_not_retry",
  ),
  "418": err(
    "A failed credit payout request cannot be approved",
    "invalid_request",
    "do_not_retry",
  ),
  "419": err(
    "A declined credit payout request cannot be approved",
    "invalid_request",
    "do_not_retry",
  ),
  "420": err("The credit payout request is already approved", "duplicate_request", "do_not_retry"),
  "421": err("The credit payout request is already declined", "invalid_request", "do_not_retry"),
  "422": err(
    "The merchant may not process transactions for this consumer's country",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "423": err(
    "The source wallet account was not found",
    "invalid_request",
    "customer_action_required",
  ),
  "424": err(
    "A batch payout currency does not match the source wallets",
    "invalid_request",
    "do_not_retry",
  ),
  "425": err(
    "The payout currency does not match the source wallets",
    "invalid_request",
    "do_not_retry",
  ),
  "426": err(
    "The target wallet currency differs from the payout currency",
    "invalid_request",
    "do_not_retry",
  ),
  "427": err("The payout amount has an invalid format", "invalid_amount", "do_not_retry"),
  "500": err(
    "The transfer failed because of an internal error",
    "provider_unavailable",
    "retry_conditionally",
    {
      httpStatus: 500,
      nextAction:
        "Check the transaction status with eZeeWallet (GET /transaction, or GET /transfers for a date range) before sending a new request.",
      retryNote:
        "eZeeWallet reports an internal error, so it is not certain whether the transfer took effect. Check the transaction status first (GET /transaction, or GET /transfers for a date range). Resending the same transaction ID is answered with code 408 (Transaction ID already processed), so a blind resend does not show the outcome.",
    },
  ),
};

/** Where a status word appears in the reference. */
export type StatusSource = "data type" | "example" | "data type and example" | "narrative";

export type StatusEntry = {
  outcome: Outcome;
  documentedIn: StatusSource;
  meaning: string;
};

const st = (outcome: Outcome, documentedIn: StatusSource, meaning: string): StatusEntry => ({
  outcome,
  documentedIn,
  meaning,
});

/** Endpoint or message whose status vocabulary is used. */
export type Vocabulary =
  | "transfers"
  | "transfers_new"
  | "refunds"
  | "transaction"
  | "single_payouts"
  | "single_payouts_new"
  | "batch_payouts"
  | "batch_payouts_new"
  | "transfer_notification"
  | "payout_notification"
  | "notification";

const TRANSFER_APPROVED = "The transfer to the merchant wallet was approved";
const BATCH_PENDING = "The batch is pending; per-item results are not documented";
const PENDING_TOP_UP =
  "The consumer has not finished; for example the wallet balance is too low and the consumer must top up through redirect_url. Funds are not reserved, and the final result arrives by notification";

/**
 * Status words per endpoint. The narrative of the reference also describes a
 * transfer "Timeout" ("user took too long to approve or decline"), but its
 * exact string is not documented, so it is not listed and stays unknown.
 */
export const STATUSES: Record<Vocabulary, Record<string, StatusEntry>> = {
  // POST /transfers (legacy): data type approved / pending_async, examples
  // approved / pending, narrative adds Declined.
  transfers: {
    approved: st("success", "data type and example", TRANSFER_APPROVED),
    pending: st("pending", "example", PENDING_TOP_UP),
    pending_async: st("pending", "data type", PENDING_TOP_UP),
    declined: st("failure", "narrative", "The transfer was declined"),
  },
  // POST /transfers_new, also list items of GET /transfers.
  transfers_new: {
    approved: st("success", "data type", TRANSFER_APPROVED),
    pending: st("pending", "data type and example", PENDING_TOP_UP),
    declined: st("failure", "data type", "The transfer was declined"),
  },
  refunds: {
    approved: st("success", "data type", "The refund to the consumer wallet was approved"),
    declined: st("failure", "data type", "The refund was declined"),
  },
  // GET /transaction?ezw_reference_id=
  transaction: {
    approved: st("success", "data type", "The transaction was approved"),
    pending: st("pending", "data type", "The transaction is not final yet"),
    declined: st("failure", "data type", "The transaction was declined"),
  },
  single_payouts: {
    succeeded: st("success", "data type", "The payout succeeded"),
    failed: st("failure", "data type", "The payout failed"),
  },
  single_payouts_new: {
    approved: st("success", "data type", "The payout was approved"),
    pending: st(
      "pending",
      "data type",
      "The consumer has no wallet account for that email yet and must onboard; a notification follows",
    ),
    declined: st("failure", "narrative", "The payout was declined"),
  },
  batch_payouts: {
    pending: st("pending", "data type", BATCH_PENDING),
    failed: st("failure", "data type", "The batch failed"),
  },
  batch_payouts_new: {
    pending: st("pending", "data type", BATCH_PENDING),
    failed: st("failure", "data type", "The batch failed"),
  },
  transfer_notification: {
    approved: st("success", "data type", "The transfer was approved"),
    declined: st(
      "failure",
      "data type",
      "The transfer was declined; decline_reason may carry free text",
    ),
  },
  payout_notification: {
    approved: st("success", "data type and example", "The payout was approved"),
    // The reference says payout notifications are sent for all statuses.
    pending: st("pending", "narrative", "The payout is not final yet"),
    declined: st("failure", "data type", "The payout was declined"),
  },
  // Notification data type, when the variant cannot be determined.
  notification: {
    approved: st("success", "data type", "Approved"),
    declined: st("failure", "data type", "Declined"),
  },
};

/** Stage per vocabulary. A wallet transfer is a payment, never a card authorization. */
export const VOCABULARY_STAGE: Record<Vocabulary, LifecycleStage> = {
  transfers: "payment",
  transfers_new: "payment",
  refunds: "refund",
  transaction: "other",
  single_payouts: "payout",
  single_payouts_new: "payout",
  batch_payouts: "payout",
  batch_payouts_new: "payout",
  transfer_notification: "payment",
  payout_notification: "payout",
  notification: "other",
};

/** `type` of GET /transaction. */
export const LOOKUP_TYPES: Record<string, LifecycleStage> = {
  transfer: "payment",
  payout: "payout",
};

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the consumer to act first (correct their wallet details, top up, or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first verify the current state of the transaction (GET /transaction) so that a new request does not duplicate an operation that already took effect.",
  safe_to_retry_technical_request: "The request can be repeated as a technical retry.",
  manual_review:
    "Review the transaction and the account settings before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the consumer to use another payment method.",
  authentication_required: "Ask the consumer to authenticate again.",
  authentication_failed: "Ask the consumer to check their wallet credentials.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, its format (integer minor units) and the currency.",
  insufficient_funds: "Make sure the paying wallet holds enough funds before a new attempt.",
  payment_method_unavailable:
    "Offer another payment method; eZeeWallet does not allow this transaction for the wallet or country.",
  fraud_or_risk: "Review the transaction before any new attempt.",
  rate_limiting: "Reduce the request rate and retry later.",
  provider_unavailable: "Look up the transaction state before sending a new request.",
  network_or_timeout: "Look up the transaction state before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration: "Check the merchant account configuration with eZeeWallet.",
  unknown:
    "Look up the transaction with eZeeWallet (GET /transaction) and review it before any new attempt.",
};
