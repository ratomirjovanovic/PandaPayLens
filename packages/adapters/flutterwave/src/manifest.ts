import type { ProviderManifest } from "@pandapaylens/core";

export const FLUTTERWAVE_ADAPTER_VERSION = "0.1.0";

const D = "https://developer.flutterwave.com";
const D4 = `${D}/v4.0.0`;

export const flutterwaveManifest: ProviderManifest = {
  id: "flutterwave",
  displayName: "Flutterwave",
  version: FLUTTERWAVE_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // Acquiring is done by a partner bank ("Flutterwave's acquiring bank"), and
  // orchestration, payment_facilitator and merchant_account_intermediary are
  // not claimed by the documentation.
  categories: ["gateway", "card_processing", "alternative_payment_method", "wallet"],
  sectors: [
    { sector: "Fintechs", source: `${D4}/docs/fintechs` },
    { sector: "Banks and other financial institutions", source: `${D4}/docs/banks-and-ofis` },
    { sector: "Travel and hospitality", source: `${D4}/docs/travel-and-hospitality` },
    { sector: "E-commerce", source: `${D4}/docs/e-commerce` },
    { sector: "Remittance", source: `${D4}/docs/remittance` },
    { sector: "Telecommunications", source: `${D4}/docs/telecommunications` },
  ],
  regions:
    "Transfers to Nigeria, the United States, the United Kingdom, SEPA, Ghana, Kenya, Uganda, Tanzania, South Africa, Cameroon, Ivory Coast, Sierra Leone, Senegal, Rwanda and over 30 other countries, as Flutterwave states them. Mobile money collections in francophone Africa, Ghana, Kenya (M-PESA), Rwanda, Tanzania, Uganda and Zambia. Payouts to Zambia only for merchants registered in Zambia (code 229400); XAF-to-XAF transfers only without approval (226400); XOF mobile money destination limits (230400); NGN-only bank transfer collections; refund minimums NGN 100 and KES 10. Direct card charges need PCI DSS certification and transfers need IP whitelisting. Licences are published for the Send remittance app (US FinCEN MSB and state money transmitter licences, Central Bank of Nigeria licences, UK and EU partners); which entity contracts with API merchants is not documented. A listed sector does not mean a merchant will be approved.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. Shapes follow the v3 and v4 examples transcribed from Flutterwave's developer documentation (verify response, charge and transfer webhooks, refund and chargeback objects, the v4 error object, charge and transfer webhooks) with synthetic values; customer, card and bank blocks are reduced to synthetic placeholders. Decline fixtures use only the documented processor_response, message and complete_message texts. None is an official Flutterwave example.",
  dependencies: [
    "Flutterwave's partner acquiring bank for card chargebacks (not named in the payloads).",
    "Banks, card issuers and mobile money operators that complete asynchronous payments and payouts; their own codes are not documented by Flutterwave beyond the v4 processor_response list.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "flutterwave.v3.response",
      description:
        "v3 REST response envelope (status, message, data) with a transaction, transfer, refund or chargeback object, an authorization prompt (meta.authorization), or an error message",
      status: "supported",
    },
    {
      id: "flutterwave.v3.object",
      description:
        "A bare v3 transaction, transfer, refund or chargeback object without the envelope",
      status: "supported",
    },
    {
      id: "flutterwave.v3.webhook",
      description:
        "v3 webhook (event, data, event.type): charge.completed, preauth-card, transfer.completed and chargeback events",
      status: "supported",
    },
    {
      id: "flutterwave.v3.refund_webhook",
      description: "v3 refund webhook (PascalCase keys, no event key, meta as a JSON string)",
      status: "limited",
    },
    {
      id: "flutterwave.v3.server_error",
      description: "v3 server error body (error_id, message, code app_error)",
      status: "supported",
    },
    {
      id: "flutterwave.v4.error",
      description: "v4 error response (status failed, error.type, error.code, validation_errors)",
      status: "supported",
    },
    {
      id: "flutterwave.v4.response",
      description:
        "v4 REST response with a charge (chg_), transfer (trf_), refund (rfd_) or chargeback (chb_) object",
      status: "limited",
    },
    {
      id: "flutterwave.v4.webhook",
      description:
        "v4 webhook (webhook_id or id, timestamp, type, data): charge.completed, transfer.disburse, transfer.reversal, refund.completed",
      status: "limited",
    },
    {
      id: "flutterwave.v3.other_webhook",
      description:
        "v3 webhooks outside payments acceptance (subscription, BVN, bill payment, tokenization, quote) and virtual card notifications; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "flutterwave.v3.transaction_events",
      description:
        "v3 transaction timeline (GET /transactions/{id}/events); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "flutterwave.v3.redirect",
      description:
        "v3 redirect parameters (status, tx_ref, transaction_id) after Inline, Standard or 3-D Secure; recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "flutterwave.v2",
      description: "Older v2 API; not researched",
      status: "unsupported",
    },
  ],
  capabilities: {
    // v3, the stable default, has no readable code table: declines are decoded
    // only from documented free-text messages.
    errorDecoding: "limited",
    paymentResponses: "supported",
    // v3 webhooks have no delivery id, the refund webhook has no event key,
    // and v4 webhook ids are documented under two names.
    webhookParsing: "limited",
    timeline: "limited",
    // v3 chargeback webhooks link to the charge only through flw_ref, and v3
    // and v4 identifiers cannot be linked to each other.
    correlation: "limited",
    // Only the provider-agnostic rules apply.
    diagnosticRules: "limited",
  },
  documentation: [
    { topic: "errors", title: "v3 common errors", url: `${D}/docs/common-errors` },
    {
      topic: "timeouts",
      title: "v3 handling error timeouts",
      url: `${D}/docs/handling-error-timeouts`,
    },
    { topic: "webhooks", title: "v3 webhooks", url: `${D}/docs/webhooks` },
    {
      topic: "verify",
      title: "v3 transaction verification",
      url: `${D}/docs/transaction-verification`,
    },
    { topic: "card", title: "v3 direct card charge", url: `${D}/docs/direct-card-charge` },
    { topic: "preauth", title: "v3 preauthorization", url: `${D}/docs/preauthorization` },
    { topic: "refunds", title: "v3 refunds", url: `${D}/docs/refunds` },
    { topic: "chargebacks", title: "v3 chargebacks", url: `${D}/docs/chargebacks` },
    { topic: "transfers", title: "v3 transfers", url: `${D}/docs/introduction-6` },
    { topic: "testing", title: "v3 testing", url: `${D}/docs/testing` },
    { topic: "v4-errors", title: "v4 errors and code tables", url: `${D4}/docs/common-errors` },
    { topic: "v4-webhooks", title: "v4 webhooks", url: `${D4}/docs/webhooks` },
    { topic: "v4-charges", title: "v4 charge schema", url: `${D4}/reference/charges_get` },
    { topic: "v4-transfers", title: "v4 transfer schema", url: `${D4}/reference/transfer_get` },
    { topic: "v4-testing", title: "v4 testing and issuer responses", url: `${D4}/docs/testing` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "event, data.id and data.status for v3 webhooks (Flutterwave's own suggestion; v3 has no event or delivery id); webhook_id (or id) for v4 webhooks",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Flutterwave may send the same webhook more than once and retries (when enabled) 3 times, 30 minutes apart. Make the handler idempotent on the event, transaction id and status, and verify the transaction (GET /transactions/{id}/verify) or the transfer before giving value.",
    docsUrl: `${D}/docs/webhooks`,
  },
  limitations: [
    "The v3 payment error table is an embedded view that could not be read. v3 errors and declines are decoded only from documented message texts (27 error messages, 3 failure processor_response values, 6 transfer complete_message values and 8 card velocity trigger errors), case-insensitively and by prefix where the message has variable text. Any other text is shown as received, with an unknown category.",
    "v3 data.status values are not enumerated by Flutterwave. Only successful, failed, pending, success-pending-validation and pending-capture are interpreted; other values are shown as unknown. The envelope status (success or error) is about the API call, not the payment.",
    "A v3 refund with status completed has been initiated and is waiting for disbursement; it is shown as pending. Only the completed-* statuses are shown as finished. A disburse_status in the refund webhook meta is shown but not interpreted.",
    "A v3 void response reports status successful; it is shown as a void (not a payment success) only when processor_response says Charge voided.",
    "Mobile money, bank transfer, USSD, QR and similar flows stay pending until a later webhook or verify response shows the final state.",
    "v3 webhooks have no event or delivery id. Repeated deliveries are recognized by event, data.id and data.status, as Flutterwave suggests; the v3 refund webhook has no event key and gets no delivery key.",
    "v3 objects carry only their creation time (created_at). It is used as the event time, so several states of one transaction share one time and keep the order of the input. Webhook delivery order is not documented.",
    "v3 transfer.completed also reports wallet funding and payout sub-account inflows (narration WALLET FUNDING or debit_currency PSA); those are shown as stage other, not as payouts. Transfer retries get a new id and the reference <original>_RETRY_<n>; retries are linked to the original by that reference.",
    "v3 chargeback webhooks link to the charge only through flw_ref. Refund webhooks link through TransactionId. v3 numeric ids and v4 prefixed ids cannot be linked to each other.",
    "v4 error codes are decoded by the pair error.code and error.type, because v4 reuses numbers across tables (for example 301404 and 209400 have two meanings each). A code whose type is missing or unknown is decoded with possible confidence only when it has a single meaning.",
    "v4 card processor_response is decoded by its type; the timeout example uses type pending with code 02, outside the documented list, so a code alone is never trusted. The v4 payout provider_response type invalid_wallet_currency has no documented meaning.",
    "v4 webhook ids are documented as webhook_id (schema) and id (webhooks page); both are read. Whether a retried v4 webhook keeps its id is not documented. The payload of order.authorization is not documented and is shown without interpretation; v4 chargeback webhooks are not documented.",
    "Signatures are never verified or copied: the v3 verif-hash header carries the merchant's secret hash itself and the v4 flutterwave-signature header is an HMAC of the body. A pasted webhook is never treated as authentic.",
    "Customer, card, bank and device fields (names, e-mail addresses, phone numbers, card digits and tokens, account numbers, IP addresses, device fingerprints, narration, redirect URLs, merchant account ids) are never copied.",
    "v3 HTML error pages, the v3 transaction events timeline, redirect query parameters, non-payment v3 webhooks (subscription, BVN, bill payment, tokenization, quote), virtual card notifications and the v2 API are not analyzed.",
    "Category and retry guidance per code or message are PandaPayLens suggestions; where Flutterwave gives advice (verify before retrying after a timeout, do not retry failed card charges automatically) it is reflected.",
  ],
  samples: ["flutterwave-refund-pending", "flutterwave-preauth-void"],
};
