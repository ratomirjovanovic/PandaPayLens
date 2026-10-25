import type { ProviderManifest } from "@pandapaylens/core";

export const SKRILL_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.paysafe.com/docs/digital-wallets";

export const skrillManifest: ProviderManifest = {
  id: "skrill",
  displayName: "Skrill",
  version: SKRILL_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  // Quick Checkout is a hosted page that routes to cards, banks and APMs, but
  // the research does not establish a merchant-facing card gateway, acquiring
  // or facilitator role, so only these two categories are claimed.
  categories: ["wallet", "alternative_payment_method"],
  // Skrill's merchant documentation lives on the Paysafe developer portal;
  // Paysafe owns Skrill, so these pages are first-party sources.
  sectors: [
    { sector: "iGaming", source: "https://www.paysafe.com/en/industries-we-serve/igaming/" },
    {
      sector: "gambling (payouts of winnings)",
      source: `${DOCS}/api-mqi/quick-checkout-payouts`,
    },
    { sector: "eCommerce (merchant type)", source: `${DOCS}/api-mqi/about` },
  ],
  regions:
    "Skrill does not accept customers from Afghanistan, Cuba, Eritrea, Iran, Iraq, Japan, Kyrgyzstan, Libya, North Korea, Sudan, South Sudan and Syria, and takes no new registrations from India. Legal entities: Paysafe Payment Solutions Limited (EEA, Central Bank of Ireland), Skrill USA, Inc. (US) and Skrill Limited (other countries, FCA). Merchant balances are split into EEA and non-EEA groups (account_id). Merchants outside the EU/EEA/US get no right to show Visa/Mastercard marks under the Skrill processing agreement. Payment methods have their own country lists.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Skrill publishes no raw Quick Checkout status_url example, so the status_url, refund, recurring and bank payout status fixtures were built from the documented field tables (the HTTP fixtures say so in an X-PPL-Fixture header). The bank payout error fixtures use documented codes with synthetic messages. The payout status report fixture follows the shape of the published payout status post with synthetic values. None are official provider examples.",
  status: "limited",
  apiFamilies: [
    {
      id: "skrill.status_url",
      description:
        "Quick Checkout / Wallet Checkout status_url post (status 2, 0, -1, -2, -3, failed_reason_code), also the MQI status_trn body with the same fields",
      status: "supported",
    },
    {
      id: "skrill.status_url.payout",
      description:
        "Quick Checkout payout and Unlinked Merchant Bank Payout status posts (same field set as the payment post)",
      status: "limited",
    },
    {
      id: "skrill.refund_status",
      description: "Refund status report posted to refund_status_url",
      status: "supported",
    },
    {
      id: "skrill.recurring_status",
      description: "Recurring billing post to rec_status_url",
      status: "limited",
    },
    {
      id: "skrill.ubp.error",
      description: "Unlinked Merchant Bank Payout JSON error responses (preparation and execution)",
      status: "experimental",
    },
    {
      id: "skrill.api.xml",
      description:
        "XML responses of refund.pl, pay.pl and ondemand_request.pl (error_msg strings are in the catalog only)",
      status: "unsupported",
    },
    {
      id: "skrill.mqi.text",
      description: "MQI status_rec / status_od text, history CSV and MQI HTTP errors",
      status: "unsupported",
    },
    {
      id: "skrill.return_url",
      description: "return_url redirect parameters (transaction_id, msid), recognized only",
      status: "unsupported",
    },
    {
      id: "skrill.balance.webhook",
      description: "Balance Notification Webhook and Balance Exchange (treasury), recognized only",
      status: "unsupported",
    },
  ],
  capabilities: {
    // failed_reason_code decoding is tested end to end; the 58 API/MQI error
    // strings arrive in XML, which core does not parse, so they are catalog-only.
    errorDecoding: "limited",
    // Only the bank payout JSON errors can be imported; the refund, transfer and
    // 1-Tap responses are XML.
    paymentResponses: "experimental",
    // Payment and refund posts are fully decoded, but payout posts share the
    // payment field set and recurring / 1-Tap field sets are partly undocumented.
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    // Generic and lifecycle rules apply; there are no Skrill-specific rules.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "quick-checkout",
      title: "Skrill Quick Checkout guide",
      url: `${DOCS}/quick-checkout`,
    },
    {
      topic: "status-url",
      title: "Quick Checkout status_url fields and status values",
      url: `${DOCS}/quick-checkout/introduction`,
    },
    {
      topic: "failed-reason-codes",
      title: "Quick Checkout failed reason codes",
      url: `${DOCS}/quick-checkout/error-codes`,
    },
    {
      topic: "wallet-checkout-failed-reason-codes",
      title: "Wallet Checkout failed reason codes",
      url: `${DOCS}/wallet-checkout/failed-reason-codes`,
    },
    {
      topic: "chargebacks-refunds",
      title: "Account and integration options (refunds, chargeback notification)",
      url: `${DOCS}/quick-checkout/account-and-integration-options`,
    },
    {
      topic: "recurring",
      title: "Skrill recurring billing",
      url: `${DOCS}/quick-checkout/skrill-recurring-billing`,
    },
    { topic: "md5", title: "MD5 signature", url: `${DOCS}/quick-checkout/md5` },
    { topic: "api-errors", title: "API error messages", url: `${DOCS}/api-mqi/error-messages` },
    { topic: "refunds", title: "Refunds API", url: `${DOCS}/api-mqi/refunds` },
    {
      topic: "payouts",
      title: "Quick Checkout payouts",
      url: `${DOCS}/api-mqi/quick-checkout-payouts`,
    },
    { topic: "mqi", title: "Merchant Query Interface", url: `${DOCS}/api-mqi/mqi` },
    {
      topic: "bank-payouts",
      title: "Unlinked merchant bank payouts",
      url: `${DOCS}/unlinked-merchant-bank-payouts`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "mb_transaction_id and status (Skrill documents no event id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Skrill posts again until it receives HTTP 200 (up to 10 posts) and warns about repeated posts for the same transaction. Make the status_url handler idempotent per mb_transaction_id and status, and answer HTTP 200.",
    docsUrl: `${DOCS}/quick-checkout/introduction`,
  },
  limitations: [
    "Skrill publishes no raw Quick Checkout status_url example, and the Content-Type of the post is not documented. The adapter follows the documented field tables and accepts the fields as a form body, a raw HTTP request, a URL query string or a JSON dump of the fields.",
    "Quick Checkout payout and bank payout status posts use the same field set as payment posts and cannot be told apart from them by structure. A post is marked as a payment only when it carries a field documented only for payments (for example customer_id, payment_type WLT/MDB, rec_payment_id); otherwise it is shown with stage payment and operation payment_or_payout. Status 1 (scheduled) and -4 (returned) occur only in bank payout posts and are shown as payouts.",
    "failed_reason_code is sent only with status -2 and only when Skrill Merchant Services has enabled it. A failed post without it is decoded only as failed; PandaPayLens does not guess the reason. Code 54 is cited in the status -2 description but is in neither reason-code table and is decoded with possible confidence.",
    "The Quick Checkout and Wallet Checkout reason-code tables disagree: code 19 means invalid or expired credentials in one and 'retry transaction' in the other, and code 06 is worded differently. Both meanings are shown. Padded (05) and unpadded (5) values are treated as the same code. Reason codes in bank payout posts are not decoded, because no table is documented for them.",
    "Refunds, chargebacks and payouts get a new mb_transaction_id, and no notification field links them to the original payment. They are never merged with the payment by amount, time or merchant reference. Which ids a chargeback (-3) post carries is not documented.",
    "transaction_id is a merchant reference (in refund reports it is the refund transaction ID) and is never used for correlation. mb_transaction_id and rec_payment_id (recurring / 1-Tap mandate) are the only correlation keys.",
    "Posts carry no timestamp and no event id. Repeated deliveries are recognized by mb_transaction_id and status. Recurring posts have no reliable delivery key. Retry behavior for refund and recurring posts and the delivery order are not documented; events are shown in the order supplied.",
    "md5sig, sha2sig and msid are never verified (that needs the merchant's secret word) and never copied; only their presence and hex length are shown. A pasted post is never treated as authentic.",
    "XML responses of refund.pl, pay.pl and ondemand_request.pl, MQI text responses (status_rec, status_od, history) and MQI HTTP errors cannot be imported, because PandaPayLens core does not parse XML or plain text. Their codes (58 API/MQI error strings, 5 MQI HTTP errors, 2 Bank API codes) are available in the catalog only.",
    "The rec_status_url post is decoded only for status 2 and -2; the docs describe that URL both as a cancellation URL and as receiving every recurring payment, and its field set is partly undocumented. ondemand_status_url (1-Tap cancellation) field names are not documented and are not recognized.",
    "Bank payout JSON errors are documented both as flat code/message/description and as nested error.code with details. Numeric 70xx codes in the nested shape are not claimed automatically, because Paysafe JSON uses the same shape; select the provider manually. Code 7016 is not documented. Bank payout success responses are not analyzed.",
    "Skrill used as a payment method inside Paysafe Checkout or the Paysafe Payments API uses Paysafe's own JSON format (paymentType SKRILL). It is not recognized by this adapter.",
    "Skrill is a wallet: there is no authorization, capture or void model for merchants. Status 2 means the funds reached the merchant's Skrill account; it is neither a card authorization nor a bank settlement. Card issuer outcomes reach the merchant only as failed_reason_code, and who acquires cards is not documented.",
    "pay_from_email, pay_to_email, customer_id, country fields, IP_country, instrument_id and echoed merchant_fields values are never copied. mb_amount can carry more decimals than the currency allows; it is then not converted, and the event amount uses amount/currency.",
    "The return_url parameters (transaction_id, msid) only show that the customer finished the checkout and are recognized but not analyzed. The Balance Notification Webhook and Balance Exchange (treasury) are out of scope. Skrill JS browser codes and Verification of Payee results are not included.",
    "An MQI status_trn response has the same fields as the status_url post; pasting both for one transaction shows them as repeated deliveries.",
    "The web documentation carries no version or date stamps.",
  ],
  samples: ["skrill-failed-insufficient-funds", "skrill-chargeback"],
};
