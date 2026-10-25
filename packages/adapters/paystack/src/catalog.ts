/**
 * Paystack code, message and status knowledge, kept as data.
 *
 * Source of every entry: docs/providers/research/paystack.md (verified
 * 2026-10-25). The developer documentation site answers scripted clients with
 * a challenge page, so the research read Paystack's own published copies of
 * its content instead:
 *
 * OpenAPI specification:        https://github.com/PaystackOSS/openapi
 * Response and webhook examples: https://github.com/PaystackOSS/doc-code-snippets
 * Help Center error articles:   https://support.paystack.com/en/articles/2123650 (bank),
 *                               2124674 (customer), 2125058 (fraud block), 2129794 (system)
 *
 * Paystack has no numeric decline code. Declines are free text, so the
 * message tables are keyed by the documented text. Meanings are short
 * paraphrases. Category and retry values are PandaPayLens suggestions derived
 * from the documented meaning and, where Paystack gives it, its own advice.
 */

import type {
  Confidence,
  ErrorCategory,
  LifecycleStage,
  Outcome,
  RetryGuidance,
} from "@pandapaylens/core";

export const OPENAPI_URL = "https://github.com/PaystackOSS/openapi";
export const SNIPPETS_URL = "https://github.com/PaystackOSS/doc-code-snippets";
export const SNIPPETS_API_URL = `${SNIPPETS_URL}/tree/main/dist/api`;
export const SAMPLE_ERROR_URL = `${SNIPPETS_URL}/blob/main/dist/api/introduction/sample-error.js`;
export const WEBHOOK_EVENTS_URL = `${SNIPPETS_URL}/blob/main/dist/doc/payments/webhooks/events.js`;
export const REFUND_EVENTS_URL = `${SNIPPETS_URL}/blob/main/dist/doc/payments/refunds/events.js`;
export const PAY_WITH_TRANSFER_EVENTS_URL = `${SNIPPETS_URL}/blob/main/dist/doc/payments/payment-methods/pwt-events.js`;
export const HELP = "https://support.paystack.com/en/articles";
export const BANK_ERRORS_URL = `${HELP}/2123650`;
export const CUSTOMER_ERRORS_URL = `${HELP}/2124674`;
export const FRAUD_ERRORS_URL = `${HELP}/2125058`;
export const SYSTEM_ERRORS_URL = `${HELP}/2129794`;
export const ABANDONED_URL = `${HELP}/2123330`;
export const REFUND_STATUSES_URL = `${HELP}/2130434`;
export const WEBHOOK_HELP_URL = `${HELP}/10609026`;
export const TRANSFERS_GAMING_URL = `${HELP}/9039298`;
export const DISPUTES_GAMING_URL = `${HELP}/9040130`;

export type CatalogEntry = {
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  /** Highest confidence the meaning supports. */
  confidence: Confidence;
  /** Where the entry is documented. */
  docsUrl: string;
  docsTitle: string;
};

const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to contact their bank, or to use another card or payment method.",
  authentication_required:
    "Ask the customer to complete the bank's authentication step (OTP, token or 3-D Secure), or to set it up with their bank first.",
  authentication_failed:
    "Ask the customer to check the authentication details (PIN, OTP, token or date of birth) and try again.",
  invalid_request: "Correct the request or the details supplied, then send a new request.",
  invalid_amount: "Check the amount against the limits that apply and use a valid amount.",
  insufficient_funds:
    "Ask the customer to fund the account or wallet, or to use another payment method.",
  payment_method_unavailable: "Ask the customer to use another card or payment method.",
  fraud_or_risk:
    "Do not charge this card again. Ask the customer to contact their bank or to use another payment method.",
  rate_limiting: "Wait before sending more requests.",
  provider_unavailable:
    "Verify the transaction before trying again; the bank or processor was probably unavailable for a while.",
  network_or_timeout:
    "Verify the transaction (GET /transaction/verify/{reference}) before trying again.",
  duplicate_request:
    "Check whether the earlier request with this reference already succeeded. Use a new reference only for a genuinely new payment.",
  configuration: "Check the API keys and the business configuration in the Paystack Dashboard.",
  unknown: "Verify the transaction and check its details in the Paystack Dashboard.",
};

const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Sending the same request again will not succeed until the cause is fixed.",
  customer_action_required: "Do not retry automatically. The customer has to act first.",
  retry_conditionally:
    "The original attempt may have gone through. Verify the transaction first (GET /transaction/verify/{reference}) and try again only if it did not succeed.",
  safe_to_retry_technical_request: "The request can be sent again.",
  manual_review: "Review the case before any new attempt.",
  unknown: "No retry guidance is available for this message.",
};

const DECLINE_RETRY =
  "Paystack describes this as a condition at the bank that can clear. Verify the transaction first; a later attempt may succeed, but avoid repeated automatic retries on the same card.";
const AUTH_RETRY =
  "The customer can try again with the correct authentication details. Do not retry automatically.";
const RATE_RETRY = "Wait before sending the request again.";

type Extra = {
  nextAction?: string;
  retryExplanation?: string;
  confidence?: Confidence;
};

function make(
  docsUrl: string,
  docsTitle: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation: string,
  extra: Extra = {},
): CatalogEntry {
  let retryExplanation = extra.retryExplanation ?? RETRY_EXPLANATION[retry];
  if (!extra.retryExplanation && retry === "retry_conditionally") {
    if (category === "card_declined") retryExplanation = DECLINE_RETRY;
    else if (category === "authentication_failed") retryExplanation = AUTH_RETRY;
    else if (category === "rate_limiting") retryExplanation = RATE_RETRY;
  }
  return {
    category,
    retry,
    explanation,
    nextAction: extra.nextAction ?? NEXT_ACTION[category],
    retryExplanation,
    // A message whose documented meaning covers several causes cannot be
    // decoded with more than possible confidence.
    confidence: extra.confidence ?? (category === "unknown" ? "possible" : "strong"),
    docsUrl,
    docsTitle,
  };
}

/** Lower-case, plain apostrophes, single spaces: the only variation tolerated. */
export function normalizeMessage(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

// 4.1 Error `type` (OpenAPI enum)

export const ERROR_TYPES: Record<string, CatalogEntry> = {
  validation_error: make(
    OPENAPI_URL,
    "Paystack OpenAPI: error type",
    "invalid_request",
    "do_not_retry",
    "The request failed validation: a missing or invalid parameter, an unknown record or a duplicate reference.",
  ),
  processor_error: make(
    OPENAPI_URL,
    "Paystack OpenAPI: error type",
    "unknown",
    "unknown",
    "Paystack lists processor_error as an error type, but its meaning and examples are not documented.",
    { confidence: "insufficient" },
  ),
  api_error: make(
    OPENAPI_URL,
    "Paystack OpenAPI: error type",
    "unknown",
    "retry_conditionally",
    "A generic server-side failure. Paystack's examples pair it with the code unknown and advice such as Try again later.",
  ),
};

// 4.2 Error `code` values seen in documented examples

export const ERROR_CODES: Record<string, CatalogEntry> = {
  duplicate_reference: make(
    OPENAPI_URL,
    "Paystack OpenAPI: initialize transaction (400)",
    "duplicate_request",
    "do_not_retry",
    "The transaction reference was already used. Paystack's next step is to use a new reference.",
  ),
  missing_params: make(
    SAMPLE_ERROR_URL,
    "Paystack API error format",
    "invalid_request",
    "do_not_retry",
    "A required parameter is missing.",
  ),
  invalid_params: make(
    SNIPPETS_API_URL,
    "Paystack API examples: refund retry, split update",
    "invalid_request",
    "do_not_retry",
    "A parameter value, or the state of the resource, is invalid for this request.",
  ),
  not_found: make(
    SNIPPETS_API_URL,
    "Paystack API examples",
    "invalid_request",
    "do_not_retry",
    "The referenced record does not exist on this integration.",
  ),
  transaction_not_found: make(
    SNIPPETS_API_URL,
    "Paystack API examples: Capitec Pay requery",
    "invalid_request",
    "do_not_retry",
    "No transaction with that reference exists on this integration.",
  ),
  invalid_transfer_recipient: make(
    SNIPPETS_API_URL,
    "Paystack API examples: initiate transfer",
    "invalid_request",
    "do_not_retry",
    "The transfer recipient code is invalid or missing.",
  ),
  unknown: make(
    SNIPPETS_API_URL,
    "Paystack API examples",
    "unknown",
    "retry_conditionally",
    "An unclassified error. Paystack's next step is often Try again later.",
  ),
  INVALID_PUSH_ID: make(
    SNIPPETS_API_URL,
    "Paystack API examples: terminal event status",
    "invalid_request",
    "do_not_retry",
    "The terminal push notification ID is invalid (Terminal API).",
  ),
};

// 4.3 API error messages (`status: false`)

type MessageEntry = CatalogEntry & {
  /** Documented text, exactly as published. */
  message: string;
  /** The documented text is a template; match its fixed prefix only. */
  prefix?: string;
};

function apiMsg(
  message: string,
  family: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation: string,
  extra: Extra & { prefix?: string } = {},
): MessageEntry {
  return {
    ...make(
      SNIPPETS_API_URL,
      `Paystack API examples: ${family}`,
      category,
      retry,
      explanation,
      extra,
    ),
    message,
    ...(extra.prefix ? { prefix: extra.prefix } : {}),
  };
}

export const API_ERROR_MESSAGES: readonly MessageEntry[] = [
  apiMsg(
    "Invalid key",
    "transactions (401 in the OpenAPI specification)",
    "configuration",
    "do_not_retry",
    "The secret key is wrong or missing.",
    {
      nextAction:
        "Check that the request uses the correct secret key for this mode (test or live).",
    },
  ),
  apiMsg(
    "Invalid Key",
    "products",
    "configuration",
    "do_not_retry",
    "The secret key is wrong or missing.",
    {
      nextAction:
        "Check that the request uses the correct secret key for this mode (test or live).",
    },
  ),
  apiMsg(
    "Entity not found",
    "OpenAPI NotFound (404)",
    "invalid_request",
    "do_not_retry",
    "The requested record does not exist.",
  ),
  apiMsg(
    "Duplicate Transaction Reference",
    "initialize transaction (duplicate_reference)",
    "duplicate_request",
    "do_not_retry",
    "The transaction reference was already used.",
  ),
  apiMsg(
    "Email Address is required",
    "sample error (missing_params)",
    "invalid_request",
    "do_not_retry",
    "The customer e-mail address is missing.",
  ),
  apiMsg(
    "Currency not supported by merchant",
    "supported currency",
    "configuration",
    "do_not_retry",
    "The business is not enabled for this currency.",
  ),
  apiMsg(
    "Transaction reference is invalid",
    "charge submit and check endpoints (400)",
    "invalid_request",
    "do_not_retry",
    "The charge reference is unknown or cannot be used.",
  ),
  apiMsg(
    "Email address is required for association with card",
    "create charge (400)",
    "invalid_request",
    "do_not_retry",
    "A card charge was sent without the customer e-mail address.",
  ),
  apiMsg(
    "Customer not found",
    "partial debit (400)",
    "invalid_request",
    "do_not_retry",
    "No customer exists for the given e-mail or customer code.",
  ),
  apiMsg(
    "Transaction ID or reference is invalid",
    "transaction timeline",
    "invalid_request",
    "do_not_retry",
    "The transaction is unknown.",
  ),
  apiMsg(
    "Transaction not found",
    "Capitec Pay requery (transaction_not_found)",
    "invalid_request",
    "do_not_retry",
    "The transaction reference is unknown.",
  ),
  apiMsg(
    "An error occurred",
    "Capitec Pay requery (500, api_error), preauthorization list (500)",
    "provider_unavailable",
    "retry_conditionally",
    "An unclassified server error.",
  ),
  apiMsg(
    "Authorization does not exist or does not belong to integration",
    "direct debit mandate verify, customer authorization verify",
    "invalid_request",
    "do_not_retry",
    "The authorization is unknown for this business.",
  ),
  apiMsg(
    "Authorization code not found.",
    "customer deactivate authorization (404)",
    "invalid_request",
    "do_not_retry",
    "The authorization code is unknown.",
  ),
  apiMsg(
    'Invalid Refund state, refund status should be "needs-attention"',
    "refund retry (422, invalid_params)",
    "invalid_request",
    "do_not_retry",
    "Only a refund in the needs-attention state can be retried with customer details.",
  ),
  apiMsg(
    "Refund amount cannot be greater than initial amount",
    "dispute update (400)",
    "invalid_amount",
    "do_not_retry",
    "The refund amount in the dispute exceeds the transaction amount.",
  ),
  apiMsg(
    "Recipient specified is invalid",
    "initiate transfer (400, invalid_transfer_recipient)",
    "invalid_request",
    "do_not_retry",
    "The transfer recipient code is invalid.",
  ),
  apiMsg(
    "Duplicate reference(s) found: <references>",
    "bulk transfer (api_error, unknown)",
    "duplicate_request",
    "do_not_retry",
    "Transfer references in the request were already used; the message lists them.",
    { prefix: "Duplicate reference(s) found:" },
  ),
  apiMsg(
    "Transfer code is invalid",
    "finalize transfer (400)",
    "invalid_request",
    "do_not_retry",
    "The transfer code given for OTP finalization is unknown.",
  ),
  apiMsg(
    "Transfer not found",
    "verify transfer (404)",
    "invalid_request",
    "do_not_retry",
    "The transfer reference is unknown.",
  ),
  apiMsg(
    "Capture amount cannot be more than authorized amount",
    "preauthorization capture (400)",
    "invalid_amount",
    "do_not_retry",
    "The capture exceeds the amount held.",
  ),
  apiMsg(
    "Customer email address is required",
    "preauthorization initialize (400)",
    "invalid_request",
    "do_not_retry",
    "The customer e-mail address is missing.",
  ),
  apiMsg(
    "No preauthorized transaction exists for the reference provided",
    "preauthorization release and list",
    "invalid_request",
    "do_not_retry",
    "The hold reference is unknown.",
  ),
  apiMsg(
    "Preauthorization unsuccessful",
    "preauthorization reserve (400)",
    "card_declined",
    "customer_action_required",
    "The hold could not be placed on the card.",
  ),
  apiMsg(
    "Preauthorization not found",
    "preauthorization verify (400, not_found)",
    "invalid_request",
    "do_not_retry",
    "The hold is unknown.",
  ),
  apiMsg(
    "Webhook endpoint management is not available for this integration",
    "webhook endpoints (403)",
    "configuration",
    "do_not_retry",
    "Webhook endpoint management is not enabled for the business.",
  ),
  apiMsg(
    "Unknown event type(s): charge.sucess",
    "create webhook endpoint (400)",
    "invalid_request",
    "do_not_retry",
    "An event name in the request is not recognized.",
    { prefix: "Unknown event type(s):" },
  ),
  apiMsg(
    "A webhook endpoint with this URL already exists for this domain",
    "create and update webhook endpoint (409)",
    "duplicate_request",
    "do_not_retry",
    "The webhook URL is already registered.",
  ),
  apiMsg(
    "Webhook endpoint not found",
    "webhook endpoint fetch, update, delete, ping (404)",
    "invalid_request",
    "do_not_retry",
    "The webhook endpoint code is unknown.",
  ),
  apiMsg(
    "Invalid query: must be one of next or previous",
    "webhook endpoint and event lists (400)",
    "invalid_request",
    "do_not_retry",
    "The pagination cursor parameter is invalid.",
  ),
  apiMsg(
    "Too many webhook ping requests. Please wait a moment and try again.",
    "webhook endpoint ping (429)",
    "rate_limiting",
    "retry_conditionally",
    "Too many ping requests were sent.",
  ),
  apiMsg(
    "Provide at least one field to update",
    "update webhook endpoint (400)",
    "invalid_request",
    "do_not_retry",
    "The update request contains no fields.",
  ),
  apiMsg(
    "Webhook event not found",
    "webhook event fetch and lookup (404)",
    "invalid_request",
    "do_not_retry",
    "The webhook delivery record is unknown.",
  ),
  apiMsg(
    "Something went wrong",
    "webhook event APIs (500)",
    "provider_unavailable",
    "retry_conditionally",
    "A server error.",
  ),
  apiMsg(
    "reference is required",
    "webhook event lookup (400)",
    "invalid_request",
    "do_not_retry",
    "A required query parameter is missing.",
  ),
  apiMsg(
    "Resend rate limit exceeded, please try again later",
    "webhook resend-matching (429)",
    "rate_limiting",
    "retry_conditionally",
    "Too many resend requests were sent.",
  ),
  apiMsg(
    "ids must be a non-empty array",
    "webhook resend (400)",
    "invalid_request",
    "do_not_retry",
    "The request body is invalid.",
  ),
];

// 4.4 Transaction-level outcome text in documented payloads

export type OutcomeText = {
  text: string;
  field: "gateway_response" | "message";
  outcome: "success" | "pending" | "failure";
  /** Present for failure texts. */
  entry?: CatalogEntry;
};

const outcomeEntry = (
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation: string,
  extra?: Extra,
) =>
  make(SNIPPETS_API_URL, "Paystack API and webhook examples", category, retry, explanation, extra);

export const OUTCOME_TEXTS: readonly OutcomeText[] = [
  { text: "Approved", field: "gateway_response", outcome: "success" },
  { text: "Successful", field: "gateway_response", outcome: "success" },
  { text: "Approved by Financial Institution", field: "gateway_response", outcome: "success" },
  { text: "Approved or completed successfully", field: "gateway_response", outcome: "success" },
  { text: "Payment successful", field: "gateway_response", outcome: "success" },
  { text: "Transaction in progress", field: "gateway_response", outcome: "pending" },
  {
    text: "No gateway was able to process the request",
    field: "gateway_response",
    outcome: "failure",
    entry: outcomeEntry(
      "provider_unavailable",
      "manual_review",
      "No downstream processor accepted the request.",
      { nextAction: "Check the transaction in the Paystack Dashboard before another attempt." },
    ),
  },
  { text: "madePayment", field: "message", outcome: "success" },
  {
    text: "Insufficient funds",
    field: "message",
    outcome: "failure",
    entry: outcomeEntry(
      "insufficient_funds",
      "customer_action_required",
      "The account does not have enough money for this payment.",
    ),
  },
  {
    text: "Error occured while enrolling you for OTP!",
    field: "message",
    outcome: "failure",
    entry: outcomeEntry(
      "authentication_failed",
      "retry_conditionally",
      "OTP enrollment failed at the bank.",
    ),
  },
  {
    text: "Account is de-activated, please contact Capitec for help",
    field: "message",
    outcome: "failure",
    entry: outcomeEntry(
      "payment_method_unavailable",
      "customer_action_required",
      "The customer's Capitec account is deactivated.",
    ),
  },
];

// 4.5 Help Center error messages

export type HelpCenterRow = CatalogEntry & {
  /** Documented variants of one row. */
  messages: readonly string[];
  /** Variants with a placeholder in square brackets, matched as templates. */
  templates?: readonly string[];
};

function hc(
  url: string,
  title: string,
): (
  messages: string | readonly string[],
  category: ErrorCategory,
  retry: RetryGuidance,
  explanation: string,
  extra?: Extra & { template?: boolean },
) => HelpCenterRow {
  return (messages, category, retry, explanation, extra = {}) => {
    const list = typeof messages === "string" ? [messages] : messages;
    return {
      ...make(url, title, category, retry, explanation, extra),
      messages: list,
      ...(extra.template ? { templates: list } : {}),
    };
  };
}

const bank = hc(BANK_ERRORS_URL, "Paystack Help Center: Bank errors");
const customer = hc(CUSTOMER_ERRORS_URL, "Paystack Help Center: Customer errors");
const fraud = hc(FRAUD_ERRORS_URL, "Paystack Help Center: Fraud block errors");
const system = hc(SYSTEM_ERRORS_URL, "Paystack Help Center: System errors");

const NOT_COMPLETED =
  "Paystack describes this as a payment the customer did not complete, not as a decline.";

export const BANK_ERRORS: readonly HelpCenterRow[] = [
  bank(
    "Access Denied",
    "card_declined",
    "retry_conditionally",
    "The bank says the account cannot be charged right now.",
  ),
  bank(
    "Auth Data Error",
    "card_declined",
    "retry_conditionally",
    "An issuer error specific to Verve cards.",
  ),
  bank("Account Closed", "card_declined", "do_not_retry", "The bank has closed the account."),
  bank(
    "An OTP related error has occurred, please contact support",
    "authentication_failed",
    "retry_conditionally",
    "The issuer could not generate a token at that time.",
  ),
  bank(
    "An error occurred while processing the request",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime, mostly with UBA Pay with Bank.",
  ),
  bank(
    "An invalid response was received from remote host, see provider response code/message for details",
    "unknown",
    "customer_action_required",
    `A GTB 737 USSD payment was not completed on the phone. ${NOT_COMPLETED}`,
  ),
  bank(
    "Bank could not send SMS",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime; no OTP was sent.",
  ),
  bank(
    "Beneficiary Bank not available",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime.",
  ),
  bank(
    "Card type has not been configured for payment gateway",
    "payment_method_unavailable",
    "customer_action_required",
    "The card is not enabled for online payments.",
  ),
  bank(
    "Card validation failed. Error occurred while processing your request",
    "provider_unavailable",
    "retry_conditionally",
    "Downtime during the attempt.",
  ),
  bank("Cannot process request", "provider_unavailable", "retry_conditionally", "Bank downtime."),
  bank(
    "Card Not Registered On Token Platform",
    "authentication_required",
    "customer_action_required",
    "The customer is not enrolled for OTP at the bank.",
  ),
  bank(
    "Contact Acquirer",
    "card_declined",
    "customer_action_required",
    "The customer's bank cannot process the payment now.",
  ),
  bank(
    "Daily transaction limit exceeded",
    "card_declined",
    "customer_action_required",
    "The bank's daily limit or minimum balance was reached.",
  ),
  bank(
    "Declined",
    "card_declined",
    "retry_conditionally",
    "The bank declined without giving a reason.",
  ),
  bank(
    "Do Not Honour",
    "card_declined",
    "customer_action_required",
    "The bank declined or restricted the account; common for international payments.",
  ),
  bank(
    "Error",
    "provider_unavailable",
    "retry_conditionally",
    "Downtime at the bank or at Paystack.",
  ),
  bank(
    "Error occurred while processing your request",
    "provider_unavailable",
    "retry_conditionally",
    "Processor downtime.",
  ),
  bank(
    "Error Occurred. Could Not Generate Token",
    "authentication_failed",
    "retry_conditionally",
    "The bank could not generate a token.",
  ),
  bank(
    "Error Occurred. Could Not Authenticate Token",
    "authentication_failed",
    "retry_conditionally",
    "The bank could not check the token.",
  ),
  bank(
    [
      "Exceeds withdrawal frequency",
      "Exceeds withdrawal frequency limit",
      "Exceeds withdrawal limit",
    ],
    "card_declined",
    "customer_action_required",
    "The daily number of withdrawals set by the bank was reached.",
  ),
  bank(
    "Invalid amount (currency conversion field overflow)",
    "invalid_amount",
    "customer_action_required",
    "The amount is outside a virtual card's limits.",
  ),
  bank(
    "Invalid Service Code",
    "fraud_or_risk",
    "customer_action_required",
    "A fraud block at the bank.",
  ),
  bank(
    "Invalid Transaction",
    "card_declined",
    "retry_conditionally",
    "The issuer cannot process the payment now; common with Verve.",
  ),
  bank(
    "Issuer or Switch Inoperative",
    "provider_unavailable",
    "retry_conditionally",
    "The bank or the card network is temporarily down.",
  ),
  bank("Lost Card", "fraud_or_risk", "do_not_retry", "The card was reported lost."),
  bank(
    "Lost Card, Pick-Up",
    "fraud_or_risk",
    "do_not_retry",
    "The card was reported lost; a replacement is waiting at the bank.",
  ),
  bank(
    ["Pickup card (lost card)", "Pickup card (stolen card)", "Pick-up card"],
    "fraud_or_risk",
    "do_not_retry",
    "The card is hotlisted as lost or stolen.",
  ),
  bank(
    "No hardware, No SMS sent",
    "authentication_required",
    "customer_action_required",
    "No OTP or hardware token is set up on the account.",
  ),
  bank(
    "Previous message located for a repeat or reversal, but repeat or reversal data are inconsistent with original message",
    "card_declined",
    "customer_action_required",
    "Paystack says the account appears to be dormant.",
  ),
  bank(
    "Received invalid response from remote entity",
    "provider_unavailable",
    "retry_conditionally",
    "Temporary bank downtime (Ecobank, First Bank).",
  ),
  bank(
    "Request to Generate Token is Successful",
    "authentication_required",
    "customer_action_required",
    "The OTP was generated but the customer did not continue.",
  ),
  bank(
    "Refer to card issuer",
    "card_declined",
    "customer_action_required",
    "The issuer flagged the card or the account.",
  ),
  bank(
    ["Refer to Financial Institution", "Refer to Financial Institution, Special Condition"],
    "card_declined",
    "customer_action_required",
    "An issue the customer has to resolve with the bank.",
  ),
  bank(
    "Restricted card",
    "card_declined",
    "customer_action_required",
    "A bank restriction, typically missing identification on the account.",
  ),
  bank(
    "Restricted Card, Pick-Up",
    "card_declined",
    "do_not_retry",
    "The card is restricted by the bank.",
  ),
  bank(
    ["Suspected Fraud", "Suspected Fraud, Pick-Up"],
    "fraud_or_risk",
    "do_not_retry",
    "The bank's fraud system blocked the payment.",
  ),
  bank(
    "The bank is currently unable to process this transaction; please try another card or bank account",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime.",
  ),
  bank(
    "This authorization could not be charged",
    "payment_method_unavailable",
    "do_not_retry",
    "A recurring charge is not possible on this Verve card.",
  ),
  bank(
    "This authorization could not be charged. Not a reusable verve card",
    "payment_method_unavailable",
    "customer_action_required",
    "A recurring charge is not possible on this Verve card.",
    { nextAction: "Paystack suggests collecting the card again to get a new authorization." },
  ),
  bank(
    "Transaction Error",
    "unknown",
    "retry_conditionally",
    "The bank or the processor could not complete the payment at that time.",
  ),
  bank(
    "The service provider is unreachable at the moment, please try again later",
    "provider_unavailable",
    "retry_conditionally",
    "Issuer downtime, common with Verve.",
  ),
  bank(
    "The bank is currently unable to process this transaction",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime.",
  ),
  bank(
    "Token Authentication failed. Received invalid response from remote entity",
    "authentication_failed",
    "retry_conditionally",
    "The bank could not verify the token.",
  ),
  bank(
    "Unable to perform transaction, try again",
    "unknown",
    "retry_conditionally",
    "Either brief downtime, or insufficient funds in a mobile money wallet.",
  ),
  bank(
    "Unknown Error",
    "provider_unavailable",
    "retry_conditionally",
    "Temporary bank downtime (UBA, Zenith Pay with Bank).",
  ),
  bank(
    "Unknown error or an unexpected error occurred during processing",
    "provider_unavailable",
    "retry_conditionally",
    "Bank downtime (Zenith Pay with Bank).",
  ),
  bank(
    "Unknown transaction",
    "provider_unavailable",
    "retry_conditionally",
    "A bank error, common with First Bank Pay with Bank.",
  ),
  bank(
    "User account is not active at the bank",
    "card_declined",
    "customer_action_required",
    "The account is not activated.",
  ),
  bank(
    "User has not been setup",
    "payment_method_unavailable",
    "customer_action_required",
    "The customer is not registered for Pay with Bank at their bank.",
  ),
  bank(
    "Your account does not seem to have a phone number, email or hardware token provisioned. Please contact your account officer",
    "authentication_required",
    "customer_action_required",
    "No OTP destination is linked to the account.",
  ),
  bank(
    "Transaction not permitted on this channel",
    "payment_method_unavailable",
    "customer_action_required",
    "The card or account is not enabled for this channel.",
  ),
];

export const CUSTOMER_ERRORS: readonly HelpCenterRow[] = [
  customer(
    "Duplicate Transaction ID",
    "duplicate_request",
    "do_not_retry",
    "The checkout was reloaded; the first attempt most likely succeeded.",
    { nextAction: "Verify the first attempt before asking the customer to pay again." },
  ),
  customer(
    "Enter the OTP code sent to your phone to complete the transaction",
    "authentication_required",
    "customer_action_required",
    "The payment was abandoned at the authentication step.",
  ),
  customer("Expired card", "card_declined", "customer_action_required", "The card has expired."),
  customer(
    "Incorrect Date of Birth",
    "authentication_failed",
    "customer_action_required",
    "A wrong date of birth was entered for Pay with Bank.",
  ),
  customer(
    "Incorrect PIN",
    "authentication_failed",
    "customer_action_required",
    "A wrong card PIN was entered.",
  ),
  customer(
    "Insufficient funds",
    "insufficient_funds",
    "customer_action_required",
    "The available balance is not enough; holds on the account can reduce it.",
  ),
  customer(
    "Invalid card number",
    "invalid_request",
    "customer_action_required",
    "A wrong card number was entered.",
  ),
  customer(
    "Invalid OTP",
    "authentication_failed",
    "customer_action_required",
    "A wrong OTP was entered.",
  ),
  customer(
    "Invalid token supplied",
    "authentication_failed",
    "customer_action_required",
    "A wrong token was entered.",
  ),
  customer(
    "Invalid USSD code",
    "invalid_request",
    "customer_action_required",
    "A wrong USSD string was dialled.",
  ),
  customer(
    "Kindly enter OTP",
    "authentication_required",
    "customer_action_required",
    "The OTP was sent but not entered.",
  ),
  customer(
    "Kindly enter the mobile no registered with your bank",
    "authentication_required",
    "customer_action_required",
    "The phone number for Pay with Bank was not provided.",
  ),
  customer(
    "Mobile number is invalid",
    "invalid_request",
    "customer_action_required",
    "A wrong phone number was entered for Pay with Bank.",
  ),
  customer(
    "No Card Record",
    "card_declined",
    "customer_action_required",
    "The card is unknown to the issuer, or the number or expiry date is wrong.",
  ),
  customer(
    "Payment Requires Token",
    "authentication_required",
    "customer_action_required",
    "The payment was abandoned at the authentication step.",
  ),
  customer(
    "PIN tries exceeded",
    "authentication_failed",
    "customer_action_required",
    "Too many wrong PINs were entered.",
    { retryExplanation: "Paystack advises trying again only after at least 24 hours." },
  ),
  customer(
    "Please conclude payment by logging in to iBank",
    "authentication_required",
    "customer_action_required",
    "GTB Pay with Bank was not completed on iBank.",
  ),
  customer(
    "Please conclude payment on your phone",
    "authentication_required",
    "customer_action_required",
    "A GTB 737 USSD payment was not completed.",
  ),
  customer(
    "Please confirm that this is a valid [bank name] account",
    "invalid_request",
    "customer_action_required",
    "A wrong account number was entered.",
    { template: true },
  ),
  customer(
    "Please enter the token sent to your phone to conclude payment of [XXXX] amount",
    "authentication_required",
    "customer_action_required",
    "The bank token was not entered.",
    { template: true },
  ),
  customer(
    "Please enter your birthday",
    "authentication_required",
    "customer_action_required",
    "The date of birth was not provided for Pay with Bank.",
  ),
  customer(
    "Press the button on your Zenith Bank token and type your PIN plus the One Time Password(OTP) generated by the token",
    "authentication_required",
    "customer_action_required",
    "The Zenith token step was not completed.",
  ),
  customer(
    "Press the white button on your GTB token and type the transaction code generated",
    "authentication_required",
    "customer_action_required",
    "The GTB token step was abandoned.",
  ),
  customer(
    "Sorry, this is not an ALAT account",
    "invalid_request",
    "customer_action_required",
    "A wrong account number was entered for ALAT by Wema.",
  ),
  customer(
    "Target Authorization Error",
    "insufficient_funds",
    "customer_action_required",
    "The mobile money wallet limit was reached or the wallet is underfunded.",
  ),
  customer(
    "Token Authorization Not Successful. Incorrect Token Supplied",
    "authentication_failed",
    "customer_action_required",
    "A wrong token was entered.",
  ),
  customer(
    "Token Not Generated. Customer Not Registered on Token Platform",
    "authentication_required",
    "customer_action_required",
    "The customer is not registered for OTP.",
  ),
  customer(
    "Token has expired",
    "authentication_failed",
    "customer_action_required",
    "The OTP expired.",
  ),
  customer(
    "The transaction was not completed",
    "unknown",
    "customer_action_required",
    `The customer did not finish the payment. ${NOT_COMPLETED}`,
  ),
  customer(
    "Transaction just initiated",
    "unknown",
    "customer_action_required",
    `The payment was started but not completed. ${NOT_COMPLETED}`,
  ),
  customer(
    "User's mobile number is invalid",
    "invalid_request",
    "customer_action_required",
    "The phone number is wrong or not registered with the bank.",
  ),
  customer(
    "Your balance is not sufficient for this transaction",
    "insufficient_funds",
    "customer_action_required",
    "The account does not have enough money.",
  ),
  customer(
    "Payer has reached their limit",
    "card_declined",
    "customer_action_required",
    "A bank or issuer spending or count limit was reached.",
  ),
];

export const FRAUD_ERRORS: readonly HelpCenterRow[] = [
  fraud(
    "Authorization was abandoned. Please try again",
    "authentication_required",
    "customer_action_required",
    "The customer stopped at the 3-D Secure or OTP step.",
  ),
  fraud(
    "Cardinal Authentication Required",
    "authentication_required",
    "customer_action_required",
    "The card's BIN does not support 3-D Secure.",
  ),
  fraud(
    "Identification required",
    "authentication_failed",
    "customer_action_required",
    "3-D Secure authentication could not be completed.",
  ),
  fraud(
    "The cardholder was not authorised. This is used in 3-D Secure Authentication",
    "authentication_failed",
    "customer_action_required",
    "3-D Secure was attempted but the card is not enrolled.",
  ),
  fraud(
    "Transaction not permitted to cardholder",
    "card_declined",
    "customer_action_required",
    "The bank restricts the customer's payments.",
  ),
  fraud(
    "Transaction was blocked by the Payment Server because it did not pass all risk checks",
    "authentication_required",
    "customer_action_required",
    "Paystack explains this as the card not being registered for 3-D Secure.",
  ),
];

export const SYSTEM_ERRORS: readonly HelpCenterRow[] = [
  system(
    "An unknown error has occurred, please contact system administrator",
    "provider_unavailable",
    "retry_conditionally",
    "Downtime during the attempt.",
  ),
  system(
    "Customer is blacklisted",
    "fraud_or_risk",
    "manual_review",
    "Paystack or the business blacklisted the customer.",
  ),
  system(
    "Currency not supported",
    "configuration",
    "do_not_retry",
    "The business is not enabled for this currency.",
  ),
  system(
    ["Denied by Fraud System", "Blocked by fraud system"],
    "fraud_or_risk",
    "retry_conditionally",
    "Paystack's fraud prevention denied the attempts.",
    {
      retryExplanation:
        "Paystack says this usually clears after 24 hours. Do not retry automatically before then.",
    },
  ),
  system(
    "Either remote server cannot be reached or the network connection was reset/broken",
    "network_or_timeout",
    "retry_conditionally",
    "Downtime on Paystack's side.",
  ),
  system(
    "Error, please try again",
    "provider_unavailable",
    "retry_conditionally",
    "Bank or processor downtime.",
  ),
  system(
    "E5015: Merchant [PAYSTACK PAYMENTS LTD] does not support currency [USD]",
    "configuration",
    "manual_review",
    "USD is not routed to the processor that was used.",
  ),
  system("Failed", "network_or_timeout", "retry_conditionally", "Network or processor downtime."),
  system(
    "Invalid Merchant selected",
    "configuration",
    "do_not_retry",
    "Wrong or swapped API keys in the integration.",
  ),
  system(
    "Merchant is not enabled for international transactions",
    "configuration",
    "do_not_retry",
    "International cards are not enabled for the business.",
  ),
  system(
    "Pay with Bank is not available at this time",
    "provider_unavailable",
    "retry_conditionally",
    "Pay with Bank is temporarily down.",
  ),
  system(
    "This cardholder has defaulted",
    "insufficient_funds",
    "customer_action_required",
    "Repeated insufficient funds results on this card.",
  ),
  system(
    "The transaction could not be processed at this time, please try again later",
    "provider_unavailable",
    "retry_conditionally",
    "Downtime.",
  ),
  system(
    "Timed out",
    "network_or_timeout",
    "retry_conditionally",
    "Paystack could not confirm the outcome; verify the transaction before retrying.",
  ),
  system(
    "Transaction Not Completed",
    "unknown",
    "retry_conditionally",
    "Either downtime or wrong details.",
  ),
  system(
    "Transaction not Found",
    "network_or_timeout",
    "retry_conditionally",
    "A requery during a processor timeout found nothing.",
  ),
  system(
    "Unable to conclude transaction",
    "provider_unavailable",
    "retry_conditionally",
    "Brief downtime.",
  ),
  system(
    "Unable to process transaction",
    "fraud_or_risk",
    "retry_conditionally",
    "Paystack's fraud prevention hotlisted the card after many cards or failures; the Dashboard shows it as Denied by Fraud System.",
    {
      retryExplanation:
        "Do not retry automatically. Paystack's fraud block on a card usually needs time to clear.",
    },
  ),
  system(
    "Unrecognized card type. Please try again with a Mastercard, Verve or VISA",
    "payment_method_unavailable",
    "customer_action_required",
    "The card brand is not accepted.",
  ),
  system("Unspecified Failure", "provider_unavailable", "retry_conditionally", "Downtime."),
];

export const HELP_CENTER_MESSAGES: readonly HelpCenterRow[] = [
  ...BANK_ERRORS,
  ...CUSTOMER_ERRORS,
  ...FRAUD_ERRORS,
  ...SYSTEM_ERRORS,
];

// 4.6 Inbound bank transfer rejection

export const INBOUND_TRANSFER_MESSAGE_TYPES: Record<string, CatalogEntry> = {
  INCORRECT_AMOUNT: make(
    PAY_WITH_TRANSFER_EVENTS_URL,
    "Paystack Pay with Transfer events",
    "invalid_amount",
    "customer_action_required",
    "The customer sent a different amount to the Pay with Transfer account.",
  ),
};

// Text lookup

export type MessageMatch = {
  /** Documented text, as published. */
  text: string;
  entry: CatalogEntry;
  table: "outcome_text" | "help_center";
};

const exact = new Map<string, MessageMatch>();
const templates: { re: RegExp; match: MessageMatch }[] = [];

// Outcome texts first: "Insufficient funds" is documented in both tables, and
// the payload example is the more direct evidence.
for (const o of OUTCOME_TEXTS) {
  if (o.entry)
    exact.set(normalizeMessage(o.text), { text: o.text, entry: o.entry, table: "outcome_text" });
}
for (const row of HELP_CENTER_MESSAGES) {
  for (const m of row.messages) {
    const match: MessageMatch = { text: m, entry: row, table: "help_center" };
    if (row.templates?.includes(m)) {
      const parts = normalizeMessage(m).split(/\[[^\]]+\]/);
      const re = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".{1,60}?");
      templates.push({ re: new RegExp(`^${re}$`), match });
    } else if (!exact.has(normalizeMessage(m))) exact.set(normalizeMessage(m), match);
  }
}

/** Failure text from a transaction payload: exact documented messages only. */
export function lookupDeclineMessage(text: string): MessageMatch | undefined {
  if (text.length > 300) return undefined;
  const n = normalizeMessage(text);
  return exact.get(n) ?? templates.find((t) => t.re.test(n))?.match;
}

/** Success and in-progress texts that are not failures. */
export function outcomeTextOf(text: string): OutcomeText | undefined {
  const n = normalizeMessage(text);
  return OUTCOME_TEXTS.find((o) => normalizeMessage(o.text) === n);
}

const apiExact = new Map<string, MessageEntry>();
for (const m of API_ERROR_MESSAGES)
  if (!m.prefix && !apiExact.has(normalizeMessage(m.message)))
    apiExact.set(normalizeMessage(m.message), m);

/** Top-level `message` of an error response. */
export function lookupApiMessage(text: string): MessageEntry | undefined {
  if (text.length > 1000) return undefined;
  const n = normalizeMessage(text);
  return (
    API_ERROR_MESSAGES.find((m) => m.message === text) ??
    apiExact.get(n) ??
    API_ERROR_MESSAGES.find((m) => m.prefix && n.startsWith(normalizeMessage(m.prefix)))
  );
}

// 5. Status vocabularies

export type StatusEntry = {
  stage: LifecycleStage;
  outcome: Outcome;
  meaning: string;
  /** False when the value is listed but its meaning is not documented. */
  known: boolean;
};

/** Transaction status (5.1) and Charge API states (5.2). */
export const TRANSACTION_STATUSES: Record<string, StatusEntry> = {
  success: { stage: "payment", outcome: "success", meaning: "Paid", known: true },
  failed: {
    stage: "payment",
    outcome: "failure",
    meaning: "Payment failed; the reason is in gateway_response or message",
    known: true,
  },
  // Paystack: the transaction "didn't fail because it never began". Shown as a
  // payment that ended without completing, not as a decline.
  abandoned: {
    stage: "cancellation",
    outcome: "failure",
    meaning: "The customer started but never completed the payment",
    known: true,
  },
  reversed: {
    stage: "reversal",
    outcome: "success",
    meaning: "Refunded after a processed refund, or reversed after a dispute",
    known: true,
  },
  processing: {
    stage: "payment",
    outcome: "pending",
    meaning: "Debit in progress",
    known: true,
  },
  pending: {
    stage: "payment",
    outcome: "pending",
    meaning: "Charge awaiting a final result",
    known: true,
  },
};

export const CHARGE_STATES: Record<string, StatusEntry> = {
  send_pin: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for the card PIN (POST /charge/submit_pin)",
    known: true,
  },
  send_otp: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for the OTP (POST /charge/submit_otp)",
    known: true,
  },
  send_phone: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for the phone number (POST /charge/submit_phone)",
    known: true,
  },
  send_birthday: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for the date of birth (POST /charge/submit_birthday)",
    known: true,
  },
  send_address: {
    stage: "authentication",
    outcome: "pending",
    meaning: "Waiting for the address (POST /charge/submit_address)",
    known: true,
  },
  open_url: {
    stage: "authentication",
    outcome: "pending",
    meaning: "The customer must open the returned URL (bank authentication, EFT)",
    known: true,
  },
  pay_offline: {
    stage: "payment",
    outcome: "pending",
    meaning: "The customer completes the payment on the phone; the result arrives by webhook",
    known: true,
  },
  pending_bank_transfer: {
    stage: "payment",
    outcome: "pending",
    meaning: "The customer must transfer to the returned account",
    known: true,
  },
};

/** Refund status (5.4). */
export const REFUND_STATUSES: Record<string, StatusEntry> = {
  pending: { stage: "refund", outcome: "pending", meaning: "Refund created", known: true },
  processing: {
    stage: "refund",
    outcome: "pending",
    meaning: "The processor received the refund",
    known: true,
  },
  processed: {
    stage: "refund",
    outcome: "success",
    meaning: "Refund completed; the transaction becomes reversed",
    known: true,
  },
  failed: {
    stage: "refund",
    outcome: "failure",
    meaning: "Refund failed; the transaction goes back to success and the money to the merchant",
    known: true,
  },
  "needs-attention": {
    stage: "refund",
    outcome: "pending",
    meaning:
      "The refund needs the customer's bank details; only this state can be retried with POST /refund/retry_with_customer_details/{id}",
    known: true,
  },
};

/** Dispute status filter enum (OpenAPI) and the `archived` value seen in examples. */
export const DISPUTE_STATUSES: readonly string[] = [
  "awaiting-merchant-feedback",
  "awaiting-bank-feedback",
  "pending",
  "resolved",
  "archived",
];

/** Dispute resolution: request enum plus `auto-accepted` from the resolve example. */
export const DISPUTE_RESOLUTIONS: readonly string[] = [
  "merchant-accepted",
  "declined",
  "auto-accepted",
];

/** Transfer status enum (5.6). Meanings of four values are not documented. */
export const TRANSFER_STATUSES: Record<string, StatusEntry> = {
  pending: { stage: "payout", outcome: "pending", meaning: "Transfer in progress", known: true },
  success: { stage: "payout", outcome: "success", meaning: "Transfer completed", known: true },
  failed: { stage: "payout", outcome: "failure", meaning: "Transfer failed", known: true },
  otp: {
    stage: "payout",
    outcome: "pending",
    meaning: "Waiting for the OTP (POST /transfer/finalize_transfer)",
    known: true,
  },
  reversed: { stage: "reversal", outcome: "success", meaning: "Transfer reversed", known: true },
  abandoned: { stage: "payout", outcome: "unknown", meaning: "Not documented", known: false },
  blocked: { stage: "payout", outcome: "unknown", meaning: "Not documented", known: false },
  rejected: { stage: "payout", outcome: "unknown", meaning: "Not documented", known: false },
  received: { stage: "payout", outcome: "unknown", meaning: "Not documented", known: false },
};

// 6.2 Webhook events

export type WebhookKind = "transaction" | "dispute" | "refund" | "transfer" | "inbound_transfer";

export type WebhookEventEntry = {
  stage: LifecycleStage;
  outcome: Outcome | "from_status";
  kind: WebhookKind;
  meaning: string;
};

/** Events with documented payloads that PandaPayLens analyzes. */
export const WEBHOOK_EVENTS: Record<string, WebhookEventEntry> = {
  "charge.success": {
    stage: "payment",
    outcome: "success",
    kind: "transaction",
    meaning: "A successful charge",
  },
  // Listed in the events catalog ("A failed charge") without a payload example.
  "charge.failed": {
    stage: "payment",
    outcome: "failure",
    kind: "transaction",
    meaning: "A failed charge",
  },
  "charge.dispute.create": {
    stage: "dispute",
    outcome: "unknown",
    kind: "dispute",
    meaning: "A dispute was logged against a transaction",
  },
  "charge.dispute.remind": {
    stage: "dispute",
    outcome: "unknown",
    kind: "dispute",
    meaning: "A reminder about an unresolved dispute",
  },
  "charge.dispute.resolve": {
    stage: "dispute",
    outcome: "unknown",
    kind: "dispute",
    meaning: "A dispute was resolved",
  },
  "refund.pending": {
    stage: "refund",
    outcome: "pending",
    kind: "refund",
    meaning: "Refund created",
  },
  "refund.processing": {
    stage: "refund",
    outcome: "pending",
    kind: "refund",
    meaning: "The processor received the refund",
  },
  "refund.processed": {
    stage: "refund",
    outcome: "success",
    kind: "refund",
    meaning: "Refund completed",
  },
  "refund.failed": {
    stage: "refund",
    outcome: "failure",
    kind: "refund",
    meaning: "Refund failed",
  },
  "refund.needs-attention": {
    stage: "refund",
    outcome: "pending",
    kind: "refund",
    meaning: "The refund needs the customer's bank details",
  },
  "transfer.success": {
    stage: "payout",
    outcome: "success",
    kind: "transfer",
    meaning: "Transfer completed",
  },
  "transfer.failed": {
    stage: "payout",
    outcome: "failure",
    kind: "transfer",
    meaning: "Transfer failed",
  },
  "transfer.reversed": {
    stage: "reversal",
    outcome: "success",
    kind: "transfer",
    meaning: "Transfer reversed",
  },
  "bank.transfer.rejected": {
    stage: "payment",
    outcome: "failure",
    kind: "inbound_transfer",
    meaning: "An inbound bank transfer to a Pay with Transfer account was rejected",
  },
};

/**
 * Documented event names outside the analyzed scope. They are recognized and
 * shown on the timeline, without semantics.
 */
export const OTHER_WEBHOOK_EVENTS: readonly string[] = [
  "preauthorization.reserve.success",
  "preauthorization.capture.success",
  "preauthorization.capture.failed",
  "preauthorization.release.success",
  "preauthorization.release.failed",
  "direct_debit.authorization.created",
  "direct_debit.authorization.active",
  "zero_charge_authorization.failed",
  "subscription.create",
  "subscription.disable",
  "subscription.not_renew",
  "subscription.expiring_cards",
  "invoice.create",
  "invoice.update",
  "invoice.payment_failed",
  "paymentrequest.pending",
  "paymentrequest.success",
  "customeridentification.success",
  "customeridentification.failed",
  "dedicatedaccount.assign.success",
  "dedicatedaccount.assign.failed",
];
