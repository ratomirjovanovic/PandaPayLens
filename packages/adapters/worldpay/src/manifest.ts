import type { ProviderManifest } from "@pandapaylens/core";

export const WORLDPAY_ADAPTER_VERSION = "0.1.0";

const ACCESS = "https://docs.worldpay.com/access/products";

export const worldpayManifest: ProviderManifest = {
  id: "worldpay",
  displayName: "Worldpay",
  version: WORLDPAY_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Not claimed: orchestration (Worldpay's "orchestrated" Payments API wraps its
  // own fraud, 3DS and token modules), wallet, payment_facilitator and
  // merchant_account_intermediary.
  categories: ["acquiring", "gateway", "card_processing", "alternative_payment_method"],
  sectors: [],
  regions:
    'Worldpay states that "All payment features are subject to regional availability"; WPG is documented as globally available. Several Access features are Enterprise only versus SMB (Worldpay eCommerce). Financial services data (MCC 6012/6051) is required for providers in the Visa Europe region. Refusal code 13 also covers monthly gambling limits (Europe EUR 50,000; Azerbaijan, Moldova and Ukraine EUR 10,000). Card Payments v7 reversals refund US entities one day after the request and others after 15 minutes.',
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers, shaped after the public Access Worldpay OpenAPI files (Payments API 2024-06-01, Card Payments v7, Payment Queries v1, Events v1) and the webhook examples of the hosted payment pages and online refunds pages. Event ids are not UUIDs so that they can carry the PPLsynth marker. None is an official Worldpay example.",
  status: "limited",
  apiFamilies: [
    {
      id: "worldpay.event",
      description:
        "Access Events v1 webhooks (eventId, eventTimestamp, eventDetails) for payment, card payout and chargeback classifications, including tokenCreated",
      status: "limited",
    },
    {
      id: "worldpay.payment_response",
      description:
        "Payments API (WP-Api-Version 2024-06-01) and Card Payments v7 responses (outcome, paymentId, commandId, refusalCode, gatewayRefusalCode, advice.code); Card Payments v6 field names are read as aliases",
      status: "supported",
    },
    {
      id: "worldpay.error",
      description:
        "Shared Access Worldpay error body (errorName, message, validationErrors[].jsonPath, headerName)",
      status: "supported",
    },
    {
      id: "worldpay.payment_query",
      description:
        "Payment Queries v1 payment details (lastEvent and the events[] history with timestamps, codes and error names)",
      status: "limited",
    },
    {
      id: "worldpay.card_payments_events_query",
      description: "Deprecated Card Payments v7 events query (Title Case lastEvent)",
      status: "limited",
    },
    {
      id: "worldpay.apms",
      description:
        "APMs API responses, read only through the shared outcome field (pending, sentForAuthorization and others)",
      status: "limited",
    },
    {
      id: "worldpay.account_payouts_webhook",
      description: "Account payouts webhooks (PaymentOutNotification); not analyzed",
      status: "unsupported",
    },
    {
      id: "worldpay.wpg",
      description:
        "WPG (Worldwide Payment Gateway) paymentService XML replies and order notifications; XML input is not supported",
      status: "unsupported",
    },
    {
      id: "worldpay.cnpapi",
      description: "cnpAPI (formerly Vantiv eCommerce) XML; XML input is not supported",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    // Parsing covers all 26 documented event types, but the webhook timestamp
    // has no time zone, the refused event has no reason and the amount
    // exponent is only documented as 2.
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Worldpay-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "refusal-codes",
      title: "Refusal codes and refusal advice codes",
      url: `${ACCESS}/reference/refusal-response`,
    },
    {
      topic: "scheme-codes",
      title: "Raw scheme response codes",
      url: `${ACCESS}/reference/refusal-response/scheme-codes`,
    },
    {
      topic: "errors",
      title: "Worldpay error responses",
      url: `${ACCESS}/reference/worldpay-error-responses`,
    },
    { topic: "api-principles", title: "API principles", url: `${ACCESS}/reference/api-principles` },
    { topic: "payments-api", title: "Payments API", url: `${ACCESS}/payments` },
    {
      topic: "payments-api-reference",
      title: "Payments API reference (2024-06-01)",
      url: `${ACCESS}/payments/openapi`,
    },
    {
      topic: "card-payments-reference",
      title: "Card Payments API reference (v7)",
      url: `${ACCESS}/card-payments/openapi`,
    },
    {
      topic: "card-payments-v7-migration",
      title: "Card Payments v7 migration guide",
      url: `${ACCESS}/card-payments/v7-migration-guide`,
    },
    {
      topic: "manage-payments",
      title: "Manage card payments (settle, cancel, refund, reverse)",
      url: `${ACCESS}/card-payments/manage-payments`,
    },
    {
      topic: "online-refunds",
      title: "Online refunds",
      url: `${ACCESS}/card-payments/features/online-refunds`,
    },
    {
      topic: "payment-queries",
      title: "Payment Queries API reference (v1)",
      url: `${ACCESS}/payment-queries/openapi`,
    },
    { topic: "webhooks", title: "Events (webhooks)", url: `${ACCESS}/events` },
    {
      topic: "webhook-events",
      title: "Events API reference (v1)",
      url: `${ACCESS}/events/openapi`,
    },
    { topic: "webhook-signature", title: "Event signature", url: `${ACCESS}/events/signature` },
    {
      topic: "hpp-webhooks",
      title: "Hosted payment pages webhooks",
      url: `${ACCESS}/hosted-payment-pages/webhooks`,
    },
    { topic: "testing", title: "Payments API testing values", url: `${ACCESS}/payments/testing` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "eventId",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Worldpay retries an event until it receives HTTP 200, for up to one week, but does not document whether a retried delivery keeps its eventId or in which order events arrive. Record processed eventIds, and also check the payment's current state (Payment Queries) before acting on an event.",
    docsUrl: `${ACCESS}/events`,
  },
  limitations: [
    "Only Access Worldpay JSON is analyzed. WPG (paymentService XML, order notifications) and cnpAPI (XML) are documented by Worldpay but XML input is not supported. Account payouts webhooks (PaymentOutNotification) and Event Notifications (limited beta, format not documented) are not analyzed.",
    "No merchant sectors are listed: Worldpay publishes no list of accepted sectors. Its sector pages (financial services MCC 6012/6051, crypto ramp providers, airline, lodging and purchasing Level 2/3 data) and the gambling limit footnote are integration requirements, not eligibility statements.",
    "refusalCode carries the Worldpay refusal code by default, but the raw scheme or acquirer code when the merchant is configured for raw codes. Card Payments v7 then adds gatewayRefusalCode with the Worldpay code, and Card Payments v6 used separate code and rawCode fields. The Payments API has no such field, so a lone refusalCode is read as a Worldpay code, with possible confidence when the raw tables give it a different meaning (for example 55, 63 or Amex 106). Zero-padded and alphanumeric codes (05, 1A, N7) are read as raw codes.",
    "The scheme of a raw code is not taken from the payload, so a raw code with different meanings per scheme (for example 51 is a generic decline for Discover) is decoded with possible confidence and all scheme readings are shown. Worldpay notes that raw codes from third-party acquirers may not be listed at all.",
    "The refused webhook carries no refusal code or description. The reason is only in the synchronous response, in Payment Queries (events[].code) or, for refunds, in refundFailed refund.refusal.",
    "Webhook eventTimestamp values carry no time zone, so they are shown as sent and are not used as event time; webhook events follow the input order. Synchronous responses carry no timestamp. Payment Queries timestamps (ISO 8601 with Z) and tokenCreated createdAt are used as event time.",
    "eventId is used as the delivery key. Worldpay retries unacknowledged events for up to one week, but whether a retry keeps the same eventId and the delivery order are not documented.",
    "Webhook amounts are documented as whole numbers with an exponent of 2. They are used as minor units only for currencies whose ISO 4217 exponent is 2; for other currencies the value is shown as supplied. Response amounts (amounts.requested, amounts.totalAuthorized) are shown as attributes and Payment Queries amounts are not read.",
    "Payments are linked by paymentId, by transactionReference (documented as identifying a payment throughout its lifecycle) and by commandId. sentForAuthorization, error, settled, cancelled, expired, refunded and the payout and chargeback events carry no paymentId, and Card Payments v7 responses carry no transactionReference, so a v7 response joins those events only through another record that carries both keys. A transactionReference reused by the merchant for several payments would join them. orderReference may be reused and is never used for linking.",
    "An outcome of sentForSettlement on an authorization request (automatic settlement) is shown as a capture request; the implied authorization is not shown as a separate event. Settle, cancel, refund and reversal requests answer HTTP 202, which confirms receipt only.",
    "Card chargebacks are limited to informationRequested in Access webhooks (chargedBack is Klarna only). Card Payments v7 reversals are processed as a cancel or a refund and have no webhook of their own.",
    "settled, settlementFailed, refunded and informationRequested are sent only in certain use cases, and event availability differs by business type, so a missing event does not mean the step did not happen.",
    "Payment Queries is read for one payment (GET /paymentQueries/payments/{paymentId}); list responses are not analyzed. The Card Payments events query is deprecated and can lag up to 15 minutes.",
    "APM responses are read only through the shared outcome field; APM lastEvent values (dispute and other states) are not analyzed.",
    "The Event-Signature header and the mutual TLS check cannot be verified from pasted data, so a pasted webhook is never treated as authentic. Only the presence of the header is reported.",
    "Refusal codes 17, 29 and 38 appear only on Worldpay's testing pages and are decoded with possible confidence. Codes 63, 85, 605 and other codes with contradicting documented texts are decoded as unknown with manual review.",
    "Error responses without a JSON errorName body (for example a bare HTTP status or a plain-text body) are not recognized.",
    "Category and retry guidance per code are PandaPayLens suggestions. Worldpay's own retry signals are the refusal advice codes (Mastercard and Maestro only), the Visa categories of raw codes, and the guidance that 4xx requests can be retried once fixed while 5xx errors are server-side, most commonly timeouts.",
  ],
  samples: ["worldpay-card-lifecycle", "worldpay-raw-refusal"],
};
