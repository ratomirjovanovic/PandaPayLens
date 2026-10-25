import type { ProviderManifest } from "@pandapaylens/core";

export const PAYSAFE_ADAPTER_VERSION = "0.1.0";

const D = "https://developer.paysafe.com/en";
const SITE = "https://www.paysafe.com/en";

export const paysafeManifest: ProviderManifest = {
  id: "paysafe",
  displayName: "Paysafe",
  version: PAYSAFE_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Paysafe serves payment facilitators (sub-merchant fields, PayFac
  // Sub-merchant API) but does not call itself one in the pages reviewed;
  // orchestration and merchant_account_intermediary are not claimed.
  categories: ["card_processing", "acquiring", "gateway", "alternative_payment_method", "wallet"],
  sectors: [
    { sector: "iGaming", source: `${SITE}/industries-we-serve/igaming/` },
    { sector: "Video gaming", source: `${SITE}/video-gaming/` },
    { sector: "Crypto", source: `${SITE}/crypto/` },
    { sector: "Forex and online trading", source: `${SITE}/forex/` },
    {
      sector:
        "Financial services (fintechs, eWallets, PSPs and payment facilitators, digital banking)",
      source: `${SITE}/industries-we-serve/financial-services/`,
    },
    {
      sector: "eCommerce (ticketing and sports, subscriptions, bill payments, property management)",
      source: `${SITE}/industries-we-serve/ecommerce/`,
    },
    { sector: "Travel and airlines", source: `${SITE}/industries-we-serve/travel/` },
    {
      sector: "Charities and nonprofits",
      source: `${SITE}/industries-we-serve/charities-and-nonprofits/`,
    },
    { sector: "Retail and hospitality", source: `${SITE}/retail-and-hospitality/` },
    {
      sector:
        "SMB categories (auto repair, chiropractors, dental practice, government and utilities, petroleum, restaurants)",
      source: `${SITE}/industries-we-serve/`,
    },
  ],
  regions:
    "Regulated entities per Paysafe's regulatory disclosures: UK FCA e-money firms (Paysafe Financial Services Limited, Skrill Limited, Prepaid Services Company Limited), Central Bank of Ireland (Paysafe Payment Solutions Limited, also authorised under MiCA; Paysafe Prepaid Services Limited), FINTRAC and Revenu Quebec MSB licences, and Skrill USA registered with FinCEN; Paysafe is a registered ISO/MSP of several US banks. The legacy Cards API is available to platform partners in North America only, code 3060 applies to UK/EU acquiring, recipient data applies only to MCC 6012 with a UK trading address, and Pay by Bank is a US method. Paysafe publishes a list of sectors it rejects (onboarding criteria page); a listed sector says nothing about whether a merchant will be approved.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Their shapes follow the transcribed examples of the Payments API OpenAPI file, the card errors page, the card and EPS webhook pages and the official Java SDK test fixtures, with synthetic values; fixtures without a published example (refund request, standalone credit return, Payment Scheduler) are built from the documented field tables and event lists. Identifiers carry the PPLsynth marker instead of Paysafe's UUIDs. None is an official Paysafe example.",
  dependencies: [
    "Card processors and acquirers whose raw responses Paysafe relays in gatewayResponse (processor tables OPN/NAG, MON, TAS/VPS, FRD and VAN; the OpenAPI text names Worldpay (VAN) as one acquirer).",
    "Alternative payment methods and wallets routed through Paysafe (for example Skrill Quick Checkout, Neteller, PaysafeCard, PayPal and SafetyPay); their results arrive in Paysafe's own format with the downstream data nested in gatewayResponse.",
    "Interchecks for instant card payouts (standalone credits).",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "paysafe.resource",
      description:
        "Payments API v1 resource responses (payment handles, payments, settlements, refunds, void authorizations, standalone and original credits, verifications) with status, gatewayResponse, settlements[] and, for HTTP 402 declines, the error object",
      status: "limited",
    },
    {
      id: "paysafe.error",
      description:
        "Payments API v1 error body (error.code, message, details, fieldErrors, additionalDetails with ADVICE and ISO_RESPONSE entries), or an error response that carries only the X-Application-Status-Code header",
      status: "supported",
    },
    {
      id: "paysafe.webhook",
      description:
        "Payments API webhooks in the documented envelopes (eventName, payload, attemptNumber, resourceId, eventDate, with eventType, type, mode or links[]); a flat resource posted without an envelope is read as a resource",
      status: "limited",
    },
    {
      id: "paysafe.list",
      description:
        "List responses with a meta object (numberOfRecords, limit, page); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "paysafe.legacy_cards",
      description:
        "Legacy Cards API requests (/cardpayments/v1/accounts/...); recognized by the request path, not analyzed",
      status: "unsupported",
    },
    {
      id: "paysafe.client_sdk",
      description:
        "Paysafe Checkout and Paysafe JS browser callbacks (code, displayMessage, detailedMessage); not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // 9 error tables, merchant advice codes and ISO response codes are decoded
    // with strong confidence; processor tables only with possible confidence.
    errorDecoding: "supported",
    // Refund, void, settlement, credit and verification bodies have no field
    // that names the resource; they are told apart only by the request path,
    // the webhook event name or a few markers.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Paysafe-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "api-reference", title: "Payments API reference", url: `${D}/payments-api/` },
    {
      topic: "openapi",
      title: "Payments API OpenAPI file (Error Summary and processor tables)",
      url: "https://developer.paysafe.com/fileadmin/openapi-spec/payments-api/apis/paysafe-ph-payments-api.yaml",
    },
    {
      topic: "card-errors",
      title: "Card errors, merchant advice codes and ISO response codes",
      url: `${D}/api-docs/payments-api/add-payment-methods/cards/card-errors/`,
    },
    {
      topic: "card-payments",
      title: "Card payments and card webhook examples",
      url: `${D}/api-docs/payments-api/add-payment-methods/cards/about-card-payments/`,
    },
    {
      topic: "get-started",
      title: "Payments API get started",
      url: `${D}/api-docs/payments-api/get-started/`,
    },
    {
      topic: "settlement-flow",
      title: "Settlement flow diagrams",
      url: `${D}/api-docs/payments-api/settlement-flow-diagrams/`,
    },
    {
      topic: "webhooks",
      title: "Configure webhooks",
      url: `${D}/api-docs/payments-api/configure-webhooks/`,
    },
    {
      topic: "webhook-events",
      title: "Webhook events",
      url: `${D}/api-docs/paysafe-checkout/webhook-events/`,
    },
    {
      topic: "eps-webhooks",
      title: "EPS webhooks (full envelope examples)",
      url: `${D}/api-docs/payments-api/add-payment-methods/eps/webhooks/`,
    },
    {
      topic: "chargebacks",
      title: "Transactions and chargebacks",
      url: `${D}/support/reference-information/transactions-and-chargebacks/`,
    },
    {
      topic: "java-sdk",
      title: "Java SDK (error handling, correlation id, webhook handler)",
      url: `${D}/api-docs/server-side-sdks-payments-api/java/`,
    },
    {
      topic: "onboarding-criteria",
      title: "Onboarding criteria (rejected sectors)",
      url: `${D}/support/reference-information/onboarding-criteria/`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "eventName, resourceId, payload status and eventDate together; Paysafe documents no event id or delivery id",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Paysafe asks merchants to ignore a notification received again for an already processed event and to make the endpoint idempotent. It sends at most 3 attempts (attemptNumber counts them) with undocumented intervals, documents no ordering, and recommends a GET call to reconfirm the status a webhook reports.",
    docsUrl: `${D}/api-docs/payments-api/configure-webhooks/`,
  },
  limitations: [
    "Paysafe documents no chargeback or dispute resource, endpoint or webhook for the Payments API. Chargebacks and retrieval requests are handled in the Merchant Back Office, so no dispute timeline can be built. Error 3425 (refund blocked because a chargeback exists) is the only chargeback signal in the API.",
    "Settlements, refunds and void authorizations carry their parent id only in the request path (/payments/{paymentId}/settlements, /settlements/{settlementId}/refunds, /payments/{paymentId}/voidauths). They are linked to their parent only when a pasted HTTP request line contains that path; otherwise their own id is used as the reference and they are reported as not linked. A settlement made with settleWithAuth true (or by a one-step APM) shares its id with the payment and is linked through that id.",
    "Refund, void, settlement, credit and verification responses share their fields. Without a request path, a webhook event name, a documented webhook type or a distinguishing field (settleWithAuth, availableToSettle, settlements[] for payments, availableToRefund for settlements, handle fields for payment handles), the resource type is shown as unknown.",
    "The processor tables (OPN/NAG, MON, TAS/VPS, FRD, VAN) are documented by processor name without saying which field carries them. gatewayResponse.responseCode is read with the table named by gatewayResponse.code only by inference (the one documented example, VPS with 00, matches the TAS/VPS table), so these decodes are never stronger than possible; GPS and other acquirer codes have no table. The AVS letters listed under error 3007 are read from gatewayResponse.avsCode by the same kind of inference.",
    "Documented but not decoded, because Paysafe does not document which payload field carries them: the Interchecks issuer reasons of ERR_OCT_DECLINE, SafetyPay and PayPal downstream codes (Paysafe maps them to its own error codes), the ACH, BACS, EFT and SEPA return codes (Merchant Back Office reports only) and the Paysafe JS client codes. Interchecks names in error.code are decoded with possible confidence, except the three Add Card codes the OpenAPI file shows as error codes.",
    "Raw downstream statuses in gatewayResponse.status (for example Skrill Quick Checkout or SafetyPay values) are not explained by Paysafe and are shown as sent. Skrill data nested in a Paysafe payload stays a Paysafe record; Skrill's own formats belong to the Skrill adapter.",
    "Webhooks have no event id. The delivery key combines eventName, resourceId, the payload status and eventDate as the research suggests; whether eventDate stays the same across retries is not documented. attemptNumber above 1 marks a redelivery. Signatures (Signature header, HMAC-SHA256) cannot be verified from pasted data, so a pasted webhook is never treated as authentic; only the presence of the header is reported.",
    "Three webhook envelope shapes appear in Paysafe's material: a flat resource (read as a resource), a full envelope with eventType and mode, and the SDK envelope with type. attemptNumber is a string in examples and an integer in the SDK; mode is live even in examples that link to the test host. Several documented examples have trailing commas, which are accepted with a warning.",
    "A payment handle COMPLETED status only means the handle was used; Paysafe sets it whatever the payment outcome, so it is shown with an unknown outcome. Handles and payments are linked through the paymentHandleToken, which is never copied: only a one-way hash of it is used as a correlation key.",
    "merchantRefNum is shown but never used for linking: it is a merchant reference, settlement examples reuse the payment's value, and the duplicate check that keeps it unique can be turned off (dupCheck).",
    "Payment Scheduler webhooks (scheduled payments, retries, trials, suspension, cancellation) are interpreted from the event name only; their payload shape and where the execution stage appears are not documented. Registration events are shown without a payment reference.",
    "Statuses outside the OpenAPI enums (ERROR for handles, refunds, settlements and credits, CANCELLED for handles, PROCESSING for settlements and refunds) are accepted from the webhook pages. statusReason is shown as sent; only PSP_REJECTED, AUTH_EXPIRED and AUTO_SETTLE_EXPIRED_PAYMENT_HANDLE are documented. riskReasonCode values are not documented.",
    "A settlement COMPLETED means Paysafe completed its settlement batch; when funds reach the merchant is not documented. A COMPLETED standalone credit can later fail, be cancelled or be returned (SA_CREDIT_FAILED, SA_CREDIT_CANCELLED, SA_CREDIT_RETURN_COMPLETED).",
    "Timestamps without a time zone (for example txnTime 2025-04-10T17:21:33.4 in a webhook example) are shown as sent and not used as event time. settlements[].txnTime can be epoch milliseconds or an ISO string.",
    "List responses (meta with numberOfRecords, limit, page) and legacy Cards API requests are recognized but not analyzed; the name of the list array is not documented. Legacy Cards API responses pasted without the request line resemble Payments API payments and are read with the same rules, although the legacy reference was not reviewed.",
    "An error response with a plain-text or empty body is recognized only through the X-Application-Status-Code header; without it nothing in the record identifies Paysafe.",
    "Numeric code spaces overlap: 3060 means Strong Customer Authentication required on the card errors page but an unsolicited reversal in the Interchecks mapping, and 3703 differs in the same way. Both meanings are shown. DW-CUSTOMER-CONFLICT appears only in an SDK test fixture and is decoded as unknown.",
    "Category and retry guidance per code are PandaPayLens suggestions. Paysafe's own retry signals are the merchant advice codes (ADVICE-01 to ADVICE-14, ADVICE-42), code 1100 (retry later) and the VSPS rows of the processor tables; Paysafe documents no idempotency header, so a retry after an unknown outcome should start with a lookup by id or merchantRefNum.",
  ],
  samples: ["paysafe-declined-advice", "paysafe-eps-lifecycle"],
};
