import type { ProviderManifest } from "@pandapaylens/core";

export const EZEEWALLET_ADAPTER_VERSION = "0.1.0";

const API_DOCS = "https://emerchantpay.github.io/ewallet-api-docs/";

export const ezeewalletManifest: ProviderManifest = {
  id: "ezeewallet",
  displayName: "eZeeWallet",
  version: EZEEWALLET_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  categories: ["wallet", "alternative_payment_method"],
  // eZeeWallet documents no accepted merchant sectors (see limitations).
  sectors: [],
  regions:
    "Regulator unresolved: the About Us page names Prime Pay Solutions Limited (Isle of Man), licensed by the Isle of Man Financial Services Authority for money transmission (Class 8 (2)(a) and (4)), while the consumer terms (17.1 to 17.2) name emerchantpay ltd. (England and Wales), authorised by the UK Financial Conduct Authority under the Electronic Money Regulations 2011 (Reg. No. 900778). The terms refer to a list of Non-Supported Countries that could not be found in the public pages; error 422 confirms per-consumer-country restrictions.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads built from the documented field tables and example shapes of the public eZeeWallet API reference (v2.0.2); identifiers and values are invented and contain PPLsynth or PPLSYNTH. They are not official eZeeWallet examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "ezeewallet.transfer",
      description:
        "Transfer responses (consumer wallet to merchant wallet) of POST /transfers (legacy, transaction_id) and POST /transfers_new (merchant_transaction_id, ezw_reference_id), wrapped in transfer, and unwrapped GET /transfers list items",
      status: "supported",
    },
    {
      id: "ezeewallet.transaction",
      description: "GET /transaction lookup ({ ezw_reference_id, status, type })",
      status: "supported",
    },
    {
      id: "ezeewallet.refund",
      description:
        "POST /refunds responses wrapped in refund; ezw_reference_id is the original transfer",
      status: "limited",
    },
    {
      id: "ezeewallet.single_payout",
      description:
        "POST /single_payouts (unique_id, succeeded / failed) and POST /single_payouts_new (ezw_reference_id, approved / pending) responses",
      status: "limited",
    },
    {
      id: "ezeewallet.batch_payout",
      description:
        "POST /batch_payouts_new ({ unique_ids, status }) responses; the legacy { unique_id, status } response is too generic to be detected automatically",
      status: "limited",
    },
    {
      id: "ezeewallet.error",
      description: 'Error envelope { "error": { "code", "message" } } with the 27 documented codes',
      status: "limited",
    },
    {
      id: "ezeewallet.notification",
      description:
        "Transfer and payout notifications POSTed to notification_url (transaction_id or ezw_reference_id / merchant_reference, unique_id, status, signature, decline_reason)",
      status: "limited",
    },
    {
      id: "ezeewallet.account",
      description:
        "GET /account responses (recognized but not analyzed: account data, no payment lifecycle)",
      status: "unsupported",
    },
    {
      id: "ezeewallet.balance",
      description: "GET /balance merchant balance responses (not recognized)",
      status: "unsupported",
    },
    {
      id: "ezeewallet.genesis",
      description:
        "eZeeWallet as an APM inside the emerchantpay Genesis gateway (transaction_type ezeewallet). These are Genesis payloads; they are never claimed by this adapter and belong to the emerchantpay adapter",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Synchronous errors have 27 exact codes, but asynchronous declines arrive as
    // undocumented free text.
    errorDecoding: "limited",
    // Status vocabularies drift per endpoint, the list container key is not
    // documented and the legacy batch payout shape cannot be detected.
    paymentResponses: "limited",
    webhookParsing: "limited",
    // No timestamps anywhere: order comes only from the input order.
    timeline: "experimental",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has eZeeWallet-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "api-reference", title: "eZeeWallet API reference (v2.0.2)", url: API_DOCS },
    {
      topic: "api-docs-repository",
      title: "eZeeWallet Slate public API docs (repository)",
      url: "https://github.com/eMerchantPay/ewallet-api-docs",
    },
    { topic: "site", title: "eZeeWallet public site", url: "https://ezeewallet.com/en" },
    {
      topic: "business",
      title: "eZeeWallet for business",
      url: "https://ezeewallet.com/en/business",
    },
    {
      topic: "genesis-route",
      title: "emerchantpay Genesis API reference (eZeeWallet section, separate format)",
      url: "https://emerchantpay.github.io/gateway-api-docs/",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "unique_id and status",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "eZeeWallet documents no event id, retry schedule, ordering or duplicate behavior. Answer every notification with the NotificationEcho ({ unique_id }) and make the handler idempotent on unique_id (or transaction_id) and status; confirm the final state with GET /transaction before acting.",
    docsUrl: API_DOCS,
  },
  limitations: [
    "Status words differ per endpoint and between the data types, examples and narrative of the reference (pending vs pending_async, succeeded / failed vs approved / declined). They are kept per endpoint, each with where it is documented, and are never merged into one state machine. A status not documented for the endpoint stays unknown.",
    "A transfer moves e-money from the consumer wallet to the merchant wallet in one step. An approved transfer is shown as a wallet payment, never as a card authorization; there is no authorize / capture split. A pending transfer means the consumer has not finished (for example must top up) and stays pending until a notification or lookup shows the result.",
    "The narrative describes a transfer Timeout, but its exact status string is not documented; such a status is shown as unknown.",
    "Notifications are thin (an id, status, signature and, when declined, decline_reason). decline_reason values are not documented: the text is shown as the provider wrote it and is never classified, so a declined notification is decoded with an unknown category.",
    "Notification signatures are SHA-1 of transaction_id and the merchant API username. They are sensitive, never copied and never verified; a pasted notification is not treated as authentic. Only the shape (40 hexadecimal characters) is reported. Which id is hashed for payout notifications is not documented.",
    "No response or notification carries a timestamp. No event time is invented; the timeline follows the input order, or receipt times supplied with the receivedAt envelope.",
    "eZeeWallet documents no event id, retries, ordering or duplicate behavior. Repeated notifications are recognized by unique_id and status only, because the payload carries nothing else; the notification content type is not documented (examples are JSON).",
    "Correlation uses ezw_reference_id and unique_id as separate keys, because the reference does not say whether they hold the same value. A refund links to its transfer through ezw_reference_id, the only documented parent reference. The legacy transfer response carries no eZeeWallet id; it links to its notification only through transaction_id, which eZeeWallet refuses to process twice (code 408). merchant_transaction_id and merchant_reference are never used as links.",
    "Error code is typed as a string but shown as an integer; both are read. Code 401 carries two different messages. The changelog entry for 2.0.1 (new error details) does not say which codes changed. Category and retry guidance per code are PandaPayLens suggestions.",
    "Reference examples contain trailing commas (not valid JSON). Such text is rejected by the input parser and must be corrected before analysis.",
    "Batch payout per-item results, credit payout request status strings (codes 417 to 421) and account status values other than the examples are not documented. The legacy batch payout response ({ unique_id, status }) is too generic to be detected without selecting the provider manually. The container key of GET /transfers list responses is not documented; list items are recognized when supplied one by one.",
    "No merchant sectors are documented. The consumer site splits wallet balances into gambling and non-gambling balances, but that is not a statement of merchant eligibility; eligibility depends on jurisdiction, licensing and underwriting.",
    "The regulated entity is unresolved: the About Us page names Prime Pay Solutions Limited (Isle of Man Financial Services Authority), the consumer terms name emerchantpay ltd. (UK Financial Conduct Authority, Reg. No. 900778). The list of Non-Supported Countries was not found in the public pages.",
    "No chargeback, subscription or rebill objects exist in the API. Consumer wallet funding (bank transfer and other methods) happens outside this API and is not shown.",
    "Payloads of the emerchantpay Genesis route (transaction_type ezeewallet, XML payment_response) are Genesis payloads, not eZeeWallet API payloads, and are never claimed by this adapter. Any record carrying transaction_type is left to other adapters.",
    "Account and balance responses carry account data and no payment lifecycle; account responses are recognized but not analyzed, balance responses are not recognized.",
  ],
  samples: ["ezeewallet-transfer-declined", "ezeewallet-payout-flow"],
};
