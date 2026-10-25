import type { ProviderManifest } from "@pandapaylens/core";

export const PAYMENTWALL_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.paymentwall.com";
const SITE = "https://www.paymentwall.com";

export const paymentwallManifest: ProviderManifest = {
  id: "paymentwall",
  displayName: "Paymentwall",
  version: PAYMENTWALL_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  // payment_facilitator is only indirectly evidenced in the research and is not claimed.
  categories: ["gateway", "card_processing", "alternative_payment_method"],
  sectors: [
    { sector: "video games (via Terminal3)", source: `${SITE}/industries/video-games` },
    { sector: "e-commerce (physical goods)", source: `${SITE}/industries/e-commerce` },
    { sector: "travel", source: `${SITE}/en/industries/travel` },
    { sector: "SaaS / subscriptions", source: `${SITE}/industries/saas` },
    { sector: "enterprise", source: `${SITE}/industries/enterprise` },
    {
      sector: "digital goods, virtual currency",
      source: `${DOCS}/integration/widget-home`,
    },
  ],
  regions:
    "Paymentwall describes itself as a regulated financial institution operating worldwide (no regulator named) and may restrict businesses in 25 listed sanctioned countries and the regions Crimea, Donetsk, Luhansk, Kherson and Zaporizhzhia. Restricted business models include illegal goods, IP infringement, prohibited MLM, Forex trading/training and financial intermediaries, server/DDoS testing tools, hardware repairs and no-value-added services (list not exhaustive). Cards are accepted globally except sanctioned countries and entities; processing currencies depend on the acquiring banks. Eligibility depends on jurisdiction, licensing and underwriting.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers and placeholder signatures. Pingback fixtures follow the query-string shape of the published pingback URL samples; Brick error, charge, subscription and 3-D Secure fixtures follow the shapes of the published JSON samples. Mobiamo and unidentified error fixtures were built from documented field lists and code tables because no complete envelope is published. None are official provider examples.",
  dependencies: [
    "External acquirer referenced as Paymentwall's Acquirer in the Terms of Service (Brick card processing)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "paymentwall.pingback",
      description:
        "Pingback query string (uid, type, ref, sign_version, sig, goodsid, slength, speriod, currency, reason, is_test): 11 types, 12 negative reasons",
      status: "supported",
    },
    {
      id: "paymentwall.brick.error",
      description: 'Brick error JSON { type: "Error", error, code } (7 token and 54 payment codes)',
      status: "supported",
    },
    {
      id: "paymentwall.brick.sdk_error",
      description:
        "PHP SDK getPublicData() error envelope { success: 0, error: { message, code } } (SDK wrapper, not the raw API)",
      status: "limited",
    },
    {
      id: "paymentwall.brick.charge",
      description:
        "Brick charge object (object: charge, amount, amount_paid, currency_paid, captured, refunded, risk)",
      status: "limited",
    },
    {
      id: "paymentwall.brick.subscription",
      description:
        "Brick subscription object (object: subscription, active, expired, is_trial, period, charges)",
      status: "limited",
    },
    {
      id: "paymentwall.brick.3ds",
      description: "Brick 3-D Secure step { success: 0, secure: { redirect | formHTML } }",
      status: "limited",
    },
    {
      id: "paymentwall.mobiamo.error",
      description: "Mobiamo error response (success, error, code W1 to W19)",
      status: "limited",
    },
    {
      id: "paymentwall.mobiamo.response",
      description: "Mobiamo payment response (ref, flow, instructions, price, completed)",
      status: "limited",
    },
    {
      id: "paymentwall.error.unidentified",
      description:
        "Error with a code whose product family the structure does not show (for example MINT, whose envelope is not documented); every documented meaning is listed. Analyzed only when Paymentwall is selected manually.",
      status: "limited",
    },
    {
      id: "paymentwall.client_callback",
      description:
        "Client-side postMessage events (paymentSuccess, widgetLoaded, ...); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "paymentwall.payment_status",
      description: "Payment Status API (GET /api/rest/payment); not analyzed",
      status: "unsupported",
    },
    {
      id: "paymentwall.other_apis",
      description:
        "Widget and Checkout signed URLs, Cancellation and Delivery Confirmation APIs, Tokidoki, Reporting, Coupon; not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Brick codes decode with strong confidence; MINT codes only through an
    // unidentified envelope (possible confidence) and several codes collide.
    errorDecoding: "limited",
    paymentResponses: "limited",
    webhookParsing: "supported",
    timeline: "limited",
    correlation: "limited",
    // Generic rules apply; no Paymentwall-specific rule exists.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "pingback", title: "Pingback reference", url: `${DOCS}/reference/pingback-home` },
    {
      topic: "pingback-tool",
      title: "Test Pingback Tool (pingback type table incl. type 1)",
      url: `${DOCS}/sandbox/pingback-tool`,
    },
    {
      topic: "signature",
      title: "Signature calculation (v2 MD5, v3 SHA-256)",
      url: `${DOCS}/reference/signature-calculation`,
    },
    {
      topic: "custom-parameters",
      title: "Custom pingback parameters",
      url: `${DOCS}/reference/pingback/custom-parameter`,
    },
    {
      topic: "brick-errors",
      title: "Brick error codes",
      url: `${DOCS}/integration/direct/brick/error-codes`,
    },
    {
      topic: "brick-charge",
      title: "Brick charge",
      url: `${DOCS}/integration/direct/brick/charge`,
    },
    {
      topic: "brick-3ds",
      title: "Brick 3-D Secure",
      url: `${DOCS}/integration/direct/brick/3dsecure`,
    },
    {
      topic: "brick-subscription",
      title: "Brick subscription",
      url: `${DOCS}/integration/direct/brick/subscription`,
    },
    {
      topic: "brick-pingback",
      title: "Brick pingback handling",
      url: `${DOCS}/integration/direct/brick/pingback`,
    },
    {
      topic: "api-reference",
      title: "API reference (Brick objects, Mobiamo, MINT)",
      url: `${DOCS}/apis`,
    },
    {
      topic: "client-callback",
      title: "Client-side callback",
      url: `${DOCS}/reference/client-side-callback`,
    },
    {
      topic: "terminal3-brick-errors",
      title:
        "Terminal3 Brick error codes (Terminal3 is Paymentwall's spin-out; used only to confirm the Brick code list)",
      url: "https://docs.terminal3.com/integration/direct/brick/error-codes",
    },
    {
      topic: "php-sdk-pingback",
      title: "paymentwall-php Pingback.php (type constants, unique id ref_type)",
      url: "https://raw.githubusercontent.com/paymentwall/paymentwall-php/master/lib/Paymentwall/Pingback.php",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "ref and type (the SDK's unique pingback id ref_type, also available as the UNIQUE_REF custom parameter); pingbacks carry no event id",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Store each ref (with its type) and refuse a repeated ref for type 0, then answer HTTP 200 with body OK. Until the OK arrives, Paymentwall resends the pingback within 30 minutes and then every 30 minutes.",
    docsUrl: `${DOCS}/reference/pingback-home`,
  },
  limitations: [
    "Pingbacks arrive as an HTTP request with the data in the URL query string. Paste the raw request, the full URL or just the query string; the host and path are not used for detection.",
    "Pingbacks carry no timestamp and no event id. Events from pingbacks have no event time and their order is the order of the supplied records. Delivery keys use the SDK's documented unique id (ref and type); partial refunds (type 220) and partial reversals (type 2, reason 10) can repeat for one ref, so they have no delivery key.",
    "Custom pingback parameters (REFERENCE_ID, UNIQUE_REF, PAYMENT_DATETIME, REVENUE, SUBSCRIPTION_ID, RECURRING_*, CHARGEBACK_* and OWN parameters) are sent under merchant-chosen names and are not read. Amounts, currencies, payment times and subscription ids from pingbacks are therefore not shown.",
    "Pingback type 1 is documented inconsistently (Virtual Currency payment confirmation in the Test Pingback Tool, GOODWILL in the PHP SDK, absent from the main pingback page). Type 220 is not among the SDK constants. In Virtual Currency pingbacks, currency is the amount of virtual currency, not an ISO currency.",
    "A pingback does not say whether a type 0 payment is the first charge of a subscription or a renewal, so isRecurring is set only for type 14 (renewal failed). Types 12, 13 and 14 are sent only when activated for the project.",
    "A negative pingback with reason 1 (chargeback) is shown as a dispute with unknown outcome; the payload does not say whether the chargeback is final.",
    "The relation between the Brick charge id (numeric) and the pingback ref (b..., t..., w... prefixes, meaning not documented) is not documented, so Brick API objects and pingbacks are not linked. Mobiamo refs are kept in their own namespace for the same reason.",
    "Code spaces collide: Brick and MINT redemption reuse 1001, 1003, 3001 to 3006, 3008 and 3009 with different meanings, and 200 is both a Brick token error and a pingback type. Codes are decoded by the product family the payload structure shows (Brick error JSON, SDK envelope, Mobiamo W codes). When the structure does not show the family, every documented meaning is listed with possible confidence.",
    "The MINT error envelope is not documented; MINT codes are decoded only from an unidentified error shape { code, error | message } when Paymentwall is selected manually, always with possible confidence.",
    "The PHP SDK error envelope { success: 0, error: { message, code } } wraps Brick responses; whether the raw API also returns success is unclear. It is decoded with the Brick tables.",
    "Brick charge risk values beyond approved are not documented (pending appears only in the PHP SDK). A voided charge is not distinguished from an uncaptured authorization because no void flag is documented. Charge and subscription date fields are not read because their format is not documented.",
    "Brick internal errors (1000) and MINT redemption internal errors (1001) are shown as retry after verification, not as safe to retry, because the original operation may have taken effect.",
    "Signatures (sig, v2 MD5 or v3 SHA-256) are never verified or copied; only their presence and length class are shown. A pasted pingback is never treated as authentic. The documentation reuses one placeholder sig value across samples.",
    "uid (which defaults to the e-mail for Brick), tokens, fingerprints, 3-D Secure redirect URLs and form HTML, support_link, card data, customer names and addresses, MSISDN and IP addresses are never copied.",
    "Client-side postMessage events are recognized but not analyzed (they come from the browser and are not authoritative). Payment Status API, Widget and Checkout URLs, Cancellation, Delivery Confirmation, Tokidoki, Reporting and Coupon APIs are not analyzed. Widget errors have no codes. Payouts and wallet transfers are not documented.",
    "Merchant Area content (Test Pingback Tool output, project settings) needs a login and was not examined. The Terminal3 documentation (Paymentwall's spin-out, same formats) was used only to confirm the Brick code list; Terminal3 payloads cannot be told apart and are treated as Paymentwall.",
    "Brick minimum amount is inconsistent in the documentation (charge reference USD 0.3, error 3115 default 0.50 USD).",
  ],
  samples: ["paymentwall-renewal-failed", "paymentwall-brick-declined"],
};
