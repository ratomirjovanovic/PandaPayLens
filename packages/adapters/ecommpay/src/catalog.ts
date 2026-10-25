/**
 * Ecommpay code, status and event knowledge, kept as data.
 *
 * Source of every entry: docs/providers/high-risk/research/ecommpay.md, which
 * cites Ecommpay's public developer portal (verified 2026-10-25):
 *
 * Codes and statuses:   https://developers.ecommpay.com/en/en_platform_payment_info_codes.md
 * Callbacks:            https://developers.ecommpay.com/en/en_platform_callbacks.md
 * Gate interaction:     https://developers.ecommpay.com/en/en_gate_interaction_organisation.md
 * Chargeback callbacks: https://developers.ecommpay.com/en/en_dbl_chargeback_callbacks.md
 *
 * Meanings are short paraphrases. Category and retry values are PandaPayLens
 * suggestions taken from the research file, which follows Ecommpay's own
 * "Action" column where it gives one. The five code families (general, risk
 * control, external card systems, external alternative payment systems,
 * merchant) are kept in separate tables.
 *
 * Where the research lists several codes in one row and the paraphrase has
 * the same number of parts (separated by ";" or "/"), each code gets its part
 * in order. Otherwise the codes of the row share the row's paraphrase.
 */

import type { ErrorCategory, LifecycleStage, Outcome, RetryGuidance } from "@pandapaylens/core";

const DP = "https://developers.ecommpay.com/en";
export const CODES_URL = `${DP}/en_platform_payment_info_codes.md`;
export const CALLBACKS_URL = `${DP}/en_platform_callbacks.md`;
export const SIGNATURE_URL = `${DP}/en_platform_signature.md`;
export const GATE_URL = `${DP}/en_gate_interaction_organisation.md`;
export const PAYMENT_MODEL_URL = `${DP}/en_platform_payment_model_overview.md`;
export const STATUS_REQUEST_URL = `${DP}/en_Gate_payment_status_request.md`;
export const REFUND_URL = `${DP}/en_Gate_Refund.md`;
export const CHARGEBACK_CALLBACKS_URL = `${DP}/en_dbl_chargeback_callbacks.md`;
export const PAYMENT_RESULT_FAQ_URL = `${DP}/en_faq_payment_result.md`;
export const PAYOUT_MODEL_URL = `${DP}/en_platform_payout_model.md`;
export const RECURRING_MODEL_URL = `${DP}/en_platform_recurring_model.md`;
export const GATE_API_URL = `${DP}/gate_api.md`;

/** How a code relates to the outcome of the operation that carries it. */
export type CodeKind = "success" | "pending" | "decline";

export type CodeFamily = "general" | "risk" | "card_system" | "apm_system" | "merchant";

export const CODE_FAMILY_LABELS: Record<CodeFamily, string> = {
  general: "general",
  risk: "risk control (RCS)",
  card_system: "external card payment system",
  apm_system: "external alternative payment system",
  merchant: "merchant",
};

export type CodeEntry = {
  meaning: string;
  kind: CodeKind;
  category: ErrorCategory;
  retry: RetryGuidance;
  /** Caveat shown with the decoded error. */
  note?: string;
  /** The documentation gives conflicting meanings; decoded with possible confidence. */
  ambiguous?: true;
};

const ok = (meaning: string): CodeEntry => ({
  meaning,
  kind: "success",
  category: "unknown",
  retry: "unknown",
});
const pending = (meaning: string): CodeEntry => ({
  meaning,
  kind: "pending",
  category: "unknown",
  retry: "unknown",
});
const d = (
  meaning: string,
  category: ErrorCategory,
  retry: RetryGuidance,
  note?: string,
): CodeEntry => ({ meaning, kind: "decline", category, retry, ...(note ? { note } : {}) });

type Row = [codes: readonly (string | number)[], meanings: string | readonly string[]];

/** Expands rows of codes that share one category and retry suggestion. */
function rows(
  table: Record<string, CodeEntry>,
  category: ErrorCategory,
  retry: RetryGuidance,
  list: readonly Row[],
): void {
  for (const [codes, meanings] of list) {
    codes.forEach((c, i) => {
      const meaning = typeof meanings === "string" ? meanings : meanings[i]!;
      table[String(c)] = d(meaning, category, retry);
    });
  }
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Brief rule: a retry is never presented as safe when the original outcome is
// unknown. The research suggests a technical retry for these timeouts.
const TIMEOUT_NOTE =
  "The research suggests a technical retry; PandaPayLens downgrades it because a timeout leaves the outcome at the external service unknown.";

/** General codes (237). */
export const GENERAL_CODES: Record<string, CodeEntry> = {
  "0": ok("Operation completed"),
  "9999": pending("Awaiting internal processing"),
};
rows(GENERAL_CODES, "unknown", "manual_review", [
  [[100], "Generic platform decline"],
  [[3081], "Payment state machine flow break"],
]);
rows(GENERAL_CODES, "authentication_failed", "customer_action_required", [
  [
    [104, 108],
    [
      "3-D Secure authentication failed",
      "Customer did not return from the issuer's authentication page (ACS)",
    ],
  ],
  [[2466], "Wrong 3-D Secure confirmation code"],
]);
rows(GENERAL_CODES, "invalid_request", "customer_action_required", [
  [[109], "Address verification (AVS) mismatch"],
  [[3191], "Additional clarification data is needed"],
]);
rows(GENERAL_CODES, "unknown", "retry_conditionally", [[[301], "Cancelled by a participant"]]);
rows(GENERAL_CODES, "configuration", "manual_review", [
  [[303], "Access denied"],
  [[310], "Operation type is disabled for the project"],
  [[318], "Network tokens are not enabled"],
  [[504], "Merchant balance too low"],
  [[2701], "Business rules check failed"],
  [[3023], "Currency is disabled for the project"],
  [[3028], "Merchant balance too low for the payout"],
  [[3102], "Card failed the business rules"],
  [[3124], "Invalid certificate"],
  [[3193], "B2B remittance is not enabled"],
  [
    [3291, 3292, 3293],
    [
      "Merchant account allows only one operation type",
      "Gambling payouts are not allowed for this MCC",
      "Payout method is not set",
    ],
  ],
  [[3299], "Merchant status blocks the operation"],
  [[3363], "Trace ID missing for a recurring or merchant-initiated payment"],
]);
rows(GENERAL_CODES, "invalid_amount", "do_not_retry", [
  [[309], "Converted amount is above the provider limit"],
  [[2642], "Amount is above the limit"],
  [[2949], "Wrong amount for the retry attempt"],
  [[3104], "Maximum payout amount exceeded"],
  [
    [3117, 3118],
    [
      "Remainder would be under 0.01 USD",
      "Amount would be under one minor unit after card scheme conversion",
    ],
  ],
  [[3120], "Amount is above the 25 USD cap for this MCC"],
  [[3283], "Refund is above the initial amount"],
  [[3289], "Amount is below the fixed fee"],
  [
    [3358, 3360],
    ["Amount is below the minimum", "Prepaid non-reloadable card amount is over 50 EUR"],
  ],
  [[3402, 3403, 3404, 3406], "Single MoneySend funding or payout cap exceeded"],
  [[3409, 3410], "MoneySend cap of 2,500 USD exceeded"],
  [range(3412, 3419), "Single MoneySend cap (25,000 to 100,000 USD) exceeded"],
  [[3609], "Amount must equal the initial amount"],
  [
    range(3618, 3625),
    "Single MoneySend cap (10,000 or 125,000 USD) exceeded; splitting the amount is allowed",
  ],
  [
    [3900, 3901],
    ["Money transfer cap of 50,000 USD exceeded", "Money transfer cap of 25,000 USD exceeded"],
  ],
]);
rows(GENERAL_CODES, "invalid_amount", "manual_review", [
  [
    [903, 904],
    ["Card refund total is above the purchases", "Card payout limit exceeded"],
  ],
  [[3281], "Converted amount is under one minor unit"],
]);
GENERAL_CODES["314"] = d(
  "Provider is unavailable now",
  "provider_unavailable",
  "safe_to_retry_technical_request",
);
GENERAL_CODES["319"] = d(
  "Not enough data to create the operation",
  "invalid_request",
  "do_not_retry",
);
GENERAL_CODES["402"] = d(
  "Declined by the anti-fraud system (RCS)",
  "fraud_or_risk",
  "do_not_retry",
);
GENERAL_CODES["501"] = d("Internal error", "provider_unavailable", "manual_review");
GENERAL_CODES["502"] = d("Data failed validation", "invalid_request", "manual_review");
GENERAL_CODES["601"] = d(
  "Generic error; send the request again",
  "unknown",
  "safe_to_retry_technical_request",
);
GENERAL_CODES["602"] = d(
  "Network error at an external service",
  "network_or_timeout",
  "retry_conditionally",
  TIMEOUT_NOTE,
);
GENERAL_CODES["603"] = d(
  "Declined automatically per project settings",
  "configuration",
  "retry_conditionally",
);
GENERAL_CODES["604"] = d(
  "Payout session uuid has expired",
  "invalid_request",
  "retry_conditionally",
);
GENERAL_CODES["702"] = d("Malformed request", "invalid_request", "do_not_retry");
GENERAL_CODES["2147"] = d("Lock timeout", "network_or_timeout", "retry_conditionally");
rows(GENERAL_CODES, "invalid_request", "do_not_retry", [
  [
    [2003, 2004, 2014, 2061, 2123, 2124],
    [
      "Invalid JSON",
      "Required field is missing",
      "Addendum sent with a COF registration",
      "AVS data is needed",
      "Verification is not allowed",
      "Invalid customer_id",
    ],
  ],
  [
    [2154, 2261, 2426, 2442],
    ["customer_id is required", "Country is missing", "Invalid email", "project_id is missing"],
  ],
  [
    [2467, 2468, 2541, 2606, 2609, 2610, 2611, 2641],
    [
      "3-D Secure device_channel app is not allowed",
      "3-D Secure device_channel 3RI is not allowed",
      "Unknown payment method",
      "Payout without a prior payment",
      "Invalid birth date",
      "Invalid country",
      "Invalid city",
      "Invalid bank or currency",
    ],
  ],
  [
    [2801, 2945],
    ["bank_id is missing", "Wrong operation type for the retry attempt"],
  ],
  [
    [3001, 3002, 3003, 3004, 3020],
    [
      "UK merchant: invalid birth date",
      "UK merchant: invalid postcode",
      "UK merchant: invalid surname",
      "UK merchant: invalid street",
      "Card expiry date is required",
    ],
  ],
  [[3022], "Customer is missing for a saved card"],
  [[3024], "Invalid payment_id"],
  [[3027], "Invalid token"],
  [[3101], "Tokenized card does not belong to the customer"],
  [[3119], "Currency differs from the channel currency"],
  [[3121], "Invalid currency"],
  [
    [3125, 3141, 3161, 3162, 3181, 3186, 3190],
    [
      "Incremental authorization is not allowed for this MCC",
      "CVV is required",
      "Invalid cardholder name",
      "Cardholder name is missing",
      "COF registration ID is unknown",
      "Retry trigger operation is unknown",
      "Remittance method mismatch",
    ],
  ],
  [[3192], "Remittance currency mismatch"],
  [
    [3194, 3195],
    ["Recipient ID is unknown", "Recipient is forbidden"],
  ],
  [[3221], "Token is missing"],
  [
    [3241, 3242, 3243, 3244],
    [
      "Customer and token do not match",
      "Account object is required",
      "Account object is not allowed",
      "Bank ID is required",
    ],
  ],
  [[3284], "Refund currency is missing or does not match"],
  [
    [3286, 3287],
    ["Amount sent without currency", "Currency sent without amount"],
  ],
  [[3301], "COF registration has expired"],
  [
    [3431, 3432, 3433],
    [
      "Same card on both sides of the transfer",
      "Saved card ID and full card data were both sent",
      "Full card data sent to an endpoint that accepts saved cards only",
    ],
  ],
  [
    [3436, 3437, 3438, 3439],
    "Sender or recipient card is invalid, or a saved card lacks an expiry date",
  ],
  [
    [3490, 3491],
    ["Debt repayment fields are missing", "Wrong card type for debt repayment"],
  ],
  [[3612], "Money transfer party fields are missing"],
]);
GENERAL_CODES["3021"] = d("Card has expired", "card_declined", "customer_action_required");
GENERAL_CODES["3026"] = d(
  "Payment system unavailable (internal)",
  "payment_method_unavailable",
  "manual_review",
);
GENERAL_CODES["3029"] = d(
  "Provider rejects an expired card",
  "card_declined",
  "customer_action_required",
);
GENERAL_CODES["3041"] = d("payment_id already exists", "duplicate_request", "do_not_retry");
GENERAL_CODES["3060"] = d(
  "Current payment status does not allow this action",
  "invalid_request",
  "manual_review",
);
GENERAL_CODES["3061"] = d("Payment not found", "invalid_request", "retry_conditionally");
GENERAL_CODES["3062"] = d(
  "Payment details are not available yet",
  "provider_unavailable",
  "retry_conditionally",
);
GENERAL_CODES["3103"] = d(
  "Payout is blocked for this card type",
  "payment_method_unavailable",
  "manual_review",
);
GENERAL_CODES["3105"] = d(
  "Card country is not allowed",
  "payment_method_unavailable",
  "do_not_retry",
);
GENERAL_CODES["3106"] = d(
  "Monthly payout amount limit reached",
  "rate_limiting",
  "retry_conditionally",
);
GENERAL_CODES["3107"] = d(
  "Payout card has no earlier purchase",
  "invalid_request",
  "manual_review",
);
rows(GENERAL_CODES, "rate_limiting", "retry_conditionally", [
  [
    [3108, 3109, 3110, 3111, 3112],
    [
      "Weekly payout amount limit reached",
      "Daily payout amount limit reached",
      "Monthly payout count limit reached",
      "Weekly payout count limit reached",
      "Daily payout count limit reached",
    ],
  ],
  [[3285], "Refund repeated too soon"],
  [[3297, 3298], "Provider daily amount limit reached"],
  [
    range(3305, 3340),
    "Payout count or amount limit (30-day, weekly or daily) reached; limits are split by MCC 7995/9406, money transfer, funds disbursement and domestic or cross-border",
  ],
  [[3355], "Daily count limit for the same card reached"],
  [[3357], "30-day count limit for the same card reached"],
  [[3362], "30-day payout amount limit for MCC 7995/9406 reached"],
  [[3407, 3408], "30-day MoneySend payout cap reached"],
  [
    [3450, 3451, 3452],
    [
      "Domestic AFT daily amount limit reached",
      "Domestic AFT weekly amount limit reached",
      "Domestic AFT 30-day amount limit reached",
    ],
  ],
  [[3606, 3607], "30-day MoneySend funding limit reached"],
  [range(3626, 3635), "Daily or weekly MoneySend or MCC 7995/9406 count limit reached"],
]);
GENERAL_CODES["3123"] = d("Invalid API key", "configuration", "do_not_retry");
GENERAL_CODES["3182"] = d(
  "Duplicate COF scheduled payment ID",
  "duplicate_request",
  "do_not_retry",
);
GENERAL_CODES["3183"] = d(
  "COF registration is void (card expired)",
  "card_declined",
  "do_not_retry",
);
GENERAL_CODES["3184"] = d("COF registration was cancelled", "invalid_request", "manual_review");
rows(GENERAL_CODES, "payment_method_unavailable", "manual_review", [
  [
    [3196, 3197],
    [
      "Remittance is not supported by the payment system",
      "Remittance is not supported by the payment method",
    ],
  ],
  [[3341], "Payout blocked by an issuer restriction"],
  [
    [3470, 3471, 3472],
    [
      "Sender card type is not allowed",
      "Recipient card type is not allowed",
      "Recipient issuer region is not allowed",
    ],
  ],
  [[3610], "Refund is not available"],
  [[3617], "MCC is not allowed for card product F2"],
]);
rows(GENERAL_CODES, "fraud_or_risk", "manual_review", [
  [
    [3198, 3199],
    ["AML review timed out", "Declined by the AML check"],
  ],
]);
GENERAL_CODES["3230"] = d(
  "merchant_refund_id was already used",
  "duplicate_request",
  "do_not_retry",
);
rows(GENERAL_CODES, "configuration", "do_not_retry", [
  [
    [3261, 3262],
    ["Invalid signature", "Empty signature"],
  ],
]);
GENERAL_CODES["3288"] = d("Refund is blocked by a chargeback", "invalid_request", "manual_review");
GENERAL_CODES["3356"] = d(
  "Payments are not allowed for this card",
  "card_declined",
  "do_not_retry",
);
GENERAL_CODES["3400"] = d(
  "AFT with a commercial card is not allowed",
  "payment_method_unavailable",
  "do_not_retry",
);
GENERAL_CODES["3411"] = d(
  "Sender issuer is outside the Europe region",
  "payment_method_unavailable",
  "do_not_retry",
);
rows(GENERAL_CODES, "card_declined", "customer_action_required", [
  [
    [3434, 3435],
    ["Sender card has expired", "Recipient card has expired"],
  ],
]);
GENERAL_CODES["3480"] = d(
  "Sender issuer is outside the EEA",
  "payment_method_unavailable",
  "do_not_retry",
);
GENERAL_CODES["3611"] = d(
  "AFT needs a reversal within 24 hours",
  "invalid_request",
  "manual_review",
);
GENERAL_CODES["3613"] = d(
  "Payment with the same customer and amount already exists",
  "duplicate_request",
  "retry_conditionally",
);
GENERAL_CODES["3201"] = {
  ...d(
    "Payment routing error",
    "configuration",
    "manual_review",
    "Ecommpay's status request page shows this code with a field validation message, so the routing meaning may not apply; read the message.",
  ),
  ambiguous: true,
};

/** Risk Control System codes (40). Ecommpay's action for all: none required; support can be asked. */
export const RISK_CODES: Record<string, CodeEntry> = {};
rows(RISK_CODES, "fraud_or_risk", "do_not_retry", [
  [
    range(1401, 1408),
    [
      "Card number (PAN) is blacklisted",
      "Customer is blacklisted",
      "Cardholder is blacklisted",
      "Card IIN is blacklisted",
      "IP address is blacklisted",
      "Email is blacklisted",
      "Phone is blacklisted",
      "Card is lost or stolen",
    ],
  ],
  [
    range(1410, 1416),
    [
      "Email domain is blocked",
      "Country is forbidden",
      "Customer country mismatch",
      "Too many countries",
      "Country is not allowed for cross-border AFT",
      "Rejected by scoring",
      "Suspicious payment behaviour",
    ],
  ],
  [[1422], "Amount limit exceeded"],
  [
    [1431, 1432],
    ["Too many cards", "Too many emails"],
  ],
  [[1435], "Too many customer identifiers"],
  [[1437], "Too many cardholder name spellings"],
  [[1441], "Compliance restriction"],
  [
    [1450, 1451, 1452, 1453],
    ["Sanctions list match", "AML check failed", "UK sanctions match", "US sanctions match"],
  ],
  [
    [1455, 1456, 1457, 1458, 1459, 1460, 1461, 1462, 1463],
    [
      "AML phrase list match",
      "Cardholder name format check failed",
      "EU sanctions match",
      "UN sanctions match",
      "NL sanctions match",
      "UAE sanctions match",
      "Card product code is restricted",
      "Card type is restricted",
      "Cardholder name mismatch",
    ],
  ],
  [[1465], "Transaction type is restricted"],
  [[1499], "Rejected by machine learning"],
]);
RISK_CODES["1409"] = d("Attempts are too frequent", "rate_limiting", "retry_conditionally");
RISK_CODES["1421"] = d("Amount is out of the allowed range", "invalid_amount", "do_not_retry");
RISK_CODES["1433"] = d("Operation count limit reached", "rate_limiting", "retry_conditionally");
RISK_CODES["1434"] = d("Likely duplicate", "duplicate_request", "do_not_retry");

/** External card payment system codes (58). */
export const CARD_SYSTEM_CODES: Record<string, CodeEntry> = {
  "10000": d("Provider decline, reason unknown", "card_declined", "retry_conditionally"),
  "10100": d("Provider decline without explanation", "card_declined", "retry_conditionally"),
  "10101": d("Amount or frequency limit", "rate_limiting", "retry_conditionally"),
  "101011": d("Amount limit", "invalid_amount", "do_not_retry"),
  "101012": d("Per-customer amount limit for the period", "rate_limiting", "retry_conditionally"),
  "101013": d("Frequency limit", "rate_limiting", "retry_conditionally"),
  "101014": d("Too many declines in the period", "rate_limiting", "retry_conditionally"),
  "10102": d("Wrong card data", "invalid_request", "customer_action_required"),
  "101021": d("Wrong card number", "invalid_request", "customer_action_required"),
  "10103": d("Wrong PIN or CVV", "card_declined", "customer_action_required"),
  "10104": d("Wrong 3-D Secure password", "authentication_failed", "customer_action_required"),
  "10105": d("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "10106": d("Card expired or wrong expiry date", "card_declined", "customer_action_required"),
  "10107": d("PIN tries exceeded", "card_declined", "customer_action_required"),
  "10108": d(
    "Maestro MO/TO is not allowed for the country",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "10109": d(
    "COF or card saving not approved by the provider",
    "card_declined",
    "retry_conditionally",
  ),
  "10110": d("Customer cancelled the COF agreement at the issuer", "card_declined", "do_not_retry"),
  "10112": d("Insufficient funds; retry later", "insufficient_funds", "retry_conditionally"),
  "10113": d("Insufficient funds; do not retry", "insufficient_funds", "do_not_retry"),
  "10114": d("Declined after 3-D Secure", "authentication_failed", "retry_conditionally"),
  "10201": d("Refer to the card issuer", "card_declined", "customer_action_required"),
  "10202": d("Issuer is inoperative", "provider_unavailable", "safe_to_retry_technical_request"),
  "10203": d("Pick up card", "fraud_or_risk", "do_not_retry"),
  "10204": d("Card is restricted", "card_declined", "customer_action_required"),
  "10205": d(
    "Card is not enrolled in 3-D Secure",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "10206": d("Provider restricts the customer", "fraud_or_risk", "do_not_retry"),
  "10301": d("Cancelled", "unknown", "retry_conditionally"),
  "10401": d(
    "Provider risk decline (do not show the reason to the customer)",
    "fraud_or_risk",
    "manual_review",
  ),
  "10402": d("Suspicious operation", "fraud_or_risk", "do_not_retry"),
  "10403": d("Retry with 3-D Secure", "authentication_required", "customer_action_required"),
  "10404": d("Suspected fraud; do not retry", "fraud_or_risk", "do_not_retry"),
  "10405": d("Fraud or closed account", "fraud_or_risk", "do_not_retry"),
  "10501": d("Refer to the acquirer", "configuration", "manual_review"),
  "10502": d("Validation error", "invalid_request", "do_not_retry"),
  "10503": d("Acquirer settings are wrong", "configuration", "manual_review"),
  "10504": d("Acquirer balance too low", "configuration", "manual_review"),
  "10505": d("Provider system is down", "provider_unavailable", "safe_to_retry_technical_request"),
  "10601": d("Try again", "unknown", "safe_to_retry_technical_request"),
  "10602": d("Timeout", "network_or_timeout", "retry_conditionally", TIMEOUT_NOTE),
  "10603": d("Cannot authorize now", "provider_unavailable", "retry_conditionally"),
  "10701": d("Wrong request sequence", "invalid_request", "do_not_retry"),
  "10702": d("Malformed request", "invalid_request", "manual_review"),
  "10703": d("Wrong ECI at the acquirer", "configuration", "manual_review"),
  "10704": d("Acquirer needs cardholder data", "invalid_request", "manual_review"),
  "10705": d("Acquirer needs customer fields", "invalid_request", "manual_review"),
  "10706": d(
    "Refund is unavailable at the acquirer",
    "payment_method_unavailable",
    "manual_review",
  ),
  "10707": d("Rental data is missing", "invalid_request", "manual_review"),
  "10708": d("Flight data is missing", "invalid_request", "manual_review"),
  "10709": d("Issuer requires additional 3-D Secure", "authentication_required", "manual_review"),
  "10722": d(
    "PSD2 strong customer authentication required",
    "authentication_required",
    "manual_review",
  ),
  "10801": d("Approved but not processed", "unknown", "manual_review"),
  "10805": d("Mastercard lifecycle decline", "card_declined", "customer_action_required"),
  "10806": d("Mastercard policy decline", "card_declined", "manual_review"),
  "10807": d("Issuer fraud or security decline", "fraud_or_risk", "do_not_retry"),
  "10810": d("Lifecycle decline; do not retry", "card_declined", "do_not_retry"),
  "10811": d("Policy decline; do not retry", "card_declined", "do_not_retry"),
  "10812": d("Invalid card; do not retry", "card_declined", "do_not_retry"),
  "19999": pending("Awaiting external processing"),
};

/** External alternative payment system codes (48). */
export const APM_SYSTEM_CODES: Record<string, CodeEntry> = {
  "20000": d("Decline, reason unknown", "unknown", "retry_conditionally"),
  "20100": d("Provider decline without explanation", "unknown", "retry_conditionally"),
  "20101": d("Amount or frequency limit", "rate_limiting", "retry_conditionally"),
  "201011": d("Amount limit", "invalid_amount", "do_not_retry"),
  "201012": d("Per-customer amount limit for the period", "rate_limiting", "retry_conditionally"),
  "201013": d("Frequency limit", "rate_limiting", "retry_conditionally"),
  "201014": d("Too many declines in the period", "rate_limiting", "retry_conditionally"),
  "20102": d("Wrong account data", "invalid_request", "customer_action_required"),
  "20103": d("Wrong login or password", "authentication_failed", "customer_action_required"),
  "20104": d("Password attempts exceeded", "authentication_failed", "customer_action_required"),
  "20105": d("Insufficient funds", "insufficient_funds", "customer_action_required"),
  "20106": d(
    "Account expired or unavailable",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "20107": d(
    "Account does not support the currency",
    "payment_method_unavailable",
    "customer_action_required",
  ),
  "20109": d(
    "COF or account saving not approved",
    "payment_method_unavailable",
    "retry_conditionally",
  ),
  "20110": d(
    "Subscription cancelled by the customer",
    "payment_method_unavailable",
    "do_not_retry",
  ),
  "20111": d("Direct debit mandate is inactive", "payment_method_unavailable", "do_not_retry"),
  "20201": d("Account is restricted", "payment_method_unavailable", "customer_action_required"),
  "20202": d("Provider is unavailable", "provider_unavailable", "safe_to_retry_technical_request"),
  "20203": d("Account is compromised", "fraud_or_risk", "do_not_retry"),
  "20204": d("Crediting is blocked", "payment_method_unavailable", "customer_action_required"),
  "20205": d("Method is unavailable in the country", "payment_method_unavailable", "do_not_retry"),
  "20206": d("Mobile operator problem", "provider_unavailable", "retry_conditionally"),
  "20301": d("Account owner cancelled", "unknown", "customer_action_required"),
  "20302": d("Password is not acceptable", "invalid_request", "customer_action_required"),
  "20303": d("Customer is not permitted", "payment_method_unavailable", "customer_action_required"),
  "20304": d("Wrong amount paid", "invalid_amount", "customer_action_required"),
  "20401": d("Provider risk decline", "fraud_or_risk", "manual_review"),
  "20402": d("Suspicious operation", "fraud_or_risk", "do_not_retry"),
  "20450": d(
    "Verification of Payee technical failure",
    "provider_unavailable",
    "retry_conditionally",
  ),
  "20451": d(
    "Blocked by the Verification of Payee result",
    "invalid_request",
    "customer_action_required",
  ),
  "20501": d("Refer to the acquirer", "configuration", "manual_review"),
  "20502": d("Validation error", "invalid_request", "do_not_retry"),
  "20503": d("Acquirer settings are wrong", "configuration", "manual_review"),
  "20504": d("Acquirer balance too low", "configuration", "manual_review"),
  "20601": d("Try again", "unknown", "safe_to_retry_technical_request"),
  "20602": d("Timeout", "network_or_timeout", "retry_conditionally", TIMEOUT_NOTE),
  "20603": d("Cannot authorize now", "provider_unavailable", "retry_conditionally"),
  "20604": d("Notification was not delivered", "network_or_timeout", "manual_review"),
  "20701": d("Wrong request sequence", "invalid_request", "do_not_retry"),
  "20702": d("Malformed request", "invalid_request", "manual_review"),
  "20703": d("Invoice not found", "invalid_request", "manual_review"),
  "20705": d("Merchant account is blocked", "configuration", "manual_review"),
  "20706": d(
    "Operation is not supported by the provider",
    "payment_method_unavailable",
    "manual_review",
  ),
  "20801": d("Approved but not processed", "unknown", "manual_review"),
  "20802": pending("Provider status is not confirmed yet"),
  "20812": d("Crediting is not confirmed", "unknown", "retry_conditionally"),
  "20899": pending("Processing at the provider; this may take days"),
  "29999": pending("Awaiting external processing"),
};

/** Merchant codes (6). */
export const MERCHANT_CODES: Record<string, CodeEntry> = {
  "30000": d("Declined by the merchant", "unknown", "do_not_retry"),
  "30100": d("Declined by the merchant without a reason", "unknown", "do_not_retry"),
  "30301": d("Merchant did not confirm", "unknown", "do_not_retry"),
  "30302": d("Merchant did not respond", "network_or_timeout", "do_not_retry"),
  "30303": d("Confirmed amount or currency differs", "invalid_amount", "do_not_retry"),
  "30401": d("Empty draws list", "configuration", "do_not_retry"),
};

export const CODE_FAMILIES: readonly [CodeFamily, Record<string, CodeEntry>][] = [
  ["general", GENERAL_CODES],
  ["risk", RISK_CODES],
  ["card_system", CARD_SYSTEM_CODES],
  ["apm_system", APM_SYSTEM_CODES],
  ["merchant", MERCHANT_CODES],
];

export type StatusInfo = { stage: LifecycleStage; outcome: Outcome; description: string };

const st = (stage: LifecycleStage, outcome: Outcome, description: string): StatusInfo => ({
  stage,
  outcome,
  description,
});

/**
 * Payment statuses (23). The payment status is the aggregate of its
 * operations; the stage here is only used when no operation is supplied.
 */
export const PAYMENT_STATUSES: Record<string, StatusInfo> = {
  error: st("payment", "failure", "Payment failed because of an error"),
  processing: st("payment", "pending", "Payment is being processed"),
  "awaiting 3ds result": st("payment", "pending", "Waiting for the 3-D Secure result"),
  "awaiting merchant auth": st("payment", "pending", "Waiting for the merchant to confirm"),
  "awaiting redirect result": st("payment", "pending", "Waiting for the redirect result"),
  "awaiting customer action": st("payment", "pending", "Waiting for the customer to act"),
  "awaiting clarification": st("payment", "pending", "Waiting for clarification data"),
  "awaiting customer": st("payment", "pending", "Retry attempts (Try again) are in progress"),
  "awaiting capture": st("authorization", "success", "Authorized and waiting for capture"),
  "scheduled recurring processing": st(
    "subscription",
    "pending",
    "Scheduled COF series is running",
  ),
  "awaiting payout completion": st("payout", "pending", "Waiting for payout completion"),
  "awaiting payment": st("payment", "pending", "Payment link waiting for payment"),
  "invoice sent": st("payment", "pending", "Payment link sent"),
  "awaiting finalization": st("payment", "pending", "Waiting for finalization"),
  success: st("payment", "success", "Payment completed"),
  decline: st("payment", "failure", "Payment declined"),
  canceled: st("cancellation", "success", "Authorization cancelled"),
  "partially reversed": st("reversal", "success", "Partially reversed"),
  reversed: st("reversal", "success", "Reversed"),
  "partially refunded": st("refund", "success", "Partially refunded"),
  refunded: st("refund", "success", "Refunded"),
  expired: st("payment", "failure", "Payment link expired"),
  "invoice canceled": st("cancellation", "success", "Payment link cancelled"),
};

/** Operation statuses (13). */
export const OPERATION_STATUSES: Record<string, { outcome: Outcome; description: string }> = {
  processing: { outcome: "pending", description: "Operation is being processed" },
  "awaiting 3ds result": { outcome: "pending", description: "Waiting for the 3-D Secure result" },
  "awaiting merchant auth": {
    outcome: "pending",
    description: "Waiting for the merchant to confirm",
  },
  "awaiting redirect result": {
    outcome: "pending",
    description: "Waiting for the redirect result",
  },
  "awaiting customer action": {
    outcome: "pending",
    description: "Waiting for the customer to act",
  },
  "awaiting clarification": { outcome: "pending", description: "Waiting for clarification data" },
  "awaiting payout completion": {
    outcome: "pending",
    description: "Waiting for payout completion",
  },
  "awaiting payment": { outcome: "pending", description: "Payment link waiting for payment" },
  "invoice sent": { outcome: "pending", description: "Payment link sent" },
  expired: { outcome: "failure", description: "Expired" },
  "invoice canceled": { outcome: "failure", description: "Payment link cancelled" },
  success: { outcome: "success", description: "Operation completed" },
  decline: { outcome: "failure", description: "Operation declined" },
};

export type OperationTypeInfo = {
  stage: LifecycleStage;
  description: string;
  recurring?: true;
  /** Payment-link and verification operations move no funds. */
  nonPayment?: true;
};

/**
 * Operation types named in Ecommpay's payment models. `payment.type` values
 * are not documented as a list, so only `operation.type` decides the stage.
 */
export const OPERATION_TYPES: Record<string, OperationTypeInfo> = {
  sale: { stage: "payment", description: "One-step purchase" },
  auth: { stage: "authorization", description: "Authorization of a two-step purchase" },
  capture: { stage: "capture", description: "Capture of an authorization" },
  cancel: { stage: "cancellation", description: "Cancellation of an authorization" },
  incremental: { stage: "authorization", description: "Incremental authorization" },
  refund: { stage: "refund", description: "Refund" },
  reversal: { stage: "reversal", description: "Reversal (same-day refund)" },
  "payment confirmation": {
    stage: "other",
    description: "Payment confirmation step of a one-step purchase",
  },
  recurring: { stage: "payment", description: "COF (recurring) debit", recurring: true },
  recurring_update: { stage: "subscription", description: "Update of a scheduled COF series" },
  recurring_cancel: {
    stage: "cancellation",
    description: "Cancellation of a scheduled COF series",
  },
  payout: { stage: "payout", description: "Payout" },
  "payout reversal": {
    stage: "reversal",
    description: "Payout reversal after crediting failed",
  },
  "account verification": {
    stage: "other",
    description: "Account verification",
    nonPayment: true,
  },
  invoice: { stage: "other", description: "Payment link", nonPayment: true },
  "contract registration": {
    stage: "other",
    description: "Contract registration through a payment link",
    nonPayment: true,
  },
};

/** Documented HTTP statuses of Gate responses. */
export const HTTP_STATUSES: Record<
  number,
  { meaning: string; category: ErrorCategory; retry: RetryGuidance }
> = {
  400: {
    meaning: "a mandatory parameter is missing",
    category: "invalid_request",
    retry: "do_not_retry",
  },
  403: {
    meaning: "forbidden (for example by IP)",
    category: "configuration",
    retry: "manual_review",
  },
  422: { meaning: "malformed JSON", category: "invalid_request", retry: "do_not_retry" },
  500: {
    meaning: "platform error",
    category: "provider_unavailable",
    retry: "retry_conditionally",
  },
};

export type ChargebackEventInfo = {
  kind: "summary" | "details";
  outcome: Outcome;
  description: string;
};

/** Chargeback callback events (9). Summaries carry counts only, no payment link. */
export const CHARGEBACK_EVENTS: Record<string, ChargebackEventInfo> = {
  new_chargebacks_summary: {
    kind: "summary",
    outcome: "unknown",
    description: "Daily summary of new chargebacks",
  },
  new_pre_arbitration_summary: {
    kind: "summary",
    outcome: "unknown",
    description: "Daily summary of new pre-arbitration cases",
  },
  new_arbitration_summary: {
    kind: "summary",
    outcome: "unknown",
    description: "Daily summary of new arbitration cases",
  },
  new_chargeback_details: {
    kind: "details",
    outcome: "pending",
    description: "New chargeback opened",
  },
  new_pre_arbitration_details: {
    kind: "details",
    outcome: "pending",
    description: "Chargeback moved to pre-arbitration",
  },
  new_arbitration_details: {
    kind: "details",
    outcome: "pending",
    description: "Chargeback moved to arbitration",
  },
  // The research does not state the financial effect of an issuer cancellation.
  chargeback_cancelled_by_issuer: {
    kind: "details",
    outcome: "unknown",
    description: "Chargeback cancelled by the issuer",
  },
  chargeback_lost: { kind: "details", outcome: "failure", description: "Chargeback lost" },
  chargeback_won: { kind: "details", outcome: "success", description: "Chargeback won" },
};

/** Token callback actions; token callbacks are recognized but not analyzed. */
export const TOKEN_ACTIONS: ReadonlySet<string> = new Set(["tokenize", "token_revoke"]);

/** Presence of these callback objects means the customer or merchant must act. */
export const PRESCRIPTIVE_FIELDS = [
  "acs",
  "threeds2",
  "redirect_data",
  "display_data",
  "clarification_fields",
] as const;

export const RETRY_TEXT: Record<RetryGuidance, string> = {
  do_not_retry: "Do not retry with the same details; the result will not change.",
  customer_action_required:
    "A new attempt needs the customer to act first (correct their details, complete authentication, contact their issuer or provider, or use another payment method).",
  retry_conditionally:
    "A later attempt may succeed, but first check the payment with a status request (/v2/payment/status) so that a new request does not duplicate an operation that already took effect. Ecommpay rejects a reused payment_id (code 3041), so a new payment needs a new payment_id.",
  safe_to_retry_technical_request:
    "Ecommpay's documented action for this code is to send the request again. If you are not sure the earlier request was rejected, check the payment status first.",
  manual_review:
    "Review the payment manually, or ask Ecommpay support, before deciding on a new attempt.",
  unknown: "Retry safety cannot be assessed from the supplied data.",
};

export const NEXT_ACTION: Record<ErrorCategory, string> = {
  card_declined:
    "Ask the customer to use another card or payment method, or to contact their issuer.",
  authentication_required:
    "Send the payment again with strong customer authentication (3-D Secure).",
  authentication_failed:
    "Ask the customer to complete authentication again, or to use another payment method.",
  invalid_request: "Correct the request data before sending a new request.",
  invalid_amount: "Check the amount, currency and the limits that apply to this operation.",
  insufficient_funds:
    "Ask the customer to use another payment method, or try again once funds are available.",
  payment_method_unavailable: "Offer another card or payment method.",
  fraud_or_risk: "Review the payment and the risk outcome before any new attempt.",
  rate_limiting: "Wait until the limit period has passed before a new attempt.",
  provider_unavailable:
    "Check the payment status before sending a new request; the provider may be temporarily unavailable.",
  network_or_timeout: "Check the payment status before sending a new request.",
  duplicate_request:
    "Check whether the original request already took effect instead of sending it again.",
  configuration:
    "Check the project configuration, credentials and signature, or contact Ecommpay support with the payment_id.",
  unknown: "Check the payment in the Ecommpay Dashboard or ask Ecommpay support.",
};
