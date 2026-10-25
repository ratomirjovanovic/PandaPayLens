# Rapyd (adapter id `rapyd`): provider research

Status: research notes for a parse-only PandaPayLens adapter. Nothing here is a guarantee about live behavior. Everything comes from Rapyd's first-party documentation (`docs.rapyd.net`), Rapyd's own website (`www.rapyd.net`) and the Rapyd-Samples GitHub organization (a verified organization whose website is `docs.rapyd.net`), as published on the verification date. When a point is not documented, the text says **NOT DOCUMENTED**.

- Verification date: **2026-10-25**
- Gate outcome: **documentation_verified**
- Scope: Rapyd Collect payments, refunds and disputes; Rapyd Disburse payouts; Rapyd Wallet transfers between wallets; webhooks for those objects. Issuing, Verify, subscriptions, invoices, orders, virtual accounts, point of sale and the Partner API are out of scope.
- Method: the docs site publishes an index for automated readers at `https://docs.rapyd.net/llms.txt` that links a Markdown sibling (`.md`) of every HTML page. Pages were discovered through that index and downloaded as Markdown. Code tables were extracted mechanically from the Markdown and every code in this file was checked against that extraction, so code values are exact; meanings are paraphrased. Pages on `www.rapyd.net` were downloaded as HTML and read as text. No page carried a "last modified" date; the API Changelog has entries up to October 2026.
- Terminology note: Rapyd calls its stored-value accounts "Rapyd Wallets" or "eWallets" (IDs `ewallet_...`). Payment methods of category `ewallet` are third-party local wallets, a different thing. Rapyd's docs separate "payout" (wallet to an external method), "transfer" (wallet to wallet) and "payment" (external method into a wallet), and so does this file.
- Amounts are decimal values in the major currency unit (for example `40.11`) in the Merchant API. Point-of-sale endpoints differ (the PAX POS refund page uses minor units); they are out of scope.

---

## Summary

| Item                               | Finding                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                            | `documentation_verified` (gate items 1-10 all yes)                                                                                                                                                                                                                                                                                                                                |
| Classification                     | `card_processing`, `acquiring`, `alternative_payment_method`, `wallet`; `gateway` and `orchestration` only partly evidenced (see Classification). Rapyd also offers payouts (Disburse)                                                                                                                                                                                            |
| Documented sectors                 | iGaming and online gambling, CFD and forex trading, crypto exchanges (on-ramp), online travel, e-commerce, marketplaces, creator economy, affiliate and influencer marketing, gig economy, B2B, fintech and financial apps (industry pages). The restricted list adds conditions for gambling, adult, CBD, nutraceuticals, travel and others                                      |
| Documentation access               | **Public** (no login) for guides, the Merchant API Reference, webhook pages, the error catalog and the OpenAPI file. The Client Portal (keys, webhook endpoint setup, reports, dispute handling) needs a login and was not used                                                                                                                                                   |
| API family to implement first      | **Merchant API REST responses** for Payment, Refund and Payout (`status` object + `data` object), then **webhooks** for the same objects (`id` `wh_...`, `type`, `data`, `trigger_operation_id`, `status`, `created_at`, `extended_timestamp`)                                                                                                                                    |
| Documented codes (distinct values) | 495 distinct values in the in-scope tables: 373 string error codes (382 table rows), 104 card network codes (105 rows) and 18 merchant advice codes. Plus 6 sandbox amount ranges                                                                                                                                                                                                 |
| Biggest limitations                | Webhook examples come in four different shapes and many are not valid JSON. Retry schedule, retry count and ordering are not stated on the webhook pages. Some codes appear only in examples, and `error_code` and `response_code` differ in at least one sample although the docs say they are the same. Card network codes `00`, `08` and `11` ("Success") are listed as errors |
| White-label                        | No. Rapyd documents its own API format. It names third-party acquirers and in-country "Network Partners", but merchants receive Rapyd's own JSON                                                                                                                                                                                                                                  |

---

## Sources

All URLs below were read on 2026-10-25. `D` = `https://docs.rapyd.net/en`. Each `D/<page>.md` is the Markdown sibling of `D/<page>.html`.

**Read in full or in the relevant part:**

| URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | What it covers                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| https://docs.rapyd.net/llms.txt                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Page index and a summary of integration rules (envelope, idempotency, webhooks at least once)                            |
| https://docs.rapyd.net/sitemap.xml, https://docs.rapyd.net/robots.txt                                                                                                                                                                                                                                                                                                                                                                                                                | Page discovery only (`robots.txt` returned an HTML error page)                                                           |
| D/error-messages.md                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Response format**: the `status` object, success and error examples                                                     |
| D/rapyd-error-codes.md                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Full error catalog** (all products); in-scope sections extracted mechanically                                          |
| D/payment-method-errors.md, D/payment-errors.md, D/card-transaction-errors.md, D/card-network-errors.md, D/merchant-advice-codes.md, D/bank-transfer-error-messages.md, D/foreign-exchange-errors.md, D/checkout-errors.md, D/hosted-page-errors.md, D/refund-errors.md, D/dispute-errors.md, D/payout-errors.md, D/sender-errors.md, D/beneficiary-errors.md, D/wallet-transaction-errors.md, D/wallet-errors.md, D/general-errors.md, D/simulated-errors.md, D/error-simulation.md | Individual error pages, compared with the catalog                                                                        |
| D/troubleshooting-authentication-and-authorization-errors.md                                                                                                                                                                                                                                                                                                                                                                                                                         | Authentication error codes with HTTP status and samples                                                                  |
| D/create-payment-error-examples.md                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Create Payment errors carry a `data` object with PAYMENT_FAILED webhook data                                             |
| D/payment.md, D/payment-542538.md, D/create-payment.md                                                                                                                                                                                                                                                                                                                                                                                                                               | Payment object, response fields, `status` and `next_action` values, many samples                                         |
| D/refund.md, D/create-refund.md                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Refund object, `status` and `failure_reason` values                                                                      |
| D/dispute.md, D/retrieve-dispute.md, D/card-disputes.md                                                                                                                                                                                                                                                                                                                                                                                                                              | Dispute object and lifecycle                                                                                             |
| D/payout.md, D/create-payout.md, D/set-payout-response.md, D/complete-payout.md, D/simulating-a-payout-returned-status.md                                                                                                                                                                                                                                                                                                                                                            | Payout object, `status` values, sandbox simulation                                                                       |
| D/rapyd-collect.md, D/rapyd-disburse.md, D/rapyd-wallet.md                                                                                                                                                                                                                                                                                                                                                                                                                           | Product overviews; payout versus transfer wording                                                                        |
| D/wallet-transaction.md, D/transfer-funds-between-wallets.md, D/set-transfer-response.md                                                                                                                                                                                                                                                                                                                                                                                             | Wallet transfer object and statuses                                                                                      |
| D/webhook-format.md, D/webhook-security.md, D/webhook-authentication.md, D/defining-a-webhook-endpoint.md                                                                                                                                                                                                                                                                                                                                                                            | **Webhook wrapper**, headers, signature formula, endpoint setup                                                          |
| D/list-webhooks.md, D/retrieve-webhook.md, D/resend-webhook.md                                                                                                                                                                                                                                                                                                                                                                                                                       | Webhook delivery record: `status` NEW/CLO/ERR/RET, `attempts`, `next_attempt_at`                                         |
| D/payment-webhooks.md, D/payment-succeeded-webhook.md, D/payment-completed-webhook.md, D/payment-captured-webhook.md, D/payment-failed-webhook.md, D/payment-expired-webhook.md, D/payment-canceled-webhook.md, D/payment-reversed-webhook.md, D/payment-updated-webhook.md                                                                                                                                                                                                          | Payment webhooks                                                                                                         |
| D/refund-webhooks.md, D/refund-completed-webhook.md, D/refund-failed-webhook.md, D/refund-rejected-webhook.md, D/refund-updated-webhook.md                                                                                                                                                                                                                                                                                                                                           | Refund webhooks                                                                                                          |
| D/dispute-webhooks.md, D/dispute-created-webhook.md, D/dispute-updated-webhook.md                                                                                                                                                                                                                                                                                                                                                                                                    | Dispute webhooks                                                                                                         |
| D/payout-webhooks.md, D/payout-created-webhook.md, D/payout-completed-webhook.md, D/payout-failed-webhook.md, D/payout-canceled-webhook.md, D/payout-expired-webhook.md, D/payout-returned-webhook.md, D/payout-updated-webhook.md, D/payout-creation-failed-webhook.md                                                                                                                                                                                                              | Payout webhooks                                                                                                          |
| D/wallet-transaction-webhooks.md, D/transfer-funds-between-wallets-created-webhook.md, D/transfer-funds-between-wallets-response-webhook.md, D/transfer-funds-between-wallets-expired-webhook.md, D/transfer-funds-webhook.md, D/transfer-completed-webhook.md, D/transfer-request-webhook.md, D/transfer-request-updated-webhook.md, D/funds-added-webhook.md, D/funds-removed-webhook.md, D/ewallet-transfer-credited-webhook.md, D/ewallet-transfer-debited-webhook.md            | Wallet transaction webhooks                                                                                              |
| D/header-parameters.md, D/request-signatures.md, D/rest-message-security.md, D/idempotency.md, D/request-rate-limits.md, D/environments.md, D/versioning-for-api-methods.md                                                                                                                                                                                                                                                                                                          | Headers, request signature, idempotency (24 hours), rate limits, environments, dated versions                            |
| D/testing-for-payment-api.md, D/testing-for-payout-api.md, D/card-numbers-for-testing.md                                                                                                                                                                                                                                                                                                                                                                                             | Sandbox behavior and test cards                                                                                          |
| D/api-changelog.md, D/code-samples.md, D/developers.md, D/webhooks.md, D/webhook-solution.md, D/merchant-api-reference.md                                                                                                                                                                                                                                                                                                                                                            | Activity check and page structure (`webhooks.md` turned out to cover communication threads, not payment webhooks)        |
| https://www.rapyd.net/ and https://www.rapyd.net/sitemap_index.xml (page sitemap lastmod 2026-10-25)                                                                                                                                                                                                                                                                                                                                                                                 | Company site, activity check                                                                                             |
| https://www.rapyd.net/company/about-rapyd/                                                                                                                                                                                                                                                                                                                                                                                                                                           | Company description                                                                                                      |
| https://www.rapyd.net/solutions/industries/ and its pages `gaming/`, `crypto/`, `trading/`, `travel/`, `ecommerce/`, `marketplaces/`, `creator-economy/`, `affiliate/`, `gig-economy-payments/`, `finance/`, `b2b/`                                                                                                                                                                                                                                                                  | Sectors in Rapyd's own words                                                                                             |
| https://www.rapyd.net/security-compliance/restricted-businesses/                                                                                                                                                                                                                                                                                                                                                                                                                     | Global Prohibited and Restricted Businesses, effective June 10, 2026                                                     |
| https://www.rapyd.net/security-compliance/regulatory-framework/                                                                                                                                                                                                                                                                                                                                                                                                                      | Regulated entities and licences                                                                                          |
| https://github.com/Rapyd-Samples (organization metadata: verified, website `docs.rapyd.net`) and its repository list                                                                                                                                                                                                                                                                                                                                                                 | Official samples organization                                                                                            |
| https://github.com/Rapyd-Samples/RapydOpenAPI (`readme.md`, `rapyd-openapi.yaml` version 1.0.23, last push 2025-08-14)                                                                                                                                                                                                                                                                                                                                                               | "Official repository" of the OpenAPI specification: `Status` schema, 400/401 examples, dispute and transfer status enums |
| https://github.com/Rapyd-Samples/Rapyd-Python-SDK (file tree only)                                                                                                                                                                                                                                                                                                                                                                                                                   | Python SDK repository; not used as evidence                                                                              |

**Downloaded and scanned mechanically** (searched for error codes, status values and identifier shapes, not read line by line): D/update-payment.md, D/capture-payment.md, D/cancel-payment.md, D/retrieve-payment.md, D/list-payments.md, D/complete-refund.md, D/cancel-refund.md, D/retrieve-payout.md, D/cancel-payout.md, D/glossary.md, D/product-guide.md, D/developer-resources.md, D/payment-completed-webhook-365172.md (point-of-sale), D/refund-427483.md and D/refund-542749.md (point-of-sale), D/dispute-542759.md, D/wallet-transaction-542960.md, D/transaction-status-messages.md (point-of-sale).

Not read: the Partner API reference, Issuing, Verify, subscription and invoice pages, the Connectors section added in October 2026, "Capture a Payment When Authorization Expires", the 3DS how-to pages, the escrow and group payment pages. Facts that would come only from those pages are marked **NOT DOCUMENTED** here. The GitHub repository `Rapyd-Samples/unofficial-rapyd-node-sdk` calls itself unofficial and was not used; the organization `Rapyd-Payments` on GitHub is not verified and was not used.

---

## Qualification gate

| #   | Item                             | Answer | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Company/product active           | yes    | www.rapyd.net home page "One solution to accept, send and manage funds globally"; its page sitemap shows `lastmod` 2026-10-25. The restricted-businesses list is "Effective from June 10, 2026"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | Payment service operational      | yes    | D/api-changelog.md lists API changes in October 2026 (for example "Added **holder_id** to the `custom_elements.required_customer_fields` parameter" of Create Checkout Page). D/environments.md gives production `https://api.rapyd.net` and sandbox `https://sandboxapi.rapyd.net`                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3   | Docs publicly accessible         | yes    | All Merchant API reference pages, error pages and webhook pages load without login, as HTML and as Markdown. The Client Portal (API keys, webhook URL and event selection, dispute evidence, reports) needs a login; it was not used                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | API families/versions identified | yes    | Merchant API REST under `/v1/...` (for example `/v1/payments`, `/v1/refunds`, `/v1/payouts`, `/v1/webhooks/:webhook`); optional dated versions through the `api_version` header (`yyyy-mm-dd`, D/versioning-for-api-methods.md); OpenAPI file version 1.0.23; webhooks; Partner API and POS APIs (out of scope)                                                                                                                                                                                                                                                                                                                                                                                    |
| 5   | Offline-examinable formats       | yes    | Every method page has JSON response samples, many with 400 samples; every in-scope webhook page has a JSON sample and a field table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | Sectors documented               | yes    | Industry pages and the restricted list (see Classification)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | Regional/regulatory limits       | yes    | Regulatory framework page: Rapyd Europe hf. (EMI, Central Bank of Iceland), Rapyd Payments Limited (EMI, FCA, licence 900688), Rapyd HK Limited (Money Service Operator and Money Lenders licences), Rapyd HK Asia Limited (Trust or Company Service Providers licence), Rapyd Holding Pte. Ltd. (Major Payment Institution, MAS), Rapyd Payments Israel Ltd. (Payment Services License, ISA), Rapyd Financial Technology US Inc. (MSB, FinCEN). "In the rest of the world, Rapyd provides regulated Services through its selected Network Partners". Docs: methods and required fields depend on country and currency; SEPA mandate, Shva (Israel) and local GBP payout codes are region-specific |
| 8   | Diagnostic value                 | yes    | 495 documented code values with paraphrasable root cause and corrective action, explicit status fields for each object, webhook types for each state change, and an operation ID that links responses to webhooks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9   | Own technical formats            | yes    | Rapyd-specific envelope (`status.error_code`, `status.response_code`, `status.operation_id`), prefixed IDs (`payment_`, `payout_`, `ewallet_`, `wh_`) and webhook wrapper (`trigger_operation_id`, `extended_timestamp`). The glossary mentions "a third-party acquirer partnered with Rapyd", but the merchant always sees Rapyd's format                                                                                                                                                                                                                                                                                                                                                         |
| 10  | No credentials needed to analyse | yes    | All examples and tables are public. Signatures need the secret key, but PandaPayLens does not verify them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Outcome rule: items 1-5, 8, 9, 10 = yes, so **documentation_verified**.

---

## Classification and documented sectors

| Value                        | Evidence                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card_processing`            | Create Payment with card payment method types (`gb_visa_card` and so on), capture, cancel and refund flows (D/create-payment.md, D/capture-payment.md)                                                                                                                                                                                   |
| `acquiring`                  | Industries page: "Licensed Visa and Mastercard acquiring across the UK, Europe, LATAM, Hong Kong, Israel and Singapore. Plus Amex acceptance." Gaming page: "Rapyd is the directly licensed card acquirer". The glossary also defines a third-party acquirer partnered with Rapyd, so not every card payment is acquired by Rapyd itself |
| `alternative_payment_method` | D/rapyd-collect.md: "eWallets, local and international cards, bank transfers, and cash"; Checkout "900+ payment methods". `payment_method_type_category` values `bank_redirect`, `bank_transfer`, `card`, `cash`, `ewallet`, `rapyd_ewallet`                                                                                             |
| `wallet`                     | Rapyd Wallet (D/rapyd-wallet.md: "similar to a bank account"); electronic money institution licences in the EEA and UK (regulatory framework page)                                                                                                                                                                                       |
| `gateway` (partial)          | Rapyd routes to partner acquirers and Network Partners and its error texts speak of "the gateway" (for example ERROR_MULTIPLE_CAPTURES_NOT_SUPPORTED). No page read calls Rapyd itself a gateway in a defining sentence                                                                                                                  |
| `orchestration` (claim only) | Trading page: "direct Visa and Mastercard acquiring, smart routing". No API field for routing decisions was found                                                                                                                                                                                                                        |
| `payment_facilitator`        | Not claimed for Rapyd itself. The API supports PayFac clients (`merchant_ewallet`, "As a Payment Facilitator (PayFac), you can create a card payment ...") and a Partner PayFac guide exists (not read)                                                                                                                                  |
| Not claimed                  | `merchant_account_intermediary`                                                                                                                                                                                                                                                                                                          |

Sectors, in Rapyd's own words. Each one depends on the merchant's jurisdiction, licensing and Rapyd's underwriting; listing a sector here says nothing about approval.

| Sector                             | Source and wording                                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iGaming and online gambling        | https://www.rapyd.net/solutions/industries/gaming/: "NEXT-LEVEL PAYMENTS FOR iGAMING AND ONLINE GAMBLING"; "Payout winnings to gamers instantly". The industries page also says "tailored for iGaming, online gambling, forex, marketplaces, online travel and more" |
| CFD and forex trading              | https://www.rapyd.net/solutions/industries/trading/: "CFD & Forex Payment Solutions"; "native account funding transaction (AFT) classification"                                                                                                                      |
| Crypto exchanges (fiat on-ramp)    | https://www.rapyd.net/solutions/industries/crypto/: "On-Ramp For Crypto Exchanges"                                                                                                                                                                                   |
| Online travel                      | https://www.rapyd.net/solutions/industries/travel/: "Online Travel Payment Processor"                                                                                                                                                                                |
| E-commerce                         | https://www.rapyd.net/solutions/industries/ecommerce/: "eCommerce Credit Card Processing"                                                                                                                                                                            |
| Marketplaces                       | https://www.rapyd.net/solutions/industries/marketplaces/: "Rapyd lets two-sided platforms accept and disburse funds"                                                                                                                                                 |
| Creator economy                    | https://www.rapyd.net/solutions/industries/creator-economy/: "Pay your creators how they want to get paid"                                                                                                                                                           |
| Affiliate and influencer marketing | https://www.rapyd.net/solutions/industries/affiliate/: "Influencer & Affiliate Payment Solutions"                                                                                                                                                                    |
| Gig economy                        | https://www.rapyd.net/solutions/industries/gig-economy-payments/                                                                                                                                                                                                     |
| B2B                                | https://www.rapyd.net/solutions/industries/b2b/                                                                                                                                                                                                                      |
| Fintech and financial apps         | https://www.rapyd.net/solutions/industries/finance/: "develop fintech applications, build banking apps"                                                                                                                                                              |

The Global Prohibited and Restricted Businesses page (https://www.rapyd.net/security-compliance/restricted-businesses/, effective June 10, 2026) narrows these. "Restricted" means "Rapyd will require additional documentation prior to onboarding"; "Prohibited" means the business may not use Rapyd. Points relevant to the sectors above, paraphrased:

- **Gambling and gaming** are restricted: games of skill with cash prizes, virtual world credits, sweepstakes and social gaming, fantasy sports and e-sports, "Gambling providers or transactions including games of chance", contracts for difference, government lotteries, loot boxes. "Illegal or miscoded gambling" is prohibited.
- **Trading**: transactions from unlicensed trading platforms are prohibited, naming binary options, rolling spot forex and financial spread betting. Investment and brokerage services, crypto service providers, prop trading and digital wallets are restricted.
- **Crypto**: NFT platforms, token swap services, privacy coin transactions, crypto mining and ICOs are prohibited; cryptocurrency service providers are restricted.
- **Adult**: some adult content and services are prohibited (listed in detail); adult entertainment, sex toy shops, sexual enhancement products and online dating are restricted.
- **Nutraceuticals**: products with unapproved health claims are prohibited; nutraceuticals also appear under restricted "Others".
- **CBD and cannabis products**, **tobacco**, **pharmaceuticals and telemedicine**, **travel** (airlines, online travel aggregators, agencies), **marketplaces**, **multi-level and affiliate marketing**, **charities and crowdfunding** and several others are restricted.
- Negative option billing and trial continuity merchants are prohibited under "High Pressure Sales".

The payout card codes `OH` and `OI` ("Card not eligible for domestic/cross border gambling transfer", D/card-network-errors.md) show that gambling payouts to cards are a documented use case.

---

## Technical specification

### 1. Sources and verification date

See [Sources](#sources). Verification date 2026-10-25.

### 2. API families and versions in scope

| Family                             | Endpoint(s) / delivery                                                                                                                                                                                                                     | Format                                                       | Relevance                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------- |
| **Merchant API: Collect payments** | `POST /v1/payments` (Create Payment), `POST /v1/payments/:payment` (Update), `POST /v1/payments/:payment/capture`, `DELETE /v1/payments/:payment` (Cancel), `GET /v1/payments/:payment`, `GET /v1/payments`; sandbox-only Complete Payment | JSON request, JSON response: `status` object + `data` object | **Primary.** Card declines, 3DS, local methods |
| **Merchant API: refunds**          | `POST /v1/refunds` and related methods (update, complete in the sandbox, retrieve, list, cancel)                                                                                                                                           | Same envelope                                                | **Primary**                                    |
| **Merchant API: Disburse payouts** | `POST /v1/payouts`, `DELETE /v1/payouts/:payout` (Cancel), `POST /v1/payouts/response` (Set Payout Response) and related methods (confirm FX, update, sandbox complete and return)                                                         | Same envelope                                                | **Primary**                                    |
| Merchant API: disputes             | `GET /v1/disputes/:dispute`, List Disputes (read only; accepting or challenging happens in the Client Portal)                                                                                                                              | Same envelope                                                | Secondary                                      |
| Merchant API: wallet transfers     | `POST /v1/ewallets/transfer`, `POST /v1/ewallets/transfer/response`                                                                                                                                                                        | Same envelope                                                | Secondary                                      |
| Checkout (hosted page)             | Create Checkout Page and related methods                                                                                                                                                                                                   | Same envelope                                                | Secondary (errors only)                        |
| **Webhooks**                       | HTTPS POST to one merchant-defined URL, events selected in the Client Portal                                                                                                                                                               | JSON body; signature in headers                              | **Primary** for asynchronous outcomes          |
| Webhook methods                    | `GET /v1/webhooks`, `GET /v1/webhooks/:webhook`, `POST /v1/webhooks/:webhook` (resend)                                                                                                                                                     | Same envelope, webhook record in `data`                      | Useful: shows delivery attempts                |
| Out of scope                       | Partner API, Issuing, Verify, subscriptions, POS (`X-API-KEY` header, minor units)                                                                                                                                                         | Various                                                      | Separate parsers if ever added                 |

Dated versions: "Some individual API methods have a dated version", selected with the `api_version` header in `yyyy-mm-dd` format; a dated version may change requests, responses, webhooks or behavior (D/versioning-for-api-methods.md). Which methods have dated versions and how they differ is **NOT DOCUMENTED** on the pages read. Pasted payloads do not carry the version.

**Recommendation: implement first** the Merchant API response envelope for Payment, Refund and Payout, because one decoder covers all of them (`status.error_code` plus the object's own status and failure fields) and the error catalog is keyed by `error_code`. Then add the webhook body (same `data` objects plus the wrapper fields) for PAYMENT__, REFUND__ / PAYMENT_REFUND__, PAYOUT__ and PAYMENT_DISPUTE_* types. Wallet transfer webhooks come last because their examples are the least consistent.

### 3. Response and error formats

#### 3.1 Content type, HTTP status and encoding

- **Requests and responses**: JSON; `Content-Type: application/json` is a required request header (D/header-parameters.md).
- **HTTP status**: method pages say "The code samples include successful requests (200) and bad requests (400)" and refer to "unauthorized request (401)". The troubleshooting page gives 401 for UNAUTHORIZED_API_CALL and UNAUTHENTICATED_API_CALL and 400 for ROUTE_PERMISSION_ERROR and MISSING_AUTHENTICATION_HEADERS. The OpenAPI file declares `"400"` and `"401"` responses with the `Status` schema. Rate limiting "may trigger an error response with the `429 Too Many Requests` status code"; the body of a 429 is **NOT DOCUMENTED**. Status codes 5xx are **NOT DOCUMENTED** on the pages read.
- **Character encoding**: **NOT DOCUMENTED**.
- **Numbers**: amounts are decimals in the major unit. The request-signature troubleshooting text says numbers with trailing zeroes break the signature unless sent as strings.

#### 3.2 The `status` object

Every REST response has a `status` object. On success there is also a `data` object; "When the requested operation fails and returns an error, the response has one object: `status`" (D/error-messages.md), with the Create Payment exception in 3.3.

| Field           | Type   | Meaning (from D/error-messages.md and the OpenAPI `Status` schema)                          |
| --------------- | ------ | ------------------------------------------------------------------------------------------- |
| `error_code`    | string | Error code; "Same as response_code"; empty string on success                                |
| `status`        | string | `SUCCESS` or `ERROR` (OpenAPI enum)                                                         |
| `message`       | string | Cause, request status and "Corrective action: ..."; empty on success                        |
| `response_code` | string | Error code; "Same as error_code"; empty on success                                          |
| `operation_id`  | string | UUID; "Operation ID for Rapyd Support"; OpenAPI: "Unique identifier (UUID) of the response" |

Code suffixes inside `error_code` / `response_code`:

- Card network refusals: `ERROR_PROCESSING_CARD - [51]` (base code, space, hyphen, space, network code in square brackets). The `message` then starts with the short network message in brackets: `[Insufficient Funds] The request attempted ...` (D/card-network-errors.md).
- Field names: several codes say the field name is "at the end of the error code" or "at the end of the response_code" (MISSING_PAYMENT_METHOD_REQUIRED_FIELD, INVALID_FIELDS, MISSING_FIELDS, INVALID_REQUIRED_FIELD, the payout `..._FIELDS_LENGTH_ABOVE_MAX [FIELD_NAMES]` codes). The exact separator is documented only by example: `MISSING_PAYOUT_METHOD_REQUIRED_FIELD - [PHONE_NUMBER]` in the PAYOUT_FAILED sample and `ERROR_CHECKOUT_AFT_MISSING_FIELDS_[<FIELD>]` in the checkout table. A parser should strip a trailing ` - [...]` or `_[...]` or ` [...]` before lookup and keep the suffix as detail.
- The rule "Branch on the machine-readable `error_code`, never on the human-readable `message`" appears in llms.txt; the `message` text may change ("updated error message" is a non-breaking change per D/versioning-for-api-methods.md).

#### 3.3 Error responses that also carry `data`

"When a Create Payment request cannot be completed, Rapyd returns an error response and triggers a PAYMENT_FAILED webhook. The error response consists of: A `status` object ... A `data` object, with the data from the PAYMENT_FAILED webhook" (D/create-payment-error-examples.md). So a pasted Create Payment error can hold a full Payment object with `status: "ERR"`.

#### 3.4 Object-level failure fields

| Object          | Fields                                                                                                                                                                                                                                                                                                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payment         | `status` (ACT, CAN, CLO, ERR, EXP, REV), `failure_code`, `failure_message`, `error_code` ("string and number"), `error_message` (Reserved), `cancel_reason`, `next_action`, `merchant_advice_code`, `merchant_advice_message`, `authentication_result` (`eci`, `result`, `version`, `cardholder_info` in a sample), `outcome` (risk assessment), `payment_method_data.acs_check` / `cvv_check` | For card network refusals in webhooks: `error_code` `ERROR_PROCESSING_CARD - [65]`, `failure_code` `65`, `failure_message` the short message. Bank transfer reversals put the reason in `failure_code` / `failure_message` (section 4.8). `cancel_reason` values are **NOT DOCUMENTED** beyond the sample value `insufficient_funds` |
| Refund          | `status` (Pending, Completed, Rejected, Error, Canceled), `failure_reason` (`lost_or_stolen_card`, `expired_or_canceled_card`, `unknown`, empty), `failure_code`                                                                                                                                                                                                                               | Values of `failure_code` are **NOT DOCUMENTED**                                                                                                                                                                                                                                                                                      |
| Payout          | `status` (see section 5.4), `error` ("error code of the last unsuccessful operation"), `gc_error_code` ("Reserved")                                                                                                                                                                                                                                                                            | Samples put the real error into `gc_error_code` and leave `error` null (section 10)                                                                                                                                                                                                                                                  |
| Dispute         | `status` (ACT, RVW, PRA, ARB, LOS, WIN, REV), `dispute_category`, `dispute_reason_description`                                                                                                                                                                                                                                                                                                 | Card scheme reason codes are **NOT DOCUMENTED** as a field                                                                                                                                                                                                                                                                           |
| Wallet transfer | `status` (CAN, CLO, DEC, EXP, HLD, PEN, REJ)                                                                                                                                                                                                                                                                                                                                                   | No failure code field                                                                                                                                                                                                                                                                                                                |

#### 3.5 Examples

Example A: error response. **Transcribed from https://docs.rapyd.net/en/error-messages.md** ("Response Example: Error"):

```json
{
  "status": {
    "error_code": "ERROR_INVALID_EWALLET",
    "status": "ERROR",
    "message": "The request attempted an operation that requires a wallet, but the wallet was not recognized. The request was rejected. Corrective action: Use the ID of a valid wallet, a string starting with 'ewallet_'.",
    "response_code": "ERROR_INVALID_EWALLET",
    "operation_id": "c9ef7f0c-07e0-4c85-9491-5d517920fb04"
  }
}
```

Example B: card network refusal. **Transcribed from https://docs.rapyd.net/en/card-network-errors.md** ("Response Example"):

```json
{
  "status": {
    "error_code": "ERROR_PROCESSING_CARD - [51]",
    "status": "ERROR",
    "message": "[Insufficient Funds] The request attempted a card operation, but the transaction would exceed the card limit. The request was rejected. Corrective action: Advise the cardholder to add funds to the account or use a different payment method.",
    "response_code": "ERROR_PROCESSING_CARD - [51]",
    "operation_id": "625680e5-213e-4357-bfcc-2cd1a488050f"
  }
}
```

Example C: successful refund. **Transcribed from https://docs.rapyd.net/en/create-refund.md** (first 200 sample):

```json
{
  "status": {
    "error_code": "",
    "status": "SUCCESS",
    "message": "",
    "response_code": "",
    "operation_id": "b7c090c5-5cc2-42f3-8bf5-0c53873dfbc7"
  },
  "data": {
    "id": "refund_34d395388fd0bd22f65f74b130fd58b5",
    "amount": 45,
    "payment": "payment_4594996f3e0e752e0de819545c6561ac",
    "currency": "EUR",
    "failure_reason": "",
    "metadata": {},
    "reason": "Merchandise returned",
    "status": "Completed",
    "receipt_number": 0,
    "created_at": 1763547845,
    "updated_at": 1763547845,
    "merchant_ewallet": null,
    "merchant_reference_id": "2025-11-19a",
    "payment_created_at": 1763547805,
    "payment_method_type": "gb_visa_card",
    "ewallets": [
      {
        "ewallet": "ewallet_c1943cfeda5f98247ab117e5d2648861",
        "amount": 45
      }
    ],
    "proportional_refund": true,
    "merchant_debited_amount": null,
    "merchant_debited_currency": null,
    "fx_rate": null,
    "fixed_side": null
  }
}
```

Example D: wallet transfer created, pending. **Transcribed from https://docs.rapyd.net/en/transfer-funds-between-wallets.md** (first 200 sample):

```json
{
  "status": {
    "error_code": "",
    "status": "SUCCESS",
    "message": "",
    "response_code": "",
    "operation_id": "0790e2e3-353d-42f8-9deb-f5cdff86f61c"
  },
  "data": {
    "id": "d2e90d89-60b6-456f-a6a7-5dccf7febf5e",
    "status": "PEN",
    "amount": 5,
    "currency_code": "USD",
    "destination_phone_number": null,
    "destination_ewallet_id": "ewallet_e9e973e1c8b9cd030ce573157702ff78",
    "destination_transaction_id": "",
    "source_ewallet_id": "ewallet_e67c8ad63200d781470a04107fbd7c59",
    "source_transaction_id": "wt_ad5149f340d7147f772dd763bc9af7af",
    "transfer_response_at": 0,
    "created_at": 1704631595,
    "metadata": {
      "merchant_defined": true
    },
    "response_metadata": {},
    "expiration": 0
  }
}
```

The matching TRANSFER_FUNDS_BETWEEN_EWALLETS_CREATED webhook sample on D/transfer-funds-between-wallets-created-webhook.md has `"trigger_operation_id": "0790e2e3-353d-42f8-9deb-f5cdff86f61c"` and the same transfer `id`, which shows how a REST response and its webhook link up.

Example E: PAYMENT_FAILED webhook, excerpt from https://docs.rapyd.net/en/payment-failed-webhook.md. The documented sample has about 100 lines. The excerpt keeps the wrapper and the status, error and identifier fields in their documented order; `...` marks omitted fields. The omitted part contains a payer name, card BIN, last four digits, expiry and a 3DS redirect URL.

```text
{
    "id": "wh_6d0b1efc39424f33556a300434cccc74",
    "type": "PAYMENT_FAILED",
    "data": {
        "id": "payment_02e5ecc4b7e0395148e8eba68ad63120",
        "mid": "mid_5c5d6187ccd4dd5c16142459e8911350",
        "paid": false,
        ...
        "amount": 0,
        ...
        "status": "ERR",
        ...
        "created_at": 1736262161,
        "error_code": "ERROR_PROCESSING_CARD - [65]",
        ...
        "next_action": "not_applicable",
        ...
        "currency_code": "ISK",
        ...
        "transaction_id": "",
        "failure_code": "65",
        "failure_message": "Authentication Required or Activity Limit Exceeded",
        "initiation_type": "customer_present",
        "original_amount": 1065,
        ...
        "authentication_result": {
            "eci": "07",
            "result": "N",
            "version": "2.2.0",
            ...
        },
        ...
        "merchant_advice_code": "02",
        "merchant_advice_message": "Try again later",
        "merchant_ewallet": null,
        "transaction_link_id": "E7iAc-7Sr5Nt7sPs_OX3Xy"
    },
    "trigger_operation_id": "9846cf13-6983-4888-88d4-c0b378dec372",
    "status": "NEW",
    "created_at": 1736262296,
    "extended_timestamp": 1736262296981
}
```

Example F: webhook wrapper, excerpt from https://docs.rapyd.net/en/webhook-format.md ("Example Webhook"). The `signature` header value is omitted here; the `data` object is shortened to its `id`.

```text
{
   "method": "POST",
   "json": true,
   "headers": {
      "Content-Type": "application/json",
      "timestamp": "1575812352",
      "salt": "Oac/iU3wivthSAIvTJdE/A==",
      "signature": "..."
   },
   "uri": "http: //webhook-endpoint.example-client.io",
   "body": {
      "id": "wh_81a54cf977b0b6b3ee57d870e2d6ec4a",
      "type": "CUSTOMER_PAYMENT_METHOD_CREATED",
      "data": { "id": "other_f0fcb1feb6f38434cdb3e697e6158cfa", ... },
      "trigger_operation_id": "0fd3bdc9-de75-4768-bc12-b807582b069c",
      "status": "NEW",
      "created_at": 1575812351,
      "extended_timestamp": 1575812351374
   },
   "timeout": 15000,
   "resolveWithFullResponse": true
}
```

### 4. Codes

Code strings are exactly as documented. "Meaning" is a short paraphrase of Rapyd's message; Rapyd's "Corrective action" is reflected where it decides the retry class. Category and retry columns are **suggestions** for PandaPayLens, not Rapyd statements. Unknown codes must fall back to `unknown`.

General notes:

- The catalog says "Some error codes are used in different contexts" (D/rapyd-error-codes.md). Nine rows repeat across the in-scope tables (for example ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS in payment, refund and general errors; INVALID_EXPIRATION in payment and FX errors). One code, ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION, has two rows with different meanings in the same table.
- Card network codes (4.6) and merchant advice codes (4.7) are separate namespaces: `01` means "Refer to card issuer" as a network code and "Do not try again" as an advice code. Decode by field (`failure_code` or the bracket suffix versus `merchant_advice_code`).
- The complete catalog page covers about 50 sections and roughly 1,000 rows for all products. Out-of-scope sections (customers, addresses, subscriptions, invoices, orders, escrow, group payments, issuing, verify, virtual accounts, wallet management, reports and others) are not tabulated here.

#### 4.1 General errors (D/general-errors.md): 15 codes

| Code                                         | Meaning (paraphrase)                                               | Category (suggested)    | Retry class (suggested)  |
| -------------------------------------------- | ------------------------------------------------------------------ | ----------------------- | ------------------------ |
| `EMAIL_IS_VERIFIED`                          | Email of the user already verified                                 | duplicate_request       | do_not_retry             |
| `ERROR_AMOUNT_MUST_BE_POSITIVE`              | `amount` is zero or negative                                       | invalid_amount          | do_not_retry             |
| `ERROR_AMOUNT_NOT_VALID`                     | `amount` not valid                                                 | invalid_amount          | do_not_retry             |
| `ERROR_BANK_IDENTIFIER_MISMATCH`             | Bank part of the account number does not match the bank identifier | invalid_request         | customer_action_required |
| `ERROR_CARD_EXPIRED`                         | Card expired                                                       | card_declined           | customer_action_required |
| `ERROR_CARD_NOT_AUTHENTICATED`               | Card ID used before the cardholder finished 3DS                    | authentication_required | customer_action_required |
| `ERROR_DAYS_UNTIL_DUE_NOT_VALID`             | `days_until_due` not a positive integer                            | invalid_request         | do_not_retry             |
| `ERROR_DUPLICATE_TRANSACTION`                | Same action already performed and completed                        | duplicate_request       | do_not_retry             |
| `ERROR_LIST_PAYMENTS_PAYOUTS_QUERY_MISMATCH` | Incompatible list query parameters                                 | invalid_request         | do_not_retry             |
| `ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS`     | List query date range longer than 90 days                          | invalid_request         | do_not_retry             |
| `ERROR_STATEMENT_DESCRIPTOR_TOO_LONG`        | `statement_descriptor` longer than 22 characters                   | invalid_request         | do_not_retry             |
| `GENERAL_ERROR`                              | No detail; contact Rapyd support                                   | unknown                 | manual_review            |
| `IDEMPOTENCY_ERROR`                          | `idempotency` value reused from an earlier request                 | duplicate_request       | do_not_retry             |
| `INVALID_FIELDS`                             | A field value is not valid; field name appended                    | invalid_request         | do_not_retry             |
| `MISSING_FIELDS`                             | Required fields missing; names appended                            | invalid_request         | do_not_retry             |

#### 4.2 Authentication and platform errors (D/troubleshooting-authentication-and-authorization-errors.md): 4 codes

These four are not in the in-scope catalog sections. MISSING_AUTHENTICATION_HEADERS and UNAUTHENTICATED_API_CALL also appear in the catalog under Reconciliation Report Errors; UNAUTHORIZED_API_CALL and ROUTE_PERMISSION_ERROR appear only on the troubleshooting page.

| Code                             | Meaning (paraphrase)                                                                                                                      | Category (suggested) | Retry class (suggested) |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------- |
| `UNAUTHORIZED_API_CALL`          | HTTP 401. Wrong path or HTTP method, object not in this environment or account, or feature not enabled. The sample has an empty `message` | configuration        | do_not_retry            |
| `ROUTE_PERMISSION_ERROR`         | HTTP 400. Route permission problem: wrong keys or feature not configured                                                                  | configuration        | do_not_retry            |
| `MISSING_AUTHENTICATION_HEADERS` | HTTP 400. `access_key`, `salt`, `timestamp` or `signature` missing, or `timestamp` not numeric                                            | configuration        | do_not_retry            |
| `UNAUTHENTICATED_API_CALL`       | HTTP 401. Access key wrong, changed or account deactivated; or signature mismatch (same code, different `message`)                        | configuration        | do_not_retry            |

#### 4.3 Payment method errors (D/payment-method-errors.md): 11 codes

| Code                                     | Meaning (paraphrase)                                                                             | Category (suggested)       | Retry class (suggested)  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `ERROR_GET_PAYMENT_METHOD_TYPE`          | Payment method type unknown or not enabled for this merchant                                     | configuration              | do_not_retry             |
| `ERROR_PAYMENT_METHOD_EXPIRED`           | Stored payment method has expired; use another one or refresh it                                 | payment_method_unavailable | customer_action_required |
| `ERROR_UPDATE_CARD_CVV_NOT_UPDATABLE`    | Request tried to change the CVV of a saved card, which is not allowed                            | invalid_request            | do_not_retry             |
| `ERROR_UPDATE_PAYMENT_METHOD`            | Payment method update had missing or wrong fields                                                | invalid_request            | do_not_retry             |
| `INVALID_CARD_EXPIRATION_DATE`           | Card expiry month or year is not valid                                                           | invalid_request            | customer_action_required |
| `INVALID_PAYMENT_METHOD`                 | Payment method ID or object not found                                                            | invalid_request            | do_not_retry             |
| `INVALID_PAYMENT_METHOD_TYPE`            | Payment method type not recognized                                                               | invalid_request            | do_not_retry             |
| `INVALID_REQUIRED_PAYMENT_METHOD_FIELDS` | Required fields of the payment method are missing                                                | invalid_request            | do_not_retry             |
| `MISSING_PAYMENT_METHOD_REQUIRED_FIELD`  | A required payment method field is missing or invalid; the field name is appended to the code    | invalid_request            | do_not_retry             |
| `PAYMENT_METHOD_FIELD_NOT_UPDATABLE`     | Tried to change a payment method field that does not exist or cannot change; field name appended | invalid_request            | do_not_retry             |
| `UNKNOWN_PAYMENT_METHOD_FIELD`           | Unexpected extra field inside `fields`; field name appended                                      | invalid_request            | do_not_retry             |

#### 4.4 Payment errors (D/payment-errors.md): 112 rows, 111 distinct codes

| Code                                                                  | Meaning (paraphrase)                                                                                   | Category (suggested)       | Retry class (suggested)  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------ |
| `CREATE_PAYMENT_APPLE_PAY_MISSING_FIELDS`                             | Decrypted Apple Pay data lacks required fields (listed at the end of the code)                         | invalid_request            | do_not_retry             |
| `ERROR_3DS_AUTHENTICATION_FAILURE`                                    | 3DS authentication failed; Rapyd suggests a retry, then another card or the issuer                     | authentication_failed      | customer_action_required |
| `ERROR_3DS_VERIFICATION_IS_NOT_SUPPORTED`                             | 3DS was requested for a payment method that has no 3DS                                                 | invalid_request            | do_not_retry             |
| `ERROR_ACCOUNT_FUNDING_TRANSACTION`                                   | Account funding transaction (AFT) not enabled for the organization                                     | configuration              | do_not_retry             |
| `ERROR_ADJUSTABLE_AMOUNT_NOT_SUPPORTED`                               | Payment method does not allow changing the amount                                                      | invalid_request            | do_not_retry             |
| `ERROR_AUTH_ONLY_IS_NOT_SUPPORTED`                                    | Authorization without capture is not available for this method type                                    | invalid_request            | do_not_retry             |
| `ERROR_AUTHENTICATION_PHONE_UNAVAILABLE`                              | SEPA mandate step could not reach the account holder's phone; payment reversed, new mandate needed     | authentication_failed      | customer_action_required |
| `ERROR_CANCEL_PAYMENT`                                                | Cancel failed: payment missing or already closed                                                       | invalid_request            | do_not_retry             |
| `ERROR_CAPTURE_PAYMENT`                                               | Capture failed: payment not found, closed, or bad parameters                                           | invalid_request            | do_not_retry             |
| `ERROR_CAPTURE_PAYMENT_3DS_INCOMPLETE`                                | Capture attempted before the customer finished 3DS                                                     | authentication_required    | customer_action_required |
| `ERROR_CAPTURE_PAYMENT_AMOUNT_EXCEEDS_AUTHORIZATION_AMOUNT`           | Capture amount is larger than the authorized amount                                                    | invalid_amount             | do_not_retry             |
| `ERROR_CAPTURE_PAYMENT_FOR_CARD_METHODS_ONLY`                         | `capture` was set for a non-card method; it must be null there                                         | invalid_request            | do_not_retry             |
| `ERROR_CAPTURE_PAYMENT_LOCKED`                                        | Another capture of the same payment is still running; retry after it ends                              | duplicate_request          | retry_conditionally      |
| `ERROR_CAPTURE_TRUE_FOR_REAUTHORIZING_CARD_PAYMENT`                   | Reauthorization sent with `capture` true; must be false                                                | invalid_request            | do_not_retry             |
| `ERROR_CARD_PAYMENT_REQUIRES_CUSTOMER_INPUT_AND_CUSTOMER_NOT_PRESENT` | Card data needs customer input but `initiation_type` is not customer_present                           | invalid_request            | do_not_retry             |
| `ERROR_CARD_PAYMENT_WITHOUT_CAPTURE_NOT_SUPPORTED`                    | Authorization-only card payment not supported by this method                                           | invalid_request            | do_not_retry             |
| `ERROR_CARD_VALIDATION_CAPTURE_TRUE`                                  | Zero-amount card validation also asked for capture                                                     | invalid_request            | do_not_retry             |
| `ERROR_CARD_VALIDATION_IN_PAYMENT_WITH_ESCROW`                        | Card validation combined with escrow                                                                   | invalid_request            | do_not_retry             |
| `ERROR_CARD_VALIDATION_IN_PAYMENT_WITH_FX`                            | Card validation combined with currency exchange                                                        | invalid_request            | do_not_retry             |
| `ERROR_CARD_VALIDATION_IN_SPLIT_PAYMENT`                              | Card validation combined with a split to several wallets                                               | invalid_request            | do_not_retry             |
| `ERROR_COMPLETE_PAYMENT_CARD_NOT_CAPTURED`                            | Sandbox Complete Payment used on an authorized card payment; Capture Payment is required               | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT`                                                | Payment method given for the new payment was not found                                                 | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_ADDRESS_VERIFICATION_FAILURE`                   | Issuer rejected the billing address (address verification)                                             | card_declined              | customer_action_required |
| `ERROR_CREATE_PAYMENT_AMOUNT_EXCEEDS_MAXIMUM`                         | Amount above the method's `max_amount`                                                                 | invalid_amount             | do_not_retry             |
| `ERROR_CREATE_PAYMENT_AMOUNT_LESS_THAN_MINIMUM`                       | Amount below the method's `min_amount`                                                                 | invalid_amount             | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CAPTURE_FOR_CARD_METHODS_ONLY`                  | `capture` set on a non-card method at creation                                                         | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CAPTURE_NOT_VALID`                              | `capture` is neither true nor false                                                                    | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CARD_NOT_SUPPORTED`                             | Card acquirer does not support this card                                                               | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_CERTIFICATE_MISMATCH`                           | Apple Pay certificate of the merchant does not match                                                   | configuration              | do_not_retry             |
| `ERROR_CREATE_PAYMENT_COMPLETE_PAYMENT_URL_NOT_VALID`                 | `complete_payment_url` missing or invalid                                                              | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CREDIT_AMOUNT_LESS_THAN_MINIMUM`                | Credit payment below the configured minimum                                                            | invalid_amount             | do_not_retry             |
| `ERROR_CREATE_PAYMENT_INSTALLMENT_AMOUNT_LESS_THAN_MINIMUM`           | An installment amount is below the configured minimum                                                  | invalid_amount             | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CURRENCY_MISMATCH`                              | Payment currency not supported by the payment method                                                   | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CURRENCY_NOT_SUPPORTED`                         | Currency unknown or not supported by the method                                                        | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_CUSTOMER_CANCEL`                                | Customer canceled or disputed the transaction                                                          | unknown                    | customer_action_required |
| `ERROR_CREATE_PAYMENT_CUSTOMER_NOT_PRESENT`                           | Recurring, installment or MOTO payment also asked for 3DS                                              | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_DOMESTIC_CARDS_ONLY`                            | Foreign-issued card used with a method that accepts domestic cards only                                | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_ERROR_PAYMENT_URL_NOT_VALID`                    | `error_payment_url` missing or invalid                                                                 | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION`                            | First row: reauthorization requested with `capture` true                                               | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_INSUFFICIENT_FUNDS`                             | Not enough funds for the payment                                                                       | insufficient_funds         | customer_action_required |
| `ERROR_CREATE_PAYMENT_ODFI_CANCEL`                                    | Originating depository institution reversed the transaction                                            | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_PAD_PROBLEM`                                    | Problem with the pre-authorized debit agreement                                                        | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION`                            | Second row: processing issue during a card reauthorization; rerun, then contact support                | provider_unavailable       | retry_conditionally      |
| `ERROR_CREATE_PAYMENT_INVALID_PAYFAC_WALLET_TYPE`                     | `ewallet` is a company wallet and cannot act as a PayFac client wallet                                 | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_INVALID_PAYFAC_MERCHANT_WALLET_TYPE`            | `merchant_ewallet` is not a company wallet                                                             | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_PERCENTAGE_MUST_BE_BETWEEN_0_AND_100`           | Split percentage outside 0-100                                                                         | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_SPLIT_MISSING_AMOUNT_OR_PERCENTAGE`             | Split allocation unclear: give amount for all wallets or percentage for all                            | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYMENT_SOURCE_UNAVAILABLE`                             | Source of funds not available                                                                          | payment_method_unavailable | customer_action_required |
| `ERROR_CRYPTOCURRENCY_PURCHASE_TRANSACTION`                           | Cryptocurrency purchase transactions not enabled for the organization                                  | configuration              | do_not_retry             |
| `ERROR_DIGITAL_WALLET_NOT_SUPPORTED_FOR_GET_SESSION`                  | Digital wallet type does not support retrieving a payment session                                      | invalid_request            | do_not_retry             |
| `ERROR_FEATURE_NOT_ACTIVATED`                                         | Feature not enabled for the organization                                                               | configuration              | do_not_retry             |
| `ERROR_FEES_ONLY_ALLOWED_FOR_EWALLET_TRANSACTIONS`                    | `payment_fees` set on a payment that does not go to a wallet                                           | invalid_request            | do_not_retry             |
| `ERROR_FIAT_FX_NOT_SUPPORTED`                                         | FX on the received currency is not supported                                                           | invalid_request            | do_not_retry             |
| `ERROR_FX_FEE_ONLY_ALLOWED_FOR_FX_TRANSACTIONS`                       | `fx_fee` set on a payment without FX                                                                   | invalid_request            | do_not_retry             |
| `ERROR_GET_AMOUNT_AND_PERCENTAGE`                                     | Split defined by both amount and percentage                                                            | invalid_request            | do_not_retry             |
| `ERROR_GET_PAYMENT`                                                   | Payment to retrieve was not found                                                                      | invalid_request            | do_not_retry             |
| `ERROR_INCREASING_PAYMENT_AMOUNT`                                     | Message says reducing an authorized amount is not supported (the name says increasing; see section 10) | invalid_amount             | do_not_retry             |
| `ERROR_INVALID_EWALLET_AMOUNT`                                        | Split amount for a wallet is not a positive number                                                     | invalid_amount             | do_not_retry             |
| `ERROR_INVALID_EWALLET_PERCENTAGE`                                    | Split percentage for a wallet is not valid                                                             | invalid_request            | do_not_retry             |
| `ERROR_INVALID_FX_FEE_CALC_TYPE`                                      | `fx_fee.calc_type` missing or not gross/net                                                            | invalid_request            | do_not_retry             |
| `ERROR_INVALID_FX_FEE_VALUE`                                          | FX fee value not acceptable (equal to or above the payment amount)                                     | invalid_request            | do_not_retry             |
| `ERROR_INVALID_MERCHANT_EWALLET_STATUS`                               | Sub-merchant wallet is not active (ACT)                                                                | configuration              | do_not_retry             |
| `ERROR_INVALID_NET_FEES`                                              | Total net fees equal or exceed the payment amount                                                      | invalid_amount             | do_not_retry             |
| `ERROR_INVALID_PAYMENT_INITIATION_TYPE`                               | `initiation_type` not recognized                                                                       | invalid_request            | do_not_retry             |
| `ERROR_INVALID_TRANSACTION_FEE_CALC_TYPE`                             | `transaction_fee.calc_type` missing or not gross/net                                                   | invalid_request            | do_not_retry             |
| `ERROR_INVALID_TRANSACTION_FEE_FEE_TYPE`                              | `transaction_fee.fee_type` missing or not percentage/absolute                                          | invalid_request            | do_not_retry             |
| `ERROR_INVALID_TRANSACTION_FEE_VALUE`                                 | Transaction fee negative or not below the payment amount                                               | invalid_amount             | do_not_retry             |
| `ERROR_MISSING_PAYMENT_TOKEN`                                         | Payment ID required but not found                                                                      | invalid_request            | do_not_retry             |
| `ERROR_MULTIPLE_CAPTURES_NOT_SUPPORTED`                               | Second capture on a gateway that allows only one                                                       | invalid_request            | do_not_retry             |
| `ERROR_ORIGINAL_PAYMENT_EXCEEDED`                                     | Amount larger than the referenced original payment                                                     | invalid_amount             | do_not_retry             |
| `ERROR_ORIGINAL_PAYMENT_NOT_FOUND`                                    | `original_payment` missing or not found                                                                | invalid_request            | do_not_retry             |
| `ERROR_PAYER_UNKNOWN`                                                 | Payer could not be identified from the request data                                                    | invalid_request            | customer_action_required |
| `ERROR_PAYMENT_AMOUNT_HAS_TO_BE_POSITIVE`                             | A wallet `amount` in the split is not positive                                                         | invalid_amount             | do_not_retry             |
| `ERROR_PAYMENT_AMOUNT_LESS_THAN_MINIMUM`                              | Amount below the minimum for the method type                                                           | invalid_amount             | do_not_retry             |
| `ERROR_PAYMENT_AMOUNT_NOT_ADJUSTABLE`                                 | Payment was not created as adjustable                                                                  | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_CAN_NOT_BE_CANCELED`                                   | Cancel attempted on a closed payment                                                                   | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_EWALLET_NOT_AN_ARRAY_OR_STRING`                        | `ewallet` is neither a wallet ID string nor an array                                                   | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_FIELD_NAME_NOT_KNOWN`                                  | Unknown field name in `payment_fields`                                                                 | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_FX_INVALID_EXPIRATION`                                 | FX payment needs a valid `expiration`                                                                  | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_INVALID_AMOUNT`                                        | Amount missing or not recognized                                                                       | invalid_amount             | do_not_retry             |
| `ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_FX`                       | Payment method does not support currency exchange                                                      | payment_method_unavailable | do_not_retry             |
| `ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_PAYMENT_CANCELLATION`     | Payment type cannot be canceled; a refund may be possible                                              | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_METHODS_GET`                                           | Payment method does not belong to the given customer                                                   | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_MORE_THAN_TWO_AMOUNT_OR_PERCENTAGE_ARE_MISSING`        | Split allocation missing for wallets                                                                   | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_NOT_FOUND`                                             | Payment ID not found                                                                                   | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_NUMBER_OF_EWALLETS_EXCEEDED`                           | Split across more than 10 wallets                                                                      | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_PERCENT_MUST_BE_BETWEEN_0_TO_100`                      | Split percentage outside 0-100                                                                         | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_PERCENTAGE_HAS_TO_BE_POSITIVE`                         | A wallet `percentage` is not positive                                                                  | invalid_request            | do_not_retry             |
| `ERROR_PAYMENT_SPLIT_AMOUNT_EXCEEDS_PAYMENT_AMOUNT`                   | Sum of wallet amounts exceeds the payment amount                                                       | invalid_amount             | do_not_retry             |
| `ERROR_PAYMENT_SPLIT_EXCEEDED_MAXIMUM_NUMBER_OF_EWALLETS`             | More than 10 wallets in `ewallets`                                                                     | invalid_request            | do_not_retry             |
| `ERROR_PROCESSING_CARD - <code>`                                      | Card network refusal; the network code is appended (section 4.6)                                       | card_declined              | unknown                  |
| `ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS`                              | List query date range longer than 90 days                                                              | invalid_request            | do_not_retry             |
| `ERROR_REAUTHORIZING_CANCELED_CARD_PAYMENT`                           | Reauthorization of a canceled payment                                                                  | invalid_request            | do_not_retry             |
| `ERROR_REAUTHORIZING_CLOSED_PAYMENT`                                  | Reauthorization of a closed payment                                                                    | invalid_request            | do_not_retry             |
| `ERROR_REVERSE_PAYMENT_DISPUTE_IN_PROCESS`                            | Reversal blocked because the payment is under dispute                                                  | invalid_request            | manual_review            |
| `ERROR_SCA_EXEMPTION_DECLINED`                                        | SCA exemption declined; resubmit without the exemption                                                 | authentication_required    | customer_action_required |
| `ERROR_SCA_EXEMPTION_LIMIT_NOT_VALID_OR_CURRENCY_NOT_SUPPORTED`       | SCA exemption limit invalid or currency not eligible                                                   | invalid_request            | do_not_retry             |
| `ERROR_SCA_EXEMPTION_NOT_ENABLED`                                     | SCA exemptions not enabled for the merchant                                                            | configuration              | do_not_retry             |
| `ERROR_SHVA_PAYMENT_OPERATION_NOT_PERMITTED`                          | Operation must be started through the Shva payment arena                                               | configuration              | do_not_retry             |
| `ERROR_SIMULATE_COMPLETE_PAYMENT_CARD_NOT_AUTHENTICATED`              | Sandbox completion of a card payment that still needs simulated 3DS                                    | authentication_required    | customer_action_required |
| `ERROR_SPLIT_PAYMENT_DUPLICATE_EWALLET`                               | Same wallet listed twice in a split                                                                    | invalid_request            | do_not_retry             |
| `ERROR_TRANSACTION_FEE_INVALID_AMOUNT`                                | Transaction fee value not a positive number                                                            | invalid_amount             | do_not_retry             |
| `ERROR_UPDATE_PAYMENT`                                                | Update attempted on a payment whose status is not ACT                                                  | invalid_request            | do_not_retry             |
| `ERROR_UPDATE_PAYMENT_AMOUNT`                                         | Amount increase allowed only for Visa/Mastercard and pre-approved merchants                            | configuration              | do_not_retry             |
| `ERROR_USING_TOKEN`                                                   | Update failed: payment method not found or the payment failed                                          | invalid_request            | manual_review            |
| `INVALID_COMPLETE_PAYMENT_URL`                                        | `complete_payment_url` not valid                                                                       | invalid_request            | do_not_retry             |
| `INVALID_ERROR_PAYMENT_URL`                                           | `error_payment_url` not valid                                                                          | invalid_request            | do_not_retry             |
| `INVALID_EXPIRATION`                                                  | Date missing or invalid (Unix time, not past, at most 1 year ahead)                                    | invalid_request            | do_not_retry             |
| `INVALID_PAYMENT`                                                     | Payment ID not found                                                                                   | invalid_request            | do_not_retry             |
| `MISSING_PAYMENT`                                                     | Payment ID not found                                                                                   | invalid_request            | do_not_retry             |
| `PAYMENT_CAPTURED_BEFORE`                                             | Capture attempted on an already closed payment                                                         | duplicate_request          | do_not_retry             |
| `UNKNOWN_PAYMENT_METHOD_FIELDS`                                       | Unrecognized field in `payment_method.fields`                                                          | invalid_request            | do_not_retry             |

#### 4.5 Card transaction errors (D/card-transaction-errors.md): 13 codes

| Code                                           | Meaning (paraphrase)                                                          | Category (suggested)       | Retry class (suggested)  |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ERROR_CARD_AUTHENTICATION_FAILURE`            | 3DS not completed in time; payment canceled, create a new one                 | authentication_failed      | customer_action_required |
| `ERROR_CARD_CVV_NOT_VALID`                     | CVV well-formed but wrong                                                     | card_declined              | customer_action_required |
| `ERROR_CARD_INFORMATION_NOT_VALID`             | Card data well-formed but not valid                                           | card_declined              | customer_action_required |
| `ERROR_CARD_NOT_SUPPORTED_FOR_ECOMMERCE`       | Card cannot be used for e-commerce                                            | payment_method_unavailable | customer_action_required |
| `ERROR_CARD_NOT_VALID`                         | Card ID not valid; a new card ID is needed                                    | invalid_request            | do_not_retry             |
| `ERROR_CARD_TYPE_DISABLED`                     | Card type disabled for the marketplace                                        | configuration              | do_not_retry             |
| `ERROR_PROCESSING_CARD`                        | Card network error; see section 4.6                                           | card_declined              | unknown                  |
| `ERROR_TRANSACTION_FAILED`                     | Card transaction failed; customer should contact the issuer                   | card_declined              | customer_action_required |
| `ERROR_TRANSACTION_REJECTED_BY_CARD_PROCESSOR` | Processor rejected; includes a Visa/Mastercard numeric code; fix and resubmit | card_declined              | retry_conditionally      |
| `ERROR_TRANSACTION_TYPE_NOT_ALLOWED_BY_SELLER` | Transaction type not allowed by the seller                                    | configuration              | do_not_retry             |
| `ERROR_TRANSACTION_TYPE_NOT_SUPPORTED`         | Transaction type not supported by the card network                            | payment_method_unavailable | customer_action_required |
| `INVALID_CARD_CVV`                             | CVV not recognized                                                            | invalid_request            | customer_action_required |
| `INVALID_CARD_NUMBER`                          | Card number not recognized                                                    | invalid_request            | customer_action_required |

#### 4.6 Card network codes (D/card-network-errors.md): 105 rows, 104 distinct values

Rapyd returns these after `ERROR_PROCESSING_CARD - [` in `error_code` / `response_code`, and alone in the payment's `failure_code` (webhooks and Create Payment error `data`). Some rows carry a scheme qualifier such as `(Mastercard)` or `(Visa)`, or group several codes (`W1, W2, W9`); they are reproduced as printed. The same tables apply to payouts ("See also Card Network Errors" on the payout, sender and beneficiary pages).

Common errors (40 rows):

| Code | Meaning (paraphrase)                                                        | Category (suggested)    | Retry class (suggested)  |
| ---- | --------------------------------------------------------------------------- | ----------------------- | ------------------------ |
| `01` | Issuer refused; customer should contact the issuer or use another method    | card_declined           | customer_action_required |
| `02` | Issuer refused under a special condition                                    | card_declined           | customer_action_required |
| `03` | Problem with the merchant's status                                          | configuration           | manual_review            |
| `04` | Issuer asks to retain the card (no fraud stated)                            | card_declined           | do_not_retry             |
| `05` | Do not honor                                                                | card_declined           | customer_action_required |
| `06` | Failed for an unknown reason; retry, then another method                    | unknown                 | retry_conditionally      |
| `07` | Issuer asks to retain the card; fraud suspected                             | fraud_or_risk           | do_not_retry             |
| `12` | Card not allowed for this transaction type                                  | card_declined           | customer_action_required |
| `13` | Card not enabled online or amount malformed                                 | invalid_amount          | customer_action_required |
| `14` | Issuer does not recognize the card number                                   | invalid_request         | customer_action_required |
| `15` | Card number not valid (invalid issuer)                                      | invalid_request         | customer_action_required |
| `17` | Customer canceled                                                           | unknown                 | customer_action_required |
| `19` | Unknown failure; re-enter and retry                                         | unknown                 | retry_conditionally      |
| `41` | Card reported lost                                                          | fraud_or_risk           | do_not_retry             |
| `42` | Card reported stolen                                                        | fraud_or_risk           | do_not_retry             |
| `43` | Card reported stolen                                                        | fraud_or_risk           | do_not_retry             |
| `46` | Account closed                                                              | card_declined           | customer_action_required |
| `50` | Timeout or invalid password; create a new payment                           | unknown                 | retry_conditionally      |
| `51` | Insufficient funds or over the card limit                                   | insufficient_funds      | customer_action_required |
| `54` | Card expired                                                                | card_declined           | customer_action_required |
| `56` | No record of the card number                                                | invalid_request         | customer_action_required |
| `57` | Transaction not permitted for this cardholder                               | card_declined           | customer_action_required |
| `58` | Transaction not permitted for the acquirer or terminal                      | configuration           | manual_review            |
| `59` | Issuer suspects fraud                                                       | fraud_or_risk           | do_not_retry             |
| `61` | Withdrawal amount limit exceeded                                            | insufficient_funds      | customer_action_required |
| `62` | Card restricted in the merchant's country                                   | card_declined           | customer_action_required |
| `63` | Security feature problem; check the CVV                                     | card_declined           | customer_action_required |
| `65` | 3DS not completed or activity limit exceeded; resubmit with 3DS             | authentication_required | customer_action_required |
| `68` | Issuer response came too late; create a new payment                         | network_or_timeout      | retry_conditionally      |
| `70` | PIN required or customer must contact the issuer                            | authentication_required | customer_action_required |
| `72` | Account not activated                                                       | card_declined           | customer_action_required |
| `75` | Too many wrong PIN entries                                                  | card_declined           | customer_action_required |
| `76` | Visa: previous message not found; Mastercard: destination account not found | invalid_request         | manual_review            |
| `77` | Visa: message data inconsistent; Mastercard: source account not found       | invalid_request         | manual_review            |
| `78` | New card still blocked until first-use unblocking                           | card_declined           | customer_action_required |
| `83` | Security issue or suspected fraud                                           | fraud_or_risk           | do_not_retry             |
| `91` | Issuer or authorization platform unavailable                                | provider_unavailable    | retry_conditionally      |
| `93` | Violation; transaction cannot complete                                      | card_declined           | customer_action_required |
| `94` | Duplicate transmission detected; Rapyd says retry                           | duplicate_request       | retry_conditionally      |
| `96` | Issuer system malfunction                                                   | provider_unavailable    | retry_conditionally      |

Card eligibility for payouts (12 rows):

| Code | Meaning (paraphrase)                                                       | Category (suggested)       | Retry class (suggested)  |
| ---- | -------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `OF` | Card not eligible for domestic money transfer (payout)                     | payment_method_unavailable | customer_action_required |
| `OG` | Card not eligible for cross-border money transfer (payout)                 | payment_method_unavailable | customer_action_required |
| `OH` | Card not eligible for domestic gambling payouts                            | payment_method_unavailable | customer_action_required |
| `OI` | Card not eligible for cross-border gambling payouts                        | payment_method_unavailable | customer_action_required |
| `OJ` | Card not eligible for domestic funds disbursement                          | payment_method_unavailable | customer_action_required |
| `OK` | Card not eligible for cross-border funds disbursement (not a success code) | payment_method_unavailable | customer_action_required |
| `TJ` | Card blocked by the cardholder                                             | card_declined              | customer_action_required |
| `TK` | Card declined by Visa                                                      | card_declined              | customer_action_required |
| `5C` | Payout type blocked or unsupported by the issuer                           | payment_method_unavailable | customer_action_required |
| `O1` | Card type could not be determined from the number                          | invalid_request            | customer_action_required |
| `O2` | Push payouts to American Express are not supported                         | payment_method_unavailable | do_not_retry             |
| `O5` | Primary account number (PAN) not valid                                     | invalid_request            | customer_action_required |

Other errors (53 rows). Rapyd gives all of them one long message: a problem with the transaction, contact the issuing bank with the code at the end of the error code.

| Code              | Meaning (paraphrase)                                                | Category (suggested)       | Retry class (suggested)  |
| ----------------- | ------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `CV`              | Card verification error                                             | card_declined              | customer_action_required |
| `00`              | Short message says success, yet listed as an error (see section 10) | unknown                    | manual_review            |
| `08`              | Short message says success, yet listed as an error (see section 10) | unknown                    | manual_review            |
| `10`              | Partial approval                                                    | unknown                    | manual_review            |
| `11`              | Short message says success, yet listed as an error (see section 10) | unknown                    | manual_review            |
| `1A`              | Additional authentication required                                  | authentication_required    | customer_action_required |
| `21`              | No action taken                                                     | unknown                    | manual_review            |
| `25`              | Record not found in file                                            | invalid_request            | manual_review            |
| `28`              | File temporarily unavailable                                        | provider_unavailable       | retry_conditionally      |
| `30`              | Format error                                                        | invalid_request            | manual_review            |
| `39`              | No credit account                                                   | card_declined              | customer_action_required |
| `3X`              | Additional authentication required                                  | authentication_required    | customer_action_required |
| `52`              | Checking account not found                                          | card_declined              | customer_action_required |
| `53`              | Savings account not found                                           | card_declined              | customer_action_required |
| `55`              | PIN not valid                                                       | authentication_failed      | customer_action_required |
| `64`              | AML requirements not met                                            | fraud_or_risk              | manual_review            |
| `6P`              | Customer ID verification failed                                     | authentication_failed      | customer_action_required |
| `71 (Mastercard)` | PIN not changed                                                     | card_declined              | manual_review            |
| `74`              | Encryption error                                                    | unknown                    | manual_review            |
| `76`              | Unsolicited reversal (second row for code 76)                       | unknown                    | manual_review            |
| `79`              | Already reversed by the switch                                      | duplicate_request          | do_not_retry             |
| `80`              | Credit issuer unavailable                                           | provider_unavailable       | retry_conditionally      |
| `81`              | Cryptographic error in PIN                                          | authentication_failed      | manual_review            |
| `81 (Mastercard)` | Domestic debit transaction not allowed                              | payment_method_unavailable | customer_action_required |
| `82`              | Negative CAM, dCVV, iCVV or CVV result                              | card_declined              | customer_action_required |
| `82 (Mastercard)` | Policy issue                                                        | card_declined              | manual_review            |
| `84 (Mastercard)` | Invalid authorization life cycle                                    | invalid_request            | manual_review            |
| `85 (Visa)`       | No reason to decline an account, address or CVV2 verification       | unknown                    | manual_review            |
| `86`              | PIN not validated                                                   | authentication_failed      | customer_action_required |
| `87 (Mastercard)` | Purchase amount only, no cash back                                  | invalid_request            | do_not_retry             |
| `88 (Mastercard)` | Cryptographic failure                                               | unknown                    | manual_review            |
| `89`              | Not eligible to receive financial position information              | unknown                    | manual_review            |
| `92`              | Transaction cannot be routed                                        | provider_unavailable       | retry_conditionally      |
| `B1`              | Surcharge amount not permitted                                      | invalid_amount             | do_not_retry             |
| `B2`              | Surcharge amount not supported                                      | invalid_amount             | do_not_retry             |
| `N0`              | Force STIP (stand-in processing)                                    | unknown                    | manual_review            |
| `N3`              | Cash service not available                                          | payment_method_unavailable | do_not_retry             |
| `N4`              | Cash request exceeds limit                                          | invalid_amount             | customer_action_required |
| `N5`              | Ineligible for resubmission                                         | card_declined              | do_not_retry             |
| `N7`              | CVV2 failure                                                        | card_declined              | customer_action_required |
| `N8`              | Transaction exceeds the authorized amount                           | invalid_amount             | do_not_retry             |
| `P2 (Visa)`       | Invalid biller information                                          | invalid_request            | manual_review            |
| `P5`              | PIN change declined                                                 | card_declined              | manual_review            |
| `P6`              | Requested PIN not safe                                              | card_declined              | manual_review            |
| `Q1`              | Card authentication failed                                          | authentication_failed      | customer_action_required |
| `R0`              | Customer requested stop payment                                     | card_declined              | do_not_retry             |
| `R1`              | Customer revoked authorization                                      | card_declined              | do_not_retry             |
| `R2`              | Transaction does not qualify for Visa PIN                           | card_declined              | manual_review            |
| `R3`              | All authorizations revoked                                          | card_declined              | do_not_retry             |
| `W1, W2, W9`      | Error connecting to the bank                                        | network_or_timeout         | retry_conditionally      |
| `XA, XD (Visa)`   | Forward to issuer                                                   | card_declined              | customer_action_required |
| `Z1`              | Offline declined                                                    | card_declined              | customer_action_required |
| `Z3`              | Unable to go online                                                 | network_or_timeout         | retry_conditionally      |

#### 4.7 Merchant advice codes (D/merchant-advice-codes.md): 18 codes

Returned in `merchant_advice_code` with text in `merchant_advice_message`. Rapyd: "Use merchant advice codes in conjunction with card network response codes to determine future actions." For successful payments they may describe reuse limits (codes 15 and 16).

| Code | Meaning (paraphrase)                                   | Category (suggested)    | Retry class (suggested)  |
| ---- | ------------------------------------------------------ | ----------------------- | ------------------------ |
| `01` | Do not try again                                       | card_declined           | do_not_retry             |
| `02` | Try again later                                        | card_declined           | retry_conditionally      |
| `03` | Update account information                             | card_declined           | customer_action_required |
| `04` | Retry with authentication                              | authentication_required | customer_action_required |
| `05` | Suspected fraud; do not retry                          | fraud_or_risk           | do_not_retry             |
| `06` | Payment cancellation; do not retry                     | card_declined           | do_not_retry             |
| `07` | Merchant does not qualify for the product code         | configuration           | do_not_retry             |
| `08` | Retry after 1 hour                                     | card_declined           | retry_conditionally      |
| `09` | Retry after 24 hours                                   | card_declined           | retry_conditionally      |
| `10` | Retry after 2 days                                     | card_declined           | retry_conditionally      |
| `11` | Retry after 4 days                                     | card_declined           | retry_conditionally      |
| `12` | Retry after 6 days                                     | card_declined           | retry_conditionally      |
| `13` | Retry after 8 days                                     | card_declined           | retry_conditionally      |
| `14` | Retry after 10 days                                    | card_declined           | retry_conditionally      |
| `15` | Informational: consumer non-reloadable prepaid card    | unknown                 | unknown                  |
| `16` | Informational: consumer single-use virtual card number | unknown                 | unknown                  |
| `17` | Token requirements not met for this token type         | invalid_request         | do_not_retry             |
| `18` | Negotiated value not approved                          | unknown                 | manual_review            |

#### 4.8 Bank transfer reversal codes (D/bank-transfer-error-messages.md): 8 codes

Sent in `failure_code` / `failure_message` of the PAYMENT_REVERSED webhook. Two codes are printed with a space inside the name; a parser should also accept the spelling without the space.

| Code                                                                     | Meaning (paraphrase)                                                         | Category (suggested)       | Retry class (suggested)  |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ERROR_CREATE_PAYMENT_ACCOUNT_UNAVAILABLE`                               | Source account of the funds is closed                                        | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_BANK _TRANSFER_MANDATE_INCOMPLETE`                 | Mandate data incomplete; create a new mandate (code printed with a space)    | invalid_request            | customer_action_required |
| `ERROR_CREATE_PAYMENT_CONTACT_BANK`                                      | Problem with the source of funds; payer should contact the bank              | payment_method_unavailable | customer_action_required |
| `ERROR_CREATE_PAYMENT_CUSTOMER_DISPUTE`                                  | Customer disputed the payment; it was reversed                               | unknown                    | manual_review            |
| `ERROR_CREATE_PAYMENT_INSUFFICIENT_FUNDS`                                | Insufficient funds                                                           | insufficient_funds         | customer_action_required |
| `ERROR_CREATE_PAYMENT_MANDATE_NOT_VALID`                                 | SEPA mandate not valid                                                       | invalid_request            | customer_action_required |
| `ERROR_CREATE_PAYMENT_PAYER_DECEASED`                                    | Institution reports the payer as deceased                                    | payment_method_unavailable | do_not_retry             |
| `ERROR_CREATE_PAYMENT_TRANSACTION_NOT _ALLOWED_FOR_THIS_TYPE_OF_ACCOUNT` | Account type cannot be used for this transaction (code printed with a space) | payment_method_unavailable | customer_action_required |

#### 4.9 Foreign exchange errors (D/foreign-exchange-errors.md): 10 codes

| Code                                                        | Meaning (paraphrase)                                    | Category (suggested) | Retry class (suggested) |
| ----------------------------------------------------------- | ------------------------------------------------------- | -------------------- | ----------------------- |
| `ERROR_CONVERT_CURRENCY_DAILY_LIMIT_REACHED`                | Daily wallet conversion limit reached; try the next day | rate_limiting        | retry_conditionally     |
| `ERROR_CURRENCY_PAIR_NOT_VALID`                             | Currency pair cannot be converted                       | configuration        | do_not_retry            |
| `ERROR_DIFFERENT_CURRENCY_REQUIRED`                         | Buy and sell currency are the same                      | invalid_request      | do_not_retry            |
| `ERROR_GET_FX_RATE`                                         | Rate for a currency not found; try later                | provider_unavailable | retry_conditionally     |
| `ERROR_GET_RATE`                                            | Rate for a currency not found; try later                | provider_unavailable | retry_conditionally     |
| `ERROR_HOSTED_PAGE_FX_FEE_ONLY_ALLOWED_FOR_FX_TRANSACTIONS` | FX fee set on a hosted page payment without FX          | invalid_request      | do_not_retry            |
| `ERROR_INVALID_QUOTE_ID`                                    | FX quote not found                                      | invalid_request      | do_not_retry            |
| `ERROR_PROCESSING_CONVERSION`                               | FX quote already used; get a new one                    | duplicate_request    | do_not_retry            |
| `INVALID_EXPIRATION`                                        | Forward date missing or invalid                         | invalid_request      | do_not_retry            |
| `INVALID_SOURCE_CURRENCY`                                   | Sell currency not recognized                            | invalid_request      | do_not_retry            |

#### 4.10 Checkout errors (D/checkout-errors.md): 35 codes

| Code                                                                               | Meaning (paraphrase)                                                          | Category (suggested)       | Retry class (suggested) |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- | ----------------------- |
| `ERROR_ACCOUNT_FUNDING_TRANSACTION`                                                | AFT not enabled for the organization                                          | configuration              | do_not_retry            |
| `ERROR_CHECKOUT_AFT_MISSING_FIELDS_[<FIELD>]`                                      | Customer-to-customer AFT checkout lacks fields (listed at the end)            | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_AFT_WITH_MULTIPLE_WALLETS`                                         | AFT checkout with more than one wallet                                        | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_AFT_WITHOUT_PURPOSE_CODE`                                          | AFT checkout without `purpose_code`                                           | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_COUNTRY_CURRENCY_MISMATCH`                                         | No payment method for this country and currency                               | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_CURRENCY_COUNTRY_MISMATCH`                                         | Same meaning as the previous code under a different name                      | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_CUSTOMER_MISSING_FOR_RECURRING_OR_INSTALLMENT_RECURRENCE_TYPE`     | Recurring or installment checkout without `customer`                          | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_PAGE_DELAYED_CAPTURE_NO_REMAINING_SUPPORTING_CARDS`                | Method filters left no card method that supports delayed capture              | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_PAGE_DELAYED_CAPTURE_NO_SUPPORTING_CARDS`                          | No card method in the country supports delayed capture                        | payment_method_unavailable | do_not_retry            |
| `ERROR_CHECKOUT_PAGE_PAYMENT_METHOD_TYPE_CATEGORIES_VALUE_NOT_VALID`               | Bad value in `payment_method_type_categories`                                 | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_PAGE_REQUIRED_CUSTOMER_FIELDS_NOT_VALID`                           | Bad value in `required_customer_fields`                                       | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_PAYMENT_METHOD_CATEGORY_CURRENCY_MISMATCH`                         | A method category has no method for the country and currency                  | invalid_request            | do_not_retry            |
| `ERROR_CHECKOUT_PAYMENT_METHOD_CURRENCY_MISMATCH`                                  | Payment method not recognized for the country                                 | invalid_request            | do_not_retry            |
| `ERROR_CREATE_CHECKOUT_AMOUNT_OUT_OF_RANGE`                                        | Amount out of range for all available methods                                 | invalid_amount             | do_not_retry            |
| `ERROR_DIGITAL_WALLETS_ONLY_NOT_ENABLED`                                           | Digital-wallets-only mode not enabled                                         | configuration              | do_not_retry            |
| `ERROR_HOSTED_PAGE_AMOUNT_MISMATCH`                                                | `amount` differs from the `cart_items` total                                  | invalid_amount             | do_not_retry            |
| `ERROR_HOSTED_PAGE_CONFLICTING_PAYMENT_METHOD_TYPES`                               | Several ways of choosing payment methods given at once                        | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_FX_FEE_VALUE_NOT_VALID`                                         | FX fee value not valid                                                        | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_GET_CUSTOMER`                                                   | Customer not found                                                            | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_COUNTRY`                                                | Country not recognized                                                        | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_EXPORT_TYPE`                                            | Follow-up message type is not email or text                                   | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_CUSTOM_ELEMENTS`                                        | Error in `custom_elements`                                                    | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE`                                    | Payment method not recognized for the country                                 | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE_AND_PAYMENT_METHOD_TYPE_CATEGORIES` | Both a method type and method categories given                                | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_PAYMENT_METHOD_TYPE_CATEGORIES`                         | Bad value in `payment_method_type_categories`                                 | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_STATUS`                                                 | Checkout page already paid                                                    | duplicate_request          | do_not_retry            |
| `ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_CATEGORIES_NOT_ENABLED`                     | A method category is not enabled                                              | configuration              | do_not_retry            |
| `ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_NOT_AVAILABLE`                              | Method type not available to the organization or not existing                 | configuration              | do_not_retry            |
| `ERROR_HOSTED_PAGE_PAYMENT_METHOD_TYPE_NOT_TOKENIZABLE`                            | Method type does not support tokenization                                     | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNREADABLE_PAYMENT_METHOD_TYPES_EXCLUDE_LIST`                   | Exclude list not readable                                                     | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNREADABLE_PAYMENT_METHOD_TYPES_INCLUDE_LIST`                   | Include list not readable                                                     | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNRECOGNIZED_PAYMENT_METHOD_TYPE`                               | Method type unavailable or non-existent                                       | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNRECOGNIZED_PAYMENT_METHOD_TYPES_TO_INCLUDE`                   | Types in the include list not recognized (text refers to payout method types) | invalid_request            | do_not_retry            |
| `ERROR_NOT_AFT_METHOD`                                                             | A listed method does not support AFT wallet funding                           | invalid_request            | do_not_retry            |
| `INVALID_DISCOUNT_PERCENT_AND_AMOUNT_OFF`                                          | Discount type unclear: set percent off or amount off                          | invalid_request            | do_not_retry            |

#### 4.11 Hosted page errors (D/hosted-page-errors.md): 13 codes

| Code                                                             | Meaning (paraphrase)                                     | Category (suggested)       | Retry class (suggested) |
| ---------------------------------------------------------------- | -------------------------------------------------------- | -------------------------- | ----------------------- |
| `ERROR_GET_HOSTED_PAGE_PAYMENT`                                  | Hosted page not found                                    | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_COLLECT_CARD_CUSTOMER_NOT_FOUND`              | Customer for the hosted card page not found              | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_COUNTRY_CURRENCY_MISMATCH`                    | No payment method for the country and currency           | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_CURRENCY_MISSING_WHEN_AMOUNT_IS_NOT_EDITABLE` | Fixed-amount page without a currency                     | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_FIXED_AMOUNT_NOT_FOUND`                       | Fixed-amount page without an amount                      | invalid_amount             | do_not_retry            |
| `ERROR_HOSTED_PAGE_GET_PAYMENT_METHOD`                           | Payment method not found                                 | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_CURRENCY`                             | Currency not recognized                                  | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_CUSTOM_ELEMENTS`                      | Error in `custom_elements`                               | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_INVALID_PAGE_EXPIRATION`                      | `page_expiration` not between 1 minute and 30 days ahead | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_MISSING_CUSTOMER`                             | Customer not found                                       | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_NO_SUPPORTED_PAYOUT_METHOD_TYPES`             | No payout method type fits the given attributes          | payment_method_unavailable | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNREADABLE_PAYOUT_METHOD_TYPES_INCLUDE_LIST`  | Payout method include list not readable                  | invalid_request            | do_not_retry            |
| `ERROR_HOSTED_PAGE_UNRECOGNIZED_CARD`                            | Card token or issued card ID not recognized              | invalid_request            | do_not_retry            |

#### 4.12 Refund errors (D/refund-errors.md): 24 codes

| Code                                                               | Meaning (paraphrase)                                                    | Category (suggested)       | Retry class (suggested) |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------- | ----------------------- |
| `ERROR_ADDING_REFUND`                                              | Payment to refund not found (it must be closed)                         | invalid_request            | do_not_retry            |
| `ERROR_CREATE_PARTIAL_REFUND_NOT_READY`                            | Partial card refund temporarily unavailable; try after 24 hours         | provider_unavailable       | retry_conditionally     |
| `ERROR_CREATE_REFUND`                                              | Refund creation failed; check the payment and inputs                    | invalid_request            | manual_review           |
| `ERROR_CREATE_REFUND_AMOUNT_REQUIRED_FOR_OPEN_INSTALLMENT_PAYMENT` | Full refund of an installment payment that is not fully collected       | invalid_amount             | do_not_retry            |
| `ERROR_CREATE_REFUND_CURRENCY_NOT_VALID`                           | Refund currency not recognized                                          | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_DUPLICATE_EWALLET`                            | Same wallet listed twice                                                | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_EWALLET_ALREADY_FULLY_REFUNDED`               | Payment already fully refunded                                          | duplicate_request          | do_not_retry            |
| `ERROR_CREATE_REFUND_EWALLET_NOT_FOUND_IN_PAYMENT`                 | Wallet is not part of the payment                                       | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_EWALLETS_INCONSISTENCY`                       | Split refund mixes amount and percent                                   | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_INVALID_EWALLETS_AMOUNT`                      | A wallet refund amount is not positive                                  | invalid_amount             | do_not_retry            |
| `ERROR_CREATE_REFUND_INVALID_EWALLETS_PERCENTAGE`                  | A wallet refund percentage is not valid                                 | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_MISSING_EWALLET_ID`                           | Wallet ID missing in the split refund                                   | invalid_request            | do_not_retry            |
| `ERROR_CREATE_REFUND_PAYMENT_NOT_REFUNDABLE`                       | Payment method does not allow refunds                                   | payment_method_unavailable | do_not_retry            |
| `ERROR_GET_EWALLET_NOT_ENOUGH_FUNDS`                               | A wallet lacks funds to cover the refund                                | insufficient_funds         | retry_conditionally     |
| `ERROR_PREVIOUS_REFUND_WAS_NOT_PROPORTIONATE`                      | Earlier refund was non-proportional, so wallet amounts must be explicit | invalid_request            | do_not_retry            |
| `ERROR_QUERY_DATE_RANGE_EXCEEDS_90_DAYS`                           | List query date range longer than 90 days                               | invalid_request            | do_not_retry            |
| `ERROR_PAYMENT_METHOD_TYPE_DOES_NOT_SUPPORT_CANCEL_REFUND`         | Method does not support canceling a refund                              | payment_method_unavailable | do_not_retry            |
| `ERROR_REFUND_AMOUNT_EXCEEDS_PAYMENT_AMOUNT`                       | Total refunds would exceed the payment                                  | invalid_amount             | do_not_retry            |
| `ERROR_REFUND_REQUEST_FOR_PAYMENT_IN_DISPUTE`                      | Refund rejected because the payment is in dispute                       | invalid_request            | manual_review           |
| `ERROR_UPDATE_REFUND`                                              | Refund update failed or refund not found                                | invalid_request            | do_not_retry            |
| `INVALID_REFUND`                                                   | Refund not found                                                        | invalid_request            | do_not_retry            |
| `INVALID_REFUND_STATUS`                                            | Refund already completed and closed                                     | duplicate_request          | do_not_retry            |
| `INVALID_REFUND_TOKEN`                                             | Refund not found                                                        | invalid_request            | do_not_retry            |
| `PAYMENT_NOT_COMPLETED`                                            | Payment is not yet closed; refund after it closes                       | invalid_request            | retry_conditionally     |

#### 4.13 Dispute errors (D/dispute-errors.md): 4 codes

These concern creating a dispute against a payment; who calls this (sandbox simulation or a portal action) is not stated on the error page.

| Code                                              | Meaning (paraphrase)                                     | Category (suggested) | Retry class (suggested) |
| ------------------------------------------------- | -------------------------------------------------------- | -------------------- | ----------------------- |
| `ERROR_CREATE_DISPUTE_AMOUNT_EXCESSIVE`           | Disputes would exceed the unreversed part of the payment | invalid_amount       | do_not_retry            |
| `ERROR_CREATE_DISPUTE_AUTHORIZATION_NOT_COMPLETE` | Authorization status does not allow a dispute            | invalid_request      | manual_review           |
| `ERROR_CREATE_DISPUTE_CURRENCY_MISMATCH`          | Dispute currency differs from the payment currency       | invalid_request      | do_not_retry            |
| `ERROR_CREATE_DISPUTE_TOO_LATE`                   | More than 110 days since capture                         | invalid_request      | do_not_retry            |

#### 4.14 Payout errors (D/payout-errors.md): 73 codes

| Code                                                                | Meaning (paraphrase)                                                  | Category (suggested)       | Retry class (suggested)  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ------------------------ |
| `ERROR_CANCEL_PAYOUT`                                               | Payout type not cancelable, or payout already confirmed or completed  | invalid_request            | do_not_retry             |
| `ERROR_CONFIRM_PAYOUT`                                              | FX confirmation on a completed payout or one without FX               | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT`                                               | Required field missing or wrong                                       | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT_ABA_CONTAINS_NON_NUMERIC_CHARACTERS`           | ABA routing number has non-digits                                     | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT_ABA_LENGTH_NOT_VALID`                          | ABA routing number is not 9 digits                                    | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT_AMOUNT_UNKNOWN`                                | FX payout must give `sender_amount` or `payout_amount`, not both      | invalid_amount             | do_not_retry             |
| `ERROR_CREATE_PAYOUT_BENEFICIARY_COUNTRY_AND_BANK_COUNTRY_MISMATCH` | Beneficiary country differs from the bank country                     | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT_COUNTRY_NOT_SUPPORTED`                         | Sender or beneficiary country not supported by the method             | payment_method_unavailable | do_not_retry             |
| `ERROR_CREATE_PAYOUT_CURRENCY_NOT_SUPPORTED`                        | Sender or payout currency not supported by the method                 | payment_method_unavailable | do_not_retry             |
| `ERROR_CREATE_PAYOUT_PURPOSE_CODE_NOT_VALID`                        | Sender `purpose_code` not valid                                       | invalid_request            | do_not_retry             |
| `ERROR_CREATE_PAYOUT_TO_CARD_BANK_NOT_SUPPORTED`                    | Card issuer has not enabled receiving funds through this bank         | payment_method_unavailable | manual_review            |
| `ERROR_CREATE_PAYOUT_TO_CARD_CONTACT_ISSUER`                        | Problem with the payout card; cardholder should contact the issuer    | card_declined              | customer_action_required |
| `ERROR_CREATE_PAYOUT_TO_CARD_EXPIRED_CARD`                          | Payout card expired                                                   | card_declined              | customer_action_required |
| `ERROR_CREATE_PAYOUT_TO_CARD_NUMBER_NOT_VALID`                      | Payout card number not valid                                          | invalid_request            | customer_action_required |
| `ERROR_CREATE_PAYOUT_TO_CARD_SERVICE_NOT_SUPPORTED`                 | Card not enabled to receive funds                                     | payment_method_unavailable | customer_action_required |
| `ERROR_EXPIRATION_SENT_FOR_NON_CASH_PAYOUT`                         | `expiration` set on a non-cash payout                                 | invalid_request            | do_not_retry             |
| `ERROR_FEE_CURRENCY_IS_INVALID_OR_NOT_SUPPORTED`                    | `payout_fees.fee_currency` invalid or unsupported                     | invalid_request            | do_not_retry             |
| `ERROR_GET_PAYOUT`                                                  | Payout not found                                                      | invalid_request            | do_not_retry             |
| `ERROR_LOCATION_PROVIDED_FOR_PAYOUT_THAT_IS_NOT_LOCATION_SPECIFIC`  | `location` given for a method that is not location-specific           | invalid_request            | do_not_retry             |
| `ERROR_MISSING_FEE_CURRENCY`                                        | Stablecoin payout without `fee_currency`                              | invalid_request            | do_not_retry             |
| `ERROR_MISSING_MERCHANT_EWALLET`                                    | `merchant_ewallet` missing                                            | invalid_request            | do_not_retry             |
| `ERROR_MISSING_OR_INVALID_PAYOUT_AMOUNT`                            | `payout_amount` not recognized                                        | invalid_amount             | do_not_retry             |
| `ERROR_MISSING_PAYOUT_AMOUNT`                                       | `payout_amount` not set                                               | invalid_amount             | do_not_retry             |
| `ERROR_MISSING_PAYOUT_BENEFICIARY_COUNTRY`                          | Beneficiary country missing                                           | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_BENEFICIARY_ENTITY_TYPE`                      | Beneficiary entity type missing                                       | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_CURRENCY`                                     | `payout_currency` missing                                             | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_LOCATION`                                     | `location_id` missing for a location payout                           | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_METHOD_TYPE`                                  | `payout_method_type` missing                                          | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_SENDER_COUNTRY`                               | `sender_country` missing                                              | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_SENDER_CURRENCY`                              | `sender_currency` missing                                             | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_SENDER_ENTITY_TYPE`                           | Sender entity type missing                                            | invalid_request            | do_not_retry             |
| `ERROR_MISSING_PAYOUT_UPDATE_FIELDS`                                | Update without description or metadata                                | invalid_request            | do_not_retry             |
| `ERROR_PAYER_DETAILS_IN_REQUEST_AND_SAVED_PAYER_DETAILS_MISMATCH`   | Sender details differ from the request or saved sender                | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_AMOUNT_EXCEEDED_ORIGINAL_AMOUNT`                      | Sandbox completion of a payout already fully paid                     | duplicate_request          | do_not_retry             |
| `ERROR_PAYOUT_AMOUNT_EXCEEDS_BENEFICIARY_ACCOUNT_LIMIT`             | Amount over the beneficiary account's transfer limit                  | invalid_amount             | customer_action_required |
| `ERROR_PAYOUT_AMOUNT_LESS_THAN_MINIMUM`                             | Amount below the method minimum                                       | invalid_amount             | do_not_retry             |
| `ERROR_PAYOUT_AMOUNT_MORE_THAN_MAXIMUM`                             | Amount above the method maximum                                       | invalid_amount             | do_not_retry             |
| `ERROR_PAYOUT_AMOUNT_NOT_WITHIN_RANGE_OF_PAYOUT_METHOD_TYPE`        | Amount outside the method range                                       | invalid_amount             | do_not_retry             |
| `ERROR_PAYOUT_BENEFICIARY_ACCOUNT_UNAVAILABLE`                      | Beneficiary account cannot accept funds                               | payment_method_unavailable | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_BANK_REJECT`                              | Beneficiary bank rejected the payout                                  | payment_method_unavailable | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_BANK_REJECTION`                           | Beneficiary bank rejected the payout (same text as the previous code) | payment_method_unavailable | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_FIELDS_LENGTH_ABOVE_MAX [FIELD_NAMES]`    | Card payout: beneficiary field too long; names appended               | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_BENEFICIARY_FIELDS_NOT_FOUND`                         | Beneficiary fields not found; names appended                          | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_BENEFICIARY_FIELDS_NOT_VALID`                         | Beneficiary field values not valid; names appended                    | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_BENEFICIARY_IDENTIFICATION_AND_ACCOUNT_MISMATCH`      | Beneficiary ID does not match the account owner                       | invalid_request            | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_IDENTIFICATION_AND_NAME_MISMATCH`         | Beneficiary name does not match the identification                    | invalid_request            | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_NAME_AND_ACCOUNT_MISMATCH`                | Beneficiary name does not match the account owner                     | invalid_request            | customer_action_required |
| `ERROR_PAYOUT_BENEFICIARY_NOT_REACHABLE_BY_METHOD`                  | Beneficiary account not reachable by this method                      | payment_method_unavailable | customer_action_required |
| `ERROR_PAYOUT_COUNTRY_NOT_VALID`                                    | A country code is not valid                                           | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_CURRENCY_NOT_SUPPORTED`                               | Payout currency not supported for the beneficiary country             | payment_method_unavailable | do_not_retry             |
| `ERROR_PAYOUT_CURRENCY_NOT_VALID`                                   | A currency code is not valid                                          | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_IBAN_NOT_SUPPORTED_FOR_LOCAL_GBP`                     | IBAN cannot receive a local GBP payout                                | payment_method_unavailable | customer_action_required |
| `ERROR_PAYOUT_NAME_NOT_VALID`                                       | Beneficiary or sender name not valid                                  | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_NOT_CANCELABLE`                                       | Payout method type does not allow cancellation                        | invalid_request            | do_not_retry             |
| `ERROR_PAYOUT_SENDER_FIELDS_LENGTH_ABOVE_MAX [FIELD_NAMES]`         | Card payout: sender field too long; names appended                    | invalid_request            | do_not_retry             |
| `ERROR_UNSUPPORTED_PAYOUT_CURRENCY_OR_COUNTRY`                      | Country, currency or entity type combination not supported            | invalid_request            | do_not_retry             |
| `ERROR_UPDATE_NON_ACTIVE_PAYOUT`                                    | Update on a payout whose status is not created                        | invalid_request            | do_not_retry             |
| `ERROR_UPDATE_PAYOUT`                                               | Payout to update not found                                            | invalid_request            | do_not_retry             |
| `ERROR_VOID_PAYOUT_INVOICE`                                         | Tried to void an invoice of type payout                               | invalid_request            | do_not_retry             |
| `ERROR_WALLET_FX_PAYOUT_NOT_SUPPORTED`                              | Payout to a wallet with different sender and payout currencies        | invalid_request            | do_not_retry             |
| `INVALID_BENEFICIARY_PAYOUT_ENTITY_TYPE`                            | Beneficiary `entity_type` not individual or company                   | invalid_request            | do_not_retry             |
| `INVALID_DESTINATION_CURRENCY`                                      | Payout currency code not recognized                                   | invalid_request            | do_not_retry             |
| `INVALID_PAYER_FIELDS`                                              | A sender field is not valid; name appended                            | invalid_request            | do_not_retry             |
| `INVALID_PAYER_PAYOUT_ENTITY_TYPE`                                  | Sender entity type not individual or company                          | invalid_request            | do_not_retry             |
| `INVALID_PAYOUT`                                                    | `payout_type` not found                                               | invalid_request            | do_not_retry             |
| `INVALID_PAYOUT_CURRENCIES`                                         | Sender or payout currency unsupported for the method type             | payment_method_unavailable | do_not_retry             |
| `INVALID_PAYOUT_ID`                                                 | Hosted payout tracker page with a bad `payout_id`                     | invalid_request            | do_not_retry             |
| `INVALID_PAYOUT_METHOD_TYPE`                                        | Payout method type not recognized                                     | invalid_request            | do_not_retry             |
| `INVALID_PAYOUT_TYPE`                                               | `category` not valid                                                  | invalid_request            | do_not_retry             |
| `INVALID_REQUIRED_FIELD`                                            | A payout field fails its regex; name appended                         | invalid_request            | do_not_retry             |
| `MISSING_PAYOUT_BENEFICIARY_COUNTRY`                                | `beneficiary_country` missing or not recognized                       | invalid_request            | do_not_retry             |
| `MISSING_PAYOUT_METHOD_REQUIRED_FIELDS`                             | Required payout fields missing; names appended                        | invalid_request            | do_not_retry             |
| `PAYOUT_METHOD_TYPE_BENEFICIARY_COUNTRY_MISMATCH`                   | Payout method type not supported in the beneficiary country           | payment_method_unavailable | do_not_retry             |

#### 4.15 Sender and beneficiary errors (D/sender-errors.md, D/beneficiary-errors.md): 4 + 8 codes

These two pages are not part of the catalog page D/rapyd-error-codes.md.

| Code                                      | Meaning (paraphrase)                         | Category (suggested) | Retry class (suggested) |
| ----------------------------------------- | -------------------------------------------- | -------------------- | ----------------------- |
| `ERROR_CREATE_SENDER_COUNTRY_NOT_VALID`   | Sender country missing or not recognized     | invalid_request      | do_not_retry            |
| `ERROR_CREATE_SENDER_CURRENCY_NOT_VALID`  | Sender currency missing or not recognized    | invalid_request      | do_not_retry            |
| `ERROR_GET_PAYER`                         | Payout sender not found                      | invalid_request      | do_not_retry            |
| `ERROR_INVALID_PAYOUT_SENDER_ENTITY_TYPE` | Sender entity type not company or individual | invalid_request      | do_not_retry            |

| Code                                                                          | Meaning (paraphrase)                                           | Category (suggested) | Retry class (suggested) |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------- | ----------------------- |
| `ERROR_BENEFICIARY_DETAILS_IN_REQUEST_AND_SAVED_BENEFICIARY_DETAILS_MISMATCH` | Request details differ from the saved beneficiary              | invalid_request      | do_not_retry            |
| `ERROR_CREATE_BENEFICIARY`                                                    | Beneficiary country not recognized                             | invalid_request      | do_not_retry            |
| `ERROR_CREATE_BENEFICIARY_COUNTRY_NOT_VALID`                                  | Beneficiary `country` not recognized                           | invalid_request      | do_not_retry            |
| `ERROR_CREATE_BENEFICIARY_CURRENCY_NOT_VALID`                                 | Beneficiary `currency` missing or not recognized               | invalid_request      | do_not_retry            |
| `ERROR_DELETE_PAYOUT_BENEFICIARY`                                             | Beneficiary to delete not found                                | invalid_request      | do_not_retry            |
| `ERROR_GET_BENEFICIARY`                                                       | Beneficiary not found                                          | invalid_request      | do_not_retry            |
| `ERROR_UPDATE_BENEFICIARY_WITH_NO_NEW_FIELDS`                                 | Update tried to change a beneficiary field that is already set | invalid_request      | do_not_retry            |
| `ERROR_VALIDATE_PAYOUT_BENEFICIARY`                                           | Beneficiary validation found bad input fields                  | invalid_request      | do_not_retry            |

#### 4.16 Wallet transaction errors (D/wallet-transaction-errors.md): 30 codes

| Code                                                                               | Meaning (paraphrase)                                             | Category (suggested)  | Retry class (suggested)  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- | ------------------------ |
| `CANCEL_TRANSACTION_ERROR`                                                         | Wallet transaction to cancel not found                           | invalid_request       | do_not_retry             |
| `COMPLETE_TRANSACTION_ERROR`                                                       | Wallet transaction to complete not found                         | invalid_request       | do_not_retry             |
| `ERROR_AMOUNT_EXCEEDS_DESTINATION_EWALLET_LIMIT`                                   | Amount would push the destination wallet over its currency limit | invalid_amount        | do_not_retry             |
| `ERROR_AMOUNT_EXCEEDS_DESTINATION_EWALLET_LIMIT_BY_MERCHANT_CONTROLLED_PARAMETERS` | Amount would exceed the destination wallet's balance limit       | invalid_amount        | do_not_retry             |
| `ERROR_BALANCE_TRANSFER`                                                           | Converted funds could not go to a disabled destination wallet    | configuration         | manual_review            |
| `ERROR_CARD_AUTHENTICATION_FAILURE`                                                | 3DS not completed in time; payment canceled                      | authentication_failed | customer_action_required |
| `ERROR_CREATE_TRANSFER`                                                            | Source or destination wallet not found                           | invalid_request       | do_not_retry             |
| `ERROR_EWALLET_ACCOUNT_LIMIT_EXCEEDS_CURRENT_BALANCE`                              | New account limit is below the current balance                   | invalid_amount        | do_not_retry             |
| `ERROR_EWALLET_LIMIT_NOT_VALID`                                                    | Account limit not a positive number                              | invalid_amount        | do_not_retry             |
| `ERROR_EWALLET_TRANSFER_DESTINATION_EWALLET_DISABLED`                              | Destination wallet disabled                                      | configuration         | do_not_retry             |
| `ERROR_EWALLET_TRANSFER_ID_NOT_FOUND`                                              | Transfer ID for the response not found                           | invalid_request       | do_not_retry             |
| `ERROR_EWALLET_TRANSFER_SOURCE_EWALLET_DISABLED`                                   | Source wallet disabled                                           | configuration         | do_not_retry             |
| `ERROR_EWALLET_TRANSFER_SOURCE_EWALLET_NOT_FOUND`                                  | Source wallet not found (text refers to a phone number)          | invalid_request       | do_not_retry             |
| `ERROR_GET_ACCOUNT_FUNDS_DETAILS`                                                  | Transaction (UUID) not found                                     | invalid_request       | do_not_retry             |
| `ERROR_GET_ISSUING_TRANSACTION`                                                    | Transfer to a virtual account not found                          | invalid_request       | do_not_retry             |
| `ERROR_GET_TRANSACTION`                                                            | Transaction not found for this wallet                            | invalid_request       | do_not_retry             |
| `ERROR_REMOVE_ACCOUNT_LIMIT`                                                       | Account limit to remove does not exist                           | invalid_request       | do_not_retry             |
| `ERROR_RESPONSE_TRANSFER`                                                          | Response to a transfer the transferee already declined           | invalid_request       | do_not_retry             |
| `ERROR_TRANSFER_FUNDS_DESTINATION_AND_SOURCE_CANNOT_BE_THE_SAME`                   | Source and destination wallet are the same                       | invalid_request       | do_not_retry             |
| `ERROR_TRANSFER_RESPONSE_INVALID_DETAILS`                                          | Transfer for the response not found                              | invalid_request       | do_not_retry             |
| `ERROR_TRANSFER_RESPONSE_PREVIOUSLY_CANCELED`                                      | Response to a transfer the sender already canceled               | invalid_request       | do_not_retry             |
| `ERROR_TRANSFER_RESPONSE_PREVIOUSLY_DECLINED`                                      | Response to a transfer the transferee already declined           | invalid_request       | do_not_retry             |
| `ERROR_UPDATE_FUNDS`                                                               | Wallet for add or remove funds not found                         | invalid_request       | do_not_retry             |
| `INVALID_TRANSACTION_ID`                                                           | Transaction not found or not linked to the wallet                | invalid_request       | do_not_retry             |
| `INVALID_TRANSFER_DETAILS`                                                         | Transfer inputs (currency or wallet IDs) not valid               | invalid_request       | do_not_retry             |
| `INVALID_TRANSFER_STATUS`                                                          | Transfer response `status` not accept, decline or cancel         | invalid_request       | do_not_retry             |
| `NOT_ENOUGH_FUNDS`                                                                 | Not enough funds in the required currency                        | insufficient_funds    | retry_conditionally      |
| `TRANSFER_DESTINATION_USER_ID_IS_INVALID`                                          | Destination wallet not found                                     | invalid_request       | do_not_retry             |
| `WALLET_TO_WALLET_TRANSFER_EXPIRED`                                                | Transfer already expired before the response                     | invalid_request       | do_not_retry             |
| `WALLET_TRANSFER_NOT_ALLOWED_FOR_COLLECT_WALLET`                                   | Transfers not allowed for a collect-type client wallet           | configuration         | do_not_retry             |

Three Wallet Errors codes (D/wallet-errors.md, otherwise out of scope) are used by in-scope pages and are listed here:

| Code                              | Meaning (paraphrase)                                                                     | Category (suggested) | Retry class (suggested) |
| --------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- | ----------------------- |
| `ERROR_GET_USER`                  | Wallet not found or deleted                                                              | invalid_request      | do_not_retry            |
| `ERROR_INVALID_EWALLET`           | Wallet ID not recognized (used as the envelope example on the Error Messages page)       | invalid_request      | do_not_retry            |
| `ERROR_WALLET_INSUFFICIENT_FUNDS` | Source wallet lacks funds in the currency (400 sample of Transfer Funds Between Wallets) | insufficient_funds   | retry_conditionally     |

#### 4.17 Sandbox simulated errors (D/simulated-errors.md, D/error-simulation.md): 6 codes

In the sandbox, amounts in fixed ranges produce errors: 4000-4009 (gateway not responding, all payment types), 2000-2009 (settlement declined), 2020-2029 (settlement pending on the gateway), 2080-2089 (processor unavailable), 2120-2129 (insufficient funds, redirect payments), 2180-2189 (payment expired, redirect payments). "Payments with an amount that matches one of the ranges listed above will have the associated error in the `failure_code` parameter." Test cards 4111111111111105, 4111111111111143 and 4111111111111151 produce network codes 05, 43 and 51 (D/card-numbers-for-testing.md). A parser should flag these as sandbox artifacts when the amount or card matches.

| Code                                                  | Meaning (paraphrase)                                                         | Category (suggested) | Retry class (suggested)  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ------------------------ |
| `ERROR_CREATE_PAYMENT_GATEWAY_NOT_RESPONDING`         | Sandbox: amount 4000-4009; the text calls the simulated error INTERNAL_ERROR | provider_unavailable | retry_conditionally      |
| `ERROR_PROCESS_PAYMENT_EXPIRED`                       | Sandbox: payment expired                                                     | unknown              | customer_action_required |
| `ERROR_PROCESS_PAYMENT_INSUFFICIENT_FUNDS`            | Sandbox: insufficient funds in the source                                    | insufficient_funds   | customer_action_required |
| `ERROR_PROCESS_PAYMENT_PROCESSOR_UNAVAILABLE`         | Sandbox: processor unavailable                                               | provider_unavailable | retry_conditionally      |
| `ERROR_PROCESS_PAYMENT_SETTLEMENT_DECLINED`           | Sandbox: settlement declined                                                 | unknown              | manual_review            |
| `ERROR_PROCESS_PAYMENT_SETTLEMENT_PENDING_ON_GATEWAY` | Sandbox: settlement still pending on the gateway                             | unknown              | manual_review            |

#### 4.18 Codes seen only in examples: 9 codes

These appear in documented samples but in no error table read. They are listed so a parser recognizes them, with meanings limited to what the sample shows.

| Code                                                    | Meaning (paraphrase)                                                                                                                 | Category (suggested) | Retry class (suggested) |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------- |
| `ERROR_CAPTURE_PAYMENT_IS_EXIPRED`                      | Capture Payment 400 sample (spelling as printed); message only says to contact support. Meaning NOT DOCUMENTED                       | unknown              | manual_review           |
| `ERROR_GET_SENDER`                                      | `gc_error_code` value in the PAYOUT_CREATION_FAILED example. Meaning NOT DOCUMENTED                                                  | unknown              | manual_review           |
| `ERROR_INVALID_PARAMETER_VALUE`                         | `response_code` in an Update Payment sample whose `error_code` is IMMUTABLE_FIELD; currency cannot change after creation             | invalid_request      | do_not_retry            |
| `ERROR_PAYMENT_IS_NOT_UPDATABLE`                        | Update Payment 400 sample; message only says to contact support. Meaning NOT DOCUMENTED                                              | unknown              | manual_review           |
| `IMMUTABLE_FIELD`                                       | `error_code` in the same Update Payment sample; a field cannot change after creation                                                 | invalid_request      | do_not_retry            |
| `INVALID_AMOUNT`                                        | Create Refund 400 sample: amount missing, not a number or out of bounds                                                              | invalid_amount       | do_not_retry            |
| `NOT_IMPLEMENTED`                                       | `gc_error_code` value in the PAYOUT_CREATED example. Meaning NOT DOCUMENTED                                                          | unknown              | manual_review           |
| `MISSING_PAYOUT_METHOD_REQUIRED_FIELD - [PHONE_NUMBER]` | `gc_error_code` in the PAYOUT_FAILED example; singular form of MISSING_PAYOUT_METHOD_REQUIRED_FIELDS with the field name in brackets | invalid_request      | do_not_retry            |
| `MISSING_INVALID_PARAMETERS`                            | OpenAPI 400 example: a parameter is missing or invalid                                                                               | invalid_request      | do_not_retry            |

#### 4.19 Count summary

| Table                                        | Rows    | Distinct                                           |
| -------------------------------------------- | ------- | -------------------------------------------------- |
| 4.1 General                                  | 15      | 15                                                 |
| 4.2 Authentication                           | 4       | 4                                                  |
| 4.3 Payment method                           | 11      | 11                                                 |
| 4.4 Payment                                  | 112     | 111                                                |
| 4.5 Card transaction                         | 13      | 13                                                 |
| 4.8 Bank transfer reversal                   | 8       | 8                                                  |
| 4.9 Foreign exchange                         | 10      | 10                                                 |
| 4.10 Checkout                                | 35      | 35                                                 |
| 4.11 Hosted page                             | 13      | 13                                                 |
| 4.12 Refund                                  | 24      | 24                                                 |
| 4.13 Dispute                                 | 4       | 4                                                  |
| 4.14 Payout                                  | 73      | 73                                                 |
| 4.15 Sender + beneficiary                    | 12      | 12                                                 |
| 4.16 Wallet transaction + cited wallet codes | 33      | 33                                                 |
| 4.17 Sandbox simulated                       | 6       | 6                                                  |
| 4.18 Example-only                            | 9       | 9                                                  |
| **String error codes, all tables**           | **382** | **373** (codes shared between tables counted once) |
| 4.6 Card network codes                       | 105     | 104                                                |
| 4.7 Merchant advice codes                    | 18      | 18                                                 |
| **Total**                                    | **505** | **495**                                            |
| Not counted: sandbox amount ranges (4.17)    | 6       | 6                                                  |

### 5. Lifecycle

Payments, refunds, disputes, payouts and wallet transfers are separate objects with separate status vocabularies. The same three-letter value means different things per object (`CLO` is a closed payment, a closed transfer and a closed webhook delivery), so status must always be read together with the object type. D/rapyd-disburse.md: "**payouts** or **disbursements** will always mean moving money from a Client Wallet or User Wallet to another 3rd party payment method type. A **transfer** will always mean moving money between Rapyd Wallets."

#### 5.1 Payments (Collect)

Payment `status` (D/create-payment.md):

| Value | Meaning                                            |
| ----- | -------------------------------------------------- |
| `ACT` | Active, waiting for 3DS or capture; can be updated |
| `CAN` | Canceled by the client or the customer's bank      |
| `CLO` | Closed (completed; refunds require this status)    |
| `ERR` | Creating or completing the payment failed          |
| `EXP` | Expired                                            |
| `REV` | Reversed by Rapyd; see `cancel_reason`             |

`next_action`: `3d_verification` (card only), `pending_capture` (card, non-zero amount), `pending_confirmation` (non-card methods), `pending_offline_capture` (settles to CLO through clearing; can be refunded but not canceled; "Currently, relevant only to Shva Arena card payments"), `not_applicable`.

Flows documented:

- **Immediate capture**: `capture` true (the default) gives `CLO` directly for cards ("A card payment with `capture` set to **true** receives a **CLO** status immediately after the payment").
- **Authorize then capture**: `capture` false leaves `ACT` with `next_action` `pending_capture`; Capture Payment closes it (`paid`, `captured`, `paid_at`). Capture of "some or all" of the amount is allowed; whether a second capture is possible depends on the gateway (ERROR_MULTIPLE_CAPTURES_NOT_SUPPORTED).
- **3DS**: PAYMENT_SUCCEEDED is sent when the request is received; "In the case of card payments that trigger the 3DS challenge flow, the status will be **ACT** and the actual result of the payment will not be known until a later point in time." A failed 3DS later produces PAYMENT_FAILED (`ERR`) or the payment is canceled (ERROR_CARD_AUTHENTICATION_FAILURE).
- **Asynchronous methods** (cash, bank transfer, bank redirect, some e-wallets): `ACT` with `instructions`, `textual_codes` or `visual_codes`, then PAYMENT_COMPLETED when "the last required third-party action is completed", or PAYMENT_EXPIRED.
- **Cancel**: only for cancelable payments; gives `CAN` and PAYMENT_CANCELED.
- **Reversal**: Rapyd may reverse (`REV`, PAYMENT_REVERSED); for bank transfers the reason is in `failure_code` (section 4.8).
- **Update**: Update Payment on `ACT` payments triggers PAYMENT_UPDATED.
- Authorized versus captured versus settled: `captured` (boolean), `paid` ("fully captured"), `paid_at` ("Time of the last capture"), `is_partial`. Settlement to the merchant (wallet credit, payout to the merchant's bank) is **NOT DOCUMENTED** as a payment status.

#### 5.2 Refunds

- Only payments in `CLO` can be refunded; partial refunds are allowed up to the payment amount; money returns to the original payment method (D/refund.md). Rapyd advises running List Disputes before refunding.
- Refund `status`: `Pending` (for example methods that need customer action), `Completed`, `Rejected` ("rejected by the specific payment processor"), `Error` ("the payment object on which the refund is based is not in **closed** status"), `Canceled` (merchant canceled). Note the title case, unlike payment statuses.
- Webhooks: REFUND_COMPLETED, PAYMENT_REFUND_FAILED (status Error), PAYMENT_REFUND_REJECTED (status Rejected), PAYMENT_REFUND_UPDATED.
- The payment object keeps `refunded`, `refunded_amount`, `refunds` (array) and per-wallet `refunded_amount`.
- Refunds of split payments use `ewallets` and `proportional_refund`.

#### 5.3 Disputes

- Dispute `status` (D/retrieve-dispute.md and OpenAPI enum): `ACT` (active, awaiting merchant action), `RVW` (Rapyd reviewing the merchant's evidence), `PRA` (pre-arbitration), `ARB` (arbitration), `LOS` (merchant lost; funds deducted), `WIN` (merchant won; funds credited), `REV` (issuer reversed the dispute; funds credited; "Final status").
- D/card-disputes.md: Rapyd deducts the disputed amount from the client's wallet when the dispute arrives; evidence is submitted in the Client Portal; customers who completed 3DS "cannot dispute a payment on the basis of fraud".
- `pre_dispute` true means the payment was refunded automatically "based on pre-determined criteria".
- Webhooks: PAYMENT_DISPUTE_CREATED, PAYMENT_DISPUTE_UPDATED (each "sent when the last required third-party action is completed").
- A payment carries a `dispute` object when disputed. A refund of a disputed payment is rejected (ERROR_REFUND_REQUEST_FOR_PAYMENT_IN_DISPUTE).

#### 5.4 Payouts (Disburse)

Payout `status` (D/create-payout.md):

| Value          | Meaning                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `Created`      | Created successfully                                                                                    |
| `Confirmation` | Waiting for confirmation of the FX rate                                                                 |
| `Pending`      | Waiting for the beneficiary to accept the funds (payout to a Rapyd Wallet with `confirmation_required`) |
| `Hold`         | Bank payout under manual review by Rapyd Protect (a Quarantine Under Review webhook is also sent)       |
| `Completed`    | "The beneficiary received some or all payout funds"                                                     |
| `Declined`     | Failed inspection                                                                                       |
| `Error`        | Not created, or failed after creation                                                                   |
| `Canceled`     | Canceled                                                                                                |
| `Expired`      | Expired (cash payouts)                                                                                  |
| `Returned`     | Funds came back after completion                                                                        |

- Webhooks: PAYOUT_CREATED, PAYOUT_UPDATED, PAYOUT_COMPLETED (beneficiary received the funds, after the last third-party action), PAYOUT_FAILED, PAYOUT_CANCELED, PAYOUT_EXPIRED, PAYOUT_RETURNED (beneficiary rejected after completion, or the bank could not credit the account), PAYOUT_CREATION_FAILED (one item of a mass payout failed).
- Set Payout Response (accept or decline a payout to a Rapyd Wallet) triggers PAYOUT_COMPLETED or PAYOUT_FAILED.
- `paid_amount` is cumulative, so `Completed` can mean partial payment.
- Card payouts use the card network table in 4.6, including the eligibility codes.
- Payout status values are title case strings, unlike payment and transfer codes.

#### 5.5 Wallet transfers

- Transfer `status`: `PEN` (waiting for the transferee), `CLO` (accepted), `DEC` (declined by the transferee), `CAN` (canceled by the sender), `EXP` (no response before expiry), `HLD` (Rapyd Protect hold), `REJ` (rejected by Rapyd Protect).
- Set Transfer Response takes `status` `accept`, `decline` or `cancel` (request verbs, not statuses). The TRANSFER_FUNDS_BETWEEN_EWALLETS_RESPONSE webhook sample shows `data.status` `accept`, the verb, not the resulting state.
- Each side has a wallet transaction ID (`source_transaction_id`, `destination_transaction_id`, prefix `wt_`); the destination ID stays empty until accepted.
- Webhooks: TRANSFER_FUNDS_BETWEEN_EWALLETS_CREATED, TRANSFER_FUNDS_BETWEEN_EWALLETS_RESPONSE, TRANSFER_FUNDS_BETWEEN_EWALLETS_EXPIRED, TRANSFER_REQUEST_UPDATED (after a Rapyd Protect review; status `PEN` or `REJ`), TRANSFER_FUNDS (balance transfer inside one wallet; `data` is an array of two wallet transactions with status `CLOSED`), EWALLET_ADDED_FUNDS, EWALLET_REMOVED_FUNDS, EWALLET_TRANSFER_CREDITED and EWALLET_TRANSFER_DEBITED (transfers between organizations), and the legacy `TransferRequest` and deprecated `TransferCompleted`.
- The feature must be activated by Rapyd and applies to person, company and some client wallets (D/transfer-funds-between-wallets.md).

### 6. Webhooks

#### 6.1 Delivery

- One URL per account, set in the Client Portal (Developers > Webhooks > Management), with per-event checkboxes; "Rapyd recommends HTTPS endpoints" (D/defining-a-webhook-endpoint.md), while D/webhook-security.md says "Webhooks are sent with the HTTPS protocol".
- Method POST, `Content-Type: application/json`, headers `timestamp`, `salt`, `signature` (D/webhook-format.md). Webhook headers do not include `access_key`.
- Expected acknowledgement: **NOT DOCUMENTED** on the webhook pages. llms.txt says "respond quickly with a 2xx status".
- **Retries**: the webhook record has `status` NEW (not yet sent successfully), CLO (sent successfully), ERR ("the maximum number of retries was reached. The automatic retry process failed"), RET (resent), plus `attempts[]` (each with `error`, `http_status_code`, `http_response_body`, `http_response_headers`), `last_attempt_at` and `next_attempt_at` (D/retrieve-webhook.md). The retry interval and the maximum number of retries are **NOT DOCUMENTED**. Webhooks in ERR can be resent with Resend Webhook.
- **Ordering**: **NOT DOCUMENTED** on the webhook pages. llms.txt says "Delivery is at-least-once, so make handlers idempotent and tolerant of duplicate or out-of-order events."
- Timeout: the wrapper example shows `"timeout": 15000`, documented as "Internal".
- Source IP ranges: **NOT DOCUMENTED** on the pages read.

#### 6.2 Body fields

| Field                  | Meaning                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                   | Webhook ID, `wh_` + 32 hex characters                                                                                                                              |
| `type`                 | Webhook type, upper snake case for in-scope types; "The name in the Client Portal is different"                                                                    |
| `data`                 | The object (payment, refund, payout, dispute, transfer, wallet); usually the full object as in the REST `data`                                                     |
| `trigger_operation_id` | UUID of the operation that triggered the webhook; matches `status.operation_id` of the triggering REST call in the transfer sample                                 |
| `status`               | Delivery status NEW, CLO, ERR, RET (not the object status: "Inside the `data` object, some webhooks have another `status` field that refers to a different event") |
| `created_at`           | Unix seconds (the field table says string, samples are numbers)                                                                                                    |
| `extended_timestamp`   | Unix milliseconds                                                                                                                                                  |

"Synchronous webhooks contain exactly the same information as the `data` section of the response" (D/payment.md); payment webhooks are split into synchronous (canceled, failed, "Payment Pending", succeeded, updated) and asynchronous (captured, completed, expired, failed, reversed).

#### 6.3 Event types in scope

| Object             | Types                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment            | `PAYMENT_SUCCEEDED`, `PAYMENT_COMPLETED`, `PAYMENT_CAPTURED`, `PAYMENT_FAILED`, `PAYMENT_EXPIRED`, `PAYMENT_CANCELED`, `PAYMENT_REVERSED`, `PAYMENT_UPDATED`; "Payment Pending" is listed without a page or type name (**NOT DOCUMENTED**)                                                                                                   |
| Refund             | `REFUND_COMPLETED`, `PAYMENT_REFUND_FAILED`, `PAYMENT_REFUND_REJECTED`, `PAYMENT_REFUND_UPDATED`                                                                                                                                                                                                                                             |
| Dispute            | `PAYMENT_DISPUTE_CREATED`, `PAYMENT_DISPUTE_UPDATED`                                                                                                                                                                                                                                                                                         |
| Payout             | `PAYOUT_CREATED`, `PAYOUT_UPDATED`, `PAYOUT_COMPLETED`, `PAYOUT_FAILED`, `PAYOUT_CANCELED`, `PAYOUT_EXPIRED`, `PAYOUT_RETURNED`, `PAYOUT_CREATION_FAILED`                                                                                                                                                                                    |
| Wallet transaction | `TRANSFER_FUNDS_BETWEEN_EWALLETS_CREATED`, `TRANSFER_FUNDS_BETWEEN_EWALLETS_RESPONSE`, `TRANSFER_FUNDS_BETWEEN_EWALLETS_EXPIRED`, `TRANSFER_REQUEST_UPDATED`, `TRANSFER_FUNDS`, `EWALLET_ADDED_FUNDS`, `EWALLET_REMOVED_FUNDS`, `EWALLET_TRANSFER_CREDITED`, `EWALLET_TRANSFER_DEBITED`, `TransferRequest`, `TransferCompleted` (deprecated) |

#### 6.4 Signature (sensitive; PandaPayLens does not verify it)

- Webhooks: `signature = BASE64 ( HASH ( url_path + salt + timestamp + access_key + secret_key + body_string ) )`, HASH being HMAC-SHA256, `url_path` "the entire URL that was configured for your company to receive webhooks", body without whitespace outside strings (D/webhook-authentication.md).
- REST requests: the same with `http_method` (lower case) first and the request path (D/request-signatures.md). The code samples Base64-encode the hexadecimal digest text (for example `Buffer.from(hash.digest("hex")).toString("base64")`), so a signature is usually 88 characters ending in `==`.
- `salt` and `timestamp` are not secret but belong to the signature; `access_key` appears in REST request headers. PandaPayLens should redact `signature`, `access_key` and any `secret_key`, may report "signature present", and must never ask for the secret key.

#### 6.5 Duplicates

- The webhook `id` (`wh_...`) identifies one webhook. The Resend Webhook sample returns the same `wh_` ID with `status` RET, so a resent webhook keeps its ID. Suggested dedupe key: `id`; fall back to `type` + `data.id` (or `data.token` for disputes) + object status + `created_at` when the ID is missing.
- REST idempotency: the optional `idempotency` header; "If the `idempotency` header value is the same in another request in the next 24 hours, the second request is determined to be idempotent and the response to the first request is returned again". By default this applies to Create Payment only and also compares `amount` (not `currency`); support can enable it for all POST requests. In the idempotent samples the replayed response has the same `operation_id` as the first one. IDEMPOTENCY_ERROR says a reused value is rejected; which configuration produces which behavior is not explained (section 10).

### 7. Identifiers

| Field                                                                                                                          | Scope                          | Notes                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status.operation_id`                                                                                                          | One API operation              | UUID; replayed unchanged for idempotent repeats                                                                                                                                         |
| `trigger_operation_id`                                                                                                         | Webhook                        | Links a webhook to the triggering operation                                                                                                                                             |
| `id` (webhook body), `token` (webhook record in Retrieve/List/Resend)                                                          | Webhook                        | `wh_` + 32 hex                                                                                                                                                                          |
| `data.id` (payment)                                                                                                            | Payment                        | `payment_` + 32 hex                                                                                                                                                                     |
| `id` (refund), `payment`                                                                                                       | Refund and its parent payment  | `refund_`; `payment` holds the `payment_` ID; `payment_created_at` too                                                                                                                  |
| `token`, `original_transaction_id`                                                                                             | Dispute and its parent payment | Dispute ID is in `token` (`dispute_`); `id` is "Reserved" and is a UUID in samples                                                                                                      |
| `id` (payout)                                                                                                                  | Payout                         | `payout_`; `uetr` for international payouts; `crypto_payout_hash` for stablecoin payouts                                                                                                |
| `id` (transfer), `source_transaction_id`, `destination_transaction_id`                                                         | Wallet transfer                | Transfer ID is a UUID; wallet transactions are `wt_`                                                                                                                                    |
| `ewallet_id`, `ewallets[].ewallet_id`, `ewallets[].ewallet`, `merchant_ewallet`, `source_ewallet_id`, `destination_ewallet_id` | Rapyd Wallets                  | `ewallet_` + 32 hex; the key name differs between payment (`ewallet_id`) and refund (`ewallet`) arrays                                                                                  |
| `customer_token`                                                                                                               | Customer                       | `cus_`                                                                                                                                                                                  |
| `payment_method`                                                                                                               | Stored payment method          | `card_...` or `other_...`; null for one-time methods                                                                                                                                    |
| `payment_method_data.fingerprint_token`                                                                                        | Card fingerprint               | `ocfp_`                                                                                                                                                                                 |
| `beneficiary.id`, `sender.id`                                                                                                  | Payout parties                 | `beneficiary_`, `sender_`                                                                                                                                                               |
| `merchant_reference_id`                                                                                                        | Merchant reference             | Up to 45 characters; present on payment, refund, payout and dispute                                                                                                                     |
| `transaction_id`, `transaction_link_id`, `network_reference_id`, `payment_account_reference`, `auth_code`                      | Card scheme and processor      | `transaction_id` is "ID of the associated transaction" and empty in many samples; `transaction_link_id` "A unique transaction identifier"; PAR values start with `V001` in Visa samples |
| `original_payment`                                                                                                             | Merchant-initiated follow-up   | Sandbox only per the field table; reauthorizations reference it                                                                                                                         |
| `mid`                                                                                                                          | Merchant ID at the processor   | "Reserved"; `mid_` in one sample, empty elsewhere                                                                                                                                       |
| `metadata`                                                                                                                     | Merchant-defined object        | Free-form                                                                                                                                                                               |

Correlation: refund to payment through `payment`; dispute to payment through `original_transaction_id`; payment to refunds through `refunds[]`; webhooks to API calls through `trigger_operation_id`; payouts have no parent payment. Payment and payout share `merchant_reference_id` only if the merchant reuses it.

### 8. Sensitive fields

Redact or mask by default (request fields included because request/response pairs get pasted):

- **Card data**: `payment_method.fields.number`, `cvv`, `expiration_month`, `expiration_year`, `name`; `payment_method_data.last4`, `bin_details.bin_number` (together with `last4`), `expiration_*`, `fingerprint_token`, `network_reference_id`, `payment_account_reference`; Apple Pay and Google Pay `decrypted_data` and tokens; payout card fields in `beneficiary`.
- **3DS**: `redirect_url` (embeds `redirection_data`), `authentication_result.cardholder_info`.
- **Signatures and secrets**: header `signature`, `access_key`, `secret_key` (never), `salt` and `timestamp` (low risk, but part of the signature).
- **Personal data**: `full_name`, `name`, `first_name`, `last_name`, `email`, `receipt_email`, `phone_number`, `date_of_birth`, `address` objects, `remitter_information`, `identification_type` / `identification_value`, sender and beneficiary objects (address, city, postcode, `date_of_birth`, `source_of_income`), `destination_phone_number`, `source_phone_number`.
- **Bank data**: `account_number`, IBAN, `bic_swift`, `ach_code`, `aba`, `sort_code`, `bank_name` in beneficiary and sender objects; mandate data.
- **Merchant and account identifiers**: `ewallet_` IDs, `customer_token`, `mid`, `organization_id` (refund webhook samples), `uri` (webhook URL), `complete_payment_url`, `error_payment_url`.
- Rapyd itself masks `identification_value` as `*********` in a beneficiary sample; masking is not consistent across samples.

### 9. Structural detection hints

Strong Rapyd signals (combine several):

1. **REST envelope**: top-level `status` is an **object** with exactly `error_code`, `status` (`SUCCESS`/`ERROR`), `message`, `response_code`, `operation_id` (UUID). On success `error_code`, `message` and `response_code` are empty strings. This shape alone is close to decisive.
2. **Prefixed IDs** with 32 lowercase hex characters: `payment_`, `refund_`, `payout_`, `dispute_`, `ewallet_`, `cus_`, `wh_`, `wt_`, `beneficiary_`, `sender_`; `ocfp_` fingerprints; `card_` / `other_` payment methods.
3. **Webhook body**: `id` `wh_...` + upper snake `type` (`PAYMENT_COMPLETED`, `PAYOUT_FAILED`, `PAYMENT_REFUND_REJECTED`) + `trigger_operation_id` (UUID) + `status` in {NEW, CLO, ERR, RET} + `created_at` + `extended_timestamp` (13 digits).
4. **Payment object**: `payment_method_type` like `gb_visa_card` or `sg_grabpay_wallet` (country prefix + method), `payment_method_type_category`, `status` in {ACT, CAN, CLO, ERR, EXP, REV}, `next_action`, `ewallets[]` with `percent`, `original_amount`, `fx_rate`, `merchant_requested_currency`, `visual_codes`, `textual_codes`.
5. **Error code shape**: upper snake codes, often `ERROR_` prefixed, and `ERROR_PROCESSING_CARD - [NN]`.
6. **Hosts**: `api.rapyd.net`, `sandboxapi.rapyd.net`, `sboxcheckout.rapyd.net`; paths `/v1/payments`, `/v1/payouts`, `/v1/refunds`, `/v1/disputes`, `/v1/ewallets/transfer`, `/v1/webhooks`.
7. **Headers**: `access_key`, `salt`, `timestamp`, `signature`, `idempotency` (lower case names without an `X-` prefix).

How this differs from supported providers:

- **Stripe**: `object` key and prefixes `pi_`, `ch_`, `evt_`; errors under `error.type`. Rapyd has no `object` key, and its error is under `status`.
- **Adyen**: `pspReference`, `resultCode`, `refusalReason`, `notificationItems`. None appear in Rapyd payloads.
- **payabl.**: URL-encoded `transactionid`, `errormessage`, `security`. Rapyd is JSON only.
- **Checkout.com**: top-level `response_code` (5 digits) with `response_summary`, IDs `pay_` / `act_`, webhook `type` in lower snake case with `created_on`. Rapyd's `response_code` is nested inside the `status` object and is an upper snake string.
- **PayPal**: errors with `name` + `debug_id`; webhooks with dotted `event_type` and `resource`. Rapyd types have no dots.
- **Braintree, Mollie, Square, Worldpay, Cybersource, Authorize.net**: their envelopes (`errors[]` with `category`, `resource` + `_links`, `errorName`, `submitTimeUtc` + `...Information` objects, `transactionResponse` / `messages.resultCode`) do not use a `status` object with `operation_id`.
- **Nuvei**: `internalRequestId`, `gwErrorCode`, string `status` `SUCCESS`/`ERROR` at top level. Rapyd's `SUCCESS`/`ERROR` sits one level down, inside `status`.
- **NMI**: query string `response`, `responsetext`, `transactionid`, `response_code`; Rapyd never uses query strings.
- **ECOMMPAY**: top-level `status` string (`error` / `success`) with `code` and `message`, or `project_id` + `payment` + `operation`. Rapyd's top-level `status` is an object.
- **Trustly**: error `message` values beginning `ERROR_` inside a JSON-RPC `error` with `version` "1.1". Rapyd's `ERROR_...` codes sit in `status.error_code`.
- **eZeeWallet, Inpay, AstroPay, MiFinity, Finrax, PXP, DECTA, Paymentwall and the other high-risk adapters**: their distinctive keys (`ezw_reference_id`, `inpay_unique_reference`, `deposit_external_id`, `{"payload": [...]}`, `clientPaymentId`, `eventCategory`, `"type": "order"` with `DE` numbers) do not occur in Rapyd payloads.
- Payout status strings (`Completed`, `Error`, `Canceled`) are generic words; never use them alone.

### 10. Limitations, ambiguities and documentation inconsistencies

1. **Four webhook shapes.** D/webhook-format.md shows an HTTP-client wrapper (`method`, `json`, `headers`, `uri`, `body`, `timeout`, `resolveWithFullResponse`) around the body. Most webhook pages show only the body. The refund webhook samples (completed, failed, rejected) show an internal record with `id` as a UUID, `token` as the `wh_` ID, `organization_id`, `org_pk`, `attempts`, `first_attempt_at`, `next_attempt_at`, `uri`, `status` "" and `created_at` 0. The PAYMENT_REFUND_UPDATED sample is a REST envelope from the webhook methods (`status` object + `data.token` + `data.type`). A parser must accept all four.
2. **Invalid example JSON.** Of the in-scope webhook samples, the payout (all eight), dispute (both), payment expired, funds added and removed, and most transfer samples fail to parse: missing commas, a merged line (`"merchant_reference_id": "GHY-0YU-HUJ-POIuetr": null` in PAYOUT_FAILED), non-breaking space characters (bytes C2 A0) before `extended_timestamp`, and a JavaScript object literal with single quotes and unquoted keys (TRANSFER_FUNDS). Field values in those samples are still usable as evidence of shape.
3. **`error_code` versus `response_code`.** The docs say they are the same, but an Update Payment 400 sample has `error_code` IMMUTABLE_FIELD and `response_code` ERROR_INVALID_PARAMETER_VALUE. A parser should read both and report a mismatch.
4. **Payout error fields.** `gc_error_code` is documented as "Reserved" and `error` as the last error code, yet the PAYOUT_FAILED sample has `error: null` and `gc_error_code: "MISSING_PAYOUT_METHOD_REQUIRED_FIELD - [PHONE_NUMBER]"`; PAYOUT_CREATED shows `gc_error_code: "NOT_IMPLEMENTED"` with status `Hold`; PAYOUT_CREATION_FAILED shows `ERROR_GET_SENDER`. None of these three values is in the catalog in that form. The PAYOUT_FAILED sample also has status `Declined`, not `Error`.
5. **Duplicate and conflicting codes.** ERROR_CREATE_PAYMENT_FOR_REAUTHORIZATION has two rows with different meanings. ERROR_INCREASING_PAYMENT_AMOUNT's message speaks of reducing the amount. Card network code `76` has two different meanings in two tables, and `81` and `82` have generic and Mastercard rows. Near duplicates: ERROR_PAYOUT_BENEFICIARY_BANK_REJECT and ..._REJECTION; ERROR_CHECKOUT_COUNTRY_CURRENCY_MISMATCH and ERROR_CHECKOUT_CURRENCY_COUNTRY_MISMATCH; ERROR_GET_FX_RATE and ERROR_GET_RATE; INVALID_PAYMENT and MISSING_PAYMENT.
6. **"Success" listed as errors.** Network codes `00`, `08` and `11` ("Success") and `10` ("Partial approval") are in the "Other Errors" table with the generic error text. Code `OK` means "Card not eligible for cross border funds disbursement", not success.
7. **Brackets in failure messages.** D/card-network-errors.md says the webhook `failure_message` is the short message in brackets (`"[Insufficient Funds]"`); the PAYMENT_FAILED and Create Payment error samples show it without brackets.
8. **Typos and spaces in codes**: `ERROR_CAPTURE_PAYMENT_IS_EXIPRED` (sample), `ERROR_CREATE_PAYMENT_BANK _TRANSFER_MANDATE_INCOMPLETE` and `ERROR_CREATE_PAYMENT_TRANSACTION_NOT _ALLOWED_FOR_THIS_TYPE_OF_ACCOUNT` (table). Live values may differ.
9. **Codes outside the tables**: nine codes appear only in samples (4.18); "INTERNAL_ERROR" is named in the simulated-error text but has no row; the four authentication codes are not in the in-scope catalog sections.
10. **Sample data inconsistencies**: a `gb_mastercard_card` payment method with `brand` VISA (PAYMENT_FAILED); `amount` 0 with `original_amount` 1065 and a wallet split of 1065 in the same sample; in the Create Payment error example `amount` 1065 with a wallet split of 7; `country_code` "au" in lower case; `receipt_number` documented as string but `0` in samples; `created_at` documented as string in webhook tables but numbers in samples; transfer `id` documented as "object" but a UUID string.
11. **Retry, acknowledgement and ordering** of webhooks are not specified on the webhook pages; only llms.txt states at-least-once delivery, 2xx acknowledgement and possible out-of-order delivery.
12. **Idempotency conflict**: D/idempotency.md says a repeated key within 24 hours returns the first response; IDEMPOTENCY_ERROR says a repeated key is rejected. The configuration that produces each behavior is not explained.
13. **Status vocabularies differ in case and form**: payments and transfers use three-letter codes, refunds and payouts use title case words, wallet transactions in TRANSFER_FUNDS use `CLOSED`, and transfer responses use verbs (`accept`). `CLO` and `REV` mean different things for payments, disputes, transfers and webhook records.
14. **Sandbox versus production**: D/environments.md warns that "there might be differences between the error codes in the sandbox and the error codes for various actual pay methods", and D/error-messages.md says external 3DS services may trigger different errors in each environment.
15. **Dated API versions** (`api_version`) can change responses and webhooks; which methods have them is not documented on the pages read, and payloads do not show the version.
16. **Webhooks page mismatch**: D/webhooks.md is about communication-thread webhooks, not the payment webhook overview its title suggests.
17. **Not read**: Partner API, Issuing, Verify, subscription and invoice webhooks, escrow and group payments, the Connectors section, 3DS how-to pages. Anything that would come only from them is **NOT DOCUMENTED** here.

### 11. Proposed capability statuses

| Capability           | Proposed      | Justification                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **errorDecoding**    | **supported** | 495 first-party code values with root cause and corrective action, a fixed `status` object, a documented suffix format for card network codes, and merchant advice codes with explicit retry timing. Example-only and simulated codes are flagged; unknown codes fall back to `unknown`. Suffix parsing (`- [NN]`, field names) must be tested against every documented form |
| **paymentResponses** | **supported** | Payment, refund, payout, dispute and transfer responses share one envelope; every method page has valid JSON samples (200 and 400); status vocabularies are enumerated in field tables and in the OpenAPI file                                                                                                                                                               |
| **webhookParsing**   | **limited**   | Event types and field tables are clear and the body is JSON with a stable core (`id`, `type`, `data`, `trigger_operation_id`, `status`, `created_at`). But samples come in four shapes, many are not valid JSON, retry and ordering are not documented on the webhook pages, and payout error fields are used differently from their descriptions                            |
| **timeline**         | **limited**   | Objects carry `created_at`, `updated_at`, `paid_at`, `transfer_response_at` and webhooks carry `created_at` and `extended_timestamp` (milliseconds), so events can be ordered. Ordering of deliveries is not guaranteed, PAYMENT_SUCCEEDED can mean "received" with status ACT, and settlement is not a payment state                                                        |
| **correlation**      | **supported** | Explicit links: refund `payment`, dispute `original_transaction_id`, payment `refunds[]`, webhook `trigger_operation_id` to REST `operation_id`, prefixed IDs per object type, and `merchant_reference_id` on all main objects. Payouts have no parent link, which is expected for this object                                                                               |
