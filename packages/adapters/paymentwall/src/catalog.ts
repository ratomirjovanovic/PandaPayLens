/**
 * Paymentwall code and status knowledge, kept as data.
 *
 * Every value below comes from docs/providers/high-risk/research/paymentwall.md,
 * which cites the public Paymentwall documentation pages linked in the URL
 * constants and the official paymentwall-php / paymentwall-node SDK sources.
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * interpretations of the documented meanings, not Paymentwall statements.
 *
 * Code spaces collide: Brick and MINT redemption reuse 1001, 1003, 3001 to
 * 3006, 3008 and 3009 with different meanings, and 200 is both a Brick token
 * error and a pingback type. The tables are therefore kept per product family
 * and are only merged by `codeCandidates`, which returns every family that
 * documents a code.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DOCS = "https://docs.paymentwall.com";

export const PINGBACK_URL = `${DOCS}/reference/pingback-home`;
export const PINGBACK_TOOL_URL = `${DOCS}/sandbox/pingback-tool`;
export const SIGNATURE_URL = `${DOCS}/reference/signature-calculation`;
export const CUSTOM_PARAMETER_URL = `${DOCS}/reference/pingback/custom-parameter`;
export const CLIENT_CALLBACK_URL = `${DOCS}/reference/client-side-callback`;
export const BRICK_HOME_URL = `${DOCS}/integration/direct/brick-home`;
export const BRICK_CHARGE_URL = `${DOCS}/integration/direct/brick/charge`;
export const BRICK_3DS_URL = `${DOCS}/integration/direct/brick/3dsecure`;
export const BRICK_SUBSCRIPTION_URL = `${DOCS}/integration/direct/brick/subscription`;
export const BRICK_PINGBACK_URL = `${DOCS}/integration/direct/brick/pingback`;
export const BRICK_ERRORS_URL = `${DOCS}/integration/direct/brick/error-codes`;
export const BRICK_SANDBOX_URL = `${DOCS}/integration/direct/brick/sandbox`;
export const CHECKOUT_SUBSCRIPTION_URL = `${DOCS}/integration/checkout/subscription`;
export const WIDGET_HOME_URL = `${DOCS}/integration/widget-home`;
export const CREDIT_CARD_URL = `${DOCS}/payment-method/credit-card`;
export const INDUSTRY_REQUIREMENTS_URL = `${DOCS}/guides/industry-requirements`;
export const APIS_URL = `${DOCS}/apis`;
export const TERMINAL3_BRICK_ERRORS_URL =
  "https://docs.terminal3.com/integration/direct/brick/error-codes";
export const PHP_SDK_PINGBACK_URL =
  "https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Pingback.php";
export const PHP_SDK_CHARGE_URL =
  "https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Charge.php";
export const PHP_SDK_ERROR_URL =
  "https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Response/Error.php";

// ---------------------------------------------------------------------------
// Pingbacks (research section 6a)

export type PingbackType = {
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
  isRecurring?: boolean;
  /** Which product family documents the type. */
  product: "all" | "virtual_currency" | "subscription" | "brick";
  /**
   * Whether `ref` + `_` + `type` (the SDK's unique pingback id) identifies one
   * business event. A ref can be partially refunded more than once, so 220
   * repeats legitimately.
   */
  uniquePerRef: boolean;
  note?: string;
  docs: string;
};

export const PINGBACK_TYPES: Readonly<Record<string, PingbackType>> = {
  "0": {
    meaning: "Payment completed, deliver the goods",
    stage: "payment",
    outcome: "success",
    product: "all",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "1": {
    meaning: "Payment confirmation (Virtual Currency API), treated as deliverable",
    stage: "payment",
    outcome: "success",
    product: "virtual_currency",
    uniquePerRef: true,
    note: "Type 1 is documented inconsistently: the Test Pingback Tool calls it a Virtual Currency payment confirmation, the PHP SDK names it PINGBACK_TYPE_GOODWILL, and the main pingback page omits it.",
    docs: PINGBACK_TOOL_URL,
  },
  "2": {
    meaning: "Negative pingback: chargeback, refund or fraud, take the goods back",
    stage: "reversal",
    outcome: "success",
    product: "all",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "12": {
    meaning: "Subscription cancelled by the user",
    stage: "cancellation",
    outcome: "success",
    product: "subscription",
    uniquePerRef: true,
    note: "Pingback types 12, 13 and 14 are sent only when activated for the project.",
    docs: PINGBACK_URL,
  },
  "13": {
    meaning: "Subscription expired",
    stage: "subscription",
    outcome: "success",
    product: "subscription",
    uniquePerRef: true,
    note: "Pingback types 12, 13 and 14 are sent only when activated for the project.",
    docs: BRICK_SUBSCRIPTION_URL,
  },
  "14": {
    meaning: "Subscription renewal failed, the subscription is stopped",
    stage: "subscription",
    outcome: "failure",
    isRecurring: true,
    product: "subscription",
    uniquePerRef: true,
    note: "Paymentwall sends type 14 after the failed renewal and its 2 reattempts (3 attempts in total). Pingback types 12, 13 and 14 are sent only when activated for the project.",
    docs: BRICK_SUBSCRIPTION_URL,
  },
  "200": {
    meaning: "Brick payment under risk review, do not deliver yet",
    stage: "payment",
    outcome: "pending",
    product: "brick",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "201": {
    meaning: "Brick risk review passed, deliver the goods",
    stage: "payment",
    outcome: "success",
    product: "brick",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "202": {
    meaning: "Brick risk review declined, the user is refunded",
    stage: "payment",
    outcome: "failure",
    product: "brick",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "203": {
    meaning: "Brick authorization voided because it was not captured in time",
    stage: "void",
    outcome: "success",
    product: "brick",
    uniquePerRef: true,
    docs: PINGBACK_URL,
  },
  "220": {
    meaning: "Partial refund successful",
    stage: "refund",
    outcome: "success",
    product: "all",
    uniquePerRef: false,
    note: "Type 220 is on the pingback documentation page but not among the SDK constants.",
    docs: PINGBACK_URL,
  },
};

export type NegativeReason = {
  meaning: string;
  stage: LifecycleStage;
  outcome: Outcome;
  /** A ref can be partially reversed more than once. */
  repeatable?: boolean;
};

/** `reason` values of a negative pingback (`type=2`). */
export const NEGATIVE_REASONS: Readonly<Record<string, NegativeReason>> = {
  // A chargeback is a dispute; the payload does not say whether it is final.
  "1": { meaning: "Chargeback", stage: "dispute", outcome: "unknown" },
  "2": { meaning: "Credit card fraud (ban the user)", stage: "reversal", outcome: "success" },
  "3": { meaning: "Other fraud (ban the user)", stage: "reversal", outcome: "success" },
  "4": { meaning: "Bad data entry", stage: "reversal", outcome: "success" },
  "5": { meaning: "Fake or proxy user", stage: "reversal", outcome: "success" },
  "6": { meaning: "Rejected by advertiser", stage: "reversal", outcome: "success" },
  "7": { meaning: "Duplicate conversions", stage: "reversal", outcome: "success" },
  "8": { meaning: "Goodwill credit taken back", stage: "reversal", outcome: "success" },
  "9": { meaning: "Cancelled order, for example a refund", stage: "refund", outcome: "success" },
  "10": {
    meaning: "Partially reversed transaction",
    stage: "reversal",
    outcome: "success",
    repeatable: true,
  },
  "11": { meaning: "PayPal e-check failed", stage: "reversal", outcome: "success" },
  "12": { meaning: "Non-collection", stage: "reversal", outcome: "success" },
};

/** `sign_version` values: 1 is deprecated, 2 is MD5, 3 is SHA-256. */
export const SIGN_VERSIONS: Readonly<Record<string, string>> = {
  "1": "v1 (deprecated, fixed field set)",
  "2": "v2 (MD5)",
  "3": "v3 (SHA-256)",
};

/** Brick charge `risk`: `approved` is documented; `pending` only in the PHP SDK. */
export const CHARGE_RISK_VALUES = ["approved", "pending"] as const;

/** Mobiamo `flow` values. */
export const MOBIAMO_FLOWS = ["code", "msisdn", "redirect"] as const;

/** Client-side `postMessage` events (browser only, not authoritative). */
export const CLIENT_EVENTS = [
  "paymentSuccess",
  "widgetLoaded",
  "widgetSizeChanged",
  "paymentProcessingStart",
  "paymentProcessingEnd",
] as const;

// ---------------------------------------------------------------------------
// Error codes (research sections 6b to 6f)

export type CodeFamily =
  "brick_token" | "brick_payment" | "mobiamo" | "mint_generation" | "mint_redemption";

export const FAMILY_LABELS: Readonly<Record<CodeFamily, string>> = {
  brick_token: "Brick one-time token",
  brick_payment: "Brick payment",
  mobiamo: "Mobiamo",
  mint_generation: "MINT ePIN generation",
  mint_redemption: "MINT ePIN redemption",
};

export const FAMILY_DOCS: Readonly<Record<CodeFamily, { title: string; url: string }[]>> = {
  brick_token: [{ title: "Paymentwall Brick error codes", url: BRICK_ERRORS_URL }],
  brick_payment: [{ title: "Paymentwall Brick error codes", url: BRICK_ERRORS_URL }],
  mobiamo: [{ title: "Paymentwall API reference (Mobiamo)", url: APIS_URL }],
  mint_generation: [{ title: "Paymentwall API reference (MINT)", url: APIS_URL }],
  mint_redemption: [{ title: "Paymentwall API reference (MINT)", url: APIS_URL }],
};

export type CodeEntry = {
  code: string;
  family: CodeFamily;
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  /** Whether the code shows that the operation did not take effect. */
  outcomeKnown: boolean;
};

const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined: "Ask the customer to contact their card issuer or to use another card.",
  authentication_required: "Complete the required authentication step and submit a new attempt.",
  authentication_failed: "Start a new session and send the request again.",
  invalid_request: "Correct the request data named by the code before sending a new request.",
  invalid_amount: "Check the amount and currency of the request against the project's limits.",
  insufficient_funds: "Ask the customer to use another card or payment method.",
  payment_method_unavailable: "Offer the customer another card or payment method.",
  fraud_or_risk:
    "Do not retry. Paymentwall does not allow this payment; the payload does not say why. Contact Paymentwall support if you need details.",
  rate_limiting: "Stop sending further attempts for this request.",
  provider_unavailable:
    "Check the state of the original operation before sending a new request (for Brick, GET /api/brick/charge/$id).",
  network_or_timeout: "Check the state of the original operation before sending a new request.",
  duplicate_request: "Do not send the request again; look up the existing charge or ePIN instead.",
  configuration:
    "Check the project keys, the X-ApiKey header and the project settings in the Paymentwall Merchant Area.",
  unknown: "Check the operation in the Paymentwall Merchant Area or with Paymentwall support.",
};

const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Sending the same request again will fail the same way until the cause is fixed.",
  customer_action_required:
    "A new attempt makes sense only after the customer has corrected the data or chosen another card.",
  retry_conditionally:
    "A new attempt can succeed, but only after checking that the original operation did not take effect.",
  safe_to_retry_technical_request:
    "The request was rejected before anything was created, so repeating it is safe once the technical cause is gone.",
  manual_review: "Check the current state of the charge or ePIN before doing anything else.",
  unknown: "The documented meaning is not specific enough to judge whether a retry is safe.",
};

type RowOverrides = Partial<
  Pick<CodeEntry, "explanation" | "nextAction" | "retryExplanation" | "outcomeKnown">
>;

function row(
  family: CodeFamily,
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  o: RowOverrides = {},
): CodeEntry {
  return {
    code,
    family,
    meaning,
    category,
    retry,
    explanation: o.explanation ?? `${FAMILY_LABELS[family]} error ${code}: ${meaning}.`,
    nextAction: o.nextAction ?? NEXT_ACTION[category],
    retryExplanation: o.retryExplanation ?? RETRY_EXPLANATION[retry],
    outcomeKnown:
      o.outcomeKnown ?? !(category === "provider_unavailable" || category === "unknown"),
  };
}

function table(entries: CodeEntry[]): Readonly<Record<string, CodeEntry>> {
  return Object.fromEntries(entries.map((e) => [e.code, e]));
}

const CARD_FIX = "Ask the customer to check and re-enter the card details, or to use another card.";
const ADDRESS_FIX = "Ask the customer to correct the billing details and submit a new attempt.";
const TOKEN_INTERNAL: RowOverrides = {
  // Tokenization creates no payment, so an internal error cannot have charged the card.
  outcomeKnown: true,
  nextAction: "Request a new one-time token.",
  retryExplanation:
    "Tokenization does not create a payment, so requesting a new token after an internal error cannot charge the card twice.",
};
const UNCERTAIN_CHARGE: RowOverrides = {
  retryExplanation:
    "An internal error does not say whether the charge or modification took effect. Check the charge (GET /api/brick/charge/$id or the pingback) before sending a new request; a blind retry could charge twice.",
};

export const BRICK_TOKEN_ERRORS = table([
  row("brick_token", "200", "Empty request", "invalid_request", "do_not_retry"),
  row(
    "brick_token",
    "223",
    "Expiration date empty or invalid",
    "invalid_request",
    "customer_action_required",
    {
      nextAction: CARD_FIX,
    },
  ),
  row(
    "brick_token",
    "224",
    "Card number empty or invalid",
    "invalid_request",
    "customer_action_required",
    {
      nextAction: CARD_FIX,
    },
  ),
  row("brick_token", "225", "CVV empty or invalid", "invalid_request", "customer_action_required", {
    nextAction: CARD_FIX,
  }),
  row(
    "brick_token",
    "231",
    "Internal error",
    "provider_unavailable",
    "safe_to_retry_technical_request",
    TOKEN_INTERNAL,
  ),
  row(
    "brick_token",
    "700",
    "Internal error",
    "provider_unavailable",
    "safe_to_retry_technical_request",
    TOKEN_INTERNAL,
  ),
  row("brick_token", "2111", "Public key missing or invalid", "configuration", "do_not_retry"),
]);

export const BRICK_PAYMENT_ERRORS = table([
  // The research suggests safe_to_retry; an internal error on a charge leaves
  // the outcome open, so PandaPayLens asks to verify first.
  row(
    "brick_payment",
    "1000",
    "Internal error",
    "provider_unavailable",
    "retry_conditionally",
    UNCERTAIN_CHARGE,
  ),
  row(
    "brick_payment",
    "1001",
    "Project not loaded, check the credentials",
    "configuration",
    "do_not_retry",
  ),
  row("brick_payment", "1003", "Payment method not active", "configuration", "do_not_retry"),
  row("brick_payment", "3000", "Charge not found", "invalid_request", "do_not_retry"),
  row("brick_payment", "3001", "Permission denied", "configuration", "do_not_retry"),
  row("brick_payment", "3002", "Wrong charge amount", "invalid_amount", "do_not_retry"),
  row(
    "brick_payment",
    "3003",
    "Card number missing or invalid",
    "invalid_request",
    "customer_action_required",
    { nextAction: CARD_FIX },
  ),
  row(
    "brick_payment",
    "3004",
    "Expiration month invalid",
    "invalid_request",
    "customer_action_required",
    { nextAction: CARD_FIX },
  ),
  row(
    "brick_payment",
    "3005",
    "Expiration year invalid",
    "invalid_request",
    "customer_action_required",
    { nextAction: CARD_FIX },
  ),
  row(
    "brick_payment",
    "3006",
    "Expiration date invalid",
    "invalid_request",
    "customer_action_required",
    { nextAction: CARD_FIX },
  ),
  row("brick_payment", "3008", "Required fields missing", "invalid_request", "do_not_retry"),
  row(
    "brick_payment",
    "3009",
    "Billing address invalid",
    "invalid_request",
    "customer_action_required",
    { nextAction: ADDRESS_FIX },
  ),
  row(
    "brick_payment",
    "3010",
    "Declined, the customer should contact the issuer to approve the payment",
    "card_declined",
    "customer_action_required",
  ),
  row(
    "brick_payment",
    "3011",
    "Declined, the customer should contact the issuer about the balance",
    "insufficient_funds",
    "customer_action_required",
    {
      nextAction:
        "Ask the customer to contact their card issuer about the balance, or to use another card.",
    },
  ),
  row("brick_payment", "3012", "Declined", "card_declined", "retry_conditionally", {
    retryExplanation:
      "The payload does not say why the card was declined. A later attempt can succeed, but do not repeat it automatically in quick succession; another card is the safer option.",
  }),
  row(
    "brick_payment",
    "3013",
    "Declined because of a card issue",
    "card_declined",
    "customer_action_required",
  ),
  row("brick_payment", "3014", "Wrong CVV", "card_declined", "customer_action_required", {
    nextAction: CARD_FIX,
  }),
  row(
    "brick_payment",
    "3101",
    "Verify the card number",
    "invalid_request",
    "customer_action_required",
    {
      nextAction: CARD_FIX,
    },
  ),
  row("brick_payment", "3102", "Expired card", "card_declined", "customer_action_required", {
    nextAction: "Ask the customer to use a card that has not expired.",
  }),
  row(
    "brick_payment",
    "3103",
    "Card brand not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  row(
    "brick_payment",
    "3104",
    "Card country not supported",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  row("brick_payment", "3111", "Token not found", "invalid_request", "do_not_retry"),
  row("brick_payment", "3112", "One-time token invalid", "invalid_request", "do_not_retry", {
    nextAction: "Request a new one-time token; a one-time token cannot be reused.",
  }),
  row("brick_payment", "3113", "Test credentials invalid", "configuration", "do_not_retry"),
  row("brick_payment", "3114", "Token deleted", "invalid_request", "do_not_retry"),
  row(
    "brick_payment",
    "3115",
    "Amount below the minimum (default 0.50 USD)",
    "invalid_amount",
    "do_not_retry",
  ),
  row(
    "brick_payment",
    "3116",
    "Amount above the maximum (default 500 USD)",
    "invalid_amount",
    "do_not_retry",
  ),
  row(
    "brick_payment",
    "3200",
    "Retry or use another card",
    "card_declined",
    "retry_conditionally",
    {
      retryExplanation:
        "Paymentwall asks to retry or to use another card. Retry once at most, initiated by the customer, rather than automatically.",
    },
  ),
  row("brick_payment", "3201", "Charge already fully refunded", "invalid_request", "do_not_retry"),
  row("brick_payment", "3202", "Charge cannot be cancelled", "invalid_request", "do_not_retry"),
  row(
    "brick_payment",
    "3203",
    "Charge not found or already captured",
    "invalid_request",
    "do_not_retry",
  ),
  row("brick_payment", "3204", "Charge cannot be refunded", "invalid_request", "manual_review", {
    retryExplanation:
      "Check the charge state (refunded, captured, age) before trying again; card refunds are possible for 180 days.",
  }),
  row("brick_payment", "3205", "Duplicate charge", "duplicate_request", "do_not_retry"),
  row("brick_payment", "3206", "Authorization expired", "invalid_request", "do_not_retry", {
    nextAction:
      "The authorization can no longer be captured. Create a new charge if the customer still wants to pay.",
  }),
  ...(
    [
      ["3301", "Check the first name"],
      ["3302", "Check the last name"],
      ["3303", "Check the address"],
      ["3304", "Check the city"],
      ["3305", "Check the state"],
      ["3306", "Check the ZIP code"],
    ] as const
  ).map(([c, m]) =>
    row("brick_payment", c, m, "invalid_request", "customer_action_required", {
      nextAction: ADDRESS_FIX,
    }),
  ),
  ...(
    [
      ["3401", "Subscription period invalid"],
      ["3402", "Subscription not found"],
      ["3403", "Subscription period duration invalid"],
      ["3404", "Trial parameters invalid"],
      ["3405", "Trial period invalid"],
      ["3406", "Trial period duration invalid"],
      ["3407", "Trial amount invalid"],
      ["3408", "Retry count invalid"],
    ] as const
  ).map(([c, m]) => row("brick_payment", c, m, "invalid_request", "do_not_retry")),
  row("brick_payment", "4004", "Undefined method", "invalid_request", "do_not_retry"),
  row("brick_payment", "4005", "Empty request", "invalid_request", "do_not_retry"),
  row("brick_payment", "4006", "API key missing", "configuration", "do_not_retry"),
  row("brick_payment", "4007", "API key invalid", "configuration", "do_not_retry"),
  row("brick_payment", "4008", "Decryption failed", "configuration", "do_not_retry"),
  row("brick_payment", "5000", "Customer not allowed to pay", "fraud_or_risk", "do_not_retry"),
]);

export const MOBIAMO_CODES = table([
  row(
    "mobiamo",
    "W1",
    "Session expired",
    "authentication_failed",
    "safe_to_retry_technical_request",
    {
      nextAction: "Request a new Mobiamo token and start the flow again.",
      outcomeKnown: true,
    },
  ),
  row("mobiamo", "W3", "Wrong secret key", "configuration", "do_not_retry"),
  row("mobiamo", "W4", "Wrong project key", "configuration", "do_not_retry"),
  row("mobiamo", "W5", "Key or uid missing", "invalid_request", "do_not_retry"),
  row("mobiamo", "W13", "Bad parameters", "invalid_request", "do_not_retry"),
  row("mobiamo", "W14", "Price not found", "invalid_amount", "do_not_retry"),
  row("mobiamo", "W15", "Service unavailable", "provider_unavailable", "retry_conditionally", {
    retryExplanation:
      "Check the payment with get-payment before starting a new one; the original request may have been processed.",
  }),
  row("mobiamo", "W16", "Payment system blocked for this user", "fraud_or_risk", "do_not_retry"),
  // Printed without the W prefix in the documentation.
  row("mobiamo", "18", "Signature invalid", "configuration", "do_not_retry"),
  row("mobiamo", "W19", "API not activated", "configuration", "do_not_retry"),
]);

const MINT_BALANCE: RowOverrides = {
  nextAction: "Check the MINT balance and limits of the partner account.",
};

export const MINT_GENERATION_ERRORS = table([
  row("mint_generation", "1", "Service access error", "configuration", "do_not_retry"),
  row("mint_generation", "2", "Generation error", "provider_unavailable", "retry_conditionally", {
    retryExplanation:
      "Check whether the ePIN was generated before requesting another one, so that no second ePIN is created.",
  }),
  row(
    "mint_generation",
    "3",
    "Not enough balance",
    "insufficient_funds",
    "manual_review",
    MINT_BALANCE,
  ),
  row("mint_generation", "4", "Check the amount", "invalid_amount", "do_not_retry"),
  row("mint_generation", "5", "Amount below the minimum", "invalid_amount", "do_not_retry"),
  row("mint_generation", "6", "Wrong ePIN data", "invalid_request", "do_not_retry"),
  row("mint_generation", "7", "Wrong currency", "invalid_request", "do_not_retry"),
  row("mint_generation", "8", "Service not loaded", "provider_unavailable", "retry_conditionally", {
    retryExplanation:
      "Check whether the ePIN was generated before requesting another one, so that no second ePIN is created.",
  }),
  row("mint_generation", "9", "Currency not allowed", "invalid_request", "do_not_retry"),
  row(
    "mint_generation",
    "10",
    "Balance limit exceeded",
    "insufficient_funds",
    "manual_review",
    MINT_BALANCE,
  ),
  row("mint_generation", "-32000", "Authentication error", "configuration", "do_not_retry"),
  row("mint_generation", "-32001", "Partner type missing", "configuration", "do_not_retry"),
  row("mint_generation", "-32004", "Method unsuccessful", "unknown", "unknown"),
  row("mint_generation", "-32005", "API type not allowed", "configuration", "do_not_retry"),
  row("mint_generation", "-32006", "Invalid parameters", "invalid_request", "do_not_retry"),
  row("mint_generation", "-32007", "Bad API version", "configuration", "do_not_retry"),
]);

export const MINT_REDEMPTION_ERRORS = table([
  // As for Brick 1000: an internal error leaves the redemption's outcome open.
  row(
    "mint_redemption",
    "1001",
    "General internal error",
    "provider_unavailable",
    "retry_conditionally",
    {
      retryExplanation:
        "An internal error does not say whether the ePIN was redeemed. Check before submitting it again.",
    },
  ),
  row("mint_redemption", "1002", "Application not loaded", "configuration", "do_not_retry"),
  row("mint_redemption", "1003", "User banned", "fraud_or_risk", "do_not_retry"),
  row("mint_redemption", "2001", "Empty ePIN", "invalid_request", "do_not_retry"),
  row("mint_redemption", "2002", "Empty key", "invalid_request", "do_not_retry"),
  row("mint_redemption", "2003", "Wrong amount", "invalid_amount", "do_not_retry"),
  row("mint_redemption", "2004", "Wrong currency", "invalid_amount", "do_not_retry"),
  row("mint_redemption", "2005", "ePIN is not an array", "invalid_request", "do_not_retry"),
  row("mint_redemption", "2006", "Empty user id", "invalid_request", "do_not_retry"),
  row(
    "mint_redemption",
    "3001",
    "MINT not active for the project",
    "configuration",
    "do_not_retry",
  ),
  ...(
    [
      ["3002", "ePIN expired"],
      ["3003", "ePIN not activated"],
      ["3005", "ePIN not for this application"],
      ["3006", "ePIN invalid"],
    ] as const
  ).map(([c, m]) =>
    row("mint_redemption", c, m, "payment_method_unavailable", "customer_action_required", {
      nextAction: "Ask the customer to check the ePIN or to use another one.",
    }),
  ),
  row("mint_redemption", "3004", "Duplicate ePIN", "duplicate_request", "do_not_retry"),
  row(
    "mint_redemption",
    "3007",
    "Only one ePIN allowed",
    "invalid_request",
    "customer_action_required",
    {
      nextAction: "Ask the customer to submit a single ePIN.",
    },
  ),
  row("mint_redemption", "3008", "Tracking failure", "unknown", "manual_review"),
  row(
    "mint_redemption",
    "3009",
    "Insufficient ePIN funds",
    "insufficient_funds",
    "customer_action_required",
    { nextAction: "Ask the customer to use another ePIN or payment method." },
  ),
  row("mint_redemption", "4001", "Maximum attempts exceeded", "rate_limiting", "do_not_retry"),
]);

export const CODE_TABLES: Readonly<Record<CodeFamily, Readonly<Record<string, CodeEntry>>>> = {
  brick_token: BRICK_TOKEN_ERRORS,
  brick_payment: BRICK_PAYMENT_ERRORS,
  mobiamo: MOBIAMO_CODES,
  mint_generation: MINT_GENERATION_ERRORS,
  mint_redemption: MINT_REDEMPTION_ERRORS,
};

/** Every documented meaning of a code, across all product families. */
export function codeCandidates(code: string): CodeEntry[] {
  const out: CodeEntry[] = [];
  for (const t of Object.values(CODE_TABLES))
    if (Object.prototype.hasOwnProperty.call(t, code)) out.push(t[code]!);
  return out;
}
