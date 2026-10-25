import type { ProviderManifest } from "@pandapaylens/core";
import {
  AMER_SIGNATURE_URL,
  AMER_STATUS_CODES_URL,
  AMER_TRANSACTIONS_URL,
  AMER_WEBHOOKS_URL,
  EU_ACCOUNT_PAYOUT_URL,
  EU_AUTHENTICATION_URL,
  EU_CANCEL_URL,
  EU_CREDIT_URL,
  EU_DEBIT_URL,
  EU_DEPOSIT_URL,
  EU_ERROR_HANDLING_URL,
  EU_GAMING_DEPOSIT_URL,
  EU_GET_WITHDRAWALS_URL,
  EU_NOTIFICATIONS_URL,
  EU_PAYOUT_FAILED_URL,
  EU_PENDING_URL,
  EU_PROTOCOL_URL,
  EU_REFUND_URL,
} from "./catalog.js";

export const TRUSTLY_ADAPTER_VERSION = "0.1.0";

const SITE = "https://www.trustly.com";

export const trustlyManifest: ProviderManifest = {
  id: "trustly",
  displayName: "Trustly",
  version: TRUSTLY_ADAPTER_VERSION,
  wave: "HR-3",
  researchStatus: "tested",
  // Pay by bank: no card, wallet or gateway flows are documented.
  categories: ["alternative_payment_method"],
  sectors: [
    { sector: "iGaming / gaming", source: `${SITE}/verticals/gaming` },
    { sector: "E-commerce", source: `${SITE}/verticals/ecommerce` },
    { sector: "Financial services", source: `${SITE}/verticals/financial-services` },
    { sector: "Travel", source: `${SITE}/verticals/travel` },
    { sector: "Subscription services", source: `${SITE}/verticals/subscription-services` },
    { sector: "Utilities", source: `${SITE}/verticals/utilities` },
    { sector: "Public sector", source: `${SITE}/verticals/public-sector` },
  ],
  regions:
    "Trustly Group AB is an authorized Swedish payment institution supervised by Finansinspektionen and provides cross-border payment services within the EU/EEA; Trustly UK Limited is FCA regulated (FRN 1005703); Trustly, Inc. holds NMLS #2463855. The EU API is available in 15 markets; Pay N Play only in Sweden, Finland, Estonia and the Netherlands. Supported holding currencies: CZK, DKK, EUR, GBP, HUF (without decimals), NOK, PLN, RON, SEK. The North America API covers US and Canadian bank payments.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. The Deposit result, the error envelope, the credit notification and the North America form-encoded event follow the examples transcribed in the research; the other notifications, method results, Transaction objects and REST errors were built from documented field tables. None is an official Trustly example.",
  dependencies: [
    "The end user's bank (online banking login and bank transfer)",
    "Local schemes reached through the EU API: Swish, iDEAL, Bancontact, MB Way, Bizum",
    "ACH and RTP (US), EFT (Canada) and BACS Direct Debit (UK) for the North America status and return codes",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "trustly.eu.notification",
      description:
        "EU JSON-RPC 1.1 notification (credit, debit, pending, cancel, account, kyc, payoutconfirmation, payoutfailed, payoutdowngraded, verifyAccount, assessAccount, advice) with notificationid, orderid and messageid",
      status: "supported",
    },
    {
      id: "trustly.eu.result",
      description:
        "EU JSON-RPC 1.1 method result (Deposit, Refund, AccountPayout, ApproveWithdrawal, GetWithdrawals); other methods are shown without semantics",
      status: "limited",
    },
    {
      id: "trustly.eu.error",
      description: "EU JSON-RPC 1.1 error envelope (JSONRPCError with the 74 numbered codes)",
      status: "supported",
    },
    {
      id: "trustly.eu.request",
      description:
        "Merchant request to the EU API (Signature, UUID, Data with Username and Password); recognized but not analyzed",
      status: "unsupported",
    },
    {
      id: "trustly.eu.notification_response",
      description:
        "Merchant's signed reply to a notification (data.status OK, FAILED, CONTINUE or FINISH); recognized but not analyzed",
      status: "unsupported",
    },
    {
      id: "trustly.amer.event",
      description:
        "North America event notification (eventId, eventType, objectId, status, paymentProviderTransaction.status), form-encoded or JSON",
      status: "limited",
    },
    {
      id: "trustly.amer.transaction",
      description:
        "North America REST Transaction object (transactionId, transactionType, status, paymentProviderTransaction)",
      status: "limited",
    },
    {
      id: "trustly.amer.error",
      description:
        "North America REST error body { errors: [{ domain, code, location, message, occurredAt }] }",
      status: "limited",
    },
  ],
  capabilities: {
    // Proposed as supported. Limited: the 53 UK Direct Debit codes have no
    // transcribed meaning, ACH return codes are not enumerated, only example
    // payoutfailed codes exist, and EU code texts differ between pages.
    errorDecoding: "limited",
    // Supported for EU, limited for North America in the research.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    // Supported for EU, limited for North America in the research.
    correlation: "limited",
    // Only the provider-agnostic rules apply.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "protocol", title: "EU API protocol (JSON-RPC 1.1)", url: EU_PROTOCOL_URL },
    { topic: "error-handling", title: "EU error handling", url: EU_ERROR_HANDLING_URL },
    { topic: "authentication", title: "EU signatures and keys", url: EU_AUTHENTICATION_URL },
    { topic: "notifications", title: "EU notifications overview", url: EU_NOTIFICATIONS_URL },
    { topic: "pending", title: "EU pending notification", url: EU_PENDING_URL },
    { topic: "credit", title: "EU credit notification", url: EU_CREDIT_URL },
    { topic: "debit", title: "EU debit notification", url: EU_DEBIT_URL },
    { topic: "cancel", title: "EU cancel notification", url: EU_CANCEL_URL },
    { topic: "payoutfailed", title: "EU payoutfailed notification", url: EU_PAYOUT_FAILED_URL },
    { topic: "deposit", title: "EU Deposit", url: EU_DEPOSIT_URL },
    { topic: "refund", title: "EU Refund", url: EU_REFUND_URL },
    { topic: "accountpayout", title: "EU AccountPayout", url: EU_ACCOUNT_PAYOUT_URL },
    { topic: "getwithdrawals", title: "EU GetWithdrawals", url: EU_GET_WITHDRAWALS_URL },
    {
      topic: "gaming-deposit",
      title: "EU gaming integration (notification order)",
      url: EU_GAMING_DEPOSIT_URL,
    },
    {
      topic: "amer-status-codes",
      title: "North America status codes and type definitions",
      url: AMER_STATUS_CODES_URL,
    },
    { topic: "amer-webhooks", title: "North America webhooks and events", url: AMER_WEBHOOKS_URL },
    {
      topic: "amer-signature",
      title: "North America notification signature",
      url: AMER_SIGNATURE_URL,
    },
    {
      topic: "amer-transactions",
      title: "North America transactions and transaction ids",
      url: AMER_TRANSACTIONS_URL,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "notificationid (EU) or eventId (North America)",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "EU notifications are retried with the same notificationid (5 s, 15 s, 45 s, 15 min, 45 min, 90 min, then every 3 hours), and Trustly expects the same reply as the first time. Store notificationid and answer a repeat with the same signed reply without acting on it again. North America events are retried every 5 minutes for 12 hours until answered with HTTP 200 within 3 seconds; treat a repeated eventId as the same event. Account, pending and credit notifications can arrive in any order.",
    docsUrl: EU_NOTIFICATIONS_URL,
  },
  limitations: [
    "Trustly runs separate API families: the EU JSON-RPC API and the North America REST API. Each has its own format ids, status tables and identifiers, and they are never mixed or linked to each other.",
    "credit and debit change the end user's balance and their meaning depends on the order they belong to. credit is shown as a received deposit (payment success), but after an AccountPayout, Withdraw or Refund on the same order it means that operation failed and the amount returned; the notification itself does not say which. debit is shown without a payment outcome because it means either a deposit taken back after it never settled or a completed withdrawal, and its effect depends on the merchant's reply, which the notification does not contain.",
    "pending means the end user finished the flow but the money has not been received; it is never shown as a credited payment. A Deposit result only means the order was created.",
    "payoutconfirmation, payoutfailed, payoutdowngraded, account, verifyAccount, assessAccount and the detailed cancel fields are opt-in, and payoutfailed and payoutdowngraded are sent in production only, so their absence in pasted data means nothing.",
    "Only example payoutfailed and payoutdowngraded errorcode values are documented (incorrect_account_number, sepa_instant_downgrade); other values stay unknown. ERROR_CHARGE_NOT_APPROVED and ERROR_ACCOUNT_NOT_FOUND have no documented meaning beyond their names.",
    "Trustly may add or remove EU error codes and GetWithdrawals transfer states without notice, and the same code can have different texts on different pages (624 means bank account number, IBAN or AccountID). Undocumented codes and states stay unknown. The HTTP status of EU errors is not documented.",
    "The EU error example and the KYC and Account Assessment examples in Trustly's documentation are not valid JSON (a missing brace, comments, trailing commas). Comments and trailing commas are removed with a LENIENT_JSON warning; the missing brace of the error example is not repaired, so that example is rejected as invalid JSON.",
    "Signatures (params.signature, alg= prefixed values, the North America Authorization header) and custom notification headers are sensitive and never verified or copied; a pasted notification is not treated as authentic.",
    "Merchant requests to the EU API carry the API password and are recognized but not analyzed. The merchant's reply to a notification is recognized but not analyzed.",
    "Only the EU methods Deposit, Refund, AccountPayout, ApproveWithdrawal and GetWithdrawals have result semantics. Other method results (for example SelectAccount, Charge or Swish) are shown as unknown. The structure of the GetWithdrawals result was not transcribed; transferstate is read from the data object or its list entries. A Refund result of 0 is not documented and stays unknown.",
    "EU events are linked only by orderid. messageid (the merchant reference) and enduserid are never used to link events, and enduserid is not copied. Whether a payoutconfirmation for a Refund carries the refund's own id or the deposit OrderID is not documented, so it may not link to the deposit.",
    "Merchant Direct Debit and Trustly Direct Debit (recurring) are only partly covered: pending, credit and cancel use the same methods, the cancel reason is shown, but the 116 scheme detail strings are not decoded and advice notifications are shown without an outcome. Recurring charges cannot be told apart from one-off deposits.",
    "EU pay by bank documents no chargeback or dispute notification. North America Dispute and Reverse events, status 10 Reversed, AC112 Disputed and EFT code 996 are shown as reported.",
    "North America event types are documented by name only, so their stage and outcome come from the documented transaction status (0 to 14) and transaction type where present; events without a status keep a conservative default. AC codes are lifecycle states shown as attributes; only AC101, AC103, AC113, AC114 and AC115 are decoded as errors.",
    "North America: the webhook page names application/x-www-form-urlencoded but shows a JSON example, so both are read. The field holding the extended decline reason code is not named; extended codes are decoded when they appear in paymentProviderTransaction.reasonCode. ACH return codes R01 to R84 are not enumerated, the 53 UK Direct Debit codes have no transcribed meaning except ARUDD_0 and DDICA_6, the paymentType number for Instant is not documented, and duplicate handling beyond eventId is not documented.",
    "North America REST errors have no transcribed example; the { message } error variant some endpoints use is not recognized. User verification error codes and the Data product are not analyzed.",
    "Category and retry guidance per code are PandaPayLens suggestions. System codes (SE01 to SE03) are shown as conditional retries because the outcome of the original request can be unknown.",
    "Sector eligibility depends on jurisdiction, licensing and Trustly's onboarding; approval for one sector does not imply another. Trustly's group companies Ecospend and SlimPay, and payabl.-wrapped Trustly payments, are out of scope.",
  ],
  samples: ["trustly-payout-failed", "trustly-amer-declined"],
};
