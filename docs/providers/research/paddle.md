# Paddle: provider research for the `paddle` adapter

Status: tested adapter, limited.
Verification date: **2026-11-17**.
Scope: the adapter parses payloads that users paste. It never calls Paddle.

Rule for this document: every statement comes from first-party Paddle documentation that was read on the verification date. Anything the docs do not state is marked **NOT DOCUMENTED**. Category and retry mappings in section 5 are PandaPayLens decisions, not Paddle statements, and are labelled that way. Code descriptions are paraphrased; the linked pages hold Paddle's own wording.

---

## 1. Sources

All pages on `developer.paddle.com` were fetched on 2026-11-17 through their Markdown variant (the same URL with `.md` appended, as listed in `https://developer.paddle.com/llms.txt`). The HTML URL is the one cited below and in the adapter.

| #   | URL                                                                                                                                                           | Used for                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | https://developer.paddle.com/llms.txt                                                                                                                         | Documentation index; Paddle Billing vs Paddle Classic comparison                                                                                                                                                                     |
| S2  | https://developer.paddle.com/api-reference/about/errors                                                                                                       | Error object (`error.type`, `code`, `detail`, `documentation_url`, `errors[]`), `meta.request_id`                                                                                                                                    |
| S3  | https://developer.paddle.com/errors                                                                                                                           | Error reference: every code with its HTTP status, grouped by entity                                                                                                                                                                  |
| S4  | https://developer.paddle.com/errors/shared/internal_error (and sibling pages)                                                                                 | Per-code example bodies, `type` value, causes and suggested fixes                                                                                                                                                                    |
| S5  | https://developer.paddle.com/api-reference/about/success-responses                                                                                            | `data` object or array plus `meta` for entity responses                                                                                                                                                                              |
| S6  | https://developer.paddle.com/webhooks/about/how-webhooks-work                                                                                                 | Notification envelope, event vs notification, at-least-once delivery, `event_id` dedupe                                                                                                                                              |
| S7  | https://developer.paddle.com/webhooks/about/respond-to-webhooks                                                                                               | 5 second timeout, retry schedule, ordering not guaranteed                                                                                                                                                                            |
| S8  | https://developer.paddle.com/webhooks/about/signature-verification                                                                                            | `Paddle-Signature` header (`ts=...;h1=...`), HMAC with the endpoint secret                                                                                                                                                           |
| S9  | https://developer.paddle.com/webhooks/transactions/transaction-payment-failed                                                                                 | Event text, full transaction schema with enums (status, payment attempt status, `error_code`), example                                                                                                                               |
| S10 | https://developer.paddle.com/webhooks/transactions/transaction-paid                                                                                           | `paid` means captured, not yet fully processed                                                                                                                                                                                       |
| S11 | https://developer.paddle.com/webhooks/transactions/transaction-completed                                                                                      | `completed` after internal processing                                                                                                                                                                                                |
| S12 | https://developer.paddle.com/webhooks/transactions/transaction-past-due                                                                                       | When transactions become `past_due`                                                                                                                                                                                                  |
| S13 | https://developer.paddle.com/webhooks/transactions/transaction-canceled                                                                                       | When transactions are canceled                                                                                                                                                                                                       |
| S14 | https://developer.paddle.com/webhooks/transactions/transaction-created, -ready, -billed, -updated, -revised                                                   | Other transaction events                                                                                                                                                                                                             |
| S15 | https://developer.paddle.com/webhooks/adjustments/adjustment-created                                                                                          | Adjustment actions, example payload                                                                                                                                                                                                  |
| S16 | https://developer.paddle.com/webhooks/adjustments/adjustment-updated                                                                                          | Refund approval flow (`pending_approval` to `approved` or `rejected`)                                                                                                                                                                |
| S17 | https://developer.paddle.com/webhooks/subscriptions/subscription-created, -activated, -canceled, -past-due, -paused, -resumed, -trialing, -updated, -imported | Subscription events, `transaction_id` on `subscription.created` only                                                                                                                                                                 |
| S18 | https://developer.paddle.com/api-reference/transactions/get-transaction                                                                                       | Transaction entity response                                                                                                                                                                                                          |
| S19 | https://developer.paddle.com/api-reference/adjustments/list-adjustments                                                                                       | Adjustment entity                                                                                                                                                                                                                    |
| S20 | https://developer.paddle.com/api-reference/subscriptions/get-subscription                                                                                     | Subscription entity response                                                                                                                                                                                                         |
| S21 | https://github.com/PaddleHQ/paddle-openapi/blob/main/v1/openapi.yaml                                                                                          | Paddle's published OpenAPI file: enum descriptions (`TransactionStatus`, `PaymentAttemptStatus`, `ErrorCode`, `AdjustmentAction`, `AdjustmentStatus`, `StatusSubscription`, `EventTypeName`, `PublicTransactionOrigin`), id patterns |
| S22 | https://developer.paddle.com/get-started/how-paddle-works                                                                                                     | Paddle describes itself as a merchant of record                                                                                                                                                                                      |
| S23 | https://developer.paddle.com/concepts/payment-methods                                                                                                         | Card and alternative payment methods                                                                                                                                                                                                 |

S21 is a secondary first-party source. Every enum used from it also appears in the schemas embedded in S9, S15 and S17.

---

## 2. API families and versions

| Family                                  | In scope | Notes                                                                                                                                                   |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paddle Billing API (JSON)               | Yes      | Transactions, adjustments and subscriptions, single entity responses `{ data: {...}, meta: { request_id } }` (S5).                                      |
| Paddle Billing API list responses       | No       | `{ data: [...], meta: { pagination } }` (S5). Recognized, not analyzed.                                                                                 |
| Paddle Billing error responses          | Yes      | `{ error: { type, code, detail, documentation_url, errors? }, meta: { request_id } }` (S2).                                                             |
| Paddle Billing webhooks (notifications) | Yes      | JSON envelope with `event_id`, `event_type`, `occurred_at`, `notification_id`, `data` (S6).                                                             |
| Paddle Classic                          | No       | Different product: `"success": false` error bodies and form-style webhook payloads with a serialized signature (S1). Out of scope and **NOT** detected. |
| Paddle.js `checkout.error` events       | No       | Client-side events (S2). Out of scope.                                                                                                                  |

API version headers and how they change payloads: out of scope; the adapter reads field names that are present in the current schemas only.

---

## 3. Formats

### 3.1 Error response (S2, S4)

- Body: `error` object and `meta` object. `error.type` is `request_error` (a problem with the request) or `api_error` (a problem on Paddle's side) (S21 `ErrorResponse`). `error.code` is a snake case string, `error.detail` is human readable text, `error.documentation_url` links to the code's reference page, and `error.errors[]` (`field`, `message`) is present only for validation errors (`invalid_field`).
- `meta.request_id` identifies the request for support.
- HTTP status: the code's status from S3. Paddle returns 4xx for request problems and, rarely, 5xx for Paddle problems (S2).
- `too_many_requests` (429) is typed `api_error` in its example (S4), so the type alone does not mean a server fault.
- `Retry-After` header carries the wait for 429 (S4 `too_many_requests`).

### 3.2 Entity response (S5, S18-S20)

`{ "data": { ...entity }, "meta": { "request_id": "..." } }`. Identifier prefixes (S21 patterns and examples): transaction `txn_`, adjustment `adj_`, subscription `sub_`, customer `ctm_`, address `add_`, business `biz_`, payment method `paymtd_`, event `evt_`, notification `ntf_`. The documented patterns are lowercase alphanumeric of a fixed length; the adapter checks only the prefix.

### 3.3 Webhook notification (S6)

| Field             | Meaning                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `event_id`        | `evt_` id of the event. Paddle names it as the key for deduplicating repeated deliveries.                       |
| `event_type`      | `entity.action`, for example `transaction.paid`.                                                                |
| `occurred_at`     | RFC 3339 time of the event. Paddle says to use it to order events.                                              |
| `notification_id` | `ntf_` id of this delivery to one destination. Two destinations get two notifications with the same `event_id`. |
| `data`            | Snapshot of the entity when the event occurred.                                                                 |

The `/events` API list returns the same event entity without `notification_id` (S6, S21 `Event`). The adapter accepts an event without `notification_id` with lower detection confidence.

---

## 4. Lifecycle

### 4.1 Transaction status (S9, S21 `TransactionStatus`)

| Status      | Meaning (paraphrased)                                                                                                 | PandaPayLens stage / outcome |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `draft`     | Required fields are missing; typically the start of a checkout.                                                       | payment / pending            |
| `ready`     | Has items, customer and address; can become billed or completed.                                                      | payment / pending            |
| `billed`    | Issued as an invoice (legal record). Not paid.                                                                        | payment / pending            |
| `paid`      | Fully paid, Paddle has not finished internal processing. S10: payment has been captured.                              | payment / success            |
| `completed` | Fully paid and processed.                                                                                             | payment / success            |
| `canceled`  | Canceled by the seller or automatically (for example unpaid transactions of a canceled or paused subscription) (S13). | cancellation / failure       |
| `past_due`  | Renewal payment failed (subscription in dunning), or an invoice unpaid 24 hours after its due date (S12). Not final.  | payment / pending (overdue)  |

The transaction status is not the outcome of a single payment attempt: the S9 example of `transaction.payment_failed` carries `status: "ready"` with a failed attempt in `payments[]`.

### 4.2 Payment attempts (`payments[]`, S9, S21 `TransactionPaymentAttempt`)

Sorted by `created_at` descending, newest first. Fields: `payment_attempt_id` (UUID), `payment_method_id` (`paymtd_`), `stored_payment_method_id` (deprecated), `amount` (string in the currency's lowest denomination), `status`, `error_code` (null when captured), `method_details`, `created_at`, `captured_at` (null unless captured).

| Status                       | Meaning (paraphrased)                                                     | Stage / outcome          |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `authorized`                 | Authorized, not captured; incomplete.                                     | authorization / success  |
| `authorized_flagged`         | Authorized, held as potentially fraudulent; incomplete.                   | authorization / pending  |
| `canceled`                   | An authorized attempt was canceled, typically a rejected flagged attempt. | void / failure           |
| `captured`                   | Captured; the attempt is complete.                                        | capture / success        |
| `error`                      | Unsuccessful; see `error_code`.                                           | payment / failure        |
| `action_required`            | The customer must act, typically 3DS.                                     | authentication / pending |
| `pending_no_action_required` | Waiting on the bank or payment provider.                                  | payment / pending        |
| `created`                    | New attempt.                                                              | payment / pending        |
| `unknown`                    | Status not known.                                                         | payment / unknown        |
| `dropped`                    | Dropped by Paddle.                                                        | payment / failure        |

### 4.3 Payment attempt `error_code` (S9, S21 `ErrorCode`)

Paraphrased; see S9 for Paddle's text.

| Code                              | Meaning (paraphrased)                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `already_canceled`                | The amount was already canceled; not typical for payments.                                      |
| `already_refunded`                | The amount was already refunded; not typical for payments.                                      |
| `authentication_failed`           | The customer went through an authentication challenge (3DS2, APM redirect) and failed it.       |
| `blocked_by_policy`               | Blocked by a policy check the seller configured.                                                |
| `blocked_card`                    | The issuer says the card is frozen, lost, damaged or stolen.                                    |
| `canceled`                        | The customer asked for the recurring payment mandate to be canceled.                            |
| `declined`                        | Declined with no further information.                                                           |
| `declined_not_retryable`          | Declined and the issuer says not to retry (for example a closed account or revoked permission). |
| `expired_card`                    | The issuer says the card has expired.                                                           |
| `fraud`                           | Issuer or payment provider flagged the payment as possible fraud.                               |
| `invalid_amount`                  | The amount is too high or too low for the issuer or provider.                                   |
| `invalid_payment_details`         | The provider says the payment method is not valid, typically expired.                           |
| `issuer_unavailable`              | The provider could not reach the issuer.                                                        |
| `not_enough_balance`              | Insufficient funds or a funds limit was reached.                                                |
| `preferred_network_not_supported` | The card network chosen by the customer is not supported by the provider.                       |
| `prepaid_card_not_supported`      | Prepaid cards are blocked on the seller's account.                                              |
| `psp_error`                       | Something went wrong at the payment provider, no other details.                                 |
| `redacted_payment_method`         | The provider did not receive the payment method details because they were redacted.             |
| `system_error`                    | A problem on the Paddle platform; Paddle suggests trying later.                                 |
| `transaction_not_permitted`       | The issuer does not allow this kind of payment (account limits, legal or compliance reasons).   |
| `unknown`                         | Unsuccessful with no other information.                                                         |

### 4.4 Adjustments (S15, S16, S21 `AdjustmentAction`, `AdjustmentStatus`)

Adjustments refund or credit all or part of a completed or billed transaction. `transaction_id` links an adjustment to its transaction; `subscription_id` and `customer_id` are copied from the transaction. `type` is `full` or `partial`. `totals.total` is the adjusted amount in the lowest denomination, with `totals.currency_code` (S15 example).

| Action                       | Meaning (paraphrased)                                                     | Stage    |
| ---------------------------- | ------------------------------------------------------------------------- | -------- |
| `refund`                     | Refunds some or all of the transaction; most live refunds need approval.  | refund   |
| `credit`                     | Credits some or all of the transaction; no approval needed. Not a refund. | other    |
| `chargeback`                 | Created by Paddle when a customer disputes a charge successfully.         | dispute  |
| `chargeback_warning`         | Created by Paddle to warn of an upcoming chargeback.                      | dispute  |
| `chargeback_reverse`         | Created by Paddle when it contests a chargeback successfully.             | dispute  |
| `chargeback_warning_reverse` | Reversal of a chargeback warning.                                         | dispute  |
| `credit_reverse`             | Reversal of a credit.                                                     | reversal |

| Status             | Meaning (paraphrased)                                                     | Outcome for refund and credit |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------- |
| `pending_approval` | Waiting for Paddle's review (most live refunds).                          | pending                       |
| `approved`         | Approved; credits start here, and refunds that Paddle approves move here. | success                       |
| `rejected`         | Paddle rejected the refund.                                               | failure                       |
| `reversed`         | A reversal adjustment was created for this adjustment.                    | unknown                       |

Chargeback family outcomes stay `unknown`: the docs do not say what an approved chargeback adjustment means for the merchant beyond its creation.

Discrepancy: the `reversed` description names `chargeback_reversal` and `credit_reversal`, while the action enum uses `chargeback_reverse` and `credit_reverse`. The adapter uses the enum values.

Whether `approved` on a refund means the money has reached the customer: **NOT DOCUMENTED**. The adapter reads `approved` as a successful refund adjustment, not as funds received.

### 4.5 Subscriptions (S17, S20, S21 `StatusSubscription`)

| Status     | Meaning (paraphrased)                                                                             | Stage / outcome        |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| `active`   | Billing normally, no past due transactions.                                                       | subscription / success |
| `trialing` | In trial.                                                                                         | subscription / pending |
| `past_due` | Has an overdue payment; Paddle retries automatic renewals according to payment recovery settings. | subscription / pending |
| `paused`   | Paused, now or by a scheduled change.                                                             | subscription / unknown |
| `canceled` | Canceled, now or by a scheduled change. Final.                                                    | cancellation / success |

`subscription.created` carries `transaction_id`, the transaction that caused the subscription. Other subscription events and the API entity do not (S17).

### 4.6 Event types in scope (S6, S9-S17, S21 `EventTypeName`)

- Transactions: `transaction.created`, `transaction.ready`, `transaction.billed`, `transaction.updated`, `transaction.revised`, `transaction.paid`, `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`, `transaction.canceled`.
- Adjustments: `adjustment.created`, `adjustment.updated`.
- Subscriptions: `subscription.created`, `subscription.imported`, `subscription.trialing`, `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`.

The other documented event types (addresses, API keys, businesses, client tokens, customers, discounts, meters, payment methods, payouts, prices, products, reports, usage balances) are outside the payment flow. The adapter keeps their name and marks them as not analyzed.

Typical checkout sequence (S6): `transaction.created`, `customer.created`, `address.created`, optionally `business.created`, `transaction.paid`, `subscription.created` for recurring items, `transaction.completed`. Paddle says `transaction.paid` is the earliest point where payment is captured.

---

## 5. Errors in the catalog

PandaPayLens maps API error codes to a category and retry guidance. These mappings are PandaPayLens decisions. Retry is suggested as safe only where Paddle says the request was not processed (`bad_gateway`, `internal_error`, `service_unavailable`), or where the request was rejected before processing (`too_many_requests`).

Catalogued groups from S3 (paraphrased in `packages/adapters/paddle/src/catalog.ts`):

- **Generic (all 29)**: authentication header problems and invalid keys or tokens (403/401), forbidden, not found, invalid URL, method not allowed, validation (`invalid_field`), invalid JSON, conflicts and concurrent modification (409), archived entities, size limits (413, 431), unsupported media type (415), rate limiting (429), internal error (500), not implemented (501), bad gateway (502), service unavailable (503), temporarily unavailable (540), Paddle Billing not enabled, receipt data not enabled, sandbox-only gaps.
- **Adjustments (all 18)**: amount above what remains, zero amount, invalid item type mix, credit on automatically-collected transactions, no tax to adjust, refund rounds to zero in payout currency, pending refund blocks further adjustments, tax mode only for partial refunds, customer or subscription mismatch, transaction status not eligible for credit or refund, item already fully adjusted, invalid or over-adjusted items, missing customer, transaction without captured payment.
- **Transactions (payment-relevant subset, 19)**: immutable transactions, payment in progress, invalid status change, not ready for payment, balance below the minimum charge, checkout not enabled, creation blocked for compliance reasons, payout account or default payment link missing, price, product or discount not found, revise restrictions, manual collection currency, checkout URL domain not approved.
- **Subscriptions (payment-relevant subset, 21)**: payment declined, payment provider unavailable, immediate charge limits per hour and per day, locked during processing, renewal or pending change, outstanding transaction or pending refund, updates while past due or canceled, missing payment method for activate, resume, retry or update, charge below the minimum, not active, credits against processing or unpaid transactions.

Codes from other S3 groups (accounts, addresses, API keys, businesses, checkout domains, checkout payment methods, customers, discounts, meters, metrics, notifications, payment methods, prices, products, reports, statement descriptors) and the remaining transaction and subscription codes are not catalogued. They are reported with category `unknown` and confidence `insufficient`, with Paddle's `detail` text and `documentation_url` reference kept.

`subscription_payment_provider_unavailable` (500, typed `api_error`): Paddle calls it usually transient and retryable shortly, but does not say that no charge was made. PandaPayLens suggests verifying the subscription's transactions before retrying.

---

## 6. Webhooks

- Delivery: at least once. Paddle retries when it gets no `200` within five seconds (S6, S7).
- Retry schedule: sandbox 3 attempts within about two minutes; live up to 60 attempts over about two days with exponential backoff (S7).
- Duplicates: documented. Deduplicate by `event_id` (S6). S6 describes `notification_id` as the id of a delivery attempt and also says one event produces one notification per destination; whether a retry to the same destination keeps the same `notification_id` is **NOT DOCUMENTED**. The adapter uses `event_id` as the delivery key and keeps `notification_id` as an attribute.
- Ordering: not guaranteed; use `occurred_at` (S6, S7).
- Signature: `Paddle-Signature` header, `ts=<unix time>;h1=<HMAC-SHA256 hex>`, computed over the timestamp and the raw body with the endpoint secret (S8). It cannot be verified offline. The header is sensitive and is never copied; only its presence is reported.
- Source IP allowlists exist (S7); not used by the adapter.

---

## 7. Identifiers and correlation

- Transaction id `txn_`: the payment. Used as the payment reference for transaction events, and for adjustments through `transaction_id`.
- Payment attempt `payment_attempt_id` (UUID): one attempt; used as the attempt reference for decoded payment errors and as the related reference of attempt events from API snapshots.
- Adjustment id `adj_`: related reference of adjustment events.
- Subscription id `sub_`: spans many transactions. Stored as the subscription reference. Subscription events use it as their related reference, so subscription events group together, and `subscription.created` links them to the transaction in its `transaction_id`. Transaction events do not use it as a correlation key, so renewal transactions stay separate.
- Not used for correlation: `customer_id`, `address_id`, `business_id`, `invoice_id`, `invoice_number`, `custom_data`, `discount_id`.

---

## 8. Sensitive fields

- `payments[].method_details.card` (`last4`, `expiry_month`, `expiry_year`, `cardholder_name`, card type), `method_details.paypal` (email, reference), `underlying_details`.
- `custom_data` on transactions and subscriptions (seller defined, can hold personal data).
- `billing_details`, `checkout.url`, `management_urls` (customer portal links), adjustment `reason` (free text).
- Customer, address and business entities in other event types.
- `Paddle-Signature` header.

The adapter copies none of these. It copies ids, statuses, collection mode, origin, amounts and codes only.

---

## 9. Detection hints

- Notification: `event_id` starting `evt_`, `event_type` of the form `entity.action`, `occurred_at`, object `data`, and `notification_id` starting `ntf_`. Paddle-only combination: `event_id` together with `event_type` and `occurred_at` (Stripe uses `id`, `type`, `object: "event"`; PayPal uses `id` and `event_type`).
- Error: `error.type` in `request_error` / `api_error`, string `error.code` and `error.detail`, and `error.documentation_url` or `meta.request_id`. A bare `{ error: { type, code } }` is not claimed.
- Entity response: `data` object whose `id` starts with `txn_`, `adj_` or `sub_`, with a `status`, plus `meta.request_id`.

---

## 10. Business category

Paddle calls itself a merchant of record (S22) and documents cards, wallets and local payment methods (S23). The manifest lists `merchant_account_intermediary`, `card_processing` and `alternative_payment_method`. Merchant sectors were not researched.

---

## 11. Limitations

- Webhook signatures cannot be verified offline.
- Only transaction, adjustment and subscription entities are analyzed. List responses, Paddle Classic payloads and other entity types are recognized or ignored, not analyzed.
- 87 of the 227 documented API error codes are catalogued (section 5); the rest stay unknown.
- Whether an approved refund adjustment means the funds reached the customer: **NOT DOCUMENTED**.
- The meaning of the chargeback family statuses for the merchant: **NOT DOCUMENTED** beyond creation.
- Payment attempt timing: only `created_at` and `captured_at` exist; the time an attempt failed is **NOT DOCUMENTED** separately.
- Amount fields are strings in the lowest denomination; decimal places per currency follow ISO 4217 via the shared helpers.
