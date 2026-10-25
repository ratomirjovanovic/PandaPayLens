import type { ProviderManifest } from "@pandapaylens/core";

export const EMERCHANTPAY_ADAPTER_VERSION = "0.1.0";

const API_DOCS = "https://emerchantpay.github.io/gateway-api-docs/";

export const emerchantpayManifest: ProviderManifest = {
  id: "emerchantpay",
  displayName: "emerchantpay",
  version: EMERCHANTPAY_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  // The eZeeWallet wallet product has a separate API and is not claimed here.
  categories: ["acquiring", "gateway", "card_processing", "alternative_payment_method"],
  sectors: [
    { sector: "gaming / iGaming", source: "https://www.emerchantpay.com/gaming/" },
    {
      sector: "digital goods and services (incl. subscription-based businesses)",
      source: "https://www.emerchantpay.com/digital-goods/",
    },
    { sector: "financial services", source: "https://www.emerchantpay.com/financial-services/" },
    { sector: "travel", source: "https://www.emerchantpay.com/travel/" },
    { sector: "eCommerce", source: "https://www.emerchantpay.com/e-commerce/" },
    { sector: "retail", source: "https://www.emerchantpay.com/retail/" },
  ],
  regions:
    "UK: emerchantpay Ltd is an FCA-authorised EMI (register no. 900778). EU: emerchantpay collaborates with UAB Phoenix Payments, an EMI supervised by the Bank of Lithuania (licence LB000477). US: emerchantpay Corp. is a registered partner/ISO of Elavon, Inc. and Westamerica Bank. Supported card brands are acquirer-specific, AVS codes are only valid for US and UK issued cards, and Visa purpose_of_payment is required for cards issued in some countries. A sector page does not mean a merchant will be approved; eligibility depends on jurisdiction, licensing and underwriting.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Notifications follow the field tables and the transcribed notification examples of the public Genesis API reference; JSON payment response objects follow the documented payment_response field table (the wire format is XML). None is an official emerchantpay example.",
  dependencies: [
    "Elavon, Inc. and Westamerica Bank (US; emerchantpay Corp. is their registered partner/ISO)",
    "UAB Phoenix Payments (EU EMI that emerchantpay collaborates with)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "emerchantpay.notification",
      description:
        "Processing notifications to notification_url (form-encoded unique_id, transaction_type, status, terminal_token, signature), including chargeback, retrieval request and RDR events",
      status: "supported",
    },
    {
      id: "emerchantpay.wpf.notification",
      description:
        "WPF (hosted payment form) notifications (form-encoded wpf_unique_id, wpf_status, notification_type=wpf, payment_transaction_* fields)",
      status: "limited",
    },
    {
      id: "emerchantpay.payment_response.object",
      description:
        "JSON object with the documented payment_response fields (SDK renderings or logs of a Processing API response); the wire format itself is XML",
      status: "limited",
    },
    {
      id: "emerchantpay.xml",
      description:
        "Processing API, reconcile and WPF XML (payment_response, wpf_payment, notification_echo, reconcile, payment_transaction, blacklist_response); recognized inside a JSON string, never parsed",
      status: "unsupported",
    },
    {
      id: "emerchantpay.apm_external_event",
      description:
        "APM external event notifications (notification_type=apm_external_event); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "emerchantpay.disputes.api",
      description: "Chargeback, retrieval request, RDR and SAFE/TC40 APIs (XML)",
      status: "unsupported",
    },
    {
      id: "emerchantpay.v1.apis",
      description:
        "Consumer, Tokenization, Managed Recurring, KYC, Payee, FX and Billing (GraphQL) APIs",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Generic and lifecycle rules apply; there are no emerchantpay-specific rules.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "api-reference", title: "Genesis API reference (version 61.1)", url: API_DOCS },
    { topic: "errors", title: "Genesis API reference: Errors", url: API_DOCS },
    {
      topic: "scheme-response-codes",
      title: "Genesis API reference: Scheme Response Codes",
      url: API_DOCS,
    },
    { topic: "notifications", title: "Genesis API reference: Notifications", url: API_DOCS },
    {
      topic: "transaction-states",
      title: "Genesis API reference: Transaction States",
      url: API_DOCS,
    },
    {
      topic: "docs-portal",
      title: "emerchantpay docs portal",
      url: "https://docs.emerchantpay.com/",
    },
    {
      topic: "s2s",
      title: "Server-to-server integration",
      url: "https://docs.emerchantpay.com/payments/payment-integrations/server-to-server/integrate-s2s/",
    },
    {
      topic: "refund",
      title: "Refund",
      url: "https://docs.emerchantpay.com/payments/online-card-payments/refund/",
    },
    {
      topic: "void",
      title: "Void",
      url: "https://docs.emerchantpay.com/payments/online-card-payments/void/",
    },
    {
      topic: "sdk-errors",
      title: "Genesis PHP SDK: Errors.php",
      url: "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Constants/Errors.php",
    },
    {
      topic: "sdk-notification",
      title: "Genesis PHP SDK: Notification.php",
      url: "https://raw.githubusercontent.com/GenesisGateway/genesis_php/master/src/Genesis/Api/Notification.php",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "unique_id and status (plus event and chargeback_unique_id for dispute notifications), or wpf_unique_id and wpf_status for WPF notifications; Genesis notifications carry no event or delivery id",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Answer each notification with the notification_echo XML carrying its unique_id (or wpf_unique_id) so Genesis stops resending it, make the handler idempotent per unique_id and status, and reconcile the transaction before acting on it.",
    docsUrl: API_DOCS,
  },
  limitations: [
    "Genesis responses are XML, and core does not parse XML. Processing API, reconcile and WPF XML pasted as text cannot be imported; XML inside a JSON string is recognized and reported as unsupported. Only JSON objects with the documented payment_response fields (as rendered by the SDKs or written to logs) are analyzed as payment responses.",
    "Detection is structural. The same Genesis platform also runs as another operator's instance (E-ComProcessing, per the official PHP SDK), with identical payloads; without a hostname a payload can only be identified as the Genesis platform, not as emerchantpay specifically. Hostnames and brand names are never used for detection.",
    "Notifications have no event id, delivery id or timestamp. The delivery key is the field combination suggested by the research (unique_id + status, plus event + chargeback_unique_id for disputes; wpf_unique_id + wpf_status for WPF); two genuinely different notifications with equal values are treated as repeated deliveries. Notification events have no event time, so their order is the input order.",
    "Genesis resends a notification periodically until it receives the notification_echo XML. The retry interval, the maximum number of attempts and the delivery order are not documented.",
    "Processing notifications carry no currency, so their amount is shown in minor units without a currency. The processing notification content type is not documented; its examples start with ? like a query string. Documentation examples split over several lines with leading & cannot be imported as-is; join them into one line.",
    "Signatures (SHA-1, SHA-256 or SHA-512 of the unique_id and the API password) are never verified, copied or reported; only the signature length class is shown. terminal_token, token, consumer_id and card or customer fields are never copied. A pasted notification is never treated as verified.",
    "APM and wallet transaction types (including eZeeWallet payments processed through Genesis) are analyzed by their Genesis structure, but their transaction_type names are not in the research, so they are shown as unknown transaction types with stage other while their documented status is kept.",
    "Gateway error codes are decoded from the 93 codes of the API reference. Six codes found only in the PHP SDK and 16 issuer codes found only in the SDK are decoded with possible confidence; other three-digit codes fall back to their documented range group with possible confidence, and anything else is reported with insufficient confidence. Message text varies per acquirer; only the code classes are stable.",
    "Scheme response codes where the Visa and Mastercard tables differ are shown with both meanings and possible confidence, because no documented field identifies the card brand. response_code is acquirer-specific and its meaning is not documented, so it is shown but not decoded.",
    "Recurring advice codes override the retry guidance of a decline; PandaPayLens never suggests a retry against the issuer's advice. AVS single-character codes and most two-character result letters are recognized but not explained, because the research does not give their individual meanings.",
    "WPF notification error field names are not given in the research, so WPF notifications are not decoded for errors; wpf_status is kept. APM external event notifications are recognized but not analyzed, because their category and code values are not documented.",
    "Refund, void and capture responses do not echo the parent transaction id. Events are linked by unique_id, reference_transaction_unique_id, wpf_unique_id and payment_transaction_unique_id only; transaction_id and order_id are merchant references and are never used for correlation.",
    "Dispute notifications (chargeback, representment, retrieval request, RDR) are opt-in per merchant; a dispute event does not show the dispute's final outcome. The state names chargeback_reversed and chargeback_reversal (WPF) are both accepted. Managed Recurring subscriptions are out of scope, so no subscription reference is set.",
    "A successful capture means Genesis processed it, not that funds were settled; settlement is not reported in these payloads.",
  ],
  samples: ["emerchantpay-rebill-declined", "emerchantpay-chargeback"],
};
