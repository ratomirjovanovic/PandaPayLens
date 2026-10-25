import type { ProviderManifest } from "@pandapaylens/core";

export const TRUST_PAYMENTS_ADAPTER_VERSION = "0.1.0";

const SITE = "https://www.trustpayments.com";
const HELP = "https://help.trustpayments.com/hc/en-us/articles";

export const trustPaymentsManifest: ProviderManifest = {
  id: "trust_payments",
  displayName: "Trust Payments",
  version: TRUST_PAYMENTS_ADAPTER_VERSION,
  wave: "HR-1",
  researchStatus: "tested",
  categories: ["gateway", "acquiring", "card_processing"],
  sectors: [
    { sector: "iGaming / gambling", source: `${SITE}/industries/gaming/` },
    { sector: "Crypto", source: `${SITE}/industries/crypto/` },
    {
      sector: "Financial services (FX, remittance, treasury, money transfer, debt repayment)",
      source: `${SITE}/industries/financial-services/`,
    },
    { sector: "Medical cannabis / consumer CBD", source: `${SITE}/industries/medical-cannabis/` },
    { sector: "Travel", source: `${SITE}/industries/travel/` },
    { sector: "Hospitality", source: `${SITE}/industries/hospitality/` },
    { sector: "Education", source: `${SITE}/industries/education/` },
    { sector: "Insurance", source: `${SITE}/industries/insurance/` },
    { sector: "Contact centres (MOTO)", source: `${SITE}/industries/call-centres/` },
    { sector: "Retail", source: `${SITE}/trust-retail/` },
    {
      sector: "Subscription / recurring billing",
      source: `${HELP}/4403180713489-What-is-the-Subscription-Engine`,
    },
  ],
  regions:
    "UK: TrustUK Payments Ltd, authorised by the FCA under the Payment Services Regulations 2017 (Ref. 932557). EU/EEA: Trust Payments (Malta) Limited, authorised by the MFSA and passported across 30 EU/EEA countries. The group describes itself as serving the UK, EU and US. EEA e-commerce must use 3-D Secure (PSD2 SCA); UK merchants with MCC 6012 must send recipient fields (Visa Europe mandate); some acquirers require subscriptionfinalnumber for installments on the US platform.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures built from the documented field tables and the public examples in the Trust Payments Help Centre (identifiers replaced with PPLsynth placeholders). They are not official Trust Payments examples.",
  dependencies: [
    "An acquiring bank account and MID (Trust Payments acquiring or another acquirer); several response fields and features depend on the acquirer.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "trust_payments.webservices.envelope",
      description:
        "Webservices API JSON response envelope (requestreference, version 1.00, response[] or the client library's responses[], secrand), including TRANSACTIONQUERY records",
      status: "supported",
    },
    {
      id: "trust_payments.jwt.payload",
      description:
        "Decoded response JWT payload of the JavaScript Library and mobile SDKs ({ iat, payload: { response[] }, aud })",
      status: "supported",
    },
    {
      id: "trust_payments.response.object",
      description: "A single Webservices response object copied out of the response array",
      status: "supported",
    },
    {
      id: "trust_payments.url_notification",
      description:
        "URL notification (form-encoded, merchant-configurable fields, notificationreference always present)",
      status: "limited",
    },
    {
      id: "trust_payments.payment_pages.redirect",
      description:
        "Payment Pages browser redirect fields (errorcode, settlestatus, transactionreference; transport not documented)",
      status: "limited",
    },
    {
      id: "trust_payments.webservices.request",
      description: "Webservices API JSON request envelope ({ alias, version, request[] })",
      status: "unsupported",
    },
    {
      id: "trust_payments.webservices.xml",
      description: "Webservices API XML responseblock (version 3.67)",
      status: "unsupported",
    },
    {
      id: "trust_payments.reports.csv",
      description: "Transaction and report CSV downloads",
      status: "unsupported",
    },
    {
      id: "trust_payments.chargebacks",
      description: "Chargebacks (Portal and RAM Tool exports only; no API payload)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    // Response timestamps have no documented time zone (see limitations).
    timeline: "limited",
    correlation: "supported",
    // Generic and lifecycle rules apply; no Trust Payments specific state rules exist.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "error-codes",
      title: "STPP - Error codes (full list)",
      url: "https://webapp.securetrading.net/errorcodes.html",
    },
    { topic: "error-codes-help", title: "Error codes", url: `${HELP}/4402897300625-Error-codes` },
    {
      topic: "checks",
      title: "Checks to perform following payment",
      url: `${HELP}/4402723592977-Checks-to-perform-following-payment`,
    },
    { topic: "auth", title: "AUTH", url: `${HELP}/4402755159569-AUTH` },
    {
      topic: "refund",
      title: "REFUND with Webservices API",
      url: `${HELP}/4402765448209-REFUND-with-Webservices-API`,
    },
    {
      topic: "payouts",
      title: "Payouts with Webservices API",
      url: `${HELP}/4402771924497-Payouts-with-Webservices-API`,
    },
    {
      topic: "settlement",
      title: "Settlement for card transactions",
      url: `${HELP}/4402724045073-Settlement-for-card-transactions`,
    },
    {
      topic: "notifications",
      title: "URL notification",
      url: `${HELP}/8640643750417-URL-notification`,
    },
    {
      topic: "notifications-payment",
      title: "URL notifications following payments",
      url: `${HELP}/360021197998-URL-notifications-following-payments`,
    },
    { topic: "jwt", title: "JSON Web Token", url: `${HELP}/4402982320273-JSON-Web-Token` },
    {
      topic: "recurring",
      title: "Recurring payments",
      url: `${HELP}/4402772396817-Recurring-payments`,
    },
    {
      topic: "subscription-engine",
      title: "What is the Subscription Engine?",
      url: `${HELP}/4403180713489-What-is-the-Subscription-Engine`,
    },
    {
      topic: "advice-codes",
      title: "Acquirer advice code mapping",
      url: `${HELP}/22541881833617-Acquirer-advice-code-mapping`,
    },
    {
      topic: "3ds",
      title: "3DS API Field Specification",
      url: `${HELP}/6743917116945-3DS-API-Field-Specification`,
    },
    { topic: "chargebacks", title: "Chargebacks", url: `${HELP}/8640277410961-Chargebacks` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "notificationreference",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Process each notificationreference once and answer HTTP 200 within 8 seconds. Offline and failover notifications are resent with the same notificationreference for about 48 hours.",
    docsUrl: `${HELP}/8640643750417-URL-notification`,
  },
  limitations: [
    "Trust Payments publishes no table for acquirerresponsecode, acquirerresponsemessage or schemeresponsecode (they vary by acquiring bank), so the reason behind a 70000 decline is never decoded and 70000 is shown with possible confidence.",
    'Error code 50000 has two documented descriptions ("Socket receive error" in the error list, "Timeout" in the JSON Web Token article); both are shown and the outcome is treated as unknown.',
    'Codes 60100 to 60120 share the message "Invalid process" and Portal codes 21000 to 21060 have only suggested categories; they are decoded with possible confidence. Codes not on the official list are reported with insufficient confidence.',
    "URL notifications have no event-type field and their field set is configured by the merchant; only notificationreference is guaranteed. The event is inferred from requesttypedescription, errorcode, settlestatus and accounttypedescription when present and is marked as inferred. Without requesttypedescription the event type is unknown.",
    "Notifications and redirects are never treated as verified: responsesitesecurity (and any other hash or JWT) is not checked, copied or reported; only whether a 64-hex value is present is shown.",
    "The delivery key is notificationreference, which Trust Payments keeps across redeliveries. Webservices responses and Payment Pages redirects have no delivery key. Notification order and notification timestamps are not documented.",
    "transactionstartedtimestamp and settledtimestamp have no documented time zone. They are read as UTC for ordering only, so times may be offset by the account's time zone.",
    "Events are linked only by transactionreference and parenttransactionreference. orderreference, requestreference and subscriptionnumber are never used for correlation. Notifications carry parenttransactionreference only when the merchant configured it, and the link between a Subscription Engine schedule and the AUTHs it creates is not documented, so engine rebills may form separate groups.",
    "Settle status 100 (Settled) means batched and sent to the acquirer, not that funds reached the merchant. Settle status 2 (Suspended) is shown as pending; the reason for a suspension is not in the payload.",
    "Payouts are REFUND requests on a CFT account and are shown with stage payout; other REFUNDs are refunds. Mastercard duplicate-payout advice codes are shown as advice only.",
    "Chargebacks are only available in Portal and the RAM Tool (CSV/XLSX exports); no chargeback payload exists in the gateway API or notifications, so disputes are not analyzed.",
    "XML responseblocks cannot be analyzed because PandaPayLens input parsing accepts JSON and form data only. Encoded JWT strings must be decoded before pasting; the decoded payload is supported. Webservices request envelopes are recognized but not analyzed.",
    "Only JSON API version 1.00 is documented; envelopes declaring another version are recognized but not analyzed.",
    "Real payloads may contain the legacy Secure Trading names and hosts; detection is structural and never relies on brand strings.",
    "Protect Plus fraudcontrolresponsecode values and the customeroutput field have no published meaning and are shown without interpretation.",
  ],
  samples: ["trust-payments-declined", "trust-payments-recurring", "trust-payments-gaming-payout"],
};
