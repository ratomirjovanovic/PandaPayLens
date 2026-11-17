import type { ProviderManifest } from "@pandapaylens/core";

export const GOCARDLESS_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.gocardless.com/docs";

export const gocardlessManifest: ProviderManifest = {
  id: "gocardless",
  displayName: "GoCardless",
  version: GOCARDLESS_ADAPTER_VERSION,
  wave: 5,
  researchStatus: "tested",
  categories: ["alternative_payment_method"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads modelled on the field tables and examples in the provider's public API reference; not official examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "gocardless.api_error",
      description:
        "Pro API error responses ({ error: { type, code, message, request_id, errors[] } })",
      status: "limited",
    },
    {
      id: "gocardless.events",
      description:
        "Webhook body or GET /events list response ({ events: [...] }) with payment, mandate, refund, payout and subscription events",
      status: "limited",
    },
    {
      id: "gocardless.event",
      description: "A single event object, or the GET /events/{id} response ({ events: { ... } })",
      status: "limited",
    },
    {
      id: "gocardless.payment",
      description: "Payment resource response ({ payments: { ... } })",
      status: "supported",
    },
    {
      id: "gocardless.refund",
      description: "Refund resource response ({ refunds: { ... } })",
      status: "supported",
    },
    {
      id: "gocardless.other_resources",
      description:
        "Mandate, payout, subscription, billing request and other resource responses (not analyzed)",
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
      topic: "error-codes",
      title: "Responses and errors",
      url: `${DOCS}/api-reference/responses-and-errors`,
    },
    { topic: "webhooks", title: "Webhooks reference", url: `${DOCS}/api-reference/webhooks` },
    { topic: "events", title: "Event", url: `${DOCS}/api-reference/event` },
    { topic: "event-types", title: "Event types", url: `${DOCS}/api-reference/events` },
    {
      topic: "payment-events",
      title: "Payment event types",
      url: `${DOCS}/api-reference/events/payment`,
    },
    {
      topic: "mandate-events",
      title: "Mandate event types",
      url: `${DOCS}/api-reference/events/mandate`,
    },
    {
      topic: "refund-events",
      title: "Refund event types",
      url: `${DOCS}/api-reference/events/refund`,
    },
    {
      topic: "payout-events",
      title: "Payout event types",
      url: `${DOCS}/api-reference/events/payout`,
    },
    {
      topic: "subscription-events",
      title: "Subscription event types",
      url: `${DOCS}/api-reference/events/subscription`,
    },
    { topic: "payment-object", title: "Payment", url: `${DOCS}/api-reference/payment` },
    { topic: "refunds", title: "Refund", url: `${DOCS}/api-reference/refund` },
    {
      topic: "idempotency",
      title: "Limits and safeguards",
      url: `${DOCS}/api-reference/limits`,
    },
  ],
  verifiedAt: "2026-11-17",
  delivery: {
    duplicateKey: "event id (events[].id)",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "GoCardless delivers each event at least once and the same event can appear in more than one webhook. Record processed event ids (not meta.webhook_id, which identifies the delivery attempt) and fetch the current resource before acting.",
    docsUrl: `${DOCS}/api-reference/webhooks`,
  },
  limitations: [
    "Only payment, mandate, refund, payout and subscription events are interpreted. Events for billing requests, instalment schedules, creditors, customers, exports, outbound payments and other resource types are recognized but shown as unknown event types.",
    "Bank reason codes (details.reason_code) are scheme and bank specific and are not decoded; GoCardless advises using details.cause instead. The reason code is shown as an attribute only.",
    "details.cause values are decoded for failed and cancelled payments, failed and cancelled mandates and failed refunds. One cause can stand for several different bank reports, so explanations are general. Causes outside the documented tables (for example bank_account_disabled, which appears only in documentation examples) stay unknown.",
    "Event times are when GoCardless created the event. Event creation is asynchronous, so the time can lag the underlying change.",
    "Refund events carry only the refund id; GoCardless does not document a payment link on them. A refund event is linked to its payment only when the refund resource (with links.payment) is supplied as well.",
    "Mandate, payout and subscription events are grouped by their own id only. A payment's mandate, payout or subscription is never used to link payments, so events of different payments under one mandate stay apart.",
    "Mandate, payout and subscription resource responses are not analyzed; paste their events instead.",
    "A payment or refund response is a snapshot. Its created_at is when the resource was created, not when the current status was reached, so it is not used as the event time.",
    "Webhook signatures (Webhook-Signature header) cannot be verified without the endpoint secret; only the header's presence is reported.",
    "meta.webhook_id is documented by name only; it is shown as an attribute and is not used to recognize repeats.",
    "API errors are decoded from the first errors[].reason only; further reasons and field names are listed as sub-codes.",
    "GoCardless documents only the prefix of its ids (EV, PM, RF, MD, PO, SB). An id with two digits after the prefix can look like a bank account number (IBAN) to the generic sensitive-data scan: the input is then flagged and such ids may be hidden in exports, while references and grouping still work.",
    "Provider-specific diagnostic rules do not cover GoCardless yet; only the generic rules apply.",
  ],
  samples: ["gocardless-payment-failed", "gocardless-lifecycle", "gocardless-validation-error"],
};
