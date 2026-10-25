import type { ProviderManifest } from "@pandapaylens/core";

export const DECTA_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.decta.com";
const SITE = "https://www.decta.com";

export const dectaManifest: ProviderManifest = {
  id: "decta",
  displayName: "DECTA",
  version: DECTA_ADAPTER_VERSION,
  wave: "HR-3",
  researchStatus: "tested",
  // Not claimed: wallet (DECTA accepts wallets but runs none in these docs),
  // payment_facilitator and merchant_account_intermediary.
  categories: ["gateway", "acquiring", "card_processing", "orchestration"],
  sectors: [
    { sector: "Retail", source: `${SITE}/products/payment-acquiring` },
    { sector: "Travel", source: `${SITE}/products/payment-acquiring` },
    { sector: "Mobility", source: `${SITE}/products/payment-acquiring` },
    { sector: "Money services", source: `${SITE}/products/payment-acquiring` },
    { sector: "eWallets", source: `${SITE}/products/payment-acquiring` },
    { sector: "Licensed forex", source: `${SITE}/products/payment-acquiring` },
    { sector: "Licensed gaming", source: `${SITE}/products/payment-acquiring` },
    { sector: "Lending", source: `${SITE}/products/payment-acquiring` },
    { sector: "Fintech", source: `${SITE}/products/white-label-payment-gateway` },
    { sector: "eCommerce", source: `${SITE}/products/white-label-payment-gateway` },
    { sector: "Delivery", source: `${SITE}/products/white-label-payment-gateway` },
    {
      sector: "Online gaming (OG payouts)",
      source: `${DOCS}/Payments/payout-scenarios/`,
    },
  ],
  regions:
    "EMI licences: FCA 900592 (UK), Central Bank of Cyprus 115.1.3.54, Central Bank of Ireland C491504; SIA DECTA in Latvia. Transaction limits differ per currency and card market. Recurring fields are mandatory for cards issued in India; on 3-D Secure terminals EU cards are always required to authenticate. SDWO payouts are available only to IPSP partners. Refunds are possible for payments up to two years old; reversals only on the same day. A listed sector does not mean a merchant will be approved; eligibility depends on jurisdiction, licensing and DECTA underwriting.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. DECTA publishes no complete Order response or order.* webhook body, so order fixtures are built from the field tables of the public Decta Gate API OpenAPI file (v0.6) and the documentation portal. Order ids are not UUIDs so that they can carry the PPLsynth marker. The 3-D Secure step responses follow the transcribed examples of the 3-D Secure page with synthetic values. None is an official DECTA example.",
  dependencies: [
    "Card schemes (Mastercard, Visa, UnionPay International) for which DECTA is a principal member or certified processor.",
    "Alternative payment methods offered through DECTA Gate (Apple Pay, Google Pay, PayPal, Volt, Zimpler, Klarna, Open Banking, MB Way); their failure reasons are not coded.",
    "White-label deployments of DECTA Gate can emit the same format under other brands and hosts.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "decta.order",
      description:
        "Decta Gate API v0.6 Order object, from an API response or the body of an order.* or oct.* webhook (event name in the X-Webhook-Event header)",
      status: "limited",
    },
    {
      id: "decta.host2host",
      description:
        "Host2Host, wallet and manual 3-D Secure step responses (processing_status, threed_check_url, status tds_*, next_step)",
      status: "limited",
    },
    {
      id: "decta.validation_error",
      description:
        "API validation error object (field name or __all__ mapped to arrays of { message, code })",
      status: "limited",
    },
    {
      id: "decta.text_error",
      description:
        "HTTP error response with a plain-text body that matches a documented DECTA error text; decoded when DECTA is selected as the provider",
      status: "limited",
    },
    {
      id: "decta.card_webhook",
      description: "card.* webhooks (saved card object); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "decta.webhook_v05",
      description:
        "Deprecated v0.5 webhooks (payment.*, invoice.*, transfer.withdrawn); body not documented",
      status: "unsupported",
    },
    {
      id: "decta.payform_sdk",
      description: "Payform JS SDK browser events (client side only)",
      status: "unsupported",
    },
    {
      id: "decta.hub",
      description: "DECTA Hub issuing and acquirer processing APIs (SOAP, ISO 8583)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has DECTA-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "codes",
      title: "Raw acquirer response codes",
      url: `${DOCS}/Useful-Information/response-codes/`,
    },
    { topic: "webhooks", title: "Webhooks", url: `${DOCS}/Integration/webhooks/` },
    {
      topic: "payment-flow",
      title: "General payment flow and order statuses",
      url: `${DOCS}/Payments/general-payment-flow/`,
    },
    {
      topic: "after-payment",
      title: "After the payment (Merchant Advice Codes, AVS, ECI, name validation)",
      url: `${DOCS}/Payments/after-the-payment/`,
    },
    {
      topic: "3ds",
      title: "3-D Secure authentication",
      url: `${DOCS}/Integration/3ds-authentication/`,
    },
    {
      topic: "integration",
      title: "Integration options",
      url: `${DOCS}/Integration/integration-options/`,
    },
    {
      topic: "scenarios",
      title: "Simple payment scenarios (one-step, two-step, refunds, reversal)",
      url: `${DOCS}/Payments/simple-payment-scenarios/`,
    },
    {
      topic: "recurring",
      title: "Recurring payment scenarios",
      url: `${DOCS}/Payments/recurring-payment-scenarios/`,
    },
    { topic: "payouts", title: "Payout scenarios", url: `${DOCS}/Payments/payout-scenarios/` },
    {
      topic: "testing",
      title: "Testing and going live",
      url: `${DOCS}/Integration/testing-and-going-live/`,
    },
    { topic: "security", title: "Security", url: `${DOCS}/Useful-Information/security/` },
    {
      topic: "api",
      title: "Decta Gate API (OpenAPI 3.0.3, v0.6)",
      url: "https://gate.decta.com/api-docs/api_documentation.yaml",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "none documented (webhooks carry no event id; the body id is the order id, and order id with the X-Webhook-Event header and the latest status_changes entry is only a heuristic)",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "DECTA documents no webhook event id, retry schedule or ordering. Make the handler idempotent on the order id and the order status, and confirm the current status with GET order before acting.",
    docsUrl: `${DOCS}/Integration/webhooks/`,
  },
  limitations: [
    "DECTA publishes no complete Order response or order.* webhook body; field presence is taken from the OpenAPI schema and depends on response_type (minimum, standard or full).",
    "The webhook event name travels only in the X-Webhook-Event header. A pasted body without its headers is analyzed from the order status, and order.* and oct.* events cannot be told apart from an API response.",
    "v0.6 webhooks carry no signature (hmac_key is reserved for v1.0, which is in development), so a pasted webhook is never treated as authentic. DECTA's advice is to accept only its static source IPs and to confirm the status via the API.",
    "Webhooks carry no event id, and the retry schedule, acknowledgement rules and delivery order are not documented. No delivery key is set, so repeated deliveries are not reported as duplicates; they are grouped with the order by its id.",
    "The timestamp keys inside status_changes, processing_status, errors and three_d_secure_status appear as true in the OpenAPI YAML and their wire name is not documented, so they are not read. Order events carry no event timestamp and follow the input order; the documented order timestamps (issued, viewed, captured, paid, cleared, settled) are shown as attributes when they are ISO 8601 strings with a time zone.",
    "The unit and format of order amounts (status_changes operation_amount, amount_refunded and similar) are not documented in the reviewed sources, so amounts are shown as supplied and are not converted to minor units. Amount consistency checks therefore do not run for DECTA.",
    "status_changes is shown as a status history on the order event (oldest first, as documented); it is not split into separate events because its entries carry no readable timestamp.",
    "The documentation's status table has labels (Refund initiated, Refund failed, Representation, Pre-arbitration, Compliance and others) whose wire values are not documented; such statuses are shown as unknown. withdrawn is a documented value without a documented meaning.",
    "order.refund_in _progress and order.reversal_in _progress are printed with a space in the documentation and are recognized only in that spelling. The event spelling order.canceled differs from the status cancelled.",
    "A paid status is shown as a capture only when the status history contains hold first (two-step payment). Payout orders can only be told apart from payments by an oct.* webhook header.",
    "Raw acquirer codes are decoded from transaction_details.processing_status.code (order) and the top-level processing_status (Host2Host, 3-D Secure and wallet responses). The field that carries the special code -1 is not documented. The vocabularies of transaction_details.errors[].code and fraud_check_status.code are not documented; such codes are shown without interpretation.",
    "Codes 198, 951 and -1 have several possible meanings and are decoded with possible confidence. Mastercard Merchant Advice Codes are not returned by every acquirer; when present, the stricter of the code's and the advice code's retry guidance is used.",
    "AVS letters, card name validation results and the ECI comparison are informational; DECTA makes no automatic decision on AVS. ECI values themselves are not copied.",
    "The response code page mentions a response_code field with Refused or Cancelled, but no such field exists in the OpenAPI schema; it is not read.",
    "API validation errors list field names with { message, code }; only the code invalid appears in DECTA's examples and the full list is not documented. Plain-text 400 descriptions are matched only when they arrive inside such an object.",
    "Orders are linked only by the order id. Recurring payments are not linked to the original payment (trace_id, cof_trace_id and transaction_link_id are not used as keys), and the subscription id on an order is not documented; from_subscription orders are marked as recurring, including the first order of a subscription.",
    "Host2Host and 3-D Secure step responses carry no order id, so they cannot be linked to the order. Their capability URLs (next_step_url, threed_check_url, redirectToACSForm) are never copied.",
    "card.* webhooks, deprecated v0.5 webhooks, Payform SDK browser events, Charge objects, alternative payment method failure reasons and the DECTA Hub APIs are not analyzed.",
    "Category and retry guidance per code are PandaPayLens suggestions that follow DECTA's status groups: for 1xx and 2xx refusals the cardholder contacts the issuer; for 9xx codes the merchant contacts DECTA technical support.",
  ],
  samples: ["decta-two-step", "decta-declined"],
};
