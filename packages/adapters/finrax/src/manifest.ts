import type { ProviderManifest } from "@pandapaylens/core";
import {
  APPROVAL_CALLBACK_URL,
  CALLBACKS_URL,
  DEPOSIT_CALLBACK_URL,
  ERRORS_URL,
  FETCH_APPROVAL_URL,
  FETCH_PAYMENT_URL,
  KEY_MANAGEMENT_URL,
  REQUEST_PAYMENT_URL,
  REQUEST_WITHDRAWAL_URL,
  SANDBOX_URL,
  SIGNATURE_URL,
  WITHDRAWAL_CALLBACK_URL,
} from "./catalog.js";

export const FINRAX_ADAPTER_VERSION = "0.1.0";

const IGAMING = "https://finrax.com/seamless-crypto-payments-for-igaming-operators";
const FOREX_EXPO = "https://finrax.com/finrax-x-forex-expo-dubai-2025";

export const finraxManifest: ProviderManifest = {
  id: "finrax",
  displayName: "Finrax",
  version: FINRAX_ADAPTER_VERSION,
  wave: "HR-3",
  researchStatus: "tested",
  // Crypto deposits from end users and a hosted crypto checkout. Not card
  // processing, acquiring or a wallet: no end-user wallet is documented.
  categories: ["alternative_payment_method", "gateway"],
  sectors: [
    { sector: "iGaming", source: IGAMING },
    { sector: "Casinos", source: FOREX_EXPO },
    { sector: "Brokers / traders", source: FOREX_EXPO },
  ],
  regions:
    "Finrax Ltd. has offices in Sofia and Vilnius. Finrax states that it is currently not offering crypto-asset service provider (CASP) services to customers in the EU. Merchant licensing, restricted countries and prohibited business lists are not published.",
  documentationAccess: "partial",
  fixtureProvenance:
    "Synthetic payloads built from the field tables, enums and examples on Finrax's public developer documentation (payment object, withdrawal responses, the three callbacks and the error body). Identifiers and values are invented and contain PPLsynth; blockchain addresses and hashes are placeholders. They are not official Finrax examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "finrax.payment",
      description:
        "Payment object (GET /v1/payments/{paymentId}) with deposits[] and nested refunds: status, displayCurrency, expected and actual amounts",
      status: "supported",
    },
    {
      id: "finrax.payment.create_response",
      description:
        "Create or submit payment response (POST /v1/payments, PATCH /v1/payments/{paymentId}): paymentInfo plus paymentUrl",
      status: "supported",
    },
    {
      id: "finrax.callback.deposit_received",
      description:
        "Deposit received callback (paymentId, depositId, status CONFIRMED, expected and actual amounts); Signature and Timestamp headers",
      status: "limited",
    },
    {
      id: "finrax.withdrawal",
      description:
        "Withdrawal created response (POST /v1/withdrawals 201: withdrawId, clientWithdrawId, status, estimated amounts)",
      status: "supported",
    },
    {
      id: "finrax.withdrawal.pending_approval",
      description:
        "Withdrawal pending approval response (POST /v1/withdrawals 202: withdrawalId, clientLabel)",
      status: "limited",
    },
    {
      id: "finrax.callback.withdrawal",
      description:
        "Withdrawal broadcast callback (withdrawalId, clientWithdrawalId, status COMPLETED, FAILED or BLOCKED, amounts)",
      status: "limited",
    },
    {
      id: "finrax.callback.withdrawal_approval",
      description:
        "Withdrawal approval callback (withdrawalId, clientWithdrawalId, status APPROVED, PENDING, REJECTED or SKIPPED)",
      status: "limited",
    },
    {
      id: "finrax.error",
      description:
        "Error body (timestamp, httpStatus, httpError, message, path); decoded from the HTTP status only",
      status: "limited",
    },
    {
      id: "finrax.payment.request",
      description:
        "Create payment request sent to Finrax (clientPaymentId without paymentId); recognized but not analyzed",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Only nine HTTP status codes and a free-text message; no provider codes.
    errorDecoding: "limited",
    // The schemas are complete, but several status values have no documented
    // meaning, an underpaid deposit has no status of its own, and the nested
    // deposit amount fields are not named in the reviewed tables.
    paymentResponses: "limited",
    // No event type or event id in callbacks; header names, acknowledgment
    // rules and content type are not documented.
    webhookParsing: "limited",
    // Callbacks fire only at final points and some objects carry no timestamp.
    timeline: "limited",
    // Explicit ids with documented links (deposit to payment, approval id to
    // withdrawal id), tested with aliases.
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has Finrax-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "errors", title: "Errors (HTTP status codes and error body)", url: ERRORS_URL },
    { topic: "signature", title: "Request signature", url: SIGNATURE_URL },
    { topic: "key-management", title: "API keys and IP whitelist", url: KEY_MANAGEMENT_URL },
    { topic: "sandbox", title: "Sandbox environment and test outcomes", url: SANDBOX_URL },
    { topic: "request-payment", title: "Request crypto payment", url: REQUEST_PAYMENT_URL },
    { topic: "fetch-payment", title: "Fetch payment", url: FETCH_PAYMENT_URL },
    {
      topic: "request-withdrawal",
      title: "Request crypto withdrawal",
      url: REQUEST_WITHDRAWAL_URL,
    },
    {
      topic: "fetch-approval",
      title: "Fetch crypto withdrawal approval",
      url: FETCH_APPROVAL_URL,
    },
    { topic: "callbacks", title: "Callbacks and their signature", url: CALLBACKS_URL },
    { topic: "deposit-callback", title: "Deposit received callback", url: DEPOSIT_CALLBACK_URL },
    {
      topic: "withdrawal-callback",
      title: "Withdrawal completed callback",
      url: WITHDRAWAL_CALLBACK_URL,
    },
    {
      topic: "approval-callback",
      title: "Withdrawal approved or rejected callback",
      url: APPROVAL_CALLBACK_URL,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "depositId for deposit callbacks, withdrawalId and status for withdrawal and approval callbacks (Finrax sends no event or delivery id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Finrax retries a callback every 2 minutes for up to 24 hours until it counts as delivered, and what counts as delivered is not documented. Credit a deposit once per depositId and act on a withdrawal status once per withdrawalId, so that a repeated callback changes nothing.",
    docsUrl: CALLBACKS_URL,
  },
  limitations: [
    "Finrax documents no provider error or decline codes. Errors are decoded from the HTTP status (nine documented codes) and the free-text message only; other status codes stay unknown. Category and retry per code are PandaPayLens suggestions.",
    "Status values are documented without definitions. Meanings come from the sandbox table where it shows the value, otherwise from the name, and each event says which (statusBasis). PENDING versus AWAITING, payment and deposit FAILED, withdrawal FAILED and approval SKIPPED are not documented and are not interpreted beyond their names; SKIPPED stays unknown.",
    "An underpaid deposit has no status of its own: the sandbox shows DEPOSITED for exact and for underpaid deposits. A DEPOSITED payment or a CONFIRMED deposit is shown as a success only when the same record shows an actual amount at least equal to the expected amount; otherwise the outcome is unknown and amountCheck says why. Whether actualDisplayAmount in the deposit callback is per deposit or cumulative is not documented, so a split payment can look underpaid per callback.",
    "A confirmed deposit or an OVERPAID payment means funds were received on chain, not that they were settled to the merchant. No settlement event is created: the settlement amount and currency fields are shown as reported, and bank settlement in EUR, USD or GBP is mentioned on the homepage without an API.",
    "Crypto amounts (deposit, withdraw and refund amounts) are shown as decimal text with their coin and are never converted to minor units. Display amounts are converted only when displayCurrency is a three-letter code that is not one of the documented coins; whether displayCurrency can be a coin is not documented. Refund amounts carry no documented currency.",
    "Callbacks carry no event type and no event or delivery id; the callback type is taken from the payload shape. Repeated deliveries are recognized by depositId, or by withdrawalId and status. Acknowledgment rules, content type, the exact header names and the timestamp unit are not documented.",
    "Callbacks are signed with RSA SHA-512 over the body and a timestamp. PandaPayLens never verifies the signature and never treats a pasted callback as authentic; only the presence of a Signature header is shown.",
    "Payment status snapshots carry no time of their last status change, so they are placed after the timed events of the same payment. Only NEW uses paymentRequestedAt. Withdrawal and approval callbacks carry no timestamp. Delivery order is not documented.",
    "Withdrawal fields are spelled differently in the 201 response (withdrawId, clientWithdrawId), the 202 response (withdrawalId, clientLabel) and the callbacks (withdrawalId, clientWithdrawalId); all spellings are read. The callback schema spells deducedSettlementAmount while the example uses deductedSettlementAmount; both are read. Sandbox withdrawal statuses (SENT, ABORTED, REJECTED) differ from the API enum and stay unknown.",
    'The approval fetch response is only {"status": ...} and cannot be recognized from its shape. The payment list response wrapper, the metadata, rate, balance and address validation endpoints, and the request bodies are not analyzed; a create payment request is recognized but not analyzed.',
    "Merchant references (clientPaymentId, clientWithdrawId, clientWithdrawalId, clientLabel) are never used to link events. Blockchain addresses, destination tags, transaction hashes, payment URLs with session tokens, initiatedBy, businessId and AML screening results (riskScore, addressRiskAssessment, txAddressOwner) are never copied; only their presence is shown where it helps.",
    "Finrax documents no chargebacks, disputes, subscriptions or rebills; none can appear on the timeline.",
    "The API base URL is not public, sandbox access needs an organisation set up by Finrax support, and the documentation is a multi-brand template: payloads from other brands served by the same API cannot be told apart from Finrax.",
    "Sector eligibility depends on jurisdiction, licensing and Finrax underwriting, none of which is published. Finrax also says it is built for unnamed high-risk verticals; that is not a sector list. Forex appears only as an event name and is not listed as a sector.",
  ],
  samples: ["finrax-underpaid", "finrax-blocked-deposit"],
};
