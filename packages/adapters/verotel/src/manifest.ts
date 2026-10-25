import type { ProviderManifest } from "@pandapaylens/core";

export const VEROTEL_ADAPTER_VERSION = "0.1.0";

export const verotelManifest: ProviderManifest = {
  id: "verotel",
  displayName: "Verotel",
  version: VEROTEL_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  // "gateway" is listed as limited in the research: hosted order page only,
  // no server-to-server card authorization API.
  categories: [
    "payment_facilitator",
    "merchant_account_intermediary",
    "card_processing",
    "gateway",
  ],
  sectors: [
    { sector: "adult", source: "https://www.verotel.com/" },
    { sector: "high-risk merchants generally", source: "https://www.verotel.com/" },
    {
      sector: "online entertainment / digital content",
      source: "https://www.verotel.com/en/pricechart.html",
    },
    {
      sector: "cam sites / webcam billing",
      source: "https://www.verotel.com/en/integration.html",
    },
    {
      sector: "pay per view, pay per download",
      source: "https://www.verotel.com/en/integration.html",
    },
    {
      sector: "token / credit purchase systems",
      source: "https://www.verotel.com/en/integration.html",
    },
    {
      sector: "shopping carts, incl. tangible products",
      source: "https://www.verotel.com/verotel_flexpay_apidescription_v0300_rev100.pdf",
    },
    {
      sector: "subscription / membership websites",
      source: "https://controlcenter.verotel.com/flexpay-doc/",
    },
  ],
  regions:
    "Verotel states it is licensed by the Dutch Central Bank (Payment Institution 2011, Electronic Money Institution 2019); the merchant agreement is governed by Dutch law. Merchants are accepted worldwide, but Verotel may block high-risk countries at its discretion (which countries is not documented). Sale currencies USD, EUR, GBP, AUD, CAD, CHF, DKK, NOK, SEK; payouts in USD, EUR or GBP. Direct Debit Europe is EUR only and limited to listed countries (the FlexPay docs and the price chart disagree on Slovakia).",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Verotel publishes no literal FlexPay postback example, so postback fixtures were built from the documented FlexPay v4 field tables; Control Center API and VerotelRUM fixtures follow the published examples' shapes with synthetic values. None are official provider examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "verotel.flexpay.postback",
      description:
        "FlexPay postbacks as key=value data (purchase success and the 10 event values), also the success redirect parameters",
      status: "limited",
    },
    {
      id: "verotel.rum.postback",
      description: "VerotelRUM postbacks (trn=add, rebill, cancel, modify, delete)",
      status: "supported",
    },
    {
      id: "verotel.api.error",
      description:
        "Control Center API JSON error envelope { error: { documentation, status, title } }",
      status: "limited",
    },
    {
      id: "verotel.api.transaction",
      description: "Control Center API transaction object (GET /transaction/:id and list elements)",
      status: "limited",
    },
    {
      id: "verotel.api.sale",
      description: "Control Center API sale object (GET /sale/:id and list elements)",
      status: "limited",
    },
    {
      id: "verotel.api.action",
      description:
        "Control Center API action responses (cancel, downgrade, extend, terminate, refund)",
      status: "limited",
    },
    {
      id: "verotel.flexpay.request",
      description:
        "FlexPay request URLs built by the merchant (startorder, cancel-subscription, status request)",
      status: "unsupported",
    },
    {
      id: "verotel.flexpay.status",
      description: "FlexPay status page (plain text name: value lines)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    // Generic rules apply; no Verotel-specific rule exists.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "flexpay",
      title: "FlexPay documentation (version 4)",
      url: "https://controlcenter.verotel.com/flexpay-doc/",
    },
    {
      topic: "flexpay-purchase",
      title: "FlexPay purchase and postbacks",
      url: "https://controlcenter.verotel.com/flexpay-doc/purchase.html",
    },
    {
      topic: "flexpay-subscription",
      title: "FlexPay subscription and postbacks",
      url: "https://controlcenter.verotel.com/flexpay-doc/subscription.html",
    },
    {
      topic: "control-center-api",
      title: "Control Center API",
      url: "https://controlcenter.verotel.com/api-doc/index.html",
    },
    {
      topic: "rum",
      title: "VerotelRUM description",
      url: "https://www.verotel.com/verotel_rumdescription_v0800_rev097.pdf",
    },
    {
      topic: "flexpay-v3",
      title: "FlexPay API v3 description (legacy)",
      url: "https://www.verotel.com/verotel_flexpay_apidescription_v0300_rev100.pdf",
    },
    {
      topic: "flexpay-upgrade",
      title: "FlexPay subscription upgrade",
      url: "https://www.verotel.com/veroteldoc_FlexPayAPIv3.4SubscriptionUpgrade.pdf",
    },
    {
      topic: "integration",
      title: "Integration overview",
      url: "https://www.verotel.com/en/integration.html",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "type, event, saleID and transactionID for FlexPay postbacks that carry a transactionID, or trn and trn_id for VerotelRUM add and rebill (Verotel documents no event or delivery id)",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Make the postback handler idempotent per saleID, event and transactionID, and answer HTTP 200 with body OK within 30 seconds: for card payments an unanswered FlexPay postback triggers an automatic refund.",
    docsUrl: "https://controlcenter.verotel.com/flexpay-doc/subscription.html",
  },
  limitations: [
    "FlexPay postbacks are HTTP GET requests whose data is in the URL query string. Paste the raw request, the full URL or just the query string; the host and path are not used for detection.",
    "Verotel publishes no literal FlexPay postback example; the adapter follows the documented v4 field tables. A success redirect copied from the browser carries the same fields as the initial or purchase postback and is not distinguished from it.",
    "Postbacks carry no timestamp and no event id. Events from postbacks have no event time; their order is the order of the supplied records, and nextChargeOn / expiresOn are shown as attributes only.",
    "Duplicate deliveries are recognized only for postbacks that carry a transactionID (rebill, credit, chargeback, and purchase, initial and upgrade with postbacks version 2) and for VerotelRUM add and rebill. Retry behavior for FlexPay postbacks is not documented. extend, downgrade, cancel, uncancel and expiry postbacks have no reliable delivery key, so repeated copies are not flagged.",
    "Declined payments and declined rebills produce no postback. A declined rebill can only show up indirectly as extend (Rebill-retry) followed by rebill or expiry. Declines are visible only in Control Center API transactions (is_approved=false with decline_reason).",
    "The expiry postback carries no reason, and extend does not say whether it was a manual extension or a Rebill-retry extension. Whether an expiry also follows a credit or chargeback is not documented.",
    "Verotel publishes no card decline code table. Only the decline category NO_FUNDS is documented; any other decline_reason is reported with insufficient confidence.",
    "For an initial postback with a trial, the amount shown is trialAmount (the first charge); priceAmount is kept as the recurring price attribute. A downgrade's amount is the new rebill price, not a charge, so it is not shown as an event amount.",
    "Chargeback postbacks and transactions are shown with stage dispute and an unknown outcome: the payload does not say whether the chargeback is final.",
    "transaction_subtype meanings (ONETIME, WALLET, PURCHASE, INITREC, RECURRED, CREDIT, CHBACK) and most API payment_method codes are not documented; the raw values are shown without interpretation.",
    "transactionID on initial, purchase and upgrade postbacks requires 'postbacks version 2', which is enabled in the Control Center; without it these postbacks link to later reversals only through saleID.",
    "VerotelRUM trn_id is kept in its own namespace: whether it equals the Control Center transaction id, or stays the same across commands of one membership, is not documented.",
    "Signatures (SHA-256 for FlexPay v4, SHA-1 for older versions) are never verified or copied; only their presence and length class are shown. A pasted postback is never treated as authentic.",
    "Control Center API error titles are matched leniently (published typo 'Paramter', optional final period). HTTP 404 and the 5000-record cap have no published title. Published API examples contain '=>' and are not valid JSON; such copies cannot be parsed and must be corrected first.",
    "The FlexPay status page (plain text name: value lines) is not analyzed: PandaPayLens core does not parse that text format. FlexPay request URLs (startorder, cancel-subscription, status request) are recognized but not analyzed.",
    "Buyer data (name, email, address, IP, country), custom1..3, description, truncatedPAN, masked identifiers, oneClickToken, usercode and passcode are never copied.",
    "An unanswered or non-OK postback acknowledgement leads Verotel to refund a card payment automatically (VerotelRUM: after two more attempts within 20 minutes); the supplied postback alone cannot show whether it was acknowledged.",
  ],
  samples: ["verotel-subscription-log", "verotel-chargeback"],
};
