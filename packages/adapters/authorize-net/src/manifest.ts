import type { ProviderManifest } from "@pandapaylens/core";

export const AUTHORIZE_NET_ADAPTER_VERSION = "0.2.0";

const DEV = "https://developer.authorize.net";
const SITE = "https://www.authorize.net";

export const authorizeNetManifest: ProviderManifest = {
  id: "authorize_net",
  displayName: "Authorize.net",
  version: AUTHORIZE_NET_ADAPTER_VERSION,
  wave: 2,
  researchStatus: "tested",
  // merchant_account_intermediary only through the All-in-one plan; who
  // underwrites that merchant account is not documented. Not an acquirer and
  // not a processor: transactions are routed to the merchant's processor.
  categories: ["gateway", "merchant_account_intermediary"],
  // General mentions only; Authorize.net names no high-risk sector.
  sectors: [
    { sector: "Nonprofits", source: `${SITE}/` },
    {
      sector: "Subscriptions, retainers and payment plans",
      source: `${SITE}/sign-up/pricing.html`,
    },
    { sector: "B2B transactions", source: `${SITE}/sign-up/pricing.html` },
  ],
  regions:
    "No list of supported merchant countries is documented. eCheck is available only to businesses based in the U.S.; dynamic currency conversion requires U.S. dollars (reason code 240); some European processors require billing name and address fields (reason code 325); the card-on-file merchant-initiated rules are described for EEA cards. Authorize.net is moving onto the Visa Acceptance Platform, with Canada as the pilot market. A listed sector does not mean a merchant will be approved; eligibility depends on jurisdiction, licensing and underwriting by the merchant account provider.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers (refId, merchantReferenceId, notificationId, webhookId). Transaction ids are numeric strings made of synthetic digits because Authorize.net transaction ids are numeric; notification and webhook ids are not UUIDs so that they can carry the PPLsynth marker. Shapes follow the JSON createTransactionResponse and webhook examples of the public API reference and webhooks page; decline and held-for-review responses have no published example and are built from the field table and the response code reference (pairing E00027 with the decline follows that code's description; the held response carries no API-level messages because their content is not documented). Message texts are only those quoted in the documentation. The XML fixtures carry the same kind of synthetic values in the element names, element order and namespace of AnetApiSchema.xsd, with the list wrappers the XML flavor uses (<messages><message>, <errors><error>); two of them hold exactly the values of a JSON fixture. The ErrorResponse fixture uses the XSD's ErrorResponse element, which carries only the API-level messages. None is an official Authorize.net example.",
  dependencies: [
    "The merchant's payment processor: Authorize.net routes transactions to back-end processors (for example Chase Paymentech, Elavon, EVO, First Data, Global Payments, Heartland, Worldpay, Barclays, HSBC), and many reason codes are specific to one processor.",
    "A merchant account provider (acquiring bank or reseller) for the Gateway only plan.",
    "Visa: Authorize.net is a wholly owned subsidiary of Visa and is moving onto the Visa Acceptance Platform.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "authorize_net.transaction_response",
      description:
        "Authorize.net API createTransactionResponse, JSON or XML: transactionResponse with responseCode 1-4 and reason codes, plus the API-level messages (JSON unwrapped or wrapped in createTransactionResponse; XML with the createTransactionResponse root in the AnetApiSchema.xsd namespace)",
      status: "limited",
    },
    {
      id: "authorize_net.api_messages",
      description:
        "Authorize.net API response that carries only the API-level messages object (resultCode Ok/Error with I/E codes), from any API method, JSON or XML (any root ending in Response in the AnetApiSchema.xsd namespace, for example ErrorResponse)",
      status: "supported",
    },
    {
      id: "authorize_net.webhook",
      description:
        "Webhook notification (notificationId, eventType net.authorize.*, eventDate, webhookId, payload) for payment, fraud, customer profile, payment profile and subscription events",
      status: "limited",
    },
    {
      id: "authorize_net.transaction_details",
      description:
        "Transaction Reporting getTransactionDetails response (transaction.transactionStatus); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "authorize_net.notification_history",
      description:
        "Webhooks REST API notification history record (deliveryStatus, retryLog); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "authorize_net.webhook.partner_boarding",
      description: "net.authorize.partner.boarding.* webhooks; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "authorize_net.legacy",
      description:
        "Legacy AIM (transact.dll, x_ fields), SIM, DPM, Silent Post and Relay Response formats, and the Accept Hosted transactResponse message",
      status: "unsupported",
    },
  ],
  capabilities: {
    // Both result layers are decoded from the first-party response code list.
    errorDecoding: "supported",
    // No decline or held example is published, and the response does not
    // echo the transaction type.
    paymentResponses: "limited",
    // Payloads are known only from examples and carry no reason code or parent id.
    webhookParsing: "limited",
    // API responses carry no timestamp; settlement status is only in the reporting API.
    timeline: "limited",
    // transId and refTransID link API responses; webhooks carry no parent id.
    correlation: "limited",
    // Only the provider-agnostic rules apply.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "codes",
      title: "Response code reference",
      url: `${DEV}/api/reference/features/errorandresponsecodes.html`,
    },
    {
      topic: "codes-json",
      title: "Response code list (JSON)",
      url: `${DEV}/api/reference/dist/json/responseCodes.json`,
    },
    { topic: "api", title: "API reference", url: `${DEV}/api/reference/index.html` },
    { topic: "webhooks", title: "Webhooks", url: `${DEV}/api/reference/features/webhooks.html` },
    {
      topic: "transactions",
      title: "Payment transactions",
      url: `${DEV}/api/reference/features/payment-transactions.html`,
    },
    {
      topic: "reporting",
      title: "Transaction reporting",
      url: `${DEV}/api/reference/features/transaction-reporting.html`,
    },
    {
      topic: "recurring",
      title: "Recurring billing",
      url: `${DEV}/api/reference/features/recurring-billing.html`,
    },
    { topic: "testing", title: "Testing guide", url: `${DEV}/hello_world/testing_guide.html` },
    { topic: "hash", title: "Transaction hash upgrade", url: `${DEV}/support/hash_upgrade.html` },
    {
      topic: "upgrade",
      title: "Upgrade guide (legacy methods)",
      url: `${DEV}/api/upgrade_guide.html`,
    },
    {
      topic: "schema",
      title: "API schema (XSD)",
      url: "https://api.authorize.net/xml/v1/schema/AnetApiSchema.xsd",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "notificationId",
    duplicatesDocumented: false,
    ordering: "not_documented",
    dedupeAdvice:
      "Make the webhook handler idempotent: record processed notificationId values and check the transaction with getTransactionDetails before acting. Authorize.net retries a failed delivery up to 10 times (3 at three-minute intervals, 3 at eight-hour intervals, 4 at 48-hour intervals) and then deactivates the webhook; its notification history groups all attempts under one notificationId, but the documentation does not state that retries reuse it.",
    docsUrl: `${DEV}/api/reference/features/webhooks.html`,
  },
  limitations: [
    "Two result layers are decoded separately: transactionResponse.responseCode (1 approved, 2 declined, 3 error, 4 held for review) and the transaction response reason codes in errors[].errorCode and messages[].code. Reason codes 1-4 have different meanings from responseCode 1-4, so the two values are never looked up in each other's table. The API-level messages.resultCode (Ok/Error) and its I/E codes form a third, independent table; E00027 only says that the transaction layer carries the reason.",
    "Many reason codes share the same customer-facing text and differ only in Authorize.net's integration suggestions; the decoded meaning follows the suggestions. Code 38 has conflicting meanings in Authorize.net's two response code files, codes 104-110 say under review while their suggestions describe eCheck validation failures, code 103 is documented as no longer in use and code 2201 appears only in the second file; these are decoded with possible confidence. Processor-specific codes (FDC Omaha, Concord EFS, Wells Fargo SecureSource, TSYS, WePay) are decoded as documented, but the documentation does not say which of these processors are still in use.",
    "Authorize.net publishes no example of a declined (responseCode 2) or held (responseCode 4) createTransactionResponse, so the API-level code that accompanies them is not documented. responseCode 3 is treated as an unknown outcome when its reason code describes a processor, network or unexplained error, because the original may have been processed.",
    "createTransactionResponse does not echo transactionType. A response without refTransID is shown as a payment, one with refTransID as a follow-up (stage other) because a capture, void, refund or PayPal continue step cannot be told apart. transId 0 is returned for errors and in test mode and is not used as a reference.",
    "createTransactionResponse has no amount, currency or timestamp. Prepaid requested and approved amounts are shown as supplied; no amount is converted to minor units and amount checks do not run.",
    "Webhook payloads are known only from examples: they carry the transaction's own id, responseCode, authCode, avsResponse and authAmount, but no reason code, no parent transaction id, no currency and no invoice number. A refund webhook therefore cannot be linked to its original sale unless the refund's API response (transId with refTransID) is also supplied. Declines and errors in webhooks are shown without a reason; call getTransactionDetails for the reason and the current status.",
    "Webhook responseCode values other than 1-4 (the documentation's failed-delivery example shows 0) are shown as undocumented. Whether capture.created is also sent for captureOnly transactions, and whether payment events are sent for declines, is not documented. A refund.created event is shown as pending because the refund settles in a later batch.",
    "net.authorize.customer.subscription.failed has no description beyond its name and is shown as a subscription failure; subscription events carry the subscription id only and are not linked to the transactions they create. Customer profile and payment profile events are shown without their profile ids.",
    "The X-ANET-Signature header (HMAC-SHA512 with the merchant's Signature Key) is sensitive and is never verified or copied; only its presence is shown. Its exact value format is not documented. transHash and transHashSha2 are integrity values tied to the Signature Key and are never copied.",
    "Webhook delivery order is not documented. notificationId is used as the delivery key: the notification history groups all attempts under it, but the documentation does not state that retries reuse it.",
    "AVS, card code and CAVV results are informational; a no-match result is mentioned on a decline only as a possible factor. Filter rejections appear as reason codes (27, 44, 45, 65, 127, 165). merchantAdvice codes (TSYS) are shown but not interpreted because their values are not documented. rawResponseCode, testRequest and SupplementalDataQualificationIndicator have no documented meaning and are not read.",
    "Card numbers, expiration dates, card codes, bank account data, track and EMV data, opaque wallet data, names, addresses, emails, IP addresses, PayPal payer data and URLs, user fields, auth codes and the masked accountNumber are never copied. API Login ID, transaction key and access tokens are never copied.",
    "XML is read only from documents whose root element is declared in the AnetApiSchema.xsd namespace (AnetApi/xml/v1/schema/AnetApiSchema.xsd) and ends in Response; XML without that namespace declaration and XML requests are not recognized. The XML lists (<messages><message>, <errors><error>, <splitTenderPayments><splitTenderPayment>) are read as the JSON arrays, a single item included, and attributes such as xsi:nil are ignored. One documented XML example places <message> directly under <transactionResponse>; that form is accepted too. NMI runs an Authorize.Net emulator that covers XML; whether it answers with this namespace is not documented, and if it does, the document alone cannot tell the two apart.",
    "getTransactionDetails responses (JSON or XML), notification history records and partner boarding webhooks are recognized but not analyzed. Legacy AIM, SIM, DPM, Silent Post and Relay Response formats and the Accept Hosted transactResponse message are not recognized; an Authorize.net-shaped legacy payload may also come from another gateway's emulator.",
    "Category and retry guidance per code are PandaPayLens suggestions based on Authorize.net's descriptions and integration suggestions, not Authorize.net statements.",
  ],
  samples: ["authorize-net-capture-refund", "authorize-net-declined"],
};
