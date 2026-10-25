import type { ProviderManifest } from "@pandapaylens/core";

export const PAYPAL_ADAPTER_VERSION = "0.1.0";

export const paypalManifest: ProviderManifest = {
  id: "paypal",
  displayName: "PayPal",
  version: PAYPAL_ADAPTER_VERSION,
  wave: 1,
  status: "limited",
  apiFamilies: [
    {
      id: "paypal.api_error",
      description:
        "Orders v2 and Payments v2 REST error responses (name, message, debug_id, details[].issue)",
      status: "supported",
    },
    {
      id: "paypal.order",
      description:
        "Orders v2 order resources, with captures, authorizations and refunds per purchase unit",
      status: "supported",
    },
    {
      id: "paypal.payment_resource",
      description: "Payments v2 capture, authorization and refund resources",
      status: "supported",
    },
    {
      id: "paypal.webhook",
      description:
        "Webhook event envelopes for CHECKOUT.ORDER.*, CHECKOUT.PAYMENT-APPROVAL.* and PAYMENT.* (v2)",
      status: "limited",
    },
    {
      id: "paypal.webhook.verify_request",
      description:
        "verify-webhook-signature request bodies (the embedded webhook_event is analyzed; signature data is ignored)",
      status: "limited",
    },
    {
      id: "paypal.webhook.subscription",
      description: "Subscription webhooks (BILLING.SUBSCRIPTION.*)",
      status: "unsupported",
    },
    {
      id: "paypal.oauth_error",
      description: "OAuth token errors ({ error, error_description })",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "orders-errors",
      title: "Orders v2 error messages",
      url: "https://developer.paypal.com/api/rest/reference/orders/v2/errors/",
    },
    {
      topic: "responses",
      title: "REST API responses (HTTP status codes)",
      url: "https://developer.paypal.com/api/rest/responses/",
    },
    {
      topic: "errors-overview",
      title: "Common errors overview",
      url: "https://developer.paypal.com/api/errors/overview",
    },
    {
      topic: "orders-api",
      title: "Orders v2 API",
      url: "https://developer.paypal.com/api/orders/v2",
    },
    {
      topic: "payments-api",
      title: "Payments v2 API",
      url: "https://developer.paypal.com/api/payments/v2",
    },
    {
      topic: "processor-response",
      title: "Processor response codes",
      url: "https://developer.paypal.com/api/orders/v2/definitions/processor_response",
    },
    {
      topic: "webhook-events",
      title: "Webhook event names",
      url: "https://developer.paypal.com/api/rest/webhooks/event-names/",
    },
    {
      topic: "webhooks",
      title: "Webhooks",
      url: "https://developer.paypal.com/api/rest/webhooks/",
    },
    {
      topic: "idempotency",
      title: "Idempotency (PayPal-Request-Id)",
      url: "https://developer.paypal.com/api/rest/reference/idempotency/",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "webhook event id",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Deduplicate on the webhook event id (WH-...) before acting. PayPal retries a delivery that did not get a 2xx response up to 25 times over 3 days, and deliveries can be resent manually.",
    docsUrl: "https://developer.paypal.com/api/rest/webhooks/",
  },
  limitations: [
    "An order with status COMPLETED is not treated as paid: the payment outcome comes from purchase_units[].payments.captures[].status, authorizations or PAYMENT.* events.",
    "Order approval (APPROVED, CHECKOUT.ORDER.APPROVED) is shown as pending: no money has moved until a capture.",
    "Webhook ordering and duplicate delivery are not documented by PayPal; duplicates are recognized by the event id only.",
    "The resource shape of CHECKOUT.ORDER.* webhooks has no official sample: only the order id, status and amount are used, and embedded payments are not expanded.",
    "Whether PAYMENT.CAPTURE.REFUNDED and PAYMENT.CAPTURE.REVERSED carry a refund or a capture resource is not documented; the resource kind is inferred from its fields.",
    "PAYMENT.CAPTURE.DECLINED and PAYMENT.CAPTURE.DENIED are both treated as capture failures, because PayPal's documentation uses both names.",
    "resource_type values other than capture are not documented and are not used.",
    "A refund is linked to its capture through supplementary_data.related_ids.capture_id or the rel=up link; PayPal publishes no sample of this linkage.",
    "Merchant references (invoice_id, custom_id, reference_id) are not used for correlation and are not copied, because they can be reused and may contain personal data.",
    "Category and retry guidance are PandaPayLens proposals; PayPal publishes none. Unknown issue names are reported as unknown.",
    "processor_response.response_code meanings are one-word tokens; their categories are inferred. payment_advice_code depends on the card network and is shown without interpretation.",
    "When an error has several details[] entries, the first issue is decoded; PayPal does not document an order or priority.",
    "Webhook signatures cannot be verified offline; a pasted payload is never proof that it came from PayPal.",
    "Subscriptions (BILLING.SUBSCRIPTION.*) and OAuth token errors are recognized but not analyzed. Disputes, payouts, legacy v1 payments and NVP/SOAP are not supported; their events appear as unknown event types.",
  ],
  samples: ["paypal-completed-declined", "paypal-instrument-declined", "paypal-webhook-lifecycle"],
};
