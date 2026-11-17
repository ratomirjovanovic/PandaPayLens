# Klarna - provider research for the `klarna` adapter

> Scope: PandaPayLens parses pasted Klarna payloads only. It never calls Klarna.
> Everything below comes from Klarna's official developer documentation (docs.klarna.com).
> Where the docs are silent, this file says **NOT DOCUMENTED**. Category and retry-class mappings
> are **PandaPayLens proposals** built from the documented descriptions. Klarna does not publish
> such a classification.

---

## 1. Sources

Verification date: **2026-11-17**. All pages were read on that date. The API references (S1, S2) were downloaded as raw HTML and the embedded OpenAPI documents were extracted from the page data, so field names, enums and response codes below are taken from the specs, not retyped from rendered text. The guide pages were read both through a raw HTML download (text extracted from the page source) and as rendered pages.

The direct-merchant documentation now lives under `https://docs.klarna.com/acquirer/klarna/`. Older links such as `https://docs.klarna.com/api/ordermanagement/` redirect there.

| #   | URL                                                                                                                                             | Used for                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| S1  | https://docs.klarna.com/acquirer/klarna/api/ordermanagement/                                                                                    | Order Management API v1 OpenAPI 3.0.1: order, capture, refund objects, error schemas, status codes  |
| S2  | https://docs.klarna.com/acquirer/klarna/api/payments/                                                                                           | Klarna Payments API v1 OpenAPI 3.0.0: create order response, ErrorV2, merchant_urls                 |
| S3  | https://docs.klarna.com/acquirer/klarna/resources/developer-tools/error-handling/error-codes-and-messages-for-order-management/                 | Order Management error codes, HTTP status, messages, handling                                       |
| S4  | https://docs.klarna.com/acquirer/klarna/resources/developer-tools/error-handling/error-codes-and-messages-for-klarna-payments/                  | Klarna Payments error codes, HTTP status, messages, handling                                        |
| S5  | https://docs.klarna.com/acquirer/klarna/resources/developer-tools/error-handling/error-codes-and-messages/                                      | Error body overview (code, messages, correlation id)                                                |
| S6  | https://docs.klarna.com/acquirer/klarna/get-started/integration-resilience/errors/                                                              | Error object rules (`error_code` ALL_CAPS_SNAKE_CASED, `error_messages` or `error_message`)         |
| S7  | https://docs.klarna.com/acquirer/klarna/get-started/integration-resilience/escalation-and-retry-policy/                                         | Order Management retry and escalation policy, idempotency key                                       |
| S8  | https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-sdk/step-3-create-an-order/                   | Create order response example, error body example, customer-token order error codes                 |
| S9  | https://docs.klarna.com/acquirer/klarna/after-payments/order-management/manage-orders-with-the-api/view-and-change-orders/                      | Get order example, INVALID_ORDER_ID example, cancel rules                                           |
| S10 | https://docs.klarna.com/acquirer/klarna/after-payments/order-management/manage-orders-with-the-api/capture-and-track-orders/                    | Capture call, 201 with `capture_id` and `location` headers, idempotency                             |
| S11 | https://docs.klarna.com/acquirer/klarna/after-payments/order-management/manage-orders-with-the-api/refund-orders-and-manage-authorizations/     | Refund call, 201 with `refund_id` and `location` headers, REFUND_NOT_ALLOWED and NOT_ALLOWED bodies |
| S12 | https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-hpp/api-documentation/status-callbacks/       | Hosted Payment Page (HPP) status callbacks: body, examples, retries, de-duplication                 |
| S13 | https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/integrate-via-hpp/before-you-start/tracking-session-status/ | HPP session status values and meanings                                                              |
| S14 | https://docs.klarna.com/acquirer/klarna/web-payments/integrate-with-klarna-payments/other-actions/authorization-callback/                       | Authorization callback body, retries, at-least-once delivery                                        |
| S15 | https://docs.klarna.com/acquirer/klarna/get-started/integration-resilience/callbacks/                                                           | Callback source IP addresses (no payload, no signature)                                             |

Pages checked and found missing on 2026-11-17:

- `https://docs.klarna.com/payments/after-payments/order-management/more-actions/pending-orders/` (linked from the `fraud_status` description in S2) redirects to `https://docs.klarna.com/acquirer/klarna/after-payments/order-management/more-actions/pending-orders/`, which returns HTTP 404. The page is not in `https://docs.klarna.com/sitemap.xml`. See section 6.3.

---

## 2. API families and versions

| Family                           | Endpoints relevant to parsing                                                                                                                                                                                                                                                          | Notes                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Klarna Payments API v1** (S2)  | `POST /payments/v1/authorizations/{authorizationToken}/order` (create order), `DELETE /payments/v1/authorizations/{token}` (cancel authorization), sessions, customer token                                                                                                            | Create order returns the `order` object |
| **Order Management API v1** (S1) | `GET /ordermanagement/v1/orders/{order_id}`, `POST .../captures`, `GET .../captures[/{capture_id}]`, `POST .../refunds`, `GET .../refunds/{refund_id}`, `POST .../cancel`, `POST .../release-remaining-authorization`, `POST .../extend-authorization-time`, `PATCH .../authorization` | Order, Capture and Refund objects       |
| **HPP status callbacks** (S12)   | POST to `merchant_urls.status_update`                                                                                                                                                                                                                                                  | `{ event_id, session }`                 |
| **Authorization callback** (S14) | POST to `merchant_urls.authorization`                                                                                                                                                                                                                                                  | `{ authorization_token, session_id }`   |

Out of scope: the Klarna Network APIs (`/v2/...`, Klarna Notifications API with signed webhooks) used by acquiring and distribution partners, Kustom/Klarna Checkout, In-store, Settlements and Disputes APIs.

---

## 3. Error response format

### 3.1 Envelope

S5 and S6: on failure Klarna answers with a 4xx or 5xx status and an error object holding an error code, an array of error messages and a unique correlation id for the request. S6 states the object must contain `error_code` and `error_messages` (or `error_message`). `error_code` is ALL_CAPS_SNAKE_CASED and machine readable; the message is English debugging text that clients should not parse or show to customers.

Schemas (S1 `ErrorMessageDto` and the per-code variants, S2 `ErrorV2`): `correlation_id` (string), `error_code` (string), `error_messages` (array of strings). No `service_version` or other field is defined.

Example shape (S8, also S9 and S11):

```json
{
  "correlation_id": "6a9b1cb1-73a3-4936-a030-481ba4bb203b",
  "error_code": "ERROR_CODE",
  "error_messages": ["ERROR_MESSAGE"]
}
```

The sequence diagrams in S9, S10 and S11 write `error_message` while the JSON samples use `error_messages`. The adapter accepts both.

The error body does **not** carry the order id. Linking an error to an order is **NOT DOCUMENTED** from the body alone.

### 3.2 Order Management error codes (S3, plus S1 response codes and S9/S11 samples)

Paraphrased; see S3 for the full text.

| HTTP        | Code                    | Meaning (paraphrase)                                                                                                              | Proposed category    | Proposed retry      |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| 400         | NOT_FOUND               | Invalid request; S3 shows a "refund cannot be found for order" message under 400                                                  | invalid_request      | do_not_retry        |
| 403         | CAPTURE_NOT_ALLOWED     | Capture refused; order may be cancelled or expired, or the amount exceeds the remaining authorization                             | invalid_request      | manual_review       |
| 403         | CANCEL_NOT_ALLOWED      | Cancel refused; an order with captures (or a closed order, S1) cannot be cancelled                                                | invalid_request      | do_not_retry        |
| 403         | NOT_ALLOWED             | Operation not allowed in the order's current state (update authorization, release, extend, customer details, merchant references) | invalid_request      | manual_review       |
| 403         | REFUND_NOT_ALLOWED      | Refund refused; only captured amounts can be refunded, over-refund not allowed                                                    | invalid_amount       | manual_review       |
| 404         | NO_SUCH_ORDER           | Order (or capture/refund) not found; check the ids                                                                                | invalid_request      | do_not_retry        |
| 404         | NO_SUCH_CAPTURE         | Capture not found; check the ids                                                                                                  | invalid_request      | do_not_retry        |
| 404         | NOT_FOUND               | Order, capture or refund not found; check the ids                                                                                 | invalid_request      | do_not_retry        |
| 409         | CONFLICT                | Conflicts with the current state of the resource                                                                                  | invalid_request      | manual_review       |
| 413         | REQUEST_TOO_LARGE       | Request too large                                                                                                                 | invalid_request      | do_not_retry        |
| 422         | INVALID_ADDRESS         | Shipping and/or billing address invalid                                                                                           | invalid_request      | do_not_retry        |
| 422         | UNPROCESSABLE_ENTITY    | Request cannot be processed (field constraint)                                                                                    | invalid_request      | do_not_retry        |
| 429         | TOO_MANY_REQUESTS       | Rate limited                                                                                                                      | rate_limiting        | retry_conditionally |
| 500         | INTERNAL_SERVER_ERROR   | Unexpected server error                                                                                                           | provider_unavailable | retry_conditionally |
| 500         | UNEXPECTED_ERROR        | Unexpected server error                                                                                                           | provider_unavailable | retry_conditionally |
| 502/503/504 | TEMPORARILY_UNAVAILABLE | Service temporarily unavailable                                                                                                   | provider_unavailable | retry_conditionally |
| not stated  | INVALID_ORDER_ID        | Order id is not a valid UUID (S9 sample)                                                                                          | invalid_request      | do_not_retry        |

S3 also lists the placeholders `XXX_NOT_ALLOWED` and `NO_SUCH_XXX`; they are patterns, not codes, and are not catalogued.

### 3.3 Klarna Payments error codes (S4, S8)

| HTTP | Code                  | Meaning (paraphrase)                                                                                                                         | Proposed category          | Proposed retry           |
| ---- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| 400  | BAD_REQUEST           | Client error; the server will not process the request                                                                                        | invalid_request            | do_not_retry             |
| 400  | BAD_VALUE             | A property failed validation; the message names it (tax, order lines, currency, address, attachment, locale)                                 | invalid_request            | do_not_retry             |
| 409  | BAD_VALUE             | Data changed since an earlier step (session, load, authorize), so fields no longer match                                                     | invalid_request            | do_not_retry             |
| 401  | UNAUTHORIZED          | Credentials invalid                                                                                                                          | configuration              | do_not_retry             |
| 403  | INVALID_OPERATION     | Operation not allowed or not configured for the merchant id (for example token already consumed)                                             | configuration              | manual_review            |
| 403  | MERCHANT_INACTIVE     | Merchant id not activated                                                                                                                    | configuration              | manual_review            |
| 403  | REJECTED              | Klarna did not approve the authorization (no reason given)                                                                                   | payment_method_unavailable | customer_action_required |
| 404  | NOT_FOUND             | Invalid session id, invalid or expired authorization token (orders must be placed within 60 minutes, S8), or authorization cannot be deleted | invalid_request            | do_not_retry             |
| 404  | SESSION_COMPLETED     | The session already has an order; pre-purchase operations are not allowed                                                                    | duplicate_request          | do_not_retry             |
| 500  | INTERNAL_SERVER_ERROR | Internal error at Klarna                                                                                                                     | provider_unavailable       | retry_conditionally      |

Customer-token order errors (S8):

| HTTP | Code                       | Meaning (paraphrase)                                                                             | Proposed category          | Proposed retry      |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- | ------------------- |
| 404  | TOKEN_NOT_FOUND            | Customer token not found                                                                         | invalid_request            | do_not_retry        |
| 403  | TOKEN_SUSPENDED            | Customer token suspended by Klarna                                                               | payment_method_unavailable | do_not_retry        |
| 403  | TOKEN_CANCELED             | Token exists but is not linked to this merchant id                                               | configuration              | do_not_retry        |
| 403  | UNAVAILABLE_PAYMENT_METHOD | Payment method cannot be used for the currency                                                   | payment_method_unavailable | do_not_retry        |
| 403  | PAYMENT_METHOD_FAILED      | Purchase failed; for credit methods most likely the customer was rejected; S8 says try resending | payment_method_unavailable | retry_conditionally |
| 400  | BAD_REQUEST                | (no description)                                                                                 | invalid_request            | do_not_retry        |
| 503  | SERVICE_UNAVAILABLE        | Temporary internal error; try again later                                                        | provider_unavailable       | retry_conditionally |

`NOT_FOUND`, `BAD_VALUE`, `BAD_REQUEST` and `INTERNAL_SERVER_ERROR` occur in both APIs. The error body does not say which API produced it. The HTTP status (when the pasted message includes it) is used only to choose between documented meanings of the same code.

### 3.4 Retry policy (S7)

Applies to the Order Management API only:

- 5xx on GET calls: retry after 5 seconds, 5 minutes, 5 hours, then escalate.
- 5xx on POST/PATCH sent with a `Klarna-Idempotency-Key`: same schedule. Klarna executes a request once per key if the retry is within 24 hours, and repeated requests return the same response.
- 5xx on POST/PATCH without an idempotency key: not safe to retry, escalate.
- 3xx/4xx: escalate; the fix may allow a later retry.
- In all failure cases the order state is uncertain.

A pasted error body does not show whether an idempotency key was used or which HTTP method was called, so PandaPayLens never presents a 5xx retry as safe: it uses `retry_conditionally` and says to verify the order first.

For Klarna Payments, retry policy beyond the per-code notes in S4 and S8 is **NOT DOCUMENTED**.

---

## 4. Objects and statuses

### 4.1 Klarna Payments `order` (create order response, S2, S8)

Fields: `order_id` (required), `redirect_url`, `fraud_status`, `authorized_payment_method`.

- `fraud_status` (S2): "Either ACCEPTED or PENDING". ACCEPTED: the order could be captured. PENDING: wait for Klarna's notification to the notification URL that the order was approved.
- `authorized_payment_method` (S2 schema): object with `type` (enum: invoice, fixed_amount, base_account, direct_debit, direct_bank_transfer, b2b_invoice, card, slice_it_by_card, pay_later_by_card, pay_by_card, fixed_sum_credit, alternative_payment_method), `number_of_days`, `number_of_installments`. The S8 example shows it as a plain string (`"invoice"`). Both shapes are accepted.
- `redirect_url`: Klarna URL to send the customer to; not copied.
- S8: placing the order charges the customer and closes the payment session; the authorization token is valid for 60 minutes.

### 4.2 Order Management order (`MerchantOrderDto`, S1, S9)

Fields used: `order_id`, `status`, `fraud_status`, `order_amount`, `original_order_amount`, `captured_amount`, `refunded_amount`, `remaining_authorized_amount`, `purchase_currency`, `purchase_country`, `created_at`, `expires_at`, `captures[]`, `refunds[]`, `initial_payment_method.type`, `initial_payment_method.number_of_installments`. Amounts are integers in minor units.

- `status` enum: `AUTHORIZED`, `PART_CAPTURED`, `CAPTURED`, `CANCELLED`, `EXPIRED`, `CLOSED`. S1 describes the field only as "The order status". Per-value meanings are **NOT DOCUMENTED**. What the docs do say: `expires_at` is the time until which the order can be captured; cancel is refused once an order has captures or is closed (S1 cancel 403); cancelling releases the authorized amount (S9).
- `fraud_status`: "Either ACCEPTED, PENDING or REJECTED" (S1). The meaning of REJECTED is **NOT DOCUMENTED** beyond its name.
- Not used: `billing_address`, `shipping_address`, `customer`, `merchant_data`, `order_lines`, `shipping_info`, `selected_shipping_option`, `locale`, `merchant_reference1/2`, `klarna_reference`.

PandaPayLens mapping (proposal):

| status        | stage         | outcome | Basis                                                                      |
| ------------- | ------------- | ------- | -------------------------------------------------------------------------- |
| AUTHORIZED    | authorization | success | Name; captures, refunds and remaining authorization fields                 |
| PART_CAPTURED | capture       | success | Name; captured_amount below order_amount                                   |
| CAPTURED      | capture       | success | Name; S9 example shows CAPTURED with captured_amount equal to order_amount |
| CANCELLED     | cancellation  | success | Cancel releases the authorization (S9)                                     |
| EXPIRED       | authorization | failure | expires_at: the order can only be captured until this time (S1)            |
| CLOSED        | other         | unknown | No description                                                             |

When `fraud_status` is PENDING the outcome of an AUTHORIZED order is reported as pending, and when it is REJECTED as unknown.

### 4.3 Capture (S1 `Capture`)

`capture_id`, `captured_amount` (minor units), `captured_at` (ISO 8601), `klarna_reference`, `reference`, `description`, `refunded_amount`, `order_lines`, `billing_address`, `shipping_address`, `shipping_info`. No currency and no order id in the object. Capture creation returns HTTP 201 with `capture_id` and `location` headers and no body (S10).

### 4.4 Refund (S1 `Refund`)

`refund_id`, `refunded_amount` (minor units), `refunded_at` (ISO 8601), `reference`, `description`, `credit_invoice`, `order_lines`. No status field, no currency, no order id. Refund creation returns HTTP 201 with `refund_id` and `location` headers and no body (S11). Whether the money has reached the customer, and when, is **NOT DOCUMENTED**. PandaPayLens shows a Refund object as a refund registered on the order (stage refund, outcome success) and states in the manifest that this is not a payout confirmation.

---

## 5. Identifiers

| Identifier                           | Where                                                              | Use                                                             |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `order_id`                           | KP order, OM order, HPP callback (PLACE_ORDER/CAPTURE_ORDER modes) | Payment reference; links all events of one order                |
| `capture_id`                         | Capture                                                            | Related reference                                               |
| `refund_id`                          | Refund                                                             | Related reference                                               |
| `event_id`                           | HPP status callback                                                | De-duplication key (S12)                                        |
| `correlation_id`                     | Error body                                                         | Identifies the failed request in Klarna logs; not a payment key |
| `klarna_reference`                   | OM order, capture, HPP callback                                    | Customer-facing reference; not used for correlation             |
| `merchant_reference1/2`, `reference` | OM order, capture, refund                                          | Merchant-supplied; not used for correlation                     |
| `session_id`                         | HPP callback, authorization callback                               | Session identifier; treated as sensitive, not copied            |

---

## 6. Callbacks and notifications

### 6.1 HPP status callbacks (S12, S13)

Body: `event_id` (identifier allowing de-duplication) and `session` (same content as the read session endpoint). Examples show `session.session_id`, `status`, `updated_at`, `expires_at`, and on COMPLETED either `authorization_token` (default place_order_mode) or `order_id` and `klarna_reference` (PLACE_ORDER or CAPTURE_ORDER mode).

Statuses (S13; TIMEOUT from S12):

| Status      | Meaning (paraphrase)                                                                      | Stage         | Outcome |
| ----------- | ----------------------------------------------------------------------------------------- | ------------- | ------- |
| WAITING     | Session created, customer not on the page yet                                             | payment       | pending |
| IN_PROGRESS | Customer opened the payment page                                                          | payment       | pending |
| COMPLETED   | Customer got an authorization; order still to be placed unless place_order_mode placed it | authorization | success |
| FAILED      | Customer declined; session still open for a retry                                         | authorization | failure |
| CANCELLED   | Customer cancelled the session; definitive                                                | cancellation  | success |
| BACK        | Customer pressed back; session still open                                                 | payment       | pending |
| ERROR       | Customer hit an error; session still open                                                 | payment       | pending |
| DISABLED    | Merchant disabled the session by API                                                      | cancellation  | success |
| TIMEOUT     | Session timer expired                                                                     | payment       | failure |

Delivery: HPP does not wait for the response; a 2xx is expected. Without a response within 3 seconds it retries after a few seconds, up to 4 calls per event. Retries can repeat an event, so use `event_id`. Ordering: **NOT DOCUMENTED**. Signature: **NOT DOCUMENTED**; Klarna suggests a one-time secret token in the callback URL query.

### 6.2 Authorization callback (S14)

Body: `authorization_token` and `session_id`. Sent once the session is authorized. Any 2xx acknowledges; 2-second connect and read timeouts; up to 3 attempts with exponential delays from 1 second; at-least-once delivery, so duplicates happen even after a 2xx. No signature scheme is documented. Both fields are sensitive (the token places the order), so PandaPayLens records the callback without copying either value; it cannot be linked to an order.

### 6.3 Pending order (fraud status) notifications

S2 says that for `fraud_status` PENDING the merchant should wait for a notification to `merchant_urls.notification` ("URL for notifications on pending orders"). The page that described this notification (body fields and event names) is no longer published (section 1). Its body format and event names are **NOT DOCUMENTED** on any current page, so the adapter does not recognize or decode it.

### 6.4 Other

- Callback source IP addresses are listed in S15. No callback payload or signature is described there.
- Webhook signature verification: not applicable to the formats above; nothing is verified offline.

---

## 7. Sensitive fields

Never copied: `authorization_token`, `session_id`, `client_token`, `customer_token`/`token_id`, `redirect_url`, `billing_address`, `shipping_address`, `customer` (date of birth, national id), `merchant_data`, `description`, `order_lines`, `shipping_info`, `error_messages` beyond the length-limited provider message, any callback URL query (`secretToken`).

---

## 8. Structural detection hints

- Error: `error_code` in ALL_CAPS_SNAKE_CASE with `error_messages` (string array) or `error_message`, plus `correlation_id`. A bare `error_code` is not enough.
- KP order: `order_id` with `fraud_status` ACCEPTED or PENDING, no `status`.
- OM order: `order_id`, an OM `status` value and a `fraud_status` value, or `order_id` with `fraud_status` and OM amount fields.
- Capture: `capture_id` with integer `captured_amount`.
- Refund: `refund_id` with integer `refunded_amount`.
- HPP callback: `event_id` with `session.status` from section 6.1.
- Authorization callback: exactly `authorization_token` and `session_id` strings.

---

## 9. Limitations and gaps

- Pending order notification format and event names: NOT DOCUMENTED today (6.3).
- Order status values have no per-value description (4.2).
- Error bodies do not include the order id; errors are not linked to orders.
- Capture and refund creation responses have no body (201 with headers), so they are not analyzed; Capture and Refund objects from GET calls and the order's `captures[]`/`refunds[]` are.
- Bare Capture and Refund objects carry no order id and no currency.
- Refunds have no status; the docs do not say when the customer receives the money.
- The retry policy is documented for Order Management only.
- HPP session ids and authorization callback values are sensitive; callbacks before an order exists cannot be linked to an order.

---

## 10. Proposed capability statuses

| Capability       | Proposal | Reason                                                                                               |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| errorDecoding    | limited  | Documented codes decoded; shared codes across APIs; no order id in errors                            |
| paymentResponses | limited  | KP order, OM order, captures and refunds; capture/refund creation has no body                        |
| webhookParsing   | limited  | HPP status callbacks and the authorization callback only; pending order notifications not documented |
| timeline         | limited  | Order snapshots have no update time; captures and refunds carry their own times                      |
| correlation      | limited  | `order_id`, `capture_id`, `refund_id` only                                                           |
| diagnosticRules  | limited  | Generic rules only                                                                                   |
