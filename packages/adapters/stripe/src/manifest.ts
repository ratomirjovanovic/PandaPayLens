import type { ProviderManifest } from "@pandapaylens/core";

export const STRIPE_ADAPTER_VERSION = "0.2.0";

export const stripeManifest: ProviderManifest = {
  id: "stripe",
  displayName: "Stripe",
  version: STRIPE_ADAPTER_VERSION,
  wave: 0,
  researchStatus: "released",
  categories: ["payment_facilitator", "gateway"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads modelled on the provider's public documentation; not official examples.",
  status: "supported",
  apiFamilies: [
    {
      id: "stripe.api_error",
      description: "API error responses ({ error: { type, code, decline_code, advice_code } })",
      status: "supported",
    },
    {
      id: "stripe.payment_intent",
      description: "PaymentIntent object snapshots",
      status: "supported",
    },
    {
      id: "stripe.event.snapshot",
      description: "API v1 snapshot events for PaymentIntent, Charge, Refund and Dispute objects",
      status: "supported",
    },
    {
      id: "stripe.event.thin",
      description: "v2 thin events (no embedded object)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "supported",
    timeline: "supported",
    correlation: "supported",
    diagnosticRules: "supported",
  },
  documentation: [
    { topic: "error-codes", title: "Error codes", url: "https://docs.stripe.com/error-codes" },
    {
      topic: "decline-codes",
      title: "Decline codes",
      url: "https://docs.stripe.com/declines/codes",
    },
    { topic: "webhooks", title: "Webhooks", url: "https://docs.stripe.com/webhooks" },
    {
      topic: "lifecycle",
      title: "PaymentIntent lifecycle",
      url: "https://docs.stripe.com/payments/paymentintents/lifecycle",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event id",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Make sure your webhook handler is idempotent, for example by recording processed event ids.",
    docsUrl: "https://docs.stripe.com/webhooks#handle-duplicate-events",
  },
  limitations: [
    "Thin events are recognized but not analyzed; paste the related object snapshot instead.",
    "Event types outside PaymentIntent, Charge, Refund and Dispute are shown without lifecycle semantics.",
    "Event timestamps have one-second resolution.",
  ],
  samples: [
    "stripe-success",
    "stripe-insufficient-funds",
    "stripe-authentication-required",
    "stripe-duplicate-webhook",
    "stripe-out-of-order",
    "stripe-api-error",
    "stripe-state-inconsistency",
  ],
};
