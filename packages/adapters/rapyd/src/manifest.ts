import type { ProviderManifest } from "@pandapaylens/core";

export const RAPYD_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.rapyd.net/en";
const SITE = "https://www.rapyd.net";
const INDUSTRIES = `${SITE}/solutions/industries`;

export const rapydManifest: ProviderManifest = {
  id: "rapyd",
  displayName: "Rapyd",
  version: RAPYD_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Gateway is only partly evidenced (routing to partner acquirers, no
  // defining statement) and orchestration is a marketing claim without an API
  // field. Payouts (Disburse) are a product line, not a business category.
  categories: ["card_processing", "acquiring", "alternative_payment_method", "wallet"],
  sectors: [
    { sector: "iGaming and online gambling", source: `${INDUSTRIES}/gaming/` },
    { sector: "CFD and forex trading", source: `${INDUSTRIES}/trading/` },
    { sector: "Crypto exchanges (fiat on-ramp)", source: `${INDUSTRIES}/crypto/` },
    { sector: "Online travel", source: `${INDUSTRIES}/travel/` },
    { sector: "E-commerce", source: `${INDUSTRIES}/ecommerce/` },
    { sector: "Marketplaces", source: `${INDUSTRIES}/marketplaces/` },
    { sector: "Creator economy", source: `${INDUSTRIES}/creator-economy/` },
    { sector: "Affiliate and influencer marketing", source: `${INDUSTRIES}/affiliate/` },
    { sector: "Gig economy", source: `${INDUSTRIES}/gig-economy-payments/` },
    { sector: "B2B", source: `${INDUSTRIES}/b2b/` },
    { sector: "Fintech and financial apps", source: `${INDUSTRIES}/finance/` },
  ],
  regions:
    "Regulated entities per Rapyd's regulatory framework page: Rapyd Europe hf. (EMI, Central Bank of Iceland), Rapyd Payments Limited (EMI, FCA), Rapyd HK Limited and Rapyd HK Asia Limited (Hong Kong licences), Rapyd Holding Pte. Ltd. (Major Payment Institution, MAS), Rapyd Payments Israel Ltd. (Payment Services License, ISA) and Rapyd Financial Technology US Inc. (MSB, FinCEN); elsewhere Rapyd works through selected Network Partners. Payment and payout methods and their required fields depend on country and currency (for example SEPA mandates, Shva in Israel, local GBP payouts). Gambling, trading, crypto, adult, travel, marketplaces and other businesses are restricted or prohibited by Rapyd's Global Prohibited and Restricted Businesses list; a listed sector does not mean a merchant will be approved.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. REST responses follow the status object and data shapes of Rapyd's Merchant API reference samples, and webhooks follow the documented field tables and the four sample shapes (body only, HTTP client wrapper, internal delivery record, Retrieve Webhook response). Many of Rapyd's webhook samples are not valid JSON, so those fixtures are rebuilt from the field tables. Identifiers carry the PPLsynth marker instead of Rapyd's 32 hexadecimal characters. None is an official Rapyd example.",
  dependencies: [
    "Card schemes and acquirers: Rapyd acquires Visa and Mastercard in some regions and also routes card payments to third-party acquirers.",
    "In-country Network Partners and local payment and payout methods whose own codes are not documented by Rapyd.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "rapyd.api_response",
      description:
        "Merchant API REST response: status object (error_code, status, message, response_code, operation_id) with a payment, refund, payout or dispute in data, or a list of them",
      status: "limited",
    },
    {
      id: "rapyd.webhook",
      description:
        "Webhook for payments, refunds, disputes and payouts (id wh_, type, data, trigger_operation_id, status, created_at, extended_timestamp), also inside the documented HTTP client wrapper or as a delivery record",
      status: "limited",
    },
    {
      id: "rapyd.wallet_transfer",
      description:
        "Wallet transfer response (transfer between Rapyd Wallets); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "rapyd.wallet_webhook",
      description:
        "Wallet transaction webhooks (TRANSFER_FUNDS_BETWEEN_EWALLETS_*, EWALLET_*, TransferRequest); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "rapyd.partner_and_pos",
      description: "Partner API, Issuing, Verify, subscriptions and point-of-sale APIs",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    // Payment, refund, payout and dispute objects are analyzed; wallet
    // transfer responses are only recognized.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    // Explicit object links only; operation ids are shown but not used to
    // group events.
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Rapyd-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "errors",
      title: "Error messages (status object)",
      url: `${DOCS}/error-messages.html`,
    },
    { topic: "codes", title: "Rapyd error codes", url: `${DOCS}/rapyd-error-codes.html` },
    {
      topic: "card-network-codes",
      title: "Card network errors",
      url: `${DOCS}/card-network-errors.html`,
    },
    {
      topic: "merchant-advice",
      title: "Merchant advice codes",
      url: `${DOCS}/merchant-advice-codes.html`,
    },
    { topic: "payment", title: "Create Payment", url: `${DOCS}/create-payment.html` },
    { topic: "refund", title: "Refund", url: `${DOCS}/refund.html` },
    { topic: "payout", title: "Create Payout", url: `${DOCS}/create-payout.html` },
    { topic: "dispute", title: "Retrieve Dispute", url: `${DOCS}/retrieve-dispute.html` },
    { topic: "webhooks", title: "Webhook format", url: `${DOCS}/webhook-format.html` },
    {
      topic: "webhook-delivery",
      title: "Retrieve Webhook (delivery status and attempts)",
      url: `${DOCS}/retrieve-webhook.html`,
    },
    { topic: "payment-webhooks", title: "Payment webhooks", url: `${DOCS}/payment-webhooks.html` },
    { topic: "refund-webhooks", title: "Refund webhooks", url: `${DOCS}/refund-webhooks.html` },
    { topic: "dispute-webhooks", title: "Dispute webhooks", url: `${DOCS}/dispute-webhooks.html` },
    { topic: "payout-webhooks", title: "Payout webhooks", url: `${DOCS}/payout-webhooks.html` },
    { topic: "idempotency", title: "Idempotency", url: `${DOCS}/idempotency.html` },
    { topic: "sandbox", title: "Simulated errors", url: `${DOCS}/simulated-errors.html` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "webhook id (wh_...), which a resent webhook keeps",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Rapyd delivers webhooks at least once and may deliver them out of order. Make the handler idempotent on the webhook id, compare the object status with the one already stored, and retrieve the payment, refund or payout before acting on an older state.",
    docsUrl: `${DOCS}/webhook-format.html`,
  },
  limitations: [
    "Error codes are decoded by the field that carries them: string codes from status.error_code, status.response_code, the payment error_code and the payout error; card network codes from the ERROR_PROCESSING_CARD - [NN] suffix (with the payment failure_code as a fallback); merchant advice codes only from merchant_advice_code. A failure_code without ERROR_PROCESSING_CARD is read as a network code with possible confidence, because Rapyd also uses failure_code for bank transfer reasons and sandbox codes. A bare number in error_code is not decoded.",
    "Rapyd documents error_code and response_code as the same value, but one sample differs. When they differ, both are decoded with possible confidence.",
    "Codes that Rapyd lists more than once with different meanings (ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION, network code 76, network codes 81 and 82 with a Mastercard row) show every meaning with possible confidence. Network codes 00, 08 and 11 (Success) and 10 (Partial approval) are listed by Rapyd as errors and are shown for manual review.",
    "Nine codes appear only in documentation samples and are decoded with possible confidence. Sandbox simulation codes are marked as such; Rapyd notes that sandbox and production codes can differ.",
    "The payout field gc_error_code is documented as reserved, although Rapyd's samples put the real error there and leave error empty. Codes from gc_error_code are decoded with possible confidence at most, and only when the payout failed.",
    "Refund failure_code values and payment cancel_reason values are not documented and are shown without interpretation. Refund failure_reason values are interpreted with possible confidence.",
    "Webhook samples come in four shapes (body only, HTTP client wrapper, internal delivery record, Retrieve Webhook response) and many are not valid JSON. All four shapes are accepted when they carry the wh_ webhook id (id, or token in a delivery record); JSON with trailing commas or comments is read with a warning, other syntax errors are not repaired.",
    "Webhook retry schedule, retry count and acknowledgement rules are not documented on the webhook pages. At-least-once delivery and possible out-of-order delivery are stated only in Rapyd's documentation index (llms.txt).",
    "PAYMENT_SUCCEEDED is sent when a payment request is received; the outcome is taken from the payment status and next_action, so a 3DS payment in ACT is shown as pending. Settlement to the merchant is not a payment status and is not shown.",
    "A payment in ACT with next_action pending_capture is shown as an authorization; capture is shown only from PAYMENT_CAPTURED. A REST response to Capture Payment cannot be told apart from other payment responses, because the response does not name the operation.",
    "Payment, refund, dispute and payout events are linked only through explicit identifiers: the payment id, the refund's payment, the dispute's original_transaction_id and the payout id. operation_id and trigger_operation_id are shown and used to match an API error with its webhook, but not to group events, because Rapyd does not document whether one operation can trigger webhooks for several objects. merchant_reference_id is never used to link events.",
    "A refund reported by both its REST response and its webhook appears as two refund events. Payouts have no parent payment.",
    "Dispute amounts, scheme reason codes and dispute timestamps are not documented as fields and are not read.",
    "Wallet transfers between Rapyd Wallets (transfer responses and wallet transaction webhooks) are recognized but not analyzed; they are a separate lifecycle from payments and payouts. Wallet transaction error codes are still decoded when they appear in an error response.",
    "Dated API versions (api_version header) can change responses and webhooks, and payloads do not show the version. Partner API, Issuing, Verify, subscriptions and point-of-sale formats are not analyzed. Bare data objects without the status object or the webhook body are not recognized.",
    "Webhook signatures and the salt, timestamp and access_key headers are never verified or copied; a pasted webhook is never treated as authentic. Only the presence of a signature header is reported.",
    "Category and retry guidance per code are PandaPayLens suggestions; Rapyd's corrective actions are reflected where they decide the retry class.",
  ],
  samples: ["rapyd-payment-failed", "rapyd-payout-lifecycle"],
};
