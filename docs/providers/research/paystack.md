# Paystack (adapter id `paystack`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Paystack's own published material as available on the verification date: the official OpenAPI repository, the official repository that holds the code snippets and response examples of the developer documentation, the official Node SDK repository, the Paystack Help Center (`support.paystack.com`) and the live API root. When a point is not documented in those sources, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified** (with a documented access limitation, see gate item 3)
- Method: the developer documentation site `https://paystack.com/docs/` answered every scripted request (and a fetch through a standard web-fetch tool) with HTTP 403 and a Cloudflare "Just a moment..." JavaScript challenge. The challenge was not bypassed and no browser automation was used. Instead, the same documentation content was read from Paystack's first-party sources that are published for reuse: `PaystackOSS/openapi` (the OpenAPI 3.0.1 specification, read as YAML and parsed mechanically), `PaystackOSS/doc-code-snippets` (whose README says it holds "Code snippets for the Paystack's Developer Documentation", including every JSON response example shown on the API reference and guide pages) and the Help Center articles, which load without a challenge. Code and status values in this file were extracted mechanically from those files and checked against them, so they are exact; meanings are paraphrased.
- Consequence: the prose of the documentation pages (for example the webhook guide, which the Help Center links as `https://paystack.com/docs/payments/webhooks/`, the API reference introduction and the transfer guides) was **not read**. Facts that would only come from that prose are marked **NOT DOCUMENTED** here, which in this file means "not documented in the sources read".

---

## Summary

| Item                          | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                       | `documentation_verified` (gate items 1-5 and 8-10 yes; item 3 yes with the access note above)                                                                                                                                                                                                                                                                                                                                                                 |
| Classification                | `card_processing`, `alternative_payment_method`; `gateway` as an inference from documented routing to downstream processors. Payouts ("Transfers") are a separate product. `acquiring`, `payment_facilitator`, `wallet`, `orchestration` and `merchant_account_intermediary` are not claimed in the sources read                                                                                                                                              |
| Countries                     | Nigeria, Ghana, South Africa and Kenya; private beta in Côte d'Ivoire and Egypt (Help Center "What is Paystack and how does it work?")                                                                                                                                                                                                                                                                                                                        |
| Documented sectors            | A long "Supported businesses" list that includes Gaming (betting, lotteries, prediction services) and Financial Services (including forex trading, cryptocurrency, lending, remittances); a separate "Ineligible businesses" list restricts several of these per country, and gambling needs prior approval                                                                                                                                                   |
| Documentation access          | Public, no login. The documentation site blocks scripted access with a Cloudflare challenge; its snippets and response examples are published in the official GitHub repositories listed below. The Dashboard needs a merchant login and was not used                                                                                                                                                                                                         |
| API family to implement first | **Transactions API** JSON responses (`/transaction/initialize`, `/transaction/verify/{reference}`, `/transaction/{id}`, `/transaction/charge_authorization`) together with the **`charge.success` webhook**, because both carry the same transaction object (`status`, `gateway_response`, `reference`, `id`, `authorization`, `log`). Then the Charge API intermediate states, then refunds and disputes, then Transfers (payouts) as a separate parser path |
| Documented code values        | 171 entries (178 distinct strings): error `type` 3, error `code` 8, API error messages 37, transaction-level `gateway_response` / `data.message` values 11, Help Center error messages 111 rows (118 strings), inbound bank transfer rejection `message_type` 1. Plus status vocabularies for transactions, charges, refunds, disputes, transfers, preauthorizations, bulk charges and webhook deliveries (section 5)                                         |
| Biggest limitations           | There is no numeric decline code: declines are free-text messages. The Help Center lists the messages merchants see, but which API field carries them (`gateway_response` or `data.message`) is not stated. Webhook payloads have no event ID and no timestamp. The retry schedule, source IPs and ordering of webhooks are NOT DOCUMENTED in the sources read. Several examples disagree with the schema on field types and HTTP status codes                |
| White-label                   | No. Paystack documents its own JSON envelope, object model, ID prefixes and webhook format. Downstream processor names appear only as values (refund `processor` `instant-transfer`, `mpgs_zen`; refund `channel` `migs`, `isw_3ds`; System errors article mentions an error from a processor that does not support USD). The sources read do not state any corporate relationship to another provider supported by PandaPayLens                              |

---

## Sources

All sources below were read on 2026-10-25.

### Official repositories (read through the GitHub API and raw file downloads)

| Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Version                                               | What it covers                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://github.com/PaystackOSS/openapi: `README.md`, `dist/paystack.yaml` (whole file parsed: paths, `components/schemas`, `components/responses`, all `enum` values); file tree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | commit `07c5abc`, 2026-06-09 (`info.version` `1.0.0`) | **OpenAPI 3.0.1 spec** "of the Paystack API". Server `https://api.paystack.co`, bearer auth, every endpoint used here, schemas `Response`, `Error`, `ErrorMeta`, `TransactionInitializeBadRequestModel`, `VerifyResponse`, request schemas, status enums for transactions, transfers, disputes, bulk charges       |
| https://github.com/PaystackOSS/doc-code-snippets: `README.md`; `dist/api/introduction/*.js` (`response-format.js`, `error-format.js`, `sample-error.js`, `meta-format.js`, `supported-currency.js`); every `dist/api/*/*/response.json` (all 2xx and error examples were parsed; the ones used are listed in the text); `src/api/webhook-events/*/index.sh`, `src/api/webhook-endpoints/*/index.sh`, `src/api/preauthorization/reserve/index.sh`, `src/api/transactions/verify/config.yml`                                                                                                                                                                                                                                                                | commit `57f7a11`, 2026-10-22                          | **Response examples of the API reference** for transactions, charges, refunds, disputes, transfers, preauthorization, Capitec Pay requery, webhook endpoint and webhook event APIs, plus the generic response, error and pagination formats                                                                        |
| Same repository, guide snippets: `dist/doc/payments/webhooks/{events,receiving-events,verifying-transaction,create-endpoint,ping-endpoint}.js`; `dist/doc/payments/refunds/{events,create-refund,retry-refund}.js`; `dist/doc/payments/payment-methods/{mobile-response-jit,mobile-response-late,mobile-event,mobile-mpesa-offline,mobile-vodafone,pwt,pwt-events,bank,bank-1,eft,capitec-pay,ussd-event}.js`; `dist/doc/payments/preauthorization/{events,reserve}.js`; `dist/doc/payments/direct-debit/{charge-authorization,charge-webhook,verify-mandate-failed}.js`; `dist/doc/transfers/single/*.js`, `dist/doc/transfers/manage/approval.js`, `dist/doc/transfers/bulk/batches.js`; event names and status values grepped across all of `dist/doc` | commit `57f7a11`, 2026-10-22                          | **Webhook event payload examples** (24 events on the webhook guide, plus events on the refunds, preauthorization, payment-method and direct-debit guides), the `x-paystack-signature` verification recipe, intermediate charge states for each payment channel, transfer OTP flow, transfer approval endpoint code |
| https://github.com/PaystackOSS/paystack-node (file tree and `package.json` only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | commit `d5f111a`, 2026-10-20                          | Official Node SDK generated from the spec; used only to confirm it is maintained. No extra error vocabulary                                                                                                                                                                                                        |
| https://github.com/PaystackOSS and https://github.com/PaystackHQ (organization repository listings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | listing on 2026-10-25                                 | Discovery of the official repositories; recent pushes (activity check)                                                                                                                                                                                                                                             |

### Paystack hosts

| URL                                                                                                                                                                                                                                                                                                                 | Result                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| https://api.paystack.co/                                                                                                                                                                                                                                                                                            | HTTP 200, JSON `{"status":true,"message":"You probably shouldn't be here, but...","data":{"service":"paystack-api","version":"1.0"}}` |
| https://status.paystack.com/                                                                                                                                                                                                                                                                                        | HTTP 200, Paystack status page (activity check only)                                                                                  |
| https://developers.paystack.co/                                                                                                                                                                                                                                                                                     | HTTP 302 to `https://paystack.com/docs`                                                                                               |
| https://paystack.com/docs/, https://paystack.com/docs/api/, https://paystack.com/docs/api/errors/, https://paystack.com/docs/payments/webhooks/, https://paystack.com/docs/changelog/, https://paystack.com/docs/llms.txt, https://paystack.com/robots.txt, https://paystack.com/sitemap.xml, https://paystack.com/ | HTTP 403 with a Cloudflare JavaScript challenge to scripted access; **not read**                                                      |

### Paystack Help Center (`https://support.paystack.com/en/...`)

Discovery: the English home page `https://support.paystack.com/en`, its 7 top-level categories and their 30 sub-categories (174 article links). The articles below were read in full; the "Edited" date is the article's own.

| Article URL                                       | Edited     | What it covers                                                                                                     |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| https://support.paystack.com/en/articles/2123650  | 2026-09-15 | **Bank errors**: 52 error messages with meaning and resolution                                                     |
| https://support.paystack.com/en/articles/2124674  | 2026-09-15 | **Customer errors**: 33 error messages                                                                             |
| https://support.paystack.com/en/articles/2125058  | 2026-09-15 | **Fraud block errors**: 6 error messages (3DS related)                                                             |
| https://support.paystack.com/en/articles/2129794  | 2026-09-15 | **System errors**: 20 error messages                                                                               |
| https://support.paystack.com/en/articles/2123330  | 2026-09-16 | Abandoned payments: what "abandoned" means                                                                         |
| https://support.paystack.com/en/articles/2130434  | 2026-09-16 | **Understanding refund statuses** and their effect on the transaction status                                       |
| https://support.paystack.com/en/articles/10609026 | 2026-09-16 | **Viewing and retrying webhooks**: delivery statuses, duplicates, retries, event list by category                  |
| https://support.paystack.com/en/articles/2123458  | 2026-09-15 | API keys and webhooks (test and live keys, callback URL vs webhook URL)                                            |
| https://support.paystack.com/en/articles/2130946  | 2026-09-16 | IP whitelisting for secret-key API requests                                                                        |
| https://support.paystack.com/en/articles/2132866  | 2026-09-28 | Transfers: availability (registered businesses), pricing and limits per country                                    |
| https://support.paystack.com/en/articles/9039298  | 2026-09-16 | Transfers guide for gaming merchants: pending transfers, NIBSS downtime, retry with the same reference, session ID |
| https://support.paystack.com/en/articles/9040130  | 2026-09-16 | Disputes for gaming and entertainment merchants (outcome decided by issuers and schemes)                           |
| https://support.paystack.com/en/articles/2129730  | 2026-09-15 | **Supported businesses** (industries and categories)                                                               |
| https://support.paystack.com/en/articles/2127042  | 2026-09-15 | **Ineligible businesses**, general and per country                                                                 |
| https://support.paystack.com/en/articles/5949186  | 2026-09-15 | A simple guide for high-risk merchants (examples of high-risk sectors)                                             |
| https://support.paystack.com/en/articles/2130562  | 2026-09-15 | What is Paystack: countries served, private beta countries                                                         |
| https://support.paystack.com/en/articles/2128642  | 2026-09-16 | Pay with Transfer (Nigeria, Ghana), 30-minute account expiry, refund of late transfers                             |
| https://support.paystack.com/en/articles/2128386  | 2026-09-16 | Pay with Mobile Money (Ghana, Kenya; providers incl. Côte d'Ivoire)                                                |
| https://support.paystack.com/en/articles/10450882 | 2026-09-22 | Preauthorization (South Africa only, on request)                                                                   |
| https://support.paystack.com/en/articles/2131522  | 2026-09-16 | Paystack-Titan bank accounts for transfer payments (Nigeria)                                                       |
| https://support.paystack.com/en/articles/2124290  | 2026-09-15 | Cloudflare errors on the Paystack API                                                                              |
| https://support.paystack.com/en/articles/2127938  | 2026-09-15 | Failed payment but customer debited (bank reversal timing)                                                         |
| https://support.paystack.com/en/articles/2129922  | 2026-09-15 | Test mode and live mode                                                                                            |
| https://support.paystack.com/en/articles/2129026  | 2026-09-16 | Paystack Developer Documentation (public resource, links to `https://paystack.com/docs/`)                          |

Not read: the prose of every `paystack.com/docs` page (see Method), Help Center articles other than those listed, the official Python, PHP and Ruby SDKs, the Postman collections. Anything that would only come from those is **NOT DOCUMENTED** here.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | Help Center articles edited September 2026; `doc-code-snippets` pushed 2026-10-22 and `paystack-node` 2026-10-20; status page online; webhook-event API examples dated July and August 2026                                                                                                                                                                                                                                                                                  |
| 2   | Payment service operational      | yes    | `https://api.paystack.co/` answers with the standard envelope and `"service":"paystack-api","version":"1.0"`; Help Center describes live and test modes and current pricing (Transfers article edited 2026-09-28)                                                                                                                                                                                                                                                            |
| 3   | Docs publicly accessible         | yes    | No login is needed: Help Center article 2129026 describes the developer documentation as an online resource at `https://paystack.com/docs/`. That site returns a Cloudflare challenge to scripted clients, so its prose was not read; its code snippets and response examples are published in `PaystackOSS/doc-code-snippets`, and the API contract in `PaystackOSS/openapi`, both public. The Dashboard (webhook history, exports) needs a merchant login and was not used |
| 4   | API families/versions identified | yes    | OpenAPI `info.version` `1.0.0`, server `https://api.paystack.co`; tags Transaction, Charge, Bulk Charge, Refund, Dispute, Transfer, Transfer Recipient, Balance and others. The API root reports `"version":"1.0"`. Preauthorization, Capitec Pay requery, webhook endpoint and webhook event APIs are documented only in the snippets repository (not in the spec)                                                                                                          |
| 5   | Offline-examinable formats       | yes    | JSON response examples for every endpoint used here, JSON webhook payload examples for transactions, refunds, disputes, transfers, subscriptions, preauthorizations; schema definitions with types and enums                                                                                                                                                                                                                                                                 |
| 6   | Sectors documented               | yes    | Help Center "Supported businesses" (Gaming: "Betting", "Lotteries", "Prediction Services"; Financial Services: "Forex Trading", "Cryptocurrency", "Lending", "Remittances" and others), restricted by "Ineligible businesses" and the high-risk guide (section "Classification and documented sectors")                                                                                                                                                                      |
| 7   | Regional/regulatory limits       | yes    | Services "available only to businesses registered in Nigeria, Ghana, South Africa and Kenya" with a private beta in Côte d'Ivoire and Egypt (article 2130562); per-country ineligible categories (article 2127042); Pay with Transfer only Nigeria and Ghana (2128642); preauthorization only South Africa (10450882); Transfers only for registered businesses (2132866); `Currency` enum `GHS`, `KES`, `NGN`, `ZAR`, `USD` (OpenAPI)                                       |
| 8   | Diagnostic value                 | yes    | Explicit transaction `status` and `gateway_response`, an error envelope with `type`, `code` and `meta.nextStep`, intermediate charge states (`send_otp`, `send_pin`, `open_url`, `pay_offline`, `pending_bank_transfer` ...), 111 documented decline and error messages with Paystack's own resolution advice, refund, dispute and transfer state vocabularies, webhook events for each                                                                                      |
| 9   | Own technical formats            | yes    | Paystack-specific envelope (`status` boolean, `message`, `data`), ID prefixes (`AUTH_`, `SIG_`, `CUS_`, `TRF_`, `RCP_`, `PLN_`, `SUB_`, `INV_`, `PRQ_`), `x-paystack-signature` header. Not a resale of a gateway PandaPayLens supports                                                                                                                                                                                                                                      |
| 10  | No credentials needed to analyse | yes    | All examples and schemas are public. The webhook signature needs the merchant secret key, but PandaPayLens does not verify signatures                                                                                                                                                                                                                                                                                                                                        |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**. The unread guide prose lowers confidence for webhook delivery behavior and the meaning of some statuses; those points are marked NOT DOCUMENTED and are reflected in the proposed capability statuses.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`            | Card channel with PIN, OTP, 3DS and address verification steps (`/charge`, `/charge/submit_pin`, `/charge/submit_otp`, `/charge/submit_address`); reusable card `authorization` objects charged with `/transaction/charge_authorization`; Help Center 2129794 says cards accepted are Verve, Mastercard and Visa, plus American Express for businesses in South Africa and Nigeria            |
| `alternative_payment_method` | `TransactionInitialize.channels` enum: `apple_pay`, `bank`, `bank_transfer`, `capitec_pay`, `card`, `eft`, `mobile_money`, `payattitude`, `qr`, `ussd` (OpenAPI); mobile money (MTN, Telecel, Airtel, M-PESA), USSD, Pay with Transfer, EFT and Capitec Pay examples in the guide snippets                                                                                                    |
| `gateway` (inference)        | Paystack calls itself "a payment service provider that facilitates easy, fast and secure online and in-person payments for African businesses" (article 2130562). Routing to downstream processors is visible in refund `processor` values (`instant-transfer`, `mpgs_zen`), refund `channel` values (`migs`, `isw_3ds`) and the System errors entry about a processor that does not take USD |
| Payouts (not a class value)  | Transfers API sends money from the Paystack balance to bank accounts and mobile money; "only available to Registered businesses" (article 2132866)                                                                                                                                                                                                                                            |
| Not claimed                  | `acquiring`, `payment_facilitator`, `wallet`, `orchestration`, `merchant_account_intermediary`. Paystack-Titan is "a partnership between Paystack and Titan Trust Bank" used to issue account numbers (article 2131522); that is not a wallet or acquiring claim                                                                                                                              |

Sectors, in Paystack's own words. Each needs the merchant's own jurisdiction, licensing and Paystack's review; listing a sector here says nothing about approval.

| Sector                                        | Source and wording                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gaming (betting, lotteries, prediction)       | Article 2129730 lists the Gaming industry with categories "Betting", "Lotteries", "Prediction Services". Article 2127042 says gambling, gaming and prize activities are unsupported "unless the operator has obtained prior approval from Paystack" and operator and customers are only in jurisdictions where it is legal. Article 2130562 names "betting companies" among customers |
| Gaming restrictions by country                | Article 2127042: South Africa lists "Betting" and "Lotteries" as unsupported; Ghana lists "Skill games merchants" and skilled game wagering as not supported for card payments, and "Betting" as needing further review for card payments                                                                                                                                             |
| Financial services                            | Article 2129730 categories: "Financial Cooperatives", "Financial Technologies", "Forex Trading", "Payment Solution Service Providers", "Insurance", "Investments", "Agricultural Investments", "Lending", "Cryptocurrency", "Remittances", "Savings", "Mobile wallets"                                                                                                                |
| Cryptocurrency and forex restrictions         | Article 2127042: "Cryptocurrency trading" unsupported in Ghana, Kenya, Nigeria and South Africa; "Forex trading and currency exchange" unsupported in Ghana, Kenya and Nigeria; general list excludes "Sales of currency without BDC licence, cryptocurrency operators". This contradicts the Supported businesses list, which names Cryptocurrency and Forex Trading                 |
| South Africa financial restrictions           | Article 2127042: "Mobile wallet services", "Lending", "Remittance businesses", "Savings businesses" unsupported in South Africa                                                                                                                                                                                                                                                       |
| Digital goods, travel, hospitality and others | Article 2129730 also lists Agriculture, Automobile, Digital Goods (including "Digital Games" and "Gift Cards"), Physical Goods, Electronics, Real Estate, Digital, Legal, General and Professional Services, Education, Hospitality, Health, Sports and Recreations, Leisure and Entertainment, Logistics, Non-profits, Travel, Transport, Utilities                                  |
| Adult                                         | Not a supported category. Article 2127042 lists "Obscene material or pornography" and "Certain sexually oriented materials or services" as unsupported, and Ghana card payments exclude "Non-face-to-face adult content and services merchants". The high-risk guide (5949186) names adult content only as an example of a high-risk sector                                           |
| Subscriptions                                 | High-risk guide (5949186) names "Subscription or free-trial services" as high risk; Plans and Subscriptions APIs exist                                                                                                                                                                                                                                                                |
| Nutraceuticals, CBD                           | **NOT DOCUMENTED** in the pages read. The high-risk guide names "Online pharmacies and tobacco or e-cigarette sellers"                                                                                                                                                                                                                                                                |

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

All endpoints are on `https://api.paystack.co`, authenticated with `Authorization: Bearer <secret key>`. Requests accept `application/json` or `application/x-www-form-urlencoded` (OpenAPI request bodies); responses are `application/json`. There is no version in the path; the spec says `1.0.0` and the API root says `1.0`.

| Family                                        | Endpoints (method and path)                                                                                                                                                                                                                                                             | Relevance                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Transactions**                              | `POST /transaction/initialize`, `GET /transaction/verify/{reference}`, `GET /transaction`, `GET /transaction/{id}`, `GET /transaction/timeline/{id}`, `POST /transaction/charge_authorization`, `POST /transaction/partial_debit`, `GET /transaction/totals`, `GET /transaction/export` | **Primary.** The transaction object is the core of verify, fetch, charge-authorization and the `charge.success` webhook                                                  |
| **Charge** (direct channel API)               | `POST /charge`, `POST /charge/submit_pin`, `/charge/submit_otp`, `/charge/submit_phone`, `/charge/submit_birthday`, `/charge/submit_address`, `GET /charge/{reference}` (check pending)                                                                                                 | **Primary second.** Intermediate states (`send_otp`, `open_url`, `pay_offline` ...) explain where a payment stopped                                                      |
| **Webhooks** (events sent to merchant)        | HTTPS POST of a JSON body to the merchant's webhook URL with header `x-paystack-signature`                                                                                                                                                                                              | **Primary.** Same transaction object inside `data` for `charge.success`; separate shapes for refunds, disputes, transfers                                                |
| Refunds                                       | `POST /refund`, `GET /refund`, `GET /refund/{id}`, `POST /refund/retry_with_customer_details/{id}`                                                                                                                                                                                      | Secondary. Lifecycle mostly visible through `refund.*` events                                                                                                            |
| Disputes                                      | `GET /dispute`, `GET /dispute/{id}`, `PUT /dispute/{id}`, `PUT /dispute/{id}/resolve`, `POST /dispute/{id}/evidence`, `GET /dispute/{id}/upload_url`, `GET /dispute/export`, `GET /dispute/transaction/{id}`                                                                            | Secondary. Chargebacks and bank disputes, linked to the transaction                                                                                                      |
| **Transfers** (payouts)                       | `POST /transfer`, `POST /transfer/finalize_transfer`, `POST /transfer/bulk`, `GET /transfer`, `GET /transfer/{code}`, `GET /transfer/verify/{reference}`, OTP management, `POST /transferrecipient`                                                                                     | Secondary, **separate parser path**: different object and status vocabulary                                                                                              |
| Preauthorization (snippets only)              | `POST /preauthorization/initialize`, `/preauthorization/reserve_authorization`, capture, release, verify, list (paths from `doc-code-snippets`)                                                                                                                                         | Later. South Africa only. Not in the OpenAPI spec                                                                                                                        |
| Webhook endpoint and event APIs               | `GET /integration/webhooks/events`, `GET /integration/webhooks/events/{id}`, `GET /integration/webhooks/events/lookup?reference=`, `POST /integration/webhooks/events/resend`, `/resend-matching`, `/integration/webhooks/events-catalog`, `/integration/webhooks/endpoints`            | Useful later: the delivery record (`status`, `status_detail`, `response_code`, `trial_count`, `event_payload`) is a ready-made webhook timeline. Not in the OpenAPI spec |
| Subscriptions, plans, invoices                | `/plan`, `/subscription`; events `subscription.*`, `invoice.*`                                                                                                                                                                                                                          | Out of scope at first                                                                                                                                                    |
| Client SDKs (InlineJS, Android, iOS, Flutter) | Browser and mobile callbacks                                                                                                                                                                                                                                                            | Out of scope; server verification is the source of truth                                                                                                                 |

**Recommendation: implement first** the Transactions API responses and the `charge.success` webhook. They are what a developer is most likely to paste after "verify says failed" or "webhook never arrived", they share one object, and they carry the two fields that explain an outcome (`status`, `gateway_response`). Add the Charge API states next, then `refund.*` and `charge.dispute.*` events (they embed or reference the transaction), then Transfers as a separate family (`transfer.*` events and transfer responses) so that payout states are never mixed with payment states.

### 3. Response and error formats

#### 3.1 Envelope

Every documented response uses one envelope (`dist/api/introduction/response-format.js`, OpenAPI schema `Response`):

| Field     | Type            | Meaning                                                                                                                                                                         |
| --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`  | boolean         | Whether the **request** succeeded. It is `true` for a charge whose payment failed (charge `200_failed` examples), so it is not the payment outcome                              |
| `message` | string          | Short description, for example "Verification successful", "Charge attempted", "Transfer has been queued", "Invalid key"                                                         |
| `data`    | object or array | The resource. Absent in most error examples                                                                                                                                     |
| `meta`    | object          | On list responses: `total`, `skipped`, `perPage`, `page`, `pageCount` (`meta-format.js`); webhook event lists use `next`, `previous`, `perPage`. On errors: `nextStep` (string) |

Error fields (OpenAPI schemas `Error`, `ErrorMeta`, `TransactionInitializeBadRequestModel`; `sample-error.js`):

| Field                      | Type    | Meaning                                                                                                       |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `status`                   | boolean | `false`                                                                                                       |
| `message`                  | string  | Human-readable error                                                                                          |
| `meta.nextStep`            | string  | "A summarised solution for the error"                                                                         |
| `type`                     | string  | Error class: `validation_error`, `processor_error`, `api_error` (see section 10 for the schema inconsistency) |
| `code`                     | string  | Machine code, for example `duplicate_reference`, `missing_params`                                             |
| `errorCodeMappingNotFound` | boolean | "An indicator for error mapping for the request"; appears only in the OpenAPI example                         |

Many documented error examples carry only `status` and `message` (for example every "Invalid key" example), so `type`, `code` and `meta` are optional in practice.

HTTP status codes appearing in documented examples: `200`, `201` (webhook endpoint created), `202` (webhook resend accepted), `400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`. A full mapping of errors to HTTP status codes is **NOT DOCUMENTED** in the sources read, and the examples disagree for some errors (section 10).

#### 3.2 Transaction object

Fields from the OpenAPI `VerifyResponse` schema and the verify, fetch, charge and webhook examples:

| Field                                                                                                 | Type (as documented)        | Notes                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                  | integer                     | Paystack transaction ID. A string in the preauthorization event's nested `transaction.id`                                                                                                             |
| `domain`                                                                                              | string                      | `test` or `live`                                                                                                                                                                                      |
| `status`                                                                                              | string                      | Transaction status (section 5.1)                                                                                                                                                                      |
| `reference`                                                                                           | string                      | Merchant or Paystack reference; request schemas say "Only -, ., = and alphanumeric characters allowed"                                                                                                |
| `receipt_number`                                                                                      | string or null              |                                                                                                                                                                                                       |
| `amount`, `requested_amount`                                                                          | integer                     | "Amount in the lower denomination of your currency" (request schema)                                                                                                                                  |
| `message`                                                                                             | string or null              | `null` in most success examples; `"madePayment"` in mobile money, bank and direct debit successes; failure text in charge failure examples                                                            |
| `gateway_response`                                                                                    | string                      | Outcome text, for example `"Successful"`, `"Approved"`. An **object** (`authorizeResponse`, `rrn`) in the preauthorization reserve example                                                            |
| `paid_at`, `created_at`, `paidAt`, `createdAt`, `transaction_date`                                    | string (ISO 8601, UTC `Z`)  | Both snake_case and camelCase copies appear in the same object                                                                                                                                        |
| `channel`                                                                                             | string                      | Examples: `card`, `bank`, `bank_transfer`, `mobile_money`, `ussd`, `apple_pay`, `direct_debit`, `preauth`; list filter enum also has `pos`, `dedicated_nuban`                                         |
| `currency`                                                                                            | string                      | `NGN`, `GHS`, `ZAR`, `KES`, `USD`                                                                                                                                                                     |
| `ip_address`                                                                                          | string or null              | Sometimes a comma-separated proxy chain (`"54.154.89.28, 162.158.38.82, 172.31.38.35"`)                                                                                                               |
| `metadata`                                                                                            | string, object, `0` or `""` | Schema: `anyOf` string or object                                                                                                                                                                      |
| `log`                                                                                                 | object or null              | `start_time`, `time_spent`, `attempts`, `errors`, `success`, `mobile`, `input`, `history[]` of `{type, message, time}`; also returned by `GET /transaction/timeline/{id}`                             |
| `fees`, `fees_split`, `fees_breakdown`                                                                | integer or null             |                                                                                                                                                                                                       |
| `authorization`                                                                                       | object                      | `authorization_code`, `bin`, `last4`, `exp_month`, `exp_year`, `channel`, `card_type`, `bank`, `country_code`, `brand`, `reusable`, `signature`, `account_name`; bank transfer adds `sender_*` fields |
| `customer`                                                                                            | object                      | `id`, `first_name`, `last_name`, `email`, `customer_code`, `phone`, `metadata`, `risk_action`, `international_format_phone`                                                                           |
| `plan`, `plan_object`, `split`, `subaccount`, `order_id`, `pos_transaction_data`, `source`, `connect` | various                     | Often empty objects or null                                                                                                                                                                           |

#### 3.3 Examples

Example A: initialize response. **Transcribed from** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/api/transactions/initialize/response.json (`200`):

```json
{
  "status": true,
  "message": "Authorization URL created",
  "data": {
    "authorization_url": "https://checkout.paystack.com/3ni8kdavz62431k",
    "access_code": "3ni8kdavz62431k",
    "reference": "re4lyvq3s3"
  }
}
```

Example B: error with `type` and `code`. **Transcribed from** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/api/introduction/sample-error.js:

```json
{
  "status": false,
  "message": "Email Address is required",
  "meta": {
    "nextStep": "Provide all required params "
  },
  "type": "validation_error",
  "code": "missing_params"
}
```

Example C: verify response, excerpt. **From** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/api/transactions/verify/response.json (`200`). Fields keep their documented order; `[...]` marks omitted fields (IP address, metadata, `fees_split`, the `customer` block and several null or empty fields).

```text
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 4099260516,
    "domain": "test",
    "status": "success",
    "reference": "re4lyvq3s3",
    "receipt_number": null,
    "amount": 40333,
    "message": null,
    "gateway_response": "Successful",
    "paid_at": "2024-08-22T09:15:02.000Z",
    "created_at": "2024-08-22T09:14:24.000Z",
    "channel": "card",
    "currency": "NGN",
    [...]
    "log": {
      "start_time": 1724318098,
      "time_spent": 4,
      "attempts": 1,
      "errors": 0,
      "success": true,
      "mobile": false,
      "input": [],
      "history": [
        { "type": "action", "message": "Attempted to pay with card", "time": 3 },
        { "type": "success", "message": "Successfully paid with card", "time": 4 }
      ]
    },
    "fees": 10283,
    [...]
    "authorization": {
      "authorization_code": "AUTH_uh8bcl3zbn",
      "bin": "408408",
      "last4": "4081",
      "exp_month": "12",
      "exp_year": "2030",
      "channel": "card",
      "card_type": "visa ",
      "bank": "TEST BANK",
      "country_code": "NG",
      "brand": "visa",
      "reusable": true,
      "signature": "SIG_yEXu7dLBeqG0kU7g95Ke",
      "account_name": null
    },
    [...]
    "requested_amount": 30050,
    [...]
    "transaction_date": "2024-08-22T09:14:24.000Z",
    [...]
  }
}
```

Example D: charge responses that stop before completion. **Transcribed from** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/api/charges/submit-pin/response.json (`200_failed`) and https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/api/charges/create/response.json (`200_bank_auth`):

```json
{
  "status": true,
  "message": "Charge attempted",
  "data": {
    "reference": "bc9w93gh629a4d7",
    "status": "failed",
    "message": "Error occured while enrolling you for OTP!"
  }
}
```

```json
{
  "status": true,
  "message": "Charge attempted",
  "data": {
    "reference": "apg8mnjf5yg7zp8",
    "url": "https://standard.paystack.co/close",
    "status": "open_url"
  }
}
```

Example E: `charge.success` webhook, excerpt. **From** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/doc/payments/webhooks/events.js (`transaction_successful`). Documented order kept; `[...]` marks the omitted `ip_address`, `log` and `customer` blocks.

```text
{
  "event": "charge.success",
  "data": {
    "id": 302961,
    "domain": "live",
    "status": "success",
    "reference": "qTPrJoy9Bx",
    "amount": 10000,
    "message": null,
    "gateway_response": "Approved by Financial Institution",
    "paid_at": "2016-09-30T21:10:19.000Z",
    "created_at": "2016-09-30T21:09:56.000Z",
    "channel": "card",
    "currency": "NGN",
    [...]
    "metadata": 0,
    [...]
    "fees": null,
    [...]
    "authorization": {
      "authorization_code": "AUTH_f5rnfq9p",
      "bin": "539999",
      "last4": "8877",
      "exp_month": "08",
      "exp_year": "2020",
      "card_type": "mastercard DEBIT",
      "bank": "Guaranty Trust Bank",
      "country_code": "NG",
      "brand": "mastercard",
      "account_name": "BoJack Horseman"
    },
    "plan": {}
  }
}
```

Example F: `transfer.failed` webhook, excerpt. **From** the same `events.js` (`transfer_failed`). Documented order kept; `[...]` marks the omitted `recipient` block (name, e-mail and bank account).

```text
{
  "event": "transfer.failed",
  "data": {
    "amount": 200000,
    "currency": "NGN",
    "domain": "test",
    "failures": null,
    "id": 69123462,
    "integration": { "id": 100043, "is_live": true, "business_name": "Paystack" },
    "reason": "Enjoy",
    "reference": "1976435206",
    "source": "balance",
    "source_details": null,
    "status": "failed",
    "titan_code": null,
    "transfer_code": "TRF_chs98y5rykjb47w",
    "transferred_at": null,
    [...]
    "session": { "provider": "nip", "id": "74849400998877667" },
    "created_at": "2021-04-12T15:30:15.000Z",
    "updated_at": "2021-04-12T15:41:21.000Z"
  }
}
```

Example G: `refund.processed` webhook, excerpt. **From** https://github.com/PaystackOSS/doc-code-snippets/blob/main/dist/doc/payments/refunds/events.js (`refund_processed`). Documented order kept; `[...]` marks the omitted `customer` block (names and e-mail).

```text
{
  "event": "refund.processed",
  "data": {
    "status": "processed",
    "transaction_reference": "T2154954_412829_3be32076_6lcg3",
    "refund_reference": "132013318360",
    "amount": "5000",
    "currency": "NGN",
    "processor": "mpgs_zen",
    [...]
    "integration": 412829,
    "domain": "live"
  }
}
```

In the excerpts, `[...]` marks omitted fields and is not part of the documented payload; the excerpts are therefore not valid JSON.

### 4. Codes

Strings are exactly as documented (including capitalization and typos). "Meaning" is a short paraphrase. Category and retry columns are **suggestions** for PandaPayLens, not Paystack statements; where Paystack gives advice (for example "retry after 24 hours"), it is reflected.

Paystack has **no numeric decline code** in the documented payloads. Declines and errors are text. A parser must match text case-insensitively, tolerate small variations and fall back to `unknown`.

#### 4.1 Error `type` (OpenAPI enum): 3 values

| Value              | Meaning (paraphrase)                                                                                             | Category        | Retry class         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------------- |
| `validation_error` | The request failed validation (missing or invalid parameter, unknown record, duplicate reference)                | invalid_request | do_not_retry        |
| `processor_error`  | Listed in the enum; meaning and examples **NOT DOCUMENTED**                                                      | unknown         | unknown             |
| `api_error`        | Generic server-side failure; examples pair it with `code` `unknown` and "Try again later" or "An error occurred" | unknown         | retry_conditionally |

#### 4.2 Error `code`: 8 values seen in documented examples

| Value                        | Where documented                                                                      | Meaning (paraphrase)                                               | Category          | Retry class         |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- | ------------------- |
| `duplicate_reference`        | OpenAPI `TransactionInitializeBadRequestModel` example                                | Reference already used; `nextStep` says to use a new reference     | duplicate_request | do_not_retry        |
| `missing_params`             | `sample-error.js`, virtual terminal update                                            | A required parameter is missing                                    | invalid_request   | do_not_retry        |
| `invalid_params`             | refund retry (422), split update (400)                                                | A parameter value or resource state is invalid                     | invalid_request   | do_not_retry        |
| `not_found`                  | preauthorization verify, split remove, virtual terminal                               | The referenced record does not exist on this integration           | invalid_request   | do_not_retry        |
| `transaction_not_found`      | Capitec Pay requery (400)                                                             | No transaction with that reference on this integration             | invalid_request   | do_not_retry        |
| `invalid_transfer_recipient` | transfer initiate (400)                                                               | Recipient code invalid or missing                                  | invalid_request   | do_not_retry        |
| `unknown`                    | Capitec requery (500), preauthorization list (404), bulk transfer (404), direct debit | Unclassified error; `nextStep` often "Try again later"             | unknown           | retry_conditionally |
| `INVALID_PUSH_ID`            | terminal event status, nested as `data.code`                                          | Terminal push notification ID invalid (Terminal API, out of scope) | invalid_request   | do_not_retry        |

Success markers, not errors: Capitec Pay requery returns top-level `type` `success` and `code` `ok`.

#### 4.3 API error messages (`status: false`): 37 values in scope

From the `response.json` files of the families in scope and `dist/api/introduction/*.js`. The HTTP status is the key or description used in the example.

| Message                                                               | Family / example (HTTP)                                                                   | Meaning (paraphrase)                                                       | Category             | Retry class                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- | ------------------------------- |
| `Invalid key`                                                         | OpenAPI `Unauthorized` (401); transaction verify, fetch, charge authorization (`400`)     | Secret key wrong or missing                                                | configuration        | do_not_retry                    |
| `Invalid Key`                                                         | products examples (401 and 400)                                                           | Same, different capitalization                                             | configuration        | do_not_retry                    |
| `Entity not found`                                                    | OpenAPI `NotFound` (404)                                                                  | Requested record does not exist                                            | invalid_request      | do_not_retry                    |
| `Duplicate Transaction Reference`                                     | OpenAPI initialize 400 (`duplicate_reference`)                                            | Reference reused                                                           | duplicate_request    | do_not_retry                    |
| `Email Address is required`                                           | `sample-error.js` (`missing_params`)                                                      | Customer e-mail missing                                                    | invalid_request      | do_not_retry                    |
| `Currency not supported by merchant`                                  | `supported-currency.js`                                                                   | Business not enabled for that currency                                     | configuration        | do_not_retry                    |
| `Transaction reference is invalid`                                    | charge submit and check endpoints (400)                                                   | Unknown or unusable charge reference                                       | invalid_request      | do_not_retry                    |
| `Email address is required for association with card`                 | charge create (400)                                                                       | Card charge without customer e-mail                                        | invalid_request      | do_not_retry                    |
| `Customer not found`                                                  | partial debit (400)                                                                       | No customer for the given e-mail or code                                   | invalid_request      | do_not_retry                    |
| `Transaction ID or reference is invalid`                              | transaction timeline (`400` key, described as 404)                                        | Unknown transaction                                                        | invalid_request      | do_not_retry                    |
| `Transaction not found`                                               | Capitec Pay requery (400, `transaction_not_found`)                                        | Unknown transaction reference                                              | invalid_request      | do_not_retry                    |
| `An error occurred`                                                   | Capitec Pay requery (500, `api_error`), preauthorization list (500)                       | Unclassified server error                                                  | provider_unavailable | retry_conditionally             |
| `Authorization does not exist or does not belong to integration`      | direct debit mandate verify (`api_error`, `unknown`); customer authorization verify (404) | Authorization unknown for this business                                    | invalid_request      | do_not_retry                    |
| `Authorization code not found.`                                       | customer deactivate authorization (404)                                                   | Authorization code unknown                                                 | invalid_request      | do_not_retry                    |
| `Invalid Refund state, refund status should be "needs-attention"`     | refund retry (422, `invalid_params`)                                                      | Only refunds in `needs-attention` can be retried with customer details     | invalid_request      | do_not_retry                    |
| `Refund amount cannot be greater than initial amount`                 | dispute update (400)                                                                      | Refund in dispute exceeds the transaction amount                           | invalid_amount       | do_not_retry                    |
| `Recipient specified is invalid`                                      | transfer initiate (400, `invalid_transfer_recipient`)                                     | Bad recipient code                                                         | invalid_request      | do_not_retry                    |
| `Duplicate reference(s) found: <references>`                          | bulk transfer (`404`, `api_error`, `unknown`)                                             | Transfer references already used; the example lists them                   | duplicate_request    | do_not_retry                    |
| `Transfer code is invalid`                                            | transfer finalize (400)                                                                   | Unknown transfer code for OTP finalization                                 | invalid_request      | do_not_retry                    |
| `Transfer not found`                                                  | transfer verify (404)                                                                     | Unknown transfer reference                                                 | invalid_request      | do_not_retry                    |
| `Capture amount cannot be more than authorized amount`                | preauthorization capture (400)                                                            | Capture exceeds the hold                                                   | invalid_amount       | do_not_retry                    |
| `Customer email address is required`                                  | preauthorization initialize (400)                                                         | E-mail missing                                                             | invalid_request      | do_not_retry                    |
| `No preauthorized transaction exists for the reference provided`      | preauthorization release (400), list (404, `api_error`)                                   | Unknown hold reference                                                     | invalid_request      | do_not_retry                    |
| `Preauthorization unsuccessful`                                       | preauthorization reserve (400)                                                            | Hold could not be placed                                                   | card_declined        | customer_action_required        |
| `Preauthorization not found`                                          | preauthorization verify (400, `not_found`)                                                | Unknown hold                                                               | invalid_request      | do_not_retry                    |
| `Webhook endpoint management is not available for this integration`   | webhook endpoint APIs (403)                                                               | Feature not enabled for the business                                       | configuration        | do_not_retry                    |
| `Unknown event type(s): charge.sucess`                                | webhook endpoint create (400)                                                             | Event name not recognized (the example uses a misspelled event on purpose) | invalid_request      | do_not_retry                    |
| `A webhook endpoint with this URL already exists for this domain`     | webhook endpoint create and update (409)                                                  | URL already registered                                                     | duplicate_request    | do_not_retry                    |
| `Webhook endpoint not found`                                          | webhook endpoint fetch, update, delete, ping (404)                                        | Unknown endpoint code                                                      | invalid_request      | do_not_retry                    |
| `Invalid query: must be one of next or previous`                      | webhook endpoint and event lists (400)                                                    | Bad pagination cursor parameter                                            | invalid_request      | do_not_retry                    |
| `Too many webhook ping requests. Please wait a moment and try again.` | webhook endpoint ping (429)                                                               | Rate limited                                                               | rate_limiting        | retry_conditionally             |
| `Provide at least one field to update`                                | webhook endpoint update (400)                                                             | Empty update                                                               | invalid_request      | do_not_retry                    |
| `Webhook event not found`                                             | webhook event fetch and lookup (404)                                                      | Unknown delivery record                                                    | invalid_request      | do_not_retry                    |
| `Something went wrong`                                                | webhook event APIs (500)                                                                  | Server error                                                               | provider_unavailable | safe_to_retry_technical_request |
| `reference is required`                                               | webhook event lookup (400)                                                                | Missing query parameter                                                    | invalid_request      | do_not_retry                    |
| `Resend rate limit exceeded, please try again later`                  | webhook resend-matching (429)                                                             | Rate limited                                                               | rate_limiting        | retry_conditionally             |
| `ids must be a non-empty array`                                       | webhook resend (400)                                                                      | Bad request body                                                           | invalid_request      | do_not_retry                    |

Other families in the snippets show the same envelope with more messages (customers, products, pages, terminals, subscriptions); they are out of scope and not counted.

#### 4.4 Transaction-level outcome text: 11 values

`gateway_response` values in documented examples (7):

| Value                                        | Where                                                                                           | Meaning (paraphrase)                         | Category             | Retry class   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------- | ------------- |
| `Approved`                                   | charge, charge authorization, partial debit, mobile money, Pay with Transfer, disputes, preauth | Payment approved                             | n/a (success)        | n/a           |
| `Successful`                                 | verify, fetch, charge create, disputes                                                          | Payment approved                             | n/a (success)        | n/a           |
| `Approved by Financial Institution`          | `charge.success` webhook example                                                                | Payment approved                             | n/a (success)        | n/a           |
| `Approved or completed successfully`         | Terminal event examples                                                                         | Payment approved                             | n/a (success)        | n/a           |
| `Payment successful`                         | USSD, QR and direct debit `charge.success` examples                                             | Payment approved                             | n/a (success)        | n/a           |
| `Transaction in progress`                    | direct debit charge authorization (`data.status` `processing`)                                  | Debit started, outcome follows later         | n/a (pending)        | n/a           |
| `No gateway was able to process the request` | webhook event lookup example, `zero_charge_authorization.failed`, `status` `failed`             | No downstream processor accepted the request | provider_unavailable | manual_review |

`data.message` failure and success text in charge examples (4):

| Value                                                      | Where                                                  | Meaning (paraphrase)                                | Category                   | Retry class              |
| ---------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- | -------------------------- | ------------------------ |
| `madePayment`                                              | bank, mobile money, direct debit, USSD successes       | Internal success marker                             | n/a (success)              | n/a                      |
| `Insufficient funds`                                       | charge check and submit address `200_failed`           | Not enough money (same text as a Help Center entry) | insufficient_funds         | customer_action_required |
| `Error occured while enrolling you for OTP!`               | charge submit pin, otp, phone, birthday `200_failed`   | OTP enrollment failed at the bank                   | authentication_failed      | retry_conditionally      |
| `Account is de-activated, please contact Capitec for help` | Capitec Pay requery `200_failed` (top-level `message`) | Customer's Capitec account is deactivated           | payment_method_unavailable | customer_action_required |

#### 4.5 Help Center error messages: 111 rows (118 strings)

Paystack's Help Center groups the error messages merchants and customers see into four articles. They are the documented decline vocabulary. **Which API field carries them is NOT DOCUMENTED**: one of them (`Insufficient funds`) appears in `data.message` of charge failure examples, while success texts appear in `gateway_response`, so an adapter should look up both fields. Some rows list several variants separated by "or"; each variant is a separate string. Typographic apostrophes in the articles are written here as plain `'`; a parser should normalize both.

##### 4.5.1 Bank errors (https://support.paystack.com/en/articles/2123650): 52 rows

| Message                                                                                                                       | Meaning (paraphrase)                                                       | Category                   | Retry class              |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `Access Denied`                                                                                                               | Bank says the account cannot be charged right now                          | card_declined              | retry_conditionally      |
| `Auth Data Error`                                                                                                             | Issuer error specific to Verve cards                                       | card_declined              | retry_conditionally      |
| `Account Closed`                                                                                                              | Bank has closed the account                                                | card_declined              | do_not_retry             |
| `An OTP related error has occurred, please contact support`                                                                   | Issuer could not generate a token at that time                             | authentication_failed      | retry_conditionally      |
| `An error occurred while processing the request`                                                                              | Bank downtime, mostly UBA Pay with Bank                                    | provider_unavailable       | retry_conditionally      |
| `An invalid response was received from remote host, see provider response code/message for details`                           | GTB 737 USSD payment not completed on the phone                            | unknown (not completed)    | customer_action_required |
| `Bank could not send SMS`                                                                                                     | Bank downtime, no OTP sent                                                 | provider_unavailable       | retry_conditionally      |
| `Beneficiary Bank not available`                                                                                              | Bank downtime                                                              | provider_unavailable       | retry_conditionally      |
| `Card type has not been configured for payment gateway`                                                                       | Card not enabled for online payments                                       | payment_method_unavailable | customer_action_required |
| `Card validation failed. Error occurred while processing your request`                                                        | Downtime during the attempt                                                | provider_unavailable       | retry_conditionally      |
| `Cannot process request`                                                                                                      | Bank downtime                                                              | provider_unavailable       | retry_conditionally      |
| `Card Not Registered On Token Platform`                                                                                       | Customer not enrolled for OTP at the bank                                  | authentication_required    | customer_action_required |
| `Contact Acquirer`                                                                                                            | Customer's bank cannot process the payment now                             | card_declined              | customer_action_required |
| `Daily transaction limit exceeded`                                                                                            | Bank daily limit or minimum balance reached                                | card_declined              | customer_action_required |
| `Declined`                                                                                                                    | Bank declined without a reason                                             | card_declined              | retry_conditionally      |
| `Do Not Honour`                                                                                                               | Bank declined or restricted the account; common for international payments | card_declined              | customer_action_required |
| `Error`                                                                                                                       | Downtime at the bank or at Paystack                                        | provider_unavailable       | retry_conditionally      |
| `Error occurred while processing your request`                                                                                | Processor downtime                                                         | provider_unavailable       | retry_conditionally      |
| `Error Occurred. Could Not Generate Token`                                                                                    | Bank could not generate a token                                            | authentication_failed      | retry_conditionally      |
| `Error Occurred. Could Not Authenticate Token`                                                                                | Bank could not check the token                                             | authentication_failed      | retry_conditionally      |
| `Exceeds withdrawal frequency`, `Exceeds withdrawal frequency limit` or `Exceeds withdrawal limit`                            | Daily number of withdrawals set by the bank reached                        | card_declined              | customer_action_required |
| `Invalid amount (currency conversion field overflow)`                                                                         | Amount outside a virtual card's limits                                     | invalid_amount             | customer_action_required |
| `Invalid Service Code`                                                                                                        | Bank fraud block                                                           | fraud_or_risk              | customer_action_required |
| `Invalid Transaction`                                                                                                         | Issuer cannot process now, common with Verve                               | card_declined              | retry_conditionally      |
| `Issuer or Switch Inoperative`                                                                                                | Bank or card network temporarily down                                      | provider_unavailable       | retry_conditionally      |
| `Lost Card`                                                                                                                   | Card reported lost                                                         | fraud_or_risk              | do_not_retry             |
| `Lost Card, Pick-Up`                                                                                                          | Card reported lost; replacement waiting at the bank                        | fraud_or_risk              | do_not_retry             |
| `Pickup card (lost card)`, `Pickup card (stolen card)` or `Pick-up card`                                                      | Card hotlisted as lost or stolen                                           | fraud_or_risk              | do_not_retry             |
| `No hardware, No SMS sent`                                                                                                    | No OTP or hardware token set up on the account                             | authentication_required    | customer_action_required |
| `Previous message located for a repeat or reversal, but repeat or reversal data are inconsistent with original message`       | Paystack says the account appears dormant                                  | card_declined              | customer_action_required |
| `Received invalid response from remote entity`                                                                                | Temporary bank downtime (Ecobank, First Bank)                              | provider_unavailable       | retry_conditionally      |
| `Request to Generate Token is Successful`                                                                                     | OTP generated but the customer did not continue                            | authentication_required    | customer_action_required |
| `Refer to card issuer`                                                                                                        | Issuer flagged the card or account                                         | card_declined              | customer_action_required |
| `Refer to Financial Institution` or `Refer to Financial Institution, Special Condition`                                       | Issue to resolve with the bank                                             | card_declined              | customer_action_required |
| `Restricted card`                                                                                                             | Bank restriction, typically missing identification on the account          | card_declined              | customer_action_required |
| `Restricted Card, Pick-Up`                                                                                                    | Card restricted by the bank                                                | card_declined              | do_not_retry             |
| `Suspected Fraud` or `Suspected Fraud, Pick-Up`                                                                               | Bank fraud system blocked the payment                                      | fraud_or_risk              | do_not_retry             |
| `The bank is currently unable to process this transaction; please try another card or bank account`                           | Bank downtime                                                              | provider_unavailable       | retry_conditionally      |
| `This authorization could not be charged`                                                                                     | Recurring charge not possible on this Verve card                           | payment_method_unavailable | do_not_retry             |
| `This authorization could not be charged. Not a reusable verve card`                                                          | Same; Paystack suggests re-tokenizing the card                             | payment_method_unavailable | customer_action_required |
| `Transaction Error`                                                                                                           | Bank or processor could not complete it at that time                       | unknown                    | retry_conditionally      |
| `The service provider is unreachable at the moment, please try again later`                                                   | Issuer downtime, common with Verve                                         | provider_unavailable       | retry_conditionally      |
| `The bank is currently unable to process this transaction`                                                                    | Bank downtime                                                              | provider_unavailable       | retry_conditionally      |
| `Token Authentication failed. Received invalid response from remote entity`                                                   | Bank could not verify the token                                            | authentication_failed      | retry_conditionally      |
| `Unable to perform transaction, try again`                                                                                    | Brief downtime, or insufficient funds in a mobile money wallet             | unknown                    | retry_conditionally      |
| `Unknown Error`                                                                                                               | Temporary bank downtime (UBA, Zenith Pay with Bank)                        | provider_unavailable       | retry_conditionally      |
| `Unknown error or an unexpected error occurred during processing`                                                             | Bank downtime (Zenith Pay with Bank)                                       | provider_unavailable       | retry_conditionally      |
| `Unknown transaction`                                                                                                         | Bank error, common with First Bank Pay with Bank                           | provider_unavailable       | retry_conditionally      |
| `User account is not active at the bank`                                                                                      | Account not activated                                                      | card_declined              | customer_action_required |
| `User has not been setup`                                                                                                     | Customer not registered for Pay with Bank at their bank                    | payment_method_unavailable | customer_action_required |
| `Your account does not seem to have a phone number, email or hardware token provisioned. Please contact your account officer` | No OTP destination linked to the account                                   | authentication_required    | customer_action_required |
| `Transaction not permitted on this channel`                                                                                   | Card or account not enabled for this channel                               | payment_method_unavailable | customer_action_required |

##### 4.5.2 Customer errors (https://support.paystack.com/en/articles/2124674): 33 rows

| Message                                                                                                               | Meaning (paraphrase)                                       | Category                | Retry class              |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ------------------------ |
| `Duplicate Transaction ID`                                                                                            | Checkout reloaded; the first attempt most likely succeeded | duplicate_request       | do_not_retry             |
| `Enter the OTP code sent to your phone to complete the transaction`                                                   | Abandoned at authentication                                | authentication_required | customer_action_required |
| `Expired card`                                                                                                        | Card expired                                               | card_declined           | customer_action_required |
| `Incorrect Date of Birth`                                                                                             | Wrong date of birth for Pay with Bank                      | authentication_failed   | customer_action_required |
| `Incorrect PIN`                                                                                                       | Wrong card PIN                                             | authentication_failed   | customer_action_required |
| `Insufficient funds`                                                                                                  | Not enough available balance (holds can reduce it)         | insufficient_funds      | customer_action_required |
| `Invalid card number`                                                                                                 | Wrong card number                                          | invalid_request         | customer_action_required |
| `Invalid OTP`                                                                                                         | Wrong OTP                                                  | authentication_failed   | customer_action_required |
| `Invalid token supplied`                                                                                              | Wrong token                                                | authentication_failed   | customer_action_required |
| `Invalid USSD code`                                                                                                   | Wrong USSD string dialled                                  | invalid_request         | customer_action_required |
| `Kindly enter OTP`                                                                                                    | OTP sent but not entered                                   | authentication_required | customer_action_required |
| `Kindly enter the mobile no registered with your bank`                                                                | Pay with Bank phone number not provided                    | authentication_required | customer_action_required |
| `Mobile number is invalid`                                                                                            | Wrong phone number for Pay with Bank                       | invalid_request         | customer_action_required |
| `No Card Record`                                                                                                      | Card unknown to the issuer, or wrong number or expiry      | card_declined           | customer_action_required |
| `Payment Requires Token`                                                                                              | Abandoned at authentication                                | authentication_required | customer_action_required |
| `PIN tries exceeded`                                                                                                  | Too many wrong PINs; retry after at least 24 hours         | authentication_failed   | customer_action_required |
| `Please conclude payment by logging in to iBank`                                                                      | GTB Pay with Bank not completed on iBank                   | authentication_required | customer_action_required |
| `Please conclude payment on your phone`                                                                               | GTB 737 USSD not completed                                 | authentication_required | customer_action_required |
| `Please confirm that this is a valid [bank name] account`                                                             | Wrong account number                                       | invalid_request         | customer_action_required |
| `Please enter the token sent to your phone to conclude payment of [XXXX] amount`                                      | Bank token not entered                                     | authentication_required | customer_action_required |
| `Please enter your birthday`                                                                                          | Date of birth not provided for Pay with Bank               | authentication_required | customer_action_required |
| `Press the button on your Zenith Bank token and type your PIN plus the One Time Password(OTP) generated by the token` | Zenith token step not completed                            | authentication_required | customer_action_required |
| `Press the white button on your GTB token and type the transaction code generated`                                    | GTB token step abandoned                                   | authentication_required | customer_action_required |
| `Sorry, this is not an ALAT account`                                                                                  | Wrong account number for ALAT by Wema                      | invalid_request         | customer_action_required |
| `Target Authorization Error`                                                                                          | Mobile money wallet limit reached or wallet underfunded    | insufficient_funds      | customer_action_required |
| `Token Authorization Not Successful. Incorrect Token Supplied`                                                        | Wrong token                                                | authentication_failed   | customer_action_required |
| `Token Not Generated. Customer Not Registered on Token Platform`                                                      | Customer not registered for OTP                            | authentication_required | customer_action_required |
| `Token has expired`                                                                                                   | OTP expired                                                | authentication_failed   | customer_action_required |
| `The transaction was not completed`                                                                                   | Customer did not finish                                    | unknown (not completed) | customer_action_required |
| `Transaction just initiated`                                                                                          | Started but not completed                                  | unknown (not completed) | customer_action_required |
| `User's mobile number is invalid`                                                                                     | Phone number wrong or not registered with the bank         | invalid_request         | customer_action_required |
| `Your balance is not sufficient for this transaction`                                                                 | Not enough money                                           | insufficient_funds      | customer_action_required |
| `Payer has reached their limit`                                                                                       | Bank or issuer spending or count limit reached             | card_declined           | customer_action_required |

##### 4.5.3 Fraud block errors (https://support.paystack.com/en/articles/2125058): 6 rows

| Message                                                                                 | Meaning (paraphrase)                                          | Category                | Retry class              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- | ------------------------ |
| `Authorization was abandoned. Please try again`                                         | Customer stopped at the 3DS or OTP step                       | authentication_required | customer_action_required |
| `Cardinal Authentication Required`                                                      | Card BIN does not support 3DS                                 | authentication_required | customer_action_required |
| `Identification required`                                                               | 3DS authentication could not be completed                     | authentication_failed   | customer_action_required |
| `The cardholder was not authorised. This is used in 3-D Secure Authentication`          | 3DS attempted but the card is not enrolled                    | authentication_failed   | customer_action_required |
| `Transaction not permitted to cardholder`                                               | Bank restricts the customer's payments                        | card_declined           | customer_action_required |
| `Transaction was blocked by the Payment Server because it did not pass all risk checks` | Paystack explains it as the card not being registered for 3DS | authentication_required | customer_action_required |

##### 4.5.4 System errors (https://support.paystack.com/en/articles/2129794): 20 rows

| Message                                                                             | Meaning (paraphrase)                                                                                                         | Category                   | Retry class              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `An unknown error has occurred, please contact system administrator`                | Downtime during the attempt                                                                                                  | provider_unavailable       | retry_conditionally      |
| `Customer is blacklisted`                                                           | Paystack or the business blacklisted the customer                                                                            | fraud_or_risk              | manual_review            |
| `Currency not supported`                                                            | Business not enabled for that currency                                                                                       | configuration              | do_not_retry             |
| `Denied by Fraud System` or `Blocked by fraud system`                               | Paystack fraud prevention denied the attempts; usually clears after 24 hours                                                 | fraud_or_risk              | retry_conditionally      |
| `Either remote server cannot be reached or the network connection was reset/broken` | Paystack-side downtime                                                                                                       | network_or_timeout         | retry_conditionally      |
| `Error, please try again`                                                           | Bank or processor downtime                                                                                                   | provider_unavailable       | retry_conditionally      |
| `E5015: Merchant [PAYSTACK PAYMENTS LTD] does not support currency [USD]`           | USD not routed to the processor used                                                                                         | configuration              | manual_review            |
| `Failed`                                                                            | Network or processor downtime                                                                                                | network_or_timeout         | retry_conditionally      |
| `Invalid Merchant selected`                                                         | Wrong or swapped API keys in the integration                                                                                 | configuration              | do_not_retry             |
| `Merchant is not enabled for international transactions`                            | International cards not enabled for the business                                                                             | configuration              | do_not_retry             |
| `Pay with Bank is not available at this time`                                       | Pay with Bank temporarily down                                                                                               | provider_unavailable       | retry_conditionally      |
| `This cardholder has defaulted`                                                     | Repeated "insufficient funds" on this card                                                                                   | insufficient_funds         | customer_action_required |
| `The transaction could not be processed at this time, please try again later`       | Downtime                                                                                                                     | provider_unavailable       | retry_conditionally      |
| `Timed out`                                                                         | Paystack could not confirm the outcome; verify before retrying                                                               | network_or_timeout         | retry_conditionally      |
| `Transaction Not Completed`                                                         | Downtime or wrong details                                                                                                    | unknown                    | retry_conditionally      |
| `Transaction not Found`                                                             | Requery during a processor timeout found nothing                                                                             | network_or_timeout         | retry_conditionally      |
| `Unable to conclude transaction`                                                    | Brief downtime                                                                                                               | provider_unavailable       | retry_conditionally      |
| `Unable to process transaction`                                                     | Card hotlisted by Paystack fraud prevention after many cards or failures; shown as "Denied by Fraud System" on the Dashboard | fraud_or_risk              | retry_conditionally      |
| `Unrecognized card type. Please try again with a Mastercard, Verve or VISA`         | Card brand not accepted                                                                                                      | payment_method_unavailable | customer_action_required |
| `Unspecified Failure`                                                               | Downtime                                                                                                                     | provider_unavailable       | retry_conditionally      |

"retry_conditionally" for downtime and timeout entries means: verify the transaction first (`GET /transaction/verify/{reference}`), because the original attempt may have gone through. Paystack's "Duplicate Transaction ID" entry shows that duplicates do happen after reloads.

#### 4.6 Inbound bank transfer rejection: 1 value

| Field and value                   | Where                                                                                                          | Meaning (paraphrase)                                              | Category       | Retry class              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- | ------------------------ |
| `message_type` `INCORRECT_AMOUNT` | `bank.transfer.rejected` event (`pwt-events.js`, `pesalink-events.js`), with `message` `incorrect amount sent` | Customer sent a different amount to the Pay with Transfer account | invalid_amount | customer_action_required |

Other `message_type` values are **NOT DOCUMENTED**.

#### 4.7 Count summary

| Table                                            | Values                     |
| ------------------------------------------------ | -------------------------- |
| 4.1 error `type`                                 | 3                          |
| 4.2 error `code`                                 | 8                          |
| 4.3 API error messages in scope                  | 37                         |
| 4.4 `gateway_response` and `data.message` values | 11                         |
| 4.5 Help Center error messages                   | 111 rows (118 strings)     |
| 4.6 inbound transfer `message_type`              | 1                          |
| **Total**                                        | **171 rows (178 strings)** |
| Not counted: status vocabularies (section 5)     | see section 5              |

### 5. Lifecycle

Payments, refunds, disputes, transfers (payouts) and preauthorizations each have their own object and status set. Keep them apart in the adapter.

#### 5.1 Transaction status

| Value        | Source                                                                                                    | Meaning                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`    | list filter enum (OpenAPI), all success examples                                                          | Paid                                                                                                                                                                                     |
| `failed`     | list filter enum, charge `200_failed` examples, webhook lookup example                                    | Payment failed; reason in `gateway_response` or `data.message`                                                                                                                           |
| `abandoned`  | list filter enum; Help Center 2123330                                                                     | The customer started but never completed the payment ("the transaction didn't fail because it never began"); also created when a site calls the API but the customer never sees checkout |
| `reversed`   | list filter enum; `charge.dispute.resolve` example (`transaction.status` `reversed`); Help Center 2130434 | Refunded (after a processed refund) or reversed after a dispute                                                                                                                          |
| `processing` | direct debit charge authorization example                                                                 | Debit in progress (`gateway_response` `Transaction in progress`)                                                                                                                         |
| `pending`    | charge responses (`200_pending`)                                                                          | Charge awaiting a final result                                                                                                                                                           |

"Reversal pending" is a Dashboard label while a refund is pending or processing (Help Center 2130434); it is **NOT DOCUMENTED** as an API value. The values `ongoing` and `queued` for a transaction are **NOT DOCUMENTED** in the sources read. The export filter adds `all`.

#### 5.2 Charge API states (`data.status` on `/charge` and submit endpoints)

| Value                   | Next step documented in the examples                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `send_pin`              | `POST /charge/submit_pin`                                                                                 |
| `send_otp`              | `POST /charge/submit_otp`; `display_text` tells the customer where the OTP is (also Telecel voucher flow) |
| `send_phone`            | `POST /charge/submit_phone`                                                                               |
| `send_birthday`         | `POST /charge/submit_birthday`                                                                            |
| `send_address`          | `POST /charge/submit_address` (with `country_code`)                                                       |
| `open_url`              | Customer must open `data.url` (bank authentication, EFT)                                                  |
| `pay_offline`           | Customer completes on the phone (USSD `ussd_code`, M-PESA, MTN, Airtel, QR); result arrives by webhook    |
| `pending_bank_transfer` | Customer must transfer to the returned `account_number` (Pay with Transfer, Pesalink, direct debit)       |
| `pending`               | Wait; `GET /charge/{reference}` returns "Reference check successful"                                      |
| `success`               | Final; full transaction object                                                                            |
| `failed`                | Final; `data.message` holds the reason                                                                    |

#### 5.3 Flows that complete later

- **Mobile money**: the charge can return `success` at once ("JIT" example) or `pending` ("late" example); the final result is the `charge.success` event (`mobile-event.js`). Customers confirm with OTP and PIN on the phone (Help Center 2128386).
- **Pay with Transfer**: `pending_bank_transfer` with a generated account; the account expires after 30 minutes and late transfers are refunded automatically (Help Center 2128642). A wrong amount produces `bank.transfer.rejected` with `message_type` `INCORRECT_AMOUNT`.
- **USSD, QR, M-PESA**: `pay_offline`, then `charge.success` with `gateway_response` `Payment successful`.
- **Direct debit**: `processing` with `Transaction in progress`, then `charge.success` (`charge-webhook.js`).
- **Failed but debited**: banks usually reverse a wrongful debit within 24 hours or the next working day (Help Center 2127938). This is outside Paystack's payloads.

A `charge.failed` event exists in the webhook events catalog example (`"A failed charge"`) and in the endpoint-create example, but no `charge.failed` payload example and no mention in the webhook guide's event list were found (section 10).

#### 5.4 Refunds

`refund.*` events and the refund object use: `pending` (refund created; transaction becomes "Reversal pending" on the Dashboard), `processing` (processor received it), `processed` (completed; transaction becomes `reversed`), `failed` (transaction goes back to `success`, money returned to the merchant), and `needs-attention` (event `refund.needs-attention`; only this state can be retried with `POST /refund/retry_with_customer_details/{id}` and customer bank details). Sources: Help Center 2130434; `refunds/events.js`; refund retry 422 message. Refund responses also carry `expected_at`, `refunded_at`, `deducted_amount`, `fully_deducted`, and the retry example has `reason` `PROCESSING`. The meaning of `reason` values is **NOT DOCUMENTED**.

#### 5.5 Disputes

- Status filter enum: `awaiting-merchant-feedback`, `awaiting-bank-feedback`, `pending`, `resolved` (OpenAPI). Examples also show `archived`.
- `resolution`: request schema accepts `merchant-accepted` and `declined`; the `charge.dispute.resolve` example shows `auto-accepted`.
- `category`: `chargeback` (event examples), `general` (resolve example); `source` `bank` (update example).
- Events: `charge.dispute.create`, `charge.dispute.remind`, `charge.dispute.resolve`. Each embeds the full `transaction`, plus `refund_amount`, `dueAt`, `resolvedAt`, `history[]` (`status`, `by`, `createdAt`) and `messages[]`.
- Outcomes "are ultimately decided by the issuing banks and the card schemes" (Help Center 9040130).

#### 5.6 Transfers (payouts), kept separate

- Status enum on list and export: `pending`, `success`, `failed`, `otp`, `abandoned`, `reversed`, `blocked`, `rejected`, `received` (OpenAPI). Meanings of `abandoned`, `blocked`, `rejected` and `received` are **NOT DOCUMENTED** in the sources read.
- `otp`: initiate returns "Transfer requires OTP to continue"; `POST /transfer/finalize_transfer` with the OTP continues.
- Initiate without OTP returns "Transfer has been queued" with `data.status` `success` in the example (section 10).
- Final states arrive as `transfer.success`, `transfer.failed`, `transfer.reversed` events; `GET /transfer/verify/{reference}` gives the current state.
- `failures` is `null` in every example; its structure and the list of transfer failure reasons are **NOT DOCUMENTED** in the sources read. `gateway_response` is `null` in transfer examples.
- Help Center 9039298: final status usually within minutes to 1 hour; NIBSS downtime keeps transfers `pending`; retry a pending transfer only with the **same** `reference` so Paystack can detect an earlier success; a new reference can pay twice. Successful transfers carry a NIP `session.id` that banks use to trace the credit.
- Transfer approval: a merchant approval URL answers HTTP 200 to approve and 400 to reject (`manage/approval.js`); the request payload is **NOT DOCUMENTED**.

#### 5.7 Preauthorization (South Africa only)

Statuses in examples: `authorized` (reserved), `captured`, `capture_failed`, `released`, `release_failed`. Events: `preauthorization.reserve.success`, `preauthorization.capture.success`, `preauthorization.capture.failed`, `preauthorization.release.success`, `preauthorization.release.failed`. A capture smaller than the hold releases the rest automatically (Help Center 10450882).

#### 5.8 Other status sets

- Bulk charge charge status filter: `success`, `failed`, `pending`, `error`, `inactive_authorization`.
- Subscription `status` examples: `active`, `complete`, `non-renewing`; invoice `status` `success`, `pending`.
- Webhook delivery record: Help Center statuses `Delivered`, `Pending`, `Failed`; API examples show `status` `Failed` with `status_detail` `retrying` or `failed`.

### 6. Webhooks

#### 6.1 Format

- HTTP POST with a JSON body (the PHP verification example accepts only `POST`); examples parse the raw body as JSON (`receiving-events.js`). The request `Content-Type` is **NOT DOCUMENTED** in the sources read.
- Body: exactly two top-level keys, `event` (dotted lower-case name) and `data` (object; an **array** for `subscription.expiring_cards`).
- No event ID, no delivery ID, no timestamp and no API version at the top level. Timestamps exist only inside `data` and differ per event (`paid_at`, `created_at`, `updated_at`, `createdAt`); `refund.*` payloads carry none.
- Merchant acknowledgement: HTTP 200 (`res.send(200)` in the examples; Help Center 10609026 "Return a 200 OK response as soon as your server accepts the event").

#### 6.2 Event names documented

| Group                   | Events                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transactions            | `charge.success`; `charge.failed` (catalog and endpoint examples only)                                                                                                                     |
| Disputes                | `charge.dispute.create`, `charge.dispute.remind`, `charge.dispute.resolve`                                                                                                                 |
| Refunds                 | `refund.pending`, `refund.processing`, `refund.processed`, `refund.failed`, `refund.needs-attention`                                                                                       |
| Transfers               | `transfer.success`, `transfer.failed`, `transfer.reversed`                                                                                                                                 |
| Inbound bank transfer   | `bank.transfer.rejected`                                                                                                                                                                   |
| Preauthorization        | `preauthorization.reserve.success`, `preauthorization.capture.success`, `preauthorization.capture.failed`, `preauthorization.release.success`, `preauthorization.release.failed`           |
| Direct debit            | `direct_debit.authorization.created`, `direct_debit.authorization.active`                                                                                                                  |
| Card verification       | `zero_charge_authorization.failed` (webhook event lookup example)                                                                                                                          |
| Subscriptions, invoices | `subscription.create`, `subscription.disable`, `subscription.not_renew`, `subscription.expiring_cards`, `invoice.create`, `invoice.update`, `invoice.payment_failed`                       |
| Other                   | `paymentrequest.pending`, `paymentrequest.success`, `customeridentification.success`, `customeridentification.failed`, `dedicatedaccount.assign.success`, `dedicatedaccount.assign.failed` |

The Help Center says "The events available to you may depend on the Paystack products your business uses" and points to the guide's supported-events section for "the latest list", which was not read.

#### 6.3 Signature (sensitive; PandaPayLens does not verify it)

- Header `x-paystack-signature` (PHP reads it as `HTTP_X_PAYSTACK_SIGNATURE`).
- Value: HMAC-SHA512 of the raw request body, keyed with the merchant's **secret key**, as lower-case hex (128 characters) (`verifying-transaction.js`, Node, PHP, Java and C# examples).
- PandaPayLens must redact the header, may report "signature present (128 hex)", and must never ask for the secret key.

#### 6.4 Duplicates, retries and ordering

- **Duplicates**: "Webhook endpoints can occasionally receive an event more than once, particularly when retries occur"; Paystack advises checking "a unique transaction reference or resource ID" before giving value (Help Center 10609026). Suggested dedupe key: `event` + `data.id` (or `data.reference`, or `data.transaction_reference` + `data.status` for refunds, `data.transfer_code` + `data.status` for transfers).
- **Retries**: automatic retries exist ("waiting for an automatic retry"; API example `status_detail` `retrying`). A delivery is not successful when the endpoint returns a non-2xx status, takes too long or blocks the request. Manual retries go to the URL configured **now**, which may differ from the original. Delivery records show `trial_count` values 3 and 10 in examples. The retry schedule, the maximum attempts and the timeout are **NOT DOCUMENTED** in the sources read.
- **Ordering**: **NOT DOCUMENTED**. Refund events go `pending`, `processing`, `processed` or `failed`, but delivery order is not guaranteed by any statement read.
- **Test and live**: separate webhook URLs and separate event histories (Help Center 10609026); `data.domain` tells them apart.
- **Source IPs**: **NOT DOCUMENTED** in the sources read.
- **Delivery record API** (`/integration/webhooks/events`): `_id` (24 hex characters), `domain`, `category` (`transactions`, `cardVerification` ...), `event_name`, `category_row_id` (the resource ID, for example the transaction ID), `webhook_url_code` (`WHK_...`), `status`, `status_detail`, `response_code`, `trial_count`, `webhook_url`, `event_payload`, `merchant_response_body`, `createdAt`, `updatedAt`. Pasted delivery records are a good timeline source.

### 7. Identifiers

| Field                                                                                                                           | Scope                              | Notes                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference`                                                                                                                     | Transaction (merchant or Paystack) | Shared by initialize, verify, charge, `charge.success`; path parameter of verify. Characters `-`, `.`, `=` and alphanumerics                              |
| `id`                                                                                                                            | Transaction                        | Integer; path parameter of fetch and timeline; dispute `transaction.id`; webhook delivery `category_row_id`                                               |
| `access_code`, `authorization_url`                                                                                              | Checkout session                   | From initialize                                                                                                                                           |
| `authorization.authorization_code` (`AUTH_...`)                                                                                 | Reusable payment authorization     | Used to charge again                                                                                                                                      |
| `authorization.signature` (`SIG_...`)                                                                                           | Card fingerprint-like value        | Same value across charges of one card in the examples; exact meaning **NOT DOCUMENTED**                                                                   |
| `customer.id`, `customer.customer_code` (`CUS_...`)                                                                             | Customer                           |                                                                                                                                                           |
| Refund `id`, `transaction` (ID or object), `transaction_reference`, `refund_reference`                                          | Refund                             | Events carry `transaction_reference` (the original transaction's reference) and `refund_reference` (processor reference, `TRF_...` or numeric, or `null`) |
| Dispute `id`, `transaction`, `transaction_reference`, `merchant_transaction_reference`                                          | Dispute                            | The embedded `transaction.reference` is the link; `transaction_reference` is `null` in examples                                                           |
| Transfer `id`, `transfer_code` (`TRF_...`), `reference`, `request`, `session.id`                                                | Transfer                           | `reference` is the idempotency key for retries (Help Center 9039298); `session.id` is the NIP session for bank tracing                                    |
| `recipient.recipient_code` (`RCP_...`), `recipient.id`                                                                          | Transfer recipient                 |                                                                                                                                                           |
| `plan_code` (`PLN_...`), `subscription_code` (`SUB_...`), `invoice_code` (`INV_...`), `request_code` (`PRQ_...`), `email_token` | Subscriptions and requests         |                                                                                                                                                           |
| Preauthorization `reference` (`pre_...` in examples), `transaction_id`                                                          | Hold and its captured transaction  |                                                                                                                                                           |
| `integration` (integer or object), `merchant_id`                                                                                | Merchant account                   | Mask in output                                                                                                                                            |
| `_id`, `webhook_url_code` (`WHK_...`)                                                                                           | Webhook delivery and endpoint      |                                                                                                                                                           |

`TRF_` is used both for transfer codes and for a refund's `refund_reference` (`refund.failed` example), so the prefix alone does not identify a transfer.

### 8. Sensitive fields

Redact or mask by default (request fields included because request and response pairs get pasted):

- **Secrets and signatures**: `x-paystack-signature` header, `Authorization: Bearer` secret keys (never), public keys, `access_code` and `authorization_url` (live checkout session), `email_token`.
- **Card and payment instrument data**: `authorization_code` (it can be charged again), `signature`, `bin`, `last4`, `exp_month`, `exp_year`, `account_name`, card numbers and CVV in `/charge` requests, `ussd_code`, `display_text` with account numbers.
- **Personal data**: `customer.email`, `first_name`, `last_name`, `phone`, `international_format_phone`, `metadata` and `custom_fields`, `ip_address`, `identification` (`bvn`, `account_number`, `value`), `sender_name`, `sender_bank_account_number`, `narration`.
- **Bank and payout data**: `recipient.details.account_number`, `account_name`, `bank_code`, `bank_name`, generated `account_number` for Pay with Transfer and dedicated accounts, `session.id`, `offline_reference`.
- **Dispute and refund data**: `messages[].body`, `messages[].sender`, `history[].by`, `evidence`, `attachments`, `refunded_by`, `initiated_by`, `merchant_note`, `customer_note`.
- **Merchant data**: `integration`, `merchant_id`, `merchant_name`, `business_name`, `webhook_url`, `merchant_response_body`.

### 9. Structural detection hints

Strong Paystack signals (combine several):

1. **Envelope**: top-level `status` as a JSON **boolean**, `message` string, `data` object or array; errors may add `type` in {`validation_error`, `processor_error`, `api_error`}, `code` and `meta.nextStep`. `meta.nextStep` is very specific.
2. **Transaction object**: `reference` + `gateway_response` + `domain` in {`test`, `live`} + `channel` + integer `amount` in minor units, usually with `log` (`time_spent`, `attempts`, `history[]`) and both `paid_at` and `paidAt`.
3. **ID prefixes**: `AUTH_`, `SIG_`, `CUS_`, `TRF_`, `RCP_`, `PLN_`, `SUB_`, `INV_`, `PRQ_`, `WHK_`. `customer.risk_action` in {`default`, `allow`, `deny`}.
4. **Charge state**: `data.status` in {`send_otp`, `send_pin`, `send_phone`, `send_birthday`, `send_address`, `open_url`, `pay_offline`, `pending_bank_transfer`} with `display_text`.
5. **Webhook**: a body with only `event` and `data`, `event` matching names in section 6.2 (`charge.success`, `transfer.success`, `refund.processed`, `charge.dispute.create` ...), and the `x-paystack-signature` header (128 hex).
6. **Hosts**: `api.paystack.co`, `checkout.paystack.com`, `standard.paystack.co`, `crayon.paystack.co`.
7. **Transfer object**: `transfer_code` + `titan_code` + `failures` + `source` `balance` + `session.provider` (`nip`).

How this differs from other providers:

- **Stripe**: objects carry `object`, IDs like `pi_`, `ch_`, `evt_`, events have `id`, `type`, `created`, `livemode` and `data.object`. Paystack has `event` (not `type`), no event `id`, and `data` is the resource itself.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in Paystack payloads.
- **Checkout.com**: `pay_`/`act_` IDs, `_links`, `response_code`, `approved`; Checkout.com also uses a field named `reference`, so `reference` alone must not decide.
- **PayPal**: `debug_id`, upper-case dotted `event_type`, `resource`, `links[]`. Paystack event names are lower-case and the key is `event`.
- **Braintree, Authorize.net, Cybersource, Worldpay, Square, Mollie**: their markers (`legacyCode`, `transactionResponse`/`messages.resultCode`, `submitTimeUtc`, `outcome`/`eventDetails`, `errors[].category`, `resource` + `_links`) are absent from Paystack payloads (see the research files of those providers).
- **NMI, payabl., Nuvei and the URL-encoded high-risk adapters**: query-string or form payloads; Paystack is JSON only.
- **Flutterwave**: no Flutterwave research exists in this repository yet and its documentation was not examined here, so no claim is made about its fields. Both serve African markets and may share generic words (`status`, `message`, `data`, `event`, `reference`, `charge`). Until the Flutterwave research is done, require Paystack-specific evidence: a **boolean** `status` envelope, `gateway_response`, `domain` `test`/`live`, the `AUTH_`/`CUS_`/`TRF_`/`RCP_` prefixes, `log.history`, `meta.nextStep` or the `x-paystack-signature` header. A top-level string `status` such as `"success"` is not a documented Paystack envelope shape (except the error template in section 10, item 3).

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Unread documentation prose**: `paystack.com/docs` was not readable by script (Cloudflare challenge). The webhook retry schedule, webhook source IPs, the guide's full event list, the API reference's error prose, the meaning of each transfer status and any transfer failure reason list are therefore NOT DOCUMENTED here.
2. **Swapped error schema**: OpenAPI `Error` puts the enum `validation_error`, `processor_error`, `api_error` on `code` and leaves `type` free text, while `TransactionInitializeBadRequestModel` and every example put that enum on `type` and a specific value (`duplicate_reference`) on `code`. Follow the examples.
3. **String `"false"`**: the documented error template (`error-format.js`) shows `"status": "false"` as a string; all real examples use a boolean. Accept both.
4. **HTTP status disagreements**: "Invalid key" is 401 in the OpenAPI spec but keyed `400` with description "400 Invalid" in the transaction examples; product fetch shows "Invalid Key" under 400; the customer fetch example is keyed `401` with description "404 Unauthorized"; the timeline and terminal examples are keyed `400` but described as "404 Not Found"; a bulk transfer duplicate reference error is described as 404.
5. **`meta` vs `metadata`**: the direct debit mandate failure example uses `metadata.nextStep` instead of `meta.nextStep`.
6. **Envelope `status` false with "Charge attempted"**: the charge submit-address `200_failed` example has top-level `status: false`, while other `200_failed` examples have `status: true`. Do not use the envelope to judge the payment.
7. **Capitec Pay requery**: `status: true`, `type: "success"`, `code: "ok"` also for the failed charge; the failure is only in `data.status` and `message`.
8. **Field types vary between examples**: `exp_month`/`exp_year` integers in the mobile money charge example and strings elsewhere; refund event `amount` a string (`"5000"`) in some and an integer in others; `customeridentification.success` `customer_id` a string, `failed` an integer; `metadata` `""`, `0`, `null` or object; preauthorization `transaction.id` a string; preauthorization reserve `gateway_response` an object; dispute `attachments` the string `"[]"`.
9. **Invalid JSON**: the charge submit-address example repeats the key `account_name` in `authorization`.
10. **Contradictory sample values**: the `charge.success` example has `status` `success` but `log.success` `false` and a log that stops at "Authentication Required: pin"; transfer initiate says "Transfer has been queued" with `data.status` `success` and `transferred_at` `null`.
11. **Event lists differ**: `charge.failed` appears only in the catalog and endpoint-create examples; `refund.needs-attention` appears only on the refunds guide; neither is in the webhook guide snippet or the Help Center's event table. `zero_charge_authorization.failed` appears only in a delivery record.
12. **Dispute values outside the enum**: `archived` status and `auto-accepted` resolution appear in examples but not in the enums.
13. **Duplicate timestamp fields**: `paid_at` and `paidAt`, `created_at` and `createdAt` coexist; transfer events switch between `created_at` and `createdAt`.
14. **Mapping of Help Center messages to fields**: not stated. A parser must look in `gateway_response`, `data.message` and top-level `message`.
15. **Typos in live strings**: `Error occured while enrolling you for OTP!`; Help Center row "Refer to Financial Institution' or 'Refer to Financial Institution, Special Condition" has stray quotes.
16. **Spec coverage**: preauthorization, Capitec Pay requery, webhook endpoint and webhook event APIs are in the snippets but not in the OpenAPI spec (spec last pushed 2026-06-09, snippets 2026-10-22).
17. **Sector lists conflict**: "Supported businesses" lists Cryptocurrency, Forex Trading, Betting and Lotteries, while "Ineligible businesses" excludes them in some or all countries.
18. **No numeric codes**: issuer response codes, 3DS result codes and AVS codes are not exposed in any documented payload.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **limited**   | The request-error layer is clear (`type`, `code`, `meta.nextStep`, 37 messages). Payment declines are free text: 111 Help Center rows give meanings and Paystack's own advice, but the field that carries them is not stated, there are no numeric codes, and text matching must tolerate variants. Unknown text must fall back to `unknown`.                                                        |
| **paymentResponses** | **supported** | The transaction object has an OpenAPI schema and many consistent examples (verify, fetch, charge, charge authorization, partial debit) with explicit `status`, `gateway_response`, `reference` and `id`; charge intermediate states are documented with examples for every channel. Type variations (section 10) are easy to tolerate.                                                               |
| **webhookParsing**   | **limited**   | JSON payload examples exist for every core event and the signature recipe is documented. But there is no event ID or timestamp, the retry schedule, ordering and source IPs were not documented in the sources read, some events have no payload example, and field types vary.                                                                                                                      |
| **timeline**         | **limited**   | `created_at`, `paid_at`, `transferred_at`, refund `expected_at`/`refunded_at`, dispute `history[]`, `log.history` (seconds relative to `log.start_time`) and webhook delivery records support a timeline. Refund events carry no timestamp, webhook bodies have no send time, and the transaction status changes after refunds and disputes without a timestamped status history in the transaction. |
| **correlation**      | **supported** | `reference` links initialize, charge, verify and `charge.success`; `id` links fetch, timeline, dispute and webhook delivery records; refunds carry `transaction_reference`; disputes embed the transaction; transfers have `reference` and `transfer_code`. Caveats: `TRF_` prefix shared by transfers and refund references, `transaction_reference` null on disputes.                              |
