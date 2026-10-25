# Square - provider research for the `square` adapter

> Scope: PandaPayLens parses pasted Square payloads only. It never calls Square.
> Everything below comes from Square's official developer documentation (developer.squareup.com).
> Where the docs are silent, this file says **NOT DOCUMENTED**. Category and retry-class mappings
> are **PandaPayLens proposals** built from the documented descriptions. Square does not publish
> such a classification.

---

## 1. Sources

Verification date: **2026-10-25**. All pages were read on that date with WebFetch and/or a raw HTML download. Every JSON example below was extracted from the raw page HTML, not retyped.

| #   | URL                                                                                          | Used for                                                      |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| S1  | https://developer.squareup.com/reference/square/enums/ErrorCode                              | Full ErrorCode enum and descriptions                          |
| S2  | https://developer.squareup.com/reference/square/enums/ErrorCategory                          | ErrorCategory enum                                            |
| S3  | https://developer.squareup.com/reference/square/objects/Error                                | Error object fields                                           |
| S4  | https://developer.squareup.com/docs/payments-api/error-codes                                 | Payments error codes guide, gift-card examples                |
| S5  | https://developer.squareup.com/docs/build-basics/handling-errors                             | Error envelope, HTTP status ranges, 401/403/429               |
| S6  | https://developer.squareup.com/reference/square/payments-api/create-payment                  | CreatePayment endpoint, per-HTTP-status error codes, examples |
| S7  | https://developer.squareup.com/reference/square/objects/CreatePaymentResponse                | `payment` may be present with FAILED on error                 |
| S8  | https://developer.squareup.com/reference/square/objects/Payment                              | Payment object fields                                         |
| S9  | https://developer.squareup.com/reference/square/objects/CardPaymentDetails                   | card_details fields and status values                         |
| S10 | https://developer.squareup.com/reference/square/objects/CardPaymentTimeline                  | authorized_at / captured_at / voided_at                       |
| S11 | https://developer.squareup.com/reference/square/objects/Card                                 | Card fields (fingerprint, bin, last_4, ...)                   |
| S12 | https://developer.squareup.com/docs/payments-api/take-payments                               | Payment status meanings                                       |
| S13 | https://developer.squareup.com/docs/payments-api/take-payments/card-payments                 | Card payment status meanings                                  |
| S14 | https://developer.squareup.com/docs/payments-api/take-payments/card-payments/delayed-capture | delay_action, delay_duration, terminal states                 |
| S15 | https://developer.squareup.com/docs/payments-api/take-payments/ach-payments                  | PENDING semantics for ACH                                     |
| S16 | https://developer.squareup.com/docs/devtools/sandbox/payments                                | Sandbox test values, PENDING to FAILED                        |
| S17 | https://developer.squareup.com/reference/square/objects/PaymentRefund                        | PaymentRefund fields and statuses                             |
| S18 | https://developer.squareup.com/reference/square/refunds-api/refund-payment                   | RefundPayment endpoint, error codes, examples                 |
| S19 | https://developer.squareup.com/reference/square/objects/RefundPaymentResponse                | `refund` may be present with FAILED on error                  |
| S20 | https://developer.squareup.com/docs/payments-api/refund-payments                             | Refund status meanings                                        |
| S21 | https://developer.squareup.com/reference/square/payments-api/webhooks/payment.created        | payment.created example                                       |
| S22 | https://developer.squareup.com/reference/square/payments-api/webhooks/payment.updated        | payment.updated example                                       |
| S23 | https://developer.squareup.com/reference/square/refunds-api/webhooks/refund.created          | refund.created example                                        |
| S24 | https://developer.squareup.com/reference/square/refunds-api/webhooks/refund.updated          | refund.updated example                                        |
| S25 | https://developer.squareup.com/reference/square/payments-api/webhooks                        | Payments webhook list                                         |
| S26 | https://developer.squareup.com/docs/webhooks/overview                                        | Duplicates, ordering, retries, IPs                            |
| S27 | https://developer.squareup.com/docs/webhooks/step2subscribe                                  | Event notification format and headers                         |
| S28 | https://developer.squareup.com/docs/webhooks/step3validate                                   | Signature validation                                          |
| S29 | https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref                       | Webhook events reference                                      |
| S30 | https://developer.squareup.com/docs/build-basics/versioning-overview                         | Square-Version header                                         |
| S31 | https://developer.squareup.com/docs/build-basics/common-api-patterns/idempotency             | Idempotency semantics                                         |

---

## 2. API families and versions

| Family                   | Endpoints relevant to parsing                                                      | Notes                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Payments API** (v2)    | `POST /v2/payments` (CreatePayment), plus Get/Update/Cancel/Complete/List Payments | Returns `{ "payment": {...} }` or `{ "errors": [...] }` (S6) |
| **Refunds API** (v2)     | `POST /v2/refunds` (RefundPayment), GetPaymentRefund, ListPaymentRefunds           | Returns `{ "refund": {...} }` or `{ "errors": [...] }` (S18) |
| **Webhooks** (v2 events) | `payment.created`, `payment.updated`, `refund.created`, `refund.updated`           | Common envelope (S27)                                        |

- Base URL in the reference examples: `https://connect.squareup.com/v2/...` (S18).
- **Square-Version header**: version names use the `YYYY-MM-DD` scheme. Each application has a default API version pinned in the Developer Console. A request can override it with the `Square-Version` header. "the response always returns the Square-Version header so you know which API version is used" (S30). The reference pages show `Square-Version: 2026-09-16` on 2026-10-25 (S6, S18, S22).
- Webhook subscriptions are tied to an API version chosen at subscription time (S27).
- The `/v2/` prefix is not the version. The version is carried only in the header. Legacy "v1" applications and tokens are flagged by `V1_APPLICATION` / `V1_ACCESS_TOKEN` (S1).

**First target:** Payments API v2 error responses (`errors[]`) and Payment objects. Webhook envelopes for `payment.*` / `refund.*` come next, because they reuse the same Payment/PaymentRefund objects.

---

## 3. Error response format

### 3.1 Envelope

- A failed request returns HTTP 400-599. The body has an `errors` array with one `Error` object per error. When there are several errors, the HTTP status matches the first one. A retried request can return a different error. `Bulk` endpoints may return per-operation `errors` inside a 200 response (S5).
- **Error object** (S3):

| Field      | Type                   | Required | Meaning                                                                            |
| ---------- | ---------------------- | -------- | ---------------------------------------------------------------------------------- |
| `category` | string (ErrorCategory) | yes      | "The high-level category for the error."                                           |
| `code`     | string (ErrorCode)     | yes      | "The specific code of the error."                                                  |
| `detail`   | string                 | no       | Human-readable description for debugging (S5: developer-facing, not for customers) |
| `field`    | string                 | no       | Name of the request field the error pertains to, if any                            |

- **CreatePaymentResponse** (S7): it has `errors` and `payment`. When there are errors, "the `payment` field might not be present, or it might be present with a status of `FAILED`." A parser must accept `{errors:[...], payment:{status:"FAILED", ...}}`.
- **RefundPaymentResponse** (S19): "If there are errors processing the request, the refund field might not be present, or it might be present with a status of FAILED."
- `CardPaymentDetails.errors` (Error[]) can also carry errors inside a Payment object (S9).
- **No full JSON example of an error response that also carries a `payment` object is shown on the pages read: NOT DOCUMENTED (example).** Only the rule in S7 is documented.

### 3.2 HTTP statuses

From S6 (CreatePayment) and S5:

| HTTP | Codes documented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | ADDRESS_VERIFICATION_FAILURE, APPLE_TTP_PIN_TOKEN, CARDHOLDER_INSUFFICIENT_PERMISSIONS, CARD_EXPIRED, CARD_NOT_SUPPORTED, CARD_TOKEN_EXPIRED, CARD_TOKEN_USED, CVV_FAILURE, EXPIRATION_FAILURE, GENERIC_DECLINE, GIFT_CARD_AVAILABLE_AMOUNT, INSUFFICIENT_FUNDS, INSUFFICIENT_PERMISSIONS, INVALID_ACCOUNT, INVALID_CARD, INVALID_CARD_DATA, INVALID_EMAIL_ADDRESS, INVALID_EXPIRATION, INVALID_FEES, INVALID_LOCATION, INVALID_PHONE_NUMBER, INVALID_PIN, INVALID_POSTAL_CODE, MANUALLY_ENTERED_PAYMENT_NOT_SUPPORTED, PAN_FAILURE, PAYMENT_AMOUNT_MISMATCH, PAYMENT_LIMIT_EXCEEDED, PAYMENT_SOURCE_NOT_ENABLED_FOR_TARGET, TRANSACTION_LIMIT, VOICE_FAILURE |
| 402  | ALLOWABLE_PIN_TRIES_EXCEEDED, BAD_EXPIRATION, CARD_DECLINED_VERIFICATION_REQUIRED, CHIP_INSERTION_REQUIRED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 401  | UNAUTHORIZED, ACCESS_TOKEN_EXPIRED, ACCESS_TOKEN_REVOKED, CLIENT_DISABLED (S5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 403  | CARD_PROCESSING_NOT_ENABLED (S6); FORBIDDEN, INSUFFICIENT_SCOPES (S5). Some INVALID_REQUEST_ERROR codes also return 403 (S5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 429  | RATE_LIMITED (S5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 503  | TEMPORARY_ERROR (S6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

RefundPayment (S18) lists all of its documented errors under **400**. These are CARD_MISMATCH, CARD_PRESENCE_REQUIRED, CARD_TOKEN_EXPIRED, CARD_TOKEN_USED, GENERIC_DECLINE, INSUFFICIENT_PERMISSIONS_FOR_REFUND, INVALID_CARD, INVALID_CARD_DATA, INVALID_FEES, PAYMENT_NOT_REFUNDABLE, PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE, REFUND_AMOUNT_INVALID, REFUND_DECLINED, REFUND_ERROR_PAYMENT_NEEDS_COMPLETION, UNSUPPORTED_CARD_BRAND, UNSUPPORTED_COUNTRY, UNSUPPORTED_CURRENCY, UNSUPPORTED_INSTRUMENT_TYPE, UNSUPPORTED_SOURCE_TYPE. Inconsistency: S20 says PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE returns a "404 ... bad request error". Do not rely on the HTTP status for classification.

HTTP status for most other codes (e.g. INTERNAL_SERVER_ERROR, SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT, IDEMPOTENCY_KEY_REUSED): **NOT DOCUMENTED** per code. Their names imply 500/503/504, but that is not confirmed.

### 3.3 Verbatim examples

**Example A: CreatePayment 400** (source S6):

```json
{
  "errors": [
    {
      "code": "ADDRESS_VERIFICATION_FAILURE",
      "category": "PAYMENT_METHOD_ERROR"
    }
  ]
}
```

**Example B: gift card insufficient funds, two errors** (source S4):

```json
{
  "errors": [
    {
      "code": "INSUFFICIENT_FUNDS",
      "detail": "Gift card does not have sufficient balance for requested amount.",
      "category": "PAYMENT_METHOD_ERROR"
    },
    {
      "code": "GIFT_CARD_AVAILABLE_AMOUNT",
      "detail": "4494",
      "category": "PAYMENT_METHOD_ERROR"
    }
  ]
}
```

Here `detail` of GIFT_CARD_AVAILABLE_AMOUNT is the remaining balance in the smallest currency unit (S4). It is a number carried as a string, not prose.

Other documented examples:

- S4 overview: `{"errors":[{"code":"INSUFFICIENT_FUNDS","detail":"Authorization error: 'INSUFFICIENT_FUNDS'","category":"PAYMENT_METHOD_ERROR"}]}`
- S5: `{"errors":[{"category":"AUTHENTICATION_ERROR","code":"UNAUTHORIZED","detail":"This request could not be authorized."}]}`
- S18 (RefundPayment 400): `{"errors":[{"code":"CARD_MISMATCH","category":"REFUND_ERROR"}]}`

### 3.4 Payment object (S8)

| Field                                                                                                                                                           | Type                       | Notes                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                                                                                                                                            | string                     | Unique payment ID                                                                   |
| `created_at`, `updated_at`                                                                                                                                      | string                     | RFC 3339                                                                            |
| `amount_money`                                                                                                                                                  | Money `{amount, currency}` | Amount excluding tip. `amount` is in the smallest currency unit (integer).          |
| `tip_money`, `total_money`, `approved_money`, `refunded_money`, `app_fee_money`                                                                                 | Money                      | `total_money` = amount + tip. `approved_money` may change on reauthorization.       |
| `app_fee_allocations`                                                                                                                                           | array                      | App fee recipients                                                                  |
| `processing_fee`                                                                                                                                                | ProcessingFee[]            | Fees Square assessed                                                                |
| `status`                                                                                                                                                        | string                     | APPROVED, PENDING, COMPLETED, CANCELED, FAILED                                      |
| `delay_duration`                                                                                                                                                | string                     | RFC 3339 duration. Defaults: PT36H card-present, P7D card-not-present. Card only.   |
| `delay_action`                                                                                                                                                  | string                     | CANCEL or COMPLETE                                                                  |
| `delayed_until`                                                                                                                                                 | string                     | `created_at` + `delay_duration`                                                     |
| `source_type`                                                                                                                                                   | string                     | CARD, BANK_ACCOUNT, WALLET, BUY_NOW_PAY_LATER, SQUARE_ACCOUNT, CASH, EXTERNAL       |
| `card_details`                                                                                                                                                  | CardPaymentDetails         | Only when source_type = CARD                                                        |
| `cash_details`, `bank_account_details`, `external_details`, `wallet_details`, `buy_now_pay_later_details`, `square_account_details`, `electronic_money_details` | objects                    | Per source_type                                                                     |
| `location_id`, `order_id`, `customer_id`, `team_member_id`, `employee_id` (deprecated), `terminal_checkout_id`                                                  | string                     | Linked IDs                                                                          |
| `reference_id`                                                                                                                                                  | string                     | Caller-supplied external reference, max 40 characters                               |
| `refund_ids`                                                                                                                                                    | string[]                   | Refunds for this payment                                                            |
| `risk_evaluation`                                                                                                                                               | RiskEvaluation             | `{created_at, risk_level}` (NORMAL/MODERATE/HIGH seen in S16)                       |
| `buyer_email_address`, `billing_address`, `shipping_address`, `note`                                                                                            |                            | PII (see section 8)                                                                 |
| `statement_description_identifier`, `receipt_number`, `receipt_url`                                                                                             | string                     | `receipt_url` appears only when COMPLETED. `receipt_number` is missing if CANCELED. |
| `capabilities`                                                                                                                                                  | string[]                   | EDIT_AMOUNT_UP/DOWN, EDIT_TIP_AMOUNT_UP/DOWN, EDIT_DELAY_ACTION                     |
| `device_details`, `application_details`                                                                                                                         | objects                    | `application_details.square_product`, `application_id`                              |
| `buyer_currency_exchange`, `is_offline_payment`, `offline_payment_details`                                                                                      |                            |                                                                                     |
| `version_token`                                                                                                                                                 | string                     | Optimistic concurrency token                                                        |

**CardPaymentDetails** (S9): `status` (AUTHORIZED, CAPTURED, VOIDED, FAILED), `card` (Card), `entry_method` (KEYED, SWIPED, EMV, ON_FILE, CONTACTLESS), `cvv_status` (CVV_ACCEPTED, CVV_REJECTED, CVV_NOT_CHECKED), `avs_status` (AVS_ACCEPTED, AVS_REJECTED, AVS_NOT_CHECKED), `auth_result_code`, `application_identifier`, `application_name`, `application_cryptogram`, `verification_method`, `verification_results`, `statement_description`, `device_details` (deprecated), `card_payment_timeline` {`authorized_at`, `captured_at`, `voided_at`} (S10), `refund_requires_card_presence`, **`errors` (Error[])**, `applied_card_surcharge_details`, `wallet_type`.

**Card** (S11), relevant fields: `card_brand`, `last_4`, `exp_month`, `exp_year`, `cardholder_name`, `billing_address`, `fingerprint`, `card_type`, `prepaid_type`, `bin` (first six digits), `customer_id`, `merchant_id`, `reference_id`.

Successful CreatePayment example (S6), verbatim:

```json
{
  "payment": {
    "id": "R2B3Z8WMVt3EAmzYWLZvz7Y69EbZY",
    "created_at": "2021-10-13T21:14:29.577Z",
    "updated_at": "2021-10-13T21:14:30.504Z",
    "amount_money": {
      "amount": 1000,
      "currency": "USD"
    },
    "app_fee_money": {
      "amount": 10,
      "currency": "USD"
    },
    "status": "COMPLETED",
    "delay_duration": "PT168H",
    "source_type": "CARD",
    "card_details": {
      "status": "CAPTURED",
      "card": {
        "card_brand": "VISA",
        "last_4": "1111",
        "exp_month": 11,
        "exp_year": 2022,
        "fingerprint": "sq-1-Hxim77tbdcbGejOejnoAklBVJed2YFLTmirfl8Q5XZzObTc8qY_U8RkwzoNL8dCEcQ",
        "card_type": "DEBIT",
        "prepaid_type": "NOT_PREPAID",
        "bin": "411111"
      },
      "entry_method": "ON_FILE",
      "cvv_status": "CVV_ACCEPTED",
      "avs_status": "AVS_ACCEPTED",
      "auth_result_code": "vNEn2f",
      "statement_description": "SQ *EXAMPLE TEST GOSQ.C",
      "card_payment_timeline": {
        "authorized_at": "2021-10-13T21:14:29.732Z",
        "captured_at": "2021-10-13T21:14:30.504Z"
      }
    },
    "location_id": "L88917AVBK2S5",
    "order_id": "pRsjRTgFWATl7so6DxdKBJa7ssbZY",
    "reference_id": "123456",
    "risk_evaluation": {
      "created_at": "2021-10-13T21:14:30.423Z",
      "risk_level": "NORMAL"
    },
    "note": "Brief Description",
    "customer_id": "W92WH6P11H4Z77CTET0RNTGFW8",
    "total_money": {
      "amount": 1000,
      "currency": "USD"
    },
    "approved_money": {
      "amount": 1000,
      "currency": "USD"
    },
    "receipt_number": "R2B3",
    "receipt_url": "https://squareup.com/receipt/preview/EXAMPLE_RECEIPT_ID",
    "delay_action": "CANCEL",
    "delayed_until": "2021-10-20T21:14:29.577Z",
    "application_details": {
      "square_product": "ECOMMERCE_API",
      "application_id": "sq0ids-TcgftTEtKxJTRF1lCFJ9TA"
    },
    "version_token": "TPtNEOBOa6Qq6E3C3IjckSVOM6b3hMbfhjvTxHBQUsB6o"
  }
}
```

---

## 4. Codes

### 4.1 ErrorCategory (S2)

| Value                                | Square meaning (paraphrased)                                                                | Proposed PandaPayLens category (fallback when `code` is unknown) |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `API_ERROR`                          | An error in the Square API itself                                                           | provider_unavailable                                             |
| `AUTHENTICATION_ERROR`               | Authentication problem. Most often a missing, malformed or invalid `Authorization` header.  | configuration                                                    |
| `INVALID_REQUEST_ERROR`              | Invalid request, e.g. a required parameter missing or a value invalid                       | invalid_request                                                  |
| `RATE_LIMIT_ERROR`                   | The app hit the Square API rate limit. Watch for 429 RATE_LIMITED and back off with jitter. | rate_limiting                                                    |
| `PAYMENT_METHOD_ERROR`               | Problem processing the payment method, e.g. an invalid CVV or expiration                    | card_declined                                                    |
| `REFUND_ERROR`                       | Problem processing a refund                                                                 | unknown (resolve by code)                                        |
| `MERCHANT_SUBSCRIPTION_ERROR` (Beta) | Problem checking a merchant subscription status                                             | configuration                                                    |
| `EXTERNAL_VENDOR_ERROR`              | Error returned from an external vendor's API (e.g. Plaid)                                   | unknown                                                          |

**Important:** the ErrorCode enum page (S1) does **not** map each code to a category. **Category per code is NOT DOCUMENTED.** It is observed only in examples: ADDRESS_VERIFICATION_FAILURE, INSUFFICIENT_FUNDS and GIFT_CARD_AVAILABLE_AMOUNT go to PAYMENT_METHOD_ERROR; CARD_MISMATCH goes to REFUND_ERROR; UNAUTHORIZED goes to AUTHENTICATION_ERROR. The adapter must read `category` from the payload, not infer it.

### 4.2 Payment-related ErrorCode values (S1, plus HTTP from S6/S5/S18)

Descriptions are short original paraphrases of S1. The Category and Retry columns are PandaPayLens proposals.
Retry classes: DNR = do_not_retry, CAR = customer_action_required, RC = retry_conditionally, SAFE = safe_to_retry_technical_request, MR = manual_review, UNK = unknown.

#### Card / payment-method declines

| Code                                   | HTTP                            | Meaning (paraphrase)                                                                                                     | Category                   | Retry             |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ----------------- |
| GENERIC_DECLINE                        | 400                             | Decline with no further info. The buyer may ask the issuer.                                                              | card_declined              | CAR               |
| CARD_DECLINED                          | NOT DOCUMENTED                  | The card was declined                                                                                                    | card_declined              | CAR               |
| CVV_FAILURE                            | 400                             | Issuer declined: CVV invalid                                                                                             | card_declined              | CAR               |
| ADDRESS_VERIFICATION_FAILURE           | 400                             | Issuer declined: postal code invalid                                                                                     | card_declined              | CAR               |
| VERIFY_CVV_FAILURE                     | NOT DOCUMENTED                  | CVV could not be verified                                                                                                | card_declined              | CAR               |
| VERIFY_AVS_FAILURE                     | NOT DOCUMENTED                  | AVS could not be verified                                                                                                | card_declined              | CAR               |
| INVALID_ACCOUNT                        | 400                             | Issuer could not find the account                                                                                        | card_declined              | CAR               |
| CARD_EXPIRED                           | 400                             | Issuer declined: card expired                                                                                            | card_declined              | CAR               |
| EXPIRATION_FAILURE                     | 400                             | Expiration invalid or card expired                                                                                       | card_declined              | CAR               |
| BAD_EXPIRATION                         | 402                             | Expiration missing or malformed                                                                                          | invalid_request            | CAR               |
| INVALID_EXPIRATION                     | 400                             | Expiration date invalid (e.g. in the past)                                                                               | invalid_request            | CAR               |
| INVALID_EXPIRATION_YEAR                | NOT DOCUMENTED                  | Expiration year invalid                                                                                                  | invalid_request            | CAR               |
| INVALID_EXPIRATION_DATE                | NOT DOCUMENTED                  | Expiration date has invalid characters                                                                                   | invalid_request            | CAR               |
| INSUFFICIENT_FUNDS                     | 400                             | Funding source lacks funds                                                                                               | insufficient_funds         | CAR               |
| GIFT_CARD_AVAILABLE_AMOUNT             | 400                             | Companion to INSUFFICIENT_FUNDS. `detail` = remaining gift card balance (minor units).                                   | insufficient_funds         | CAR               |
| CARD_DECLINED_VERIFICATION_REQUIRED    | 402                             | Declined with a request for extra verification                                                                           | authentication_required    | CAR               |
| APPLE_TTP_PIN_TOKEN                    | 400                             | Apple Tap to Pay decline asking for PIN. Supplemental to CARD_DECLINED_VERIFICATION_REQUIRED, with an issuer token.      | authentication_required    | CAR               |
| CARD_DECLINED_CALL_ISSUER              | NOT DOCUMENTED                  | Declined. The cardholder should call the issuer.                                                                         | card_declined              | CAR               |
| VOICE_FAILURE                          | 400                             | Issuer requires voice authorization from the cardholder                                                                  | card_declined              | CAR               |
| TRANSACTION_LIMIT                      | 400                             | Issuer says the amount is too high or too low (e.g. credit limit)                                                        | card_declined              | CAR               |
| PAN_FAILURE                            | 400                             | Card number invalid (length/format)                                                                                      | invalid_request            | CAR               |
| CARD_NOT_SUPPORTED                     | 400                             | Card not supported in the region or for the MCC                                                                          | payment_method_unavailable | CAR               |
| UNSUPPORTED_CARD_BRAND                 | NOT DOCUMENTED (400 on refunds) | Card issuer not supported                                                                                                | payment_method_unavailable | CAR               |
| UNSUPPORTED_ENTRY_METHOD               | NOT DOCUMENTED                  | Swipe/dip/tap method not supported                                                                                       | payment_method_unavailable | CAR               |
| INVALID_PIN                            | 400                             | Issuer declined: PIN invalid                                                                                             | authentication_failed      | CAR               |
| MISSING_PIN                            | NOT DOCUMENTED                  | Required PIN missing                                                                                                     | authentication_required    | CAR               |
| ALLOWABLE_PIN_TRIES_EXCEEDED           | 402                             | PIN retries exhausted. The cardholder must contact the issuer.                                                           | authentication_failed      | CAR               |
| CHIP_INSERTION_REQUIRED                | 402                             | Issuer requires a chip read                                                                                              | payment_method_unavailable | CAR               |
| MANUALLY_ENTERED_PAYMENT_NOT_SUPPORTED | 400                             | Keyed card numbers declined. The card must be swiped, tapped or dipped.                                                  | payment_method_unavailable | CAR               |
| CARD_PRESENCE_REQUIRED                 | NOT DOCUMENTED (400 on refunds) | Card must be present                                                                                                     | payment_method_unavailable | CAR               |
| READER_DECLINED                        | NOT DOCUMENTED                  | Square Card Reader declined for an unknown reason                                                                        | card_declined              | UNK               |
| CARDHOLDER_INSUFFICIENT_PERMISSIONS    | 400                             | Issuer restriction on where the card can be used                                                                         | card_declined              | CAR               |
| INVALID_CARD                           | 400                             | Card cannot be validated from the details                                                                                | invalid_request            | CAR               |
| INVALID_CARD_DATA                      | 400                             | Card data invalid (generic)                                                                                              | invalid_request            | CAR               |
| INVALID_ENCRYPTED_CARD                 | NOT DOCUMENTED                  | Encrypted card data invalid                                                                                              | invalid_request            | DNR               |
| INVALID_POSTAL_CODE                    | 400                             | Postal code malformed                                                                                                    | invalid_request            | CAR               |
| CURRENCY_MISMATCH                      | NOT DOCUMENTED                  | Payment currency not valid for the funding source                                                                        | invalid_request            | DNR               |
| CARD_TOKEN_EXPIRED                     | 400                             | Card nonce expired                                                                                                       | invalid_request            | CAR (re-tokenize) |
| CARD_TOKEN_USED                        | 400                             | Card nonce already used                                                                                                  | duplicate_request          | DNR               |
| SOURCE_USED                            | NOT DOCUMENTED                  | Source ID already used to create a card                                                                                  | duplicate_request          | DNR               |
| SOURCE_EXPIRED                         | NOT DOCUMENTED                  | Source ID expired                                                                                                        | invalid_request            | CAR               |
| CARD_MISMATCH                          | 400 (refund)                    | Card does not match what is expected                                                                                     | invalid_request            | DNR               |
| AMOUNT_TOO_HIGH                        | NOT DOCUMENTED                  | Amount too high for the source                                                                                           | invalid_amount             | DNR               |
| AMOUNT_TOO_LOW                         | NOT DOCUMENTED                  | Amount too low for the source                                                                                            | invalid_amount             | DNR               |
| PAYMENT_AMOUNT_MISMATCH                | 400                             | Amount differs from what Square expected                                                                                 | invalid_amount             | DNR               |
| PAYMENT_LIMIT_EXCEEDED                 | 400                             | Amount over the merchant's processing limit                                                                              | configuration              | MR                |
| INVALID_FEES                           | 400                             | `app_fee_money` too high                                                                                                 | invalid_amount             | DNR               |
| ACCOUNT_UNUSABLE                       | NOT DOCUMENTED                  | Account cannot transact (ACH)                                                                                            | payment_method_unavailable | CAR               |
| BUYER_REFUSED_PAYMENT                  | NOT DOCUMENTED                  | Bank account rejected or did not authorize the payment                                                                   | card_declined              | CAR               |
| UNSUPPORTED_INSTRUMENT_TYPE            | NOT DOCUMENTED (400 on refunds) | Instrument type unsupported                                                                                              | payment_method_unavailable | DNR               |
| UNSUPPORTED_SOURCE_TYPE                | NOT DOCUMENTED (400 on refunds) | Source type unsupported                                                                                                  | payment_method_unavailable | DNR               |
| CART_INELIGIBLE_FOR_EBT                | NOT DOCUMENTED                  | Cart not eligible for EBT                                                                                                | payment_method_unavailable | CAR               |
| RESERVATION_DECLINED                   | NOT DOCUMENTED                  | S1 text: "The card issuer declined the refund." The wording looks copied from REFUND_DECLINED. The meaning is ambiguous. | card_declined              | UNK               |

#### Merchant / account configuration

| Code                                                     | HTTP                            | Meaning                                                             | Category        | Retry |
| -------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------- | --------------- | ----- |
| INSUFFICIENT_PERMISSIONS                                 | 400                             | Square account not allowed to accept this payment (e.g. gift cards) | configuration   | MR    |
| INVALID_LOCATION                                         | 400                             | Account cannot take payments in that region                         | configuration   | DNR   |
| CARD_PROCESSING_NOT_ENABLED                              | 403                             | Location not enabled for card processing                            | configuration   | MR    |
| PAYMENT_SOURCE_NOT_ENABLED_FOR_TARGET                    | 400                             | Merchant/location not enabled for this source                       | configuration   | MR    |
| UNSUPPORTED_COUNTRY / UNSUPPORTED_CURRENCY               | NOT DOCUMENTED (400 on refunds) | Unsupported country/currency                                        | configuration   | DNR   |
| LOCATION_MISMATCH                                        | NOT DOCUMENTED                  | Location does not match what is expected                            | invalid_request | DNR   |
| MERCHANT_SUBSCRIPTION_NOT_FOUND (Beta)                   | NOT DOCUMENTED                  | Required merchant subscription not found                            | configuration   | MR    |
| SANDBOX_NOT_SUPPORTED                                    | NOT DOCUMENTED                  | Not supported in sandbox                                            | configuration   | DNR   |
| INVALID_SQUARE_VERSION_FORMAT / API_VERSION_INCOMPATIBLE | NOT DOCUMENTED                  | Square-Version header malformed or incompatible                     | configuration   | DNR   |

#### Authentication / authorization (S5 statuses)

| Code                             | HTTP           | Meaning                                     | Category      | Retry              |
| -------------------------------- | -------------- | ------------------------------------------- | ------------- | ------------------ |
| UNAUTHORIZED                     | 401            | General authorization error                 | configuration | DNR                |
| ACCESS_TOKEN_EXPIRED             | 401            | Token expired                               | configuration | RC (after refresh) |
| ACCESS_TOKEN_REVOKED             | 401            | Token revoked                               | configuration | DNR                |
| CLIENT_DISABLED                  | 401            | Client disabled                             | configuration | DNR                |
| FORBIDDEN                        | 403            | General access error                        | configuration | DNR                |
| INSUFFICIENT_SCOPES              | 403            | Token lacks the required permission         | configuration | DNR                |
| APPLICATION_DISABLED             | NOT DOCUMENTED | Application disabled                        | configuration | DNR                |
| V1_APPLICATION / V1_ACCESS_TOKEN | NOT DOCUMENTED | Pre-2016-03-30 app/token not usable with v2 | configuration | DNR                |

Note: PandaPayLens `authentication_failed` / `authentication_required` describe cardholder authentication (PIN, SCA). API credential errors map to `configuration`.

#### Idempotency, rate limit, transport

| Code                   | HTTP           | Meaning                                                                                                                    | Category             | Retry                                              |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| IDEMPOTENCY_KEY_REUSED | NOT DOCUMENTED | Key already used. S31: same key + same request returns the original response; same key + changed request returns an error. | duplicate_request    | DNR                                                |
| RATE_LIMITED           | 429            | Rate limit exceeded                                                                                                        | rate_limiting        | SAFE (backoff + jitter, S2/S5)                     |
| TEMPORARY_ERROR        | 503            | Temporary internal error. "You can safely retry your call using the same idempotency key."                                 | provider_unavailable | SAFE (same idempotency key)                        |
| INTERNAL_SERVER_ERROR  | NOT DOCUMENTED | General server error                                                                                                       | provider_unavailable | RC (same idempotency key)                          |
| SERVICE_UNAVAILABLE    | NOT DOCUMENTED | Service unavailable                                                                                                        | provider_unavailable | RC                                                 |
| BAD_GATEWAY            | NOT DOCUMENTED | Bad gateway                                                                                                                | provider_unavailable | RC                                                 |
| GATEWAY_TIMEOUT        | NOT DOCUMENTED | Gateway timeout                                                                                                            | network_or_timeout   | RC (outcome unknown, so check payment state first) |
| REQUEST_TIMEOUT        | NOT DOCUMENTED | Request timeout                                                                                                            | network_or_timeout   | RC                                                 |
| CONFLICT               | NOT DOCUMENTED | Conflict                                                                                                                   | invalid_request      | MR                                                 |
| NOT_FOUND              | NOT DOCUMENTED | Resource not found                                                                                                         | invalid_request      | DNR                                                |

#### Delayed capture / refunds

| Code                                        | HTTP                    | Meaning                                                | Category          | Retry                 |
| ------------------------------------------- | ----------------------- | ------------------------------------------------------ | ----------------- | --------------------- |
| DELAYED_TRANSACTION_EXPIRED                 | NOT DOCUMENTED          | Update attempted on an expired delayed-capture payment | invalid_request   | DNR                   |
| DELAYED_TRANSACTION_CANCELED                | NOT DOCUMENTED          | Cancel attempted on an already-canceled payment        | duplicate_request | DNR                   |
| DELAYED_TRANSACTION_CAPTURED                | NOT DOCUMENTED          | Capture attempted on an already-captured payment       | duplicate_request | DNR                   |
| DELAYED_TRANSACTION_FAILED                  | NOT DOCUMENTED          | Update attempted on a failed delayed-capture payment   | invalid_request   | DNR                   |
| PARTIAL_PAYMENT_DELAY_CAPTURE_NOT_SUPPORTED | NOT DOCUMENTED          | Delayed capture of a partial payment not supported     | invalid_request   | DNR                   |
| REFUND_AMOUNT_INVALID                       | 400                     | Refund exceeds the refundable amount                   | invalid_amount    | DNR                   |
| REFUND_ALREADY_PENDING                      | NOT DOCUMENTED          | A refund is already pending                            | duplicate_request | DNR                   |
| PAYMENT_NOT_REFUNDABLE                      | 400                     | Not refundable (e.g. too old)                          | invalid_request   | DNR                   |
| PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE       | 400 (S18) / "404" (S20) | Disputed payment, cannot be refunded                   | fraud_or_risk     | MR                    |
| REFUND_ERROR_PAYMENT_NEEDS_COMPLETION       | 400                     | Payment is APPROVED. Complete it first.                | invalid_request   | RC (after completion) |
| REFUND_DECLINED                             | 400                     | Issuer declined the refund                             | card_declined     | MR                    |
| INSUFFICIENT_PERMISSIONS_FOR_REFUND         | 400                     | Account cannot process this refund                     | configuration     | MR                    |

Other ErrorCode values in S1 that are not payment-specific (generic validation such as MISSING_REQUIRED_PARAMETER, INVALID_VALUE, VALUE_TOO_LONG, EXPECTED_*, INVALID_ENUM_VALUE, etc.) should map to `invalid_request` / `do_not_retry`. S1 also lists `PLAID_ERROR*` (EXTERNAL_VENDOR_ERROR family, bank linking), loyalty/subscription/customer codes, `CHECKOUT_EXPIRED`, `BAD_CERTIFICATE`, `APPLE_PAYMENT_PROCESSING_CERTIFICATE_HASH_NOT_FOUND`, and HTTP-style codes (`METHOD_NOT_ALLOWED`, `NOT_ACCEPTABLE`, `GONE`, `REQUEST_ENTITY_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_ENTITY`, `NOT_IMPLEMENTED`).

No `fraud_or_risk` decline code exists in the ErrorCode enum. Risk is exposed only through `payment.risk_evaluation.risk_level` (NORMAL / MODERATE / HIGH, S16).

---

## 5. Statuses

### Payment.status (S8, S12, S13, S14, S15)

| Value     | Meaning                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APPROVED  | Authorized, waiting for completion or cancellation (delayed capture, `autocomplete:false`). Complete with CompletePayment or cancel with CancelPayment.                                                           |
| PENDING   | Not described on the card pages. For ACH, the payment is created PENDING and moves to COMPLETED or FAILED when the transfer resolves (S15). In sandbox, a failed ACH goes PENDING to FAILED after 1 minute (S16). |
| COMPLETED | Captured. Funds credited to the seller. Stays COMPLETED even after partial or full refunds (S20).                                                                                                                 |
| CANCELED  | Voided. Card funds released.                                                                                                                                                                                      |
| FAILED    | Declined by the bank/issuer. No funds credited.                                                                                                                                                                   |

Terminal states: COMPLETED, CANCELED, FAILED (S14). Automatic `delay_action` (default CANCEL) applies only to non-terminal payments. Only COMPLETED payments can be refunded (S20).

### card_details.status (S9)

AUTHORIZED, CAPTURED, VOIDED, FAILED. S9 gives only the list. **Per-value meanings are NOT DOCUMENTED.** The webhook examples show the pairs APPROVED/AUTHORIZED (S21) and COMPLETED/CAPTURED (S22, S6). `card_payment_timeline` gives `authorized_at`, `captured_at`, `voided_at` (S10).

### PaymentRefund.status (S17, S20)

| Value     | Meaning                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PENDING   | Square is processing. Most refunds finish within hours. For card/bank, PENDING can last up to 14 days.                                 |
| COMPLETED | Approved, funds sent. Bank posting may take 7-10 business days.                                                                        |
| REJECTED  | Lack of funds in the seller's account and Square could not pull from the linked bank. Also applies to refunds to transportation cards. |
| FAILED    | Refund failed (seller funds, invalid card, invalid parameters). The cardholder does not receive it.                                    |

A refund can skip PENDING (e.g. Japan) (S20).

---

## 6. Webhooks

### 6.1 Envelope (S27, S21-S24)

| Field                                        | Meaning                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `merchant_id`                                | Merchant where the event occurred                                                                       |
| `location_id`                                | Optional. Present only if the event is tied to a location (absent in all four payment/refund examples). |
| `type`                                       | Event type, e.g. `payment.updated`                                                                      |
| `event_id`                                   | UUID idempotency value that uniquely identifies the event                                               |
| `created_at`                                 | RFC 3339 event creation time                                                                            |
| `data.type`                                  | Affected object type (`payment` / `refund`)                                                             |
| `data.id`                                    | Affected object ID                                                                                      |
| `data.deleted`                               | Only on deletions                                                                                       |
| `data.object.payment` / `data.object.refund` | The full object at event time                                                                           |

Event types (S29, S25): `payment.created` ("A Payment was created."), `payment.updated` (e.g. `payment.status` or `card_details.status` changes on authorize/cancel/complete), `refund.created`, `refund.updated` (typically a status change on completion). All need the `PAYMENTS_READ` permission. Related events not covered here: `terminal.refund.*`, `payout.*`, `dispute.*`.

Verbatim `payment.created` example (S21):

```json
{
  "merchant_id": "6SSW7HV8K2ST5",
  "type": "payment.created",
  "event_id": "13b867cf-db3d-4b1c-90b6-2f32a9d78124",
  "created_at": "2020-02-06T21:27:30.792Z",
  "data": {
    "type": "payment",
    "id": "KkAkhdMsgzn59SM8A89WgKwekxLZY",
    "object": {
      "payment": {
        "id": "hYy9pRFVxpDsO1FB05SunFWUe9JZY",
        "created_at": "2020-11-22T21:16:51.086Z",
        "updated_at": "2020-11-22T21:16:51.198Z",
        "amount_money": {
          "amount": 100,
          "currency": "USD"
        },
        "status": "APPROVED",
        "delay_duration": "PT168H",
        "source_type": "CARD",
        "card_details": {
          "status": "AUTHORIZED",
          "card": {
            "card_brand": "MASTERCARD",
            "last_4": "9029",
            "exp_month": 11,
            "exp_year": 2022,
            "fingerprint": "sq-1-Tvruf3vPQxlvI6n0IcKYfBukrcv6IqWr8UyBdViWXU2yzGn5VMJvrsHMKpINMhPmVg",
            "card_type": "CREDIT",
            "prepaid_type": "NOT_PREPAID",
            "bin": "540988"
          },
          "entry_method": "KEYED",
          "cvv_status": "CVV_ACCEPTED",
          "avs_status": "AVS_ACCEPTED",
          "statement_description": "SQ *DEFAULT TEST ACCOUNT",
          "card_payment_timeline": {
            "authorized_at": "2020-11-22T21:16:51.198Z"
          }
        },
        "location_id": "S8GWD5R9QB376",
        "order_id": "03O3USaPaAaFnI6kkwB1JxGgBsUZY",
        "risk_evaluation": {
          "created_at": "2020-11-22T21:16:51.198Z",
          "risk_level": "NORMAL"
        },
        "total_money": {
          "amount": 100,
          "currency": "USD"
        },
        "approved_money": {
          "amount": 100,
          "currency": "USD"
        },
        "capabilities": ["EDIT_TIP_AMOUNT", "EDIT_TIP_AMOUNT_UP", "EDIT_TIP_AMOUNT_DOWN"],
        "receipt_number": "hYy9",
        "delay_action": "CANCEL",
        "delayed_until": "2020-11-29T21:16:51.086Z",
        "version_token": "FfQhQJf9r3VSQIgyWBk1oqhIwiznLwVwJbVVA0bdyEv6o"
      }
    }
  }
}
```

Doc quirk: in this example `data.id` (`KkAkhd...`) differs from `data.object.payment.id` (`hYy9...`). The payment.updated example (S22) uses `hYy9...` for both. **Correlate on `data.object.payment.id`, and treat `data.id` as a fallback.**

Verbatim `refund.updated` example (S24):

```json
{
  "merchant_id": "6SSW7HV8K2ST5",
  "type": "refund.updated",
  "event_id": "bc316346-6691-4243-88ed-6d651a0d0c47",
  "created_at": "2020-02-06T22:14:16.421Z",
  "data": {
    "type": "refund",
    "id": "KkAkhdMsgzn59SM8A89WgKwekxLZY_ptNBVqHYxt5gAdfcobBe4u1AZsXhoz06KTtuq9Ls24P",
    "object": {
      "refund": {
        "id": "KkAkhdMsgzn59SM8A89WgKwekxLZY_ptNBVqHYxt5gAdfcobBe4u1AZsXhoz06KTtuq9Ls24P",
        "created_at": "2020-02-06T21:27:41.836Z",
        "updated_at": "2020-02-06T22:14:16.381Z",
        "amount_money": {
          "amount": 1000,
          "currency": "USD"
        },
        "status": "COMPLETED",
        "processing_fee": [
          {
            "effective_at": "2020-02-06T23:27:31.000Z",
            "type": "INITIAL",
            "amount_money": {
              "amount": -59,
              "currency": "USD"
            }
          }
        ],
        "location_id": "NAQ1FHV6ZJ8YV",
        "order_id": "haOyDuHiqtAXMk0d8pDKXpL7Jg4F",
        "payment_id": "KkAkhdMsgzn59SM8A89WgKwekxLZY",
        "version": 10
      }
    }
  }
}
```

Doc quirks: the refund.created example (S23, status PENDING, `version: 7`) uses the **same `event_id`** as refund.updated. The refund webhook object carries a `version` integer that is not in the PaymentRefund reference field list (S17). It is useful for ordering.

### 6.2 Delivery semantics (S26, S27)

- **Duplicates:** "Webhooks can be sent more than once." Dedupe on `event_id`. If no 2xx comes back in time, Square sends a duplicate and the receiver has 10 seconds to respond.
- **Ordering:** "There's no guarantee of the delivery order of event notices." Order a timeline by `data.object.<obj>.updated_at`, then `version` (refund) / `version_token` changes, then envelope `created_at`. Do not use arrival order.
- **Latency:** usually well under 60 seconds.
- **Retries:** on a non-2xx response or a timeout, Square retries with exponential backoff for up to 24 hours (11 retries: 1m, 2m, 4m, 8m, 16m, 32m, 60m, 2h, 4h, 8h, 8h), then discards the event. The Events API can recover missed events.
- **Headers:** `x-square-hmacsha256-signature`, `square-environment` (Production/Sandbox), `square-initial-delivery-timestamp`, `square-retry-number` (retries only), `square-retry-reason` (`http_timeout`, `http_error`, `ssl_error`, `other_error`).
- **Signature (S28):** `x-square-hmacsha256-signature` = HMAC-SHA-256 over the subscription **notification URL + raw request body**, keyed with the subscription signature key. The example header value is Base64 (`2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=`). Use a constant-time comparison. PandaPayLens cannot verify it without the key and URL, and must not ask for the key. Treat the header as **sensitive** and redact it.
- Source IPs: production 54.245.1.154, 34.202.99.168; sandbox 54.212.177.79, 107.20.218.8.

---

## 7. Identifiers

| ID                                   | Where                                                         | Notes                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment `id`                         | `payment.id`, `refund.payment_id`, `data.id` (payment events) | Example form: `R2B3Z8WMVt3EAmzYWLZvz7Y69EbZY` (alphanumeric, ~29 characters, examples end in `ZY`). The format is **NOT DOCUMENTED**, so do not validate on it. |
| Refund `id`                          | `refund.id`, `payment.refund_ids[]`                           | In all examples it is `<payment_id>_<suffix>`. The composite format is **NOT DOCUMENTED** as a contract, so use it only as a weak hint.                         |
| `refund.payment_id`                  | PaymentRefund                                                 | Primary refund-to-payment link                                                                                                                                  |
| `order_id`                           | Payment and PaymentRefund                                     | Links to the Orders API                                                                                                                                         |
| `reference_id`                       | Payment (max 40), Card                                        | Caller-supplied merchant reference                                                                                                                              |
| `location_id`                        | Payment, PaymentRefund, optional in envelope                  | Seller location (e.g. `L88917AVBK2S5`)                                                                                                                          |
| `merchant_id`                        | Webhook envelope, Card                                        | Merchant token                                                                                                                                                  |
| `customer_id`                        | Payment, Card                                                 |                                                                                                                                                                 |
| `event_id`                           | Webhook envelope                                              | UUID, dedupe key                                                                                                                                                |
| `idempotency_key`                    | Requests only (CreatePayment, RefundPayment)                  | Not echoed in responses (NOT DOCUMENTED as echoed)                                                                                                              |
| `version_token`                      | Payment                                                       | Opaque concurrency token                                                                                                                                        |
| `receipt_number`                     | Payment                                                       | First 4 characters of the payment ID in the examples (`R2B3`, `hYy9`)                                                                                           |
| Card `fingerprint`                   | `card_details.card.fingerprint`                               | `sq-1-...`. Identifies the card across locations within one app.                                                                                                |
| `application_details.application_id` | Payment                                                       | `sq0ids-...`                                                                                                                                                    |

---

## 8. Sensitive fields (redact or mask before display/export)

- Headers: `x-square-hmacsha256-signature`, `Authorization` (Bearer access tokens), and any webhook signature key.
- Card: `card_details.card.fingerprint`, `bin`, `last_4`, `exp_month`, `exp_year`, `cardholder_name`, `card.billing_address`. Also EMV fields `application_cryptogram`, `auth_result_code`.
- Buyer PII: `buyer_email_address`, `billing_address`, `shipping_address`, `customer_id`, `note` (free text), `team_member_id` / `employee_id`.
- Request-side secrets that may appear in pasted requests: `source_id` (card nonce `cnon:...`, card-on-file `ccof:...`, bank `bnon:...`, wallet `wnon:...`), `verification_token`, `idempotency_key` (low sensitivity).
- `receipt_url` (public receipt link), `device_details`.
- `merchant_id` / `location_id`: low sensitivity, but mask them in shared exports.

---

## 9. Structural detection hints (vs Stripe / Adyen / Checkout.com)

Positive Square signals:

- An error envelope with a top-level `errors` **array** whose items have **UPPER_SNAKE** `category` _and_ `code` (e.g. `PAYMENT_METHOD_ERROR` + `GENERIC_DECLINE`). Stripe uses a single `error` object with lowercase `type`/`code`/`decline_code`. Adyen uses `resultCode`/`refusalReason`/`errorCode` plus `pspReference`. Checkout.com uses `error_type` + `error_codes[]` (snake_case strings) + `request_id`.
- `category` values ending in `_ERROR` from the 8-value ErrorCategory set.
- A Money object shaped `amount_money: {amount, currency}`. Stripe uses a flat `amount` + `currency`, Adyen uses `amount: {value, currency}`, Checkout.com uses a flat `amount` + `currency`.
- A `payment` wrapper key with `source_type`, `card_details.status` ∈ {AUTHORIZED, CAPTURED, VOIDED, FAILED}, `delay_action`, `delayed_until`, `version_token`, `approved_money`, `receipt_number`.
- `card_details.card.fingerprint` starting with `sq-1-`. `application_details.application_id` starting with `sq0ids-` / `sq0idp-`. Source IDs `cnon:`, `ccof:`.
- Webhook: `merchant_id` + `type` with a dotted lowercase name (`payment.updated`) + `event_id` (UUID) + `data.{type,id,object.{payment|refund}}`. Stripe events have `object:"event"`, `id:"evt_..."` and `data.object` directly. Adyen has `notificationItems[].NotificationRequestItem`. Checkout.com has `type` like `payment_approved` with `data.id` `pay_...`.
- Header `x-square-hmacsha256-signature` (Stripe uses `Stripe-Signature`, Adyen uses an `hmacSignature` inside `additionalData`, Checkout.com uses `Cko-Signature`).
- Response header `Square-Version: YYYY-MM-DD`.

Suggested rule: score `square` high when there is (`errors[]` with UPPER_SNAKE `category`+`code`) OR (`payment.amount_money` + `payment.source_type`) OR (envelope `merchant_id`+`event_id`+`data.object.payment|refund`).

---

## 10. Limitations and gaps

- **Category per ErrorCode is NOT DOCUMENTED.** Read it from the payload. Fall back to the section 4.1 mapping.
- HTTP status per code is documented only for the CreatePayment/RefundPayment lists and auth/rate-limit codes. There is a 400-vs-404 contradiction for PAYMENT_NOT_REFUNDABLE_DUE_TO_DISPUTE (S18 vs S20).
- No verbatim example exists of a failed CreatePayment response that includes `payment` with status FAILED. Only the rule in S7 is documented. The shape of `card_details.errors` inside a FAILED payment is not exemplified.
- `card_details.status` per-value meanings are NOT DOCUMENTED.
- `detail` text is free-form and unstable. It may contain issuer text (`"Authorization error: 'INSUFFICIENT_FUNDS'"`). Never key logic on it, except GIFT_CARD_AVAILABLE_AMOUNT, where `detail` is a minor-unit balance.
- Retry guidance is official only for RATE_LIMITED (backoff + jitter) and TEMPORARY_ERROR (retry with the same idempotency key). All other retry classes in section 4.2 are PandaPayLens judgments.
- The ErrorCode enum is large (~200 values) and grows over time. Unknown codes must degrade to the category fallback, then `unknown`.
- Webhook doc examples have quirks (mismatched `data.id` in payment.created, a reused `event_id` across refund examples). Real payloads may differ.
- The refund webhook object includes `version`, which is not in the PaymentRefund reference.
- Square issuer raw decline/response codes are not exposed except `auth_result_code` (an opaque issuer auth code, not a decline reason).
- This research did not cover dispute webhooks (`dispute.*`), the Terminal API, the Orders API, or the legacy v1 Transactions API.

---

## 11. Proposed capability statuses

| Capability           | Proposed status | Justification                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported**   | The envelope `{errors:[{category, code, detail?, field?}]}` is fully documented (S3, S5). The complete ErrorCode and ErrorCategory enums are published (S1, S2), and HTTP mappings exist for the CreatePayment/RefundPayment codes (S6, S18). The category/retry mapping is a PandaPayLens proposal, so mark per-code mappings as "derived".                           |
| **paymentResponses** | **supported**   | The Payment, CardPaymentDetails, Card, CardPaymentTimeline and PaymentRefund objects are fully specified (S8-S11, S17), with verbatim examples (S6, S18). Mixed `errors` + FAILED `payment` is documented as possible (S7, S19), but there is no example, so add tests with a synthetic fixture labelled as such.                                                      |
| **webhookParsing**   | **supported**   | The envelope is documented (S27) with verbatim examples for all four events (S21-S24). Dedupe key `event_id` and the signature header are documented. Signature verification is out of scope (needs the secret and URL), so report it as "not verified".                                                                                                               |
| **timeline**         | **partial**     | Timestamps are rich: `created_at`/`updated_at`, `card_payment_timeline.authorized_at/captured_at/voided_at`, `delayed_until`, refund `created_at`/`updated_at`, envelope `created_at`. But delivery order is explicitly not guaranteed (S26), `card_details.status` semantics are not documented, and one pasted payload holds only the current snapshot, not history. |
| **correlation**      | **partial**     | Strong documented links exist: `refund.payment_id`, `payment.refund_ids[]`, `order_id`, `reference_id`, `location_id`, `event_id`. Weaknesses: the doc example's `data.id` differs from the payment id, the composite refund id format is not a contract, and `idempotency_key` is not echoed in responses, so request-to-response linking needs the pasted request.   |
