/**
 * emerchantpay (Genesis gateway) code and status knowledge, kept as data.
 *
 * Every code below comes from docs/providers/high-risk/research/emerchantpay.md,
 * which cites the public Genesis API reference (API and documentation version
 * 61.1) and the official Genesis PHP SDK. Category and retry values are
 * PandaPayLens interpretations of the documented meanings; the research marks
 * them as suggestions, not emerchantpay statements.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

export const API_DOCS_URL = "https://emerchantpay.github.io/gateway-api-docs/";
export const DOCS_PORTAL_URL = "https://docs.emerchantpay.com/";
export const S2S_GUIDE_URL =
  "https://docs.emerchantpay.com/payments/payment-integrations/server-to-server/integrate-s2s/";
export const REFUND_GUIDE_URL =
  "https://docs.emerchantpay.com/payments/online-card-payments/refund/";
export const VOID_GUIDE_URL = "https://docs.emerchantpay.com/payments/online-card-payments/void/";
export const SDK_ERRORS_URL =
  "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Errors.php";
export const SDK_STATES_URL =
  "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Transaction/States.php";
export const SDK_NOTIFICATION_URL =
  "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Notification.php";
export const SDK_RESPONSE_URL =
  "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Response.php";

/** Which documented code table an entry comes from. */
export type CodeFamily = "gateway" | "gateway_sdk" | "gateway_range" | "scheme" | "scheme_sdk";

export type CatalogEntry = {
  /** Short paraphrase of the documented meaning. */
  meaning: string;
  category: ErrorCategory;
  retry: RetryGuidance;
  explanation: string;
  nextAction: string;
  retryExplanation: string;
  /** The code does not establish whether the operation took effect. */
  outcomeUncertain?: boolean;
};

const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their card issuer.",
  authentication_required:
    "Run 3-D Secure / strong customer authentication and submit a new attempt.",
  authentication_failed:
    "Ask the customer to complete authentication again or to use another card.",
  invalid_request: "Correct the request fields named by the code before sending a new request.",
  invalid_amount: "Check the amount, currency and the referenced transaction of the request.",
  insufficient_funds: "Ask the customer to use another payment method or to add funds.",
  payment_method_unavailable: "Offer the customer another payment method.",
  fraud_or_risk:
    "Do not retry automatically. Review the transaction and contact the emerchantpay risk team or your account manager for details.",
  rate_limiting: "Wait before trying again and avoid automated repeated attempts.",
  provider_unavailable:
    "Reconcile the transaction (Reconcile API or the merchant console) to learn its final state before trying again.",
  network_or_timeout:
    "Reconcile the transaction (Reconcile API or the merchant console) before sending a new request.",
  duplicate_request:
    "Check whether an earlier identical transaction is still active or already succeeded.",
  configuration:
    "Check the terminal and account configuration, credentials and environment (staging or production) with emerchantpay support.",
  unknown:
    "Check the transaction in the emerchantpay merchant console or contact emerchantpay support.",
};

const RETRY_EXPLANATION: Record<RetryGuidance, string> = {
  do_not_retry: "Retrying the same request with the same details will not change the result.",
  customer_action_required:
    "A new attempt only makes sense after the customer acts (new details, another card or method, or contacting the issuer).",
  retry_conditionally:
    "The condition may be temporary or the original outcome may be unknown. Reconcile the transaction before any new attempt, and avoid immediate repeated retries.",
  safe_to_retry_technical_request:
    "The request was rejected for a technical reason before a payment was made; it can be sent again later.",
  manual_review:
    "The code does not allow an automatic decision; review the transaction before acting.",
  unknown: "Retry safety cannot be assessed for this code.",
};

type Opts = { next?: string; why?: string; uncertain?: boolean };

function entry(
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts: Opts = {},
): CatalogEntry {
  return {
    meaning,
    category,
    retry,
    explanation: `${meaning}.`,
    nextAction: opts.next ?? NEXT_ACTION[category],
    retryExplanation: opts.why ?? RETRY_EXPLANATION[retry],
    ...(opts.uncertain ? { outcomeUncertain: true } : {}),
  };
}

type Row = [
  code: string,
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts,
];

function table(rows: readonly Row[]): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [code, meaning, category, retry, opts] of rows)
    out[code] = entry(meaning, category, retry, opts);
  return out;
}

const RECONCILE_FIRST =
  "emerchantpay says codes 230 to 250 must be reconciled because the issuer may have processed the transaction. Reconcile before any new attempt.";
const UNKNOWN_OUTCOME =
  "The code does not establish whether the transaction took effect. Reconcile it before any new attempt.";
const U = { uncertain: true } as const;

// ---------------------------------------------------------------------------
// Gateway error codes (`code` in responses, `error_code` in notifications)

/** The 93 gateway error codes of the API reference, section Errors. */
export const GATEWAY_CODES: Record<string, CatalogEntry> = table([
  // 100-199 system errors
  [
    "100",
    "General system error",
    "provider_unavailable",
    "retry_conditionally",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
  [
    "101",
    "The gateway is under maintenance",
    "provider_unavailable",
    "safe_to_retry_technical_request",
  ],
  ["110", "API login failed", "configuration", "do_not_retry"],
  ["120", "The terminal is misconfigured", "configuration", "do_not_retry"],
  // 200-299 communication errors
  [
    "200",
    "Communication with the issuer failed",
    "network_or_timeout",
    "manual_review",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
  [
    "210",
    "The connection to the issuer could not be established",
    "network_or_timeout",
    "retry_conditionally",
  ],
  ["220", "The issuer account data is invalid", "configuration", "manual_review"],
  [
    "230",
    "The issuer timed out",
    "network_or_timeout",
    "manual_review",
    { ...U, why: RECONCILE_FIRST },
  ],
  [
    "240",
    "The issuer returned an invalid response",
    "provider_unavailable",
    "manual_review",
    { ...U, why: RECONCILE_FIRST },
  ],
  [
    "250",
    "The issuer response could not be parsed",
    "provider_unavailable",
    "manual_review",
    { ...U, why: RECONCILE_FIRST },
  ],
  // 300-399 input data errors
  ["300", "Invalid transaction data", "invalid_request", "do_not_retry"],
  ["310", "Invalid transaction type", "invalid_request", "do_not_retry"],
  ["320", "A required argument is missing", "invalid_request", "do_not_retry"],
  ["330", "An argument has an invalid format", "invalid_request", "do_not_retry"],
  ["340", "An argument value is not plausible (invalid value)", "invalid_request", "do_not_retry"],
  ["350", "Invalid XML input", "invalid_request", "do_not_retry"],
  ["360", "Wrong content type", "invalid_request", "do_not_retry"],
  // 400-499 workflow errors
  ["400", "The workflow is not allowed for this transaction", "invalid_request", "do_not_retry"],
  ["410", "The reference transaction was not found", "invalid_request", "do_not_retry"],
  ["420", "Wrong workflow for the reference transaction", "invalid_request", "do_not_retry"],
  ["430", "The reference transaction is already invalidated", "invalid_request", "do_not_retry"],
  [
    "440",
    "Mismatch with the reference transaction (for example the amount is too high)",
    "invalid_amount",
    "do_not_retry",
  ],
  [
    "450",
    "Doublet: a transaction with the same card data and amount was sent within 5 minutes",
    "duplicate_request",
    "do_not_retry",
    {
      next: "Check whether the earlier identical transaction succeeded before asking the customer to pay again.",
    },
  ],
  ["460", "Transaction not found", "invalid_request", "do_not_retry"],
  ["470", "Chargeback not found", "invalid_request", "do_not_retry"],
  ["471", "Rapid dispute resolution (RDR) record not found", "invalid_request", "do_not_retry"],
  ["480", "Retrieval request not found", "invalid_request", "do_not_retry"],
  ["490", "Fraud report not found", "invalid_request", "do_not_retry"],
  // 500-599 processing errors (issuer decline)
  ["500", "Declined by the issuer", "card_declined", "customer_action_required"],
  ["501", "Rejected by the bank", "card_declined", "customer_action_required"],
  ["510", "Invalid card number", "card_declined", "customer_action_required"],
  [
    "511",
    "Original credit transactions (OCT) are not enabled at the issuer",
    "payment_method_unavailable",
    "do_not_retry",
  ],
  [
    "520",
    "The card has expired or the expiry date is invalid",
    "card_declined",
    "customer_action_required",
  ],
  ["530", "The transaction is pending", "unknown", "manual_review", { ...U, why: UNKNOWN_OUTCOME }],
  ["540", "Credit limit exceeded", "insufficient_funds", "customer_action_required"],
  ["550", "A voucher could not be issued", "unknown", "manual_review"],
  [
    "551",
    "Strong customer authentication (SCA) is required",
    "authentication_required",
    "customer_action_required",
  ],
  // 600-699 risk errors
  ["600", "Declined by risk management", "fraud_or_risk", "do_not_retry"],
  ["601", "Interchange reject", "unknown", "manual_review"],
  ["609", "The BIN country does not match the billing country", "fraud_or_risk", "do_not_retry"],
  ["610", "The card is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["611", "The BIN is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["612", "The country is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["613", "The IP address is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["614", "Another value of the transaction is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["615", "The card is not whitelisted", "fraud_or_risk", "do_not_retry"],
  ["620", "Card limit exceeded", "fraud_or_risk", "retry_conditionally"],
  ["621", "Terminal limit exceeded", "configuration", "manual_review"],
  ["622", "MID limit exceeded", "configuration", "manual_review"],
  ["623", "Velocity limit for unknown cards exceeded", "fraud_or_risk", "retry_conditionally"],
  ["624", "Ticket size exceeded", "fraud_or_risk", "do_not_retry"],
  ["625", "User limit exceeded", "fraud_or_risk", "retry_conditionally"],
  [
    "626",
    "Recent issuer declines on this card; emerchantpay says to try later",
    "fraud_or_risk",
    "retry_conditionally",
  ],
  [
    "627",
    "Cross-selling filter: the transaction was already approved on another MID",
    "duplicate_request",
    "do_not_retry",
  ],
  ["628", "Recurring amount or count exceeded", "fraud_or_risk", "do_not_retry"],
  ["629", "Declined by a risk filter", "fraud_or_risk", "do_not_retry"],
  [
    "630",
    "On hold for manual review",
    "fraud_or_risk",
    "manual_review",
    { ...U, why: "The transaction is held for a manual risk review; wait for its final state." },
  ],
  ["690", "The AVS check failed", "fraud_or_risk", "customer_action_required"],
  ["691", "MaxMind rated the transaction as high risk", "fraud_or_risk", "do_not_retry"],
  ["692", "Declined by ThreatMetrix", "fraud_or_risk", "do_not_retry"],
  ["693", "The IP address is not whitelisted", "fraud_or_risk", "do_not_retry"],
  ["694", "The domain is blacklisted", "fraud_or_risk", "do_not_retry"],
  ["695", "Fraud error; contact the risk team", "fraud_or_risk", "manual_review"],
  ["696", "The IBAN is blacklisted", "fraud_or_risk", "do_not_retry"],
  // 700-799 tokenization errors (750-751 client-side encryption)
  ["700", "General tokenization error", "unknown", "manual_review"],
  ["701", "The consumer already exists", "duplicate_request", "do_not_retry"],
  ["702", "The consumer was not found", "invalid_request", "do_not_retry"],
  ["703", "The consumer is disabled", "invalid_request", "do_not_retry"],
  ["710", "Tokenization is not enabled", "configuration", "do_not_retry"],
  ["720", "Invalid token type", "invalid_request", "do_not_retry"],
  ["730", "Invalid token", "invalid_request", "do_not_retry"],
  ["731", "Invalid scheme tokenization configuration", "configuration", "do_not_retry"],
  ["732", "The token is already scheme-tokenized", "duplicate_request", "do_not_retry"],
  ["740", "Detokenization is forbidden", "configuration", "do_not_retry"],
  ["741", "Tokenization is forbidden", "configuration", "do_not_retry"],
  ["742", "Token update is forbidden", "configuration", "do_not_retry"],
  ["743", "Token validation is forbidden", "configuration", "do_not_retry"],
  ["744", "Token deletion is forbidden", "configuration", "do_not_retry"],
  ["750", "Client-side encryption error", "invalid_request", "do_not_retry"],
  ["751", "Client-side encryption is not enabled", "configuration", "do_not_retry"],
  // 800-899 KYC errors
  ["800", "General KYC error", "unknown", "manual_review"],
  ["801", "Unsupported KYC document MIME type", "invalid_request", "do_not_retry"],
  ["802", "Invalid KYC attributes", "invalid_request", "do_not_retry"],
  ["803", "KYC is not configured", "configuration", "do_not_retry"],
  ["804", "KYC provider error", "provider_unavailable", "retry_conditionally"],
  ["805", "The KYC notification was already received", "duplicate_request", "do_not_retry"],
  ["806", "The merchant state does not allow KYC", "configuration", "do_not_retry"],
  // 900-999 issuer / remote errors
  [
    "900",
    "Error at the issuer",
    "provider_unavailable",
    "manual_review",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
  ["910", "Issuer system error", "provider_unavailable", "retry_conditionally"],
  ["920", "Issuer configuration error", "configuration", "manual_review"],
  ["930", "The data passed caused an error at the issuer", "invalid_request", "do_not_retry"],
  ["940", "Remote workflow error", "unknown", "manual_review", { ...U, why: UNKNOWN_OUTCOME }],
  [
    "950",
    "The issuer timed out with the clearing network",
    "network_or_timeout",
    "manual_review",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
]);

/**
 * Gateway codes found only in the official PHP SDK (Errors.php), not in the
 * API reference. `000` (success) is not an error and is handled separately.
 */
export const SDK_GATEWAY_CODES: Record<string, CatalogEntry> = table([
  ["001", "Undefined error", "unknown", "unknown"],
  ["331", "Mastercard format error", "invalid_request", "do_not_retry"],
  ["602", "Frontend reject", "unknown", "manual_review"],
  ["697", "Terminal card brand limitation", "fraud_or_risk", "retry_conditionally"],
  [
    "960",
    "The issuer could not reach the clearing network",
    "network_or_timeout",
    "manual_review",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
]);

/** Gateway code values that mean success (PHP SDK `000`), not an error. */
export const GATEWAY_SUCCESS_CODES = ["0", "00", "000"] as const;

/**
 * The ten documented code range groups. Used only as a fallback, with
 * possible confidence, for a three-digit code that is not in the tables.
 */
export const GATEWAY_RANGES: readonly {
  from: number;
  to: number;
  group: string;
  entry: CatalogEntry;
}[] = [
  {
    from: 100,
    to: 199,
    group: "system errors",
    entry: entry("System error (range 100-199)", "provider_unavailable", "manual_review", {
      ...U,
      why: UNKNOWN_OUTCOME,
    }),
  },
  {
    from: 200,
    to: 299,
    group: "communication errors",
    entry: entry("Communication error (range 200-299)", "network_or_timeout", "manual_review", {
      ...U,
      why: UNKNOWN_OUTCOME,
    }),
  },
  {
    from: 300,
    to: 399,
    group: "input data errors",
    entry: entry("Input data error (range 300-399)", "invalid_request", "do_not_retry"),
  },
  {
    from: 400,
    to: 499,
    group: "workflow errors",
    entry: entry("Workflow error (range 400-499)", "invalid_request", "do_not_retry"),
  },
  {
    from: 500,
    to: 599,
    group: "processing errors (issuer decline)",
    entry: entry(
      "Processing error, issuer decline (range 500-599)",
      "card_declined",
      "customer_action_required",
    ),
  },
  {
    from: 600,
    to: 699,
    group: "risk errors",
    entry: entry("Risk error (range 600-699)", "fraud_or_risk", "do_not_retry"),
  },
  {
    from: 700,
    to: 799,
    group: "tokenization errors",
    entry: entry("Tokenization error (range 700-799)", "unknown", "manual_review"),
  },
  {
    from: 800,
    to: 899,
    group: "KYC errors",
    entry: entry("KYC error (range 800-899)", "unknown", "manual_review"),
  },
  {
    from: 900,
    to: 999,
    group: "issuer or remote errors",
    entry: entry(
      "Issuer or remote error (range 900-999)",
      "provider_unavailable",
      "manual_review",
      { ...U, why: UNKNOWN_OUTCOME },
    ),
  },
];

// ---------------------------------------------------------------------------
// Scheme response codes (`scheme_response_code`)

export type SchemeEntry = CatalogEntry & {
  /** Meaning in the Visa table, if the code is listed there. */
  visa?: string;
  /** Meaning in the Mastercard and Maestro table, if listed there. */
  mastercard?: string;
  /** The two tables give different meanings. */
  conflict: boolean;
  /** Approval or non-decline code; never decoded as an error. */
  success?: boolean;
};

type SchemeRow = [
  code: string,
  visa: string | null,
  mastercard: string | null,
  category: ErrorCategory,
  retry: RetryGuidance,
  opts?: Opts & { success?: boolean },
];

function schemeTable(rows: readonly SchemeRow[]): Record<string, SchemeEntry> {
  const out: Record<string, SchemeEntry> = {};
  for (const [code, visa, mastercard, category, retry, opts = {}] of rows) {
    const conflict = visa !== null && mastercard !== null && visa !== mastercard;
    const meaning =
      visa !== null && mastercard !== null
        ? conflict
          ? `Visa: ${visa}; Mastercard: ${mastercard}`
          : visa
        : visa !== null
          ? `Visa: ${visa}`
          : `Mastercard: ${mastercard ?? ""}`;
    out[code] = {
      ...entry(meaning, category, retry, opts),
      ...(visa !== null ? { visa } : {}),
      ...(mastercard !== null ? { mastercard } : {}),
      conflict,
      ...(opts.success ? { success: true } : {}),
    };
  }
  return out;
}

const OK = { success: true } as const;

/**
 * The 83 distinct scheme response codes of the API reference (Visa table 71
 * codes, Mastercard and Maestro table 48 codes).
 */
export const SCHEME_CODES: Record<string, SchemeEntry> = schemeTable([
  ["00", "approved", "approved", "unknown", "unknown", OK],
  ["10", "partial approval", "partial approval", "unknown", "unknown", OK],
  ["11", "approved (V.I.P.)", null, "unknown", "unknown", OK],
  [
    "85",
    "not declined (verification only)",
    "not declined (verification only)",
    "unknown",
    "unknown",
    OK,
  ],
  [
    "01",
    "refer to card issuer",
    "refer to card issuer",
    "card_declined",
    "customer_action_required",
  ],
  ["02", "refer to card issuer", null, "card_declined", "customer_action_required"],
  ["03", "invalid merchant", "invalid merchant", "configuration", "do_not_retry"],
  ["04", "pick up card", "pick up card", "fraud_or_risk", "do_not_retry"],
  ["07", "capture card", null, "fraud_or_risk", "do_not_retry"],
  ["05", "do not honour", "do not honour", "card_declined", "customer_action_required"],
  ["06", "error", null, "unknown", "retry_conditionally"],
  ["08", null, "honour with ID", "unknown", "manual_review"],
  ["12", "invalid transaction", "invalid transaction", "invalid_request", "do_not_retry"],
  ["13", "invalid amount", "invalid amount", "invalid_amount", "do_not_retry"],
  ["14", "invalid card number", "invalid card number", "card_declined", "customer_action_required"],
  ["15", "no such issuer", "no such issuer", "card_declined", "customer_action_required"],
  ["19", "re-enter transaction", null, "network_or_timeout", "retry_conditionally"],
  ["21", "no action taken", null, "unknown", "retry_conditionally"],
  ["25", "record not found", null, "unknown", "retry_conditionally"],
  ["28", "file temporarily unavailable", null, "unknown", "retry_conditionally"],
  ["30", null, "format error", "invalid_request", "do_not_retry"],
  ["39", "no credit account", null, "card_declined", "customer_action_required"],
  ["52", "no checking account", null, "card_declined", "customer_action_required"],
  ["53", "no savings account", null, "card_declined", "customer_action_required"],
  ["41", "lost card", "lost card", "fraud_or_risk", "do_not_retry"],
  ["43", "stolen card", "stolen card", "fraud_or_risk", "do_not_retry"],
  ["46", "closed account", "closed account", "card_declined", "do_not_retry"],
  [
    "51",
    "insufficient funds",
    "insufficient funds",
    "insufficient_funds",
    "customer_action_required",
  ],
  ["54", "expired card", "expired card", "card_declined", "customer_action_required"],
  [
    "55",
    "incorrect or missing PIN",
    "incorrect or missing PIN",
    "authentication_failed",
    "customer_action_required",
  ],
  [
    "57",
    "transaction not permitted to cardholder",
    "transaction not permitted to cardholder",
    "card_declined",
    "do_not_retry",
  ],
  [
    "58",
    "transaction not allowed at terminal or acquirer",
    "transaction not allowed at terminal or acquirer",
    "configuration",
    "do_not_retry",
  ],
  ["59", "suspected fraud", null, "fraud_or_risk", "do_not_retry"],
  ["63", "security violation", "security violation", "fraud_or_risk", "do_not_retry"],
  ["64", "AML requirement", null, "fraud_or_risk", "do_not_retry"],
  ["83", null, "fraud or security", "fraud_or_risk", "do_not_retry"],
  ["93", "violation of law", null, "fraud_or_risk", "do_not_retry"],
  [
    "61",
    "exceeds amount limit",
    "exceeds amount limit",
    "insufficient_funds",
    "customer_action_required",
  ],
  ["62", "restricted card", "restricted card", "card_declined", "do_not_retry"],
  [
    "65",
    "frequency limit exceeded",
    "count limit exceeded, or 3DS soft decline (resubmit with 3DS)",
    "authentication_required",
    "customer_action_required",
  ],
  ["70", "PIN data required", "contact card issuer", "card_declined", "customer_action_required"],
  ["71", null, "PIN not changed", "card_declined", "do_not_retry"],
  [
    "81",
    "PIN cryptographic error",
    "domestic debit transaction not allowed",
    "card_declined",
    "do_not_retry",
  ],
  ["82", "negative CVV checks", "policy", "card_declined", "do_not_retry"],
  ["P5", "PIN unblock or change denied", null, "card_declined", "do_not_retry"],
  ["P6", "PIN unblock or change denied", null, "card_declined", "do_not_retry"],
  ["72", null, "account not yet activated", "card_declined", "customer_action_required"],
  ["74", "PIN encryption error", null, "authentication_failed", "retry_conditionally"],
  [
    "86",
    "PIN cannot be verified",
    "PIN cannot be verified",
    "authentication_failed",
    "retry_conditionally",
  ],
  ["88", null, "cryptographic failure", "authentication_failed", "retry_conditionally"],
  ["75", "PIN tries exceeded", "PIN tries exceeded", "authentication_failed", "do_not_retry"],
  ["76", "unsolicited reversal", 'invalid "to" account', "unknown", "manual_review"],
  ["77", null, 'invalid "from" account', "card_declined", "customer_action_required"],
  [
    "78",
    "card blocked on first use",
    "invalid account",
    "card_declined",
    "customer_action_required",
  ],
  ["79", "already reversed", "life cycle", "card_declined", "retry_conditionally"],
  [
    "80",
    "no financial impact",
    "system not available",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["84", null, "invalid authorization life cycle", "invalid_request", "do_not_retry"],
  ["87", null, "purchase only, no cashback allowed", "invalid_request", "do_not_retry"],
  [
    "89",
    "ineligible for GIV",
    "unacceptable PIN, retry",
    "authentication_failed",
    "customer_action_required",
  ],
  ["90", null, "cutoff in progress", "provider_unavailable", "safe_to_retry_technical_request"],
  ["91", "issuer inoperative", "issuer inoperative", "provider_unavailable", "retry_conditionally"],
  [
    "92",
    "unable to route transaction",
    "unable to route transaction",
    "provider_unavailable",
    "retry_conditionally",
  ],
  ["96", "system malfunction", "system malfunction", "provider_unavailable", "retry_conditionally"],
  ["1Z", null, "issuer system inoperative", "provider_unavailable", "retry_conditionally"],
  ["94", null, "duplicate transaction", "duplicate_request", "do_not_retry"],
  [
    "1A",
    "soft decline, additional customer authentication required",
    null,
    "authentication_required",
    "customer_action_required",
  ],
  ["5C", "blocked by issuer", null, "card_declined", "do_not_retry"],
  ["N3", "cash service not available", null, "card_declined", "do_not_retry"],
  ["N4", "cash request over limit", null, "card_declined", "do_not_retry"],
  ["N5", "not eligible for resubmission", null, "card_declined", "do_not_retry"],
  ["R2", "not eligible for Visa PIN", null, "card_declined", "do_not_retry"],
  ["6P", "verification data failed", null, "card_declined", "customer_action_required"],
  ["9G", "blocked by cardholder", null, "card_declined", "customer_action_required"],
  ["N7", "CVV2 failure", null, "card_declined", "customer_action_required"],
  ["B1", "surcharge amount not permitted", null, "invalid_amount", "do_not_retry"],
  ["B2", "surcharge not supported", null, "invalid_amount", "do_not_retry"],
  ["N8", "amount exceeds the preauthorized amount", null, "invalid_amount", "do_not_retry"],
  ["N0", "force STIP", null, "unknown", "unknown"],
  ["Q1", "card authentication failed", null, "authentication_failed", "customer_action_required"],
  ["R0", "stop payment", null, "card_declined", "do_not_retry"],
  ["R1", "revocation of authorization", null, "card_declined", "do_not_retry"],
  ["R3", "revocation of all authorizations", null, "card_declined", "do_not_retry"],
  ["Z3", "unable to go online, offline-declined", null, "card_declined", "retry_conditionally"],
]);

/**
 * Issuer response codes found only in the PHP SDK (`getIssuerResponseCode`),
 * not in the API reference tables.
 */
export const SDK_SCHEME_CODES: Record<string, CatalogEntry> = table([
  ["09", "No original transaction", "card_declined", "do_not_retry"],
  ["17", "Invalid capture date", "card_declined", "do_not_retry"],
  ["20", 'No "from" account', "card_declined", "do_not_retry"],
  ["22", "No checking account", "card_declined", "do_not_retry"],
  ["23", "No saving account", "card_declined", "do_not_retry"],
  ["24", "No credit account", "card_declined", "do_not_retry"],
  ["34", "Implausible card data", "card_declined", "do_not_retry"],
  ["42", "Special pickup", "card_declined", "do_not_retry"],
  ["44", "Pickup card", "card_declined", "do_not_retry"],
  ["45", "Transaction back off", "card_declined", "do_not_retry"],
  ["66", "Exceeds acquirer limit", "card_declined", "do_not_retry"],
  ["67", "Retain card", "card_declined", "do_not_retry"],
  [
    "68",
    "Response received too late",
    "network_or_timeout",
    "manual_review",
    { ...U, why: UNKNOWN_OUTCOME },
  ],
  ["97", "No funds transfer", "card_declined", "do_not_retry"],
  ["98", "Duplicate reversal", "duplicate_request", "do_not_retry"],
  ["99", "Duplicate transaction", "duplicate_request", "do_not_retry"],
]);

// ---------------------------------------------------------------------------
// Recurring advice codes (`recurring_advice_code`, `recurring_advice_text`)

export type AdviceEntry = { meaning: string; category: ErrorCategory; retry: RetryGuidance };

const advice = (meaning: string, category: ErrorCategory, retry: RetryGuidance): AdviceEntry => ({
  meaning,
  category,
  retry,
});

/** The 18 recurring advice codes of the API reference, section Recurring Advice. */
export const RECURRING_ADVICE: Record<string, AdviceEntry> = {
  "01": advice("new account information available", "card_declined", "customer_action_required"),
  "02": advice("try again later", "card_declined", "retry_conditionally"),
  "03": advice("do not try again", "card_declined", "do_not_retry"),
  "04": advice("token requirements not met for this token type", "configuration", "do_not_retry"),
  "21": advice("recurring payment cancellation service", "card_declined", "do_not_retry"),
  "22": advice("merchant does not qualify for the product code", "configuration", "do_not_retry"),
  "24": advice("retry after 1 hour", "card_declined", "retry_conditionally"),
  "25": advice("retry after 24 hours", "card_declined", "retry_conditionally"),
  "26": advice("retry after 2 days", "card_declined", "retry_conditionally"),
  "27": advice("retry after 4 days", "card_declined", "retry_conditionally"),
  "28": advice("retry after 6 days", "card_declined", "retry_conditionally"),
  "29": advice("retry after 8 days", "card_declined", "retry_conditionally"),
  "30": advice("retry after 10 days", "card_declined", "retry_conditionally"),
  "31": advice(
    "retry later (at most 15 attempts in 30 days)",
    "card_declined",
    "retry_conditionally",
  ),
  "40": advice("non-reloadable prepaid card", "payment_method_unavailable", "do_not_retry"),
  "41": advice("single-use virtual card number", "payment_method_unavailable", "do_not_retry"),
  "42": advice("sanctions score exceeds the threshold", "fraud_or_risk", "do_not_retry"),
  "43": advice("multi-use virtual card number", "payment_method_unavailable", "do_not_retry"),
};

// ---------------------------------------------------------------------------
// 3DS authentication status reason codes (EMVCo values)

/** The 27 listed values (`01`-`26` and `87`); `27`-`79` are reserved by EMVCo. */
export const THREEDS_REASONS: Record<string, AdviceEntry> = {
  "01": advice("card authentication failed", "authentication_failed", "customer_action_required"),
  "02": advice("unknown device", "authentication_failed", "retry_conditionally"),
  "03": advice("unsupported device", "authentication_failed", "retry_conditionally"),
  "04": advice("exceeds authentication frequency limit", "authentication_failed", "do_not_retry"),
  "05": advice("expired card", "card_declined", "customer_action_required"),
  "06": advice("invalid card number", "card_declined", "customer_action_required"),
  "07": advice("invalid transaction", "card_declined", "do_not_retry"),
  "08": advice("no card record", "card_declined", "customer_action_required"),
  "09": advice("security failure", "authentication_failed", "customer_action_required"),
  "10": advice("stolen card", "fraud_or_risk", "do_not_retry"),
  "11": advice("suspected fraud", "fraud_or_risk", "do_not_retry"),
  "12": advice("transaction not permitted to cardholder", "card_declined", "do_not_retry"),
  "13": advice("cardholder not enrolled in service", "card_declined", "customer_action_required"),
  "14": advice("transaction timed out at the ACS", "provider_unavailable", "retry_conditionally"),
  "15": advice("low confidence", "unknown", "unknown"),
  "16": advice("medium confidence", "unknown", "unknown"),
  "17": advice("high confidence", "unknown", "unknown"),
  "18": advice("very high confidence", "unknown", "unknown"),
  "19": advice("exceeds ACS maximum challenges", "authentication_failed", "do_not_retry"),
  "20": advice(
    "non-payment transaction not supported",
    "authentication_failed",
    "retry_conditionally",
  ),
  "21": advice("3RI transaction not supported", "authentication_failed", "retry_conditionally"),
  "22": advice("ACS technical issue", "provider_unavailable", "retry_conditionally"),
  "23": advice("decoupled authentication issue", "authentication_failed", "retry_conditionally"),
  "24": advice("decoupled authentication issue", "authentication_failed", "retry_conditionally"),
  "25": advice("decoupled authentication issue", "authentication_failed", "retry_conditionally"),
  "26": advice(
    "authentication attempted but not completed by the cardholder",
    "authentication_failed",
    "customer_action_required",
  ),
  "87": advice("transaction excluded from attempts processing (Visa)", "unknown", "unknown"),
};

/** EMVCo reserved range for the 3DS status reason. */
export const THREEDS_RESERVED_RANGE = { from: 27, to: 79 } as const;

// ---------------------------------------------------------------------------
// Verification results (informational)

/** Single-character AVS codes `A`-`J` (meanings range from full match to no match and "not sent"). */
export const AVS_SINGLE_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

/** Source prefix of two-character AVS codes. */
export const AVS_SOURCE_PREFIXES: Record<string, string> = {
  "2": "intermediate processor",
  "5": "issuer processor",
};

/** Result letters of two-character AVS codes. */
export const AVS_RESULT_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "F",
  "G",
  "I",
  "M",
  "N",
  "P",
  "R",
  "S",
  "U",
  "W",
  "X",
  "Y",
  "Z",
] as const;

/** The only AVS result letters whose meaning the research states. */
export const AVS_LETTER_MEANINGS: Record<string, string> = {
  R: "system unavailable",
  U: "system unavailable",
};

/** CVV result codes (`cvv_result_code`). */
export const CVV_RESULTS: Record<string, string> = {
  M: "match",
  N: "no match",
  S: "should be on card",
  P: "not processed",
  U: "issuer not participating",
};

/** Cryptogram results (`cryptogram_result`, Diners and Discover only). */
export const CRYPTOGRAM_RESULTS: Record<string, string> = {
  "01": "pass",
  "02": "fail",
  "03": "unable to validate",
  "04": "CAVV failed",
  "05": "issuer not participating",
  "06": "CAVV unable to authenticate",
};

// ---------------------------------------------------------------------------
// States, transaction types and notification events

export type StateInfo = {
  outcome: Outcome;
  /** Stage implied by the state itself (refund, void, dispute, reversal). */
  stage?: LifecycleStage;
  description: string;
};

const state = (outcome: Outcome, description: string, stage?: LifecycleStage): StateInfo => ({
  outcome,
  description,
  ...(stage ? { stage } : {}),
});

/** The 15 transaction states of the API reference, section Transaction States. */
export const TRANSACTION_STATES: Record<string, StateInfo> = {
  approved: state("success", "Transaction approved."),
  declined: state("failure", "Transaction declined."),
  pending_async: state(
    "pending",
    "Asynchronous transaction waiting for the customer (3DS or redirect); a notification with the final state follows.",
  ),
  pending_hold: state(
    "pending",
    "The customer finished, but the provider's update is still pending.",
  ),
  pending: state("unknown", "Outcome not known yet; reconcile the transaction later."),
  error: state("failure", "The transaction ended with an error."),
  refunded: state("success", "The transaction was refunded.", "refund"),
  chargebacked: state("unknown", "A chargeback was received for the transaction.", "dispute"),
  voided: state("success", "The transaction was voided.", "void"),
  chargeback_reversed: state("unknown", "The chargeback was reversed.", "dispute"),
  represented: state("unknown", "The chargeback was represented.", "dispute"),
  representment_reversed: state("unknown", "The representment was reversed.", "dispute"),
  second_chargebacked: state("unknown", "A second chargeback was received.", "dispute"),
  pending_review: state("pending", "The transaction is under manual risk review."),
  partially_reversed: state("success", "A preauthorization was partially reversed.", "reversal"),
};

/** The 19 WPF (hosted payment form) states of the API reference, section WPF States. */
export const WPF_STATES: Record<string, StateInfo> = {
  new: state("pending", "The WPF payment was created."),
  user: state("pending", "The customer is on the payment form."),
  timeout: state(
    "unknown",
    "The WPF payment timed out; the research does not describe the state further.",
  ),
  in_progress: state("pending", "The payment is in progress."),
  unsuccessful: state("unknown", "Documented as not used."),
  pending: state("unknown", "Outcome not known yet; reconcile the WPF payment later."),
  pending_hold: state(
    "pending",
    "The customer finished, but the provider's update is still pending.",
  ),
  approved: state("success", "The WPF payment was approved."),
  declined: state("failure", "The WPF payment was declined."),
  error: state("failure", "The WPF payment ended with an error."),
  refunded: state("success", "The WPF payment was refunded.", "refund"),
  voided: state("success", "The WPF payment was voided.", "void"),
  chargebacked: state("unknown", "A chargeback was received.", "dispute"),
  chargeback_reversal: state("unknown", "The chargeback was reversed.", "dispute"),
  represented: state("unknown", "The chargeback was represented.", "dispute"),
  representment_reversed: state("unknown", "The representment was reversed.", "dispute"),
  second_chargebacked: state("unknown", "A second chargeback was received.", "dispute"),
  pending_review: state("pending", "The payment is under manual risk review."),
  submitted: state("pending", "The payment was submitted."),
};

export type TransactionTypeInfo = {
  stage: LifecycleStage;
  description: string;
  /** True for a subsequent recurring charge, false for the initial one. */
  recurring?: boolean;
};

/**
 * Transaction types named in the research. APM and wallet transaction types
 * exist in the API reference, but their literal names are not in the research,
 * so they are not listed and are shown as unknown transaction types.
 */
export const TRANSACTION_TYPES: Record<string, TransactionTypeInfo> = {
  authorize: {
    stage: "authorization",
    description: "Card authorization (funds reserved, not captured).",
  },
  authorize3d: {
    stage: "authorization",
    description: "Card authorization with 3-D Secure (funds reserved, not captured).",
  },
  capture: { stage: "capture", description: "Capture of an earlier authorization." },
  sale: { stage: "payment", description: "Card sale (authorization and capture in one step)." },
  sale3d: { stage: "payment", description: "Card sale with 3-D Secure." },
  refund: { stage: "refund", description: "Refund of a captured transaction (full or partial)." },
  void: { stage: "void", description: "Void of a same-day transaction." },
  init_recurring_sale: {
    stage: "payment",
    description: "Initial sale of a recurring sequence.",
    recurring: false,
  },
  init_recurring_sale3d: {
    stage: "payment",
    description: "Initial sale of a recurring sequence with 3-D Secure.",
    recurring: false,
  },
  recurring_sale: {
    stage: "payment",
    description: "Subsequent recurring sale referencing the initial recurring transaction.",
    recurring: true,
  },
  credit: { stage: "payout", description: "Credit (payout) referencing an earlier transaction." },
  payout: { stage: "payout", description: "Payout without a reference transaction." },
  account_verification: {
    stage: "other",
    description:
      "Account verification. API version 60.8 removed this type, but the WPF section still describes it.",
  },
};

/** `event` values of chargeback, retrieval and RDR notifications. */
export const DISPUTE_EVENTS: Record<string, string> = {
  chargeback: "A chargeback was received.",
  chargeback_reversal: "A chargeback was reversed.",
  representment: "The chargeback was represented.",
  representment_reversal: "The representment was reversed.",
  second_chargeback: "A second chargeback was received.",
  retrieval_request: "A retrieval request (request for transaction documentation) was received.",
  rapid_dispute_resolution: "A rapid dispute resolution (RDR) record was created.",
  rapid_dispute_resolution_reversal: "A rapid dispute resolution (RDR) record was reversed.",
};

/** XML root elements of Genesis payloads (recognized, never parsed). */
export const XML_ROOTS: Record<string, string> = {
  payment_response: "Processing API or reconcile response",
  wpf_payment: "WPF create or reconcile response",
  notification_echo: "notification acknowledgement",
  reconcile: "reconcile request",
  payment_transaction: "Processing API request (may contain card data)",
  blacklist_response: "blacklist API response",
};

export const FAMILY_DOCS: Record<CodeFamily, { title: string; url: string }[]> = {
  gateway: [{ title: "Genesis API reference: Errors", url: API_DOCS_URL }],
  gateway_sdk: [
    { title: "Genesis API reference: Errors", url: API_DOCS_URL },
    { title: "Genesis PHP SDK: Errors.php", url: SDK_ERRORS_URL },
  ],
  gateway_range: [{ title: "Genesis API reference: Errors (code ranges)", url: API_DOCS_URL }],
  scheme: [{ title: "Genesis API reference: Scheme Response Codes", url: API_DOCS_URL }],
  scheme_sdk: [
    { title: "Genesis API reference: Scheme Response Codes", url: API_DOCS_URL },
    { title: "Genesis PHP SDK: Errors.php (issuer response codes)", url: SDK_ERRORS_URL },
  ],
};

export const RECURRING_ADVICE_DOC = {
  title: "Genesis API reference: Recurring Advice",
  url: API_DOCS_URL,
};
export const THREEDS_REASON_DOC = {
  title: "Genesis API reference: 3DS Status Reason Code",
  url: API_DOCS_URL,
};
export const NOTIFICATIONS_DOC = {
  title: "Genesis API reference: Notifications",
  url: API_DOCS_URL,
};

export { NEXT_ACTION, RETRY_EXPLANATION };
