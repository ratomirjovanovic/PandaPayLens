import type { ProviderManifest } from "@pandapaylens/core";

export const MOLLIE_ADAPTER_VERSION = "0.1.0";

export const mollieManifest: ProviderManifest = {
  id: "mollie",
  displayName: "Mollie",
  version: MOLLIE_ADAPTER_VERSION,
  wave: 1,
  status: "limited",
  apiFamilies: [
    {
      id: "mollie.payment",
      description:
        "Payments API v2 payment objects (resource: payment), as returned by GET /v2/payments/{id}",
      status: "supported",
    },
    {
      id: "mollie.refund",
      description: "Refund objects (resource: refund)",
      status: "supported",
    },
    {
      id: "mollie.chargeback",
      description: "Chargeback objects (resource: chargeback)",
      status: "supported",
    },
    {
      id: "mollie.capture",
      description: "Capture objects (resource: capture)",
      status: "supported",
    },
    {
      id: "mollie.error",
      description:
        "Payments API v2 error responses (status, title, detail, field, _links.documentation)",
      status: "limited",
    },
    {
      id: "mollie.event",
      description:
        "Next-gen webhook events with the full payload (resource: event, _embedded.entity)",
      status: "experimental",
    },
    {
      id: "mollie.event.simple",
      description: "Next-gen webhook events with the simple payload (no embedded entity)",
      status: "unsupported",
    },
    {
      id: "mollie.webhook.classic",
      description: "Classic webhooks (form-encoded id=<resource id>, nothing else)",
      status: "unsupported",
    },
    {
      id: "mollie.orders",
      description: "Orders API v2 objects (no longer recommended by Mollie)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "error-codes",
      title: "Handling errors",
      url: "https://docs.mollie.com/reference/handling-errors",
    },
    {
      topic: "failure-reasons",
      title: "Extra payment parameters (details.failureReason)",
      url: "https://docs.mollie.com/reference/extra-payment-parameters",
    },
    {
      topic: "lifecycle",
      title: "Handling payment status",
      url: "https://docs.mollie.com/docs/handling-payment-status",
    },
    {
      topic: "payment-object",
      title: "Get payment",
      url: "https://docs.mollie.com/reference/get-payment",
    },
    { topic: "webhooks", title: "Webhooks", url: "https://docs.mollie.com/reference/webhooks" },
    {
      topic: "webhooks-next-gen",
      title: "Next-gen webhooks",
      url: "https://docs.mollie.com/reference/webhooks-new",
    },
    { topic: "refunds", title: "Refunds", url: "https://docs.mollie.com/docs/refunds" },
    {
      topic: "idempotency",
      title: "API idempotency",
      url: "https://docs.mollie.com/reference/api-idempotency",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event id (next-gen webhooks)",
    // Mollie documents retries (only 200 OK counts, 15 s timeout, 10 attempts
    // over 26 h) but does not state in so many words that a notification can
    // arrive more than once.
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Mollie retries a webhook until it receives 200 OK within 15 seconds (up to 10 attempts over 26 hours), so a slow handler can receive the same event again. Record processed event ids and always fetch the current object before acting.",
    docsUrl: "https://docs.mollie.com/reference/webhooks-new",
  },
  limitations: [
    "Classic webhooks (form-encoded id=tr_...) carry only an identifier: no status, amount, time or signature. They are recognized but not analyzed; paste the GET /v2/payments/{id} response for that id instead.",
    "Next-gen simple payloads carry no entity and are recognized but not analyzed. Full payloads are experimental: Mollie publishes no complete payment event envelope example, many event types are beta, and Mollie still recommends classic webhooks for payments.",
    "Mollie API errors have no machine-readable error code. They are classified by HTTP status and field only; detail is free text and not used for classification, so 422 account suspension and 400 idempotency-key misuse cannot be told apart from other 422 and 400 errors.",
    "details.failureReason is card-only and optional (the documented failed-payment example has none). Its 15 values are documented without descriptions, so explanations are derived from the code names.",
    "statusReason (point-of-sale), SEPA bankReasonCode and chargeback reason codes are not decoded.",
    "A payment object is a snapshot, not an event log. Timeline points come only from timestamps present on it (createdAt, authorizedAt, paidAt, canceledAt, expiredAt, failedAt) and are labeled as derived from the snapshot. A pending status is never timestamped; expiresAt and captureBefore are deadlines, not events.",
    "Lifecycle points derived from snapshots are not deliveries. When several snapshots are supplied, the generic out-of-order rule can still report them as arriving out of order (with possible confidence only).",
    "Refunds and captures only have createdAt, so the time of their status changes is not available. Chargebacks have no status; received and reversed are taken from createdAt and reversedAt.",
    "Embedded refunds, chargebacks and captures (?embed=...) are read defensively because the shape of _embedded is not documented in the payment response schema.",
    "Mollie does not state explicitly that a retried next-gen delivery reuses the event id; PandaPayLens uses the event id as the delivery key. Snapshots have no delivery key.",
    "Signature headers (X-Mollie-Signature) cannot be verified without the signing secret; only their presence is reported.",
    "Orders API objects, API v1 payloads and HAL list responses are not analyzed.",
    "Provider-specific diagnostic rules (state inconsistency, retry risk) do not cover Mollie yet; only the generic rules apply.",
  ],
  samples: ["mollie-failed", "mollie-lifecycle", "mollie-classic-webhook"],
};
