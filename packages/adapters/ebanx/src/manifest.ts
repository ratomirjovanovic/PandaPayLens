import type { ProviderManifest } from "@pandapaylens/core";

export const EBANX_ADAPTER_VERSION = "0.1.0";

const DOCS = "https://docs.ebanx.com/docs";
const SITE = "https://www.ebanx.com/en";

export const ebanxManifest: ProviderManifest = {
  id: "ebanx",
  displayName: "EBANX",
  version: EBANX_ADAPTER_VERSION,
  wave: 3,
  researchStatus: "tested",
  // payment_facilitator, wallet, orchestration and merchant_account_intermediary
  // are not claimed by the pages read.
  categories: ["card_processing", "acquiring", "gateway", "alternative_payment_method"],
  sectors: [
    { sector: "SaaS and cloud", source: `${SITE}/industries/global-saas/` },
    { sector: "Gaming (video games)", source: `${SITE}/industries/gaming/` },
    { sector: "Shared economy", source: `${SITE}/industries/shared-economy/` },
    { sector: "E-commerce", source: `${SITE}/industries/e-commerce/` },
    { sector: "Streaming", source: `${SITE}/industries/streaming/` },
    { sector: "Digital ads", source: `${SITE}/industries/digital-ads/` },
    { sector: "Travel and OTA", source: `${SITE}/industries/travel/` },
    {
      sector: "Airlines",
      source: `${SITE}/insights/articles/what-types-of-businesses-do-we-serve/`,
    },
    { sector: "B2B high-value payments", source: `${SITE}/industries/others/` },
  ],
  regions:
    "EBANX operates in more than 20 countries in Latin America, Africa and Asia; pay-in and payout availability is listed per country and tenant (cross-border hosts api.ebanxpay.com, local hosts api-local-latam.ebanxpay.com; the older ebanx.com hosts still work). Licences as EBANX states them: Payment and Collection Service Provider registration with the Central Bank of Uruguay, CMF authorization as a cross-border sub-acquirer in Chile, and an In-Principle Approval for a Major Payment Institution licence from the Monetary Authority of Singapore. Payouts are documented for senders outside Brazil, Chile, Colombia and Mexico, not for taxes or salaries, up to USD 10,000 per payee document per month. Gambling, adult content, crypto exchanges and forex are not documented as served sectors, and the prohibited products list could not be read. A listed sector does not mean a merchant will be approved.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures with PPLsynth identifiers. The query response with a chargeback node, the Pix Automatico decline, the integration_key error, the NuPay BP-DR-20 error, the notification body and the payout error follow examples transcribed from EBANX's guides and pay-in scenario file, with synthetic identifiers. Card declines, captures, refunds, cancellations, other error messages and payout responses are built from the documented field tables and OpenAPI enumerations. EBANX's example hashes are lowercase hex; the fixtures use PPLsynth hashes instead. None is an official EBANX example.",
  dependencies: [
    "Local acquirers, card schemes and alternative payment method providers in each country, named only as transaction_status.acquirer (EBANX or EBANX IP in the examples).",
    "EBANX also processes behind partner platforms (Braintree, Worldpay, Spreedly, Yuno, DEUNA, Xsolla, Chargebee, Recurly, Zuora). In those setups the merchant sees the partner's format, which this adapter does not analyze.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "ebanx.payin_response",
      description:
        "Pay-in Direct API JSON response from /ws/direct, /ws/query, /ws/capture, /ws/cancel and /ws/refund: status SUCCESS with the payment object (status OP, PE, CO or CA, transaction_status, refunds, chargeback, claims)",
      status: "supported",
    },
    {
      id: "ebanx.payin_error",
      description: "Pay-in error envelope: status ERROR, status_code and status_message",
      status: "supported",
    },
    {
      id: "ebanx.payment_notification",
      description:
        "Payment notification form post (operation payment_status_change, notification_type update, chargeback, refund or chargeback_credit, hash_codes)",
      status: "limited",
    },
    {
      id: "ebanx.payout_response",
      description:
        "Payout API JSON response (type with a payout object, or an HP-* error with status_code and code)",
      status: "limited",
    },
    {
      id: "ebanx.payout_notification",
      description: "Payout notification form post (operation payout_status_*, hash_codes)",
      status: "limited",
    },
    {
      id: "ebanx.payin_request",
      description:
        "Pay-in request bodies (integration_key, payment with amount_total and currency_code); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "ebanx.enrollment_notification",
      description:
        "Enrollment notification (operation enrollment_status_change, merchant_enrollment_code); recognized, not analyzed",
      status: "unsupported",
    },
    {
      id: "ebanx.other_endpoints",
      description:
        "Token, card verification, enrollment, FX, bank list, balance transfer and chargeback evidence responses, settlement and chargeback report files",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    // The notification carries no status, amount, time or event id.
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has EBANX-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "codes",
      title: "Pay-in API error codes",
      url: `${DOCS}/pay-in/dev-tools/response-codes/api-error-codes`,
    },
    {
      topic: "card-codes",
      title: "Card error codes",
      url: `${DOCS}/pay-in/dev-tools/response-codes/card-error-codes`,
    },
    {
      topic: "apm-codes",
      title: "APM error codes",
      url: `${DOCS}/pay-in/dev-tools/response-codes/apm-error-codes`,
    },
    {
      topic: "iso8583",
      title: "ISO 8583 and Mastercard MAC codes",
      url: `${DOCS}/pay-in/dev-tools/response-codes/iso8583-codes`,
    },
    {
      topic: "api",
      title: "Pay-in OpenAPI",
      url: "https://docs.ebanx.com/api-reference/pay-in/openapi.json",
    },
    {
      topic: "webhooks",
      title: "Payment notifications",
      url: `${DOCS}/pay-in/management/status-and-retrieval/payment-notifications`,
    },
    {
      topic: "query",
      title: "Retrieve a payment (/ws/query)",
      url: `${DOCS}/pay-in/management/status-and-retrieval/retrieve-payment`,
    },
    {
      topic: "refund",
      title: "Refund a payment",
      url: `${DOCS}/pay-in/management/post-payment/refund-payment`,
    },
    {
      topic: "cancel",
      title: "Cancel a payment",
      url: `${DOCS}/pay-in/management/post-payment/cancel-payment`,
    },
    {
      topic: "chargebacks",
      title: "Chargebacks and disputes",
      url: `${DOCS}/pay-in/management/post-payment/chargeback-dispute`,
    },
    {
      topic: "cards",
      title: "Credit cards (authorization and capture)",
      url: `${DOCS}/pay-in/processing/payment-methods/multi-country/cards/credit-cards`,
    },
    {
      topic: "system-failures",
      title: "Sandbox system failure simulation",
      url: `${DOCS}/pay-in/dev-tools/sandbox-simulation/system-failures`,
    },
    {
      topic: "payout-codes",
      title: "Payout error codes",
      url: `${DOCS}/payout/create-payout/errors/payout-error-codes`,
    },
    {
      topic: "payout-notifications",
      title: "Payout notifications",
      url: `${DOCS}/payout/general/notification`,
    },
    {
      topic: "partners",
      title: "Channels and partners",
      url: `${DOCS}/pay-in/processing/partners-and-connections/channels-and-partners`,
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "operation and payment hash for update notifications, or operation and payout uid for payout notifications (EBANX sends no event or delivery id)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "An EBANX notification only says that a payment changed; it carries no status. Reply HTTP 200 at once, then call /ws/query with the hash and act on the returned state. Querying is idempotent, so a repeated delivery is harmless when the handler always reads the current state. Do not drop refund or chargeback notifications as duplicates: a second refund produces an identical body.",
    docsUrl: `${DOCS}/pay-in/management/status-and-retrieval/payment-notifications`,
  },
  limitations: [
    "A payment notification carries only operation, notification_type and hash_codes: no status, amount, timestamp or event id. It is shown as a signal to check the payment (outcome unknown), never as a success or failure. The payment state comes from a matching /ws/query response.",
    "Notifications have no delivery id. A repeated update notification for the same hash is treated as a redelivery, because a payment reaches CO or CA only once. Refund, chargeback and chargeback_credit notifications get no delivery key, because two different refunds or chargebacks produce identical bodies. Retry schedule, ordering and source IPs are not documented.",
    "Several codes have two documented meanings depending on the page or endpoint (BP-R-3 to BP-R-6, BP-DR-9, BP-DR-62, BP-DR-63, BP-DR-132, BP-REF-41, and BP-DR-17, BP-DR-18 and BP-DR-20 in the NuPay examples). Both meanings are shown with possible confidence; status_message is used only as a hint. The token endpoint reuses BP-DR codes with token-specific wording that is not covered.",
    "Card and APM description_code tables share some values with different meanings (for example INVALID_DUE_DATE). The table is chosen from payment_type_code (creditcard and visa for cards; boleto, pix, pix-automatico, oxxopay and spei for APMs) and from card-only fields; when neither applies, both meanings are shown with possible confidence.",
    "EBANX says transaction_status.code must not be used to confirm a payment; payment.status is authoritative. A successful API envelope (status SUCCESS) can describe a cancelled or declined payment.",
    "Without capture_available or pre_approved, a CO response from /ws/capture cannot be told apart from an auto-captured /ws/direct payment, and a partial capture reports only the captured amount. CO is shown as a confirmed payment, not as settlement; transfer_date is shown as the documented settlement date.",
    "Dates are YYYY-MM-DD HH:mm:ss without a zone; they are read as UTC, as the OpenAPI descriptions state. Placeholders such as {{YYYY-MM-DD HH:mm:ss}} and {{unique_payment_hash}} from documentation examples are recognized and not used as values.",
    "Error envelopes carry no payment hash, so a capture, cancel or refund error cannot be linked to its payment. merchant_payment_code is never used for correlation. HTTP 401, 429, 500, 503 and 504 responses without an EBANX body cannot be attributed to EBANX.",
    "Refunds listed in several pasted /ws/query responses appear once per response, because API responses have no delivery key.",
    "ISO 8583 and MAC codes appear only for merchants that enabled them, in seven countries; EBANX warns that issuers interpret ISO codes differently, so an ISO code alone is decoded with possible confidence. A Mastercard MAC code makes the retry guidance stricter, never looser.",
    "Payout statuses CM, AD, AW and RE are documented only on the payout notification page. Canceled-payout reason codes (code, message, gateway_details) are not analyzed because where they appear is not documented. Verify-account, balance transfer and payee responses are not analyzed.",
    "Enrollment notifications, token and card verification responses, enrollment queries, chargeback evidence responses, settlement and chargeback report files are not analyzed. Enrollment reason codes are not decoded.",
    "Notification signatures (X-Signature-Content, X-JWS-Signature) are never verified or copied; a pasted notification is not treated as authentic.",
    "When EBANX processes for Braintree, Worldpay or other partners, the merchant receives the partner's format; those payloads are not EBANX payloads and are not detected here.",
    "Category and retry guidance per code are PandaPayLens suggestions; where EBANX gives advice (retry at any time, do not retry) it is reflected, but a retry is shown as safe only when the payment status already shows that the attempt failed (CA); otherwise /ws/query must confirm the state first.",
  ],
  samples: ["ebanx-auth-capture-refund", "ebanx-insufficient-funds"],
};
