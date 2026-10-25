import type { ProviderManifest } from "@pandapaylens/core";
import {
  API_ERRORS_URL,
  BUSINESS_VALUE_URL,
  COLLECTION_REASON_CODES_URL,
  COLLECTION_WEBHOOKS_URL,
  INSTANT_BANK_TRANSFER_STATUS_URL,
  ISO_STATUS_URL,
  JWT_ERRORS_URL,
  ORDER_LIFECYCLE_URL,
  PAYOUT_REASON_CODES_URL,
  PAYOUT_WEBHOOKS_URL,
  PAYOUTS_INTRO_URL,
  RESPONSE_CODES_URL,
  SECURITY_MODEL_URL,
  X_REQUEST_ID_URL,
} from "./catalog.js";

export const INPAY_ADAPTER_VERSION = "0.1.0";

export const inpayManifest: ProviderManifest = {
  id: "inpay",
  displayName: "Inpay",
  version: INPAY_ADAPTER_VERSION,
  wave: "HR-3",
  researchStatus: "tested",
  // Wallet covers only the Wallet transfer pay-in method (EntirePay trading
  // name). Bank payouts from virtual accounts fit no category and are
  // described in apiFamilies instead.
  categories: ["alternative_payment_method", "wallet"],
  sectors: [
    { sector: "Financial Services", source: BUSINESS_VALUE_URL },
    { sector: "iGaming", source: BUSINESS_VALUE_URL },
    { sector: "NGOs", source: BUSINESS_VALUE_URL },
    { sector: "Corporates", source: "https://inpay.com/" },
  ],
  regions:
    "Inpay is an authorized payment institution in the EU, licensed and regulated by the Danish FSA (No. 22008), a SWIFT member, and screens against OFAC, UN, EU and HMT sanctions lists. Payout availability is set per contracted product (currency, country and local instrument: LOCAL, SEPA, INSTANT SEPA, INTERNATIONAL); pay-in availability per payment method, debtor country and debtor currency.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Payout and order shapes follow the payout status and webhook examples and the order webhook examples transcribed in the research; error bodies follow the documented error shapes. Values, references and reason combinations are invented, and none is an official Inpay example.",
  dependencies: [
    "Unnamed open-banking provider for Instant Bank Transfer pay-ins (it reports debtor_bank_status_code)",
    "EntirePay trading name for the Wallet transfer pay-in method",
    "Bank payment rails for payouts (local schemes, SEPA, SEPA Instant, SWIFT)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "inpay.payout",
      description:
        "Payouts API v1 payment request (status response, search item, create response and webhook body): inpay_unique_reference, end_to_end_id, state, reasons[] with category and code",
      status: "supported",
    },
    {
      id: "inpay.order",
      description:
        "Collections API v1 Order (GetOrder and order webhook body): uuid, status, status_reasons, payments[] attempts, nested refund",
      status: "limited",
    },
    {
      id: "inpay.error",
      description:
        "Error bodies: { errors: [{ title, detail, code }] }, { error: { code, title, details } } and { message }, with numeric API codes and JWT error codes",
      status: "limited",
    },
    {
      id: "inpay.iso20022",
      description:
        "ISO 20022 payout channel (pain.002.001.11 / pacs.002.001.12 status reports, XML): not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Proposed as supported. Limited: pay-in reasons are free text without
    // codes, the JWT error field is not documented, and the generic error
    // envelopes are not recognized without a provider selection.
    errorDecoding: "limited",
    // Proposed as supported. Limited: the ISO 20022 status reports are XML
    // and not analyzed, and most payment attempt status spellings in JSON are
    // not documented.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has Inpay-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "payouts",
      title: "Payouts introduction (payment request states)",
      url: PAYOUTS_INTRO_URL,
    },
    { topic: "payout-reason-codes", title: "Payout reason codes", url: PAYOUT_REASON_CODES_URL },
    { topic: "payout-webhooks", title: "Payout webhooks", url: PAYOUT_WEBHOOKS_URL },
    { topic: "order-lifecycle", title: "Collections order lifecycle", url: ORDER_LIFECYCLE_URL },
    {
      topic: "instant-bank-transfer-status",
      title: "Instant Bank Transfer payment status",
      url: INSTANT_BANK_TRANSFER_STATUS_URL,
    },
    { topic: "collection-webhooks", title: "Collections webhooks", url: COLLECTION_WEBHOOKS_URL },
    { topic: "collection-reasons", title: "Pay-in reason codes", url: COLLECTION_REASON_CODES_URL },
    { topic: "api-errors", title: "API errors", url: API_ERRORS_URL },
    { topic: "response-codes", title: "HTTP response codes", url: RESPONSE_CODES_URL },
    { topic: "jwt-errors", title: "JWT signing errors", url: JWT_ERRORS_URL },
    { topic: "security-model", title: "Security models (PKCS#7 and JWT)", url: SECURITY_MODEL_URL },
    { topic: "x-request-id", title: "X-Request-ID header", url: X_REQUEST_ID_URL },
    {
      topic: "iso20022-status",
      title: "ISO 20022 status codes (not analyzed)",
      url: ISO_STATUS_URL,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "X-Request-ID header (webhook bodies carry no event id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Inpay redelivers the same state with the same X-Request-ID and asks for a 200 answer to duplicates. Keep the X-Request-ID of processed webhooks, answer repeats with 200, and base state changes on the payout or order state rather than on arrival order.",
    docsUrl: PAYOUT_WEBHOOKS_URL,
  },
  limitations: [
    "Merchants on the PKCS#7 security model receive signed and encrypted response and webhook bodies. Only bodies that were already decrypted (or JWT-model plain JSON) can be analyzed; an encrypted body is not recognized.",
    "Webhooks carry no event name and no event id; the state of the resource says what happened. Repeated deliveries are recognized only when the webhook is pasted as an HTTP request with its X-Request-ID header; a bare body has no documented duplicate key, so no deliveryKey is set.",
    "Webhook signatures (PKCS#7 signature, JWT in the Authorization header) are sensitive and never verified or copied; a pasted webhook is never treated as authentic. Whether the JWT model also covers Collections webhooks is not documented.",
    "The webhook retry schedule, retry count and delivery order are not documented. Inpay documents only that 2XX acknowledges, 3XX and 4XX stop further attempts and 5XX triggers a retry.",
    "Payout timestamps have no documented time zone and order webhooks have no timestamp at all, so Inpay events are not placed on the timeline by time and are ordered by input order. The payout timestamp is shown as an attribute.",
    "Payout completed means accepted by the banking layer or processing partner, not confirmed credit to the beneficiary; returned can follow. A payout request (received) is not a completed payout, and a bank transfer pay-in attempt is not a received payment.",
    "Pay-in reasons in status_reasons are free text without codes, and Inpay's example texts do not match its reason table. Only two texts that clearly name a table row are matched, with possible confidence; other texts are shown as provider messages and the documented candidate reasons for the order status are listed.",
    "Payment attempt changes do not trigger webhooks. Docs tables write attempt statuses in capitals with spaces (BANK AUTHORISED) while JSON examples show only created, bank_authorised, completed and consent_required; other lower snake case values are matched to the table labels and flagged as inferred. Swish and BLIK attempt statuses are not documented and stay unknown.",
    "The nested refund status list is not documented (examples show created, processing and completed); other values stay unknown. The meaning of the order status returned is not described, so its outcome stays unknown.",
    "Three different error body shapes are documented. The generic { errors: [{ title, detail }] } and { error: { details } } shapes are recognized with high confidence only when they carry a documented numeric code, a JWT error code or an Inpay field name; otherwise select Inpay manually. The response field that carries JWT error codes is not documented, so the code is accepted from any documented error field.",
    "Codes outside the reason table appear in Inpay examples (beneficiary-account-not-existing, validation_schema_failed, awaiting_extended_kyc). They are decoded with possible confidence and an unknown category. The reason table's kind column (refund_cancelled / refund_returned) is docs metadata; the payout state tells a cancelled row from a returned one.",
    "The ISO 20022 channel (pain.001 / pacs.008 in, pain.002 / pacs.002 status reports out) is XML and is not analyzed. Reconciliation, FX, Account Funding, Authentication check and Sandbox APIs are not analyzed.",
    "The payout currency example in the OpenAPI file is the literal text ISO 4217 and the descriptions of debtor_account.id and scheme_name are swapped there. Amounts are converted only with a valid three-letter currency. The virtual account number (debtor_account.id), payer and beneficiary names, account numbers, bank identifiers and redirect URLs are never copied.",
    "Order reference is unique only per business unit and is not used to link events. Payouts are linked by inpay_unique_reference and end_to_end_id, which Inpay documents as the merchant's unique payout reference; orders by uuid, primary_payment, payments[].inpay_unique_reference and refund uuid.",
    "Inpay documents no chargebacks (bank transfer rails), no subscriptions and no card payments; none is shown. Never read a pay-in or payout state as a card authorization or capture.",
    "Category and retry guidance per code are PandaPayLens suggestions; Inpay gives no per-code retry advice. HTTP 500 and 503 leave the outcome of the request open and are shown as conditional retries after a status lookup.",
    "Sector eligibility depends on jurisdiction, licensing and Inpay's onboarding and compliance review. Account-specific product lists, per-product payout schemas and production hosts need a customer login and were not reviewed.",
  ],
  samples: ["inpay-payout-rejected", "inpay-order-cancelled"],
};
