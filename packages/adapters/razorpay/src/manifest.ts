import type { ProviderManifest } from "@pandapaylens/core";

export const RAZORPAY_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://razorpay.com/docs";

export const razorpayManifest: ProviderManifest = {
  id: "razorpay",
  displayName: "Razorpay",
  version: RAZORPAY_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // "Payment aggregator" is Razorpay's own term; payment_facilitator is the
  // closest category. Not claimed: acquiring (Razorpay depends on partner
  // banks), wallet, merchant_account_intermediary, and orchestration (claimed
  // for the Optimizer product only, whose formats were not read).
  categories: ["gateway", "payment_facilitator", "card_processing", "alternative_payment_method"],
  sectors: [
    { sector: "E-commerce", source: `${DOCS}/payments/solutions/ecommerce/` },
    { sector: "Travel", source: `${DOCS}/payments/solutions/travel/` },
    {
      sector: "Banking, financial services and insurance (lending, wealth management, insurance)",
      source: `${DOCS}/payments/solutions/bfsi/`,
    },
    { sector: "SaaS and subscription businesses", source: `${DOCS}/x/solutions/saas/` },
    { sector: "Education and e-learning", source: `${DOCS}/x/solutions/edtech/` },
    {
      sector: "Securities brokers and other SEBI-registered intermediaries (MCC 6211)",
      source: `${DOCS}/payments/payment-methods/upi/`,
    },
    { sector: "Marketplaces", source: `${DOCS}/llms.txt` },
    { sector: "D2C brands", source: "https://razorpay.com/llms.txt" },
    { sector: "Freelancers and individual businesses", source: "https://razorpay.com/llms.txt" },
  ],
  regions:
    "Razorpay describes itself as an RBI-authorised payment aggregator for domestic online and offline payments in India, with a Payment Aggregator - Cross Border (PA-CB) licence, operating across India, Malaysia, Singapore and the USA. Settlements are in INR only. RazorpayX and payroll are India-only, and RazorpayX Lite is not available for new merchants. NPCI deprecated UPI Collect from 28 February 2026, with exemptions.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth and PPLSYNTH identifiers, built from the field tables of Razorpay's public API reference (payment, order, refund, dispute, settlement and payout entities), its error pages and its webhook pages. Several JSON examples in the documentation are invalid or contradict the field rules (missing or trailing commas, inline comments, a failed card payment with captured true and no error reason, an error reason that no table lists), so the fixtures follow the field tables, not the examples. Razorpay ids are a prefix and 14 alphanumeric characters; synthetic ids keep the documented prefix but may be longer and contain hyphens so that they carry the PPLsynth marker. None is an official Razorpay example.",
  dependencies: [
    "Partner banks for payment processing (Razorpay does not name them)",
    "NPCI for UPI",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "razorpay.api_error",
      description:
        "Payments API v1 error envelope ({ error: { code, description, field, source, step, reason, metadata } }), also as wrapped by the official Node.js SDK ({ statusCode, error })",
      status: "supported",
    },
    {
      id: "razorpay.payment",
      description:
        "Payment entity snapshots with status and the flat error_code, error_description, error_source, error_step and error_reason fields",
      status: "supported",
    },
    {
      id: "razorpay.order",
      description: "Order entity snapshots (created, attempted, paid)",
      status: "supported",
    },
    {
      id: "razorpay.refund",
      description: "Refund entity snapshots (pending, processed, failed)",
      status: "supported",
    },
    {
      id: "razorpay.webhook",
      description:
        "Webhook envelope (entity event, event, contains, payload, created_at) for payment.*, order.paid, refund.*, payment.dispute.*, settlement.processed, payout.* and downtime events; other families are shown as unknown event types",
      status: "supported",
    },
    {
      id: "razorpay.collection",
      description: "Collection responses (entity collection, items[]) of the entities above",
      status: "limited",
    },
    {
      id: "razorpay.dispute",
      description:
        "Dispute entity snapshots (phase, status, reason_code); reason_code values are not documented as a list",
      status: "limited",
    },
    {
      id: "razorpay.settlement",
      description: "Settlement entity snapshots; they carry no link to the payments they contain",
      status: "limited",
    },
    {
      id: "razorpay.payout",
      description:
        "RazorpayX payout entity snapshots and payout.* webhooks, with status_details.reason decoded from the payout table",
      status: "limited",
    },
    {
      id: "razorpay.checkout_callback",
      description:
        "Standard Checkout success handler and callback fields (razorpay_payment_id, razorpay_order_id, razorpay_signature); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "razorpay.s2s_create",
      description:
        "Server-to-server JSON payment creation responses (razorpay_payment_id, next[] actions); recognized, not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "supported",
    // Only created_at exists per entity and per event, webhook order is not
    // guaranteed, refunds can show processed before the bank confirms, and
    // payouts can leave a "terminal" state.
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has Razorpay-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "errors", title: "Razorpay errors", url: `${DOCS}/errors/` },
    { topic: "common-errors", title: "Common API errors", url: `${DOCS}/errors/common/` },
    { topic: "payment-errors", title: "Payment errors", url: `${DOCS}/errors/payments/list/` },
    { topic: "card-errors", title: "Card errors", url: `${DOCS}/errors/payments/cards/` },
    { topic: "upi-errors", title: "UPI errors", url: `${DOCS}/errors/payments/upi/` },
    {
      topic: "error-parameters",
      title: "Error source and step values per payment method",
      url: `${DOCS}/errors/payments/payment-methods-error-parameters/`,
    },
    {
      topic: "error-reasons",
      title: "Error reasons",
      url: `${DOCS}/payments/payment-gateway/rainy-day/errors/error-reasons/`,
    },
    { topic: "api-conventions", title: "Understand the API", url: `${DOCS}/api/understand/` },
    { topic: "payment-entity", title: "Payment entity", url: `${DOCS}/api/payments/entity/` },
    { topic: "payment-lifecycle", title: "Payment life cycle", url: `${DOCS}/payments/payments/` },
    {
      topic: "late-authorisation",
      title: "Late authorisation",
      url: `${DOCS}/payments/payments/late-authorisation/`,
    },
    { topic: "order-entity", title: "Order entity", url: `${DOCS}/api/orders/entity/` },
    { topic: "refund-entity", title: "Refund entity", url: `${DOCS}/api/refunds/entity/` },
    { topic: "refunds", title: "Refunds", url: `${DOCS}/payments/refunds/` },
    { topic: "dispute-entity", title: "Dispute entity", url: `${DOCS}/api/disputes/entity/` },
    {
      topic: "settlement-entity",
      title: "Settlement entity",
      url: `${DOCS}/api/settlements/entity/`,
    },
    { topic: "webhooks", title: "Webhooks", url: `${DOCS}/webhooks/` },
    { topic: "webhook-events", title: "All webhook events", url: `${DOCS}/webhooks/all/` },
    {
      topic: "webhook-best-practices",
      title: "Webhook best practices",
      url: `${DOCS}/webhooks/best-practices/`,
    },
    {
      topic: "webhook-signature",
      title: "Validate and test webhooks",
      url: `${DOCS}/webhooks/validate-test/`,
    },
    { topic: "razorpayx-errors", title: "RazorpayX errors", url: `${DOCS}/errors/x/` },
    {
      topic: "payout-status-details",
      title: "Payout status details",
      url: `${DOCS}/errors/x/payout-status-details/`,
    },
    {
      topic: "payout-states",
      title: "Payout states and life cycle",
      url: `${DOCS}/x/payouts/states-life-cycle/`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "x-razorpay-event-id header",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Razorpay delivers webhooks at least once and documents duplicates as expected behavior, for example when the receiver answered after the 5-second timeout. Store the x-razorpay-event-id header of every processed event and skip repeats; the JSON body has no event id. For RazorpayX payouts, Razorpay also suggests deduplicating on payout id plus payout status. Base state changes on the entity's own state, not on arrival order.",
    docsUrl: `${DOCS}/webhooks/best-practices/`,
  },
  limitations: [
    "Payments API v1 JSON, payment, order, refund, dispute, settlement and payout entities, collections of them and the webhook envelope are analyzed. Standard Checkout handler fields and server-to-server creation responses are recognized but not analyzed. Route, Subscriptions, Invoices, Payment Links, QR codes, Smart Collect, Optimizer and other families were not researched; their webhooks are shown as unknown event types.",
    'Razorpay calls its payment reason tables "top" errors, so they are not exhaustive. Unknown reasons are decoded as unknown with insufficient confidence. The reason invalid_otp appears in Razorpay\'s own sample error but in no table; it is read like incorrect_otp with possible confidence.',
    "Several reasons have different meanings on different Razorpay pages (capture_failed, credit_not_permitted, international_transaction_not_allowed and others); the decoder states the disagreement and lowers confidence where the next step differs.",
    "The same reason string means different things for a payment and for a RazorpayX payout (for example insufficient_funds is the customer's balance in a payment and the merchant's balance in a payout). Payout status_details reasons are read only from the payout table. An API error body does not say which API answered it, so a reason that exists in both the payment and the RazorpayX tables is read as a payment reason unless the HTTP status or the reason itself points to RazorpayX, and the other reading is shown.",
    "The source value sets differ between Razorpay pages (for example bank appears in webhook samples but not in the netbanking list); undocumented source and step values are shown as supplied and flagged.",
    "The webhook body has no event id. The x-razorpay-event-id header is used as the delivery key only when a raw HTTP request with that header is pasted; a pasted JSON body has no delivery key, so repeated deliveries cannot be recognized from it. Whether created_at stays the same across retries is not documented.",
    "The X-Razorpay-Signature header and razorpay_signature fields cannot be verified from pasted data, so a pasted webhook or callback is never treated as authentic. Only the presence of the signature header is reported; its value is never copied.",
    "A webhook payload is a snapshot of the entity when the event occurred, so its status can lag the current state. Webhook order is not guaranteed. Several documented samples contradict the field rules (a failed card payment with captured true, refund.created already showing processed); the adapter keeps the event's own meaning and shows the snapshot status as supplied.",
    "Late authorisation: a failed payment can become authorized for up to 3 days, and payment.failed followed by payment.captured for the same payment is documented as expected. A failed payment is therefore not treated as final when deciding on retries.",
    "Only created_at is available per entity and per event; there are no per-transition timestamps. Entity snapshots have no event time; webhook created_at is used as the event time.",
    "Payments are linked by the pay_ id, orders by the order_ id (all attempts on one order form one group), refunds and disputes through payment_id. Settlements are not linked to payments: that link exists only in the reconciliation API, which is not analyzed. Payouts are linked only by their pout_ id. The order receipt and the payout reference_id are merchant references and are never used for linking.",
    "Dispute reason_code values are not documented as a list, and reason_description appears in no example; reason_code is shown as supplied. Refund statuses differ between pages (the FAQ names a Reversed status that the entity does not list).",
    "settlement.processed is described both as a completed transfer and as only the initiation of the transfer (the credit can take up to 3 hours); it is shown as a successful settlement step, not as confirmed credit.",
    "RazorpayX payouts are analyzed with limited status: processed is called terminal but can later become reversed, and reversed and failed can follow each other depending on the account type.",
    "Common API errors without a reason are decoded from the HTTP status and the documented description text, with possible confidence. Endpoint-specific error descriptions are not codes and are shown as the provider message only.",
    "Category and retry guidance per reason are PandaPayLens suggestions. Razorpay's own retry signals are its next-step advice per reason (for example retry after 30 minutes for some payout failures) and the RazorpayX 5XX rule (same X-Payout-Idempotency key and body).",
  ],
  samples: ["razorpay-card-lifecycle", "razorpay-late-authorisation"],
};
