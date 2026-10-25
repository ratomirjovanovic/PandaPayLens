import type { ProviderManifest } from "@pandapaylens/core";

export const SEGPAY_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://gethelp.segpay.com/docs/Content/";

export const segpayManifest: ProviderManifest = {
  id: "segpay",
  displayName: "Segpay",
  version: SEGPAY_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  // Orchestration applies to the Gateway product only (merchant pooling, smart routing).
  categories: [
    "payment_facilitator",
    "gateway",
    "merchant_account_intermediary",
    "card_processing",
    "orchestration",
  ],
  sectors: [
    {
      sector: "adult (content, VOD, cam, fan platforms)",
      source: "https://segpay.com/verticals/high-risk/",
    },
    { sector: "dating (mainstream and adult)", source: "https://segpay.com/verticals/high-risk/" },
    { sector: "creator / fan platforms", source: "https://segpay.com/" },
    { sector: "subscription", source: "https://segpay.com/verticals/subscriptions/" },
    { sector: "SaaS and digital goods", source: "https://segpay.com/verticals/saas-billing/" },
    { sector: "online gaming (non-gambling)", source: "https://segpay.com/" },
    { sector: "e-commerce", source: "https://segpay.com/verticals/e-commerce/" },
    { sector: "CBD / nutraceuticals", source: "https://segpay.com/verticals/cbd/" },
  ],
  regions:
    "Merchant entities in the US, EU (Ireland), UK and Australia; registered as Visa and Mastercard payment facilitator in the EU, UK and US. RDR is available to PSP accounts only. PSD2 SCA applies to Europe-to-Europe transactions. PayPal is unavailable in 35 listed countries; SEPA Direct Debit covers 21 listed countries; Pay by Bank is UK/EU only (GBP/EUR, no recurring); crypto has no recurring billing and no refunds. Eligibility depends on jurisdiction, licensing and underwriting.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic payloads. Processing transaction and PayPal dispute postbacks follow the default examples Segpay publishes (partly transcribed from documentation screenshots); member management postbacks and Gateway Event Notifications were built from the documented parameter tables because Segpay publishes no full default example for most of them. Not official provider examples.",
  dependencies: [
    "Third-party acquirers and processors connected through the Segpay Gateway (26 documented integrations)",
    "PayPal (payment method on the Segpay pay page)",
    "TrueLayer (Pay by Bank on the Segpay pay page)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "segpay.processing.transaction",
      description:
        "Processing transaction postback with default key names (trantype, action, stage, approved, purchaseid, tranid)",
      status: "limited",
    },
    {
      id: "segpay.processing.member",
      description:
        "Processing member management postbacks (Inquiry/Probe, Enable, Disable, Cancel, Reactivation)",
      status: "limited",
    },
    {
      id: "segpay.processing.paypal_dispute",
      description: "Processing PayPal Dispute postback (disputeid, disputestage, currentstatus)",
      status: "limited",
    },
    {
      id: "segpay.gateway.notification",
      description:
        "Gateway Event Notification (EventCode, SubEventTypeID, TransactionID, SubscriberID, ResponseCode)",
      status: "limited",
    },
    {
      id: "segpay.processing.custom_postback",
      description: "Processing postbacks with merchant-chosen key names (recognized, not analyzed)",
      status: "unsupported",
    },
    {
      id: "segpay.gateway.xml",
      description: "Gateway XML API responses (authresponse, creditresponse, rebillresponse, ...)",
      status: "unsupported",
    },
    {
      id: "segpay.srs",
      description:
        "SRS reporting and admin web service responses (.NET DataSet XML, plain strings)",
      status: "unsupported",
    },
    {
      id: "segpay.gateway.express_stats",
      description: "Gateway Express Stats XML",
      status: "unsupported",
    },
    {
      id: "segpay.membership_upgrade",
      description: "Membership Upgrade API JSON/XML responses",
      status: "unsupported",
    },
    {
      id: "segpay.oneclick",
      description: "One-Click web service responses",
      status: "unsupported",
    },
    {
      id: "segpay.mpi.v4",
      description: "MPI V4 (3DS2) browser callback objects",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    // No synchronous payment response is analyzed: the hosted pay page redirects,
    // Gateway responses are XML, and One-Click / Membership Upgrade examples are
    // missing or malformed.
    paymentResponses: "unsupported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    // Generic and lifecycle rules apply; no Segpay-specific rule exists.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "postbacks",
      title: "Processing API: Postbacks",
      url: `${DOCS}DeveloperDocs/ProcessingAPI/06-Postbacks.htm`,
    },
    {
      topic: "postback-parameters",
      title: "Processing API: Postback parameters",
      url: `${DOCS}DeveloperDocs/ProcessingAPI/07-PostbackParameters.htm`,
    },
    {
      topic: "transaction-matrix",
      title: "Transaction Postback Matrix",
      url: `${DOCS}DeveloperDocs/ProcessingAPI/Postbacks-TransactionMatrix.htm`,
    },
    {
      topic: "error-codes",
      title: "Processing API: Error codes (fraud, Instant Conversion, One-Click)",
      url: `${DOCS}DeveloperDocs/ProcessingAPI/11-Error%20Codes.htm`,
    },
    {
      topic: "manage-postbacks",
      title: "Merchant Portal: Manage postbacks",
      url: `${DOCS}MPDocs/MyWebsites/ManagePostbacks.htm`,
    },
    {
      topic: "paypal-disputes",
      title: "PayPal Dispute configuration",
      url: `${DOCS}MPDocs/PayPal-DisputeConfiguration.htm`,
    },
    {
      topic: "stand-in",
      title: "Stand-In",
      url: `${DOCS}MPFeatures/Stand-In.htm`,
    },
    {
      topic: "gateway",
      title: "Gateway Integration Guide (event codes, sub event types, response codes)",
      url: `${DOCS}GatewayDocs/GatewayIntegrationGuide.htm`,
    },
    {
      topic: "merchant-advice",
      title: "Merchant Advice & Response Codes",
      url: `${DOCS}GatewayDocs/Merchant%20Advice%20%26%20Response%20Codes.htm`,
    },
    {
      topic: "3ds",
      title: "3D Secure MPI V4",
      url: `${DOCS}GatewayDocs/3DSecureV4.htm`,
    },
    {
      topic: "signed-requests",
      title: "Gateway hosted pay page signed requests",
      url: `${DOCS}GatewayDocs/HostedPP-SignedRequests.htm`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "Processing: tranid + trantype + action + stage + approved (not for Stand-In postbacks); Gateway: TransactionID + EventCode (Segpay documents no event id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Make postback handling idempotent per tranid and result (Processing) or TransactionID and EventCode (Gateway). Do not treat a Stand-In decline as a repeat of the temporary approval: it reuses the same tranid and purchaseid.",
    docsUrl: `${DOCS}DeveloperDocs/ProcessingAPI/06-Postbacks.htm`,
  },
  limitations: [
    "Processing and Gateway are separate products with separate formats; they are analyzed as separate input families and their identifiers are never mixed.",
    "Default Processing postback key names are not tabulated by Segpay; they are taken from published screenshots. Postbacks that use merchant-chosen key names are recognized from value shapes but not analyzed.",
    "Segpay publishes no full example of the Inquiry, Enable, Disable, Cancellation or Reactivation postbacks; their parsing follows the token tables only, and reason code values in them are not documented, so they are shown as raw codes.",
    "No signature, HMAC or event id is documented for Processing postbacks or Gateway notifications. A pasted postback is never treated as verified, and the HTTP credentials Segpay supports are not part of the payload.",
    "Delivery keys use documented identifiers only: tranid + trantype + action + stage + approved for transaction postbacks, TransactionID + EventCode for Gateway notifications. Member management and PayPal dispute postbacks get no delivery key. Whether processingtime changes on a retry is not documented, so it is not part of the key.",
    "A Stand-In decline reuses the temporary approval's tranid and purchaseid. Stand-In postbacks (standin=1) never get a delivery key, so they are never reported as duplicates; a temporary approval is shown as pending, not as a final approval.",
    "The authcode format is not specified. It is decoded only when its prefix is a documented fraud code (F4xx, V30xx), an Instant Conversion / One-Click error (ERR301-ERR310) or a scheme code in Segpay's Visa categories or Mastercard buckets; anything else is reported as unknown. The rest of authcode can contain the blocked email or other customer data and is never copied.",
    "Segpay's Visa category 4 (all other codes, reattempts allowed) is not applied automatically, because the authcode prefix is not guaranteed to be an issuer code.",
    "Mastercard Merchant Advice Codes, Visa recurring cancellation codes and MPI V4 named errors are catalogued, but no supported Segpay payload field that carries them is documented.",
    "The Processing rebill retry schedule, the final failure signal after retries and the Gateway Flex Rebill rules are not documented; a declined rebill does not show whether Segpay will retry it.",
    "Gateway XML API responses, Express Stats, SRS reports and admin responses are XML or plain strings, which PandaPayLens core does not parse; they are not recognized. Membership Upgrade and One-Click responses are undocumented or malformed in the documentation and not analyzed.",
    "Postback timestamps (transtime, PayPal dispute dates, Gateway Timestamp) are read as GMT as Segpay states; whether the GMT STANDARD TIME label follows UK daylight saving is not documented, so times may be off by one hour in summer.",
    "Events are grouped by purchaseid, tranid and relatedtranid (Processing) and by TransactionID, OriginalTransactionID, RefundTransactionID and SubscriberID (Gateway). A purchase groups every billing cycle of a subscription. A recurring One-Click purchase gets a new purchaseid and is not linked to the original. Gateway SubscriberID is documented as unique per customer, so purchases of one customer may share a group.",
    "Gateway S events mean either a single sale or the settlement of an earlier authorization; the payload does not say which. A Gateway rebill (R) is treated as approved unless its ResponseCode says otherwise.",
    "Amounts without a currency code (Gateway notifications without CurrencyCode, PayPal dispute transamount) are shown as attributes only, not as minor-unit amounts.",
    "Test transactions (TESTTRANS / TESTRANS = 1) are flagged; Segpay does not support rebills, refunds or voids in test mode.",
    "Orchestration (merchant pooling, smart routing) applies to the Gateway product only.",
  ],
  samples: ["segpay-rebill-declined", "segpay-stand-in", "segpay-paypal-dispute"],
};
