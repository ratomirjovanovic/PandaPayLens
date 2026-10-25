import type { ProviderManifest } from "@pandapaylens/core";

export const CHECKOUT_ADAPTER_VERSION = "0.1.0";

export const checkoutManifest: ProviderManifest = {
  id: "checkout",
  displayName: "Checkout.com",
  version: CHECKOUT_ADAPTER_VERSION,
  wave: 1,
  status: "limited",
  apiFamilies: [
    {
      id: "checkout.api_error",
      description: "API error responses ({ request_id, error_type, error_codes[] })",
      status: "supported",
    },
    {
      id: "checkout.payment_response",
      description:
        "Unified Payments API request responses and payment details (pay_ id, status, approved, response_code)",
      status: "supported",
    },
    {
      id: "checkout.action_accepted",
      description: "Capture, refund and void accepted responses ({ action_id, reference, _links })",
      status: "limited",
    },
    {
      id: "checkout.webhook",
      description:
        "Workflows webhooks for gateway payment events (created_on envelope, or timestamp + source envelope)",
      status: "limited",
    },
    {
      id: "checkout.webhook.payment_setup",
      description: "Payment Setup API events (flat event_type / event_data envelope)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; the retry-risk and state
    // consistency rules have no Checkout.com-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "response-codes",
      title: "API response codes",
      url: "https://www.checkout.com/docs/developer-resources/codes/api-response-codes",
    },
    {
      topic: "error-codes",
      title: "Error codes",
      url: "https://www.checkout.com/docs/developer-resources/codes/error-codes",
    },
    {
      topic: "recommendation-codes",
      title: "Recommendation codes",
      url: "https://www.checkout.com/docs/developer-resources/codes/recommendation-codes",
    },
    {
      topic: "payments-api",
      title: "Accept a payment using the Payments API",
      url: "https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-using-the-payments-api",
    },
    {
      topic: "payment-details",
      title: "Get payment details",
      url: "https://www.checkout.com/docs/payments/manage-payments/get-payment-details",
    },
    {
      topic: "webhooks",
      title: "Receive webhooks",
      url: "https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks",
    },
    {
      topic: "resend-webhooks",
      title: "Resend webhooks",
      url: "https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks/resend-webhooks",
    },
    {
      topic: "event-types",
      title: "Event types",
      url: "https://www.checkout.com/docs/developer-resources/event-notifications/event-types",
    },
    {
      topic: "retries",
      title: "Retry a payment",
      url: "https://www.checkout.com/docs/payments/manage-payments/retry-a-payment",
    },
    {
      topic: "idempotency",
      title: "Idempotency",
      url: "https://www.checkout.com/docs/developer-resources/api/idempotency",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event id (evt_)",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Make your webhook handler idempotent: record processed event ids, and because it is not documented whether retries and manual resends keep the same event id, also check the payment id and action id before acting.",
    docsUrl:
      "https://www.checkout.com/docs/developer-resources/event-notifications/receive-webhooks",
  },
  limitations: [
    "Checkout.com documents at-least-once delivery and warns that manual resends may cause duplicates, but does not document whether a retried or resent webhook keeps the same evt_ id. Repeated deliveries are only recognized when they share the event id.",
    "Delivery order is not guaranteed and there is no sequence number. The timeline orders events by data.processed_on, then created_on or timestamp, then input order.",
    "Webhooks carry no payment status; the lifecycle state is inferred from the event type.",
    "Payment Setup events (flat event_type / event_data envelope) are recognized but not analyzed.",
    "Dispute, authentication, fraud and other non-gateway event types are shown without lifecycle semantics.",
    "Legacy (previous platform) payloads cannot be verified because that documentation is no longer published, so they are not recognized.",
    "Declines are decoded from response_code only; response_summary text varies between endpoints and is not used for decoding.",
    "The error_type list is incomplete in the documentation, and error codes for captures, refunds and voids beyond the /payments list are not documented.",
    "Capture, refund and void accepted (202) responses do not say which action was requested, and a 202 does not confirm that the action succeeded.",
    "Mastercard merchant advice codes other than the documented retry-after codes (24 to 30) are shown but not interpreted.",
    "Category and retry guidance per code are PandaPayLens suggestions; only the soft/hard/risk classification, Smart Dunning and downtime-retry eligibility, 3DS retry codes and recommendation codes are Checkout.com retry signals.",
    "Webhook signatures (Cko-Signature) cannot be verified from pasted payloads.",
  ],
  samples: ["checkout-declined", "checkout-capture-refund"],
};
