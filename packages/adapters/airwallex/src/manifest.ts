import type { ProviderManifest } from "@pandapaylens/core";

export const AIRWALLEX_ADAPTER_VERSION = "0.1.0";

const D = "https://www.airwallex.com/docs";
const GET_STARTED = `${D}/payments/get-started/get-started-with-payments`;

export const airwallexManifest: ProviderManifest = {
  id: "airwallex",
  displayName: "Airwallex",
  version: AIRWALLEX_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Not claimed: orchestration (dynamic routing is a product claim, and no
  // payload field exposes a routing decision), wallet (the Airwallex Wallet is
  // the merchant's business balance), payment_facilitator and
  // merchant_account_intermediary.
  categories: ["acquiring", "card_processing", "gateway", "alternative_payment_method"],
  sectors: [
    {
      sector: "Ecommerce and online retail",
      source: "https://www.airwallex.com/global/solutions/ecommerce",
    },
    { sector: "Marketplaces", source: "https://www.airwallex.com/global/solutions/marketplaces" },
    { sector: "SaaS", source: "https://www.airwallex.com/global/solutions/saas" },
    { sector: "Travel", source: "https://www.airwallex.com/global/solutions/travel" },
    { sector: "Digital content and subscriptions", source: GET_STARTED },
    { sector: "B2B and professional services", source: GET_STARTED },
    { sector: "Retail and food and beverage (in person)", source: GET_STARTED },
    {
      sector:
        "Digital products (Merchant of Record beta: games, SaaS, design assets, e-books, digital vouchers)",
      source: `${D}/payments/merchant-of-record`,
    },
  ],
  regions:
    "Licensed entities per Airwallex's regional sites: UK (Airwallex (UK) Limited, FCA-authorised EMI, FRN 900876), EU (Airwallex (Netherlands) B.V., DNB, and AWX Lithuania, UAB, Bank of Lithuania, both EMIs), Australia (Airwallex Pty Ltd, AFSL 487221), Singapore (Major Payment Institution, MAS licence PS20200541), Hong Kong (Money Service Operator licence 16-09-01929) and the US (Airwallex US, LLC, money transmitter, NMLS 1928093). US-registered merchants must provide a US individual to enable card payments; Hong Kong merchants cannot hold UnionPay debit cards; Visa POS holds are limited to 5 days; settlement batches follow the time zone of the merchant's Airwallex entity. No prohibited or restricted business list was found.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers, shaped after the public Airwallex API reference (Retrieve PaymentIntent, PaymentAttempt, Refund and PaymentDispute), the error response codes page and the payments webhook pages. trace_id and event id values carry the PPLsynth marker instead of the documented hex formats. FAILED attempts with failure_details are built from the documented schema, because Airwallex publishes no such example. None is an official Airwallex example.",
  status: "limited",
  apiFamilies: [
    {
      id: "airwallex.error",
      description:
        "Payments Client API error body (code, message, source, trace_id, details, provider_original_response_code), including declines and HTTP 401, 404, 429 and 500 errors",
      status: "supported",
    },
    {
      id: "airwallex.payment_intent",
      description:
        "PaymentIntent snapshots (int_ ids) with the embedded latest_payment_attempt and its failure_code, failure_details, issuer response code and Merchant Advice Code",
      status: "limited",
    },
    {
      id: "airwallex.payment_attempt",
      description: "PaymentAttempt snapshots (att_ ids)",
      status: "limited",
    },
    { id: "airwallex.refund", description: "Refund snapshots (rfd_ ids)", status: "supported" },
    {
      id: "airwallex.payment_dispute",
      description:
        "PaymentDispute snapshots (dst_ ids) with stage, status, mode and reason; the older dispute webhook shape (dispute_id, dispute_amount) is read as an alias",
      status: "limited",
    },
    {
      id: "airwallex.webhook",
      description:
        "Payments webhooks (id, name, data.object, created_at, version) for payment_intent.*, payment_attempt.*, refund.* and payment_dispute.* events; other documented payments events are shown without lifecycle semantics",
      status: "limited",
    },
    {
      id: "airwallex.payout_webhook",
      description:
        "payout.transfer.* and payout.batch_transfers.* webhooks; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "airwallex.transfer",
      description: "Payout Transfer objects; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "airwallex.js",
      description: "Airwallex.js and mobile SDK client-side error callbacks; not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Two documented layers: the Airwallex code (31 values with HTTP status)
    // and the issuer response code (176 rows), keyed on the card brand, plus
    // Merchant Advice Codes. Tested from the documented examples.
    errorDecoding: "supported",
    // No documented example of a FAILED attempt with failure_details, the
    // documented examples pair a SUCCEEDED intent with an AUTHORIZED attempt,
    // and payloads depend on the API version.
    paymentResponses: "limited",
    // The envelope examples disagree (account_id vs accountId, missing
    // created_at and version, invalid JSON, three event id formats), and the
    // link between failure events and failure_code is inferred.
    webhookParsing: "limited",
    // Snapshots carry no status history and embed only the latest attempt;
    // delivery order is not guaranteed.
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has Airwallex-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "error-codes",
      title: "Error response codes",
      url: `${D}/payments/troubleshooting/error-response-codes`,
    },
    {
      topic: "issuer-response-codes",
      title: "Issuer response codes",
      url: `${D}/payments/troubleshooting/response-codes/issuer-response-codes`,
    },
    {
      topic: "merchant-advice-codes",
      title: "Merchant Advice Codes",
      url: `${D}/payments/troubleshooting/response-codes/merchant-advice-code`,
    },
    {
      topic: "avs-codes",
      title: "AVS codes",
      url: `${D}/payments/troubleshooting/response-codes/avs-codes`,
    },
    {
      topic: "cvc-codes",
      title: "CVC2/CVV2 codes",
      url: `${D}/payments/troubleshooting/response-codes/cvc2cvv2-codes`,
    },
    {
      topic: "statuses",
      title: "Payment statuses",
      url: `${D}/payments/reference/payment-statuses`,
    },
    {
      topic: "payment-intents",
      title: "Retrieve a PaymentIntent",
      url: `${D}/api/payments/payment_intents/retrieve`,
    },
    {
      topic: "payment-attempts",
      title: "Retrieve a PaymentAttempt",
      url: `${D}/api/payments/payment_attempts/retrieve`,
    },
    { topic: "refunds", title: "Retrieve a Refund", url: `${D}/api/payments/refunds/retrieve` },
    {
      topic: "disputes",
      title: "Retrieve a PaymentDispute",
      url: `${D}/api/payments/payment_disputes/retrieve`,
    },
    {
      topic: "webhooks",
      title: "Payments webhooks",
      url: `${D}/payments/reference/payments-webhooks`,
    },
    {
      topic: "webhook-delivery",
      title: "Webhooks overview",
      url: `${D}/developer-tools/webhooks/webhooks-overview`,
    },
    {
      topic: "webhook-envelope",
      title: "Listen for webhook events",
      url: `${D}/developer-tools/webhooks/listen-for-webhook-events`,
    },
    { topic: "rate-limits", title: "Rate limits", url: `${D}/developer-tools/api/rate-limits` },
    {
      topic: "idempotency",
      title: "Using the PaymentIntents API",
      url: `${D}/payments/get-started/using-payments-intent-api`,
    },
    {
      topic: "testing",
      title: "Test card numbers",
      url: `${D}/payments/test-and-go-live/test-card-numbers`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event id",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Airwallex retries until it receives HTTP 200 (exponential back-off over about three days) and keeps the event id unchanged across retries. Record processed event ids, and order events by created_at instead of arrival order. Whether a manual re-trigger keeps the same id is not documented.",
    docsUrl: `${D}/developer-tools/webhooks/webhooks-overview`,
  },
  limitations: [
    "Only the Payments Client API JSON (PaymentIntent, PaymentAttempt, Refund, PaymentDispute, the error body) and payments webhooks are analyzed. Payout transfers and payout webhooks are recognized but not analyzed in this version, and transfer error codes (for example validation_failed with details.errors[]) are not decoded.",
    "Issuer response codes depend on the card brand: 14 code strings have different meanings per brand. The brand is read from details.card_brand (error body) or payment_method.card.brand (attempt). Without a brand, every brand meaning is shown and the decode is marked possible. Only lowercase brand names such as visa and mastercard appear in Airwallex's examples; other brand spellings are matched by name.",
    "Codes from local payment method providers (provider_declined with a provider's own provider_original_response_code) are not published by Airwallex and are shown without a meaning. The meaning of operation_above_limit is not documented. Airwallex.js browser error codes are not analyzed.",
    "PaymentAttempt failure_code values have no descriptions in the documentation, and Airwallex publishes no example of a FAILED attempt with failure_details; decoding them follows the value names and the documented schema. The link between the five failure events and failure_code is inferred from the names.",
    "The value set of authentication_data.avs_result and cvc_result is not documented (the API reference shows pass, webhook examples show U). Single-letter values are explained from the AVS and CVC tables; other values are shown as supplied.",
    "Webhook envelope examples disagree: account_id or accountId, missing created_at and version, and event ids as evt_ digits, 32 hex characters or a UUID. When created_at is missing, the object's updated_at is used as the event time. Payload fields depend on the API version (x-api-version and the subscription version); no per-version change log for payments was found.",
    "A PaymentIntent snapshot embeds only the latest attempt and carries no status history. Airwallex says the intent status list is not exhaustive and that the intent status is only typically linked to the latest attempt (its own examples show a SUCCEEDED intent with an AUTHORIZED attempt). Unknown statuses are shown as unknown.",
    "Snapshot event times use the object's updated_at, which is the time of the last change, not necessarily of the status shown.",
    "The event id is used as the delivery key; Airwallex documents it as stable across retries. Delivery order is not guaranteed.",
    "Payments are linked by the PaymentIntent id and the PaymentAttempt id (payment_intent_id and payment_attempt_id on attempts, refunds and disputes). merchant_order_id may be reused and is never used for linking. The attempt id suffix pattern seen in examples is not documented and is not used.",
    "Older dispute webhooks (dispute_id, dispute_amount, status EVIDENCE_REQUIRED, stage DISPUTE) are read with their own values; which API version produces that shape is not documented.",
    "Documented payment_consent, payment_method, customer, payment_link, fraud and funds_split events are shown without lifecycle semantics. POS terminal events are not recognized.",
    "The x-signature header cannot be verified from pasted data, so a pasted webhook is never treated as authentic. Only the presence of the header is reported.",
    "Category and retry guidance per code are PandaPayLens suggestions; where Airwallex gives advice (for example retry later, or Merchant Advice Code 02: retry after 72 hours), the guidance follows it. Error messages are marked by Airwallex as subject to change and are never parsed.",
  ],
  samples: ["airwallex-card-lifecycle", "airwallex-declined"],
};
