import type { ProviderManifest } from "@pandapaylens/core";

export const PAYU_INDIA_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.payu.in/docs";
const REF = "https://docs.payu.in/reference";
const SITE = "https://payu.in";

export const payuIndiaManifest: ProviderManifest = {
  id: "payu_india",
  displayName: "PayU India",
  version: PAYU_INDIA_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // acquiring is not claimed: payloads name the bank gateways a payment was
  // routed to. Merchant wallets and routing through other aggregators are
  // separate products that were not researched.
  categories: ["gateway", "payment_facilitator", "card_processing", "alternative_payment_method"],
  sectors: [
    { sector: "Travel", source: `${SITE}/travel-payment-solutions/` },
    { sector: "Airlines", source: `${SITE}/company/` },
    { sector: "Insurance", source: `${SITE}/insurance-category/` },
    { sector: "EdTech", source: `${SITE}/edtech-payment-solutions/` },
    { sector: "D2C and e-commerce", source: `${SITE}/ecommerce-payment-solutions/` },
    { sector: "WealthTech", source: `${SITE}/wealthtech-payment-solutions/` },
    { sector: "NBFC (lending)", source: `${SITE}/nbfc-payment-solutions/` },
    { sector: "AI and SaaS", source: `${SITE}/global-ai-saas-payments-india/` },
  ],
  regions:
    "India only: PayU Payments Private Limited is a payment aggregator regulated under the RBI Payment Aggregator Guidelines (RBI/DPSS/2019-20/174), per its grievance policy. PayU platforms in other regions use different formats and are not covered. UPI Collect by VPA is sunset by NPCI from 28 February 2026 and allowed only on MCC 6012 and 6211; international cards can be disabled per merchant (E903, E908); cross-border payments are a separate product. PayU's own banned list excludes gambling and games of chance, adult goods and services, unlicensed forex and money exchange including crypto, skill-based gaming where not permitted, tobacco, firearms and multilevel marketing, and a cautious list covers dating, online pharmacies, alcohol, securities and forex, gift cards and payment aggregators. A listed sector does not mean a merchant will be approved; eligibility depends on PayU underwriting.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers instead of PayU's numeric ids. The payment response, the failed-payment webhook, the Verify Payment responses and the refund API failure follow the shapes of the examples on docs.payu.in with synthetic values; other outcomes (pending UPI, dropped, cancelled, pre-authorized, refund queued with error_code) are built from the documented parameter tables, payment state table and code tables. The code tables on the Error Codes page are loaded by docs.payu.in from JSON files in a GitHub assets repository (palgunams21/payu-docs-assets); the research checked every code against those files. None of the fixtures is an official PayU example.",
  dependencies: [
    "Card networks, issuing banks, net banking and UPI banks and wallets that PayU routes to; their own reasons reach the merchant only as text in field8 and field9.",
    "Bank payment gateways named in payloads (for example PG_TYPE and bankcode values).",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "payu_india.payment_response",
      description:
        "Form-encoded payment response posted to surl, furl or curl and the Successful / Failed payment webhook, which share one field set (mihpayid, txnid, status, unmappedstatus, error, error_Message, field7, field8, field9, bank_ref_num, hash)",
      status: "limited",
    },
    {
      id: "payu_india.verify_payment",
      description: "Verify Payment API JSON (status 0/1, msg, transaction_details keyed by txnid)",
      status: "limited",
    },
    {
      id: "payu_india.command_response",
      description:
        "Command API JSON envelope (status 0/1, msg, mihpayid, request_id, error_code) of refund, capture and cancel requests; error_code is decoded only for refund requests",
      status: "experimental",
    },
    {
      id: "payu_india.refund_webhook",
      description: "Refund webhook and refund status callback JSON; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "payu_india.dispute_webhook",
      description: "Dispute (chargeback) webhook JSON; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "payu_india.s2s_response",
      description:
        "S2S interim payment response (metaData, result, binData); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "payu_india.transaction_details",
      description:
        "Date-range transaction listing (Transaction_details array); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "payu_india.settlement",
      description: "Settlement and chargeback REST APIs, Payment Links, subscriptions and payouts",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    // No currency field in the payment response, no documented time zone, and
    // the browser post and the webhook cannot be told apart.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has PayU-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "codes", title: "Error codes", url: `${REF}/error-codes` },
    {
      topic: "payment-states",
      title: "Payment state explanations",
      url: `${REF}/payment-state-explanations`,
    },
    {
      topic: "payment-response",
      title: "Collect Payment API (PayU hosted checkout)",
      url: `${REF}/_payment_payu_hosted_checkout`,
    },
    {
      topic: "webhooks",
      title: "Webhook events and sample payloads",
      url: `${DOCS}/webhook-events-and-sample-payloads`,
    },
    { topic: "verify", title: "Verify Payment API", url: `${REF}/verify_payment_api` },
    { topic: "refund", title: "Refund Transaction API", url: `${REF}/refund_transaction_api` },
    {
      topic: "refund-codes",
      title: "Error codes for refund initiation",
      url: `${REF}/error-codes-for-refund-initiation`,
    },
    {
      topic: "hashing",
      title: "Hashing the request and response",
      url: `${DOCS}/hashing-request-and-response`,
    },
    { topic: "faq", title: "General FAQs", url: `${DOCS}/general-faqs` },
    {
      topic: "checkout",
      title: "Prebuilt checkout page integration",
      url: `${DOCS}/prebuilt-checkout-page-integration`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "no documented key: payment webhooks carry no event or delivery id, so repeated deliveries are not recognized",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "PayU asks merchants to handle duplicate webhook events idempotently. Key your handler on mihpayid and the status, never fulfil an order while status is pending, and confirm the state with the Verify Payment API before acting. Retry schedule and ordering of webhooks are not documented.",
    docsUrl: `${DOCS}/webhook-events-and-sample-payloads`,
  },
  limitations: [
    "The browser post to surl, furl or curl and the payment webhook use the same fields, so a pasted record cannot be attributed to one of them. PayU calls the server-to-server webhook the primary source of truth.",
    "Payment webhooks have no event or delivery id, retry schedule or ordering rule. No delivery key is set, so a repeated delivery appears as a separate event and is not reported as a duplicate.",
    "status pending (UPI, net banking, wallets and corporate banking that complete later) stays pending. PayU says only success is a successful payment and a pending payment must be resolved with the Verify Payment API or a later webhook. The length of the pending window is not documented.",
    "The payment response and Verify Payment output carry no currency field, so amounts are shown as the decimal strings PayU sends (amount, net_amount_debit, amt) and are not converted to minor units.",
    "addedon has no documented time zone. It is shown as supplied and is not used as an event time, so events are ordered as they appear in the input.",
    "Codes are decoded from the main payment error table, the EX table, the subscription and Alt ID tables, and the AuthN/AuthZ mapping tables (possible confidence). The UPI error table disagrees with the main table for 67 of its 210 rows and is not used.",
    "E307, E9251, E9252, E9254, EX151, EX306, EX307 and EX401 have several rows with different texts; all meanings are shown with possible confidence. Thirteen codes from the AuthN/AuthZ mapping tables have no meaning and are shown as unknown.",
    "E4936 appears in a Verify Payment example but in no code table; it and any other unlisted code are shown as unknown with insufficient confidence.",
    "PayU says error reasons come from banks and can differ between transactions. field8 (the bank's raw reason) and field9 (PayU's translation) are shown as text after removing identifier-like values; they are not decoded. Field7 is read as the execution stage; seven Field7 values used only in the AuthN mapping table are not described and are not interpreted.",
    "The issuer response code table (67 codes mapped to PayU codes) is kept as reference data only: no payload field is documented to carry the issuer code. field5 looks like that code in card samples, but the docs do not say so, so it is not read.",
    "error_code of the command API is decoded with the refund initiation table only when the msg shows a refund request, because the capture table reuses the same numbers with other meanings. A queued refund (status 1, error_code 102) is shown as pending, not as a completed refund. Refund status codes (R000-R501) are kept as reference data because the docs do not say which field carries them. Command API bodies printed as PHP arrays or PHP-serialized strings are not parsed.",
    "Refund webhooks, refund ARN callbacks, dispute webhooks, S2S interim responses and the transaction listing are recognized but not analyzed. Settlement and chargeback APIs, Payment Links, subscriptions (SI, e-NACH, UPI Autopay), payouts and PayU platforms outside India are not analyzed.",
    "Events are linked only by mihpayid (PayU's transaction id). txnid is shown as the merchant reference and not used for linking. A Verify Payment entry that PayU reports as Not Found has no mihpayid and stays on its own.",
    "The response hash is a SHA-512 over the merchant salt and payment fields. It is never verified or copied; only its presence and length are reported. The merchant key, udf1-udf10, card, UPI (VPA), account, phone, email, name, address and PAN fields are never copied.",
    "Field names drift between APIs and pages (error_Message and error_message, bank_ref_num and bank_ref_no, userCancelled and usercancelled, success and failed). The documented variants are accepted; status values are matched without regard to case.",
    "Category and retry guidance per code are PandaPayLens suggestions; where PayU gives advice it is reflected.",
  ],
  samples: ["payu-india-card-declined", "payu-india-upi-pending"],
};
