import type { ProviderManifest } from "@pandapaylens/core";

export const NUVEI_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.nuvei.com/documentation";
const SITE = "https://www.nuvei.com";

export const nuveiManifest: ProviderManifest = {
  id: "nuvei",
  displayName: "Nuvei",
  version: NUVEI_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // Orchestration (smart routing, cascading) is only a marketing claim with no
  // API field, and payment_facilitator, wallet and merchant_account_intermediary
  // are not claimed by the documentation.
  categories: ["card_processing", "acquiring", "gateway", "alternative_payment_method"],
  sectors: [
    { sector: "iGaming / online gaming", source: `${SITE}/use-cases/online-gaming` },
    {
      sector: "Gaming and gambling (payouts)",
      source: `${DOCS}/features/financial-operations/payout/`,
    },
    { sector: "Forex", source: `${DOCS}/features/financial-operations/payout/` },
    { sector: "Video and social gaming", source: `${SITE}/use-cases/video-gaming` },
    { sector: "Crypto", source: `${SITE}/use-cases/crypto-platforms-exchanges` },
    {
      sector: "Digital content / subscriptions",
      source: `${SITE}/use-cases/digital-content-subscriptions`,
    },
    { sector: "Travel", source: `${SITE}/use-cases/travel-mobility` },
    { sector: "Financial services", source: `${SITE}/use-cases/financial-services` },
  ],
  regions:
    "Regulated entities per Nuvei's licences page: UK FCA e-money institution (Nuvei Financial Services Limited), DNB-licensed PSP (Nuvei Global Services B.V.), Central Bank of Cyprus EMI (Nuvei Limited), Bank of Lithuania EMI (Nuvei UAB), entities in Japan and Singapore, and a US MSB with money transmitter licences in 39 jurisdictions. Multi-settle is available only to US merchants with a TSYS acquirer; cross-border OCT payouts above 10,000 EUR are not allowed in Azerbaijan, Moldova and Ukraine (filter code 1295); Colombian domestic Visa transactions must be in COP (10049); one card registration flow accepts only EU/EEA cards (9158). A listed sector does not mean a merchant will be approved; eligibility depends on jurisdiction, licensing and Nuvei underwriting.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Approved REST responses and the chargeback event DMN follow the transcribed examples of the API reference and the Control Panel DMN page with synthetic values. Nuvei publishes no complete declined or status=ERROR REST response and no raw withdrawal DMN, and its payment DMN examples are truncated, so those fixtures are built from the documented field tables and code tables. Identifiers carry the PPLsynth marker instead of Nuvei's numeric format. None is an official Nuvei example.",
  dependencies: [
    "Card schemes and acquirers, including Nuvei's own acquiring and third-party acquirers named in transaction data.",
    "Alternative payment methods routed through Nuvei (for example Skrill as apmgw_MoneyBookers or PayPal as apmgw_expresscheckout); their own error codes are not documented by Nuvei.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "nuvei.rest_response",
      description:
        "REST API 1.0 JSON response (status, errCode, reason, transactionStatus, gwErrorCode, gwExtendedErrorCode, gwErrorReason, paymentMethodErrorCode, paymentMethodErrorReason)",
      status: "limited",
    },
    {
      id: "nuvei.payment_dmn",
      description:
        "Payment DMN as a query string or form body (ppp_status, Status, ErrCode, ExErrCode, Reason, ReasonCode)",
      status: "limited",
    },
    {
      id: "nuvei.withdrawal_dmn",
      description: "Withdrawal DMN (wdRequestId, wdRequestState, wdRequestStatus, wdOrderStatus)",
      status: "limited",
    },
    {
      id: "nuvei.chargeback_dmn",
      description: "Control Panel event DMN (JSON) with EventType Chargeback",
      status: "limited",
    },
    {
      id: "nuvei.event_dmn",
      description:
        "Other Control Panel event DMNs (alerts, manual corrections, fraud reports, PayFac and terminal events); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "nuvei.subscription_dmn",
      description: "Rebilling subscription DMNs (dmnType); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "nuvei.payment_page_redirect",
      description:
        "Payment Page parameters appended to the Success, Pending or Error URL (browser side); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "nuvei.rest_v2",
      description: "REST API 2.0 (beta), a different JSON format with dotted decline codes",
      status: "unsupported",
    },
    {
      id: "nuvei.web_sdk",
      description: "Web SDK and Simply Connect browser results",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    // No declined or status=ERROR REST response is published; the decline path
    // is built from the field tables.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Only the provider-agnostic rules apply; none has Nuvei-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "codes",
      title: "Response handling (errCode, gateway, filter and decline reason tables)",
      url: `${DOCS}/integration/response-handling/`,
    },
    {
      topic: "api",
      title: "REST API 1.0 reference",
      url: `${DOCS}/additional-links/api-reference/`,
    },
    {
      topic: "payment-flow",
      title: "REST API 1.0 server-to-server flow",
      url: `${DOCS}/accept-payment/server-to-server/rest-1-0/`,
    },
    { topic: "webhooks", title: "DMN delivery", url: `${DOCS}/integration/webhooks/` },
    {
      topic: "payment-dmns",
      title: "Payment DMNs",
      url: `${DOCS}/integration/webhooks/payment-dmns/`,
    },
    {
      topic: "withdrawal-dmns",
      title: "Withdrawal DMNs",
      url: `${DOCS}/integration/webhooks/withdrawal-dmns/`,
    },
    {
      topic: "event-dmns",
      title: "Control Panel event DMNs",
      url: `${DOCS}/integration/webhooks/control-panel/`,
    },
    {
      topic: "3ds",
      title: "3-D Secure responses",
      url: `${DOCS}/features/3d-secure/3ds-implementations/3ds-responses/`,
    },
    {
      topic: "auth-settle",
      title: "Auth and settle",
      url: `${DOCS}/features/financial-operations/auth-and-settle/`,
    },
    { topic: "void", title: "Void", url: `${DOCS}/features/financial-operations/void/` },
    { topic: "refund", title: "Refund", url: `${DOCS}/features/financial-operations/refund/` },
    { topic: "payouts", title: "Payout", url: `${DOCS}/features/financial-operations/payout/` },
    {
      topic: "withdrawals",
      title: "Withdrawal guide",
      url: `${DOCS}/accept-payment/payment-page/cashier/withdrawal-guide/`,
    },
    { topic: "faq", title: "FAQs", url: `${DOCS}/additional-links/faqs/` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "EventId (or EventCorrelationId) for Control Panel event DMNs; payment DMNs have no delivery id, so the transaction id (TransactionID, or PPP_TransactionID when it is empty), Status, ppp_status, transactionType and responseTimeStamp are combined",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Nuvei resends a DMN every 15 minutes for 24 hours until it gets HTTP 200, and an APM payment sends a PENDING DMN before the final one. Make the handler idempotent on the transaction id and status, ignore a status that is older than the one already stored, and confirm the state with /getPaymentStatus or /getTransactionDetails before acting.",
    docsUrl: `${DOCS}/integration/webhooks/`,
  },
  limitations: [
    "Codes are decoded only by the field that carries them (errCode, gwErrorCode with gwExtendedErrorCode, gwErrorReason, threeDReasonId, merchantAdviceCode), because the same numbers mean different things in different fields. A bare number is never decoded.",
    "APPROVED and PENDING share the gateway code pair 0/0, so the outcome is taken only from the status fields (transactionStatus, status, Status, ppp_status, wdOrderStatus, wdRequestStatus).",
    "Filter codes 1158, 1159, 1160 and 1167 are listed twice by Nuvei with unrelated meanings; both meanings are shown with possible confidence. Codes 1211, 1212, 1213, 1215 and 1216 are only listed as reserved.",
    "Nuvei calls its decline reason list non-exhaustive. Unlisted gwErrorReason texts are shown as a decline with possible confidence. 29 errCode values named only in the Java SDK constants are decoded with possible confidence.",
    "APM-side codes (paymentMethodErrorCode, errApmCode, apmErrorCode) and Nuvei's errScCode for APM transactions are not documented and are shown without interpretation.",
    "The link between the DMN fields ErrCode, ExErrCode and Reason and the REST fields gwErrorCode, gwExtendedErrorCode and gwErrorReason is inferred from the field descriptions, so gateway and filter codes from DMNs and withdrawal DMNs are decoded with possible confidence at most. ReasonCode and gwReasonCode values are not documented and are not interpreted.",
    "No complete declined or status=ERROR REST response is published; decline and error handling follows the field descriptions and code tables. The HTTP status of REST 1.0 errors is not documented.",
    "REST responses carry no timestamp and settle, refund and void responses do not echo relatedTransactionId, so a modification response cannot be linked to its payment from the response alone. Each operation has its own transactionId.",
    "REST /payout responses cannot be told apart from refund responses unless transactionType says payout; a Credit transaction is shown as a refund. A payment DMN with type=WITHDRAWAL and withdrawal DMNs are shown as payouts.",
    "Payment DMNs have no event or delivery id. The delivery key combines the transaction id, Status, ppp_status, transactionType and responseTimeStamp; whether responseTimeStamp stays the same across Nuvei's retries is not documented, so a repeated delivery with a new timestamp appears as a separate event. Without responseTimeStamp no delivery key is set.",
    "responseTimeStamp (YYYY-MM-DD.HH:MM:SS) is read as GMT, as the checksum section of the payment DMN page states. Delivery order is not documented.",
    "transactionType in payment DMNs is sent only when Nuvei enables it for the account. Without it a payment DMN is shown as a payment. Status values SUCCESS and UPDATE are documented without an outcome and are shown as unknown.",
    "Field names in DMNs differ in case between Nuvei's tables and examples (PPP_TransactionID, ppp_TransactionId, TransactionID, TransactionId); identifiers are matched without regard to case. Status (DMN) and status (Payment Page redirect) are told apart by case.",
    "Checksums (advanceResponseChecksum, responsechecksum, the withdrawal DMN checksum and the event DMN checksum header) are never verified or copied; a pasted DMN is never treated as authentic. Only the checksum length is reported.",
    "Withdrawal DMNs are documented only as a field table and a checksum string, without a raw example, and the notificationType of order notifications is not documented. Withdrawal amounts are not read. Withdrawal API error codes belong to Withdrawal API responses, which are not analyzed.",
    "Control Panel event DMNs are analyzed only for EventType Chargeback, keyed by EventId or EventCorrelationId; AttemptNumber above 1 marks a redelivery. Other event types (alerts, manual corrections, fraud reports, instant settlement, PayFac and terminal events) are recognized but not analyzed. DisputeUnifiedStatusCode values and scheme chargeback reason codes are not documented by Nuvei and are shown as supplied.",
    "Subscription DMNs, pre-deposit DMNs, KYC DMNs, Payment Page redirect parameters, Web SDK and Simply Connect results and REST API 2.0 (beta) are not analyzed. Payment Page redirect parameters reach the browser and are not a trustworthy final state.",
    "Skrill payments made through Nuvei (payment_method apmgw_MoneyBookers) arrive in Nuvei's own DMN format and are analyzed by this adapter; direct Skrill status_url posts belong to the Skrill adapter.",
    "Category and retry guidance per code are PandaPayLens suggestions; where Nuvei gives advice it is reflected. Mastercard Merchant Advice Codes are read only next to a decline or an error, because Nuvei's successful examples also carry one.",
  ],
  samples: ["nuvei-apm-pending-approved", "nuvei-declined"],
};
