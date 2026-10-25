import type { ProviderManifest } from "@pandapaylens/core";

export const BRAINTREE_ADAPTER_VERSION = "0.1.0";

export const braintreeManifest: ProviderManifest = {
  id: "braintree",
  displayName: "Braintree",
  version: BRAINTREE_ADAPTER_VERSION,
  wave: 1,
  status: "limited",
  apiFamilies: [
    {
      id: "braintree.graphql.response",
      description:
        "GraphQL API response bodies (data, errors[].extensions with errorClass and legacyCode, transactions with statusHistory)",
      status: "supported",
    },
    {
      id: "braintree.transaction",
      description:
        "Transaction snapshots: SDK objects in snake_case or camelCase, SDK result objects with a transaction, and GraphQL Transaction or Refund objects",
      status: "supported",
    },
    {
      id: "braintree.sdk.validation_errors",
      description: "SDK result objects with validation errors (attribute, code, message)",
      status: "limited",
    },
    {
      id: "braintree.webhook.notification",
      description:
        "Webhook notifications already parsed by a Braintree SDK (kind, timestamp, subject)",
      status: "limited",
    },
    {
      id: "braintree.webhook.signed",
      description:
        "Raw form-encoded webhook deliveries (bt_signature, bt_payload); recognized, not decoded",
      status: "unsupported",
    },
  ],
  capabilities: {
    errorDecoding: "supported",
    paymentResponses: "supported",
    webhookParsing: "limited",
    timeline: "limited",
    correlation: "limited",
    diagnosticRules: "limited",
  },
  documentation: [
    {
      topic: "authorization-responses",
      title: "Processor authorization responses",
      url: "https://developer.paypal.com/braintree/docs/reference/general/processor-responses/authorization-responses",
    },
    {
      topic: "settlement-responses",
      title: "Processor settlement responses",
      url: "https://developer.paypal.com/braintree/docs/reference/general/processor-responses/settlement-responses",
    },
    {
      topic: "gateway-rejections",
      title: "Gateway rejections",
      url: "https://developer.paypal.com/braintree/articles/control-panel/transactions/gateway-rejections",
    },
    {
      topic: "statuses",
      title: "Statuses",
      url: "https://developer.paypal.com/braintree/docs/reference/general/statuses",
    },
    {
      topic: "transaction-response",
      title: "Transaction response object",
      url: "https://developer.paypal.com/braintree/docs/reference/response/transaction",
    },
    {
      topic: "validation-errors",
      title: "Validation errors",
      url: "https://developer.paypal.com/braintree/docs/reference/general/validation-errors/all",
    },
    {
      topic: "graphql-errors",
      title: "GraphQL: making API calls",
      url: "https://developer.paypal.com/braintree/graphql/guides/making_api_calls/",
    },
    {
      topic: "graphql-ids",
      title: "GraphQL: migrating (legacy ids and GraphQL ids)",
      url: "https://developer.paypal.com/braintree/graphql/guides/migrating/",
    },
    {
      topic: "webhooks",
      title: "Webhooks: parse",
      url: "https://developer.paypal.com/braintree/docs/guides/webhooks/parse",
    },
    {
      topic: "webhook-kinds",
      title: "Webhook notification kinds",
      url: "https://developer.paypal.com/braintree/docs/reference/general/webhooks/overview",
    },
  ],
  verifiedAt: "2026-10-25",
  delivery: {
    duplicateKey: "no documented notification id",
    duplicatesDocumented: true,
    ordering: "not_guaranteed",
    dedupeAdvice:
      "Braintree retries a notification until your endpoint answers with a 2xx status within 30 seconds, and notifications can arrive out of order. Make the handler idempotent and order state changes by the notification timestamp.",
    docsUrl: "https://developer.paypal.com/braintree/docs/guides/webhooks/parse",
  },
  limitations: [
    "Raw webhook deliveries (bt_signature and bt_payload) are recognized but not decoded or verified: verification needs the merchant's private API key. Parse the notification with a Braintree SDK and paste the parsed notification instead.",
    "Decoded webhook XML is not accepted; PandaPayLens reads JSON and form data only.",
    "Card, PayPal, Venmo and wallet transactions produce no transaction webhooks; only ACH and SEPA Direct Debit settlements do. Timelines come from the supplied snapshots and statusHistory entries, and missing states are not inferred.",
    "A statusHistory without timestamps (as in some GraphQL responses) is shown as one snapshot event that lists the statuses.",
    "Braintree documents no notification id, so repeated deliveries of the same notification are not identified (no delivery key).",
    "Correlation uses explicit ids only: transaction id, refunded transaction id, refund ids and the dispute's transaction id. Legacy ids and GraphQL ids differ; they are linked only when one record carries both (legacyId or graphql_id). GraphQL ids are never decoded.",
    "Order ids, retried transactions, duplicateOf links and disbursement transaction lists are not used for correlation.",
    "The JSON serialization of SDK objects is not documented. snake_case and camelCase field names are accepted; other spellings (for example .NET PascalCase) are not recognized.",
    "Category and retry mappings are PandaPayLens proposals derived from the documented descriptions and Hard/Soft decline types.",
    "Only 12 of the documented Transaction validation codes are mapped individually; other codes are decoded by GraphQL errorClass or as a generic validation error.",
    "GraphQL errorClass values have no published descriptions; their mapping is a PandaPayLens proposal.",
    "Five GraphQL gateway rejection reasons are documented by name only.",
    "Codes 2109 to 2999 share one generic Processor Declined meaning.",
    "ACH return codes are shown but not decoded; network response codes and merchant advice codes are not decoded.",
    "Braintree-specific diagnostic rules are not implemented; only the generic rules run.",
  ],
  samples: [
    "braintree-processor-declined",
    "braintree-sale-refund-dispute",
    "braintree-signed-webhook",
  ],
};
