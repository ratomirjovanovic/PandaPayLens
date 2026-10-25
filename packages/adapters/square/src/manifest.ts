import type { ProviderManifest } from "@pandapaylens/core";

export const SQUARE_ADAPTER_VERSION = "0.1.0";

export const squareManifest: ProviderManifest = {
  id: "square",
  displayName: "Square",
  version: SQUARE_ADAPTER_VERSION,
  wave: 1,
  researchStatus: "released",
  categories: ["payment_facilitator", "card_processing"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads modelled on the provider's public documentation; not official examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "square.error_response",
      description:
        "Payments and Refunds API error responses ({ errors: [{ category, code, detail, field }] }), optionally with the FAILED payment or refund",
      status: "supported",
    },
    {
      id: "square.payment",
      description: "Payment objects, bare or wrapped as { payment: {...} }",
      status: "supported",
    },
    {
      id: "square.refund",
      description: "PaymentRefund objects, bare or wrapped as { refund: {...} }",
      status: "supported",
    },
    {
      id: "square.webhook",
      description:
        "payment.created, payment.updated, refund.created and refund.updated webhook events",
      status: "supported",
    },
    {
      id: "square.webhook.other",
      description: "Other webhook event families (for example dispute.* or payout.*)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "supported",
    timeline: "limited",
    correlation: "limited",
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "error-codes",
      title: "ErrorCode",
      url: "https://developer.squareup.com/reference/square/enums/ErrorCode",
    },
    {
      topic: "error-categories",
      title: "ErrorCategory",
      url: "https://developer.squareup.com/reference/square/enums/ErrorCategory",
    },
    {
      topic: "handling-errors",
      title: "Handling errors",
      url: "https://developer.squareup.com/docs/build-basics/handling-errors",
    },
    {
      topic: "payments-error-codes",
      title: "Payments API error codes",
      url: "https://developer.squareup.com/docs/payments-api/error-codes",
    },
    {
      topic: "payment-object",
      title: "Payment",
      url: "https://developer.squareup.com/reference/square/objects/Payment",
    },
    {
      topic: "refund-object",
      title: "PaymentRefund",
      url: "https://developer.squareup.com/reference/square/objects/PaymentRefund",
    },
    {
      topic: "webhooks",
      title: "Webhooks overview",
      url: "https://developer.squareup.com/docs/webhooks/overview",
    },
    {
      topic: "webhook-events",
      title: "Webhook events reference",
      url: "https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event_id",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Record processed event_id values and skip repeats before acting on a notification. Base state on the object's updated_at, not on arrival order.",
    docsUrl: "https://developer.squareup.com/docs/webhooks/overview",
  },
  limitations: [
    "Square does not document which ErrorCategory each ErrorCode belongs to. The category is read from the payload; PandaPayLens category and retry mappings are derived from the documented code descriptions.",
    "Retry guidance is official only for RATE_LIMITED and TEMPORARY_ERROR. All other retry classes are PandaPayLens judgments.",
    "Unknown ErrorCode values fall back to the payload's category with lower confidence, then to unknown.",
    "card_details.status values (AUTHORIZED, CAPTURED, VOIDED, FAILED) are shown as provider status only. Square does not document their per-value meaning.",
    "Webhook delivery order is not guaranteed. The timeline uses the object's updated_at, then the event's created_at. A single payload holds only the current snapshot of the object, not its history.",
    "Webhook signatures (x-square-hmacsha256-signature) are not verified: that needs the subscription signature key and notification URL. The header is treated as sensitive.",
    "Events are linked only by the payment id and refund.payment_id (and the refund id between refund events). order_id links to the Orders API and is not documented as unique per payment attempt, and reference_id is caller-supplied, so neither is used for correlation.",
    "In Square's documented payment.created example, data.id differs from the payment id. PandaPayLens uses the payment's own id and falls back to data.id only when the payment id is missing.",
    "idempotency_key is not echoed in responses, so an error response can only be linked to a payment when it includes the payment or refund object.",
    "No documented example shows an error response that includes the FAILED payment or refund. This shape is supported from the documented rule and tested with synthetic data.",
    "The refund webhook object's version field is not in the PaymentRefund reference. It is shown as an attribute only.",
    "Square does not expose the issuer's raw decline code; only Square's own error code is available.",
    "Webhook families other than payment.* and refund.* (for example dispute.* or payout.*) are recognized but not analyzed. Disputes, Terminal, Orders and the legacy v1 APIs are not covered.",
    "HTTP status is documented only for some codes, and documentation is inconsistent for PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE (400 vs 404), so the HTTP status is not used for classification.",
  ],
  samples: ["square-declined", "square-webhook-lifecycle"],
};
