import type { ProviderManifest } from "@pandapaylens/core";

export const PXP_ADAPTER_VERSION = "0.1.0";

const HIGH_RISK_PARTNERS = "https://www.pxp.io/high-risk-partners";

export const pxpManifest: ProviderManifest = {
  id: "pxp",
  displayName: "PXP Financial",
  version: PXP_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  categories: [
    "gateway",
    "acquiring",
    "card_processing",
    "orchestration",
    "alternative_payment_method",
  ],
  sectors: [
    { sector: "Betting and gaming", source: "https://www.pxp.io/gaming" },
    {
      sector: "UK regulated gambling (MCC 7995)",
      source: "https://www.pxp.io/a-level-playing-field-for-uk-gambling-payments",
    },
    { sector: "Retail", source: "https://www.pxp.io/retail" },
    { sector: "Hospitality", source: "https://www.pxp.io/hospitality" },
    { sector: "Travel", source: "https://www.pxp.io/travel" },
    { sector: "Cruise", source: "https://www.pxp.io/cruise" },
    { sector: "Gaming platforms", source: HIGH_RISK_PARTNERS },
    { sector: "Content creator platforms", source: HIGH_RISK_PARTNERS },
    { sector: "Payment facilitators", source: HIGH_RISK_PARTNERS },
    { sector: "Forex & Crypto", source: HIGH_RISK_PARTNERS },
    { sector: "CBD and Nutraceutics", source: HIGH_RISK_PARTNERS },
    { sector: "Direct marketing", source: HIGH_RISK_PARTNERS },
  ],
  regions:
    "Card processing across the UK, EU, US, Canada and LATAM (FCA authorised since 2008, register number 504318; US money transmitter licence). Local payment methods are single-currency: SPEI (MXN), CVU (ARS, Argentina only), Bre-B (COP), FlashFlow (THB), Aeropay (US). Per-country gambling acceptance rules are not documented.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads built from PXP's public OpenAPI schemas, documented field tables and example shapes; identifiers and values are invented and contain PPLsynth. They are not official PXP examples.",
  dependencies: [
    "Third-party acquirers named in fundingData.providerResponse.provider (examples show elavon and lloydscardnet)",
    "PayPal (PayPal, Pay Later, Venmo)",
    "Aeropay",
    "SPEI",
    "CVU",
    "Bre-B",
    "FlashFlow",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "pxp.transaction_response",
      description:
        "Transactions API v1 responses: initiation, modifications (capture, void, refund, incremental) and lookup items (state, stateData, systemTransactionId)",
      status: "supported",
    },
    {
      id: "pxp.api_error",
      description:
        "API error envelope ({ correlationId, details, errorCode, errorReason }); errorCode values are known only from PXP examples",
      status: "limited",
    },
    {
      id: "pxp.webhook",
      description:
        "Merchant webhooks v1 (eventCategory, eventDate, eventData, eventOwner) for card, PayPal family, pay-by-bank deposits and payouts, Aeropay and 3DS challenge-completed events",
      status: "limited",
    },
    {
      id: "pxp.webhook.non_payment",
      description:
        "Token, reporting, user and test-connection webhooks (recognized but not analyzed)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has PXP-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "how-it-works",
      title: "Transactions: how it works (states, card and APM codes)",
      url: "https://developer.pxp.io/guides/transactions/how-it-works.md",
    },
    {
      topic: "transaction-api",
      title: "Transactions service OpenAPI",
      url: "https://developer.pxp.io/_bundle/apis/transaction.yaml",
    },
    {
      topic: "api-overview",
      title: "API overview (HTTP statuses, idempotency, webhook retries)",
      url: "https://developer.pxp.io/guides/get-started/api-overview.md",
    },
    {
      topic: "modify-transactions",
      title: "Modify transactions",
      url: "https://developer.pxp.io/guides/transactions/modify-transactions.md",
    },
    {
      topic: "lookup",
      title: "Get transaction details",
      url: "https://developer.pxp.io/guides/transactions/get-transaction-details.md",
    },
    {
      topic: "webhooks",
      title: "About webhooks",
      url: "https://developer.pxp.io/guides/get-started/about-webhooks.md",
    },
    {
      topic: "manage-webhooks",
      title: "Manage webhooks (duplicate handling)",
      url: "https://developer.pxp.io/guides/get-started/manage-webhooks.md",
    },
    {
      topic: "webhook-api",
      title: "Merchant webhooks service OpenAPI",
      url: "https://developer.pxp.io/_bundle/apis/merchant-webhook.yaml",
    },
    {
      topic: "3ds-states",
      title: "3DS authentication states",
      url: "https://developer.pxp.io/guides/3ds/states.md",
    },
    {
      topic: "spei",
      title: "SPEI transactions",
      url: "https://developer.pxp.io/guides/transactions/e-commerce/spei-transaction.md",
    },
    {
      topic: "flashflow",
      title: "FlashFlow transactions",
      url: "https://developer.pxp.io/guides/transactions/e-commerce/flashflow-transaction.md",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "eventCode and systemTransactionId (only when eventCode is present)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "PXP says duplicate webhooks share eventCode and systemTransactionId while eventDate can differ, and that the details of the latest delivery should be used. Events without an eventCode (most card, PayPal family, payout and 3DS events) have no documented duplicate key, so make the handler idempotent on systemTransactionId and state.",
    docsUrl: "https://developer.pxp.io/guides/get-started/manage-webhooks.md",
  },
  limitations: [
    "PXP documents no chargeback, dispute or settlement events, and no chargeback or dispute API objects. Chargebacks cannot be shown on the timeline.",
    "Webhooks have no event id. Repeated deliveries are recognized only by eventCode and systemTransactionId, as PXP documents. Card, PayPal family, payout and 3DS events usually carry no eventCode, so their repeated deliveries are not recognized as duplicates.",
    "Many card and PayPal events carry no eventCode. Their event name (for example transaction-captured) is inferred from eventCategory, state, intent and funding type and marked with eventTypeInferred. Card refused and error events without eventCode are shown by state only.",
    "Captures, voids and refunds return a new systemTransactionId and PXP documents no parent field for cards or PayPal. Such modifications are shown as separate transactions and are never merged with the original by guesswork. originalSystemTransactionId links them only where it is present (Aeropay). merchantOrderId is never used as a link.",
    "Delivery order is not documented and PXP retries up to 10 times within 10 seconds. The timeline orders webhooks by eventDate, which can differ between copies of one event.",
    "Transaction responses carry no provider timestamp; merchantTransactionDate (merchant supplied) is used when it has a time zone. Timestamps without a time zone are not placed on the timeline.",
    "Field shapes drift between PXP examples (amounts.transaction, amounts.transactionValue and a singular amount object; flat or nested fundingData.card; eventCategory casing). All documented variants are read and the variant used is reported in attributes.",
    "The states Confirmed, Updated and Approved appear in the transaction enum without an explanation and stay unknown. A card refund response with state Authorised is shown as a successful refund authorisation; PXP gives no card refund webhook example.",
    "Pay-by-bank APM state codes (APM001 to APM013) and API errorCode values have no published definition table; their meanings come from PXP examples and are decoded with at most possible confidence. Unknown codes stay unknown.",
    "Raw acquirer codes in providerResponse.code depend on the acquirer and are not documented by PXP; they are shown but not interpreted. Mastercard merchantAdvice codes are shown but not interpreted.",
    "3DS decoding uses authenticationState, transStatus and the documented reason codes only. The field that carries 3DS error codes (101 to 403) and challengeCancel meanings are not documented per value, so they are not decoded. 3DS events have no documented link to the card transaction.",
    "Token, reporting, user and test-connection webhooks are recognized but not analyzed. Token events cannot be told apart from the body. CVU and Bre-B transaction-context responses and client SDK codes (SDKxxxx) are not analyzed.",
    "Purchase and payout share pay-by-bank event codes; without transactionMethod.intent the operation of such an event is not known and it is shown as a payment.",
    "Card payout and verification responses are not exemplified by PXP. FlashFlow refunds and Aeropay payouts are not documented.",
    "Webhook signatures (X-Signature, X-Signature-Timestamp, X-Request-Id headers) are sensitive and are never verified; a pasted webhook is not treated as authentic. The hash function for the header signature is not named by PXP.",
    "Adult content is not a documented PXP sector. The high-risk vertical list describes PXP's partner programme, not per-merchant acceptance; eligibility depends on jurisdiction, licensing and underwriting.",
    "The transactions release notes are empty, so payload changes cannot be tracked by date.",
    "Category and retry guidance per code are PandaPayLens suggestions; PXP gives no per-code retry advice except for 3DS states and its idempotency on merchantTransactionId.",
  ],
  samples: ["pxp-card-refused", "pxp-payout-rejected"],
};
