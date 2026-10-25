import type { ProviderManifest } from "@pandapaylens/core";

export const PAYABL_ADAPTER_VERSION = "0.1.0";

export const payablManifest: ProviderManifest = {
  id: "payabl",
  displayName: "payabl.",
  version: PAYABL_ADAPTER_VERSION,
  wave: 1,
  researchStatus: "released",
  categories: ["acquiring", "gateway"],
  sectors: [],
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic payloads modelled on the provider's public documentation; not official examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "payabl.gateway.response",
      description:
        "Gateway API synchronous responses (URL-encoded transactionid/transid, status, errormessage/errmsg)",
      status: "supported",
    },
    {
      id: "payabl.notification",
      description:
        "Notifications / callbacks to notification_url (URL-encoded transactionid, type, errorcode, security)",
      status: "limited",
    },
    {
      id: "payabl.session.init",
      description: "Hosted Payment Page init and Web SDK session responses (URL-encoded)",
      status: "supported",
    },
    {
      id: "payabl.websdk.callback",
      description: "Web SDK browser JavaScript callback ({ status, metadata })",
      status: "unsupported",
    },
    {
      id: "payabl.diagnose.xml",
      description: "tx_diagnose and send_notification XML responses",
      status: "unsupported",
    },
    {
      id: "payabl.mobile.init",
      description: "Mobile SDK /mobile/init JSON responses",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Generic rules apply; the provider-specific state and retry-risk rules do not cover payabl.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "response-codes",
      title: "Response codes",
      url: "https://docs.payabl.com/docs/response-codes-detailed",
    },
    {
      topic: "issuer-codes",
      title: "Error codes for credit cards",
      url: "https://docs.payabl.com/docs/error-codes-for-credit-cards-2",
    },
    {
      topic: "cft-codes",
      title: "CFT response codes",
      url: "https://docs.payabl.com/docs/cft-response-code",
    },
    {
      topic: "merchant-advice-codes",
      title: "Mastercard merchant advice codes",
      url: "https://docs.payabl.com/docs/mastercard-merchant-advice-codes",
    },
    {
      topic: "apm-codes",
      title: "APM error codes",
      url: "https://docs.payabl.com/docs/error-codes-apm",
    },
    {
      topic: "3ds-reasons",
      title: "3DS transaction status reason codes",
      url: "https://docs.payabl.com/docs/3ds-transaction-status-reason-codes",
    },
    {
      topic: "notifications",
      title: "Retry notification / callback",
      url: "https://docs.payabl.com/docs/retry-notificationcallback",
    },
    {
      topic: "signature",
      title: "Signature calculation",
      url: "https://docs.payabl.com/docs/signature-calculation2",
    },
    {
      topic: "authorization",
      title: "Authorization",
      url: "https://docs.payabl.com/docs/authorization",
    },
    {
      topic: "pre-authorization",
      title: "Pre-authorization",
      url: "https://docs.payabl.com/docs/pre-authorization",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "transactionid, type, errorcode, payment_state and amount (payabl. documents no event id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Make your notification handler idempotent per transactionid and type, and answer HTTP 200 with body OK so Auto-Retry stops resending.",
    docsUrl: "https://docs.payabl.com/docs/retry-notificationcallback",
  },
  limitations: [
    "Gateway API responses do not say which operation (authorize, pre-authorize, capture, reversal, refund or CFT) produced them, so they are shown with the generic stage payment.",
    "Notifications have no event or delivery id. The delivery key is the field combination transactionid + type + errorcode + payment_state + amount; two genuinely different notifications with equal values (for example two equal partial refunds) are treated as repeated deliveries. Whether timestamp stays the same across retries is not documented, so it is not part of the key.",
    "Only the notification types order, capture and refund are documented. Reversal, CFT and chargeback notification types are not documented and are shown without lifecycle semantics; chargebacks are reported by email, the dashboard and the diagnose interface.",
    "A successful capture or refund means payabl. processed the operation, not that funds were settled. payment_state=credited means funds were received for an APM capture; settlement to the merchant is not documented as a payload state.",
    "One transactionid spans authorization, capture and refund, so events are grouped by it. Payouts (CFT) get a new transactionid that the response does not link to the original deposit. orderid is never used for correlation.",
    "Gateway, risk, issuer, raw Visa/Mastercard, Mastercard advice, APM, OCT and Web SDK codes share the status/errorcode field. Where a code has different meanings in different documented tables, confidence is reduced to possible and the alternatives are listed.",
    "EPS codes (021, 009, 005, 010) are decoded with possible confidence: the EPS payment_method id is not documented in the PandaPayLens research.",
    "payabl. code lists are not exhaustive; codes outside them are reported with insufficient confidence.",
    "The notification signature (security) and the request signature are never verified, copied or reported; only the signature length class is shown.",
    "XML responses (tx_diagnose, send_notification), Mobile SDK JSON and notifications converted to JSON are not analyzed. The Web SDK browser callback is recognized but not analyzed, because payabl. says it must not be used to update merchant systems.",
    "Notification field sets are configurable per merchant; content type, charset and delivery order are not documented.",
    "Notification timestamps are used as event time only when they are 10-digit Unix seconds.",
    "Copies of documentation examples with the rendering defects ¤cy= and ×tamp= are repaired and flagged.",
  ],
  samples: ["payabl-authorized", "payabl-insufficient-funds", "payabl-timeout"],
};
