import type { ProviderManifest } from "@pandapaylens/core";

export const BLUESNAP_ADAPTER_VERSION = "0.1.0";

const JSON_REF = "https://developers.bluesnap.com/v8976-JSON/reference";
const XML_REF = "https://developers.bluesnap.com/v8976-XML/reference";
const TOOLS_REF = "https://developers.bluesnap.com/v8976-Tools/reference";
const BASICS_REF = "https://developers.bluesnap.com/reference";
const SUPPORT = "https://support.bluesnap.com/docs";
const WHO_WE_SERVE = "https://www.bluesnap.com/who-we-serve/";

export const bluesnapManifest: ProviderManifest = {
  id: "bluesnap",
  displayName: "BlueSnap",
  version: BLUESNAP_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // acquiring: BlueSnap lists Israel and LatAm local card acquiring guides; the
  // scope of its own acquiring is not documented in the reviewed sources.
  // Not claimed: payment_facilitator, wallet and orchestration.
  categories: [
    "card_processing",
    "gateway",
    "alternative_payment_method",
    "merchant_account_intermediary",
    "acquiring",
  ],
  sectors: [
    { sector: "B2B", source: WHO_WE_SERVE },
    { sector: "B2C / eCommerce", source: WHO_WE_SERVE },
    { sector: "SaaS", source: WHO_WE_SERVE },
    { sector: "vertical software platforms", source: WHO_WE_SERVE },
    { sector: "software", source: WHO_WE_SERVE },
    { sector: "education software", source: WHO_WE_SERVE },
    { sector: "healthcare software", source: WHO_WE_SERVE },
    { sector: "business management software", source: WHO_WE_SERVE },
    { sector: "retail", source: WHO_WE_SERVE },
    { sector: "logistics and freight", source: WHO_WE_SERVE },
    { sector: "manufacturing", source: WHO_WE_SERVE },
    { sector: "subscriptions and recurring billing", source: WHO_WE_SERVE },
  ],
  regions:
    "Legal entities: BlueSnap Payment Services (Ireland) Ltd, authorised by the Central Bank of Ireland (C431532); BlueSnap Payment Services Ltd, authorised by the UK FCA (629580); BlueSnap Payment Services Israel Ltd, authorised by the Israel Securities Authority; entities in Canada, Australia, India and the US without a stated licence. transactionRegion values are AU, CA, EU, IL, IN, UK and US. Shoppers in OFAC sanctioned countries are refused (15012). Mandates are for Australia and Canada only; some card brands are only for US, UK and EUR merchants; proceeding without 3-D Secure is not available for Europe and the UK. BlueSnap's Prohibited Items list names internet gambling, virtual gaming credits, cryptocurrency, foreign currency exchange and binary options, debt relief, weapons and several adult categories. Eligibility depends on jurisdiction, licensing and underwriting.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads with PPLsynth identifiers. Card transaction, refund and error bodies follow the field tables and response examples of the public BlueSnap Payment API (JSON) reference and the declined authorizations support guide; the XML card transaction and error documents carry the same content with the kebab-case element names and the http://ws.plimus.com namespace of the Payment API (XML) reference; webhooks follow the two documented webhook examples (CHARGE, CANCELLATION) and, for DECLINE, REFUND, CHARGEBACK, RECURRING and the other types without a published example, the webhook parameter reference. BlueSnap transaction IDs are numbers; the fixtures use PPLsynth strings instead. None is an official BlueSnap example.",
  dependencies: [
    "Payroc: BlueSnap states that Payroc acquired it in 2025 (site footer: BlueSnap, Powered by Payroc). The documented API and webhook formats are still BlueSnap's own.",
    "Card processors and issuers behind BlueSnap, not named in the documentation; BlueSnap normalizes their responses into its own errorName values and may append the processor's code and text to description.",
    "Kount (fraud screening): fraudEvents.fraudTransactionId is a Kount ID and some fraud results map Kount response keys.",
    "Chargebacks911 (dispute handling): chargebackId is the Chargebacks911 case number and CHARGEBACK_STATUS_CHANGED reports its events.",
    "PayPal, ACH/ECP, SEPA Direct Debit, BECS Direct Debit and Pre-Authorized Debit, routed by BlueSnap as alternative payment methods.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "bluesnap.card_transaction",
      description:
        "Payment API (JSON) card transaction responses: Auth Only, Auth Capture, Capture, Auth Reversal and Retrieve (cardTransactionType, transactionId, processingInfo.processingStatus, refunds and chargebacks lists)",
      status: "supported",
    },
    {
      id: "bluesnap.refund",
      description: "Payment API (JSON) refund responses (refundTransactionId, refundStatus)",
      status: "supported",
    },
    {
      id: "bluesnap.error",
      description:
        "Payment API (JSON) error body: message[] with errorName, code, description, invalidProperty and fraudEvents, decoded by errorName",
      status: "supported",
    },
    {
      id: "bluesnap.webhook",
      description:
        "Webhooks (IPNs) as application/x-www-form-urlencoded bodies, identified by transactionType (34 documented names)",
      status: "limited",
    },
    {
      id: "bluesnap.throttling",
      description:
        "HTTP 429 or 503 responses whose plain-text body is one of the five documented throttling messages",
      status: "limited",
    },
    {
      id: "bluesnap.alt_transaction",
      description:
        "Payment API (JSON) alt transaction responses (ecpTransaction, sepaDirectDebitTransaction, paypalTransaction, becsDirectDebitTransaction, acssDirectDebitTransaction); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "bluesnap.card_transaction_xml",
      description:
        "Payment API (XML, namespace http://ws.plimus.com) card transaction responses (<card-transaction> with card-transaction-type, transaction-id, processing-info), read with the JSON logic through the kebab-case element names",
      status: "limited",
    },
    {
      id: "bluesnap.error_xml",
      description:
        "Payment API (XML, namespace http://ws.plimus.com) error body: <messages> with message elements holding error-name, code, description and invalid-property, decoded by error-name like the JSON body",
      status: "supported",
    },
    {
      id: "bluesnap.payment_api_xml",
      description:
        "Other XML documents in the namespace http://ws.plimus.com (refund, alt-transaction, vaulted-shopper, recurring-subscription and any other root); recognized as BlueSnap, not analyzed",
      status: "unsupported",
    },
    {
      id: "bluesnap.extended_payment_api",
      description:
        "Extended Payment API (XML only in the documentation); its element names are not in the reviewed sources, so its documents are only recognized through the namespace as BlueSnap XML, not analyzed",
      status: "unsupported",
    },
    {
      id: "bluesnap.batch_transactions",
      description:
        "Batch transaction results (processingInfo.processingErrors.processingError[]); not analyzed",
      status: "unsupported",
    },
    {
      id: "bluesnap.browser_callbacks",
      description:
        "Hosted Payment Fields and 3-D Secure JavaScript callbacks (onError, sdkResponse); client side, not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Every documented errorName in the Payment API and Tools error tables is
    // decoded, with BlueSnap's own advice for card errors.
    errorDecoding: "supported",
    // Card and refund responses are analyzed; alt transaction responses are
    // only recognized, and approval times are Pacific time without a zone.
    paymentResponses: "limited",
    // No event or delivery id, no retry interval or ordering, no published
    // example for most types, and reason fields are free text.
    webhookParsing: "limited",
    // No timestamp carries a time zone, so events follow the input order.
    timeline: "limited",
    // transactionId equals referenceNumber, but the link between refund or
    // chargeback IDs and reversalRefNum is an inference.
    correlation: "limited",
    // Only the provider-agnostic rules apply.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "errors",
      title: "Error handling overview",
      url: `${JSON_REF}/error-handling-overview`,
    },
    { topic: "messages", title: "message object", url: `${JSON_REF}/messages` },
    { topic: "messages-xml", title: "message object (XML)", url: `${XML_REF}/messages` },
    {
      topic: "card-transaction-errors",
      title: "Card transaction errors",
      url: `${JSON_REF}/card-transaction-errors`,
    },
    {
      topic: "alt-transaction-errors",
      title: "Alt transaction errors",
      url: `${JSON_REF}/alt-transaction-errors`,
    },
    { topic: "refund-errors", title: "Refund errors", url: `${JSON_REF}/refund-errors` },
    { topic: "fraud-errors", title: "Fraud errors", url: `${JSON_REF}/fraud-errors` },
    {
      topic: "idempotency-errors",
      title: "Idempotency errors",
      url: `${JSON_REF}/idempotency-errors`,
    },
    {
      topic: "subscription-errors",
      title: "Subscription and billing plan errors",
      url: `${JSON_REF}/subscription-billing-plan-errors`,
    },
    { topic: "wallet-errors", title: "Wallet errors", url: `${TOOLS_REF}/wallet-errors` },
    {
      topic: "hosted-payment-fields-errors",
      title: "Hosted Payment Fields errors",
      url: `${TOOLS_REF}/hosted-payment-field-errors`,
    },
    {
      topic: "card-transaction",
      title: "Card transaction object",
      url: `${JSON_REF}/card-transaction`,
    },
    {
      topic: "processing-info",
      title: "processingInfo object",
      url: `${JSON_REF}/processing-info`,
    },
    { topic: "auth-capture", title: "Auth Capture", url: `${JSON_REF}/auth-capture` },
    { topic: "auth-capture-xml", title: "Auth Capture (XML)", url: `${XML_REF}/auth-capture` },
    {
      topic: "card-transaction-errors-xml",
      title: "Card transaction errors (XML)",
      url: `${XML_REF}/card-transaction-errors`,
    },
    { topic: "refund", title: "Refund", url: `${JSON_REF}/refund` },
    { topic: "idempotency", title: "Idempotency", url: `${BASICS_REF}/idempotency` },
    { topic: "webhooks", title: "Webhooks (IPNs)", url: `${BASICS_REF}/webhooks-ipns` },
    {
      topic: "webhook-names",
      title: "Webhook name reference",
      url: `${SUPPORT}/ipns-name-reference`,
    },
    {
      topic: "webhook-parameters",
      title: "Webhook parameter reference",
      url: `${SUPPORT}/ipn-parameter-reference`,
    },
    { topic: "webhook-faq", title: "Webhook FAQs (retries)", url: `${SUPPORT}/ipn-faqs` },
    {
      topic: "webhook-setup",
      title: "Webhook setup (security header)",
      url: `${SUPPORT}/ipn-setup`,
    },
    {
      topic: "declines",
      title: "Understanding your declined authorizations",
      url: `${SUPPORT}/understanding-your-declined-authorizations`,
    },
    { topic: "ach-returns", title: "ACH/ECP return codes", url: `${SUPPORT}/ecp` },
    { topic: "chargebacks", title: "About chargebacks", url: `${SUPPORT}/about-chargebacks` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "transactionType, referenceNumber, reversalRefNum, cbStatus and transactionDate (BlueSnap documents no event or delivery id; this combination is the research file's suggestion)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "BlueSnap retries a webhook up to 11 times until it receives an empty HTTP 200 OK, and a manual resend from the Merchant Portal produces a duplicate by design. Webhooks carry no event id, so make the handler idempotent per transactionType and referenceNumber (plus reversalRefNum and cbStatus for refunds and chargebacks), and retrieve the transaction before acting on an event, since the delivery order is not documented.",
    docsUrl: `${SUPPORT}/ipn-faqs`,
  },
  limitations: [
    "The JSON Payment API, the XML Payment API card transaction and error documents, and form-encoded webhooks are analyzed. Other XML documents in the namespace http://ws.plimus.com (refund, alt-transaction, vaulted-shopper, recurring-subscription) and the Extended Payment API, whose element names are not in the reviewed sources, are recognized as BlueSnap XML but not analyzed. Alt transaction responses (ACH/ECP, SEPA, PayPal, BECS, Pre-Authorized Debit) are recognized but not analyzed; batch transaction results, browser callbacks (Hosted Payment Fields, 3-D Secure) and the Reporting API are not analyzed.",
    "XML is claimed only in BlueSnap's namespace http://ws.plimus.com; the same elements without that namespace are not attributed to BlueSnap. The XML Payment API has the same semantics as the JSON one, and its kebab-case element names are read as the corresponding JSON fields (card-transaction-type as cardTransactionType, processing-info as processingInfo, error-name as errorName, invalid-property as invalidProperty). The names of elements the reviewed sources do not list, such as the children of fraud-events, are read through that same correspondence and are an inference. Attributes are ignored, empty elements count as absent, and XML gives every value as text, so true and false are read as booleans. Errors in XML are decoded by error-name exactly like the JSON body; the XML card error page lacks four names of the JSON page, which are still decoded from the JSON table.",
    "Errors are decoded by errorName, not by the numeric code: 37 card error names share 14002, and some numbers mean different things on different pages (14034, 20051, 24011, 90014, 90032). When a name appears in several tables with different guidance (for example NO_AVAILABLE_PROCESSORS, EXPIRED_TOKEN, INVALID_CARD_NUMBER), the card transaction reading is used with possible confidence and all readings are listed. A code alone, or an undocumented name, is decoded only when the code belongs to a single documented row, with possible confidence.",
    "Processor (issuer) decline codes are not documented. A processor code and text that BlueSnap appends to description (for example after 'processing failure.:') is shown as provider text only and is not decoded.",
    "Category and retry guidance per error are PandaPayLens suggestions. BlueSnap's own advice is shown for card transaction errors; where its pages conflict (SYSTEM_TECHNICAL_ERROR: do not retry on the Payment API page, retry on the Extended Payment API page) the Payment API advice is used.",
    "Webhooks carry no event or delivery id. The delivery key combines transactionType, referenceNumber, reversalRefNum, cbStatus and transactionDate; whether transactionDate stays the same across BlueSnap's retries is not documented, and its minute precision can make two genuine events in the same minute look like one.",
    "No BlueSnap timestamp is used as event time: card transaction approval times are Pacific time without a zone, webhook transactionDate has no documented time zone, and refund and chargeback dates have no documented format. They are shown as sent, and events follow the input order.",
    "Webhook reason fields (declineReason, failureReason, cancelReason, reversalReason) are free text without a documented format. A documented errorName or ACH return code found in them is decoded with possible confidence (strong when the field holds only the ACH code); anything else is shown as provider text with an unknown category. errorProcessingCode is undescribed and shown as a sub-code only. Card brand chargeback reason codes are not decoded.",
    "Webhook amounts are read from invoiceChargeAmount with invoiceChargeCurrency (falling back to invoiceAmount with currency) in the documented #,###.## format, for payment and authorization events only. The research documents the format but not the exact meaning of each amount field. reversalAmount has no documented currency and is shown as an attribute only.",
    "transactionId and referenceNumber are the same BlueSnap ID, and originalRefNum links recurring charges to the initial transaction. Refund and chargeback IDs (refundTransactionId, chargebackTransactionId) are linked to webhook reversalRefNum on the inference, not stated by BlueSnap, that they are the same values. Declined API calls return no transaction ID and cannot be linked. merchantTransactionId is shown but never used for linking.",
    "The webhook security header (Bls-Ipn-Timestamp, Bls-Signature) is described inconsistently and authKey needs the merchant's Data Protection Key, so a pasted webhook is never treated as verified. Only the presence of authKey (and whether it has the shape of an MD5 hex digest) and of the Bls-Signature header is reported; their values are never copied.",
    "PENDING_REFUND is sent both when a pending refund starts and when it is deleted after 3 months of failed attempts; the payload does not say which, so it is shown as pending. Chargeback outcomes are left unknown; cbStatus (New, Working, Completed_Won, Completed_Lost, Completed_Pending) is shown as the provider status. RDR appears in the parameter reference without a description and is reported as an unknown event type. The PAYOUT webhook is recognized only when it carries transactionType.",
    "Throttling responses (HTTP 429 or 503) are recognized only when the body is plain text equal to one of the five documented messages; BlueSnap does not document the field that carries them. Bodies of HTTP 403, 404 and 500 responses are not documented and are not attributed to BlueSnap.",
    "acquiring is listed because BlueSnap publishes local card acquiring guides for Israel and LatAm; the scope of its own acquiring is not documented in the reviewed sources. Sectors are BlueSnap's own marketing categories and say nothing about approval.",
    "Kount response keys 323 and 332 are catalogued but not decoded, because where they appear in a payload is not documented. CVV, AVS and 3-D Secure values are shown as attributes and not treated as errors.",
  ],
  samples: ["bluesnap-webhook-lifecycle", "bluesnap-do-not-honor"],
};
