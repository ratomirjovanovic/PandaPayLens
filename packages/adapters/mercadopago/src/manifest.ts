import type { ProviderManifest } from "@pandapaylens/core";

export const MERCADOPAGO_ADAPTER_VERSION = "0.1.0";

const D = "https://www.mercadopago.com.br/developers/en";

export const mercadopagoManifest: ProviderManifest = {
  id: "mercadopago",
  displayName: "Mercado Pago",
  version: MERCADOPAGO_ADAPTER_VERSION,
  wave: 5,
  researchStatus: "tested",
  categories: ["payment_facilitator", "card_processing"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads built from the Payments API reference field lists and the notification examples in Mercado Pago's public documentation, with PPLsynth references and synthetic numeric ids. Error bodies follow the body shape declared in Mercado Pago's official Node.js SDK. None is an official Mercado Pago example.",
  status: "limited",
  apiFamilies: [
    {
      id: "mercadopago.payment",
      description:
        "Payment objects from POST, GET and PUT /v1/payments, with status and status_detail",
      status: "limited",
    },
    {
      id: "mercadopago.refund",
      description: "Refund objects from POST and GET /v1/payments/{id}/refunds",
      status: "limited",
    },
    {
      id: "mercadopago.error_response",
      description:
        "Error bodies with status, error, message and cause, decoded by HTTP status only",
      status: "limited",
    },
    {
      id: "mercadopago.webhook",
      description:
        "Webhooks notifications for the payment topic (payment.created, payment.updated) and the topic_chargebacks_wh topic",
      status: "limited",
    },
    {
      id: "mercadopago.ipn",
      description: "IPN query parameters with topic=payment and id",
      status: "limited",
    },
    {
      id: "mercadopago.webhook.other",
      description:
        "Other Webhooks topics (merchant orders, claims, fraud alerts, Card Updater, subscriptions, Point)",
      status: "unsupported",
    },
    {
      id: "mercadopago.ipn.other",
      description: "IPN notifications for chargebacks, merchant_order and point_integration_ipn",
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
    {
      topic: "payment-object",
      title: "Get payment",
      url: `${D}/reference/online-payments/checkout-api-payments/get-payment/get`,
    },
    {
      topic: "payment-results",
      title: "Get payment status",
      url: `${D}/docs/checkout-api-payments/response-handling/query-results`,
    },
    {
      topic: "payment-creation-results",
      title: "Payment creation results",
      url: `${D}/docs/checkout-api-payments/response-handling/collection-results`,
    },
    {
      topic: "refunds",
      title: "Create refund",
      url: `${D}/reference/online-payments/checkout-api-payments/create-refund/post`,
    },
    {
      topic: "webhooks",
      title: "Webhooks",
      url: `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks`,
    },
    {
      topic: "ipn",
      title: "IPN",
      url: `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/ipn`,
    },
    {
      topic: "notifications-additional-info",
      title: "Additional information about notifications",
      url: `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/additional-info`,
    },
    {
      topic: "sdk-errors",
      title: "Node.js SDK error handling",
      url: "https://github.com/mercadopago/sdk-nodejs/blob/master/docs/error-handling.md",
    },
  ],
  verifiedAt: "2026-11-17",
  delivery: {
    duplicateKey:
      "none documented for payment notifications; identical notification bodies are treated as repeats",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Answer 200 or 201 within 22 seconds, or Mercado Pago retries every 15 minutes and later at longer intervals. Notifications carry no status: fetch GET /v1/payments/{id} and act on the payment's current status, not on the notification.",
    docsUrl: `${D}/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks`,
  },
  limitations: [
    "Webhooks and IPN notifications carry only the resource id, never the payment status, so their outcome is unknown. Fetch the payment to learn its state.",
    "No delivery or idempotency key is documented for payment notifications; repeats are recognized only by identical content. Delivery order is not documented.",
    "Webhook signatures (x-signature with x-request-id) are never verified: that needs the application's secret. IPN signatures cannot be validated at all. Both headers are treated as sensitive.",
    "Error bodies are decoded by HTTP status only. The Payments API reference lists numeric error values but not the body field that carries them, and the structure of cause items is not documented, so cause entries are counted, not interpreted.",
    "Rejections are decoded from status_detail. Category and retry classes are PandaPayLens judgments from the documented descriptions; Mercado Pago does not publish retry guidance per value. The issuer's own response code is not in the payment object.",
    "charged_back with status_detail settled or reimbursed is shown without an outcome because Mercado Pago does not say in whose favor it ended.",
    "Refund status descriptions in the reference are copies of the payment descriptions; refund authorized is left unknown.",
    "The topic_chargebacks_wh notification is read as a dispute signal for its payment_id; its actions values are not enumerated by Mercado Pago. Ids above 2^53 lose precision in JSON and are dropped.",
    "Other Webhooks topics (merchant orders, claims, fraud alerts, Card Updater, subscriptions, Point, Orders API) and IPN topics other than payment are recognized but not analyzed. The Orders API (/v1/orders) is not covered.",
    "Events are linked only by the payment id and the refund id. external_reference is merchant supplied and is never used to link events.",
    "Facts come from the Brazil developer site in English. Some numeric error codes have different meanings on other country sites.",
  ],
  samples: ["mercadopago-payment-lifecycle", "mercadopago-rejected-insufficient"],
};
