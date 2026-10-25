import type { ProviderManifest } from "@pandapaylens/core";

export const CCBILL_ADAPTER_VERSION = "0.1.0";

const INDUSTRIES = "https://ccbill.com/industries";

export const ccbillManifest: ProviderManifest = {
  id: "ccbill",
  displayName: "CCBill",
  version: CCBILL_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  // The research rates orchestration as limited (consumer-redirect cascades
  // in FlexForms only), so it is not claimed as a category.
  categories: [
    "payment_facilitator",
    "card_processing",
    "gateway",
    "merchant_account_intermediary",
  ],
  sectors: [
    { sector: "adult", source: "https://ccbill.com/industries/adult-business" },
    { sector: "dating", source: "https://ccbill.com/industries/dating" },
    { sector: "live cams", source: INDUSTRIES },
    {
      sector: "content creator platforms",
      source: "https://ccbill.com/industries/content-creator-platforms",
    },
    { sector: "streaming media", source: INDUSTRIES },
    { sector: "subscription", source: INDUSTRIES },
    { sector: "ecommerce (digital or physical goods)", source: INDUSTRIES },
    { sector: "billing and invoicing (business services)", source: INDUSTRIES },
    { sector: "CBD", source: "https://ccbill.com/industries/cbd" },
    { sector: "high-risk businesses generally", source: INDUSTRIES },
  ],
  regions:
    "Visa and Mastercard processing requires business and legal presence in the US, Canada or a listed European country. SCA is mandatory only for cards issued by EU-based banks. Cards and CCBill Pay support USD, EUR, GBP, AUD, CAD and JPY; ACH is US only and USD only. CCBill collects annual card brand high-risk registration fees. The Acceptable Use Policy prohibits gambling content and lists other businesses CCBill will not process. Licensing and regulator registrations are not documented in the pages reviewed.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers (account numbers use the documentation placeholders 999999 / 9999). CCBill publishes one literal webhook body (Expiration) and no literal Background Post body, so all other webhook, Background Post and REST fixtures were built from the documented field tables and OpenAPI examples. None is an official CCBill example.",
  dependencies: [
    "Card acquirers contracted by CCBill as a Visa Sponsored Merchant Program and Mastercard Payment Facilitator Program member (acquirers are not named in the documentation)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "ccbill.webhook",
      description:
        "Webhooks (20 event types), URL-encoded or JSON body. The event type is sent only in the URL query string.",
      status: "limited",
    },
    {
      id: "ccbill.background_post",
      description: "Background Post to the Approval Post URL or Denial Post URL (form fields)",
      status: "supported",
    },
    {
      id: "ccbill.rest.charge",
      description:
        "RESTful Transaction API charge response (approved, declineCode, declineText, denialId, subscriptionId), media types v1 and v2",
      status: "supported",
    },
    {
      id: "ccbill.rest.error",
      description:
        "RESTful API and 3DS error envelope (id, url, errors[], generalMessage, errorCode, timestamp)",
      status: "supported",
    },
    {
      id: "ccbill.rest.payment_token",
      description: "RESTful API payment token object (recognized, not analyzed)",
      status: "unsupported",
    },
    {
      id: "ccbill.legacy.api",
      description:
        "Legacy subscriptionManagement.cgi and billingApi.cgi CSV / XML responses (result codes are in the catalog; the CSV and XML text cannot be imported)",
      status: "unsupported",
    },
    {
      id: "ccbill.widget",
      description: "CCBill Advanced Widget (JavaScript) result and error objects",
      status: "unsupported",
    },
    {
      id: "ccbill.datalink",
      description: "Data Link extract CSV (merchant-configured columns)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Generic and lifecycle rules apply; there are no CCBill-specific rules.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "webhooks",
      title: "Webhooks user guide",
      url: "https://ccbill.com/doc/webhooks-user-guide",
    },
    {
      topic: "webhooks-overview",
      title: "Webhooks overview",
      url: "https://ccbill.com/doc/webhooks-overview",
    },
    {
      topic: "background-post",
      title: "Background Post",
      url: "https://ccbill.com/doc/background-post",
    },
    {
      topic: "decline-codes",
      title: "Postback decline codes",
      url: "https://ccbill.com/doc/background-post#postback_decline_codes",
    },
    {
      topic: "error-codes",
      title: "RESTful API and 3DS error codes",
      url: "https://ccbill.com/doc/error-codes",
    },
    {
      topic: "rest-api",
      title: "RESTful Transaction API",
      url: "https://ccbill.com/doc/ccbill-restful-transaction-api",
    },
    {
      topic: "rest-openapi",
      title: "RESTful API OpenAPI files (official repository)",
      url: "https://github.com/CCBill/restful-api-guide",
    },
    {
      topic: "legacy-api",
      title: "CCBill API guide",
      url: "https://ccbill.com/doc/ccbill-api-guide",
    },
    {
      topic: "rebill-failure",
      title: "RenewalFailure (Declined Rebill)",
      url: "https://ccbill.com/doc/renewal-failure-declined-rebill",
    },
    { topic: "chargeback", title: "Chargeback webhook", url: "https://ccbill.com/doc/chargeback" },
    { topic: "web-verify", title: "Web Verify", url: "https://ccbill.com/doc/web-verify" },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "Background Post: subscription_id (approval) or denialId (denial). Webhooks: none (CCBill documents no event id or delivery id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Make the Background Post handler idempotent per subscription_id or denialId, because CCBill resends unsuccessful posts up to 30 times. For webhooks, deduplicate in your own system (for example on eventType, subscriptionId, transactionId and timestamp); CCBill documents no delivery key, and up to four webhook URLs can receive the same event.",
    docsUrl: "https://ccbill.com/doc/background-post",
  },
  limitations: [
    "The webhook event type is sent only in the URL query string (eventType), never in the body. It is read from a pasted raw HTTP request or full URL; when only the body is pasted, it is inferred from the field set only where the documented field tables make it unambiguous.",
    "Body-only webhooks that cannot be told apart are reported as an unidentified event with the candidate event types: Refund and Void have identical fields, Upgrade, UpSale and CrossSale differ only by event type, and an Expiration body (subscriptionId, clientAccnum, clientSubacc, timestamp) is a subset of every other event. Stage and outcome are only set when every candidate shares them.",
    "CCBill documents no webhook signature, event id, retry policy, acknowledgement rule or delivery order; authenticity guidance is IP-based only. A pasted webhook or Background Post is never treated as verified. Webhooks get no delivery key.",
    "Webhook failureCode is described as a decline code sent from the bank, with the example BE-140, which matches no published table. Numeric values are decoded with the decline code table at possible confidence; other values are shown verbatim with failureReason and insufficient confidence.",
    "Decline code 15 has two documented meanings (account still being processed, and declined by bank in every billing API example); both are shown with possible confidence.",
    "REST error numbers 100105 to 100109 mean different things at HTTP 400 and HTTP 500, 200000 is both the REST validation error and the 3DS unknown error, and 100100 also appears in a generic HTTP 500 example. Without the HTTP status the meanings are listed and confidence is reduced.",
    "REST v1 returns subscriptionId, and v1 and v2 return denialId, as JSON numbers larger than 2^53. Their precision is lost when the JSON is parsed, so such identifiers are not used as references and are flagged; string identifiers (v2 subscriptionId) are kept as sent.",
    "The REST declineCode is decoded with the Background Post decline table, which matches the documented REST examples; CCBill does not state explicitly that it is the same code space, so confidence is possible.",
    "Webhook timestamps (YYYY-MM-DD HH:MM:SS) have no documented time zone. They are read as UTC to order events; the absolute time may be offset.",
    "Whether transactionId on Refund, Void, Chargeback and Return is the original sale or the reversal record is not documented. Events are grouped by subscriptionId, transactionId, denialId and originalSubscriptionId; paymentAccount (a card hash) is never used for correlation.",
    "Only chargeback initiation is documented; later dispute stages and whether a Cancellation or Expiration follows a refund or chargeback are not documented. The rebill retry schedule is not documented beyond nextRetryDate.",
    "The exact eventType strings for RenewalSuccess and RenewalFailure are not shown literally in the documentation.",
    "Legacy API CSV and XML responses, Data Link CSV extracts, Advanced Widget objects and Dynamic Pricing errors are not imported; legacy result codes and subscription statuses are available in the catalog only.",
    "The Background Post content type is not documented. A form body pasted without HTTP headers must be URL-encoded (spaces as + or %20) to be read as form data.",
    "Payloads from the ISO Payment Gateway product are out of scope: it has no public technical documentation.",
  ],
  samples: ["ccbill-renewal-failure", "ccbill-expiration-http", "ccbill-denial"],
};
