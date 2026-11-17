# Xendit - provider research for the `xendit` adapter

> Scope: PandaPayLens parses pasted Xendit payloads only. It never calls Xendit.
> Everything below comes from Xendit's official documentation (docs.xendit.co) and Xendit's
> archived official API reference (archive.developers.xendit.co). Where the docs are silent, this
> file says **NOT DOCUMENTED**. Category and retry mappings are **PandaPayLens proposals** built
> from the documented descriptions. Xendit publishes no such classification.

---

## 1. Sources

Verification date: **2026-11-17**. All pages were read on that date. The docs.xendit.co pages were
downloaded as Markdown through the site's documentation index (`https://docs.xendit.co/llms.txt`);
the API reference pages embed their OpenAPI 3 definition, which was parsed to list enums, schemas
and error responses. The archived reference was downloaded as HTML.

| #   | URL                                                                         | Used for                                                          |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| X1  | https://docs.xendit.co/apidocs/create-payment-request                       | Payment Request schema, error responses per HTTP status           |
| X2  | https://docs.xendit.co/apidocs/get-payment-request                          | Payment Request statuses, latest_payment, failure_code enum       |
| X3  | https://docs.xendit.co/apidocs/get-payment                                  | Payment schema and statuses                                       |
| X4  | https://docs.xendit.co/apidocs/capture-payment                              | Capture errors (CAPTURE_AMOUNT_EXCEEDED, status errors)           |
| X5  | https://docs.xendit.co/apidocs/cancel-payment-request                       | Cancel errors (INACTIVE_PAYMENT_REQUEST, TEMPORARILY_UNAVAILABLE) |
| X6  | https://docs.xendit.co/apidocs/payment-webhook-notification                 | Payment webhook envelope, events, examples, x-callback-token      |
| X7  | https://docs.xendit.co/apidocs/create-a-refund                              | Refund errors                                                     |
| X8  | https://docs.xendit.co/apidocs/get-a-refund                                 | Refund schema and statuses                                        |
| X9  | https://docs.xendit.co/apidocs/refund-webhook-notification                  | Refund webhook events, schema, example                            |
| X10 | https://docs.xendit.co/apidocs/create-payout-v3                             | Payout schema, payout error responses with messages               |
| X11 | https://docs.xendit.co/apidocs/get-payout-v3-by-id                          | Payout errors                                                     |
| X12 | https://docs.xendit.co/apidocs/cancel-payout                                | Cancel payout errors                                              |
| X13 | https://docs.xendit.co/apidocs/payout-v3-webhook                            | Payout webhook events, status and failure code enums, examples    |
| X14 | https://docs.xendit.co/docs/payout-status-lifecycle                         | Payout status descriptions, failure codes with retry advice       |
| X15 | https://docs.xendit.co/docs/payments-api-webhooks                           | Payments API webhook event table                                  |
| X16 | https://docs.xendit.co/docs/how-payments-api-work                           | Endpoints, request/response example, amounts as decimals          |
| X17 | https://docs.xendit.co/docs/pay-one-off-payment                             | Payment Request status descriptions and webhook per status        |
| X18 | https://docs.xendit.co/docs/reusable-payment-codes                          | ACCEPTING_PAYMENTS, many payments per payment request             |
| X19 | https://docs.xendit.co/docs/authorize-and-capture                           | Manual capture flow, AUTHORIZED                                   |
| X20 | https://docs.xendit.co/docs/refund-payment-request                          | Meaning of refund.succeeded and refund.failed                     |
| X21 | https://docs.xendit.co/docs/cards-card-declines-and-error-codes             | Card network response codes and the Xendit codes they map to      |
| X22 | https://docs.xendit.co/docs/simulate-error-scenarios                        | Error scenario table (embedded, not readable)                     |
| X23 | https://docs.xendit.co/apidocs/webhook-behavior                             | Retry schedule, manual resend                                     |
| X24 | https://docs.xendit.co/docs/handling-webhooks                               | Duplicates, ordering, x-callback-token                            |
| X25 | https://docs.xendit.co/docs/delayed-webhooks                                | Late webhooks, payment after expiry                               |
| X26 | https://docs.xendit.co/docs/migrate-to-payment-session                      | Legacy invoice statuses and events, migration to sessions         |
| X27 | https://docs.xendit.co/docs/payouts-set-up-webhooks                         | Payout webhook setup                                              |
| X28 | https://archive.developers.xendit.co/api-reference/#errors                  | Error format, HTTP codes, idempotency, 500 is indeterminate       |
| X29 | https://archive.developers.xendit.co/api-reference/#webhook                 | Retries, duplicates, webhook-id, ordering, x-callback-token       |
| X30 | https://archive.developers.xendit.co/api-reference/#invoices                | Invoice object, statuses, invoice error codes                     |
| X31 | https://archive.developers.xendit.co/api-reference/#invoice-callback        | Invoice callback fields and examples                              |
| X32 | https://archive.developers.xendit.co/api-reference/#disbursements           | Disbursement object, statuses, failure codes, error codes         |
| X33 | https://archive.developers.xendit.co/api-reference/#disbursement-callback   | Disbursement callback fields and examples                         |
| X34 | https://archive.developers.xendit.co/api-reference/#payment-status-callback | Legacy eWallet failure code table                                 |
| X35 | https://docs.xendit.co/docs/cards-cancel-a-payment                          | Cancelling an authorized payment (void)                           |

---

## 2. API families in scope

| Family                                  | Endpoints                                                                                              | Notes                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Payments API v3                         | `POST /v3/payment_requests`, `GET /v3/payment_requests/{id}`, `GET /v3/payments/{id}`, capture, cancel | Payment Request and Payment objects (X1-X5) |
| Refunds (v3)                            | `POST /v3/refunds`, get, list                                                                          | Refund object (X7, X8)                      |
| Payouts v3                              | `POST /v3/payouts`, `GET /v3/payouts/{id}`, cancel                                                     | Payout object (X10-X13)                     |
| Webhooks v3                             | payment, payment request, refund, payout events                                                        | Common envelope (X6, X9, X13)               |
| Legacy Invoices (`/v2/invoices`)        | create, get, expire, callback                                                                          | Xendit asks merchants to migrate (X26, X30) |
| Legacy Disbursements (`/disbursements`) | create, get, callback                                                                                  | Indonesia (X32)                             |

Out of scope (recognized only when they use the v3 webhook envelope): payment tokens, payment
sessions, subscriptions, disputes, xenPlatform, reports, BI SNAP, legacy per-method APIs
(eWallets, virtual accounts, retail outlets, QR codes, direct debit, credit card charges).

---

## 3. Error response format

- JSON `{ "error_code": "...", "message": "..." }` (X1, X7, X10, X28). Payout validation errors say
  "The errors field contains details" (X10); the legacy reference says the same (X30, X32). The
  shape of `errors` items is **NOT DOCUMENTED**; the adapter only counts them.
- HTTP statuses (X28): 400 bad request, 401 no valid API key, 403 permission, 404 not found, 500
  Xendit error. v3 pages also use 409 (duplicates) and 503 (channel or issuer unavailable).
- Xendit says a 500 result is indeterminate and may have side effects; retrying with a new
  idempotency key is advised against (X28). Content errors (4xx) are cached per idempotency key
  for POST requests (X28).

Documented `error_code` values with paraphrased meaning (full list in `catalog.ts`, each with its
source page):

- Payments v3 (X1, X4, X5): `API_VALIDATION_ERROR`, `INVALID_VALUE_ERROR`, `CARD_EXPIRED`,
  `INVALID_PAYMENT_DETAILS`, `PAYMENT_REQUEST_RATE_LIMITED`, `INVALID_TOKEN`, `SKIP_3DS_FORBIDDEN`,
  `INVALID_MERCHANT_SETTINGS`, `ACCOUNT_ACCESS_BLOCKED`, `DUPLICATE_ERROR`,
  `ACCOUNT_ALREADY_LINKED`, `SERVER_ERROR`, `CHANNEL_UNAVAILABLE`, `ISSUER_UNAVAILABLE`,
  `INVALID_API_KEY`, `DATA_NOT_FOUND`, `INELIGIBLE_TRANSACTION_STATUS`, `TEMPORARILY_UNAVAILABLE`,
  `INACTIVE_PAYMENT_REQUEST`, `CAPTURE_AMOUNT_EXCEEDED`.
- Refunds (X7): `REFUND_NOT_SUPPORTED`, `PARTIAL_REFUND_NOT_SUPPORTED`, `INELIGIBLE_TRANSACTION`,
  `REFUND_TEMPORARILY_UNAVAILABLE`, `REFUND_IN_PROGRESS`, `REFUND_AMOUNT_EXCEEDED`,
  `PARTIAL_REFUND_COUNTS_EXCEEDED`, `MAXIMUM_REFUND_TRANSACTION_REACHED`,
  `MAXIMUM_REFUND_AMOUNT_REACHED`, `INSUFFICIENT_BALANCE` (merchant balance).
- Payouts (X10-X12): `REQUEST_FORBIDDEN_ERROR`, `INVALID_QUOTE`, `CANCELLATION_NOT_ALLOWED` and
  `CONVERSION_TRADE_NOT_YET_CANCELLABLE` (the last two: listed without a description).
- Legacy invoices and disbursements (X30, X32): `INVALID_JSON_FORMAT`,
  `NO_COLLECTION_METHODS_ERROR`, `UNAVAILABLE_PAYMENT_METHOD_ERROR`, `INVOICE_NOT_FOUND_ERROR`,
  `DISBURSEMENT_DESCRIPTION_NOT_FOUND_ERROR`, `DIRECT_DISBURSEMENT_BALANCE_INSUFFICIENT_ERROR`,
  `DUPLICATE_TRANSACTION_ERROR`, `BANK_CODE_NOT_SUPPORTED_ERROR`, `RECIPIENT_ACCOUNT_NUMBER_ERROR`,
  `RECIPIENT_AMOUNT_ERROR`, `MAXIMUM_TRANSFER_LIMIT_ERROR`, `INVALID_DESTINATION`,
  `DIRECT_DISBURSEMENT_NOT_FOUND_ERROR`. Not implemented: invoice codes about virtual account
  ranges, retail outlet codes, reminders and installments (out of scope).

Documentation conflicts:

- The Create Disbursement error example shows `BANK_CODE_NOT_SUPPORTED`, while its error table
  lists `BANK_CODE_NOT_SUPPORTED_ERROR` (X32). Both are accepted; the example spelling with
  possible confidence.

---

## 4. Payment lifecycle (Payments API v3)

Amounts: `request_amount`, `capture_amount` and refund `amount` are JSON numbers in major units
(the documented example has `10000.01`, X16). They are converted with the currency's ISO 4217
exponent.

Payment Request `status` (enum X2, meanings X17, X18):

| Status               | Meaning (paraphrased)                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `REQUIRES_ACTION`    | End user must complete `actions` (redirect, present code, OTP)           |
| `PENDING`            | Partner has not answered yet; wait for the webhook                       |
| `ACCEPTING_PAYMENTS` | Reusable payment code ready for many payments, each a `payment.capture`  |
| `AUTHORIZED`         | Authorized, waiting for capture (meaning from X19; not in the X17 table) |
| `SUCCEEDED`          | Payment completed; `payment.capture` is sent                             |
| `FAILED`             | Payment failed; `payment.failure` is sent (not by every method)          |
| `CANCELED`           | Cancelled by the merchant; actions can no longer be completed            |
| `EXPIRED`            | Expired by the partner's expiry or the requested expiry date             |

Payment `status` (enum X3): `PENDING`, `AUTHORIZED`, `SUCCEEDED`, `FAILED`, `CANCELED`, `EXPIRED`.
Meanings are taken from the webhook event table (X15): capture = collected and confirmed,
authorization = reserved on the end user's account, expiry = a successful authorization expired,
failure = not collected. `CANCELED` on a payment: the cancel guide (X35) describes cancelling an
authorized, uncaptured payment as a void that releases the hold on the funds; it is shown as a
void. Settlement is a separate concept (X26 for invoices); a `SUCCEEDED` payment is not shown as
settled.

Documentation conflict: the one-off payment guide (X17) describes a Payment Request `PENDING`
status, but the Payment Request status enum (X2) does not list it (the Payment enum does). It is
accepted with the guide's meaning.

Payment `failure_code` (enum X2, X3) values are documented **as names only**. The page meant to
describe them (X22) embeds a table that could not be read without a browser. Meanings used, all at
`possible` confidence:

- names that also exist as v3 API errors with a description (X1, X4): `CHANNEL_UNAVAILABLE`,
  `ISSUER_UNAVAILABLE`, `INVALID_TOKEN`, `ACCOUNT_ACCESS_BLOCKED`, `INVALID_MERCHANT_SETTINGS`,
  `CAPTURE_AMOUNT_EXCEEDED`, `SERVER_ERROR`;
- names in the legacy eWallet failure table (X34): `ACCOUNT_ACCESS_BLOCKED`,
  `INVALID_MERCHANT_CREDENTIALS`, `USER_DECLINED_PAYMENT`, `INVALID_ACCOUNT_DETAILS`,
  `CHANNEL_UNAVAILABLE`, `INSUFFICIENT_BALANCE`, `ACCOUNT_NOT_ACTIVATED`, `INVALID_TOKEN`,
  `FAILURE_DETAILS_UNAVAILABLE`;
- names that card network response codes map to (X21): `DECLINED_BY_ISSUER`, `STOLEN_CARD`,
  `INACTIVE_OR_UNAUTHORIZED_CARD`, `EXPIRED_CARD`, `INSUFFICIENT_BALANCE`, `INVALID_CVV`,
  `PROCESSOR_ERROR`, `DECLINED_BY_PROCESSOR`, `CARD_DECLINED`, `ISSUER_UNAVAILABLE`,
  `AUTHENTICATION_FAILED`.

**NOT DOCUMENTED** (shown as unknown, insufficient confidence): `PAYMENT_ATTEMPT_COUNTS_EXCEEDED`,
`USER_DEVICE_UNREACHABLE`, `PARTNER_TIMEOUT_ERROR`, `TIMEOUT_ERROR`, `USER_DID_NOT_AUTHORIZE`,
`PAYMENT_REQUEST_EXPIRED`, `EXPIRED_OTP`, `INVALID_OTP`, `PAYMENT_AMOUNT_LIMITS_EXCEEDED`,
`OTP_ATTEMPT_COUNTS_EXCEEDED`, `SUSPECTED_FRAUDULENT`. The enum lists `CAPTURE_AMOUNT_EXCEEDED`
with a trailing space; codes are trimmed before lookup.

Card details: `payment_details.authorization_data` has `network_response_code`,
`network_response_code_descriptor`, `cvn_verification_result` and `address_verification_result`
(X6). The card declines guide (X21) uses other names (`card_network_response_code`,
`card_network_descriptor`, `merchant_advice_code`). Only the schema names are read; network
codes are shown, not decoded. X21 also maps some network codes to names that are not in the
failure_code enum (`PARTIAL_APPROVAL`, `INVALID_CARD`, `ISSUER_SUSPECT_FRAUD`, `PROCESS_ERROR`).

## 5. Refunds

Refund `status` (X8, X9): `PENDING` (processing), `SUCCEEDED`, `FAILED` (see `failure_code`).
`refund.succeeded` means Xendit processed the refund and sent it to the channel; Xendit says it
does not guarantee the money reached the end user (X20). Refund `failure_code` is
"channel-specific" with no list: **NOT DOCUMENTED**. `reason` values: `FRAUDULENT`, `DUPLICATE`,
`REQUESTED_BY_CUSTOMER`, `CANCELLATION`, `OTHERS`.

## 6. Payouts v3

Amounts `source_amount` and `destination_amount` are described as minor units with "most
currencies have 2 decimals, others have 0" and the examples "PHP 10.00 -> 1000, IDR 10 -> 10"
(X10, X13). ISO 4217 gives IDR 2 decimals, and the cross-border example pairs IDR 1000000 with USD 63. The exponent per currency is therefore **NOT DOCUMENTED** reliably; amounts are shown as sent.

Statuses: the lifecycle page (X14) describes `ACCEPTED`, `PENDING_COMPLIANCE_ASSESSMENT`,
`COMPLIANCE_REJECTED`, `REQUESTED`, `FAILED`, `SUCCEEDED`, `CANCELLED`, `REVERSED` (a succeeded
payout rejected later by the processor). The schema enum (X13) instead lists `REJECTED`,
`ROUTING`, `READY`, `LOCKED`, `EXPIRED` in addition and omits `COMPLIANCE_REJECTED`. The extra
enum values have no description: **NOT DOCUMENTED**, shown as unknown.

Failure codes with description and retry advice (X14): `INSUFFICIENT_BALANCE` (retry after top
up), `INVALID_DESTINATION`, `DESTINATION_MAXIMUM_LIMIT`, `ACCOUNT_NAME_MISMATCH` (do not retry
as is), `REJECTED_BY_CHANNEL` (retry after validating the account), `TEMPORARY_TRANSFER_ERROR`
(retry in 1-3 hours), `TRANSFER_ERROR` (do not retry). `SLS_SENDER` and `SLS_RECIPIENT` are
enum-only: **NOT DOCUMENTED**.

## 7. Legacy invoices and disbursements

Invoice (X30, X31): `id` (Xendit), `external_id` (merchant), `user_id` (business), `status`
`PENDING`, `PAID`, `SETTLED` (paid amount settled to the cash balance), `EXPIRED`; `amount`,
`paid_amount` as numbers, optional `currency`, `paid_at`, `payment_method`, `payment_channel`,
`bank_code`, `ewallet_type`; the invoice object returned by create and get also has
`invoice_url` (hosted page) and `expiry_date`. Callbacks are sent for paid and (when enabled)
expired invoices.
Sensitive fields: `payer_email`, `payment_destination` (virtual account number or payment
code), `customer`, `items`.

Disbursement (X32, X33): `id`, `external_id`, `user_id`, `bank_code`, `account_holder_name`,
`account_number`, `amount` (number, no currency field), `disbursement_description`, `status`
`PENDING`, `COMPLETED`, `FAILED`, `failure_code`, `is_instant`. Failure codes with description:
`INSUFFICIENT_BALANCE`, `UNKNOWN_BANK_NETWORK_ERROR` (outcome of a retry unpredictable),
`TEMPORARY_BANK_NETWORK_ERROR` (retry in 1-3 hours), `INVALID_DESTINATION`,
`SWITCHING_NETWORK_ERROR` (retry in 1-3 hours), `REJECTED_BY_BANK` (unclear reason),
`TRANSFER_ERROR` (fatal, contact support), `TEMPORARY_TRANSFER_ERROR` (retry in 1-2 hours).

## 8. Webhooks

Envelope (X6, X9, X13): `{ event, business_id, created, data }`; refunds add `api_version: "v3"`.
There is no event id in the body.

| Event                                                | Object          | Source                                 |
| ---------------------------------------------------- | --------------- | -------------------------------------- |
| `payment.capture`                                    | Payment         | X6 (schema and example), X15           |
| `payment.authorization`                              | Payment         | X6, X15                                |
| `payment.failure`                                    | Payment         | X6, X15                                |
| `payment.expiry`                                     | Payment         | X15 only, no payload example           |
| `payment_request.expiry`                             | Payment Request | X15 only, no payload example           |
| `refund.succeeded`, `refund.failed`                  | Refund          | X9, X15                                |
| `v3_payout.succeeded`, `v3_payout.failed`            | Payout          | X13 (examples)                         |
| `v3_payout.reversed`                                 | Payout          | X13 enum; meaning from REVERSED in X14 |
| `v3_payout.rejected`, `v3_payout.pending_compliance` | Payout          | X13 enum only: NOT DOCUMENTED          |
| `payment_token.*`                                    | Payment Token   | X15; out of scope                      |

The migration guide (X26) names `payment.succeeded`, which the webhook schema does not list; it is
treated as an unknown event.

Delivery (X23, X24, X29):

- Retries up to six times with exponential back-off (15 minutes to 24 hours) until a 2xx answer;
  manual and batch resend from the dashboard.
- Duplicates are documented; Xendit names `payment_id` and `capture_id` to identify payment
  events, and the legacy reference documents a unique `webhook-id` header on every webhook.
- Order is not guaranteed.
- Late webhooks are documented, including a payment that arrives after its payment request expired
  (X25).
- Authenticity: the `x-callback-token` header carries a static token from the dashboard. It cannot
  be verified from pasted data and is treated as sensitive.

## 9. Identifiers and correlation

- `payment_id` (`py-...`) identifies one payment; `capture_id` one capture.
- `payment_request_id` (`pr-...`) links a payment request to its payments, except for
  `REUSABLE_PAYMENT_CODE` requests, which receive many payments (X18).
- `refund_id` (`rfd-...`) with `payment_id` of the refunded payment.
- `payout_id` (`po-...`); legacy invoice and disbursement `id`.
- `reference_id` and `external_id` are merchant references and are not used for correlation.

## 10. Sensitive fields

Card details and cardholder data in `channel_properties`, 3DS authentication data
(`authentication_value`), `payer_name`, `payer_account_number`, `receipt_id`, `remark`,
`retrieval_reference_number`, `customer_id`, `metadata`, `actions[].value` (URLs, virtual account
numbers, payment codes, QR strings), payout `sender` and `recipient` (names, addresses, phone
numbers, account numbers), legacy `payer_email`, `payment_destination`, `account_holder_name`,
`account_number`, and the `x-callback-token` header.

## 11. Detection hints

- Error: only the keys `error_code` (UPPER_SNAKE), `message` and optional `errors`.
- Webhook: `event`, `business_id`, `created` and `data` together.
- Objects: `payment_id`, `payment_request_id`, `refund_id` with `payment_id`, or `payout_id`,
  each with a documented status and object-specific fields.
- Legacy: `id`, `external_id`, `user_id` with invoice fields (`merchant_name`, `is_high`) or
  disbursement fields (`bank_code`, `disbursement_description`).

## 12. Capability proposal

All capabilities `limited`: payment failure codes are names only, payout status lists conflict,
payout amounts cannot be converted reliably, webhook bodies have no event id, and two events have
no payload example.
