# GoCardless: provider research for the `gocardless` adapter

Verification date: **2026-11-17**.
Scope: the adapter parses payloads that users paste. It never calls GoCardless.

Rule for this document: every statement comes from an official GoCardless developer documentation page (`developer.gocardless.com`, now served from `docs.gocardless.com`) that was read on the verification date. Anything the docs do not state is marked **NOT DOCUMENTED**. Category, stage, outcome and retry mappings are PandaPayLens decisions, not GoCardless statements, and are labelled that way. Code tables are summarized in our own words; follow the links for the full wording.

---

## 1. Sources

All pages were fetched on 2026-11-17. `https://developer.gocardless.com/api-reference` and the pages under `https://developer.gocardless.com/docs/` redirect to the same paths on `https://docs.gocardless.com`, which are the URLs listed here.

| #   | URL                                                                            | Used for                                                                             |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| S1  | https://docs.gocardless.com/docs/api-reference/responses-and-errors            | HTTP status codes, error envelope, error types and reasons, error examples           |
| S2  | https://docs.gocardless.com/docs/api-reference/webhooks                        | Webhook delivery, duplicates, ordering, retries, signature header, `meta.webhook_id` |
| S3  | https://docs.gocardless.com/docs/getting-started/stay-up-to-date-with-webhooks | Webhook body example (`{"events": [...]}`), maximum of 250 events per webhook        |
| S4  | https://docs.gocardless.com/docs/api-reference/event                           | Event object fields, `links.*`, list and single-event response envelopes             |
| S5  | https://docs.gocardless.com/docs/api-reference/events                          | Event anatomy, `details.origin` values, `details.cause` guidance                     |
| S6  | https://docs.gocardless.com/docs/api-reference/events/payment                  | Payment actions and causes                                                           |
| S7  | https://docs.gocardless.com/docs/api-reference/events/mandate                  | Mandate actions and causes                                                           |
| S8  | https://docs.gocardless.com/docs/api-reference/events/refund                   | Refund actions and causes                                                            |
| S9  | https://docs.gocardless.com/docs/api-reference/events/payout                   | Payout actions and causes                                                            |
| S10 | https://docs.gocardless.com/docs/api-reference/events/subscription             | Subscription actions and causes                                                      |
| S11 | https://docs.gocardless.com/docs/api-reference/payment                         | Payment resource, status values, `links`, retry and cancel endpoints                 |
| S12 | https://docs.gocardless.com/docs/api-reference/refund                          | Refund resource, status values, `links`                                              |
| S13 | https://docs.gocardless.com/docs/api-reference/mandate                         | Mandate status values                                                                |
| S14 | https://docs.gocardless.com/docs/api-reference/payout                          | Payout status values                                                                 |
| S15 | https://docs.gocardless.com/docs/api-reference/subscription                    | Subscription status values                                                           |
| S16 | https://docs.gocardless.com/docs/api-reference/webhook                         | Webhook resource (`request_body`, `request_headers` example)                         |
| S17 | https://docs.gocardless.com/docs/api-reference/making-requests                 | API version header, base URLs, content type                                          |
| S18 | https://docs.gocardless.com/docs/api-reference/limits                          | Rate limit, timeouts, idempotency keys and `idempotent_creation_conflict`            |

---

## 2. API families and versions

- Pro API, version `2015-07-06`, sent in the `GoCardless-Version` header (S17). It is the only version listed.
- Requests and responses are JSON (`application/json` or `application/vnd.api+json`) (S17).
- Resources in scope: events (webhooks and the Events API), payments, refunds, mandates, payouts, subscriptions.
- Out of scope: billing requests, instalment schedules, creditors, customers, exports, outbound payments, payer authorisations, scheme identifiers, payment account transactions. Events for these resource types are recognized as GoCardless events but their actions are not interpreted.

## 3. Response envelopes

Every resource is wrapped in a key named after the resource collection (S11, S12, S4):

- Single payment: `{"payments": { "id": "PM...", ... }}`. Single refund: `{"refunds": { "id": "RF...", ... }}`.
- Single event (`GET /events/{id}`): `{"events": { ... }}`, an object, not an array (S4).
- Event list (`GET /events`): `{"meta": {"cursors": {...}, "limit": n}, "events": [ ... ], "linked": {...}}`; `linked` only with `include` (S4).
- Webhook body: `{"events": [ ... ]}` with one or more events, at most 250 (S3). S2 names a `meta.webhook_id` field in the webhook payload. Its exact position next to `events` is not shown in any example: **NOT DOCUMENTED** beyond the name. The adapter reads it only as an optional attribute.

Identifier prefixes (S4, S11-S15): events `EV`, payments `PM`, refunds `RF`, mandates `MD`, payouts `PO`, subscriptions `SB`, creditors `CR`, customers `CU`.

Amounts are integers in the lowest currency unit (S11, S12). Timestamps (`created_at`) are ISO 8601 with a `Z` suffix in all examples.

## 4. Error responses (S1, S18)

Envelope: `{"error": {"type", "code", "message", "documentation_url", "request_id", "errors": [...]}}`.

- `type` is one of `gocardless`, `invalid_api_usage`, `invalid_state`, `validation_failed`.
- `code` is the HTTP status as an integer.
- `errors[]` items carry `field`, `message` and `request_pointer` for field validation failures, and `reason` and `message` otherwise. A `validation_failed` example with `reason: bank_account_exists` and `links` also exists, so both shapes appear under that type.
- `idempotent_creation_conflict` (409) carries `links.conflicting_resource_id` (S18).

GoCardless guidance per type (S1), paraphrased: `gocardless` is an internal problem, report it with the request id; `invalid_api_usage` is a fault in how the request was built; `invalid_state` should be shown to the user and not retried; `validation_failed` asks the user to fix the input.

Reasons per type, paraphrased (full list in S1):

- `gocardless`: internal error, request timeout, database query timeout.
- `invalid_api_usage`: wrong JSON types or unknown parameters, unknown path, resource or linked resource not found, credentials not recognized or not permitted, feature not enabled, Accept or Content-Type problems, body too large, rate limit, access token missing, disabled or revoked, missing or malformed Authorization header, missing scope, action only possible in the dashboard, PATCH used, bad syntax, idempotency key over 128 characters, parameters not nested under the resource name, HTTP instead of HTTPS, missing or unknown version header, invalid filters, body on a GET, removed customer data, archived payout items.
- `invalid_state`: resource not cancellable, payment could not be retried, bank account already disabled, mandate inactive, mandate replaced, bank account disabled, mandate not reinstatable, refund would not reach the account, payment not yet `confirmed` or `paid_out` for a refund, refund total confirmation mismatch, more than 5 refunds, idempotency key already used, bank account token already used, billing request not ready.
- `validation_failed`: bank account already exists, creditor balance too low for the refund (`metadata.available_refund_amount`), plus field errors.

HTTP statuses (S1): 400, 401, 403, 404, 405, 406, 409, 410, 415, 422, 426, 429, 500, 504. 500 and 504 are described as "retry, and report if it persists". 429 requests are "safe to retry" (S18). The request timeout is 29 seconds (S18).

PandaPayLens decisions:

- `DecodedError.code` is the first `errors[].reason`, or the `type` when no reason is given. `type` and the HTTP code go to `subCodes`.
- `invalid_state` reasons: `do_not_retry` (S1 says do not allow a retry).
- Internal errors and timeouts: `retry_conditionally`, because the outcome of a creation request is unknown. S18 warns that retrying without an idempotency key can collect a payment twice.
- `rate_limit_exceeded`: `safe_to_retry_technical_request` (S18).
- `idempotent_creation_conflict`: category `duplicate_request`, `do_not_retry`, outcome known (the original resource exists).
- Field errors without a reason: `invalid_request`, `customer_action_required`.
- Unknown reasons: category `unknown`, confidence `insufficient`.

## 5. Events (S4, S5)

Fields used: `id` (`EV...`), `created_at`, `resource_type`, `action`, `details.origin` (`bank`, `api`, `gocardless`, `customer`, `payer`), `details.cause`, `details.scheme`, `details.reason_code`, `details.will_attempt_retry`, `details.not_retried_reason` (`failure_filter_applied` or `other`), `links.*`.

- GoCardless asks integrators to branch on `details.cause`, not on `details.reason_code`, which is scheme and bank specific (S2, S5). The adapter does not decode reason codes; it copies them as an attribute only.
- `details.description` can change without notice and is not parsed (S5). It is free text and is not copied.
- `metadata`, `resource_metadata`, `source.name` and `customer_notifications` are merchant or customer data and are never copied.
- `links.payment` is documented for `resource_type: payments`, `links.refund` for refunds, `links.mandate` for mandates, `links.payout` for payouts, `links.subscription` for subscriptions. `links.parent_event` names the event that caused this one (for example a mandate cancellation that cancels its pending payments).
- Whether refund events also carry `links.payment`: **NOT DOCUMENTED**. Refund events are linked to the payment only through a refund snapshot (`links.payment`).
- Whether subscription `payment_created` events carry `links.payment`: **NOT DOCUMENTED**.

### Actions per resource type, and PandaPayLens stage and outcome

Payments (S6): `created`, `customer_approval_granted`, `customer_approval_denied`, `submitted`, `confirmed`, `chargeback_cancelled`, `paid_out`, `late_failure_settled`, `chargeback_settled`, `surcharge_fee_debited`, `failed`, `charged_back`, `cancelled`, `resubmission_requested`, `sds_settlement_delayed`.

- `confirmed` means collected and held by GoCardless, not paid out: stage `payment`, outcome `success`.
- `paid_out` means sent to the creditor's bank account: stage `settlement`, outcome `success`.
- `failed` can follow `confirmed` when the bank reports late (S11): stage `payment`, outcome `failure`.
- `charged_back` and `chargeback_cancelled`: stage `dispute`, outcome `unknown`.
- `late_failure_settled`, `chargeback_settled`: deductions from a payout, stage `settlement`, outcome `unknown` (the failure is carried by the earlier event).
- `cancelled`: stage `cancellation`, outcome `failure`. `customer_approval_denied`: `payment`, `failure`.
- `created`, `customer_approval_granted`, `submitted`, `resubmission_requested`: `payment`, `pending`.
- `sds_settlement_delayed`: `settlement`, `pending`. `surcharge_fee_debited`: `other`, `unknown`.

Mandates (S7): `created`, `customer_approval_granted`, `customer_approval_skipped`, `active`, `cancelled`, `failed`, `transferred`, `expired`, `submitted`, `resubmission_requested`, `reinstated`, `replaced`, `consumed`, `blocked`. A mandate is a standing authority to collect, not a payment authorization: stage `other`. Outcome: `active` and `reinstated` success; `failed`, `cancelled`, `expired`, `blocked` failure; `created`, `customer_approval_*`, `submitted`, `resubmission_requested` pending; `transferred`, `replaced`, `consumed` unknown.

Refunds (S8): `created` (refund/pending), `paid` (refund/success), `failed` (refund/failure), `refund_settled` (settlement/unknown), `funds_returned` (settlement/unknown). S8 states that `failed` and `refund_settled` are independent: a refund can fail after it was settled, and the funds then come back to the merchant.

Payouts (S9): `paid`, `paid_again` (settlement/success), `fx_rate_confirmed`, `tax_exchange_rates_confirmed` (settlement/unknown). A GoCardless payout transfers collected funds to the merchant, so it is mapped to `settlement`, not to `payout` (which in PandaPayLens means a disbursement to a recipient). FX payouts emit `paid` but stay `pending` until `fx_rate_confirmed` (S9). No payout failure event is documented; a payout can have status `bounced` (S14).

Subscriptions (S10): `created`, `customer_approval_granted`, `customer_approval_denied`, `amended`, `payment_created`, `cancelled`, `finished`, `paused`, `resumed`, `scheduled_pause`, `scheduled_pause_cancelled`, `scheduled_resume`. Stage `subscription`; outcome `success` (the change happened) except `customer_approval_denied` (failure).

### Causes

The causes listed for payment `failed` and `cancelled`, mandate `failed` and `cancelled`, and refund `failed` are catalogued with a short paraphrase, a category and retry guidance (PandaPayLens decisions). The same cause can stand for different bank reports in different schemes (for example `refer_to_payer` covers insufficient funds, refusals and unspecified failures), so explanations stay general and category `unknown` is used where a cause is a catch-all.

- Discrepancy: the cause `bank_account_disabled` appears in examples on S4 and S3 but in none of the cause tables (S6-S10). It is not in the catalog and decodes as unknown.
- `will_attempt_retry: true` on a failed payment means GoCardless will retry automatically (S6). The decoder then advises against a manual retry. `POST /payments/{id}/actions/retry` works only when the mandate is active, up to 3 times (S11).

## 6. Resource status values

- Payment (S11): `pending_customer_approval`, `pending_submission`, `submitted`, `confirmed`, `paid_out`, `cancelled`, `customer_approval_denied`, `failed`, `charged_back`.
- Refund (S12): `created`, `pending_submission`, `submitted`, `paid`, `cancelled`, `bounced`, `funds_returned`.
- Mandate (S13): `pending_customer_approval`, `pending_submission`, `submitted`, `active`, `suspended_by_payer`, `failed`, `cancelled`, `expired`, `consumed`, `blocked`.
- Payout (S14): `pending`, `paid`, `bounced`.
- Subscription (S15): `pending_customer_approval`, `customer_approval_denied`, `active`, `finished`, `cancelled`, `paused`.

Payment and refund snapshots are analyzed. Mandate, payout and subscription snapshots are not in scope.

## 7. Webhook delivery (S2, S3)

- At least once delivery; the same event can appear in more than one webhook. Deduplicate on `events[].id`, not on `meta.webhook_id`, which identifies the delivery attempt.
- Webhooks can arrive out of order; GoCardless recommends fetching the current resource state.
- 9 delivery attempts in total (1 initial and 8 retries) at increasing intervals; a 10 second response timeout counts as a failure.
- Unknown event types should be acknowledged with 204 and ignored; GoCardless may add event types without notice.
- Signature: `Webhook-Signature` header, HMAC-SHA256 hex digest of the raw body with the endpoint secret. It cannot be verified offline. The header value is sensitive and never copied; only its presence is reported.

## 8. Correlation (PandaPayLens decisions)

- Payment events: `links.payment`. Payment snapshots: `id`.
- Refund events: `links.refund`. Refund snapshots: `id` and `links.payment`, which connects the refund to its payment.
- Mandate, payout and subscription events link only events of the same mandate, payout or subscription. A payment's mandate, payout, subscription and `parent_event` are never used to link payments, because one mandate cancellation fans out to every pending payment of that mandate and one payout contains many payments.
- `deliveryKey`: the event id.

## 9. Detection hints

- Event: `resource_type` and `action` strings, a `details` or `links` object, and an `id` with the `EV` prefix.
- Webhook or list: an `events` array whose items look like events.
- Error: `error.type` is one of the four documented types and `error.code` is an integer, with `request_id` or an `errors` array.
- Snapshots: a `payments` or `refunds` object with `id` prefixed `PM` or `RF` and a `status` string.

## 10. Known limitations

- Reason codes (`details.reason_code`) are not decoded.
- Billing request, instalment schedule and other resource events are recognized but not interpreted.
- Mandate, payout and subscription snapshots are not analyzed.
- Signatures cannot be verified.
- Event times are when GoCardless created the event; event creation is asynchronous (S4), so it can lag the underlying change.
