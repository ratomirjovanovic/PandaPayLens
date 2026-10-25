# Braintree: provider research for the `braintree` adapter

> Scope: PandaPayLens parses pasted Braintree payloads only. It never calls Braintree.
> Everything below comes from Braintree's official developer documentation (developer.paypal.com/braintree),
> plus two first-party code sources that the docs link to or that Braintree publishes: the GraphQL schema repo
> (`github.com/braintree/graphql-api`, linked from the GraphQL guides as "GitHub Schema Repo") and the official
> Node.js server SDK (`github.com/braintree/braintree_node`). Facts taken only from code, and not from a docs page,
> are labelled **(SDK source)** or **(schema)**. Where the docs say nothing, this file says **NOT DOCUMENTED**.
> Category and retry-class mappings are **PandaPayLens proposals** based on the documented descriptions and the
> documented hard/soft decline type. Braintree does not publish such a classification.

---

## 1. Sources

Verification date: **2026-10-25**. All pages were read on that date with WebFetch and/or a raw HTML download
(`curl` + tag stripping). Every JSON/XML example below was copied from raw page HTML or raw source files, not retyped.

| #   | URL                                                                                                                                                   | Used for                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | https://developer.paypal.com/braintree/docs/reference/general/processor-responses/authorization-responses                                             | 1000/2000/3000-class codes, exact texts, Hard/Soft type, retry guidance, Mastercard no-retry list                                                                                    |
| S2  | https://developer.paypal.com/braintree/docs/reference/general/processor-responses/settlement-responses                                                | 4000-class settlement codes (16 codes)                                                                                                                                               |
| S3  | https://developer.paypal.com/braintree/articles/control-panel/transactions/gateway-rejections                                                         | Gateway rejection reasons (9 headings), automatic void note                                                                                                                          |
| S4  | https://developer.paypal.com/braintree/docs/reference/general/statuses                                                                                | Transaction / verification / dispute / escrow / subscription statuses and flows                                                                                                      |
| S5  | https://developer.paypal.com/braintree/docs/reference/response/transaction                                                                            | SDK Transaction response object fields, result object examples, `status_history` fields, `gateway_rejection_reason` values                                                           |
| S6  | https://developer.paypal.com/braintree/docs/reference/general/result-objects                                                                          | SDK result object (`success?`, `errors`, `message`, `params`)                                                                                                                        |
| S7  | https://developer.paypal.com/braintree/docs/reference/general/validation-errors/overview                                                              | Validation error structure (`attribute`, `code`, `message`, nesting)                                                                                                                 |
| S8  | https://developer.paypal.com/braintree/docs/reference/general/validation-errors/all                                                                   | Full validation error code list (Transaction section: 99 codes)                                                                                                                      |
| S9  | https://developer.paypal.com/braintree/graphql/guides/making_api_calls/                                                                               | GraphQL envelope (`data`/`errors`/`extensions.requestId`), `errors[].extensions` fields, `errorClass` values, timeouts, verbatim error example                                       |
| S10 | https://developer.paypal.com/braintree/graphql/guides/transactions/                                                                                   | GraphQL transaction examples incl. `statusHistory`, refund error example                                                                                                             |
| S11 | https://developer.paypal.com/braintree/graphql/guides/testing/                                                                                        | Test amounts, `PROCESSOR_DECLINED` example                                                                                                                                           |
| S12 | https://developer.paypal.com/braintree/graphql/guides/migrating/                                                                                      | Legacy IDs vs GraphQL IDs, `legacyId`, `graphql_id`, `idFromLegacyId`                                                                                                                |
| S13 | https://developer.paypal.com/braintree/in-person/guides/graphql-error-handling/                                                                       | GraphQL HTTP 200 behaviour, `legacyCode`, `requestId` (in-person guide)                                                                                                              |
| S14 | https://github.com/braintree/graphql-api (raw `schema.graphql`, master)                                                                               | Exact GraphQL type/field/enum names: `PaymentStatus`, `PaymentStatusEvent` and implementations, `GatewayRejectionReason`, `ProcessorDeclineType`, `Transaction`, `Refund`, `Dispute` |
| S15 | https://developer.paypal.com/braintree/docs/guides/webhooks/overview                                                                                  | What webhooks exist for, HTTPS POST, "full Braintree object"                                                                                                                         |
| S16 | https://developer.paypal.com/braintree/docs/guides/webhooks/parse                                                                                     | `application/x-www-form-urlencoded`, `bt_signature` + `bt_payload`, parse call, retries, ordering                                                                                    |
| S17 | https://developer.paypal.com/braintree/docs/guides/webhooks/testing-go-live                                                                           | `sample_notification`, dummy-object caveat                                                                                                                                           |
| S18 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/overview                                                                       | Notification categories, kind/timestamp/one subject attribute                                                                                                                        |
| S19 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/transaction                                                                    | `transaction_settled`, `transaction_settlement_declined` (ACH / SEPA Direct Debit only)                                                                                              |
| S20 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/dispute                                                                        | 8 `dispute_*` kinds                                                                                                                                                                  |
| S21 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/disbursement                                                                   | `disbursement`, `transaction_disbursed` (deprecated)                                                                                                                                 |
| S22 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/fraud-protection                                                               | `transaction_reviewed`                                                                                                                                                               |
| S23 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/subscription                                                                   | 8 `subscription_*` kinds                                                                                                                                                             |
| S24 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/local-payment-methods                                                          | 4 `local_payment_*` kinds                                                                                                                                                            |
| S25 | https://developer.paypal.com/braintree/docs/reference/general/webhooks/payment-method                                                                 | `payment_method_revoked_by_customer`, `payment_method_customer_data_updated`                                                                                                         |
| S26 | https://developer.paypal.com/braintree/docs/reference/response/dispute                                                                                | SDK Dispute response object (`id`, `kind`, `reason`, `status`, `transaction`, ...)                                                                                                   |
| S27 | https://github.com/braintree/braintree_node: `lib/braintree/webhook_notification_gateway.js`, `webhook_notification.js`, `webhook_testing_gateway.js` | **(SDK source)** `bt_payload` is base64 XML; `<notification><timestamp/><kind/><subject/>` root; signature format; full Kind enum                                                    |

URLs that returned 404 on 2026-10-25 (not used): `.../docs/reference/general/gateway-rejection-reasons`, `.../graphql/guides/making-api-calls/` (hyphenated), `.../docs/reference/response/webhook-notification`, `.../docs/reference/general/webhooks/transaction-issues`.

---

## 2. API families in scope

| Family                                                                                                                                                            | Transport                                                                            | Field naming                                                                                                                                                | What a developer would paste                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GraphQL API** (`https://payments.braintree-api.com/graphql`, sandbox `payments.sandbox.braintree-api.com/graphql`, header `Braintree-Version: 2019-01-01`) (S9) | JSON over HTTPS; **always HTTP 200**, even on errors (S9, S13)                       | camelCase fields, UPPER_SNAKE enums (`PROCESSOR_DECLINED`, `GATEWAY_REJECTED`) (S14)                                                                        | Full response body `{data, errors?, extensions:{requestId}}`                                                                                                                                               |
| **Server SDKs** (Java, .NET, Node.js, PHP, Python, Ruby) over the legacy XML gateway API (S5, S6)                                                                 | SDK result objects; wire format is XML (SDK source S27)                              | Docs use Ruby snake_case (`processor_response_code`). Node SDK exposes camelCase (`processorResponseCode`) (SDK source S27, via `Util.convertNodeToObject`) | Logged/serialized result or Transaction objects (`JSON.stringify(result)`, `to_json`, `print(vars(tx))`). **The JSON serialization of SDK objects is NOT DOCUMENTED.** It depends on language and logging. |
| **Webhooks** (S15, S16)                                                                                                                                           | HTTPS POST, `application/x-www-form-urlencoded`, fields `bt_signature`, `bt_payload` | Raw: base64 of XML with kebab-case elements (SDK source S27). Parsed: SDK `WebhookNotification` object                                                      | (i) the raw form body, (ii) the base64 payload, (iii) decoded XML, (iv) the parsed SDK notification object serialized to JSON                                                                              |

**Input shapes to support first (priority order):**

1. **GraphQL response bodies** (`errors[].extensions.legacyCode/errorClass`, and `data.*.transaction` with `status` + `statusHistory[]`). This shape is the best documented (S9, S10, S14) and fully deterministic.
2. **SDK transaction snapshots / result objects as JSON** in snake_case (Ruby/Python/PHP style) **and** camelCase (Node/Java style): `status`, `processor_response_code`/`processorResponseCode`, `processor_response_text`, `processor_response_type`, `gateway_rejection_reason`, `processor_settlement_response_code`, `status_history[]`. Field names are documented (S5). The JSON envelope is not.
3. **Decoded webhook notifications**: SDK object `{kind, timestamp, transaction|dispute|disbursement|subscription|...}` and the decoded XML `<notification>` (S16, S27). Optionally, decode a pasted `bt_payload` base64 **locally without signature verification** (no webhook secret / private key available). The result must be labelled "unverified".
4. SDK validation errors (`errors` with `attribute`/`code`/`message`) (S6, S7). Limited, because the JSON shape is SDK-specific.

---

## 3. Response / error formats

### 3.1 GraphQL envelope (S9, S13)

- Top level is always a JSON object that may hold `data`, `errors`, `extensions`. HTTP status is always 200 (S9, S13).
- Partial success is allowed: `data` may be partly filled while `errors` is present. A field that failed to resolve is `null` (S9).
- `extensions.requestId` is present on every response (S9). It is the support/debug identifier.
- `errors[]` element fields (S9):
  - `message`: human-readable. Braintree says it **must not be parsed** and may change.
  - `locations`: `[{line, column}]` in the GraphQL document.
  - `path`: the query/mutation field that caused the error, e.g. `["chargePaymentMethod"]`.
  - `extensions.errorType`: **deprecated**, use `errorClass` (values seen in examples: `"user_error"`).
  - `extensions.errorClass`: one of `AUTHENTICATION`, `AUTHORIZATION`, `INTERNAL`, `UNSUPPORTED_CLIENT`, `NOT_FOUND`, `NOT_IMPLEMENTED`, `RESOURCE_LIMIT`, `SERVICE_AVAILABILITY`, `VALIDATION` (S9). **Per-value descriptions and HTTP mappings: NOT DOCUMENTED.**
  - `extensions.legacyCode`: a string code that matches the SDK validation error codes (S8), e.g. `"91565"`, `"81531"`, `"91512"`.
  - `extensions.inputPath`: path into the input variables, e.g. `["input","transaction","amount"]`.
- Error sources (S9): GraphQL validation (type mismatch), Braintree validation (e.g. invalid card number), or upstream issues.
- **Processor declines and gateway rejections are NOT errors in GraphQL.** A declined charge comes back in `data` as a `Transaction` with `status: "PROCESSOR_DECLINED"` (S11 example) or `GATEWAY_REJECTED`. The reason is in `statusHistory[]` (`ProcessorDeclinedEvent.processorResponse.legacyCode`, `GatewayRejectedEvent.gatewayRejectionReason`) (S14).
- Timeouts (S9): Braintree recommends a 60 s client timeout. A client timeout does not mean the charge failed. The transaction may still complete, and you must search for it. This is relevant to timeline/diagnostics.

**Example 1: GraphQL validation error (verbatim from S9 raw HTML)**

```json
{
  "data": {
    "chargePaymentMethod": null
  },
  "errors": [
    {
      "message": "Unknown or expired single-use payment method.",
      "locations": [
        {
          "line": 2,
          "column": 7
        }
      ],
      "path": ["chargePaymentMethod"],
      "extensions": {
        "errorType": "user_error",
        "errorClass": "VALIDATION",
        "legacyCode": "91565",
        "inputPath": ["input", "paymentMethodId"]
      }
    }
  ],
  "extensions": {
    "requestId": "a-uuid-for-the-request"
  }
}
```

**Example 2: GraphQL reverse with statusHistory (verbatim from S10 raw HTML).** Note that the docs example shows `terminal` as a string `"true"`, but the schema type is `Boolean` (S14). The parser must accept both.

```json
{
  "data": {
    "reverseTransaction": {
      "reversal": {
        "id": "TRANSACTION_ID",
        "status": "VOIDED",
        "statusHistory": [
          {
            "status": "VOIDED",
            "terminal": "true"
          },
          {
            "status": "SUBMITTED_FOR_SETTLEMENT",
            "terminal": "false"
          },
          {
            "status": "AUTHORIZED",
            "terminal": "false"
          }
        ]
      }
    }
  }
}
```

Other documented GraphQL error example (S10): refund of a fully refunded transaction gives `"data": null`, `errorClass: "VALIDATION"`, `legacyCode: "91512"`, `inputPath: ["input","transactionId"]`, message "Transaction has already been completely refunded." (That example has no top-level `extensions`.)

**Doc inconsistency (S10):** the Transactions guide also shows a `voidTransaction` example with a payload-level `errors: [{field, message, code}]` (codes `INVALID_INPUT_FOR_VOID_TRANSACTION_MUTATION`, `TRANSACTION_NOT_FOUND`, `TRANSACTION_CANNOT_BE_VOIDED`) and a top-level `{"errors":[{"message":"Unauthorized access","extensions":{"code":"UNAUTHORIZED"}}]}`. The published schema's `VoidTransactionPayload` has only `clientMutationId` and `transaction` (S14), with no `errors` field. Treat these shapes as **unverified**. Parse them leniently (accept `extensions.code`), but do not rely on them.

### 3.2 GraphQL transaction fields (exact names, S14)

`Transaction`: `id` (GraphQL ID), `legacyId`, `createdAt`, `status: PaymentStatus`, `amount {value, currencyCode/currencyIsoCode}`, `orderId`, `merchantAccountId`, `merchantId`, `processorResponse` (**deprecated since 2018-12-06**), `processorAuthorizationResponse: TransactionAuthorizationProcessorResponse`, `processorSettlementResponse: TransactionSettlementProcessorResponse`, `statusHistory: [PaymentStatusEvent!]` (**reverse chronological**), `refunds: [Refund!]`, `disputes: [Dispute!]`, `riskData`, `paymentMethodSnapshot`, `customer`, `billingAddress`, `shipping`, `source: PaymentSource`, `channel`, `retried`, `retriedParentTransaction`, `retriedTransactions`, `upcomingRetryDate`, `partialCaptureDetails`, `partiallyAuthorized`, `disbursementDetails`, `authorizationAdjustments`.

`TransactionAuthorizationProcessorResponse`: `legacyCode` (the 1000/2000/3000 code), `message`, `cvvResponse`, `avsPostalCodeResponse`, `avsStreetAddressResponse`, `authorizationId`, `additionalInformation`, `retrievalReferenceNumber`, `emvData`, `mastercardTransactionLinkId`.

`TransactionSettlementProcessorResponse`: `legacyCode` (4000-class), `message`, `achReturnCode`, `achRejectReason` (plus deprecated AVS/CVV fields).

`PaymentStatusEvent` (interface): `status`, `timestamp`, `amount`, `source`, `terminal`. Implementations: `AuthorizationExpiredEvent`, `AuthorizedEvent` (+`processorResponse`, `networkResponse`, `riskDecision`, `authorizationExpiresAt`, `userName`), `FailedEvent` (+`processorResponse`, `networkResponse`, `merchantAdviceCodeResponse`, `riskDecision`), `GatewayRejectedEvent` (+`gatewayRejectionReason`, `processorResponse`, `networkResponse`, `merchantAdviceCodeResponse`, `riskDecision`, `duplicateOf: Transaction`), `ProcessorDeclinedEvent` (+`declineType: ProcessorDeclineType` = `HARD`|`SOFT`, `processorResponse`, `networkResponse`, `merchantAdviceCodeResponse`, `riskDecision`), `SettledEvent`, `SettlementConfirmedEvent`, `SettlementDeclinedEvent` (+`processorResponse: TransactionSettlementProcessorResponse`), `SettlementPendingEvent`, `SettlingEvent`, `SubmittedForSettlementEvent`, `VoidedEvent`. A pasted response only contains `__typename` if the query asked for it, so the event type must be inferred from `status` plus the fields present.

`PaymentNetworkResponse {code, message}`; `MerchantAdviceCodeResponse {code, message}`; `PaymentSource` enum: `API`, `CONTROL_PANEL`, `PAYMENT_READER`, `RECURRING`, `UNKNOWN`.

### 3.3 SDK result object (S5, S6, S7)

- `success?` (Ruby) / `success` (other SDKs): `true` gives `result.transaction` with status `authorized`, `submitted_for_settlement` or `settling` (S5).
- `success == false` happens for (S5, S6): (a) **validation errors**, where `result.errors` is populated (each error has `attribute`, `code`, `message`, nested by request params: `errors.for(:transaction)`, `on(:amount)`, base errors use attribute `"base"`) and **no transaction object is present**; (b) **processor declined**, where `result.transaction.status == "processor_declined"` with `processor_response_type`, `processor_response_code`, `processor_response_text`, `additional_processor_response`; (c) **settlement declined**, where `processor_settlement_response_code`/`_text`; (d) **gateway rejected**, where `result.transaction.gateway_rejection_reason`.
- `result.message`: all error messages joined by `\n`, e.g. `"Amount is required.\nCredit card number is invalid."` (S6).
- `result.params`: the submitted params. **Card number and CVV are excluded** for PCI reasons (S6).

Verbatim Ruby example from S5 (processor declined):

```ruby
result.success?
#=> false
result.transaction.status
#=> "processor_declined"
result.transaction.processor_response_type
#=> "soft_declined"
result.transaction.processor_response_code
#=> "2001"
result.transaction.processor_response_text
#=> "Insufficient Funds"
```

and `result.transaction.additional_processor_response # e.g. "05 : NOT AUTHORISED"` (S5).

### 3.4 SDK Transaction snapshot fields (exact Ruby/XML names, S5)

`id`, `graphql_id`, `type` (`sale`/`credit`), `status`, `status_history[]` (`amount`, `status`, `timestamp`, `transaction_source` = `Api`/`ControlPanel`/`Recurring`, `user`), `amount`, `currency_iso_code`, `created_at`, `updated_at`, `order_id`, `merchant_account_id`, `processor_response_code`, `processor_response_text`, `processor_response_type` (`"approved"`, `"soft_declined"`, `"hard_declined"`), `additional_processor_response`, `processor_authorization_code`, `processor_settlement_response_code`, `processor_settlement_response_text`, `gateway_rejection_reason`, `network_response_code`, `network_response_text`, `merchant_advice_code`, `merchant_advice_code_text`, `network_transaction_id`, `retrieval_reference_number`, `acquirer_reference_number`, `avs_error_response_code`, `avs_postal_code_response_code`, `avs_street_address_response_code`, `cvv_response_code` (`M`,`N`,`U`,`I`,`S`,`A`,`B`), `refund_ids`, `refund_id` (deprecated), `refunded_transaction_id`, `retried_transaction_id`, `retry_ids`, `disputes[]`, `risk_data` (`id`, `decision` = `"Not Evaluated"|"Approve"|"Review"|"Decline"`, `device_data_captured`, `fraud_service_provider`, `decision_reasons`, `risk_score`), `payment_instrument_type`, `credit_card_details`, `customer_details`, `billing_details`, `shipping_details`, `paypal_details`, `us_bank_account_details`, `three_d_secure_info`, `disbursement_details`, `escrow_status`, `subscription_id`, `plan_id`, `recurring`, `ach_return_code`, `ach_reject_reason`.

Note: in the `status_history` details table, S5 spells the per-event fields `proccessor_response_code` / `proccessor_response_text` (double "c"). This is probably a doc typo. Accept both spellings.

### 3.5 Webhook format (S16, S17, S27)

- POST, `application/x-www-form-urlencoded`, two fields `bt_signature` and `bt_payload` (S16).
- Docs: "payload matches the format of standard API responses" and includes a snapshot of the entity at fire time (S16). **The encoding of `bt_payload` is NOT DOCUMENTED on the docs pages.**
- **(SDK source S27)** `bt_payload` is base64 (the sample has a trailing `\n`) of an XML document. `bt_signature` is `publicKey|hexHMAC-SHA1` (one or more pairs separated by `&`). Verification needs the API private key, which PandaPayLens never has.
- SDK sample XML skeleton (verbatim from `webhook_testing_gateway.js`, S27):

```xml
<notification>
    <timestamp type="datetime">...</timestamp>
    <kind>${kind}</kind>
    ${sourceMerchantIdXml}
    <subject>${this.subjectXmlFor(kind, id)}</subject>
</notification>
```

Sample `transaction_settled` subject (S27): `<transaction><id>…</id><status>settled</status><type>sale</type><currency-iso-code>USD</currency-iso-code><amount>100</amount><merchant-account-id>…</merchant-account-id><payment-instrument-type>us_bank_account</payment-instrument-type><us-bank-account>…</us-bank-account></transaction>`. Sample dispute subject: `<dispute>` with `amount-disputed`, `kind` (`chargeback`), `status` (`open`), `reason` (`fraud`), `id`, `<transaction><id/><amount/></transaction>`, `date-opened`, `reply-by-date`.
The SDK unwraps `subject.api-error-response` if present (S27). Error responses can therefore be embedded in a notification.

- Parsed object (S16, S18): `kind`, `timestamp` (UTC), plus **one** type-specific attribute (`transaction`, `dispute`, `disbursement`, `subscription`, `merchant_account`, ...). Fraud Protection notifications carry `transaction_review` fields `transaction_id`, `decision`, `reviewer_email`, `reviewer_note`, `reviewed_time` (S22). Disbursement adds `retry` and `success?` (S21).
- Delivery (S16): retried **hourly** until a 2xx within 30 s, for up to 3 h (sandbox) / 24 h (production). **Notifications may arrive out of order.** Use `timestamp` (S16).
- `sample_notification` output contains a **dummy object**, not a complete gateway record (S17). Pasted test webhooks will be sparse.

---

## 4. Codes

### 4.1 Processor authorization responses (S1)

Ranges (S1): **1000-class** approved (`success` true; gateway rules may still reject it); **2000-class** declined by the processor (`success` false); **3000-class** back-end processing network problem.
Hard decline = not temporary, so retries on the same payment method will likely fail. Soft decline = temporary, so a retry may succeed (S1; same wording in schema `ProcessorDeclineType`, S14).
Retry rules documented in S1:

- **Mastercard prohibits retries** on hard declines **2009, 2012, 2019, 2022, 2047, 2053**.
- For transactions sent with a **recurring ECI flag**: soft declines may be retried at most **15 times in 30 days**. **2004**: do not retry. **2005**: do not retry with the same payment information. **2015**: do not retry.
- Recommended UX: show the customer a generic message and log the code.

**Approvals** (no decline type on the page):

| Code | Text (exact)                           | Paraphrase                                                                          | Category / retry                            |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| 1000 | Approved.                              | Approved                                                                            | n/a (success)                               |
| 1001 | Approved. Check customer ID.           | Approved; verify customer ID                                                        | n/a                                         |
| 1002 | Processed.                             | Not authorized but sent straight to settlement (some refunds, credits, voice auths) | n/a                                         |
| 1003 | Approved with Risk.                    | Bank account usable but some data mismatch/risk noted                               | n/a (consider `manual_review` hint)         |
| 1004 | Approved for Partial Amount.           | Approved for less than requested                                                    | n/a (`invalid_amount` hint for diagnostics) |
| 1005 | Auth Declined but Settlement Captured. | Refund authorization declined but submitted for settlement                          | n/a                                         |

(Approval texts are as printed in the raw page table, with trailing periods. The `processor_response_text` returned by the API may omit the period, e.g. the 2001 example in S5 is "Insufficient Funds". Match texts case-insensitively, ignoring trailing punctuation, and always prefer the code.)

**Declines and network errors (all 2000-2108, the 2109-2999 range, and 3000).** Documented decline type from S1. Category and retry class are PandaPayLens proposals.

| Code      | processor_response_text (exact, from page)                                                  | Paraphrase                                                           | Documented decline type | Category (proposed)        | Retry class (proposed)   |
| --------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- | -------------------------- | ------------------------ |
| 2000      | Do Not Honor                                                                                | Issuer unwilling to accept; customer should contact their bank       | Soft                    | card_declined              | retry_conditionally      |
| 2001      | Insufficient Funds                                                                          | Insufficient funds at time of authorization                          | Soft                    | insufficient_funds         | retry_conditionally      |
| 2002      | Limit Exceeded                                                                              | Withdrawal/credit limit exceeded                                     | Soft                    | insufficient_funds         | retry_conditionally      |
| 2003      | Cardholder's Activity Limit Exceeded                                                        | Cardholder activity limit exceeded                                   | Soft                    | card_declined              | retry_conditionally      |
| 2004      | Expired Card                                                                                | Card expired                                                         | Hard                    | card_declined              | customer_action_required |
| 2005      | Invalid Credit Card Number                                                                  | Card number invalid                                                  | Hard                    | invalid_request            | customer_action_required |
| 2006      | Invalid Expiration Date                                                                     | Expiration date invalid                                              | Hard                    | invalid_request            | customer_action_required |
| 2007      | No Account                                                                                  | Account not on file with issuer                                      | Hard                    | card_declined              | customer_action_required |
| 2008      | Card Account Length Error                                                                   | Card number has wrong length                                         | Hard                    | invalid_request            | customer_action_required |
| 2009      | No Such Issuer                                                                              | Issuer not found / issuer connectivity error (Mastercard: no retry)  | Hard                    | card_declined              | do_not_retry             |
| 2010      | Card Issuer Declined CVV                                                                    | Issuer declined the CVV                                              | Hard                    | card_declined              | customer_action_required |
| 2011      | Voice Authorization Required                                                                | Issuer requires voice authorization                                  | Hard                    | card_declined              | manual_review            |
| 2012      | Processor Declined - Possible Lost Card                                                     | Possible lost card (Mastercard: no retry)                            | Hard                    | fraud_or_risk              | do_not_retry             |
| 2013      | Processor Declined - Possible Stolen Card                                                   | Possible stolen card                                                 | Hard                    | fraud_or_risk              | do_not_retry             |
| 2014      | Processor Declined - Fraud Suspected                                                        | Issuer suspects fraud                                                | Hard                    | fraud_or_risk              | do_not_retry             |
| 2015      | Transaction Not Allowed                                                                     | Transaction not allowed, reason unspecified                          | Hard                    | card_declined              | do_not_retry             |
| 2016      | Duplicate Transaction                                                                       | Looks like a duplicate of a recent transaction                       | Soft                    | duplicate_request          | retry_conditionally      |
| 2017      | Cardholder Stopped Billing                                                                  | Cardholder stopped this billing                                      | Hard                    | card_declined              | do_not_retry             |
| 2018      | Cardholder Stopped All Billing                                                              | Cardholder stopped all recurring billing                             | Hard                    | card_declined              | do_not_retry             |
| 2019      | Invalid Transaction                                                                         | Card does not support this transaction type (Mastercard: no retry)   | Hard                    | card_declined              | do_not_retry             |
| 2020      | Violation                                                                                   | Violation; cardholder must contact bank                              | Hard                    | card_declined              | customer_action_required |
| 2021      | Security Violation                                                                          | Security violation                                                   | Hard                    | fraud_or_risk              | do_not_retry             |
| 2022      | Declined - Updated Cardholder Available                                                     | Updated card issued; old card no longer valid (Mastercard: no retry) | Hard                    | card_declined              | customer_action_required |
| 2023      | Processor Does Not Support This Feature                                                     | Processor lacks the requested feature (e.g. 3DS, Level 2/3)          | Hard                    | configuration              | manual_review            |
| 2024      | Card Type Not Enabled                                                                       | Card brand not enabled on merchant account                           | Hard                    | configuration              | manual_review            |
| 2025      | Set Up Error - Merchant                                                                     | Merchant setup/connectivity error at processor                       | Soft                    | configuration              | manual_review            |
| 2026      | Invalid Merchant ID                                                                         | Invalid merchant ID at processor                                     | Soft                    | configuration              | manual_review            |
| 2027      | Set Up Error - Amount                                                                       | Amount-related setup error                                           | Hard                    | configuration              | manual_review            |
| 2028      | Set Up Error - Hierarchy                                                                    | Account hierarchy setup error                                        | Hard                    | configuration              | manual_review            |
| 2029      | Set Up Error - Card                                                                         | Card setup error                                                     | Hard                    | configuration              | manual_review            |
| 2030      | Set Up Error - Terminal                                                                     | Terminal setup error                                                 | Hard                    | configuration              | manual_review            |
| 2031      | Encryption Error                                                                            | Encryption error / issuer does not support $0 verification           | Hard                    | configuration              | manual_review            |
| 2032      | Surcharge Not Permitted                                                                     | Surcharge not permitted on this card                                 | Hard                    | configuration              | do_not_retry             |
| 2033      | Inconsistent Data                                                                           | Data inconsistent with processor records                             | Hard                    | invalid_request            | manual_review            |
| 2034      | No Action Taken                                                                             | Error; intended transaction not completed                            | Soft                    | unknown                    | retry_conditionally      |
| 2035      | Partial Approval For Amount In Group III Version                                            | Partial approval (Group III)                                         | Soft                    | invalid_amount             | manual_review            |
| 2036      | Authorization could not be found                                                            | Authorization to act on not found                                    | Hard                    | invalid_request            | do_not_retry             |
| 2037      | Already Reversed                                                                            | Authorization already reversed                                       | Hard                    | invalid_request            | do_not_retry             |
| 2038      | Processor Declined                                                                          | Processor declined; reasons vary (customer should contact bank)      | Soft                    | card_declined              | retry_conditionally      |
| 2039      | Invalid Authorization Code                                                                  | Authorization code invalid or missing                                | Hard                    | invalid_request            | do_not_retry             |
| 2040      | Invalid Store                                                                               | Invalid store / account configuration issue                          | Soft                    | configuration              | manual_review            |
| 2041      | Declined - Call For Approval                                                                | Issuer requires cardholder to call for approval                      | Hard                    | card_declined              | customer_action_required |
| 2042      | Invalid Client ID                                                                           | Invalid client ID (configuration)                                    | Soft                    | configuration              | manual_review            |
| 2043      | Error - Do Not Retry, Call Issuer                                                           | Issuer forbids retry; call issuer                                    | Hard                    | card_declined              | do_not_retry             |
| 2044      | Declined - Call Issuer                                                                      | Issuer declined; call issuer                                         | Hard                    | card_declined              | customer_action_required |
| 2045      | Invalid Merchant Number                                                                     | Invalid merchant number                                              | Hard                    | configuration              | manual_review            |
| 2046      | Declined                                                                                    | Generic decline (card or PayPal)                                     | Soft                    | card_declined              | retry_conditionally      |
| 2047      | Call Issuer. Pick Up Card                                                                   | Card reported lost/stolen; pick up card (Mastercard: no retry)       | Hard                    | fraud_or_risk              | do_not_retry             |
| 2048      | Invalid Amount                                                                              | Amount invalid (zero, unreadable, or too large)                      | Soft                    | invalid_amount             | retry_conditionally      |
| 2049      | Invalid SKU Number                                                                          | Non-numeric SKU                                                      | Hard                    | invalid_request            | do_not_retry             |
| 2050      | Invalid Credit Plan                                                                         | Invalid credit plan                                                  | Hard                    | invalid_request            | do_not_retry             |
| 2051      | Credit Card Number does not match method of payment                                         | Card number does not match payment method                            | Hard                    | invalid_request            | customer_action_required |
| 2052      | Invalid level III Purchase                                                                  | Level III data inaccurate or missing                                 | Hard                    | invalid_request            | do_not_retry             |
| 2053      | Card reported as lost or stolen                                                             | Card reported lost or stolen (Mastercard: no retry)                  | Hard                    | fraud_or_risk              | do_not_retry             |
| 2054      | Reversal amount does not match authorization amount                                         | Refund/reversal exceeds original or partial not allowed              | Hard                    | invalid_amount             | do_not_retry             |
| 2055      | Invalid Transaction Division Number                                                         | Invalid transaction division number                                  | Hard                    | configuration              | manual_review            |
| 2056      | Transaction amount exceeds the transaction division limit                                   | Amount exceeds transaction division limit                            | Hard                    | invalid_amount             | manual_review            |
| 2057      | Issuer or Cardholder has put a restriction on the card                                      | Issuer or cardholder restricted the card                             | Soft                    | card_declined              | retry_conditionally      |
| 2058      | Merchant not Mastercard SecureCode enabled                                                  | Merchant not enabled for Mastercard SecureCode                       | Hard                    | configuration              | manual_review            |
| 2059      | Address Verification Failed                                                                 | PayPal: address verification failed / seller protection              | Hard                    | fraud_or_risk              | customer_action_required |
| 2060      | Address Verification and Card Security Code Failed                                          | PayPal: AVS and CVV both failed                                      | Hard                    | fraud_or_risk              | customer_action_required |
| 2061      | Invalid Transaction Data                                                                    | Invalid transaction data                                             | Hard                    | invalid_request            | do_not_retry             |
| 2062      | Invalid Tax Amount                                                                          | Invalid tax amount                                                   | Soft                    | invalid_amount             | retry_conditionally      |
| 2063      | PayPal Business Account preference resulted in the transaction failing                      | PayPal business account preference blocked payment                   | Hard                    | configuration              | manual_review            |
| 2064      | Invalid Currency Code                                                                       | Currency code invalid for account                                    | Hard                    | configuration              | do_not_retry             |
| 2065      | Refund Time Limit Exceeded                                                                  | PayPal refund past time limit                                        | Hard                    | invalid_request            | do_not_retry             |
| 2066      | PayPal Business Account Restricted                                                          | PayPal business account restricted                                   | Hard                    | configuration              | manual_review            |
| 2067      | Authorization Expired                                                                       | PayPal authorization expired                                         | Hard                    | invalid_request            | do_not_retry             |
| 2068      | PayPal Business Account Locked or Closed                                                    | PayPal business account locked or closed                             | Hard                    | configuration              | manual_review            |
| 2069      | PayPal Blocking Duplicate Order IDs                                                         | PayPal blocked duplicate order ID                                    | Hard                    | duplicate_request          | do_not_retry             |
| 2070      | PayPal Buyer Revoked Pre-Approved Payment Authorization                                     | Buyer revoked pre-approved PayPal payment                            | Hard                    | payment_method_unavailable | customer_action_required |
| 2071      | PayPal Payee Account Invalid Or Does Not Have a Confirmed Email                             | PayPal payee account invalid / email unconfirmed                     | Hard                    | configuration              | manual_review            |
| 2072      | PayPal Payee Email Incorrectly Formatted                                                    | PayPal payee email badly formatted                                   | Hard                    | configuration              | manual_review            |
| 2073      | PayPal Validation Error                                                                     | PayPal could not validate the transaction                            | Hard                    | invalid_request            | do_not_retry             |
| 2074      | Funding Instrument In The PayPal Account Was Declined By The Processor Or Bank, Or It Can't | Funding source in PayPal account declined/unusable                   | Hard                    | payment_method_unavailable | customer_action_required |
| 2075      | Payer Account Is Locked Or Closed                                                           | Payer PayPal account locked or closed                                | Hard                    | payment_method_unavailable | customer_action_required |
| 2076      | Payer Cannot Pay For This Transaction With PayPal                                           | Payer cannot use PayPal for this transaction                         | Hard                    | payment_method_unavailable | customer_action_required |
| 2077      | Transaction Refused Due To PayPal Risk Model                                                | Refused by PayPal risk model                                         | Hard                    | fraud_or_risk              | do_not_retry             |
| 2078      | Invalid Secure Payment Data                                                                 | Invalid secure payment data (e.g. PIN decryption)                    | Soft                    | invalid_request            | retry_conditionally      |
| 2079      | PayPal Merchant Account Configuration Error                                                 | PayPal merchant account configuration error                          | Hard                    | configuration              | manual_review            |
| 2080      | Invalid user credentials                                                                    | Invalid user credentials                                             | Soft                    | configuration              | manual_review            |
| 2081      | PayPal pending payments are not supported                                                   | PayPal pending payment not supported                                 | Hard                    | configuration              | manual_review            |
| 2082      | PayPal Domestic Transaction Required                                                        | PayPal requires a domestic transaction                               | Hard                    | configuration              | do_not_retry             |
| 2083      | PayPal Phone Number Required                                                                | PayPal requires payer phone number                                   | Hard                    | invalid_request            | customer_action_required |
| 2084      | PayPal Tax Info Required                                                                    | PayPal requires payer tax info                                       | Hard                    | invalid_request            | customer_action_required |
| 2085      | PayPal Payee Blocked Transaction                                                            | Payee fraud settings blocked the payment                             | Hard                    | fraud_or_risk              | manual_review            |
| 2086      | PayPal Transaction Limit Exceeded                                                           | PayPal transaction limit exceeded                                    | Hard                    | payment_method_unavailable | customer_action_required |
| 2087      | PayPal reference transactions not enabled for your account                                  | PayPal reference transactions not enabled                            | Hard                    | configuration              | manual_review            |
| 2088      | Currency not enabled for your PayPal seller account                                         | Currency not enabled on PayPal seller account                        | Hard                    | configuration              | manual_review            |
| 2089      | PayPal payee email permission denied for this request                                       | PayPal payee email permission denied                                 | Hard                    | configuration              | manual_review            |
| 2090      | PayPal or Venmo account not configured to refund more than settled amount                   | PayPal/Venmo not configured to refund above settled amount           | Hard                    | configuration              | manual_review            |
| 2091      | Currency of this transaction must match currency of your PayPal account                     | Currency must match PayPal account currency                          | Hard                    | configuration              | do_not_retry             |
| 2092      | No Data Found - Try Another Verification Method                                             | No data found; use another verification method                       | Soft                    | payment_method_unavailable | customer_action_required |
| 2093      | PayPal payment method is invalid                                                            | PayPal payment method invalid/expired/canceled                       | Hard                    | payment_method_unavailable | customer_action_required |
| 2094      | PayPal payment has already been completed                                                   | PayPal payment already completed (out-of-sequence call)              | Hard                    | duplicate_request          | do_not_retry             |
| 2095      | PayPal refund is not allowed after partial refund                                           | PayPal full refund not allowed after partial refund                  | Hard                    | invalid_request            | do_not_retry             |
| 2096      | PayPal buyer account can't be the same as the seller account                                | PayPal buyer and seller are the same account                         | Hard                    | invalid_request            | do_not_retry             |
| 2097      | PayPal authorization amount limit exceeded                                                  | PayPal authorization amount limit exceeded                           | Hard                    | invalid_amount             | do_not_retry             |
| 2098      | PayPal authorization count limit exceeded                                                   | PayPal authorization count limit exceeded                            | Hard                    | invalid_request            | do_not_retry             |
| 2099      | Cardholder Authentication Required                                                          | Cardholder authentication (3DS) required                             | Soft                    | authentication_required    | customer_action_required |
| 2100      | PayPal channel initiated billing not enabled for your account                               | PayPal channel-initiated billing not enabled                         | Hard                    | configuration              | manual_review            |
| 2101      | Additional authorization required                                                           | Additional authorization required (e.g. insert chip)                 | Soft                    | authentication_required    | customer_action_required |
| 2102      | Incorrect PIN                                                                               | Incorrect PIN                                                        | Soft                    | authentication_failed      | customer_action_required |
| 2103      | PIN try exceeded                                                                            | PIN attempts exceeded                                                | Soft                    | authentication_failed      | customer_action_required |
| 2104      | Offline Issuer Declined                                                                     | Declined offline by issuer                                           | Soft                    | card_declined              | retry_conditionally      |
| 2105      | Cannot Authorize at this time (Life cycle)                                                  | Cannot authorize now (card life-cycle)                               | Soft                    | card_declined              | retry_conditionally      |
| 2106      | Cannot Authorize at this time (Policy)                                                      | Cannot authorize now (policy)                                        | Soft                    | card_declined              | retry_conditionally      |
| 2107      | Card Not Activated                                                                          | Card not activated                                                   | Hard                    | card_declined              | customer_action_required |
| 2108      | Closed Card                                                                                 | Card/account closed                                                  | Hard                    | payment_method_unavailable | customer_action_required |
| 2109-2999 | Processor Declined                                                                          | Generic processor decline for any other 2xxx code                    | Soft                    | card_declined              | retry_conditionally      |
| 3000      | Processor Network Unavailable - Try Again                                                   | Back-end processing network problem; try again                       | Soft                    | provider_unavailable       | retry_conditionally      |

Totals: 109 individual decline codes (2000-2108) + 1 range row (2109-2999) + 3000 = 111 rows. Documented type: 83 Hard, 28 Soft.
Mapping rules used: Hard + Mastercard no-retry list → `do_not_retry`; Hard where the fix is a new/corrected card or a customer step → `customer_action_required`; merchant/processor setup codes → `configuration` + `manual_review`; Soft generic declines → `retry_conditionally`; 3000 → `provider_unavailable` + `retry_conditionally` (not `safe_to_retry_technical_request`, because a retry creates a new transaction; the SDK/GraphQL charge has no documented idempotency key).

### 4.2 Gateway rejection reasons

Status: `gateway_rejected` (SDK) / `GATEWAY_REJECTED` (GraphQL). Set only when the status is gateway_rejected (S5). A gateway rejection comes from the **merchant's own gateway settings**, not the issuer (S3). If the transaction was already authorized, **the gateway voids it automatically** (the bank may be slow to release the hold) (S3).

Value sets differ by source: the SDK Transaction reference (S5) lists 9 lowercase values; the GraphQL `GatewayRejectionReason` enum (S14) has 14; the Control Panel article (S3) has 9 headings, including "Payment Method Blocked".

| SDK value (S5)                                           | GraphQL enum (S14)               | Meaning (S3; others NOT DOCUMENTED beyond the name)                                                          | Category (proposed)        | Retry (proposed)         |
| -------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `application_incomplete`                                 | `APPLICATION_INCOMPLETE`         | Provisional account hit its processing limit before full approval                                            | configuration              | manual_review            |
| `avs`                                                    | `AVS`                            | Blocked by merchant AVS rules                                                                                | fraud_or_risk              | customer_action_required |
| `avs_and_cvv`                                            | `AVS_AND_CVV`                    | Blocked by AVS and CVV rules (no prose description)                                                          | fraud_or_risk              | customer_action_required |
| `cvv`                                                    | `CVV`                            | Blocked by merchant CVV rules                                                                                | fraud_or_risk              | customer_action_required |
| `duplicate`                                              | `DUPLICATE`                      | Blocked by duplicate-transaction checking. GraphQL `GatewayRejectedEvent.duplicateOf` points to the original | duplicate_request          | do_not_retry             |
| `fraud`                                                  | `FRAUD`                          | Blocked by fraud tools (premium fraud / Fraud Protection). See `riskDecision` / `risk_data`                  | fraud_or_risk              | manual_review            |
| `risk_threshold`                                         | `RISK_THRESHOLD`                 | Blocked by basic risk threshold rules                                                                        | fraud_or_risk              | manual_review            |
| `three_d_secure`                                         | `THREE_D_SECURE`                 | Blocked by 3D Secure rules                                                                                   | authentication_failed      | customer_action_required |
| `token_issuance`                                         | `TOKEN_ISSUANCE`                 | Rejected during token issuance (S3 links to the Venmo guide)                                                 | payment_method_unavailable | customer_action_required |
| NOT DOCUMENTED in S5 (`payment_method_blocked` presumed) | `PAYMENT_METHOD_BLOCKED`         | Payment method is blocked (S3 links to ACH guide)                                                            | payment_method_unavailable | customer_action_required |
| NOT DOCUMENTED in S5                                     | `EXCESSIVE_RETRY`                | Name only, no description                                                                                    | rate_limiting              | do_not_retry             |
| NOT DOCUMENTED in S5                                     | `MANUAL_TRANSACTIONS_DISABLED`   | Name only                                                                                                    | configuration              | manual_review            |
| NOT DOCUMENTED in S5                                     | `TOO_MANY_CONFIRMATION_ATTEMPTS` | Name only                                                                                                    | rate_limiting              | do_not_retry             |
| NOT DOCUMENTED in S5                                     | `UNION_PAY_ENROLLMENT_REQUIRED`  | Name only                                                                                                    | authentication_required    | customer_action_required |

Adapter rule: normalize by lowercasing the GraphQL enum (`AVS_AND_CVV` → `avs_and_cvv`) and keep unknown values as `unknown`.

### 4.3 Settlement responses (S2)

Surface: SDK `processor_settlement_response_code` / `processor_settlement_response_text` (S5); GraphQL `processorSettlementResponse.legacyCode` / `.message` and `SettlementDeclinedEvent.processorResponse` (S14). Status `settlement_declined` / `SETTLEMENT_DECLINED`. Payment-method applicability is only stated where PayPal/Venmo appears in the name or description.

| Code | Text (exact)                                                              | Group (S2) | Paraphrase                                                                               | Category (proposed)        | Retry (proposed)                            |
| ---- | ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| 4000 | Settled                                                                   | Approval   | Capture succeeded                                                                        | n/a                        | n/a                                         |
| 4002 | Settlement Pending                                                        | Pending    | Capture still in progress                                                                | unknown                    | retry_conditionally (wait, do not resubmit) |
| 4001 | Settlement Declined                                                       | Decline    | Processor refused to settle the sale or refund                                           | card_declined              | manual_review                               |
| 4003 | Already Captured                                                          | Decline    | Already fully captured                                                                   | duplicate_request          | do_not_retry                                |
| 4004 | Already Refunded                                                          | Decline    | Already fully refunded                                                                   | duplicate_request          | do_not_retry                                |
| 4005 | PayPal Risk Rejected                                                      | Decline    | PayPal risk rejected the sale                                                            | fraud_or_risk              | do_not_retry                                |
| 4006 | Capture Amount Exceeded Allowable Limit                                   | Decline    | Capture amount above processor limit                                                     | invalid_amount             | do_not_retry                                |
| 4018 | PayPal Pending Payments Not Supported                                     | Decline    | PayPal returned pending, which Braintree does not allow; likely account misconfiguration | configuration              | manual_review                               |
| 4019 | PayPal Refund Transaction with an Open Case Not Allowed                   | Decline    | Refund blocked by an open dispute/case                                                   | invalid_request            | manual_review                               |
| 4020 | PayPal Refund Attempt Limit Reached                                       | Decline    | Max refund attempts exceeded                                                             | rate_limiting              | do_not_retry                                |
| 4021 | PayPal Refund Transaction Not Allowed                                     | Decline    | Refund not allowed for this transaction type                                             | invalid_request            | do_not_retry                                |
| 4022 | PayPal Refund Invalid Partial Amount                                      | Decline    | Partial refund amount invalid                                                            | invalid_amount             | do_not_retry                                |
| 4023 | PayPal Refund Merchant Account Missing ACH                                | Decline    | PayPal account has no verified bank account                                              | configuration              | manual_review                               |
| 4024 | Refund Time Limit Exceeded                                                | Decline    | Refund outside the 180-day window                                                        | invalid_request            | do_not_retry                                |
| 4025 | Payer Account Is Locked Or Closed                                         | Decline    | Customer PayPal account unusable                                                         | payment_method_unavailable | customer_action_required                    |
| 4026 | PayPal or Venmo account not configured to refund more than settled amount | Decline    | Over-refund not enabled (contact PayPal)                                                 | configuration              | manual_review                               |

Total: 16 settlement codes. ACH return codes (`ach_return_code` / `achReturnCode`) exist as fields, but **their value list was not read in this research** (out of scope).

### 4.4 Validation error codes (S8) and GraphQL errorClass (S9)

- S8 lists about 878 coded rows across all sections. The **Transaction** section has **99** codes (e.g. 81501 Amount cannot be negative, 81502 Amount is required, 81503 Amount is an invalid format, 81528 Amount is too large, 81531 Amount must be greater than zero, 91504 can only void if authorized/submitted_for_settlement…, 91506 Cannot refund unless settled, 91507 Cannot submit for settlement unless authorized, 91512 already fully refunded, 91521 Refund amount is too large, 91522 Settlement amount is too large, 91565 Unknown or expired payment_method_nonce). The same numbers appear as GraphQL `extensions.legacyCode`.
- Proposed: all validation codes → `invalid_request` / `do_not_retry` by default, with overrides: amount codes (815xx amount) → `invalid_amount`; "already refunded/captured" → `duplicate_request`; state-transition errors (91504, 91506, 91507) → `invalid_request` + `manual_review`. A full per-code import from S8 is a follow-up task.
- GraphQL `errorClass` proposed mapping (Braintree publishes no descriptions): `VALIDATION` → invalid_request/do_not_retry; `AUTHENTICATION` → configuration/do_not_retry (bad API keys); `AUTHORIZATION` → configuration/manual_review; `NOT_FOUND` → invalid_request/do_not_retry; `UNSUPPORTED_CLIENT` → configuration/do_not_retry; `NOT_IMPLEMENTED` → configuration/do_not_retry; `RESOURCE_LIMIT` → rate_limiting/retry_conditionally; `SERVICE_AVAILABILITY` → provider_unavailable/safe_to_retry_technical_request **only for queries**, retry_conditionally for mutations; `INTERNAL` → provider_unavailable/retry_conditionally.

---

## 5. Transaction statuses

SDK values (S5, exactly 12 listed on the Transaction `status` field) plus `settlement_confirmed` (listed in S4 and in S5's `status_history` table). GraphQL `PaymentStatus` enum (S14) uses the same names uppercased.

| SDK (`status`)             | GraphQL (`PaymentStatus`)  | Meaning (S4 / S14 paraphrase)                                                                                          | Terminal?            |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `authorization_expired`    | `AUTHORIZATION_EXPIRED`    | Stayed in authorized too long. Window varies by card/type (e.g. 7 days Amex default, 29 days PayPal)                   | yes                  |
| `authorized`               | `AUTHORIZED`               | Processor approved and funds are on hold. Must be submitted for settlement or voided                                   | no                   |
| `authorizing`              | `AUTHORIZING`              | Not on S4. Schema: if it stays here, contact Braintree                                                                 | no (stuck = anomaly) |
| `submitted_for_settlement` | `SUBMITTED_FOR_SETTLEMENT` | Captured and queued for the nightly batch                                                                              | no                   |
| `settling`                 | `SETTLING`                 | Transitional. Can no longer be voided, only refunded                                                                   | no                   |
| `settled`                  | `SETTLED`                  | Settlement complete (for refunds: funds on their way back to the customer)                                             | yes*                 |
| `settlement_pending`       | `SETTLEMENT_PENDING`       | Not yet fully settled. Normal for ACH Direct Debit and multiple partial settlements; usually resolves for PayPal/Venmo | no                   |
| `settlement_declined`      | `SETTLEMENT_DECLINED`      | Processor declined at settlement. See settlement response code                                                         | yes                  |
| `settlement_confirmed`     | `SETTLEMENT_CONFIRMED`     | Parent of a partial capture. The parent will not settle, its children do                                               | yes (parent)         |
| `processor_declined`       | `PROCESSOR_DECLINED`       | Declined at authorization. See processor response code                                                                 | yes                  |
| `gateway_rejected`         | `GATEWAY_REJECTED`         | Rejected by merchant gateway rules (AVS, CVV, duplicate, risk, fraud) or provisional-account limit                     | yes                  |
| `failed`                   | `FAILED`                   | Error while sending to the processor                                                                                   | yes                  |
| `voided`                   | `VOIDED`                   | Cancelled before settlement                                                                                            | yes                  |

\* `settled` can still be followed by `transaction_settlement_declined` for ACH/SEPA returns (S19). Use the GraphQL `terminal` flag on events when present rather than this table.

Documented flows (S4): `authorized → submitted_for_settlement → settling → settled`; void allowed from `authorized`, `submitted_for_settlement`, and (some PayPal) `settlement_pending`; after `settling`/`settled`, refund instead (refund = separate transaction of `type: credit` with `refunded_transaction_id`); `authorized → authorization_expired`; partial capture: parent → `settlement_confirmed`, each child → `settled` or `settlement_declined`; ACH sales enter `settlement_pending` and typically update in 1-3 business days.

Other status sets (S4): verification `processor_declined`, `gateway_rejected`, `failed`, `verified`; dispute `open`, `disputed`, `under_review`, `accepted`, `auto_accepted`, `expired`, `won`, `lost` (GraphQL `DisputeStatus`: `ACCEPTED`, `AUTO_ACCEPTED`, `DISPUTED`, `EXPIRED`, `LOST`, `OPEN`, `UNDER_REVIEW`, `WON`; SDK Dispute reference S26 shows uppercase, SDK webhook samples S27 show lowercase `open` → accept both); escrow `hold_pending`, `held`, `release_pending`, `released`, `refunded`; subscription `pending`, `active`, `past_due`, `expired`, `canceled`.

---

## 6. Webhook notification kinds

Transaction / dispute / money-movement relevant kinds (exact strings):

| Kind                                                                                                                                                                                                                                                     | Source                              | Fires when                                                                                   | Subject attribute                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `transaction_settled`                                                                                                                                                                                                                                    | S19                                 | Transaction settled. **Only for ACH Direct Debit and SEPA Direct Debit** sale/refund         | `transaction`                                                                                                                         |
| `transaction_settlement_declined`                                                                                                                                                                                                                        | S19                                 | Settlement rejected; can arrive **after** `transaction_settled` (bank return). ACH/SEPA only | `transaction` (+`ach_return_code`, `ach_reject_reason` on the transaction, S5)                                                        |
| `transaction_disbursed`                                                                                                                                                                                                                                  | S21                                 | **Deprecated.** Transaction marked for disbursement (Braintree-funded accounts)              | `transaction`                                                                                                                         |
| `disbursement`                                                                                                                                                                                                                                           | S21                                 | Daily, per merchant account: funds sent. Contains `transaction_ids[]`                        | `disbursement` (`id`, `amount`, `disbursement_date`, `disbursement_type`, `transaction_ids`, `merchant_account`, `retry`, `success?`) |
| `transaction_reviewed`                                                                                                                                                                                                                                   | S22                                 | Fraud Protection review accepted/rejected; if rejected, a void/refund was requested          | `transaction_review` (`transaction_id`, `decision`, `reviewer_email`, `reviewer_note`, `reviewed_time`)                               |
| `dispute_opened`                                                                                                                                                                                                                                         | S20                                 | New dispute                                                                                  | `dispute`                                                                                                                             |
| `dispute_under_review`                                                                                                                                                                                                                                   | S20                                 | Under internal PayPal review                                                                 | `dispute`                                                                                                                             |
| `dispute_disputed`                                                                                                                                                                                                                                       | S20                                 | Merchant contested                                                                           | `dispute`                                                                                                                             |
| `dispute_accepted`                                                                                                                                                                                                                                       | S20                                 | Merchant accepted                                                                            | `dispute`                                                                                                                             |
| `dispute_auto_accepted`                                                                                                                                                                                                                                  | S20                                 | System auto-accepted                                                                         | `dispute`                                                                                                                             |
| `dispute_won`                                                                                                                                                                                                                                            | S20                                 | Resolved for merchant                                                                        | `dispute`                                                                                                                             |
| `dispute_lost`                                                                                                                                                                                                                                           | S20                                 | Resolved against merchant                                                                    | `dispute`                                                                                                                             |
| `dispute_expired`                                                                                                                                                                                                                                        | S20                                 | Response window lapsed                                                                       | `dispute`                                                                                                                             |
| `subscription_charged_successfully` / `subscription_charged_unsuccessfully` / `subscription_went_past_due` / `subscription_went_active` / `subscription_canceled` / `subscription_expired` / `subscription_trial_ended` / `subscription_billing_skipped` | S23                                 | Recurring billing events (the subscription object includes its transactions)                 | `subscription`                                                                                                                        |
| `local_payment_completed` / `local_payment_reversed` / `local_payment_funded` / `local_payment_expired`                                                                                                                                                  | S24                                 | Local payment method lifecycle                                                               | local payment fields (`payment_method_nonce`, ...)                                                                                    |
| `payment_method_revoked_by_customer`, `payment_method_customer_data_updated`                                                                                                                                                                             | S25                                 | Vaulted method revoked / updated                                                             | payment method                                                                                                                        |
| `transaction_retried`                                                                                                                                                                                                                                    | **SDK source only** (S27 Kind enum) | NOT DOCUMENTED on the docs pages read                                                        | `transaction`                                                                                                                         |

The SDK Kind enum (S27) also includes `check` (Control Panel test webhook), account-updater, OAuth, sub-merchant, Grant API kinds. These are not transaction-relevant.

**What is NOT notified (S15, S19):** The webhooks overview lists ACH Direct Debit _transaction statuses_ as the only transaction-status webhooks. The transaction webhook page covers only ACH and SEPA Direct Debit. So **card, PayPal, Venmo, Apple/Google Pay transactions get no webhook for `authorized`, `processor_declined`, `gateway_rejected`, `failed`, `submitted_for_settlement`, `settling`, `settled`, `voided`, `authorization_expired`, or for refund creation.** Their state must come from API responses or snapshots (GraphQL `statusHistory`, SDK `status_history`). Also: `subscription_charged_unsuccessfully` does not fire on manual retries or when subscription creation fails (S23). `subscription_went_past_due` fires once per billing cycle (S23). A timeline built from webhooks alone is therefore incomplete by design.

---

## 7. Identifiers

| Identifier                | SDK field                                                                                                           | GraphQL field                                                                               | Notes                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction ID (legacy)   | `id` (also `transaction.id` in webhooks)                                                                            | `legacyId`                                                                                  | Short alphanumeric, e.g. `vsx5py3` (S12 example). "Length and format … may change at any time" (S5)                                                                                                                    |
| Transaction ID (GraphQL)  | `graphql_id`                                                                                                        | `id`                                                                                        | Unique across all domains. Legacy IDs can collide across types (a Transaction and a PaymentMethod may share one) (S12). Docs example value `dHJhbnNhY3Rpb25faWQ=` is base64 (S10). Convert with `idFromLegacyId` (S12) |
| Order ID                  | `order_id`                                                                                                          | `orderId`                                                                                   | Merchant-supplied. For PayPal it is the PayPal invoice number (unique per PayPal business account) (S5, S14)                                                                                                           |
| Refunds of a sale         | `refund_ids[]` (`refund_id` deprecated)                                                                             | `refunds[]` (`Refund` objects)                                                              | (S5, S14)                                                                                                                                                                                                              |
| Original sale of a refund | `refunded_transaction_id`                                                                                           | `Refund.refundedTransaction`                                                                | (S5, S14)                                                                                                                                                                                                              |
| Retries                   | `retried_transaction_id`, `retry_ids`                                                                               | `retriedParentTransaction`, `retriedTransactions`, `retried`                                | (S5, S14)                                                                                                                                                                                                              |
| Partial capture           | NOT DOCUMENTED in fields read (`partial_settlement_transaction_ids` not seen)                                       | `partialCaptureDetails`                                                                     | (S14)                                                                                                                                                                                                                  |
| Duplicate original        | n/a                                                                                                                 | `GatewayRejectedEvent.duplicateOf`                                                          | (S14)                                                                                                                                                                                                                  |
| Dispute                   | `dispute.id`, `graphql_id`, `case_number`, `reference_number`, `original_dispute_id`, `transaction.id`              | `Dispute.id`, `legacyId`, `caseNumber`, `referenceNumber`, `originalDispute`, `transaction` | (S26, S14)                                                                                                                                                                                                             |
| Disbursement              | `disbursement.id`, `transaction_ids[]`                                                                              | `disbursementDetails`                                                                       | (S21)                                                                                                                                                                                                                  |
| Processor refs            | `processor_authorization_code`, `retrieval_reference_number`, `acquirer_reference_number`, `network_transaction_id` | `processorAuthorizationResponse.authorizationId`, `.retrievalReferenceNumber`               | Correlate with issuer/acquirer                                                                                                                                                                                         |
| Request                   | n/a                                                                                                                 | top-level `extensions.requestId`                                                            | Per GraphQL request (S9)                                                                                                                                                                                               |
| Merchant                  | `merchant_account_id`                                                                                               | `merchantAccountId`, `merchantId`                                                           |                                                                                                                                                                                                                        |
| PayPal                    | `paypal_details` (`payment_id`, ...), `local_payment_details.payment_id`                                            |                                                                                             |                                                                                                                                                                                                                        |

---

## 8. Sensitive fields (redact or mask before display/export)

- **Credentials:** `Authorization: Basic …` headers (base64 of `PUBLIC_KEY:PRIVATE_KEY`, S9), `Bearer` tokenization keys / client tokens / `authorizationFingerprint` / access tokens (S9). `bt_signature` contains the merchant **public key** (S27). Treat it as sensitive.
- **Payment instruments:** `payment_method_nonce` / `paymentMethodId` (single-use), vault `token`, `credit_card_details.bin`/`last_4`/`cardholder_name`/`expiration_*`, `paymentMethodSnapshot` (`bin`, `last4`), Apple Pay `source_card_last4`, `us_bank_account` (`routing-number`, `last-4`, `account-holder-name`), SEPA account details, `three_d_secure_info` (`cavv`, `xid`, `eci`). `result.params` excludes card number and CVV (S6), but pasted request bodies might not.
- **PII:** `customer_details` (name, email, phone, company), `billing_details`/`shipping_details` addresses, `paypal_details` (payer email/ID), dispute `paypal_messages`, `evidence` comments/URLs, `reviewer_email`/`reviewer_note` (S22).
- **Risk / device:** `risk_data.id`, `device_data_captured`, `decision_reasons`, `risk_score`; `network_transaction_id` (reusable for MIT chains); `processor_authorization_code`.
- **Low risk (keep):** status, codes, texts, amounts, currency, timestamps, transaction/order/dispute IDs (the order ID may embed customer info, so offer masking).

---

## 9. Structural detection hints

| Shape                                     | Strong signals                                                                                                                                                                                                                                                                                        | Disambiguation                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GraphQL error/response**                | Top-level `extensions.requestId` + `data` and/or `errors[]`; `errors[].extensions.legacyCode` matching `^\d{5}$`; `errorClass` in the 9-value set; `inputPath` arrays                                                                                                                                 | Generic GraphQL (Shopify, etc.) also uses `errors[].extensions`. Require `legacyCode` or `errorClass` ∈ Braintree set, or `requestId` + Braintree field names (`chargePaymentMethod`, `paymentMethodSnapshot`, `legacyId`) |
| **GraphQL transaction**                   | `status` ∈ uppercase `PaymentStatus` set; `statusHistory[]` with `status`/`timestamp`/`terminal`; `processorAuthorizationResponse.legacyCode` 1000-3000; `gatewayRejectionReason`; `legacyId`                                                                                                         | Uppercase status + `legacyId` is very Braintree-specific                                                                                                                                                                   |
| **SDK transaction snapshot (snake_case)** | `processor_response_code` (4-digit string 1000-3000), `processor_response_text`, `processor_response_type` ∈ {approved, soft_declined, hard_declined}, `gateway_rejection_reason`, `status` ∈ lowercase set, `status_history[]` with `transaction_source`, `merchant_account_id`, `currency_iso_code` | Stripe uses `decline_code`/`outcome`; Adyen uses `resultCode`/`refusalReason`. `processor_response_code` + `merchant_account_id` is a strong pair                                                                          |
| **SDK snapshot (camelCase, Node/Java)**   | `processorResponseCode`, `processorResponseText`, `processorResponseType`, `gatewayRejectionReason`, `statusHistory[].transactionSource`, `merchantAccountId`, `currencyIsoCode`                                                                                                                      | camelCase + lowercase status values separates it from GraphQL (uppercase enums, no `processorResponseCode`)                                                                                                                |
| **SDK result wrapper**                    | `{success:false, transaction:{…}}` or `{success:false, errors:{…}, message:"…\n…", params:{…}}`; errors with `attribute`, `code` (5-digit), `message`                                                                                                                                                 | Serialization varies (Node `errors.deepErrors()` arrays, Ruby `ValidationErrorCollection`). Accept any nested object containing `{attribute, code, message}` triples                                                       |
| **Raw webhook form body**                 | `bt_signature=…&bt_payload=…` (URL-encoded), signature `^[a-z0-9]+\|[0-9a-f]{40}` pairs                                                                                                                                                                                                               | Unique to Braintree                                                                                                                                                                                                        |
| **Base64 bt_payload**                     | Base64 string that decodes to text starting with `<notification>` (or `<?xml`)                                                                                                                                                                                                                        | Decode locally, mark **signature unverified**                                                                                                                                                                              |
| **Decoded XML**                           | `<notification>`, `<timestamp type="datetime">`, `<kind>`, `<subject>`; kebab-case children (`currency-iso-code`, `merchant-account-id`)                                                                                                                                                              | Kebab-case XML is the legacy gateway format                                                                                                                                                                                |
| **Parsed SDK notification (JSON)**        | `{kind: "<known kind>", timestamp, transaction                                                                                                                                                                                                                                                        | dispute                                                                                                                                                                                                                    | disbursement | subscription | …}`or`{kind, timestamp, subject:{…}}` | `kind` ∈ the Braintree Kind set (e.g. `dispute_opened`, `transaction_settled`) |

---

## 10. Limitations

1. **SDK JSON serialization is NOT DOCUMENTED.** Docs show Ruby accessors only. Pasted SDK objects may be snake_case, camelCase, or PascalCase (.NET), may contain SDK internals (`gateway`, private fields), and dates may be strings or Date objects.
2. **Webhook signature verification is impossible offline** (needs the private key). `bt_payload` encoding (base64 XML) comes from SDK source, not from a docs page.
3. **No webhooks for most card/PayPal transaction state changes** (S15, S19). Webhook-only timelines will have gaps. Out-of-order delivery is documented (S16).
4. GraphQL `errorClass` values have **no published descriptions or HTTP mapping**. `message` must not be parsed (S9).
5. Gateway rejection value lists **disagree** between the SDK reference (9), the Control Panel article (9, incl. Payment Method Blocked) and the GraphQL enum (14). Five GraphQL values have no description.
6. Docs inconsistencies: `terminal` shown as string `"true"` vs schema Boolean (S10 vs S14); `voidTransaction` payload `errors[]` and `extensions.code: "UNAUTHORIZED"` examples not reflected in the schema (S10 vs S14); `proccessor_response_code` typo in the S5 status-history table; dispute status case differs (S26 uppercase vs S27 lowercase).
7. `authorizing` status has no description on S4 (schema only).
8. The 2109-2999 range is a single generic row. Individual codes in that range have no specific meaning.
9. `additional_processor_response` (e.g. `"05 : NOT AUTHORISED"`) is bank-specific free text. Braintree says to treat `processor_response_code` as the source of truth (S5). `network_response_code` and `merchant_advice_code` lists were not transcribed here (separate "Network Response Codes" / merchant advice pages).
10. ACH return code values, verification (`credit_card_verification`) response objects, and the full 878-row validation catalogue are not transcribed in this file.
11. Test webhooks from `sample_notification` contain dummy objects (S17). Do not infer missing fields from them.
12. Client timeouts: a timed-out charge may still have succeeded (S9). The adapter should flag "no response ≠ failure".

---

## 11. Proposed capability statuses

| Capability           | Status        | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | Complete official tables: 1000-1005, 2000-2108 + 2109-2999 + 3000 with exact texts and **documented Hard/Soft type** (S1), 16 settlement codes (S2), gateway rejection reasons (S3/S5/S14), 99 transaction validation codes reused as GraphQL `legacyCode` (S8, S9). Category/retry is a PandaPayLens mapping (mark as derived). Unknown codes fall back by range.                                                                                                         |
| **paymentResponses** | **supported** | GraphQL `Transaction`/`Refund` with `status` + `statusHistory` events is fully specified in the schema (S14), with verbatim examples (S9, S10, S11). SDK snapshot field names are documented (S5). Caveat: the SDK JSON envelope is undocumented, so detection must be field-based.                                                                                                                                                                                        |
| **webhookParsing**   | **limited**   | Parsed notifications (`kind`, `timestamp`, subject) and all relevant kinds are documented (S16-S25). But raw deliveries are signed base64 XML that cannot be verified offline, the encoding is only evident from SDK source (S27), and transaction webhooks cover only ACH/SEPA. Support decoded/parsed notifications fully. Offer base64 decode as "unverified".                                                                                                          |
| **timeline**         | **supported** | `statusHistory`/`status_history` gives an ordered, timestamped, amount-bearing event list with `terminal` flags and per-event processor responses (S5, S14). Combined with refunds (`refund_ids`/`refunds`), disputes (`statusHistory` on `Dispute`) and webhooks (with out-of-order handling, S16), this is enough for an accurate timeline from a single snapshot. Gaps from missing webhooks are documented, not silent.                                                |
| **correlation**      | **limited**   | Strong links exist (`refunded_transaction_id`/`refund_ids`, `dispute.transaction.id`, `disbursement.transaction_ids`, `retried_transaction_id`, `order_id`, `duplicateOf`). But legacy vs GraphQL IDs differ (S12): `graphql_id`/`legacyId` is needed to join GraphQL pastes with SDK/webhook pastes, and `idFromLegacyId` cannot be called offline. GraphQL IDs that are base64 may be decodable, but that format is **NOT DOCUMENTED**, so do not rely on decoding them. |
