# Mercado Pago research

Provider id: `mercadopago`. Scope: the Payments API (`/v1/payments`), its refunds, error responses, and Webhooks and IPN notifications for payments. Research date: 2026-11-17.

All facts below come from Mercado Pago's own documentation, read on 2026-11-17. Code tables are paraphrased, not copied; follow the links for the exact wording. Where the documentation is silent, this note says NOT DOCUMENTED and the adapter does not rely on the item.

## 1. Sources

All pages were fetched on 2026-11-17 from the Brazil developer site in English (`www.mercadopago.com.br/developers/en/...`), which serves every page below with HTTP 200. Each page also has a Markdown rendering at the same URL with `.md` appended, which was used to read collapsed sections. The equivalent deep paths on `www.mercadopago.com/developers/en/...` returned HTTP 404 on that date.

| #   | Page                                           | URL                                                                                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Get payment (API reference)                    | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/get-payment/get                               |
| S2  | Create payment (API reference)                 | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-payment/post                           |
| S3  | Update payment (API reference)                 | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/update-payment/put                            |
| S4  | Create cancellation (API reference)            | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-cancellation/put                       |
| S5  | Create refund (API reference)                  | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-refund/post                            |
| S6  | Get specific refund (API reference)            | https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/get-refund/get                                |
| S7  | Payment creation results                       | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/response-handling/collection-results                               |
| S8  | Get payment status                             | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/response-handling/query-results                                    |
| S9  | Card token generation errors                   | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/error-messages/card-token-creation-errors                          |
| S10 | Data entry errors                              | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/response-handling/data-insertion-errors                            |
| S11 | Why is a payment rejected?                     | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/improve-payment-approval/reasons-for-rejection             |
| S12 | Notifications introduction                     | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/additional-content/your-integrations/notifications/introduction    |
| S13 | Webhooks                                       | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks        |
| S14 | IPN                                            | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/additional-content/your-integrations/notifications/ipn             |
| S15 | Additional information about notifications     | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/additional-content/your-integrations/notifications/additional-info |
| S16 | Configure payment notifications (Checkout Pro) | https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/payment-notifications                                           |
| S17 | Refunds and cancellations                      | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/cancellations-and-refunds/introduction          |
| S18 | Capture authorized payment                     | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/capture-authorized-payment                      |
| S19 | Chargebacks introduction                       | https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/chargebacks/introduction                        |
| S20 | Official Node.js SDK, error handling guide     | https://github.com/mercadopago/sdk-nodejs/blob/master/docs/error-handling.md (last changed 2026-10-13)                                     |
| S21 | Official Node.js SDK, error classes            | https://github.com/mercadopago/sdk-nodejs/blob/master/src/utils/errors/index.ts (commit 53dee2c, 2026-11-11)                               |

S20 and S21 are Mercado Pago's own SDK repository. They are the only first-party source found that states the shape of an API error body (section 4).

Other country sites (for example `.com.pe`, `.com.co`, `.com.mx`) publish the same reference pages, but search results showed that some numeric error codes carry different meanings on different country pages (for example 3003 and 4020). Only the Brazil English pages were used.

## 2. API families in scope

| Family                                                                                            | Endpoints                                                                              | Status in the adapter                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Payment object                                                                                    | `POST /v1/payments`, `GET /v1/payments/{id}`, `PUT /v1/payments/{id}` (S1 to S4)       | Analyzed                                                        |
| Refund object                                                                                     | `POST /v1/payments/{id}/refunds`, `GET /v1/payments/{id}/refunds/{refund_id}` (S5, S6) | Analyzed                                                        |
| Error responses                                                                                   | All of the above                                                                       | Envelope recognized, decoded by HTTP status only (section 4)    |
| Webhooks, `payment` topic                                                                         | HTTP POST with JSON body (S13, S16)                                                    | Analyzed                                                        |
| Webhooks, `topic_chargebacks_wh`                                                                  | HTTP POST with JSON body (S15)                                                         | Analyzed as a dispute signal                                    |
| Other Webhooks topics (merchant orders, claims, fraud alerts, Card Updater, subscriptions, Point) | S13, S15                                                                               | Recognized, not analyzed                                        |
| IPN                                                                                               | Query parameters `topic` and `id` (S14)                                                | `payment` topic analyzed; other topics recognized, not analyzed |
| Orders API (`/v1/orders`), Checkout Pro preferences, merchant orders, subscriptions, Point, QR    |                                                                                        | Out of scope                                                    |

## 3. Payment object

Fields used by the adapter, as described in S1 (paraphrased):

| Field                                                          | Type in S1                     | Meaning                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                           | number                         | Payment id generated by Mercado Pago                                                                                                                                    |
| `status`                                                       | string                         | Current payment state (section 5)                                                                                                                                       |
| `status_detail`                                                | string                         | Detail of the result (section 5)                                                                                                                                        |
| `date_created`, `date_approved`, `date_last_updated`           | string                         | Creation, approval and last event time. The examples use ISO 8601 with milliseconds and an offset or `Z`                                                                |
| `date_of_expiration`                                           | string                         | Expiration time                                                                                                                                                         |
| `money_release_date`                                           | string                         | When the money is released to the collector's balance                                                                                                                   |
| `operation_type`                                               | string                         | Enum: `investment`, `regular_payment`, `money_transfer`, `recurring_payment`, `account_fund`, `payment_addition`, `cellphone_recharge`, `pos_payment`, `money_exchange` |
| `payment_method_id`                                            | string                         | Payment method; for cards the brand                                                                                                                                     |
| `payment_type_id`                                              | string                         | Enum: `ticket`, `bank_transfer`, `credit_card`, `debit_card`, `prepaid_card`, `digital_currency`, `digital_wallet`, `voucher_card`, `crypto_transfer`                   |
| `payment_method.data.threeds`                                  | string                         | 3DS result enum: `AUTHENTICATED`, `NOT_AUTHENTICATED`, `CHALLENGE`, `ATTEMPTED`, `REJECTED`, `ERROR`                                                                    |
| `currency_id`                                                  | string                         | Currency                                                                                                                                                                |
| `transaction_amount`                                           | number                         | Amount. The S1 response example shows it as the string `"24.50"`, so both forms occur in documentation                                                                  |
| `transaction_amount_refunded`                                  | number                         | Refunded amount                                                                                                                                                         |
| `transaction_details.total_paid_amount`, `net_received_amount` | number                         | Paid and net amounts                                                                                                                                                    |
| `captured`                                                     | boolean                        | Whether the amount was captured                                                                                                                                         |
| `binary_mode`                                                  | boolean                        | When true, the result can only be approved or rejected                                                                                                                  |
| `installments`                                                 | number                         | Number of installments                                                                                                                                                  |
| `live_mode`                                                    | boolean                        | Production or test                                                                                                                                                      |
| `external_reference`                                           | string                         | Merchant reference                                                                                                                                                      |
| `collector_id`                                                 | string (number in the example) | Receiving user                                                                                                                                                          |
| `processing_mode`                                              | string                         | `Aggregator` or `Gateway`                                                                                                                                               |
| `authorization_code`                                           | string                         | Six-digit card authorization code                                                                                                                                       |

Sensitive fields present in the object and never copied: `payer.email`, `payer.identification.number` and `type`, `payer.id`, `card` (card details), `metadata`, `additional_info` (can hold names, phone, addresses, IP), `description`, `statement_descriptor`, `notification_url`, `call_for_authorize_id`, `merchant_number`, `merchant_account_id`.

Amounts are decimal numbers in the currency (S1, S2 examples: `24.50`, `12.34`). The adapter converts them with `decimalToMinor`.

Capture: an authorized payment must be captured within 5 days of creation (S18). Partial capture with a lower `transaction_amount` is documented (S18).

## 4. Error responses

### 4.1 Envelope

The API reference pages (S1 to S6) list errors as rows of HTTP status, an error value (mostly numeric, for example `2000`, `3005`, `4292`; sometimes text such as `Unauthorized use of live credentials` or `pa_unauthorized_result_from_policies`) and a description. **They do not show the JSON body of an error.**

The official Node.js SDK (S21) builds its errors from the raw response body and declares that body as an object with optional `status` (number), `message` (string), `error` (string) and `cause` (array of unspecified items). It maps HTTP status to error classes: 400 bad request, 401 authentication, 402 payment processing (described for the Orders and advanced payments APIs), 403 forbidden, 404 not found, 409 idempotency or state conflict, 422 business rule violation, 423 idempotency key locked, 424 failed dependency, 429 rate limit with `Retry-After`, 5xx server error. S20 gives recovery advice per class: credentials and permissions errors need a fix and no retry; validation errors fail again on identical retry; idempotency conflicts need the original key kept and the operation reconciled; rate limits should respect `retryAfter`; dependency, lock and server errors may be retried within a bounded policy; a connection error leaves the outcome unknown and must be reconciled before a write is repeated.

NOT DOCUMENTED: the structure of the items in `cause` (field names for a numeric code or description), the set of values of the top-level `error` string for the Payments API, and which field carries the numeric codes of the reference tables.

Consequence for the adapter: an error body is recognized only when it carries `status`, `error`, `message` and a `cause` array together. It is decoded by HTTP status (from the body or the pasted HTTP status line) using the SDK classes above, with confidence `possible`. `cause` items are counted but not interpreted, and the numeric codes below are not decoded.

### 4.2 Numeric error values listed in the reference

Paraphrased groups from S1, S2, S4, S5 and S6. Kept here for reference only; the adapter does not decode them because the body field that carries them is not documented.

- Authentication and authorization: 5 (access token missing, 401 on S4 and S6, 400 on S1), 4 and 3002 (caller not authorized, 403), `Unauthorized use of live credentials` (401, token without the payment scope, S2), `pa_unauthorized_result_from_policies` (403, policy agent, usually a missing authorization header, S2), 401 on S5 (invalid token).
- Not found: 2000 (payment not found, 404), 2032 (refund not found, 404, S5 and S6).
- Duplicate request: 2001 (the same request was posted in the last minute, S1), and on S9 the client-side value 801 with the same meaning.
- Idempotency header missing: 4292 (400 on S2, 404 on S5).
- Invalid state: 3005 (the resource state does not allow the operation, S1 and S2), 2018 and 2016 (invalid status change when cancelling, S4), 2063 (action not valid for the payment state, refunds, S5).
- Refund rules: 2024 and 15016 (payment too old to refund, S5), 3024 (partial refund not supported; 400 on S1 and S2, 404 on S5), 4040 and 4041 (refund amount must be positive and numeric, listed under 401 on S5).
- Card and token data: 2006, 2062, 3003, 3006, 3008 (card token missing or invalid), 3000, 3001, 3012 to 3023, 3029, 3030 (card and cardholder fields missing or invalid), 3010 (card not on whitelist).
- Payment method and amount: 2072, 4002, 4003, 4023, 4024, 4037 (transaction amount missing or invalid), 2131 (payment method cannot be inferred), 3011, 3014, 3026 to 3028 (payment method or type invalid), 4033 (invalid installments), 4038 and 4039 (application fee larger than the amount or negative), 2059 (application fee needs an OAuth token).
- Users: 2034 (test and production users mixed), 2123 (invalid operators), 6033 (user unavailable).

The same number is listed with different HTTP statuses on different pages (for example 3012 and 3024 are 400 on S2 and 404 on S5), and several numbers express the same condition (for example 2018, 2063 and 3005 for an invalid state). A body does not say which endpoint produced it.

## 5. Payment statuses

### 5.1 `status` (S1, paraphrased)

| Value          | Meaning                                                                       | Adapter stage and outcome                                                              |
| -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pending`      | The payer has not finished paying (for example a boleto that is still unpaid) | payment, pending (authentication, pending when `status_detail` is `pending_challenge`) |
| `approved`     | Approved and credited                                                         | payment, success                                                                       |
| `authorized`   | Authorized, not captured                                                      | authorization, success                                                                 |
| `in_process`   | Under review                                                                  | payment, pending                                                                       |
| `in_mediation` | The payer opened a dispute                                                    | dispute, pending                                                                       |
| `rejected`     | Rejected; the payer may try again                                             | payment, failure                                                                       |
| `cancelled`    | Cancelled by a party or expired                                               | cancellation, failure                                                                  |
| `refunded`     | Refunded to the payer                                                         | refund, success                                                                        |
| `charged_back` | A chargeback was issued on the card                                           | dispute, pending for `in_process`, otherwise unknown                                   |

Approval is not settlement: `money_release_date` is when funds become available (S1).

Cancellation is possible only while the payment is `pending`, `in_process` or `authorized` (S4, S17). Pending offline payments are cancelled after 30 days with `status_detail` `expired` (S8, S15, S17).

### 5.2 `status_detail` (S1, S7, S8)

S1 lists all values in one enum; S7 and S8 pair them with a `status`. Several values only make sense with their status (`pending`, `in_process`, `refunded`, `by_admin`, `settled`, `reimbursed`), so the adapter reads them as a pair.

- `approved`: `accredited` (credited), `partially_refunded` (at least one partial refund). S1 also lists `partially_bpp_refunded` and `partially_bpp_covered` (mediation outcomes with partial reimbursement) without naming the status.
- `authorized`: `pending_capture`.
- `in_process`: `offline_process`, `pending_contingency`, `pending_review_manual`, `deferred_retry` (S8), and in S1 `pending_provider_response`.
- `pending`: `pending_waiting_transfer`, `pending_waiting_payment`, `pending_challenge` (3DS challenge not yet completed), and in S1 `pending_waiting_for_remedy`.
- `cancelled`: `expired`, `by_collector`, `by_payer`, and in S1 `by_admin`.
- `refunded`: `refunded`, `by_admin`, and in S1 `bpp_refunded` (mediation won by the payer, refund covered by Mercado Pago). S1 also lists `bpp_covered` without a status.
- `charged_back`: `in_process` (payer disowned the payment, in progress), `settled` (money retained after the chargeback), `reimbursed` (money reimbursed after the chargeback). The documentation does not say whose favor `settled` and `reimbursed` represent; the adapter shows them without an outcome.
- `in_mediation`: `pending`.
- `rejected` (paraphrased; S1 descriptions with S7 and S8 payer messages):
  - Card data entry: `cc_rejected_bad_filled_card_number`, `cc_rejected_bad_filled_date`, `cc_rejected_bad_filled_security_code`, `cc_rejected_bad_filled_other`.
  - Issuer and card: `cc_rejected_call_for_authorize` (payer must authorize the amount with the issuer), `cc_rejected_card_disabled` (inactive card), `cc_rejected_insufficient_amount` (insufficient limit or funds), `cc_rejected_invalid_installments`, `cc_rejected_max_attempts` (attempt limit reached), `cc_rejected_duplicated_payment` (duplicate on the issuer side; S7 tells the payer a payment of that value was already made), `cc_rejected_card_type_not_allowed` (credit function not enabled on a combined card), `cc_rejected_card_error` (S7 only, generic), `cc_rejected_other_reason` (generic).
  - 3DS: `cc_rejected_3ds_challenge` (challenge failed), `cc_rejected_3ds_mandatory` (3DS required but not performed).
  - Risk: `cc_rejected_blacklist` (card on a denial list), `cc_rejected_high_risk` (fraud prevention; S7 tells the payer to choose another method), `rejected_high_risk` (risk, credit scoring or suspected fraud).
  - Timeout: `cc_rejected_time_out` (Mercado Pago did not receive a response in time; the payment is rejected).
  - Limits and rules: `cc_amount_rate_limit_exceeded` (payment method capacity limit), `rejected_by_regulations`, `rejected_by_biz_rule`, `rejected_insufficient_data` (required data missing), `insufficient_amount` (insufficient amount; S1 does not say whether this means funds or a minimum amount).
  - Bank transfer: `bank_error` (error with the bank), `bank_rejected` (bank rejected the payment), `rejected_by_bank` (operation rejected by the bank).
  - Payer: `payer_unavailable` (payer restricted).
  - Other: `rejected_other_reason` (unclassified).

S11 groups rejections into issuer declines, fraud prevention, and checkout data errors. Mapping each value to a PandaPayLens category and retry class is a PandaPayLens judgment based on these descriptions; Mercado Pago does not publish retry guidance per value except the payer messages in S7 (choose another card or method for `cc_rejected_high_risk`, `cc_rejected_max_attempts`, `cc_rejected_duplicated_payment`, `cc_rejected_card_disabled`).

The issuer's own raw response code is NOT DOCUMENTED in the payment object.

## 6. Refunds

S5 and S6 describe the refund object: `id` (number), `payment_id` (number), `amount` (number), `status`, `date_created`, `refund_mode`, `adjustment_amount`, `unique_sequence_number` (refund id from the card processor), `reason`, `source[]` (who requested it: `id`, `name`, `type` one of Admin, Collector, BPP, Marketplace), `metadata`, `label`, `partition_details`. A full refund is created when `amount` is omitted. `X-Idempotency-Key` is required.

Refund `status` enum in S5 and S6: `approved`, `in_process`, `rejected`, `cancelled`, `authorized`. The descriptions on those pages are copied from the payment status descriptions and do not describe refunds. The adapter maps `approved` to success, `in_process` to pending, `rejected` and `cancelled` to failure, and leaves `authorized` unknown.

Rules (S17): refunds are possible within 180 days of approval, require enough balance in the seller's account, and go back to the card statement or, for other methods, to the payer's account.

A refund does not have its own notification topic in S13; it shows up as a `payment` notification and a change of the payment's `status` and `transaction_amount_refunded`. NOT DOCUMENTED: whether a separate `payment.updated` is always sent for a partial refund.

`source[].name` is a person's name and is never copied.

## 7. Notifications

### 7.1 Webhooks (recommended, S12, S13, S16)

- Delivered as HTTP POST with a JSON body. Query parameters `data.id` and `type` accompany the URL (S16).
- Body fields (S13, paraphrased): `id` (notification id), `live_mode`, `type` (topic, for payments `payment`), `date_created` (S13 says it is the creation date of the notified resource), `user_id` (seller), `api_version` (`v1`), `action` (event, creation or update), `data.id` (id of the payment, merchant order or claim).
- Payment actions documented: `payment.created` (S13 example) and `payment.updated` (S16 simulation example).
- The notification carries no status. The receiver must fetch `GET /v1/payments/{id}` to learn the state (S13).
- Signature: header `x-signature` with `ts` and `v1`, plus `x-request-id`; `v1` is an HMAC-SHA256 over a manifest built from `data.id`, `x-request-id` and `ts`, keyed with the application's secret (S13). Not verifiable offline; PandaPayLens never verifies it and treats both headers as sensitive.
- Delivery: the receiver must answer 200 or 201 within 22 seconds; otherwise Mercado Pago retries every 15 minutes, then at longer intervals after the third attempt, and keeps trying (S13). Fraud alert notifications are not retried (S15).
- Test payments made with test credentials do not send notifications (S13).
- Duplicate delivery: implied by the retry policy. A delivery or idempotency key for `payment` notifications is NOT DOCUMENTED. Only the Card Updater example (S15) describes its `id` as preventing duplicates. The adapter sets no delivery key and relies on identical content.
- Ordering: NOT DOCUMENTED.

Other topics (S13, S15): `order`/`orders`, `subscription_authorized_payment`, `subscription_preapproval`, `subscription_preapproval_plan`, `mp-connect`, `wallet_connect`, `stop_delivery_op_wh` (fraud alert, example with `data.payment_id`), `topic_claims_integration_wh`, `topic_card_id_wh` (Card Updater example with `type` `automatic-payments` and `action` `card.updated`), `topic_merchant_order_wh`, `topic_chargebacks_wh`, `point_integration_wh`.

Chargebacks topic example (S15): `actions` (array, example value `changed_case_status`), `api_version`, `application_id`, `data` with `checkout`, `date_updated`, `id` (chargeback id), `payment_id`, `product_id`, `site_id`, `transaction_intent_id`, then `date_created`, `id`, `live_mode`, `type` `topic_chargebacks_wh`, `user_id`, `version`. The values of `actions` are not enumerated. The adapter reads it as a dispute signal for `data.payment_id` with outcome unknown. The example's chargeback id (217000061307271000) is above 2^53, so JSON parsers lose precision; the adapter drops unsafe integer ids instead of guessing.

### 7.2 IPN (legacy, S14)

- Mercado Pago calls the notification URL with two query parameters, `topic` and `id`, for example `?topic=payment&id=123456789`. `topic` is one of `payment`, `chargebacks`, `merchant_order`, `point_integration_ipn`.
- IPN will be discontinued; the `x-signature` header is sent but cannot be validated (S12, S14).
- Same 22 second timeout and 15 minute retry policy as Webhooks (S14).
- The integrator may add `cliente` to the URL to tell sellers apart (S13, S14), and `source_news=ipn` to receive only Webhooks (S14).

The adapter reads a pasted query string or form body with `topic` and `id` (and optionally `cliente` or `source_news`). Only `topic=payment` is analyzed; the notification carries no status, so the outcome is unknown.

## 8. Identifiers and correlation

- Payment id (`id` on the payment, `payment_id` on refunds and chargeback notifications, `data.id` on `payment` webhooks, `id` on `payment` IPN) links all records of one payment.
- Refund id links records of one refund.
- `external_reference` is set by the merchant and may be reused across attempts; it is shown but never used for correlation.
- Merchant orders can hold several payments; out of scope.

## 9. Structural detection hints

- Payment: `status_detail` and `transaction_amount` together with one of `currency_id`, `payment_type_id`, `date_last_updated` or `collector_id`.
- Refund: `payment_id` and `amount` with `refund_mode`, or with `adjustment_amount` and a `source` array.
- Webhook: `action` (or `actions`), `type`, `api_version`, `live_mode`, `user_id` and a `data` object.
- IPN: a form or query record whose only keys are `topic` and `id` (and the documented optional `cliente` or `source_news`), with a documented topic.
- Error: `status` (number), `error`, `message` and `cause` (array) together.

## 10. Business category

- `payment_facilitator`: in `Aggregator` processing mode the merchant uses Mercado Pago's merchant codes (S1, `processing_mode`).
- `card_processing`: in `Gateway` mode the merchant brings its own merchant code and Mercado Pago processes the card payment (S1); card authorization, capture and 3DS fields are documented (S1, S18).
- Not claimed: `wallet`. Mercado Pago accounts can pay, but the pages read for this note do not describe the account balance as a payment method of the Payments API.
- Merchant sectors: not researched.

## 11. Capability proposal

| Capability       | Proposal | Reason                                                                                                             |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| errorDecoding    | limited  | Rejections decoded from `status_detail`; error bodies only by HTTP status because the code field is not documented |
| paymentResponses | limited  | Payment and refund objects analyzed; Orders API not covered                                                        |
| webhookParsing   | limited  | Payment and chargeback topics only; notifications carry no status                                                  |
| timeline         | limited  | Snapshots only; notifications have no status and ordering is not documented                                        |
| correlation      | limited  | Payment and refund ids only                                                                                        |
| diagnosticRules  | limited  | Generic rules only                                                                                                 |

## 12. Open questions and gaps

- Error body `cause` item fields and the top-level `error` values for the Payments API: NOT DOCUMENTED.
- Mapping of reference error numbers to a body field: NOT DOCUMENTED.
- Meaning of `charged_back` with `settled` or `reimbursed` from the merchant's point of view: not stated.
- Refund status descriptions are copies of payment descriptions.
- Delivery key and ordering for `payment` notifications: NOT DOCUMENTED.
- `transaction_amount` appears as a number in the schema and as a string in an example.
- Some numeric error codes differ between country sites.
