import type { ProviderManifest } from "@pandapaylens/core";

export const PADDLE_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://developer.paddle.com";

export const paddleManifest: ProviderManifest = {
  id: "paddle",
  displayName: "Paddle",
  version: PADDLE_ADAPTER_VERSION,
  wave: 5,
  researchStatus: "tested",
  // Paddle describes itself as a merchant of record (get-started/how-paddle-works)
  // and documents card and alternative payment methods (concepts/payment-methods).
  categories: ["merchant_account_intermediary", "card_processing", "alternative_payment_method"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Shapes follow the schemas and examples on developer.paddle.com (webhook event pages, error reference, entity responses) and Paddle's published OpenAPI file, with synthetic values. None is an official Paddle example.",
  status: "limited",
  apiFamilies: [
    {
      id: "paddle.notification",
      description:
        "Paddle Billing webhook notifications and events (event_id, event_type, occurred_at, notification_id, data) for transactions, adjustments and subscriptions",
      status: "limited",
    },
    {
      id: "paddle.entity",
      description:
        "Paddle Billing API entity responses ({ data, meta }) for a transaction, an adjustment or a subscription",
      status: "limited",
    },
    {
      id: "paddle.error",
      description:
        "Paddle Billing API error responses (error.type, error.code, error.detail, error.documentation_url, meta.request_id)",
      status: "limited",
    },
    {
      id: "paddle.list",
      description: "Paddle Billing API list responses ({ data: [...], meta.pagination })",
      status: "unsupported",
    },
    {
      id: "paddle.classic",
      description: "Paddle Classic API responses and webhooks",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "error-codes", title: "Errors", url: `${DOCS}/api-reference/about/errors` },
    { topic: "error-reference", title: "Error reference", url: `${DOCS}/errors` },
    {
      topic: "responses",
      title: "Success responses",
      url: `${DOCS}/api-reference/about/success-responses`,
    },
    {
      topic: "webhooks",
      title: "How webhooks work",
      url: `${DOCS}/webhooks/about/how-webhooks-work`,
    },
    {
      topic: "webhook-delivery",
      title: "Handle webhook delivery",
      url: `${DOCS}/webhooks/about/respond-to-webhooks`,
    },
    {
      topic: "webhook-signature",
      title: "Verify webhook signatures",
      url: `${DOCS}/webhooks/about/signature-verification`,
    },
    {
      topic: "lifecycle",
      title: "transaction.payment_failed (transaction schema and payment attempt codes)",
      url: `${DOCS}/webhooks/transactions/transaction-payment-failed`,
    },
    {
      topic: "transactions",
      title: "Get a transaction",
      url: `${DOCS}/api-reference/transactions/get-transaction`,
    },
    {
      topic: "adjustments",
      title: "adjustment.created",
      url: `${DOCS}/webhooks/adjustments/adjustment-created`,
    },
    {
      topic: "subscriptions",
      title: "Get a subscription",
      url: `${DOCS}/api-reference/subscriptions/get-subscription`,
    },
  ],
  verifiedAt: "2026-11-17",
  delivery: {
    duplicateKey: "event_id",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Paddle delivers at least once and retries when it gets no 200 within five seconds (live accounts: up to 60 attempts over about two days). Store processed event_id values and skip repeats; order events by occurred_at, not by arrival.",
    docsUrl: `${DOCS}/webhooks/about/how-webhooks-work`,
  },
  limitations: [
    "Webhook signatures (Paddle-Signature) cannot be verified offline; only the header's presence is reported.",
    "Only transaction, adjustment and subscription entities are analyzed. Other event types (customers, addresses, businesses, prices, products, payouts and others) are listed by name without analysis. List responses and Paddle Classic payloads are not analyzed.",
    "87 documented API error codes are catalogued: all generic and adjustment codes and the payment-relevant transaction and subscription codes. Other codes are reported as unknown with insufficient confidence, keeping Paddle's detail and documentation link.",
    "Payment attempt error codes are decoded from payments[].error_code. In webhooks only transaction.payment_failed is decoded, for its newest attempt; other transaction events show the newest attempt's code as an attribute. API snapshots decode every failed attempt.",
    "A past_due transaction or subscription is shown as pending (overdue), not failed: invoices become past due without a failed attempt, and renewals stay collectable during payment recovery.",
    "The transaction status is not the outcome of one payment attempt: transaction.payment_failed can carry a ready transaction. The event type and the newest attempt decide the outcome.",
    "An approved refund adjustment is shown as a successful refund adjustment; Paddle does not document when the funds reach the customer. Credits are not treated as refunds.",
    "Chargeback adjustments (chargeback, chargeback_warning and their reversals) are shown as disputes with an unknown outcome; their statuses are not documented for the merchant's position.",
    "Subscription ids span many transactions. Subscription events are grouped with each other and, through transaction_id on subscription.created, with the first transaction; renewal transactions stay separate.",
    "The time a payment attempt failed is not documented; attempt events use captured_at or created_at.",
    "Provider-specific diagnostic rules do not cover Paddle yet; only the generic rules apply.",
  ],
  samples: ["paddle-payment-failed", "paddle-refund-lifecycle"],
};
