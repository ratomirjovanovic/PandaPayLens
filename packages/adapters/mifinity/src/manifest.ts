import type { ProviderManifest } from "@pandapaylens/core";

export const MIFINITY_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://mifinity.readme.io";

export const mifinityManifest: ProviderManifest = {
  id: "mifinity",
  displayName: "MiFinity",
  version: MIFINITY_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  // Bank, card (OCT) and crypto payouts have no matching category and are
  // described in apiFamilies instead.
  categories: ["wallet", "alternative_payment_method"],
  // MiFinity states no accepted merchant sectors on any page reviewed.
  sectors: [],
  regions:
    "MiFinity UK Limited is an FCA authorised electronic money institution (Register Ref. 900090); Mifinity Malta Limited is an MFSA financial institution (C64824). MiFinity lists 23 non-serviced countries, including the United States, Russia and Ukraine, and card payouts (PAC/PMC) cover all countries except that list. UnionPay payouts run only from EEA countries to mainland China cards. Deposit and withdrawal limits are set per currency.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Shapes follow the payout callback and error envelope examples transcribed in the research and MiFinity's documented field tables; deposit callback, Payment Status, Account to Account and PayAnyCoin bodies were built from those field tables. None is an official MiFinity example.",
  dependencies: [
    "BVNK (named by MiFinity as the stablecoin infrastructure behind PayAnyCoin crypto payouts)",
    "Visa Direct (card payouts via PayAnyCard / PayMyCard)",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "mifinity.error",
      description:
        "Shared error envelope { errors: [{ type, errorCode, message, formObjectName, field }] } with the 25 documented errorCode values",
      status: "limited",
    },
    {
      id: "mifinity.deposit_callback",
      description:
        "eWallet deposit callback posted to returnUrl or errorUrl (traceId, validationKey, transactionReference, money; failures add errorMessage and detailedStatus)",
      status: "limited",
    },
    {
      id: "mifinity.deposit_status",
      description:
        "Payment Status API response (status SUCCESSFUL, PENDING, NOT_COMPLETED or FAILED, detailedStatus, errorMessage, paymentResponse)",
      status: "supported",
    },
    {
      id: "mifinity.payout_status",
      description:
        "Payout callback (PayAnyBank, PayAnyCard, PayMyCard, Account to Account, PayAnyCoin) and Transaction Status lookup with the numeric transactionStatus",
      status: "limited",
    },
    {
      id: "mifinity.payout_response",
      description:
        "Synchronous payout response (PayAnyBank, PayAnyCard, PayMyCard), Account to Account response with status OK, and PayAnyCoin response with statusCode / statusMessage",
      status: "limited",
    },
    {
      id: "mifinity.iframe_init",
      description: "init-iframe response with a session token (recognized but not analyzed)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "limited",
    // Proposed as supported; limited because PayAnyCoin statuses beyond
    // PENDING and the content of paymentResponse are not documented.
    paymentResponses: "limited",
    webhookParsing: "limited",
    timeline: "limited",
    // Proposed as supported; limited because traceId is only used as a key
    // for payouts, where MiFinity rejects a reused traceId.
    correlation: "limited",
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "error-codes", title: "Error codes", url: `${DOCS}/docs/error-codes` },
    { topic: "pab-error-codes", title: "PAB error codes", url: `${DOCS}/docs/pab-error-codes` },
    {
      topic: "transaction-status",
      title: "Transaction status (payout status ids, 404 and 5xx handling)",
      url: `${DOCS}/docs/transaction-status`,
    },
    {
      topic: "transaction-status-old",
      title: "Transaction status (older table with status 4 and Reversed)",
      url: `${DOCS}/docs/transaction-status-1`,
    },
    {
      topic: "payout-callbacks",
      title: "Notification callbacks (payouts)",
      url: `${DOCS}/docs/notification-callbacks`,
    },
    {
      topic: "withdrawal-callbacks",
      title: "Notification callbacks for withdrawals (documents status 5 as Failed)",
      url: `${DOCS}/docs/notification-callbacks-for-withdrawals`,
    },
    {
      topic: "deposit-callback",
      title: "Payment status callback (deposits)",
      url: `${DOCS}/docs/payment-status-callback`,
    },
    {
      topic: "payment-status",
      title: "Payment Status API (deposits)",
      url: `${DOCS}/docs/payment-status-api-1`,
    },
    { topic: "pab-flow", title: "PayAnyBank flow (traceId retries)", url: `${DOCS}/docs/pab-flow` },
    { topic: "payanycoin", title: "PayAnyCoin API", url: `${DOCS}/docs/payanycoin-api` },
    {
      topic: "signature",
      title: "Merchant signature verification (requests to MiFinity only)",
      url: `${DOCS}/docs/merchant-signature-verification`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "none documented (MiFinity documents no callback event id)",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "MiFinity documents no event id, retry schedule or duplicate rule for callbacks, so repeated deliveries cannot be recognized. A successful payout sends two callbacks (Submitted, then Processed by acquirer). Make the handler idempotent on traceId and transactionStatus, and confirm the state with the Transaction Status or Payment Status API.",
    docsUrl: `${DOCS}/docs/notification-callbacks`,
  },
  limitations: [
    "MiFinity documents no merchant sectors: no sector is documented on any page reviewed, so the sector list is empty. The payout callback value paymentCategoryType GAMING_PAYOUT is a payload value, not a statement of accepted sectors. Eligibility depends on jurisdiction, licensing and underwriting.",
    "Callbacks carry no documented signature or event id. A pasted callback is never verified and is not treated as authentic; X-MiFinity-Signature signs merchant requests to MiFinity, not callbacks, and is never copied. No deliveryKey is set, so repeated deliveries are not recognized as duplicates.",
    "Payout status 5 contradicts itself: most pages document it as Processed by acquirer (final success), the withdrawal callbacks page as Failed. Both meanings are shown. The outcome follows transactionStatusDescription when present; without it the outcome stays unknown.",
    "Status 4 (Processed by PSP) appears only on the older transaction status page. Reversed has no numeric id and is recognized only by transactionStatusDescription. No parent or original transaction field is documented for reversals.",
    "Submitted (3) means the funds are debited and MiFinity says to treat it as success, but Processed by acquirer, Rejected or Internal Error can follow; it is shown as pending.",
    "TRANSACTION_FAILED is a catch-all for unrelated causes and can carry processor text. It is decoded with possible confidence and an unknown category; the message gives only a hint.",
    "The PayAnyCoin (crypto payout) error reference is not published (the PAYC Gateway Error Reference and Runbook are named but not available), and only statusCode 7 / PENDING is documented. Other PayAnyCoin statuses stay unknown; statusCode 7 is never read as transactionStatus 7.",
    "Deposit callbacks have no status field on success and no timestamps. Success is inferred from the absence of errorMessage and detailedStatus and must be confirmed with the Payment Status API. The Refused by Risk example carries the same errorMessage as an abandoned deposit, so detailedStatus decides.",
    "Refunds, chargebacks, cancellations, subscriptions and deposit reversals are not documented and are not shown.",
    "traceId is merchant supplied. It links payout events only, where MiFinity rejects a reused traceId (DUPLICATED_TRANSACTION_ID). Deposit events are linked only by transactionReference; the content of the Payment Status paymentResponse object is not documented and is read with the deposit callback field names.",
    "createdOn is the creation time of the payout, not of the status change. It is used as event time only when transactionLastUpdated is missing.",
    "Error messages often contain unfilled placeholders ({0}), and the same code can appear under different error types. The generic list of 56 HTTP status codes has no MiFinity specific meaning; only 401 (Account to Account with TOTP), 403, 404 on status lookups and 5xx have documented rules.",
    "Money objects differ by endpoint (presentationAmount, displayable, actual), the fee field is totalFee in tables and totalFees in examples, and exchangeRate is a number or an object. Amounts are read from amount and currency only.",
    "The init-iframe response is recognized but not analyzed (it carries a session token, not a payment result). Lookup endpoints (currencies, bank fields, account listing) are not analyzed. Callback fields without a documented meaning, such as externalReference and responseCode, are not used.",
    "Category and retry guidance per code are PandaPayLens suggestions; MiFinity gives no per-code retry advice except the duplicate traceId rule and the status lookup rules.",
  ],
  samples: ["mifinity-payout-flow", "mifinity-deposit-refused"],
};
