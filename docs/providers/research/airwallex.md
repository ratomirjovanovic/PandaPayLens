# Airwallex (adapter id `airwallex`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Airwallex's first-party documentation, Airwallex's own website and Airwallex's official GitHub repositories as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Method: documentation pages were discovered through the site's own page index (`https://www.airwallex.com/docs/llms.txt`) and docs sitemap (`https://www.airwallex.com/docs/sitemap.xml`), then downloaded in the Markdown form the site serves for every docs page (the page URL with a `.md` suffix) and read as text. Code tables were extracted mechanically from that Markdown and every code value in this file was checked against the extraction, so code values are exact; meanings are paraphrased. The official OpenAPI 3.1 specification (`airwallex/airwallex-openapi`, version folder `2026-08-21`) was used to cross-check error codes, webhook event names and schemas. No page needed a login; the Airwallex web app (webhook setup, event list, sample payload previews) was not used.
- Naming note: Airwallex uses "PaymentIntent" and "PaymentAttempt" for its own objects. The words overlap with Stripe's vocabulary, but the JSON shapes, ID prefixes, status values and event envelopes are different (section 9).

---

## Summary

| Item                          | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                       | `documentation_verified` (gate items 1-5 and 7-10 yes; item 6 yes for the sectors Airwallex names, with no restricted-business list found)                                                                                                                                                                                                                                                                                                            |
| Classification                | `acquiring`, `card_processing`, `gateway`, `alternative_payment_method`; `orchestration` as a claim only (dynamic routing, merchant routing rules). `wallet`, `payment_facilitator` and `merchant_account_intermediary` are not claimed by the pages read                                                                                                                                                                                             |
| Documented sectors            | Ecommerce and online retail, marketplaces, SaaS, travel (solutions pages); digital content providers, B2B and professional services, retail and F&B (payments use-case pages); digital products such as games, SaaS, design assets, e-books and digital vouchers for the Merchant of Record beta                                                                                                                                                      |
| Documentation access          | **Public** (no login) for product docs, the API reference, webhook docs and code tables. Webhook subscription setup, event delivery logs and sample payload previews live in the Airwallex web app and need an account; they were not used                                                                                                                                                                                                            |
| API family to implement first | **Payments Client API** JSON (`/api/v1/pa/...`): PaymentIntent and PaymentAttempt snapshots, Refund and PaymentDispute objects, and the shared error body (`code`, `message`, `source`, `trace_id`, `details`, `provider_original_response_code`). Together with **payments webhooks** (`{id, name, account_id, data.object, created_at, version}`), whose `data.object` is the same schema as the Retrieve APIs                                      |
| Documented codes              | 429 code rows in total. Payments acceptance: 263 (API error `code` 31, PaymentAttempt `failure_code` 6, issuer response codes 176 rows covering 162 distinct strings, Mastercard MAC 5, AVS 23 rows, CVC 7 rows, Airwallex.js 15). Payouts: 166 (transfer API codes 34, transfer field-validation codes 103, transfer failure codes 29). Plus enumerations for statuses, dispute stages and dispute reasons                                           |
| Biggest limitations           | Issuer response codes collide across card brands (14 code strings have different meanings per brand, for example `100`, `65`, `82`), so the brand must be known. Webhook envelope examples disagree (`account_id` vs `accountId`, event `id` formats, timestamp formats, a dispute payload in an older schema). No example of a FAILED PaymentAttempt with `failure_details`. Payloads depend on the API version (`x-api-version`, webhook `version`) |
| White-label                   | No. Airwallex documents itself as an acquirer and payment processor with its own JSON formats. Some payment methods settle outside Airwallex (`settle_via` `paypal` or `amex`), but the merchant still receives Airwallex objects                                                                                                                                                                                                                     |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://www.airwallex.com/docs`. Docs pages were fetched as `<page>.md`. The docs pages show no per-page modification date; the API reference shows the API version list (latest `2026-08-21`).

| URL                                                                                                                                                                                                                                                                          | What it covers                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://www.airwallex.com/robots.txt, https://www.airwallex.com/sitemap-index.xml, D/sitemap.xml, D/llms.txt, https://www.airwallex.com/global/sitemap-landing.xml, https://www.airwallex.com/en-us/sitemap-landing.xml, https://www.airwallex.com/en-uk/sitemap-landing.xml | Page discovery only                                                                                                                                                                              |
| D/payments/troubleshooting/error-response-codes                                                                                                                                                                                                                              | **Main error table**: HTTP status codes, error body fields (`code`, `source`, `message`, `trace_id`, `details`), 400 codes, 401/404/500 codes, four example error bodies                         |
| D/payments/troubleshooting/response-codes                                                                                                                                                                                                                                    | Index of the issuer, AVS, CVC2/CVV2 and Merchant Advice Code pages                                                                                                                               |
| D/payments/troubleshooting/response-codes/issuer-response-codes                                                                                                                                                                                                              | **Issuer response codes** (176 rows, by card brand) with explanations and next steps                                                                                                             |
| D/payments/troubleshooting/response-codes/avs-codes                                                                                                                                                                                                                          | AVS result codes per scheme                                                                                                                                                                      |
| D/payments/troubleshooting/response-codes/cvc2cvv2-codes                                                                                                                                                                                                                     | CVC2/CVV2 result codes                                                                                                                                                                           |
| D/payments/troubleshooting/response-codes/merchant-advice-code                                                                                                                                                                                                               | Mastercard Merchant Advice Codes with valid issuer-code combinations                                                                                                                             |
| D/payments/reference/payment-statuses                                                                                                                                                                                                                                        | PaymentIntent statuses, the webhook emitted for each, required merchant action                                                                                                                   |
| D/payments/reference/payments-webhooks and D/developer-tools/webhooks/listen-for-webhook-events/online-payments (identical content)                                                                                                                                          | **Payments webhook event list** and payload examples for PaymentIntent, PaymentAttempt, PaymentConsent, Customer, Refund, PaymentMethod, Dispute, PaymentLink; POS, fraud and funds split events |
| D/developer-tools/webhooks/webhooks-overview                                                                                                                                                                                                                                 | Delivery, 200 acknowledgement, retries (exponential back-off over about three days), duplicates, ordering, signing                                                                               |
| D/developer-tools/webhooks/listen-for-webhook-events                                                                                                                                                                                                                         | **Event envelope fields**, delivery headers `x-timestamp` and `x-signature`, signature recipe, test-event header, source IP list                                                                 |
| D/developer-tools/webhooks/view-and-re-trigger-webhook-events                                                                                                                                                                                                                | Event retention (30 days), delivery statuses, manual re-trigger                                                                                                                                  |
| D/developer-tools/webhooks/listen-for-webhook-events/transfers                                                                                                                                                                                                               | Payout transfer and batch transfer webhook events and a full transfer event example                                                                                                              |
| D/api/introduction                                                                                                                                                                                                                                                           | Base URLs; the HTML version of the same page lists the API versions                                                                                                                              |
| D/api/payments/payment_intents                                                                                                                                                                                                                                               | PaymentIntent endpoints and events                                                                                                                                                               |
| D/api/payments/payment_intents/create, /confirm, /confirm_continue, /capture, /cancel, /retrieve                                                                                                                                                                             | Request and response fields, response examples, per-endpoint error code lists                                                                                                                    |
| D/api/payments/payment_attempts, D/api/payments/payment_attempts/retrieve                                                                                                                                                                                                    | PaymentAttempt endpoints, events and response example                                                                                                                                            |
| D/api/payments/refunds, D/api/payments/refunds/create, D/api/payments/refunds/retrieve                                                                                                                                                                                       | Refund endpoints, events, fields, statuses, examples, errors                                                                                                                                     |
| D/api/payments/payment_disputes, D/api/payments/payment_disputes/retrieve                                                                                                                                                                                                    | PaymentDispute endpoints, events, stages, statuses, reason types, example                                                                                                                        |
| D/api/authentication/api_access_token/login                                                                                                                                                                                                                                  | Access token request headers (`x-client-id`, `x-api-key`, `x-login-as`), `token`, login error codes                                                                                              |
| D/api/payouts/transfers/retrieve                                                                                                                                                                                                                                             | Transfer object fields including `failure` and `funding.failure_details`                                                                                                                         |
| D/payments/get-started/using-payments-intent-api                                                                                                                                                                                                                             | PaymentIntent creation, `request_id` idempotency, `client_secret` lifetime and handling                                                                                                          |
| D/payments/about-airwallex-payments, D/payments/overview, D/payments/about-airwallex-payments/how-airwallex-payments-work                                                                                                                                                    | Product scope, lifecycle overview, settlement batches, routing claim                                                                                                                             |
| D/payments/about-airwallex-payments/payments-data-model                                                                                                                                                                                                                      | Object relationships: PaymentIntent, PaymentAttempt, Customer, PaymentMethod, PaymentConsent, Refund, PaymentDispute                                                                             |
| D/payments/about-airwallex-payments/choose-your-payments-solution, D/payments/get-started/get-started-with-payments                                                                                                                                                          | Use cases and "typical business types"                                                                                                                                                           |
| D/payments/merchant-of-record                                                                                                                                                                                                                                                | Merchant of Record beta: eligibility (digital products only)                                                                                                                                     |
| D/payments/payment-operations, D/payments/payment-operations/manage-payments                                                                                                                                                                                                 | Post-payment operations overview                                                                                                                                                                 |
| D/payments/payment-operations/manage-payments/place-a-hold-on-a-payment-method                                                                                                                                                                                               | `auto_capture`, `authorization_type`, hold windows per scheme, partial capture                                                                                                                   |
| D/payments/payment-operations/manage-payments/cancellations                                                                                                                                                                                                                  | Cancel flow and example response                                                                                                                                                                 |
| D/payments/payment-operations/manage-payments/refunds                                                                                                                                                                                                                        | Refund eligibility, refundable funds, statuses and webhooks, example                                                                                                                             |
| D/payments/payment-operations/disputes, D/payments/payment-operations/disputes/dispute-flow, D/payments/payment-operations/disputes/dispute-notifications, D/payments/payment-operations/disputes/handle-disputes-using-our-apis                                             | Dispute stages and statuses, timing, webhook-to-stage mapping, a full dispute webhook example, auto-response rules                                                                               |
| D/payments/about-airwallex-payments/settle-into-your-airwallex-balance, D/payments/about-airwallex-payments/reserve-plan                                                                                                                                                     | Settlement batches and timing, reserves                                                                                                                                                          |
| D/payments/about-airwallex-payments/cof-payments                                                                                                                                                                                                                             | Credential on file (CIT / MIT) concepts                                                                                                                                                          |
| D/payments/integration-options/web-checkout/native-api/3d-secure-authentication/native-api-(for-api-versions-on-or-after-2024-06-14)                                                                                                                                         | 3DS flow, `REQUIRES_CUSTOMER_ACTION` example with `next_action`, version note on `redirect_form`                                                                                                 |
| D/payments/integration-options/web-checkout/native-api/guest-user-checkout                                                                                                                                                                                                   | Native API flow                                                                                                                                                                                  |
| D/payments/test-and-go-live/test-card-numbers                                                                                                                                                                                                                                | Test cards with issuer codes and internal error codes, 3DS failure bodies, AVS scenarios, suggested shopper messages per code                                                                    |
| D/payments/payment-methods/payment-method-onboarding-requirement                                                                                                                                                                                                             | Onboarding requirements per method; US merchant requirement                                                                                                                                      |
| D/payments/reference/supported-currencies                                                                                                                                                                                                                                    | Currency list and decimal precision                                                                                                                                                              |
| D/developer-tools/api/rate-limits                                                                                                                                                                                                                                            | Rate and concurrency limits, HTTP 429 body `too_many_requests`, access token lifetime                                                                                                            |
| D/developer-tools/sdks/airwallex.js/error-codes                                                                                                                                                                                                                              | Airwallex.js browser error codes (common, payment, payout, onboarding, compliance)                                                                                                               |
| D/developer-tools/sdks/server-side-sdks-(beta)                                                                                                                                                                                                                               | Node.js SDK (beta): error classes, retryable errors, date-based API versioning                                                                                                                   |
| D/developer-tools/sandbox-environment/payments                                                                                                                                                                                                                               | Sandbox payment simulation overview                                                                                                                                                              |
| D/payouts/errors/transfer-error-codes                                                                                                                                                                                                                                        | Transfer error body, transfer API codes, numeric field-validation codes                                                                                                                          |
| D/payouts/transfers/manage-transfers, D/payouts/transfers/create-a-transfer/transfer-statuses, D/payouts/transfers/manage-transfers/failure-reasons, D/payouts/transfers/manage-transfers/handle-failed-transfers                                                            | Transfer statuses, funding statuses, failure codes `9xxxx`                                                                                                                                       |
| https://www.airwallex.com/global/solutions/ecommerce, .../marketplaces, .../saas, .../travel; https://www.airwallex.com/global/payments/payment-gateway                                                                                                                      | Sectors in Airwallex's own words; gateway positioning                                                                                                                                            |
| https://www.airwallex.com/global, https://www.airwallex.com/en-uk, https://www.airwallex.com/en-eu, https://www.airwallex.com/en-au, https://www.airwallex.com/en-sg, https://www.airwallex.com/en-hk, https://www.airwallex.com/en-us/state-licenses                        | Company activity and regulatory footers (licences per entity)                                                                                                                                    |
| https://www.airwallex.com/global/terms/sign-up-terms                                                                                                                                                                                                                         | Searched for a prohibited or restricted business list; none found on this page                                                                                                                   |
| https://api.github.com/orgs/airwallex/repos and https://github.com/airwallex/airwallex-openapi (repository metadata, `README.md`, `openapi/client-api/2026-08-21/airwallex-openapi-2026-08-21.json`)                                                                         | Official repositories; OpenAPI 3.1 spec (MIT-licensed repository, last push 2026-10-16): `x-api-version` header, `Error` schema, 308 webhook names, per-endpoint error lists                     |

Official SDK repositories seen in the organization listing (metadata only): `airwallex/airwallex-payment-android` (last push 2026-09-30), `airwallex/airwallex-payment-ios` (2026-10-13), `airwallex/airwallex-payment-react-native` (2026-10-19), `airwallex/airwallex-payment-flutter` (2026-09-16), `airwallex/airwallex-cli` (2026-10-21). The server-side Node.js SDK is published on npm as `@airwallex/node-sdk` (beta) per the SDK page.

Also tried: `https://www.airwallex.com/global/terms/prohibited-activities`, `https://www.airwallex.com/global/terms/payment-acceptance-terms` and `https://www.airwallex.com/global/legal` return 404.

Not read: Payment Consents and Payment Methods API reference pages, Increment Authorization, Financial Transactions and Settlement Records APIs, batch transfer error codes, connected account error codes, older-API-version payout pages, local payment method dispute pages (Klarna, PayPal and Venmo, Afterpay, Cash App Pay, Tabby), Payments for Platforms pages, POS and SoftPOS pages. Facts that would come only from those pages are **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | Home pages state "Trusted by over 675,000 businesses"; the API reference lists API version `2026-08-21` as latest; the official OpenAPI repository was last pushed 2026-10-16; mobile SDK repositories were pushed in September and October 2026                                                                                                                                                                                          |
| 2   | Payment service operational      | yes    | Production `https://api.airwallex.com` and sandbox `https://api.sandbox.airwallex.com` (API introduction); production and sandbox rate limits (rate-limits page); live webhook IP lists for production and sandbox (listen-for-webhook-events)                                                                                                                                                                                            |
| 3   | Docs publicly accessible         | yes    | Product docs, API reference, webhook docs and all code tables load without login. The web app (webhook subscriptions, event delivery log, sample payload previews, reports) needs an account and was not used                                                                                                                                                                                                                             |
| 4   | API families/versions identified | yes    | Client API under `/api/v1/` with payments acceptance under `/api/v1/pa/`; date-based versions selected with the `x-api-version` header (OpenAPI README); version list on the API reference from `2022-12-13` to `2026-08-21`; webhooks carry the subscription `version`                                                                                                                                                                   |
| 5   | Offline-examinable formats       | yes    | JSON response examples for every endpoint read; four error body examples; webhook envelope and per-object payload examples; full field tables                                                                                                                                                                                                                                                                                             |
| 6   | Sectors documented               | yes    | Solutions pages for ecommerce, marketplaces, SaaS and travel; use-case tables naming business types; Merchant of Record beta limited to digital products. No prohibited or restricted business list was found in the pages read                                                                                                                                                                                                           |
| 7   | Regional/regulatory limits       | yes    | UK: Airwallex (UK) Limited, FCA-authorised EMI, FRN 900876. EU: Airwallex (Netherlands) B.V. (DNB, licence R179622) and AWX Lithuania, UAB (Bank of Lithuania), both EMIs. Australia: Airwallex Pty Ltd, AFSL 487221 (ASIC). Singapore: Airwallex (Singapore) Pte. Ltd., Major Payment Institution, MAS licence PS20200541. Hong Kong: Money Service Operator licence 16-09-01929. US: Airwallex US, LLC, money transmitter, NMLS 1928093 |
| 8   | Diagnostic value                 | yes    | 31 API error codes with HTTP mapping, 176 issuer response code rows with explanations, PaymentIntent (7) and PaymentAttempt (10) status sets, refund and dispute lifecycles, 71 payments webhook events (60 without POS terminal events) with an event ID, documented retries, ordering and signing                                                                                                                                       |
| 9   | Own technical formats            | yes    | Airwallex-specific JSON (`int_`, `att_`, `rfd_`, `dst_` IDs, uppercase statuses, `latest_payment_attempt`, `provider_original_response_code`, `trace_id`, event `name`). Issuer response code page: "Airwallex as an acquirer will receive an issuer response code". Not a resale of a gateway PandaPayLens supports                                                                                                                      |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Webhook signatures need the per-subscription secret, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                            |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acquiring`                  | Issuer response codes page: "Airwallex as an acquirer will receive an issuer response code in authorization response from card networks". `acquirer_reference_number` is populated on captured attempts                                                                       |
| `card_processing`            | Reserve plan page: "As a payment processor, Airwallex is responsible for the disputes and refunds"; card authorization, capture, cancel and refund flows; scheme-specific issuer codes for Visa, Mastercard, UnionPay, Cartes Bancaires, Amex, JCB, Discover, Diners          |
| `gateway`                    | About Airwallex Payments: "Airwallex payment gateway connects payment acceptance directly to our global financial infrastructure"; payment-gateway page ("online payment gateway")                                                                                            |
| `alternative_payment_method` | "cards (Visa, Mastercard) and 160+ local payment methods (Alipay, iDEAL, GrabPay)"; the PaymentAttempt `payment_method` object has about 80 method sub-objects (for example `alipaycn`, `ideal`, `klarna`, `paypal`, `sepa_direct_debit`, `wechatpay`)                        |
| `orchestration` (claim only) | About Airwallex Payments: "Dynamically routes transactions to the most suitable provider"; error code `rejected_by_routing_rules`. No field exposing the routing decision was found                                                                                           |
| Not claimed                  | `wallet` (the "Airwallex Wallet" is the merchant's multi-currency business balance, not a consumer wallet; `airwallex_pay` exists as a payment method but was not researched), `payment_facilitator` (Payments for Platforms pages not read), `merchant_account_intermediary` |

Sectors, in Airwallex's own words (each needs the merchant's own jurisdiction, licensing and underwriting; listing a sector here says nothing about approval):

| Sector                                     | Source and wording                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ecommerce and online retail                | https://www.airwallex.com/global/solutions/ecommerce: "a payment processing solution built for international eCommerce and retail brands"                                                                                                |
| Marketplaces                               | https://www.airwallex.com/global/solutions/marketplaces: "Onboard global sellers, creators, freelancers and more. Accept payments and send funds worldwide"                                                                              |
| SaaS                                       | https://www.airwallex.com/global/solutions/saas: "embedding financial services, including payment acceptance, card issuing, accounts, and more"                                                                                          |
| Travel                                     | https://www.airwallex.com/global/solutions/travel: "Boost bookings from travelers, pay global suppliers more efficiently". The PaymentIntent schema also has `additional_info.online_travel_agency_data` and `online_ticket_agency_data` |
| Digital content, subscriptions             | D/payments/get-started/get-started-with-payments: online checkout is "Typical for ecommerce, SaaS, and digital content providers"; subscriptions "Typical for SaaS, memberships, and usage-based products"                               |
| B2B and professional services              | Same page: invoices and links "Typical for B2B services, agencies, and professional services"; use-case table: "Wholesaler, Social seller, Professional service provider"                                                                |
| Retail and F&B (in person)                 | Same page: "Typical for retail, F&B, and hybrid experiences"                                                                                                                                                                             |
| Digital products (Merchant of Record beta) | D/payments/merchant-of-record: "Supported examples include games and in-game items, SaaS and software, design assets, e-books, and digital vouchers. Physical goods are not supported."                                                  |

Adult, iGaming, crypto, nutraceuticals and other high-risk sectors: **NOT DOCUMENTED** in the pages read (neither accepted nor excluded). A prohibited or restricted business list was not found.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

All APIs share one host per environment (`https://api.airwallex.com`, `https://api.sandbox.airwallex.com`), JSON request and response bodies, and a bearer token from `POST /api/v1/authentication/login`. Versions are dates selected by the `x-api-version` request header; without it the account's default version applies (OpenAPI README). Webhook subscriptions have their own API version that "determines the structure of the notifications you receive, including event names and payload fields".

| Family                                               | Endpoint(s) / delivery                                                                                                                                                                                                                                                | Format                                                            | Relevance                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Payments: PaymentIntents**                         | `POST /api/v1/pa/payment_intents/create`, `GET /api/v1/pa/payment_intents/{id}`, `GET /api/v1/pa/payment_intents`, `POST .../{id}/update`, `.../{id}/confirm`, `.../{id}/confirm_continue`, `.../{id}/capture`, `.../{id}/increment_authorization`, `.../{id}/cancel` | JSON; 200/201 with the PaymentIntent, 4xx/5xx with the error body | **Primary.** The intent embeds `latest_payment_attempt`, which carries the decline detail                          |
| **Payments: PaymentAttempts**                        | `GET /api/v1/pa/payment_attempts/{id}`, `GET /api/v1/pa/payment_attempts`                                                                                                                                                                                             | JSON                                                              | **Primary.** Attempt status, `failure_code`, `failure_details`, issuer code, MAC, 3DS and fraud data               |
| **Payments: Refunds**                                | `POST /api/v1/pa/refunds/create`, `GET /api/v1/pa/refunds/{id}`, `GET /api/v1/pa/refunds`                                                                                                                                                                             | JSON                                                              | **Primary**                                                                                                        |
| **Payments: PaymentDisputes**                        | `GET /api/v1/pa/payment_disputes/{id}`, list, `.../update`, `.../accept`, `.../challenge`, `.../related_payment_intents`                                                                                                                                              | JSON                                                              | Secondary (dispute timeline)                                                                                       |
| **Webhooks**                                         | HTTPS POST to the subscription's notification URL                                                                                                                                                                                                                     | JSON body; `x-timestamp` and `x-signature` headers                | **Primary.** 10 PaymentIntent, 14 PaymentAttempt, 4 Refund, 9 PaymentDispute events plus consent, method, customer |
| Payments: PaymentConsents, PaymentMethods, Customers | `/api/v1/pa/payment_consents/...`, `/api/v1/pa/payment_methods/...`, `/api/v1/pa/customers/...` (reference pages not read)                                                                                                                                            | JSON                                                              | Secondary (recurring and saved-card correlation)                                                                   |
| Payouts: Transfers                                   | `/api/v1/transfers/...` (Retrieve read), batch transfers                                                                                                                                                                                                              | JSON; transfer events put the transfer directly in `data`         | Later phase. Separate product (outbound money), own error and failure codes                                        |
| Airwallex.js / mobile SDKs                           | Browser and app SDK callbacks                                                                                                                                                                                                                                         | JS objects with an error `code` and message                       | Out of scope at first; client-side only                                                                            |
| Authentication                                       | `POST /api/v1/authentication/login`                                                                                                                                                                                                                                   | JSON (`token`, `expires_at`)                                      | Only for recognizing and redacting tokens                                                                          |

**Recommendation: implement first** the Payments Client API JSON objects (PaymentIntent with `latest_payment_attempt`, PaymentAttempt, Refund) and the shared error body, together with payments webhooks for `payment_intent.*`, `payment_attempt.*` and `refund.*`. These are what a developer is most likely to paste, `data.object` in those webhooks is documented as the same schema as the Retrieve API, and the decline detail (`provider_original_response_code`, `merchant_advice_code`, `failure_code`, `failure_details`) lives in the same objects. Add `payment_dispute.*` next, then payout transfers as a separate format.

### 3. Response and error formats

#### 3.1 Content type, encoding and HTTP status

- **Requests and responses**: JSON (`Content-Type: application/json` in every cURL example). Amounts are JSON numbers in **major units** ("$9.99 is represented as `9.99`", PaymentIntents guide; examples `16.66`, `49.12`, `100.0`).
- **Timestamps**: ISO 8601 strings. The API reference uses `+00:00` offsets (`2025-01-31T06:57:10+00:00`); guides and webhook examples use `+0000` (`2023-01-13T07:32:05+0000`), sometimes with milliseconds (`2021-03-03T08:17:27.659+0000`). Parse all three.
- **HTTP status** (error-response-codes page): `200` OK, `201` Created, `400` request invalid or an error "in Airwallex or downstream provider", `401` unauthorized, `404` not found, `500` unexpected Airwallex error. The API reference also lists `403 Forbidden` (no code given) and the rate-limits page adds `429`.
- **Declines are HTTP 400.** An issuer decline on confirm returns HTTP 400 with `code: issuer_declined` (section 3.3 example A), not a 200 with a failed status. The intent then returns to `REQUIRES_PAYMENT_METHOD` (payment statuses page).
- **Idempotency**: `request_id` (merchant UUID, maximum 64 on refunds) on create and operation requests. Retrying with the same `request_id` "will return the original successful response instead of creating a duplicate"; reusing it for a different request gives `duplicate_request`.

#### 3.2 Error body fields

Documented on the error-response-codes page: "the body will generally contain the following fields":

| Field                             | Type   | Meaning                                                                                                |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `code`                            | string | Error code (section 4.1). Lowercase snake case, one value starts with a digit (`3ds_not_supported`)    |
| `source`                          | string | Request parameter that caused the error; "only for code `validation_error`"                            |
| `message`                         | string | Error text; the table header says messages are "subject to change". Do not parse it                    |
| `trace_id`                        | string | Request trace ID for Airwallex support; 32 lowercase hex in every example                              |
| `details`                         | map    | Extra information; empty `{}` in most examples                                                         |
| `provider_original_response_code` | string | Present at top level in the `issuer_declined` example only; not listed in the field table (section 10) |

`details` in the `issuer_declined` example: `card_brand`, `card_type`, `is_commercial`, `issuing_bank_name`, `original_response_code`. The Refund and PaymentAttempt `failure_details.details` description says it "may include `original_response_code`, `original_response_message` from provider, and other contextual information such as card details, risk factors, etc.". The full key set of `details` is **NOT DOCUMENTED**.

Failure objects inside resources (PaymentAttempt and Refund) reuse the same shape: `failure_details` = `{code, message, trace_id, details}`. A PaymentAttempt also has `failure_code` (section 4.2).

Payout transfer errors use the same top-level `code` / `message` / `source` / `details`, but field validation failures use `code: "validation_failed"` with `details.errors[]` items `{source, code, params}` where `code` is a three-digit string (section 4.8). Note `validation_error` (payments) vs `validation_failed` (payouts).

#### 3.3 Examples

Example A: issuer decline. **Transcribed from https://www.airwallex.com/docs/payments/troubleshooting/error-response-codes.md** ("`issuer_declined`"):

```json
{
  "code": "issuer_declined",
  "message": "The card issuer declined this transaction. Please refer to the original response code.",
  "trace_id": "1d2a733d9abb4321abf635a9cd3ed730",
  "provider_original_response_code": "05",
  "details": {
    "card_brand": "mastercard",
    "card_type": "DEBIT",
    "is_commercial": false,
    "issuing_bank_name": "AIRWALLEX BANK",
    "original_response_code": "05"
  }
}
```

Example B: validation error. **Transcribed from the same page** ("`validation_error`"):

```json
{
  "code": "validation_error",
  "source": "merchant_order_id",
  "message": "merchant_order_id must be provided.",
  "trace_id": "e9afc11e3032ebaa4d4c9080ae77b232",
  "details": {}
}
```

Example C: rate limit (HTTP 429). **Transcribed from https://www.airwallex.com/docs/developer-tools/api/rate-limits.md**:

```json
{
  "code": "too_many_requests",
  "message": "Rate Limit Exceeded.",
  "trace_id": "65550cb69fbe78b760be650a64d00269",
  "details": {}
}
```

Example D: cancelled PaymentIntent. **Transcribed from https://www.airwallex.com/docs/payments/payment-operations/manage-payments/cancellations.md**:

```json
{
  "id": "int_tWFe5PBQz9msmRCegzuZoUJcE49",
  "request_id": "c2e5204e-4f1b-402f-b58a-249f2ef34ee1",
  "amount": 100.0,
  "currency": "HKD",
  "merchant_order_id": "f488663a-d610-4f22-83ba-64202d7d76cc",
  "status": "CANCELLED",
  "captured_amount": 0,
  "created_at": "2020-06-28T10:11:49+0000",
  "updated_at": "2020-06-28T10:12:01+0000",
  "cancelled_at": "2020-06-28T10:12:01+0000"
}
```

Example E: refund created (HTTP 201). **Transcribed from https://www.airwallex.com/docs/api/payments/refunds/create.md**:

```json
{
  "id": "rfd_hkpdbybkch3ovunwjy1_1raukh",
  "request_id": "962dbd83-5e7b-4185-b668-596834395c12",
  "payment_intent_id": "int_hkpdskz7vg1xc7uscdj",
  "payment_attempt_id": "att_hkpdskz7vg1xc7uscdj",
  "amount": 10,
  "currency": "USD",
  "reason": "Return goods",
  "status": "RECEIVED",
  "created_at": "2021-01-31T06:57:10+00:00",
  "updated_at": "2021-01-31T07:01:10+00:00"
}
```

Further documented shapes, not transcribed in full: the Retrieve PaymentIntent example with a nested `latest_payment_attempt` (`status`, `provider_original_response_code`, `authorization_code`, `payment_method.card.{bin,last4,brand,fingerprint,...}`, `authentication_data.{ds_data,fraud_data,avs_result,cvc_result}`, `settle_via`) at D/api/payments/payment_intents/retrieve.md, and a `REQUIRES_CUSTOMER_ACTION` intent with `latest_payment_attempt.status` `AUTHENTICATION_REDIRECTED` and `next_action` `{type: "redirect_iframe", method: "GET", url: ".../pa/gateway/hk/domain_secure/redirect/int_.../start?key=..."}` on the 3DS native API page.

### 4. Codes

Code strings are exactly as documented. "Meaning" is a short original paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not Airwallex statements; where Airwallex gives advice (for example "try again later" or "do not retry"), the suggestion follows it.

Where codes appear:

| Field                                                                                                         | Holds                                                    |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `code` (error body), `failure_details.code` (attempt, refund)                                                 | Airwallex error codes (section 4.1)                      |
| `latest_payment_attempt.failure_code` / PaymentAttempt `failure_code`                                         | Attempt failure class (section 4.2)                      |
| `provider_original_response_code`, `details.original_response_code`, `provider_original_response_description` | Raw issuer or payment-method provider code (section 4.3) |
| `merchant_advice_code`                                                                                        | Mastercard MAC (section 4.4)                             |
| `authentication_data.avs_result`, `authentication_data.cvc_result`                                            | AVS and CVC results (section 4.5)                        |

#### 4.1 API error `code` values (error-response-codes page, endpoint error lists, rate-limits page, login page): 31 codes

| Code                             | HTTP      | Meaning (paraphrase)                                                                          | Category                   | Retry class                     |
| -------------------------------- | --------- | --------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- |
| `3ds_not_supported`              | 400       | 3DS is required but the card does not support it                                              | authentication_failed      | customer_action_required        |
| `amount_above_limit`             | 400       | Amount is above the allowed limit                                                             | invalid_amount             | do_not_retry                    |
| `amount_below_limit`             | 400       | Amount is below the allowed limit                                                             | invalid_amount             | do_not_retry                    |
| `authentication_declined`        | 400       | The shopper failed authentication (3DS)                                                       | authentication_failed      | customer_action_required        |
| `card_brand_not_supported`       | 400       | The card brand is not supported (test page: not configured on the account)                    | payment_method_unavailable | customer_action_required        |
| `configuration_error`            | 400       | Request conflicts with the merchant's configuration; contact support                          | configuration              | manual_review                   |
| `currency_not_supported`         | 400       | Currency not supported                                                                        | configuration              | do_not_retry                    |
| `duplicate_request`              | 400       | The `request_id` was used before                                                              | duplicate_request          | do_not_retry                    |
| `frequency_above_limit`          | 400       | Frequency limit reached for this resource and operation                                       | rate_limiting              | retry_conditionally             |
| `invalid_status_for_operation`   | 400       | The resource's current status does not allow this operation                                   | invalid_request            | do_not_retry                    |
| `issuer_declined`                | 400       | The card issuer declined; read the original response code (section 4.3) for the real reason   | card_declined              | customer_action_required        |
| `issuer_unavailable`             | 400       | Card issuer temporarily unavailable; try later                                                | provider_unavailable       | retry_conditionally             |
| `no_3ds_liability_shift`         | 400       | Declined because liability shift could not be obtained (network outage or issuer unavailable) | authentication_failed      | retry_conditionally             |
| `operation_not_supported`        | 400       | The operation is not supported                                                                | invalid_request            | do_not_retry                    |
| `payment_method_not_allowed`     | 400       | Payment method not enabled for the account                                                    | configuration              | do_not_retry                    |
| `provider_declined`              | 400       | The payment method provider declined; read the original response code                         | card_declined              | customer_action_required        |
| `provider_unavailable`           | 400       | Payment provider temporarily unavailable; try later                                           | provider_unavailable       | retry_conditionally             |
| `quote_expired`                  | 400       | The FX quote expired; create a new quote and retry                                            | invalid_request            | safe_to_retry_technical_request |
| `rejected_by_routing_rules`      | 400       | Rejected by the merchant's routing rules; contact support                                     | configuration              | manual_review                   |
| `resource_already_exists`        | 400       | A resource with this ID already exists                                                        | duplicate_request          | do_not_retry                    |
| `resource_not_found`             | 400 / 404 | The referenced resource ID does not exist (listed under both 400 and 404)                     | invalid_request            | do_not_retry                    |
| `risk_declined`                  | 400       | Blocked by Airwallex risk controls                                                            | fraud_or_risk              | do_not_retry                    |
| `suspended_from_online_payments` | 400       | The account is suspended from online payments; contact support                                | configuration              | manual_review                   |
| `validation_error`               | 400       | Request failed validation; `source` names the parameter                                       | invalid_request            | do_not_retry                    |
| `unauthorized`                   | 401       | Access denied (token missing or invalid)                                                      | configuration              | do_not_retry                    |
| `not_found`                      | 404       | Endpoint does not exist                                                                       | configuration              | do_not_retry                    |
| `internal_error`                 | 500       | Internal Airwallex error; try again later                                                     | provider_unavailable       | retry_conditionally             |
| `operation_above_limit`          | 400       | Listed only in the confirm and confirm_continue error lists; meaning **NOT DOCUMENTED**       | unknown                    | unknown                         |
| `too_many_requests`              | 429       | Rate or concurrency limit exceeded; Airwallex advises exponential back-off with jitter        | rate_limiting              | safe_to_retry_technical_request |
| `credentials_invalid`            | 401       | Login with invalid API credentials (authentication endpoint)                                  | configuration              | do_not_retry                    |
| `credentials_expired`            | 401       | Login with expired API credentials (authentication endpoint)                                  | configuration              | do_not_retry                    |

Endpoint lists (API reference): confirm can return `validation_error`, `duplicate_request`, `suspended_from_online_payments`, `frequency_above_limit`, `operation_above_limit`, `invalid_status_for_operation`, `provider_unavailable`, `configuration_error`, `authentication_declined`, `risk_declined`, `resource_already_exists`, `provider_declined`, `quote_expired`, `payment_method_not_allowed`, `card_brand_not_supported`, `issuer_declined`, `no_3ds_liability_shift`, `3ds_not_supported`, `rejected_by_routing_rules`. Capture: `validation_error`, `duplicate_request`, `suspended_from_online_payments`, `frequency_above_limit`, `amount_above_limit`, `invalid_status_for_operation`. Cancel: `validation_error`, `duplicate_request`, `invalid_status_for_operation`, `provider_unavailable`, `provider_declined`, `issuer_declined`. Create refund: `validation_error`, `duplicate_request`, `invalid_status_for_operation`, `amount_above_limit`, `operation_not_supported`, `resource_not_found`. Create intent: `validation_error`, `duplicate_request`, `suspended_from_online_payments`, `currency_not_supported`, `resource_not_found`, plus the confirm list when `payment_method` is sent.

Retry notes: `internal_error`, `provider_unavailable` and `issuer_unavailable` leave the outcome uncertain; resend with the **same** `request_id` (Airwallex returns the original response if the first call succeeded) or retrieve the intent first. The Node.js SDK retries only `ServerError`, `TimeoutError` and `NetworkError`. `issuer_declined` and `provider_declined` should be refined by the original response code in section 4.3.

Test page variant: the suggested-messages table on D/payments/test-and-go-live/test-card-numbers spells `authentication_decline` (no final `d`); the 3DS scenario table on the same page shows `authentication_declined`. Treat the short form as an alias.

#### 4.2 PaymentAttempt `failure_code` (Retrieve PaymentIntent and PaymentAttempt schemas): 6 values

Only the values are listed; there are no per-value descriptions. Meanings below are the value names restated.

| Value                   | Meaning (from the name)                 | Category              | Retry class                              |
| ----------------------- | --------------------------------------- | --------------------- | ---------------------------------------- |
| `authentication_failed` | Authentication (for example 3DS) failed | authentication_failed | customer_action_required                 |
| `authorization_failed`  | Authorization was declined              | card_declined         | customer_action_required (refine by 4.3) |
| `capture_failed`        | Capture failed                          | unknown               | manual_review                            |
| `provider_unavailable`  | Provider unavailable                    | provider_unavailable  | retry_conditionally                      |
| `system_unavailable`    | Airwallex system unavailable            | provider_unavailable  | retry_conditionally                      |
| `fraud_rejected`        | Rejected by fraud screening             | fraud_or_risk         | do_not_retry                             |

#### 4.3 Issuer response codes (`provider_original_response_code`; issuer-response-codes page): 176 rows, 162 distinct code strings

Airwallex's note: some codes are vague and issuers do not always disclose the real reason; often only the cardholder can learn it from the issuer. **The meaning depends on the card brand.** Fourteen code strings appear more than once with different meanings (`34`, `46`, `65`, `6P`, `82`, `91` within the two-character family; `100`, `109`, `110`, `111`, `115`, `119`, `122`, `200` between Amex and Discover/Diners). Read the brand from `details.card_brand` (error body), `payment_method.card.brand` (attempt) or the dispute `card_brand`.

Brand abbreviations: V = Visa, MC = Mastercard, UP = UnionPay, CB = Cartes Bancaires.

##### 4.3.1 Two-character codes (Visa, Mastercard, UnionPay, Cartes Bancaires): 82 rows

| Code | Brands        | Meaning (paraphrase)                                                                         | Category                   | Retry class              |
| ---- | ------------- | -------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `00` | all brands    | Approved                                                                                     | n/a (success)              | n/a                      |
| `01` | V, MC, UP     | Declined; shopper should contact the issuer                                                  | card_declined              | customer_action_required |
| `02` | CB            | Refer to card issuer                                                                         | card_declined              | customer_action_required |
| `03` | V, MC, UP, CB | Invalid merchant (issuer decline)                                                            | card_declined              | customer_action_required |
| `04` | V, MC, UP, CB | Pick up card: possible counterfeit or stolen card, mostly card-present                       | fraud_or_risk              | do_not_retry             |
| `05` | V, MC, UP, CB | Do not honor, generic decline                                                                | card_declined              | customer_action_required |
| `06` | V, MC, UP     | Error at the issuer                                                                          | card_declined              | customer_action_required |
| `07` | V, CB         | Pick up card, special condition: suspected counterfeit or stolen                             | fraud_or_risk              | do_not_retry             |
| `08` | CB            | Approved with cardholder identification (card-present)                                       | n/a (approval)             | n/a                      |
| `10` | V, MC, UP, CB | Partial approval; Airwallex does not support it, so the transaction was cancelled            | unknown                    | manual_review            |
| `11` | V, UP         | Approved (VIP); the explanation repeats the code 10 text (section 10)                        | unknown                    | manual_review            |
| `12` | V, MC, UP, CB | Invalid transaction: issuer policy does not allow this transaction type                      | card_declined              | customer_action_required |
| `13` | V, MC, UP, CB | Invalid amount or amount field format error; often debit or prepaid cards not allowed online | invalid_amount             | customer_action_required |
| `14` | V, MC, UP, CB | Invalid card number                                                                          | card_declined              | customer_action_required |
| `15` | V, MC, UP, CB | Invalid issuer: card range belongs to no issuer                                              | card_declined              | customer_action_required |
| `17` | CB            | Customer cancelled; do not retry                                                             | card_declined              | do_not_retry             |
| `19` | V, CB         | Re-enter transaction: temporary processing problem, retry recommended                        | provider_unavailable       | retry_conditionally      |
| `20` | CB            | Invalid response from the issuer                                                             | provider_unavailable       | retry_conditionally      |
| `21` | UP            | No action taken: card not activated or dormant                                               | card_declined              | customer_action_required |
| `22` | UP            | Operation error; transaction type may be disallowed                                          | card_declined              | customer_action_required |
| `30` | MC, UP, CB    | Format error; check for invalid characters                                                   | invalid_request            | customer_action_required |
| `31` | CB            | Bank not supported by switch                                                                 | payment_method_unavailable | customer_action_required |
| `33` | CB            | Expired card                                                                                 | card_declined              | customer_action_required |
| `34` | UP            | Fraudulent card                                                                              | fraud_or_risk              | do_not_retry             |
| `34` | CB            | Suspected fraud                                                                              | fraud_or_risk              | do_not_retry             |
| `38` | CB            | Allowed PIN tries exceeded                                                                   | authentication_failed      | customer_action_required |
| `40` | UP            | Transaction type not supported by the issuer                                                 | card_declined              | customer_action_required |
| `41` | V, MC, UP, CB | Lost card                                                                                    | fraud_or_risk              | do_not_retry             |
| `43` | V, MC, UP, CB | Stolen card                                                                                  | fraud_or_risk              | do_not_retry             |
| `46` | V, MC         | Closed account; do not retry the same card number                                            | card_declined              | do_not_retry             |
| `46` | CB            | Business-specific decline without detail                                                     | card_declined              | customer_action_required |
| `51` | V, MC, UP, CB | Insufficient funds or over credit limit                                                      | insufficient_funds         | customer_action_required |
| `52` | V             | No checking account linked to the card                                                       | card_declined              | customer_action_required |
| `53` | V             | No savings account linked to the card                                                        | card_declined              | customer_action_required |
| `54` | V, MC, UP, CB | Expired card                                                                                 | card_declined              | customer_action_required |
| `55` | V, MC, UP, CB | Invalid PIN                                                                                  | authentication_failed      | customer_action_required |
| `56` | CB            | No card record                                                                               | card_declined              | customer_action_required |
| `57` | V, MC, UP, CB | Transaction not permitted to issuer or cardholder (for example prepaid wallet top-up)        | card_declined              | customer_action_required |
| `58` | MC, CB        | Transaction not permitted to acquirer or terminal (for example international use blocked)    | card_declined              | customer_action_required |
| `59` | V, UP, CB     | Suspected fraud                                                                              | fraud_or_risk              | do_not_retry             |
| `60` | CB            | Card acceptor should contact the acquirer; contact Airwallex                                 | configuration              | manual_review            |
| `61` | V, MC, UP, CB | Exceeds withdrawal amount limit                                                              | card_declined              | customer_action_required |
| `62` | V, MC, UP, CB | Restricted card (issuer risk policy or delinquency)                                          | card_declined              | customer_action_required |
| `63` | V, MC, CB     | Security violation                                                                           | fraud_or_risk              | customer_action_required |
| `64` | V, UP         | AML requirement failure or original amount mismatch                                          | fraud_or_risk              | manual_review            |
| `65` | V             | Exceeds withdrawal count (usage frequency) limit                                             | card_declined              | customer_action_required |
| `65` | MC            | Soft decline: issuer requests additional authentication                                      | authentication_required    | customer_action_required |
| `68` | CB            | Issuer response arrived too late; retry                                                      | network_or_timeout         | retry_conditionally      |
| `6P` | V             | Customer ID verification failed (Visa Direct); not related to CVV                            | authentication_failed      | customer_action_required |
| `6P` | CB            | Verification data failed                                                                     | authentication_failed      | customer_action_required |
| `70` | MC            | Contact card issuer                                                                          | card_declined              | customer_action_required |
| `72` | MC            | Account not yet activated                                                                    | card_declined              | customer_action_required |
| `75` | CB            | Allowed PIN entries exceeded                                                                 | authentication_failed      | customer_action_required |
| `77` | CB            | Closed account; do not retry the same card number                                            | card_declined              | do_not_retry             |
| `78` | V, MC, CB     | Invalid or nonexistent account (explanation text repeats code 72)                            | card_declined              | customer_action_required |
| `79` | MC            | Lifecycle decline (invalid card data); read the MAC                                          | card_declined              | customer_action_required |
| `80` | V             | Credit issuer unavailable                                                                    | provider_unavailable       | retry_conditionally      |
| `82` | MC            | Policy decline; read the MAC                                                                 | card_declined              | customer_action_required |
| `82` | V, CB         | Negative CAM, dCVV, iCVV, CVV or CAVV result, or offline PIN interrupted                     | authentication_failed      | customer_action_required |
| `83` | MC            | Fraud or security decline; read the MAC                                                      | fraud_or_risk              | do_not_retry             |
| `85` | V, MC         | No reason to decline (approval for zero-amount or verification requests)                     | n/a (approval)             | n/a                      |
| `90` | UP            | Daily cutoff in progress; retry with the same credentials                                    | provider_unavailable       | retry_conditionally      |
| `91` | V, UP         | Issuer or authorization platform not available                                               | provider_unavailable       | retry_conditionally      |
| `91` | MC, CB        | Issuer unavailable or switch inoperative                                                     | provider_unavailable       | retry_conditionally      |
| `92` | V, MC, UP     | Cannot route; possibly a wrong or test card number                                           | card_declined              | customer_action_required |
| `93` | V, MC, CB     | Violation of law                                                                             | card_declined              | do_not_retry             |
| `94` | CB            | Duplicate transmission; do not retry the same authorization                                  | duplicate_request          | do_not_retry             |
| `96` | V, MC, UP, CB | System malfunction at the issuer                                                             | provider_unavailable       | retry_conditionally      |
| `97` | CB            | General monitoring timeout; retry                                                            | network_or_timeout         | retry_conditionally      |
| `98` | CB            | Server inaccessible                                                                          | provider_unavailable       | retry_conditionally      |
| `1A` | V             | Authentication required (soft decline; SCA in EEA/UK)                                        | authentication_required    | customer_action_required |
| `R0` | V, CB         | Stop payment order for one recurring payment                                                 | card_declined              | do_not_retry             |
| `R1` | V, CB         | Revocation of authorisation order (all recurring payments of this order)                     | card_declined              | do_not_retry             |
| `R3` | V, CB         | Revocation of all authorisation orders for the card                                          | card_declined              | do_not_retry             |
| `N7` | V             | CVV2 failure                                                                                 | card_declined              | customer_action_required |
| `5C` | V             | Transaction not supported or blocked by issuer                                               | card_declined              | customer_action_required |
| `9G` | V             | Blocked by the cardholder                                                                    | card_declined              | customer_action_required |
| `A0` | CB            | Fallback to contact chip mode (card-present)                                                 | payment_method_unavailable | customer_action_required |
| `A1` | CB            | Soft decline; retry with authentication such as 3DS                                          | authentication_required    | customer_action_required |
| `A2` | CB            | PIN requested in single-tap contactless mode (card-present)                                  | authentication_required    | customer_action_required |
| `A3` | CB            | New contactless tap with authentication required (card-present)                              | authentication_required    | customer_action_required |
| `A4` | CB            | TRA exemption misused; retry with SCA                                                        | authentication_required    | customer_action_required |

##### 4.3.2 American Express (three digits): 21 rows

| Code  | Meaning (paraphrase)                                              | Category                   | Retry class              |
| ----- | ----------------------------------------------------------------- | -------------------------- | ------------------------ |
| `000` | Approved                                                          | n/a (success)              | n/a                      |
| `100` | Deny (policy decline)                                             | card_declined              | customer_action_required |
| `109` | Invalid merchant; acquirer to check the merchant ID               | configuration              | manual_review            |
| `110` | Invalid amount                                                    | invalid_amount             | customer_action_required |
| `111` | Invalid account                                                   | card_declined              | customer_action_required |
| `115` | Requested function not supported                                  | payment_method_unavailable | customer_action_required |
| `116` | Not sufficient funds                                              | insufficient_funds         | customer_action_required |
| `119` | Cardmember not enrolled or not permitted (for example 3DS or AVS) | card_declined              | customer_action_required |
| `121` | Limit exceeded (usage frequency)                                  | card_declined              | customer_action_required |
| `122` | Invalid card security code                                        | card_declined              | customer_action_required |
| `130` | Additional customer identification required (soft decline)        | authentication_required    | customer_action_required |
| `181` | Format error                                                      | invalid_request            | customer_action_required |
| `183` | Invalid currency code                                             | configuration              | do_not_retry             |
| `187` | Deny, new card issued                                             | card_declined              | customer_action_required |
| `189` | Deny, merchant cancelled or closed                                | configuration              | manual_review            |
| `190` | National ID mismatch                                              | authentication_failed      | customer_action_required |
| `200` | Deny, pick up card (lost or stolen)                               | fraud_or_risk              | do_not_retry             |
| `909` | System malfunction (cryptographic error)                          | provider_unavailable       | customer_action_required |
| `912` | Issuer not available                                              | provider_unavailable       | retry_conditionally      |
| `977` | Invalid payment plan (recurring frequency or amount)              | invalid_request            | do_not_retry             |
| `978` | Invalid payment times (recurring frequency or amount)             | invalid_request            | do_not_retry             |

##### 4.3.3 JCB (dotted nine-digit codes): 40 rows

| Code          | Meaning (paraphrase)                                                       | Category                   | Retry class              |
| ------------- | -------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `000.000.000` | Succeeded                                                                  | n/a (success)              | n/a                      |
| `800.100.100` | Declined, reason unknown                                                   | card_declined              | customer_action_required |
| `800.100.150` | Refund on a gambling transaction not allowed                               | payment_method_unavailable | do_not_retry             |
| `800.100.151` | Invalid card                                                               | card_declined              | customer_action_required |
| `800.100.152` | Declined by the authorization system                                       | card_declined              | customer_action_required |
| `800.100.153` | Invalid CVV                                                                | card_declined              | customer_action_required |
| `800.100.154` | Transaction marked invalid                                                 | card_declined              | customer_action_required |
| `800.100.155` | Amount exceeds credit                                                      | insufficient_funds         | customer_action_required |
| `800.100.156` | Format error                                                               | invalid_request            | customer_action_required |
| `800.100.157` | Wrong expiry date                                                          | card_declined              | customer_action_required |
| `800.100.158` | Suspected manipulation                                                     | fraud_or_risk              | do_not_retry             |
| `800.100.159` | Stolen card                                                                | fraud_or_risk              | do_not_retry             |
| `800.100.160` | Card blocked                                                               | card_declined              | customer_action_required |
| `800.100.161` | Too many invalid tries                                                     | card_declined              | customer_action_required |
| `800.100.162` | Limit exceeded                                                             | card_declined              | customer_action_required |
| `800.100.163` | Maximum transaction frequency exceeded                                     | card_declined              | customer_action_required |
| `800.100.164` | Merchant's processing limit exceeded                                       | configuration              | manual_review            |
| `800.100.165` | Card lost                                                                  | fraud_or_risk              | do_not_retry             |
| `800.100.168` | Restricted card                                                            | card_declined              | customer_action_required |
| `800.100.169` | Card type not processed by the authorization center                        | payment_method_unavailable | customer_action_required |
| `800.100.170` | Transaction not permitted                                                  | card_declined              | customer_action_required |
| `800.100.171` | Pick up card                                                               | fraud_or_risk              | do_not_retry             |
| `800.100.172` | Account blocked                                                            | card_declined              | customer_action_required |
| `800.100.173` | Invalid currency                                                           | configuration              | do_not_retry             |
| `800.100.174` | Insufficient funds                                                         | insufficient_funds         | customer_action_required |
| `800.100.176` | Account temporarily unavailable; try later                                 | provider_unavailable       | retry_conditionally      |
| `800.100.179` | Exceeds withdrawal count limit                                             | card_declined              | customer_action_required |
| `800.100.190` | Invalid configuration data (currency or amount limits)                     | configuration              | manual_review            |
| `800.100.192` | Invalid CVV; amount still reserved for a few business days                 | card_declined              | customer_action_required |
| `800.100.195` | Account number or ID unknown                                               | card_declined              | customer_action_required |
| `800.100.200` | Refer to payer, reason not specified                                       | card_declined              | customer_action_required |
| `800.100.201` | Account or bank details incorrect                                          | card_declined              | customer_action_required |
| `800.100.202` | Account closed                                                             | card_declined              | do_not_retry             |
| `800.100.203` | Insufficient funds                                                         | insufficient_funds         | customer_action_required |
| `800.100.204` | Mandate expired (recurring)                                                | card_declined              | customer_action_required |
| `800.100.205` | Mandate discarded (recurring)                                              | card_declined              | customer_action_required |
| `800.100.402` | Card or account holder not valid                                           | card_declined              | customer_action_required |
| `800.100.403` | Revocation of authorisation order                                          | card_declined              | do_not_retry             |
| `800.100.500` | Cardholder asked the bank to stop this recurring payment                   | card_declined              | do_not_retry             |
| `800.100.501` | Cardholder asked the bank to stop all recurring payments for this merchant | card_declined              | do_not_retry             |

##### 4.3.4 Discover and Diners Club (three digits): 33 rows

| Code  | Meaning (paraphrase)                                 | Category                   | Retry class              |
| ----- | ---------------------------------------------------- | -------------------------- | ------------------------ |
| `081` | Approved                                             | n/a (success)              | n/a                      |
| `100` | Do not honor                                         | card_declined              | customer_action_required |
| `101` | Expired card                                         | card_declined              | customer_action_required |
| `102` | Suspected fraud                                      | fraud_or_risk              | do_not_retry             |
| `103` | Customer authentication required (soft decline)      | authentication_required    | customer_action_required |
| `104` | Restricted card                                      | card_declined              | customer_action_required |
| `106` | Allowed PIN tries exceeded                           | authentication_failed      | customer_action_required |
| `109` | Invalid merchant                                     | card_declined              | customer_action_required |
| `110` | Invalid amount                                       | invalid_amount             | customer_action_required |
| `111` | Invalid card number                                  | card_declined              | customer_action_required |
| `115` | Requested function not supported                     | payment_method_unavailable | customer_action_required |
| `117` | Incorrect PIN                                        | authentication_failed      | customer_action_required |
| `118` | Cycle range suspended (invalid card data)            | card_declined              | customer_action_required |
| `119` | Not permitted to cardholder                          | card_declined              | customer_action_required |
| `120` | Not permitted to originator                          | card_declined              | customer_action_required |
| `122` | Card validity period exceeded                        | card_declined              | customer_action_required |
| `124` | Violation of law                                     | card_declined              | do_not_retry             |
| `125` | Card not effective (not yet activated)               | card_declined              | customer_action_required |
| `129` | Suspected counterfeit card                           | fraud_or_risk              | do_not_retry             |
| `163` | Security violation                                   | fraud_or_risk              | do_not_retry             |
| `182` | Decline given by issuer (generic)                    | card_declined              | customer_action_required |
| `192` | Restricted merchant                                  | card_declined              | customer_action_required |
| `197` | Card account verification failed                     | card_declined              | customer_action_required |
| `198` | TVR or CVR validation failed                         | card_declined              | customer_action_required |
| `200` | Do not honor                                         | card_declined              | customer_action_required |
| `201` | Expired card                                         | card_declined              | customer_action_required |
| `202` | Suspected fraud                                      | fraud_or_risk              | do_not_retry             |
| `204` | Restricted card                                      | card_declined              | customer_action_required |
| `206` | Allowed PIN tries exceeded                           | authentication_failed      | customer_action_required |
| `207` | Special conditions (suspected counterfeit or stolen) | fraud_or_risk              | do_not_retry             |
| `208` | Lost card                                            | fraud_or_risk              | do_not_retry             |
| `209` | Stolen card                                          | fraud_or_risk              | do_not_retry             |
| `210` | Suspected counterfeit card                           | fraud_or_risk              | do_not_retry             |

Codes for local payment methods (`provider_declined` with a provider's own `provider_original_response_code`) are **NOT DOCUMENTED** on the pages read.

The test card table confirms the field linkage: test PANs with amounts in the `8x.xx` range return issuer codes such as `59`, `07`, `05`, `14`, `51` and Amex `100` with internal error code `issuer_declined`, and test card `4646 4646 4646 4644` returns `risk_declined`.

#### 4.4 Mastercard Merchant Advice Code (`merchant_advice_code`; merchant-advice-code page): 5 values

| MAC  | Valid with issuer codes    | Meaning (paraphrase)                                                                              | Retry class                   |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- |
| `01` | 00, 05, 14, 51, 54, 79, 82 | New account information available; update before next billing                                     | customer_action_required      |
| `02` | 51, 79, 82, 83             | Cannot approve now; Airwallex suggests retrying 72 hours later                                    | retry_conditionally           |
| `03` | 05, 14, 51, 54, 79, 82, 83 | Do not try again (account closed or fraud)                                                        | do_not_retry                  |
| `04` | 39                         | POS cardholder presence indicator (SLI and cryptography data problem); resubmit with correct data | do_not_retry (fix data first) |
| `21` | 05                         | Payment cancellation: cardholder cancelled the agreement                                          | do_not_retry                  |

Other Mastercard MAC values are **NOT DOCUMENTED** on this page. The OpenAPI example uses `"merchant_advice_code": "01"`.

#### 4.5 AVS and CVC results

AVS (avs-codes page): 23 rows, 18 distinct letters. Several letters mean different things for Visa and Mastercard. The page also gives a "Web app Description" bucket: Match, Partial Match, Not Match, Unavailable or Not Applicable.

| Code | Bucket                        | Meaning (paraphrase)                                                                              |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `A`  | Partial Match                 | Address matches, ZIP does not                                                                     |
| `B`  | Unavailable or Not Applicable | Visa: street matches, postal code not verified (format)                                           |
| `C`  | Unavailable or Not Applicable | Visa: street and postal code not verified (format)                                                |
| `D`  | Match                         | Visa: street and postal code match                                                                |
| `E`  | Unavailable or Not Applicable | Error response for merchant category code                                                         |
| `F`  | Match                         | Visa: street and postal code match (UK only)                                                      |
| `G`  | Unavailable or Not Applicable | Visa: address unavailable, international, non-AVS participant                                     |
| `I`  | Unavailable or Not Applicable | Visa: address not verified (international)                                                        |
| `M`  | Match                         | Visa: street and postal code match                                                                |
| `N`  | Not Match                     | Neither address nor postal code matches                                                           |
| `P`  | Unavailable or Not Applicable | Visa: postal code matches, street not verified (format)                                           |
| `R`  | Unavailable or Not Applicable | Retry: system unable to process or timed out                                                      |
| `S`  | Unavailable or Not Applicable | AVS not supported                                                                                 |
| `U`  | Unavailable or Not Applicable | Mastercard: no data from issuer; Visa: address not verified or issuer not participating           |
| `W`  | Partial Match                 | Visa: nine-digit ZIP matches, address does not; Mastercard: postal code matches, address does not |
| `X`  | Match                         | Mastercard and Visa: address and (nine-digit) postal code match                                   |
| `Y`  | Match                         | Mastercard (US, five-digit) and Visa: address and postal code match                               |
| `Z`  | Partial Match                 | Mastercard and Visa: five-digit postal code matches, address does not                             |

CVC2/CVV2 (cvc2cvv2-codes page): 7 rows, 6 values. `M` match; `N` no match; `P` not processed (issuer temporarily unavailable); `S` Visa: merchant indicates no CVV2 although it should be on the card; `U` Visa: issuer not participating or no keys, Mastercard: unverified; space: Visa, no result.

How these values appear in API fields is unclear: the API reference example has `avs_result: "pass"` and `cvc_result: "pass"`, the webhook examples have `"U"` (section 10). Treat both forms as possible; the full value set of the API fields is **NOT DOCUMENTED**. Suggested use: informational context for `card_declined` (`N7`, `82`, Amex `122`), never a category on their own.

#### 4.6 Airwallex.js error codes (browser SDK; airwallex.js error-codes page): 15 codes

Payment Elements, Hosted Payment Page and Drop-in (9):

| Code                 | Meaning (paraphrase)                                     | Category                   | Retry class              |
| -------------------- | -------------------------------------------------------- | -------------------------- | ------------------------ |
| `unauthorized`       | Authentication failed; regenerate the token              | configuration              | do_not_retry             |
| `awx_pay_error`      | Payment declined; try another account or method          | card_declined              | customer_action_required |
| `custom_code`        | Bank account balance too low (message shows the balance) | insufficient_funds         | customer_action_required |
| `resource_not_found` | PaymentIntent or Customer not found                      | invalid_request            | do_not_retry             |
| `required`           | A checkout field is required                             | invalid_request            | customer_action_required |
| `invalid`            | A checkout field is invalid                              | invalid_request            | customer_action_required |
| `un_support`         | Card not supported for payment                           | payment_method_unavailable | customer_action_required |
| `expired`            | Card expiry date is in the past                          | card_declined              | customer_action_required |
| `no_payment_methods` | No payment methods available; enable them with support   | configuration              | do_not_retry             |

Common SDK errors (6), which the page says are not applicable to Payment Elements: `UNAUTHORIZED` (missing credentials or failed token exchange), `AUTH_TIMEOUT` (`authCode` older than 30 seconds), `INIT_ERROR` (missing element, environment, locale, `authCode`, `codeVerifier` or `clientId`), `CREATE_ELEMENT_ERROR` (unsupported element type), `ELEMENT_NOT_FOUND` (element not initialized), `MOUNT_ELEMENT_ERROR` (DOM container not found). All are configuration / do_not_retry. Payout, onboarding and compliance element codes on the same page are out of scope.

#### 4.7 Dispute enumerations (Retrieve a Payment Dispute)

Not error codes, but needed for dispute decoding:

- `reason.type` (17): `CREDIT_NOT_PROCESSED`, `FRAUDULENT`, `DUPLICATE_CHARGE`, `PRODUCT_NOT_RECEIVED`, `PRODUCT_UNACCEPTABLE`, `UNRECOGNIZED_CHARGE`, `CANCELLED_PRODUCT`, `MISREPRESENTATION`, `COUNTERFEIT_PRODUCT`, `PROCESSING_ERRORS`, `AUTHORIZATION`, `NOT_RECOGNIZED`, `BANK_REJECTION`, `FUND_REVERSAL`, `CONSUMER_DISPUTE`, `POINT_OF_INTERACTION_ERROR`, `UNKNOWN`. `reason.original_code` holds the scheme reason code (examples `4837`, `10.4`).
- `accept_details[].reason` (10): `AGREEMENT_REACHED_WITH_CUSTOMER`, `CUSTOMER_RELATIONSHIP_MAINTENANCE`, `LOW_VALUE_TRANSACTION`, `VALID_CUSTOMER_DISPUTE`, `NO_ACTION_TAKEN_BY_MERCHANT`, `RDR_AUTO_ACCEPTED`, `COLLABORATION_ACCEPTED_MANUAL`, `COLLABORATION_AUTO_ACCEPTED`, `COLLABORATION_AUTO_ACCEPTED_BY_EXPIRY`, `OTHERS`.
- `challenge_details[].reason` (8): `CUSTOMER_WITHDRAWN`, `CUSTOMER_REFUNDED`, `PRODUCT_RECEIVED`, `PURCHASE_HISTORY`, `NOT_ENTITLED`, `SEPARATE_PRODUCT`, `AUTHENTIC_PRODUCT`, `OTHER_REASONS`.

Suggested category for any dispute: not a payment error; report it as a dispute timeline event. `FRAUDULENT` and `UNRECOGNIZED_CHARGE` can be flagged as fraud_or_risk context.

#### 4.8 Payout codes (separate product)

Transfer API error `code` (transfer-error-codes page, "400 errors"): 34 codes. Suggested defaults: limit and amount codes invalid_amount / do_not_retry; unsupported or invalid configuration codes configuration / do_not_retry; `service_unavailable` provider_unavailable / retry_conditionally.

| Code                                                 | Meaning (paraphrase)                                                     | Category             | Retry class                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------- |
| `validation_failed`                                  | Schema validation failed; see `details.errors[]`                         | invalid_request      | do_not_retry                    |
| `amount_beneficiary_receives_above_cumulative_limit` | Amount after beneficiary fees is above the cumulative limit              | invalid_amount       | do_not_retry                    |
| `amount_above_transfer_method_limit`                 | Above the maximum for the transfer method                                | invalid_amount       | do_not_retry                    |
| `amount_beneficiary_receives_below_limit`            | Amount after beneficiary fees is below the minimum                       | invalid_amount       | do_not_retry                    |
| `amount_below_transfer_method_limit`                 | Below the minimum for the transfer method                                | invalid_amount       | do_not_retry                    |
| `balance_insufficient`                               | Wallet balance too low to fund the transfer                              | insufficient_funds   | customer_action_required        |
| `beneficiary_type_unsupported`                       | Transfers to this beneficiary account are not supported                  | configuration        | do_not_retry                    |
| `currency_pair_invalid`                              | Currency pair not supported                                              | invalid_request      | do_not_retry                    |
| `declaration_required`                               | Mainland China local transfer needs a declaration                        | invalid_request      | customer_action_required        |
| `fee_unknown`                                        | Fee configuration problem; contact the account manager                   | configuration        | manual_review                   |
| `open_position_limit_exceeded`                       | Exceeds the remaining open position limit (post-fund model)              | invalid_amount       | do_not_retry                    |
| `order_amount_insufficient`                          | China local transfer orders do not cover the amount                      | invalid_request      | customer_action_required        |
| `order_info_unsupported`                             | `order_info` is no longer supported                                      | invalid_request      | do_not_retry                    |
| `order_reconciliation_failed`                        | China local transfer orders not yet settled; retry later                 | invalid_request      | retry_conditionally             |
| `payer_unsupported`                                  | Payer specification not supported                                        | invalid_request      | do_not_retry                    |
| `transfer_currency_unsupported`                      | Transfer currency not supported                                          | configuration        | do_not_retry                    |
| `transfer_date_invalid`                              | `transfer_date` invalid                                                  | invalid_request      | do_not_retry                    |
| `transfer_amount_above_account_limit`                | Transfer amount above account maximum                                    | invalid_amount       | do_not_retry                    |
| `transfer_amount_below_account_limit`                | Transfer amount below account minimum                                    | invalid_amount       | do_not_retry                    |
| `transfer_method_unsupported`                        | Transfer method not supported                                            | configuration        | do_not_retry                    |
| `quote_expired`                                      | FX quote expired                                                         | invalid_request      | safe_to_retry_technical_request |
| `quote_id_invalid`                                   | FX quote ID invalid                                                      | invalid_request      | do_not_retry                    |
| `quote_id_required`                                  | A quote is required for this conversion                                  | invalid_request      | do_not_retry                    |
| `duplicate_request_id`                               | `request_id` already used for a created transfer (`details.id` holds it) | duplicate_request    | do_not_retry                    |
| `request_id_duplicate`                               | Legacy name of `duplicate_request_id`                                    | duplicate_request    | do_not_retry                    |
| `service_unavailable`                                | Service unavailable; try later                                           | provider_unavailable | retry_conditionally             |
| `source_amount_above_account_limit`                  | Source amount above account maximum                                      | invalid_amount       | do_not_retry                    |
| `source_amount_below_account_limit`                  | Source amount below account minimum                                      | invalid_amount       | do_not_retry                    |
| `source_currency_unsupported`                        | Source currency not supported                                            | configuration        | do_not_retry                    |
| `workflow_invalid`                                   | Active approval workflow is invalid                                      | configuration        | manual_review                   |
| `transfer_not_found`                                 | Transfer ID not found                                                    | invalid_request      | do_not_retry                    |
| `confirm_funding_unsupported`                        | Account is not in manual-funding mode                                    | configuration        | do_not_retry                    |
| `funding_already_confirmed`                          | Funding already confirmed                                                | duplicate_request    | do_not_retry                    |
| `update_unsupported`                                 | Transfer cannot be cancelled in its current status                       | invalid_request      | do_not_retry                    |

Transfer field-validation codes (`details.errors[].code`, three-digit strings): 103 codes, grouped here rather than paraphrased one by one. All are invalid_request / do_not_retry (fix the field) except `050` (unexpected error) and `084` (IBAN validation unavailable), which are provider_unavailable / retry_conditionally.

| Range / codes                                                                 | Group (paraphrase)                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `001`-`017`                                                                   | Mandatory field, allowed characters (alphanumeric, Chinese, numeric), whitespace, emoji, enumerated or invalid values |
| `018`-`023`                                                                   | Length limits (`params.length_min` / `length_max`), metadata limits                                                   |
| `024`-`027`                                                                   | Field not applicable to SWIFT, date and date-time format, date in the past                                            |
| `028`-`030`                                                                   | PO box address, email, postcode                                                                                       |
| `031`-`036`                                                                   | Account currency mismatch, SWIFT/BIC country or validity, both amounts given, bank code, IBAN country                 |
| `037`-`038`                                                                   | Transfer amount above or below limits                                                                                 |
| `039`-`049`                                                                   | Beneficiary bank details, transfer method, paper checks, decimals, payer and beneficiary IDs, payer age               |
| `050`                                                                         | Unexpected error                                                                                                      |
| `051`-`059`, `060`-`072`, `073`-`079`, `093`, `095`-`097`, `098`, `103`-`104` | Transfer-method rules: Australia BPAY, Brazil LOCAL, China LOCAL, Paraguay LOCAL, Canada INTERAC, Airwallex Pay       |
| `080`-`081`                                                                   | FX forward not supported for same-name or own-account transfers                                                       |
| `082`, `085`-`088`                                                            | Branch code, account number, embedded bank or branch code, transit number                                             |
| `083`, `084`, `089`                                                           | IBAN invalid for country, IBAN validation unavailable, IBAN bank not supported                                        |
| `090`-`092`, `099`-`102`                                                      | Spaces only, missing IBAN or local details, phone number format, value out of range, invalid proxy ID                 |

Transfer failure codes (`failure.code` on a FAILED transfer; failure-reasons page): 29 codes. Failed transfers are cancelled automatically within seconds.

| Code(s)                            | Meaning (paraphrase)                                                                                               | Category                                           | Retry class              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------ |
| `90101`                            | Invalid account name or number                                                                                     | invalid_request                                    | customer_action_required |
| `90201`, `90202`, `90203`, `90204` | Invalid bank or branch code, SWIFT/BIC, correspondent bank, bank information                                       | invalid_request                                    | customer_action_required |
| `90301`, `90302`                   | Beneficiary name mismatch, account currency mismatch                                                               | invalid_request                                    | customer_action_required |
| `90401`, `90402`                   | Invalid beneficiary details, invalid special character                                                             | invalid_request                                    | customer_action_required |
| `90501`, `90502`                   | Channel policy, TM suspended (internal review)                                                                     | fraud_or_risk                                      | manual_review            |
| `90604`                            | Insufficient balance                                                                                               | insufficient_funds                                 | customer_action_required |
| `90701`, `90702`, `90703`          | Beneficiary account closed, inactive or dormant, restricted                                                        | card_declined (account problem; no exact category) | do_not_retry             |
| `90801`, `90802`                   | Beneficiary requested return, beneficiary bank returned                                                            | unknown                                            | manual_review            |
| `90901`-`90904`, `91201`           | China local transfer: beneficiary validation, order, account type, company registration number, processing failure | invalid_request                                    | manual_review            |
| `91001`, `91002`                   | Recall requested, client requested                                                                                 | unknown                                            | manual_review            |
| `91101`                            | Invalid payment purpose                                                                                            | invalid_request                                    | customer_action_required |
| `91401`, `91402`                   | System error, channel timeout                                                                                      | provider_unavailable                               | manual_review            |
| `99901`, `99902`                   | Unable to apply, other                                                                                             | unknown                                            | manual_review            |

Transfer funding failures use `funding.failure_details` with `code` (example `insufficient_funds`), `iso_code` (ISO 20022, example `AM04`) and `provider_failure_details` (`code` such as `R01`, `local_clearing_system` `AU_BECS` / `US_ACH` / `GB_BACS` / `EU_SEPA`, `message`). Those direct debit deposit codes are on a page that was not read: **NOT DOCUMENTED** here.

#### 4.9 Count summary

| Table                                        | Codes                                                   |
| -------------------------------------------- | ------------------------------------------------------- |
| 4.1 API error `code`                         | 31                                                      |
| 4.2 PaymentAttempt `failure_code`            | 6                                                       |
| 4.3 Issuer response codes                    | 176 rows (162 distinct strings)                         |
| 4.4 Mastercard MAC                           | 5                                                       |
| 4.5 AVS / CVC                                | 23 rows (18 letters) / 7 rows (6 values)                |
| 4.6 Airwallex.js                             | 15                                                      |
| **Payments acceptance subtotal**             | **263 rows**                                            |
| 4.8 Transfer API codes                       | 34                                                      |
| 4.8 Transfer field-validation codes          | 103                                                     |
| 4.8 Transfer failure codes                   | 29                                                      |
| **Total**                                    | **429 rows**                                            |
| 4.7 Dispute enumerations (not counted above) | 17 reason types, 10 accept reasons, 8 challenge reasons |

### 5. Lifecycle

Card and local payment methods share the PaymentIntent and PaymentAttempt objects. Disputes, refunds and payouts are separate objects and should stay separate in the adapter.

#### 5.1 PaymentIntent

A PaymentIntent "can contain multiple PaymentAttempts"; its status is "typically" linked to the latest attempt, "Note that there may be exceptions" (payment statuses page). The status list "is not exhaustive" (Retrieve schema).

| Status                     | Meaning (paraphrase)                                                     | Webhook                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `REQUIRES_PAYMENT_METHOD`  | Created, or the previous attempt failed or expired; waiting for confirm  | `payment_intent.created` + `payment_intent.requires_payment_method` on creation; only the latter when reverted after a failure |
| `REQUIRES_CUSTOMER_ACTION` | Waiting for 3DS, redirect or QR scan; see `next_action`                  | `payment_intent.requires_customer_action`                                                                                      |
| `REQUIRES_CAPTURE`         | Authorized, not captured (`auto_capture` false)                          | `payment_intent.requires_capture`                                                                                              |
| `PENDING`                  | Asynchronous processing (for example direct debits)                      | `payment_intent.pending`                                                                                                       |
| `PENDING_REVIEW`           | Authorized but under risk review; capture is not possible in this status | `payment_intent.pending_review`                                                                                                |
| `SUCCEEDED`                | Captured; funds guaranteed and will settle (for example T+2)             | `payment_intent.succeeded`                                                                                                     |
| `CANCELLED`                | Cancelled by the merchant, or the authorization expired before capture   | `payment_intent.cancelled`                                                                                                     |

Also: `payment_intent.updated` (intent updated) and `payment_intent.payment_failed` (an attempt on the intent failed). `next_action.type` is one of `render_qrcode`, `call_sdk`, `redirect`, `redirect_iframe`, `request_pin`; before API version `2022-11-11` 3DS used `redirect_form` (3DS native API page). The `client_secret` is valid for 60 minutes from creation and cannot be refreshed. PaymentIntents can be queried for 2 years.

#### 5.2 PaymentAttempt

| Status                      | Meaning (paraphrase)                                      | Webhook                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECEIVED`                  | Attempt created                                           | `payment_attempt.received`                                                                                                                                                              |
| `AUTHENTICATION_REDIRECTED` | Waiting for customer authentication (3DS, QR scan)        | `payment_attempt.authentication_redirected`                                                                                                                                             |
| `PENDING_AUTHORIZATION`     | Authorization request accepted, final result pending      | `payment_attempt.pending_authorization`                                                                                                                                                 |
| `AUTHORIZED`                | Authorized; will be auto-captured or needs manual capture | `payment_attempt.authorized`                                                                                                                                                            |
| `CAPTURE_REQUESTED`         | Capture requested; "The payment is complete"              | `payment_attempt.capture_requested`                                                                                                                                                     |
| `SETTLED`                   | Airwallex received settlement from the provider           | `payment_attempt.settled`                                                                                                                                                               |
| `PAID`                      | Funds settled to the merchant's Wallet                    | `payment_attempt.paid`                                                                                                                                                                  |
| `CANCELLED`                 | Cancelled; any authorized amount is released              | `payment_attempt.cancelled`                                                                                                                                                             |
| `EXPIRED`                   | Expired after the allowed payment time                    | `payment_attempt.expired`                                                                                                                                                               |
| `FAILED`                    | Failed; create a new attempt to retry                     | `payment_attempt.authentication_failed`, `payment_attempt.authorization_failed`, `payment_attempt.risk_declined`, `payment_attempt.failed_to_process`, `payment_attempt.capture_failed` |

The mapping of the five failure events to status `FAILED` and to the `failure_code` values (section 4.2) is inferred from their names; it is **NOT DOCUMENTED** explicitly. `acquirer_reference_number` is populated once the attempt reaches `CAPTURE_REQUESTED` or `SETTLED`.

#### 5.3 Authorization, capture and holds

- `payment_method_options.card.auto_capture` defaults to `true`. `authorization_type` is `final_auth` (default) or `pre_auth`, only for Visa and Mastercard.
- Hold windows (hold page): most schemes 7 days; Visa up to 30 days with `pre_auth` (POS limited to 5 days; 30 days only for cruise, lodging, vehicle rental); Mastercard up to 30 days; Klarna up to 28 days. The payment statuses page says "typically 5 days for cards" (section 10). UnionPay debit cards cannot be held by Hong Kong merchants.
- Partial capture is allowed; capturing more than authorized is not. An increment authorization endpoint exists (not read).

#### 5.4 Cancellation

`POST /api/v1/pa/payment_intents/{id}/cancel` cancels the full amount of an uncaptured intent, with an optional reason. Result: intent `CANCELLED` with `cancelled_at` and `cancellation_reason`, then a webhook. Only for methods that need a capture step.

#### 5.5 Refunds

| Status     | Webhook           | Meaning (paraphrase)                                                                                                         |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `RECEIVED` | `refund.received` | Created; amount valid and payment not in dispute                                                                             |
| `ACCEPTED` | `refund.accepted` | Accepted by the provider; effectively completed from Airwallex's side                                                        |
| `SETTLED`  | `refund.settled`  | Reconciled; appears in settlement reports                                                                                    |
| `FAILED`   | `refund.failed`   | Rejected: insufficient refundable funds in the settlement currency, refund time limit exceeded, dispute, or provider reasons |

A refund references `payment_intent_id` or `payment_attempt_id`. Several partial refunds are allowed up to the captured amount; the attempt tracks `refunded_amount`. A refund can stay unsettled for a while after `refund.accepted`. A card refund that is later returned through the network is credited back in a later settlement (no specific status documented).

#### 5.6 Disputes

`stage`: `RFI`, `PRE_CHARGEBACK`, `CHARGEBACK`, `PRE_ARBITRATION`, `ARBITRATION`. `status`: `REQUIRES_RESPONSE`, `CHALLENGED`, `ACCEPTED`, `REVERSED`, `WON`, `LOST`, `PENDING_CLOSURE`, `EXPIRED`, `PENDING_DECISION`. `mode` (`ALLOCATION`, `COLLABORATION`) applies from the chargeback stage. `transaction_type` is `PAYMENT` or `REFUND`. Each status has a matching `payment_dispute.*` event.

Documented rules: an RFI expires after 15 days without response; after a chargeback challenge the issuer has up to 115 days to escalate, otherwise the dispute is won; Airwallex auto-accepts pre-chargebacks below 60 USD (or equivalent) and all pre-arbitration requests, and auto-defends when a full refund already exists. These automatic actions also emit webhooks. Local payment method disputes (Klarna, PayPal and Venmo, Afterpay, Cash App Pay, Tabby) follow their own flows (not read).

#### 5.7 Authorized, captured and settled

- **Authorized**: attempt `AUTHORIZED`; intent `REQUIRES_CAPTURE` (manual capture) or `PENDING_REVIEW`.
- **Captured**: attempt `CAPTURE_REQUESTED`; intent `SUCCEEDED`; `captured_amount` on intent and attempt.
- **Settled to Airwallex**: attempt `SETTLED`. **Paid to the merchant's Wallet**: attempt `PAID`. Settlement batches run daily, by default at 23:00 in the time zone of the merchant's Airwallex entity; reserves can delay availability. `settle_via` `airwallex` means settlement into the Wallet; `paypal` or `amex` means external settlement.
- **Cancelled / expired**: attempt `CANCELLED` or `EXPIRED`; intent `CANCELLED` (manual or expired authorization).
- **Refunded / disputed**: separate Refund and PaymentDispute objects; losses and refunds become negative financial transactions in the next batch.

#### 5.8 Payouts (transfers)

Transfer `status` (API version `2025-06-30` or later): `IN_APPROVAL`, `APPROVAL_RECALLED`, `APPROVAL_REJECTED`, `APPROVAL_BLOCKED` (approval flow only), `SCHEDULED`, `OVERDUE`, `PROCESSING`, `SENT`, `PAID`, `FAILED`, `CANCELLED`, each with a `payout.transfer.<status>` event, plus `payout.transfer.cancellation_requested`. **`PAID` is not final**: a transfer can move to `FAILED` later if the clearing system or recipient bank rejects it. `FAILED` transfers are cancelled automatically. Funding `status`: `REQUIRES_FUNDING_CONFIRMATION`, `SCHEDULED`, `PROCESSING`, `FUNDED`, `FAILED`, `CANCELLED`, `REVERSED` (direct debit funding only), with `payout.transfer.funding.*` events. Older API versions use a different status model (page not read). Batch transfers have their own `payout.batch_transfers.*` statuses.

#### 5.9 Saved credentials (PaymentConsent)

Events: `payment_consent.created`, `.updated`, `.pending`, `.verified`, `.disabled`, `.paused`, `.requires_payment_method`, `.requires_customer_action`, `.verification_failed`. The consent example shows `status` `VERIFIED`, `next_triggered_by` `merchant`, `merchant_trigger_reason` `unscheduled`. The intent's `triggered_by` is `merchant` (MIT) or `customer` (CIT). The full consent status list is **NOT DOCUMENTED** here (reference page not read).

### 6. Webhooks

#### 6.1 Delivery, acknowledgement, retries and ordering

- **Transport**: HTTPS POST of a JSON body to the subscription's notification URL. Subscriptions are created in the web app with a name, URL, API version and event list; one subscription can cover several accounts.
- **Acknowledgement**: HTTP `200`. Anything else, or a timeout, is a failure; Airwallex advises answering 200 immediately.
- **Retries**: "exponential back-off over about three days until your endpoint returns 200". Delivery states in the web app: Success, Queued, Failed. Events are kept for 30 days and can be re-triggered manually within 30 days.
- **Duplicates**: expected. "that `id` is unchanged for the same event across retries". Whether a manual re-trigger keeps the same `id` is **NOT DOCUMENTED**.
- **Ordering**: "Airwallex does not guarantee that events are delivered in the order they were generated"; use the payload `created_at`.
- **Source IPs**: production 25 addresses (`35.240.218.67`, `35.185.179.53`, `34.87.64.173`, `35.220.213.251`, `34.92.128.176`, `34.91.47.254`, `34.91.75.229`, `35.230.185.215`, `34.86.42.60`, `34.177.101.131`, `34.143.140.106`, `34.158.57.211`, `34.124.183.136`, `34.126.131.52`, `34.21.185.174`, `34.142.140.136`, `35.236.197.105`, `34.11.6.7`, `34.145.133.253`, `34.182.195.122`, `35.186.175.150`, `34.85.218.163`, `136.107.34.62`, `35.186.166.138`, `34.21.104.184`); sandbox 6 (`35.240.211.132`, `35.187.239.216`, `34.87.139.23`, `136.110.35.143`, `34.142.189.194`, `35.197.128.86`).

#### 6.2 Envelope fields

| Field        | Meaning                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Event ID, stable across retries; "corresponds to Event ID in the web app"                                                         |
| `name`       | Event type, for example `payment_attempt.authorized`                                                                              |
| `account_id` | Account the event belongs to (account-level events; can be empty)                                                                 |
| `org_id`     | Organization (organization-level events; can be empty)                                                                            |
| `data`       | Business data; "The resource that triggered the event is nested under `data.object`", same schema as that resource's Retrieve API |
| `created_at` | Event creation time                                                                                                               |
| `version`    | Subscription API version; "determines the content within the `data` object"                                                       |

Fields seen only in examples: `accountId` (camelCase duplicate of `account_id`), `createdAt`, `sourceId` (an `int_` ID in the dispute example). Transfer events put the transfer directly in `data` (no `object` level) in their only example (section 10).

Example: dispute event. **Transcribed from https://www.airwallex.com/docs/payments/payment-operations/disputes/dispute-notifications.md**:

```json
{
  "id": "04e0e84622d7b3add4f712dea5abcbeb",
  "name": "payment_dispute.requires_response",
  "account_id": "acct_BGEVPKSxP9OjzQGbwxVEKA",
  "accountId": "acct_BGEVPKSxP9OjzQGbwxVEKA",
  "data": {
    "object": {
      "accept_details": [],
      "acquirer_reference_number": "24107623281055025187415",
      "amount": 10,
      "card_brand": "visa",
      "challenge_details": [],
      "created_at": "2023-10-08T06:04:00+0000",
      "currency": "AUD",
      "due_at": "2023-10-30T20:00:00+0000",
      "id": "dst_sgstmr5zzgpg1wsjcwo",
      "issuer_comment": "",
      "merchant_order_id": "e837629e-ddc5-462f-aaa1-89536a0abcf9",
      "mode": "ALLOCATION",
      "payment_attempt_id": "att_sgstpqlwlgpg1jabmrm_in2ki6",
      "payment_intent_id": "int_sgstpqlwlgpg1in2ki6",
      "payment_method_type": "VISA",
      "reason": {
        "description": "Other Fraud-Card Absent Environment",
        "original_code": "10.4",
        "type": "FRAUDULENT"
      },
      "stage": "CHARGEBACK",
      "status": "REQUIRES_RESPONSE",
      "updated_at": "2023-10-08T06:04:00+0000"
    }
  },
  "created_at": "2023-05-23T09:50:01+0000",
  "createdAt": "2023-05-23T09:50:01+0000",
  "version": "2023-10-01",
  "sourceId": "int_sgstj9lgrgl82niuabz"
}
```

The generic envelope on the listen-for-webhook-events page is `{"id": "evt_100_2019102201540902013102020043_8321220011893766", "name": "payment_attempt.authorized", "account_id": "19621303213", "data": {"object": {...}}, "created_at": "2019-10-22T01:54:09+0000", "version": "2024-02-22"}` (the `{...}` placeholder is in the original).

#### 6.3 Event names relevant to payments acceptance (payments-webhooks page; same names in the OpenAPI `webhooks` map)

- PaymentIntent (10): `payment_intent.created`, `.requires_payment_method`, `.updated`, `.requires_capture`, `.requires_customer_action`, `.pending`, `.pending_review`, `.succeeded`, `.cancelled`, `.payment_failed`.
- PaymentAttempt (14): `payment_attempt.received`, `.authentication_failed`, `.authentication_redirected`, `.pending_authorization`, `.authorization_failed`, `.authorized`, `.capture_requested`, `.settled`, `.paid`, `.cancelled`, `.expired`, `.risk_declined`, `.failed_to_process`, `.capture_failed`.
- Refund (4): `refund.received`, `.accepted`, `.settled`, `.failed`.
- PaymentDispute (9): `payment_dispute.requires_response`, `.challenged`, `.accepted`, `.expired`, `.pending_closure`, `.pending_decision`, `.won`, `.lost`, `.reversed`.
- PaymentConsent (9), PaymentMethod (5: `payment_method.created`, `.updated`, `.attached`, `.detached`, `.disabled`), Customer (2: `customer.created`, `.updated`), PaymentLink (2: `payment_link.created`, `.paid`), Fraud (1: `fraud.merchant_notified`, "payment has been identified as fraudulent. Initiate a refund and hold delivery"), Funds split (4: `funds_split.created`, `.failed`, `.released`, `.settled`), POS terminal (11, out of scope).
- Payouts: 19 `payout.transfer.*` and 19 `payout.batch_transfers.*` events.

#### 6.4 Signature (sensitive; PandaPayLens does not verify it)

- Headers: `x-timestamp` (Unix time in **milliseconds**, example `1357872222592`) and `x-signature` (lowercase hex HMAC-SHA256). The signature is sent "if the webhook is configured with a secret".
- Recipe: HMAC-SHA256 with the subscription's secret as key over `x-timestamp` (as received) followed directly by the raw request body. Each notification URL has its own secret.
- Test events: "Webhook signatures for test events are generated using the secret key provided in the `client-secret-key` header of the test event payload". A pasted test delivery can therefore contain a secret in a header and must be redacted.
- PandaPayLens should redact `x-signature`, `client-secret-key` and any `Authorization` header, may report "signature present (64 hex)", and must never ask for the webhook secret.

#### 6.5 Duplicate identification

Use the envelope `id` as the dedupe key (documented as stable across retries). Inside one ID, keep the latest `data.object.updated_at`. Because ordering is not guaranteed, timeline steps should be sorted by `created_at` (event) and `updated_at` (object), not by arrival order. `request_id` on objects is "specified by the merchant in the last operation", so it changes between operations and is not a dedupe key for events.

### 7. Identifiers

| Field                                                                                                     | Scope                                          | Notes                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` on PaymentIntent (`int_...`)                                                                         | Order-level payment                            | Two shapes in examples: lowercase alphanumeric (`int_hkpdskz7vg1xc7uscdj`) and older mixed case (`int_tWFe5PBQz9msmRCegzuZoUJcE49`). The intent is the "single record of truth" that refunds and disputes point back to                                                             |
| `id` on PaymentAttempt (`att_...`), `payment_intent_id`                                                   | One try to pay                                 | The attempt carries its parent `payment_intent_id`. In several examples the attempt ID ends with `_` plus the last six characters of its intent ID (`att_sgstpqlwlgpg1jabmrm_in2ki6` under `int_sgstpqlwlgpg1in2ki6`); this pattern is **NOT DOCUMENTED** and must not be relied on |
| `latest_payment_attempt`                                                                                  | Intent to latest attempt                       | Embedded object, not a reference. Earlier attempts are only reachable through List Payment Attempts                                                                                                                                                                                 |
| Refund `id` (`rfd_...`), `payment_intent_id`, `payment_attempt_id`                                        | Refund to payment                              | Explicit parent links on every refund                                                                                                                                                                                                                                               |
| Dispute `id` (`dst_...`), `payment_intent_id`, `payment_attempt_id`                                       | Dispute to payment                             | The handle-disputes guide calls it `dispute_id`; the legacy dispute webhook example uses `dispute_id`                                                                                                                                                                               |
| `merchant_order_id`                                                                                       | Merchant order reference                       | On intent, attempt and dispute; "Your unique internal reference ID"                                                                                                                                                                                                                 |
| `request_id`                                                                                              | Merchant idempotency key of the last operation | UUID in examples; changes per operation                                                                                                                                                                                                                                             |
| `trace_id`, `failure_details.trace_id`                                                                    | One API request or failure                     | For Airwallex support                                                                                                                                                                                                                                                               |
| `payment_method_transaction_id` (`provider_transaction_id` deprecated)                                    | Provider or issuer transaction ID              |                                                                                                                                                                                                                                                                                     |
| `authorization_code`                                                                                      | Issuer approval code                           |                                                                                                                                                                                                                                                                                     |
| `acquirer_reference_number`                                                                               | Card network ARN                               | On attempts (after capture), refunds and disputes; links a refund or dispute to the card network record                                                                                                                                                                             |
| `customer_id` (`cus_...`), `payment_consent_id` (`cst_...`), payment method `id` (`mtd_...`)              | Shopper and saved credentials                  | Link recurring and saved-card payments                                                                                                                                                                                                                                              |
| `connected_account_id` (`acct_...`), event `account_id`, `org_id`                                         | Merchant account and platform                  | Mask in output                                                                                                                                                                                                                                                                      |
| `conversion_quote_id` (`cvq_...`), `invoice_id`, `payment_link_id`, `terminal_id`                         | Related products                               |                                                                                                                                                                                                                                                                                     |
| Event `id`                                                                                                | Webhook event                                  | `evt_` followed by digits and underscores, or 32 lowercase hex, in examples                                                                                                                                                                                                         |
| Transfer `id` (UUID), `short_reference_id` (example `P250709-K61UKW4`), `request_id`, `batch_transfer_id` | Payout                                         | No prefix on transfer IDs                                                                                                                                                                                                                                                           |

### 8. Sensitive fields

Redact or mask by default. Request fields are included because request and response pairs get pasted.

- **Secrets and credentials**: `client_secret` (a JWT starting `eyJ`; its payload includes account, intent and customer IDs; docs: "Never log the `client_secret` in plain text"), `Authorization: Bearer` tokens and the login `token`, `x-api-key`, `x-client-id`, `x-login-as`, webhook `x-signature`, the `client-secret-key` header of test events, webhook secrets, `next_action.url` (carries a `key=` parameter), `next_action.data`, `next_action.qrcode`.
- **Card data**: `payment_method.card.number` and `cvc` (requests), `expiry_month`, `expiry_year`, `name`, `bin` (6 or 8 digits) with `last4`, `fingerprint`, `card.billing.*`, `authentication_data.ds_data.cavv`, `ds_data.xid`, network token data, `authorization_code`.
- **Bank and APM data**: `ach_direct_debit.account_number`, `aba_routing_number`, `owner_name`, `owner_email`; account data in `sepa_direct_debit`, `bacs_direct_debit`, `becs_direct_debit`, `eft_direct_debit`; `shopper_email`, `shopper_name`, `payer_name` in APM objects.
- **Personal data**: `customer.{first_name, last_name, email, phone_number, address, business_name, merchant_customer_id}`, `billing.*`, `order.shipping`, `device_data` (includes IP and device details), dispute `customer_name`, `challenge_details[].customer_info` (`email`, `ip`, `device_id`, `phone_number`, `billing_address`, `name`), `delivery_info`, `metadata` (merchant-defined, may contain PII).
- **Dispute and network references**: `acquirer_reference_number`, `issuer_documents`, evidence file IDs.
- **Merchant identifiers**: `account_id` / `accountId`, `org_id`, `connected_account_id`, legacy `merchant_account`, `descriptor`, `return_url`, `merchant_website_url`.
- **Payout data**: beneficiary and payer `bank_details` (`account_number`, `iban`, `swift_code`, `account_routing_value1/2`), names, `date_of_birth`, `personal_id_number`, `legal_rep_*`, `security_question_answer`, `personal_email`, mobile numbers, beneficiary card `number` (masked in examples) and `token`, `digital_wallet.id_value`, `dispatch_info.external_reference`.

### 9. Structural detection hints

Strong Airwallex signals (combine several; none of the shared words below is enough alone):

1. **PaymentIntent JSON**: `id` matching `^int_[A-Za-z0-9]+$`, upper-case `status` from {`REQUIRES_PAYMENT_METHOD`, `REQUIRES_CUSTOMER_ACTION`, `REQUIRES_CAPTURE`, `PENDING`, `PENDING_REVIEW`, `SUCCEEDED`, `CANCELLED`}, `merchant_order_id`, `request_id`, decimal `amount` with `captured_amount`, often `latest_payment_attempt` and `descriptor`. **No `object` key.**
2. **PaymentAttempt JSON** (top level or as `latest_payment_attempt`): `id` `^att_`, `payment_intent_id` `^int_`, upper-case `status` from the 10-value set in section 5.2, `settle_via` in {`airwallex`, `paypal`, `amex`}, `provider_original_response_code`, `authentication_data.{ds_data, fraud_data, avs_result, cvc_result}`, `payment_method.card.number_type` (`PAN`).
3. **Error body**: top-level `code` (lowercase snake case from section 4.1) + `message` + `trace_id` (32 hex) + `details` (object), optional `source`, optional `provider_original_response_code`. There is no wrapping `error` object and no `status` key.
4. **Webhook envelope**: `name` (lowercase dotted, prefixes `payment_intent.`, `payment_attempt.`, `refund.`, `payment_dispute.`, `payment_consent.`, `payout.transfer.`), `data.object` (or `data` for transfers), `created_at` as an ISO string, `version` as `YYYY-MM-DD`, `account_id` / `accountId` / `org_id`. Headers `x-timestamp` (13 digits) and `x-signature` (64 hex).
5. **Refund**: `id` `^rfd_`, `payment_intent_id` + `payment_attempt_id`, `status` in {`RECEIVED`, `ACCEPTED`, `SETTLED`, `FAILED`}.
6. **Dispute**: `id` `^dst_`, `stage` and `status` from section 5.6, `reason.{original_code, type, description}`, `mode`, `card_brand`.
7. **Hosts and paths**: `api.airwallex.com`, `api.sandbox.airwallex.com`, `/api/v1/pa/`; `next_action.url` containing `/api/v1/pa/gateway/`.
8. **Transfer**: UUID `id`, `short_reference_id`, `transfer_method`, `source_currency` / `transfer_currency`, transfer `status` set from section 5.8, `failure.code` in the `9xxxx` range.

How this differs from Stripe (the main collision risk; Stripe facts below are as modeled by the existing Stripe adapter in `packages/adapters/stripe` and the other research files):

| Aspect          | Stripe                                                            | Airwallex                                                                                                    |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Object marker   | `object: "payment_intent"`, `object: "event"`                     | No `object` key anywhere in the documented payloads                                                          |
| Intent ID       | `pi_...`                                                          | `int_...`                                                                                                    |
| Status values   | Lower case (`succeeded`, `canceled` with one `l`)                 | Upper case (`SUCCEEDED`, `CANCELLED` with two), different set (`REQUIRES_CUSTOMER_ACTION`, `PENDING_REVIEW`) |
| Amounts         | Integer minor units                                               | Decimal major units (`16.66`)                                                                                |
| Decline detail  | `last_payment_error` with `decline_code`                          | `latest_payment_attempt` with `provider_original_response_code`, `failure_code`, `failure_details`           |
| Error envelope  | Wrapped: `{"error": {"type", "code", "decline_code", "message"}}` | Flat: `{"code", "message", "trace_id", "details"}`                                                           |
| Event envelope  | `type`, `data.object`, `object: "event"`                          | `name`, `data.object`, `version`, `account_id`; no `type`, no `object`                                       |
| `client_secret` | Built from the intent ID                                          | A JWT (`eyJ...`)                                                                                             |

Shared tokens that must not decide alone: `evt_` event ID prefix (Stripe and Checkout.com also), `cus_` customer prefix, `acct_` account prefix, `data.object` nesting, `next_action`, `client_secret`, `metadata`, the word PaymentIntent.

Other providers:

- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in Airwallex payloads.
- **payabl.**, **NMI**, **Nuvei DMNs**: URL-encoded key=value bodies (`transactionid`, `response`, `ppp_status`). Airwallex is JSON only.
- **Checkout.com**: `pay_` / `act_` IDs, Title Case payment `status`, `approved` boolean, `response_code` 5-digit; events have snake_case `type` (`payment_captured`); errors `request_id` + `error_type` + `error_codes[]`. Airwallex events use `name`, and errors use a single `code`.
- **PayPal**: `event_type` in upper-case dotted form, `resource`, errors with `name` + `debug_id`. An Airwallex attempt with `payment_method.type: "paypal"` (and `settle_via: "paypal"`) is still an Airwallex payload.
- **Braintree**: `bt_signature` / `bt_payload` form bodies, GraphQL `errors[].extensions`.
- **Mollie**: `resource` key, `tr_` IDs, amounts `{currency, value}` as strings.
- **Square**: `errors[]` with upper-case `category` + `code`, webhook `merchant_id` + `event_id` + `type`.
- **Worldpay**: `outcome`, `eventDetails`, `errorName`.
- **Cybersource**: `submitTimeUtc`, `...Information` objects, upper-case `status` and `reason` in errors.
- **Authorize.net**: `transactionResponse`, `messages.resultCode`, webhook `eventType` `net.authorize.*`.
- **Nuvei REST**: `internalRequestId`, `gwErrorCode`, `status` `SUCCESS` / `ERROR`.
- **High-risk adapters** (Ecommpay, PXP, Paymentwall, MiFinity, Trustly, eZeeWallet, Skrill, CCBill, Segpay, Verotel and others in `packages/adapters`): none uses the `int_` / `att_` / `rfd_` / `dst_` prefixes or the `trace_id` + `code` error body. Ecommpay's request error is `{status: "error", code, message}`; an Airwallex error never has `status` at top level.

Suggested rule: score `airwallex` high when (`id` `^int_` or `payment_intent_id` `^int_`) together with an upper-case status from the documented sets, or when an error body has `code` from section 4.1 plus `trace_id`, or when an event has `name` with a documented prefix plus `version` `YYYY-MM-DD`.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Issuer codes are brand-specific.** 14 code strings carry different meanings per brand family (section 4.3). Two-character codes also mean different things on other providers' pages (for example payabl.). Decoding must key on brand; without a brand, fall back to the meaning shared by most brands or to `unknown`.
2. **Copied explanations in the issuer table**: code `11` "Approved (V.I.P)" repeats the explanation of `10` (partial approval); code `78` "Invalid/nonexistent account" repeats the explanation of `72` (account not activated). Approval-type codes are spread across families (`00`, `08`, `85`, `000`, `000.000.000`, `081`).
3. **Webhook envelope examples disagree**: `account_id` (listen page) vs `accountId` (payments webhooks page) vs both plus `createdAt` and `sourceId` (dispute notification page). The payments-webhooks examples miss a comma after `name` (invalid JSON) and omit `created_at` and `version`; the PaymentLink example has no `id` or `name`.
4. **Event `id` formats**: `evt_100_...` (digits and underscores) on two pages, 32 lowercase hex on the dispute page, a UUID in the transfer example.
5. **Timestamp formats**: `+00:00` (API reference), `+0000` (guides, webhooks), `.659+0000` (legacy dispute example), `x-timestamp` in epoch milliseconds.
6. **Legacy dispute payload**: the Dispute section of the payments-webhooks page shows `dispute_id`, `card_scheme`, `dispute_reason_type`, `dispute_original_reason_code`, `accept_reason`, `status: "EVIDENCE_REQUIRED"`, `stage: "DISPUTE"`, `dispute_amount`, `dispute_currency`, `updated_by`, `merchant_account`. These names and values are not in the current Retrieve schema. Which API version produces this shape is **NOT DOCUMENTED**. A parser should accept both.
7. **Transfer events**: the transfer webhook example puts the transfer directly in `data`, while the generic page says the resource is under `data.object`.
8. **Inconsistent example state**: the Retrieve, Confirm and Capture PaymentIntent examples show intent `SUCCEEDED` with `latest_payment_attempt.status` `AUTHORIZED` and `captured_amount: 0`.
9. **Authorization window**: "typically 5 days for cards" (payment statuses page) vs "7 days" for most schemes (hold page).
10. **Error code lists**: `operation_above_limit` appears only in endpoint error lists, with no description; `too_many_requests` only on the rate-limits page; `403 Forbidden` appears in the API reference without a code; `credentials_invalid` and `credentials_expired` only on the login page. The test page spells `authentication_decline` once, and its 3DS table labels a row "authorization failed" while showing `authentication_declined`.
11. **Error schema**: the OpenAPI `Error` schema has `code`, `details`, `message`, `source` but no `trace_id`; the docs table has `trace_id`; the `issuer_declined` example adds a top-level `provider_original_response_code` that neither lists.
12. **PaymentAttempt `failure_code`** values have no descriptions, and there is no documented example of a FAILED attempt with populated `failure_details` (the OpenAPI example uses `<string>` placeholders). The link between failure events and `failure_code` is inferred.
13. **AVS and CVC field values**: `avs_result: "pass"` / `cvc_result: "pass"` in the API reference vs `"U"` in webhook examples. The value set of these fields is **NOT DOCUMENTED**.
14. **Event names in prose**: the get-started page mentions `payment_intent.failed`, which is not an event; the real name is `payment_intent.payment_failed`. The event-list page uses `payment.new` as a filter example.
15. **Card `bin`** is 6 digits in API reference examples and 8 digits in webhook examples.
16. **Example defects**: the 3DS `next_action` example has a trailing comma; the OpenAPI example has `acquirer_reference_number` as `9.328788974770498e+22` (a number rendered in exponent form).
17. **Payout failure field name**: the failure-reasons page says to read `failure_reason`; the transfer schema exposes `failure.code` / `failure.message` / `failure.details` (and a separate `funding.failure_reason`).
18. **Version dependence**: payloads depend on `x-api-version` and the webhook subscription `version`. Known differences: `redirect_form` before `2022-11-11`; transfer status model before `2025-06-30`; transfer error codes before `2024-01-31` and error structure before `2024-09-27`. A full per-version change log for payments was not found.
19. **Status lists are open**: the intent status list "is not exhaustive", and the intent status is only "typically" linked to the latest attempt.
20. **Messages are not stable**: the error table marks messages "subject to change"; decoding must use `code` and the original response code, never `message`.
21. **Not covered**: local payment method provider codes, Mastercard MAC values beyond five, direct debit deposit codes, consent statuses, batch transfer codes, connected account codes, and the pages listed under "Not read" in the Sources.
22. **Regional / product**: US-registered merchants must provide a US individual to enable card payments; Hong Kong merchants cannot hold UnionPay debit cards; Visa POS holds are limited to 5 days; Merchant of Record is a beta limited to digital products and Hosted Payment Page; pre-chargeback auto-accept below 60 USD; settlement time follows the Airwallex entity's time zone.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | A clear two-layer model: Airwallex `code` (31 values with HTTP mapping) and the raw issuer code (176 rows with explanations and next steps), plus MAC, AVS, CVC and attempt `failure_code`. Brand collisions are handled by keying on `card_brand`; local payment method provider codes and `operation_above_limit` stay `unknown`.                                                 |
| **paymentResponses** | **supported** | Every endpoint read has a field table and a JSON example; the error body is uniform across endpoints. Tests can be built from the documented examples (declines from Example A and the test-card table). Caveat: no documented FAILED-attempt example, so `failure_details` handling must be tested from the schema.                                                                |
| **webhookParsing**   | **supported** | JSON envelope with a stable event `id`, `name`, `created_at` and `version`; `data.object` reuses the Retrieve schemas; retries, duplicates and ordering are documented. The parser must tolerate `account_id` / `accountId`, three timestamp formats, `data` vs `data.object` (transfers) and the legacy dispute shape. Signature verification is out of scope.                     |
| **timeline**         | **limited**   | Statuses map cleanly to steps (attempt `RECEIVED` to `AUTHORIZED` to `CAPTURE_REQUESTED` to `SETTLED` to `PAID`; refunds; dispute stages), and events carry `created_at`. But a single snapshot only has `created_at` and `updated_at` (no per-status history), only the latest attempt is embedded, delivery order is not guaranteed, and payout `PAID` can later become `FAILED`. |
| **correlation**      | **supported** | Explicit parent links are documented on every child object: attempt `payment_intent_id`; refund and dispute `payment_intent_id` + `payment_attempt_id`; plus `merchant_order_id`, `acquirer_reference_number`, `customer_id`, `payment_consent_id`. The `att_..._xxxxxx` suffix pattern is undocumented and should not be used.                                                     |
