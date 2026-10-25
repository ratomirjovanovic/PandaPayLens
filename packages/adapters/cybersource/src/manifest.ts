import type { ProviderManifest } from "@pandapaylens/core";

export const CYBERSOURCE_ADAPTER_VERSION = "0.1.0";

const DEV = "https://developer.cybersource.com";
const PAYMENTS_GUIDE = `${DEV}/docs/cybs/en-us/payments/developer/ctv/rest/payments.md`;
const REASON_CODES = `${DEV}/docs/cybs/en-us/reason-codes-so/reference/all/so/reason-codes-so/reason-codes-so.md`;
const WEBHOOKS = `${DEV}/docs/cybs/en-us/webhooks/implementation/all/rest/webhooks.md`;
const MERCHANT_PAGE =
  "https://www.cybersource.com/en-us/why-cybersource/merchant-payment-processing.html";

export const cybersourceManifest: ProviderManifest = {
  id: "cybersource",
  displayName: "Cybersource",
  version: CYBERSOURCE_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Not claimed: acquiring (acquirers are third parties), card_processing
  // (unclear: Visa Platform Connect is a processing connection, but the
  // acquirer stays responsible), wallet and alternative_payment_method
  // (carried as a gateway only).
  categories: ["gateway", "orchestration"],
  sectors: [
    { sector: "Lodging (pre-authorizations)", source: PAYMENTS_GUIDE },
    { sector: "Auto rental (pre-authorizations)", source: PAYMENTS_GUIDE },
    { sector: "E-commerce (pre-authorizations)", source: PAYMENTS_GUIDE },
    { sector: "Restaurants (pre-authorizations)", source: PAYMENTS_GUIDE },
    { sector: "Mastercard bill payments", source: PAYMENTS_GUIDE },
    { sector: "Mass transit", source: REASON_CODES },
    { sector: "Charity donations (case study)", source: MERCHANT_PAGE },
  ],
  regions:
    "Cybersource states coverage of 160+ countries and territories, but publishes no full country restriction list. A merchant must register with a payment processor before accepting payments. PSD2 strong customer authentication applies to EU/EEA pre-authorizations; fast refunds are only available for Visa cards in India; processor responses 70 (PIN required) and 1A (additional authentication required) are limited to listed countries. The listed use cases are general examples from the documentation, not a statement of merchant eligibility, which depends on jurisdiction, licensing, underwriting and the acquirer behind the processor connection. No high-risk sector is documented.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Payment responses follow the response examples of the public Payments Developer Guide (Visa Platform Connect variant) and the schemas of the official OpenAPI specification; error bodies follow the HTTP 400 and 502 schemas and the timeout example; webhook envelopes follow the Webhooks Implementation Guide and the Pay by Bank webhook page; Transaction Details records are built from the documented field list, as no complete example was reviewed. Request ids are not 22-digit numbers so that they can carry the PPLsynth marker. None is an official Cybersource example.",
  dependencies: [
    "Payment processors and acquirers behind each Cybersource processor connection (30+ documented); declines, processor response codes, AVS, CVN and merchant advice values come from them.",
    "Card networks (Visa, Mastercard) for merchant advice codes.",
    "Visa Acceptance Solutions serves the same documentation and formats under its own brand.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "cybersource.payment_response",
      description:
        "REST Payments API v2 HTTP 201 responses for authorizations, sales, captures, reversals, refunds, credits and voids (status, errorInformation, processorInformation, _links)",
      status: "supported",
    },
    {
      id: "cybersource.error_response",
      description:
        "REST Payments API v2 HTTP 400 and 502 error bodies (flat submitTimeUtc, status, reason, message, details[])",
      status: "supported",
    },
    {
      id: "cybersource.webhook",
      description:
        "Webhook notification envelope, version 3 (eventType, productId, transactionTraceId, payload); payment event payloads are encrypted",
      status: "limited",
    },
    {
      id: "cybersource.transaction_details",
      description:
        "Transaction Details response (GET /tss/v2/transactions/{id}): rootId, applicationInformation with rCode, numeric reasonCode and applications[]",
      status: "experimental",
    },
    {
      id: "cybersource.pay_by_bank_payload",
      description:
        "Decrypted Pay by Bank notification payload (flat object with dotted keys), alone or inside the envelope",
      status: "experimental",
    },
    {
      id: "cybersource.encrypted_message",
      description:
        "Message-level encryption wrapper ({ encryptedResponse } or { encryptedRequest }); recognized, cannot be decrypted",
      status: "unsupported",
    },
    {
      id: "cybersource.reporting",
      description: "Reporting API v3 chargeback and notification-of-change records",
      status: "unsupported",
    },
    {
      id: "cybersource.simple_order",
      description: "Simple Order API (SOAP and name-value pairs), deprecated; XML is not accepted",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Cybersource-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "response-codes",
      title: "Transaction response codes",
      url: `${DEV}/api/reference/response-codes.md`,
    },
    {
      topic: "response-code-file",
      title: "Response code file (status, reason, recommended action)",
      url: `${DEV}/content/dam/cybsdeveloper2021/responsecode.json`,
    },
    {
      topic: "payments",
      title: "Payments Developer Guide (REST, Visa Platform Connect)",
      url: PAYMENTS_GUIDE,
    },
    { topic: "reason-codes", title: "Reason codes (numeric)", url: REASON_CODES },
    { topic: "webhooks", title: "Webhooks Implementation Guide", url: WEBHOOKS },
    {
      topic: "rest-getting-started",
      title: "REST API getting started (authentication, message-level encryption)",
      url: `${DEV}/docs/cybs/en-us/platform/developer/all/rest/rest-getting-started.md`,
    },
    {
      topic: "transaction-search",
      title: "Transaction Search and Details API",
      url: `${DEV}/docs/cybs/en-us/txn-search/developer/all/rest/txn-search.md`,
    },
    {
      topic: "api-fields",
      title: "REST API field reference",
      url: `${DEV}/docs/cybs/en-us/api-fields/reference/all/rest/api-fields.md`,
    },
    {
      topic: "avs",
      title: "AVS codes",
      url: `${DEV}/docs/cybs/en-us/avs-codes/reference/all/na/avs-codes.md`,
    },
    {
      topic: "cvn",
      title: "CVN codes",
      url: `${DEV}/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance/sa-cvn-codes.md`,
    },
    {
      topic: "pay-by-bank-webhooks",
      title: "Pay by Bank webhook notifications",
      url: `${DEV}/docs/cybs/en-us/pay-by-bank/developer/all/rest/pay-by-bank/paybybank-intro-services/paybybank-webhook-intro.md`,
    },
    {
      topic: "openapi",
      title: "Official OpenAPI specification (Java SDK repository)",
      url: "https://raw.githubusercontent.com/CyberSource/cybersource-rest-client-java/master/generator/cybersource-rest-spec.json",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "event type with a fingerprint of the webhook id, the event date and the payload (transactionTraceId is new on every retry attempt, so it is not used)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Cybersource retries a notification when the endpoint does not respond and gives every attempt a new transactionTraceId, so the trace id cannot be used to detect repeats. Make the handler idempotent on the transaction id inside the decrypted payload and the event type, and confirm the transaction state with Transaction Details before acting.",
    docsUrl: WEBHOOKS,
  },
  limitations: [
    "Payment event and Unified Checkout notifications require message-level encryption, and the decrypted payload of card payment events is not documented. Such notifications are placed on the timeline by their event type only: they carry no readable transaction id, amount or reason, so they cannot be linked to other records.",
    "Two encryption formats are documented (JSON Web Encryption in the webhook guide, a {CBC}-prefixed string in the Pay by Bank example); neither can be decrypted offline. REST responses wrapped in encryptedResponse are recognized but not analyzed.",
    "There is no stable notification id. Repeated deliveries are recognized only when the event type, webhook id, event date and payload (or ciphertext) are identical; whether a retried payment notification keeps the same ciphertext is not documented. Acknowledgement rules, delivery order and the requestType value of a retry are not documented.",
    "The webhook eventDate carries no time zone, so it is shown as supplied and not used to order events.",
    "payments.authorization.status.rejected also covers SERVER_TIMEOUT and SERVICE_TIMEOUT, whose real outcome is unknown; with an encrypted payload the actual status cannot be read. payments.credit.status.updated repeats the description of the accepted event and is shown with an unknown outcome. Event types without payment semantics (risk, invoicing, token management) are shown without amounts or references; payload fields of recurring billing and Pay by Link events are not documented.",
    "Follow-on responses (capture, reversal, refund, credit, void) do not echo the id of the original payment; only the request path and the Transaction Details rootId link them. Pasted responses are therefore linked only by their own request id, by Transaction Details rootId and relatedTransactions links, and by the same id on incremental authorizations. clientReferenceInformation.code is merchant-defined and only optionally unique, so it is never used as a key.",
    "The operation of a response is read from _links (self, capture, authReversal, void), from the service-specific amount object or from the status. Refunds and stand-alone credits share the /pts/v2/credits/ resource and cannot always be told apart. A DECLINED or AUTHORIZED response without _links is shown as a payment, although refund, credit and payout responses use the same statuses. A PENDING response without _links is shown as an unidentified follow-on operation.",
    "Settlement is not a payload state: a capture or refund PENDING means accepted and waiting for the batch, BATCHED means sent to the processor, and Cybersource is not told when funds move. Chargebacks appear only in Reporting API records, which are not analyzed.",
    "processorInformation.responseCode depends on the processor (30+) and Cybersource says not to use it to evaluate the result; it is shown verbatim and not decoded. AVS and CVN results are shown as codes only, because the same letter can mean different things for Cielo and Latin American Processing.",
    "Reason codes are decoded from errorInformation.reason (HTTP 201) or the top-level reason (HTTP 400 and 502). Values that appear only as OpenAPI enum names are decoded with possible confidence, DAGGREJECTED, DAGGDENIED and DSYSREJECTED with insufficient confidence. PROCESSOR_ERROR has conflicting descriptions (pick up card versus Invalid account) and is decoded with possible confidence.",
    "Payment insights categories are Cybersource's own retry advice and replace the reason's retry guidance on declines. Merchant advice codes are told apart by format (one digit for Visa, two for Mastercard, 00 to 05 for Barclays); when present, the stricter guidance is used. The documented example of a successful authorization carries category 01, so categories are only applied to declines.",
    "Transaction Details records are built from the documented field list; no complete example was reviewed. Amounts are not read from them. Only service names that match a REST service (ics_auth, ics_auth_reversal, ics_credit, ics_void) get a lifecycle stage; ics_bill, ics_decision and other names are shown without one. Numeric reason codes are decoded from the reason code table; code 267 is cited in the timeout guidance but missing from the table and is decoded with possible confidence. The rFlag vocabulary is not documented.",
    "Pay by Bank statuses are documented by name only; their stage and outcome follow the names. The decrypted payload uses the misspelled key reconcillationID, which is not read.",
    "HTTP 429 and 503 load-shedding responses, Secure Acceptance form posts, the Simple Order API, payouts-specific fields and Reporting API records are not analyzed. Plain-text error bodies are not documented and are not claimed.",
    "Category and retry guidance per reason are PandaPayLens suggestions that follow Cybersource's recommended actions where given. A timeout or SERVER_ERROR is never shown as safe to retry: Cybersource asks to check the status first and may reverse the authorization automatically.",
    "Webhook signatures (v-c-signature) cannot be verified from pasted payloads and are never copied; a pasted notification is never treated as authentic.",
  ],
  samples: ["cybersource-capture-refund", "cybersource-insufficient-funds"],
};
