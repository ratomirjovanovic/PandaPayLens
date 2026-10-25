# Razorpay (adapter id `razorpay`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Razorpay's first-party documentation, Razorpay's own website and Razorpay's official Node.js SDK repository as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: pages were discovered through Razorpay's machine-readable documentation index `https://razorpay.com/docs/llms.txt` (2,241 page links, "Last Updated: 30 April 2026") and downloaded as raw Markdown from the mirror path `https://razorpay.com/docs/build/llm-docs/<path>.md`, which the index itself links. Each Markdown page corresponds to the HTML page `https://razorpay.com/docs/<path>/` (spot-checked: `/docs/errors/` and `/docs/api/` return HTTP 200). Code tables were extracted mechanically from the Markdown and every code value in this file was checked against that extraction, so code strings are exact; meanings are paraphrased.
- Product note: **Razorpay Payments** (payment gateway: orders, payments, refunds, disputes, settlements) and **RazorpayX** (business banking: payouts, contacts, fund accounts) are two product lines with one API host (`https://api.razorpay.com/v1`), one error envelope and one webhook envelope, but separate dashboards, separate webhook configuration and partly different error tables. This file keeps them apart.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                |
| Classification                     | `gateway`, `payment_facilitator` (Razorpay's own term is "payment aggregator", RBI-authorised), `card_processing` through partner banks, `alternative_payment_method` (UPI, netbanking, wallets, cardless EMI, pay later); `orchestration` only as a product claim (Optimizer). `acquiring`, `wallet` and `merchant_account_intermediary` are not claimed         |
| Documented sectors                 | E-commerce, travel, BFSI (lending, wealth management, insurance), SaaS / subscription, EdTech / education, marketplaces, securities brokers and other SEBI-registered intermediaries (MCC 6211), D2C brands, freelancers and individual businesses (see Classification)                                                                                           |
| Documentation access               | **Public** (no login) for the guides, the API reference, the error pages and the webhook pages. Dashboard actions (webhook logs, replay requests, settlement reports) need a merchant login and were not used                                                                                                                                                     |
| API family to implement first      | **Payments API v1 JSON**: the error envelope `{"error": {"code", "description", "field", "source", "step", "reason", "metadata"}}` and the payment entity with flat `error_code`, `error_description`, `error_source`, `error_step`, `error_reason`, together with the **payment, order and refund webhooks** (`entity: "event"`, `event`, `contains`, `payload`) |
| Documented codes (distinct values) | **156** across four tables: error `code` (type) 3 + payment error `reason` 111 + RazorpayX API error `reason` 7 + RazorpayX payout `status_details.reason` 35. Plus value sets for `source` (12) and `step` (21), and descriptive message strings per endpoint (not codes)                                                                                        |
| Biggest limitations                | The payment `reason` lists are "top" errors, not exhaustive, and the documented sample uses a reason (`invalid_otp`) that no table lists. The `source` value sets differ between pages. Dispute `reason_code` values are not listed anywhere. Several JSON examples are invalid (missing or trailing commas, inline comments, zero-width spaces)                  |
| White-label                        | No. Razorpay documents its own JSON formats. It depends on unnamed "partner banks" for processing; the names of underlying acquirers or gateways are **NOT DOCUMENTED**                                                                                                                                                                                           |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://razorpay.com/docs/build/llm-docs`. Each `D/<path>.md` mirrors `https://razorpay.com/docs/<path>/`.

| URL                                                                                                                                                                                                                                                         | What it covers                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://razorpay.com/llms.txt                                                                                                                                                                                                                               | Company-level index (dated 2026-03-02): regulatory status, regions, product list, sector pages                                                                      |
| https://razorpay.com/docs/llms.txt                                                                                                                                                                                                                          | Documentation index (dated 30 April 2026); page discovery only                                                                                                      |
| https://razorpay.com/, https://razorpay.com/docs/errors/, https://razorpay.com/docs/api/                                                                                                                                                                    | Activity check (HTTP 200); HTML counterparts of the Markdown pages                                                                                                  |
| D/api/understand.md                                                                                                                                                                                                                                         | REST conventions, HTTP status codes, `entity` / collection / `notes` conventions, 14-character identifiers, rate limiting, pagination, example payment              |
| D/api/authentication.md                                                                                                                                                                                                                                     | Basic Auth with key id and key secret; test and live keys                                                                                                           |
| D/api/glossary.md                                                                                                                                                                                                                                           | API glossary                                                                                                                                                        |
| D/errors.md                                                                                                                                                                                                                                                 | **Error envelope** and its fields, sample error                                                                                                                     |
| D/errors/common.md                                                                                                                                                                                                                                          | Common API errors with sample bodies (URL not found, access denied, invalid key, unknown id, missing or invalid parameter, too many requests, server error)         |
| D/errors/payments/list.md                                                                                                                                                                                                                                   | **Payment error reasons**: "Bad Request Errors" and "Gateway Errors" tables; `source` value meanings                                                                |
| D/errors/payments/cards.md                                                                                                                                                                                                                                  | Top card error reasons with merchant guidance                                                                                                                       |
| D/errors/payments/upi.md                                                                                                                                                                                                                                    | Top UPI error reasons with merchant guidance                                                                                                                        |
| D/errors/payments/payment-methods-error-parameters.md                                                                                                                                                                                                       | **`source` and `step` values** per method (cards, UPI intent and collect, netbanking, wallet, cardless EMI, emandate); UPI Collect deprecation notice               |
| D/payments/payment-gateway/rainy-day/errors.md, D/payments/payment-gateway/rainy-day/errors/error-codes.md, D/payments/payment-gateway/rainy-day/errors/error-reasons.md, D/payments/payment-gateway/rainy-day/errors/payment-error-parameters.md           | "Rainy Day" error pages: envelope, **Error Reasons** table (113 rows), method parameters                                                                            |
| D/payments/payments/failure-analysis.md                                                                                                                                                                                                                     | Failure reasons grouped as customer drop-offs, bank failures, business failures                                                                                     |
| D/api/payments.md, D/api/payments/entity.md, D/api/payments/capture.md, D/api/payments/fetch-with-id.md                                                                                                                                                     | **Payment entity** (success and failure examples), capture endpoint and its errors                                                                                  |
| D/api/orders.md, D/api/orders/entity.md, D/api/orders/create.md, D/payments/orders.md                                                                                                                                                                       | **Order entity**, order states, create-order errors                                                                                                                 |
| D/api/refunds.md, D/api/refunds/entity.md, D/api/refunds/create-normal.md                                                                                                                                                                                   | **Refund entity**, create-refund errors                                                                                                                             |
| D/payments/refunds.md, D/payments/refunds/normal.md, D/payments/refunds/instant.md, D/payments/refunds/errors.md, D/payments/refunds/faqs.md                                                                                                                | Refund types, states, timings, refund error body, FAQ on `pending`                                                                                                  |
| D/api/disputes.md, D/api/disputes/entity.md, D/api/disputes/fetch.md, D/payments/disputes.md, D/payments/disputes/faqs.md                                                                                                                                   | **Dispute entity**, phases, states, process, fetch errors                                                                                                           |
| D/api/settlements.md, D/api/settlements/entity.md, D/api/settlements/fetch-recon.md, D/payments/settlements.md, D/payments/settlements/faqs.md, D/payments/settlements/apis.md                                                                              | **Settlement entity**, settlement cycle and states, reconciliation items linking settlements to payments, refunds and transfers                                     |
| D/payments/payments.md, D/payments/payments/late-authorisation.md, D/payments/payments/capture-settings.md, D/payments/payments/faqs.md, D/payments/payment-gateway/how-it-works.md                                                                         | **Payment life cycle**, late authorisation, auto and manual capture, 3-day auto-refund                                                                              |
| D/payments/payment-gateway/web-integration/standard/integration-steps.md                                                                                                                                                                                    | Checkout success handler fields (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`), payment signature recipe, client-side `payment.failed` handler  |
| D/payments/payment-gateway/s2s-integration/json/v2/build-integration/netbanking.md, D/payments/payment-gateway/s2s-integration/json/v2/build-integration/upi/collect.md, D/payments/payment-gateway/s2s-integration/json/v2/build-integration/upi/intent.md | Server-to-server JSON payment creation, `next` actions (`redirect`, `poll`, `intent`), callback fields                                                              |
| D/payments/payment-methods.md, D/payments/payment-methods/upi.md, D/payments/payment-methods/upi/upi-intent.md, D/payments/payment-methods/netbanking.md                                                                                                    | Method codes, UPI intent and collect flows, SEBI intermediary rules, netbanking flow                                                                                |
| D/payments/international-payments.md                                                                                                                                                                                                                        | International payments (160+ currencies), onboarding for Indian and international businesses                                                                        |
| D/webhooks.md, D/webhooks/all.md, D/webhooks/payments.md, D/webhooks/orders.md, D/webhooks/refunds.md, D/webhooks/disputes.md, D/webhooks/settlements.md, D/webhooks/payouts.md                                                                             | **Webhook envelope**, complete event list, sample payloads                                                                                                          |
| D/webhooks/best-practices.md, D/webhooks/faqs.md, D/webhooks/validate-test.md, D/webhooks/setup-edit-payments.md, D/webhooks/setup-edit-payouts.md, D/x/apis/subscribe.md                                                                                   | Delivery, 5-second timeout, retries, disabling, replay, **`X-Razorpay-Signature`** and **`x-razorpay-event-id`**, idempotency, ordering                             |
| D/security/whitelists.md                                                                                                                                                                                                                                    | API host `api.razorpay.com`, static host `prod-api-static.razorpay.com`, certificates                                                                               |
| D/api/x/payouts.md, D/api/x/payouts/entity.md, D/api/x/error-codes.md, D/api/x/payout-idempotency/make-request.md                                                                                                                                           | **Payout entity**, RazorpayX API error reasons, `X-Payout-Idempotency` header                                                                                       |
| D/errors/x.md, D/errors/x/payout-status-details.md, D/errors/x/contacts.md, D/errors/x/fund-account.md                                                                                                                                                      | **RazorpayX error types, HTTP errors, 5XX retry rules, payout `status_details` reasons**                                                                            |
| D/x/payouts.md, D/x/payouts/states-life-cycle.md, D/x/payouts/best-practices.md                                                                                                                                                                             | **Payout states and transitions**, deemed success, reversal transaction, payout modes and limits, webhook deduplication advice                                      |
| D/payments/solutions/ecommerce.md, D/payments/solutions/travel.md, D/payments/solutions/bfsi.md, D/x/solutions/saas.md, D/x/solutions/edtech.md                                                                                                             | Sectors in Razorpay's own words                                                                                                                                     |
| https://github.com/razorpay/razorpay-node (repository metadata, `lib/api.js`, `lib/utils/razorpay-utils.js`, `lib/types/api.d.ts`, `lib/types/payments.d.ts`, `lib/types/refunds.d.ts`, `lib/types/disputes.d.ts`, `lib/types/webhooks.d.ts`)               | Official Node.js SDK (last push 2026-08-28, latest release v2.9.8 of 2026-07-15): SDK error object shape, webhook and payment signature verification, status unions |

Also tried: `https://razorpay.com/prohibited-businesses/` returned HTTP 404, so no first-party list of prohibited sectors was read. Not read: the Route (transfers), Subscriptions, Invoices, Payment Links, QR code, Smart Collect, POS and Partner pages, the fund-account and contact entities beyond their error pages, the downtime entity page, and the dashboard pages. Facts that would come only from those pages are marked **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | razorpay.com loads; the company index (2026-03-02) describes current products; the docs index is dated 30 April 2026; the payouts page lists 2026 bank holidays; the Node SDK had a release on 2026-07-15 and a push on 2026-08-28                                                                                                                                                                         |
| 2   | Payment service operational      | yes    | API reference documents live endpoints on `https://api.razorpay.com/v1/...`; the settlement webhook sample has `created_at` 1763021990 (November 2025); the UPI page describes a NPCI deadline of 28 February 2026 and a SEBI rule effective 1 October 2025 as current requirements                                                                                                                        |
| 3   | Docs publicly accessible         | yes    | API reference, error pages, webhook pages and guides load without login (both HTML and Markdown). Dashboard functions (webhook logs, replay requests via support, settlement reports, payment capture settings) need a merchant login; not used                                                                                                                                                            |
| 4   | API families/versions identified | yes    | REST API `v1` (all paths `/v1/...`; D/api/understand.md: "All Razorpay APIs are backwards-compatible"; no other version number); S2S JSON payment creation (`/v1/payments/create/json`, documented as "json/v2" integration guide); Payments webhooks; RazorpayX Payouts API and webhooks                                                                                                                  |
| 5   | Offline-examinable formats       | yes    | JSON examples for every entity read (payment, order, refund, dispute, settlement, payout), JSON error samples, full webhook payload samples per event and per payment method                                                                                                                                                                                                                               |
| 6   | Sectors documented               | yes    | Solutions pages for e-commerce, travel, BFSI, SaaS and EdTech; SEBI-registered intermediaries (MCC 6211) on the UPI page; marketplaces and lending bundles in the docs index (see Classification)                                                                                                                                                                                                          |
| 7   | Regional/regulatory limits       | yes    | Company index: "RBI-authorised payment aggregator for domestic online and offline payments in India" with a Payment Aggregator - Cross Border (PA-CB) licence; operates across India, Malaysia, Singapore and the USA; RazorpayX and payroll are "India-only". Settlements in INR only. NPCI UPI Collect deprecation (28 February 2026, with exemptions). RazorpayX Lite "not available for new merchants" |
| 8   | Diagnostic value                 | yes    | 156 documented code values, a structured error object that names the failing party (`source`) and stage (`step`), explicit payment, order, refund, dispute, settlement and payout states, documented webhook retry and duplicate rules                                                                                                                                                                     |
| 9   | Own technical formats            | yes    | Razorpay-specific JSON (`entity`, `error_source`, `error_step`, `error_reason`, `acquirer_data`, prefixed 14-character IDs such as `pay_`, `order_`, `rfnd_`). Not a resale of a gateway PandaPayLens supports                                                                                                                                                                                             |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Signatures need the key secret or webhook secret, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gateway`                    | D/payments/payment-gateway/how-it-works.md ("How Payment Gateway Works"); the company index lists "Payment Gateway: Full-stack payment gateway for Indian businesses"                                                                                                                |
| `payment_facilitator`        | Company index: "Razorpay is an RBI-authorised payment aggregator". "Payment aggregator" is Razorpay's term; mapping it to `payment_facilitator` is this file's interpretation. The card and UPI error pages say "Payment Aggregators depend on partner banks for payment processing" |
| `card_processing`            | Card payments with authorisation and capture (D/api/payments/capture.md), card `step` values including `card_enrollment_check` and `payment_capture`. Processing is done through partner banks, not as an acquirer                                                                   |
| `alternative_payment_method` | D/payments/payment-methods.md: UPI, netbanking, wallets, cardless EMI, pay later, bank transfer, emandate, cash on delivery                                                                                                                                                          |
| `orchestration` (claim only) | Company index: Optimizer is "Multi-payment-gateway routing and orchestration - connect 15+ payment processors via single API". Optimizer API formats were not read                                                                                                                   |
| Not claimed                  | `acquiring` (the docs say Razorpay depends on partner banks; no acquirer licence or scheme membership was found in the pages read), `wallet` (Razorpay routes customer wallets such as `payzapp` but does not claim to issue one), `merchant_account_intermediary`                   |
| Separate product             | RazorpayX payouts and current accounts (business banking, India-only per the company index). Not one of the classification categories; kept as its own family in this file                                                                                                           |

Sectors, in Razorpay's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                                              | Source and wording                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-commerce                                          | D/payments/solutions/ecommerce.md: "recommended products for the ecommerce industry"; docs index bundle "E-commerce: Payment Gateway + Magic Checkout + Settle (Instant)"                                                        |
| Travel                                              | D/payments/solutions/travel.md: "recommended products for the travel industry"                                                                                                                                                   |
| Banking, financial services, insurance (BFSI)       | D/payments/solutions/bfsi.md: "payment solutions that solve unique challenges across the lending, wealth management and insurance sectors"; docs index bundle "BFSI/Lending"                                                     |
| SaaS / subscription                                 | D/x/solutions/saas.md ("SaaS businesses can automate invoice generation for subscription models"); docs index bundle "SaaS/Subscription"                                                                                         |
| EdTech / education                                  | D/x/solutions/edtech.md: "Educational institutions and e-learning platforms"; docs index: outward remittances "for education and travel"                                                                                         |
| Marketplaces                                        | Docs index bundle "Marketplaces: Route (Split Payments) + Escrow Accounts + Payouts"; company index (Route): "e-commerce, aggregators, insurance, real estate, and mutual funds"                                                 |
| Securities brokers / SEBI-registered intermediaries | D/payments/payment-methods/upi.md: special UPI onboarding for "Merchant Category Code 6211 (Securities Brokers/Dealers)" that are "SEBI-registered intermediary (including Stockbrokers, Mutual Funds, PMS providers and so on)" |
| D2C brands                                          | Company index: Magic Checkout is "One-click checkout for D2C brands"                                                                                                                                                             |
| Freelancers and individual businesses               | Company index: "Payment solutions for freelancers, solopreneurs, and individual businesses"                                                                                                                                      |

Adult, iGaming / gambling, crypto, nutraceuticals and CBD: **NOT DOCUMENTED** in the pages read (neither accepted nor prohibited; the prohibited-businesses URL tried returned 404).

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                                  | Endpoint(s) / delivery                                                                                                                                                                                                       | Format                                                                                                        | Relevance                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Payments API v1**                     | `https://api.razorpay.com/v1/` + `orders`, `orders/:id/payments`, `payments`, `payments/:id`, `payments/:id/capture`, `payments/:id/refund`, `refunds`, `disputes`, `settlements`, `settlements/recon/combined` (recon page) | JSON request and response; Basic Auth                                                                         | **Primary.** Error envelope and entity JSON                                                        |
| **Payments webhooks**                   | HTTP POST to merchant URL (up to 30 URLs; ports 80 or 443)                                                                                                                                                                   | JSON body; `X-Razorpay-Signature` and `x-razorpay-event-id` headers                                           | **Primary.** Payment, order, refund events; secondary: dispute, settlement, downtime events        |
| Checkout handler / callback             | Browser handler (Standard Checkout) or POST to `callback_url`                                                                                                                                                                | JS object or form post with `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`; failure `error` | Secondary. Client-side, must be confirmed server-side (docs make signature verification mandatory) |
| S2S JSON payment creation               | `POST /v1/payments/create/json`                                                                                                                                                                                              | JSON response `{razorpay_payment_id, next: [{action, url}]}`                                                  | Secondary. Shows the next step (`redirect`, `poll`, `intent`)                                      |
| **RazorpayX Payouts API**               | `https://api.razorpay.com/v1/payouts` and composite payouts; header `X-Payout-Idempotency` mandatory since 15 March 2025                                                                                                     | JSON; Basic Auth                                                                                              | Secondary. Separate product; `status` + `status_details`                                           |
| RazorpayX webhooks                      | HTTP POST to one URL per merchant ID                                                                                                                                                                                         | Same envelope as Payments webhooks                                                                            | Secondary. `payout.*` events                                                                       |
| Optimizer, Route, Subscriptions, others | Various                                                                                                                                                                                                                      | JSON                                                                                                          | Out of scope at first. Same envelope family, not read in detail                                    |

**Recommendation: implement first** the Payments API v1 error envelope, the payment entity (including its flat `error_*` fields) and the `payment.*`, `order.paid` and `refund.*` webhooks. They share one reason vocabulary (`error.reason` in API errors equals `error_reason` in the payment entity and webhook), developers paste them most often, and the documentation gives full examples for each payment method. Add disputes and settlements next (same envelope, small state sets), then RazorpayX payouts as a separate parser path keyed on `entity: "payout"`.

### 3. Response and error formats

#### 3.1 Content type, transport and conventions

- **Requests and responses**: JSON (D/api/understand.md, "the server responds with a JSON object"). Authentication is HTTP Basic with key id and key secret (D/api/authentication.md).
- **HTTP status codes**: success responses are said to be HTTP 200 (D/errors.md: "All successful Razorpay API responses return with HTTP Status code 200"), but D/api/understand.md lists `201 Created` and `202 Accepted` as common success responses (see section 10). Errors: 400, 401, 404, 429, 500, 502, 503, 504 are listed in D/api/understand.md. RazorpayX also documents 401 for OAuth errors.
- **`entity`**: "All Razorpay API responses carry this attribute with the value being the name of the API resource" (D/api/understand.md). Lists come as `{"entity": "collection", "count": n, "items": [...]}`.
- **Identifiers**: "The identifier is of 14 characters, alphanumeric and case-sensitive", after a type prefix such as `pay_` (D/api/understand.md; D/api/disputes/fetch.md says an id that is not 14 characters or not alphanumeric is rejected).
- **Amounts**: integers in the smallest currency sub-unit (paise for INR); three-decimal currencies end in 0 (D/api/payments/entity.md).
- **Timestamps**: Unix seconds (`created_at`, `respond_by`, `submitted_at`).
- **`notes`**: up to 15 key-value pairs of up to 256 characters each (D/api/understand.md). Examples show `notes` both as an object and as an empty array `[]`.
- **Webhooks**: "HTTP POST request with JSON payload" (D/webhooks.md). The exact `Content-Type` header value is **NOT DOCUMENTED**.

#### 3.2 Error envelope (API responses)

Fields (D/errors.md, D/payments/payment-gateway/rainy-day/errors.md):

| Field               | Type   | Meaning                                                                                                                  |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `error`             | object | Wrapper                                                                                                                  |
| `error.code`        | string | "Type of the error", for example `BAD_REQUEST_ERROR` (section 4.1)                                                       |
| `error.description` | string | Human-readable text                                                                                                      |
| `error.field`       | string | Request parameter that caused the error; often `null` or absent                                                          |
| `error.source`      | string | "The point of failure" (section 4.2); `NA` on generic API errors                                                         |
| `error.step`        | string | "The stage where the transaction failure occurred" (section 4.2); `NA` or `null` on generic API errors                   |
| `error.reason`      | string | "The exact error reason. It can be handled programmatically" (sections 4.3 to 4.5); `NA` or `null` on generic API errors |
| `error.metadata`    | object | Extra information; `payment_id` and `order_id` in the payment sample, `{}` elsewhere                                     |

The same object is delivered to the browser by Standard Checkout's `payment.failed` handler as `response.error.code`, `.description`, `.source`, `.step`, `.reason`, `.metadata.order_id`, `.metadata.payment_id` (D/payments/payment-gateway/web-integration/standard/integration-steps.md).

The official Node.js SDK rethrows HTTP errors as `{ statusCode: err.response.status, error: err.response.data.error }` (`lib/api.js`, function `normalizeError`), typed as `INormalizeError` with `code`, `description`, optional `field`, `source`, `step`, `reason`, `metadata` (`lib/types/api.d.ts`). Developers may paste this wrapper; the adapter should accept both shapes.

#### 3.3 Payment entity and its error fields

Fields used for diagnosis (D/api/payments/entity.md, D/api/payments/capture.md):

| Field                                                                                         | Meaning                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `entity`                                                                                | `pay_` + 14 characters; `entity: "payment"`                                                                                                                                                                       |
| `status`                                                                                      | `created`, `authorized`, `captured`, `refunded`, `failed`                                                                                                                                                         |
| `captured`                                                                                    | Boolean                                                                                                                                                                                                           |
| `method`                                                                                      | Entity page lists `card`, `netbanking`, `wallet`, `emi`, `upi` (other method codes exist, see section 10)                                                                                                         |
| `amount`, `currency`, `base_amount`, `amount_refunded`, `amount_transferred`, `refund_status` | `refund_status` is `null`, `partial` or `full`                                                                                                                                                                    |
| `order_id`, `invoice_id`, `customer_id`, `token_id`, `card_id`                                | Links to other entities                                                                                                                                                                                           |
| `error_code`                                                                                  | Error type, for example `BAD_REQUEST_ERROR`                                                                                                                                                                       |
| `error_description`                                                                           | Text                                                                                                                                                                                                              |
| `error_source`                                                                                | Failing party, for example `customer`                                                                                                                                                                             |
| `error_step`                                                                                  | Failing stage, for example `payment_authentication`                                                                                                                                                               |
| `error_reason`                                                                                | Exact reason, for example `incorrect_otp` (same vocabulary as `error.reason`)                                                                                                                                     |
| `card`                                                                                        | `id`, `entity: "card"`, `name`, `last4`, `network`, `type` (`credit`, `debit`, `prepaid`, `unknown`), `issuer` (4-character bank code), `international`, `emi`, `sub_type`, `token_iin`; webhooks also show `iin` |
| `upi`                                                                                         | `payer_account_type` (`bank_account`, `credit_card`, `wallet`, `credit_line`), `vpa`, `flow` (`intent`, `collect`, `in_app`)                                                                                      |
| `bank`, `wallet`, `vpa`                                                                       | Netbanking bank code (for example `HDFC`), wallet name (for example `payzapp`), UPI ID                                                                                                                            |
| `acquirer_data`                                                                               | `auth_code`, `rrn`, `authentication_reference_number` (RuPay; AEVV for Amex), `bank_transaction_id` (netbanking), `transaction_id` (wallet examples)                                                              |
| `fee`, `tax`                                                                                  | Razorpay fee including GST, and the GST part                                                                                                                                                                      |
| `email`, `contact`, `notes`, `description`, `created_at`                                      | Customer data and merchant data                                                                                                                                                                                   |

A successful payment has all five `error_*` fields set to `null` (or, in card webhook samples, `error_code` and `error_description` set to `""`).

#### 3.4 Other entities

- **Order** (D/api/orders/entity.md): `id` (`order_`), `entity: "order"`, `amount`, `amount_paid`, `amount_due`, `currency`, `receipt` (merchant reference, up to 40 characters, unique), `status` (`created`, `attempted`, `paid`), `attempts`, `notes`, `created_at`. Webhook samples add `offer_id`.
- **Refund** (D/api/refunds/entity.md): `id` (`rfnd_`), `entity: "refund"`, `amount`, `currency`, `payment_id`, `notes`, `receipt`, `acquirer_data` (`arn`, or RRN or UTR), `created_at`, `batch_id`, `status` (`pending`, `processed`, `failed`), `speed_requested` (`normal`, `optimum`), `speed_processed` (`instant`, `normal`). A refund has **no** error fields in the entity; failures are only the `failed` status.
- **Dispute** (D/api/disputes/entity.md): `id` (`disp_`), `entity: "dispute"`, `payment_id`, `amount`, `currency`, `amount_deducted`, `reason_code`, `reason_description` (documented but absent from every example), `respond_by`, `status`, `phase`, `created_at`, `evidence` (`amount`, `summary`, document id lists such as `shipping_proof`, `billing_proof`, `others[].type` / `document_ids`, `submitted_at`).
- **Settlement** (D/api/settlements/entity.md): `id` (`setl_`), `entity: "settlement"`, `amount`, `status` (`created`, `processed`, `failed`), `fees`, `tax`, `utr`, `created_at`. No list of the payments it contains; that comes from the reconciliation API (`items[]` with `entity_id`, `type` = `payment` / `refund` / `transfer` / `adjustment`, `payment_id`, `order_id`, `dispute_id`, `settlement_id`, `settlement_utr`, `settled`, `settled_at`, `credit`, `debit`, `fee`, `tax`).
- **Payout** (D/api/x/payouts/entity.md): `id` (`pout_`), `entity: "payout"`, `fund_account_id` (`fa_`), `amount` (paise), `currency` (`INR`), `notes`, `fees`, `tax`, `status`, `utr`, `mode` (`NEFT`, `RTGS`, `IMPS`; samples also show `UPI`), `purpose`, `reference_id` (merchant reference, up to 40 characters), `narration`, `debit_account_number`, `batch_id`, `status_details` (`description`, `source`, `reason`), `created_at`, `fee_type`. Deprecated but still present in samples: `failure_reason` and an `error` object.

#### 3.5 Examples

Example A: API error. **Transcribed from https://razorpay.com/docs/build/llm-docs/errors.md** ("Sample Error Response"):

```json
{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "Authentication failed due to incorrect otp",
    "field": null,
    "source": "customer",
    "step": "payment_authentication",
    "reason": "invalid_otp",
    "metadata": {
      "payment_id": "pay_EDNBKIP31Y4jl8",
      "order_id": "order_DBJKIP31Y4jl8"
    }
  }
}
```

Note: `invalid_otp` appears in no reason table (the tables have `incorrect_otp`), and `order_DBJKIP31Y4jl8` has 13 characters after the prefix, not 14.

Example B: generic API error with `NA` placeholders and `field`. **Transcribed from https://razorpay.com/docs/build/llm-docs/errors/common.md** ("A required parameter is missing"):

```json
{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "The amount field is required.",
    "source": "business",
    "step": "payment_initiation",
    "reason": "input_validation_failed",
    "metadata": {},
    "field": "amount"
  }
}
```

Example C: failed payment webhook (netbanking). **Transcribed from https://razorpay.com/docs/build/llm-docs/webhooks/payments.md** ("Payment Failed", Netbanking tab):

```json
{
  "entity": "event",
  "account_id": "acc_BFQ7uQEaa7j2z7",
  "event": "payment.failed",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_DEAU825sJlCbGa",
        "entity": "payment",
        "amount": 50000,
        "currency": "INR",
        "status": "failed",
        "order_id": "order_DEATVTRRctwEGb",
        "invoice_id": null,
        "international": false,
        "method": "netbanking",
        "amount_refunded": 0,
        "refund_status": null,
        "captured": false,
        "description": null,
        "card_id": null,
        "bank": "HDFC",
        "wallet": null,
        "vpa": null,
        "email": "gaurav.kumar@example.com",
        "contact": "+919876543210",
        "notes": [],
        "fee": null,
        "tax": null,
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": "Payment failed",
        "error_source": "bank",
        "error_step": "payment_authorization",
        "error_reason": "payment_failed",
        "acquirer_data": {
          "bank_transaction_id": null
        },
        "created_at": 1567610214
      }
    }
  },
  "created_at": 1567610215
}
```

Note: `error_source: "bank"` is not in the netbanking `source` list (section 4.2).

Example D: refund entity. **Transcribed from https://razorpay.com/docs/build/llm-docs/api/refunds/entity.md**:

```json
{
  "id": "rfnd_FgRAHdNOM4ZVbO",
  "entity": "refund",
  "amount": 10000,
  "currency": "INR",
  "payment_id": "pay_FgR9UMzgmKDJRi",
  "notes": {
    "notes_key_1": "Beam me up Scotty.",
    "notes_key_2": "Engage"
  },
  "receipt": null,
  "acquirer_data": {
    "arn": "10000000000000"
  },
  "created_at": 1600856650,
  "batch_id": null,
  "status": "processed",
  "speed_processed": "normal",
  "speed_requested": "normal"
}
```

Example E: S2S UPI intent creation response. **Transcribed from https://razorpay.com/docs/build/llm-docs/payments/payment-gateway/s2s-integration/json/v2/build-integration/upi/intent.md**:

```json
{
  "razorpay_payment_id": "pay_ERNEungCtXpZqM",
  "next": [
    {
      "action": "intent",
      "url": "upi://pay?pa=upi@razopay&pn=acme&tr=QTeEWVyigzIBlUD&tn=razorpay&am=100&cu=INR&mc=5411"
    },
    {
      "action": "poll",
      "url": "https://api.razorpay.com/v1/payments/pay_ERNEungCtXpZqM"
    }
  ]
}
```

Example F: RazorpayX payout status details. **Transcribed from https://razorpay.com/docs/build/llm-docs/errors/x/payout-status-details.md** ("Sample Status Details Response Code"; the trailing comma is in the original and makes it invalid JSON):

```text
{
  "status_details": {
    "description": "IMPS is not enabled on beneficiary account, Retry with different mode",
    "source": "beneficiary_bank",
    "reason": "imps_not_allowed",
  }
}
```

Example G: Standard Checkout success handler. **Transcribed from https://razorpay.com/docs/build/llm-docs/payments/payment-gateway/web-integration/standard/integration-steps.md** ("Success Callback"):

```json
{
  "razorpay_payment_id": "pay_29QQoUBi66xm2f",
  "razorpay_order_id": "order_9A33XWu170gUtm",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

### 4. Codes

Code strings are exactly as documented. "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not Razorpay statements; where Razorpay gives next-step advice (for example "retry after 30 min"), it is reflected. Razorpay calls its payment lists "top error codes", so an adapter must handle unknown reasons.

**The same string can mean different things in different tables.** `insufficient_funds` is the customer's balance in a payment but the merchant's RazorpayX balance in a payout; `authentication_failed` is a 3-D Secure / OTP failure in a payment but an OAuth token failure in RazorpayX; `server_error` exists in all three tables. The entity (`payment` vs `payout`) and the field (`error_reason` / `error.reason` vs `status_details.reason`) must select the table.

#### 4.1 Error `code` (error type): 3 values

| Code                | Where documented                                                                                                    | Meaning (paraphrase)                                               | Category (suggestion) | Retry class (suggestion)                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------- |
| `BAD_REQUEST_ERROR` | Every error page; payment `error_code`; also used for "Too many requests" and for RazorpayX OAuth (HTTP 401) errors | The request or the payment was rejected; `reason` gives the detail | from `reason`         | from `reason`                                                     |
| `SERVER_ERROR`      | D/errors/common.md, D/errors/x.md (HTTP 500 and, in the sample, HTTP 503)                                           | Error on Razorpay's side                                           | provider_unavailable  | safe_to_retry_technical_request (RazorpayX: same idempotency key) |
| `GATEWAY_ERROR`     | D/errors/x.md (HTTP 502)                                                                                            | Error at the payment gateway or downstream bank (RazorpayX)        | provider_unavailable  | safe_to_retry_technical_request (same idempotency key)            |

Not codes but seen in the same field: `NA` (deprecated payout `error.code`, D/errors/x.md and the `payout.processed` sample), and the headings `BAD_REQUEST_AUTHENTICATION_ERROR` and `SERVICE_UNAVAILABLE` on D/errors/x.md, whose samples actually carry `BAD_REQUEST_ERROR` and `SERVER_ERROR`. The create-order page also shows validation tokens inside descriptions (`BAD_REQUEST_INVALID_CURRENCY`, `BAD_REQUEST_ENCODING_VALIDATION_FAILED`); they are text, not `code` values.

#### 4.2 `source` and `step` value sets

`source` (who failed). Union of the documented values, 12 including the placeholder:

| Value              | Documented on                                                 | Meaning                                                   |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| `customer`         | all payment methods                                           | Customer error (wrong OTP, cancelled, insufficient funds) |
| `business`         | all payment methods; RazorpayX                                | Merchant integration or configuration                     |
| `internal`         | methods page; RazorpayX                                       | Razorpay internal error                                   |
| `razorpay`         | D/errors/payments/list.md only                                | Razorpay internal error (same idea as `internal`)         |
| `gateway`          | cards, UPI, emandate; list page; RazorpayX `status_details`   | Gateway, bank or, for payouts, Razorpay's partner bank    |
| `issuer_bank`      | cards, UPI, netbanking, emandate                              | Customer's bank                                           |
| `issuer`           | wallet, cardless EMI; `payment.failed` wallet and UPI samples | Wallet or credit issuer                                   |
| `bank`             | emandate list; `payment.failed` netbanking sample             | Bank (not in the netbanking list)                         |
| `customer_psp`     | UPI                                                           | Customer's UPI app                                        |
| `network`          | UPI, cardless EMI                                             | UPI network / NPCI or credit network                      |
| `beneficiary_bank` | UPI; RazorpayX `status_details`                               | Receiving bank                                            |
| `NA`               | generic API errors                                            | Not applicable                                            |

`step` (where it failed), 21 values plus `NA` / `null`:

- Cards: `payment_initiation`, `card_enrollment_check`, `payment_authentication`, `payment_authorization`, `payment_capture`.
- UPI (intent and collect): `mandate_creation`, `payment_initiation`, `payment_creation`, `payment_authentication`, `payment_request`, `payment_debit_request`, `payment_debit_response`, `payment_credit_request`, `payment_credit_response`, `payment_status_request`, `payment_status_response`, `payment_response`, `refund_request`; intent only: `payment_request_beneficiary_details`, `payment_response_beneficiary_details`; collect only: `payment_authentication_request`, `payment_authentication_response`.
- Netbanking and emandate: `payment_initiation`, `payment_authentication`, `payment_authorization`.
- Wallet and cardless EMI: `payment_initiation`, `payment_eligibility_check`, `payment_authentication`, `payment_authorization`.

Suggested timeline use: `step` places a failure on the method's documented flow; `source` decides whether the merchant, the customer or a third party must act.

#### 4.3 Payment error reasons (`error.reason`, `error_reason`): 111 values

Pages: **B** = D/errors/payments/list.md "Bad Request Errors" (70 rows, 69 distinct), **G** = same page "Gateway Errors" (53 rows), **R** = D/payments/payment-gateway/rainy-day/errors/error-reasons.md (113 rows, 109 distinct after removing one stray space), **C** = D/errors/payments/cards.md (16), **U** = D/errors/payments/upi.md (10). D/payments/payments/failure-analysis.md repeats a subset with the same strings. A reason in both B and G can arrive with either kind of failure; the table cannot tell which from the string alone.

| Reason                                  | Pages         | Meaning (paraphrase)                                                                                                                                 | Category (suggestion)      | Retry class (suggestion) |
| --------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `amount_less_than_minimum_amount`       | B, R          | Amount is below the minimum allowed, for example below a bank's fixed fee                                                                            | invalid_amount             | do_not_retry             |
| `authentication_failed`                 | B, G, R, C    | 3-D Secure or OTP authentication did not complete (wrong details, or the customer left the authentication page)                                      | authentication_failed      | customer_action_required |
| `authorisation_declined_by_psp`         | G, R          | The UPI app (PSP) refused the authorisation, because of a PSP problem or a problem with the customer's VPA                                           | payment_method_unavailable | customer_action_required |
| `bank_account_invalid`                  | B, R          | The customer's bank account is not valid, for example closed                                                                                         | invalid_request            | customer_action_required |
| `bank_account_validation_failed`        | B, R          | Third-party validation (TPV) could not confirm the bank account details                                                                              | invalid_request            | customer_action_required |
| `bank_cutoff_in_progress`               | G, R          | The bank's periodic core banking cutoff is running                                                                                                   | provider_unavailable       | retry_conditionally      |
| `bank_not_available`                    | G, R          | The bank is down or has a technical issue                                                                                                            | provider_unavailable       | retry_conditionally      |
| `bank_not_enabled`                      | B, R          | The selected bank is not enabled for the merchant account                                                                                            | configuration              | do_not_retry             |
| `bank_technical_error`                  | B, G, R, C, U | The issuing bank's core banking system failed during the payment (also used for UPI provider downtime)                                               | provider_unavailable       | customer_action_required |
| `beneficiary_account_does_not_exist`    | G, R          | The beneficiary account does not exist                                                                                                               | configuration              | manual_review            |
| `beneficiary_account_dormant`           | G, R          | The beneficiary account is dormant                                                                                                                   | configuration              | manual_review            |
| `capture_failed`                        | B, R          | Capture of an authorised payment failed; the two pages give different next steps (contact Razorpay, or customer retries)                             | unknown                    | manual_review            |
| `card_declined`                         | G, R, C       | The issuer declined the card without telling Razorpay why                                                                                            | card_declined              | customer_action_required |
| `card_disabled_for_online_payments`     | C             | The card is not enabled for online use by the cardholder (Cards page only)                                                                           | card_declined              | customer_action_required |
| `card_expired`                          | B, R, C       | The card has expired                                                                                                                                 | card_declined              | customer_action_required |
| `card_network_not_enabled`              | B, R          | The card network (for example Amex) is not enabled for the merchant                                                                                  | configuration              | do_not_retry             |
| `card_not_enrolled`                     | B, R, C       | The card is not enrolled for 3-D Secure or for this payment method                                                                                   | payment_method_unavailable | customer_action_required |
| `card_number_invalid`                   | B, R          | The card number does not belong to any known BIN/IIN                                                                                                 | invalid_request            | customer_action_required |
| `card_type_invalid`                     | B, R          | This card type is not allowed for the payment (example given: credit cards for mutual fund purchases)                                                | payment_method_unavailable | customer_action_required |
| `collect_on_mcc_blocked`                | G, R          | NPCI blocks UPI collect requests for the merchant category; the intent flow is suggested                                                             | configuration              | do_not_retry             |
| `collect_request_pending`               | G, R          | A UPI collect request is still waiting for the customer or for the acquirer callback                                                                 | authentication_required    | customer_action_required |
| `compliance_violation`                  | B, R          | A compliance rule failed at customer or merchant level; `source` tells which                                                                         | fraud_or_risk              | manual_review            |
| `credit_failed`                         | G, R, U       | The credit into the merchant account was refused (TPV account mismatch or beneficiary bank issue); the UPI page also maps partner bank downtime here | unknown                    | customer_action_required |
| `credit_limit_exceeded`                 | G, R          | Cardless EMI: the customer's credit limit is used up                                                                                                 | insufficient_funds         | customer_action_required |
| `credit_limit_expired`                  | G, R          | Cardless EMI: the customer's credit limit has expired                                                                                                | payment_method_unavailable | customer_action_required |
| `credit_limit_inactive`                 | G, R          | Cardless EMI: the credit limit is inactive, possibly pending customer action                                                                         | payment_method_unavailable | customer_action_required |
| `credit_limit_not_approved`             | G, R          | Cardless EMI: the credit limit was not approved                                                                                                      | payment_method_unavailable | customer_action_required |
| `credit_not_permitted`                  | G, R          | The beneficiary bank did not allow the credit (TPV mismatch or bank issue); the list page words it as credit not allowed for this customer           | unknown                    | customer_action_required |
| `debit_declined`                        | G, R          | The customer's bank refused the debit, for example because the account is blocked                                                                    | card_declined              | customer_action_required |
| `debit_instrument_blocked`              | B, G, R, C    | The card is blocked by the issuer or the cardholder                                                                                                  | card_declined              | customer_action_required |
| `debit_instrument_inactive`             | G, R, C       | The card is inactive, frozen or not enabled for online use                                                                                           | card_declined              | customer_action_required |
| `deemed_transaction`                    | G, R          | Deemed transaction: the acquirer does not know the outcome yet; it becomes known the next day                                                        | unknown                    | manual_review            |
| `duplicate_refund_id`                   | B, R          | Two refunds were started with the same refund ID                                                                                                     | duplicate_request          | do_not_retry             |
| `duplicate_request`                     | B, R          | An identical payment request was already sent to the gateway                                                                                         | duplicate_request          | do_not_retry             |
| `duplicate_rrn_found`                   | G, R          | Another payment already has the same RRN; rare and temporary                                                                                         | duplicate_request          | retry_conditionally      |
| `emi_greater_than_max_amount`           | B, R          | Cardless EMI: the amount is above the customer's maximum                                                                                             | invalid_amount             | customer_action_required |
| `emi_plan_unavailable`                  | B, R          | Cardless EMI: the chosen plan is no longer offered                                                                                                   | payment_method_unavailable | customer_action_required |
| `funds_blocked_by_mandate`              | G, R          | UPI one-time mandate: the funds are blocked by an existing mandate                                                                                   | insufficient_funds         | customer_action_required |
| `gateway_technical_error`               | G, R, C, U    | Technical error or downtime at the gateway or Razorpay's partner bank                                                                                | provider_unavailable       | retry_conditionally      |
| `incorrect_atm_pin`                     | B, R          | Wrong ATM PIN, mainly during UPI registration (described as very rare in payments)                                                                   | authentication_failed      | customer_action_required |
| `incorrect_card_details`                | B, R          | Generic: some card detail entered was wrong                                                                                                          | invalid_request            | customer_action_required |
| `incorrect_card_expiry_date`            | B, R          | Wrong card expiry date                                                                                                                               | invalid_request            | customer_action_required |
| `incorrect_cardholder_name`             | B, R          | Wrong cardholder name                                                                                                                                | invalid_request            | customer_action_required |
| `incorrect_cvv`                         | B, R, C       | Wrong CVV                                                                                                                                            | card_declined              | customer_action_required |
| `incorrect_otp`                         | B, R          | Wrong OTP                                                                                                                                            | authentication_failed      | customer_action_required |
| `incorrect_pin`                         | B, R          | Wrong PIN                                                                                                                                            | authentication_failed      | customer_action_required |
| `input_validation_failed`               | B, R          | The request had a wrong or missing input; see `description` and `field`                                                                              | invalid_request            | do_not_retry             |
| `insufficient_funds`                    | B, R, C, U    | Not enough balance in the customer's account                                                                                                         | insufficient_funds         | customer_action_required |
| `international_transaction_not_allowed` | B, R          | International transactions are not enabled for the account or product (the list page puts the action on the customer instead)                        | configuration              | do_not_retry             |
| `invalid_amount`                        | B, R          | Amount (or, per one page, currency) is invalid or of the wrong type                                                                                  | invalid_amount             | do_not_retry             |
| `invalid_currency`                      | B, R          | The currency is unsupported or not enabled for the merchant                                                                                          | configuration              | do_not_retry             |
| `invalid_device`                        | B, R          | UPI: the device is not bound to the customer's account (device binding missing)                                                                      | authentication_required    | customer_action_required |
| `invalid_email`                         | B, R          | The email address is not valid                                                                                                                       | invalid_request            | customer_action_required |
| `invalid_mobile_number`                 | B, R          | Wallet: the mobile number is not registered with the wallet or is invalid                                                                            | invalid_request            | customer_action_required |
| `invalid_order_id`                      | B, R          | The order ID is missing or invalid                                                                                                                   | invalid_request            | do_not_retry             |
| `invalid_request`                       | B, R          | The request is invalid because of data the merchant sent                                                                                             | invalid_request            | do_not_retry             |
| `invalid_response_from_gateway`         | G, R          | The gateway's response could not be used                                                                                                             | provider_unavailable       | retry_conditionally      |
| `invalid_user_details`                  | B, R          | The customer does not exist or the user details are invalid                                                                                          | invalid_request            | customer_action_required |
| `invalid_vpa`                           | B, G, R, U    | The VPA (UPI ID) is wrong or not registered                                                                                                          | invalid_request            | customer_action_required |
| `issuer_technical_error`                | G, R          | Technical error at the issuer (listed twice: generic and UPI)                                                                                        | provider_unavailable       | retry_conditionally      |
| `live_mode_not_enabled`                 | B, R          | Live mode is not enabled, typically test keys used for a live payment                                                                                | configuration              | do_not_retry             |
| `mandate_creation_declined`             | G, R          | UPI Autopay / OTM mandate creation was declined                                                                                                      | card_declined              | customer_action_required |
| `mandate_creation_expired`              | G, R          | Mandate creation expired                                                                                                                             | network_or_timeout         | customer_action_required |
| `mandate_creation_failed`               | G, R          | Mandate creation failed or was declined by some party                                                                                                | unknown                    | customer_action_required |
| `mandate_creation_timeout`              | G, R          | Mandate creation timed out                                                                                                                           | network_or_timeout         | customer_action_required |
| `mcc_amount_limit_exceeded`             | G             | The amount limit for the merchant category code was exceeded (Gateway list only)                                                                     | invalid_amount             | manual_review            |
| `merchant_not_activated`                | B, R          | The merchant account or terminal is not active with the gateway                                                                                      | configuration              | manual_review            |
| `mismatch_in_transaction_details`       | B, R          | The merchant passed transaction details that do not match                                                                                            | invalid_request            | do_not_retry             |
| `mobile_number_invalid`                 | B, R          | UPI: the mobile number is not mapped to the bank account                                                                                             | invalid_request            | customer_action_required |
| `order_already_paid`                    | B, R          | The order already has a successful payment                                                                                                           | duplicate_request          | do_not_retry             |
| `order_amount_mismatch`                 | B, R          | The payment amount differs from the order amount                                                                                                     | invalid_amount             | do_not_retry             |
| `order_payment_method_mismatch`         | B, R          | The payment method differs from the method set on the order                                                                                          | invalid_request            | do_not_retry             |
| `otp_attempts_exceeded`                 | B, R          | Too many wrong OTP attempts                                                                                                                          | authentication_failed      | customer_action_required |
| `otp_expired`                           | B, R          | The OTP had expired                                                                                                                                  | authentication_failed      | customer_action_required |
| `payment_amount_tampered`               | G, R          | The payment amount was altered                                                                                                                       | invalid_amount             | manual_review            |
| `payment_cancelled`                     | B, G, R, C, U | The customer cancelled, closed the window or pressed back during payment; the Cards page also files bank downtime under it                           | authentication_failed      | customer_action_required |
| `payment_collect_request_expired`       | G, R, U       | The UPI collect request expired before the customer approved it                                                                                      | network_or_timeout         | customer_action_required |
| `payment_declined`                      | G, R, U       | The issuer bank or gateway declined without a reason                                                                                                 | card_declined              | customer_action_required |
| `payment_declined_due_to_high_traffic`  | G, R          | The bank could not serve the request during very high traffic                                                                                        | provider_unavailable       | retry_conditionally      |
| `payment_failed`                        | B, G, R, C    | Bank or wallet gateway failure with no specific code                                                                                                 | unknown                    | customer_action_required |
| `payment_method_not_enabled`            | B, R          | The payment method (listed twice, once specifically for UPI) is not enabled for the merchant                                                         | configuration              | do_not_retry             |
| `payment_pending`                       | G, R          | The bank or gateway marked the payment pending; it may be authorised later (late authorisation)                                                      | unknown                    | manual_review            |
| `payment_pending_approval`              | B, R          | Waiting for maker-checker approval inside the merchant's organisation                                                                                | unknown                    | manual_review            |
| `payment_risk_check_failed`             | B, G, R, C    | Declined by a risk check at Razorpay, the gateway or the issuer; `source` tells which                                                                | fraud_or_risk              | customer_action_required |
| `payment_session_expired`               | G, R          | The payment session expired before the customer finished                                                                                             | network_or_timeout         | customer_action_required |
| `payment_timed_out`                     | B, G, R, C, U | The customer did not finish in time (typically 10 minutes), or the gateway did not answer                                                            | network_or_timeout         | customer_action_required |
| `pin_attempts_exceeded`                 | B, R          | Too many wrong PIN attempts                                                                                                                          | authentication_failed      | customer_action_required |
| `pin_not_set`                           | B, R          | No UPI PIN is set on the account                                                                                                                     | authentication_required    | customer_action_required |
| `psp_app_not_available`                 | G, R          | The UPI app is unavailable, for example during downtime (spelled with a stray space on the Error Reasons page)                                       | provider_unavailable       | customer_action_required |
| `psp_app_not_supported`                 | G, R          | The UPI app is not supported (blocked)                                                                                                               | payment_method_unavailable | customer_action_required |
| `psp_not_available`                     | G, R          | The PSP is down                                                                                                                                      | provider_unavailable       | customer_action_required |
| `psp_not_registered`                    | G, R          | The PSP is not registered on the customer's device                                                                                                   | payment_method_unavailable | customer_action_required |
| `record_not_found`                      | B, R          | The bank has no record of the payment, typically on a status check                                                                                   | unknown                    | retry_conditionally      |
| `recurring_payment_not_enabled`         | B, R          | Recurring payments are not enabled for the merchant                                                                                                  | configuration              | do_not_retry             |
| `refund_limit_crossed`                  | B, R          | The refund amount limit was crossed                                                                                                                  | invalid_amount             | manual_review            |
| `reqauth_mandate_not_acknowledged`      | G, R          | The PSP did not answer the mandate authorisation request                                                                                             | provider_unavailable       | retry_conditionally      |
| `request_timed_out`                     | G, R          | The request timed out                                                                                                                                | network_or_timeout         | retry_conditionally      |
| `server_error`                          | B, G, R       | Technical error on Razorpay's side                                                                                                                   | provider_unavailable       | retry_conditionally      |
| `transaction_daily_count_exceeded`      | G, R          | The payer exceeded the number of transactions allowed per day                                                                                        | card_declined              | customer_action_required |
| `transaction_daily_limit_exceeded`      | B, G, R       | The payer exceeded the daily amount limit on the card                                                                                                | card_declined              | customer_action_required |
| `transaction_frequency_limit_exceeded`  | B, G, R       | The payer hit NPCI's per-day UPI frequency or amount limit                                                                                           | card_declined              | customer_action_required |
| `transaction_limit_exceeded`            | B, R, C       | The payer exceeded the card's credit or debit limit                                                                                                  | card_declined              | customer_action_required |
| `transaction_on_vpa_restricted`         | B, R          | The PSP has blocked transactions on this VPA                                                                                                         | payment_method_unavailable | customer_action_required |
| `upi_app_technical_error`               | B, R          | Technical error in the customer's UPI app (PSP)                                                                                                      | provider_unavailable       | customer_action_required |
| `upi_autopay_not_supported_on_psp`      | B, R          | The customer's UPI app does not support UPI Autopay                                                                                                  | payment_method_unavailable | customer_action_required |
| `upi_collect_not_enabled`               | B, R          | The merchant called the collect flow but it is not enabled                                                                                           | configuration              | do_not_retry             |
| `upi_intent_not_enabled`                | B, R          | The merchant called the intent flow but it is not enabled                                                                                            | configuration              | do_not_retry             |
| `user_not_eligible`                     | B, G, R       | Cardless EMI / credit: the customer failed the eligibility check                                                                                     | payment_method_unavailable | customer_action_required |
| `user_not_registered_for_netbanking`    | B, R          | The customer's account is not registered for netbanking                                                                                              | payment_method_unavailable | customer_action_required |
| `verification_failed`                   | B, R          | Verifying the payment with the status check API failed; described as temporary                                                                       | network_or_timeout         | retry_conditionally      |
| `vpa_resolution_failed`                 | G, R, U       | The UPI network could not resolve the VPA                                                                                                            | provider_unavailable       | customer_action_required |

Also seen but in no table: `invalid_otp` (only in the sample error of section 3.5, Example A). Suggested handling: treat like `incorrect_otp` with a note that it is undocumented.

#### 4.4 RazorpayX API error reasons (`error.reason` on payout, contact and fund account APIs): 7 values

Sources: D/api/x/error-codes.md (3) and D/errors/x.md (HTTP errors section).

| Reason                        | HTTP / `code`                           | Meaning (paraphrase)                                                  | Category (suggestion) | Retry class (suggestion)                                        |
| ----------------------------- | --------------------------------------- | --------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| `input_validation_failed`     | 400 / `BAD_REQUEST_ERROR`               | Wrong or missing input; see `description` and `field`                 | invalid_request       | do_not_retry                                                    |
| `insufficient_funds`          | **NOT DOCUMENTED** / **NOT DOCUMENTED** | The merchant's own account lacks funds for the transaction            | insufficient_funds    | manual_review                                                   |
| `server_error`                | 500 / `SERVER_ERROR`                    | Razorpay server problem                                               | provider_unavailable  | safe_to_retry_technical_request (same idempotency key and body) |
| `payout_approval_not_allowed` | 400 / `BAD_REQUEST_ERROR`               | The payout is no longer pending, so it cannot be approved or rejected | invalid_request       | do_not_retry                                                    |
| `authentication_failed`       | 401 / `BAD_REQUEST_ERROR`               | OAuth token invalid, expired or without permission                    | configuration         | do_not_retry                                                    |
| `gateway_error`               | 502 / `GATEWAY_ERROR`                   | Error at the payment gateway or downstream bank                       | provider_unavailable  | safe_to_retry_technical_request (same idempotency key and body) |
| `service_unavailable`         | 503 / `SERVER_ERROR` (per sample)       | Service temporarily unavailable                                       | provider_unavailable  | safe_to_retry_technical_request (same idempotency key and body) |

Razorpay's 5XX rule (D/errors/x.md): retry at most three times, after 1, 2 and 5 minutes, with the same `X-Payout-Idempotency` key and the same body, within 7 calendar days; then wait at least an hour, check by `reference_id`, and only then treat the payout as failed. D/errors/x.md also gives four description-only API errors without a reason string (URL not found, IP not allowlisted, different body for the same idempotency header, generic server trouble).

#### 4.5 RazorpayX payout status details (`status_details.reason`): 35 values

Source: D/errors/x/payout-status-details.md. These describe why a payout is in its current state; only the `reversed` / `failed` group is an error. For non-error groups the category column is "n/a".

| Reason                                  | Payout status     | `source`         | Meaning (paraphrase)                                                        | Category (suggestion)      | Retry class (suggestion)            |
| --------------------------------------- | ----------------- | ---------------- | --------------------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| `bank_account_closed`                   | reversed / failed | beneficiary_bank | Beneficiary account is closed                                               | invalid_request            | do_not_retry                        |
| `bank_account_frozen`                   | reversed / failed | beneficiary_bank | Beneficiary account is frozen                                               | payment_method_unavailable | do_not_retry                        |
| `bank_account_invalid`                  | reversed / failed | beneficiary_bank | Beneficiary account details are invalid                                     | invalid_request            | do_not_retry                        |
| `beneficiary_account_dormant`           | reversed / failed | beneficiary_bank | Beneficiary account is dormant                                              | payment_method_unavailable | do_not_retry                        |
| `beneficiary_bank_failure`              | reversed / failed | beneficiary_bank | Technical failure at the beneficiary bank; Razorpay says retry after 30 min | provider_unavailable       | retry_conditionally                 |
| `beneficiary_bank_offline`              | reversed / failed | beneficiary_bank | Beneficiary bank offline; retry after 30 min                                | provider_unavailable       | retry_conditionally                 |
| `beneficiary_bank_rejected`             | reversed / failed | beneficiary_bank | Rejected by the beneficiary bank                                            | unknown                    | manual_review                       |
| `beneficiary_bank_technical_error`      | reversed / failed | beneficiary_bank | Technical issue at the beneficiary bank; retry after 30 min                 | provider_unavailable       | retry_conditionally                 |
| `beneficiary_psp_offline`               | reversed / failed | beneficiary_bank | Beneficiary UPI PSP offline; retry after 30 min                             | provider_unavailable       | retry_conditionally                 |
| `imps_not_allowed`                      | reversed / failed | beneficiary_bank | IMPS not enabled on the beneficiary account; use another mode               | payment_method_unavailable | retry_conditionally                 |
| `invalid_ifsc_code`                     | reversed / failed | beneficiary_bank | IFSC code is invalid                                                        | invalid_request            | do_not_retry                        |
| `npci_beneficiary_timeout`              | reversed / failed | beneficiary_bank | Temporary issue between NPCI and the beneficiary bank; retry after 30 min   | network_or_timeout         | retry_conditionally                 |
| `transaction_limit_exceeded`            | reversed / failed | beneficiary_bank | Amount above what the beneficiary account accepts                           | invalid_amount             | do_not_retry                        |
| `amount_limit_exhausted_neft`           | reversed / failed | business         | The account's NEFT 24x7 limit is used up; retry later                       | configuration              | retry_conditionally                 |
| `beneficiary_account_invalid`           | reversed / failed | business         | Beneficiary account number is invalid                                       | invalid_request            | do_not_retry                        |
| `beneficiary_vpa_invalid`               | reversed / failed | business         | UPI validation of the beneficiary VPA failed                                | invalid_request            | retry_conditionally                 |
| `insufficient_funds`                    | reversed / failed | business         | Merchant's account lacks funds                                              | insufficient_funds         | manual_review                       |
| `invalid_beneficiary`                   | reversed / failed | business         | No wallet account exists for the given phone number                         | invalid_request            | do_not_retry                        |
| `gateway_down`                          | reversed / failed | gateway          | Razorpay's partner bank has technical issues                                | provider_unavailable       | retry_conditionally                 |
| `gateway_technical_error`               | reversed / failed | gateway          | Temporary issue at the partner bank; retry after 30 min                     | provider_unavailable       | retry_conditionally                 |
| `gateway_timeout`                       | reversed / failed | gateway          | Payout timed out at the partner bank; retry after 30 min                    | network_or_timeout         | retry_conditionally                 |
| `server_error`                          | reversed / failed | internal         | Payout failed; contact support                                              | provider_unavailable       | manual_review                       |
| `server_error_temporary`                | reversed / failed | internal         | Temporary technical issue; retry                                            | provider_unavailable       | retry_conditionally                 |
| `beneficiary_bank_confirmation_pending` | processing        | beneficiary_bank | Credit confirmation pending from the beneficiary bank                       | n/a                        | do_not_retry (wait for final state) |
| `bank_window_closed`                    | processing        | gateway          | The window for the payout mode is closed for the day                        | n/a                        | do_not_retry (wait)                 |
| `payout_bank_processing`                | processing        | gateway          | Partner bank is processing the payout                                       | n/a                        | do_not_retry (wait)                 |
| `amount_limit_exhausted`                | processing        | business         | The mode's 24x7 limit for the account is used up                            | n/a                        | do_not_retry (wait)                 |
| `partner_bank_pending`                  | processing        | internal         | Partner bank is processing the payout                                       | n/a                        | do_not_retry (wait)                 |
| `payout_processed`                      | processed         | beneficiary_bank | Money credited to the beneficiary                                           | n/a (success)              | n/a                                 |
| `pending_approval`                      | pending           | business         | Waiting for approval in the approval workflow                               | n/a                        | manual_review                       |
| `gateway_degraded`                      | queued            | gateway          | Queued because partner bank systems are down                                | n/a                        | do_not_retry (wait)                 |
| `beneficiary_bank_down`                 | queued            | gateway          | Queued because the beneficiary bank is down; fails after a time limit       | n/a                        | do_not_retry (wait)                 |
| `low_balance`                           | queued            | business         | Queued because the merchant balance is too low                              | n/a                        | manual_review (add funds)           |
| `syncing_balance`                       | queued            | gateway          | Queued while the balance syncs with the bank                                | n/a                        | do_not_retry (wait)                 |
| `fee_recovery_pending`                  | queued            | business         | Queued behind a pending fee recovery payout                                 | n/a                        | do_not_retry (wait)                 |

#### 4.6 Endpoint-specific error descriptions (not codes)

Endpoint pages list errors as description strings with HTTP 400 and no reason value. They are useful for matching `error.description` text but are not stable codes. Examples (paraphrased):

- Capture (D/api/payments/capture.md): capture amount differs from the authorised amount; order already paid; payment id does not exist; amount not an integer or missing.
- Create order (D/api/orders/create.md): amount below INR 1.00, negative or not an integer; amount above the account maximum; unsupported currency; `receipt` longer than 40 characters or with unsupported characters; **duplicate `receipt`** ("`receipt` is treated as an idempotency key"); concurrent order operation; TPV bank code or account number problems; malformed JSON (`EOF.`).
- Create refund (D/api/refunds/create-normal.md): refund larger than captured amount; already fully refunded; invalid speed; **merchant balance too low** ("Refunds are paid out from the merchant balance"); payment not `captured`; `amount` of 0 treated as blank; method does not support (partial) refunds; refunds disabled; refund already processed; **refund blocked by an ongoing dispute**; duplicate `receipt` for the same payment; invalid `notes`; concurrent payment operation.
- Refund of a payment older than 6 months (D/payments/refunds/errors.md): `code` `BAD_REQUEST_ERROR` with `source`, `step` and `reason` all `null`.
- Fetch dispute (D/api/disputes/fetch.md): invalid key (401), unknown id or wrong prefix, id not 14 alphanumeric characters, invalid `expand` value.
- Common errors (D/errors/common.md): "The requested URL was not found on the server", "Access Denied" (IP allowlisting), "The api key provided is invalid", "The id provided does not exist or access is unauthorised", missing or invalid parameter, "Too many requests" (`BAD_REQUEST_ERROR`, suggested category rate_limiting, retry safe_to_retry_technical_request with backoff), server error (`SERVER_ERROR`).

#### 4.7 HTTP status codes

D/api/understand.md: 400 (client error), 401 (unauthenticated), 404, 429 (throttling; "Retry the request after some time", with exponential backoff and jitter), 500, 502, 503, 504. RazorpayX adds 401 for OAuth problems and 502 / 503 meanings (section 4.4). Many endpoint pages put ordinary "not found" errors under HTTP 400, so 404 alone is not reliable.

#### 4.8 Count summary

| Table                                    | Distinct values                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Error `code` (type)                      | 3                                                                                                                                                                                                      |
| Payment error reasons                    | 111                                                                                                                                                                                                    |
| RazorpayX API error reasons              | 7                                                                                                                                                                                                      |
| RazorpayX payout `status_details.reason` | 35                                                                                                                                                                                                     |
| **Total code values**                    | **156**                                                                                                                                                                                                |
| `source` values (including `NA`)         | 12                                                                                                                                                                                                     |
| `step` values                            | 21                                                                                                                                                                                                     |
| Dispute `reason_code` values             | **NOT DOCUMENTED** as a list (examples only: `chargeback`, `pre_arbitration`, `processed_invalid_expired_card`, `non_matching_account_number`, `goods_or_services_not_received_or_partially_received`) |

### 5. Lifecycle

Keep the families apart: an **order** is the merchant's purchase container, a **payment** is one attempt with its own authorisation and capture, a **refund** and a **dispute** each hang off one payment, a **settlement** batches many transactions to the merchant's bank, and a **payout** (RazorpayX) is an outgoing transfer from the merchant's business account that is unrelated to any payment.

#### 5.1 Order (D/payments/orders.md, D/api/orders/entity.md)

`created` -> `attempted` (first payment attempt) -> `paid` (a payment was captured). Only one successful payment per order; no further payments once `paid`; the order stays `paid` even after a refund. While the order is `attempted` and a payment on it is authorised, a new payment on the same order is refused. `attempts` counts successful and failed attempts. `amount_paid` and `amount_due` track partial payments.

#### 5.2 Payment (D/payments/payments.md, D/payments/payments/late-authorisation.md, D/payments/payments/capture-settings.md)

| Status       | Meaning                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `created`    | Details sent to Razorpay, not processed yet. With no bank response, it stays here for 10 minutes and then becomes `failed` on timeout                                                     |
| `authorized` | The bank authenticated and authorised; funds are taken from the customer. Must be captured; **auto-refunded if not captured within 3 days** (or a configured timeout, minimum 12 minutes) |
| `captured`   | Complete; settled according to the settlement schedule                                                                                                                                    |
| `refunded`   | Refunded (partial refunds keep `captured` and set `refund_status: "partial"` in every sample; whether `refunded` requires a full refund is **NOT DOCUMENTED** explicitly)                 |
| `failed`     | Attempt failed; any debited amount is returned to the customer in 5-7 working days                                                                                                        |

- **Auto-capture is the default.** Capture settings apply only to payments created with the Orders API; Direct Settlement merchants and bank transfers are always auto-captured. Manual capture uses `POST /v1/payments/:id/capture` and the amount must equal the authorised amount.
- **Late authorisation**: after the 10-minute timeout Razorpay polls the bank for 3 days; a `failed` payment can become `authorized` (less than 0.5% of payments, per the page). A timeline must therefore allow `failed` -> `authorized` -> `captured` for the same `pay_` id.
- **`payment.failed` then `payment.captured` for the same payment** is "expected behaviour", from late authorisation or UPI in-app retries (D/webhooks/payments.md).
- Checkout returns `razorpay_payment_id` "only for successful payments" (integration steps page).

#### 5.3 UPI flows

- **Intent** (D/payments/payment-methods/upi/upi-intent.md, S2S intent page): customer picks a UPI app, approves with UPI PIN, returns to the merchant. S2S creation returns `next` = `intent` (a `upi://pay?...` URL) and `poll` (the payment URL). On desktop web a QR code is shown instead. `upi.flow: "intent"`. The `vpa` may be missing on failed intent payments ("Do not hardcode the `vpa` parameter").
- **Collect** (S2S collect page): Razorpay sends a collect request to the customer's VPA; there is no redirect; `next` = `poll` and the merchant polls until `authorized` or `failed`. Expiry is typically 5-10 minutes (`payment_collect_request_expired`). **Deprecated by NPCI from 28 February 2026**, with exemptions (MCC 6012 and 6211, iOS app and mobile web, mandate execute / modify / revoke, eRupi, PA-CB businesses).
- **Turbo UPI** (`upi.flow: "in_app"`) and UPI Autopay / one-time mandates (`mandate_creation` step, `mandate_creation_*` reasons) exist; not read in detail.
- Step order for diagnosis: see section 4.2. NPCI frequency limits (`transaction_frequency_limit_exceeded`) and deemed transactions (`deemed_transaction`) are UPI-specific.

#### 5.4 Netbanking (D/payments/payment-methods/netbanking.md, S2S netbanking page)

Customer chooses a bank (4-letter `bank` code), is redirected to the bank login (`next` = `redirect`), authorises, and returns to the merchant. Razorpay then POSTs `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` to `callback_url` on success; on failure "the callback will contain details of the error" (exact callback field names **NOT DOCUMENTED** on that page). Steps: `payment_initiation`, `payment_authentication`, `payment_authorization`. The bank's reference is `acquirer_data.bank_transaction_id`.

#### 5.5 Refund (D/payments/refunds.md, D/api/refunds/entity.md, D/payments/refunds/faqs.md)

- States: `pending` (Razorpay is processing), `processed` (final), `failed` (for example a normal refund on a payment older than 6 months, or an instant refund failing on the customer's account). The guide page lists only `processed` and `failed`; the FAQ also names "Reversed" without defining it (section 10).
- Razorpay "usually" marks a refund `processed` **before** the ARN / RRN arrives from the gateway; waiting for gateway confirmation is an opt-in account feature.
- Speeds: `speed_requested` `normal` or `optimum`; `speed_processed` `instant` or `normal`. `refund.speed_changed` fires when an instant attempt falls back.
- Refunds are paid from the merchant's balance and only go back to the original payment source. Once issued they "cannot be canceled or reversed" (refunds FAQ).
- On the payment: `amount_refunded`, `refund_status` (`partial` / `full`).

#### 5.6 Dispute (D/payments/disputes.md, D/api/disputes/entity.md)

- `phase`: `fraud`, `retrieval` (a "soft" chargeback), `chargeback`, `pre_arbitration`, `arbitration`.
- `status`: `open`, `under_review`, `won`, `lost`, `closed` (closed is used for fraud-phase disputes after the merchant provides details or refunds).
- Merchant options: accept (customer is refunded; for fraud the merchant must refund, otherwise Razorpay auto-refunds) or contest with evidence before `respond_by`. `amount_deducted` stays 0 unless `lost`. International dispute deductions use the exchange rate of the dispute creation day.
- A refund on a payment under dispute is blocked (create-refund errors).
- Webhooks: `payment.dispute.created`, `.under_review`, `.action_required` (evidence insufficient), `.won`, `.lost`, `.closed`. The webhook payload carries both the payment and the dispute.

#### 5.7 Settlement (D/payments/settlements.md, D/webhooks/settlements.md, D/api/settlements/fetch-recon.md)

- States: `created`, `processed`, `failed` (failure reasons in the guide: inactive or frozen bank account, wrong bank details, rejected by the bank).
- Domestic cycle T+2 working days from capture; international per applicable law (example T+7). All settlements in INR. Partial settlements when the live balance is below the scheduled amount. No settlements on Sundays, second and fourth Saturdays and bank holidays.
- `settlement.processed` means the transfer was initiated; credit can take up to 3 hours (but see section 10). `utr` is the bank reference for reconciliation.
- Settlement to payment links exist only in the reconciliation items (`settlement_id`, `entity_id`, `payment_id`, `order_id`, `dispute_id`), not in the settlement entity or webhook.

#### 5.8 Payout (RazorpayX; D/x/payouts/states-life-cycle.md, D/webhooks/payouts.md)

| Status       | Entered when                                                                                      | Next states                                                |
| ------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `pending`    | Approval workflow requires approval (auto-rejected after 3 months)                                | `queued`, `scheduled`, `processing`, `rejected`            |
| `queued`     | Merchant balance insufficient (auto-failed after 3 months); also partner or beneficiary bank down | `processing`, `cancelled`                                  |
| `scheduled`  | Payout scheduled for a later time                                                                 | `processing`, `cancelled`, `failed` (insufficient balance) |
| `processing` | Sent to the bank; IMPS and UPI can stay here up to T+3 working days (NPCI "deemed success")       | `processed`, `reversed` (and `failed` on current accounts) |
| `processed`  | Credited by the contact's bank; called terminal, yet can later become `reversed`                  | `reversed`                                                 |
| `reversed`   | Failed after debit; a reversal transaction credits amount, fees and tax back                      | `failed` (RazorpayX-powered current accounts only)         |
| `failed`     | Current account payouts failed by the partner bank, or scheduled without balance                  | `reversed` once money is credited back                     |
| `cancelled`  | Merchant cancelled a `queued` or `scheduled` payout                                               | terminal                                                   |
| `rejected`   | Approver rejected, or not approved before the scheduled time                                      | terminal                                                   |

Webhooks map as `payout.pending`, `payout.queued`, `payout.initiated` (= `processing`), `payout.processed`, `payout.reversed`, `payout.failed`, `payout.rejected`, `payout.updated` (any entity change, for example the UTR arriving; also fired whenever `status_details` changes). `scheduled` and `cancelled` have no listed webhook. The payout entity's own status list omits `scheduled`.

#### 5.9 Downtime (not a payment state)

`payment.downtime.started`, `.updated`, `.resolved` and `payout.downtime.started`, `.resolved` report method, bank, network, VPA handle or PSP outages (`down_` and `poutdown_` ids, `severity`, `instrument`). Useful as context for `bank_technical_error` or `gateway_technical_error`, but they never refer to a specific payment.

### 6. Webhooks

#### 6.1 Delivery, acknowledgement and retries

- HTTP POST with a JSON body to a public URL on port 80 or 443; TLS 1.0 and 1.1 are not supported in production; up to 30 URLs for Payments, one per merchant ID for RazorpayX. Separate URLs for test and live mode; "the payload structure remains the same".
- The receiver must answer with a 2XX **within 5 seconds**; anything else, or a timeout, is a failure (D/webhooks/setup-edit-payments.md).
- Failures are retried with **exponential backoff for 24 hours** after the event's creation; if they keep failing for 24 hours the webhook is **disabled** and an alert email is sent. The exact retry intervals are **NOT DOCUMENTED**.
- Manual replay of a single event can be requested through support if it is at most 15 days old; bulk replay is not possible.
- `payment.failed` is "not triggered if the payment fails during authorisation (while making the first payment)" (D/webhooks/payments.md); the scope of this sentence is unclear (section 10).

#### 6.2 Envelope

| Field        | Meaning                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| `entity`     | Always `"event"`                                                                            |
| `account_id` | Merchant account, `acc_` + 14 characters (missing in the `payout.downtime.resolved` sample) |
| `event`      | Event name, dotted lowercase, for example `payment.captured`                                |
| `contains`   | Array of the entity names present in `payload`, for example `["payment", "order"]`          |
| `payload`    | Object keyed by entity name; each value is `{ "entity": { ...full entity snapshot... } }`   |
| `created_at` | Event creation, Unix seconds                                                                |

There is **no event ID in the body**; the event ID travels only in the `x-razorpay-event-id` header. The payload "is a snapshot of the entity when the event occurred": a `payment.authorized` payload shows the payment as authorised even if it is already captured. Field order inside the JSON is not fixed ("The webhook sequence is not fixed in the JSON payload"; card samples are alphabetised). Core fields are consistent but method-specific fields vary (webhooks FAQ).

#### 6.3 Event names (D/webhooks/all.md and per-family pages)

- Orders: `order.paid` (payload: payment and order).
- Payments: `payment.authorized`, `payment.captured`, `payment.failed` (payload: payment).
- Payment downtime: `payment.downtime.started`, `payment.downtime.updated`, `payment.downtime.resolved`.
- Refunds: `refund.created`, `refund.processed`, `refund.failed`, `refund.speed_changed` (payload: refund and payment).
- Disputes: `payment.dispute.created`, `payment.dispute.won`, `payment.dispute.lost`, `payment.dispute.closed`, `payment.dispute.under_review`, `payment.dispute.action_required` (payload: payment and dispute).
- Settlements: `settlement.processed` (payload: settlement).
- Payouts (RazorpayX): `payout.pending`, `payout.rejected`, `payout.queued`, `payout.initiated`, `payout.processed`, `payout.updated`, `payout.reversed`, `payout.failed` (subscription "mandatory" when using Payout APIs), `payout.downtime.started`, `payout.downtime.resolved`.
- Other families listed but not read in detail: `invoice.*`, `subscription.*`, `transfer.processed`, `transfer.failed`, `product.route.*`, `qr_code.*`, `virtual_account.*`, `payment_link.*`, `account.app.authorization_revoked`, `fund_account.validation.*`, `payout_link.*`, `transaction.created`.

#### 6.4 Signature fields (sensitive; PandaPayLens does not verify them)

- **`X-Razorpay-Signature`** header: HMAC-SHA256, key = the webhook secret set in the dashboard, message = the **raw** request body; hex digest (D/webhooks/validate-test.md; Node SDK `validateWebhookSignature` uses `crypto.createHmac('sha256', secret).update(body).digest('hex')`). The secret is optional when configuring a webhook and need not be the API key secret. After a secret change, retries of older events still use the old secret.
- **`razorpay_signature`** (Checkout and S2S callbacks): HMAC-SHA256 hex of `order_id + "|" + razorpay_payment_id` with the API key secret. The Node SDK also documents `payment_id + "|" + subscription_id` for subscriptions and `payment_link_id|payment_link_reference_id|payment_link_status|payment_id` for payment links.
- PandaPayLens should redact these values, may report "signature present (64 hex)", and must never ask for the key secret or webhook secret.

#### 6.5 Duplicate identification

- Razorpay uses at-least-once delivery; duplicates are "expected behaviour", for example when the receiver accepted the event but answered after 5 seconds.
- Dedupe key: the **`x-razorpay-event-id`** header ("unique per event"). If only the body was pasted, there is no documented event id; a suggested fallback is `event` + `payload.<first contains>.entity.id` + that entity's `status` + `created_at` (whether `created_at` is stable across retries is **NOT DOCUMENTED**).
- RazorpayX best practices: dedupe payout webhooks on payout ID plus payout status.

#### 6.6 Ordering

Order is not guaranteed. Documented expectations: `payment.authorized` before `payment.captured`; payouts `payout.pending` -> `payout.queued` -> `payout.initiated` -> `payout.processed` or `payout.reversed`, "may not be followed at all times"; any payout webhook after `processed` or `reversed` "should be ignored" (which conflicts with `processed` -> `reversed`, see section 10). A timeline should sort by the entity's own state order and `created_at`, not by arrival.

### 7. Identifiers

All Razorpay ids are a lowercase prefix, an underscore and 14 case-sensitive alphanumeric characters (D/api/understand.md), with some documented exceptions (section 10).

| Field / prefix                                                                                               | Scope                                                                          | Notes                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `pay_` (`id`, `payment_id`, `razorpay_payment_id`, `error.metadata.payment_id`)                              | Payment attempt                                                                | One per attempt. Refunds, disputes and recon items point to it with `payment_id`                                  |
| `order_` (`order_id`, `razorpay_order_id`, `error.metadata.order_id`)                                        | Order                                                                          | Groups all attempts. `order.paid` carries both order and payment                                                  |
| `receipt` (order), `receipt` (refund)                                                                        | Merchant reference                                                             | Order receipt up to 40 characters and unique ("treated as an idempotency key"); refund receipt unique per payment |
| `notes`                                                                                                      | Merchant data                                                                  | Free key-value pairs; often hold the merchant's own ids                                                           |
| `rfnd_`                                                                                                      | Refund                                                                         | `payment_id` is the parent                                                                                        |
| `disp_`                                                                                                      | Dispute                                                                        | `payment_id` is the parent                                                                                        |
| `setl_`                                                                                                      | Settlement                                                                     | Linked to transactions only through recon items (`settlement_id`)                                                 |
| `acquirer_data.rrn`, `.arn`, `.auth_code`, `.bank_transaction_id`, `.authentication_reference_number`; `utr` | Bank and network references                                                    | RRN can repeat (`duplicate_rrn_found`); refund ARN may hold a UTR for instant refunds                             |
| `card_`, `token_`, `cust_`, `inv_`                                                                           | Card, saved token, customer, invoice                                           | Correlate repeat customers                                                                                        |
| `acc_` (`account_id`)                                                                                        | Merchant account                                                               | In every webhook envelope; mask in output                                                                         |
| `pout_`, `fa_`, `cont_`, `batch_`; `reference_id`                                                            | RazorpayX payout, fund account, contact, bulk batch; merchant payout reference | `reference_id` up to 40 characters; recommended to hold the merchant's transaction id                             |
| `X-Payout-Idempotency`                                                                                       | RazorpayX request idempotency                                                  | UUID v4 recommended; same key and same body for retries within 7 days                                             |
| `down_`, `poutdown_`                                                                                         | Downtime                                                                       | Not linked to payments                                                                                            |
| `doc_`                                                                                                       | Dispute evidence document                                                      |                                                                                                                   |
| `x-razorpay-event-id` (header)                                                                               | Webhook event                                                                  | Dedupe key                                                                                                        |

### 8. Sensitive fields

Redact or mask by default:

- **Card data**: `card.name`, `card.last4` together with `card.iin` / `token_iin` / `card.issuer`, `card_id`, `token_id`, `acquirer_data.auth_code`, `acquirer_data.authentication_reference_number`. Full card numbers and CVV are not part of the documented responses.
- **UPI and bank data**: `vpa`, `upi.vpa`, `fund_account.vpa.address` / `username` / `handle`, bank account numbers and IFSC in TPV orders and fund accounts (`account_number`, `payee_ifsc` in notes), `debit_account_number`, `bank_transaction_id`, `rrn`, `arn`, `utr`, `settlement_utr`.
- **Personal data**: `email`, `contact`, customer names in `notes`, `ip` and `user_agent` in S2S payment requests, dispute `evidence.summary` and evidence document ids.
- **Signatures and secrets**: `X-Razorpay-Signature`, `razorpay_signature`, the `Authorization: Basic` header (base64 of key id and key secret), key secret and webhook secret (never request them), OAuth bearer tokens, `X-Payout-Idempotency` values.
- **Merchant identifiers**: `account_id` (`acc_`), key id (`rzp_` prefix is **NOT DOCUMENTED** in the pages read, so do not rely on it), `callback_url`, `notes`, `reference_id`, `narration`, `receipt`.

### 9. Structural detection hints

Strong Razorpay signals (combine several):

1. **Error envelope**: top-level `error` object with upper-case `code` ending in `_ERROR` (`BAD_REQUEST_ERROR`, `SERVER_ERROR`, `GATEWAY_ERROR`) **and** at least two of `source`, `step`, `reason`, `metadata`, `description`. The placeholder `"NA"` in `source` / `step` / `reason` is characteristic. The SDK variant wraps it as `{ "statusCode": 400, "error": { ... } }`.
2. **Entity JSON**: `"entity": "payment" | "order" | "refund" | "dispute" | "settlement" | "payout" | "collection"` together with an `id` whose prefix matches (`pay_`, `order_`, `rfnd_`, `disp_`, `setl_`, `pout_`) followed by 14 alphanumerics. The flat `error_code` + `error_description` + `error_source` + `error_step` + `error_reason` quintet on a payment is decisive. `acquirer_data`, `amount_refunded`, `refund_status`, `captured` (boolean), `base_amount` and integer `created_at` are supporting fields.
3. **Webhook**: `"entity": "event"` + `event` (dotted lowercase) + `contains` (array) + `payload.<name>.entity` + `account_id` starting `acc_`. Headers `X-Razorpay-Signature` and `x-razorpay-event-id`.
4. **Checkout / callback**: keys `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` (brand name in the key).
5. **S2S creation**: `razorpay_payment_id` + `next[]` of `{action: "redirect" | "poll" | "intent", url}` with URLs on `api.razorpay.com/v1/payments/...` or `upi://pay?...`.
6. **Payout**: `entity: "payout"`, `pout_`, `fund_account_id` (`fa_`), `mode` in upper case (`IMPS`, `NEFT`, `RTGS`, `UPI`), `utr`, `purpose`, `status_details{description, source, reason}`.
7. **Hosts**: `api.razorpay.com`, `prod-api-static.razorpay.com`, `x.razorpay.com` (RazorpayX dashboard links).
8. **Value shapes**: currency mostly `INR`; 4-letter Indian bank codes (`HDFC`, `UTIB`, `SBIN`); `method` values `upi`, `netbanking`, `wallet`, `emi`; UPI VPAs `name@handle`.

How this differs from supported providers:

- **Stripe**: `object` (not `entity`), ids `pi_` / `ch_` / `evt_`, events `{object: "event", type, data.object}`, errors `{error: {type, code, message, decline_code, param}}` with lowercase codes. Razorpay uses `entity`, `event`, `payload`, and upper-case `code` with `source` / `step` / `reason`.
- **Checkout.com**: payment ids also start with `pay_`, but they are 26 lowercase base32 characters (`pay_mbabizu24mvu3mela5njyhpit4`, checkout research file) versus Razorpay's 14 mixed-case alphanumerics; Checkout.com errors are `{request_id, error_type, error_codes[]}`. **`pay_` alone must not decide.**
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in Razorpay payloads.
- **PayPal**: `event_type` in upper-case dotted form, `resource`, errors with `name` + `debug_id`. PayPal also has `status_details.reason`, so a payout `status_details` object alone is not decisive; require `entity: "payout"` or `pout_`.
- **Braintree**: GraphQL `errors[]` with `extensions`, or `bt_signature` / `bt_payload` notifications. No overlap.
- **Mollie**: next-generation webhooks use **the same event names** as Razorpay for some events (`payment.failed`, `refund.failed`), but Mollie's envelope is `resource: "event"`, `type`, `entityId`, `_embedded` (mollie research file). Event names alone must not decide; require `entity: "event"` + `event` + `contains`.
- **Square**: `type` such as `payment.updated` with `event_id`, `merchant_id`, `data.object`; errors `errors[]` with `category`, `code`, `detail`.
- **NMI**: URL-encoded `response`, `responsetext`, `transactionid`; the JSON error variant uses `error_code` such as `E_VALIDATION` (nmi research file). Razorpay `error_code` sits next to the other four `error_*` fields and holds `BAD_REQUEST_ERROR`.
- **Worldpay, Cybersource, Authorize.net**: their own envelopes (`errorName`; `status` / `reason` / `details`; `messages.resultCode`). Cybersource's top-level `reason` is a string next to `status` and `message`, never inside an `error` object with `source` and `step`.
- **Nuvei**: `errCode`, `reason`, `status: "ERROR"`, `gwErrorCode`, `internalRequestId`. Nuvei's `reason` is a sentence; Razorpay's is a snake_case token inside `error`.
- **payabl.**: form-encoded `transactionid`, `errormessage`, `security`. No overlap.
- **High-risk adapters**: Verotel FlexPay postbacks use an `event` parameter in a query string (verotel research file) and Skrill uses `account_id` for currency sub-accounts (skrill research file); both are form or query-string data without `entity` or `contains`, so the JSON envelope rule above separates them.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Non-exhaustive reason lists**: the payment pages call their tables "top error codes". Unknown reasons must fall back to `unknown`.
2. **Undocumented reason in the main sample**: `invalid_otp` (sample on D/errors.md and both rainy-day pages) is in no table; the tables use `incorrect_otp`.
3. **Duplicate and malformed rows** in the Error Reasons page: `funds_blocked_by_mandate` and `psp_not_available` appear twice with the same text; `issuer_technical_error` and `payment_method_not_enabled` appear twice with different text; `psp_app_ not_available` contains a space. The next step for `invalid_response_from_gateway` ("retry with the correct ATM PIN") and for `mismatch_in_transaction_details` ("get the required card network enabled") are copied from other rows.
4. **Conflicting meanings between pages** for the same reason: `capture_failed`, `credit_not_permitted`, `international_transaction_not_allowed`, `invalid_amount` (amount only vs amount or currency), `authentication_failed` (failure-analysis page says "incorrect card details"). `payment_cancelled` and `credit_failed` also cover partner or customer bank downtime on the Cards and UPI pages.
5. **`source` value sets disagree**: the list page names `customer`, `business`, `gateway`, `razorpay`; the methods page uses `internal`, `issuer_bank`, `customer_psp`, `network`, `beneficiary_bank`, `issuer`, `bank`; webhook samples use `bank` for netbanking although the netbanking list does not include it. RazorpayX says API errors have only `business` or `internal`.
6. **HTTP success code**: D/errors.md says all successes are HTTP 200; D/api/understand.md lists 201 and 202 as common successes. Many "not found" errors are documented as HTTP 400.
7. **`id` type**: D/api/understand.md declares the common `id` attribute as `integer` but describes and shows it as a 14-character string. Some sample ids do not have 14 characters (`order_DBJKIP31Y4jl8`, `cust_BtQNqzmBlXXXX`, `disp_0000000000000`); one contains `$` (`token_KOdY$DBYQOv08n`); the S2S netbanking redirect URL uses `payments/FVptEs3cSWX1fs/authorize` without a prefix and with a different id than `razorpay_payment_id`.
8. **Invalid JSON in examples**: inline `//` comment in the payment entity success example; missing comma after `status_details` in the payout entity and `payout.pending` samples; trailing commas in the `status_details` samples and after the `payout.processed` sample; misplaced braces in `refund.speed_changed` (`created_at` inside `payload`); zero-width space characters around values in `payout.downtime.started`; `"contact": "++919900000000"` in `payment.dispute.lost`. A tolerant parser must not depend on these samples being valid.
9. **Sample states that contradict the field rules**: card `payment.authorized` and `payment.failed` samples have `captured: true`; card samples use `""` instead of `null` for `error_code` / `error_description` even on `payment.failed` (so the failed card sample has no reason at all); the `payment.dispute.won` and `under_review` samples show an `authorized`, uncaptured payment; `refund.created` samples already show `status: "processed"`; the capture example has a `upi` object on a `method: "card"` payment.
10. **Enum mismatches**: card `sub_type` is documented as `customer` / `business` but examples show `consumer`; payment `method` lists five values while the methods page also has `cardless_emi`, `paylater`, `bank_transfer`, `emandate`, `cod`; payout `mode` lists `NEFT`, `RTGS`, `IMPS` but samples use `UPI`; payout entity statuses omit `scheduled`; downtime `status` in the Node SDK is `scheduled | started | resolved | cancelled` while webhooks show `updated`; RazorpayX downtime `source` is `beneficiary` in one sample and `BENEFICIARY` in another; the Node SDK types `refund_status` as the string `'null'`.
11. **Refund statuses**: the entity lists `pending`, `processed`, `failed`; the guide lists only `processed` and `failed`; the FAQ names "Reversed" as a final status and says `refund.processed` delivers failures too, while a separate `refund.failed` event exists. Normal refund duration is 5-7 working days (entity, auto-refund) but 7-10 working days on the Normal Refunds page.
12. **Settlement timing**: the settlement webhook tip says the event fires "after Razorpay has successfully transferred funds", while the warning on the same page says `processed` only confirms initiation and credit can take up to 3 hours.
13. **Payout terminal states**: `processed` is called terminal but can move to `reversed`; the webhook ordering page says to ignore any webhook after `processed`, which would drop a later `payout.reversed`. `reversed` can become `failed` and `failed` can become `reversed` depending on account type.
14. **Dispute fields**: `reason_description` is documented but absent from every example; `reason_code` has no value list; `under_review` is described as "is reviewing" on the entity page and "has reviewed" on the guide.
15. **Webhook signature example**: the Node.js snippet on D/webhooks/validate-test.md passes `JSON.stringify(webhookBody)`, contradicting the instruction not to parse or re-serialise the body.
16. **Retry wording**: best practices says retries run "for 24 hours after event creation"; the FAQ says "24 hours after event creation timestamp", which can be read as a start delay. Retry intervals are not given.
17. **Webhook body has no event id**; deduplication needs the `x-razorpay-event-id` header, which pasted payloads usually lack.
18. **`payment.failed` scope**: "`payment.failed` is not triggered if the payment fails during authorisation (while making the first payment)" is unexplained and conflicts with the netbanking `payment.failed` sample whose `error_step` is `payment_authorization`.
19. **Recon `notes`** is documented as an object but the examples show a string.
20. **Regional and product limits**: UPI Collect deprecated from 28 February 2026 with exemptions; RazorpayX Lite closed to new merchants; RazorpayX and payroll India-only; settlements in INR only; `payout.queued` only for RazorpayX Lite; manual capture not supported for bank transfer.
21. **Not read**: Route, Subscriptions, Invoices, Payment Links, QR codes, Smart Collect, Optimizer, POS, Partner and Turbo UPI pages; fund-account and contact entities; downtime entity; the per-method S2S request field pages. Anything only there is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | One error object across API responses, payment entities, webhooks and the browser handler, with 111 documented payment reasons, 7 RazorpayX API reasons, 35 payout status reasons and documented `source` / `step` meanings, plus Razorpay's own next-step advice. Unknown reasons, the undocumented `invalid_otp`, and page-to-page wording differences are handled by falling back to `unknown` and quoting the page set.                       |
| **paymentResponses** | **supported** | Payment, order, refund, dispute, settlement and payout entities have field tables and JSON examples, including a failed payment with all five `error_*` fields. The invalid-JSON and contradictory examples (section 10) mean tests should be built from the field tables, not copied samples.                                                                                                                                                    |
| **webhookParsing**   | **supported** | One envelope (`entity: "event"`, `event`, `contains`, `payload`, `created_at`) for every event, a complete event list and per-method samples. Signature and event-id headers are documented. Limits to state in the UI: no event id in the body, snapshots may lag the current state, field order varies.                                                                                                                                         |
| **timeline**         | **limited**   | Clear state machines for orders, payments, refunds, disputes and payouts, `created_at` on entities and events, and documented late-authorisation and failed-then-captured sequences. But only `created_at` (no per-transition timestamps) is in the payment entity, webhook order is not guaranteed, refunds can show `processed` before the bank confirms, and payouts can leave a "terminal" state.                                             |
| **correlation**      | **supported** | Prefixed ids with explicit parent links: refund and dispute `payment_id`, payment `order_id`, webhook payloads that carry both parent and child (`order.paid`, `refund.*`, `payment.dispute.*`), `error.metadata.payment_id` / `order_id` on API errors, and recon items linking `setl_` to payments, refunds and disputes. Settlements and payouts are correlated only through the recon API and `reference_id`, which the adapter should state. |
