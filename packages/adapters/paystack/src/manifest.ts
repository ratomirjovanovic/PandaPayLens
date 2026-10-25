import type { ProviderManifest } from "@pandapaylens/core";

export const PAYSTACK_ADAPTER_VERSION = "0.1.0";

const HELP = "https://support.paystack.com/en/articles";
const SNIPPETS = "https://github.com/PaystackOSS/doc-code-snippets";
const SUPPORTED_BUSINESSES = `${HELP}/2129730`;
const INELIGIBLE_BUSINESSES = `${HELP}/2127042`;
const HIGH_RISK_GUIDE = `${HELP}/5949186`;

export const paystackManifest: ProviderManifest = {
  id: "paystack",
  displayName: "Paystack",
  version: PAYSTACK_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // gateway is an inference from documented routing to downstream processors
  // (refund processor and channel values). Not claimed: acquiring,
  // payment_facilitator, wallet, orchestration, merchant_account_intermediary.
  categories: ["card_processing", "alternative_payment_method", "gateway"],
  sectors: [
    {
      sector:
        "Gaming: betting, lotteries, prediction services (prior approval required; betting and lotteries unsupported in South Africa)",
      source: SUPPORTED_BUSINESSES,
    },
    {
      sector:
        "Gambling, gaming and prize activities only with Paystack's prior approval and where legal for operator and customers",
      source: INELIGIBLE_BUSINESSES,
    },
    {
      sector:
        "Financial services: financial cooperatives, financial technologies, payment solution service providers, insurance, investments, agricultural investments, savings, mobile wallets",
      source: SUPPORTED_BUSINESSES,
    },
    {
      sector:
        "Forex trading, cryptocurrency, lending, remittances (listed as supported, but excluded per country by the ineligible businesses list)",
      source: SUPPORTED_BUSINESSES,
    },
    {
      sector:
        "Digital goods (including digital games and gift cards), physical goods, electronics, real estate, professional services, education, hospitality, health, travel, transport, utilities, non-profits and other listed industries",
      source: SUPPORTED_BUSINESSES,
    },
    {
      sector: "Subscription or free-trial services (named as high risk)",
      source: HIGH_RISK_GUIDE,
    },
  ],
  regions:
    "Services are available only to businesses registered in Nigeria, Ghana, South Africa and Kenya, with a private beta in Côte d'Ivoire and Egypt. Documented currencies: NGN, GHS, ZAR, KES, USD. Pay with Transfer is available in Nigeria and Ghana only (generated accounts expire after 30 minutes), preauthorization in South Africa only, and Transfers only for registered businesses. The ineligible businesses list restricts categories per country: cryptocurrency trading in Ghana, Kenya, Nigeria and South Africa; forex trading in Ghana, Kenya and Nigeria; betting and lotteries, mobile wallets, lending, remittance and savings businesses in South Africa; skill games and betting for card payments in Ghana.",
  // Public, no login. The documentation site answers scripted clients with a
  // challenge page; see limitations.
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Response and webhook shapes follow the response examples and webhook payload examples that Paystack publishes for its developer documentation in the PaystackOSS/doc-code-snippets repository and the schemas of the PaystackOSS/openapi specification, with synthetic values. Decline texts are the exact messages of Paystack's Help Center error articles. Paystack publishes no charge.failed payload example, so that fixture reuses the documented transaction object. None is an official Paystack example.",
  dependencies: [
    "Card schemes (Verve, Mastercard, Visa; American Express for businesses in South Africa and Nigeria) and the customer's bank, which produce most decline texts.",
    "Downstream processors named only as values (refund processor instant-transfer, mpgs_zen; refund channel migs, isw_3ds).",
    "Mobile money operators (MTN, Telecel, Airtel, M-PESA), USSD, Pay with Transfer (Paystack-Titan accounts in Nigeria), EFT and Capitec Pay.",
    "NIBSS Instant Payment (NIP) for transfers to Nigerian bank accounts; NIBSS downtime keeps transfers pending.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "paystack.api_response",
      description:
        "API responses whose data is a transaction (initialize, verify, fetch, charge_authorization and Charge API states such as send_pin, send_otp, pay_offline and pending), a refund, a dispute or a transfer",
      status: "supported",
    },
    {
      id: "paystack.api_error",
      description:
        "Error responses (status false, message, type, code, meta.nextStep), including the swapped type and code enums and the string status of the error template",
      status: "limited",
    },
    {
      id: "paystack.webhook",
      description:
        "Webhooks with semantics: charge.success, charge.failed, charge.dispute.create, charge.dispute.remind, charge.dispute.resolve, refund.*, transfer.success, transfer.failed, transfer.reversed and bank.transfer.rejected",
      status: "limited",
    },
    {
      id: "paystack.list_response",
      description:
        "Paginated list responses (data array with meta.perPage); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "paystack.other_webhooks",
      description:
        "Preauthorization, direct debit, subscription, invoice, payment request, customer identification and dedicated account events; recognized and shown without semantics",
      status: "unsupported",
    },
    {
      id: "paystack.webhook_delivery_records",
      description:
        "Webhook event API delivery records (/integration/webhooks/events); not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Request errors are clear, but payment declines are free text matched
    // only against exact documented messages, and the field that carries the
    // Help Center messages is not documented.
    errorDecoding: "limited",
    paymentResponses: "supported",
    // No event id or timestamp in webhook bodies; retry schedule, ordering and
    // source IPs not documented in the sources read; charge.failed has no
    // payload example.
    webhookParsing: "limited",
    // Refund webhooks carry no timestamp, failed transactions carry no time of
    // failure, and status changes after refunds or disputes have no
    // timestamped history in the transaction.
    timeline: "limited",
    // Refund webhooks link only through transaction_reference, the documented
    // refund event example has no refund id, dispute transaction_reference is
    // null in the examples, and bank.transfer.rejected carries no documented
    // reference.
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Paystack-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "developer-docs",
      title: "Paystack developer documentation",
      url: "https://paystack.com/docs/",
    },
    {
      topic: "openapi",
      title: "Paystack OpenAPI specification (PaystackOSS/openapi)",
      url: "https://github.com/PaystackOSS/openapi",
    },
    {
      topic: "examples",
      title:
        "Response and webhook examples of the developer documentation (PaystackOSS/doc-code-snippets)",
      url: SNIPPETS,
    },
    {
      topic: "error-format",
      title: "API error format example",
      url: `${SNIPPETS}/blob/main/dist/api/introduction/sample-error.js`,
    },
    {
      topic: "webhook-events",
      title: "Webhook event payload examples",
      url: `${SNIPPETS}/blob/main/dist/doc/payments/webhooks/events.js`,
    },
    {
      topic: "refund-events",
      title: "Refund event payload examples",
      url: `${SNIPPETS}/blob/main/dist/doc/payments/refunds/events.js`,
    },
    { topic: "bank-errors", title: "Help Center: Bank errors", url: `${HELP}/2123650` },
    { topic: "customer-errors", title: "Help Center: Customer errors", url: `${HELP}/2124674` },
    {
      topic: "fraud-block-errors",
      title: "Help Center: Fraud block errors",
      url: `${HELP}/2125058`,
    },
    { topic: "system-errors", title: "Help Center: System errors", url: `${HELP}/2129794` },
    { topic: "abandoned", title: "Help Center: Abandoned payments", url: `${HELP}/2123330` },
    {
      topic: "refund-statuses",
      title: "Help Center: Understanding refund statuses",
      url: `${HELP}/2130434`,
    },
    {
      topic: "webhooks",
      title: "Help Center: Viewing and retrying webhooks",
      url: `${HELP}/10609026`,
    },
    {
      topic: "transfers",
      title: "Help Center: Transfers guide for gaming merchants",
      url: `${HELP}/9039298`,
    },
    {
      topic: "supported-businesses",
      title: "Help Center: Supported businesses",
      url: SUPPORTED_BUSINESSES,
    },
    {
      topic: "ineligible-businesses",
      title: "Help Center: Ineligible businesses",
      url: INELIGIBLE_BUSINESSES,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "no documented key (webhook bodies carry no event id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Paystack documents that an endpoint can receive an event more than once, especially on retries, and advises checking a unique transaction reference or resource id before giving value. Webhook bodies carry no event id or timestamp, so verify the transaction (GET /transaction/verify/{reference}) and record what you have already fulfilled.",
    docsUrl: `${HELP}/10609026`,
  },
  limitations: [
    "Documentation access: the developer documentation at paystack.com/docs answers scripted clients with a challenge page, so its prose (webhook guide, API reference introduction, transfer guides) was not read. The research relies on Paystack's official OpenAPI specification, the official repository of the documentation's code snippets and response examples, and the Help Center. Anything that would only come from the unread prose is treated as not documented.",
    "Declines are free text; Paystack payloads carry no numeric decline, issuer response, 3-D Secure or AVS code. Only the exact documented messages are decoded (case, apostrophes and spacing are ignored). Any other text is shown as received and decoded as unknown with insufficient confidence.",
    "Paystack's Help Center does not say which API field carries its error messages. gateway_response and the transaction message are both checked; the top-level message of a response is only used for request errors.",
    "Webhook bodies have no event id, delivery id or timestamp, so no delivery key is set and repeated deliveries of one event are not reported as duplicates. The retry schedule, maximum attempts, timeout, delivery order and source IPs are not documented in the sources read.",
    "The x-paystack-signature header (HMAC-SHA512 of the body with the secret key) cannot be verified from pasted data, so a pasted webhook is never treated as authentic. Only the presence of the header is used, as supporting detection evidence.",
    "The OpenAPI Error schema puts validation_error, processor_error and api_error on code, while every example puts them on type. Both placements are accepted. processor_error has no documented meaning. Many errors carry only status and message; a message-only error is recognized only when the message is one of the documented API error messages.",
    'The error template shows status as the string "false"; it is accepted only together with a documented error type or meta.nextStep. The direct debit example uses metadata.nextStep instead of meta.nextStep; both are read.',
    "The envelope status is the request result, not the payment result (a failed charge can come with status true, and the submit-address example has status false with a charge in data). The payment outcome is taken from data.status only.",
    "The documented HTTP status codes disagree between the specification and the examples for several errors, so the HTTP status is shown but not used to classify errors.",
    "abandoned is shown as a payment that ended without completing (cancellation stage), not as a decline: Paystack says such a transaction never began. reversed is shown as a reversal of a paid transaction.",
    "charge.failed appears only in Paystack's events catalog, without a payload example. It is read as the documented transaction object.",
    'Transfers are payouts and are kept separate from payments. The transfer statuses abandoned, blocked, rejected and received have no documented meaning and are shown as unknown. Transfer failure reasons are not documented (failures is null in every example), so a failed transfer has no decoded reason. A transfer initiate response can say "Transfer has been queued" with status success and no transferred_at; such a response is shown with an unknown outcome.',
    "Refund webhooks carry no timestamp and, in the documented example, no refund id; they are linked to the payment only through transaction_reference. The refund reason values are not documented and are not shown.",
    "Disputes are linked through the embedded transaction (reference and id); dispute outcomes are decided by issuing banks and card schemes, and the dispute event is shown without an outcome. dueAt and resolvedAt are shown as supplied.",
    "bank.transfer.rejected is decoded from message_type INCORRECT_AMOUNT only; other message_type values and the other fields of this event are not documented, so it carries no reference.",
    "Preauthorization, direct debit, subscription, invoice, payment request, customer identification and dedicated account events are recognized but shown without semantics. Paginated list responses and webhook delivery records are recognized as Paystack data but not analyzed.",
    "The documented examples disagree on field types (amount as a string in some refund events, exp_month as an integer, metadata as 0, an empty string or an object, gateway_response as an object in the preauthorization example). Amounts are read as integers or digit strings in minor units; other variants are ignored.",
    "Merchant sectors: the Supported businesses article lists cryptocurrency, forex trading, betting and lotteries, while the Ineligible businesses article excludes them in some or all countries and requires prior approval for gambling. Both are recorded; a listed sector does not mean a merchant will be approved.",
    "Category and retry guidance per message are PandaPayLens suggestions derived from Paystack's documented meanings, using Paystack's own advice where it gives one (for example retrying after 24 hours).",
  ],
  samples: ["paystack-card-lifecycle", "paystack-do-not-honour"],
};
