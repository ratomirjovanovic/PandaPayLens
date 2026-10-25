import type { ProviderManifest } from "@pandapaylens/core";

export const ECOMMPAY_ADAPTER_VERSION = "0.1.0";

const DP = "https://developers.ecommpay.com/en";

export const ecommpayManifest: ProviderManifest = {
  id: "ecommpay",
  displayName: "Ecommpay",
  version: ECOMMPAY_ADAPTER_VERSION,
  wave: "HR-2",
  researchStatus: "tested",
  categories: ["gateway", "acquiring", "card_processing", "orchestration"],
  // Only sectors stated on readable first-party pages. The industry pages of
  // the marketing site could not be read, so this list is incomplete.
  sectors: [
    {
      sector:
        "UK small businesses in eligible low risk industry sectors (a reference list of 30, for example advertising, clothing, groceries, gym memberships, online education, product subscriptions, professional digital services, digital entertainment, telecommunications, takeaways, logistics and wholesalers)",
      source: `${DP}/en_platform_onboarding_for_small_businesses.md`,
    },
    {
      sector: "Microfinance (debt repayment, MCC 6012 or 6051)",
      source: `${DP}/llms-full.txt`,
    },
    {
      sector: "Travel (airline and lodging addenda for Visa and Mastercard)",
      source: `${DP}/llms-full.txt`,
    },
  ],
  regions:
    "Small-business onboarding only for UK companies with fewer than 10 staff and up to EUR 2 million turnover. MoneySend/AFT sender issuers must be in the European region or the EEA (codes 3411, 3480); UK merchant data checks (3001 to 3004); PSD2 SCA declines (10722); Maestro MO/TO country restriction (10108); debt repayment in the UK only with MCC 6012. Licence and regulator details were not found in readable sources.",
  documentationAccess: "public",
  fixtureProvenance:
    "Synthetic fixtures built from Ecommpay's documented callback and Gate response field tables and example shapes. String identifiers contain PPLsynth; fields the documentation types as integers (project_id, operation.id) use obviously synthetic numbers. The research lists no payment.type values, so the payment.type strings in fixtures are placeholders; the adapter never derives semantics from them. They are not official Ecommpay examples.",
  dependencies: [
    "Downstream providers and banks reached through Ecommpay routing and cascading; they appear only in operation.provider.",
    "Alternative payment methods and wallets offered through Ecommpay (for example Open Banking, PIX, Blik, Skrill, Neteller, AstroPay), which reach the merchant in Ecommpay's own format.",
  ],
  status: "limited",
  apiFamilies: [
    {
      id: "ecommpay.callback",
      description:
        "Gate payment callback (project_id, payment, single operation, signature); per-project field configuration, no event type",
      status: "limited",
    },
    {
      id: "ecommpay.payment_status",
      description:
        "Gate payment status response (/v2/payment/status) with payment, operations[] and errors[]",
      status: "supported",
    },
    {
      id: "ecommpay.request_error",
      description: "Gate request-level error body { status: error, code, message }",
      status: "supported",
    },
    {
      id: "ecommpay.request_accepted",
      description:
        "Gate asynchronous acceptance { status: success, request_id, project_id, payment_id }",
      status: "supported",
    },
    {
      id: "ecommpay.chargeback_callback",
      description: "Chargeback summary and detailed callbacks (unsigned, daily, never resent)",
      status: "limited",
    },
    {
      id: "ecommpay.token_callback",
      description: "Token callbacks (tokenize, token_revoke); recognized but not analyzed",
      status: "unsupported",
    },
    {
      id: "ecommpay.payment_page_events",
      description: "Payment Page JavaScript events (different shape)",
      status: "unsupported",
    },
    {
      id: "ecommpay.data_api",
      description: "Data API (specification not reviewed)",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    // Resent callbacks can carry newer data, ordering is not documented and
    // chargeback date fields are not documented by name.
    timeline: "limited",
    correlation: "supported",
    // Only the provider-agnostic rules apply; none has Ecommpay-specific checks.
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "codes",
      title: "Payment information codes and statuses",
      url: `${DP}/en_platform_payment_info_codes.md`,
    },
    { topic: "callbacks", title: "Callbacks", url: `${DP}/en_platform_callbacks.md` },
    {
      topic: "signature",
      title: "Signature generation and verification",
      url: `${DP}/en_platform_signature.md`,
    },
    {
      topic: "gate",
      title: "Gate interaction (HTTP statuses, request status)",
      url: `${DP}/en_gate_interaction_organisation.md`,
    },
    {
      topic: "payment-model",
      title: "Payment model overview",
      url: `${DP}/en_platform_payment_model_overview.md`,
    },
    { topic: "one-step", title: "One-step purchase", url: `${DP}/en_platform_sms_model.md` },
    { topic: "two-step", title: "Two-step purchase", url: `${DP}/en_platform_dms_model.md` },
    {
      topic: "recurring",
      title: "COF (recurring) payments",
      url: `${DP}/en_platform_recurring_model.md`,
    },
    { topic: "payout", title: "Payouts", url: `${DP}/en_platform_payout_model.md` },
    { topic: "refund", title: "Refunds", url: `${DP}/en_Gate_Refund.md` },
    {
      topic: "status",
      title: "Payment status request",
      url: `${DP}/en_Gate_payment_status_request.md`,
    },
    {
      topic: "chargebacks",
      title: "Chargeback callbacks",
      url: `${DP}/en_dbl_chargeback_callbacks.md`,
    },
    { topic: "payment-result", title: "Payment result FAQ", url: `${DP}/en_faq_payment_result.md` },
    { topic: "gate-api", title: "Gate API (OpenAPI 3.38.1)", url: `${DP}/gate_api.md` },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey:
      "none documented (callbacks carry no event id or delivery id; operation.id with operation.status and operation.date is only a heuristic)",
    duplicatesDocumented: true,
    ordering: "not_documented",
    dedupeAdvice:
      "Ecommpay resends a callback until it gets HTTP 200 (up to 120 attempts within about 11 days), and a resend can carry newer data if the status changed. Make the handler idempotent on payment.id, operation.id and operation.status, and read the current state with a status request before acting.",
    docsUrl: `${DP}/en_platform_callbacks.md`,
  },
  limitations: [
    "Callbacks have no event type field. The event is inferred from operation.type and operation.status (with payment.status shown as an attribute) and is marked with eventTypeInferred.",
    "Callback fields are configurable per project: optional fields can be added, removed or renamed. Only project_id, payment.id, payment.type, payment.status, operation.type and operation.status are required for analysis; renamed fields are not recognized.",
    "Callbacks carry no delivery id. Ecommpay documents resends, and a resend may carry newer data, so no delivery key is set and repeated deliveries are not reported as duplicates; they are grouped with the payment by payment.id and operation.id.",
    "Delivery order is not documented. The timeline uses operation.date (format YYYY-MM-DDThh:mm:ss+0000).",
    "Chargeback callbacks are unsigned, are sent once a day and are never resent. Only the documented fields are read (event, event_date, chargeback_count, chargebacks[].chargeback_id, case_id, operation_id, card_type, chargeback_status, reason_code). Chargeback amount and date field names are not documented, so they are not read; reason codes are shown without interpretation and the full chargeback_status list is not documented.",
    "Summary chargeback callbacks carry only counts and cannot be linked to a payment. Detailed chargebacks are linked to the disputed operation only through chargebacks[].operation_id.",
    "Signatures (signature, general.signature) are sensitive and are never verified, copied or reported. A pasted callback is never treated as authentic.",
    "Events are linked by payment.id (merchant assigned, unique per project, compared case-insensitively) and operation.id. payment.id is unique only within a project; records from different projects that reuse a payment id would be grouped together. Recurring payments are not linked to their COF registration.",
    "Codes come from operation.code (string), errors[].code (integer in the OpenAPI schema, a string in examples) or the top-level code of a request error; all three are decoded. Ecommpay does not say the code list is exhaustive, so unknown codes are reported with insufficient confidence.",
    "Codes 602, 10602 and 20602 (network error and timeouts) are shown as retry_conditionally, not as the technical retry the research suggests, because the outcome at the external service is unknown.",
    "Code 3201 means payment routing error in the code table, but a status request example pairs it with a field validation message; it is decoded with possible confidence.",
    "Provider result codes in operation.provider.result_code are provider specific and are shown without interpretation.",
    "payment.type values are not documented as a list, so the stage comes from operation.type only. account_verification (payment.type) and account verification (operation.type) are spelled differently in the documentation.",
    "Status responses that use a single operation object instead of operations[] are recognized when they also carry last_failed_request or arrive as an HTTP response; last_failed_request is not analyzed because its fields are not documented.",
    "Token callbacks, Payment Page JavaScript events and the Data API are not analyzed.",
    "The documented sectors are only those on readable developer portal pages; the marketing site's industry pages could not be read. Gambling appears only in payout limit code texts (MCC 7995/9406), which is not a statement that gambling merchants are accepted. Eligibility depends on jurisdiction, licensing and underwriting.",
    "Category and retry guidance per code are PandaPayLens suggestions that follow Ecommpay's Action column where it gives one.",
  ],
  samples: ["ecommpay-two-step", "ecommpay-payout-declined"],
};
