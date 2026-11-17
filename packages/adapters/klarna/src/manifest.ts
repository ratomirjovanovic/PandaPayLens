import type { ProviderManifest } from "@pandapaylens/core";

export const KLARNA_ADAPTER_VERSION = "0.1.0";

export const klarnaManifest: ProviderManifest = {
  id: "klarna",
  displayName: "Klarna",
  version: KLARNA_ADAPTER_VERSION,
  wave: 5,
  researchStatus: "tested",
  categories: ["alternative_payment_method"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads built from the field tables and examples in Klarna's public API references and guides; not official examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "klarna.error_response",
      description:
        "Klarna Payments and Order Management error bodies ({ error_code, error_messages, correlation_id })",
      status: "limited",
    },
    {
      id: "klarna.payments_order",
      description:
        "Klarna Payments create order response ({ order_id, fraud_status, authorized_payment_method, redirect_url })",
      status: "limited",
    },
    {
      id: "klarna.order",
      description:
        "Order Management order (GET order) with status, fraud_status, amounts, captures and refunds",
      status: "limited",
    },
    {
      id: "klarna.capture",
      description: "Order Management Capture object (GET capture)",
      status: "limited",
    },
    {
      id: "klarna.refund",
      description: "Order Management Refund object (GET refund)",
      status: "limited",
    },
    {
      id: "klarna.hpp_status_callback",
      description: "Hosted Payment Page status callbacks ({ event_id, session })",
      status: "limited",
    },
    {
      id: "klarna.authorization_callback",
      description: "Klarna Payments authorization callback ({ authorization_token, session_id })",
      status: "limited",
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
      topic: "order-management-api",
      title: "Order Management API",
      url: "https://docs.klarna.com/acquirer/klarna/api/ordermanagement/",
    },
    {
      topic: "payments-api",
      title: "Klarna Payments API",
      url: "https://docs.klarna.com/acquirer/klarna/api/payments/",
    },
    {
      topic: "order-management-errors",
      title: "Error codes and messages for Order Management",
      url: "https://docs.klarna.com/acquirer/klarna/resources/developer-tools/error-handling/error-codes-and-messages-for-order-management/",
    },
    {
      topic: "payments-errors",
      title: "Error codes and messages for Klarna Payments",
      url: "https://docs.klarna.com/acquirer/klarna/resources/developer-tools/error-handling/error-codes-and-messages-for-klarna-payments/",
    },
    {
      topic: "errors",
      title: "Errors",
      url: "https://docs.klarna.com/acquirer/klarna/get-started/integration-resilience/errors/",
    },
    {
      topic: "retry-policy",
      title: "Escalation and retry policy",
      url: "https://docs.klarna.com/acquirer/klarna/get-started/integration-resilience/escalation-and-retry-policy/",
    },
    {
      topic: "create-order",
      title: "Create an order",
      url: "https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-sdk/step-3-create-an-order/",
    },
    {
      topic: "hpp-status-callbacks",
      title: "Hosted Payment Page status callbacks",
      url: "https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-hpp/api-documentation/status-callbacks/",
    },
    {
      topic: "authorization-callback",
      title: "Authorization callback",
      url: "https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/other-actions/authorization-callback/",
    },
  ],
  verifiedAt: "2026-11-17",
  delivery: {
    duplicateKey: "event_id (Hosted Payment Page status callbacks)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Record processed event_id values of status callbacks and skip repeats. Authorization callbacks are delivered at least once and carry no event id; make order creation idempotent per authorization. Base state on session.updated_at and on the order read from the Order Management API, not on arrival order.",
    docsUrl:
      "https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-hpp/api-documentation/status-callbacks/",
  },
  limitations: [
    "Pending order notifications (sent to merchant_urls.notification when fraud_status is PENDING) are not analyzed: the page that described their body and event names is no longer published, and no current page documents them.",
    "Klarna lists the order status values (AUTHORIZED, PART_CAPTURED, CAPTURED, CANCELLED, EXPIRED, CLOSED) without describing them. Stages and outcomes are PandaPayLens readings of the names and of the documented operations; CLOSED stays unknown.",
    "fraud_status REJECTED is listed without a description. An order with fraud_status PENDING is shown as pending and one with REJECTED as unknown.",
    "Error bodies carry no order id, so errors are not linked to orders. correlation_id identifies the failed request in Klarna's logs and is shown as an attribute only.",
    "NOT_FOUND, BAD_VALUE, BAD_REQUEST and INTERNAL_SERVER_ERROR are documented by both Klarna Payments and Order Management with different meanings. The body does not say which API answered; the HTTP status, when pasted, is used to choose between documented meanings.",
    "Klarna's retry policy covers Order Management only and depends on a Klarna-Idempotency-Key that a pasted body does not show, so server errors are never presented as safe to retry.",
    "Capture and refund creation answer HTTP 201 with the ids in headers and no body, so they cannot be analyzed. Capture and Refund objects from GET calls and the order's captures and refunds lists are analyzed.",
    "Bare Capture and Refund objects contain no order id and no currency; they link to an order only through the order's own captures and refunds lists.",
    "Refund objects have no status. A listed refund is shown as registered on the order; Klarna does not document when the customer receives the money.",
    "Order snapshots have no update time. The timeline uses captured_at and refunded_at for captures and refunds; the order itself keeps its source position.",
    "Hosted Payment Page session ids and authorization tokens are treated as sensitive and never copied, so status callbacks before an order exists, and authorization callbacks, are not linked to an order.",
    "Callbacks carry no signature. Klarna suggests a one-time secret in the callback URL; PandaPayLens does not verify the origin of any callback.",
    "merchant_reference1, merchant_reference2, reference and klarna_reference are merchant or customer-facing references and are never used for correlation.",
    "Klarna Network (v2) APIs and their signed webhooks, Kustom/Klarna Checkout, In-store, Settlements and Disputes are not covered.",
  ],
  samples: ["klarna-capture-not-allowed", "klarna-order-lifecycle"],
};
