import type { ProviderManifest } from "@pandapaylens/core";

export const ADYEN_ADAPTER_VERSION = "0.2.0";

export const adyenManifest: ProviderManifest = {
  id: "adyen",
  displayName: "Adyen",
  version: ADYEN_ADAPTER_VERSION,
  wave: 0,
  status: "supported",
  apiFamilies: [
    {
      id: "adyen.webhook.standard",
      description: "Standard payment webhooks (notificationItems / NotificationRequestItem)",
      status: "supported",
    },
    {
      id: "adyen.payment_response",
      description: "Checkout payment responses with resultCode and pspReference",
      status: "supported",
    },
    {
      id: "adyen.api_error",
      description: "API error responses (status, errorCode, errorType, message)",
      status: "limited",
    },
    {
      id: "adyen.webhook.other",
      description: "Other webhook families (Balance Platform, Management, ...)",
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
    {
      topic: "webhook-types",
      title: "Webhook types",
      url: "https://docs.adyen.com/development-resources/webhooks/webhook-types",
    },
    {
      topic: "webhook-handling",
      title: "Handle webhook events",
      url: "https://docs.adyen.com/development-resources/webhooks/handle-webhook-events",
    },
    {
      topic: "refusal-reasons",
      title: "Refusal reasons",
      url: "https://docs.adyen.com/development-resources/refusal-reasons",
    },
    {
      topic: "result-codes",
      title: "Result codes",
      url: "https://docs.adyen.com/online-payments/build-your-integration/payment-result-codes",
    },
    {
      topic: "error-codes",
      title: "API error codes",
      url: "https://docs.adyen.com/development-resources/error-codes",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "eventCode and pspReference",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice: "Make sure your webhook handler deduplicates on eventCode + pspReference before acting.",
    docsUrl: "https://docs.adyen.com/development-resources/webhooks/handle-webhook-events",
  },
  limitations: [
    "API errors are categorized by errorType and HTTP status; individual errorCode values are not mapped yet.",
    "Only Standard payment webhooks are analyzed; other webhook families are recognized and explained.",
    "CAPTURE or REFUND with success=true means the request was processed, not that funds settled.",
  ],
  samples: [
    "adyen-authorised",
    "adyen-refused",
    "adyen-capture-refund",
    "adyen-duplicate-conflict",
    "adyen-retry-risk",
  ],
};
