# Mollie: provider research for the `mollie` adapter

Status: research only. No adapter code exists yet.
Verification date: **2026-10-25**.
Scope: the adapter parses payloads that users paste. It never calls Mollie.

Rule for this document: every statement comes from an official page at `docs.mollie.com` that was read on the verification date. Anything the docs do not state is marked **NOT DOCUMENTED**. Category and retry mappings in section 4 are PandaPayLens decisions, not Mollie statements, and are labelled that way.

---

## 1. Sources

All pages were fetched as raw Markdown, using the `.md` variant of each URL (for example `https://docs.mollie.com/reference/handling-errors.md`). Each page's `updatedAt` front-matter value is shown where it was present.

| #   | URL                                                                                                       | Used for                                                                                    | updatedAt  |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| S1  | https://docs.mollie.com/reference/handling-errors                                                         | Error format, HTTP status table, error examples                                             | 2025-05-20 |
| S2  | https://docs.mollie.com/reference/get-payment                                                             | Payment object schema (OpenAPI 3.1 embedded in page), examples, `embed` param               | (OpenAPI)  |
| S3  | https://docs.mollie.com/reference/extra-payment-parameters                                                | `details.*` per method, `details.failureReason` enum                                        | 2026-10-07 |
| S4  | https://docs.mollie.com/docs/handling-payment-status                                                      | Payment statuses, webhook-per-status table, expiry times, status flow diagram               | 2026-10-22 |
| S4a | https://files.readme.io/7b7b86584883528a4917ec7f1aa99d8cf07b600d8d2d10eb2206b35c195dbb7d-Status_flows.png | Status flow diagram embedded in S4 (image, read visually)                                   | n/a        |
| S5  | https://docs.mollie.com/reference/webhooks                                                                | Classic webhooks (form-encoded `id`), retry schedule, what triggers them                    | 2026-01-16 |
| S6  | https://docs.mollie.com/reference/webhooks-new                                                            | Next-gen webhooks (event envelope, `X-Mollie-Signature`, event types, retry, blocked state) | 2026-09-16 |
| S7  | https://docs.mollie.com/reference/webhooks-best-practices                                                 | HMAC verification example                                                                   | n/a        |
| S8  | https://docs.mollie.com/reference/payments-api-webhooks                                                   | `payment.*` event list and payload examples                                                 | n/a        |
| S9  | https://docs.mollie.com/reference/refunds-api-webhooks                                                    | `refund.*` event list and payload examples                                                  | n/a        |
| S10 | https://docs.mollie.com/reference/chargebacks-api-webhooks                                                | `chargeback.*` events and payload examples                                                  | n/a        |
| S11 | https://docs.mollie.com/reference/captures-api-webhooks                                                   | `capture.*` events and payload examples                                                     | n/a        |
| S12 | https://docs.mollie.com/reference/get-refund                                                              | Refund schema and status enum                                                               | 2026-05-27 |
| S13 | https://docs.mollie.com/reference/get-chargeback                                                          | Chargeback schema and examples                                                              | n/a        |
| S14 | https://docs.mollie.com/reference/get-capture                                                             | Capture schema and status values; shared error schema                                       | n/a        |
| S15 | https://docs.mollie.com/reference/get-webhook-event                                                       | Event object schema (`resource:"event"`)                                                    | n/a        |
| S16 | https://docs.mollie.com/reference/create-webhook                                                          | Full list of next-gen event types                                                           | n/a        |
| S17 | https://docs.mollie.com/docs/refunds                                                                      | Refund status table, refund error and retry guidance                                        | n/a        |
| S18 | https://docs.mollie.com/reference/status-reasons                                                          | `statusReason` codes (point-of-sale only)                                                   | 2026-06-16 |
| S19 | https://docs.mollie.com/reference/orders-api                                                              | Orders API "no longer recommended"                                                          | n/a        |
| S20 | https://docs.mollie.com/docs/migrating-from-orders-to-payments                                            | Orders to Payments migration, `ord_` example                                                | n/a        |
| S21 | https://docs.mollie.com/docs/order-status-changes                                                         | Order statuses (legacy)                                                                     | n/a        |
| S22 | https://docs.mollie.com/docs/place-a-hold-for-a-payment                                                   | Capture statuses, authorization release and expiry transitions                              | n/a        |
| S23 | https://docs.mollie.com/reference/common-data-types                                                       | Identifier prefixes, amount object                                                          | n/a        |
| S24 | https://docs.mollie.com/docs/multicurrency                                                                | Currency decimal places                                                                     | n/a        |
| S25 | https://docs.mollie.com/reference/api-idempotency                                                         | `Idempotency-Key`, 400/409 semantics                                                        | n/a        |
| S26 | https://docs.mollie.com/reference/rate-limiting                                                           | 429 body example, `Retry-After`, `RateLimit` headers                                        | n/a        |
| S27 | https://docs.mollie.com/reference/security                                                                | "Webhooks never contain sensitive information"                                              | n/a        |
| S28 | https://docs.mollie.com/reference/authentication                                                          | Credential types (no key prefix rules found)                                                | n/a        |
| S29 | https://docs.mollie.com/llms.txt                                                                          | Docs index, used to discover pages                                                          | n/a        |

A page for `reference/status-changes` returned 404. The current payment-status page is S4.

---

## 2. API families and versions

| Family                                                     | Status per docs                                                                                                                                                | Notes                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments API v2** (`https://api.mollie.com/v2/payments`) | Current, recommended                                                                                                                                           | Servers block in S2: `https://api.mollie.com/v2`. Refunds, chargebacks and captures are sub-resources of a payment: `/v2/payments/{paymentId}/refunds/{refundId}`, `/chargebacks/{id}`, `/captures/{id}` (S12-S14). |
| **Orders API v2** (`/v2/orders`)                           | "We no longer recommend using the Orders API. Please refer to the Payments API instead." (S19). Every Orders endpoint summary in S29 carries the same warning. | A formal removal or sunset date is **NOT DOCUMENTED** in the pages read. Order IDs use `ord_` (S2 pattern `^ord_.+$`; S20 example `ord_pbjz8x`). A payment can carry `orderId` and `_links.order` (S2).             |
| **API v1**                                                 | S1 marks 409 and 410 as "(only in v2)", which implies a v1 existed.                                                                                            | v1 payloads are **NOT DOCUMENTED** in the pages read. Out of scope.                                                                                                                                                 |
| **Classic webhooks**                                       | Current. Recommended for payment updates (S6, see section 6).                                                                                                  | `POST`, `application/x-www-form-urlencoded`, body `id=<resource id>` only (S5).                                                                                                                                     |
| **Next-gen webhooks**                                      | Labelled "Next-gen Webhooks (beta)" in the S5 callout. Configured via the Webhooks API or the Dashboard.                                                       | JSON event envelope `resource:"event"`, HMAC-SHA256 `X-Mollie-Signature` (S6). Payment, refund, chargeback and capture events exist (S8-S11, S16), some only in beta (S6).                                          |
| **Webhook Events API** (`/v2/events/{id}`)                 | Documented (S15)                                                                                                                                               | Lets an integrator fetch an event object later. Its shape is the same as the next-gen envelope.                                                                                                                     |

**First target for the adapter:** the Payments API v2 **payment object** (`resource:"payment"`), as returned by `GET /v2/payments/{id}`. It is also the payload of next-gen `payment.*` events (S8: "The payload of a webhook is always simply a snapshot of the entity, as returned by the GET endpoint"). After that, add the v2 error object, then refund, chargeback and capture objects, then the next-gen event envelope. Orders API objects come last, or never, because the API is no longer recommended.

---

## 3. Error response format and payment object shape

### 3.1 Error object (v2)

Schema, transcribed from the OpenAPI error schema shared by S2 and S14 (`"description": "An error response object."`):

| Field                  | Type             | Required | Doc description (abridged)                                                                                                                                                                                                              |
| ---------------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`               | integer, 400-599 | yes      | "The status code of the error message. This is always the same code as the status code of the HTTP message itself."                                                                                                                     |
| `title`                | string           | yes      | "The HTTP reason phrase of the error. For example, for a `404` error, the `title` will be `Not Found`."                                                                                                                                 |
| `detail`               | string           | yes      | "A detailed human-readable description of the error that occurred."                                                                                                                                                                     |
| `field`                | string           | no       | "If the error was caused by a value provided by you in a specific field, the `field` property will contain the name of the field that caused the issue." S1 says it appears with 422 responses ("usually contains a `field` property"). |
| `_links.documentation` | `{href, type}`   | yes      | "The URL to the generic Mollie API error handling guide." `type` is `text/html`.                                                                                                                                                        |

Content-Type: S1 examples show both `application/hal+json` (401, 422) and `application/json` (404). Do not rely on Content-Type.

The value of `_links.documentation.href` varies across docs examples: `https://docs.mollie.com/overview/authentication` (S1, 401), `https://docs.mollie.com/errors` (S1, 404/422), `https://docs.mollie.com/overview/handling-errors` (S26, 429). Do not use it for detection or classification.

No machine-readable error code exists beyond HTTP `status` and `field`. A Mollie-specific error `code` field is **NOT DOCUMENTED**. Classification has to use `status`, `field`, and possibly `detail` text, which is free text and not a stable contract.

**Example 1: 422 Unprocessable Entity (verbatim, S1, https://docs.mollie.com/reference/handling-errors)**

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/hal+json

{
    "status": 422,
    "title": "Unprocessable Entity",
    "detail": "The amount is higher than the maximum",
    "field": "amount",
    "_links": {
       "documentation": {
            "href": "https://docs.mollie.com/errors",
            "type": "text/html"
        }
    }
}
```

**Example 2: 401 Unauthorized (verbatim, S1)**

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/hal+json

{
    "status": 401,
    "title": "Unauthorized Request",
    "detail": "Missing authentication, or failed to authenticate",
    "_links": {
        "documentation": {
            "href": "https://docs.mollie.com/overview/authentication",
            "type": "text/html"
        }
    }
}
```

Note that `title` here is "Unauthorized Request", not the bare reason phrase. Treat `title` as display text.

**Example 3: 404 Not Found (verbatim, S1)**

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "No payment exists with token tr_I_dont_exist.",
  "_links": {
    "documentation": {
      "href": "https://docs.mollie.com/errors",
      "type": "text/html"
    }
  }
}
```

**Example 4: 429 Too Many Requests (verbatim body, S26, https://docs.mollie.com/reference/rate-limiting)**

```json
{
  "status": 429,
  "title": "Too Many Requests",
  "detail": "You have exceeded the rate limit. Please slow down your requests.",
  "_links": {
    "documentation": {
      "href": "https://docs.mollie.com/overview/handling-errors",
      "type": "text/html"
    }
  }
}
```

The 429 response carries the headers `Retry-After: <int seconds>` (429 only), `RateLimit-Policy` and `RateLimit` (S26).

### 3.2 Payment object (`resource: "payment"`)

Source: S2 OpenAPI schema plus S3 for `details`. Main fields:

| Field                                                                                                               | Type                                | Notes from docs                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource`                                                                                                          | string                              | "Will always contain the string `payment`"                                                                                                                                                                      |
| `id`                                                                                                                | string                              | `tr_` prefix, e.g. `tr_5B8cwPMGnU6qLbRvo7qEZo` (pattern `^tr_.+$`)                                                                                                                                              |
| `mode`                                                                                                              | string                              | `live` \| `test`                                                                                                                                                                                                |
| `status`                                                                                                            | string                              | `open` `pending` `authorized` `paid` `canceled` `expired` `failed`                                                                                                                                              |
| `statusReason`                                                                                                      | object\|null                        | `{code, message}`. "Currently it is only available for point-of-sale payments" (S2, S18)                                                                                                                        |
| `amount`                                                                                                            | `{currency, value}`                 | `value` is "A string containing an exact monetary amount in the given currency." Example `{currency:"EUR", value:"1000.00"}`                                                                                    |
| `amountRefunded`, `amountRemaining`, `amountCaptured`, `amountChargedBack`                                          | amount objects                      | Present in examples (S2 example 3)                                                                                                                                                                              |
| `settlementAmount`                                                                                                  | amount\|null                        | **Deprecated**. "will be removed on January 1st, 2027" (S2)                                                                                                                                                     |
| `description`                                                                                                       | string                              | max 255 chars                                                                                                                                                                                                   |
| `method`                                                                                                            | string\|null                        | ~35 values (e.g. `creditcard`, `ideal`, `banktransfer`, `paypal`, `applepay`, `klarna`, ...)                                                                                                                    |
| `details`                                                                                                           | object\|null                        | Method-specific (see S3 and sections 4 and 8)                                                                                                                                                                   |
| `metadata`                                                                                                          | string\|number\|object\|array\|null | Merchant-defined, about 1 kB. Examples show it as a **JSON-encoded string**: `"metadata": "{\"order_id\":12345}"`                                                                                               |
| `sequenceType`                                                                                                      | string                              | e.g. `oneoff` (also `first`, `recurring` per S3/S25)                                                                                                                                                            |
| `captureMode`, `captureDelay`, `captureBefore`                                                                      |                                     | Manual capture / holds (S22)                                                                                                                                                                                    |
| `isCancelable`                                                                                                      | boolean\|null                       | "omitted if the payment reaches a final state"                                                                                                                                                                  |
| `createdAt`                                                                                                         | ISO 8601                            | always                                                                                                                                                                                                          |
| `authorizedAt`                                                                                                      | ISO 8601                            | "omitted if the payment is not authorized (yet)"                                                                                                                                                                |
| `paidAt`                                                                                                            | ISO 8601                            | "omitted if the payment is not completed (yet)"                                                                                                                                                                 |
| `canceledAt`                                                                                                        | ISO 8601                            | "omitted if the payment is not canceled (yet)"                                                                                                                                                                  |
| `expiresAt`                                                                                                         | ISO 8601                            | "omitted if the payment can no longer expire" (a future deadline, not an event)                                                                                                                                 |
| `expiredAt`                                                                                                         | ISO 8601                            | "omitted if the payment did not expire (yet)" (the actual expiry event)                                                                                                                                         |
| `failedAt`                                                                                                          | ISO 8601                            | "omitted if the payment did not fail (yet)"                                                                                                                                                                     |
| `dueDate`                                                                                                           |                                     | bank transfer                                                                                                                                                                                                   |
| `profileId`                                                                                                         | `pfl_`                              |                                                                                                                                                                                                                 |
| `customerId` (`cst_`), `mandateId` (`mdt_`), `subscriptionId` (`sub_`), `orderId` (`ord_`), `settlementId` (`stl_`) |                                     | links to other resources                                                                                                                                                                                        |
| `redirectUrl`, `cancelUrl`, `webhookUrl`                                                                            | string                              |                                                                                                                                                                                                                 |
| `billingAddress`, `shippingAddress`                                                                                 | address objects                     | PII (section 8)                                                                                                                                                                                                 |
| `lines`, `routing`, `applicationFee`, `locale`, `countryCode`, `storeCredentials`, `testmode`                       |                                     |                                                                                                                                                                                                                 |
| `_links`                                                                                                            | object                              | `self`, `checkout`, `changePaymentState` (test mode), `dashboard`, `refunds`, `chargebacks`, `captures`, `settlement`, `customer`, `mandate`, `subscription`, `order`, `documentation`. Each is `{href, type}`. |

Timestamp formats in examples include both `+00:00` offsets (`2024-03-20T09:13:37+00:00`, S2/S8) and fractional `Z` (`2024-12-16T15:57:04.0Z`, S6 events). The parser must accept both.

Payment example (verbatim from S8, `payment.failed` payload, https://docs.mollie.com/reference/payments-api-webhooks):

```json
{
  "resource": "payment",
  "id": "tr_5B8cwPMGnU6qLbRvo7qEZo",
  "mode": "live",
  "amount": { "currency": "EUR", "value": "10.00" },
  "description": "Order #12345",
  "method": "creditcard",
  "sequenceType": "oneoff",
  "redirectUrl": "https://webshop.example.org/order/12345/",
  "webhookUrl": "https://webshop.example.org/payments/webhook/",
  "metadata": "{\"order_id\":12345}",
  "profileId": "pfl_QkEhN94Ba",
  "status": "failed",
  "isCancelable": null,
  "createdAt": "2024-03-20T09:13:37+00:00",
  "failedAt": "2024-03-20T09:15:02+00:00",
  "_links": {
    "self": {
      "href": "https://api.mollie.com/v2/payments/tr_5B8cwPMGnU6qLbRvo7qEZo",
      "type": "application/hal+json"
    },
    "dashboard": {
      "href": "https://www.mollie.com/dashboard/org_12345678/payments/tr_5B8cwPMGnU6qLbRvo7qEZo",
      "type": "text/html"
    },
    "documentation": {
      "href": "https://docs.mollie.com/reference/get-payment",
      "type": "text/html"
    }
  }
}
```

This official failed-payment example has **no `details` and no `failureReason`**. The adapter must not assume `details.failureReason` is present on failed payments.

Card `details` as seen in the S2 example (`get-payment-200-3`, test mode, status `paid`): `cardToken`, `cardNumber: "4444"`, `cardHolder: "T. TEST"`, `cardAudience`, `cardLabel: "Mastercard"`, `cardCountryCode: "NL"`, `cardSecurity: "3dsecure"`, `feeRegion: "other"`.

---

## 4. Codes

### 4.1 HTTP statuses (S1 "All possible status codes", with S25/S26 additions)

Mollie's own rule (S1): 4xx means the client caused it and "the error for this specific request usually will not go away by itself". 5xx means Mollie's side, and "the errors should subside without your mediation".

| HTTP            | Mollie meaning (paraphrase of S1)                                                                                                                                                                            | PPL category (our mapping)                                                                                                                                              | PPL retry (our mapping)                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 200 / 201 / 204 | Success / created / canceled-or-deleted                                                                                                                                                                      | n/a                                                                                                                                                                     | n/a                                                                                                  |
| 400             | Bad Request: Mollie could not understand the request, possibly a syntax error. S25 adds that it is also returned when the same `Idempotency-Key` is reused for a different endpoint or different parameters. | invalid_request (idempotency-key misuse: duplicate_request)                                                                                                             | do_not_retry                                                                                         |
| 401             | Unauthorized: authentication failed, check your API key                                                                                                                                                      | configuration                                                                                                                                                           | do_not_retry                                                                                         |
| 403             | Forbidden: no access to the requested resource                                                                                                                                                               | configuration                                                                                                                                                           | do_not_retry                                                                                         |
| 404             | Not Found: the object referenced by the URL does not exist                                                                                                                                                   | invalid_request                                                                                                                                                         | do_not_retry                                                                                         |
| 405             | Method Not Allowed: see the `Allow` header                                                                                                                                                                   | invalid_request                                                                                                                                                         | do_not_retry                                                                                         |
| 409             | Conflict: "a duplicate API call that was probably a mistake (only in v2)". S25: also returned when a second request with the same idempotency key arrives while the first is still processing.               | duplicate_request                                                                                                                                                       | retry_conditionally (after the first request completes, with the same idempotency key, S25)          |
| 410             | Gone: the object was previously deleted (v2 only)                                                                                                                                                            | invalid_request                                                                                                                                                         | do_not_retry                                                                                         |
| 415             | Unsupported Media Type: Mollie recommends always using JSON                                                                                                                                                  | invalid_request                                                                                                                                                         | do_not_retry                                                                                         |
| 422             | Unprocessable Entity: any other reason. Usually has a `field`. Can also mean the account's payment services are suspended (check the Dashboard).                                                             | invalid_request by default. `field:"amount"` maps to invalid_amount. Suspension (only recognisable from `detail` text, NOT DOCUMENTED as a code) maps to configuration. | do_not_retry (suspension: manual_review)                                                             |
| 429             | Too Many Requests: rate limit hit, "try again after a short period". Body in S26.                                                                                                                            | rate_limiting                                                                                                                                                           | safe_to_retry_technical_request (honour `Retry-After`)                                               |
| 500             | Internal Server Error: developers are notified automatically                                                                                                                                                 | provider_unavailable                                                                                                                                                    | retry_conditionally. S17: for refund creation, do not auto-retry on uncertainty, verify first.       |
| 502             | Bad Gateway: temporarily unavailable (calamity or maintenance), retry later                                                                                                                                  | provider_unavailable                                                                                                                                                    | safe_to_retry_technical_request                                                                      |
| 503             | Service Unavailable: same as 502, retry later. S17: for parallel refunds, a 503 means the refund was not performed and can safely be retried.                                                                | provider_unavailable                                                                                                                                                    | safe_to_retry_technical_request                                                                      |
| 504             | Gateway Timeout: "Your request is causing an unusually long process time."                                                                                                                                   | network_or_timeout                                                                                                                                                      | retry_conditionally. The outcome is unknown: check state first, or reuse an `Idempotency-Key` (S25). |

Non-retry-safe POSTs per S25: recurring payments (`sequenceType:recurring`), subscriptions and partial refunds. These are the cases where a blind retry can double-charge or double-refund.

### 4.2 `details.failureReason` (card payments)

Source: S3, section "Cards", https://docs.mollie.com/reference/extra-payment-parameters. The same list appears in the S15 embedded payment schema.
Doc text: "A failure code to help understand why the payment failed." Companion field `details.failureMessage`: "A human-friendly failure message that can be shown to the customer. The message is translated in accordance with the payment's locale setting."

There are exactly **15 documented values**. **Per-value descriptions are NOT DOCUMENTED.** Mollie lists only the enum. The "meaning" column below is the plain reading of the code name, labelled as such. Category and retry are PandaPayLens mappings, aligned with the existing Stripe catalog (`packages/adapters/stripe/src/catalog.ts`).

| Value (exact)                    | Meaning (name-derived, no Mollie description)         | Category                                                                         | Retry                    |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| `authentication_abandoned`       | Customer did not complete authentication (3DS)        | authentication_failed                                                            | customer_action_required |
| `authentication_failed`          | Authentication was attempted and failed               | authentication_failed                                                            | customer_action_required |
| `authentication_required`        | Issuer requires authentication that was not performed | authentication_required                                                          | customer_action_required |
| `authentication_unavailable_acs` | Issuer's authentication server (ACS) unavailable      | authentication_failed (technical issuer-side; alternative: provider_unavailable) | retry_conditionally      |
| `card_declined`                  | Card declined, no specific reason                     | card_declined                                                                    | customer_action_required |
| `card_expired`                   | Card has expired                                      | card_declined                                                                    | customer_action_required |
| `inactive_card`                  | Card is not active                                    | card_declined                                                                    | customer_action_required |
| `insufficient_funds`             | Not enough funds                                      | insufficient_funds                                                               | customer_action_required |
| `invalid_cvv`                    | CVV/CVC incorrect                                     | card_declined                                                                    | customer_action_required |
| `invalid_card_holder_name`       | Card holder name invalid                              | invalid_request                                                                  | customer_action_required |
| `invalid_card_number`            | Card number invalid                                   | card_declined                                                                    | customer_action_required |
| `invalid_card_type`              | Card type not accepted / not supported                | payment_method_unavailable                                                       | do_not_retry (same card) |
| `possible_fraud`                 | Suspected fraud                                       | fraud_or_risk                                                                    | do_not_retry             |
| `refused_by_issuer`              | Issuer refused                                        | card_declined                                                                    | customer_action_required |
| `unknown_reason`                 | Not specified                                         | unknown                                                                          | unknown                  |

Unknown future values: map to `unknown` / `unknown` and keep the raw string. Show `failureMessage` as the provider explanation when present.

### 4.3 Other failure-reason fields (secondary; document now, decide later)

- **`statusReason.code`**: point-of-sale payments only (S18). S18 lists 120 code rows (a few codes such as `refer_to_card_issuer`, `expired_card`, `insufficient_funds` and `invalid_pin` repeat across groups) across "Card scheme failures" (e.g. `do_not_honor`, `insufficient_funds`, `expired_card`, `invalid_pin`, `suspected_fraud`, `issuer_unavailable`, `system_malfunction`, `duplicate_transaction`, `decline_for_cvv2_failure`, `additional_customer_authentication_required`), "Merchant related failures" (e.g. `merchant_id_not_found`, `invalid_currency`), "Terminal failures" (`terminal_busy`, `terminal_unreachable`) and "Voucher failures". Unlike `failureReason`, these **do** have per-code descriptions in S18. Recommendation: phase 2, a separate catalog.
- **SEPA Direct Debit**: `details.bankReasonCode` ("The official reason why this payment has failed", which defers to the European Payments Council) and `details.bankReason` (human-friendly) (S3). Mollie's own list of codes is **NOT DOCUMENTED**.
- **Chargeback `reason`**: `{code, description}`, "Only available for chargebacks of SEPA Direct Debit payments" (S13). Example `{"code":"AC01","description":"Account identifier incorrect (i.e. invalid IBAN)"}`. Full code list **NOT DOCUMENTED** by Mollie.

---

## 5. Statuses and transitions

### 5.1 Payment (S2, S4, S22)

| Status       | Doc description (S4, paraphrased)                                         | Final? | Classic webhook fired? (S4) |
| ------------ | ------------------------------------------------------------------------- | ------ | --------------------------- |
| `open`       | Created; customer can still complete it                                   | no     | No                          |
| `pending`    | Temporary; payment process started but not complete                       | no     | Yes                         |
| `authorized` | For capture-capable methods: stays here while new captures can be created | no     | Yes                         |
| `paid`       | Customer completed the payment ("definitive")                             | yes*   | Yes                         |
| `canceled`   | Customer canceled ("definitive")                                          | yes    | Yes                         |
| `expired`    | Expired, e.g. abandoned ("definitive")                                    | yes    | Yes                         |
| `failed`     | Failed ("definitive")                                                     | yes    | Yes                         |

\* `paid` is final for the payment status, but the payment still receives refunds and chargebacks afterwards. These change `amountRefunded` and `amountChargedBack`, not `status`.

Transitions:

- **Status flow diagram (S4a, read visually):** `open` branches either directly to the four end states (`paid`, `canceled`, `expired`, `failed`), or through `pending` or `authorized`. Both of those then lead to the same four end states. The diagram does not draw an edge between `pending` and `authorized`. A `pending` to `authorized` transition is therefore **NOT DOCUMENTED** (neither confirmed nor excluded).
- **Text-confirmed transitions:**
  - `open` to `expired` after the method-specific expiry time (S4 table: iDEAL 15 min, creditcard 30 min, banktransfer 12(+2) days, and others).
  - `authorized` to `paid` once the full amount is captured, or when there is no authorized amount left (S22). Methods without multi-capture go to `paid` immediately after a partial capture (S22).
  - `authorized` to `canceled` on release-authorization when there are no captures. If there was a successful capture, it goes to `paid` instead (S22).
  - `authorized` to `expired` when the authorization window lapses with no captures. If partially captured, it goes to `paid` (S22).
  - A failed or canceled attempt in hosted checkout without a fixed `method` leaves the payment **`open`** (S4, "Redirect back to hosted checkout page"). A failed card attempt therefore does **not** always produce `status:"failed"`.
  - With Orders API methods (Klarna, Billie, Riverty), Payments API payments are captured immediately and become `paid`, unless `captureMode:"manual"` is set, which gives `authorized` (S20).

### 5.2 Refund (S12, S17)

Enum (S12): `queued` `pending` `processing` `refunded` `failed` `canceled`. "Refunds have their own status, independent of the Payment or Order" (S17).

| Status       | S17 description (paraphrased)                                               | Classic payment webhook? (S17 column) |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------- |
| `queued`     | Queued because of insufficient balance; can be canceled                     | No                                    |
| `pending`    | Ready to be picked up for processing; can still be canceled                 | No                                    |
| `canceled`   | Canceled; will not be processed                                             | No                                    |
| `processing` | Being processed; cancellation no longer possible                            | Yes                                   |
| `failed`     | Failed after processing (e.g. closed account); funds return to the merchant | Yes                                   |
| `refunded`   | Completed; funds received or on their way                                   | Yes                                   |

S5 confirms the classic **payment** webhook (with `id=tr_...`) is called when a refund reaches `processing`, `refunded` or `failed`. Next-gen has a `refund.<status>` event for all six statuses (beta, S6/S9).
Refund timestamps: only `createdAt` is documented (S12). There are **no** `refundedAt` or `failedAt` style fields, so a timeline cannot date refund status changes from the object alone.

### 5.3 Chargeback (S13)

The chargeback object has **no `status` field**. Its state comes from timestamps: `createdAt` (received) and `reversedAt` (null until reversed). Next-gen events: `chargeback.received`, `chargeback.reversed` (beta). The classic payment webhook fires "when a chargeback is received on the payment" (S5). Whether the classic webhook also fires on chargeback reversal is **NOT DOCUMENTED**.

### 5.4 Capture (S14, S22)

Values: `pending` `succeeded` `failed` (S14 description string; S22 table).

- `pending`: created, not yet processed (initial).
- `succeeded`: the payment moves to `paid` if no authorized amount remains.
- `failed`: e.g. the authorization has expired.

Capture timestamps: only `createdAt` (S14). Next-gen events: `capture.succeeded`, `capture.failed` (beta). Capture links: `paymentId`, optional `shipmentId` (`shp_`), `settlementId`.

### 5.5 Order (legacy, S21)

The statuses `created`, `paid`, `authorized`, `canceled`, `shipping`, `completed`, `expired`, `pending` and their transitions are listed in S21. Out of scope for the first adapter version.

---

## 6. Webhooks

### 6.1 Classic webhooks (S5, S6 "Classic Mollie webhooks", S27)

- Configured per resource by passing `webhookUrl` on create (payments, orders, subscriptions, payment links).
- Request: `POST`, `Content-Type: application/x-www-form-urlencoded`, body is a **single parameter `id`**. Verbatim example (S5):

  ```http
  POST /payments/webhook HTTP/1.1
  Host: webshop.example.org
  User-Agent: Mollie HTTP client/1.0
  Content-Type: application/x-www-form-urlencoded
  Accept: */*
  Accept-Encoding: deflate, gzip
  Content-Length: 28

  id=tr_5B8cwPMGnU6qLbRvo7qEZo
  ```

- Mollie states that the status is deliberately not sent: "Since the status is not transmitted in the webhook, fake calls to your webhook will never result in orders being processed without being actually paid." (S5). S27: "webhooks will only signal to your server that an update is ready to be fetched". S6: "our webhook system will only deliver the ID of the entity ... You are expected to retrieve the full object yourself via the relevant API to understand what changed."
- **No signature** of any kind. S5 advises against IP allow-listing but publishes `https://ip-ranges.mollie.com/ips.txt`. S6 tells integrators to tell the systems apart by the presence of `X-Mollie-Signature` on next-gen calls.
- Triggers for payments (S5): status reaches `paid`, `authorized`, `expired`, `failed` or `canceled`, **and** (S4 table) `pending`. A refund reaching `processing`, `refunded` or `failed`, and a chargeback being received, also trigger it. The webhook is not called when a customer cancels on a method-specific page and is sent back to hosted checkout. For orders: `paid`/`authorized`, shipment created, order or lines canceled, order or lines refunded.
- Note: S5's list of payment triggers omits `pending`, but S4's table marks `pending` with "Webhook: Yes". This is a minor inconsistency in the docs.
- For refunds and chargebacks, the classic webhook posts the **payment** id (`tr_`), not `re_` or `chb_`. The S5 wording is "the webhook will be called when a refund is performed on the payment". It does not say a refund id is posted.
- Retry (S5): only `200 OK` counts as success. Timeout 15 s. 10 attempts over 26 h: at 0, +1 min, +2, +4, +8, +16, +29 min, +1 h, +2 h, +22 h (cumulative 00:00, 00:01, 00:03, 00:07, 00:15, 00:31, 01:00, 02:00, 04:00, 26:00). Manual re-trigger is not possible (contact support). A 301/302 redirect drops the body; use 307/308.

**What PandaPayLens can do with a classic webhook (product-owner caution: confirmed).**
The body `id=tr_WDqYK6vllg` carries one identifier and nothing else: no status, amount, timestamp, event type or signature. It **cannot** be used to decode an error, determine status, or build a timeline. Recommended behaviour, mirroring how the Stripe adapter treats v2 "thin" events: _recognised but not supported_. Detect the form-encoded `id=<prefix>_...` body, return `supported:false` with an `unsupportedReason`, and tell the user what to paste instead:

1. **Required:** the JSON response of `GET https://api.mollie.com/v2/payments/{id}` for that id (the payment object, `resource:"payment"`). It gives the status, amount, `details.failureReason`/`failureMessage` (cards), and the milestone timestamps `createdAt`/`authorizedAt`/`paidAt`/`canceledAt`/`expiredAt`/`failedAt`.
2. **Optional, for refunds, chargebacks and captures:** the same call with `?embed=refunds,chargebacks,captures` (the `embed` query parameter and those three values are documented in S2). The JSON shape of the resulting `_embedded` block is **NOT DOCUMENTED** in the S2 response schema, so the adapter should parse it defensively. Alternatively, paste the individual refund (`re_`), chargeback (`chb_`) and capture (`cpt_`) objects. Each one carries `paymentId` for correlation.
3. If the id is not `tr_` (for example `ord_` from an Orders API webhook), the user should paste the corresponding GET response. Orders are out of scope at first.

Even with the full object, a classic flow gives a **snapshot**, not an event history. Intermediate statuses (`pending`, an `authorized` later captured) only appear if their `*At` timestamp survives on the object. `pendingAt` does not exist.

### 6.2 Next-gen webhooks (S6, S7, S8-S11, S15, S16)

- Configured by subscription (Webhooks API `POST /v2/webhooks` or the Dashboard), with a list of event types or `*`.
- **Envelope** (`resource:"event"`, S6 and S15 schema):

  | Field                                                    | Notes                                                                                                                            |
  | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | `resource`                                               | always `"event"`                                                                                                                 |
  | `id`                                                     | `event_` prefix (pattern `^event_.+$`), e.g. `event_GvJ8WHrp5isUdRub9CJyH`                                                       |
  | `type`                                                   | event type, e.g. `payment-link.paid`, `payment.paid`                                                                             |
  | `entityId`                                               | "The entity token that triggered the event", e.g. `pl_...`, `tr_...`                                                             |
  | `createdAt`                                              | event creation time                                                                                                              |
  | `_embedded.entity`                                       | **full payload only** (nullable). It is a snapshot of the entity as returned by its GET endpoint (S8-S11)                        |
  | `_links.self` / `_links.documentation` / `_links.entity` | S15 schema names `_links.entity`. The S6 examples instead show a type-named key (`"payment-link"`). Treat link keys as variable. |

- Two payload modes (S6): **full** (snapshot with `_embedded.entity`) and **simple** (ids and type only, no `_embedded`). "You always get the full payload via public API", while the simple payload applies "when using Dashboard or App". A simple payload has the same limitation as a classic webhook: it carries no status.
- Full payload example (verbatim, S6, https://docs.mollie.com/reference/webhooks-new). It is the only complete envelope example in the docs and it is for a payment link, not a payment:

  ```json
  {
    "resource": "event",
    "id": "event_GvJ8WHrp5isUdRub9CJyH",
    "type": "payment-link.paid",
    "entityId": "pl_qng5gbbv8NAZ5gpM5ZYgx",
    "createdAt": "2024-12-16T15:57:04.0Z",
    "_embedded": {
      "entity": {
        "id": "pl_qng5gbbv8NAZ5gpM5ZYgx",
        "profileId": "pfl_D96wnsu869",
        "mode": "live",
        "description": "Bicycle tires",
        "amount": {
          "currency": "EUR",
          "value": "24.95"
        },
        "archived": false,
        "redirectUrl": "https://webshop.example.org/thanks",
        "createdAt": "2021-03-20T09:29:56.0Z",
        "expiresAt": "2023-06-06T11:00:00.0Z",
        "reusable": true,
        "_links": { "...": "abridged here; see source" }
      }
    },
    "_links": {
      "self": {
        "href": "https://api.mollie.com/v2/events/event_GvJ8WHrp5isUdRub9CJyH",
        "type": "application/hal+json"
      },
      "documentation": {
        "href": "https://docs.mollie.com/guides/webhooks",
        "type": "text/html"
      },
      "payment-link": {
        "href": "/v2/payment-links/pl_qng5gbbv8NAZ5gpM5ZYgx",
        "type": "application/hal+json"
      }
    }
  }
  ```

  The S8-S11 "payload examples" for `payment.*`, `refund.*`, `chargeback.*` and `capture.*` show **only the entity** (the bare payment, refund and so on), not wrapped in the event envelope. A complete `payment.paid` envelope example is **NOT DOCUMENTED**. Expect it to look like the envelope above with a payment in `_embedded.entity`.

- **Signature** (S6): header `X-Mollie-Signature`, value like `sha256=<hex>`. It is an HMAC-SHA256 of the **unaltered raw POST body**, keyed with the merchant's signing secret. To verify: strip `sha256=`, compute the HMAC, compare. S7 recommends a timing-safe comparison. During secret rotation, **two** `X-Mollie-Signature` headers are sent for 24 h. A timestamp header or replay-protection window is **NOT DOCUMENTED**.
  - Doc inconsistencies to note: (a) The S7 PHP and Python samples compare the computed hex digest directly against the full header value, without stripping `sha256=`. That contradicts S6. (b) The example signature `sha256=4a4c6f3ed4d15fee87ad44e07a7fa9b8` is 32 hex characters, but a real HMAC-SHA256 hex digest is 64. It is illustrative only.
  - PandaPayLens never has the signing secret, so it cannot verify signatures. At most it can report "signature header present: yes/no, cannot verify locally".
- **Event types** (S16 enum: 47 types plus `*`). Payment-relevant ones:
  - `payment.authorized`, `payment.canceled`, `payment.expired`, `payment.failed`, `payment.paid`, `payment.pending` (S6 lists these as "Global Events").
  - `refund.queued`, `refund.pending`, `refund.processing`, `refund.refunded`, `refund.failed`, `refund.canceled` (Beta, S6).
  - `chargeback.received`, `chargeback.reversed` (Beta).
  - `capture.succeeded`, `capture.failed` (Beta).
  - `payment-link.paid` (Global).
  - `dispute.created`, `dispute.updated`, `dispute.resolved` (Beta in S6, but **absent** from the S16 create-webhook enum; the payload shape is NOT DOCUMENTED).
  - Also present: `balance-transaction.created`, `payout.*`, `sales-invoice.*`, `business-account-transfer.*`, `business-account-draft-transfer.*`, `unmatched-credit-transfer.*`, `connect-balance-transfer.*`, `file.*`.
  - There is **no `payment.created` event** in the S16 enum, even though the S6 "What's new" text mentions "payment creation" as an example.
- **Doc inconsistency:** S6 lists `payment.*` under Global Events, but S6 also says: "We recommend using classic webhooks for payment-related updates (until we make these event types available for Next-gen webhooks) and Next-gen for any non-payment actions." In practice most payment integrations will still be classic.
- Retry (S6): same 10-attempt, 26 h schedule, timeout >15 s. Live mode requires HTTPS. After repeated failures "over the 24h period" the webhook is marked `blocked` and delivery stops. Subscription limits: 2 in test mode, up to 3 in live mode.

---

## 7. Identifiers

Source: S23 ("Identifiers are prefixed ... maximum length of 32 characters, including the prefix") and OpenAPI `pattern`s in S2, S12-S15.

| Prefix   | Resource                            | Source                                                             |
| -------- | ----------------------------------- | ------------------------------------------------------------------ |
| `tr_`    | Payment                             | S2 `^tr_.+$`, S23                                                  |
| `re_`    | Refund                              | S12 `^re_.+$`, example `re_4qqhO89gsT`                             |
| `chb_`   | Chargeback                          | S13 `^chb_.+$`, examples `chb_n9z0tp`, `chb_xFzwUN4ci8HAmSGUACS4J` |
| `cpt_`   | Capture                             | S14 `^cpt_.+$`, example `cpt_vytxeTZskVKR7C7WgdSP3d`               |
| `ord_`   | Order (legacy)                      | S2 `^ord_.+$`, S20 `ord_pbjz8x`                                    |
| `shp_`   | Shipment (orders)                   | S14                                                                |
| `pl_`    | Payment link                        | S6                                                                 |
| `event_` | Next-gen webhook event              | S15 `^event_.+$`                                                   |
| `hook_`  | Webhook subscription                | S16 examples                                                       |
| `pfl_`   | Profile                             | S2                                                                 |
| `cst_`   | Customer                            | S2, S23                                                            |
| `mdt_`   | Mandate                             | S2                                                                 |
| `sub_`   | Subscription                        | S2                                                                 |
| `stl_`   | Settlement                          | S12-S14                                                            |
| `org_`   | Organization                        | S2 `_links.dashboard` hrefs                                        |
| `tkn_`   | Card token (in `details.cardToken`) | S2 example only                                                    |

Linking:

- Refund to payment: `paymentId` (string, `tr_`) plus `_links.payment.href`. The refund self href is `/v2/payments/{tr_}/refunds/{re_}`.
- Chargeback to payment: `paymentId` plus `_links.payment`. Self href is `/v2/payments/{tr_}/chargebacks/{chb_}`.
- Capture to payment: `paymentId`, optional `shipmentId`.
- Payment to its children: `_links.refunds`, `_links.chargebacks`, `_links.captures` (list URLs), or the `embed` parameter.
- Payment to order: `orderId`, `_links.order`. Payment to customer/mandate/subscription: `customerId`/`mandateId`/`subscriptionId`.
- Event to entity: `entityId`.
- Refund `externalReference` `{type:"acquirer-reference", id}`: an acquirer-side reference (S12).

Ids are case-sensitive mixed-case alphanumerics. The minimum length is not documented, only the 32-character maximum.

---

## 8. Sensitive fields (redaction list)

S27 says classic webhooks "never contain sensitive information". Full objects do. Redact or mask these:

| Path                                                                                                           | Why (doc wording)                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `details.consumerName`                                                                                         | "The customer's name"                                                                                     |
| `details.consumerAccount`                                                                                      | IBAN or domestic account number; **for PayPal "an email address"**                                        |
| `details.consumerBic`                                                                                          | Customer bank BIC                                                                                         |
| `details.cardHolder`                                                                                           | "The customer's name as shown on their card"                                                              |
| `details.cardNumber`                                                                                           | "The last4-digit of the PAN" (Bancontact: masked card number)                                             |
| `details.cardMaskedNumber` / POS `details.maskedNumber`                                                        | "first6 and last4 digits"                                                                                 |
| `details.cardBin`                                                                                              | first 6 digits                                                                                            |
| `details.cardFingerprint`                                                                                      | stable card identifier, "can be used to identify returning customers"                                     |
| `details.cardExpiryDate`                                                                                       | `MM/YY`                                                                                                   |
| `details.cardToken`                                                                                            | card token (example `tkn_...`)                                                                            |
| `details.shippingAddress`                                                                                      | wallet-provided address                                                                                   |
| `details.billingEmail` (deprecated)                                                                            | email                                                                                                     |
| `details.paypalPayerId`, `details.paypalReference`                                                             | PayPal account and reference                                                                              |
| `details.customerReference` (paysafecard)                                                                      | may be a hashed IP                                                                                        |
| `details.transferReference`, `details.mandateReference`, `details.signatureDate`, `details.endToEndIdentifier` | bank/SEPA references                                                                                      |
| `billingAddress.*`, `shippingAddress.*`                                                                        | `givenName`, `familyName`, `email`, street, postal code, and so on (S23 address object)                   |
| `metadata`                                                                                                     | merchant-defined; may contain anything                                                                    |
| `description`                                                                                                  | free text, often contains order or customer references                                                    |
| `_links.checkout.href`                                                                                         | a live payable URL                                                                                        |
| `_links.changePaymentState`, `_links.dashboard`                                                                | the dashboard URL contains `org_`                                                                         |
| `redirectUrl`, `cancelUrl`, `webhookUrl`                                                                       | may embed order ids or tokens                                                                             |
| `customerId`, `mandateId`                                                                                      | linkable customer identifiers                                                                             |
| `Authorization: Bearer ...` in pasted requests                                                                 | API keys. Examples show `test_...`. A `live_` prefix or other prefix rules are **NOT DOCUMENTED** in S28. |
| `X-Mollie-Signature` header                                                                                    | not secret, but meaningless to keep                                                                       |

Keep without redaction: `id` values, `status`, `amount`, timestamps, `method`, `failureReason`, `cardLabel`, `cardCountryCode`, `cardSecurity`, `feeRegion`, `cardAudience`, `cardFunding`, `wallet`.

---

## 9. Structural detection hints

Strong signals, which can be combined:

- **Payment:** `resource === "payment"` **and** `id` matches `^tr_` **and** `amount` is `{currency: /^[A-Z]{3}$/, value: string}` **and** `status` is one of the 7 values. A `_links.self.href` containing `api.mollie.com/v2/payments/`, and `mode` being `live` or `test`, add confidence.
- **Refund:** `resource:"refund"`, `id` `^re_`, `paymentId` `^tr_`, status in the refund enum.
- **Chargeback:** `resource:"chargeback"`, `id` `^chb_`, `paymentId`, `reversedAt` key present (possibly null).
- **Capture:** `resource:"capture"`, `id` `^cpt_`, `paymentId`, status in `pending|succeeded|failed`.
- **Next-gen event:** `resource:"event"`, `id` `^event_`, `type` matching `^[a-z-]+(\.[a-z-]+)+$`, `entityId`. `_embedded.entity` is present for full payloads and absent for simple ones.
- **Error:** an object with integer `status` in 400-599, string `title`, string `detail`, and `_links.documentation.href`. Optional `field`. There is no `resource` key. This resembles RFC 7807 problem+json (which other providers also use), so require `_links.documentation` (a HAL-style `{href,type}`) to tell it apart.
- **Classic webhook:** a raw text body matching `^id=(tr|re|chb|cpt|ord|sub|pl|...)_[A-Za-z0-9]+$` (form-encoded), possibly with HTTP headers including `User-Agent: Mollie HTTP client/1.0` (S5 example; whether this header is stable is NOT DOCUMENTED). Detect it, then mark it unsupported with guidance (section 6.1).
- **List responses:** a HAL `_embedded.payments` / `refunds` / `chargebacks` / `captures` array with `count`. These are documented on list pages that were not transcribed here. Treat as phase 2.
- Distinguishing features against other adapters: amounts are **decimal strings** inside `{currency,value}` (Stripe uses integer minor units; Adyen uses `{currency, value:int}`). Note the key order varies in examples (`value` first or `currency` first).

---

## 10. Limitations and pitfalls

1. **Amounts are decimal strings.** `amount.value` is "A string containing an exact monetary amount in the given currency" (S2, S23), e.g. `"10.00"`, `"24.95"`, `"-5.95"` (negative in `settlementAmount`, S9). Convert to integer minor units **without floats**: split on `.`, validate digits, pad or verify the fraction against the currency exponent, and use BigInt or integer maths. Exponents from S24: 2 for most currencies, **0 for `ISK` and `JPY`**. S24 lists only Mollie's 28 supported payment currencies. For others, fall back to the ISO 4217 exponent and flag "exponent assumed". S24 notes that HUF and TWD PayPal amounts are rounded to zero decimals while the documented exponent stays 2. How many decimals `value` carries for a 0-exponent currency (e.g. `"1000"` vs `"1000.00"` for JPY) is **NOT DOCUMENTED** in the pages read. Accept both, and reject non-zero fractional digits beyond the exponent.
2. **Classic webhooks contain only an id.** No status, amount or time (section 6.1). They cannot be decoded.
3. **Next-gen "simple" payloads contain no entity.** Same limitation as classic.
4. **`details.failureReason` is optional and card-only.** The official `payment.failed` example has no `details` at all. Failed checkout attempts without a fixed `method` leave the payment `open` (S4). Per-value descriptions are NOT DOCUMENTED.
5. **No Mollie error code.** API errors classify only by HTTP status plus `field`. `detail` is free text.
6. **Timestamps are milestones on a snapshot**, not an event log. Refunds and captures only have `createdAt`. Chargebacks have `createdAt`/`reversedAt`. A `pending` timestamp does not exist. The timeline must label inferred ordering.
7. **`expiresAt` vs `expiredAt`.** `expiresAt` is a future deadline and must not be shown as an "expired" event. Only `expiredAt` is the event.
8. **`metadata` is often a JSON-encoded string.** Do not auto-parse it into the timeline; treat it as sensitive.
9. **`settlementAmount` is deprecated** and goes away on 2027-01-01 (S2, S12-S14). Do not depend on it.
10. **`statusReason` only exists for point-of-sale payments.** It uses a different code set (S18).
11. **Orders API** is no longer recommended. Orders have their own statuses and an `ord_` webhook id. Out of scope.
12. **Signature verification is impossible locally** (no secret). The `sha256=` prefix handling is inconsistent between S6 and S7.
13. **Doc inconsistencies found:** `pending` webhook (S4 says yes, S5's list omits it). `payment.*` events are listed as global next-gen events, yet classic is recommended for payments (S6). `_links` key in events (`entity` in the schema vs a type-named key in examples). `dispute.*` events appear in S6 but not in the S16 enum. Error `_links.documentation.href` varies.
14. Rate-limit context (`Retry-After`, `RateLimit` headers) lives in **headers**. A pasted body alone loses it.

---

## 11. Proposed capability statuses

The repository has no shared capability-status vocabulary yet (the core types only expose `supported: boolean` plus `unsupportedReason`). The proposal uses **supported / partial / unsupported**.

| Capability         | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errorDecoding`    | **partial**   | The v2 error object is fully documented (S1, OpenAPI error schema) and easy to detect. Classification is limited to HTTP status (14 documented error statuses) and `field`, because Mollie has no machine-readable error code. Payment-level decline decoding via `details.failureReason` has an exact 15-value enum (S3), but no per-value descriptions and it is card-only. Our explanations will be name-derived. POS `statusReason` (described codes) and SEPA `bankReasonCode` are deferred.              |
| `paymentResponses` | **supported** | The payment object (`resource:"payment"`) is fully specified in S2 with status enum, amount, timestamps, details and links. Refund, chargeback and capture objects are fully specified in S12-S14. All have stable `resource` and id-prefix markers.                                                                                                                                                                                                                                                           |
| `webhookParsing`   | **partial**   | Next-gen full-payload events (`resource:"event"` with `_embedded.entity`) are parseable: the envelope is documented in S6/S15 and the entity reuses the GET schemas. Classic webhooks (`id=tr_...`) and next-gen simple payloads carry no state. They are recognised but unsupported, with "paste GET /v2/payments/{id}" guidance. Signature verification is impossible locally. Note that a full payment-event envelope example is NOT DOCUMENTED, and Mollie still recommends classic webhooks for payments. |
| `timeline`         | **partial**   | A payment object yields milestone timestamps (`createdAt`, `authorizedAt`, `paidAt`, `canceledAt`, `expiredAt`, `failedAt`) plus `expiresAt`/`captureBefore` as deadlines. Refunds, captures and chargebacks add `createdAt` (and `reversedAt`). There is no true event log unless the user pastes several next-gen events (each with its own `createdAt`). Intermediate `pending` is never timestamped, and refund/capture status-change times are not available.                                             |
| `correlation`      | **supported** | Documented foreign keys: `paymentId` on refund, chargeback and capture; `entityId` on events; `orderId`/`customerId`/`mandateId`/`subscriptionId` on payments. `_links.payment` hrefs embed both ids. Prefixes are documented and unambiguous (S23, OpenAPI patterns).                                                                                                                                                                                                                                         |

Suggested `supportedFormats` for the adapter (by analogy with the Stripe adapter):
`mollie.payment`, `mollie.refund`, `mollie.chargeback`, `mollie.capture`, `mollie.error`, `mollie.event` (full payload). Recognised but unsupported: `mollie.webhook.classic` (form-encoded `id=`) and `mollie.event.simple` (no `_embedded`).
