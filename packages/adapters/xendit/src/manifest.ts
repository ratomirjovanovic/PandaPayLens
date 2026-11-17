import type { ProviderManifest } from "@pandapaylens/core";

export const XENDIT_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.xendit.co";
const ARCHIVE = "https://archive.developers.xendit.co/api-reference";

export const xenditManifest: ProviderManifest = {
  id: "xendit",
  displayName: "Xendit",
  version: XENDIT_ADAPTER_VERSION,
  wave: 5,
  researchStatus: "tested",
  // Xendit collects payments over many local methods (cards, e-wallets,
  // virtual accounts, QR, retail outlets) and sends payouts. Not claimed:
  // acquiring, payment_facilitator, orchestration, merchant_account_intermediary.
  categories: ["card_processing", "alternative_payment_method", "gateway"],
  // Merchant sectors were not part of this research.
  sectors: [],
  regions:
    "The Payments API v3 country enum lists Indonesia, the Philippines, Vietnam, Thailand, Singapore, Malaysia, Hong Kong and Mexico. Legacy disbursements send money to Indonesian banks and e-wallets. Payouts v3 coverage is listed per country in the payout coverage pages.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Shapes follow the request, response and webhook examples and schemas of the Xendit API reference (docs.xendit.co, OpenAPI pages) and of the archived legacy API reference for invoices and disbursements, with synthetic values. None is an official Xendit example.",
  status: "limited",
  apiFamilies: [
    {
      id: "xendit.api_error",
      description:
        "Error responses { error_code, message, errors? } of the Payments API v3, refunds, Payouts v3 and the legacy invoice and disbursement endpoints",
      status: "limited",
    },
    {
      id: "xendit.webhook",
      description:
        "v3 webhooks with semantics: payment.capture, payment.authorization, payment.failure, payment.expiry, payment_request.expiry, refund.succeeded, refund.failed, v3_payout.succeeded, v3_payout.failed and v3_payout.reversed",
      status: "limited",
    },
    {
      id: "xendit.payment_request",
      description: "Payments API v3 Payment Request objects (create, get, cancel responses)",
      status: "limited",
    },
    {
      id: "xendit.payment",
      description: "Payments API v3 Payment objects (get, capture, cancel responses)",
      status: "limited",
    },
    { id: "xendit.refund", description: "v3 Refund objects", status: "limited" },
    { id: "xendit.payout", description: "Payouts v3 Payout objects", status: "limited" },
    {
      id: "xendit.invoice",
      description: "Legacy Invoice objects (/v2/invoices) and invoice callbacks",
      status: "limited",
    },
    {
      id: "xendit.disbursement",
      description: "Legacy Disbursement objects (/disbursements) and disbursement callbacks",
      status: "limited",
    },
    {
      id: "xendit.webhook.other",
      description:
        "Payment token, payment session, subscription, dispute and other events in the v3 envelope; recognized, not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // API errors are documented with descriptions; payment failure codes are
    // documented as names only.
    errorDecoding: "limited",
    paymentResponses: "limited",
    // No event id in v3 webhook bodies; payment.expiry and
    // payment_request.expiry have no payload example.
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "api-reference", title: "Xendit API reference", url: `${DOCS}/apidocs` },
    {
      topic: "payment-requests",
      title: "Create a payment request",
      url: `${DOCS}/apidocs/create-payment-request`,
    },
    {
      topic: "payment-webhook",
      title: "Payment webhook notification",
      url: `${DOCS}/apidocs/payment-webhook-notification`,
    },
    {
      topic: "webhook-events",
      title: "Payments API webhooks",
      url: `${DOCS}/docs/payments-api-webhooks`,
    },
    {
      topic: "payment-request-statuses",
      title: "Pay (one-off payment)",
      url: `${DOCS}/docs/pay-one-off-payment`,
    },
    { topic: "refunds", title: "Create a refund", url: `${DOCS}/apidocs/create-a-refund` },
    {
      topic: "refund-webhook",
      title: "Refund webhook notification",
      url: `${DOCS}/apidocs/refund-webhook-notification`,
    },
    { topic: "payouts", title: "Create Payout", url: `${DOCS}/apidocs/create-payout-v3` },
    { topic: "payout-webhook", title: "Payout Webhook", url: `${DOCS}/apidocs/payout-v3-webhook` },
    {
      topic: "payout-statuses",
      title: "Payout status lifecycle",
      url: `${DOCS}/docs/payout-status-lifecycle`,
    },
    {
      topic: "card-declines",
      title: "Card declines and error codes",
      url: `${DOCS}/docs/cards-card-declines-and-error-codes`,
    },
    {
      topic: "webhook-behavior",
      title: "Webhook behavior",
      url: `${DOCS}/apidocs/webhook-behavior`,
    },
    {
      topic: "handling-webhooks",
      title: "Handling webhooks",
      url: `${DOCS}/docs/handling-webhooks`,
    },
    {
      topic: "legacy-api",
      title: "Archived API reference (invoices, disbursements, error handling)",
      url: `${ARCHIVE}/`,
    },
  ],
  verifiedAt: "2026-11-17",
  delivery: {
    duplicateKey:
      "webhook-id header when the HTTP message is pasted; otherwise none (v3 webhook bodies carry no event id)",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Xendit documents duplicate webhooks (retries up to six times over 24 hours, and resends after provider outages) and no fixed order. Make processing idempotent: Xendit names payment_id and capture_id as the values that identify payment events, and the legacy reference documents a unique webhook-id header for every webhook.",
    docsUrl: `${DOCS}/docs/handling-webhooks`,
  },
  limitations: [
    "The x-callback-token header (a static token from the dashboard) cannot be checked from pasted data, so a pasted webhook is never treated as authentic. The header is not read.",
    "v3 webhook bodies have no event id. The webhook-id header is used as the delivery key only when the HTTP message is pasted; otherwise repeated deliveries are not reported as duplicates by key.",
    "Payments API failure codes (failure_code) are documented as an enum without descriptions; the error scenario table is an embedded table that could not be read. Meanings are taken, with possible confidence, from the API error of the same name, the legacy eWallet failure table or the card network response code table. Codes without any description are decoded as unknown with insufficient confidence.",
    "Card network response codes in payment_details.authorization_data are shown as received and not decoded. The card declines guide uses different field names (card_network_response_code) from the API schema (network_response_code); only the schema names are read.",
    "payment.expiry and payment_request.expiry appear only in the Payments API webhooks table, without a payload example. The migration guide also names payment.succeeded, which the API schema does not list; it is treated as an unknown event.",
    "Payout statuses: the payout status page and the API schema disagree. REJECTED, ROUTING, READY, LOCKED and EXPIRED have no description and are shown as unknown. v3_payout.rejected and v3_payout.pending_compliance have no description and are shown with an unknown outcome. SLS_SENDER and SLS_RECIPIENT failure codes have no description.",
    "Payout amounts are documented as minor units, but the documented examples contradict that for some currencies (IDR is described with 0 decimals). Payout amounts are shown as sent and are not converted.",
    "Legacy disbursements carry no currency field, so the amount is shown as sent and not converted.",
    "Refund failure codes are documented only as channel specific and are decoded as unknown. refund.succeeded means Xendit sent the refund to the channel; Xendit says it does not guarantee that the money reached the end user.",
    "A payment request of type REUSABLE_PAYMENT_CODE receives many payments, so its id is not used to link events.",
    "Legacy invoices: only the invoice object and callback are analyzed. The archived reference is no longer maintained; Xendit asks merchants to migrate to Payment Sessions, whose events are recognized but not analyzed.",
    "Legacy API error codes were read from the archived reference, whose error example (BANK_CODE_NOT_SUPPORTED) differs from its error table (BANK_CODE_NOT_SUPPORTED_ERROR); both are accepted.",
    "Category and retry guidance are PandaPayLens suggestions derived from Xendit's documented descriptions; Xendit's own retry advice is used where it gives one.",
  ],
  samples: ["xendit-card-payment-lifecycle", "xendit-payout-failed"],
};
