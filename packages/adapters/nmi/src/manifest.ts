import type { ProviderManifest } from "@pandapaylens/core";

export const NMI_ADAPTER_VERSION = "0.1.0";

const INDUSTRIES = "https://www.nmi.com/who-we-serve/other-industries/";

export const nmiManifest: ProviderManifest = {
  id: "nmi",
  displayName: "NMI",
  version: NMI_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  // The research rates merchant_account_intermediary (via the NMI Payments
  // product) as weak and unclear, so only gateway is claimed.
  categories: ["gateway"],
  // NMI names only general verticals; no high-risk sector is documented.
  sectors: [
    { sector: "Medical and dental practices", source: INDUSTRIES },
    { sector: "Membership and subscription businesses", source: INDUSTRIES },
    { sector: "Parking operators", source: INDUSTRIES },
    { sector: "Vending and kiosks", source: INDUSTRIES },
    { sector: "Nonprofits (donation processing)", source: INDUSTRIES },
    { sector: "Transit", source: INDUSTRIES },
    { sector: "Travel and entertainment", source: INDUSTRIES },
    { sector: "Food service", source: INDUSTRIES },
    { sector: "Hospitality", source: INDUSTRIES },
    { sector: "Educational institutions", source: INDUSTRIES },
  ],
  regions:
    "NMI lists certifications for the US, UK, EU and ROI and trades in the UK as Network Merchants Ltd. No country restriction list is published. Many features depend on the connected processor (Apple Pay, chargeback reporting); ACH tokenization covers US and CAN accounts.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Classic Payment API fixtures follow the documented query-string responses (the decline and rate-limit examples) and the Transaction Response Variables table; webhook fixtures follow the documented event_id / event_type / event_body envelope and the transaction event_body field list. Settlement, chargeback and recurring event bodies were built from the documented field names only. None is an official NMI example.",
  dependencies: [
    "The connected third-party processor (NMI routes to more than 150 processors; processor_id names it)",
    "The partner ISO, ISV or reseller and the acquiring bank that underwrite the merchant (NMI works only through partners)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "nmi.classic.response",
      description:
        "Classic Payment API (transact.php, Direct Post) query-string response (response, responsetext, authcode, transactionid, avsresponse, cvvresponse, orderid, type, response_code)",
      status: "supported",
    },
    {
      id: "nmi.webhook",
      description:
        "Merchant webhooks (JSON event_id / event_type / event_body): 36 documented event types; transaction events are analyzed in full, settlement, chargeback, recurring and account updater events only from the documented fields",
      status: "limited",
    },
    {
      id: "nmi.rest.transaction",
      description: "REST API v5 transaction JSON (object: transaction)",
      status: "unsupported",
    },
    {
      id: "nmi.rest.error",
      description: "REST API v5 error JSON (type, error_code E_*, message, ref_id, details)",
      status: "unsupported",
    },
    {
      id: "nmi.webhook.partner",
      description: "Merchant Sign-Up (partner) webhooks (application.* and merchant.* events)",
      status: "unsupported",
    },
    {
      id: "nmi.query.xml",
      description: "Query API XML (nm_response); PandaPayLens does not parse XML input",
      status: "unsupported",
    },
    {
      id: "nmi.threestep.xml",
      description: "Three-Step Redirect XML; PandaPayLens does not parse XML input",
      status: "unsupported",
    },
    {
      id: "nmi.emulators",
      description:
        "Authorize.Net (AIM, SIM, XML) and Sparrow emulator formats; foreign formats that are not attributed to NMI",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the generic and lifecycle rules apply; there are no NMI-specific rules.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "payment-api",
      title: "Payment API (transact.php)",
      url: "https://docs.nmi.com/reference/transactions-processing",
    },
    {
      topic: "response-codes",
      title: "Response codes",
      url: "https://docs.nmi.com/reference/response-codes",
    },
    {
      topic: "rate-limiting",
      title: "Rate limiting",
      url: "https://docs.nmi.com/reference/rate-limiting",
    },
    { topic: "query-api", title: "Query API", url: "https://docs.nmi.com/reference/query" },
    {
      topic: "webhooks",
      title: "Webhooks overview",
      url: "https://docs.nmi.com/reference/overview",
    },
    {
      topic: "webhook-retries",
      title: "Webhook retry logic",
      url: "https://docs.nmi.com/reference/retry-logic",
    },
    {
      topic: "transaction-events",
      title: "Transaction events",
      url: "https://docs.nmi.com/reference/transaction-events",
    },
    {
      topic: "integration-portal",
      title: "Integration Portal",
      url: "https://secure.nmi.com/merchants/resources/integration/integration_portal.php",
    },
    {
      topic: "white-label",
      title: "Customizable white-label payment gateway",
      url: "https://www.nmi.com/resources/payments-101/why-nmi/customizable-white-label-payment-gateway/",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "event_id together with event_type",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Make the webhook handler idempotent: record processed event_id values and also check the transaction_id and the transaction condition before acting. NMI re-attempts a delivery up to 20 times over about 3 days until it receives HTTP 200, but does not document whether re-attempts keep the same event_id.",
    docsUrl: "https://docs.nmi.com/reference/retry-logic",
  },
  limitations: [
    "White label: NMI lets partners re-brand the gateway (logos, colors, URLs), so the same Classic and webhook formats come from many reseller brands and hostnames. Detection says NMI format; it cannot tell NMI from a reseller, and Classic responses carry no provider marker, so their detection confidence is capped below certainty. NMI's Authorize.Net and Sparrow emulators produce foreign formats that are not attributed to NMI.",
    "Classic responses are recognized from the documented field combination (response, responsetext, avsresponse, cvvresponse and a 3-digit response_code) when they arrive as form data or a raw HTTP response. The documentation renders examples as JSON objects; such JSON copies are not recognized. A raw HTTP response with Content-Type text/plain (as in NMI's code examples) is not parsed as form data by PandaPayLens today.",
    'The response field is read first. NMI\'s own example "Failed to Create Plan" pairs response=3 with response_code=100, so response_code is never trusted alone: when response and response_code disagree the record keeps the outcome given by response (unknown for response=3 without a documented error code) and the conflict is shown with insufficient confidence.',
    "response_code is NMI's gateway mapping. Raw processor codes (processor_response_code in webhooks) have no documented table and are shown, not decoded. merchant_advice_code values are not documented and are shown, not interpreted. HTTP 429 (system-wide rate limit) without a body carries no NMI marker and is not attributed.",
    "AVS and CVV results are informational. AVS B is listed twice by NMI (address only matches, and AVS not available) and is shown as ambiguous. A no-match result is mentioned on a decline only as a possible factor; NMI does not state that it caused the decline.",
    "Classic responses carry no amount (amount_authorized has no currency) and do not say which earlier transaction a capture, void or refund belongs to. Capture and void keep the authorization's transactionid in NMI's examples, so they group with it; a refund gets a new transactionid and no parent field, so it cannot be linked to the original payment.",
    "orderid / order_id is an optional merchant reference that can be reused across attempts and is never used for correlation. customer_vault_id is a stored-credential reference and is only flagged as present.",
    "Webhooks: content type, delivery order and whether re-attempts keep the event_id are not documented. Repeated deliveries are recognized by event_id together with event_type, because NMI's own samples reuse one event_id for different events. Webhook-Signature (t=nonce,s=HMAC) cannot be verified without the merchant's signing key; a pasted webhook is never treated as authentic and the header value is never copied.",
    "Webhook action.date is used as event time only when it has the 14-digit YYYYMMDDhhmmss form, read as UTC as documented for the Query API; the webhook pages do not restate its format or time zone. Otherwise the timeline falls back to input order.",
    "Transaction webhooks set isRecurring only when action.source is recurring. A subscription_id on transaction events is not documented, so recurring charges are not linked to their subscription. Recurring events read only subscription_id from event_body; plan event bodies are not described in the research.",
    "Settlement batch events are expanded into one settlement event per documented transaction_ids entry (at most 500 per batch). Chargeback batch events are summaries with chargebacks[] (id, date, amount, reason); whether a chargeback id is a transaction id is not documented, so chargebacks are not linked to payments, and their amount format and currency are not documented, so no amount is normalized. NMI sends chargeback events only if the processor supports chargeback reporting.",
    "transaction.*.unknown events and condition unknown mean an unknown processing error; their outcome stays unknown and no retry is suggested before the transaction is looked up.",
    "REST API v5 JSON (transactions and E_* errors) and Merchant Sign-Up partner webhooks are recognized but not analyzed. Query API and Three-Step Redirect XML are not parsed. Collect.js, Gateway.js 3-D Secure callbacks and CardEase XML are out of scope.",
    "NMI documents no high-risk sector and sells only through partners (ISOs, ISVs). Sector eligibility depends on the partner, the acquiring bank and the connected processor; approval for one sector does not imply another. The relationship between NMI Payments and Anovia Payments is not explained in the documentation read, so merchant_account_intermediary is not claimed.",
  ],
  samples: ["nmi-insufficient-funds", "nmi-auth-capture-refund"],
};
